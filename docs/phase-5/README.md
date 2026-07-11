# فاز ۵ — Storefront Migration

## وضعیت فعلی

نمونهٔ static storefront نسخهٔ محلی (`local-v1`) از شاخهٔ فعلی حذف شده است؛
زیرا با Next.js App Router، Prisma و لایه‌های امنیتی نسخهٔ Enterprise یکپارچه
نبود. نسخهٔ کامل آن در شاخهٔ `legacy/local-v1` و تگ `v1.0-local` باقی مانده
است. جزئیات حذف در [Legacy cleanup](../legacy-removal/phase-03-cleanup.md)
ثبت شده است.

## هدف فاز

Storefront جدید باید با Next.js + TypeScript، مسیرهای `(store)`، داده‌های
معتبر server-side و طراحی Apple Premium ساخته شود. هیچ HTML/JS قدیمی یا
دادهٔ نمایشی نباید دوباره به runtime جدید برگردد.

## الزامات انتقال

- Catalog، product detail، compare، wishlist و cart باید به Routeهای typed
  App Router تبدیل شوند.
- قیمت، موجودی، تخفیف، سبد و checkout فقط از APIهای معتبر server-side تغذیه
  شوند.
- SEO با metadata، sitemap و robots metadata routeهای Next.js مدیریت شود.
- تصاویر از object storage/CDN و media module فعلی دریافت شوند.
- WCAG 2.2 AA، RTL، E2E، تست visual و performance پیش از release ضروری است.

## کیفیت موردنیاز

هدف‌های production: LCP کمتر از 2.5 ثانیه، INP کمتر از 200ms، CLS کمتر از
0.1 و Lighthouse با دادهٔ واقعی. امتیاز 9.8/10 فقط بعد از parity واقعی،
تست کاربر و quality gateهای production قابل تأیید است.
