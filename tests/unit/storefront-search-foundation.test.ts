import { describe, expect, it, vi } from 'vitest';

import {
  buildPublicPimCatalogSearchPath,
  createPublicPimCatalogSearchAdapter,
  createPublicPimCatalogSearchTransport,
} from '@/features/storefront/queries/public-pim-catalog-search';
import { expandPersianSearchSynonyms, normalizePersianSearchTerm } from '@/features/storefront/services/persian-search';
import { parseStorefrontSearchInput } from '@/features/storefront/schemas/search';
import { searchIndexEvolution, typoToleranceDesign, type PublicPimCatalogPageDto } from '@/features/storefront/types/search';

function catalogPage(items: PublicPimCatalogPageDto['items']): PublicPimCatalogPageDto {
  return { items, page: 1, pageSize: 3, total: items.length, totalPages: 1 };
}

const IPHONE = {
  id: 'iphone-16-pro',
  slug: 'iphone-16-pro',
  name: 'iPhone 16 Pro',
  brand: 'Apple',
  summary: null,
  category: { slug: 'iphone', name: 'iPhone' },
  heroMediaUrl: null,
  startingPriceRials: '1000000000',
  compareAtPriceRials: null,
  availability: 'IN_STOCK',
  isNew: true,
  isOnSale: false,
} as const;

const AIRPODS = {
  ...IPHONE,
  id: 'airpods-pro-2',
  slug: 'airpods-pro-2',
  name: 'AirPods Pro 2',
} as const;

describe('storefront search foundation', () => {
  it('normalizes Arabic variants, Persian digits, diacritics, and display separators', () => {
    expect(normalizePersianSearchTerm('  آيـفون\u200c۱۶  پِرو ')).toBe('آیفون 16 پرو');
    expect(normalizePersianSearchTerm('MacBook-١٢')).toBe('macbook 12');
  });

  it('expands bounded Persian and English product synonyms without treating them as typo correction', () => {
    const expansion = expandPersianSearchSynonyms('آیفون ۱۶ پرو');

    expect(expansion.normalizedTerm).toBe('آیفون 16 پرو');
    expect(expansion.candidates).toEqual(expect.arrayContaining([
      { term: 'آیفون 16 پرو', source: 'normalized' },
      { term: 'iphone 16 pro', source: 'synonym' },
    ]));
    expect(expansion.candidates.length).toBeGreaterThan(1);
    expect(expansion.candidates.length).toBeLessThanOrEqual(6);
  });

  it('adds bounded, curated typo corrections without claiming fuzzy ranking', () => {
    const expansion = expandPersianSearchSynonyms('iphon 16 pro');

    expect(expansion.candidates).toEqual(expect.arrayContaining([
      { term: 'iphon 16 pro', source: 'normalized' },
      { term: 'iphone 16 pro', source: 'typo' },
    ]));
  });

  it('validates the existing bounded PIM catalog contract before normalizing its query', () => {
    const input = parseStorefrontSearchInput({
      query: ' آیفون ۱۶ ',
      page: '2',
      pageSize: '12',
      minPriceRials: '1000000',
      maxPriceRials: '2000000',
      sort: 'price-asc',
    });

    expect(input).toMatchObject({
      query: 'آیفون 16',
      page: 2,
      pageSize: 12,
      minPriceRials: 1_000_000n,
      maxPriceRials: 2_000_000n,
      sort: 'price-asc',
    });
    expect(() => parseStorefrontSearchInput({ page: 1 })).toThrow();
    expect(() => parseStorefrontSearchInput({ query: 'x', minPriceRials: '20', maxPriceRials: '10' })).toThrow();
  });

  it('builds only the canonical public PIM URL with encoded, supported filters', () => {
    const path = buildPublicPimCatalogSearchPath(parseStorefrontSearchInput({
      query: 'ایرپاد پرو',
      brand: 'Apple',
      model: 'AirPods Pro',
      category: 'airpods',
      color: 'White',
      inStock: 'true',
      page: 2,
      pageSize: 12,
      sort: 'newest',
    }));

    expect(path).toContain('/api/store/products?');
    expect(path).toContain('query=%D8%A7%DB%8C%D8%B1%D9%BE%D8%A7%D8%AF+%D9%BE%D8%B1%D9%88');
    expect(path).toContain('category=airpods');
    expect(path).toContain('brand=Apple');
    expect(path).toContain('model=AirPods+Pro');
    expect(path).toContain('color=White');
    expect(path).toContain('inStock=true');
  });

  it('merges successful synonym pages through the public PIM transport and labels totals as approximate', async () => {
    const listProducts = vi.fn(async (input: { query: string }) => {
      if (input.query === 'آیفون 16 پرو') return catalogPage([IPHONE]);
      if (input.query === 'iphone 16 pro') return catalogPage([IPHONE, AIRPODS]);
      return catalogPage([]);
    });
    const adapter = createPublicPimCatalogSearchAdapter({ listProducts });

    const result = await adapter.search({ query: 'آیفون 16 پرو', pageSize: 3 });

    expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({ query: 'آیفون 16 پرو' }));
    expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({ query: 'iphone 16 pro' }));
    expect(result.items.map((item) => item.id)).toEqual(['iphone-16-pro', 'airpods-pro-2']);
    expect(result.primaryTotal).toBe(1);
    expect(result.isApproximate).toBe(true);
  });

  it('keeps the primary PIM result when an optional synonym request is unavailable', async () => {
    const listProducts = vi.fn(async (input: { query: string }) => {
      if (input.query === 'آیفون 16 پرو') return catalogPage([IPHONE]);
      throw new Error('Optional candidate unavailable');
    });
    const adapter = createPublicPimCatalogSearchAdapter({ listProducts });

    const result = await adapter.search({ query: 'آیفون 16 پرو' });

    expect(result.items).toEqual([IPHONE]);
    expect(result.unavailableCandidates.length).toBeGreaterThan(0);
  });

  it('creates a same-origin PIM transport instead of a direct database client', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: catalogPage([IPHONE]),
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const transport = createPublicPimCatalogSearchTransport(fetcher);

    const page = await transport.listProducts(parseStorefrontSearchInput({ query: 'iphone' }));

    expect(page.items).toEqual([IPHONE]);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/store\/products\?/), expect.objectContaining({
      credentials: 'same-origin',
      method: 'GET',
    }));
  });

  it('documents the deliberate absence of an indexed typo-ranking implementation', () => {
    expect(typoToleranceDesign.status).toBe('not-implemented');
    expect(typoToleranceDesign.currentBehavior).toBe('normalized-synonym-and-curated-typo-candidates-only');
    expect(searchIndexEvolution.current).toMatchObject({
      indexStatus: 'no-dedicated-search-index',
      rankingStatus: 'no-typo-ranking',
    });
  });
});
