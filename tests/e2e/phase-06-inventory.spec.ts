import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'e2e-inventory-admin@example.test';
const ADMIN_PASSWORD = 'E2E-Inventory-Password-2026';
const PRODUCT_SLUG = 'e2e-inventory-iphone';
const TRACKED_SKU = 'E2E-INV-IPHONE-256-BLK';
const BULK_SKU = 'E2E-INV-BULK-CABLE';
const RAW_IMEI = '490154203237518';

type ApiEnvelope<T> = Readonly<{ success: boolean; data: T }>;
type Warehouse = Readonly<{ id: string; branchId: string; locations: readonly Readonly<{ id: string }>[] }>;
type InventoryItem = Readonly<{ id: string; location: Readonly<{ id: string }> }>;

let sourceLocationId = '';
let destinationLocationId = '';
let destinationInventoryItemId = '';
let reservationId = '';

async function login(page: Page, callbackUrl = '/admin/inventory'): Promise<void> {
  await page.goto(`/account/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(callbackUrl.replaceAll('/', '\\/')));
}

async function browserApi<T>(page: Page, path: string, init?: Readonly<{ method?: string; body?: unknown }>): Promise<Readonly<{ status: number; body: ApiEnvelope<T> }>> {
  return page.evaluate(async ({ path: requestedPath, init: requestedInit }) => {
    const response = await fetch(requestedPath, {
      method: requestedInit?.method ?? 'GET',
      headers: requestedInit?.body === undefined
        ? { 'x-request-id': `e2e-inventory-${crypto.randomUUID()}` }
        : { 'content-type': 'application/json', 'x-request-id': `e2e-inventory-${crypto.randomUUID()}` },
      ...(requestedInit?.body === undefined ? {} : { body: JSON.stringify(requestedInit.body) }),
    });
    return { status: response.status, body: await response.json() };
  }, { path, init }) as Promise<Readonly<{ status: number; body: ApiEnvelope<T> }>>;
}

test.describe('Phase 06 inventory and multi-branch browser journeys', () => {
  test.describe.configure({ mode: 'serial' });

  test('redirects an unauthenticated visitor from the inventory dashboard', async ({ page }) => {
    await page.goto('/admin/inventory');
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test('redirects an unauthenticated visitor from branch management', async ({ page }) => {
    await page.goto('/admin/branches');
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test('redirects an unauthenticated visitor from warehouse management', async ({ page }) => {
    await page.goto('/admin/warehouses');
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test('redirects an unauthenticated visitor from protected device records', async ({ page }) => {
    await page.goto('/admin/imei');
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test('shows the seeded tracked product as a public storefront product', async ({ page }) => {
    await page.goto(`/products/${PRODUCT_SLUG}`);
    await expect(page.getByRole('heading', { name: 'Apple333 E2E Inventory iPhone' })).toBeVisible();
    await expect(page.getByTestId('storefront-add-to-cart')).toBeEnabled();
  });

  test('shows four public branch availability bands without exact stock counts', async ({ page }) => {
    await page.goto(`/products/${PRODUCT_SLUG}`);
    const availability = page.getByTestId('storefront-branch-availability');
    await expect(availability).toBeVisible();
    await expect(availability).toContainText('E2E Inventory Branch A');
    await expect(availability).toContainText('E2E Inventory Branch B');
    await expect(availability).toContainText('E2E Inventory Branch C');
    await expect(availability).toContainText('E2E Inventory Branch D');
    await expect(availability).not.toContainText('10');
  });

  test('never exposes an IMEI in the public storefront document', async ({ page }) => {
    await page.goto(`/products/${PRODUCT_SLUG}`);
    await expect(page.locator('body')).not.toContainText(RAW_IMEI);
  });

  test('allows the isolated inventory manager to open the inventory dashboard', async ({ page }) => {
    await login(page);
    await expect(page.getByText(TRACKED_SKU)).toBeVisible();
    await expect(page.getByText(BULK_SKU)).toBeVisible();
  });

  test('renders all isolated branches in the branch management panel', async ({ page }) => {
    await login(page, '/admin/branches');
    await expect(page.getByText('E2E Inventory Branch A')).toBeVisible();
    await expect(page.getByText('E2E Inventory Branch B')).toBeVisible();
    await expect(page.getByText('E2E Inventory Branch C')).toBeVisible();
    await expect(page.getByText('E2E Inventory Branch D')).toBeVisible();
  });

  test('renders branch-owned warehouses and locations', async ({ page }) => {
    await login(page, '/admin/warehouses');
    await expect(page.getByText('E2E Warehouse 1')).toBeVisible();
    await expect(page.getByText('E2E Warehouse 4')).toBeVisible();
    await expect(page.getByText('STORAGE').first()).toBeVisible();
  });

  test('renders only a masked IMEI in the protected device list', async ({ page }) => {
    await login(page, '/admin/imei');
    await expect(page.getByText(TRACKED_SKU)).toBeVisible();
    await expect(page.locator('body')).not.toContainText(RAW_IMEI);
    await expect(page.locator('body')).toContainText('7518');
  });

  test('returns the admin inventory API only after authenticated browser login', async ({ page }) => {
    await login(page);
    const result = await browserApi<{ dashboard: unknown; inventory: Readonly<{ items: readonly InventoryItem[] }> }>(page, `/api/inventory?sku=${BULK_SKU}`);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data.inventory.items.length).toBeGreaterThan(0);
  });

  test('records a browser-originated bulk stock receipt through the protected API', async ({ page }) => {
    await login(page);
    const warehouses = await browserApi<Readonly<{ items: readonly Warehouse[] }>>(page, '/api/warehouses?page=1&pageSize=100');
    const source = warehouses.body.data.items.find((warehouse) => warehouse.branchId !== '')!;
    sourceLocationId = source.locations[0]!.id;
    const result = await browserApi<unknown>(page, '/api/inventory/receive', {
      method: 'POST',
      body: {
        sku: BULK_SKU,
        toLocationId: sourceLocationId,
        quantity: 2,
        reference: 'E2E-RECEIVE',
        idempotencyKey: 'e2e-inventory-receive-0001',
      },
    });
    expect(result.status).toBe(201);
    expect(result.body.success).toBe(true);
  });

  test('records a browser-originated adjustment through the movement ledger', async ({ page }) => {
    await login(page);
    const result = await browserApi<unknown>(page, '/api/inventory/adjust', {
      method: 'POST',
      body: {
        sku: BULK_SKU,
        locationId: sourceLocationId,
        quantity: 1,
        direction: 'DECREASE',
        reason: 'E2E controlled count correction',
        idempotencyKey: 'e2e-inventory-adjust-0001',
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  test('transfers a bulk SKU between two branch-owned locations', async ({ page }) => {
    await login(page);
    const warehouses = await browserApi<Readonly<{ items: readonly Warehouse[] }>>(page, '/api/warehouses?page=1&pageSize=100');
    const destination = warehouses.body.data.items.find((warehouse) => warehouse.locations[0]?.id !== sourceLocationId)!;
    destinationLocationId = destination.locations[0]!.id;
    const result = await browserApi<unknown>(page, '/api/inventory/transfer', {
      method: 'POST',
      body: {
        sku: BULK_SKU,
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        quantity: 1,
        idempotencyKey: 'e2e-inventory-transfer-0001',
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  test('creates and releases a browser-originated reservation without an order', async ({ page }) => {
    await login(page);
    const inventory = await browserApi<{ inventory: Readonly<{ items: readonly InventoryItem[] }> }>(page, `/api/inventory?sku=${BULK_SKU}`);
    const destinationItem = inventory.body.data.inventory.items.find((item) => item.location.id === destinationLocationId)!;
    destinationInventoryItemId = destinationItem.id;
    const reserve = await browserApi<Readonly<{ id: string }>>(page, '/api/inventory/reservations', {
      method: 'POST',
      body: {
        inventoryItemId: destinationInventoryItemId,
        quantity: 1,
        reference: 'E2E-TEMPORARY-HOLD',
        idempotencyKey: 'e2e-inventory-reserve-0001',
      },
    });
    expect(reserve.status).toBe(201);
    reservationId = reserve.body.data.id;

    const release = await browserApi<unknown>(page, `/api/inventory/reservations/${reservationId}/release`, {
      method: 'POST',
      body: { idempotencyKey: 'e2e-inventory-release-0001' },
    });
    expect(release.status).toBe(200);
    expect(release.body.success).toBe(true);
  });

  test('does not expose raw identifiers in the authenticated device API envelope', async ({ page }) => {
    await login(page);
    const result = await browserApi<unknown>(page, `/api/imei?sku=${TRACKED_SKU}`);
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain(RAW_IMEI);
  });
});
