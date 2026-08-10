-- Phase 08: additive payment and financial transaction orchestration.
-- This migration deliberately contains no DROP, data rewrite, or legacy
-- OrderPayment backfill. Existing OMS evidence remains untouched.

CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'INITIALIZING', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'INITIALIZING', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PaymentTransactionType" AS ENUM ('INITIALIZATION', 'AUTHORIZATION', 'CAPTURE', 'VERIFICATION', 'REVERSAL', 'REFUND', 'RECONCILIATION');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "PaymentSignatureStatus" AS ENUM ('VALID', 'INVALID', 'NOT_PROVIDED', 'UNSUPPORTED');
CREATE TYPE "PaymentCallbackProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'REJECTED', 'FAILED');
CREATE TYPE "RefundStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentReconciliationDifferenceType" AS ENUM ('NONE', 'INTERNAL_PAID_PROVIDER_NOT_PAID', 'PROVIDER_PAID_INTERNAL_NOT_PAID', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'DUPLICATE_PROVIDER_REFERENCE', 'MISSING_ORDER', 'REFUND_MISMATCH', 'UNPROCESSED_CALLBACK');
CREATE TYPE "PaymentReconciliationResolutionStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
CREATE TYPE "PaymentEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "amountRials" BIGINT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
    "provider" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_amountRials_non_negative" CHECK ("amountRials" >= 0),
    CONSTRAINT "Payment_version_positive" CHECK ("version" >= 1),
    CONSTRAINT "Payment_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "amountRials" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "providerAuthority" VARCHAR(200),
    "providerReference" VARCHAR(200),
    "redirectUrl" TEXT,
    "providerStatus" VARCHAR(80),
    "failureCode" VARCHAR(120),
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAttempt_attemptNumber_positive" CHECK ("attemptNumber" >= 1),
    CONSTRAINT "PaymentAttempt_amountRials_non_negative" CHECK ("amountRials" >= 0),
    CONSTRAINT "PaymentAttempt_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attemptId" TEXT,
    "type" "PaymentTransactionType" NOT NULL,
    "amountRials" BIGINT NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL,
    "providerReference" VARCHAR(200),
    "providerCode" VARCHAR(120),
    "safeMetadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentTransaction_amountRials_non_negative" CHECK ("amountRials" >= 0)
);

CREATE TABLE "PaymentCallback" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "externalEventId" VARCHAR(200) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "signatureStatus" "PaymentSignatureStatus" NOT NULL,
    "processingStatus" "PaymentCallbackProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "paymentId" TEXT,
    "attemptId" TEXT,
    "failureCode" VARCHAR(120),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentCallback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentCallback_payloadHash_sha256" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountRials" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "providerReference" VARCHAR(200),
    "failureCode" VARCHAR(120),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Refund_amountRials_positive" CHECK ("amountRials" > 0),
    CONSTRAINT "Refund_reason_present" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "PaymentReconciliationRecord" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "internalStatus" VARCHAR(80) NOT NULL,
    "providerStatus" VARCHAR(80) NOT NULL,
    "differenceType" "PaymentReconciliationDifferenceType" NOT NULL,
    "resolutionStatus" "PaymentReconciliationResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "safeDetails" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentReconciliationRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" VARCHAR(240) NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseReference" VARCHAR(240) NOT NULL,
    "paymentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentIdempotencyRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentIdempotencyRecord_requestHash_sha256" CHECK ("requestHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "PaymentOutboxEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentOutboxEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentOutboxEvent_versions_positive" CHECK ("aggregateVersion" >= 1 AND "schemaVersion" >= 1),
    CONSTRAINT "PaymentOutboxEvent_attempts_non_negative" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_provider_status_createdAt_idx" ON "Payment"("provider", "status", "createdAt");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "PaymentAttempt_paymentId_createdAt_idx" ON "PaymentAttempt"("paymentId", "createdAt");
CREATE INDEX "PaymentAttempt_status_expiresAt_idx" ON "PaymentAttempt"("status", "expiresAt");
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_idempotencyKey_key" ON "PaymentAttempt"("paymentId", "idempotencyKey");
CREATE UNIQUE INDEX "PaymentAttempt_provider_providerAuthority_key" ON "PaymentAttempt"("provider", "providerAuthority");
CREATE UNIQUE INDEX "PaymentAttempt_provider_providerReference_key" ON "PaymentAttempt"("provider", "providerReference");
CREATE INDEX "PaymentTransaction_paymentId_occurredAt_idx" ON "PaymentTransaction"("paymentId", "occurredAt");
CREATE INDEX "PaymentTransaction_attemptId_occurredAt_idx" ON "PaymentTransaction"("attemptId", "occurredAt");
CREATE INDEX "PaymentTransaction_type_status_occurredAt_idx" ON "PaymentTransaction"("type", "status", "occurredAt");
CREATE INDEX "PaymentTransaction_paymentId_type_providerReference_idx" ON "PaymentTransaction"("paymentId", "type", "providerReference");
CREATE INDEX "PaymentCallback_paymentId_receivedAt_idx" ON "PaymentCallback"("paymentId", "receivedAt");
CREATE INDEX "PaymentCallback_attemptId_receivedAt_idx" ON "PaymentCallback"("attemptId", "receivedAt");
CREATE INDEX "PaymentCallback_processingStatus_receivedAt_idx" ON "PaymentCallback"("processingStatus", "receivedAt");
CREATE UNIQUE INDEX "PaymentCallback_provider_externalEventId_key" ON "PaymentCallback"("provider", "externalEventId");
CREATE UNIQUE INDEX "Refund_providerReference_key" ON "Refund"("providerReference");
CREATE INDEX "Refund_paymentId_status_idx" ON "Refund"("paymentId", "status");
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");
CREATE UNIQUE INDEX "Refund_paymentId_idempotencyKey_key" ON "Refund"("paymentId", "idempotencyKey");
CREATE INDEX "PaymentReconciliationRecord_paymentId_checkedAt_idx" ON "PaymentReconciliationRecord"("paymentId", "checkedAt");
CREATE INDEX "PaymentReconciliationRecord_resolutionStatus_checkedAt_idx" ON "PaymentReconciliationRecord"("resolutionStatus", "checkedAt");
CREATE INDEX "PaymentReconciliationRecord_differenceType_checkedAt_idx" ON "PaymentReconciliationRecord"("differenceType", "checkedAt");
CREATE INDEX "PaymentIdempotencyRecord_paymentId_idx" ON "PaymentIdempotencyRecord"("paymentId");
CREATE INDEX "PaymentIdempotencyRecord_expiresAt_idx" ON "PaymentIdempotencyRecord"("expiresAt");
CREATE UNIQUE INDEX "PaymentIdempotencyRecord_scope_key_key" ON "PaymentIdempotencyRecord"("scope", "key");
CREATE INDEX "PaymentOutboxEvent_status_availableAt_idx" ON "PaymentOutboxEvent"("status", "availableAt");
CREATE INDEX "PaymentOutboxEvent_paymentId_occurredAt_idx" ON "PaymentOutboxEvent"("paymentId", "occurredAt");
CREATE UNIQUE INDEX "PaymentOutboxEvent_paymentId_eventType_aggregateVersion_key" ON "PaymentOutboxEvent"("paymentId", "eventType", "aggregateVersion");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentCallback" ADD CONSTRAINT "PaymentCallback_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentCallback" ADD CONSTRAINT "PaymentCallback_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReconciliationRecord" ADD CONSTRAINT "PaymentReconciliationRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIdempotencyRecord" ADD CONSTRAINT "PaymentIdempotencyRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentOutboxEvent" ADD CONSTRAINT "PaymentOutboxEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial provider transactions are evidence: application code may append,
-- but an accidental UPDATE or DELETE fails closed at the database boundary.
CREATE FUNCTION "apple333_prevent_payment_transaction_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PaymentTransaction is append-only';
END;
$$;

CREATE TRIGGER "PaymentTransaction_append_only"
BEFORE UPDATE OR DELETE ON "PaymentTransaction"
FOR EACH ROW EXECUTE FUNCTION "apple333_prevent_payment_transaction_mutation"();
