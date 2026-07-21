import { z } from 'zod';

const cuid = z.string().cuid();
const boundedText = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => boundedText(max).nullable().optional();
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/).min(2).max(96);
const idempotencyKey = z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/);
const quantity = z.number().int().min(1).max(1_000_000);

export const branchStatusInput = z.enum(['ACTIVE', 'DISABLED', 'ARCHIVED']);
export const warehouseStatusInput = z.enum(['ACTIVE', 'DISABLED', 'ARCHIVED']);
export const inventoryLocationStatusInput = z.enum(['ACTIVE', 'DISABLED', 'ARCHIVED']);
export const inventoryLocationTypeInput = z.enum(['RECEIVING', 'STORAGE', 'PICKUP', 'QUARANTINE', 'DAMAGED']);
export const inventoryTrackingModeInput = z.enum(['NONE', 'SERIAL', 'IMEI', 'SERIAL_AND_IMEI']);
export const inventoryDeviceStatusInput = z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED']);
export const inventoryAdjustmentDirectionInput = z.enum(['INCREASE', 'DECREASE']);
export const inventoryAvailabilityInput = z.enum(['AVAILABLE', 'LIMITED', 'UNAVAILABLE']);

function luhnValid(value: string): boolean {
  let sum = 0;
  for (let index = value.length - 1, parity = 0; index >= 0; index -= 1, parity ^= 1) {
    let digit = Number(value[index]);
    if (parity === 1) digit *= 2;
    sum += digit > 9 ? digit - 9 : digit;
  }
  return sum % 10 === 0;
}

export function normalizeImei(value: string): string {
  const normalized = value.trim().replace(/[\s-]/g, '');
  if (!/^\d{14,15}$/.test(normalized)) {
    throw new Error('IMEI must contain 14 or 15 digits.');
  }
  if (normalized.length === 15 && !luhnValid(normalized)) {
    throw new Error('IMEI check digit is invalid.');
  }
  return normalized;
}

export function normalizeSerialNumber(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,64}$/.test(normalized)) {
    throw new Error('Serial number must be 6 to 64 alphanumeric characters.');
  }
  return normalized;
}

const imeiInput = z.string().trim().min(1).max(64).transform((value, context) => {
  try {
    return normalizeImei(value);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : 'Invalid IMEI.' });
    return z.NEVER;
  }
});

const serialNumberInput = z.string().trim().min(1).max(64).transform((value, context) => {
  try {
    return normalizeSerialNumber(value);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : 'Invalid serial number.' });
    return z.NEVER;
  }
});

export const inventoryPageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  branchId: cuid.optional(),
  warehouseId: cuid.optional(),
  locationId: cuid.optional(),
  sku: code.optional(),
  categoryId: cuid.optional(),
  availability: inventoryAvailabilityInput.optional(),
  query: z.string().trim().min(1).max(160).optional(),
}).strict();

export const inventoryResourcePageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  branchId: cuid.optional(),
}).strict();

export const inventorySkuRouteInput = z.object({ sku: code }).strict();
export const branchIdRouteInput = z.object({ id: cuid }).strict();
export const warehouseIdRouteInput = z.object({ id: cuid }).strict();

export const createInventoryLocationInput = z.object({
  code,
  name: boundedText(160),
  type: inventoryLocationTypeInput,
  status: inventoryLocationStatusInput.default('ACTIVE'),
}).strict();

export const createBranchInput = z.object({
  code,
  name: boundedText(160),
  kind: z.enum(['STORE', 'CENTRAL_STOCK']).default('STORE'),
  status: branchStatusInput.default('ACTIVE'),
  city: nullableText(120),
  address: nullableText(2_000),
  phone: z.string().trim().min(6).max(40).nullable().optional(),
  isPickupEnabled: z.boolean().default(true),
}).strict();

export const updateBranchInput = createBranchInput.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one branch field must change.',
);

export const createWarehouseInput = z.object({
  branchId: cuid,
  code,
  name: boundedText(160),
  status: warehouseStatusInput.default('ACTIVE'),
  locations: z.array(createInventoryLocationInput).min(1).max(50).superRefine((items, context) => {
    const values = items.map((item) => item.code);
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Location codes must be unique within a warehouse.' });
    }
  }),
}).strict();

export const updateWarehouseInput = z.object({
  code: code.optional(),
  name: boundedText(160).optional(),
  status: warehouseStatusInput.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one warehouse field must change.');

export const inventoryDeviceInput = z.object({
  imei: imeiInput.optional(),
  serialNumber: serialNumberInput.optional(),
  warrantyExpiresAt: z.coerce.date().optional(),
}).strict().superRefine((value, context) => {
  if (!value.imei && !value.serialNumber) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['imei'], message: 'IMEI or serial number is required.' });
  }
});

export const updateInventorySkuPolicyInput = z.object({
  sku: code,
  trackingMode: inventoryTrackingModeInput,
}).strict();

const stockOperationBase = z.object({
  sku: code,
  quantity,
  reference: boundedText(160).nullable().optional(),
  idempotencyKey,
}).strict();

export const receiveInventoryInput = stockOperationBase.extend({
  toLocationId: cuid,
  devices: z.array(inventoryDeviceInput).max(1_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.devices && value.devices.length !== value.quantity) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['devices'], message: 'Tracked device count must equal received quantity.' });
  }
});

export const adjustInventoryInput = stockOperationBase.extend({
  locationId: cuid,
  direction: inventoryAdjustmentDirectionInput,
  reason: boundedText(1_000),
}).strict();

export const transferInventoryInput = stockOperationBase.extend({
  fromLocationId: cuid,
  toLocationId: cuid,
  deviceUnitIds: z.array(cuid).min(1).max(1_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.fromLocationId === value.toLocationId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['toLocationId'], message: 'Source and destination locations must differ.' });
  }
  if (value.deviceUnitIds && new Set(value.deviceUnitIds).size !== value.deviceUnitIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deviceUnitIds'], message: 'Device unit identifiers must be unique.' });
  }
});

export const createInventoryReservationInput = z.object({
  inventoryItemId: cuid,
  quantity,
  deviceUnitIds: z.array(cuid).min(1).max(1_000).optional(),
  reference: boundedText(160).nullable().optional(),
  expiresAt: z.coerce.date().optional(),
  idempotencyKey,
}).strict().superRefine((value, context) => {
  if (value.deviceUnitIds && new Set(value.deviceUnitIds).size !== value.deviceUnitIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deviceUnitIds'], message: 'Device unit identifiers must be unique.' });
  }
});

export const releaseInventoryReservationInput = z.object({
  reservationId: cuid,
  idempotencyKey,
}).strict();

export const inventoryDeviceListQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sku: code.optional(),
  branchId: cuid.optional(),
  status: inventoryDeviceStatusInput.optional(),
  query: z.string().trim().min(3).max(64).optional(),
}).strict();

export type InventoryPageQuery = z.output<typeof inventoryPageQuery>;
export type InventoryResourcePageQuery = z.output<typeof inventoryResourcePageQuery>;
export type CreateBranchInput = z.output<typeof createBranchInput>;
export type UpdateBranchInput = z.output<typeof updateBranchInput>;
export type CreateWarehouseInput = z.output<typeof createWarehouseInput>;
export type UpdateWarehouseInput = z.output<typeof updateWarehouseInput>;
export type ReceiveInventoryInput = z.output<typeof receiveInventoryInput>;
export type AdjustInventoryInput = z.output<typeof adjustInventoryInput>;
export type TransferInventoryInput = z.output<typeof transferInventoryInput>;
export type CreateInventoryReservationInput = z.output<typeof createInventoryReservationInput>;
export type InventoryDeviceListQuery = z.output<typeof inventoryDeviceListQuery>;
export type UpdateInventorySkuPolicyInput = z.output<typeof updateInventorySkuPolicyInput>;
