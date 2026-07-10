# Database Schema فاز ۳

## جدول‌ها

| جدول | ستون‌های کلیدی | قیدها |
|---|---|---|
| `branches` | id, code, name, status | code یکتا |
| `warehouses` | id, branch_id?, code, type | یک مرکزی، location فعال |
| `inventory_balances` | warehouse_id, variant_id, on_hand, reserved, version | unique(warehouse_id, variant_id), check non-negative |
| `inventory_items` | id, variant_id, warehouse_id, qty, cost | برای کالاهای quantity-managed |
| `devices` | id, variant_id, warehouse_id, status, imei_1_hash, serial_hash | IMEI/serial hash یکتا در محدودهٔ شرکت |
| `imei_records` | device_id, slot, encrypted_value, normalized_hash | unique(normalized_hash) |
| `serial_numbers` | device_id, encrypted_value, normalized_hash | unique(normalized_hash) |
| `stock_movements` | id, device_id?/variant_id, from_location, to_location, type, reference | immutable و indexed by location/time |
| `purchase_orders` | id, supplier_id, status, expected_at | PO number یکتا |
| `receiving_orders` | id, purchase_order_id, warehouse_id, status | receive only against valid PO |
| `transfer_orders` | id, source_id, destination_id, status, requested_by | source ≠ destination |
| `transfer_items` | transfer_id, device_id?/variant_id, qty | device فقط یک‌بار در transfer فعال |
| `reservations` | id, order_id?, device_id?/variant_id, location_id, expires_at, status | active reservation indexed by expiry |
| `stock_audits` | id, location_id, scope, status, opened_by | count session versioned |
| `stock_audit_items` | audit_id, device_id?/variant_id, expected, counted | unique per audit + item |

## index و مقیاس

- B-tree unique روی `imei_records.normalized_hash` و `serial_numbers.normalized_hash` برای پاسخ IMEI زیر 300ms.
- indexes: `(warehouse_id, variant_id)`, `(status, warehouse_id)`, `(expires_at) WHERE status='active'`, `(device_id, occurred_at desc)`.
- `stock_movements` و `audit_logs` ماهانه partition می‌شوند؛ indexهای report بر اساس location/time دارند.
- read replica یا warehouse تحلیلی برای گزارش‌های سنگین؛ transactionهای عملیاتی فقط روی primary.

## transactionهای اجباری

دریافت، reserve/release، dispatch/receive transfer، sale، return و adjustment از row lock/optimistic version استفاده می‌کنند. هر mutation balance یک ledger row و audit event می‌سازد؛ jobهای retry باید idempotency key داشته باشند.
