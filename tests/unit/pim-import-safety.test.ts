import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  batchFindUnique: vi.fn(),
  batchUpdateMany: vi.fn(),
  transactionRun: vi.fn(),
  transaction: {
    brand: { findMany: vi.fn() },
    catalogCategory: { findMany: vi.fn() },
    catalogProduct: { findMany: vi.fn(), findUnique: vi.fn() },
    catalogVariant: { findMany: vi.fn() },
    productImportBatch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    productImportChange: { create: vi.fn() },
    productImportRow: { update: vi.fn() },
    warranty: { findMany: vi.fn() },
  },
}));

vi.mock('@/server/db/prisma', () => ({
  prisma: {
    $transaction: mocks.transactionRun,
    productImportBatch: {
      findUnique: mocks.batchFindUnique,
      updateMany: mocks.batchUpdateMany,
    },
  },
}));

vi.mock('@/server/repositories/audit-log-repository', () => ({
  auditLogRepository: { create: mocks.auditCreate },
}));

vi.mock('@/server/repositories/pim-repository', () => ({
  pimRepository: { findMediaForAssociation: vi.fn() },
}));

import { productImportPreviewInput } from '@/modules/pim/validators';
import { applyAdminProductImport, previewAdminProductImport } from '@/server/services/pim-service';

const CATEGORY_ID = 'ckz8x8x8x000001l4h3e5f6g7';
const BRAND_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k2';
const WARRANTY_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k3';
const IMPORT_ID = 'import_1';
const audit = { actorId: 'admin_1', requestId: 'pim_import_safety_test' };

type StagedImportRow = Readonly<{
  rowNumber: number;
  status: string;
  validationErrors?: Readonly<{ messages?: readonly string[] }>;
}>;

function productRow(rowNumber: number, data: Record<string, unknown>) {
  const fields = {
    name: `iPhone ${rowNumber}`,
    slug: `iphone-${rowNumber}`,
    categoryId: CATEGORY_ID,
    brandId: BRAND_ID,
    warrantyId: WARRANTY_ID,
    sku: `IPHONE-${rowNumber}`,
    priceRials: '1000',
    ...data,
  };
  return {
    rowNumber,
    data: Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  };
}

describe('PIM import safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionRun.mockImplementation(async (callback: (transaction: typeof mocks.transaction) => Promise<unknown>) => callback(mocks.transaction));
    mocks.transaction.catalogProduct.findMany.mockResolvedValue([]);
    mocks.transaction.catalogVariant.findMany.mockResolvedValue([]);
    mocks.transaction.catalogCategory.findMany.mockResolvedValue([{ id: CATEGORY_ID }]);
    mocks.transaction.brand.findMany.mockResolvedValue([{ id: BRAND_ID }]);
    mocks.transaction.warranty.findMany.mockResolvedValue([{ id: WARRANTY_ID }]);
    mocks.transaction.productImportBatch.create.mockResolvedValue({
      id: IMPORT_ID,
      status: 'FAILED',
      totalRows: 4,
      validRows: 0,
      failedRows: 4,
      rows: [],
    });
    mocks.auditCreate.mockResolvedValue(undefined);
  });

  it('records duplicate, reference, and existing-SKU validation errors during preview', async () => {
    mocks.transaction.catalogVariant.findMany.mockResolvedValue([
      {
        sku: 'CONFLICT-SKU',
        skuRecord: { code: 'CONFLICT-SKU' },
        product: { slug: 'another-product' },
      },
    ]);
    const input = productImportPreviewInput.parse({
      format: 'CSV',
      originalFileName: 'products.csv',
      rows: [
        productRow(1, { slug: 'iphone-duplicate', sku: 'DUPLICATE-SKU' }),
        productRow(2, { slug: 'iphone-duplicate', sku: 'DUPLICATE-SKU' }),
        productRow(3, { categoryId: undefined, brandId: undefined, warrantyId: undefined }),
        productRow(4, { slug: 'fresh-product', sku: 'CONFLICT-SKU' }),
      ],
    });

    await previewAdminProductImport(input, audit);

    const createCall = mocks.transaction.productImportBatch.create.mock.calls[0]?.[0] as {
      data: { rows: { create: readonly StagedImportRow[] } };
    };
    const rowsByNumber = new Map(createCall.data.rows.create.map((row) => [row.rowNumber, row]));

    expect(rowsByNumber.get(1)?.validationErrors?.messages).toEqual(expect.arrayContaining([
      'Duplicate slug within this import.',
      'Duplicate SKU within this import.',
    ]));
    expect(rowsByNumber.get(2)?.validationErrors?.messages).toEqual(expect.arrayContaining([
      'Duplicate slug within this import.',
      'Duplicate SKU within this import.',
    ]));
    expect(rowsByNumber.get(3)?.validationErrors?.messages).toEqual(expect.arrayContaining([
      'A category is required for every imported product.',
      'A brand is required for every imported product.',
      'A warranty is required for every imported SKU.',
    ]));
    expect(rowsByNumber.get(4)?.validationErrors?.messages).toContain('The SKU is already assigned to another product.');
  });

  it('uses an atomic READY-to-APPLYING claim and rejects a concurrent apply', async () => {
    mocks.batchUpdateMany.mockResolvedValue({ count: 0 });
    mocks.batchFindUnique.mockResolvedValue({ id: IMPORT_ID });

    await expect(applyAdminProductImport(IMPORT_ID, audit)).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(mocks.batchUpdateMany).toHaveBeenCalledWith({
      where: { id: IMPORT_ID, status: 'READY' },
      data: {
        status: 'APPLYING',
        applyAttemptToken: expect.any(String),
        applyStartedAt: expect.any(Date),
      },
    });
    expect(mocks.transactionRun).not.toHaveBeenCalled();
  });

  it('marks an already claimed batch FAILED with a safe error code after a transactional apply rollback', async () => {
    mocks.batchUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    mocks.transaction.productImportBatch.findUnique.mockResolvedValue({
      id: IMPORT_ID,
      status: 'APPLYING',
      rows: [{ id: 'row_1', status: 'VALID', action: 'CREATE', normalizedData: {} }],
    });

    await expect(applyAdminProductImport(IMPORT_ID, audit)).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(mocks.batchUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: IMPORT_ID, status: 'READY' },
      data: {
        status: 'APPLYING',
        applyAttemptToken: expect.any(String),
        applyStartedAt: expect.any(Date),
      },
    });
    expect(mocks.batchUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: IMPORT_ID, status: 'APPLYING', applyAttemptToken: expect.any(String) },
      data: {
        status: 'FAILED',
        applyAttemptToken: null,
        applyStartedAt: null,
        errorReport: { code: 'PIM_IMPORT_APPLY_FAILED' },
      },
    });
  });
});
