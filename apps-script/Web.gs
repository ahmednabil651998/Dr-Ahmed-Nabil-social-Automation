/**
 * Web App واحد بيعمل حاجتين:
 * 1) doGet: داش بورد (تقويم الأسبوعين الجايين + أرقام + حالة السيستم). بيفتح بس بالمفتاح DASH_KEY.
 * 2) doPost: webhook لتيليجرام (بيوصله من Cloudflare Worker). بيشتغل بس بالمفتاح WEBHOOK_KEY.
 * النشر: Deploy ← New deployment ← Web app ← Execute as: Me ← Who has access: Anyone (شوف docs/rollout.md).
 */

function randomKey_() { return Utilities.getUuid().replace(/-/g, ''); }

function webKey_(name) {
  var p = props_(), k = p.getProperty(name);
  if (!k) { k = randomKey_(); p.setProperty(name, k); }
  return k;
}

/* ---------- Webhook تيليجرام ---------- */

function doPost(e) {
  if (!e || !e.parameter || e.parameter.key !== props_().getProperty('WEBHOOK_KEY')) return ContentService.createTextOutput('no');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return ContentService.createTextOutput('busy');
  try {
    var u = JSON.parse(e.postData.contents);
    try { handleUpdate_(u); } catch (err) { notify_('❌ حصل خطأ: ' + err.message); }
  } finally { lock.releaseLock(); }
  return ContentService.createTextOutput('ok');
}

// من القايمة: بيسجّل الـ webhook على تيليجرام ويديك القيم اللي هتحطها في Cloudflare Worker
function enableWebhook() {
  var ui = SpreadsheetApp.getUi();
  var r1 = ui.prompt('تفعيل Webhook (1 من 2)', 'الصق رابط الـ Web App (اللي آخره /exec):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var r2 = ui.prompt('تفعيل Webhook (2 من 2)', 'الصق رابط الـ Cloudflare Worker (https://....workers.dev):', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var execUrl = r1.getResponseText().trim(), workerUrl = r2.getResponseText().trim();
  var key = webKey_('WEBHOOK_KEY'), secret = webKey_('TG_WEBHOOK_SECRET');
  var res = tg_('setWebhook', { url: workerUrl, secret_token: secret, allowed_updates: JSON.stringify(['message', 'callback_query']), drop_pending_updates: 'false' });
  if (!res.ok) { ui.alert('تيليجرام رفض: ' + res.description); return; }
  ui.alert('تيليجرام بقى بيبعت على الـ Worker ✅\n\nحط القيمتين دول في إعدادات الـ Worker (Settings ← Variables، كـ Secret):\n\n' +
    'APPS_SCRIPT_URL = ' + execUrl + '?key=' + key + '\n\nTG_SECRET = ' + secret +
    '\n\nوبعدين غيّر TG_MODE في تاب Settings لـ webhook.');
}

function disableWebhook() {
  var res = tg_('deleteWebhook', {});
  SpreadsheetApp.getUi().alert(res.ok ? 'رجعنا للوضع العادي ✅ غيّر TG_MODE في تاب Settings لـ polling.' : 'حصل خطأ: ' + res.description);
}

/* ---------- الداش بورد ---------- */

function dashboardLink() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url ? 'رابط الداش بورد (ما تشاركهوش):\n\n' + url + '?key=' + webKey_('DASH_KEY') :
    'لازم تعمل Deploy للـ Web App الأول (شوف docs/rollout.md).');
}

function doGet(e) {
  if (!e || !e.parameter || e.parameter.key !== props_().getProperty('DASH_KEY')) return HtmlService.createHtmlOutput('مش مسموح');
  return HtmlService.createHtmlOutput(dashboardHtml_()).setTitle('داش بورد د. أحمد نبيل')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function dashboardHtml_() {
  var today = cairoDate_(), days = [], i;
  for (i = 0; i < 14; i++) {
    var d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i);
    days.push(Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'));
  }
  var cal = {};
  days.forEach(function (d) { cal[d] = []; });
  var s = sheet_(), ideas = 0, ready = 0;
  for (var r = 2; r <= s.getLastRow(); r++) {
    var st = cellText_(r, C.STATUS), dt = cellText_(r, C.DATE);
    if (st === ST_IDEA) ideas++;
    var stop = st === ST.READY && postBlocked_(r); // موقوف تلقائي لحد ما بياناته تتصلّح
    if (st === ST.READY && !stop && validDate_(dt)) ready++; // اللي تاريخه فاضي/غلط مش هيتبعت
    if (cal[dt]) cal[dt].push(['📝', cellText_(r, C.HOOK) || ('بوست ' + cellText_(r, C.NUM)), stop ? st + ' ⛔ موقوف' : st]);
  }
  var rs = rsheet_(), readyR = 0;
  if (rs) for (var q = 2; q <= rs.getLastRow(); q++) {
    var rst = rtext_(q, RC.STATUS), rdt = rtext_(q, RC.DATE);
    var rstop = rst === RST.READY && reelBlocked_(q);
    if (rst === RST.READY && !rstop && validDate_(rdt)) readyR++;
    if (cal[rdt]) cal[rdt].push(['🎬', rtext_(q, RC.TITLE) || ('ريل ' + rtext_(q, RC.NUM)), rstop ? rst + ' ⛔ موقوف' : rst]);
  }
  var names = ['الحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
  var calHtml = days.map(function (d) {
    var items = cal[d], wd = names[new Date(d + 'T12:00:00Z').getUTCDay()];
    return '<div class="day' + (items.length ? '' : ' empty') + '"><b>' + wd + ' ' + d.substring(5) + '</b>' +
      (items.length ? items.map(function (x) { return '<div class="it">' + x[0] + ' ' + esc_(x[1]) + ' <span class="st">' + esc_(x[2]) + '</span></div>'; }).join('') : '<div class="it muted">فاضي</div>') + '</div>';
  }).join('');

  var top = analyticsRows_().filter(function (x) { return daysAgo_(x.date) <= 30; }).sort(function (a, b) { return b.eng - a.eng; }).slice(0, 5);
  var topHtml = top.length ? top.map(function (x) {
    return '<tr><td>' + esc_(x.platform + ' ' + x.kind + ' ' + x.num) + '</td><td>' + x.eng + '</td><td>' + (x.views || '-') + '</td><td><a href="' + esc_(x.link) + '" target="_blank">فتح</a></td></tr>';
  }).join('') : '<tr><td colspan="4" class="muted">لسه مفيش أرقام (فعّل ANALYTICS_ENABLED)</td></tr>';

  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>' +
    'body{font-family:system-ui,Tahoma,sans-serif;margin:16px;background:#f6f7fb;color:#1d2433}h1{font-size:20px}h2{font-size:16px;margin-top:24px}' +
    '.cards{display:flex;gap:8px;flex-wrap:wrap}.card{background:#fff;border-radius:10px;padding:10px 14px;box-shadow:0 1px 3px #0001}.card b{display:block;font-size:22px}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.day{background:#fff;border-radius:10px;padding:8px;box-shadow:0 1px 3px #0001}' +
    '.day.empty{opacity:.6}.it{font-size:13px;margin-top:4px}.st{font-size:11px;color:#5b6475}.muted{color:#8a93a5}' +
    'table{width:100%;background:#fff;border-radius:10px;border-collapse:collapse}td{padding:6px;border-bottom:1px solid #eee;font-size:13px}' +
    '</style></head><body><h1>داش بورد د. أحمد نبيل</h1>' +
    '<div class="cards"><div class="card"><b>' + ready + '</b>بوست جاهز</div><div class="card"><b>' + readyR + '</b>ريل جاهز</div>' +
    '<div class="card"><b>' + ideas + '</b>فكرة مستنية</div></div>' +
    '<h2>الأسبوعين الجايين</h2><div class="grid">' + calHtml + '</div>' +
    '<h2>الأحسن في آخر 30 يوم</h2><table><tr><td><b>المنشور</b></td><td><b>تفاعل</b></td><td><b>مشاهدات</b></td><td></td></tr>' + topHtml + '</table>' +
    '<p class="muted">آخر تحديث: ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') + '</p></body></html>';
}
