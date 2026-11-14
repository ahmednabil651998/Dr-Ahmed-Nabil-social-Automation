/**
 * نشر بوستات صفحة د. أحمد نبيل - موافقة على Telegram ثم نشر على فيسبوك
 * مفيش أي توكن أو سر مكتوب في الكود. كله بيتخزن في Script Properties من قايمة "إعداد النشر".
 */

var SHEET_NAME = 'Posts';
var PAGE_ID = '103991896132654';
var APP_ID = '1156816820230277';
var GRAPH = 'https://graph.facebook.com/v25.0/';
var TZ = 'Africa/Cairo';
var SEND_HOUR = 17; // الساعة اللي بيتبعت فيها بوست النهارده للموافقة (بتوقيت القاهرة)
var HASHTAGS = '#Dr_Ahmed_Nabil ❤️\n#ويبقي_الاثر ✨';

// أعمدة الجدول
var C = { NUM: 1, DATE: 2, STATUS: 3, HOOK: 4, CAPTION: 5, IMG: 6, NOTES: 7, TGMSG: 8, FBID: 9 };
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
  if (Number(Utilities.formatDate(now, TZ, 'H')) !== SEND_HOUR) return;
  var today = cairoDate_(now);
  if (props_().getProperty('LAST_SENT_DATE') === today) return;
  var ok = sendNext_(today);
  if (ok) props_().setProperty('LAST_SENT_DATE', today);
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
  if (ready - 1 <= 2) {
    tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'), text: '📌 فاضل ' + (ready - 1) + ' بوستات جاهزة بعد ده. وقت دفعة جديدة قرّب.' });
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
    var p = props_(), offset = Number(p.getProperty('UPDATE_OFFSET') || 0);
    // الـ offset لازم يتبعت كنص صريح في الرابط، وإلا تليجرام بيتجاهله ويرجّع نفس الرسايل كل دقيقة
    var res = tg_('getUpdates?offset=' + String(offset) + '&timeout=0', { allowed_updates: JSON.stringify(['message', 'callback_query']) });
    (res.result || []).forEach(function (u) {
      p.setProperty('UPDATE_OFFSET', String(u.update_id + 1));
      try { handleUpdate_(u); } catch (e) { notify_('❌ حصل خطأ: ' + e.message); }
    });
  } finally { lock.releaseLock(); }
}

function handleUpdate_(u) {
  var chat = props_().getProperty('CHAT_ID');
  if (u.callback_query) {
    var cq = u.callback_query;
    if (String(cq.from.id) !== chat) return;
    tg_('answerCallbackQuery', { callback_query_id: cq.id });
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
  var editRow = Number(props_().getProperty('EDIT_ROW') || 0);
  if (editRow && text && text.charAt(0) !== '/') {
    cell_(editRow, C.CAPTION).setValue(ensureHashtags_(text));
    props_().deleteProperty('EDIT_ROW');
    notify_('تمام، ده الكابشن المعدّل:');
    sendForApproval_(editRow);
  } else if (text === '/post') {
    sendNext_(cairoDate_());
  } else if (text === '/start' || text === '/help') {
    notify_('أنا بعتلك بوست النهارده كل يوم الساعة 5 العصر للموافقة.\n/post = ابعتلي بوست دلوقتي');
  }
}

/* ---------- النشر على فيسبوك ---------- */

function publish_(row) {
  var token = props_().getProperty('FB_PAGE_TOKEN');
  var blob = DriveApp.getFileById(cellText_(row, C.IMG)).getBlob();
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
  notify_('✅ اتنشر على الصفحة.\nhttps://www.facebook.com/' + postId);
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
