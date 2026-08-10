import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/errors/app-error";
import {
  requirePaymentBranchAccess,
  resolvePaymentBranchScope,
  type Permission,
  type SessionActor,
} from "@/server/security/permissions";

function actor(overrides: Partial<SessionActor>): SessionActor {
  return {
    id: "actor-payment-1",
    isAdmin: true,
    roleCodes: ["FINANCE_MANAGER"],
    permissions: new Set<Permission>(["payments.read"]),
    ...overrides,
  };
}

describe("Phase 08 payment RBAC scope", () => {
  it("allows finance managers to operate across governed branches", () => {
    expect(
      resolvePaymentBranchScope(actor({ branchId: "branch-a" })),
    ).toBeUndefined();
  });

  it("binds branch managers to their assigned branch", () => {
    const branchManager = actor({
      roleCodes: ["BRANCH_MANAGER"],
      branchId: "branch-a",
    });
    expect(resolvePaymentBranchScope(branchManager)).toBe("branch-a");
    expect(() => requirePaymentBranchAccess(branchManager, "branch-b")).toThrow(
      AuthorizationError,
    );
  });

  it("fails closed for an unbound non-global payment actor", () => {
    expect(() =>
      resolvePaymentBranchScope(
        actor({ roleCodes: ["BRANCH_MANAGER"], branchId: null }),
      ),
    ).toThrow(AuthorizationError);
  });
});
