import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ALLOWED_DATABASE_NAMES = new Set(['apple333_test', 'apple333_e2e_test']);
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const FIXTURE_PREFIX = 'e2e-storefront-';

/**
 * Validates environment strings before a Prisma client is created. The fixture
 * never accepts a remote, staging, shared, or production database target.
 */
export function validateE2eStorefrontSeedEnvironment(environment = process.env) {
  const errors = [];

  if (environment.NODE_ENV !== 'test') {
    errors.push('NODE_ENV must be exactly "test".');
  }
  if (environment.APPLE333_E2E_TEST_DB !== '1') {
    errors.push('APPLE333_E2E_TEST_DB must be exactly "1".');
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required.');
    return { ok: false, errors };
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL.');
    return { ok: false, errors };
  }

  if (url.protocol !== 'postgresql:') {
    errors.push('DATABASE_URL must use the postgresql: scheme.');
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    errors.push('DATABASE_URL must use a loopback database host.');
  }
  if (!ALLOWED_DATABASE_NAMES.has(decodeURIComponent(url.pathname).replace(/^\//, ''))) {
    errors.push('DATABASE_URL must target the dedicated apple333 test database.');
  }
  if (url.searchParams.getAll('schema').length !== 1 || url.searchParams.get('schema') !== 'public') {
    errors.push('DATABASE_URL must contain exactly one schema=public parameter.');
  }
  if (!url.username || !url.password) {
    errors.push('DATABASE_URL must include a test-only role and password.');
  }

  return { ok: errors.length === 0, errors };
}

const categories = [
  {
    id: `${FIXTURE_PREFIX}category-iphone`,
    slug: 'e2e-iphone',
    name: 'E2E iPhone',
    description: 'Deterministic test catalog category.',
    sortOrder: 1,
  },
  {
    id: `${FIXTURE_PREFIX}category-accessories`,
    slug: 'e2e-accessories',
    name: 'E2E Accessories',
    description: 'Deterministic test accessory category.',
    sortOrder: 2,
  },
];

const products = [
  {
    id: `${FIXTURE_PREFIX}product-iphone-16-pro`,
    slug: 'e2e-iphone-16-pro',
    categoryId: `${FIXTURE_PREFIX}category-iphone`,
    name: 'Apple333 E2E iPhone 16 Pro',
    summary: 'Deterministic published iPhone fixture for browser validation.',
    description: 'A controlled non-production product used only by E2E tests.',
    specifications: { display: '6.3-inch', camera: '48MP', cpu: 'A18 Pro', battery: '3582mAh' },
    isFeatured: true,
    featuredRank: 1,
    isNew: true,
    isOnSale: true,
    variant: {
      id: `${FIXTURE_PREFIX}variant-iphone-16-pro`,
      sku: 'E2E-IP16PRO-256-BLK',
      code: 'E2E-IP16PRO-256-BLK',
      title: '256GB Black',
      modelNumber: 'E2E-A18PRO',
      color: 'Black',
      storage: '256GB',
      priceRials: 1_499_000_000n,
      compareAtPriceRials: 1_599_000_000n,
    },
  },
  {
    id: `${FIXTURE_PREFIX}product-iphone-16`,
    slug: 'e2e-iphone-16',
    categoryId: `${FIXTURE_PREFIX}category-iphone`,
    name: 'Apple333 E2E iPhone 16',
    summary: 'Second deterministic iPhone fixture for comparison validation.',
    description: 'A controlled non-production product used only by E2E tests.',
    specifications: { display: '6.1-inch', camera: '48MP', cpu: 'A18', battery: '3561mAh' },
    isFeatured: true,
    featuredRank: 2,
    isNew: true,
    isOnSale: false,
    variant: {
      id: `${FIXTURE_PREFIX}variant-iphone-16`,
      sku: 'E2E-IP16-128-WHT',
      code: 'E2E-IP16-128-WHT',
      title: '128GB White',
      modelNumber: 'E2E-A18',
      color: 'White',
      storage: '128GB',
      priceRials: 1_099_000_000n,
      compareAtPriceRials: null,
    },
  },
  {
    id: `${FIXTURE_PREFIX}product-airpods-pro`,
    slug: 'e2e-airpods-pro',
    categoryId: `${FIXTURE_PREFIX}category-accessories`,
    name: 'Apple333 E2E AirPods Pro',
    summary: 'Deterministic accessory fixture for catalog discovery validation.',
    description: 'A controlled non-production product used only by E2E tests.',
    specifications: { audio: 'Adaptive Audio', chip: 'H2' },
    isFeatured: false,
    featuredRank: null,
    isNew: false,
    isOnSale: true,
    variant: {
      id: `${FIXTURE_PREFIX}variant-airpods-pro`,
      sku: 'E2E-AIRPODS-PRO-WHT',
      code: 'E2E-AIRPODS-PRO-WHT',
      title: 'White',
      modelNumber: 'E2E-H2',
      color: 'White',
      storage: null,
      priceRials: 299_000_000n,
      compareAtPriceRials: 339_000_000n,
    },
  },
];

const branch = {
  id: `${FIXTURE_PREFIX}branch`,
  code: 'E2E-STOREFRONT',
  name: 'E2E Storefront Branch',
  city: 'Test City',
};

async function seed(prisma) {
  for (const category of categories) {
    await prisma.catalogCategory.upsert({
      where: { slug: category.slug },
      create: { ...category, isActive: true, deletedAt: null },
      update: { ...category, isActive: true, deletedAt: null },
    });
  }

  await prisma.branch.upsert({
    where: { code: branch.code },
    create: { ...branch, kind: 'STORE', isActive: true, isPickupEnabled: true },
    update: { ...branch, kind: 'STORE', isActive: true, isPickupEnabled: true },
  });

  for (const product of products) {
    await prisma.catalogProduct.upsert({
      where: { slug: product.slug },
      create: {
        id: product.id,
        categoryId: product.categoryId,
        slug: product.slug,
        name: product.name,
        brand: 'Apple',
        summary: product.summary,
        description: product.description,
        specifications: product.specifications,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-07-20T00:00:00.000Z'),
        isFeatured: product.isFeatured,
        featuredRank: product.featuredRank,
        isNew: product.isNew,
        isOnSale: product.isOnSale,
        deletedAt: null,
      },
      update: {
        categoryId: product.categoryId,
        name: product.name,
        brand: 'Apple',
        summary: product.summary,
        description: product.description,
        specifications: product.specifications,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-07-20T00:00:00.000Z'),
        isFeatured: product.isFeatured,
        featuredRank: product.featuredRank,
        isNew: product.isNew,
        isOnSale: product.isOnSale,
        deletedAt: null,
      },
    });

    await prisma.catalogVariant.upsert({
      where: { sku: product.variant.sku },
      create: {
        id: product.variant.id,
        productId: product.id,
        sku: product.variant.sku,
        title: product.variant.title,
        modelNumber: product.variant.modelNumber,
        color: product.variant.color,
        storage: product.variant.storage,
        priceRials: product.variant.priceRials,
        compareAtPriceRials: product.variant.compareAtPriceRials,
        isActive: true,
        deletedAt: null,
        sortOrder: 0,
      },
      update: {
        productId: product.id,
        title: product.variant.title,
        modelNumber: product.variant.modelNumber,
        color: product.variant.color,
        storage: product.variant.storage,
        priceRials: product.variant.priceRials,
        compareAtPriceRials: product.variant.compareAtPriceRials,
        isActive: true,
        deletedAt: null,
        sortOrder: 0,
      },
    });

    await prisma.productSku.upsert({
      where: { code: product.variant.code },
      create: {
        id: `${product.variant.id}-sku`,
        variantId: product.variant.id,
        code: product.variant.code,
        priceRials: product.variant.priceRials,
        compareAtPriceRials: product.variant.compareAtPriceRials,
        status: 'ACTIVE',
        deletedAt: null,
      },
      update: {
        variantId: product.variant.id,
        priceRials: product.variant.priceRials,
        compareAtPriceRials: product.variant.compareAtPriceRials,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    await prisma.branchInventory.upsert({
      where: { branchId_variantId: { branchId: branch.id, variantId: product.variant.id } },
      create: { branchId: branch.id, variantId: product.variant.id, onHand: 12, reserved: 0 },
      update: { onHand: 12, reserved: 0 },
    });

    await prisma.productSeo.upsert({
      where: { productId: product.id },
      create: {
        productId: product.id,
        metaTitle: `${product.name} | Apple333 E2E`,
        metaDescription: product.summary,
        canonicalUrl: `http://127.0.0.1:3000/products/${product.slug}`,
        noIndex: true,
      },
      update: {
        metaTitle: `${product.name} | Apple333 E2E`,
        metaDescription: product.summary,
        canonicalUrl: `http://127.0.0.1:3000/products/${product.slug}`,
        noIndex: true,
      },
    });
  }
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath) && resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const validation = validateE2eStorefrontSeedEnvironment();
  if (!validation.ok) {
    console.error(`E2E storefront fixture preflight failed: ${validation.errors.join(' ')}`);
    process.exitCode = 1;
  } else {
    const prisma = new PrismaClient();
    try {
      await seed(prisma);
      console.log(`Seeded deterministic storefront E2E fixtures (products=${products.length}).`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'E2E storefront fixture seeding failed.');
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  }
}
