# استراتژی تست

| لایه | مثال |
|---|---|
| Unit | transition state machine، فرمت IMEI، محاسبه available و rule permission |
| Integration | تراکنش reserve/sale، dispatch/receive، import idempotent، index lookup |
| API contract | schema، authorization، pagination، error و idempotency |
| E2E | PO تا دریافت، انتقال مرکزی به شعبه، رزرو آنلاین تا pickup، cycle count |
| Load | 100k+ device، میلیون‌ها movement، p95 IMEI search زیر 300ms |
| Security | IDOR شعبه، privilege escalation، replay webhook، PII redaction |

دادهٔ تست باید IMEI ساختگی داشته باشد. قبل از انتشار migration، backup/restore و rollback path در staging تست می‌شوند.
