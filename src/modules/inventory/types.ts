export type InventoryBranchStatus = 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
export type InventoryWarehouseStatus = InventoryBranchStatus;
export type InventoryLocationStatus = InventoryBranchStatus;
export type InventoryLocationType = 'RECEIVING' | 'STORAGE' | 'PICKUP' | 'QUARANTINE' | 'DAMAGED';
export type InventoryTrackingMode = 'NONE' | 'SERIAL' | 'IMEI' | 'SERIAL_AND_IMEI';
export type InventoryDeviceStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'RETURNED' | 'DAMAGED';
export type InventoryReservationStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'CANCELLED' | 'FULFILLED';
export type InventoryAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';

export type InventoryBranchDto = Readonly<{
  id: string;
  code: string;
  name: string;
  kind: 'STORE' | 'CENTRAL_STOCK';
  status: InventoryBranchStatus;
  city: string | null;
  address: string | null;
  phone: string | null;
  isPickupEnabled: boolean;
  warehouseCount: number;
  updatedAt: string;
}>;

export type InventoryWarehouseDto = Readonly<{
  id: string;
  branchId: string;
  branch: Readonly<{ id: string; code: string; name: string; status: InventoryBranchStatus }>;
  code: string;
  name: string;
  status: InventoryWarehouseStatus;
  locations: readonly InventoryLocationDto[];
  locationCount: number;
  updatedAt: string;
}>;

export type InventoryLocationDto = Readonly<{
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  type: InventoryLocationType;
  status: InventoryLocationStatus;
}>;

export type InventoryItemDto = Readonly<{
  id: string;
  sku: Readonly<{
    id: string;
    code: string;
    barcode: string | null;
    variantId: string;
    productName: string;
    variantTitle: string | null;
    categoryId: string | null;
  }>;
  branch: Readonly<{ id: string; code: string; name: string; status: InventoryBranchStatus }>;
  warehouse: Readonly<{ id: string; code: string; name: string; status: InventoryWarehouseStatus }>;
  location: InventoryLocationDto;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  availability: InventoryAvailability;
  trackingMode: InventoryTrackingMode;
  version: number;
  updatedAt: string;
}>;

export type InventoryMovementDto = Readonly<{
  id: string;
  skuId: string;
  skuCode: string;
  type: 'PURCHASE' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN' | 'SALE_RESERVED';
  adjustmentDirection: 'INCREASE' | 'DECREASE' | null;
  quantity: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  reference: string | null;
  createdAt: string;
}>;

/** Device identifiers are deliberately never included in public or broad list DTOs. */
export type InventoryDeviceUnitDto = Readonly<{
  id: string;
  skuCode: string;
  skuId: string;
  inventoryItemId: string | null;
  branch: Readonly<{ id: string; code: string; name: string }> | null;
  imeiMasked: string | null;
  serialNumberMasked: string | null;
  status: InventoryDeviceStatus;
  warrantyExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type InventoryDashboardDto = Readonly<{
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  skuCount: number;
  branchCount: number;
}>;

export type BranchInventoryAvailabilityDto = Readonly<{
  branchId: string;
  branchName: string;
  branchCode: string;
  availability: InventoryAvailability;
}>;

export type InventoryAvailabilityDto = Readonly<{
  skuCode: string;
  availability: InventoryAvailability;
  branches: readonly BranchInventoryAvailabilityDto[];
}>;
