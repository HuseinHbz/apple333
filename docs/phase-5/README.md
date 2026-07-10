# فاز ۵ — Premium Store Front

## خروجی اجراشده

- storefront responsive شامل [catalog](../../catalog.html)، [product detail](../../product.html)، [compare](../../compare.html) و [wishlist](../../wishlist.html).
- جست‌وجو، فیلتر دسته/قیمت، انتخاب حداکثر چهار محصول برای compare، wishlist و cart preview مبتنی بر local state.
- semantic HTML، skip link، labelهای فرم، contrast قابل‌قبول و responsive breakpoints برای موبایل و tablet.
- `robots.txt`، `sitemap.xml`، canonical/meta description و Product JSON-LD نمونه.

## Design system

Grid هشت‌پیکسلی، رنگ‌های Ink/White/Apple Gray/Apple Blue، radius محدود، shadow نرم و حرکت‌های کوتاه در نسخهٔ production. Typography پیشنهادی: SF Pro در محیط دارای مجوز، سپس Inter/Vazirmatn. کلیک‌پذیری حداقل 44px، focus state واضح و احترام به `prefers-reduced-motion` الزامی است.

## معماری Production Frontend

نسخهٔ فعلی برای اجرای بدون dependency از HTML/CSS/JS استفاده می‌کند. برای production باید به Next.js + TypeScript، Tailwind، shadcn/Radix، TanStack Query، Zustand، React Hook Form و SSR/ISR منتقل شود. Catalog/search از API نسخه‌دار، images از CDN، و cart/wishlist server-synced پس از login تغذیه شوند.

## SEO و Performance

SSR/ISR برای صفحهٔ محصول و landing page، metadata پویا، canonical، OpenGraph/Twitter Card، JSON-LD Product/Breadcrumb/FAQ، sitemap پویا، تصویر AVIF/WebP با ابعاد مشخص و CDN. هدف‌های production: LCP < 2.5s، INP < 200ms، CLS < 0.1 و Lighthouse با دادهٔ واقعی آزمایش می‌شود؛ امتیاز 100 بدون تست محیط production ادعا نمی‌شود.

## Accessibility و QA

WCAG 2.2 AA: keyboard navigation، heading hierarchy، focus، contrast، نام قابل دسترس دکمه‌ها و error state. Quality gate هر صفحه: visual، UX، accessibility، performance، conversion، Apple feeling و code quality؛ آستانهٔ 9.8/10 تنها بعد از prototype test، Lighthouse و تست کاربر معتبر است.

## موارد نیازمند اتصال Production

Autocomplete فارسی/انگلیسی، typo tolerance، voice search، موجودی زندهٔ شعب، review، ویدیو/360°، CMS landing page، price-drop notification، export PDF compare و dark mode نیازمند API، provider یا runtime production هستند. هیچ‌یک نباید با دادهٔ ساختگی به مشتری نمایش داده شود.
