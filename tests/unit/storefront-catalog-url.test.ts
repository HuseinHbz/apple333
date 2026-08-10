import { describe, expect, it } from 'vitest';

import { storefrontCatalogApiPath } from '@/features/storefront/services/catalog-url';

describe('storefront catalog URL boundary', () => {
  it('uses the canonical public PIM products endpoint', () => {
    expect(storefrontCatalogApiPath()).toBe('/api/store/products?page=1&pageSize=24&sort=featured');
  });

  it('normalizes Persian search input before it reaches the public API', () => {
    const path = storefrontCatalogApiPath({ query: 'آیفون‌۱۶', page: 2, sort: 'newest' });
    expect(path).toContain('page=2');
    expect(path).toContain('sort=newest');
    expect(new URL(path, 'http://localhost').searchParams.get('query')).toBe('آیفون 16');
  });

  it('keeps only supported PIM filter parameters in the URL', () => {
    const path = storefrontCatalogApiPath({ brand: 'Apple', model: 'iPhone 16', category: 'iphone', color: 'Black', storage: '256GB', inStock: true });
    expect(path).toContain('brand=Apple');
    expect(path).toContain('model=iPhone+16');
    expect(path).toContain('category=iphone');
    expect(path).toContain('color=Black');
    expect(path).toContain('storage=256GB');
    expect(path).toContain('inStock=true');
  });

  it('drops non-numeric price values before they can reach the API validator', () => {
    const path = storefrontCatalogApiPath({ minPriceRials: '1e6', maxPriceRials: '1000000' });
    expect(path).not.toContain('minPriceRials');
    expect(path).toContain('maxPriceRials=1000000');
  });
});
