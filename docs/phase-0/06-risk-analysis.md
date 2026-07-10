# تحلیل ریسک و امنیت

| ریسک | احتمال / اثر | کنترل و مالک |
|---|---|---|
| تقلب در پرداخت یا اقساط | متوسط / بسیار بالا | KYC متناسب، review مالی، محدودیت نرخ، rules و مالک: Finance/Security |
| افشای PII/مدارک | متوسط / بسیار بالا | encryption، URL امضاشده، RBAC، retention و DLP؛ مالک: CTO |
| oversell یا اختلاف شعب | متوسط / بالا | transaction، reservation TTL، stock ledger و cycle count؛ مالک: Operations |
| API شخص ثالث قطع شود | بالا / متوسط | adapter، queue/retry، fallback دستی و monitor؛ مالک: Engineering |
| خزش غیرمجاز/نقض terms | متوسط / بالا | فقط API/مجوز رسمی، legal review و حذف connector غیرمجاز؛ مالک: Legal/Product |
| قیمت‌گذاری اشتباه AI | متوسط / بالا | AI advisory، rule version، انسان در حلقه و سقف تغییر؛ مالک: Pricing |
| حمله OTP / account takeover | بالا / بالا | rate limit، device/IP signal، MFA حساس، session rotation؛ مالک: Security |
| از دست‌رفتن داده | کم / بسیار بالا | backup رمزنگاری، PITR، restore drill؛ مالک: DevOps |

## معماری امنیت

- TLS سراسری، HSTS، CSP، WAF، secrets manager و scan وابستگی/تصویر Docker.
- password با Argon2id؛ OTP یک‌بارمصرف، کوتاه‌عمر، rate-limited و بدون log حساس.
- RBAC همراه با permissionهای دقیق و در فاز رشد ABAC برای شعبه/مالکیت داده.
- encryption در transit و at rest؛ مدارک و IMEI tokenized/رمزشده؛ logها PII خام ندارند.
- Audit immutable برای تغییر قیمت، وضعیت مالی، موجودی، نقش و reveal دادهٔ حساس.
- backup: snapshot روزانه، PITR، نسخهٔ خارج از محیط و تست restore حداقل فصلی.
- DR: RPO هدف 15 دقیقه و RTO هدف 4 ساعت برای سفارش و پرداخت؛ runbook و تمرین سالانه.

## کنترل کیفیت انتشار

Threat modeling برای هر قابلیت حساس، SAST/DAST، test مجوز، penetration test پیش از launch، alert برای نرخ خطا/تقلب و playbook incident. رخدادهای امنیتی دارای severity، مالک، زمان اطلاع‌رسانی و postmortem بدون سرزنش‌اند.
