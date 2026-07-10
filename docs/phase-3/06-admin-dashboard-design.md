# طراحی پنل فاز ۳

## صفحه‌ها

1. **Inventory Dashboard:** ارزش موجودی، available، low stock، incoming/outgoing، مقایسهٔ چهار شعبه و صف انتقال.
2. **Branch / Warehouse:** KPI، موجودی، همکاران، فروش و transferهای همان location.
3. **IMEI Search & Device Detail:** جست‌وجو با scan یا متن، کارت وضعیت، محل، lifecycle، گارانتی و history immutable.
4. **Receiving:** انتخاب PO، scan/bulk import، QC exception و put-away.
5. **Transfers:** کانبان وضعیت‌ها با اقدام‌های role-aware و confirmation اسکن مقصد.
6. **Reservations:** زمان باقی‌مانده، صاحب رزرو، اولویت و release دستی مجاز.
7. **Stock Audit / Reports:** اختلاف، دلیل، approval، گزارش ارزش/گردش/slow moving.

## UX

دسکتاپ 1440/1920: جدول dense اما خوانا، پنل فیلتر sticky و اقدام اصلی واحد. tablet: کارت‌های خلاصه و scan-first. هر وضعیت رنگ و label متنی دارد؛ رنگ به‌تنهایی معنی نمی‌دهد. عملیاتی مانند Lost، adjustment و IMEI edit confirmation، دلیل و سطح مجوز می‌خواهند.

## ارزیابی کیفیت

پس از prototype و تست سناریوی دریافت، انتقال و pickup با کاربران واقعی، نمرهٔ visual، UX، کارایی کسب‌وکار، فنی و حس Apple Enterprise ثبت می‌شود. حد انتشار 9.8/10 تعریف شده است؛ این نمره فقط پس از تست، نه بر اساس قضاوت طراح، معتبر است.
