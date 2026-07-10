# سند طراحی پایگاه داده

## قواعد پایه

- PostgreSQL با UUID/ULID برای کلید عمومی؛ تاریخ UTC و مبلغ `bigint` به ریال.
- داده‌های مالی و وضعیت قرارداد append-only یا نسخه‌دار؛ حذف سخت فقط طبق سیاست retention.
- `created_at`, `updated_at`, `created_by` و در موجودیت حساس `version` الزامی است.

## موجودیت‌ها و ارتباط‌ها

| حوزه | جدول‌ها | ارتباط کلیدی |
|---|---|---|
| هویت | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `addresses` | user چند address و role دارد |
| کاتالوگ | `categories`, `products`, `product_variants`, `product_specs`, `media_assets`, `price_history` | product چند variant/spec/media دارد |
| شعب و انبار | `branches`, `warehouses`, `stock_items`, `device_units`, `stock_reservations`, `stock_transfers`, `inventory_movements` | variant در مکان‌های مختلف stock دارد؛ unit سریال‌دار است |
| فروش | `carts`, `cart_items`, `orders`, `order_items`, `payments`, `shipments`, `refunds` | order snapshot قیمت/کالا و چند payment دارد |
| اقساط | `installment_applications`, `customer_documents`, `installment_contracts`, `installment_schedule`, `installment_payments` | application به قرارداد نسخه‌دار تبدیل می‌شود |
| Trade-in | `trade_ins`, `used_devices`, `device_inspections`, `pricing_quotes`, `pricing_rules` | trade-in به used device و quote وصل است |
| تعامل | `articles`, `article_revisions`, `reviews`, `wishlists`, `wallet_ledger`, `loyalty_ledger`, `notifications`, `tickets` | ledgerها immutable هستند |
| کنترل | `audit_logs`, `outbox_events`, `webhook_events` | همهٔ عملیات حساس قابل بازپخش/پیگیری |

## طرح رابطه‌ای خلاصه

```text
User ──< Order ──< OrderItem >── ProductVariant >── Product >── Category
  ├──< Address                         │
  ├──< InstallmentApplication ── Contract ──< InstallmentSchedule
  └──< TradeIn ── UsedDevice ──< DeviceInspection

Branch ──< Warehouse ──< StockItem >── ProductVariant
                              └──< DeviceUnit (imei/serial, when applicable)
```

## ستون‌های مهم

- `product_variants`: `product_id`, `sku`, `storage`, `color`, `region`, `warranty_id`, `is_active`.
- `device_units`: `variant_id`, `imei_hash`, `serial_hash`, `status`, `warehouse_id`, `cost_price`, `received_at`.
- `stock_items`: `warehouse_id`, `variant_id`, `on_hand`, `reserved`, `available` (generated or transactional).
- `orders`: `customer_id`, `branch_id`, `status`, `currency`, `total_amount`, `pricing_snapshot`, `idempotency_key`.
- `pricing_quotes`: `used_device_id`, `rule_version`, `market_snapshot`, `suggested_price`, `approved_price`, `approved_by`.
- `audit_logs`: `actor_id`, `action`, `entity_type`, `entity_id`, `before`, `after`, `ip_hash`, `occurred_at`.

## index و مقیاس‌پذیری

- unique: `users.phone_normalized`, `product_variants.sku`, `device_units.imei_hash` (در صورت وجود)، `orders.idempotency_key`.
- composite: `(warehouse_id, variant_id)` روی stock، `(customer_id, created_at desc)` روی order، `(status, created_at)` روی درخواست اقساط و تیکت.
- partial index برای `status IN ('pending','active')` و جست‌وجوهای صف کاری.
- GIN روی JSONB مشخصات محصول فقط برای فیلترهای تاییدشده؛ جست‌وجوی عمومی در Search Engine.
- partition ماهانه برای audit_logs، notification deliveries و eventها؛ read replica برای گزارش‌های سنگین.
- PII و IMEI در سطح ستون رمزنگاری یا tokenized، با hash جدا برای lookup دقیق.

## یکپارچگی داده

کاهش/رزرو موجودی و ثبت سفارش در transaction با optimistic locking انجام می‌شود. جمع موجودی قابل فروش هرگز نباید منفی شود. گزارش‌ها از read model یا data warehouse تغذیه می‌شوند، نه query سنگین روی تراکنش تولید.
