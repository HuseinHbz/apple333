import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  PAYMENT_E2E_ACTORS,
  PAYMENT_E2E_FIXTURES,
  PAYMENT_E2E_PASSWORD,
  PAYMENT_E2E_SECRET,
} from "../../scripts/payment-e2e-fixtures.mjs";

test.describe.configure({ mode: "serial" });

async function login(
  page: Page,
  actor: (typeof PAYMENT_E2E_ACTORS)[keyof typeof PAYMENT_E2E_ACTORS],
  callbackUrl: string,
) {
  await page.goto(
    `/account/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
  );
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(PAYMENT_E2E_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(callbackUrl.replaceAll("/", "\\/")));
}

let successAuthority = "";

test.describe("Phase 08 payment browser journeys", () => {
  test("customer reaches the canonical payment from order history", async ({
    page,
  }) => {
    const fixture = PAYMENT_E2E_FIXTURES.successOrder;
    await login(
      page,
      PAYMENT_E2E_ACTORS.CUSTOMER,
      `/account/orders/${fixture.orderNumber}`,
    );
    await expect(page.getByTestId("order-payment-summary")).toBeVisible();
    await page.getByRole("link", { name: "مشاهده پرداخت" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/checkout/payment/${fixture.paymentId}$`),
    );
    await expect(page.getByTestId("customer-payment-actions")).toBeVisible();
  });

  test("declined simulator payment remains failed and can be retried", async ({
    page,
  }) => {
    const fixture = PAYMENT_E2E_FIXTURES.failedOrder;
    await login(
      page,
      PAYMENT_E2E_ACTORS.CUSTOMER,
      `/checkout/payment/${fixture.paymentId}`,
    );
    await page.getByLabel("سناریوی درگاه آزمایشی").selectOption("declined");
    await page
      .getByRole("button", { name: "ورود به درگاه امن آزمایشی" })
      .click();
    await expect(page).toHaveURL(/\/return\?authority=/);
    await expect(page.getByTestId("payment-return-verifier")).toContainText(
      "پرداخت تأیید نشد",
    );
    await expect(page.getByRole("link", { name: "تلاش دوباره" })).toBeVisible();
  });

  test("a failed payment can be retried and cancelled without paying the order", async ({
    page,
  }) => {
    const fixture = PAYMENT_E2E_FIXTURES.failedOrder;
    await login(
      page,
      PAYMENT_E2E_ACTORS.CUSTOMER,
      `/checkout/payment/${fixture.paymentId}`,
    );
    await page.getByLabel("سناریوی درگاه آزمایشی").selectOption("cancelled");
    await page
      .getByTestId("customer-payment-actions")
      .getByRole("button")
      .click();
    await expect(page).toHaveURL(/\/return\?authority=/);
    await expect(page.getByTestId("payment-return-verifier")).toContainText(
      "پرداخت تأیید نشد",
    );
    const state = await page.evaluate(async (id) => {
      const response = await fetch(`/api/store/payments/${id}`);
      return { status: response.status, body: await response.json() };
    }, fixture.paymentId);
    expect(state.status).toBe(200);
    expect(state.body.data.status).toBe("CANCELLED");
  });

  test("successful simulator payment is verified server-side", async ({
    page,
  }) => {
    const fixture = PAYMENT_E2E_FIXTURES.successOrder;
    await login(
      page,
      PAYMENT_E2E_ACTORS.CUSTOMER,
      `/checkout/payment/${fixture.paymentId}`,
    );
    await page
      .getByRole("button", { name: "ورود به درگاه امن آزمایشی" })
      .click();
    await expect(page).toHaveURL(/\/return\?authority=/);
    successAuthority = new URL(page.url()).searchParams.get("authority") ?? "";
    expect(successAuthority).toMatch(/^SIM-success-/);
    await expect(page.getByTestId("payment-return-verifier")).toContainText(
      "پرداخت با موفقیت",
    );
  });

  test("duplicate signed success callback has one canonical payment result", async ({
    request,
  }) => {
    const externalEventId = `e2e-event-${crypto.randomUUID()}`;
    const signaturePayload = `${externalEventId}:${successAuthority}:success`;
    const signature = createHmac("sha256", PAYMENT_E2E_SECRET)
      .update(signaturePayload)
      .digest("hex");
    const payload = {
      externalEventId,
      authority: successAuthority,
      signature,
      scenario: "success",
    };
    const first = await request.post(
      "/api/payments/callback/PAYMENT_SIMULATOR",
      { data: payload },
    );
    const second = await request.post(
      "/api/payments/callback/PAYMENT_SIMULATOR",
      { data: payload },
    );
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
  });

  test("invalid callback signature fails closed", async ({ request }) => {
    const payload = {
      externalEventId: `invalid-${crypto.randomUUID()}`,
      authority: successAuthority,
      signature: "0".repeat(64),
      scenario: "success",
    };
    const first = await request.post(
      "/api/payments/callback/PAYMENT_SIMULATOR",
      { data: payload },
    );
    const replay = await request.post(
      "/api/payments/callback/PAYMENT_SIMULATOR",
      { data: payload },
    );
    expect(first.status()).toBe(401);
    expect(replay.status()).toBe(401);
  });

  test("order history reflects the verified PAID projection", async ({
    page,
  }) => {
    const fixture = PAYMENT_E2E_FIXTURES.successOrder;
    await login(
      page,
      PAYMENT_E2E_ACTORS.CUSTOMER,
      `/account/orders/${fixture.orderNumber}`,
    );
    await expect(page.getByTestId("order-payment-summary")).toContainText(
      "پرداخت موفق",
    );
  });

  test("another customer cannot read a foreign payment", async ({ page }) => {
    const fixture = PAYMENT_E2E_FIXTURES.successOrder;
    await login(page, PAYMENT_E2E_ACTORS.OTHER_CUSTOMER, "/account/orders");
    const response = await page.evaluate(async (id) => {
      const result = await fetch(`/api/store/payments/${id}`);
      return { status: result.status, body: await result.json() };
    }, fixture.paymentId);
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test("finance sees payment evidence and can reconcile", async ({ page }) => {
    const fixture = PAYMENT_E2E_FIXTURES.successOrder;
    await login(
      page,
      PAYMENT_E2E_ACTORS.FINANCE,
      `/admin/payments/${fixture.paymentId}`,
    );
    await expect(page.getByText("تراکنش‌های تغییرناپذیر")).toBeVisible();
    const response = await page.evaluate(async (id) => {
      const result = await fetch(`/api/admin/payments/${id}/reconcile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `e2e-reconcile:${crypto.randomUUID()}`,
        }),
      });
      return { status: result.status, body: await result.json() };
    }, fixture.paymentId);
    expect(response.status).toBe(200);
    expect(response.body.data.differenceType).toBe("NONE");
  });

  test("order manager cannot issue refunds", async ({ page }) => {
    const fixture = PAYMENT_E2E_FIXTURES.successOrder;
    await login(page, PAYMENT_E2E_ACTORS.ORDER_MANAGER, "/admin/payments");
    const status = await page.evaluate(async (id) => {
      const result = await fetch(`/api/admin/payments/${id}/refunds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `e2e-refund:${crypto.randomUUID()}`,
          amountRials: "1",
          reason: "Unauthorized refund attempt",
          scenario: "refund_success",
        }),
      });
      return result.status;
    }, fixture.paymentId);
    expect(status).toBe(403);
  });
});
