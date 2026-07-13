import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';

import type {
  AdminBrandDto,
  AdminCategoryDto,
  AdminProductAttributeDto,
  AdminProductDetailDto,
  AdminProductListItemDto,
  AdminProductMediaDto,
  AdminProductSpecificationDto,
  AdminProductVariantDto,
  AdminProductImportDto,
  AdminSpecificationGroupDto,
  AdminWarrantyDto,
  ProductImportPreviewDto,
} from '@/modules/pim/types';
import type {
  CategoryAttributeAssignmentInput,
  CreateAttributeValueInput,
  CreateBrandInput,
  CreateCategoryInput,
  CreateProductAttributeInput,
  CreateProductInput,
  CreateSpecificationGroupInput,
  CreateWarrantyInput,
  ProductImportPreviewInput,
  ProductImportListQuery,
  ProductListQuery,
  ProductMediaInput,
  ProductSpecificationInput,
  ProductVariantInput,
  ProductWorkflowInput,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateProductVariantInput,
  UpdateProductAttributeInput,
  UpdateSpecificationGroupInput,
  UpdateWarrantyInput,
} from '@/modules/pim/validators';
import { createProductInput, PIM_IMPORT_MAX_ROWS } from '@/modules/pim/validators';
import { auditInput, requireAuditContext } from '@/server/admin/audit';
import type { AdminAuditContext, Page } from '@/server/admin/types';
import { toPage } from '@/server/admin/pagination';
import { prisma } from '@/server/db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/server/errors/app-error';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import {
  pimRepository,
  type AdminProductDetailRecord,
  type AdminProductListRecord,
  type BrandRecord,
  type CategoryRecord,
  type ProductAttributeRecord,
  type SpecificationGroupRecord,
  type WarrantyRecord,
} from '@/server/repositories/pim-repository';

type Transaction = Prisma.TransactionClient;

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function jsonValue(value: Prisma.JsonValue | null): unknown | null {
  return value;
}

function jsonInput(value: unknown | null | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function buildProductSearchText(input: Readonly<{
  name: string;
  slug: string;
  brand: string;
  skuCodes?: readonly string[];
  specificationValues?: readonly string[];
}>): string {
  return [...new Set([
    input.name,
    input.slug,
    input.brand,
    ...(input.skuCodes ?? []),
    ...(input.specificationValues ?? []),
  ].map((value) => value.trim().toLocaleLowerCase('en-US')).filter(Boolean))].join(' ');
}

function toBrandDto(record: BrandRecord): AdminBrandDto {
  return {
    id: record.id,
    code: record.code,
    slug: record.slug,
    name: record.name,
    logoMediaId: record.logoMediaId,
    description: record.description,
    status: record.status,
    deletedAt: iso(record.deletedAt),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toCategoryDto(record: CategoryRecord): AdminCategoryDto {
  return {
    id: record.id,
    parentId: record.parentId,
    slug: record.slug,
    name: record.name,
    description: record.description,
    imageMediaId: record.imageMediaId,
    imageUrl: record.imageUrl,
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    deletedAt: iso(record.deletedAt),
    productCount: record._count.products,
    childCount: record._count.children,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toWarrantyDto(record: WarrantyRecord): AdminWarrantyDto {
  return {
    id: record.id,
    code: record.code,
    provider: record.provider,
    name: record.name,
    durationMonths: record.durationMonths,
    terms: record.terms,
    conditions: record.conditions,
    isActive: record.isActive,
    deletedAt: iso(record.deletedAt),
    variantCount: record._count.variants,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toSpecificationGroupDto(record: SpecificationGroupRecord): AdminSpecificationGroupDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    attributeCount: record._count.attributes,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toProductAttributeDto(record: ProductAttributeRecord): AdminProductAttributeDto {
  return {
    id: record.id,
    groupId: record.groupId,
    code: record.code,
    name: record.name,
    valueType: record.valueType,
    unitCode: record.unitCode,
    isFilterable: record.isFilterable,
    isSearchable: record.isSearchable,
    isRequiredDefault: record.isRequiredDefault,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    valueCount: record._count.values,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toProductListDto(record: AdminProductListRecord): AdminProductListItemDto {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    brand: record.brandRecord ? { id: record.brandRecord.id, name: record.brandRecord.name } : null,
    legacyBrand: record.brand,
    category: record.category ? { id: record.category.id, name: record.category.name, slug: record.category.slug } : null,
    status: record.status,
    version: record.version,
    variantCount: record._count.variants,
    activeVariantCount: record.variants.length,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toProductVariantDto(record: AdminProductDetailRecord['variants'][number]): AdminProductVariantDto {
  return {
    id: record.id,
    sku: record.sku,
    title: record.title,
    color: record.color,
    storage: record.storage,
    region: record.region,
    modelNumber: record.modelNumber,
    optionKey: record.optionKey,
    warranty: record.warrantyRecord ? { id: record.warrantyRecord.id, name: record.warrantyRecord.name, provider: record.warrantyRecord.provider } : null,
    isActive: record.isActive,
    deletedAt: iso(record.deletedAt),
    version: record.version,
    sortOrder: record.sortOrder,
    skuRecord: record.skuRecord ? {
      id: record.skuRecord.id,
      code: record.skuRecord.code,
      barcode: record.skuRecord.barcode,
      priceRials: record.skuRecord.priceRials.toString(),
      compareAtPriceRials: record.skuRecord.compareAtPriceRials?.toString() ?? null,
      costRials: record.skuRecord.costRials?.toString() ?? null,
      status: record.skuRecord.status,
      version: record.skuRecord.version,
      deletedAt: iso(record.skuRecord.deletedAt),
    } : null,
  };
}

function toProductSpecificationDto(record: AdminProductDetailRecord['specificationsStructured'][number]): AdminProductSpecificationDto {
  return {
    id: record.id,
    scope: record.scope,
    subjectKey: record.subjectKey,
    displayValue: record.displayValue,
    value: jsonValue(record.value),
    unitCode: record.unitCode,
    sortOrder: record.sortOrder,
    attribute: { id: record.attribute.id, code: record.attribute.code, name: record.attribute.name, valueType: record.attribute.valueType },
    attributeValue: record.attributeValue ? { id: record.attributeValue.id, code: record.attributeValue.code, label: record.attributeValue.label } : null,
  };
}

function toProductMediaDto(record: AdminProductDetailRecord['media'][number]): AdminProductMediaDto {
  return {
    id: record.id,
    mediaId: record.mediaId,
    variantId: record.variantId,
    role: record.role,
    altText: record.altText,
    caption: record.caption,
    sortOrder: record.sortOrder,
    media: {
      originalName: record.media.originalName,
      contentType: record.media.contentType,
      kind: record.media.kind,
      deletedAt: iso(record.media.deletedAt),
    },
  };
}

type ProductImportRecord = Readonly<{
  id: string;
  format: 'CSV' | 'XLSX';
  status: ProductImportPreviewDto['status'];
  originalFileName: string;
  totalRows: number;
  validRows: number;
  failedRows: number;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

function toProductImportDto(record: ProductImportRecord): AdminProductImportDto {
  return {
    id: record.id,
    format: record.format,
    status: record.status,
    originalFileName: record.originalFileName,
    totalRows: record.totalRows,
    validRows: record.validRows,
    failedRows: record.failedRows,
    appliedAt: iso(record.appliedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toProductDetailDto(record: AdminProductDetailRecord): AdminProductDetailDto {
  return {
    ...toProductListDto(record),
    summary: record.summary,
    description: record.description,
    isFeatured: record.isFeatured,
    featuredRank: record.featuredRank,
    isNew: record.isNew,
    isOnSale: record.isOnSale,
    submittedForReviewAt: iso(record.submittedForReviewAt),
    approvedAt: iso(record.approvedAt),
    approvedBy: record.approvedBy ? { id: record.approvedBy.id, name: record.approvedBy.name, email: record.approvedBy.email } : null,
    publishedAt: iso(record.publishedAt),
    deletedAt: iso(record.deletedAt),
    seo: record.seo ? {
      metaTitle: record.seo.metaTitle,
      metaDescription: record.seo.metaDescription,
      canonicalUrl: record.seo.canonicalUrl,
      noIndex: record.seo.noIndex,
      schemaData: jsonValue(record.seo.schemaData),
    } : null,
    variants: record.variants.map(toProductVariantDto),
    specifications: record.specificationsStructured.map(toProductSpecificationDto),
    media: record.media.map(toProductMediaDto),
  };
}

function assertVersion(expected: number, actual: number): void {
  if (expected !== actual) throw new ConflictError();
}

/**
 * A read-then-update version check is vulnerable to a concurrent writer. This
 * conditional mutation is the authoritative optimistic-lock transition and
 * also holds the product row lock for the rest of the transaction.
 */
async function claimProductVersion(
  productId: string,
  client: Transaction,
  expectedVersion?: number,
): Promise<void> {
  const result = await client.catalogProduct.updateMany({
    where: {
      id: productId,
      deletedAt: null,
      ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
    },
    data: { version: { increment: 1 } },
  });
  if (result.count !== 1) {
    if (expectedVersion === undefined) throw new NotFoundError();
    throw new ConflictError();
  }
}

async function claimVariantVersion(
  productId: string,
  variantId: string,
  expectedVersion: number,
  client: Transaction,
): Promise<void> {
  const result = await client.catalogVariant.updateMany({
    where: { id: variantId, productId, deletedAt: null, version: expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (result.count !== 1) throw new ConflictError();
}

async function assertActiveCategory(categoryId: string | null | undefined, client: Transaction): Promise<void> {
  if (categoryId === undefined || categoryId === null) return;
  if (!await pimRepository.findActiveCategory(categoryId, client)) throw new ValidationError({ categoryId: 'Category is inactive or does not exist.' });
}

async function activeBrandName(brandId: string | null | undefined, client: Transaction): Promise<{ id: string; name: string } | null> {
  if (brandId === undefined || brandId === null) return null;
  const brand = await pimRepository.findActiveBrand(brandId, client);
  if (!brand) throw new ValidationError({ brandId: 'Brand is inactive or does not exist.' });
  return brand;
}

async function assertMediaKind(mediaId: string | null | undefined, expected: 'IMAGE' | 'VIDEO' | undefined, client: Transaction): Promise<void> {
  if (mediaId === undefined || mediaId === null) return;
  const media = await pimRepository.findMediaForAssociation(mediaId, client);
  if (!media || (expected && media.kind !== expected)) throw new ValidationError({ mediaId: 'Media is unavailable or has an invalid kind.' });
}

async function assertWarranty(warrantyId: string | null | undefined, client: Transaction): Promise<void> {
  if (warrantyId === undefined || warrantyId === null) return;
  if (!await pimRepository.findActiveWarranty(warrantyId, client)) throw new ValidationError({ warrantyId: 'Warranty is inactive or does not exist.' });
}

async function resolveSpecificationTargets(
  productId: string,
  categoryId: string | null,
  variants: readonly { id: string; sku: string }[],
  specifications: readonly ProductSpecificationInput[],
  client: Transaction,
): Promise<Prisma.ProductSpecificationCreateManyInput[]> {
  return Promise.all(specifications.map(async (specification): Promise<Prisma.ProductSpecificationCreateManyInput> => {
    const attribute = await pimRepository.findActiveAttribute(specification.attributeId, client);
    if (!attribute) throw new ValidationError({ attributeId: 'Specification attribute is unavailable.' });
    if (categoryId) {
      const assignment = await client.categoryAttribute.findFirst({
        where: { categoryId, attributeId: specification.attributeId },
        select: { id: true },
      });
      if (!assignment) throw new ValidationError({ attributeId: 'Specification attribute is not assigned to this product category.' });
    }
    if (specification.attributeValueId) {
      const value = await pimRepository.findActiveAttributeValue(specification.attributeValueId, client);
      if (!value || value.attributeId !== specification.attributeId) throw new ValidationError({ attributeValueId: 'Attribute value does not belong to the selected attribute.' });
    }
    const variant = specification.scope === 'VARIANT'
      ? variants.find((item) => item.sku === specification.variantSkuCode)
      : undefined;
    if (specification.scope === 'VARIANT' && !variant) throw new ValidationError({ variantSkuCode: 'Variant SKU does not belong to this product.' });

    const value = jsonInput(specification.value);
    return {
      productId,
      variantId: variant?.id ?? null,
      attributeId: specification.attributeId,
      attributeValueId: specification.attributeValueId ?? null,
      scope: specification.scope,
      subjectKey: variant?.id ?? 'PRODUCT',
      ...(value === undefined ? {} : { value }),
      displayValue: specification.displayValue,
      ...(specification.unitCode === undefined || specification.unitCode === null ? {} : { unitCode: specification.unitCode }),
      sortOrder: specification.sortOrder,
    };
  }));
}

export async function listAdminProducts(query: ProductListQuery): Promise<Page<AdminProductListItemDto>> {
  const result = await pimRepository.findProductPage(query);
  return toPage(result.items.map(toProductListDto), query, result.total);
}

export async function getAdminProduct(productId: string): Promise<AdminProductDetailDto> {
  const product = await pimRepository.findProductById(productId);
  if (!product || product.deletedAt) throw new NotFoundError();
  return toProductDetailDto(product);
}

export async function listAdminBrands(query: ProductListQuery): Promise<Page<AdminBrandDto>> {
  const result = await pimRepository.findBrandPage(query);
  return toPage(result.items.map(toBrandDto), query, result.total);
}

export async function listAdminCategories(query: ProductListQuery): Promise<Page<AdminCategoryDto>> {
  const result = await pimRepository.findCategoryPage(query);
  return toPage(result.items.map(toCategoryDto), query, result.total);
}

export async function listAdminWarranties(query: ProductListQuery): Promise<Page<AdminWarrantyDto>> {
  const result = await pimRepository.findWarrantyPage(query);
  return toPage(result.items.map(toWarrantyDto), query, result.total);
}

export async function listAdminSpecificationGroups(query: ProductListQuery): Promise<Page<AdminSpecificationGroupDto>> {
  const result = await pimRepository.findSpecificationGroups(query);
  return toPage(result.items.map(toSpecificationGroupDto), query, result.total);
}

export async function listAdminProductAttributes(query: ProductListQuery): Promise<Page<AdminProductAttributeDto>> {
  const result = await pimRepository.findProductAttributes(query);
  return toPage(result.items.map(toProductAttributeDto), query, result.total);
}

export async function listAdminProductImports(query: ProductImportListQuery): Promise<Page<AdminProductImportDto>> {
  const where: Prisma.ProductImportBatchWhereInput = {
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.query === undefined ? {} : { originalFileName: { contains: query.query, mode: 'insensitive' } }),
  };
  const [items, total] = await Promise.all([
    prisma.productImportBatch.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        format: true,
        status: true,
        originalFileName: true,
        totalRows: true,
        validRows: true,
        failedRows: true,
        appliedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.productImportBatch.count({ where }),
  ]);
  return toPage(items.map(toProductImportDto), query, total);
}

export async function getAdminProductImport(importId: string): Promise<AdminProductImportDto> {
  const record = await prisma.productImportBatch.findUnique({
    where: { id: importId },
    select: {
      id: true,
      format: true,
      status: true,
      originalFileName: true,
      totalRows: true,
      validRows: true,
      failedRows: true,
      appliedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!record) throw new NotFoundError();
  return toProductImportDto(record);
}

export async function createAdminBrand(input: CreateBrandInput, context: AdminAuditContext): Promise<AdminBrandDto> {
  const audit = requireAuditContext(context);
  const brandId = await prisma.$transaction(async (transaction) => {
    await assertMediaKind(input.logoMediaId, 'IMAGE', transaction);
    const duplicate = await transaction.brand.findFirst({ where: { OR: [{ code: input.code }, { slug: input.slug }] }, select: { id: true } });
    if (duplicate) throw new ConflictError();
    const brandData: Prisma.BrandUncheckedCreateInput = {
        code: input.code,
        slug: input.slug,
        name: input.name,
        ...(input.logoMediaId === undefined ? {} : { logoMediaId: input.logoMediaId }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.seoTitle === undefined ? {} : { seoTitle: input.seoTitle }),
        ...(input.seoDescription === undefined ? {} : { seoDescription: input.seoDescription }),
        ...(input.canonicalUrl === undefined ? {} : { canonicalUrl: input.canonicalUrl }),
        ...(input.schemaData === undefined ? {} : { schemaData: input.schemaData === null ? Prisma.JsonNull : jsonInput(input.schemaData) as Prisma.InputJsonValue }),
        status: input.status,
      };
    const brand = await transaction.brand.create({
      data: brandData,
      select: { id: true },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.brand.created', entityType: 'Brand', entityId: brand.id, metadata: { code: input.code, status: input.status },
    }), transaction);
    return brand.id;
  });
  const brand = await pimRepository.findBrandById(brandId);
  if (!brand) throw new NotFoundError();
  return toBrandDto(brand);
}

export async function updateAdminBrand(brandId: string, input: UpdateBrandInput, context: AdminAuditContext): Promise<AdminBrandDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const existing = await pimRepository.findBrandById(brandId, transaction);
    if (!existing || existing.deletedAt) throw new NotFoundError();
    await assertMediaKind(input.logoMediaId, 'IMAGE', transaction);
    if (input.code !== undefined || input.slug !== undefined) {
      const duplicate = await transaction.brand.findFirst({
        where: {
          id: { not: brandId },
          OR: [
            ...(input.code === undefined ? [] : [{ code: input.code }]),
            ...(input.slug === undefined ? [] : [{ slug: input.slug }]),
          ],
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictError();
    }
    await transaction.brand.update({
      where: { id: brandId },
      data: {
        ...(input.code === undefined ? {} : { code: input.code }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.logoMediaId === undefined ? {} : { logoMediaId: input.logoMediaId }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.seoTitle === undefined ? {} : { seoTitle: input.seoTitle }),
        ...(input.seoDescription === undefined ? {} : { seoDescription: input.seoDescription }),
        ...(input.canonicalUrl === undefined ? {} : { canonicalUrl: input.canonicalUrl }),
        ...(input.schemaData === undefined ? {} : { schemaData: jsonInput(input.schemaData) ?? Prisma.JsonNull }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.brand.updated', entityType: 'Brand', entityId: brandId,
    }), transaction);
  });
  const brand = await pimRepository.findBrandById(brandId);
  if (!brand) throw new NotFoundError();
  return toBrandDto(brand);
}

export async function deleteAdminBrand(brandId: string, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const brand = await pimRepository.findBrandById(brandId, transaction);
    if (!brand || brand.deletedAt) throw new NotFoundError();
    if (brand._count.products > 0) throw new ConflictError();
    await transaction.brand.update({ where: { id: brandId }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.brand.archived', entityType: 'Brand', entityId: brandId,
    }), transaction);
  });
}

async function assertCategoryParent(parentId: string | null | undefined, categoryId: string | undefined, client: Transaction): Promise<void> {
  if (parentId === undefined || parentId === null) return;
  if (parentId === categoryId) throw new ValidationError({ parentId: 'A category cannot be its own parent.' });
  let cursor: string | null = parentId;
  let depth = 0;
  while (cursor) {
    const category: { id: string; parentId: string | null } | null = await client.catalogCategory.findFirst({
      where: { id: cursor, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!category) throw new ValidationError({ parentId: 'Parent category is unavailable.' });
    if (category.id === categoryId) throw new ValidationError({ parentId: 'Category hierarchy cannot contain a cycle.' });
    cursor = category.parentId;
    depth += 1;
    if (depth > 32) throw new ValidationError({ parentId: 'Category hierarchy exceeds the supported depth.' });
  }
}

export async function createAdminCategory(input: CreateCategoryInput, context: AdminAuditContext): Promise<AdminCategoryDto> {
  const audit = requireAuditContext(context);
  const categoryId = await prisma.$transaction(async (transaction) => {
    await assertCategoryParent(input.parentId, undefined, transaction);
    await assertMediaKind(input.imageMediaId, 'IMAGE', transaction);
    const duplicate = await transaction.catalogCategory.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (duplicate) throw new ConflictError();
    const category = await transaction.catalogCategory.create({
      data: {
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(input.imageMediaId === undefined ? {} : { imageMediaId: input.imageMediaId }),
        slug: input.slug,
        name: input.name,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
        ...(input.seoTitle === undefined ? {} : { seoTitle: input.seoTitle }),
        ...(input.seoDescription === undefined ? {} : { seoDescription: input.seoDescription }),
        ...(input.canonicalUrl === undefined ? {} : { canonicalUrl: input.canonicalUrl }),
        ...(input.schemaData === undefined ? {} : { schemaData: jsonInput(input.schemaData) ?? Prisma.JsonNull }),
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.category.created', entityType: 'CatalogCategory', entityId: category.id, metadata: { slug: input.slug },
    }), transaction);
    return category.id;
  });
  const category = await pimRepository.findCategoryById(categoryId);
  if (!category) throw new NotFoundError();
  return toCategoryDto(category);
}

export async function updateAdminCategory(categoryId: string, input: UpdateCategoryInput, context: AdminAuditContext): Promise<AdminCategoryDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const existing = await pimRepository.findCategoryById(categoryId, transaction);
    if (!existing || existing.deletedAt) throw new NotFoundError();
    await assertCategoryParent(input.parentId, categoryId, transaction);
    await assertMediaKind(input.imageMediaId, 'IMAGE', transaction);
    if (input.slug !== undefined) {
      const duplicate = await transaction.catalogCategory.findFirst({ where: { id: { not: categoryId }, slug: input.slug }, select: { id: true } });
      if (duplicate) throw new ConflictError();
    }
    await transaction.catalogCategory.update({
      where: { id: categoryId },
      data: {
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(input.imageMediaId === undefined ? {} : { imageMediaId: input.imageMediaId }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
        ...(input.seoTitle === undefined ? {} : { seoTitle: input.seoTitle }),
        ...(input.seoDescription === undefined ? {} : { seoDescription: input.seoDescription }),
        ...(input.canonicalUrl === undefined ? {} : { canonicalUrl: input.canonicalUrl }),
        ...(input.schemaData === undefined ? {} : { schemaData: jsonInput(input.schemaData) ?? Prisma.JsonNull }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.category.updated', entityType: 'CatalogCategory', entityId: categoryId,
    }), transaction);
  });
  const category = await pimRepository.findCategoryById(categoryId);
  if (!category) throw new NotFoundError();
  return toCategoryDto(category);
}

export async function deleteAdminCategory(categoryId: string, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const category = await pimRepository.findCategoryById(categoryId, transaction);
    if (!category || category.deletedAt) throw new NotFoundError();
    if (category._count.children > 0 || category._count.products > 0) throw new ConflictError();
    await transaction.catalogCategory.update({ where: { id: categoryId }, data: { deletedAt: new Date(), isActive: false } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.category.archived', entityType: 'CatalogCategory', entityId: categoryId,
    }), transaction);
  });
}

export async function createAdminWarranty(input: CreateWarrantyInput, context: AdminAuditContext): Promise<AdminWarrantyDto> {
  const audit = requireAuditContext(context);
  const warrantyId = await prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.warranty.findUnique({ where: { code: input.code }, select: { id: true } });
    if (duplicate) throw new ConflictError();
    const warrantyData: Prisma.WarrantyUncheckedCreateInput = {
      code: input.code,
      provider: input.provider,
      name: input.name,
      durationMonths: input.durationMonths,
      ...(input.terms === undefined ? {} : { terms: input.terms }),
      ...(input.conditions === undefined ? {} : { conditions: input.conditions }),
      isActive: input.isActive,
    };
    const warranty = await transaction.warranty.create({ data: warrantyData, select: { id: true } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.warranty.created', entityType: 'Warranty', entityId: warranty.id, metadata: { code: input.code },
    }), transaction);
    return warranty.id;
  });
  const warranty = await pimRepository.findWarrantyById(warrantyId);
  if (!warranty) throw new NotFoundError();
  return toWarrantyDto(warranty);
}

export async function updateAdminWarranty(warrantyId: string, input: UpdateWarrantyInput, context: AdminAuditContext): Promise<AdminWarrantyDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const warranty = await pimRepository.findWarrantyById(warrantyId, transaction);
    if (!warranty || warranty.deletedAt) throw new NotFoundError();
    if (input.code !== undefined) {
      const duplicate = await transaction.warranty.findFirst({ where: { id: { not: warrantyId }, code: input.code }, select: { id: true } });
      if (duplicate) throw new ConflictError();
    }
    await transaction.warranty.update({
      where: { id: warrantyId },
      data: {
        ...(input.code === undefined ? {} : { code: input.code }),
        ...(input.provider === undefined ? {} : { provider: input.provider }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.durationMonths === undefined ? {} : { durationMonths: input.durationMonths }),
        ...(input.terms === undefined ? {} : { terms: input.terms }),
        ...(input.conditions === undefined ? {} : { conditions: input.conditions }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.warranty.updated', entityType: 'Warranty', entityId: warrantyId,
    }), transaction);
  });
  const warranty = await pimRepository.findWarrantyById(warrantyId);
  if (!warranty) throw new NotFoundError();
  return toWarrantyDto(warranty);
}

export async function deleteAdminWarranty(warrantyId: string, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const warranty = await pimRepository.findWarrantyById(warrantyId, transaction);
    if (!warranty || warranty.deletedAt) throw new NotFoundError();
    if (warranty._count.variants > 0) throw new ConflictError();
    await transaction.warranty.update({ where: { id: warrantyId }, data: { deletedAt: new Date(), isActive: false } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.warranty.archived', entityType: 'Warranty', entityId: warrantyId,
    }), transaction);
  });
}

export async function createAdminSpecificationGroup(input: CreateSpecificationGroupInput, context: AdminAuditContext): Promise<AdminSpecificationGroupDto> {
  const audit = requireAuditContext(context);
  const groupId = await prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.specificationGroup.findUnique({ where: { code: input.code }, select: { id: true } });
    if (duplicate) throw new ConflictError();
    const groupData: Prisma.SpecificationGroupUncheckedCreateInput = {
      code: input.code,
      name: input.name,
      ...(input.description === undefined ? {} : { description: input.description }),
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const group = await transaction.specificationGroup.create({ data: groupData, select: { id: true } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.specification-group.created', entityType: 'SpecificationGroup', entityId: group.id, metadata: { code: input.code },
    }), transaction);
    return group.id;
  });
  const record = await prisma.specificationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, code: true, name: true, description: true, sortOrder: true, isActive: true, updatedAt: true, _count: { select: { attributes: true } } },
  });
  if (!record) throw new NotFoundError();
  return toSpecificationGroupDto(record);
}

export async function createAdminProductAttribute(input: CreateProductAttributeInput, context: AdminAuditContext): Promise<AdminProductAttributeDto> {
  const audit = requireAuditContext(context);
  const attributeId = await prisma.$transaction(async (transaction) => {
    if (input.groupId) {
      const group = await transaction.specificationGroup.findFirst({ where: { id: input.groupId, isActive: true, deletedAt: null }, select: { id: true } });
      if (!group) throw new ValidationError({ groupId: 'Specification group is unavailable.' });
    }
    const duplicate = await transaction.productAttribute.findUnique({ where: { code: input.code }, select: { id: true } });
    if (duplicate) throw new ConflictError();
    const attributeData: Prisma.ProductAttributeUncheckedCreateInput = {
      ...(input.groupId === undefined ? {} : { groupId: input.groupId }),
      code: input.code,
      name: input.name,
      valueType: input.valueType,
      ...(input.unitCode === undefined ? {} : { unitCode: input.unitCode }),
      ...(input.description === undefined ? {} : { description: input.description }),
      isFilterable: input.isFilterable,
      isSearchable: input.isSearchable,
      isRequiredDefault: input.isRequiredDefault,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    const attribute = await transaction.productAttribute.create({ data: attributeData, select: { id: true } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.attribute.created', entityType: 'ProductAttribute', entityId: attribute.id, metadata: { code: input.code, valueType: input.valueType },
    }), transaction);
    return attribute.id;
  });
  const record = await prisma.productAttribute.findUnique({
    where: { id: attributeId },
    select: { id: true, groupId: true, code: true, name: true, valueType: true, unitCode: true, isFilterable: true, isSearchable: true, isRequiredDefault: true, sortOrder: true, isActive: true, updatedAt: true, _count: { select: { values: true } } },
  });
  if (!record) throw new NotFoundError();
  return toProductAttributeDto(record);
}

export async function updateAdminSpecificationGroup(
  groupId: string,
  input: UpdateSpecificationGroupInput,
  context: AdminAuditContext,
): Promise<AdminSpecificationGroupDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const group = await transaction.specificationGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw new NotFoundError();
    if (input.code !== undefined) {
      const duplicate = await transaction.specificationGroup.findFirst({
        where: { id: { not: groupId }, code: input.code },
        select: { id: true },
      });
      if (duplicate) throw new ConflictError();
    }
    const data: Prisma.SpecificationGroupUncheckedUpdateInput = {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };
    await transaction.specificationGroup.update({ where: { id: groupId }, data });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.specification-group.updated', entityType: 'SpecificationGroup', entityId: groupId,
    }), transaction);
  });
  const record = await prisma.specificationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, code: true, name: true, description: true, sortOrder: true, isActive: true, updatedAt: true, _count: { select: { attributes: true } } },
  });
  if (!record) throw new NotFoundError();
  return toSpecificationGroupDto(record);
}

export async function deleteAdminSpecificationGroup(groupId: string, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const group = await transaction.specificationGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true, _count: { select: { attributes: true, categories: true, categoryAttributes: true } } },
    });
    if (!group) throw new NotFoundError();
    if (group._count.attributes > 0 || group._count.categories > 0 || group._count.categoryAttributes > 0) throw new ConflictError();
    await transaction.specificationGroup.update({ where: { id: groupId }, data: { deletedAt: new Date(), isActive: false } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.specification-group.archived', entityType: 'SpecificationGroup', entityId: groupId,
    }), transaction);
  });
}

export async function updateAdminProductAttribute(
  attributeId: string,
  input: UpdateProductAttributeInput,
  context: AdminAuditContext,
): Promise<AdminProductAttributeDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const attribute = await transaction.productAttribute.findFirst({
      where: { id: attributeId, deletedAt: null },
      select: { id: true },
    });
    if (!attribute) throw new NotFoundError();
    if (input.groupId !== undefined && input.groupId !== null) {
      const group = await transaction.specificationGroup.findFirst({
        where: { id: input.groupId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new ValidationError({ groupId: 'Specification group is unavailable.' });
    }
    if (input.code !== undefined) {
      const duplicate = await transaction.productAttribute.findFirst({
        where: { id: { not: attributeId }, code: input.code },
        select: { id: true },
      });
      if (duplicate) throw new ConflictError();
    }
    const data: Prisma.ProductAttributeUncheckedUpdateInput = {
      ...(input.groupId === undefined ? {} : { groupId: input.groupId }),
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.valueType === undefined ? {} : { valueType: input.valueType }),
      ...(input.unitCode === undefined ? {} : { unitCode: input.unitCode }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.isFilterable === undefined ? {} : { isFilterable: input.isFilterable }),
      ...(input.isSearchable === undefined ? {} : { isSearchable: input.isSearchable }),
      ...(input.isRequiredDefault === undefined ? {} : { isRequiredDefault: input.isRequiredDefault }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };
    await transaction.productAttribute.update({ where: { id: attributeId }, data });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.attribute.updated', entityType: 'ProductAttribute', entityId: attributeId,
    }), transaction);
  });
  const record = await prisma.productAttribute.findUnique({
    where: { id: attributeId },
    select: { id: true, groupId: true, code: true, name: true, valueType: true, unitCode: true, isFilterable: true, isSearchable: true, isRequiredDefault: true, sortOrder: true, isActive: true, updatedAt: true, _count: { select: { values: true } } },
  });
  if (!record) throw new NotFoundError();
  return toProductAttributeDto(record);
}

export async function deleteAdminProductAttribute(attributeId: string, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const attribute = await transaction.productAttribute.findFirst({
      where: { id: attributeId, deletedAt: null },
      select: { id: true, _count: { select: { values: true, categoryAssignments: true, specifications: true } } },
    });
    if (!attribute) throw new NotFoundError();
    if (attribute._count.values > 0 || attribute._count.categoryAssignments > 0 || attribute._count.specifications > 0) throw new ConflictError();
    await transaction.productAttribute.update({ where: { id: attributeId }, data: { deletedAt: new Date(), isActive: false } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.attribute.archived', entityType: 'ProductAttribute', entityId: attributeId,
    }), transaction);
  });
}

export async function createAdminAttributeValue(input: CreateAttributeValueInput, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const attribute = await pimRepository.findActiveAttribute(input.attributeId, transaction);
    if (!attribute) throw new ValidationError({ attributeId: 'Attribute is unavailable.' });
    const duplicate = await transaction.attributeValue.findUnique({ where: { attributeId_code: { attributeId: input.attributeId, code: input.code } }, select: { id: true } });
    if (duplicate) throw new ConflictError();
    const value = await transaction.attributeValue.create({
      data: {
        attributeId: input.attributeId,
        code: input.code,
        label: input.label,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        ...(input.metadata === undefined ? {} : { metadata: jsonInput(input.metadata) ?? Prisma.JsonNull }),
      },
      select: { id: true },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.attribute-value.created', entityType: 'AttributeValue', entityId: value.id, metadata: { attributeId: input.attributeId, code: input.code },
    }), transaction);
  });
}

export async function assignAdminCategoryAttribute(categoryId: string, input: CategoryAttributeAssignmentInput, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    await assertActiveCategory(categoryId, transaction);
    const attribute = await pimRepository.findActiveAttribute(input.attributeId, transaction);
    if (!attribute) throw new ValidationError({ attributeId: 'Attribute is unavailable.' });
    if (input.groupId) {
      const group = await transaction.specificationGroup.findFirst({ where: { id: input.groupId, isActive: true, deletedAt: null }, select: { id: true } });
      if (!group) throw new ValidationError({ groupId: 'Specification group is unavailable.' });
    }
    await transaction.categoryAttribute.upsert({
      where: { categoryId_attributeId: { categoryId, attributeId: input.attributeId } },
      create: { categoryId, attributeId: input.attributeId, ...(input.groupId === undefined ? {} : { groupId: input.groupId }), isRequired: input.isRequired, isFilterable: input.isFilterable, sortOrder: input.sortOrder },
      update: { ...(input.groupId === undefined ? {} : { groupId: input.groupId }), isRequired: input.isRequired, isFilterable: input.isFilterable, sortOrder: input.sortOrder },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.category-attribute.assigned', entityType: 'CatalogCategory', entityId: categoryId, metadata: { attributeId: input.attributeId },
    }), transaction);
  });
}

async function validateVariantInput(input: ProductVariantInput, client: Transaction): Promise<void> {
  await assertWarranty(input.warrantyId, client);
  if (input.costRials !== null && input.costRials !== undefined && input.costRials > input.priceRials) {
    throw new ValidationError({ costRials: 'Cost cannot exceed the approved selling price.' });
  }
}

function variantOptionKey(input: Pick<ProductVariantInput, 'skuCode' | 'color' | 'storage' | 'region' | 'modelNumber' | 'optionKey'>): string {
  if (input.optionKey) return input.optionKey.trim().toLocaleLowerCase('en-US');
  const options = [input.color, input.storage, input.region, input.modelNumber]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLocaleLowerCase('en-US'));
  return options.length > 0 ? options.join('|') : `sku:${input.skuCode.toLocaleLowerCase('en-US')}`;
}

function assertUniqueVariantOptions(variants: readonly ProductVariantInput[]): void {
  const keys = variants.map(variantOptionKey);
  if (new Set(keys).size !== keys.length) {
    throw new ValidationError({ variants: 'Each product variant must have a unique option combination.' });
  }
}

function variantCreateData(input: ProductVariantInput): Prisma.CatalogVariantCreateWithoutProductInput {
  return {
    sku: input.skuCode,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.color === undefined ? {} : { color: input.color }),
    ...(input.storage === undefined ? {} : { storage: input.storage }),
    ...(input.region === undefined ? {} : { region: input.region }),
    ...(input.modelNumber === undefined ? {} : { modelNumber: input.modelNumber }),
    optionKey: variantOptionKey(input),
    ...(input.warrantyId === undefined || input.warrantyId === null ? {} : { warrantyRecord: { connect: { id: input.warrantyId } } }),
    ...(input.warranty === undefined ? {} : { warranty: input.warranty }),
    priceRials: input.priceRials,
    ...(input.compareAtPriceRials === undefined ? {} : { compareAtPriceRials: input.compareAtPriceRials }),
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    skuRecord: {
      create: {
        code: input.skuCode,
        ...(input.barcode === undefined ? {} : { barcode: input.barcode }),
        priceRials: input.priceRials,
        ...(input.compareAtPriceRials === undefined ? {} : { compareAtPriceRials: input.compareAtPriceRials }),
        ...(input.costRials === undefined ? {} : { costRials: input.costRials }),
        status: input.status,
      },
    },
  };
}

async function assertProductSlugAvailable(slug: string, excludedId: string | undefined, client: Transaction): Promise<void> {
  const duplicate = await client.catalogProduct.findFirst({
    where: { slug, ...(excludedId === undefined ? {} : { id: { not: excludedId } }) },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError();
}

export async function createAdminProduct(input: CreateProductInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  // Route handlers validate this already, but services are also called by
  // import and trusted internal workflows. Parse here so Zod defaults for
  // variants, specifications, flags, scope, and sort order are never skipped.
  const productInput = createProductInput.parse(input);
  const audit = requireAuditContext(context);
  const productId = await prisma.$transaction(async (transaction) => {
    await assertActiveCategory(productInput.categoryId, transaction);
    const brand = await activeBrandName(productInput.brandId, transaction);
    await assertProductSlugAvailable(productInput.slug, undefined, transaction);
    await Promise.all(productInput.variants.map((variant) => validateVariantInput(variant, transaction)));
    assertUniqueVariantOptions(productInput.variants);

    const productData: Prisma.CatalogProductCreateInput = {
        ...(productInput.categoryId === undefined || productInput.categoryId === null ? {} : { category: { connect: { id: productInput.categoryId } } }),
        ...(productInput.brandId === undefined || productInput.brandId === null ? {} : { brandRecord: { connect: { id: productInput.brandId } } }),
        slug: productInput.slug,
        name: productInput.name,
        brand: brand?.name ?? 'Apple',
        searchText: buildProductSearchText({
          name: productInput.name,
          slug: productInput.slug,
          brand: brand?.name ?? 'Apple',
          skuCodes: productInput.variants.map((variant) => variant.skuCode),
          specificationValues: productInput.specifications.map((specification) => specification.displayValue),
        }),
        ...(productInput.summary === undefined ? {} : { summary: productInput.summary }),
        ...(productInput.description === undefined ? {} : { description: productInput.description }),
        isFeatured: productInput.isFeatured,
        ...(productInput.featuredRank === undefined ? {} : { featuredRank: productInput.featuredRank }),
        isNew: productInput.isNew,
        isOnSale: productInput.isOnSale,
        ...(productInput.seo === undefined ? {} : {
          ...(productInput.seo.metaTitle === undefined ? {} : { seoTitle: productInput.seo.metaTitle }),
          ...(productInput.seo.metaDescription === undefined ? {} : { seoDescription: productInput.seo.metaDescription }),
          seo: {
            create: {
              ...(productInput.seo.metaTitle === undefined ? {} : { metaTitle: productInput.seo.metaTitle }),
              ...(productInput.seo.metaDescription === undefined ? {} : { metaDescription: productInput.seo.metaDescription }),
              ...(productInput.seo.canonicalUrl === undefined ? {} : { canonicalUrl: productInput.seo.canonicalUrl }),
              ...(productInput.seo.schemaData === undefined ? {} : { schemaData: jsonInput(productInput.seo.schemaData) ?? Prisma.JsonNull }),
              noIndex: productInput.seo.noIndex ?? false,
            },
          },
        }),
        variants: { create: productInput.variants.map(variantCreateData) },
      };
    const product = await transaction.catalogProduct.create({
      data: productData,
      select: { id: true, variants: { select: { id: true, sku: true } } },
    });

    const specificationRows = await resolveSpecificationTargets(product.id, productInput.categoryId ?? null, product.variants, productInput.specifications, transaction);
    if (specificationRows.length > 0) await transaction.productSpecification.createMany({ data: specificationRows });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product.created', entityType: 'CatalogProduct', entityId: product.id,
      metadata: { slug: productInput.slug, variantCount: productInput.variants.length, specificationCount: productInput.specifications.length },
    }), transaction);
    return product.id;
  });
  return getAdminProduct(productId);
}

export async function updateAdminProduct(productId: string, input: UpdateProductInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const product = await pimRepository.findProductWorkflowState(productId, transaction);
    if (!product || product.deletedAt) throw new NotFoundError();
    assertVersion(input.version, product.version);
    await assertActiveCategory(input.categoryId, transaction);
    const brand = await activeBrandName(input.brandId, transaction);
    if (input.slug !== undefined) await assertProductSlugAvailable(input.slug, productId, transaction);

    const productData: Prisma.CatalogProductUpdateInput = {
        ...(input.categoryId === undefined ? {} : { category: input.categoryId === null ? { disconnect: true } : { connect: { id: input.categoryId } } }),
        ...(input.brandId === undefined ? {} : { brandRecord: input.brandId === null ? { disconnect: true } : { connect: { id: input.brandId } } }),
        ...(brand ? { brand: brand.name } : {}),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.summary === undefined ? {} : { summary: input.summary }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.isFeatured === undefined ? {} : { isFeatured: input.isFeatured }),
        ...(input.featuredRank === undefined ? {} : { featuredRank: input.featuredRank }),
        ...(input.isNew === undefined ? {} : { isNew: input.isNew }),
        ...(input.isOnSale === undefined ? {} : { isOnSale: input.isOnSale }),
        ...(input.seo === undefined ? {} : {
          ...(input.seo.metaTitle === undefined ? {} : { seoTitle: input.seo.metaTitle }),
          ...(input.seo.metaDescription === undefined ? {} : { seoDescription: input.seo.metaDescription }),
          seo: {
            upsert: {
              create: {
                ...(input.seo.metaTitle === undefined ? {} : { metaTitle: input.seo.metaTitle }),
                ...(input.seo.metaDescription === undefined ? {} : { metaDescription: input.seo.metaDescription }),
                ...(input.seo.canonicalUrl === undefined ? {} : { canonicalUrl: input.seo.canonicalUrl }),
                ...(input.seo.schemaData === undefined ? {} : { schemaData: jsonInput(input.seo.schemaData) ?? Prisma.JsonNull }),
                noIndex: input.seo.noIndex ?? false,
              },
              update: {
                ...(input.seo.metaTitle === undefined ? {} : { metaTitle: input.seo.metaTitle }),
                ...(input.seo.metaDescription === undefined ? {} : { metaDescription: input.seo.metaDescription }),
                ...(input.seo.canonicalUrl === undefined ? {} : { canonicalUrl: input.seo.canonicalUrl }),
                ...(input.seo.schemaData === undefined ? {} : { schemaData: jsonInput(input.seo.schemaData) ?? Prisma.JsonNull }),
                ...(input.seo.noIndex === undefined ? {} : { noIndex: input.seo.noIndex }),
              },
            },
          },
        }),
        ...(input.name === undefined && input.slug === undefined && input.brandId === undefined ? {} : {
          searchText: buildProductSearchText({
            name: input.name ?? product.name,
            slug: input.slug ?? product.slug,
            brand: brand?.name ?? product.brand,
            skuCodes: product.variants.flatMap((variant) => [variant.sku, ...(variant.skuRecord ? [variant.skuRecord.code] : [])]),
          }),
        }),
    };
    await claimProductVersion(productId, transaction, input.version);
    await transaction.catalogProduct.update({ where: { id: productId }, data: productData });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product.updated', entityType: 'CatalogProduct', entityId: productId, metadata: { previousVersion: product.version },
    }), transaction);
  });
  return getAdminProduct(productId);
}

export async function createAdminProductVariant(productId: string, input: ProductVariantInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const product = await pimRepository.findProductWorkflowState(productId, transaction);
    if (!product || product.deletedAt) throw new NotFoundError();
    await validateVariantInput(input, transaction);
    const duplicate = await transaction.catalogVariant.findUnique({ where: { sku: input.skuCode }, select: { id: true } });
    if (duplicate) throw new ConflictError();
    const nextOptionKey = variantOptionKey(input);
    if (product.variants.some((variant) => !variant.deletedAt && variant.optionKey === nextOptionKey)) {
      throw new ConflictError();
    }
    const variantData: Prisma.CatalogVariantCreateInput = {
      ...variantCreateData(input),
      product: { connect: { id: productId } },
    };
    const variant = await transaction.catalogVariant.create({ data: variantData, select: { id: true } });
    await transaction.catalogProduct.update({
      where: { id: productId },
      data: {
        version: { increment: 1 },
        searchText: buildProductSearchText({
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          skuCodes: [...product.variants.flatMap((item) => [item.sku, ...(item.skuRecord ? [item.skuRecord.code] : [])]), input.skuCode],
        }),
      },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product-variant.created', entityType: 'CatalogVariant', entityId: variant.id, metadata: { productId, sku: input.skuCode },
    }), transaction);
  });
  return getAdminProduct(productId);
}

export async function updateAdminProductVariant(productId: string, variantId: string, input: UpdateProductVariantInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const variant = await pimRepository.findVariant(productId, variantId, transaction);
    if (!variant || variant.deletedAt || !variant.skuRecord) throw new NotFoundError();
    assertVersion(input.version, variant.version);
    const merged: ProductVariantInput = {
      skuCode: input.skuCode ?? variant.sku,
      barcode: input.barcode ?? variant.skuRecord.barcode,
      title: input.title ?? variant.title,
      color: input.color ?? variant.color,
      storage: input.storage ?? variant.storage,
      region: input.region ?? variant.region,
      modelNumber: input.modelNumber ?? variant.modelNumber,
      optionKey: input.optionKey ?? variant.optionKey,
      warrantyId: input.warrantyId ?? variant.warrantyId,
      warranty: input.warranty ?? variant.warranty,
      priceRials: input.priceRials ?? variant.skuRecord.priceRials,
      compareAtPriceRials: input.compareAtPriceRials ?? variant.skuRecord.compareAtPriceRials,
      costRials: input.costRials ?? variant.skuRecord.costRials,
      status: input.status ?? variant.skuRecord.status,
      isActive: input.isActive ?? variant.isActive,
      sortOrder: input.sortOrder ?? 0,
    };
    await validateVariantInput(merged, transaction);
    const nextOptionKey = variantOptionKey(merged);
    if (input.skuCode !== undefined) {
      const duplicate = await transaction.catalogVariant.findFirst({ where: { id: { not: variantId }, sku: input.skuCode }, select: { id: true } });
      if (duplicate) throw new ConflictError();
    }
    const optionDuplicate = await transaction.catalogVariant.findFirst({
      where: { id: { not: variantId }, productId, optionKey: nextOptionKey, deletedAt: null },
      select: { id: true },
    });
    if (optionDuplicate) throw new ConflictError();
    await claimVariantVersion(productId, variantId, input.version, transaction);
    await transaction.catalogVariant.update({
      where: { id: variantId },
      data: {
        ...(input.skuCode === undefined ? {} : { sku: input.skuCode }),
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.storage === undefined ? {} : { storage: input.storage }),
        ...(input.region === undefined ? {} : { region: input.region }),
        ...(input.modelNumber === undefined ? {} : { modelNumber: input.modelNumber }),
        optionKey: nextOptionKey,
        ...(input.warrantyId === undefined ? {} : { warrantyId: input.warrantyId }),
        ...(input.warranty === undefined ? {} : { warranty: input.warranty }),
        ...(input.priceRials === undefined ? {} : { priceRials: input.priceRials }),
        ...(input.compareAtPriceRials === undefined ? {} : { compareAtPriceRials: input.compareAtPriceRials }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
    });
    const skuUpdate = await transaction.productSku.updateMany({
      where: { variantId, version: variant.skuRecord.version, deletedAt: null },
      data: {
        ...(input.skuCode === undefined ? {} : { code: input.skuCode }),
        ...(input.barcode === undefined ? {} : { barcode: input.barcode }),
        ...(input.priceRials === undefined ? {} : { priceRials: input.priceRials }),
        ...(input.compareAtPriceRials === undefined ? {} : { compareAtPriceRials: input.compareAtPriceRials }),
        ...(input.costRials === undefined ? {} : { costRials: input.costRials }),
        ...(input.status === undefined ? {} : { status: input.status }),
        version: { increment: 1 },
      },
    });
    if (skuUpdate.count !== 1) throw new ConflictError();
    await claimProductVersion(productId, transaction);
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product-variant.updated', entityType: 'CatalogVariant', entityId: variantId, metadata: { productId, previousVersion: variant.version },
    }), transaction);
  });
  return getAdminProduct(productId);
}

export async function deleteAdminProductVariant(productId: string, variantId: string, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const variant = await pimRepository.findVariant(productId, variantId, transaction);
    if (!variant || variant.deletedAt) throw new NotFoundError();
    const [inventoryCount, cartCount] = await Promise.all([
      transaction.branchInventory.count({ where: { variantId } }),
      transaction.storefrontCartItem.count({ where: { variantId } }),
    ]);
    if (inventoryCount > 0 || cartCount > 0) {
      await transaction.catalogVariant.update({ where: { id: variantId }, data: { isActive: false, deletedAt: new Date(), version: { increment: 1 } } });
      if (variant.skuRecord) await transaction.productSku.update({ where: { variantId }, data: { status: 'DISCONTINUED', deletedAt: new Date(), version: { increment: 1 } } });
    } else {
      await transaction.catalogVariant.update({ where: { id: variantId }, data: { isActive: false, deletedAt: new Date(), version: { increment: 1 } } });
      if (variant.skuRecord) await transaction.productSku.update({ where: { variantId }, data: { status: 'DISCONTINUED', deletedAt: new Date(), version: { increment: 1 } } });
    }
    await transaction.catalogProduct.update({ where: { id: productId }, data: { version: { increment: 1 } } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product-variant.archived', entityType: 'CatalogVariant', entityId: variantId, metadata: { productId, inventoryCount, cartCount },
    }), transaction);
  });
}

export async function addAdminProductSpecifications(productId: string, specifications: readonly ProductSpecificationInput[], context: AdminAuditContext): Promise<AdminProductDetailDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const product = await transaction.catalogProduct.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true, categoryId: true, variants: { select: { id: true, sku: true } } },
    });
    if (!product) throw new NotFoundError();
    const rows = await resolveSpecificationTargets(productId, product.categoryId, product.variants, specifications, transaction);
    for (const row of rows) {
      const updateData: Prisma.ProductSpecificationUncheckedUpdateInput = {
        variantId: row.variantId ?? null,
        attributeValueId: row.attributeValueId ?? null,
        scope: row.scope,
        ...(row.value === undefined ? {} : { value: row.value }),
        displayValue: row.displayValue,
        ...(row.unitCode === undefined ? {} : { unitCode: row.unitCode }),
        ...(row.sortOrder === undefined ? {} : { sortOrder: row.sortOrder }),
      };
      await transaction.productSpecification.upsert({
        where: { productId_subjectKey_attributeId: { productId: row.productId, subjectKey: row.subjectKey, attributeId: row.attributeId } },
        create: row,
        update: updateData,
      });
    }
    await transaction.catalogProduct.update({ where: { id: productId }, data: { version: { increment: 1 } } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product-specifications.upserted', entityType: 'CatalogProduct', entityId: productId, metadata: { count: rows.length },
    }), transaction);
  });
  return getAdminProduct(productId);
}

export async function addAdminProductMedia(productId: string, input: ProductMediaInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const product = await transaction.catalogProduct.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true } });
    if (!product) throw new NotFoundError();
    // This product-level mutation serializes all HERO changes: PostgreSQL holds
    // the row lock until the gallery demotion and HERO upsert commit together.
    await claimProductVersion(productId, transaction);
    const expectedKind = input.role === 'VIDEO' ? 'VIDEO' : 'IMAGE';
    await assertMediaKind(input.mediaId, expectedKind, transaction);
    if (input.variantId) {
      const variant = await transaction.catalogVariant.findFirst({ where: { id: input.variantId, productId, deletedAt: null }, select: { id: true } });
      if (!variant) throw new ValidationError({ variantId: 'Variant does not belong to this product.' });
    }
    if (input.role === 'HERO') {
      await transaction.productMedia.updateMany({ where: { productId, role: 'HERO' }, data: { role: 'GALLERY' } });
    }
    await transaction.productMedia.upsert({
      where: { productId_mediaId: { productId, mediaId: input.mediaId } },
      create: {
        productId,
        mediaId: input.mediaId,
        ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
        role: input.role,
        ...(input.altText === undefined ? {} : { altText: input.altText }),
        ...(input.caption === undefined ? {} : { caption: input.caption }),
        sortOrder: input.sortOrder,
      },
      update: {
        ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
        role: input.role,
        ...(input.altText === undefined ? {} : { altText: input.altText }),
        ...(input.caption === undefined ? {} : { caption: input.caption }),
        sortOrder: input.sortOrder,
      },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product-media.upserted', entityType: 'CatalogProduct', entityId: productId, metadata: { mediaId: input.mediaId, role: input.role },
    }), transaction);
  });
  return getAdminProduct(productId);
}

export async function deleteAdminProductMedia(productId: string, mediaId: string, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const result = await transaction.productMedia.deleteMany({ where: { productId, mediaId } });
    if (result.count === 0) throw new NotFoundError();
    await transaction.catalogProduct.update({ where: { id: productId }, data: { version: { increment: 1 } } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product-media.deleted', entityType: 'CatalogProduct', entityId: productId, metadata: { mediaId },
    }), transaction);
  });
}

type WorkflowTarget = 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

async function assertPublishable(productId: string, client: Transaction): Promise<void> {
  const product = await pimRepository.findProductWorkflowState(productId, client);
  if (!product || product.deletedAt) throw new NotFoundError();
  if (!product.category || !product.category.isActive || product.category.deletedAt) throw new ValidationError({ categoryId: 'Published products require an active category.' });
  if (!product.brandRecord || product.brandRecord.status !== 'ACTIVE' || product.brandRecord.deletedAt) throw new ValidationError({ brandId: 'Published products require an active brand.' });
  const hasSellableSku = product.variants.some((variant) => variant.isActive && !variant.deletedAt && variant.skuRecord && !variant.skuRecord.deletedAt && variant.skuRecord.status === 'ACTIVE' && variant.skuRecord.priceRials > 0n);
  if (!hasSellableSku) throw new ValidationError({ variants: 'Published products require at least one active SKU with a positive price.' });
}

async function transitionProduct(productId: string, target: WorkflowTarget, input: ProductWorkflowInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const product = await pimRepository.findProductWorkflowState(productId, transaction);
    if (!product || product.deletedAt) throw new NotFoundError();
    assertVersion(input.version, product.version);
    const allowed = target === 'REVIEW'
      ? product.status === 'DRAFT' || product.status === 'PUBLISHED'
      : target === 'PUBLISHED'
        ? product.status === 'REVIEW'
        : product.status !== 'ARCHIVED';
    if (!allowed) throw new ConflictError();
    if (target === 'REVIEW' || target === 'PUBLISHED') await assertPublishable(productId, transaction);
    const now = new Date();
    const update = {
      status: target,
      ...(target === 'REVIEW' ? { submittedForReviewAt: now } : {}),
      ...(target === 'PUBLISHED' ? { approvedAt: now, approvedById: audit.actorId, publishedAt: now } : {}),
    } satisfies Prisma.CatalogProductUpdateInput;
    await claimProductVersion(productId, transaction, input.version);
    await transaction.catalogProduct.update({ where: { id: productId }, data: update });
    await transaction.productWorkflowEvent.create({
      data: { productId, actorId: audit.actorId, fromStatus: product.status, toStatus: target, ...(input.note === undefined ? {} : { note: input.note }), revision: product.version + 1 },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: `pim.product.${target.toLowerCase()}`, entityType: 'CatalogProduct', entityId: productId, metadata: { fromStatus: product.status, toStatus: target, revision: product.version + 1 },
    }), transaction);
  });
  return getAdminProduct(productId);
}

export function submitAdminProductForReview(productId: string, input: ProductWorkflowInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  return transitionProduct(productId, 'REVIEW', input, context);
}

export function publishAdminProduct(productId: string, input: ProductWorkflowInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  return transitionProduct(productId, 'PUBLISHED', input, context);
}

export function archiveAdminProduct(productId: string, input: ProductWorkflowInput, context: AdminAuditContext): Promise<AdminProductDetailDto> {
  return transitionProduct(productId, 'ARCHIVED', input, context);
}

export async function deleteAdminProduct(productId: string, input: ProductWorkflowInput, context: AdminAuditContext): Promise<void> {
  const audit = requireAuditContext(context);
  await prisma.$transaction(async (transaction) => {
    const product = await pimRepository.findProductWorkflowState(productId, transaction);
    if (!product || product.deletedAt) throw new NotFoundError();
    assertVersion(input.version, product.version);
    await claimProductVersion(productId, transaction, input.version);
    await transaction.catalogProduct.update({ where: { id: productId }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
    await transaction.productWorkflowEvent.create({ data: { productId, actorId: audit.actorId, fromStatus: product.status, toStatus: 'ARCHIVED', ...(input.note === undefined ? {} : { note: input.note }), revision: product.version + 1 } });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product.soft-deleted', entityType: 'CatalogProduct', entityId: productId, metadata: { fromStatus: product.status, revision: product.version + 1 },
    }), transaction);
  });
}

function importString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value.trim() || undefined : typeof value === 'number' ? String(value) : undefined;
}

function importNullableString(data: Record<string, unknown>, key: string): string | null | undefined {
  const value = data[key];
  if (value === null) return null;
  return importString(data, key);
}

function parseImportProduct(data: Record<string, unknown>) {
  const candidate = {
    name: importString(data, 'name'),
    slug: importString(data, 'slug'),
    brandId: importNullableString(data, 'brandId'),
    categoryId: importNullableString(data, 'categoryId'),
    summary: importNullableString(data, 'summary'),
    description: importNullableString(data, 'description'),
    variants: [{
      skuCode: importString(data, 'skuCode') ?? importString(data, 'sku'),
      barcode: importNullableString(data, 'barcode'),
      title: importNullableString(data, 'variantTitle'),
      color: importNullableString(data, 'color'),
      storage: importNullableString(data, 'storage'),
      region: importNullableString(data, 'region'),
      modelNumber: importNullableString(data, 'modelNumber'),
      warrantyId: importNullableString(data, 'warrantyId'),
      priceRials: importString(data, 'priceRials') ?? importString(data, 'price'),
      compareAtPriceRials: importNullableString(data, 'compareAtPriceRials'),
      costRials: importNullableString(data, 'costRials'),
    }],
  };
  return createProductInput.safeParse(candidate);
}

function serializableImportInput(input: CreateProductInput): Prisma.InputJsonValue {
  return {
    ...input,
    variants: input.variants.map((variant) => ({
      ...variant,
      priceRials: variant.priceRials.toString(),
      ...(variant.compareAtPriceRials === undefined || variant.compareAtPriceRials === null ? {} : { compareAtPriceRials: variant.compareAtPriceRials.toString() }),
      ...(variant.costRials === undefined || variant.costRials === null ? {} : { costRials: variant.costRials.toString() }),
    })),
  } as Prisma.InputJsonValue;
}

function importErrors(result: ReturnType<typeof parseImportProduct>): readonly string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function duplicateImportValues(values: readonly string[]): ReadonlySet<string> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return new Set([...counts].flatMap(([value, count]) => count > 1 ? [value] : []));
}

function addImportSkuOwner(
  owners: Map<string, Set<string>>,
  skuCode: string | null | undefined,
  productSlug: string,
): void {
  if (!skuCode) return;
  const skuOwners = owners.get(skuCode) ?? new Set<string>();
  skuOwners.add(productSlug);
  owners.set(skuCode, skuOwners);
}

function validateImportReferences(input: Readonly<{
  product: CreateProductInput;
  existingProducts: ReadonlyMap<string, Readonly<{ deletedAt: Date | null; status: string }>>;
  existingSkuOwners: ReadonlyMap<string, ReadonlySet<string>>;
  duplicateSlugs: ReadonlySet<string>;
  duplicateSkuCodes: ReadonlySet<string>;
  activeCategoryIds: ReadonlySet<string>;
  activeBrandIds: ReadonlySet<string>;
  activeWarrantyIds: ReadonlySet<string>;
}>): readonly string[] {
  const messages: string[] = [];
  const existingProduct = input.existingProducts.get(input.product.slug);

  if (input.duplicateSlugs.has(input.product.slug)) messages.push('Duplicate slug within this import.');

  if (!input.product.categoryId) {
    messages.push('A category is required for every imported product.');
  } else if (!input.activeCategoryIds.has(input.product.categoryId)) {
    messages.push('Category is inactive or unavailable.');
  }
  if (!input.product.brandId) {
    messages.push('A brand is required for every imported product.');
  } else if (!input.activeBrandIds.has(input.product.brandId)) {
    messages.push('Brand is inactive or unavailable.');
  }
  if (existingProduct && (existingProduct.deletedAt || existingProduct.status === 'ARCHIVED')) {
    messages.push('The imported slug belongs to an archived product.');
  }
  if (existingProduct && !existingProduct.deletedAt && existingProduct.status !== 'ARCHIVED') {
    // Phase 04.1 only applies complete product creates. Treating an existing
    // product as an update would silently ignore variant, SKU, price, and
    // relationship changes until a full reviewed upsert contract exists.
    messages.push('Update imports are not supported; use a new product slug.');
  }

  for (const variant of input.product.variants) {
    if (input.duplicateSkuCodes.has(variant.skuCode)) messages.push('Duplicate SKU within this import.');
    if (!variant.warrantyId) {
      messages.push('A warranty is required for every imported SKU.');
    } else if (!input.activeWarrantyIds.has(variant.warrantyId)) {
      messages.push('Warranty is inactive or unavailable.');
    }

    const ownerSlugs = input.existingSkuOwners.get(variant.skuCode);
    if (existingProduct) {
      if (!ownerSlugs?.has(input.product.slug)) {
        messages.push('The SKU does not belong to the existing product.');
      }
    } else if (ownerSlugs && ownerSlugs.size > 0) {
      messages.push('The SKU is already assigned to another product.');
    }
  }

  return [...new Set(messages)];
}

export async function previewAdminProductImport(input: ProductImportPreviewInput, context: AdminAuditContext): Promise<ProductImportPreviewDto> {
  const audit = requireAuditContext(context);
  const batch = await prisma.$transaction(async (transaction) => {
    if (input.sourceFileId) {
      const source = await pimRepository.findMediaForAssociation(input.sourceFileId, transaction);
      if (!source || source.kind !== 'DOCUMENT') throw new ValidationError({ sourceFileId: 'Import source file is unavailable.' });
    }
    const parsedRows = input.rows.map((row) => ({ row, parsed: parseImportProduct(row.data) }));
    const normalizedProducts = parsedRows.flatMap(({ parsed }) => parsed.success ? [parsed.data] : []);
    const candidateSlugs = [...new Set(normalizedProducts.map((product) => product.slug))];
    const candidateSkuCodes = [...new Set(normalizedProducts.flatMap((product) => product.variants.map((variant) => variant.skuCode)))];
    const categoryIds = [...new Set(normalizedProducts.flatMap((product) => product.categoryId ? [product.categoryId] : []))];
    const brandIds = [...new Set(normalizedProducts.flatMap((product) => product.brandId ? [product.brandId] : []))];
    const warrantyIds = [...new Set(normalizedProducts.flatMap((product) => product.variants.flatMap((variant) => variant.warrantyId ? [variant.warrantyId] : [])))];
    const [existingProducts, existingVariants, activeCategories, activeBrands, activeWarranties] = await Promise.all([
      transaction.catalogProduct.findMany({
        where: { slug: { in: candidateSlugs } },
        select: { slug: true, deletedAt: true, status: true },
      }),
      transaction.catalogVariant.findMany({
        where: {
          OR: [
            { sku: { in: candidateSkuCodes } },
            { skuRecord: { is: { code: { in: candidateSkuCodes } } } },
          ],
        },
        select: { sku: true, skuRecord: { select: { code: true } }, product: { select: { slug: true } } },
      }),
      transaction.catalogCategory.findMany({
        where: { id: { in: categoryIds }, isActive: true, deletedAt: null },
        select: { id: true },
      }),
      transaction.brand.findMany({
        where: { id: { in: brandIds }, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      }),
      transaction.warranty.findMany({
        where: { id: { in: warrantyIds }, isActive: true, deletedAt: null },
        select: { id: true },
      }),
    ]);
    const existingProductsBySlug = new Map(existingProducts.map((product) => [product.slug, product]));
    const existingSkuOwners = new Map<string, Set<string>>();
    for (const variant of existingVariants) {
      addImportSkuOwner(existingSkuOwners, variant.sku, variant.product.slug);
      addImportSkuOwner(existingSkuOwners, variant.skuRecord?.code, variant.product.slug);
    }
    const duplicateSlugs = duplicateImportValues(normalizedProducts.map((product) => product.slug));
    const duplicateSkuCodes = duplicateImportValues(normalizedProducts.flatMap((product) => product.variants.map((variant) => variant.skuCode)));
    const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
    const activeBrandIds = new Set(activeBrands.map((brand) => brand.id));
    const activeWarrantyIds = new Set(activeWarranties.map((warranty) => warranty.id));
    const rows = parsedRows.map(({ row, parsed }) => {
      const messages = parsed.success
        ? validateImportReferences({
          product: parsed.data,
          existingProducts: existingProductsBySlug,
          existingSkuOwners,
          duplicateSlugs,
          duplicateSkuCodes,
          activeCategoryIds,
          activeBrandIds,
          activeWarrantyIds,
        })
        : importErrors(parsed);
      if (messages.length > 0) {
        return {
          rowNumber: row.rowNumber,
          status: 'VALIDATION_ERROR' as const,
          action: 'SKIP' as const,
          rawData: row.data as Prisma.InputJsonValue,
          validationErrors: { messages } as Prisma.InputJsonValue,
        };
      }
      if (!parsed.success) throw new ConflictError();
      return {
        rowNumber: row.rowNumber,
        status: 'VALID' as const,
        action: existingProductsBySlug.has(parsed.data.slug) ? 'UPDATE' as const : 'CREATE' as const,
        rawData: row.data as Prisma.InputJsonValue,
        normalizedData: serializableImportInput(parsed.data),
      };
    });
    const validRows = rows.filter((row) => row.status === 'VALID').length;
    const failedRows = rows.length - validRows;
    const status = failedRows === 0 ? 'READY' as const : 'FAILED' as const;
    const created = await transaction.productImportBatch.create({
      data: {
        ...(input.sourceFileId === undefined ? {} : { sourceFileId: input.sourceFileId }),
        requestedById: audit.actorId,
        format: input.format,
        status,
        originalFileName: input.originalFileName,
        ...(input.sourceChecksum === undefined ? {} : { sourceChecksum: input.sourceChecksum }),
        totalRows: rows.length,
        validRows,
        failedRows,
        validationSummary: { validRows, failedRows },
        ...(failedRows === 0 ? {} : { errorReport: { code: 'PIM_IMPORT_VALIDATION_FAILED', failedRows } }),
        rows: { create: rows },
      },
      select: { id: true, status: true, totalRows: true, validRows: true, failedRows: true, rows: { where: { status: 'VALIDATION_ERROR' }, orderBy: { rowNumber: 'asc' }, select: { rowNumber: true, validationErrors: true } } },
    });
    await auditLogRepository.create(auditInput(audit, {
      action: 'pim.product-import.previewed', entityType: 'ProductImportBatch', entityId: created.id, metadata: { format: input.format, totalRows: rows.length, validRows, failedRows },
    }), transaction);
    return created;
  });
  return {
    id: batch.id,
    status: batch.status,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    failedRows: batch.failedRows,
    errors: batch.rows.map((row) => ({
      rowNumber: row.rowNumber,
      messages: Array.isArray((row.validationErrors as { messages?: unknown } | null)?.messages)
        ? ((row.validationErrors as { messages: unknown[] }).messages.filter((message): message is string => typeof message === 'string'))
        : ['Invalid import row.'],
    })),
  };
}

async function createImportedProduct(input: CreateProductInput, transaction: Transaction): Promise<string> {
  await assertActiveCategory(input.categoryId, transaction);
  const brand = await activeBrandName(input.brandId, transaction);
  await Promise.all(input.variants.map((variant) => validateVariantInput(variant, transaction)));
  assertUniqueVariantOptions(input.variants);
  const productData: Prisma.CatalogProductCreateInput = {
      ...(input.categoryId === undefined || input.categoryId === null ? {} : { category: { connect: { id: input.categoryId } } }),
      ...(input.brandId === undefined || input.brandId === null ? {} : { brandRecord: { connect: { id: input.brandId } } }),
      slug: input.slug,
      name: input.name,
      brand: brand?.name ?? 'Apple',
      searchText: buildProductSearchText({
        name: input.name,
        slug: input.slug,
        brand: brand?.name ?? 'Apple',
        skuCodes: input.variants.map((variant) => variant.skuCode),
        specificationValues: input.specifications.map((specification) => specification.displayValue),
      }),
      ...(input.summary === undefined ? {} : { summary: input.summary }),
      ...(input.description === undefined ? {} : { description: input.description }),
      variants: { create: input.variants.map(variantCreateData) },
    };
  const product = await transaction.catalogProduct.create({
    data: productData,
    select: { id: true, variants: { select: { id: true, sku: true } } },
  });
  const specs = await resolveSpecificationTargets(product.id, input.categoryId ?? null, product.variants, input.specifications, transaction);
  if (specs.length > 0) await transaction.productSpecification.createMany({ data: specs });
  return product.id;
}

const PIM_IMPORT_APPLY_FAILED_CODE = 'PIM_IMPORT_APPLY_FAILED';
const PIM_IMPORT_APPLY_LEASE_MS = 30 * 60 * 1_000;

async function claimProductImportBatch(batchId: string): Promise<string> {
  const attemptToken = randomUUID();
  const startedAt = new Date();
  let claim = await prisma.productImportBatch.updateMany({
    where: { id: batchId, status: 'READY' },
    data: { status: 'APPLYING', applyAttemptToken: attemptToken, applyStartedAt: startedAt },
  });
  if (claim.count === 1) return attemptToken;

  // A process can terminate after its state claim but before the business
  // transaction starts. That transaction cannot have committed partial data:
  // all product, row, journal, and completion mutations are one transaction.
  // Reclaim only a long-expired lease, then atomically claim it again.
  const recovered = await prisma.productImportBatch.updateMany({
    where: {
      id: batchId,
      status: 'APPLYING',
      applyStartedAt: { lt: new Date(startedAt.getTime() - PIM_IMPORT_APPLY_LEASE_MS) },
    },
    data: { status: 'READY', applyAttemptToken: null, applyStartedAt: null },
  });
  if (recovered.count === 1) {
    claim = await prisma.productImportBatch.updateMany({
      where: { id: batchId, status: 'READY' },
      data: { status: 'APPLYING', applyAttemptToken: attemptToken, applyStartedAt: startedAt },
    });
    if (claim.count === 1) return attemptToken;
  }

  const batch = await prisma.productImportBatch.findUnique({ where: { id: batchId }, select: { id: true } });
  if (!batch) throw new NotFoundError();
  throw new ConflictError();
}

async function markProductImportBatchFailed(batchId: string, attemptToken: string): Promise<void> {
  await prisma.productImportBatch.updateMany({
    where: { id: batchId, status: 'APPLYING', applyAttemptToken: attemptToken },
    data: {
      status: 'FAILED',
      applyAttemptToken: null,
      applyStartedAt: null,
      // Never persist a driver error or stack trace in an admin-visible batch.
      errorReport: { code: PIM_IMPORT_APPLY_FAILED_CODE },
    },
  });
}

export async function applyAdminProductImport(batchId: string, context: AdminAuditContext): Promise<ProductImportPreviewDto> {
  const audit = requireAuditContext(context);
  const attemptToken = await claimProductImportBatch(batchId);
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const batch = await transaction.productImportBatch.findUnique({
        where: { id: batchId },
        include: { rows: { orderBy: { rowNumber: 'asc' } } },
      });
      if (!batch || batch.status !== 'APPLYING' || batch.applyAttemptToken !== attemptToken) throw new ConflictError();
      if (batch.rows.length > PIM_IMPORT_MAX_ROWS) throw new ValidationError({ rows: `Apply imports in batches of ${PIM_IMPORT_MAX_ROWS} rows or fewer.` });

      for (const row of batch.rows) {
        if (row.status !== 'VALID' || !row.normalizedData || !row.action || row.action === 'SKIP') throw new ConflictError();
        // Staging stores CreateProductInput JSON (with bigint values encoded as
        // strings), not a flat CSV record. Re-validate that normalized shape
        // before every write; Zod restores the bigint fields safely.
        const parsed = createProductInput.safeParse(row.normalizedData);
        if (!parsed.success) throw new ConflictError();
        const existing = await transaction.catalogProduct.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
        // Preview rejects update rows. Re-check under the write transaction so
        // a product created after preview cannot turn into a partial update.
        if (existing) throw new ConflictError();
        const productId = await createImportedProduct(parsed.data, transaction);
        await transaction.productImportChange.create({
          data: { importBatchId: batchId, entityType: 'CatalogProduct', entityId: productId, action: 'CREATE', afterSnapshot: { slug: parsed.data.slug, name: parsed.data.name } },
        });
        await transaction.productImportRow.update({ where: { id: row.id }, data: { status: 'APPLIED', appliedAt: new Date() } });
      }
      const completion = await transaction.productImportBatch.updateMany({
        where: { id: batchId, status: 'APPLYING', applyAttemptToken: attemptToken },
        data: { status: 'COMPLETED', appliedAt: new Date(), applyAttemptToken: null, applyStartedAt: null },
      });
      if (completion.count !== 1) throw new ConflictError();
      const completed = await transaction.productImportBatch.findUnique({
        where: { id: batchId },
        select: { id: true, status: true, totalRows: true, validRows: true, failedRows: true, rows: { where: { status: 'VALIDATION_ERROR' }, select: { rowNumber: true, validationErrors: true } } },
      });
      if (!completed) throw new ConflictError();
      await auditLogRepository.create(auditInput(audit, {
        action: 'pim.product-import.applied', entityType: 'ProductImportBatch', entityId: batchId, metadata: { totalRows: completed.totalRows },
      }), transaction);
      return completed;
    });
    return {
      id: result.id,
      status: result.status,
      totalRows: result.totalRows,
      validRows: result.validRows,
      failedRows: result.failedRows,
      errors: result.rows.map((row) => ({ rowNumber: row.rowNumber, messages: ['Validation failed.'] })),
    };
  } catch (error) {
    // The claim was committed before the business transaction. If the latter
    // rolls back, this independent transition makes the batch terminal and
    // prevents an accidental automatic re-apply of an unknown partial run.
    await markProductImportBatchFailed(batchId, attemptToken);
    throw error;
  }
}
