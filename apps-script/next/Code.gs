/**
 * نشر بوستات صفحة د. أحمد نبيل - موافقة على Telegram ثم نشر على فيسبوك
 * مفيش أي توكن أو سر مكتوب في الكود. كله بيتخزن في Script Properties من قايمة "إعداد النشر".
 */

var SHEET_NAME = 'Posts';
var PAGE_ID = '103991896132654';
var APP_ID = '1156816820230277';
var GRAPH = 'https://graph.facebook.com/v25.0/';
var TZ = 'Africa/Cairo';
var SEND_HOUR = 17; // القيمة الافتراضية. الساعة الفعلية من تاب Settings (SEND_HOUR) لو موجود
var HASHTAGS = '#Dr_Ahmed_Nabil ❤️\n#ويبقي_الاثر ✨';

// أعمدة الجدول
var C = { NUM: 1, DATE: 2, STATUS: 3, HOOK: 4, CAPTION: 5, IMG: 6, NOTES: 7, TGMSG: 8, FBID: 9, IG: 10, TYPE: 11, REQ: 12, IMGP: 13 };
var ST = { READY: 'جاهز', SENT: 'اتبعت للموافقة', APPROVED: 'تمت الموافقة', DONE: 'اتنشر' };

/* ---------- قايمة الإعداد في الجدول ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('إعداد النشر')
    .addItem('1) ربط Telegram', 'connectTelegram')
    .addItem('2) ربط فيسبوك', 'connectFacebook')
    .addItem('3) تشغيل النظام', 'startSystem')
    .addSeparator()
    .addItem('تجربة: ابعت بوست دلوقتي للموافقة', 'sendNextNow')
    .addItem('فحص الحالة', 'statusCheck')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('الريلز')
      .addItem('تجهيز تاب Reels', 'setupReelsSheet')
      .addItem('تجربة آمنة: ارفع أول ريل كمسودة على فيسبوك', 'testReelDraft')
      .addItem('ابعت ريل دلوقتي للموافقة', 'sendReelNow'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('الإضافات')
      .addItem('تجهيز الإضافات (مرة واحدة)', 'setupExtras')
      .addItem('فحص شامل للسيستم', 'healthCheckNow')
      .addItem('ربط إنستجرام (تجربة من غير نشر)', 'connectInstagram')
      .addItem('تحديث الأرقام دلوقتي', 'analyticsNow')
      .addItem('ابعت التقرير الأسبوعي دلوقتي', 'weeklyReportNow')
      .addSeparator()
      .addItem('اعمل قالب الصورة (Slides)', 'createImageTemplate')
      .addItem('تجربة صورة (على تيليجرام)', 'testPostImage')
      .addSeparator()
      .addItem('رابط الداش بورد', 'dashboardLink')
      .addItem('تفعيل Webhook (Cloudflare)', 'enableWebhook')
      .addItem('إلغاء Webhook', 'disableWebhook')
      .addSeparator()
      .addItem('إضافة عضو للفريق', 'addTeamMember'))
    .addToUi();
}

function props_() { return PropertiesService.getScriptProperties(); }

function connectTelegram() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('ربط Telegram', 'الصق توكن البوت من BotFather:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var token = r.getResponseText().trim();
  var me = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getMe', { muteHttpExceptions: true }).getContentText());
  if (!me.ok) { ui.alert('التوكن غلط. اتأكد إنك نسخته كامل وجرب تاني.'); return; }
  props_().setProperty('TG_TOKEN', token);
  // امسح أي webhook قديم عشان نستخدم الاستعلام الدوري
  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/deleteWebhook', { muteHttpExceptions: true });
  var up = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates', { muteHttpExceptions: true }).getContentText());
  var chat = null, last = 0;
  (up.result || []).forEach(function (u) {
    last = Math.max(last, u.update_id);
    if (u.message && u.message.chat && u.message.chat.type === 'private') chat = u.message.chat.id;
  });
  if (!chat) { ui.alert('البوت اتربط، بس مش لاقي محادثة. افتح البوت على Telegram واضغط Start وابعت أي رسالة، وبعدين شغّل "ربط Telegram" تاني.'); return; }
  props_().setProperty('CHAT_ID', String(chat));
  props_().setProperty('UPDATE_OFFSET', String(last + 1));
  tg_('sendMessage', { chat_id: chat, text: '✅ تم ربط البوت. بوستات النهارده هتوصلك هنا للموافقة.' });
  ui.alert('تم ربط Telegram ✅');
}

function connectFacebook() {
  var ui = SpreadsheetApp.getUi();
  var r1 = ui.prompt('ربط فيسبوك (1 من 2)', 'الصق توكن Graph API Explorer (الأزرق، اللي طلع بعد Generate Access Token):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var shortToken = r1.getResponseText().trim();
  var r2 = ui.prompt('ربط فيسبوك (2 من 2)', 'الصق App Secret بتاع التطبيق (من Settings ← Basic). مش بيتحفظ، بيتستخدم مرة واحدة بس:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var secret = r2.getResponseText().trim();
  // 1) حوّل التوكن القصير لتوكن طويل
  var ex = JSON.parse(UrlFetchApp.fetch(GRAPH + 'oauth/access_token?grant_type=fb_exchange_token&client_id=' + APP_ID +
    '&client_secret=' + encodeURIComponent(secret) + '&fb_exchange_token=' + encodeURIComponent(shortToken), { muteHttpExceptions: true }).getContentText());
  if (ex.error || !ex.access_token) { ui.alert('فشل التحويل: ' + (ex.error ? ex.error.message : 'سبب غير معروف')); return; }
  // 2) هات توكن الصفحة من التوكن الطويل (توكن الصفحة ده مش بينتهي)
  var res = JSON.parse(UrlFetchApp.fetch(GRAPH + PAGE_ID + '?fields=name,access_token&access_token=' + encodeURIComponent(ex.access_token), { muteHttpExceptions: true }).getContentText());
  if (res.error || !res.access_token) { ui.alert('التوكن مش شغال: ' + (res.error ? res.error.message : 'مفيش توكن للصفحة')); return; }
  props_().setProperty('FB_PAGE_TOKEN', res.access_token);
  // اتأكد إن التوكن دائم
  var dbg = JSON.parse(UrlFetchApp.fetch(GRAPH + 'debug_token?input_token=' + encodeURIComponent(res.access_token) +
    '&access_token=' + encodeURIComponent(res.access_token), { muteHttpExceptions: true }).getContentText());
  var never = dbg.data && Number(dbg.data.expires_at) === 0;
  ui.alert('تم ربط الصفحة: ' + res.name + ' ✅\n' + (never ? 'التوكن دائم (مش بينتهي).' : 'تنبيه: التوكن ممكن ينتهي، قولي لـ Claude.'));
}

function startSystem() {
  var ui = SpreadsheetApp.getUi();
  if (!props_().getProperty('TG_TOKEN') || !props_().getProperty('FB_PAGE_TOKEN')) {
    ui.alert('اربط Telegram وفيسبوك الأول (الخطوتين 1 و2).');
    return;
  }
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyJob').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('pollTelegram').timeBased().everyMinutes(1).create();
  ui.alert('النظام اشتغل ✅\nكل يوم الساعة 5 العصر بوست النهارده هيوصلك على Telegram للموافقة، وأي ضغطة منك بتتنفذ خلال دقيقة.');
}

function statusCheck() {
  var s = sheet_(), last = s.getLastRow(), ready = 0;
  for (var r = 2; r <= last; r++) if (s.getRange(r, C.STATUS).getValue() === ST.READY) ready++;
  SpreadsheetApp.getUi().alert(
    'Telegram: ' + (props_().getProperty('TG_TOKEN') ? 'متربط' : 'غير متربط') + '\n' +
    'فيسبوك: ' + (props_().getProperty('FB_PAGE_TOKEN') ? 'متربط' : 'غير متربط') + '\n' +
    'التشغيل التلقائي: ' + (ScriptApp.getProjectTriggers().length ? 'شغال' : 'متوقف') + '\n' +
    'بوستات جاهزة: ' + ready);
}

/* ---------- الجدول ---------- */

function sheet_() { return SpreadsheetApp.getActive().getSheetByName(SHEET_NAME); }
function cairoDate_(d) { return Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM-dd'); }
function cell_(row, col) { return sheet_().getRange(row, col); }
function cellText_(row, col) { return String(cell_(row, col).getValue() || '').replace(/^'/, ''); }

function ensureHashtags_(caption) {
  var c = String(caption || '').trim();
  if (c.indexOf('#Dr_Ahmed_Nabil') === -1) c += '\n\n' + HASHTAGS;
  return c;
}

/* ---------- الإرسال اليومي ---------- */

function dailyJob() {
  var now = new Date();
  try { reelsDailyJob_(now); } catch (e) { notify_('❌ خطأ في الريلز: ' + e.message); } // Reels.gs
  try { extrasHourly_(now); } catch (e) { notify_('❌ خطأ في الإضافات: ' + e.message); } // Settings.gs
  dailySend_(now);
  // لقطات الأرقام بعد إرسال البوست، عشان لو أخدت وقت أو وقفت ما تأخرش البوست (Snapshots.gs)
  try { if (typeof snapshotsJob_ === 'function') snapshotsJob_(); } catch (e) { try { notify_('❌ خطأ في لقطات الأرقام: ' + e.message); } catch (e2) {} }
}

function dailySend_(now) {
  var hour = Number(Utilities.formatDate(now, TZ, 'H')), sendHour = num_('SEND_HOUR');
  if (hour < sendHour || hour > sendHour + CATCHUP_HOURS) return;
  var today = cairoDate_(now);
  if (props_().getProperty('LAST_SENT_DATE') === today) return;
  if (hour > sendHour && !catchUpAllowed_(today, sendHour)) return; // الساعة عدّت ومابتعتش: محاولة متأخرة واحدة بس
  var ok = sendNext_(today);
  if (ok) props_().setProperty('LAST_SENT_DATE', today);
  else props_().setProperty('LAST_CATCHUP_DATE', today); // مفيش بوست جاهز: التنبيه وصل خلاص، ومفيش داعي لمحاولة متأخرة
}

// لو تشغيل الساعة SEND_HOUR ما حصلش (التريجر اتأخر أو وقف بخطأ)، بنحاول مرة واحدة بس في الساعات اللي بعدها.
var CATCHUP_HOURS = 4;

function catchUpAllowed_(today, sendHour) {
  var p = props_();
  if (p.getProperty('LAST_CATCHUP_DATE') === today) return false;
  p.setProperty('LAST_CATCHUP_DATE', today);
  if (p.getProperty('LAST_PUBLISHED_DATE') === today) { // اتنشر بوست النهارده من طريق تاني (Claude أو /post)
    p.setProperty('LAST_SENT_DATE', today);
    return false;
  }
  var s = sheet_(), pending = 0;
  for (var r = 2; r <= s.getLastRow(); r++) {
    var st = cellText_(r, C.STATUS);
    if (st === ST.SENT || st === ST.APPROVED) pending = cellText_(r, C.NUM);
  }
  if (pending) {
    notify_('⏰ بوست النهارده ما اتبعتش الساعة ' + sendHour + '. ما بعتش بوست جديد عشان بوست رقم ' + pending + ' لسه مستني موافقتك.');
    return false;
  }
  notify_('⏰ بوست النهارده ما اتبعتش الساعة ' + sendHour + '، فببعته دلوقتي.');
  return true;
}

function sendNextNow() {
  if (!sendNext_(cairoDate_())) SpreadsheetApp.getUi().alert('مفيش بوست جاهز بتاريخ النهارده أو قبله.');
}

function sendNext_(today) {
  var s = sheet_(), last = s.getLastRow(), row = 0, ready = 0;
  for (var r = 2; r <= last; r++) {
    if (cellText_(r, C.STATUS) !== ST.READY) continue;
    ready++;
    if (!row && cellText_(r, C.DATE) <= today) row = r;
  }
  if (!row) {
    tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'), text: '⚠️ مفيش بوست جاهز لبوست النهارده. محتاجين بوستات جديدة في الجدول.' });
    return false;
  }
  sendForApproval_(row);
  if (ready - 1 <= num_('LOW_READY_ALERT')) {
    var low = { chat_id: props_().getProperty('CHAT_ID'), text: '📌 فاضل ' + (ready - 1) + ' بوستات جاهزة بعد ده. وقت دفعة جديدة قرّب.' };
    if (on_('AI_ENABLED')) low.reply_markup = JSON.stringify({ inline_keyboard: [[{ text: '💡 اقترح 5 أفكار', callback_data: 'aid:5' }]] });
    tg_('sendMessage', low);
  }
  return true;
}

function sendForApproval_(row) {
  var chat = props_().getProperty('CHAT_ID');
  var caption = ensureHashtags_(cellText_(row, C.CAPTION));
  var blob = DriveApp.getFileById(cellText_(row, C.IMG)).getBlob();
  var keyboard = JSON.stringify({ inline_keyboard: [
    [{ text: '✅ انشر', callback_data: 'ok:' + row }, { text: '✏️ تعديل', callback_data: 'ed:' + row }],
    [{ text: '⏭ أجّل لبكرة', callback_data: 'sk:' + row }]
  ]});
  var tgCaption = caption.length <= 1000 ? caption : '';
  var res = tgPhoto_(chat, blob, tgCaption, caption.length <= 1000 ? keyboard : null);
  if (!tgCaption) {
    res = tg_('sendMessage', { chat_id: chat, text: caption, reply_markup: keyboard });
  }
  cell_(row, C.STATUS).setValue(ST.SENT);
  if (res && res.result) cell_(row, C.TGMSG).setValue(res.result.message_id);
}

/* ---------- استقبال ضغطات Telegram ---------- */

function pollTelegram() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var p = props_();
    p.setProperty('LAST_POLL_AT', String(new Date().getTime()));
    // في وضع webhook تيليجرام بيبعت لوحده على doPost (Web.gs)، فمانسألوش هنا (الاتنين مع بعض مش بيشتغلوا)
    if (setting_('TG_MODE') !== 'webhook') {
      var offset = Number(p.getProperty('UPDATE_OFFSET') || 0);
      // الـ offset لازم يتبعت كنص صريح في الرابط، وإلا تليجرام بيتجاهله ويرجّع نفس الرسايل كل دقيقة
      var res = tg_('getUpdates?offset=' + String(offset) + '&timeout=0', { allowed_updates: JSON.stringify(['message', 'callback_query']) });
      (res.result || []).forEach(function (u) {
        p.setProperty('UPDATE_OFFSET', String(u.update_id + 1));
        try { handleUpdate_(u); } catch (e) { notify_('❌ حصل خطأ: ' + e.message); }
      });
    }
    try { publishApproved_(); } catch (e) { notify_('❌ حصل خطأ في النشر: ' + e.message); }
    try { publishApprovedReels_(); } catch (e) { notify_('❌ حصل خطأ في نشر الريل: ' + e.message); } // Reels.gs
    try { igFinishPending_(); } catch (e) { notify_('❌ حصل خطأ في إنستجرام: ' + e.message); } // Instagram.gs
  } finally { lock.releaseLock(); }
}

// الموافقة من Claude: Claude بيغيّر حالة البوست في الشيت لـ "تمت الموافقة"، وهنا بننشره خلال دقيقة.
function publishApproved_() {
  var s = sheet_(), last = s.getLastRow();
  for (var r = 2; r <= last; r++) {
    if (cellText_(r, C.STATUS) === ST.APPROVED && !cellText_(r, C.FBID)) publish_(r);
  }
}

function handleUpdate_(u) {
  var chat = props_().getProperty('CHAT_ID');
  if (u.callback_query) {
    var cq = u.callback_query;
    if (String(cq.from.id) !== chat) return;
    tg_('answerCallbackQuery', { callback_query_id: cq.id });
    if (cq.data.charAt(0) === 'r') { handleReelCallback_(cq.data); return; } // زراير الريلز (Reels.gs)
    if (cq.data.indexOf('cm') === 0) { handleCommentCallback_(cq.data); return; } // زراير الكومنتات (Comments.gs)
    if (cq.data.indexOf('aid:') === 0) { requestIdeas_(Number(cq.data.split(':')[1]) || 5); return; } // AI.gs
    if (cq.data.indexOf('sch:') === 0) { scheduleIdea_(Number(cq.data.split(':')[1])); return; } // AI.gs
    if (cq.data.indexOf('igr:') === 0) { retryIgPost_(Number(cq.data.split(':')[1])); return; }
    var parts = cq.data.split(':'), act = parts[0], row = Number(parts[1]);
    var status = cellText_(row, C.STATUS);
    if (act === 'ok') {
      if (status !== ST.SENT) { notify_('البوست ده اتعالج قبل كده (' + status + ').'); return; }
      cell_(row, C.STATUS).setValue(ST.APPROVED);
      publish_(row);
    } else if (act === 'ed') {
      props_().setProperty('EDIT_ROW', String(row));
      notify_('✏️ ابعتلي الكابشن الجديد كامل في رسالة واحدة، وأنا هبعتهولك تاني للموافقة. (والهاشتاجات بتتضاف لوحدها)');
    } else if (act === 'sk') {
      var d = new Date(cellText_(row, C.DATE) + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      cell_(row, C.DATE).setNumberFormat('@').setValue(Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'));
      cell_(row, C.STATUS).setValue(ST.READY);
      notify_('⏭ اتأجّل لبكرة.');
    }
    return;
  }
  var m = u.message;
  if (!m || String(m.chat.id) !== chat) return;
  var text = m.text || '';
  // فويس أو فيديو على البوت (AI.gs)
  if (m.voice || m.audio) { ideaFromVoice_(m.voice || m.audio); return; }
  if (m.video || (m.document && /^video\//.test(m.document.mime_type || ''))) { videoToReel_(m); return; }
  if (handleCommentMessage_(text)) return; // رد مكتوب على كومنت (Comments.gs)
  if (text.indexOf('/idea') === 0) {
    var idea = text.substring(5).trim();
    if (!idea) notify_('اكتب الفكرة بعد /idea في نفس الرسالة.');
    else ideaFromText_(idea);
    return;
  }
  if (text === '/health') { notify_(runHealth_(true).text); return; }
  if (text === '/report') { weeklyReport_(); return; }
  if (handleReelMessage_(text)) return; // رسايل الريلز (Reels.gs)
  var editRow = Number(props_().getProperty('EDIT_ROW') || 0);
  if (editRow && text && text.charAt(0) !== '/') {
    var lnBefore = cellText_(editRow, C.CAPTION);
    cell_(editRow, C.CAPTION).setValue(ensureHashtags_(text));
    props_().deleteProperty('EDIT_ROW');
    if (typeof lnLogEdit_ === 'function') lnLogEdit_('بوست', cellText_(editRow, C.NUM), lnBefore, cellText_(editRow, C.CAPTION), 'تيليجرام'); // Learning.gs
    notify_('تمام، ده الكابشن المعدّل:');
    sendForApproval_(editRow);
  } else if (text === '/post') {
    sendNext_(cairoDate_());
  } else if (text === '/start' || text === '/help') {
    notify_('أنا بعتلك بوست النهارده كل يوم الساعة ' + num_('SEND_HOUR') + '، وريل النهارده الساعة ' + num_('REEL_SEND_HOUR') + ' للموافقة.\n' +
      '/post = ابعتلي بوست دلوقتي\n/reel = ابعتلي ريل دلوقتي\n/idea فكرتك = اكتبلي بوست منها\n/health = فحص السيستم\n/report = تقرير الأرقام\n' +
      'ابعت فويس ← فكرة بوست، وابعت فيديو ← ريل جديد. Claude بيكتبهم في ميعاده (' + setting_('CLAUDE_TIMES') + ').');
  }
}

/* ---------- النشر على فيسبوك ---------- */

function publish_(row) {
  var token = props_().getProperty('FB_PAGE_TOKEN');
  var blob = stripImageMeta_(DriveApp.getFileById(cellText_(row, C.IMG)).getBlob());
  var caption = ensureHashtags_(cellText_(row, C.CAPTION));
  var resp = UrlFetchApp.fetch(GRAPH + PAGE_ID + '/photos', {
    method: 'post',
    payload: { source: blob, caption: caption, published: 'true', access_token: token },
    muteHttpExceptions: true
  });
  var j = JSON.parse(resp.getContentText());
  if (j.error) {
    cell_(row, C.STATUS).setValue(ST.SENT);
    notify_('❌ النشر فشل: ' + j.error.message + '\nممكن توكن فيسبوك انتهى. شغّل "2) ربط فيسبوك" من قايمة الجدول.');
    return;
  }
  var postId = j.post_id || j.id;
  cell_(row, C.STATUS).setValue(ST.DONE);
  cell_(row, C.FBID).setValue(postId);
  props_().setProperty('LAST_PUBLISHED_DATE', cairoDate_());
  notify_('✅ اتنشر على الصفحة.\nhttps://www.facebook.com/' + postId);
  if (on_('IG_ENABLED') && !cellText_(row, C.IG)) retryIgPost_(row); // Instagram.gs
}

// إنستجرام بعد فيسبوك. لو فشل، فيسبوك بيفضل منشور ويتبعتلك زرار يعيد إنستجرام بس.
function retryIgPost_(row) {
  if (cellText_(row, C.IG)) { notify_('البوست ده اتنشر على إنستجرام قبل كده.'); return; }
  try {
    var link = igPublishPhoto_(row);
    cell_(row, C.IG).setValue(link);
    notify_('✅ إنستجرام: اتنشر.\n' + link);
  } catch (e) {
    tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'), text: '❌ إنستجرام: البوست فشل.\n' + e.message,
      reply_markup: JSON.stringify({ inline_keyboard: [[{ text: '🔁 أعد إنستجرام بس', callback_data: 'igr:' + row }]] }) });
  }
}

/* ---------- شيل البيانات المخفية من الصورة ----------
 * ChatGPT بيحط جوه الصورة بيانات (C2PA / XMP / EXIF) بتقول إنها معمولة بالذكاء الاصطناعي،
 * وفيسبوك بيقراها ويحط علامة "محتوى ذكاء اصطناعي". هنا بنشيل البيانات دي بس، والصورة نفسها ما بتتغيرش.
 */
function stripImageMeta_(blob) {
  try {
    var b = blob.getBytes(), name = blob.getName();
    var u = function (i) { return b[i] & 0xFF; };
    var out = null, mime = null;
    // PNG: نسيب بس الأجزاء اللي بترسم الصورة، ونشيل أي نصوص أو بيانات (caBX/tEXt/iTXt/zTXt/eXIf ...)
    if (u(0) === 0x89 && u(1) === 0x50 && u(2) === 0x4E && u(3) === 0x47) {
      var keep = { IHDR: 1, PLTE: 1, IDAT: 1, IEND: 1, tRNS: 1, gAMA: 1, cHRM: 1, sRGB: 1, iCCP: 1, sBIT: 1, pHYs: 1, bKGD: 1 };
      out = b.slice(0, 8);
      var p = 8;
      while (p + 12 <= b.length) {
        var len = ((u(p) << 24) | (u(p + 1) << 16) | (u(p + 2) << 8) | u(p + 3)) >>> 0;
        var type = String.fromCharCode(u(p + 4), u(p + 5), u(p + 6), u(p + 7));
        var end = p + 12 + len;
        if (end > b.length) return blob; // ملف غريب: نسيبه زي ما هو
        if (keep[type]) out = out.concat(b.slice(p, end));
        p = end;
        if (type === 'IEND') break;
      }
      mime = 'image/png';
    // JPEG: نشيل APP1 (EXIF/XMP) و APP11 (C2PA) و APP13 والتعليقات، ونسيب الباقي
    } else if (u(0) === 0xFF && u(1) === 0xD8) {
      out = b.slice(0, 2);
      var q = 2;
      while (q + 4 <= b.length && u(q) === 0xFF) {
        var m = u(q + 1);
        if (m === 0xDA) { out = out.concat(b.slice(q)); break; } // من هنا بيانات الصورة نفسها
        var seg = (u(q + 2) << 8) | u(q + 3);
        var drop = (m === 0xE1 || m === 0xEB || m === 0xED || m === 0xFE);
        if (!drop) out = out.concat(b.slice(q, q + 2 + seg));
        q += 2 + seg;
      }
      mime = 'image/jpeg';
    // WebP (صور ChatGPT بتطلع WebP حتى لو اسمها .png): نشيل C2PA و EXIF و XMP
    } else if (u(0) === 0x52 && u(1) === 0x49 && u(2) === 0x46 && u(3) === 0x46 && u(8) === 0x57 && u(9) === 0x45 && u(10) === 0x42 && u(11) === 0x50) {
      var keepW = { 'VP8 ': 1, 'VP8L': 1, 'VP8X': 1, 'ALPH': 1, 'ANIM': 1, 'ANMF': 1, 'ICCP': 1 };
      var body = [], w = 12;
      while (w + 8 <= b.length) {
        var wt = String.fromCharCode(u(w), u(w + 1), u(w + 2), u(w + 3));
        var wl = (u(w + 4) | (u(w + 5) << 8) | (u(w + 6) << 16) | (u(w + 7) << 24)) >>> 0;
        var wend = w + 8 + wl + (wl % 2);
        if (w + 8 + wl > b.length) return blob; // ملف غريب: نسيبه زي ما هو
        if (keepW[wt]) {
          var part = b.slice(w, Math.min(wend, b.length));
          if (wt === 'VP8X') part[8] = part[8] & ~0x0C; // نشيل علامة وجود EXIF و XMP
          body = body.concat(part);
        }
        w = wend;
      }
      var size = body.length + 4;
      var sz = [size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >>> 24) & 0xFF];
      for (var k = 0; k < 4; k++) if (sz[k] > 127) sz[k] -= 256;
      out = [82, 73, 70, 70].concat(sz, [87, 69, 66, 80], body);
      mime = 'image/webp';
    }
    if (!out) return blob;
    return Utilities.newBlob(out, mime, name);
  } catch (e) {
    return blob; // لو حصل أي خطأ ننشر الصورة الأصلية بدل ما النشر يقف
  }
}

/* ---------- Telegram ---------- */

function notify_(text) { tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'), text: text }); }

function tg_(method, payload) {
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + props_().getProperty('TG_TOKEN') + '/' + method, {
    method: 'post', payload: payload, muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText());
}

function tgPhoto_(chat, blob, caption, keyboard) {
  var payload = { chat_id: chat, photo: blob };
  if (caption) payload.caption = caption;
  if (keyboard) payload.reply_markup = keyboard;
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + props_().getProperty('TG_TOKEN') + '/sendPhoto', {
    method: 'post', payload: payload, muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText());
}
