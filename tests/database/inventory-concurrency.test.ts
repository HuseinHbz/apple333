import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateInventoryTestEnvironment } from '../../scripts/verify-inventory-test-environment.mjs';
import type { AdminAuditContext } from '@/server/admin/types';
import { PERMISSIONS, type SessionActor } from '@/server/security/permissions';

const preflight = validateInventoryTestEnvironment(process.env);
if (!preflight.ok || !process.env.INVENTORY_TEST_DATABASE_URL) {
  throw new Error(`Inventory concurrency tests require the guarded isolated target: ${preflight.errors.join(' ')}`);
}

process.env.DATABASE_URL = process.env.INVENTORY_TEST_DATABASE_URL;

type Database = typeof import('@/server/db/prisma');
type Inventory = typeof import('@/server/services/inventory-service');

const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
const codeSuffix = suffix.toUpperCase();
const slugSuffix = suffix.toLowerCase();

function luhnCheckDigit(body: string): string {
  for (let candidate = 0; candidate <= 9; candidate += 1) {
    const digits = `${body}${candidate}`;
    let sum = 0;
    let doubleDigit = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    if (sum % 10 === 0) return String(candidate);
  }
  throw new Error('Unable to generate a Luhn-valid IMEI check digit.');
}

// The persistence suite also validates a known IMEI. Derive an isolated,
// Luhn-valid identifier per concurrency run so this test measures the race,
// not a pre-existing fixture collision.
const concurrencyImei = (() => {
  const body = `35693803${suffix.slice(-6).padStart(6, '0')}`;
  return `${body}${luhnCheckDigit(body)}`;
})();

let database: Database;
let inventory: Inventory;
let actor: SessionActor;
let actorId: string;
let categoryId: string;
let sourceLocationId: string;
let destinationLocationId: string;
let trackedSkuCode: string;
let bulkSkuCode: string;

function audit(action: string): AdminAuditContext {
  return { actorId, requestId: `inventory-concurrency-${slugSuffix}-${action}`.slice(0, 128) };
}

function fulfilledCount(results: readonly PromiseSettledResult<unknown>[]): number {
  return results.filter((result) => result.status === 'fulfilled').length;
}

function expectOneConflict(results: readonly PromiseSettledResult<unknown>[]): void {
  expect(fulfilledCount(results)).toBe(1);
  const rejected = results.find((result) => result.status === 'rejected');
  expect(rejected).toBeDefined();
  if (rejected?.status === 'rejected') expect(rejected.reason).toMatchObject({ code: 'CONFLICT' });
}

async function createSku(input: Readonly<{ suffix: string; trackingMode: 'NONE' | 'IMEI' }>): Promise<string> {
  const code = `CON-${input.suffix}-${codeSuffix}`;
  const product = await database.prisma.catalogProduct.create({
    data: {
      slug: `concurrency-${input.suffix.toLowerCase()}-${slugSuffix}`,
      name: `Concurrency ${input.suffix} ${suffix}`,
      categoryId,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  const variant = await database.prisma.catalogVariant.create({
    data: { productId: product.id, sku: code, title: `${input.suffix} variant`, priceRials: 1_000_000n },
    select: { id: true },
  });
  await database.prisma.productSku.create({
    data: { variantId: variant.id, code, priceRials: 1_000_000n, status: 'ACTIVE' },
  });
  if (input.trackingMode !== 'NONE') {
    await inventory.configureSkuTracking(actor, { sku: code, trackingMode: input.trackingMode }, audit(`tracking-${input.suffix}`));
  }
  return code;
}

describe.sequential('Phase 06 real PostgreSQL concurrency and ledger consistency', () => {
  beforeAll(async () => {
    database = await import('@/server/db/prisma');
    inventory = await import('@/server/services/inventory-service');
    await database.prisma.$connect();

    const user = await database.prisma.user.create({
      data: { name: `Inventory concurrency ${suffix}`, email: `inventory-concurrency-${suffix}@example.test` },
      select: { id: true },
    });
    actorId = user.id;
    actor = { id: user.id, roleCodes: ['INVENTORY_MANAGER'], permissions: new Set(PERMISSIONS), isAdmin: true };
    const category = await database.prisma.catalogCategory.create({
      data: { slug: `inventory-concurrency-${slugSuffix}`, name: `Inventory concurrency ${suffix}` },
      select: { id: true },
    });
    categoryId = category.id;

    const sourceBranch = await inventory.createBranch(
      actor,
      { code: `CON-A-${codeSuffix}`, name: 'Concurrency source', kind: 'STORE', status: 'ACTIVE', isPickupEnabled: true },
      audit('branch-source'),
    );
    const destinationBranch = await inventory.createBranch(
      actor,
      { code: `CON-B-${codeSuffix}`, name: 'Concurrency destination', kind: 'STORE', status: 'ACTIVE', isPickupEnabled: true },
      audit('branch-destination'),
    );
    const sourceWarehouse = await inventory.createWarehouse(actor, {
      branchId: sourceBranch.id,
      code: `CON-WH-A-${codeSuffix}`,
      name: 'Concurrency source warehouse',
      status: 'ACTIVE',
      locations: [{ code: `CON-LOC-A-${codeSuffix}`, name: 'Source', type: 'STORAGE', status: 'ACTIVE' }],
    }, audit('warehouse-source'));
    const destinationWarehouse = await inventory.createWarehouse(actor, {
      branchId: destinationBranch.id,
      code: `CON-WH-B-${codeSuffix}`,
      name: 'Concurrency destination warehouse',
      status: 'ACTIVE',
      locations: [{ code: `CON-LOC-B-${codeSuffix}`, name: 'Destination', type: 'STORAGE', status: 'ACTIVE' }],
    }, audit('warehouse-destination'));
    sourceLocationId = sourceWarehouse.locations[0]!.id;
    destinationLocationId = destinationWarehouse.locations[0]!.id;
    trackedSkuCode = await createSku({ suffix: 'TRACKED', trackingMode: 'IMEI' });
    bulkSkuCode = await createSku({ suffix: 'BULK', trackingMode: 'NONE' });
  });

  afterAll(async () => {
    await database.prisma.$disconnect();
  });

  it('allows only one concurrent reservation of the final bulk unit', async () => {
    const received = await inventory.receiveInventory(actor, {
      sku: bulkSkuCode,
      toLocationId: sourceLocationId,
      quantity: 1,
      idempotencyKey: `con-reserve-receive-${suffix}`,
    }, audit('reserve-receive'));
    const attempts = await Promise.allSettled([
      inventory.reserveInventory(actor, { inventoryItemId: received.inventoryItem.id, quantity: 1, idempotencyKey: `con-reserve-a-${suffix}` }, audit('reserve-a')),
      inventory.reserveInventory(actor, { inventoryItemId: received.inventoryItem.id, quantity: 1, idempotencyKey: `con-reserve-b-${suffix}` }, audit('reserve-b')),
    ]);
    expectOneConflict(attempts);
    const item = await database.prisma.inventoryItem.findUniqueOrThrow({
      where: { id: received.inventoryItem.id },
      select: { quantity: true, reservedQuantity: true, availableQuantity: true },
    });
    expect(item).toEqual({ quantity: 1, reservedQuantity: 1, availableQuantity: 0 });
  });

  it('allows only one concurrent receipt of the same IMEI and leaves one device record', async () => {
    const attempts = await Promise.allSettled([
      inventory.receiveInventory(actor, {
        sku: trackedSkuCode,
        toLocationId: sourceLocationId,
        quantity: 1,
        devices: [{ imei: concurrencyImei }],
        idempotencyKey: `con-imei-a-${suffix}`,
      }, audit('imei-a')),
      inventory.receiveInventory(actor, {
        sku: trackedSkuCode,
        toLocationId: sourceLocationId,
        quantity: 1,
        devices: [{ imei: concurrencyImei }],
        idempotencyKey: `con-imei-b-${suffix}`,
      }, audit('imei-b')),
    ]);
    expectOneConflict(attempts);
    expect(await database.prisma.deviceUnit.count({ where: { imei: concurrencyImei } })).toBe(1);
  });

  it('allows only one concurrent transfer of the same tracked device', async () => {
    const device = await database.prisma.deviceUnit.findUniqueOrThrow({
      where: { imei: concurrencyImei },
      select: { id: true },
    });
    const attempts = await Promise.allSettled([
      inventory.transferInventory(actor, {
        sku: trackedSkuCode,
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        quantity: 1,
        deviceUnitIds: [device.id],
        idempotencyKey: `con-transfer-a-${suffix}`,
      }, audit('transfer-a')),
      inventory.transferInventory(actor, {
        sku: trackedSkuCode,
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        quantity: 1,
        deviceUnitIds: [device.id],
        idempotencyKey: `con-transfer-b-${suffix}`,
      }, audit('transfer-b')),
    ]);
    expectOneConflict(attempts);
    const moved = await database.prisma.deviceUnit.findUniqueOrThrow({
      where: { id: device.id },
      select: { inventoryItem: { select: { locationId: true } }, reservationId: true, status: true },
    });
    expect(moved).toEqual({ inventoryItem: { locationId: destinationLocationId }, reservationId: null, status: 'AVAILABLE' });
  });

  it('does not lose successful parallel balance adjustments and leaves a consistent ledger', async () => {
    const received = await inventory.receiveInventory(actor, {
      sku: bulkSkuCode,
      toLocationId: destinationLocationId,
      quantity: 10,
      idempotencyKey: `con-adjust-receive-${suffix}`,
    }, audit('adjust-receive'));
    const changes = [2, 3];
    const attempts = await Promise.allSettled(changes.map((quantity, index) => inventory.adjustInventory(actor, {
      sku: bulkSkuCode,
      locationId: destinationLocationId,
      quantity,
      direction: 'INCREASE',
      reason: 'Phase 06 concurrency evidence',
      idempotencyKey: `con-adjust-${index}-${suffix}`,
    }, audit(`adjust-${index}`))));
    const applied = attempts.reduce((sum, result, index) => sum + (result.status === 'fulfilled' ? changes[index]! : 0), 0);
    expect(applied).toBeGreaterThan(0);
    for (const result of attempts.filter((result) => result.status === 'rejected')) {
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'CONFLICT' });
    }
    const item = await database.prisma.inventoryItem.findUniqueOrThrow({
      where: { id: received.inventoryItem.id },
      select: { quantity: true, reservedQuantity: true, availableQuantity: true },
    });
    expect(item).toEqual({ quantity: 10 + applied, reservedQuantity: 0, availableQuantity: 10 + applied });
    const movements = await database.prisma.stockMovement.findMany({
      where: { sku: { is: { code: bulkSkuCode } }, toLocationId: destinationLocationId },
      select: { type: true, quantity: true, adjustmentDirection: true },
    });
    const inbound = movements.reduce((sum, movement) => sum + (movement.type === 'PURCHASE' || movement.adjustmentDirection === 'INCREASE' ? movement.quantity : 0), 0);
    expect(inbound).toBeGreaterThanOrEqual(10 + applied);
    expect(await database.prisma.deviceUnit.count({ where: { inventoryItemId: null, status: { in: ['AVAILABLE', 'RESERVED'] } } })).toBe(0);
  });
});
