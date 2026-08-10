import type { Prisma } from "@prisma/client";

import type { PaymentListQuery } from "@/modules/payments/validators";
import { prisma } from "@/server/db/prisma";

export const paymentDetailSelect = {
  id: true,
  orderId: true,
  paymentNumber: true,
  currency: true,
  amountRials: true,
  status: true,
  method: true,
  provider: true,
  version: true,
  paidAt: true,
  failedAt: true,
  cancelledAt: true,
  expiresAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      currency: true,
      grandTotalRials: true,
      paymentStatus: true,
      orderStatus: true,
      version: true,
      allocations: {
        select: { branchId: true },
      },
    },
  },
  attempts: {
    orderBy: { attemptNumber: "asc" },
    select: {
      id: true,
      attemptNumber: true,
      provider: true,
      amountRials: true,
      currency: true,
      status: true,
      idempotencyKey: true,
      providerAuthority: true,
      providerReference: true,
      redirectUrl: true,
      providerStatus: true,
      failureCode: true,
      expiresAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  transactions: {
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      attemptId: true,
      type: true,
      amountRials: true,
      status: true,
      providerReference: true,
      providerCode: true,
      safeMetadata: true,
      occurredAt: true,
      createdAt: true,
    },
  },
  callbacks: {
    orderBy: { receivedAt: "asc" },
    select: {
      id: true,
      externalEventId: true,
      payloadHash: true,
      signatureStatus: true,
      processingStatus: true,
      failureCode: true,
      receivedAt: true,
      processedAt: true,
    },
  },
  refunds: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amountRials: true,
      reason: true,
      status: true,
      providerReference: true,
      failureCode: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  reconciliationRecords: {
    orderBy: { checkedAt: "desc" },
    take: 25,
    select: {
      id: true,
      internalStatus: true,
      providerStatus: true,
      differenceType: true,
      resolutionStatus: true,
      safeDetails: true,
      checkedAt: true,
    },
  },
  outboxEvents: {
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      eventType: true,
      aggregateVersion: true,
      status: true,
      occurredAt: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

export type PaymentDetailRecord = Prisma.PaymentGetPayload<{
  select: typeof paymentDetailSelect;
}>;

export const paymentListSelect = {
  id: true,
  orderId: true,
  paymentNumber: true,
  currency: true,
  amountRials: true,
  status: true,
  provider: true,
  version: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      orderNumber: true,
      customerId: true,
      allocations: { take: 1, select: { branchId: true } },
    },
  },
  attempts: {
    orderBy: { attemptNumber: "desc" },
    take: 1,
    select: { providerReference: true },
  },
} satisfies Prisma.PaymentSelect;

export type PaymentListRecord = Prisma.PaymentGetPayload<{
  select: typeof paymentListSelect;
}>;

type PaymentDatabase = typeof prisma | Prisma.TransactionClient;

function database(client?: Prisma.TransactionClient): PaymentDatabase {
  return client ?? prisma;
}

function paymentWhere(
  query: PaymentListQuery,
  branchId?: string,
): Prisma.PaymentWhereInput {
  const amount: Prisma.BigIntFilter = {
    ...(query.minAmountRials ? { gte: BigInt(query.minAmountRials) } : {}),
    ...(query.maxAmountRials ? { lte: BigInt(query.maxAmountRials) } : {}),
  };
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.minAmountRials || query.maxAmountRials
      ? { amountRials: amount }
      : {}),
    ...(query.providerReference
      ? {
          attempts: {
            some: {
              providerReference: {
                contains: query.providerReference,
                mode: "insensitive",
              },
            },
          },
        }
      : {}),
    ...(query.query
      ? {
          OR: [
            {
              paymentNumber: { contains: query.query, mode: "insensitive" },
            },
            {
              order: {
                orderNumber: { contains: query.query, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
    ...(branchId ? { order: { allocations: { some: { branchId } } } } : {}),
  };
}

export const paymentRepository = {
  findById(id: string, client?: Prisma.TransactionClient) {
    return database(client).payment.findUnique({
      where: { id },
      select: paymentDetailSelect,
    });
  },

  findByOrderId(orderId: string, client?: Prisma.TransactionClient) {
    return database(client).payment.findUnique({
      where: { orderId },
      select: paymentDetailSelect,
    });
  },

  findByOrderNumber(orderNumber: string, client?: Prisma.TransactionClient) {
    return database(client).payment.findFirst({
      where: { order: { orderNumber } },
      select: paymentDetailSelect,
    });
  },

  async list(query: PaymentListQuery, branchId?: string) {
    const where = paymentWhere(query, branchId);
    const [records, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        select: paymentListSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.payment.count({ where }),
    ]);
    return { records, total };
  },
};
