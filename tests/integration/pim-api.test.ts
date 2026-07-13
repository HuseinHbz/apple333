import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionActor } from '@/server/security/permissions';

const mocks = vi.hoisted(() => ({
  createAdminProduct: vi.fn(),
  listAdminProducts: vi.fn(),
  updateAdminProduct: vi.fn(),
  publishAdminProduct: vi.fn(),
  requireAdminActor: vi.fn(),
  log: vi.fn(),
}));

vi.mock('@/modules/auth/session', () => ({ requireAdminActor: mocks.requireAdminActor }));
vi.mock('@/server/logging/logger', () => ({ log: mocks.log }));
vi.mock('@/server/services/pim-service', () => ({
  createAdminProduct: mocks.createAdminProduct,
  listAdminProducts: mocks.listAdminProducts,
  updateAdminProduct: mocks.updateAdminProduct,
  publishAdminProduct: mocks.publishAdminProduct,
}));

import { POST as publishProduct } from '@/app/api/admin/products/[id]/publish/route';
import { PATCH as updateProduct } from '@/app/api/admin/products/[id]/route';
import { GET as listProducts, POST as createProduct } from '@/app/api/admin/products/route';

const PRODUCT_ID = 'ckz8x8x8x000001l4h3e5f6g7';

const catalogManager: SessionActor = {
  id: 'admin_1',
  isAdmin: true,
  roleCodes: ['CATALOG_MANAGER'],
  permissions: new Set(['products.read', 'products.create', 'products.update']),
};

const publisher: SessionActor = {
  ...catalogManager,
  permissions: new Set([...catalogManager.permissions, 'products.publish']),
};

function request(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe('PIM administrative API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminActor.mockResolvedValue(catalogManager);
    mocks.listAdminProducts.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
    mocks.createAdminProduct.mockResolvedValue({ id: PRODUCT_ID, slug: 'iphone-16-pro', name: 'iPhone 16 Pro' });
    mocks.updateAdminProduct.mockResolvedValue({ id: PRODUCT_ID, slug: 'iphone-16-pro', name: 'iPhone 16 Pro' });
    mocks.publishAdminProduct.mockResolvedValue({ id: PRODUCT_ID, status: 'PUBLISHED' });
  });

  it('parses a bounded product list query before reaching the service', async () => {
    const response = await listProducts(request('/api/admin/products?page=2&pageSize=25&status=DRAFT'));

    expect(response.status).toBe(200);
    expect(mocks.listAdminProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 25, status: 'DRAFT' }));
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects an invalid product list query before reaching the service', async () => {
    const response = await listProducts(request('/api/admin/products?page=0'));
    const body = await response.json() as { success: boolean; error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mocks.listAdminProducts).not.toHaveBeenCalled();
  });

  it('requires same-origin requests for product creation', async () => {
    const response = await createProduct(request('/api/admin/products', {
      method: 'POST',
      headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'iphone-16-pro', name: 'iPhone 16 Pro', variants: [] }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.createAdminProduct).not.toHaveBeenCalled();
  });

  it('validates and forwards a draft creation with audit context', async () => {
    const response = await createProduct(request('/api/admin/products', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json', 'x-request-id': 'pim_create_1234' },
      body: JSON.stringify({ slug: 'iphone-16-pro', name: 'iPhone 16 Pro', variants: [] }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createAdminProduct).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'iphone-16-pro', name: 'iPhone 16 Pro', variants: [] }),
      expect.objectContaining({ actorId: 'admin_1', requestId: 'pim_create_1234' }),
    );
  });

  it('enforces product optimistic-lock input on updates', async () => {
    const response = await updateProduct(request(`/api/admin/products/${PRODUCT_ID}`, {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'iPhone 16 Pro Max' }),
    }), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(response.status).toBe(400);
    expect(mocks.updateAdminProduct).not.toHaveBeenCalled();
  });

  it('reserves publication for the explicit publish permission', async () => {
    const response = await publishProduct(request(`/api/admin/products/${PRODUCT_ID}/publish`, {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1 }),
    }), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(response.status).toBe(403);
    expect(mocks.publishAdminProduct).not.toHaveBeenCalled();

    mocks.requireAdminActor.mockResolvedValue(publisher);
    const authorized = await publishProduct(request(`/api/admin/products/${PRODUCT_ID}/publish`, {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1 }),
    }), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(authorized.status).toBe(200);
    expect(mocks.publishAdminProduct).toHaveBeenCalledWith(PRODUCT_ID, { version: 1 }, expect.objectContaining({ actorId: 'admin_1' }));
  });
});
