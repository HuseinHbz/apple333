# Phase 02 Audit Review

## Verified architecture

Baseline شامل storefront استاتیک، dashboard استاتیک و `server.py` با SQLite است. هیچ Next.js، TypeScript، Prisma، test runner یا CI در baseline وجود نداشت. SQLite و Python MVP حفظ می‌شوند و در این فاز تغییر نمی‌کنند.

## Reuse / refactor / replacement

- **Reuse as reference:** design tokens/layoutهای storefront، lifecycle موجودی/سفارش و مفهوم Audit Log.
- **Refactor later:** product card، catalog، compare و cart local state به React component و typed module.
- **Replace:** HTTP server Python، caller-controlled authorization، SQLite startup DDL و mock payment.

## Critical blockers

- نقش پیش‌فرض admin و هویت header-controlled در `server.py`.
- نداشتن runtime و dependency manifest Node.
- نداشتن PostgreSQL/Prisma/migration history و تست/CI.

## Unknown items

منبع حقیقت کاربران/محصولات، PostgreSQL staging، Redis/MinIO، SMS/Auth provider، payment provider، domain/DNS و سیاست نگهداری داده در repository موجود نیستند.

## Phase 02 boundary

این فاز foundation جدید را در `src/` اضافه می‌کند و صفحات/سرور legacy را حذف یا rewrite نمی‌کند. Prisma schema فقط proposal/validation است؛ migration و اتصال به database اجرا نمی‌شود.
