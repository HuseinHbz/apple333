export const PAYMENT_E2E_PASSWORD = "E2E-Payment-Password-2026";
export const PAYMENT_E2E_SECRET = "phase08-e2e-simulator-secret-with-32chars";

export const PAYMENT_E2E_ACTORS = Object.freeze({
  CUSTOMER: Object.freeze({
    id: "c000000000000000000000081",
    email: "e2e-phase08-customer@example.test",
    roleCode: "CUSTOMER",
  }),
  OTHER_CUSTOMER: Object.freeze({
    id: "c000000000000000000000082",
    email: "e2e-phase08-other@example.test",
    roleCode: "CUSTOMER",
  }),
  FINANCE: Object.freeze({
    id: "c000000000000000000000083",
    email: "e2e-phase08-finance@example.test",
    roleCode: "FINANCE_MANAGER",
  }),
  ORDER_MANAGER: Object.freeze({
    id: "c000000000000000000000084",
    email: "e2e-phase08-order-manager@example.test",
    roleCode: "ORDER_MANAGER",
  }),
});

export const PAYMENT_E2E_FIXTURES = Object.freeze({
  successOrder: Object.freeze({
    id: "o000000000000000000000081",
    orderNumber: "A33-PAY-E2E-SUCCESS",
    paymentId: "p000000000000000000000081",
    paymentNumber: "PAY-E2E-SUCCESS",
    amountRials: 8_800_000n,
  }),
  failedOrder: Object.freeze({
    id: "o000000000000000000000082",
    orderNumber: "A33-PAY-E2E-FAILED",
    paymentId: "p000000000000000000000082",
    paymentNumber: "PAY-E2E-FAILED",
    amountRials: 9_900_000n,
  }),
  otherOrder: Object.freeze({
    id: "o000000000000000000000083",
    orderNumber: "A33-PAY-E2E-OTHER",
    paymentId: "p000000000000000000000083",
    paymentNumber: "PAY-E2E-OTHER",
    amountRials: 7_700_000n,
  }),
});
