# سند معماری فنی

## تصمیم معماری

**Modular Monolith مبتنی بر Domain** برای انتشار اول انتخاب می‌شود: پیچیدگی عملیاتی کمتر از microservice دارد، مرزهای دامنه را روشن نگه می‌دارد و بعداً سرویس‌های پرمصرف مانند Search، Pricing یا Notification جداشدنی‌اند.

```text
Web / Admin (Next.js) ── API Gateway (NestJS)
                              │
  Identity · Catalog · Inventory · Orders · Payments · Installments
  Trade-in · Pricing · CRM · Content · Notifications · Reporting
                              │
PostgreSQL · Redis · Search · Object Storage · Queue · Observability
```

## فناوری‌های پیشنهادی

| لایه | انتخاب | چرایی |
|---|---|---|
| فروشگاه و پنل | Next.js + TypeScript | SSR/ISR برای SEO، عملکرد و یک کدبیس وب |
| UI | Tailwind CSS + Radix/shadcn primitives | Design token، دسترس‌پذیری، سرعت توسعه |
| state کلاینت | TanStack Query + Zustand | cache سرور و state محلی کوچک و قابل تست |
| API | NestJS + REST versioned + OpenAPI | ماژول، validation، guard و قرارداد مستند |
| هویت | OTP/Password + session کوتاه‌عمر + refresh rotation | تجربهٔ ایران‌محور و کنترل session |
| دادهٔ اصلی | PostgreSQL | ACID برای سفارش، انبار و امور مالی |
| cache/queue | Redis + BullMQ | OTP، rate limit، cache و jobهای پس‌زمینه |
| جست‌وجو | Meilisearch ابتدا، OpenSearch در مقیاس | فیلتر faceted سریع و مسیر ارتقا |
| فایل | S3-compatible storage | مدرک و مدیا با URL امضاشده، lifecycle و CDN |
| رویداد/خطا | OpenTelemetry + Sentry + Grafana/Loki | trace، alert و debugging تولید |

## مرز ماژول‌ها

- **Identity:** کاربر، نقش، permission، session، OTP، دستگاه معتبر.
- **Catalog:** دسته، محصول اصلی، variant، مشخصات، مدیا و قیمت منتشرشده.
- **Inventory:** شعبه، انبار، موجودی، رزرو، انتقال و DeviceUnit.
- **Commerce:** سبد، سفارش، پرداخت، ارسال و بازگشت.
- **Finance:** تقسیط، مدارک، قرارداد، برنامهٔ پرداخت و وضعیت مطالبات.
- **Trade-in/Pricing:** ارزیابی، قوانین قیمت، گرید دستگاه، پیشنهاد و تاریخچه.
- **CRM/Content:** مشتری، امتیاز، کیف پول، تیکت، مقاله و کمپین.

ماژول‌ها فقط از قراردادهای سرویس یا رویداد دامنه استفاده می‌کنند؛ اتصال مستقیم به جدول ماژول دیگر ممنوع است مگر read model تعریف‌شده.

## API و Jobها

- REST زیر `/api/v1`، پاسخ‌های استاندارد، pagination cursor و idempotency key برای عملیات مالی.
- webhook پرداخت با امضای ارائه‌دهنده، ثبت خام درخواست و پردازش idempotent.
- Jobها: ارسال اعلان، تبدیل مدیا، sync مشخصات مجاز، index جست‌وجو، گزارش روزانه و یادآوری اقساط.
- Outbox pattern برای انتشار مطمئن رویداد پس از commit دیتابیس.

## SEO و عملکرد

- صفحات محصول، دسته و مقاله با SSR/ISR، metadata، canonical، JSON-LD Product/Breadcrumb/Article.
- تصاویر AVIF/WebP، CDN، lazy loading، اندازه‌های مشخص و Web Vitals budget.
- هدف: LCP کمتر از 2.5s، INP کمتر از 200ms و CLS کمتر از 0.1 در اتصال هدف.

## اتصال‌های بیرونی

هر ارائه‌دهنده پشت interface adapter قرار می‌گیرد: `PaymentProvider`، `SmsProvider`، `ShippingProvider`، `ExchangeRateProvider` و `MarketDataProvider`. secrets در vault نگهداری و هیچ‌گاه در کلاینت یا commit قرار نمی‌گیرند. دریافت داده از Apple، دیوار و شیپور فقط با مجوز/API رسمی و رعایت rate limit و terms انجام می‌شود.
