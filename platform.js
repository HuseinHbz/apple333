const root = document.querySelector('#view-root');
const title = document.querySelector('#page-title');
const kicker = document.querySelector('#page-kicker');
const dialogElement = document.querySelector('#action-dialog');
const number = new Intl.NumberFormat('fa-IR');
let currentView = 'dashboard';

const branches = [
  ['ونک', 'b-vanak', '۲۲۱M', 78], ['پاسداران', 'b-pasdaran', '۱۸۰M', 62],
  ['کوروش', 'b-koorosh', '۲۷۷M', 89], ['انبار مرکزی', null, '۴۲۱ SKU', 94],
];

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2600);
}

function status(value) {
  const kind = /تأیید|فعال|تحویل|منتشر/.test(value) ? 'success' : /انتظار|ارزیابی|مسیر/.test(value) ? 'pending' : 'info';
  return `<span class="status ${kind}">${value}</span>`;
}

function panel(heading, body, action = '') {
  return `<article class="panel"><div class="panel-heading"><h3>${heading}</h3>${action}</div>${body}</article>`;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function setHead(section, heading) {
  kicker.textContent = section;
  title.textContent = heading;
  document.querySelectorAll('#side-nav button').forEach((button) => button.classList.toggle('active', button.dataset.view === currentView));
}

function branchRows(reportBranches) {
  const data = reportBranches?.map((branch) => [branch.name.replace('انبار شعبه ', ''), null, number.format(branch.on_hand), Math.min(100, branch.on_hand * 25)]) || branches;
  return data.map(([name, id, value, progress]) => `<div class="branch-row"><span class="branch-icon">${id ? '⌂' : '▣'}</span><div><b>${name}</b><small>${id ? 'موجودی و فروش شعبه' : 'موقعیت مرکزی'}</small></div><div class="progress"><i style="width:${progress}%"></i></div><strong>${value}</strong></div>`).join('');
}

function dashboard() {
  setHead('OVERVIEW', 'صبح بخیر، حسین');
  const orderRows = [
    ['#A-2841', 'آوا قاسمی', '۱۵۴,۹۰۰,۰۰۰', 'آنلاین', status('پرداخت شد')],
    ['#A-2840', 'سامان رضایی', '۳۲,۹۰۰,۰۰۰', 'ونک', status('در حال آماده‌سازی')],
    ['#A-2839', 'سارا گودرزی', '۷۸,۵۰۰,۰۰۰', 'آنلاین', status('ارسال شد')],
  ];
  root.innerHTML = `<section class="dashboard"><p class="date-line">نمای کلی فروشگاه و چهار شعبه</p><div class="metrics"><article class="metric"><div class="metric-title">فروش امروز <b>+۱۸٪</b></div><h2>۴۸۳M</h2><p>تومان · نسبت به دیروز</p></article><article class="metric"><div class="metric-title">سفارش‌های جدید <b>+۱۲٪</b></div><h2>۳۶</h2><p>۸ مورد نیازمند پیگیری</p></article><article class="metric"><div class="metric-title">درخواست اقساط <b class="warn">۱۲ مورد</b></div><h2>۸</h2><p>در انتظار بررسی مالی</p></article><article class="metric"><div class="metric-title">هشدار موجودی <b class="warn">۲ SKU</b></div><h2>۵</h2><p class="down">نیازمند تأمین یا انتقال</p></article></div><div class="grid-two">${panel('فروش هفت روز اخیر', '<div class="chart"><svg viewBox="0 0 600 200" preserveAspectRatio="none"><path d="M0,155 C45,145 58,82 110,120 S178,105 210,122 S276,30 320,75 S390,130 430,78 S505,90 600,18" fill="none" stroke="#161616" stroke-width="2.5"/></svg></div><div class="chart-labels"><span>شنبه</span><span>یکشنبه</span><span>دوشنبه</span><span>سه‌شنبه</span><span>چهارشنبه</span><span>امروز</span></div>', '<button class="link-button" data-go="insights">مشاهده گزارش ←</button>')}${panel('عملکرد شعب', branchRows())}</div><div class="table-panel">${panel('آخرین سفارش‌ها', table(['شماره', 'مشتری', 'مبلغ', 'کانال', 'وضعیت'], orderRows), '<button class="link-button" data-go="orders">همه سفارش‌ها ←</button>')}</div></section>`;
}

function inventory() {
  setHead('INVENTORY', 'مرکز عملیات انبار');
  const auditRows = [
    ['۱۰:۴۲', 'دریافت و QC', 'iPhone 16 Pro · …۸۲۱۴', 'مینا رضایی', 'انبار مرکزی', status('تأیید شد')],
    ['۱۰:۲۶', 'ارسال انتقال', 'AirPods Pro 2 · …۴۰۳۹', 'علی کریمی', 'پاسداران', status('در مسیر')],
    ['۰۹:۵۸', 'رزرو آنلاین', 'iPhone 16 Pro Max · …۲۷۶۱', 'سیستم', 'ونک', status('فعال')],
  ];
  root.innerHTML = `<section class="section inventory-command"><div class="section-intro"><div><h2>موجودی، IMEI و شعب</h2><p>داده‌ها هنگام اجرای سرور محلی از API فاز ۳ خوانده می‌شوند.</p></div><div class="button-row"><button class="primary" data-modal="receiving">+ دریافت کالا</button><button class="primary" data-modal="transfer">+ انتقال بین شعب</button></div></div><div class="filters"><input id="imei-search" placeholder="IMEI، Serial یا بارکد دستگاه…" /><button class="primary" data-action="imei-search">جست‌وجو</button><button class="link-button" data-modal="scan">اسکن با دوربین</button></div><div id="imei-result"></div><div class="metrics"><article class="metric"><div class="metric-title">موجودی قابل فروش</div><h2 id="available-stock">۴۲۱</h2><p>در ۵ موقعیت فعال</p></article><article class="metric"><div class="metric-title">ارزش موجودی</div><h2>۱۸.۶B</h2><p>تومان · ارزش خرید</p></article><article class="metric"><div class="metric-title">رزروهای فعال</div><h2 id="reserved-stock">۱۲</h2><p>رزروهای دارای زمان پایان</p></article><article class="metric"><div class="metric-title">کمبود موجودی</div><h2 id="low-stock">۵</h2><p>SKU نیازمند اقدام</p></article></div><div class="grid-two"><div id="branch-panel">${panel('وضعیت شعب و انبار مرکزی', branchRows())}</div>${panel('صف عملیات انبار', '<div class="data-row"><span class="branch-icon">↓</span><div><b>دریافت کالا</b><small>اسکن IMEI، QC و ورود به انبار</small></div></div><div class="data-row"><span class="branch-icon">→</span><div><b>انتقال بین شعب</b><small>درخواست، تأیید، ارسال و دریافت</small></div></div><div class="data-row"><span class="branch-icon">◷</span><div><b>رزرو</b><small>آزادسازی خودکار با timeout</small></div></div>', '<button class="link-button" data-modal="audit">شروع شمارش موجودی ←</button>')}</div>${panel('آخرین رخدادهای قابل ممیزی', table(['زمان', 'عملیات', 'دستگاه / کالا', 'کاربر', 'محل', 'وضعیت'], auditRows), '<button class="link-button" data-modal="audit">Audit Log ←</button>')}</section>`;
  void hydrateInventory();
}

async function hydrateInventory() {
  try {
    const response = await fetch('/api/v1/inventory/reports');
    if (!response.ok || currentView !== 'inventory') return;
    const report = await response.json();
    document.querySelector('#available-stock').textContent = number.format(report.totals.on_hand - report.totals.reserved);
    document.querySelector('#reserved-stock').textContent = number.format(report.totals.reserved);
    document.querySelector('#low-stock').textContent = number.format(report.lowStock.length);
    document.querySelector('#branch-panel').innerHTML = panel('وضعیت شعب و انبار مرکزی', branchRows(report.branches));
  } catch (_) {
    // The static preview intentionally works before the local API is started.
  }
}

function simpleView(view) {
  const content = {
    catalog: ['کالا و کاتالوگ', 'مدیریت SKU، variant، مشخصات و قیمت‌های محصول'],
    orders: ['سفارش‌ها', 'پیگیری سفارش آنلاین، پرداخت و تحویل شعبه'],
    installments: ['اقساط و اعتبارسنجی', 'درخواست، مدارک، تأیید مالی و قرارداد'],
    tradein: ['تعویض گوشی', 'ارزیابی IMEI، سلامت دستگاه و پیشنهاد قیمت'],
    customers: ['مشتریان و CRM', 'پروفایل، وفاداری، کیف پول و پیگیری‌ها'],
    insights: ['گزارش و هوش قیمت', 'فروش، حاشیه سود، موجودی و قیمت کارکرده'],
    content: ['محتوا و بازاریابی', 'مقالات، SEO، کمپین و صفحات فرود'],
    support: ['پشتیبانی و خدمات', 'تیکت، گارانتی، تعمیرات و SLA'],
    settings: ['تنظیمات و امنیت', 'نقش‌ها، providerها، لاگ و policy'],
  }[view];
  setHead('OPERATIONS', content[0]);
  root.innerHTML = `<section class="section"><div class="section-intro"><div><h2>${content[0]}</h2><p>${content[1]}</p></div><button class="primary" data-modal="generic">+ عملیات جدید</button></div>${panel('وضعیت ماژول', '<div class="empty">این بخش در نمونهٔ عملیاتی آمادهٔ اتصال به API مربوطه است.</div>')}</section>`;
}

const views = { dashboard, inventory, catalog: () => simpleView('catalog'), orders: () => simpleView('orders'), installments: () => simpleView('installments'), tradein: () => simpleView('tradein'), customers: () => simpleView('customers'), insights: () => simpleView('insights'), content: () => simpleView('content'), support: () => simpleView('support'), settings: () => simpleView('settings') };

function render(view) {
  currentView = view;
  views[view]();
  document.querySelector('.sidebar').classList.remove('open');
}

function openDialog(kind) {
  const descriptions = {
    receiving: ['دریافت کالا', 'در نسخهٔ API، دریافت با IMEI/Serial یکتا، QC و ثبت حرکت موجودی انجام می‌شود.'],
    transfer: ['انتقال بین شعب', 'جریان انتقال: درخواست، تأیید، ارسال با اسکن و دریافت در مقصد.'],
    scan: ['اسکن دستگاه', 'اسکنر USB یا دوربین باید مقدار IMEI/Serial را به فرم جست‌وجو وارد کند.'],
    audit: ['شمارش و Audit', 'هر تغییر موجودی، IMEI و قیمت به‌صورت رویداد ممیزی ثبت می‌شود.'],
    generic: ['عملیات جدید', 'جزئیات عملیات را ثبت کنید.'],
  }[kind] || ['عملیات جدید', 'جزئیات را ثبت کنید.'];
  document.querySelector('#dialog-content').innerHTML = `<h2 class="dialog-title">${descriptions[0]}</h2><p style="font-size:11px;line-height:1.9;color:#777">${descriptions[1]}</p><div class="form-grid"><label>عنوان / دستگاه<input placeholder="مثلاً iPhone 16 Pro" /></label><label>شعبه<select><option>ونک</option><option>پاسداران</option><option>کوروش</option><option>انبار مرکزی</option></select></label></div><label style="display:block;margin-top:12px;font-size:11px">یادداشت<textarea rows="3" placeholder="توضیحات تکمیلی"></textarea></label><button class="primary" style="margin-top:18px" value="default">ثبت پیش‌نویس</button>`;
  dialogElement.showModal();
}

async function searchDevice() {
  const input = document.querySelector('#imei-search');
  const target = document.querySelector('#imei-result');
  const value = input?.value.trim();
  if (!value) return toast('IMEI یا Serial را وارد کنید');
  try {
    const response = await fetch(`/api/v1/devices/${encodeURIComponent(value)}`);
    if (!response.ok) throw new Error();
    const device = await response.json();
    target.innerHTML = `<div class="panel" style="margin-bottom:13px"><div class="data-row"><span class="product-thumb">i</span><div><b>${device.display_name}</b><small>${device.imei_1} · ${device.serial_number} · ${device.warehouse}</small></div>${status(device.status)}</div></div>`;
  } catch (_) {
    target.innerHTML = '<div class="panel" style="margin-bottom:13px"><div class="empty">دستگاه پیدا نشد یا API محلی اجرا نشده است.</div></div>';
  }
}

document.querySelector('#side-nav').addEventListener('click', (event) => { if (event.target.dataset.view) render(event.target.dataset.view); });
document.addEventListener('click', (event) => {
  if (event.target.dataset.go) render(event.target.dataset.go);
  if (event.target.dataset.modal) openDialog(event.target.dataset.modal);
  if (event.target.dataset.action === 'imei-search') void searchDevice();
  if (event.target.id === 'new-action') openDialog('generic');
  if (event.target.id === 'notifications') toast('۳ اعلان جدید دارید');
  if (event.target.id === 'logout') toast('از پنل خارج شدید');
});
dialogElement.addEventListener('close', () => { if (dialogElement.returnValue === 'default') toast('پیش‌نویس با موفقیت ثبت شد'); });
document.querySelector('#mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
render('dashboard');
