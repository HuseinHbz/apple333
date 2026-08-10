import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  ORDER_E2E_ACTORS,
  ORDER_E2E_FIXTURES,
  ORDER_E2E_PASSWORD,
  ORDER_E2E_ROLE_PERMISSIONS,
} from "./order-e2e-fixtures.mjs";
import { validateOrderTestEnvironment } from "./verify-order-test-environment.mjs";

const PUBLISHED_AT = new Date("2026-07-29T00:00:00.000Z");

/**
 * This guard is intentionally independent of the command runner. It makes an
 * imported seed fail before it can receive a Prisma client for any target
 * other than the owned Phase 07 disposable database.
 */
export function validateOrderE2eSeedEnvironment(environment = process.env) {
  const preflight = validateOrderTestEnvironment(environment);
  const errors = [...preflight.errors];
  if (environment.APPLE333_ORDER_E2E_TEST_DB !== "1") {
    errors.push('APPLE333_ORDER_E2E_TEST_DB must be exactly "1".');
  }
  return { ok: errors.length === 0, errors };
}

async function upsertRolesAndActors(prisma, passwordHash) {
  const roleDefinitions = Object.entries(ORDER_E2E_ROLE_PERMISSIONS);
  const permissionCodes = [
    ...new Set(roleDefinitions.flatMap(([, permissions]) => permissions)),
  ];
  const permissionRows = await Promise.all(
    permissionCodes.map((code) =>
      prisma.permission.upsert({
        where: { code },
        create: {
          code,
          group: "orders",
          description: "Isolated Phase 07 E2E permission.",
        },
        update: {
          group: "orders",
          description: "Isolated Phase 07 E2E permission.",
        },
        select: { id: true, code: true },
      }),
    ),
  );
  const permissionIds = new Map(
    permissionRows.map((permission) => [permission.code, permission.id]),
  );
  const roleIds = new Map();

  for (const [code, permissions] of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code },
      create: {
        code,
        name: `E2E ${code}`,
        description: "Isolated Phase 07 browser-test role.",
        isSystem: true,
      },
      update: {
        name: `E2E ${code}`,
        description: "Isolated Phase 07 browser-test role.",
        isSystem: true,
      },
      select: { id: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((codeValue) => {
          const permissionId = permissionIds.get(codeValue);
          if (!permissionId)
            throw new Error(
              `Missing isolated Phase 07 permission: ${codeValue}.`,
            );
          return { roleId: role.id, permissionId };
        }),
      });
    }
    roleIds.set(code, role.id);
  }

  for (const actor of Object.values(ORDER_E2E_ACTORS)) {
    const user = await prisma.user.upsert({
      where: { id: actor.id },
      create: {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        status: "ACTIVE",
      },
      update: { email: actor.email, name: actor.name, status: "ACTIVE" },
      select: { id: true },
    });
    if (actor.roleCode === "CUSTOMER") {
      // Browser evidence exercises a real non-admin customer session. This
      // deletion targets only the fixed isolated fixture and is guarded by
      // the disposable-database preflight before this script opens Prisma.
      await prisma.adminUser.deleteMany({ where: { userId: user.id } });
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          passwordHash,
          firstName: "E2E",
          lastName: "Customer",
        },
        update: { passwordHash, firstName: "E2E", lastName: "Customer" },
      });
    } else {
      await prisma.adminUser.upsert({
        where: { userId: user.id },
        create: { userId: user.id, passwordHash, isActive: true },
        update: { passwordHash, isActive: true, branchId: null },
      });
    }
    const roleId = roleIds.get(actor.roleCode);
    if (!roleId)
      throw new Error(`Missing isolated Phase 07 role for ${actor.email}.`);
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId } });
  }
}

async function seedCatalogAndInventory(prisma) {
  const {
    category,
    product,
    variant,
    productSku,
    branch,
    warehouse,
    location,
    inventoryItem,
  } = ORDER_E2E_FIXTURES;
  await prisma.catalogCategory.upsert({
    where: { id: category.id },
    create: {
      id: category.id,
      slug: category.slug,
      name: category.name,
      isActive: true,
    },
    update: {
      slug: category.slug,
      name: category.name,
      isActive: true,
      deletedAt: null,
    },
  });
  await prisma.catalogProduct.upsert({
    where: { id: product.id },
    create: {
      id: product.id,
      categoryId: category.id,
      slug: product.slug,
      name: product.name,
      brand: "Apple",
      summary: "Deterministic isolated order E2E product.",
      description:
        "This record belongs only to the Phase 07 disposable database.",
      status: "PUBLISHED",
      publishedAt: PUBLISHED_AT,
    },
    update: {
      categoryId: category.id,
      slug: product.slug,
      name: product.name,
      brand: "Apple",
      summary: "Deterministic isolated order E2E product.",
      description:
        "This record belongs only to the Phase 07 disposable database.",
      status: "PUBLISHED",
      publishedAt: PUBLISHED_AT,
      deletedAt: null,
    },
  });
  await prisma.catalogVariant.upsert({
    where: { id: variant.id },
    create: {
      id: variant.id,
      productId: product.id,
      sku: variant.sku,
      title: variant.title,
      color: "Black",
      storage: "256GB",
      attributes: { color: "Black", storage: "256GB" },
      priceRials: variant.priceRials,
      isActive: true,
    },
    update: {
      productId: product.id,
      sku: variant.sku,
      title: variant.title,
      color: "Black",
      storage: "256GB",
      attributes: { color: "Black", storage: "256GB" },
      priceRials: variant.priceRials,
      isActive: true,
      deletedAt: null,
    },
  });
  await prisma.productSku.upsert({
    where: { id: productSku.id },
    create: {
      id: productSku.id,
      variantId: variant.id,
      code: productSku.code,
      priceRials: variant.priceRials,
      status: "ACTIVE",
    },
    update: {
      variantId: variant.id,
      code: productSku.code,
      priceRials: variant.priceRials,
      status: "ACTIVE",
      deletedAt: null,
    },
  });
  await prisma.inventorySkuPolicy.upsert({
    where: { skuId: productSku.id },
    create: { skuId: productSku.id, trackingMode: "NONE" },
    update: { trackingMode: "NONE" },
  });
  await prisma.branch.upsert({
    where: { id: branch.id },
    create: {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      kind: "STORE",
      status: "ACTIVE",
      isActive: true,
      isPickupEnabled: true,
    },
    update: {
      code: branch.code,
      name: branch.name,
      kind: "STORE",
      status: "ACTIVE",
      isActive: true,
      isPickupEnabled: true,
    },
  });
  await prisma.warehouse.upsert({
    where: { id: warehouse.id },
    create: {
      id: warehouse.id,
      branchId: branch.id,
      code: warehouse.code,
      name: warehouse.name,
      status: "ACTIVE",
    },
    update: {
      branchId: branch.id,
      code: warehouse.code,
      name: warehouse.name,
      status: "ACTIVE",
    },
  });
  await prisma.inventoryLocation.upsert({
    where: { id: location.id },
    create: {
      id: location.id,
      warehouseId: warehouse.id,
      code: location.code,
      name: location.name,
      type: "STORAGE",
      status: "ACTIVE",
    },
    update: {
      warehouseId: warehouse.id,
      code: location.code,
      name: location.name,
      type: "STORAGE",
      status: "ACTIVE",
    },
  });
  await prisma.inventoryItem.upsert({
    where: { id: inventoryItem.id },
    create: {
      id: inventoryItem.id,
      warehouseId: warehouse.id,
      locationId: location.id,
      skuId: productSku.id,
      quantity: inventoryItem.quantity,
      reservedQuantity: 0,
      availableQuantity: inventoryItem.quantity,
      version: 1,
    },
    update: {
      warehouseId: warehouse.id,
      locationId: location.id,
      skuId: productSku.id,
      quantity: inventoryItem.quantity,
      reservedQuantity: 0,
      availableQuantity: inventoryItem.quantity,
      version: 1,
    },
  });
  await prisma.branchInventory.upsert({
    where: {
      branchId_variantId: { branchId: branch.id, variantId: variant.id },
    },
    create: {
      branchId: branch.id,
      variantId: variant.id,
      onHand: inventoryItem.quantity,
      reserved: 0,
    },
    update: { onHand: inventoryItem.quantity, reserved: 0 },
  });
}

async function seedCustomerAddress(prisma) {
  const { customerAddress } = ORDER_E2E_FIXTURES;
  await prisma.address.upsert({
    where: { id: customerAddress.id },
    create: {
      ...customerAddress,
      userId: ORDER_E2E_ACTORS.CUSTOMER.id,
      isDefault: true,
    },
    update: {
      label: customerAddress.label,
      recipientName: customerAddress.recipientName,
      mobile: customerAddress.mobile,
      province: customerAddress.province,
      city: customerAddress.city,
      line1: customerAddress.line1,
      postalCode: customerAddress.postalCode,
      isDefault: true,
    },
  });
}

/**
 * Seed deterministic OMS fixtures for any explicitly acknowledged Phase 07
 * disposable database. Browser callers must additionally use the E2E wrapper
 * below, which requires its own acknowledgement marker.
 */
export async function seedOrderTestFixtures(prisma, environment = process.env) {
  const validation = validateOrderTestEnvironment(environment);
  if (!validation.ok)
    throw new Error(
      `Order fixture preflight failed: ${validation.errors.join(" ")}`,
    );

  const passwordHash = await hash(ORDER_E2E_PASSWORD, 12);
  await prisma.$transaction(
    async (transaction) => {
      await upsertRolesAndActors(transaction, passwordHash);
      await seedCatalogAndInventory(transaction);
      await seedCustomerAddress(transaction);
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

/** Seed browser fixtures only when the additional E2E acknowledgement exists. */
export async function seedOrderE2eFixtures(prisma, environment = process.env) {
  const validation = validateOrderE2eSeedEnvironment(environment);
  if (!validation.ok)
    throw new Error(
      `Order E2E fixture preflight failed: ${validation.errors.join(" ")}`,
    );
  return seedOrderTestFixtures(prisma, environment);
}

function isDirectExecution() {
  const invokedPath = process.argv[1];
  return (
    Boolean(invokedPath) &&
    resolve(invokedPath) === fileURLToPath(import.meta.url)
  );
}

async function runCli() {
  const validation = validateOrderE2eSeedEnvironment();
  if (!validation.ok) {
    console.error(
      `Order E2E fixture preflight failed: ${validation.errors.join(" ")}`,
    );
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.ORDER_TEST_DATABASE_URL } },
  });
  try {
    await seedOrderE2eFixtures(prisma);
    console.log(
      "Seeded isolated Phase 07 order E2E fixtures (catalog=1, branch=1, inventory=12, actors=2).",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Order E2E fixture seeding failed.",
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (isDirectExecution()) {
  void runCli().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Order E2E fixture seeding failed.",
    );
    process.exitCode = 1;
  });
}
