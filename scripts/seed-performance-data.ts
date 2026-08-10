/**
 * Phase 05.1 deterministic storefront-performance fixture generator.
 *
 * This script is deliberately isolated from the standard Prisma seed. It can
 * only write to the dedicated local PIM test database after an explicit
 * operator opt-in. It never deletes, truncates, upserts, or mutates records
 * created by a previous run.
 */

const PRISMA_CLIENT_MODULE: string = "@prisma/client";

export const PERFORMANCE_CATALOG_SCALES = Object.freeze([10_000, 100_000] as const);
export const PERFORMANCE_VARIANTS_PER_PRODUCT = 4;
export const PERFORMANCE_SPECIFICATIONS_PER_PRODUCT = 4;

const EXPECTED_DATABASE_NAME = "apple333_pim_test";
const EXPECTED_DATABASE_USER = "apple333_pim_test";
const EXPECTED_DATABASE_PORT = "55432";
const REQUIRED_MIGRATION = "20260713000000_phase_04_1_pim_activation";
const DEFAULT_BATCH_SIZE = 250;
const MIN_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1_000;

type PerformanceCatalogScale = (typeof PERFORMANCE_CATALOG_SCALES)[number];

type BenchmarkCategory = {
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly models: readonly string[];
  readonly priceBaseRials: number;
};

type BenchmarkBrand = {
  readonly code: string;
  readonly slug: string;
  readonly name: string;
};

type BenchmarkAttribute = {
  readonly code: string;
  readonly name: string;
  readonly unitCode: string | null;
};

type SeedContext = {
  readonly runId: string;
  readonly marker: string;
  readonly prefix: string;
  readonly skuPrefix: string;
  readonly categoryId: (category: BenchmarkCategory) => string;
  readonly brandId: (brand: BenchmarkBrand) => string;
  readonly specificationGroupId: string;
  readonly attributeId: (attribute: BenchmarkAttribute) => string;
  readonly attributeValueId: (attribute: BenchmarkAttribute, tier: number) => string;
  readonly productId: (ordinal: number) => string;
  readonly productSlug: (ordinal: number, category: BenchmarkCategory) => string;
  readonly variantId: (ordinal: number, variantOffset: number) => string;
  readonly skuCode: (ordinal: number, variantOffset: number) => string;
  readonly productSpecificationId: (
    ordinal: number,
    attribute: BenchmarkAttribute,
  ) => string;
};

type BenchmarkSeedBatch = {
  readonly products: Record<string, unknown>[];
  readonly variants: Record<string, unknown>[];
  readonly skus: Record<string, unknown>[];
  readonly specifications: Record<string, unknown>[];
};

type BenchmarkReferenceData = {
  readonly categories: Record<string, unknown>[];
  readonly brands: Record<string, unknown>[];
  readonly specificationGroups: Record<string, unknown>[];
  readonly attributes: Record<string, unknown>[];
  readonly attributeValues: Record<string, unknown>[];
  readonly categorySpecificationGroups: Record<string, unknown>[];
  readonly categoryAttributes: Record<string, unknown>[];
};

type RunState = {
  readonly categories: number;
  readonly brands: number;
  readonly specificationGroups: number;
  readonly attributes: number;
  readonly attributeValues: number;
  readonly categorySpecificationGroups: number;
  readonly categoryAttributes: number;
  readonly products: number;
  readonly variants: number;
  readonly skus: number;
  readonly specifications: number;
};

type CreateManyDelegate = {
  createMany: (argumentsValue: {
    data: Record<string, unknown>[];
  }) => Promise<{ count: number }>;
  count: (argumentsValue: { where: Record<string, unknown> }) => Promise<number>;
};

type BenchmarkPrismaTransaction = {
  catalogCategory: CreateManyDelegate;
  brand: CreateManyDelegate;
  specificationGroup: CreateManyDelegate;
  productAttribute: CreateManyDelegate;
  attributeValue: CreateManyDelegate;
  categorySpecificationGroup: CreateManyDelegate;
  categoryAttribute: CreateManyDelegate;
  catalogProduct: CreateManyDelegate;
  catalogVariant: CreateManyDelegate;
  productSku: CreateManyDelegate;
  productSpecification: CreateManyDelegate;
};

type BenchmarkPrismaClient = BenchmarkPrismaTransaction & {
  $transaction: <Value>(
    callback: (transaction: BenchmarkPrismaTransaction) => Promise<Value>,
    options?: { maxWait?: number; timeout?: number },
  ) => Promise<Value>;
  $queryRaw: <Value>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<Value>;
  $disconnect: () => Promise<void>;
};

type PrismaClientConstructor = new (options: {
  datasources: { db: { url: string } };
}) => BenchmarkPrismaClient;

type PrismaClientModule = {
  PrismaClient: PrismaClientConstructor;
};

export type PerformanceSeedArguments = {
  readonly help: boolean;
  readonly execute: boolean;
  readonly runId: string | null;
  readonly scale: PerformanceCatalogScale | null;
  readonly batchSize: number | null;
};

const BENCHMARK_BRANDS: readonly BenchmarkBrand[] = Object.freeze([
  { code: "apple", slug: "apple", name: "Apple" },
  { code: "belkin", slug: "belkin", name: "Belkin" },
  { code: "anker", slug: "anker", name: "Anker" },
  { code: "spigen", slug: "spigen", name: "Spigen" },
]);

const BENCHMARK_CATEGORIES: readonly BenchmarkCategory[] = Object.freeze([
  {
    code: "iphone",
    slug: "iphone",
    name: "iPhone",
    models: ["iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro", "iPhone 15"],
    priceBaseRials: 850_000_000,
  },
  {
    code: "ipad",
    slug: "ipad",
    name: "iPad",
    models: ["iPad Pro", "iPad Air", "iPad mini", "iPad"],
    priceBaseRials: 420_000_000,
  },
  {
    code: "mac",
    slug: "mac",
    name: "Mac",
    models: ["MacBook Air", "MacBook Pro", "iMac", "Mac mini"],
    priceBaseRials: 1_100_000_000,
  },
  {
    code: "apple-watch",
    slug: "apple-watch",
    name: "Apple Watch",
    models: ["Apple Watch Series 10", "Apple Watch Ultra 2", "Apple Watch SE"],
    priceBaseRials: 300_000_000,
  },
  {
    code: "airpods",
    slug: "airpods",
    name: "AirPods",
    models: ["AirPods Pro", "AirPods 4", "AirPods Max"],
    priceBaseRials: 180_000_000,
  },
  {
    code: "accessories",
    slug: "accessories",
    name: "Accessories",
    models: ["MagSafe Charger", "AirTag", "USB-C Cable", "Protective Case"],
    priceBaseRials: 40_000_000,
  },
]);

const BENCHMARK_ATTRIBUTES: readonly BenchmarkAttribute[] = Object.freeze([
  { code: "chipset", name: "Chipset", unitCode: null },
  { code: "display", name: "Display", unitCode: "inch" },
  { code: "camera", name: "Camera", unitCode: "mp" },
  { code: "battery", name: "Battery", unitCode: "mah" },
]);

const VARIANT_COLORS = Object.freeze([
  "Black Titanium",
  "Natural Titanium",
  "Blue",
  "White",
] as const);

const VARIANT_STORAGES = Object.freeze(["128GB", "256GB", "512GB", "1TB"] as const);

function isPerformanceCatalogScale(value: number): value is PerformanceCatalogScale {
  return PERFORMANCE_CATALOG_SCALES.some((scale) => scale === value);
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a whole number.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive whole number.`);
  }

  return parsed;
}

function parseRunId(value: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{6,38}[a-z0-9])?$/.test(value)) {
    throw new Error(
      "--run-id must be 8-40 lowercase letters, digits, or hyphens and cannot start or end with a hyphen.",
    );
  }

  return value;
}

export function parsePerformanceSeedArguments(
  argumentsList: readonly string[] = process.argv.slice(2),
): PerformanceSeedArguments {
  if (argumentsList.length === 1 && argumentsList[0] === "--help") {
    return { help: true, execute: false, runId: null, scale: null, batchSize: null };
  }

  let execute = false;
  let runId: string | null = null;
  let scale: PerformanceCatalogScale | null = null;
  let batchSize: number | null = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument) continue;

    if (argument === "--execute") {
      if (execute) throw new Error("--execute can only be supplied once.");
      execute = true;
      continue;
    }

    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }

    if (argument === "--run-id") {
      if (runId) throw new Error("--run-id can only be supplied once.");
      runId = parseRunId(value);
    } else if (argument === "--scale") {
      if (scale !== null) throw new Error("--scale can only be supplied once.");
      const parsedScale = parsePositiveInteger(value, "--scale");
      if (!isPerformanceCatalogScale(parsedScale)) {
        throw new Error("--scale must be exactly 10000 or 100000.");
      }
      scale = parsedScale;
    } else if (argument === "--batch-size") {
      if (batchSize !== null) {
        throw new Error("--batch-size can only be supplied once.");
      }
      const parsedBatchSize = parsePositiveInteger(value, "--batch-size");
      if (parsedBatchSize < MIN_BATCH_SIZE || parsedBatchSize > MAX_BATCH_SIZE) {
        throw new Error(
          `--batch-size must be between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}.`,
        );
      }
      batchSize = parsedBatchSize;
    } else {
      throw new Error(`Unsupported argument: ${argument}.`);
    }

    index += 1;
  }

  if (!execute) {
    throw new Error("Use --execute after completing the isolated test-database preflight.");
  }
  if (!runId || scale === null) {
    throw new Error("Both --run-id and --scale are required with --execute.");
  }

  return { help: false, execute, runId, scale, batchSize };
}

export function validatePerformanceSeedEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (environment.NODE_ENV !== "test") {
    errors.push('NODE_ENV must be exactly "test".');
  }
  if (environment.APPLE333_PIM_TEST_DB !== "1") {
    errors.push('APPLE333_PIM_TEST_DB must be exactly "1".');
  }
  if (environment.PERFORMANCE_SEED_ALLOW_WRITE !== "1") {
    errors.push('PERFORMANCE_SEED_ALLOW_WRITE must be exactly "1".');
  }

  const databaseUrl = environment.PIM_TEST_DATABASE_URL;
  if (!databaseUrl) {
    errors.push("PIM_TEST_DATABASE_URL is required.");
  } else {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol !== "postgresql:") {
        errors.push("PIM_TEST_DATABASE_URL must use the postgresql: scheme.");
      }
      if (parsed.username !== EXPECTED_DATABASE_USER) {
        errors.push(
          `PIM_TEST_DATABASE_URL must use the ${EXPECTED_DATABASE_USER} role.`,
        );
      }
      if (!parsed.password) {
        errors.push("PIM_TEST_DATABASE_URL must include a non-empty password.");
      }
      if (parsed.hostname !== "127.0.0.1") {
        errors.push("PIM_TEST_DATABASE_URL host must be exactly 127.0.0.1.");
      }
      if (parsed.port !== EXPECTED_DATABASE_PORT) {
        errors.push(
          `PIM_TEST_DATABASE_URL must use dedicated port ${EXPECTED_DATABASE_PORT}.`,
        );
      }
      if (decodeURIComponent(parsed.pathname) !== `/${EXPECTED_DATABASE_NAME}`) {
        errors.push(
          `PIM_TEST_DATABASE_URL must target /${EXPECTED_DATABASE_NAME}.`,
        );
      }
      if (
        parsed.searchParams.getAll("schema").length !== 1 ||
        parsed.searchParams.get("schema") !== "public"
      ) {
        errors.push(
          "PIM_TEST_DATABASE_URL must contain exactly one schema=public parameter.",
        );
      }
      if (parsed.hash) {
        errors.push("PIM_TEST_DATABASE_URL must not contain a URL fragment.");
      }
    } catch {
      errors.push("PIM_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
    }
  }

  if (
    environment.DATABASE_URL &&
    environment.DATABASE_URL !== environment.PIM_TEST_DATABASE_URL
  ) {
    errors.push(
      "DATABASE_URL must be unset or exactly match PIM_TEST_DATABASE_URL for this fixture generator.",
    );
  }

  return { ok: errors.length === 0, errors };
}

export function createPerformanceSeedContext(runId: string): SeedContext {
  const safeRunId = parseRunId(runId);
  const prefix = `perf-seed-${safeRunId}`;
  const skuPrefix = `PERFSEED-${safeRunId.toUpperCase()}-`;

  return {
    runId: safeRunId,
    marker: `phase-05.1-performance:${safeRunId}`,
    prefix,
    skuPrefix,
    categoryId: (category) => `${prefix}-category-${category.code}`,
    brandId: (brand) => `${prefix}-brand-${brand.code}`,
    specificationGroupId: `${prefix}-specification-group`,
    attributeId: (attribute) => `${prefix}-attribute-${attribute.code}`,
    attributeValueId: (attribute, tier) =>
      `${prefix}-attribute-value-${attribute.code}-${tier}`,
    productId: (ordinal) => `${prefix}-product-${String(ordinal).padStart(6, "0")}`,
    productSlug: (ordinal, category) =>
      `${prefix}-${category.slug}-${String(ordinal).padStart(6, "0")}`,
    variantId: (ordinal, variantOffset) =>
      `${prefix}-variant-${String(ordinal).padStart(6, "0")}-${variantOffset + 1}`,
    skuCode: (ordinal, variantOffset) =>
      `${skuPrefix}${String(ordinal).padStart(6, "0")}-${variantOffset + 1}`,
    productSpecificationId: (ordinal, attribute) =>
      `${prefix}-product-specification-${String(ordinal).padStart(6, "0")}-${attribute.code}`,
  };
}

export function buildPerformanceReferenceData(
  context: SeedContext,
): BenchmarkReferenceData {
  const specificationGroups = [
    {
      id: context.specificationGroupId,
      code: `${context.prefix}-device-specifications`,
      name: "Benchmark device specifications",
      description: "Deterministic Phase 05.1 benchmark-only specification group.",
      sortOrder: 0,
      isActive: true,
    },
  ];

  const categories = BENCHMARK_CATEGORIES.map((category, index) => ({
    id: context.categoryId(category),
    slug: `${context.prefix}-category-${category.slug}`,
    name: `Benchmark ${category.name}`,
    description: "Deterministic Phase 05.1 benchmark-only catalog category.",
    sortOrder: index,
    isActive: true,
  }));

  const brands = BENCHMARK_BRANDS.map((brand) => ({
    id: context.brandId(brand),
    code: `${context.prefix}-brand-${brand.code}`,
    slug: `${context.prefix}-brand-${brand.slug}`,
    name: `Benchmark ${brand.name}`,
    description: "Deterministic Phase 05.1 benchmark-only catalog brand.",
    status: "ACTIVE",
  }));

  const attributes = BENCHMARK_ATTRIBUTES.map((attribute, index) => ({
    id: context.attributeId(attribute),
    groupId: context.specificationGroupId,
    code: `${context.prefix}-attribute-${attribute.code}`,
    name: attribute.name,
    valueType: "SELECT",
    unitCode: attribute.unitCode,
    description: "Deterministic performance-fixture attribute.",
    isFilterable: true,
    isSearchable: true,
    isRequiredDefault: false,
    sortOrder: index,
    isActive: true,
  }));

  const attributeValues = BENCHMARK_ATTRIBUTES.flatMap((attribute) =>
    Array.from({ length: PERFORMANCE_VARIANTS_PER_PRODUCT }, (_, tierIndex) => {
      const tier = tierIndex + 1;
      return {
        id: context.attributeValueId(attribute, tier),
        attributeId: context.attributeId(attribute),
        code: `tier-${tier}`,
        label: `Benchmark ${attribute.name} tier ${tier}`,
        sortOrder: tierIndex,
        isActive: true,
        metadata: { benchmark: true, tier },
      };
    }),
  );

  const categorySpecificationGroups = BENCHMARK_CATEGORIES.map((category, index) => ({
    id: `${context.categoryId(category)}-specification-group`,
    categoryId: context.categoryId(category),
    groupId: context.specificationGroupId,
    sortOrder: index,
  }));

  const categoryAttributes = BENCHMARK_CATEGORIES.flatMap((category) =>
    BENCHMARK_ATTRIBUTES.map((attribute, index) => ({
      id: `${context.categoryId(category)}-attribute-${attribute.code}`,
      categoryId: context.categoryId(category),
      attributeId: context.attributeId(attribute),
      groupId: context.specificationGroupId,
      isRequired: false,
      isFilterable: true,
      sortOrder: index,
    })),
  );

  return {
    categories,
    brands,
    specificationGroups,
    attributes,
    attributeValues,
    categorySpecificationGroups,
    categoryAttributes,
  };
}

function categoryForOrdinal(ordinal: number): BenchmarkCategory {
  return BENCHMARK_CATEGORIES[(ordinal - 1) % BENCHMARK_CATEGORIES.length]!;
}

function brandForOrdinal(ordinal: number): BenchmarkBrand {
  return BENCHMARK_BRANDS[(ordinal - 1) % BENCHMARK_BRANDS.length]!;
}

function modelForOrdinal(category: BenchmarkCategory, ordinal: number): string {
  return category.models[(ordinal - 1) % category.models.length]!;
}

function specificationDisplayValue(
  attribute: BenchmarkAttribute,
  category: BenchmarkCategory,
  tier: number,
): string {
  switch (attribute.code) {
    case "chipset":
      return `${category.name} benchmark silicon tier ${tier}`;
    case "display":
      return `${5 + tier}.${category.code === "mac" ? 6 : 1}`;
    case "camera":
      return String(12 * tier);
    case "battery":
      return String(2_000 + tier * 1_000);
    default:
      return `Benchmark tier ${tier}`;
  }
}

/**
 * Builds only in-memory records. It performs no I/O and is safe to unit test.
 */
export function buildPerformanceCatalogBatch(
  context: SeedContext,
  startOrdinal: number,
  size: number,
): BenchmarkSeedBatch {
  if (!Number.isSafeInteger(startOrdinal) || startOrdinal < 1) {
    throw new Error("startOrdinal must be a positive whole number.");
  }
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new Error("size must be a positive whole number.");
  }

  const products: Record<string, unknown>[] = [];
  const variants: Record<string, unknown>[] = [];
  const skus: Record<string, unknown>[] = [];
  const specifications: Record<string, unknown>[] = [];
  const publishedAtBase = Date.UTC(2026, 0, 1);

  for (let offset = 0; offset < size; offset += 1) {
    const ordinal = startOrdinal + offset;
    const category = categoryForOrdinal(ordinal);
    const brand = brandForOrdinal(ordinal);
    const model = modelForOrdinal(category, ordinal);
    const productId = context.productId(ordinal);
    const productName = `${model} Performance Fixture ${String(ordinal).padStart(6, "0")}`;
    const productPriceRials = category.priceBaseRials + (ordinal % 50_000) * 10_000;

    products.push({
      id: productId,
      categoryId: context.categoryId(category),
      brandId: context.brandId(brand),
      slug: context.productSlug(ordinal, category),
      name: productName,
      brand: `Benchmark ${brand.name}`,
      summary: `Deterministic ${category.name} performance fixture ${ordinal}.`,
      description:
        "Synthetic catalog fixture for isolated Phase 05.1 performance validation. It contains no production product data.",
      status: "PUBLISHED",
      specifications: {
        benchmark: true,
        marker: context.marker,
        category: category.code,
        model,
        ordinal,
      },
      seoTitle: `${productName} | Benchmark`,
      seoDescription: "Synthetic benchmark-only catalog record.",
      approvedAt: new Date(publishedAtBase + ordinal * 60_000),
      publishedAt: new Date(publishedAtBase + ordinal * 60_000),
      searchText: `${context.marker} ${brand.name} ${category.name} ${model}`,
      isFeatured: ordinal % 20 === 0,
      featuredRank: ordinal % 20 === 0 ? ordinal : null,
      isNew: ordinal % 7 === 0,
      isOnSale: ordinal % 11 === 0,
    });

    for (
      let variantOffset = 0;
      variantOffset < PERFORMANCE_VARIANTS_PER_PRODUCT;
      variantOffset += 1
    ) {
      const tier = variantOffset + 1;
      const color = VARIANT_COLORS[variantOffset]!;
      const storage = VARIANT_STORAGES[variantOffset]!;
      const variantId = context.variantId(ordinal, variantOffset);
      const priceRials = BigInt(productPriceRials + variantOffset * 25_000_000);
      const compareAtPriceRials =
        ordinal % 11 === 0 ? priceRials + BigInt(15_000_000) : null;

      variants.push({
        id: variantId,
        productId,
        sku: context.skuCode(ordinal, variantOffset),
        title: `${color} / ${storage}`,
        color,
        storage,
        region: variantOffset % 2 === 0 ? "LL/A" : "CH/A",
        modelNumber: `PERF-${category.code.toUpperCase()}-${String(ordinal).padStart(6, "0")}-${tier}`,
        optionKey: `${color.toLowerCase().replaceAll(" ", "-")}-${storage.toLowerCase()}`,
        warranty: "Benchmark warranty only",
        attributes: {
          benchmark: true,
          color,
          storage,
          tier,
        },
        priceRials,
        compareAtPriceRials,
        isActive: true,
        sortOrder: variantOffset,
      });

      skus.push({
        id: `${variantId}-sku-record`,
        variantId,
        code: context.skuCode(ordinal, variantOffset),
        priceRials,
        compareAtPriceRials,
        costRials: priceRials - BigInt(5_000_000),
        status: "ACTIVE",
      });
    }

    for (let attributeIndex = 0; attributeIndex < BENCHMARK_ATTRIBUTES.length; attributeIndex += 1) {
      const attribute = BENCHMARK_ATTRIBUTES[attributeIndex]!;
      const tier = ((ordinal + attributeIndex) % PERFORMANCE_VARIANTS_PER_PRODUCT) + 1;
      const displayValue = specificationDisplayValue(attribute, category, tier);

      specifications.push({
        id: context.productSpecificationId(ordinal, attribute),
        productId,
        attributeId: context.attributeId(attribute),
        attributeValueId: context.attributeValueId(attribute, tier),
        scope: "PRODUCT",
        subjectKey: "product",
        value: {
          benchmark: true,
          ordinal,
          tier,
          displayValue,
        },
        displayValue,
        unitCode: attribute.unitCode,
        sortOrder: attributeIndex,
      });
    }
  }

  return { products, variants, skus, specifications };
}

function expectedRunState(scale: PerformanceCatalogScale): RunState {
  return {
    categories: BENCHMARK_CATEGORIES.length,
    brands: BENCHMARK_BRANDS.length,
    specificationGroups: 1,
    attributes: BENCHMARK_ATTRIBUTES.length,
    attributeValues:
      BENCHMARK_ATTRIBUTES.length * PERFORMANCE_VARIANTS_PER_PRODUCT,
    categorySpecificationGroups: BENCHMARK_CATEGORIES.length,
    categoryAttributes: BENCHMARK_CATEGORIES.length * BENCHMARK_ATTRIBUTES.length,
    products: scale,
    variants: scale * PERFORMANCE_VARIANTS_PER_PRODUCT,
    skus: scale * PERFORMANCE_VARIANTS_PER_PRODUCT,
    specifications: scale * PERFORMANCE_SPECIFICATIONS_PER_PRODUCT,
  };
}

function sameRunState(left: RunState, right: RunState): boolean {
  return (
    left.categories === right.categories &&
    left.brands === right.brands &&
    left.specificationGroups === right.specificationGroups &&
    left.attributes === right.attributes &&
    left.attributeValues === right.attributeValues &&
    left.categorySpecificationGroups === right.categorySpecificationGroups &&
    left.categoryAttributes === right.categoryAttributes &&
    left.products === right.products &&
    left.variants === right.variants &&
    left.skus === right.skus &&
    left.specifications === right.specifications
  );
}

function emptyRunState(state: RunState): boolean {
  return Object.values(state).every((value) => value === 0);
}

async function readRunState(
  prisma: BenchmarkPrismaClient,
  context: SeedContext,
): Promise<RunState> {
  const [
    categories,
    brands,
    specificationGroups,
    attributes,
    attributeValues,
    categorySpecificationGroups,
    categoryAttributes,
    products,
    variants,
    skus,
    specifications,
  ] = await Promise.all([
    prisma.catalogCategory.count({
      where: { slug: { startsWith: `${context.prefix}-category-` } },
    }),
    prisma.brand.count({ where: { code: { startsWith: `${context.prefix}-brand-` } } }),
    prisma.specificationGroup.count({
      where: { code: `${context.prefix}-device-specifications` },
    }),
    prisma.productAttribute.count({
      where: { code: { startsWith: `${context.prefix}-attribute-` } },
    }),
    prisma.attributeValue.count({
      where: { attribute: { code: { startsWith: `${context.prefix}-attribute-` } } },
    }),
    prisma.categorySpecificationGroup.count({
      where: { category: { slug: { startsWith: `${context.prefix}-category-` } } },
    }),
    prisma.categoryAttribute.count({
      where: { category: { slug: { startsWith: `${context.prefix}-category-` } } },
    }),
    prisma.catalogProduct.count({
      where: { searchText: { startsWith: context.marker } },
    }),
    prisma.catalogVariant.count({ where: { sku: { startsWith: context.skuPrefix } } }),
    prisma.productSku.count({ where: { code: { startsWith: context.skuPrefix } } }),
    prisma.productSpecification.count({
      where: { product: { searchText: { startsWith: context.marker } } },
    }),
  ]);

  return {
    categories,
    brands,
    specificationGroups,
    attributes,
    attributeValues,
    categorySpecificationGroups,
    categoryAttributes,
    products,
    variants,
    skus,
    specifications,
  };
}

function rowValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function assertIsolatedMigratedDatabase(
  prisma: BenchmarkPrismaClient,
): Promise<void> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT current_database() AS database, current_user AS role, current_schema() AS schema
  `;
  const identity = rowValue(rows[0]);
  if (
    !identity ||
    identity.database !== EXPECTED_DATABASE_NAME ||
    identity.role !== EXPECTED_DATABASE_USER ||
    identity.schema !== "public"
  ) {
    throw new Error(
      "Connected database identity does not match the dedicated isolated performance-test target.",
    );
  }

  const migrations = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT migration_name AS "migrationName", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
    FROM "_prisma_migrations"
    WHERE migration_name = ${REQUIRED_MIGRATION}
  `;
  const migration = rowValue(migrations[0]);
  if (!migration || !migration.finishedAt || migration.rolledBackAt) {
    throw new Error(
      "The completed Phase 04.1 migration is required; this generator never runs migrations.",
    );
  }
}

async function createReferenceData(
  prisma: BenchmarkPrismaClient,
  context: SeedContext,
): Promise<void> {
  const referenceData = buildPerformanceReferenceData(context);
  await prisma.$transaction(
    async (transaction) => {
      await transaction.catalogCategory.createMany({ data: referenceData.categories });
      await transaction.brand.createMany({ data: referenceData.brands });
      await transaction.specificationGroup.createMany({
        data: referenceData.specificationGroups,
      });
      await transaction.productAttribute.createMany({ data: referenceData.attributes });
      await transaction.attributeValue.createMany({ data: referenceData.attributeValues });
      await transaction.categorySpecificationGroup.createMany({
        data: referenceData.categorySpecificationGroups,
      });
      await transaction.categoryAttribute.createMany({ data: referenceData.categoryAttributes });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

async function createCatalogData(
  prisma: BenchmarkPrismaClient,
  context: SeedContext,
  scale: PerformanceCatalogScale,
  batchSize: number,
): Promise<void> {
  for (let ordinal = 1; ordinal <= scale; ordinal += batchSize) {
    const size = Math.min(batchSize, scale - ordinal + 1);
    const batch = buildPerformanceCatalogBatch(context, ordinal, size);
    await prisma.$transaction(
      async (transaction) => {
        await transaction.catalogProduct.createMany({ data: batch.products });
        await transaction.catalogVariant.createMany({ data: batch.variants });
        await transaction.productSku.createMany({ data: batch.skus });
        await transaction.productSpecification.createMany({ data: batch.specifications });
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    const completed = ordinal + size - 1;
    if (completed === scale || completed % 10_000 === 0) {
      console.log(`Performance fixture progress: products=${completed}/${scale}.`);
    }
  }
}

function usage(): void {
  console.log(`Phase 05.1 isolated storefront performance fixture generator

This command can only target the dedicated local PostgreSQL test database. It
does not create databases, run migrations, read production data, delete data,
or alter previously-created benchmark records.

Required environment:
  NODE_ENV=test
  APPLE333_PIM_TEST_DB=1
  PERFORMANCE_SEED_ALLOW_WRITE=1
  PIM_TEST_DATABASE_URL=postgresql://apple333_pim_test:<password>@127.0.0.1:55432/apple333_pim_test?schema=public
  DATABASE_URL=<unset, or exactly PIM_TEST_DATABASE_URL>

Required arguments:
  --execute --run-id <unique-8-to-40-char-lowercase-id> --scale <10000|100000>

Optional:
  --batch-size ${MIN_BATCH_SIZE}..${MAX_BATCH_SIZE} (default ${DEFAULT_BATCH_SIZE})

The same fully-completed run id is verification-only on a repeat execution.
Any partial run is rejected. Choose a new run id instead of repairing data in
place.`);
}

async function loadPrismaClient(): Promise<PrismaClientConstructor> {
  // The string is intentionally widened so TypeScript can type-check this
  // pure fixture-builder module even before `prisma generate` has produced a
  // local client. Runtime execution still requires that generated client.
  const prismaModule = (await import(PRISMA_CLIENT_MODULE)) as unknown as PrismaClientModule;
  return prismaModule.PrismaClient;
}

async function execute(argumentsValue: PerformanceSeedArguments): Promise<void> {
  if (!argumentsValue.runId || argumentsValue.scale === null) {
    throw new Error("--run-id and --scale are required for execution.");
  }

  const environment = validatePerformanceSeedEnvironment(process.env);
  if (!environment.ok) {
    throw new Error(
      `Performance fixture environment preflight failed: ${environment.errors.join(" ")}`,
    );
  }

  const PrismaClient = await loadPrismaClient();
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.PIM_TEST_DATABASE_URL! } },
  });
  const context = createPerformanceSeedContext(argumentsValue.runId);
  const expected = expectedRunState(argumentsValue.scale);

  try {
    await assertIsolatedMigratedDatabase(prisma);
    const before = await readRunState(prisma, context);
    if (sameRunState(before, expected)) {
      console.log(
        `Performance fixture already complete and verified: run=${context.runId}, scale=${argumentsValue.scale}.`,
      );
      return;
    }
    if (!emptyRunState(before)) {
      throw new Error(
        "This run id already has partial or unexpected benchmark records. No records were modified; choose a new run id.",
      );
    }

    await createReferenceData(prisma, context);
    await createCatalogData(
      prisma,
      context,
      argumentsValue.scale,
      argumentsValue.batchSize ?? DEFAULT_BATCH_SIZE,
    );

    const after = await readRunState(prisma, context);
    if (!sameRunState(after, expected)) {
      throw new Error(
        "Fixture verification failed after insertion. Existing records were retained and no cleanup was attempted.",
      );
    }

    console.log(
      `Performance fixture complete: run=${context.runId}, products=${after.products}, variants=${after.variants}, specifications=${after.specifications}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function isDirectExecution(): boolean {
  const invokedPath = process.argv[1] ?? "";
  return /(?:^|[\\/])seed-performance-data\.(?:ts|js)$/.test(invokedPath);
}

async function main(): Promise<void> {
  try {
    const argumentsValue = parsePerformanceSeedArguments();
    if (argumentsValue.help) {
      usage();
    } else {
      await execute(argumentsValue);
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Performance fixture execution failed.",
    );
    process.exitCode = 1;
  }
}

if (isDirectExecution()) {
  void main();
}
