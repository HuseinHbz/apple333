import type { Prisma } from "@prisma/client";

import type { OrderListQuery } from "@/modules/orders/validators";
import type { AdminDatabaseClient } from "@/server/admin/database";
import { prisma } from "@/server/db/prisma";

const orderItemSelect = {
  id: true,
  productId: true,
  variantId: true,
  productSkuId: true,
  sku: true,
  productName: true,
  variantName: true,
  quantity: true,
  unitPriceRials: true,
  discountAmountRials: true,
  taxAmountRials: true,
  lineTotalRials: true,
  warrantySnapshot: true,
  attributesSnapshot: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderItemSelect;

const allocationSelect = {
  id: true,
  orderItemId: true,
  branchId: true,
  warehouseId: true,
  inventoryItemId: true,
  reservationId: true,
  quantity: true,
  status: true,
  branch: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  reservation: { select: { id: true, status: true, expiresAt: true } },
  deviceAssignments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      imeiSnapshot: true,
      serialNumberSnapshot: true,
      deviceUnit: { select: { id: true, status: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderAllocationSelect;

const paymentSelect = {
  id: true,
  provider: true,
  method: true,
  amountRials: true,
  status: true,
  providerReference: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderPaymentSelect;

const fulfillmentSelect = {
  id: true,
  method: true,
  branchId: true,
  warehouseId: true,
  status: true,
  trackingCode: true,
  preparedAt: true,
  shippedAt: true,
  deliveredAt: true,
  branch: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderFulfillmentSelect;

const statusHistorySelect = {
  id: true,
  fromStatus: true,
  toStatus: true,
  actorId: true,
  actorType: true,
  reasonCode: true,
  note: true,
  requestId: true,
  version: true,
  actor: { select: { id: true, name: true, email: true } },
  createdAt: true,
} satisfies Prisma.OrderStatusHistorySelect;

const noteSelect = {
  id: true,
  visibility: true,
  content: true,
  authorId: true,
  author: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderNoteSelect;

export const orderDetailSelect = {
  id: true,
  orderNumber: true,
  source: true,
  type: true,
  customerId: true,
  sourceCartId: true,
  guestTokenHash: true,
  customerSnapshot: true,
  billingAddressSnapshot: true,
  shippingAddressSnapshot: true,
  currency: true,
  subtotalRials: true,
  discountTotalRials: true,
  taxTotalRials: true,
  shippingTotalRials: true,
  feeTotalRials: true,
  grandTotalRials: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  fulfillmentMethod: true,
  orderStatus: true,
  allocationStatus: true,
  version: true,
  items: { orderBy: { createdAt: "asc" }, select: orderItemSelect },
  allocations: { orderBy: { createdAt: "asc" }, select: allocationSelect },
  payments: { orderBy: { createdAt: "asc" }, select: paymentSelect },
  fulfillment: { select: fulfillmentSelect },
  statusHistory: { orderBy: { createdAt: "asc" }, select: statusHistorySelect },
  notes: { orderBy: { createdAt: "asc" }, select: noteSelect },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

export type OrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof orderDetailSelect;
}>;

export const orderListSelect = {
  id: true,
  orderNumber: true,
  source: true,
  type: true,
  customerId: true,
  customerSnapshot: true,
  currency: true,
  subtotalRials: true,
  discountTotalRials: true,
  taxTotalRials: true,
  shippingTotalRials: true,
  feeTotalRials: true,
  grandTotalRials: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  fulfillmentMethod: true,
  orderStatus: true,
  allocationStatus: true,
  version: true,
  allocations: {
    take: 1,
    orderBy: { createdAt: "asc" },
    select: { branchId: true, branch: { select: { code: true, name: true } } },
  },
  _count: { select: { items: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

export type OrderListRecord = Prisma.OrderGetPayload<{
  select: typeof orderListSelect;
}>;

export const checkoutCartSelect = {
  id: true,
  userId: true,
  guestTokenHash: true,
  status: true,
  version: true,
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      quantity: true,
      unitPriceRials: true,
      variant: {
        select: {
          id: true,
          title: true,
          attributes: true,
          priceRials: true,
          isActive: true,
          deletedAt: true,
          product: {
            select: { id: true, name: true, status: true, deletedAt: true },
          },
          warrantyRecord: {
            select: {
              code: true,
              provider: true,
              name: true,
              durationMonths: true,
              isActive: true,
              deletedAt: true,
            },
          },
          skuRecord: {
            select: {
              id: true,
              code: true,
              priceRials: true,
              status: true,
              deletedAt: true,
              inventoryPolicy: { select: { trackingMode: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.StorefrontCartSelect;

export type CheckoutCartRecord = Prisma.StorefrontCartGetPayload<{
  select: typeof checkoutCartSelect;
}>;

export const orderCatalogVariantSelect = {
  id: true,
  title: true,
  attributes: true,
  priceRials: true,
  isActive: true,
  deletedAt: true,
  product: {
    select: { id: true, name: true, status: true, deletedAt: true },
  },
  warrantyRecord: {
    select: {
      code: true,
      provider: true,
      name: true,
      durationMonths: true,
      isActive: true,
      deletedAt: true,
    },
  },
  skuRecord: {
    select: {
      id: true,
      code: true,
      priceRials: true,
      status: true,
      deletedAt: true,
      inventoryPolicy: { select: { trackingMode: true } },
    },
  },
} satisfies Prisma.CatalogVariantSelect;

export type OrderCatalogVariant = Prisma.CatalogVariantGetPayload<{
  select: typeof orderCatalogVariantSelect;
}>;

const customerSelect = {
  id: true,
  name: true,
  email: true,
  mobile: true,
  status: true,
} satisfies Prisma.UserSelect;

export type OrderCustomerRecord = Prisma.UserGetPayload<{
  select: typeof customerSelect;
}>;

const addressSelect = {
  id: true,
  userId: true,
  recipientName: true,
  mobile: true,
  province: true,
  city: true,
  line1: true,
  postalCode: true,
} satisfies Prisma.AddressSelect;

export type OrderAddressRecord = Prisma.AddressGetPayload<{
  select: typeof addressSelect;
}>;

const inventoryCandidateSelect = {
  id: true,
  warehouseId: true,
  locationId: true,
  skuId: true,
  quantity: true,
  reservedQuantity: true,
  availableQuantity: true,
  version: true,
  sku: {
    select: {
      id: true,
      code: true,
      variantId: true,
      inventoryPolicy: { select: { trackingMode: true } },
    },
  },
  location: {
    select: {
      id: true,
      type: true,
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              isActive: true,
              isPickupEnabled: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InventoryItemSelect;

export type OrderInventoryCandidate = Prisma.InventoryItemGetPayload<{
  select: typeof inventoryCandidateSelect;
}>;

function orderWhere(query: OrderListQuery): Prisma.OrderWhereInput {
  const filters: Prisma.OrderWhereInput[] = [];
  if (query.customerId !== undefined)
    filters.push({ customerId: query.customerId });
  if (query.branchId !== undefined)
    filters.push({ allocations: { some: { branchId: query.branchId } } });
  if (query.source !== undefined) filters.push({ source: query.source });
  if (query.status !== undefined) filters.push({ orderStatus: query.status });
  if (query.paymentStatus !== undefined)
    filters.push({ paymentStatus: query.paymentStatus });
  if (query.allocationStatus !== undefined)
    filters.push({ allocationStatus: query.allocationStatus });
  if (query.fulfillmentStatus !== undefined)
    filters.push({ fulfillmentStatus: query.fulfillmentStatus });
  if (query.createdFrom !== undefined || query.createdTo !== undefined) {
    filters.push({
      createdAt: {
        ...(query.createdFrom === undefined ? {} : { gte: query.createdFrom }),
        ...(query.createdTo === undefined ? {} : { lte: query.createdTo }),
      },
    });
  }
  if (query.query !== undefined) {
    filters.push({
      OR: [
        { orderNumber: { contains: query.query, mode: "insensitive" } },
        {
          customer: {
            is: {
              OR: [
                { email: { contains: query.query, mode: "insensitive" } },
                { mobile: { contains: query.query } },
                { name: { contains: query.query, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }
  return filters.length === 0 ? {} : { AND: filters };
}

export const orderRepository = {
  findCheckoutCartByGuestTokenHash(
    guestTokenHash: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<CheckoutCartRecord | null> {
    return client.storefrontCart.findFirst({
      where: { guestTokenHash, status: "ACTIVE" },
      select: checkoutCartSelect,
    });
  },

  findCustomerById(
    id: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<OrderCustomerRecord | null> {
    return client.user.findUnique({ where: { id }, select: customerSelect });
  },

  findAddressForCustomer(
    id: string,
    userId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<OrderAddressRecord | null> {
    return client.address.findFirst({
      where: { id, userId },
      select: addressSelect,
    });
  },

  findCatalogVariants(
    variantIds: readonly string[],
    client: AdminDatabaseClient,
  ): Promise<readonly OrderCatalogVariant[]> {
    return client.catalogVariant.findMany({
      where: { id: { in: [...variantIds] } },
      select: orderCatalogVariantSelect,
    });
  },

  findOrderById(
    id: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<OrderDetailRecord | null> {
    return client.order.findUnique({
      where: { id },
      select: orderDetailSelect,
    });
  },

  findOrderByNumber(
    orderNumber: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<OrderDetailRecord | null> {
    return client.order.findUnique({
      where: { orderNumber },
      select: orderDetailSelect,
    });
  },

  /**
   * Customer detail queries are scoped in SQL rather than loading an arbitrary
   * order number and relying on a later ownership check. This is a
   * defence-in-depth boundary for IDOR resistance; callers still enforce
   * `orders.read_own` before issuing the query.
   */
  findOrderForCustomerByNumber(
    orderNumber: string,
    customerId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<OrderDetailRecord | null> {
    return client.order.findFirst({
      where: { orderNumber, customerId },
      select: orderDetailSelect,
    });
  },

  findOrderBySourceCartId(
    sourceCartId: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<OrderDetailRecord | null> {
    return client.order.findUnique({
      where: { sourceCartId },
      select: orderDetailSelect,
    });
  },

  async findOrderPage(
    query: OrderListQuery,
    client: AdminDatabaseClient = prisma,
  ): Promise<Readonly<{ items: readonly OrderListRecord[]; total: number }>> {
    const where = orderWhere(query);
    const [items, total] = await Promise.all([
      client.order.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: orderListSelect,
      }),
      client.order.count({ where }),
    ]);
    return { items, total };
  },

  findIdempotencyRecord(
    scope: string,
    key: string,
    client: AdminDatabaseClient = prisma,
  ) {
    return client.orderIdempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
      select: {
        id: true,
        requestHash: true,
        responseReference: true,
        orderId: true,
        expiresAt: true,
      },
    });
  },

  createIdempotencyRecord(
    data: Prisma.OrderIdempotencyRecordUncheckedCreateInput,
    client: AdminDatabaseClient,
  ) {
    return client.orderIdempotencyRecord.create({
      data,
      select: { id: true, orderId: true, responseReference: true },
    });
  },

  markCartConverted(
    input: Readonly<{ cartId: string; version: number; customerId: string }>,
    client: AdminDatabaseClient,
  ) {
    return client.storefrontCart.updateMany({
      where: { id: input.cartId, status: "ACTIVE", version: input.version },
      data: {
        status: "CONVERTED",
        userId: input.customerId,
        guestTokenHash: null,
        version: { increment: 1 },
      },
    });
  },

  findSellableInventoryCandidates(
    variantIds: readonly string[],
    branchId: string | undefined,
    client: AdminDatabaseClient,
  ): Promise<readonly OrderInventoryCandidate[]> {
    return client.inventoryItem.findMany({
      where: {
        availableQuantity: { gt: 0 },
        sku: {
          is: {
            variantId: { in: [...variantIds] },
            status: "ACTIVE",
            deletedAt: null,
          },
        },
        location: {
          is: {
            type: { in: ["STORAGE", "PICKUP"] },
            status: "ACTIVE",
            warehouse: {
              is: {
                status: "ACTIVE",
                ...(branchId === undefined ? {} : { branchId }),
                branch: { is: { status: "ACTIVE", isActive: true } },
              },
            },
          },
        },
      },
      orderBy: [{ availableQuantity: "desc" }, { id: "asc" }],
      select: inventoryCandidateSelect,
    });
  },
};
