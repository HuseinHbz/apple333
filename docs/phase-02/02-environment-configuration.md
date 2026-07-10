# Environment Configuration

`.env.example` تنها نام متغیرها و placeholder امن دارد. فایل‌های `.env*`، key و credential در `.gitignore` قرار گرفته‌اند. `src/config/env.ts` متغیرهای server-only را با Zod کنترل می‌کند و هیچ secret را به client export نمی‌کند.

در development، Redis/S3 اختیاری هستند و readiness آن‌ها را به‌صورت disabled گزارش می‌کند. در production، `DATABASE_URL`، `AUTH_SECRET` و `APP_URL` اجباری‌اند؛ Redis/S3 در صورت فعال‌شدن feature مربوطه باید پیکربندی معتبر داشته باشند.
