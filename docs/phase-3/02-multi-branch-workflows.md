# Workflowهای شعب و انبار

## دریافت خرید

`Purchase Order → Receiving Order → Quality Check → IMEI/Serial capture → Put-away → Available`

دریافت‌کننده QR/Barcode را اسکن یا فایل Excel استاندارد را import می‌کند. ردیف تکراری، IMEI نامعتبر، variant اشتباه یا IMEI قبلاً ثبت‌شده block می‌شود. QC باید نتیجه، عکس/یادداشت و کاربر را ثبت کند؛ فقط پس از قبول QC دستگاه وارد موجودی قابل فروش می‌شود.

## انتقال بین شعب

`Draft → Requested → Approved → Dispatched → In transit → Received | Rejected | Cancelled`

مبدأ و مقصد نمی‌توانند یکسان باشند. درخواست‌کننده، تأییدکننده، فرستنده و دریافت‌کننده (به‌ویژه در انتقال ارزشمند) نقش یا کاربر مجزا دارند. هنگام dispatch دستگاه از موجودی قابل‌فروش مبدأ خارج و به وضعیت in-transit می‌رود؛ دریافت فقط با اسکن IMEI/Serial و تأیید مقصد تکمیل می‌شود.

## رزرو

`Created → Confirmed → Fulfilled | Expired | Cancelled`

رزرو آنلاین یا حضوری روی device مشخص یا variant انجام می‌شود. TTL پیش‌فرض کوتاه و قابل پیکربندی است؛ job پایان‌زمان، رزرو را آزاد می‌کند. اولویت VIP فقط ترتیب allocation را تغییر می‌دهد و نباید موجودی را منفی کند.

## شمارش و تعدیل

شمارش cycle count در location انجام می‌شود. اختلاف ابتدا pending است، سپس با علت، مدرک و تأیید نقش مجاز به adjustment تبدیل می‌شود. Lost/Damaged/Repair وضعیت دستگاه هستند و تا تعیین تکلیف در available محاسبه نمی‌شوند.
