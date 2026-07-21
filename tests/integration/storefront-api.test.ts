import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicProductCardDto, PublicProductDto, StorefrontCartDto } from '@/modules/catalog/types';

const mocks = vi.hoisted(() => ({
  listPublicCategories: vi.fn(),
  listPublicProducts: vi.fn(),
  getPublicProduct: vi.fn(),
  comparePublicProducts: vi.fn(),
  getGuestCart: vi.fn(),
  addGuestCartItem: vi.fn(),
}));

vi.mock('@/server/services/catalog-service', () => ({
  listPublicCategories: mocks.listPublicCategories,
  listPublicProducts: mocks.listPublicProducts,
  getPublicProduct: mocks.getPublicProduct,
  comparePublicProducts: mocks.comparePublicProducts,
}));

vi.mock('@/server/services/storefront-cart-service', () => ({
  getGuestCart: mocks.getGuestCart,
  addGuestCartItem: mocks.addGuestCartItem,
}));

import { GET as categoriesGet } from '@/app/api/store/categories/route';
import { POST as addCartItem } from '@/app/api/store/cart/items/route';
import { GET as compareProducts } from '@/app/api/store/products/compare/route';
import { GET as productGet } from '@/app/api/store/products/[slug]/route';
import { GET as productsGet } from '@/app/api/store/products/route';

const productCard = {
  id: 'cm1a2b3c4d5e6f7g8h9i0j1k',
  slug: 'iphone-16-pro',
  name: 'iPhone 16 Pro',
  brand: 'Apple',
  summary: null,
  category: null,
  heroMediaUrl: null,
  startingPriceRials: '1000000',
  compareAtPriceRials: null,
  availability: 'IN_STOCK',
  isNew: true,
  isOnSale: false,
} satisfies PublicProductCardDto;

const product = {
  ...productCard,
  description: null,
  specifications: [],
  media: [],
  variants: [],
  seo: {
    metaTitle: 'Buy iPhone 16 Pro',
    metaDescription: 'Apple iPhone 16 Pro.',
    canonicalUrl: 'https://apple333.example/products/iphone-16-pro',
    noIndex: false,
  },
} satisfies PublicProductDto;

const emptyCart = {
  itemCount: 0,
  subtotalRials: '0',
  items: [],
} satisfies StorefrontCartDto;

function request(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe('storefront public API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublicCategories.mockResolvedValue([{ id: 'cat_1', slug: 'iphone', name: 'iPhone', description: null, imageUrl: null }]);
    mocks.listPublicProducts.mockResolvedValue({ items: [productCard], page: 1, pageSize: 12, total: 1, totalPages: 1 });
    mocks.getPublicProduct.mockResolvedValue(product);
    mocks.comparePublicProducts.mockResolvedValue([product]);
    mocks.getGuestCart.mockResolvedValue(emptyCart);
    mocks.addGuestCartItem.mockResolvedValue(emptyCart);
  });

  it('serves allow-listed categories with a cache policy', async () => {
    const response = await categoriesGet(request('/api/store/categories'));
    const body = await response.json() as { success: boolean; data: { items: unknown[] } };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(body).toMatchObject({ success: true, data: { items: [{ slug: 'iphone' }] } });
  });

  it('rejects an invalid catalog query before calling the catalog service', async () => {
    const response = await productsGet(request('/api/store/products?page=0'));
    const body = await response.json() as { success: boolean; error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mocks.listPublicProducts).not.toHaveBeenCalled();
  });

  it('passes bounded brand and model filters through the public catalog contract', async () => {
    const response = await productsGet(request('/api/store/products?brand=Apple&model=iPhone%2016&sort=newest'));

    expect(response.status).toBe(200);
    expect(mocks.listPublicProducts).toHaveBeenCalledWith(expect.objectContaining({
      brand: 'Apple',
      model: 'iPhone 16',
      sort: 'newest',
    }));
  });

  it('uses the validated route parameter for a product response', async () => {
    const response = await productGet(request('/api/store/products/iphone-16-pro'), {
      params: Promise.resolve({ slug: 'iphone-16-pro' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getPublicProduct).toHaveBeenCalledWith('iphone-16-pro');
  });

  it('preserves safe SEO fields returned by the public product service', async () => {
    const response = await productGet(request('/api/store/products/iphone-16-pro'), {
      params: Promise.resolve({ slug: 'iphone-16-pro' }),
    });
    const body = await response.json() as { success: boolean; data: PublicProductDto };

    expect(response.status).toBe(200);
    expect(body.data.seo).toEqual(product.seo);
    expect(body.data.seo).not.toHaveProperty('schemaData');
  });

  it('bounds product comparisons through the query validator', async () => {
    const response = await compareProducts(request('/api/store/products/compare?slugs=iphone-16-pro,iphone-16'));
    const body = await response.json() as { success: boolean; data: { items: readonly PublicProductDto[] } };

    expect(response.status).toBe(200);
    expect(mocks.comparePublicProducts).toHaveBeenCalledWith(['iphone-16-pro', 'iphone-16']);
    expect(body.data.items).toEqual([product]);
  });

  it('requires same-origin cart mutations and sets an opaque guest-cart cookie', async () => {
    const response = await addCartItem(request('/api/store/cart/items', {
      method: 'POST',
      headers: { origin: 'http://localhost' },
      body: JSON.stringify({ variantId: 'ckz8x8x8x000001l4h3e5f6g7', quantity: 1 }),
    }));

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('set-cookie')).toContain('apple333_store_cart=');
    expect(mocks.addGuestCartItem).toHaveBeenCalledWith(expect.any(String), {
      variantId: 'ckz8x8x8x000001l4h3e5f6g7',
      quantity: 1,
    });
  });

  it('rejects a cross-origin cart mutation before reaching the cart service', async () => {
    const response = await addCartItem(request('/api/store/cart/items', {
      method: 'POST',
      headers: { origin: 'https://untrusted.example' },
      body: JSON.stringify({ variantId: 'ckz8x8x8x000001l4h3e5f6g7', quantity: 1 }),
    }));
    const body = await response.json() as { success: boolean; error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(mocks.addGuestCartItem).not.toHaveBeenCalled();
  });
});
