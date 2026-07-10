# فاز ۴ — Order Management، Payment، Checkout و Delivery

## ۱. معماری سفارش

Checkout یک transaction اتمیک است: سرور قیمت catalog را محاسبه می‌کند، کوپن/کیف پول را اعمال می‌کند، device را از فاز ۳ رزرو می‌کند، سفارش/فاکتور/payment/shipment/timeline را می‌سازد و Audit Event ثبت می‌کند. وضعیت‌ها: `pending → confirmed → processing → packed → shipping → delivered → completed` با مسیرهای لغو/مرجوعی/بازپرداخت کنترل‌شده. تکمیل سفارش، device رزروشده را به `sold` تبدیل می‌کند؛ لغو آن را آزاد می‌کند.

## ۲. Checkout و سبد

- Cart مهمان با guest token هش‌شده و Cart کاربر با customer ID، TTL چهارده روز و merge در login.
- Checkout: اطلاعات → آدرس/تحویل → روش ارسال → پرداخت → بازبینی → تکمیل.
- تحویل شعبه، branch را اجباری می‌کند؛ ارسال از انبار مرکزی انجام می‌شود.
- قیمت، تخفیف، حمل و مبلغ قابل پرداخت فقط در server authority تعیین می‌شود.

## ۳. پرداخت

Adapter استاندارد `PaymentProvider` برای ZarinPal، IDPay، Mellat، Saman و wallet در production لازم است. نسخهٔ محلی provider `mock` دارد تا callback/تأیید، idempotency و timeline قابل تست باشد. callback واقعی باید signature، amount، authority، order lock و replay را اعتبارسنجی کند؛ هرگز موفقیت برگشتی مرورگر به‌تنهایی معتبر نیست.

## ۴. حمل و رهگیری

Providerهای Post، Tipax، SnapBox، Express و Pickup از یک shipping quote interface استفاده می‌کنند: cost، insurance، ETA، وزن/ابعاد و tracking. shipment با order یک‌به‌یک است و tracking timeline از `order_status_history` و shipment تولید می‌شود. quoteهای فعلی local هستند و پیش از قرارداد provider نباید به‌عنوان نرخ واقعی عرضه شوند.

## ۵. فاکتور

هر سفارش یک invoice number و snapshot immutable از مشتری، کالا، مالیات، تخفیف، ارسال، بیمه و مبلغ نهایی می‌گیرد. خروجی PDF production باید server-side ایجاد، QR دارای URL امضاشده و دسترسی customer/finance داشته باشد؛ در نسخهٔ محلی endpoint JSON فاکتور آماده است.

## ۶. تخفیف، کارت هدیه و کیف پول

Coupon rules حداقل خرید، سقف، بازهٔ زمانی، گروه مشتری، شعبه و category scope دارند. ledger کیف پول immutable و transaction-based است؛ balance از آن یا projection محافظت‌شده حاصل می‌شود. Gift card با code hash، مانده و expiry ذخیره می‌شود. کد نمونه `WELCOME10` فقط برای local demo است.

## ۷. Database schema

`addresses`, `carts`, `cart_items`, `coupon_rules`, `coupon_redemptions`, `gift_cards`, `wallets`, `wallet_transactions`, `orders`, `order_items`, `payments`, `payment_logs`, `invoices`, `shipments`, `order_status_history`.

Indexهای اجباری: `(customer_id, created_at DESC)` برای سفارش، `(status, created_at DESC)` برای صف عملیات، `(order_id,status)` برای payment، tracking code و cart expiry. order number، invoice number، payment authority و idempotency key یکتا هستند. مبلغ‌ها integer ریال و snapshotها immutable اند.

## ۸. API

| Endpoint | هدف |
|---|---|
| `POST /api/v1/carts`, `POST /api/v1/carts/:id/items` | Cart مهمان/کاربر |
| `POST /api/v1/coupons/validate` | اعتبارسنجی تخفیف |
| `POST /api/v1/checkout` | سفارش، رزرو، payment و shipment اتمیک |
| `POST /api/v1/payments/:id/confirm` | تأیید mock callback |
| `GET /api/v1/orders`, `GET /api/v1/orders/:id` | پنل عملیات و مشتری |
| `PATCH /api/v1/orders/:id/status` | workflow role-aware |
| `GET /api/v1/invoices/:id`, `GET /api/v1/tracking/:id` | فاکتور و timeline |
| `GET /api/v1/wallet` | مانده wallet |

## ۹. پنل‌ها

Admin: صف سفارش، پرداخت، refund، invoice، coupon، gift card، wallet، shipping و report. Customer: سفارش‌ها، پرداخت‌ها، invoice، tracking، wallet، coupon و آدرس‌ها. هر action مالی/وضعیت همراه permission، branch scope و audit است.

## ۱۰. Security checklist

- server-side price/discount calculation، idempotency key و order locking.
- CSRF برای session cookie، CSP و output encoding برای XSS، rate limit checkout/coupon/payment.
- webhook signature/amount/reference verification و replay protection.
- PII/minimum logging، encrypted payment metadata، RBAC و immutable audit event.
- refund فقط با maker-checker مالی و ledger transaction.

## ۱۱. تست

Unit: pricing/coupon/shipping/status machine. Integration: checkout→reserve→payment→shipment→sold و cancel→release. Security: amount tampering، callback replay، IDOR و branch scope. Load: 1000 concurrent checkout، P95 API زیر 200ms با PostgreSQL/Redis و queue. UAT: فروش، مالی، انبار و چهار شعبه.

## ۱۲. Production deployment

SQLite فقط برای اجرای محلی است. Production: NestJS/Next.js، PostgreSQL HA، Redis برای cart/session/lock/queue، object storage برای invoice PDF، provider secrets در vault، Docker CI/CD، WAF/CDN، monitoring، backup/PITR و DR test. قبل از Go-live باید sandbox هر درگاه/حمل، penetration test، load test، invoice قانونی و قرارداد SLA تأیید شوند.
