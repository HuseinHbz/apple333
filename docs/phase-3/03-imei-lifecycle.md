# طراحی چرخهٔ IMEI و Device

## دادهٔ دستگاه

`imei_1`, `imei_2`, `serial_number`, `model_number`, `activation_date`, `purchase_date`, `warranty_status`, `region`, `sim_type`, `variant_id` و `location_id` برای هر unit نگهداری می‌شود. مقدارهای IMEI و serial رمزنگاری‌شده هستند و hash نرمال‌شدهٔ unique برای lookup سریع دارند.

## چرخهٔ وضعیت

```text
Purchased → Received → QC Passed → Stored/Available
                         ├→ Reserved → Sold → After-sales
                         ├→ Transferred → Available
                         ├→ Returned → QC → Available | Repair | Damaged
                         └→ Lost (requires investigation and approval)
```

هر transition یک policy دارد: مثال، `Sold` فقط از `Reserved` یا `Available` با سفارش پرداخت‌شده مجاز است؛ `Lost` فقط با مدیر و دلیل؛ تغییر IMEI/Serial پس از دریافت نیازمند dual approval و audit است. رخداد lifecycle شامل actor، علت، زمان، محل قبلی/جدید و شناسهٔ سند مرجع است.
