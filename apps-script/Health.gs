/**
 * الفحص اليومي للسيستم: التوكنز، التريجرز، المحتوى الجاهز، والحالات العالقة.
 * بيبعتلك على تيليجرام قبل ما النشر يقف، مش بعد.
 */

function healthCheckNow() {
  var res = runHealth_(true);
  SpreadsheetApp.getUi().alert(res.text);
}

// manual = true: يرجّع التقرير كامل حتى لو مفيش مشاكل
function runHealth_(manual) {
  var ok = [], bad = [];
  var p = props_();

  // 1) توكن فيسبوك
  try {
    var me = fbJson_(UrlFetchApp.fetch(GRAPH + 'me?fields=id,name&access_token=' + encodeURIComponent(p.getProperty('FB_PAGE_TOKEN')), { muteHttpExceptions: true }));
    ok.push('فيسبوك: ' + me.name);
  } catch (e) { bad.push('فيسبوك: ' + e.message); }

  // 2) يوتيوب
  if (YT_ENABLED) {
    try { ok.push('يوتيوب: ' + checkYtChannel_(ytToken_())); }
    catch (e) { bad.push('يوتيوب: ' + e.message + '\n(لو invalid_grant: اعمل موافقة جديدة من OAuth Playground — docs/youtube-status.md)'); }
  }

  // 3) إنستجرام
  if (on_('IG_ENABLED') || on_('IG_REELS_ENABLED')) {
    try { ok.push('إنستجرام: @' + igAccount_().username); }
    catch (e) { bad.push('إنستجرام: ' + e.message); }
  }

  // 4) Telegram
  try {
    var tgMe = tg_('getMe', {});
    if (!tgMe.ok) throw new Error(tgMe.description || 'التوكن مش شغال');
    if (setting_('TG_MODE') === 'webhook') {
      var wh = tg_('getWebhookInfo', {}).result || {};
      if (!wh.url) bad.push('تيليجرام: الوضع webhook بس مفيش webhook متسجل. شغّل "تفعيل Webhook" تاني أو رجّع TG_MODE لـ polling.');
      else if (wh.last_error_message) bad.push('تيليجرام webhook: آخر خطأ "' + wh.last_error_message + '"، وفيه ' + (wh.pending_update_count || 0) + ' رسايل مستنية.');
    }
    ok.push('تيليجرام: @' + tgMe.result.username);
  } catch (e) { bad.push('تيليجرام: ' + e.message); }

  // 5) Gemini
  if (on_('AI_ENABLED')) {
    if (!p.getProperty('GEMINI_API_KEY')) bad.push('الذكاء الاصطناعي متفعّل بس مفيش GEMINI_API_KEY في Script Properties.');
    else {
      try { ai_([{ text: 'رد بكلمة واحدة: تمام' }], false); ok.push('Gemini: شغال'); }
      catch (e) { bad.push('Gemini: ' + e.message); }
    }
  }

  // 5ب) الصور (Cloudflare + القالب)
  if (on_('IMAGES_ENABLED')) {
    if (!p.getProperty('CF_ACCOUNT_ID') || !p.getProperty('CF_API_TOKEN')) bad.push('الصور متفعّلة بس مفيش CF_ACCOUNT_ID أو CF_API_TOKEN في Script Properties.');
    try { DriveApp.getFileById(setting_('IMAGE_TEMPLATE_ID')).getName(); ok.push('قالب الصورة: موجود'); }
    catch (e) { bad.push('قالب الصورة مش موجود. شغّل "اعمل قالب الصورة".'); }
  }

  // 5ج) طابور Claude: حاجات مستنية من أكتر من يومين
  var waiting = 0, sw = sheet_();
  for (var w = 2; w <= sw.getLastRow(); w++) if (cellText_(w, C.STATUS) === ST_WRITE) waiting++;
  if (waiting) ok.push('مستني Claude يكتبه: ' + waiting);

  // 6) التريجرز
  var handlers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['dailyJob', 'pollTelegram'].forEach(function (f) {
    if (handlers.indexOf(f) === -1) bad.push('التريجر ' + f + ' مش موجود. شغّل "3) تشغيل النظام".');
  });
  var lastPoll = Number(p.getProperty('LAST_POLL_AT') || 0);
  if (lastPoll && new Date().getTime() - lastPoll > 30 * 60000) bad.push('pollTelegram ما اشتغلش من أكتر من نص ساعة.');

  // 7) المحتوى الجاهز والحالات العالقة
  var today = cairoDate_();
  var s = sheet_(), readyPosts = 0, stuck = [], review = [], noFbId = [];
  for (var r = 2; r <= s.getLastRow(); r++) {
    var st = cellText_(r, C.STATUS), d = cellText_(r, C.DATE);
    // البوست الموقوف (بيانات بايظة) أو اللي تاريخه فاضي/غلط مش هيتبعت، فمابيتحسبش جاهز
    if (st === ST.READY) {
      if (postBlocked_(r)) stuck.push('بوست ' + cellText_(r, C.NUM) + ' (موقوف: بيانات بايظة، شوف الملاحظات)');
      else if (!validDate_(d)) stuck.push('بوست ' + cellText_(r, C.NUM) + ' (جاهز بس التاريخ فاضي أو مش yyyy-MM-dd)');
      else readyPosts++;
    }
    if ((st === ST.SENT || st === ST.APPROVED) && d && d < today && daysAgo_(d) >= 2) stuck.push('بوست ' + cellText_(r, C.NUM) + ' (' + st + ')');
    // "محتاج مراجعة" (Code.gs): فيسبوك ما أكدش النشر، وبيتنبّه عليه كل يوم لحد ما يتراجع
    if (typeof ST_REVIEW !== 'undefined' && st === ST_REVIEW) review.push(cellText_(r, C.NUM));
    if (st === ST.DONE && !cellText_(r, C.FBID) && daysAgo_(d) <= 60) noFbId.push(cellText_(r, C.NUM));
  }
  if (review.length) bad.push('محتاج مراجعة (فيسبوك ما أكدش النشر): بوست ' + review.join('، ') + '. افتح الصفحة واتأكد، وبعدين دوس «✅ اتنشر فعلًا» أو «🔁 ما اتنشرش، انشره» في رسالة تيليجرام.');
  if (noFbId.length) bad.push('اتنشر من غير رقم فيسبوك، فأرقامه مش بتتسحب: بوست ' + noFbId.join('، ') + '. ابعت: /fbid رقم_البوست اللينك');
  var readyReels = 0, rs = rsheet_();
  if (rs) {
    for (var q = 2; q <= rs.getLastRow(); q++) {
      var rst = rtext_(q, RC.STATUS);
      if (rst === RST.READY) {
        if (reelBlocked_(q)) stuck.push('ريل ' + rtext_(q, RC.NUM) + ' (موقوف: بيانات بايظة، شوف الملاحظات)');
        else if (!validDate_(rtext_(q, RC.DATE))) stuck.push('ريل ' + rtext_(q, RC.NUM) + ' (جاهز بس التاريخ فاضي أو مش yyyy-MM-dd)');
        else readyReels++;
      }
      if (rst === RST.FAILED) stuck.push('ريل ' + rtext_(q, RC.NUM) + ' (فشل جزئي)');
      if (rst === RST.SENT && daysAgo_(rtext_(q, RC.DATE)) >= 2) stuck.push('ريل ' + rtext_(q, RC.NUM) + ' (' + rst + ')');
    }
  }
  if (readyPosts <= num_('LOW_READY_ALERT')) bad.push('البوستات الجاهزة: ' + readyPosts + ' بس.');
  else ok.push('بوستات جاهزة: ' + readyPosts);
  if (rs) ok.push('ريلز جاهزة: ' + readyReels);
  if (stuck.length) bad.push('حاجات عالقة: ' + stuck.join('، '));

  var text = (bad.length ? '⚠️ الفحص اليومي لقى ' + bad.length + ' مشكلة:\n• ' + bad.join('\n• ') + '\n\n' : '✅ الفحص اليومي: كله تمام.\n') +
    (manual || bad.length ? '\nالشغال:\n• ' + ok.join('\n• ') : '');
  if (!manual) {
    if (bad.length) notify_(text);
    else notify_('✅ الفحص اليومي: كله تمام (' + readyPosts + ' بوست و ' + readyReels + ' ريل جاهزين).');
  }
  return { ok: ok, bad: bad, text: text };
}
