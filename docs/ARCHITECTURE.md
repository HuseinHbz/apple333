# معماری هدف

## انتخاب‌ها

| لایه | انتخاب پیشنهادی | دلیل |
|---|---|---|
| وب | Next.js + TypeScript | SEO، عملکرد، پنل و فروشگاه در یک کدبیس |
| API | NestJS + TypeScript | ماژولار، RBAC، صف و قراردادهای API روشن |
| دادهٔ اصلی | PostgreSQL | تراکنش‌های مالی، انبار و روابط پیچیده |
| Cache / session | Redis | OTP، نرخ‌دهی، صف‌های سبک و Cache |
| جست‌وجو | Meilisearch در شروع، OpenSearch در مقیاس | جست‌وجوی سریع کالا و فیلترها |
| فایل و مدیا | S3-compatible object storage | تصاویر کالا و مدارک با URL امضاشده |
| صف | BullMQ / Redis؛ سپس RabbitMQ در صورت نیاز | اعلان، پردازش مدیا و همگام‌سازی |
| مشاهده‌پذیری | Sentry + OpenTelemetry + Grafana | خطا، ردیابی و شاخص‌های عملیات |
| استقرار | Docker + CI/CD | محیط‌های تکرارپذیر و انتشار کنترل‌شده |

## اصول طراحی

- ابتدا Modular Monolith؛ جداسازی سرویس‌ها فقط با نیاز واقعی مقیاس یا مالکیت مستقل.
- تمام مبلغ‌ها به `rial` به‌شکل عدد صحیح ذخیره و برای نمایش به تومان تبدیل می‌شوند.
- هر تغییر قیمت، موجودی، اقساط و وضعیت Trade-in دارای تاریخچه و کاربر انجام‌دهنده است.
- مدارک کاربران رمزنگاری و دسترسی آن‌ها محدود، زمان‌دار و قابل ممیزی خواهد بود.
- APIها نسخه‌دار هستند و مجوز دسترسی را در سمت سرور بررسی می‌کنند.

## دامنه‌های اصلی

```text
Identity ── Customers ── Orders ── Payments
                  │            │
Catalog ── Inventory/Branches ── Installments
                  │
             Trade-in ── Used-device Pricing
                  │
          Notifications / CRM / Reporting
```

## مدل‌های کلیدی فازهای ۱ و ۲

- `User`, `Role`, `Permission`, `Session`, `Address`, `CustomerDocument`
- `Branch`, `Warehouse`, `Product`, `ProductVariant`, `StockItem`, `DeviceUnit`
- `AuditLog`, `Notification`, `PriceHistory`, `InventoryMovement`

## مرزهای مهم

- اطلاعات و فرآیند مالی اقساط باید قبل از انتشار با واحد مالی و حقوقی تأیید شوند.
- اتصال به درگاه پرداخت، پیامک، استعلام گارانتی و منابع بیرونی پس از انتخاب رسمی تأمین‌کننده انجام می‌شود.
- خزش یا جمع‌آوری آگهی فقط با اجازه و روش مجاز همان پلتفرم اجرا خواهد شد.
