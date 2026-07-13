import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validatePimTestEnvironment } from '../../scripts/verify-pim-test-environment.mjs';
import type { AdminAuditContext } from '@/server/admin/types';

const preflight = validatePimTestEnvironment(process.env);
if (!preflight.ok || !process.env.PIM_TEST_DATABASE_URL) {
  throw new Error(`PIM database tests require the guarded isolated target: ${preflight.errors.join(' ')}`);
}

process.env.DATABASE_URL = process.env.PIM_TEST_DATABASE_URL;

type Database = typeof import('@/server/db/prisma');
type PIM = typeof import('@/server/services/pim-service');
type ProductsRoute = typeof import('@/app/api/products/route');
type ProductRoute = typeof import('@/app/api/products/[slug]/route');
type CategoriesRoute = typeof import('@/app/api/categories/route');

const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
const codeSuffix = suffix.toUpperCase();
const slugSuffix = suffix.toLowerCase();

let database: Database;
let pim: PIM;
let productsRoute: ProductsRoute;
let productRoute: ProductRoute;
let categoriesRoute: CategoriesRoute;
let actorId: string;
let brandId: string;
let rootCategoryId: string;
let childCategoryId: string;
let warrantyId: string;
let publishedProductId: string;
let publishedSlug: string;
let publishedVersion: number;

function audit(action: string): AdminAuditContext {
  return {
    actorId,
    requestId: `pim-db-${slugSuffix}-${action}`.slice(0, 128),
  };
}

function importRow(rowNumber: number, values: Record<string, string>): Readonly<{ rowNumber: number; data: Record<string, string> }> {
  return { rowNumber, data: values };
}

describe.sequential('Phase 04.1 real PostgreSQL PIM persistence', () => {
  beforeAll(async () => {
    database = await import('@/server/db/prisma');
    pim = await import('@/server/services/pim-service');
    productsRoute = await import('@/app/api/products/route');
    productRoute = await import('@/app/api/products/[slug]/route');
    categoriesRoute = await import('@/app/api/categories/route');

    await database.prisma.$connect();
    const actor = await database.prisma.user.create({
      data: {
        name: `PIM DB test ${suffix}`,
        email: `pim-db-${suffix}@example.test`,
      },
      select: { id: true },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await database.prisma.$disconnect();
  });

  it('persists brand, nested category, product, SKU, specification, media, and workflow', async () => {
    const brand = await pim.createAdminBrand({
      code: `PIM-${codeSuffix}`,
      slug: `pim-brand-${slugSuffix}`,
      name: `PIM Test Brand ${suffix}`,
      status: 'ACTIVE',
    }, audit('brand'));
    brandId = brand.id;

    const warranty = await pim.createAdminWarranty({
      code: `PIM-WARRANTY-${codeSuffix}`,
      provider: 'Apple333 Test',
      name: `PIM Warranty ${suffix}`,
      durationMonths: 18,
    }, audit('warranty'));
    warrantyId = warranty.id;

    const root = await pim.createAdminCategory({
      slug: `pim-root-${slugSuffix}`,
      name: `PIM Root ${suffix}`,
    }, audit('category-root'));
    rootCategoryId = root.id;

    const child = await pim.createAdminCategory({
      parentId: root.id,
      slug: `pim-child-${slugSuffix}`,
      name: `PIM Child ${suffix}`,
    }, audit('category-child'));
    childCategoryId = child.id;

    const group = await pim.createAdminSpecificationGroup({
      code: `PIM-SPECS-${codeSuffix}`,
      name: `PIM Specifications ${suffix}`,
    }, audit('spec-group'));
    const attribute = await pim.createAdminProductAttribute({
      groupId: group.id,
      code: `PIM-DISPLAY-${codeSuffix}`,
      name: 'Display size',
      valueType: 'SELECT',
    }, audit('spec-attribute'));
    await pim.createAdminAttributeValue({
      attributeId: attribute.id,
      code: `PIM-61-${codeSuffix}`,
      label: '6.1 inch',
    }, audit('spec-value'));
    const attributeValue = await database.prisma.attributeValue.findFirstOrThrow({
      where: { attributeId: attribute.id, code: `PIM-61-${codeSuffix}` },
      select: { id: true },
    });
    await pim.assignAdminCategoryAttribute(root.id, {
      attributeId: attribute.id,
      groupId: group.id,
      isFilterable: true,
    }, audit('category-attribute'));

    publishedSlug = `pim-phone-${slugSuffix}`;
    const product = await pim.createAdminProduct({
      categoryId: root.id,
      brandId: brand.id,
      slug: publishedSlug,
      name: `PIM Phone ${suffix}`,
      summary: 'Persisted product test fixture',
      description: 'Created only in the isolated PIM database.',
      seo: {
        metaTitle: `PIM Phone ${suffix}`,
        metaDescription: 'A safe integration-test SEO description.',
        canonicalUrl: `https://example.test/products/${publishedSlug}`,
      },
      variants: [{
        skuCode: `PIM-SKU-${codeSuffix}`,
        warrantyId: warranty.id,
        priceRials: 1_000_000n,
        compareAtPriceRials: 1_100_000n,
      }],
      specifications: [{
        attributeId: attribute.id,
        attributeValueId: attributeValue.id,
        displayValue: '6.1 inch',
      }],
    }, audit('product-create'));
    publishedProductId = product.id;
    publishedVersion = product.version;

    const persisted = await database.prisma.catalogProduct.findUniqueOrThrow({
      where: { id: product.id },
      include: {
        seo: true,
        variants: { include: { skuRecord: true } },
        specificationsStructured: true,
      },
    });
    expect(persisted.variants).toHaveLength(1);
    expect(persisted.variants[0]?.skuRecord?.code).toBe(`PIM-SKU-${codeSuffix}`);
    expect(persisted.specificationsStructured).toHaveLength(1);
    expect(persisted.seo?.canonicalUrl).toBe(`https://example.test/products/${publishedSlug}`);

    const image = await database.prisma.mediaFile.create({
      data: {
        storageKey: `pim-db/${suffix}/hero.jpg`,
        originalName: 'hero.jpg',
        contentType: 'image/jpeg',
        extension: 'jpg',
        bytes: 1_024,
        kind: 'IMAGE',
        uploadedById: actorId,
      },
      select: { id: true },
    });
    const afterMedia = await pim.addAdminProductMedia(product.id, {
      mediaId: image.id,
      role: 'HERO',
      altText: 'PIM test hero',
    }, audit('product-media'));
    publishedVersion = afterMedia.version;

    const document = await database.prisma.mediaFile.create({
      data: {
        storageKey: `pim-db/${suffix}/source.csv`,
        originalName: 'source.csv',
        contentType: 'text/csv',
        extension: 'csv',
        bytes: 512,
        kind: 'DOCUMENT',
        uploadedById: actorId,
      },
      select: { id: true },
    });
    await expect(pim.addAdminProductMedia(product.id, { mediaId: document.id, role: 'GALLERY' }, audit('invalid-media')))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const review = await pim.submitAdminProductForReview(product.id, { version: publishedVersion }, audit('review'));
    const published = await pim.publishAdminProduct(product.id, { version: review.version }, audit('publish'));
    expect(published.status).toBe('PUBLISHED');

    const workflowEvents = await database.prisma.productWorkflowEvent.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: 'asc' },
      select: { toStatus: true },
    });
    expect(workflowEvents.map((event) => event.toStatus)).toEqual(['REVIEW', 'PUBLISHED']);
  });

  it('prevents category cycles through the persisted hierarchy', async () => {
    await expect(pim.updateAdminCategory(rootCategoryId, { parentId: childCategoryId }, audit('category-cycle')))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('logs invalid import rows and applies a valid staged CSV import exactly once', async () => {
    const invalid = await pim.previewAdminProductImport({
      format: 'CSV',
      originalFileName: 'invalid.csv',
      rows: [
        importRow(1, { slug: `missing-${slugSuffix}` }),
        importRow(2, {
          name: 'Conflicting SKU',
          slug: `conflicting-sku-${slugSuffix}`,
          brandId,
          categoryId: rootCategoryId,
          warrantyId,
          skuCode: `PIM-SKU-${codeSuffix}`,
          priceRials: '1200000',
        }),
        importRow(3, {
          name: 'Invalid category',
          slug: `invalid-category-${slugSuffix}`,
          brandId,
          categoryId: actorId,
          warrantyId,
          skuCode: `PIM-BAD-CATEGORY-${codeSuffix}`,
          priceRials: '1200000',
        }),
      ],
    }, audit('import-invalid'));
    expect(invalid.status).toBe('FAILED');
    expect(invalid.failedRows).toBe(3);

    const importedSlug = `pim-imported-${slugSuffix}`;
    const valid = await pim.previewAdminProductImport({
      format: 'CSV',
      originalFileName: 'valid.csv',
      rows: [importRow(1, {
        name: `Imported PIM Phone ${suffix}`,
        slug: importedSlug,
        brandId,
        categoryId: rootCategoryId,
        warrantyId,
        skuCode: `PIM-IMPORT-${codeSuffix}`,
        priceRials: '2000000',
      })],
    }, audit('import-preview'));
    expect(valid.status).toBe('READY');
    expect(valid.validRows).toBe(1);

    const applied = await pim.applyAdminProductImport(valid.id, audit('import-apply'));
    expect(applied.status).toBe('COMPLETED');
    await expect(pim.applyAdminProductImport(valid.id, audit('import-reapply')))
      .rejects.toMatchObject({ code: 'CONFLICT' });

    const imported = await database.prisma.catalogProduct.findUnique({
      where: { slug: importedSlug },
      include: { variants: { include: { skuRecord: true } } },
    });
    expect(imported?.variants[0]?.skuRecord?.code).toBe(`PIM-IMPORT-${codeSuffix}`);
  });

  it('rolls back every import write when a post-preview SKU conflict occurs', async () => {
    const rollbackSlug = `pim-import-rollback-${slugSuffix}`;
    const conflictSku = `PIM-ROLLBACK-${codeSuffix}`;
    const preview = await pim.previewAdminProductImport({
      format: 'CSV',
      originalFileName: 'rollback.csv',
      rows: [importRow(1, {
        name: `Rollback PIM Phone ${suffix}`,
        slug: rollbackSlug,
        brandId,
        categoryId: rootCategoryId,
        warrantyId,
        skuCode: conflictSku,
        priceRials: '2000000',
      })],
    }, audit('import-rollback-preview'));
    expect(preview.status).toBe('READY');

    await pim.createAdminProduct({
      categoryId: rootCategoryId,
      brandId,
      slug: `pim-import-conflict-${slugSuffix}`,
      name: `PIM Import Conflict ${suffix}`,
      variants: [{ skuCode: conflictSku, warrantyId, priceRials: 2_000_000n }],
    }, audit('import-rollback-conflict'));

    await expect(pim.applyAdminProductImport(preview.id, audit('import-rollback-apply'))).rejects.toBeDefined();

    const [batch, absentProduct, changes] = await Promise.all([
      database.prisma.productImportBatch.findUniqueOrThrow({
        where: { id: preview.id },
        include: { rows: { orderBy: { rowNumber: 'asc' } } },
      }),
      database.prisma.catalogProduct.findUnique({ where: { slug: rollbackSlug }, select: { id: true } }),
      database.prisma.productImportChange.findMany({ where: { importBatchId: preview.id } }),
    ]);

    expect(batch.status).toBe('FAILED');
    expect(batch.errorReport).toMatchObject({ code: 'PIM_IMPORT_APPLY_FAILED' });
    expect(batch.rows).toHaveLength(1);
    expect(batch.rows[0]).toMatchObject({ status: 'VALID', appliedAt: null });
    expect(absentProduct).toBeNull();
    expect(changes).toHaveLength(0);
  });

  it('returns only published database records and safe SEO through public API aliases', async () => {
    await pim.createAdminProduct({
      categoryId: rootCategoryId,
      brandId,
      slug: `pim-draft-${slugSuffix}`,
      name: `PIM Draft ${suffix}`,
      variants: [],
    }, audit('draft-product'));

    const listResponse = await productsRoute.GET(new Request('http://localhost/api/products?page=1&pageSize=25'));
    const listBody = await listResponse.json() as {
      success: boolean;
      data: { items: readonly { slug: string }[] };
    };
    expect(listResponse.status).toBe(200);
    expect(listBody.success).toBe(true);
    expect(listBody.data.items.map((item) => item.slug)).toContain(publishedSlug);
    expect(listBody.data.items.map((item) => item.slug)).not.toContain(`pim-draft-${slugSuffix}`);

    const detailResponse = await productRoute.GET(
      new Request(`http://localhost/api/products/${publishedSlug}`),
      { params: Promise.resolve({ slug: publishedSlug }) },
    );
    const detailBody = await detailResponse.json() as {
      success: boolean;
      data: { id: string; seo: { canonicalUrl: string | null; noIndex: boolean; schemaData?: unknown } };
    };
    expect(detailResponse.status).toBe(200);
    expect(detailBody.data.id).toBe(publishedProductId);
    expect(detailBody.data.seo.canonicalUrl).toBe(`https://example.test/products/${publishedSlug}`);
    expect(detailBody.data.seo.noIndex).toBe(false);
    expect(detailBody.data.seo).not.toHaveProperty('schemaData');

    const categoryResponse = await categoriesRoute.GET(new Request('http://localhost/api/categories'));
    const categoryBody = await categoryResponse.json() as { data: { items: readonly { id: string }[] } };
    expect(categoryResponse.status).toBe(200);
    expect(categoryBody.data.items.map((category) => category.id)).toContain(rootCategoryId);
  });
});
