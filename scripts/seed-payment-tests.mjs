import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import {
  PAYMENT_E2E_ACTORS,
  PAYMENT_E2E_FIXTURES,
  PAYMENT_E2E_PASSWORD,
} from "./payment-e2e-fixtures.mjs";
import { validatePaymentTestEnvironment } from "./verify-payment-test-environment.mjs";

const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
if (process.env.APPLE333_PAYMENT_E2E_TEST_DB !== "1")
  throw new Error("APPLE333_PAYMENT_E2E_TEST_DB must be exactly 1.");
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;
const prisma = new PrismaClient();
const passwordHash = await hash(PAYMENT_E2E_PASSWORD, 12);

const rolePermissions = {
  CUSTOMER: ["orders.read_own"],
  FINANCE_MANAGER: [
    "payments.read",
    "payments.read_financial",
    "payments.verify",
    "payments.reconcile",
    "payments.refund",
    "payments.audit.read",
    "payments.provider_reference.read",
  ],
  ORDER_MANAGER: ["payments.read"],
};

try {
  const permissionIds = new Map();
  for (const code of [...new Set(Object.values(rolePermissions).flat())]) {
    const permission = await prisma.permission.upsert({
      where: { code },
      create: {
        code,
        group: "payments",
        description: "Phase 08 E2E permission",
      },
      update: {},
    });
    permissionIds.set(code, permission.id);
  }
  const roleIds = new Map();
  for (const [code, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: `E2E ${code}`, isSystem: true },
      update: {},
    });
    roleIds.set(code, role.id);
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permissionIds.get(permission),
      })),
      skipDuplicates: true,
    });
  }
  for (const [name, actor] of Object.entries(PAYMENT_E2E_ACTORS)) {
    await prisma.user.upsert({
      where: { id: actor.id },
      create: { id: actor.id, email: actor.email, name: `Phase 08 ${name}` },
      update: { email: actor.email, status: "ACTIVE" },
    });
    if (actor.roleCode === "CUSTOMER") {
      await prisma.userProfile.upsert({
        where: { userId: actor.id },
        create: {
          userId: actor.id,
          passwordHash,
          firstName: "E2E",
          lastName: "Payment",
        },
        update: { passwordHash },
      });
    } else {
      await prisma.adminUser.upsert({
        where: { userId: actor.id },
        create: { userId: actor.id, passwordHash, isActive: true },
        update: { passwordHash, isActive: true, branchId: null },
      });
    }
    await prisma.userRole.createMany({
      data: [{ userId: actor.id, roleId: roleIds.get(actor.roleCode) }],
      skipDuplicates: true,
    });
  }
  const definitions = [
    [PAYMENT_E2E_FIXTURES.successOrder, PAYMENT_E2E_ACTORS.CUSTOMER.id],
    [PAYMENT_E2E_FIXTURES.failedOrder, PAYMENT_E2E_ACTORS.CUSTOMER.id],
    [PAYMENT_E2E_FIXTURES.otherOrder, PAYMENT_E2E_ACTORS.OTHER_CUSTOMER.id],
  ];
  for (const [fixture, customerId] of definitions) {
    await prisma.order.upsert({
      where: { id: fixture.id },
      create: {
        id: fixture.id,
        orderNumber: fixture.orderNumber,
        source: "STOREFRONT",
        type: "STANDARD_SALE",
        customerId,
        customerSnapshot: { id: customerId, name: "Phase 08 E2E Customer" },
        currency: "IRR",
        subtotalRials: fixture.amountRials,
        grandTotalRials: fixture.amountRials,
        fulfillmentMethod: "DELIVERY",
        orderStatus: "PENDING_CONFIRMATION",
      },
      update: { paymentStatus: "UNPAID" },
    });
    await prisma.payment.upsert({
      where: { id: fixture.paymentId },
      create: {
        id: fixture.paymentId,
        orderId: fixture.id,
        paymentNumber: fixture.paymentNumber,
        amountRials: fixture.amountRials,
        currency: "IRR",
        provider: "PAYMENT_SIMULATOR",
      },
      update: {
        status: "CREATED",
        paidAt: null,
        failedAt: null,
        cancelledAt: null,
        expiresAt: null,
      },
    });
  }
  console.log("Phase 08 payment E2E fixtures are ready.");
} finally {
  await prisma.$disconnect();
}
