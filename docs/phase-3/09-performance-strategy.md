# استراتژی عملکرد

- IMEI lookup با hash index و query محدود، p95 کمتر از 300ms؛ full scan ممنوع.
- dashboard از aggregate/read model و cache کوتاه‌عمر استفاده می‌کند؛ ledger اصلی برای نمودار query نمی‌شود.
- bulk import در queue، batch transactional، result قابل resume و error row-level دارد.
- partition movement/audit و cursor pagination برای میلیون‌ها رکورد.
- connection pooling، tracing query، alert slow query و load test پیش از شعبه/کمپین جدید.
