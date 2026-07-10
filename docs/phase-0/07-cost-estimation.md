# برآورد هزینه و ظرفیت

## فرض‌ها

این برآورد برای محصول اختصاصی production-ready با چهار شعبه، وب فروشگاهی، پنل عملیات، QA، DevOps و پشتیبانی اولیه است؛ مالیات، سخت‌افزار فروشگاهی، هزینهٔ حقوقی، کارمزد ارائه‌دهندگان و تبلیغات را شامل نمی‌شود. اعداد باید پس از Discovery، انتخاب تأمین‌کننده و backlog تخمین‌زده شوند.

## ظرفیت تیم پیشنهادی

| نقش | ظرفیت متوسط | مسئولیت |
|---|---:|---|
| Product/Business Analyst | 1 | PRD، KPI، UAT و اولویت‌بندی |
| Product Designer | 1 | research، design system و prototype |
| Tech Lead / CTO | 1 | معماری، review و امنیت |
| Frontend Engineer | 2 | storefront و admin |
| Backend Engineer | 2–3 | domainها، API، integration |
| QA Engineer | 1–2 | automation و UAT |
| DevOps/SRE | 0.5–1 | CI/CD، observability و DR |
| Data/AI Engineer | 0.5–1 از Release 3 | pricing/analytics با governance |

## بازهٔ زمانی و بودجهٔ برنامه‌ریزی

| سطح | مدت تقریبی | effort تقریبی | برآورد جهانی |
|---|---:|---:|---:|
| Foundation + Commerce MVP | 4–6 ماه | 3,000–5,000 ساعت | 150k–350k USD |
| Retail Operations کامل | 8–12 ماه | 8,000–13,000 ساعت | 400k–1.0m USD |
| Enterprise + intelligence کامل | 12–18 ماه | 13,000–20,000 ساعت | 700k–1.8m USD |

نرخ و هزینهٔ واقعی در ایران یا هر بازار دیگر به ترکیب تیم، سطح SLA، قرارداد، ارز و هزینهٔ زیرساخت وابسته است؛ از این جدول نباید به‌عنوان پیشنهاد قیمت قطعی استفاده شود.

## هزینهٔ سالانهٔ عملیاتی

- Cloud/CDN/monitoring/backup: از چند صد تا چند هزار دلار ماهانه، متناسب با ترافیک و retention.
- پیامک، درگاه، ارسال، OCR/KYC و دادهٔ بازار: usage-based و قراردادی.
- پشتیبانی، امنیت، patch و بهبود: حداقل 15–25٪ هزینهٔ توسعهٔ سالانه برای محصول mission-critical.

## کنترل هزینه

MVP را به جریان درآمدی اول محدود کنید، معماری modular monolith را حفظ کنید، از provider adapter استفاده کنید و فقط پس از اثبات نیاز سراغ microservice، AI پیچیده یا data pipeline گران بروید. بودجهٔ contingency حداقل 15٪ برای اتصال‌ها، تغییر مقررات و داده‌های غیرقابل پیش‌بینی در نظر گرفته شود.
