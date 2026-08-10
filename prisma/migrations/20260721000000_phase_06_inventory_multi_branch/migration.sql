-- Phase 06: Inventory & multi-branch foundation
--
-- This migration is intentionally additive. It must be reviewed against a
-- production schema snapshot before deployment; it has not been executed by
-- this repository task.

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryLocationStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryLocationType" AS ENUM ('RECEIVING', 'STORAGE', 'PICKUP', 'QUARANTINE', 'DAMAGED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'SALE_RESERVED');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentDirection" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "DeviceUnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'CANCELLED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "InventoryTrackingMode" AS ENUM ('NONE', 'SERIAL', 'IMEI', 'SERIAL_AND_IMEI');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE';

-- Preserve the semantics of the existing legacy active flag for existing rows.
UPDATE "Branch"
SET "status" = CASE
    WHEN "isActive" THEN 'ACTIVE'::"BranchStatus"
    ELSE 'DISABLED'::"BranchStatus"
END;

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryLocationType" NOT NULL,
    "status" "InventoryLocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySkuPolicy" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "trackingMode" "InventoryTrackingMode" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySkuPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryItem_quantity_nonnegative_check" CHECK ("quantity" >= 0),
    CONSTRAINT "InventoryItem_reserved_nonnegative_check" CHECK ("reservedQuantity" >= 0),
    CONSTRAINT "InventoryItem_reserved_not_above_quantity_check" CHECK ("reservedQuantity" <= "quantity"),
    CONSTRAINT "InventoryItem_available_balance_check" CHECK ("availableQuantity" = "quantity" - "reservedQuantity")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "adjustmentDirection" "InventoryAdjustmentDirection",
    "reference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "performedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockMovement_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "StockMovement_distinct_locations_check" CHECK (
        "fromLocationId" IS NULL
        OR "toLocationId" IS NULL
        OR "fromLocationId" <> "toLocationId"
    )
);

-- CreateTable
CREATE TABLE "DeviceUnit" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "reservationId" TEXT,
    "imei" TEXT,
    "serialNumber" TEXT,
    "status" "DeviceUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "warrantyExpiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceUnit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeviceUnit_identifier_required_check" CHECK ("imei" IS NOT NULL OR "serialNumber" IS NOT NULL)
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "reference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryReservation_quantity_positive_check" CHECK ("quantity" > 0)
);

-- CreateIndex
CREATE INDEX "Branch_status_kind_idx" ON "Branch"("status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_branchId_code_key" ON "Warehouse"("branchId", "code");

-- CreateIndex
CREATE INDEX "Warehouse_branchId_status_idx" ON "Warehouse"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_warehouseId_code_key" ON "InventoryLocation"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_id_warehouseId_key" ON "InventoryLocation"("id", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryLocation_warehouseId_status_type_idx" ON "InventoryLocation"("warehouseId", "status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySkuPolicy_skuId_key" ON "InventorySkuPolicy"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_locationId_skuId_key" ON "InventoryItem"("locationId", "skuId");

-- CreateIndex
CREATE INDEX "InventoryItem_warehouseId_skuId_idx" ON "InventoryItem"("warehouseId", "skuId");

-- CreateIndex
CREATE INDEX "InventoryItem_skuId_availableQuantity_idx" ON "InventoryItem"("skuId", "availableQuantity");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_idempotencyKey_key" ON "StockMovement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockMovement_skuId_createdAt_idx" ON "StockMovement"("skuId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_fromLocationId_createdAt_idx" ON "StockMovement"("fromLocationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_toLocationId_createdAt_idx" ON "StockMovement"("toLocationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_reference_createdAt_idx" ON "StockMovement"("reference", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceUnit_imei_key" ON "DeviceUnit"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceUnit_serialNumber_key" ON "DeviceUnit"("serialNumber");

-- CreateIndex
CREATE INDEX "DeviceUnit_skuId_status_idx" ON "DeviceUnit"("skuId", "status");

-- CreateIndex
CREATE INDEX "DeviceUnit_inventoryItemId_status_idx" ON "DeviceUnit"("inventoryItemId", "status");

-- CreateIndex
CREATE INDEX "DeviceUnit_reservationId_status_idx" ON "DeviceUnit"("reservationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_idempotencyKey_key" ON "InventoryReservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryReservation_inventoryItemId_status_expiresAt_idx" ON "InventoryReservation"("inventoryItemId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_reference_status_idx" ON "InventoryReservation"("reference", "status");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySkuPolicy" ADD CONSTRAINT "InventorySkuPolicy_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_warehouseId_fkey" FOREIGN KEY ("locationId", "warehouseId") REFERENCES "InventoryLocation"("id", "warehouseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceUnit" ADD CONSTRAINT "DeviceUnit_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceUnit" ADD CONSTRAINT "DeviceUnit_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceUnit" ADD CONSTRAINT "DeviceUnit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
