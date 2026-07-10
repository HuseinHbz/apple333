# Database Change Plan — Before Prisma Schema

## Existing models

SQLite runtime دارای inventory، orders، payments، carts، wallets و audit concepts است. SQL PostgreSQL موجود تنها inventory Phase 3 را توصیف می‌کند. Prisma schema یا migration history وجود ندارد.

## Proposed Phase 02 schema

فقط identity foundation: `User`, `UserProfile`, `Address`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Session`, `Account`, `VerificationToken`, `SystemSetting`, `AuditLog`.

## Impact and data-loss risk

در این phase هیچ migration، reset، `db push`، drop یا تغییر SQLite اجرا نمی‌شود. `prisma/schema.prisma` یک proposal قابل validate است و به دادهٔ موجود وصل نمی‌شود. ریسک data loss در این commit **صفر** است زیرا هیچ database command اجرا نخواهد شد.

## Next migration requirements

پیش از اولین migration: ERD approval، PostgreSQL staging، backup/restore rehearsal، migration SQL review، dry run و rollback/runbook لازم است. نام migration آینده `phase_02_identity_foundation` خواهد بود و فقط additive است.
