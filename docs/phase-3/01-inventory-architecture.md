# معماری موجودی و چندشعبه‌ای

## مدل مرکزی

یک tenant شرکتی، یک کاتالوگ مرکزی و یک inventory ledger دارد؛ هر شعبه و انبار مکان مستقل (`stock_location`) است. انبار مرکزی و چهار شعبه با یک مدل داده مدیریت می‌شوند تا افزودن شعبه پنجم یا انبار جدید تغییر معماری نخواهد داشت.

```text
Company
 ├─ Central Warehouse
 ├─ Branch 1 ── warehouse / sales floor
 ├─ Branch 2 ── warehouse / sales floor
 ├─ Branch 3 ── warehouse / sales floor
 └─ Branch 4 ── warehouse / sales floor
```

`InventoryBalance` موجودی aggregate هر variant در یک مکان را نگهداری می‌کند؛ `InventoryItem` و `Device` واحد فیزیکی را نگهداری می‌کنند. برای iPhone/iPad/Mac و کالای سریال‌دار، فروش و انتقال در سطح Device رخ می‌دهد. لوازم جانبی می‌تواند فقط quantity-managed باشد.

## اصول صحت داده

- Ledger حرکت موجودی immutable است؛ balance یک read model قابل بازسازی است.
- تغییر وضعیت device و حرکت آن باید در یک تراکنش انجام شود.
- مقدار available = on_hand − reserved و هرگز منفی نیست.
- `Device` در یک لحظه فقط در یک مکان و یک وضعیت فعال است.
- قیمت خرید و فروش snapshot دارد؛ تغییر catalog روی سوابق تاریخی اثر نمی‌گذارد.
