# Authentication and RBAC Foundation

`Session`, `Account` and `VerificationToken` are proposed in Prisma for an Auth.js-compatible architecture. Cookie settings are httpOnly, secure in production and SameSite Lax. The current `currentActor()` returns `null`; this is intentional fail-closed behavior until a configured provider/session repository is implemented.

Initial roles are represented by `RoleCode`: SUPER_ADMIN, ADMIN, BUSINESS_OWNER, BRANCH_MANAGER, SALES_STAFF, WAREHOUSE_STAFF, FINANCE_STAFF, SUPPORT_STAFF and CUSTOMER. Permissions use `resource.action`; all protected routes must enforce them on the server. Branch scope is retained as an actor extension point, not UI-only logic.
