import { describe, expect, it } from "vitest";

import {
  PERFORMANCE_CATALOG_SCALES,
  PERFORMANCE_SPECIFICATIONS_PER_PRODUCT,
  PERFORMANCE_VARIANTS_PER_PRODUCT,
  buildPerformanceCatalogBatch,
  buildPerformanceReferenceData,
  createPerformanceSeedContext,
  parsePerformanceSeedArguments,
  validatePerformanceSeedEnvironment,
} from "../../scripts/seed-performance-data";

describe("Phase 05.1 performance fixture generator", () => {
  it("limits the supported catalog scales to 10k and 100k", () => {
    expect(PERFORMANCE_CATALOG_SCALES).toEqual([10_000, 100_000]);
    expect(() =>
      parsePerformanceSeedArguments([
        "--execute",
        "--run-id",
        "phase051-100k",
        "--scale",
        "50000",
      ]),
    ).toThrow("--scale must be exactly 10000 or 100000.");
  });

  it("builds deterministic catalog records with variants and specifications", () => {
    const context = createPerformanceSeedContext("phase051-10k");
    const first = buildPerformanceCatalogBatch(context, 1, 2);
    const repeated = buildPerformanceCatalogBatch(context, 1, 2);

    expect(first).toEqual(repeated);
    expect(first.products).toHaveLength(2);
    expect(first.variants).toHaveLength(2 * PERFORMANCE_VARIANTS_PER_PRODUCT);
    expect(first.skus).toHaveLength(2 * PERFORMANCE_VARIANTS_PER_PRODUCT);
    expect(first.specifications).toHaveLength(
      2 * PERFORMANCE_SPECIFICATIONS_PER_PRODUCT,
    );
    expect(first.products[0]).toMatchObject({
      status: "PUBLISHED",
      brand: "Benchmark Apple",
      searchText: expect.stringContaining("phase-05.1-performance:phase051-10k"),
    });
    expect(first.variants[0]).toMatchObject({
      color: "Black Titanium",
      storage: "128GB",
      isActive: true,
    });
  });

  it("builds reference categories, brands, attributes, and attribute values", () => {
    const context = createPerformanceSeedContext("phase051-reference");
    const reference = buildPerformanceReferenceData(context);

    expect(reference.categories).toHaveLength(6);
    expect(reference.brands).toHaveLength(4);
    expect(reference.attributes).toHaveLength(PERFORMANCE_SPECIFICATIONS_PER_PRODUCT);
    expect(reference.attributeValues).toHaveLength(
      PERFORMANCE_SPECIFICATIONS_PER_PRODUCT * PERFORMANCE_VARIANTS_PER_PRODUCT,
    );
    expect(reference.categoryAttributes).toHaveLength(
      6 * PERFORMANCE_SPECIFICATIONS_PER_PRODUCT,
    );
  });

  it("rejects production-like environments before a database client is loaded", () => {
    const result = validatePerformanceSeedEnvironment({
      NODE_ENV: "production",
      APPLE333_PIM_TEST_DB: "0",
      PERFORMANCE_SEED_ALLOW_WRITE: "0",
      PIM_TEST_DATABASE_URL:
        "postgresql://postgres:password@example.com:5432/apple333?schema=public",
      DATABASE_URL: "postgresql://postgres:password@example.com:5432/apple333?schema=public",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'NODE_ENV must be exactly "test".',
        'APPLE333_PIM_TEST_DB must be exactly "1".',
        'PERFORMANCE_SEED_ALLOW_WRITE must be exactly "1".',
        "PIM_TEST_DATABASE_URL host must be exactly 127.0.0.1.",
      ]),
    );
  });
});
