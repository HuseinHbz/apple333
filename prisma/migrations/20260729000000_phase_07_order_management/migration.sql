-- Phase 07: Enterprise Order Management System
--
-- Additive-only migration. It must be applied only after the Phase 07
-- disposable-environment preflight confirms database ownership. Do not edit
-- any previously applied migration and do not run this file against a shared
-- or production database from development tooling.

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('STOREFRONT', 'ADMIN', 'BRANCH_POS', 'CALL_CENTER', 'IMPORT', 'API');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('STANDARD_SALE', 'PICKUP', 'DELIVERY', 'RESERVATION', 'PREORDER', 'INSTALLMENT_PLACEHOLDER', 'TRADE_IN_PLACEHOLDER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'AUTHORIZED', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderAllocationStatus" AS ENUM ('UNALLOCATED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'ALLOCATION_FAILED', 'RELEASED');

-- CreateEnum
CREATE TYPE "OrderFulfillmentStatus" AS ENUM ('UNFULFILLED', 'PENDING', 'PICKING', 'PACKED', 'READY_FOR_PICKUP', 'SHIPPED', 'PARTIALLY_FULFILLED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderFulfillmentMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "OrderNoteVisibility" AS ENUM ('INTERNAL', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "OrderActorType" AS ENUM ('CUSTOMER', 'ADMIN', 'GUEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrderEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderDeviceAssignmentStatus" AS ENUM ('RESERVED', 'RELEASED', 'FULFILLED');

-- AlterTable (all nullable to preserve historical audit records)
ALTER TYPE "StockMovementType" ADD VALUE 'SALE_FULFILLED';
ALTER TABLE "StorefrontCartItem" ADD COLUMN "unitPriceRials" BIGINT;
ALTER TABLE "StorefrontCartItem" ADD CONSTRAINT "StorefrontCartItem_unit_price_nonnegative_check" CHECK ("unitPriceRials" IS NULL OR "unitPriceRials" >= 0);

-- Authenticated checkout requires a customer-owned credential source. This is
-- nullable and additive so existing account creation flows remain compatible.
ALTER TABLE "UserProfile" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "reasonCode" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "beforeSnapshot" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "afterSnapshot" JSONB;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "type" "OrderType" NOT NULL,
    "customerId" TEXT,
    "sourceCartId" TEXT,
    "guestTokenHash" TEXT,
    "customerSnapshot" JSONB NOT NULL,
    "billingAddressSnapshot" JSONB,
    "shippingAddressSnapshot" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "subtotalRials" BIGINT NOT NULL,
    "discountTotalRials" BIGINT NOT NULL DEFAULT 0,
    "taxTotalRials" BIGINT NOT NULL DEFAULT 0,
    "shippingTotalRials" BIGINT NOT NULL DEFAULT 0,
    "feeTotalRials" BIGINT NOT NULL DEFAULT 0,
    "grandTotalRials" BIGINT NOT NULL,
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "fulfillmentMethod" "OrderFulfillmentMethod" NOT NULL,
    "orderStatus" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "allocationStatus" "OrderAllocationStatus" NOT NULL DEFAULT 'UNALLOCATED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Order_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "Order_money_nonnegative_check" CHECK (
      "subtotalRials" >= 0 AND "discountTotalRials" >= 0 AND "taxTotalRials" >= 0
      AND "shippingTotalRials" >= 0 AND "feeTotalRials" >= 0 AND "grandTotalRials" >= 0
    ),
    CONSTRAINT "Order_grand_total_balance_check" CHECK (
      "grandTotalRials" = "subtotalRials" - "discountTotalRials" + "taxTotalRials" + "shippingTotalRials" + "feeTotalRials"
    )
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productSkuId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceRials" BIGINT NOT NULL,
    "discountAmountRials" BIGINT NOT NULL DEFAULT 0,
    "taxAmountRials" BIGINT NOT NULL DEFAULT 0,
    "lineTotalRials" BIGINT NOT NULL,
    "warrantySnapshot" JSONB,
    "attributesSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderItem_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "OrderItem_money_nonnegative_check" CHECK (
      "unitPriceRials" >= 0 AND "discountAmountRials" >= 0 AND "taxAmountRials" >= 0 AND "lineTotalRials" >= 0
    ),
    CONSTRAINT "OrderItem_line_total_balance_check" CHECK (
      "lineTotalRials" = "unitPriceRials" * "quantity" - "discountAmountRials" + "taxAmountRials"
    )
);

-- CreateTable
CREATE TABLE "OrderAllocation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "reservationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "OrderAllocationStatus" NOT NULL DEFAULT 'UNALLOCATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderAllocation_quantity_positive_check" CHECK ("quantity" > 0)
);

-- CreateTable
CREATE TABLE "OrderDeviceAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "orderAllocationId" TEXT NOT NULL,
    "deviceUnitId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "imeiSnapshot" TEXT,
    "serialNumberSnapshot" TEXT,
    "status" "OrderDeviceAssignmentStatus" NOT NULL DEFAULT 'RESERVED',
    "releasedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDeviceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountRials" BIGINT NOT NULL,
    "status" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "idempotencyKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderPayment_amount_nonnegative_check" CHECK ("amountRials" >= 0)
);

-- CreateTable
CREATE TABLE "OrderFulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "OrderFulfillmentMethod" NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "status" "OrderFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingCode" TEXT,
    "preparedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorId" TEXT,
    "actorType" "OrderActorType" NOT NULL,
    "reasonCode" TEXT,
    "note" TEXT,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderStatusHistory_version_positive_check" CHECK ("version" > 0)
);

-- CreateTable
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "visibility" "OrderNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseReference" TEXT NOT NULL,
    "orderId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderOutboxEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "OrderEventStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderOutboxEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderOutboxEvent_version_positive_check" CHECK ("aggregateVersion" > 0),
    CONSTRAINT "OrderOutboxEvent_attempts_nonnegative_check" CHECK ("attempts" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_sourceCartId_key" ON "Order"("sourceCartId");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "Order_guestTokenHash_createdAt_idx" ON "Order"("guestTokenHash", "createdAt");
CREATE INDEX "Order_orderStatus_createdAt_idx" ON "Order"("orderStatus", "createdAt");
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");
CREATE INDEX "Order_fulfillmentStatus_createdAt_idx" ON "Order"("fulfillmentStatus", "createdAt");
CREATE INDEX "Order_source_createdAt_idx" ON "Order"("source", "createdAt");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_updatedAt_idx" ON "Order"("updatedAt");

CREATE INDEX "OrderItem_orderId_createdAt_idx" ON "OrderItem"("orderId", "createdAt");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
CREATE INDEX "OrderItem_productSkuId_idx" ON "OrderItem"("productSkuId");

CREATE UNIQUE INDEX "OrderAllocation_reservationId_key" ON "OrderAllocation"("reservationId");
CREATE UNIQUE INDEX "OrderAllocation_active_order_item_key" ON "OrderAllocation"("orderItemId") WHERE "status" = 'ALLOCATED';
CREATE INDEX "OrderAllocation_orderId_status_idx" ON "OrderAllocation"("orderId", "status");
CREATE INDEX "OrderAllocation_orderItemId_status_idx" ON "OrderAllocation"("orderItemId", "status");
CREATE INDEX "OrderAllocation_branchId_status_idx" ON "OrderAllocation"("branchId", "status");
CREATE INDEX "OrderAllocation_warehouseId_status_idx" ON "OrderAllocation"("warehouseId", "status");
CREATE INDEX "OrderAllocation_inventoryItemId_status_idx" ON "OrderAllocation"("inventoryItemId", "status");

CREATE UNIQUE INDEX "OrderDeviceAssignment_orderAllocationId_deviceUnitId_key" ON "OrderDeviceAssignment"("orderAllocationId", "deviceUnitId");
CREATE UNIQUE INDEX "OrderDeviceAssignment_active_device_unit_key" ON "OrderDeviceAssignment"("deviceUnitId") WHERE "status" = 'RESERVED';
CREATE INDEX "OrderDeviceAssignment_orderId_status_idx" ON "OrderDeviceAssignment"("orderId", "status");
CREATE INDEX "OrderDeviceAssignment_orderItemId_status_idx" ON "OrderDeviceAssignment"("orderItemId", "status");
CREATE INDEX "OrderDeviceAssignment_deviceUnitId_status_idx" ON "OrderDeviceAssignment"("deviceUnitId", "status");
CREATE INDEX "OrderDeviceAssignment_reservationId_status_idx" ON "OrderDeviceAssignment"("reservationId", "status");

CREATE UNIQUE INDEX "OrderPayment_orderId_idempotencyKey_key" ON "OrderPayment"("orderId", "idempotencyKey");
CREATE UNIQUE INDEX "OrderPayment_providerReference_key" ON "OrderPayment"("providerReference");
CREATE INDEX "OrderPayment_orderId_status_createdAt_idx" ON "OrderPayment"("orderId", "status", "createdAt");
CREATE INDEX "OrderPayment_status_createdAt_idx" ON "OrderPayment"("status", "createdAt");

CREATE UNIQUE INDEX "OrderFulfillment_orderId_key" ON "OrderFulfillment"("orderId");
CREATE INDEX "OrderFulfillment_branchId_status_idx" ON "OrderFulfillment"("branchId", "status");
CREATE INDEX "OrderFulfillment_warehouseId_status_idx" ON "OrderFulfillment"("warehouseId", "status");
CREATE INDEX "OrderFulfillment_status_createdAt_idx" ON "OrderFulfillment"("status", "createdAt");

CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");
CREATE INDEX "OrderStatusHistory_actorId_createdAt_idx" ON "OrderStatusHistory"("actorId", "createdAt");
CREATE INDEX "OrderStatusHistory_requestId_idx" ON "OrderStatusHistory"("requestId");
CREATE INDEX "OrderNote_orderId_visibility_createdAt_idx" ON "OrderNote"("orderId", "visibility", "createdAt");
CREATE INDEX "OrderNote_authorId_createdAt_idx" ON "OrderNote"("authorId", "createdAt");

CREATE UNIQUE INDEX "OrderIdempotencyRecord_scope_key_key" ON "OrderIdempotencyRecord"("scope", "key");
CREATE INDEX "OrderIdempotencyRecord_expiresAt_idx" ON "OrderIdempotencyRecord"("expiresAt");
CREATE INDEX "OrderIdempotencyRecord_orderId_idx" ON "OrderIdempotencyRecord"("orderId");

CREATE UNIQUE INDEX "OrderOutboxEvent_orderId_eventType_aggregateVersion_key" ON "OrderOutboxEvent"("orderId", "eventType", "aggregateVersion");
CREATE INDEX "OrderOutboxEvent_status_availableAt_idx" ON "OrderOutboxEvent"("status", "availableAt");
CREATE INDEX "OrderOutboxEvent_orderId_occurredAt_idx" ON "OrderOutboxEvent"("orderId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_sourceCartId_fkey" FOREIGN KEY ("sourceCartId") REFERENCES "StorefrontCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CatalogVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productSkuId_fkey" FOREIGN KEY ("productSkuId") REFERENCES "ProductSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAllocation" ADD CONSTRAINT "OrderAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderDeviceAssignment" ADD CONSTRAINT "OrderDeviceAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDeviceAssignment" ADD CONSTRAINT "OrderDeviceAssignment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDeviceAssignment" ADD CONSTRAINT "OrderDeviceAssignment_orderAllocationId_fkey" FOREIGN KEY ("orderAllocationId") REFERENCES "OrderAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDeviceAssignment" ADD CONSTRAINT "OrderDeviceAssignment_deviceUnitId_fkey" FOREIGN KEY ("deviceUnitId") REFERENCES "DeviceUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderDeviceAssignment" ADD CONSTRAINT "OrderDeviceAssignment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderFulfillment" ADD CONSTRAINT "OrderFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderFulfillment" ADD CONSTRAINT "OrderFulfillment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderFulfillment" ADD CONSTRAINT "OrderFulfillment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderIdempotencyRecord" ADD CONSTRAINT "OrderIdempotencyRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderOutboxEvent" ADD CONSTRAINT "OrderOutboxEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
