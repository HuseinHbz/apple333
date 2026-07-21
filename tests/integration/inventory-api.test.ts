import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Permission, SessionActor } from '@/server/security/permissions';

const mocks = vi.hoisted(() => ({
  requireAdminActor: vi.fn(),
  log: vi.fn(),
  revalidateStorefrontInventory: vi.fn(),
  listInventory: vi.fn(),
  getInventoryBySku: vi.fn(),
  inventoryDashboard: vi.fn(),
  receiveInventory: vi.fn(),
  adjustInventory: vi.fn(),
  transferInventory: vi.fn(),
  configureSkuTracking: vi.fn(),
  reserveInventory: vi.fn(),
  releaseInventoryReservation: vi.fn(),
  listBranches: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
  listWarehouses: vi.fn(),
  createWarehouse: vi.fn(),
  updateWarehouse: vi.fn(),
  listDeviceUnits: vi.fn(),
  inventoryAvailabilityBySku: vi.fn(),
}));

vi.mock('@/modules/auth/session', () => ({ requireAdminActor: mocks.requireAdminActor }));
vi.mock('@/server/logging/logger', () => ({ log: mocks.log }));
vi.mock('@/server/services/storefront-inventory-cache', () => ({ revalidateStorefrontInventory: mocks.revalidateStorefrontInventory }));
vi.mock('@/server/services/inventory-service', () => ({
  listInventory: mocks.listInventory,
  getInventoryBySku: mocks.getInventoryBySku,
  inventoryDashboard: mocks.inventoryDashboard,
  receiveInventory: mocks.receiveInventory,
  adjustInventory: mocks.adjustInventory,
  transferInventory: mocks.transferInventory,
  configureSkuTracking: mocks.configureSkuTracking,
  reserveInventory: mocks.reserveInventory,
  releaseInventoryReservation: mocks.releaseInventoryReservation,
  listBranches: mocks.listBranches,
  createBranch: mocks.createBranch,
  updateBranch: mocks.updateBranch,
  listWarehouses: mocks.listWarehouses,
  createWarehouse: mocks.createWarehouse,
  updateWarehouse: mocks.updateWarehouse,
  listDeviceUnits: mocks.listDeviceUnits,
  inventoryAvailabilityBySku: mocks.inventoryAvailabilityBySku,
}));

import { GET as getBranchInventory } from '@/app/api/branches/[id]/inventory/route';
import { PATCH as patchBranch } from '@/app/api/branches/[id]/route';
import { GET as getBranches, POST as postBranch } from '@/app/api/branches/route';
import { GET as getDeviceUnits } from '@/app/api/imei/route';
import { POST as adjust } from '@/app/api/inventory/adjust/route';
import { POST as receive } from '@/app/api/inventory/receive/route';
import { POST as releaseReservation } from '@/app/api/inventory/reservations/[id]/release/route';
import { POST as reserve } from '@/app/api/inventory/reservations/route';
import { GET as getInventorySku } from '@/app/api/inventory/[sku]/route';
import { GET as getPublicInventoryAvailability } from '@/app/api/inventory/[sku]/availability/route';
import { POST as updatePolicy } from '@/app/api/inventory/sku-policy/route';
import { POST as transfer } from '@/app/api/inventory/transfer/route';
import { GET as getInventory } from '@/app/api/inventory/route';
import { PATCH as patchWarehouse } from '@/app/api/warehouses/[id]/route';
import { GET as getWarehouses, POST as postWarehouse } from '@/app/api/warehouses/route';

const BRANCH_ID = 'ckz8x8x8x000001l4h3e5f6g7';
const WAREHOUSE_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k2';
const LOCATION_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k3';
const OTHER_LOCATION_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k4';
const INVENTORY_ITEM_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k5';
const RESERVATION_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k6';

const allPermissions: readonly Permission[] = [
  'inventory.read', 'inventory.receive', 'inventory.adjust', 'inventory.transfer', 'inventory.reserve', 'inventory.release', 'inventory.policy.update', 'devices.read', 'branches.read', 'branches.create', 'branches.update', 'warehouses.read', 'warehouses.create', 'warehouses.update',
] as const;

function actor(permissions: readonly Permission[] = allPermissions): SessionActor {
  return { id: 'inventory-admin', isAdmin: true, roleCodes: ['INVENTORY_MANAGER'], permissions: new Set<Permission>(permissions) };
}

function request(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

function mutation(path: string, body: unknown, origin = 'http://localhost'): Request {
  return request(path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-request-id': 'inventory_api_1234' }, body: JSON.stringify(body) });
}

describe('Phase 06 inventory administrative APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminActor.mockResolvedValue(actor());
    mocks.inventoryDashboard.mockResolvedValue({ totalQuantity: 0, availableQuantity: 0, reservedQuantity: 0, damagedQuantity: 0, skuCount: 0, branchCount: 0 });
    mocks.listInventory.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
    mocks.getInventoryBySku.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, totalPages: 0 });
    mocks.receiveInventory.mockResolvedValue({ idempotent: false });
    mocks.adjustInventory.mockResolvedValue({ idempotent: false });
    mocks.transferInventory.mockResolvedValue({ idempotent: false });
    mocks.configureSkuTracking.mockResolvedValue({ sku: 'IPHONE-16-PRO', trackingMode: 'IMEI' });
    mocks.reserveInventory.mockResolvedValue({ id: RESERVATION_ID, status: 'ACTIVE', idempotent: false });
    mocks.releaseInventoryReservation.mockResolvedValue({ id: RESERVATION_ID, status: 'RELEASED', idempotent: false });
    mocks.listBranches.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
    mocks.createBranch.mockResolvedValue({ id: BRANCH_ID });
    mocks.updateBranch.mockResolvedValue({ id: BRANCH_ID });
    mocks.listWarehouses.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
    mocks.createWarehouse.mockResolvedValue({ id: WAREHOUSE_ID });
    mocks.updateWarehouse.mockResolvedValue({ id: WAREHOUSE_ID });
    mocks.listDeviceUnits.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
    mocks.inventoryAvailabilityBySku.mockResolvedValue({ skuCode: 'IPHONE-16-PRO', availability: 'LIMITED', branches: [{ branchId: BRANCH_ID, branchCode: 'TEH-01', branchName: 'Tehran', availability: 'LIMITED' }] });
  });

  it('returns the inventory dashboard and a bounded inventory page', async () => {
    const response = await getInventory(request('/api/inventory?page=2&pageSize=25&availability=LIMITED'));
    expect(response.status).toBe(200);
    expect(mocks.inventoryDashboard).toHaveBeenCalledWith(expect.anything(), undefined);
    expect(mocks.listInventory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ page: 2, availability: 'LIMITED' }));
  });

  it('rejects invalid inventory page input before the service', async () => {
    const response = await getInventory(request('/api/inventory?page=0'));
    expect(response.status).toBe(400);
    expect(mocks.listInventory).not.toHaveBeenCalled();
  });

  it('looks up inventory by canonical SKU code', async () => {
    const response = await getInventorySku(request('/api/inventory/iphone-16-pro'), { params: Promise.resolve({ sku: 'iphone-16-pro' }) });
    expect(response.status).toBe(200);
    expect(mocks.getInventoryBySku).toHaveBeenCalledWith(expect.anything(), 'IPHONE-16-PRO');
  });

  it('rejects malformed SKU path input', async () => {
    const response = await getInventorySku(request('/api/inventory/!'), { params: Promise.resolve({ sku: '!' }) });
    expect(response.status).toBe(400);
    expect(mocks.getInventoryBySku).not.toHaveBeenCalled();
  });

  it('returns privacy-safe public availability bands without administrator authentication', async () => {
    const response = await getPublicInventoryAvailability(request('/api/inventory/iphone-16-pro/availability'), { params: Promise.resolve({ sku: 'iphone-16-pro' }) });
    const body = await response.json() as { success: boolean; data: { skuCode: string; availability: string; branches: unknown[] } };
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toMatchObject({ success: true, data: { skuCode: 'IPHONE-16-PRO', availability: 'LIMITED' } });
    expect(mocks.inventoryAvailabilityBySku).toHaveBeenCalledWith('IPHONE-16-PRO');
  });

  it('rejects malformed public availability SKU input', async () => {
    const response = await getPublicInventoryAvailability(request('/api/inventory/!/availability'), { params: Promise.resolve({ sku: '!' }) });
    expect(response.status).toBe(400);
    expect(mocks.inventoryAvailabilityBySku).not.toHaveBeenCalled();
  });

  it('requires same origin for stock receiving', async () => {
    const response = await receive(mutation('/api/inventory/receive', { sku: 'IPHONE-16-PRO', toLocationId: LOCATION_ID, quantity: 1, idempotencyKey: 'receive-key-0001' }, 'https://evil.example'));
    expect(response.status).toBe(403);
    expect(mocks.receiveInventory).not.toHaveBeenCalled();
  });

  it('validates and forwards a stock receiving request with audit context', async () => {
    const response = await receive(mutation('/api/inventory/receive', { sku: 'iphone-16-pro', toLocationId: LOCATION_ID, quantity: 1, idempotencyKey: 'receive-key-0001' }));
    expect(response.status).toBe(201);
    expect(mocks.receiveInventory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sku: 'IPHONE-16-PRO', quantity: 1 }), expect.objectContaining({ actorId: 'inventory-admin', requestId: 'inventory_api_1234' }));
    expect(mocks.revalidateStorefrontInventory).toHaveBeenCalledOnce();
  });

  it('rejects a receiving device-count mismatch before the service', async () => {
    const response = await receive(mutation('/api/inventory/receive', { sku: 'IPHONE-16-PRO', toLocationId: LOCATION_ID, quantity: 2, idempotencyKey: 'receive-key-0002', devices: [{ imei: '490154203237518' }] }));
    expect(response.status).toBe(400);
    expect(mocks.receiveInventory).not.toHaveBeenCalled();
  });

  it('enforces inventory-adjust permission', async () => {
    mocks.requireAdminActor.mockResolvedValue(actor(['inventory.read']));
    const response = await adjust(mutation('/api/inventory/adjust', { sku: 'IPHONE-16-PRO', locationId: LOCATION_ID, quantity: 1, direction: 'INCREASE', reason: 'count', idempotencyKey: 'adjust-key-0001' }));
    expect(response.status).toBe(403);
    expect(mocks.adjustInventory).not.toHaveBeenCalled();
  });

  it('forwards a valid stock adjustment', async () => {
    const response = await adjust(mutation('/api/inventory/adjust', { sku: 'IPHONE-16-PRO', locationId: LOCATION_ID, quantity: 1, direction: 'DECREASE', reason: 'cycle count', idempotencyKey: 'adjust-key-0002' }));
    expect(response.status).toBe(200);
    expect(mocks.adjustInventory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ direction: 'DECREASE' }), expect.anything());
    expect(mocks.revalidateStorefrontInventory).toHaveBeenCalledOnce();
  });

  it('rejects same-location transfer input', async () => {
    const response = await transfer(mutation('/api/inventory/transfer', { sku: 'IPHONE-16-PRO', fromLocationId: LOCATION_ID, toLocationId: LOCATION_ID, quantity: 1, idempotencyKey: 'transfer-key-0001' }));
    expect(response.status).toBe(400);
    expect(mocks.transferInventory).not.toHaveBeenCalled();
  });

  it('forwards a valid stock transfer', async () => {
    const response = await transfer(mutation('/api/inventory/transfer', { sku: 'IPHONE-16-PRO', fromLocationId: LOCATION_ID, toLocationId: OTHER_LOCATION_ID, quantity: 1, idempotencyKey: 'transfer-key-0002' }));
    expect(response.status).toBe(200);
    expect(mocks.transferInventory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fromLocationId: LOCATION_ID, toLocationId: OTHER_LOCATION_ID }), expect.anything());
  });

  it('protects SKU tracking policy updates', async () => {
    mocks.requireAdminActor.mockResolvedValue(actor(['inventory.read']));
    const response = await updatePolicy(mutation('/api/inventory/sku-policy', { sku: 'IPHONE-16-PRO', trackingMode: 'IMEI' }));
    expect(response.status).toBe(403);
    expect(mocks.configureSkuTracking).not.toHaveBeenCalled();
  });

  it('sets a validated SKU tracking policy', async () => {
    const response = await updatePolicy(mutation('/api/inventory/sku-policy', { sku: 'iphone-16-pro', trackingMode: 'SERIAL_AND_IMEI' }));
    expect(response.status).toBe(200);
    expect(mocks.configureSkuTracking).toHaveBeenCalledWith(expect.anything(), { sku: 'IPHONE-16-PRO', trackingMode: 'SERIAL_AND_IMEI' }, expect.anything());
  });

  it('creates a reservation foundation without order input', async () => {
    const response = await reserve(mutation('/api/inventory/reservations', { inventoryItemId: INVENTORY_ITEM_ID, quantity: 1, idempotencyKey: 'reserve-key-0001' }));
    expect(response.status).toBe(201);
    expect(mocks.reserveInventory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ inventoryItemId: INVENTORY_ITEM_ID }), expect.anything());
  });

  it('requires an idempotency key to release a reservation', async () => {
    const response = await releaseReservation(mutation(`/api/inventory/reservations/${RESERVATION_ID}/release`, {}), { params: Promise.resolve({ id: RESERVATION_ID }) });
    expect(response.status).toBe(400);
    expect(mocks.releaseInventoryReservation).not.toHaveBeenCalled();
  });

  it('releases a reservation using its route identity', async () => {
    const response = await releaseReservation(mutation(`/api/inventory/reservations/${RESERVATION_ID}/release`, { idempotencyKey: 'release-key-0001' }), { params: Promise.resolve({ id: RESERVATION_ID }) });
    expect(response.status).toBe(200);
    expect(mocks.releaseInventoryReservation).toHaveBeenCalledWith(expect.anything(), { reservationId: RESERVATION_ID, idempotencyKey: 'release-key-0001' }, expect.anything());
  });

  it('lists branch resources through RBAC', async () => {
    const response = await getBranches(request('/api/branches?page=2&pageSize=10'));
    expect(response.status).toBe(200);
    expect(mocks.listBranches).toHaveBeenCalledWith(expect.anything(), 2, 10);
  });

  it('rejects branch creation from an untrusted origin', async () => {
    const response = await postBranch(mutation('/api/branches', { code: 'TEH-01', name: 'Tehran' }, 'https://evil.example'));
    expect(response.status).toBe(403);
    expect(mocks.createBranch).not.toHaveBeenCalled();
  });

  it('creates a normalized branch payload', async () => {
    const response = await postBranch(mutation('/api/branches', { code: 'teh-01', name: 'Tehran' }));
    expect(response.status).toBe(201);
    expect(mocks.createBranch).toHaveBeenCalledWith(expect.objectContaining({ code: 'TEH-01' }), expect.anything());
  });

  it('rejects malformed branch identifiers before a patch', async () => {
    const response = await patchBranch(request('/api/branches/not-valid', { method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ status: 'DISABLED' }) }), { params: Promise.resolve({ id: 'not-valid' }) });
    expect(response.status).toBe(400);
    expect(mocks.updateBranch).not.toHaveBeenCalled();
  });

  it('updates a branch and invalidates public availability', async () => {
    const response = await patchBranch(request(`/api/branches/${BRANCH_ID}`, { method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ status: 'DISABLED' }) }), { params: Promise.resolve({ id: BRANCH_ID }) });
    expect(response.status).toBe(200);
    expect(mocks.updateBranch).toHaveBeenCalledWith(expect.anything(), BRANCH_ID, { status: 'DISABLED' }, expect.anything());
    expect(mocks.revalidateStorefrontInventory).toHaveBeenCalledOnce();
  });

  it('scopes branch inventory by the route branch id', async () => {
    const response = await getBranchInventory(request(`/api/branches/${BRANCH_ID}/inventory?page=1&pageSize=10`), { params: Promise.resolve({ id: BRANCH_ID }) });
    expect(response.status).toBe(200);
    expect(mocks.listInventory).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ branchId: BRANCH_ID }));
  });

  it('lists warehouses with an optional branch filter', async () => {
    const response = await getWarehouses(request(`/api/warehouses?page=1&pageSize=10&branchId=${BRANCH_ID}`));
    expect(response.status).toBe(200);
    expect(mocks.listWarehouses).toHaveBeenCalledWith(expect.anything(), 1, 10, BRANCH_ID);
  });

  it('requires at least one location to create a warehouse', async () => {
    const response = await postWarehouse(mutation('/api/warehouses', { branchId: BRANCH_ID, code: 'CENTRAL', name: 'Central', locations: [] }));
    expect(response.status).toBe(400);
    expect(mocks.createWarehouse).not.toHaveBeenCalled();
  });

  it('creates a warehouse with a physical location', async () => {
    const response = await postWarehouse(mutation('/api/warehouses', { branchId: BRANCH_ID, code: 'CENTRAL', name: 'Central', locations: [{ code: 'MAIN', name: 'Main', type: 'STORAGE' }] }));
    expect(response.status).toBe(201);
    expect(mocks.createWarehouse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ branchId: BRANCH_ID, locations: expect.any(Array) }), expect.anything());
  });

  it('updates a warehouse status', async () => {
    const response = await patchWarehouse(request(`/api/warehouses/${WAREHOUSE_ID}`, { method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ status: 'DISABLED' }) }), { params: Promise.resolve({ id: WAREHOUSE_ID }) });
    expect(response.status).toBe(200);
    expect(mocks.updateWarehouse).toHaveBeenCalledWith(expect.anything(), WAREHOUSE_ID, { status: 'DISABLED' }, expect.anything());
  });

  it('rejects short identifier searches before protected IMEI lookup', async () => {
    const response = await getDeviceUnits(request('/api/imei?query=12'));
    expect(response.status).toBe(400);
    expect(mocks.listDeviceUnits).not.toHaveBeenCalled();
  });

  it('returns masked-device records only through the protected route service', async () => {
    const response = await getDeviceUnits(request('/api/imei?sku=iphone-16-pro&status=AVAILABLE'));
    expect(response.status).toBe(200);
    expect(mocks.listDeviceUnits).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sku: 'IPHONE-16-PRO', status: 'AVAILABLE' }));
  });
});
