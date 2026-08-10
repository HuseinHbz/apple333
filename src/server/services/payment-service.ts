import { randomUUID } from "node:crypto";

import { Prisma, type Refund } from "@prisma/client";

import {
  paymentRequestHash,
  paymentPayloadHash,
} from "@/modules/payments/idempotency";
import type {
  PaymentProvider,
  ProviderPaymentResult,
} from "@/modules/payments/provider";
import { PaymentProviderError } from "@/modules/payments/provider";
import { executeProviderOperation } from "@/modules/payments/provider-execution";
import {
  findPaymentDifference,
  type PaymentDifferenceType,
} from "@/modules/payments/reconciliation";
import { isPaymentSimulatorRuntimeAllowed } from "@/modules/payments/runtime-policy";
import {
  assertPaymentTransition,
  PaymentStateTransitionError,
} from "@/modules/payments/state-machine";
import { paymentSimulatorProvider } from "@/modules/payments/simulator-provider";
import type { PaymentDto, PaymentStatus } from "@/modules/payments/types";
import type {
  CreatePaymentInput,
  CreateRefundInput,
  InitializePaymentInput,
  PaymentCallbackInput,
  PaymentListQuery,
  ReconcilePaymentInput,
  VerifyPaymentInput,
} from "@/modules/payments/validators";
import { prisma } from "@/server/db/prisma";
import { AppError, AuthorizationError } from "@/server/errors/app-error";
import { log } from "@/server/logging/logger";
import {
  recordPaymentCallback,
  recordPaymentCommand,
  recordPaymentLifecycle,
} from "@/server/monitoring/metrics";
import {
  paymentRepository,
  type PaymentDetailRecord,
  type PaymentListRecord,
} from "@/server/repositories/payment-repository";
import {
  hasPermission,
  requirePermission,
  resolvePaymentBranchScope,
  type SessionActor,
} from "@/server/security/permissions";

type Transaction = Prisma.TransactionClient;

const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;
const PAYMENT_ATTEMPT_TTL_MS = 15 * 60 * 1_000;

export type PaymentAuditContext = Readonly<{
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}>;

function logPaymentOperation(
  context: PaymentAuditContext,
  payment: Readonly<{ id: string; orderId: string; provider: string }>,
  operation: string,
  result: "success" | "failure" | "replay",
  startedAt: number,
  errorCode?: string,
): void {
  const fields = {
    requestId: context.requestId,
    paymentId: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    operation,
    result,
    durationMs: Date.now() - startedAt,
    ...(errorCode ? { errorCode } : {}),
  };
  log(result === "failure" ? "warn" : "info", "payment_operation", fields);
}

type PaymentVisibility = Readonly<{
  financial: boolean;
  providerReference: boolean;
  audit: boolean;
}>;

export class PaymentServiceError extends AppError {
  public constructor(code: string, status: number, message: string) {
    super(code, status, message);
    this.name = "PaymentServiceError";
  }
}

function paymentError(code: string, status: number, message: string): never {
  throw new PaymentServiceError(code, status, message);
}

function isPrismaError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function isSerializationConflict(error: unknown): boolean {
  if (isPrismaError(error, "P2034")) return true;
  if (!isPrismaError(error, "P2010")) return false;
  const metadata = error.meta as Record<string, unknown> | undefined;
  return metadata?.code === "40001";
}

function mapPaymentError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof PaymentStateTransitionError) {
    paymentError(error.code, 409, "Payment state transition is not permitted.");
  }
  if (error instanceof PaymentProviderError) {
    paymentError(
      error.code,
      error.retryable ? 503 : 422,
      "The payment provider could not complete the operation.",
    );
  }
  if (isSerializationConflict(error)) {
    paymentError(
      "PAYMENT_VERSION_CONFLICT",
      409,
      "Payment changed concurrently; refresh and retry safely.",
    );
  }
  if (isPrismaError(error, "P2002")) {
    paymentError(
      "PAYMENT_DUPLICATE_REQUEST",
      409,
      "A duplicate payment operation was rejected.",
    );
  }
  throw error;
}

async function runPaymentTransaction<T>(
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      lastError = error;
    }
  }
  mapPaymentError(lastError);
}

function paymentNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PAY-${date}-${randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
}

function ensurePayment(
  record: PaymentDetailRecord | null,
): PaymentDetailRecord {
  if (!record) paymentError("PAYMENT_NOT_FOUND", 404, "Payment was not found.");
  return record;
}

function actorType(actor?: SessionActor): string {
  if (!actor) return "SYSTEM";
  return actor.isAdmin ? "ADMIN" : "CUSTOMER";
}

function writeAudit(
  transaction: Transaction,
  input: Readonly<{
    actor?: SessionActor;
    context: PaymentAuditContext;
    action: string;
    paymentId: string;
    metadata?: Prisma.InputJsonObject;
    before?: Prisma.InputJsonObject;
    after?: Prisma.InputJsonObject;
  }>,
) {
  return transaction.auditLog.create({
    data: {
      ...(input.actor ? { actorId: input.actor.id } : {}),
      actorType: actorType(input.actor),
      action: input.action,
      entityType: "Payment",
      entityId: input.paymentId,
      requestId: input.context.requestId,
      ...(input.context.ipAddress
        ? { ipAddress: input.context.ipAddress }
        : {}),
      ...(input.context.userAgent
        ? { userAgent: input.context.userAgent }
        : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.before ? { beforeSnapshot: input.before } : {}),
      ...(input.after ? { afterSnapshot: input.after } : {}),
    },
  });
}

function writeOutbox(
  transaction: Transaction,
  input: Readonly<{
    paymentId: string;
    eventType: string;
    version: number;
    paymentNumber: string;
    orderId: string;
    status: string;
  }>,
) {
  return transaction.paymentOutboxEvent.create({
    data: {
      paymentId: input.paymentId,
      eventType: input.eventType,
      aggregateVersion: input.version,
      payload: {
        paymentNumber: input.paymentNumber,
        orderId: input.orderId,
        status: input.status,
      },
    },
  });
}

async function replayIdempotency(
  scope: string,
  key: string,
  hash: string,
): Promise<PaymentDetailRecord | null> {
  const record = await prisma.paymentIdempotencyRecord.findUnique({
    where: { scope_key: { scope, key } },
  });
  if (!record) return null;
  if (record.requestHash !== hash) {
    paymentError(
      "PAYMENT_IDEMPOTENCY_CONFLICT",
      409,
      "The idempotency key was already used with another request.",
    );
  }
  if (record.expiresAt.getTime() < Date.now()) {
    paymentError(
      "PAYMENT_IDEMPOTENCY_EXPIRED",
      409,
      "The idempotency record has expired and cannot be reused.",
    );
  }
  return record.paymentId
    ? ensurePayment(await paymentRepository.findById(record.paymentId))
    : null;
}

function writeIdempotency(
  transaction: Transaction,
  input: Readonly<{
    scope: string;
    key: string;
    hash: string;
    responseReference: string;
    paymentId: string;
  }>,
) {
  return transaction.paymentIdempotencyRecord.create({
    data: {
      scope: input.scope,
      key: input.key,
      requestHash: input.hash,
      responseReference: input.responseReference,
      paymentId: input.paymentId,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS),
    },
  });
}

function visibilityFor(actor: SessionActor): PaymentVisibility {
  if (!actor.isAdmin) {
    return { financial: true, providerReference: false, audit: false };
  }
  return {
    financial: hasPermission(actor, "payments.read_financial"),
    providerReference: hasPermission(actor, "payments.provider_reference.read"),
    audit: hasPermission(actor, "payments.audit.read"),
  };
}

function mapPayment(
  record: PaymentDetailRecord,
  visibility: PaymentVisibility,
) {
  const base: PaymentDto = {
    id: record.id,
    orderId: record.orderId,
    orderNumber: record.order.orderNumber,
    paymentNumber: record.paymentNumber,
    currency: record.currency,
    amountRials: visibility.financial ? record.amountRials.toString() : null,
    status: record.status as PaymentStatus,
    method: record.method,
    provider: record.provider,
    version: record.version,
    paidAt: record.paidAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    attempts: record.attempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      provider: attempt.provider,
      amountRials: visibility.financial ? attempt.amountRials.toString() : null,
      currency: attempt.currency,
      status: attempt.status,
      redirectUrl: attempt.redirectUrl,
      expiresAt: attempt.expiresAt?.toISOString() ?? null,
      completedAt: attempt.completedAt?.toISOString() ?? null,
      createdAt: attempt.createdAt.toISOString(),
    })),
    transactions: record.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amountRials: visibility.financial
        ? transaction.amountRials.toString()
        : null,
      status: transaction.status,
      providerReference: visibility.providerReference
        ? transaction.providerReference
        : null,
      providerCode: visibility.audit ? transaction.providerCode : null,
      occurredAt: transaction.occurredAt.toISOString(),
    })),
    refunds: record.refunds.map((refund) => ({
      id: refund.id,
      amountRials: visibility.financial ? refund.amountRials.toString() : null,
      reason: visibility.audit ? refund.reason : "Refund requested",
      status: refund.status,
      createdAt: refund.createdAt.toISOString(),
      completedAt: refund.completedAt?.toISOString() ?? null,
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
  return {
    ...base,
    ...(visibility.audit
      ? {
          callbacks: record.callbacks.map((callback) => ({
            id: callback.id,
            externalEventId: callback.externalEventId,
            payloadHash: callback.payloadHash,
            signatureStatus: callback.signatureStatus,
            processingStatus: callback.processingStatus,
            failureCode: callback.failureCode,
            receivedAt: callback.receivedAt.toISOString(),
            processedAt: callback.processedAt?.toISOString() ?? null,
          })),
          reconciliation: record.reconciliationRecords.map((entry) => ({
            id: entry.id,
            internalStatus: entry.internalStatus,
            providerStatus: entry.providerStatus,
            differenceType: entry.differenceType,
            resolutionStatus: entry.resolutionStatus,
            checkedAt: entry.checkedAt.toISOString(),
          })),
          outbox: record.outboxEvents.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            aggregateVersion: event.aggregateVersion,
            status: event.status,
            occurredAt: event.occurredAt.toISOString(),
          })),
        }
      : {}),
  };
}

function assertCustomerOwnership(
  actor: SessionActor,
  payment: PaymentDetailRecord,
): void {
  if (actor.isAdmin) {
    assertAdminPaymentAccess(actor, payment);
    return;
  }
  if (!payment.order.customerId || payment.order.customerId !== actor.id) {
    throw new AuthorizationError();
  }
}

function assertAdminPaymentAccess(
  actor: SessionActor,
  payment: PaymentDetailRecord,
): void {
  requirePermission(actor, "payments.read");
  const branchScope = resolvePaymentBranchScope(actor);
  if (
    branchScope &&
    !payment.order.allocations.some(
      (allocation) => allocation.branchId === branchScope,
    )
  ) {
    throw new AuthorizationError();
  }
}

function assertReturnUrl(returnUrl: string): void {
  const candidate = new URL(returnUrl);
  const allowedOrigin = new URL(process.env.APP_URL ?? "http://127.0.0.1:3000")
    .origin;
  if (
    candidate.origin !== allowedOrigin ||
    !["http:", "https:"].includes(candidate.protocol) ||
    candidate.username ||
    candidate.password
  ) {
    paymentError(
      "PAYMENT_RETURN_URL_REJECTED",
      400,
      "The payment return URL must use the application origin.",
    );
  }
}

function providerFor(code: string): PaymentProvider {
  if (code !== "PAYMENT_SIMULATOR") {
    paymentError(
      "PAYMENT_PROVIDER_NOT_SUPPORTED",
      422,
      "The selected payment provider is not enabled.",
    );
  }
  if (!isPaymentSimulatorRuntimeAllowed()) {
    paymentError(
      "PAYMENT_PROVIDER_NOT_ENABLED",
      503,
      "No production payment provider is enabled for this release.",
    );
  }
  return paymentSimulatorProvider();
}

function assertSafeProviderPaymentResult(result: ProviderPaymentResult): void {
  const validStatuses = new Set([
    "PENDING",
    "AUTHORIZED",
    "PAID",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
  ]);
  const invalid =
    !validStatuses.has(result.status) ||
    result.authority.length < 8 ||
    result.authority.length > 200 ||
    result.amountRials < 0n ||
    !/^[A-Z]{3}$/.test(result.currency) ||
    result.providerCode.length < 1 ||
    result.providerCode.length > 120 ||
    Boolean(result.reference && result.reference.length > 200) ||
    (result.status === "PAID" && !result.reference) ||
    Boolean(result.expiresAt && Number.isNaN(result.expiresAt.getTime()));
  if (invalid) {
    throw new PaymentProviderError(
      "PROVIDER_INVALID_RESPONSE",
      "Provider returned an invalid canonical payment result.",
      false,
    );
  }
  if (!result.redirectUrl) return;
  try {
    const redirect = new URL(result.redirectUrl);
    const loopback = ["127.0.0.1", "localhost"].includes(redirect.hostname);
    if (
      !["http:", "https:"].includes(redirect.protocol) ||
      redirect.username ||
      redirect.password ||
      result.redirectUrl.length > 2_000 ||
      (process.env.NODE_ENV === "production" &&
        redirect.protocol !== "https:" &&
        !loopback)
    ) {
      throw new Error("unsafe redirect");
    }
  } catch {
    throw new PaymentProviderError(
      "PROVIDER_INVALID_RESPONSE",
      "Provider returned an unsafe redirect URL.",
      false,
    );
  }
}

function assertSafeProviderRefundResult(
  result: Awaited<ReturnType<PaymentProvider["refundPaymentWhenSupported"]>>,
): void {
  if (
    result.providerCode.length < 1 ||
    result.providerCode.length > 120 ||
    Boolean(result.reference && result.reference.length > 200) ||
    (result.succeeded && !result.reference)
  ) {
    throw new PaymentProviderError(
      "PROVIDER_INVALID_RESPONSE",
      "Provider returned an invalid canonical refund result.",
      false,
    );
  }
}

export async function createPaymentForOrder(
  actor: SessionActor,
  orderNumber: string,
  input: CreatePaymentInput,
  context: PaymentAuditContext,
) {
  const startedAt = Date.now();
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      customerId: true,
      currency: true,
      grandTotalRials: true,
      orderStatus: true,
      allocations: { select: { branchId: true } },
    },
  });
  if (!order) paymentError("ORDER_NOT_FOUND", 404, "Order was not found.");
  if (actor.isAdmin) {
    requirePermission(actor, "payments.initialize");
    const branchScope = resolvePaymentBranchScope(actor);
    if (
      branchScope &&
      !order.allocations.some(
        (allocation) => allocation.branchId === branchScope,
      )
    ) {
      throw new AuthorizationError();
    }
  } else if (order.customerId !== actor.id) {
    throw new AuthorizationError();
  }
  if (["CANCELLED", "REJECTED"].includes(order.orderStatus)) {
    paymentError(
      "PAYMENT_ORDER_NOT_PAYABLE",
      409,
      "A cancelled or rejected order cannot be paid.",
    );
  }
  if (order.currency !== "IRR" || order.grandTotalRials < 0n) {
    paymentError(
      "PAYMENT_MONEY_INVALID",
      409,
      "The persisted order amount or currency is not payable.",
    );
  }
  providerFor(input.provider);
  const scope = `payment:create:order:${order.id}`;
  const hash = paymentRequestHash({
    actorId: actor.id,
    orderId: order.id,
    provider: input.provider,
  });
  const replay = await replayIdempotency(scope, input.idempotencyKey, hash);
  if (replay) {
    recordPaymentCommand("create", "replay", Date.now() - startedAt);
    logPaymentOperation(context, replay, "create", "replay", startedAt);
    return mapPayment(replay, visibilityFor(actor));
  }

  let created = false;
  try {
    await runPaymentTransaction(async (transaction) => {
      const existing = await paymentRepository.findByOrderId(
        order.id,
        transaction,
      );
      if (existing) {
        await writeIdempotency(transaction, {
          scope,
          key: input.idempotencyKey,
          hash,
          responseReference: existing.id,
          paymentId: existing.id,
        });
        return;
      }
      const payment = await transaction.payment.create({
        data: {
          orderId: order.id,
          paymentNumber: paymentNumber(),
          currency: order.currency,
          amountRials: order.grandTotalRials,
          provider: input.provider,
        },
      });
      created = true;
      await writeOutbox(transaction, {
        paymentId: payment.id,
        eventType: "payment.created",
        version: payment.version,
        paymentNumber: payment.paymentNumber,
        orderId: payment.orderId,
        status: payment.status,
      });
      await writeAudit(transaction, {
        actor,
        context,
        action: "payment.created",
        paymentId: payment.id,
        after: {
          status: payment.status,
          currency: payment.currency,
          amountRials: payment.amountRials.toString(),
        },
      });
      await writeIdempotency(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        responseReference: payment.id,
        paymentId: payment.id,
      });
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      const raced = await replayIdempotency(scope, input.idempotencyKey, hash);
      if (raced) {
        recordPaymentCommand("create", "replay", Date.now() - startedAt);
        logPaymentOperation(context, raced, "create", "replay", startedAt);
        return mapPayment(raced, visibilityFor(actor));
      }
      const canonical = await paymentRepository.findByOrderId(order.id);
      if (canonical) {
        try {
          await runPaymentTransaction((transaction) =>
            writeIdempotency(transaction, {
              scope,
              key: input.idempotencyKey,
              hash,
              responseReference: canonical.id,
              paymentId: canonical.id,
            }),
          );
        } catch (idempotencyError) {
          if (!isPrismaError(idempotencyError, "P2002"))
            mapPaymentError(idempotencyError);
          const persisted = await replayIdempotency(
            scope,
            input.idempotencyKey,
            hash,
          );
          if (!persisted) mapPaymentError(idempotencyError);
        }
        recordPaymentCommand("create", "replay", Date.now() - startedAt);
        logPaymentOperation(context, canonical, "create", "replay", startedAt);
        return mapPayment(canonical, visibilityFor(actor));
      }
    }
    recordPaymentCommand("create", "failure", Date.now() - startedAt);
    logPaymentOperation(
      context,
      { id: "not-created", orderId: order.id, provider: input.provider },
      "create",
      "failure",
      startedAt,
      error instanceof Error ? error.name : "UNKNOWN",
    );
    mapPaymentError(error);
  }
  const payment = ensurePayment(
    await paymentRepository.findByOrderId(order.id),
  );
  recordPaymentCommand("create", "success", Date.now() - startedAt);
  if (created) recordPaymentLifecycle("created");
  logPaymentOperation(context, payment, "create", "success", startedAt);
  return mapPayment(payment, visibilityFor(actor));
}

export async function getCustomerPayment(actor: SessionActor, id: string) {
  const payment = ensurePayment(await paymentRepository.findById(id));
  assertCustomerOwnership(actor, payment);
  return mapPayment(payment, visibilityFor(actor));
}

export async function getOrderPayment(
  actor: SessionActor,
  orderNumber: string,
) {
  const payment = ensurePayment(
    await paymentRepository.findByOrderNumber(orderNumber),
  );
  assertCustomerOwnership(actor, payment);
  return mapPayment(payment, visibilityFor(actor));
}

async function markInitializationFailed(
  paymentId: string,
  attemptId: string,
  error: PaymentProviderError,
  context: PaymentAuditContext,
): Promise<void> {
  await runPaymentTransaction(async (transaction) => {
    const current = ensurePayment(
      await paymentRepository.findById(paymentId, transaction),
    );
    if (current.status !== "INITIALIZING") return;
    const transition = assertPaymentTransition("INITIALIZING", "FAILED");
    const version = current.version + 1;
    const updated = await transaction.payment.updateMany({
      where: { id: current.id, version: current.version },
      data: {
        status: "FAILED",
        version: { increment: 1 },
        failedAt: new Date(),
      },
    });
    if (updated.count !== 1)
      paymentError(
        "PAYMENT_VERSION_CONFLICT",
        409,
        "Payment changed concurrently.",
      );
    await transaction.paymentAttempt.update({
      where: { id: attemptId },
      data: {
        status: "FAILED",
        failureCode: error.code,
        completedAt: new Date(),
      },
    });
    await transaction.paymentTransaction.create({
      data: {
        paymentId: current.id,
        attemptId,
        type: "INITIALIZATION",
        amountRials: current.amountRials,
        status: "FAILED",
        providerCode: error.code,
        safeMetadata: { retryable: error.retryable },
      },
    });
    await writeOutbox(transaction, {
      paymentId: current.id,
      eventType: transition.eventType,
      version,
      paymentNumber: current.paymentNumber,
      orderId: current.orderId,
      status: "FAILED",
    });
    await writeAudit(transaction, {
      context,
      action: "payment.initialization.failed",
      paymentId: current.id,
      metadata: { errorCode: error.code, retryable: error.retryable },
      before: { status: current.status },
      after: { status: "FAILED" },
    });
  });
}

export async function initializePayment(
  actor: SessionActor,
  id: string,
  input: InitializePaymentInput,
  context: PaymentAuditContext,
) {
  const startedAt = Date.now();
  assertReturnUrl(input.returnUrl);
  const current = ensurePayment(await paymentRepository.findById(id));
  assertCustomerOwnership(actor, current);
  if (actor.isAdmin) requirePermission(actor, "payments.initialize");
  if (["CANCELLED", "REJECTED"].includes(current.order.orderStatus)) {
    paymentError("PAYMENT_ORDER_NOT_PAYABLE", 409, "Order is not payable.");
  }
  const provider = providerFor(current.provider);
  const scope = `payment:${id}:initialize`;
  const hash = paymentRequestHash({ id, input });
  const replay = await replayIdempotency(scope, input.idempotencyKey, hash);
  let initialized:
    | Readonly<{
        payment: PaymentDetailRecord;
        attempt: PaymentDetailRecord["attempts"][number];
      }>
    | undefined;
  if (replay) {
    const resumableAttempt = replay.attempts.find(
      (attempt) => attempt.idempotencyKey === input.idempotencyKey,
    );
    if (
      replay.status === "INITIALIZING" &&
      resumableAttempt?.status === "INITIALIZING" &&
      !resumableAttempt.providerAuthority
    ) {
      initialized = { payment: replay, attempt: resumableAttempt };
    } else {
      recordPaymentCommand("initialize", "replay", Date.now() - startedAt);
      logPaymentOperation(context, replay, "initialize", "replay", startedAt);
      return mapPayment(replay, visibilityFor(actor));
    }
  }

  const prepareInitialization = () =>
    runPaymentTransaction(async (transaction) => {
      const payment = ensurePayment(
        await paymentRepository.findById(id, transaction),
      );
      if (!["CREATED", "FAILED", "EXPIRED"].includes(payment.status)) {
        paymentError(
          "PAYMENT_INITIALIZATION_NOT_ALLOWED",
          409,
          "Payment cannot be initialized in its current state.",
        );
      }
      const transition = assertPaymentTransition(
        payment.status as PaymentStatus,
        "INITIALIZING",
      );
      const version = payment.version + 1;
      const updated = await transaction.payment.updateMany({
        where: { id: payment.id, version: payment.version },
        data: {
          status: "INITIALIZING",
          version: { increment: 1 },
          failedAt: null,
          expiresAt: new Date(Date.now() + PAYMENT_ATTEMPT_TTL_MS),
        },
      });
      if (updated.count !== 1)
        paymentError(
          "PAYMENT_VERSION_CONFLICT",
          409,
          "Payment changed concurrently.",
        );
      const attempt = await transaction.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: payment.attempts.length + 1,
          provider: payment.provider,
          amountRials: payment.amountRials,
          currency: payment.currency,
          status: "INITIALIZING",
          idempotencyKey: input.idempotencyKey,
          expiresAt: new Date(Date.now() + PAYMENT_ATTEMPT_TTL_MS),
        },
      });
      await transaction.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptId: attempt.id,
          type: "INITIALIZATION",
          amountRials: payment.amountRials,
          status: "PENDING",
          providerCode: "REQUEST_ACCEPTED",
        },
      });
      await writeOutbox(transaction, {
        paymentId: payment.id,
        eventType: transition.eventType,
        version,
        paymentNumber: payment.paymentNumber,
        orderId: payment.orderId,
        status: "INITIALIZING",
      });
      await writeAudit(transaction, {
        actor,
        context,
        action: "payment.initialization.requested",
        paymentId: payment.id,
        before: { status: payment.status },
        after: { status: "INITIALIZING", attemptNumber: attempt.attemptNumber },
      });
      await writeIdempotency(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        responseReference: attempt.id,
        paymentId: payment.id,
      });
      return { payment, attempt };
    });
  if (!initialized) {
    try {
      initialized = await prepareInitialization();
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        const raced = await replayIdempotency(
          scope,
          input.idempotencyKey,
          hash,
        );
        if (raced) {
          const resumableAttempt = raced.attempts.find(
            (attempt) => attempt.idempotencyKey === input.idempotencyKey,
          );
          if (
            raced.status === "INITIALIZING" &&
            resumableAttempt?.status === "INITIALIZING" &&
            !resumableAttempt.providerAuthority
          ) {
            initialized = { payment: raced, attempt: resumableAttempt };
          } else {
            recordPaymentCommand(
              "initialize",
              "replay",
              Date.now() - startedAt,
            );
            logPaymentOperation(
              context,
              raced,
              "initialize",
              "replay",
              startedAt,
            );
            return mapPayment(raced, visibilityFor(actor));
          }
        }
      }
      if (!initialized) {
        recordPaymentCommand("initialize", "failure", Date.now() - startedAt);
        logPaymentOperation(
          context,
          current,
          "initialize",
          "failure",
          startedAt,
          error instanceof Error ? error.name : "UNKNOWN",
        );
        mapPaymentError(error);
      }
    }
  }

  let providerResult: ProviderPaymentResult;
  try {
    providerResult = await executeProviderOperation((signal) =>
      provider.initializePayment({
        paymentId: initialized.payment.id,
        paymentNumber: initialized.payment.paymentNumber,
        amountRials: initialized.payment.amountRials,
        currency: initialized.payment.currency,
        returnUrl: input.returnUrl,
        idempotencyKey: input.idempotencyKey,
        scenario: input.scenario,
        signal,
      }),
    );
    assertSafeProviderPaymentResult(providerResult);
  } catch (error) {
    const providerError =
      error instanceof PaymentProviderError
        ? error
        : new PaymentProviderError(
            "PROVIDER_INVALID_RESPONSE",
            "Provider initialization failed.",
            false,
          );
    await markInitializationFailed(
      id,
      initialized.attempt.id,
      providerError,
      context,
    );
    recordPaymentCommand("initialize", "failure", Date.now() - startedAt);
    logPaymentOperation(
      context,
      current,
      "initialize",
      "failure",
      startedAt,
      providerError.code,
    );
    mapPaymentError(providerError);
  }

  if (
    providerResult.amountRials !== initialized.payment.amountRials ||
    providerResult.currency !== initialized.payment.currency
  ) {
    const mismatch = new PaymentProviderError(
      "PROVIDER_INVALID_RESPONSE",
      "Provider initialization amount mismatch.",
      false,
    );
    await markInitializationFailed(
      id,
      initialized.attempt.id,
      mismatch,
      context,
    );
    recordPaymentLifecycle("amount_mismatch");
    recordPaymentCommand("initialize", "failure", Date.now() - startedAt);
    logPaymentOperation(
      context,
      current,
      "initialize",
      "failure",
      startedAt,
      "PAYMENT_AMOUNT_MISMATCH",
    );
    paymentError("PAYMENT_AMOUNT_MISMATCH", 422, "Provider amount mismatch.");
  }

  const initializationApplied = await runPaymentTransaction(
    async (transaction) => {
      const payment = ensurePayment(
        await paymentRepository.findById(id, transaction),
      );
      if (payment.status !== "INITIALIZING") return false;
      const transition = assertPaymentTransition("INITIALIZING", "PENDING");
      const version = payment.version + 1;
      const updated = await transaction.payment.updateMany({
        where: { id: payment.id, version: payment.version },
        data: {
          status: "PENDING",
          version: { increment: 1 },
          expiresAt: providerResult.expiresAt,
        },
      });
      if (updated.count !== 1)
        paymentError(
          "PAYMENT_VERSION_CONFLICT",
          409,
          "Payment changed concurrently.",
        );
      await transaction.paymentAttempt.update({
        where: { id: initialized.attempt.id },
        data: {
          status: "PENDING",
          providerAuthority: providerResult.authority,
          providerReference: providerResult.reference,
          redirectUrl: providerResult.redirectUrl,
          providerStatus: providerResult.status,
          expiresAt: providerResult.expiresAt,
        },
      });
      await transaction.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptId: initialized.attempt.id,
          type: "INITIALIZATION",
          amountRials: payment.amountRials,
          status: "SUCCEEDED",
          providerReference: providerResult.reference,
          providerCode: providerResult.providerCode,
        },
      });
      await writeOutbox(transaction, {
        paymentId: payment.id,
        eventType: "payment.initialized",
        version,
        paymentNumber: payment.paymentNumber,
        orderId: payment.orderId,
        status: "PENDING",
      });
      await writeOutbox(transaction, {
        paymentId: payment.id,
        eventType: transition.eventType,
        version,
        paymentNumber: payment.paymentNumber,
        orderId: payment.orderId,
        status: "PENDING",
      });
      await writeAudit(transaction, {
        actor,
        context,
        action: "payment.initialized",
        paymentId: payment.id,
        before: { status: payment.status },
        after: { status: "PENDING" },
      });
      return true;
    },
  );
  recordPaymentCommand(
    "initialize",
    initializationApplied ? "success" : "replay",
    Date.now() - startedAt,
  );
  if (initializationApplied) recordPaymentLifecycle("initialized");
  const completed = ensurePayment(await paymentRepository.findById(id));
  logPaymentOperation(
    context,
    completed,
    "initialize",
    initializationApplied ? "success" : "replay",
    startedAt,
  );
  return mapPayment(completed, visibilityFor(actor));
}

type VerificationOptions = Readonly<{
  actor?: SessionActor;
  paymentId: string;
  idempotencyKey: string;
  authority?: string;
  callbackId?: string;
  context: PaymentAuditContext;
}>;

async function completeVerification(
  options: VerificationOptions,
  result: ProviderPaymentResult,
): Promise<PaymentDetailRecord> {
  const completion = await runPaymentTransaction(async (transaction) => {
    const payment = ensurePayment(
      await paymentRepository.findById(options.paymentId, transaction),
    );
    if (
      payment.status === "PAID" ||
      payment.status === "PARTIALLY_REFUNDED" ||
      payment.status === "REFUNDED"
    ) {
      if (options.callbackId) {
        await transaction.paymentCallback.update({
          where: { id: options.callbackId },
          data: { processingStatus: "DUPLICATE", processedAt: new Date() },
        });
      }
      return { payment, lifecycle: null };
    }
    const attempt = [...payment.attempts]
      .reverse()
      .find((candidate) => candidate.providerAuthority === result.authority);
    if (!attempt) {
      paymentError(
        "PAYMENT_AUTHORITY_UNKNOWN",
        422,
        "Provider authority does not belong to this payment.",
      );
    }

    const moneyMatches =
      result.amountRials === payment.amountRials &&
      result.currency === payment.currency;
    let targetStatus: PaymentStatus = result.status;
    let failureCode: string | null = null;
    if (!moneyMatches) {
      targetStatus = "FAILED";
      failureCode = "PAYMENT_AMOUNT_MISMATCH";
    }
    if (targetStatus === "AUTHORIZED") {
      targetStatus = "AUTHORIZED";
    } else if (
      !["PAID", "FAILED", "CANCELLED", "EXPIRED", "PENDING"].includes(
        targetStatus,
      )
    ) {
      targetStatus = "FAILED";
      failureCode = "PROVIDER_INVALID_RESPONSE";
    }

    if (targetStatus === "PENDING") {
      await transaction.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptId: attempt.id,
          type: "VERIFICATION",
          amountRials: result.amountRials,
          status: "PENDING",
          providerReference: result.reference,
          providerCode: result.providerCode,
        },
      });
      return {
        payment: ensurePayment(
          await paymentRepository.findById(payment.id, transaction),
        ),
        lifecycle: null,
      };
    }

    const transition = assertPaymentTransition(
      payment.status as PaymentStatus,
      targetStatus,
    );
    const version = payment.version + 1;
    const updated = await transaction.payment.updateMany({
      where: { id: payment.id, version: payment.version },
      data: {
        status: targetStatus,
        version: { increment: 1 },
        ...(targetStatus === "PAID" ? { paidAt: new Date() } : {}),
        ...(targetStatus === "FAILED" ? { failedAt: new Date() } : {}),
        ...(targetStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
    });
    if (updated.count !== 1)
      paymentError(
        "PAYMENT_VERSION_CONFLICT",
        409,
        "Payment changed concurrently.",
      );

    await transaction.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: targetStatus,
        providerReference: result.reference,
        providerStatus: result.status,
        failureCode,
        completedAt: targetStatus === "AUTHORIZED" ? null : new Date(),
      },
    });
    await transaction.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        attemptId: attempt.id,
        type: "VERIFICATION",
        amountRials: result.amountRials,
        status: ["AUTHORIZED", "PAID"].includes(targetStatus)
          ? "SUCCEEDED"
          : "FAILED",
        providerReference: result.reference,
        providerCode: failureCode ?? result.providerCode,
        safeMetadata: { moneyMatches },
      },
    });
    if (targetStatus === "AUTHORIZED") {
      await transaction.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptId: attempt.id,
          type: "AUTHORIZATION",
          amountRials: payment.amountRials,
          status: "SUCCEEDED",
          providerReference: result.reference,
          providerCode: result.providerCode,
        },
      });
    }
    if (targetStatus === "PAID") {
      await transaction.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          attemptId: attempt.id,
          type: "CAPTURE",
          amountRials: payment.amountRials,
          status: "SUCCEEDED",
          providerReference: result.reference,
          providerCode: result.providerCode,
        },
      });
      const orderUpdated = await transaction.order.updateMany({
        where: { id: payment.orderId, version: payment.order.version },
        data: { paymentStatus: "PAID", version: { increment: 1 } },
      });
      if (orderUpdated.count !== 1) {
        paymentError(
          "PAYMENT_ORDER_VERSION_CONFLICT",
          409,
          "Order changed concurrently during payment completion.",
        );
      }
      await transaction.orderOutboxEvent.create({
        data: {
          orderId: payment.orderId,
          eventType: "order.payment_completed",
          aggregateVersion: payment.order.version + 1,
          payload: {
            orderNumber: payment.order.orderNumber,
            status: payment.order.orderStatus,
            paymentStatus: "PAID",
          },
        },
      });
    }
    await writeOutbox(transaction, {
      paymentId: payment.id,
      eventType: transition.eventType,
      version,
      paymentNumber: payment.paymentNumber,
      orderId: payment.orderId,
      status: targetStatus,
    });
    await writeAudit(transaction, {
      ...(options.actor ? { actor: options.actor } : {}),
      context: options.context,
      action:
        targetStatus === "PAID"
          ? "payment.verified.paid"
          : targetStatus === "AUTHORIZED"
            ? "payment.verified.authorized"
            : "payment.verified.failed",
      paymentId: payment.id,
      metadata: {
        moneyMatches,
        providerCode: failureCode ?? result.providerCode,
      },
      before: { status: payment.status },
      after: { status: targetStatus },
    });
    if (options.callbackId) {
      await transaction.paymentCallback.update({
        where: { id: options.callbackId },
        data: {
          processingStatus: moneyMatches ? "PROCESSED" : "REJECTED",
          failureCode,
          processedAt: new Date(),
        },
      });
    }
    return {
      payment: ensurePayment(
        await paymentRepository.findById(payment.id, transaction),
      ),
      lifecycle: !moneyMatches
        ? ("amount_mismatch" as const)
        : targetStatus === "PAID"
          ? ("paid" as const)
          : ["FAILED", "CANCELLED", "EXPIRED"].includes(targetStatus)
            ? ("failed" as const)
            : null,
    };
  });
  if (completion.lifecycle) recordPaymentLifecycle(completion.lifecycle);
  return completion.payment;
}

async function verifyPaymentCore(
  options: VerificationOptions,
): Promise<PaymentDetailRecord> {
  const current = ensurePayment(
    await paymentRepository.findById(options.paymentId),
  );
  if (["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(current.status)) {
    return current;
  }
  if (!["INITIALIZING", "PENDING", "AUTHORIZED"].includes(current.status)) {
    paymentError(
      "PAYMENT_VERIFICATION_NOT_ALLOWED",
      409,
      "Payment cannot be verified in its current state.",
    );
  }
  const attempt = [...current.attempts]
    .reverse()
    .find(
      (candidate) =>
        candidate.providerAuthority &&
        (!options.authority ||
          candidate.providerAuthority === options.authority),
    );
  if (!attempt?.providerAuthority) {
    paymentError(
      "PAYMENT_AUTHORITY_UNKNOWN",
      422,
      "No matching provider authority is available.",
    );
  }
  const scope = `payment:${current.id}:verify`;
  const hash = paymentRequestHash({
    paymentId: current.id,
    authority: attempt.providerAuthority,
  });
  const replay = await replayIdempotency(scope, options.idempotencyKey, hash);
  if (
    replay &&
    ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(replay.status)
  ) {
    return replay;
  }
  if (!replay) {
    try {
      await runPaymentTransaction((transaction) =>
        writeIdempotency(transaction, {
          scope,
          key: options.idempotencyKey,
          hash,
          responseReference: attempt.id,
          paymentId: current.id,
        }),
      );
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        const raced = await replayIdempotency(
          scope,
          options.idempotencyKey,
          hash,
        );
        if (
          raced &&
          ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(raced.status)
        ) {
          return raced;
        }
        if (!raced) throw error;
        // Provider verification is read-only and safe to resume. The
        // canonical completion transaction below still has one winner.
      } else {
        throw error;
      }
    }
  }

  let result: ProviderPaymentResult;
  try {
    result = await executeProviderOperation((signal) =>
      providerFor(current.provider).verifyPayment({
        authority: attempt.providerAuthority!,
        expectedAmountRials: current.amountRials,
        expectedCurrency: current.currency,
        signal,
      }),
    );
    assertSafeProviderPaymentResult(result);
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error;
    throw new PaymentProviderError(
      "PROVIDER_INVALID_RESPONSE",
      "Payment verification failed.",
      false,
    );
  }
  return completeVerification(options, result);
}

export async function verifyPayment(
  actor: SessionActor,
  id: string,
  input: VerifyPaymentInput,
  context: PaymentAuditContext,
) {
  const startedAt = Date.now();
  const current = ensurePayment(await paymentRepository.findById(id));
  assertCustomerOwnership(actor, current);
  if (actor.isAdmin) requirePermission(actor, "payments.verify");
  try {
    const result = await verifyPaymentCore({
      actor,
      paymentId: id,
      idempotencyKey: input.idempotencyKey,
      ...(input.authority ? { authority: input.authority } : {}),
      context,
    });
    recordPaymentCommand("verify", "success", Date.now() - startedAt);
    logPaymentOperation(context, result, "verify", "success", startedAt);
    return mapPayment(result, visibilityFor(actor));
  } catch (error) {
    recordPaymentCommand("verify", "failure", Date.now() - startedAt);
    logPaymentOperation(
      context,
      current,
      "verify",
      "failure",
      startedAt,
      error instanceof AppError
        ? error.code
        : error instanceof PaymentProviderError
          ? error.code
          : error instanceof Error
            ? error.name
            : "UNKNOWN",
    );
    mapPaymentError(error);
  }
}

function assertCallbackReplayWasValid(callback: {
  signatureStatus: string;
  failureCode: string | null;
}): void {
  if (
    callback.signatureStatus === "INVALID" ||
    callback.failureCode === "PAYMENT_CALLBACK_SIGNATURE_INVALID"
  ) {
    paymentError(
      "PAYMENT_CALLBACK_SIGNATURE_INVALID",
      401,
      "Callback signature is invalid.",
    );
  }
  if (callback.failureCode === "PAYMENT_AUTHORITY_UNKNOWN") {
    paymentError(
      "PAYMENT_AUTHORITY_UNKNOWN",
      422,
      "Callback authority is unknown.",
    );
  }
}

export async function processPaymentCallback(
  providerCode: string,
  input: PaymentCallbackInput,
  rawPayload: string,
  context: PaymentAuditContext,
) {
  const startedAt = Date.now();
  const provider = providerFor(providerCode);
  const payloadHash = paymentPayloadHash(rawPayload);
  let callbackId: string | undefined;
  const duplicate = await prisma.paymentCallback.findUnique({
    where: {
      provider_externalEventId: {
        provider: providerCode,
        externalEventId: input.externalEventId,
      },
    },
  });
  if (duplicate) {
    if (duplicate.payloadHash !== payloadHash) {
      paymentError(
        "PAYMENT_CALLBACK_REPLAY_CONFLICT",
        409,
        "Callback event identifier was replayed with another payload.",
      );
    }
    assertCallbackReplayWasValid(duplicate);
    recordPaymentCallback("duplicate", Date.now() - startedAt);
    if (
      ["RECEIVED", "FAILED"].includes(duplicate.processingStatus) &&
      duplicate.paymentId
    ) {
      callbackId = duplicate.id;
    } else {
      return duplicate.paymentId
        ? mapPayment(
            ensurePayment(
              await paymentRepository.findById(duplicate.paymentId),
            ),
            { financial: false, providerReference: false, audit: false },
          )
        : { accepted: false, duplicate: true };
    }
  }
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { provider: providerCode, providerAuthority: input.authority },
    select: { id: true, paymentId: true },
  });
  const signaturePayload = `${input.externalEventId}:${input.authority}:${input.scenario}`;
  const valid = await provider.validateCallback({
    rawPayload: signaturePayload,
    externalEventId: input.externalEventId,
    authority: input.authority,
    signature: input.signature,
  });
  if (!callbackId) {
    try {
      const callback = await prisma.paymentCallback.create({
        data: {
          provider: providerCode,
          externalEventId: input.externalEventId,
          payloadHash,
          signatureStatus: valid ? "VALID" : "INVALID",
          processingStatus: valid && attempt ? "RECEIVED" : "REJECTED",
          ...(attempt
            ? { paymentId: attempt.paymentId, attemptId: attempt.id }
            : {}),
          ...(!valid
            ? { failureCode: "PAYMENT_CALLBACK_SIGNATURE_INVALID" }
            : !attempt
              ? { failureCode: "PAYMENT_AUTHORITY_UNKNOWN" }
              : {}),
          ...(!valid || !attempt ? { processedAt: new Date() } : {}),
        },
      });
      callbackId = callback.id;
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        recordPaymentCallback("duplicate", Date.now() - startedAt);
        const raced = await prisma.paymentCallback.findUnique({
          where: {
            provider_externalEventId: {
              provider: providerCode,
              externalEventId: input.externalEventId,
            },
          },
        });
        if (!raced) {
          paymentError(
            "PAYMENT_CALLBACK_PROCESSING_FAILED",
            409,
            "Callback processing state could not be resolved.",
          );
        }
        assertCallbackReplayWasValid(raced);
        if (
          ["RECEIVED", "FAILED"].includes(raced.processingStatus) &&
          raced.paymentId
        ) {
          callbackId = raced.id;
        } else {
          return raced.paymentId
            ? mapPayment(
                ensurePayment(
                  await paymentRepository.findById(raced.paymentId),
                ),
                { financial: false, providerReference: false, audit: false },
              )
            : { accepted: false, duplicate: true };
        }
      } else {
        throw error;
      }
    }
  }
  if (!callbackId) {
    paymentError(
      "PAYMENT_CALLBACK_PROCESSING_FAILED",
      409,
      "Callback processing state could not be resolved.",
    );
  }
  if (!valid) {
    recordPaymentCallback("invalid", Date.now() - startedAt);
    paymentError(
      "PAYMENT_CALLBACK_SIGNATURE_INVALID",
      401,
      "Callback signature is invalid.",
    );
  }
  if (!attempt) {
    recordPaymentCallback("invalid", Date.now() - startedAt);
    paymentError(
      "PAYMENT_AUTHORITY_UNKNOWN",
      422,
      "Callback authority is unknown.",
    );
  }
  try {
    const payment = await verifyPaymentCore({
      paymentId: attempt.paymentId,
      idempotencyKey: `callback:${paymentPayloadHash(
        `${providerCode}:${input.externalEventId}`,
      ).slice(0, 64)}`,
      authority: input.authority,
      callbackId,
      context,
    });
    await prisma.paymentCallback.updateMany({
      where: { id: callbackId, processingStatus: "RECEIVED" },
      data: {
        processingStatus: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
          payment.status,
        )
          ? "PROCESSED"
          : "FAILED",
        processedAt: new Date(),
      },
    });
    recordPaymentCallback("success", Date.now() - startedAt);
    logPaymentOperation(context, payment, "callback", "success", startedAt);
    return mapPayment(payment, {
      financial: false,
      providerReference: false,
      audit: false,
    });
  } catch (error) {
    await prisma.paymentCallback.updateMany({
      where: {
        id: callbackId,
        processingStatus: { in: ["RECEIVED", "FAILED"] },
      },
      data: {
        processingStatus: "FAILED",
        failureCode:
          error instanceof PaymentProviderError
            ? error.code
            : "PAYMENT_CALLBACK_PROCESSING_FAILED",
        processedAt: new Date(),
      },
    });
    const resolved = ensurePayment(
      await paymentRepository.findById(attempt.paymentId),
    );
    if (["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(resolved.status)) {
      recordPaymentCallback("success", Date.now() - startedAt);
      logPaymentOperation(context, resolved, "callback", "replay", startedAt);
      return mapPayment(resolved, {
        financial: false,
        providerReference: false,
        audit: false,
      });
    }
    recordPaymentCallback("failure", Date.now() - startedAt);
    logPaymentOperation(
      context,
      resolved,
      "callback",
      "failure",
      startedAt,
      error instanceof PaymentProviderError
        ? error.code
        : error instanceof Error
          ? error.name
          : "UNKNOWN",
    );
    mapPaymentError(error);
  }
}

function mapListRecord(record: PaymentListRecord, financial: boolean) {
  return {
    id: record.id,
    paymentNumber: record.paymentNumber,
    orderNumber: record.order.orderNumber,
    currency: record.currency,
    amountRials: financial ? record.amountRials.toString() : null,
    status: record.status,
    provider: record.provider,
    providerReference: null,
    version: record.version,
    paidAt: record.paidAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listAdminPayments(
  actor: SessionActor,
  query: PaymentListQuery,
) {
  requirePermission(actor, "payments.read");
  const financial = hasPermission(actor, "payments.read_financial");
  const providerReference = hasPermission(
    actor,
    "payments.provider_reference.read",
  );
  if (
    (!financial && (query.minAmountRials || query.maxAmountRials)) ||
    (!providerReference && query.providerReference)
  ) {
    throw new AuthorizationError();
  }
  const branchId = resolvePaymentBranchScope(actor);
  const { records, total } = await paymentRepository.list(query, branchId);
  return {
    items: records.map((record) => ({
      ...mapListRecord(record, financial),
      providerReference: providerReference
        ? (record.attempts[0]?.providerReference ?? null)
        : null,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function getAdminPayment(actor: SessionActor, id: string) {
  const payment = ensurePayment(await paymentRepository.findById(id));
  assertAdminPaymentAccess(actor, payment);
  const visibility = visibilityFor(actor);
  const mapped = mapPayment(payment, visibility);
  if (!visibility.audit) return mapped;
  const auditTrail = await prisma.auditLog.findMany({
    where: { entityType: "Payment", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      actorId: true,
      actorType: true,
      action: true,
      requestId: true,
      reasonCode: true,
      createdAt: true,
    },
  });
  return {
    ...mapped,
    auditTrail: auditTrail.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

async function providerSnapshot(payment: PaymentDetailRecord) {
  const attempt = [...payment.attempts]
    .reverse()
    .find((candidate) => candidate.providerAuthority);
  if (!attempt?.providerAuthority) {
    return {
      status: "PENDING" as const,
      amountRials: payment.amountRials,
      currency: payment.currency,
      providerReference: null,
    };
  }
  const result = await executeProviderOperation((signal) =>
    providerFor(payment.provider).queryPayment({
      authority: attempt.providerAuthority!,
      expectedAmountRials: payment.amountRials,
      expectedCurrency: payment.currency,
      signal,
    }),
  );
  assertSafeProviderPaymentResult(result);
  return {
    status:
      result.status === "AUTHORIZED" ? ("PENDING" as const) : result.status,
    amountRials: result.amountRials,
    currency: result.currency,
    providerReference: result.reference,
  };
}

async function reconcileOne(
  payment: PaymentDetailRecord,
  context: PaymentAuditContext,
  actor?: SessionActor,
  idempotency?: Readonly<{
    scope: string;
    key: string;
    hash: string;
  }>,
) {
  const provider = await providerSnapshot(payment);
  const providerReference = provider.providerReference;
  const duplicateProviderReference = providerReference
    ? (await prisma.paymentAttempt.count({
        where: { providerReference },
      })) > 1
    : false;
  const capturedRefund = payment.transactions
    .filter((entry) => entry.type === "REFUND" && entry.status === "SUCCEEDED")
    .reduce((sum, entry) => sum + entry.amountRials, 0n);
  const expectedRefund = payment.refunds
    .filter((entry) => entry.status === "SUCCEEDED")
    .reduce((sum, entry) => sum + entry.amountRials, 0n);
  const differenceType = findPaymentDifference({
    internalStatus: payment.status as PaymentStatus,
    internalAmountRials: payment.amountRials,
    internalCurrency: payment.currency,
    capturedRefundRials: capturedRefund,
    expectedRefundRials: expectedRefund,
    provider,
    orderExists: Boolean(payment.order.id),
    duplicateProviderReference,
    hasUnprocessedCallback: payment.callbacks.some((entry) =>
      ["RECEIVED", "FAILED"].includes(entry.processingStatus),
    ),
  });
  await runPaymentTransaction(async (transaction) => {
    const current = ensurePayment(
      await paymentRepository.findById(payment.id, transaction),
    );
    const reconciliation = await transaction.paymentReconciliationRecord.create(
      {
        data: {
          paymentId: current.id,
          internalStatus: current.status,
          providerStatus: provider.status,
          differenceType,
          resolutionStatus: differenceType === "NONE" ? "RESOLVED" : "OPEN",
          safeDetails: {
            internalAmountRials: current.amountRials.toString(),
            providerAmountRials: provider.amountRials.toString(),
            internalCurrency: current.currency,
            providerCurrency: provider.currency,
          },
        },
      },
    );
    await transaction.paymentTransaction.create({
      data: {
        paymentId: current.id,
        type: "RECONCILIATION",
        amountRials: provider.amountRials,
        status: differenceType === "NONE" ? "SUCCEEDED" : "FAILED",
        providerReference,
        providerCode: differenceType,
      },
    });
    if (differenceType !== "NONE") {
      const version = current.version + 1;
      const updated = await transaction.payment.updateMany({
        where: { id: current.id, version: current.version },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1)
        paymentError(
          "PAYMENT_VERSION_CONFLICT",
          409,
          "Payment changed concurrently.",
        );
      await writeOutbox(transaction, {
        paymentId: current.id,
        eventType: "payment.reconciliation_mismatch",
        version,
        paymentNumber: current.paymentNumber,
        orderId: current.orderId,
        status: current.status,
      });
    }
    await writeAudit(transaction, {
      ...(actor ? { actor } : {}),
      context,
      action: "payment.reconciled",
      paymentId: current.id,
      metadata: { differenceType, providerStatus: provider.status },
    });
    if (idempotency) {
      await writeIdempotency(transaction, {
        ...idempotency,
        responseReference: reconciliation.id,
        paymentId: current.id,
      });
    }
  });
  return differenceType;
}

async function reconciliationReplay(
  scope: string,
  key: string,
  hash: string,
): Promise<Readonly<{
  payment: PaymentDetailRecord;
  differenceType: PaymentDifferenceType;
}> | null> {
  const payment = await replayIdempotency(scope, key, hash);
  if (!payment) return null;
  const idempotency = await prisma.paymentIdempotencyRecord.findUnique({
    where: { scope_key: { scope, key } },
    select: { responseReference: true },
  });
  const reconciliation = idempotency
    ? await prisma.paymentReconciliationRecord.findFirst({
        where: {
          id: idempotency.responseReference,
          paymentId: payment.id,
        },
        select: { differenceType: true },
      })
    : null;
  if (!reconciliation) {
    paymentError(
      "PAYMENT_IDEMPOTENCY_RESULT_MISSING",
      409,
      "The reconciliation idempotency result is unavailable.",
    );
  }
  return { payment, differenceType: reconciliation.differenceType };
}

export async function reconcileAdminPayment(
  actor: SessionActor,
  id: string,
  input: ReconcilePaymentInput,
  context: PaymentAuditContext,
) {
  const startedAt = Date.now();
  requirePermission(actor, "payments.reconcile");
  const payment = ensurePayment(await paymentRepository.findById(id));
  assertAdminPaymentAccess(actor, payment);
  providerFor(payment.provider);
  const scope = `payment:${id}:reconcile`;
  const hash = paymentRequestHash({ id });
  const replay = await reconciliationReplay(scope, input.idempotencyKey, hash);
  if (replay) {
    recordPaymentCommand("reconcile", "replay", Date.now() - startedAt);
    logPaymentOperation(
      context,
      replay.payment,
      "reconcile",
      "replay",
      startedAt,
    );
    return {
      differenceType: replay.differenceType,
      payment: mapPayment(replay.payment, visibilityFor(actor)),
    };
  }
  let differenceType: PaymentDifferenceType;
  try {
    differenceType = await reconcileOne(payment, context, actor, {
      scope,
      key: input.idempotencyKey,
      hash,
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      const raced = await reconciliationReplay(
        scope,
        input.idempotencyKey,
        hash,
      );
      if (raced) {
        recordPaymentCommand("reconcile", "replay", Date.now() - startedAt);
        logPaymentOperation(
          context,
          raced.payment,
          "reconcile",
          "replay",
          startedAt,
        );
        return {
          differenceType: raced.differenceType,
          payment: mapPayment(raced.payment, visibilityFor(actor)),
        };
      }
    }
    recordPaymentCommand("reconcile", "failure", Date.now() - startedAt);
    logPaymentOperation(
      context,
      payment,
      "reconcile",
      "failure",
      startedAt,
      error instanceof Error ? error.name : "UNKNOWN",
    );
    mapPaymentError(error);
  }
  recordPaymentLifecycle(
    differenceType === "NONE" ? "reconciled" : "reconciliation_mismatch",
  );
  recordPaymentCommand("reconcile", "success", Date.now() - startedAt);
  const reconciledPayment = ensurePayment(await paymentRepository.findById(id));
  logPaymentOperation(
    context,
    reconciledPayment,
    "reconcile",
    "success",
    startedAt,
  );
  return {
    differenceType,
    payment: mapPayment(reconciledPayment, visibilityFor(actor)),
  };
}

export async function reconcileAllPayments(): Promise<{
  checked: number;
  mismatches: number;
  differences: Readonly<Record<string, number>>;
}> {
  const ids = await prisma.payment.findMany({ select: { id: true } });
  const differences: Record<string, number> = {};
  let mismatches = 0;
  for (const { id } of ids) {
    const payment = ensurePayment(await paymentRepository.findById(id));
    const difference = await reconcileOne(payment, {
      requestId: `reconcile-${randomUUID()}`,
    });
    differences[difference] = (differences[difference] ?? 0) + 1;
    if (difference !== "NONE") mismatches += 1;
  }
  return { checked: ids.length, mismatches, differences };
}

export async function createRefund(
  actor: SessionActor,
  id: string,
  input: CreateRefundInput,
  context: PaymentAuditContext,
) {
  const startedAt = Date.now();
  requirePermission(actor, "payments.refund");
  const payment = ensurePayment(await paymentRepository.findById(id));
  assertAdminPaymentAccess(actor, payment);
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)) {
    paymentError(
      "REFUND_NOT_ALLOWED",
      409,
      "Only captured payments can be refunded.",
    );
  }
  const provider = providerFor(payment.provider);
  const amountRials = BigInt(input.amountRials);
  const scope = `payment:${id}:refund`;
  const hash = paymentRequestHash({
    id,
    amountRials: input.amountRials,
    reason: input.reason,
  });
  const replay = await replayIdempotency(scope, input.idempotencyKey, hash);
  type PreparedRefund = Readonly<{
    kind: "prepared";
    refund: Refund;
    attempt: PaymentDetailRecord["attempts"][number];
  }>;
  let prepared: PreparedRefund | undefined;
  if (replay) {
    const existingRefund = await prisma.refund.findUnique({
      where: {
        paymentId_idempotencyKey: {
          paymentId: id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    const capturedAttempt = [...replay.attempts]
      .reverse()
      .find(
        (candidate) =>
          candidate.providerReference && candidate.providerAuthority,
      );
    if (!existingRefund) {
      paymentError(
        "PAYMENT_IDEMPOTENCY_RESULT_MISSING",
        409,
        "The refund idempotency result is unavailable.",
      );
    }
    if (existingRefund.status === "PENDING" && !capturedAttempt) {
      paymentError(
        "REFUND_PROVIDER_REFERENCE_MISSING",
        409,
        "Captured provider reference is unavailable.",
      );
    }
    if (existingRefund.status === "PENDING" && capturedAttempt) {
      prepared = {
        kind: "prepared",
        refund: existingRefund,
        attempt: capturedAttempt,
      };
    } else {
      recordPaymentCommand("refund", "replay", Date.now() - startedAt);
      logPaymentOperation(context, replay, "refund", "replay", startedAt);
      return mapPayment(replay, visibilityFor(actor));
    }
  }

  const prepareRefund = () =>
    runPaymentTransaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id} FOR UPDATE`;
      const current = ensurePayment(
        await paymentRepository.findById(id, transaction),
      );
      const concurrentReplay =
        await transaction.paymentIdempotencyRecord.findUnique({
          where: { scope_key: { scope, key: input.idempotencyKey } },
        });
      if (concurrentReplay) {
        if (concurrentReplay.requestHash !== hash) {
          paymentError(
            "PAYMENT_IDEMPOTENCY_CONFLICT",
            409,
            "Idempotency key was already used with different input.",
          );
        }
        return { kind: "replay" as const };
      }
      const reserved = await transaction.refund.aggregate({
        where: {
          paymentId: id,
          status: { in: ["CREATED", "PENDING", "SUCCEEDED"] },
        },
        _sum: { amountRials: true },
      });
      if (
        (reserved._sum.amountRials ?? 0n) + amountRials >
        current.amountRials
      ) {
        paymentError(
          "REFUND_AMOUNT_EXCEEDED",
          409,
          "Refund total cannot exceed the captured payment amount.",
        );
      }
      const attempt = [...current.attempts]
        .reverse()
        .find(
          (candidate) =>
            candidate.providerReference && candidate.providerAuthority,
        );
      if (!attempt?.providerReference || !attempt.providerAuthority) {
        paymentError(
          "REFUND_PROVIDER_REFERENCE_MISSING",
          409,
          "Captured provider reference is unavailable.",
        );
      }
      const refund = await transaction.refund.create({
        data: {
          paymentId: id,
          amountRials,
          reason: input.reason,
          status: "PENDING",
          idempotencyKey: input.idempotencyKey,
        },
      });
      const version = current.version + 1;
      const updated = await transaction.payment.updateMany({
        where: { id, version: current.version },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1)
        paymentError(
          "PAYMENT_VERSION_CONFLICT",
          409,
          "Payment changed concurrently.",
        );
      await writeOutbox(transaction, {
        paymentId: id,
        eventType: "payment.refund_requested",
        version,
        paymentNumber: current.paymentNumber,
        orderId: current.orderId,
        status: current.status,
      });
      await writeAudit(transaction, {
        actor,
        context,
        action: "payment.refund.requested",
        paymentId: id,
        after: { refundId: refund.id, amountRials: amountRials.toString() },
      });
      await writeIdempotency(transaction, {
        scope,
        key: input.idempotencyKey,
        hash,
        responseReference: refund.id,
        paymentId: id,
      });
      return { kind: "prepared" as const, refund, attempt };
    });
  const resumedPreparedRefund = Boolean(prepared);
  const preparation = prepared ?? (await prepareRefund());
  if (preparation.kind === "replay") {
    recordPaymentCommand("refund", "replay", Date.now() - startedAt);
    const replayed = ensurePayment(await paymentRepository.findById(id));
    logPaymentOperation(context, replayed, "refund", "replay", startedAt);
    return mapPayment(replayed, visibilityFor(actor));
  }
  const activeRefund = preparation;
  if (!resumedPreparedRefund) recordPaymentLifecycle("refund_requested");

  let providerResult: Awaited<
    ReturnType<PaymentProvider["refundPaymentWhenSupported"]>
  >;
  try {
    providerResult = await executeProviderOperation((signal) =>
      provider.refundPaymentWhenSupported({
        authority: activeRefund.attempt.providerAuthority!,
        paymentReference: activeRefund.attempt.providerReference!,
        amountRials,
        idempotencyKey: input.idempotencyKey,
        scenario: input.scenario,
        signal,
      }),
    );
    assertSafeProviderRefundResult(providerResult);
  } catch (error) {
    const providerError =
      error instanceof PaymentProviderError
        ? error
        : new PaymentProviderError(
            "PROVIDER_INVALID_RESPONSE",
            "Provider refund failed.",
            false,
          );
    const failureResolution = await runPaymentTransaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${activeRefund.refund.id} FOR UPDATE`;
        const currentRefund = await transaction.refund.findUnique({
          where: { id: activeRefund.refund.id },
        });
        if (!currentRefund) {
          paymentError("REFUND_NOT_FOUND", 404, "Refund was not found.");
        }
        if (currentRefund.status !== "PENDING") {
          return currentRefund.status;
        }
        await transaction.refund.update({
          where: { id: currentRefund.id },
          data: {
            status: "FAILED",
            failureCode: providerError.code,
            completedAt: new Date(),
          },
        });
        await transaction.paymentTransaction.create({
          data: {
            paymentId: id,
            attemptId: activeRefund.attempt.id,
            type: "REFUND",
            amountRials,
            status: "FAILED",
            providerCode: providerError.code,
          },
        });
        await writeAudit(transaction, {
          actor,
          context,
          action: "payment.refund.failed",
          paymentId: id,
          metadata: { providerCode: providerError.code },
        });
        return "FAILED" as const;
      },
    );
    if (failureResolution === "SUCCEEDED") {
      const completed = ensurePayment(await paymentRepository.findById(id));
      recordPaymentCommand("refund", "replay", Date.now() - startedAt);
      logPaymentOperation(context, completed, "refund", "replay", startedAt);
      return mapPayment(completed, visibilityFor(actor));
    }
    recordPaymentCommand("refund", "failure", Date.now() - startedAt);
    logPaymentOperation(
      context,
      payment,
      "refund",
      "failure",
      startedAt,
      providerError.code,
    );
    mapPaymentError(providerError);
  }

  const finalization = await runPaymentTransaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${activeRefund.refund.id} FOR UPDATE`;
    const currentRefund = await transaction.refund.findUnique({
      where: { id: activeRefund.refund.id },
    });
    if (!currentRefund) {
      paymentError("REFUND_NOT_FOUND", 404, "Refund was not found.");
    }
    if (currentRefund.status !== "PENDING") {
      return { applied: false as const, status: currentRefund.status };
    }
    await transaction.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id} FOR UPDATE`;
    const current = ensurePayment(
      await paymentRepository.findById(id, transaction),
    );
    await transaction.refund.update({
      where: { id: currentRefund.id },
      data: {
        status: providerResult.succeeded ? "SUCCEEDED" : "FAILED",
        providerReference: providerResult.reference,
        failureCode: providerResult.succeeded
          ? null
          : providerResult.providerCode,
        completedAt: new Date(),
      },
    });
    await transaction.paymentTransaction.create({
      data: {
        paymentId: id,
        attemptId: activeRefund.attempt.id,
        type: "REFUND",
        amountRials,
        status: providerResult.succeeded ? "SUCCEEDED" : "FAILED",
        providerReference: providerResult.reference,
        providerCode: providerResult.providerCode,
      },
    });
    if (!providerResult.succeeded) {
      await writeAudit(transaction, {
        actor,
        context,
        action: "payment.refund.failed",
        paymentId: id,
        metadata: { providerCode: providerResult.providerCode },
      });
      return { applied: true as const, status: "FAILED" as const };
    }
    const succeeded = await transaction.refund.aggregate({
      where: { paymentId: id, status: "SUCCEEDED" },
      _sum: { amountRials: true },
    });
    const refunded = succeeded._sum.amountRials ?? 0n;
    const targetStatus =
      refunded === current.amountRials ? "REFUNDED" : "PARTIALLY_REFUNDED";
    if (current.status !== targetStatus) {
      assertPaymentTransition(current.status as PaymentStatus, targetStatus);
    }
    const version = current.version + 1;
    const updated = await transaction.payment.updateMany({
      where: { id, version: current.version },
      data: { status: targetStatus, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      paymentError(
        "PAYMENT_VERSION_CONFLICT",
        409,
        "Payment changed concurrently.",
      );
    await transaction.order.update({
      where: { id: current.orderId },
      data: {
        paymentStatus:
          targetStatus === "REFUNDED" ? "REFUNDED" : "PARTIALLY_REFUNDED",
        version: { increment: 1 },
      },
    });
    await writeOutbox(transaction, {
      paymentId: id,
      eventType:
        targetStatus === "REFUNDED"
          ? "payment.refunded"
          : "payment.partially_refunded",
      version,
      paymentNumber: current.paymentNumber,
      orderId: current.orderId,
      status: targetStatus,
    });
    await writeAudit(transaction, {
      actor,
      context,
      action: "payment.refund.completed",
      paymentId: id,
      before: { status: current.status },
      after: { status: targetStatus, amountRials: amountRials.toString() },
    });
    return { applied: true as const, status: "SUCCEEDED" as const };
  });
  if (!finalization.applied) {
    const replayed = ensurePayment(await paymentRepository.findById(id));
    recordPaymentCommand("refund", "replay", Date.now() - startedAt);
    logPaymentOperation(context, replayed, "refund", "replay", startedAt);
    return mapPayment(replayed, visibilityFor(actor));
  }
  recordPaymentCommand(
    "refund",
    providerResult.succeeded ? "success" : "failure",
    Date.now() - startedAt,
  );
  if (providerResult.succeeded) recordPaymentLifecycle("refunded");
  const completed = ensurePayment(await paymentRepository.findById(id));
  logPaymentOperation(
    context,
    completed,
    "refund",
    providerResult.succeeded ? "success" : "failure",
    startedAt,
    providerResult.succeeded ? undefined : providerResult.providerCode,
  );
  return mapPayment(completed, visibilityFor(actor));
}
