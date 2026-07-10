# مدل امنیت و کنترل تقلب

- RBAC پایه با scope شعبه/location: Sales فقط read/reserve شعبهٔ خود؛ Warehouse دریافت/ارسال مجاز؛ Manager تأیید انتقال؛ Admin سراسری.
- تغییر وضعیت حساس و انتقال ارزش بالا maker-checker دارد؛ درخواست‌کننده نمی‌تواند آن را تأیید کند.
- IMEI/Serial رمزنگاری، search با hash، mask در UI و Audit برای reveal/export.
- validate فرمت/تکراری IMEI، scan source، duplicate device و transition غیرمجاز در سرور انجام می‌شود.
- AuditEvent شامل actor، action، device/reference، before/after، location، IP/device fingerprint و request ID است.
- anomaly rules: انتقال پرتکرار، adjustment غیرعادی، IMEI تکراری، فروش دستگاه in-transit، تلاش رزرو بیشتر از available.
