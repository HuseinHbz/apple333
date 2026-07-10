# اَپل‌خانه

پلتفرم فروش، اقساط، Trade-in و مدیریت چندشعبه‌ای محصولات Apple.

## وضعیت فعلی

- ✅ نمونهٔ اولیهٔ رابط فروشگاه (صفحهٔ خانه و محاسبه‌گر اقساط)
- ✅ تحلیل اولیه و معماری هدف پروژه
- ⏳ فاز ۱: زیرساخت برنامه، احراز هویت و نقش‌ها

جزئیات اجرای پروژه در [اسناد فاز صفر](docs/phase-0) نگهداری می‌شود.

## اجرای نمونهٔ طراحی

فایل `index.html` را با مرورگر باز کنید. این نمونه به اینترنت یا نصب وابستگی نیاز ندارد.

## اجرای API فاز ۳

برای اجرای inventory API و پنل روی یک سرور محلی، از Python همراه Codex استفاده کنید:

```powershell
& 'C:\Users\Husein_hbz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' server.py
```

سپس [http://localhost:8080/platform.html](http://localhost:8080/platform.html) و نمونهٔ گزارش API در [http://localhost:8080/api/v1/inventory/reports](http://localhost:8080/api/v1/inventory/reports) در دسترس است. دیتابیس محلی SQLite در `data/applekhane.db` در اولین اجرا ساخته می‌شود.
