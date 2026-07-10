# API Contract فاز ۳

تمام endpointها زیر `/api/v1` هستند، JWT/session معتبر و permission دارند، پاسخ خطا `code`, `message`, `requestId` برمی‌گرداند. endpointهای mutation از `Idempotency-Key` پشتیبانی می‌کنند.

| Method / path | Permission | توضیح |
|---|---|---|
| `GET /inventory?branchId=&variantId=` | inventory.read | balance و فیلترها، cursor pagination |
| `GET /inventory/branches/:branchId` | inventory.branch.read | موجودی و KPI شعبه |
| `GET /devices/:imei` | device.read | جست‌وجوی masked IMEI/Serial با audit reveal |
| `POST /purchase-orders` | receiving.create | ایجاد PO |
| `POST /receiving-orders/:id/scan` | receiving.execute | ثبت اسکن device و QC |
| `POST /receiving-orders/:id/import` | receiving.import | import async فایل استاندارد |
| `POST /transfers` | transfer.create | ایجاد درخواست انتقال |
| `PATCH /transfers/:id/status` | transfer.approve/dispatch/receive | transition کنترل‌شدهٔ status |
| `POST /reservations` | reservation.create | رزرو device یا variant با expiry |
| `DELETE /reservations/:id` | reservation.cancel | لغو مجاز رزرو |
| `POST /stock-audits` | audit.create | شروع cycle count |
| `POST /stock-audits/:id/counts` | audit.count | ثبت batch count اسکن‌شده |
| `GET /inventory/reports` | inventory.report.read | available/sold/slow-moving/value/movement |

نمونهٔ ایجاد transfer:

```json
{"sourceWarehouseId":"wh-central","destinationWarehouseId":"wh-vanak","deviceIds":["dev-1"],"reason":"restock","idempotencyKey":"..."}
```

API نباید IMEI خام را در log یا پاسخ پیش‌فرض نشان دهد؛ نمایش کامل فقط برای permission ویژه و با ثبت AuditEvent مجاز است.
