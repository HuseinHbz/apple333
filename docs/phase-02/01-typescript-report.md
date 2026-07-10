# TypeScript Report

## Initial state

قبل از Phase 02 هیچ فایل TypeScript، `tsconfig.json` یا typecheck script وجود نداشت؛ بنابراین شمار خطای اولیه **N/A** است، نه صفر.

## Configuration

`tsconfig.json` strict mode، `noUncheckedIndexedAccess`، `noImplicitOverride`، `exactOptionalPropertyTypes`، `forceConsistentCasingInFileNames`، `noFallthroughCasesInSwitch` و `isolatedModules` را فعال می‌کند.

## Final state

پس از نصب dependency و Prisma client generation، معیار نهایی `pnpm typecheck` است. هیچ `any`، `@ts-ignore` یا cast دو مرحله‌ای در foundation مجاز نیست. هر exception آینده باید در این سند با دلیل و scope ثبت شود.
