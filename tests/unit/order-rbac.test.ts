import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/errors/app-error";
import {
  requireOrderBranchAccess,
  resolveOrderBranchScope,
  type Permission,
  type SessionActor,
} from "@/server/security/permissions";

function actor(overrides: Partial<SessionActor>): SessionActor {
  return {
    id: "actor-1",
    isAdmin: true,
    roleCodes: ["ORDER_MANAGER"],
    permissions: new Set<Permission>(["orders.read"]),
    ...overrides,
  };
}

describe("order RBAC branch scope", () => {
  it("allows explicitly governed global roles to access all branches", () => {
    const globalActor = actor({
      roleCodes: ["ORDER_MANAGER"],
      branchId: "branch-a",
    });
    expect(resolveOrderBranchScope(globalActor)).toBeUndefined();
    expect(() =>
      requireOrderBranchAccess(globalActor, "branch-b"),
    ).not.toThrow();
  });

  it("fails closed for an unbound branch role", () => {
    const unbound = actor({ roleCodes: ["BRANCH_MANAGER"], branchId: null });
    expect(() => resolveOrderBranchScope(unbound)).toThrow(AuthorizationError);
  });

  it("prevents a branch-scoped operator from crossing branch ownership", () => {
    const branchActor = actor({
      roleCodes: ["BRANCH_OPERATOR"],
      branchId: "branch-a",
    });
    expect(resolveOrderBranchScope(branchActor)).toBe("branch-a");
    expect(() =>
      requireOrderBranchAccess(branchActor, "branch-a"),
    ).not.toThrow();
    expect(() => requireOrderBranchAccess(branchActor, "branch-b")).toThrow(
      AuthorizationError,
    );
  });
});
