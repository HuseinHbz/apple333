import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublicProduct: vi.fn(),
  listPublicCategories: vi.fn(),
  listPublicProducts: vi.fn(),
}));

vi.mock('@/server/services/catalog-service', () => ({
  getPublicProduct: mocks.getPublicProduct,
  listPublicCategories: mocks.listPublicCategories,
  listPublicProducts: mocks.listPublicProducts,
}));

import { GET as categoriesGet } from '@/app/api/categories/route';
import { GET as productGet } from '@/app/api/products/[slug]/route';
import { GET as productsGet } from '@/app/api/products/route';

function request(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe('public PIM compatibility aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublicProducts.mockResolvedValue({ items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 });
    mocks.listPublicCategories.mockResolvedValue([]);
    mocks.getPublicProduct.mockResolvedValue({ id: 'product_1', slug: 'iphone-16-pro' });
  });

  it('keeps public product aliases bounded and cacheable', async () => {
    const response = await productsGet(request('/api/products?page=1&pageSize=12'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(mocks.listPublicProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 12 }));
  });

  it('uses the validated slug for the public product-detail alias', async () => {
    const response = await productGet(request('/api/products/iphone-16-pro'), {
      params: Promise.resolve({ slug: 'iphone-16-pro' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getPublicProduct).toHaveBeenCalledWith('iphone-16-pro');
  });

  it('retains the existing public category projection behind its alias', async () => {
    const response = await categoriesGet(request('/api/categories'));
    const body = await response.json() as { success: boolean; data: { items: unknown[] } };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, data: { items: [] } });
    expect(mocks.listPublicCategories).toHaveBeenCalledOnce();
  });
});
