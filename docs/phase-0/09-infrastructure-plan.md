# برنامهٔ زیرساخت و DevOps

## ۱. محیط‌ها و توپولوژی

```text
Internet → CDN / WAF → Load Balancer → Web (Next.js) / API (NestJS)
                                       ↘ Worker (queue)
                         Managed PostgreSQL · Redis · Search · Object Storage
                                       ↓
                       Monitoring / Logs / Traces / Encrypted Backups
```

سه محیط جدا لازم است: `development` برای توسعه، `staging` با دادهٔ مصنوعی و هم‌پیکربندی production برای UAT، و `production`. دادهٔ production هرگز به development منتقل نمی‌شود؛ accessها SSO/VPN/MFA و least privilege دارند.

## ۲. اجرا و استقرار

- Linux LTS، Docker imageهای immutable، non-root user و image scan.
- Docker Compose برای local/staging کوچک؛ Kubernetes یا managed container platform فقط پس از اثبات نیاز مقیاس/HA.
- CDN برای assetهای عمومی، object storage برای مدیا/مدارک، URL امضاشده برای فایل خصوصی.
- PostgreSQL managed با Multi-AZ در production، Redis managed، و Search به‌عنوان دادهٔ بازسازی‌پذیر.

## ۳. CI/CD

1. Pull Request: lint، typecheck، unit test، dependency/security scan و build.
2. merge به main: deploy خودکار staging، migration dry run و test end-to-end منتخب.
3. انتشار production: approval مسئول، migration سازگار با rollback، canary/blue-green در صورت پشتیبانی و health check.
4. rollback شامل image و feature flag است؛ rollback دیتابیس با forward-fix طراحی می‌شود، نه migration مخرب.

## ۴. Observability و SLO

| سیگنال | ابزار پیشنهادی | هدف |
|---|---|---|
| خطا/trace | Sentry + OpenTelemetry | ارتباط خطا با درخواست و کاربر بدون PII خام |
| metrics | Prometheus + Grafana | CPU، queue lag، DB pool، conversion و payment error |
| logs | Loki/ELK با retention | ساخت‌یافته، redacted و قابل جست‌وجو |
| alert | Pager/on-call | پرداخت، سفارش، DB، queue و امنیت با runbook |

SLO اولیه: 99.9٪ availability storefront، 99.95٪ پذیرش API سفارش (به‌جز provider failure)، و پردازش اعلان عادی در کمتر از پنج دقیقه. Error budget باید تصمیم انتشار را تحت تأثیر قرار دهد.

## ۵. Backup، DR و ظرفیت

- PostgreSQL: point-in-time recovery، backup روزانه، نگهداری منطقه/حساب جدا و encryption.
- Object storage: versioning و lifecycle؛ restore نمونه‌ای هر فصل.
- RPO 15 دقیقه و RTO چهار ساعت برای جریان سفارش/پرداخت؛ runbook، owner و تمرین Disaster Recovery سالانه.
- capacity: autoscale stateless web/API، connection pool DB، queue worker مستقل و load test قبل از کمپین‌های بزرگ.

## ۶. امنیت عملیاتی

- secrets manager با rotation؛ هیچ secret در `.env` production، frontend یا log نیست.
- WAF، rate limiting، DDoS policy، patch schedule، SBOM و vulnerability management.
- access production زمان‌دار، ثبت‌شده و بازبینی‌شده؛ break-glass با دو نفر تأییدکننده برای عملیات حساس.
- retention و حذف داده با سیاست حقوقی/حریم خصوصی مشخص، نه براساس حدس تیم فنی.

## ۷. آمادگی راه‌اندازی

قبل از Go-live: load test، restore test، penetration test، payment webhook rehearsal، inventory reconciliation، monitoring dashboard، on-call roster، runbook incident و UAT امضاشده توسط مالی/انبار/شعبه الزامی است.
