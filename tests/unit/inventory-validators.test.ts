import { describe, expect, it } from 'vitest';

import {
  adjustInventoryInput,
  createBranchInput,
  createInventoryReservationInput,
  createWarehouseInput,
  inventoryDeviceInput,
  inventoryDeviceListQuery,
  inventoryPageQuery,
  inventoryResourcePageQuery,
  normalizeImei,
  normalizeSerialNumber,
  receiveInventoryInput,
  releaseInventoryReservationInput,
  transferInventoryInput,
  updateBranchInput,
  updateInventorySkuPolicyInput,
  updateWarehouseInput,
} from '@/modules/inventory/validators';

const BRANCH_ID = 'ckz8x8x8x000001l4h3e5f6g7';
const WAREHOUSE_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k2';
const LOCATION_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k3';
const OTHER_LOCATION_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k4';
const INVENTORY_ITEM_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k5';
const RESERVATION_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k6';
const KEY = 'inventory-test-key-0001';

describe('inventory input validation', () => {
  it.each([
    ['490154203237518', '490154203237518'],
    ['4901-5420 3237 518', '490154203237518'],
    ['12345678901234', '12345678901234'],
  ])('normalizes IMEI %s', (source, expected) => {
    expect(normalizeImei(source)).toBe(expected);
  });

  it.each(['490154203237519', '1234567890123', '1234567890123456', '4901542032375AA'])('rejects invalid IMEI %s', (imei) => {
    expect(() => normalizeImei(imei)).toThrow();
  });

  it.each([
    ['f2lzq0abcdef', 'F2LZQ0ABCDEF'],
    [' C02ZX0ABCD12 ', 'C02ZX0ABCD12'],
  ])('normalizes Apple serial %s', (source, expected) => {
    expect(normalizeSerialNumber(source)).toBe(expected);
  });

  it.each(['short', 'SERIAL-INVALID', 'ABC123!'])('rejects unsafe serial %s', (serial) => {
    expect(() => normalizeSerialNumber(serial)).toThrow();
  });

  it('enforces an IMEI or serial for a device unit', () => {
    expect(inventoryDeviceInput.parse({ imei: '490154203237518' })).toMatchObject({ imei: '490154203237518' });
    expect(inventoryDeviceInput.parse({ serialNumber: 'f2lzq0abcdef' })).toMatchObject({ serialNumber: 'F2LZQ0ABCDEF' });
    expect(() => inventoryDeviceInput.parse({})).toThrow();
  });

  it('applies bounded, strict inventory page defaults', () => {
    expect(inventoryPageQuery.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(inventoryPageQuery.parse({ page: '2', pageSize: '50', sku: 'iphone-16-pro-256', availability: 'LIMITED' })).toMatchObject({ page: 2, pageSize: 50, sku: 'IPHONE-16-PRO-256', availability: 'LIMITED' });
    expect(() => inventoryPageQuery.parse({ pageSize: 101 })).toThrow();
    expect(() => inventoryPageQuery.parse({ unknown: true })).toThrow();
  });

  it('parses resource pagination and branch filters', () => {
    expect(inventoryResourcePageQuery.parse({ page: '3', pageSize: '10', branchId: BRANCH_ID })).toEqual({ page: 3, pageSize: 10, branchId: BRANCH_ID });
    expect(() => inventoryResourcePageQuery.parse({ branchId: 'not-a-cuid' })).toThrow();
  });

  it('creates a branch with safe defaults and normalized code', () => {
    expect(createBranchInput.parse({ code: ' tehran-01 ', name: 'Tehran Store' })).toMatchObject({ code: 'TEHRAN-01', kind: 'STORE', status: 'ACTIVE', isPickupEnabled: true });
  });

  it.each([
    [{ code: 'A', name: 'Branch' }],
    [{ code: 'BRANCH-01', name: '' }],
    [{ code: 'BRANCH-01', name: 'Branch', unexpected: true }],
  ])('rejects invalid branch payload %#', (payload) => {
    expect(() => createBranchInput.parse(payload)).toThrow();
  });

  it('requires at least one branch update field', () => {
    expect(updateBranchInput.parse({ status: 'DISABLED' })).toEqual({ status: 'DISABLED' });
    expect(() => updateBranchInput.parse({})).toThrow();
  });

  it('requires an initial unique location for a new warehouse', () => {
    expect(createWarehouseInput.parse({ branchId: BRANCH_ID, code: 'central-01', name: 'Central', locations: [{ code: 'main', name: 'Main', type: 'STORAGE' }] })).toMatchObject({ code: 'CENTRAL-01', locations: [{ code: 'MAIN', status: 'ACTIVE' }] });
    expect(() => createWarehouseInput.parse({ branchId: BRANCH_ID, code: 'CENTRAL-01', name: 'Central', locations: [] })).toThrow();
    expect(() => createWarehouseInput.parse({ branchId: BRANCH_ID, code: 'CENTRAL-01', name: 'Central', locations: [{ code: 'MAIN', name: 'One', type: 'STORAGE' }, { code: 'MAIN', name: 'Two', type: 'PICKUP' }] })).toThrow();
  });

  it('requires a real warehouse mutation', () => {
    expect(updateWarehouseInput.parse({ status: 'DISABLED' })).toEqual({ status: 'DISABLED' });
    expect(() => updateWarehouseInput.parse({})).toThrow();
  });

  it('validates untracked stock receiving', () => {
    expect(receiveInventoryInput.parse({ sku: 'iphone-16-pro', toLocationId: LOCATION_ID, quantity: 3, idempotencyKey: KEY })).toMatchObject({ sku: 'IPHONE-16-PRO', quantity: 3 });
  });

  it('requires one supplied tracked unit per received quantity when supplied', () => {
    expect(receiveInventoryInput.parse({ sku: 'iphone-16-pro', toLocationId: LOCATION_ID, quantity: 2, idempotencyKey: KEY, devices: [{ imei: '490154203237518' }, { serialNumber: 'F2LZQ0ABCDEF' }] }).devices).toHaveLength(2);
    expect(() => receiveInventoryInput.parse({ sku: 'iphone-16-pro', toLocationId: LOCATION_ID, quantity: 2, idempotencyKey: KEY, devices: [{ imei: '490154203237518' }] })).toThrow();
  });

  it.each([
    ['INCREASE', 4],
    ['DECREASE', 1],
  ])('validates %s inventory adjustment', (direction, quantity) => {
    expect(adjustInventoryInput.parse({ sku: 'iphone-16-pro', locationId: LOCATION_ID, quantity, direction, reason: 'cycle count', idempotencyKey: KEY })).toMatchObject({ direction, quantity });
  });

  it.each([
    [{ sku: 'IPHONE-16-PRO', locationId: LOCATION_ID, quantity: 0, direction: 'INCREASE', reason: 'count', idempotencyKey: KEY }],
    [{ sku: 'IPHONE-16-PRO', locationId: LOCATION_ID, quantity: 1, direction: 'INCREASE', reason: '', idempotencyKey: KEY }],
  ])('rejects invalid adjustment %#', (payload) => {
    expect(() => adjustInventoryInput.parse(payload)).toThrow();
  });

  it('requires different source and destination locations', () => {
    expect(transferInventoryInput.parse({ sku: 'iphone-16-pro', fromLocationId: LOCATION_ID, toLocationId: OTHER_LOCATION_ID, quantity: 1, idempotencyKey: KEY })).toMatchObject({ sku: 'IPHONE-16-PRO' });
    expect(() => transferInventoryInput.parse({ sku: 'IPHONE-16-PRO', fromLocationId: LOCATION_ID, toLocationId: LOCATION_ID, quantity: 1, idempotencyKey: KEY })).toThrow();
  });

  it('accepts only unique, bounded tracked-device selections for a transfer', () => {
    expect(transferInventoryInput.parse({
      sku: 'IPHONE-16-PRO',
      fromLocationId: LOCATION_ID,
      toLocationId: OTHER_LOCATION_ID,
      quantity: 1,
      deviceUnitIds: [INVENTORY_ITEM_ID],
      idempotencyKey: KEY,
    }).deviceUnitIds).toEqual([INVENTORY_ITEM_ID]);
    expect(() => transferInventoryInput.parse({
      sku: 'IPHONE-16-PRO',
      fromLocationId: LOCATION_ID,
      toLocationId: OTHER_LOCATION_ID,
      quantity: 2,
      deviceUnitIds: [INVENTORY_ITEM_ID, INVENTORY_ITEM_ID],
      idempotencyKey: KEY,
    })).toThrow();
  });

  it('requires bounded opaque reservation keys and quantities', () => {
    expect(createInventoryReservationInput.parse({ inventoryItemId: INVENTORY_ITEM_ID, quantity: 1, idempotencyKey: KEY })).toMatchObject({ inventoryItemId: INVENTORY_ITEM_ID, quantity: 1 });
    expect(() => createInventoryReservationInput.parse({ inventoryItemId: INVENTORY_ITEM_ID, quantity: 0, idempotencyKey: KEY })).toThrow();
    expect(() => createInventoryReservationInput.parse({ inventoryItemId: INVENTORY_ITEM_ID, quantity: 1, idempotencyKey: 'unsafe value' })).toThrow();
  });

  it('keeps reservation device-unit selections unique and opaque', () => {
    expect(createInventoryReservationInput.parse({
      inventoryItemId: INVENTORY_ITEM_ID,
      quantity: 1,
      deviceUnitIds: [WAREHOUSE_ID],
      idempotencyKey: KEY,
    }).deviceUnitIds).toEqual([WAREHOUSE_ID]);
    expect(() => createInventoryReservationInput.parse({
      inventoryItemId: INVENTORY_ITEM_ID,
      quantity: 2,
      deviceUnitIds: [WAREHOUSE_ID, WAREHOUSE_ID],
      idempotencyKey: KEY,
    })).toThrow();
  });

  it('validates reservation release replay protection input', () => {
    expect(releaseInventoryReservationInput.parse({ reservationId: RESERVATION_ID, idempotencyKey: KEY })).toEqual({ reservationId: RESERVATION_ID, idempotencyKey: KEY });
    expect(() => releaseInventoryReservationInput.parse({ reservationId: RESERVATION_ID })).toThrow();
  });

  it('validates an SKU tracking-policy change', () => {
    expect(updateInventorySkuPolicyInput.parse({ sku: 'iphone-16-pro', trackingMode: 'SERIAL_AND_IMEI' })).toEqual({ sku: 'IPHONE-16-PRO', trackingMode: 'SERIAL_AND_IMEI' });
    expect(() => updateInventorySkuPolicyInput.parse({ sku: 'IPHONE-16-PRO', trackingMode: 'RAW_IMEI' })).toThrow();
  });

  it('bounds protected IMEI list search', () => {
    expect(inventoryDeviceListQuery.parse({ query: ' 518 ', status: 'AVAILABLE' })).toMatchObject({ query: '518', status: 'AVAILABLE', page: 1, pageSize: 25 });
    expect(() => inventoryDeviceListQuery.parse({ query: '12' })).toThrow();
  });

  it('keeps warehouse identifiers separate from location identifiers', () => {
    expect(WAREHOUSE_ID).not.toBe(LOCATION_ID);
  });
});
