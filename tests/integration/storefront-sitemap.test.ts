import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listPublicCategories: vi.fn(),
  listPublicSitemapEntries: vi.fn(),
}));

vi.mock('@/server/services/catalog-service', () => ({
  listPublicCategories: mocks.listPublicCategories,
  listPublicSitemapEntries: mocks.listPublicSitemapEntries,
}));

import sitemap, { generateSitemaps } from '@/app/sitemap';

describe('storefront sitemap projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublicCategories.mockResolvedValue([{ id: 'iphone', slug: 'iphone', name: 'iPhone' }]);
    mocks.listPublicSitemapEntries.mockResolvedValue([
      { slug: 'iphone-16-pro', lastModified: new Date('2026-07-20T00:00:00.000Z'), noIndex: false },
      { slug: 'hidden-product', lastModified: new Date('2026-07-20T00:00:00.000Z'), noIndex: true },
    ]);
  });

  it('declares a database-independent runtime shard envelope', async () => {
    const shards = await generateSitemaps();
    expect(shards).toHaveLength(20);
    expect(shards[0]).toEqual({ id: 0 });
    expect(shards[19]).toEqual({ id: 19 });
  });

  it('includes canonical public routes but excludes no-index products', async () => {
    const entries = await sitemap({ id: 0 });
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain('http://localhost:3000/products/iphone-16-pro');
    expect(urls).toContain('http://localhost:3000/categories/iphone');
    expect(urls).not.toContain('http://localhost:3000/products/hidden-product');
  });

  it('requests the correct shard window from the public PIM service', async () => {
    await sitemap({ id: 1 });
    expect(mocks.listPublicSitemapEntries).toHaveBeenCalledWith({ skip: 50_000, take: 50_000 });
  });
});
