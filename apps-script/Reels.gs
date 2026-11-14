/**
 * ريلز صفحة د. أحمد نبيل - المرحلة 1: فيسبوك ريلز
 * الريل بيتبعت على Telegram للموافقة، وبعد "انشر" بيترفع على فيسبوك ريلز.
 * الملف ده بيستخدم نفس التوكنز والدوال المشتركة اللي في Code.gs (props_, tg_, notify_, GRAPH, PAGE_ID, TZ).
 * يوتيوب (المرحلة 2) لسه متضافش.
 */

var REELS_SHEET = 'Reels';
var REEL_SEND_HOUR = 20; // الساعة اللي بيتبعت فيها ريل النهارده للموافقة (8 بالليل بتوقيت القاهرة)
var REEL_TAGS = '#ثانوية_عامة #كيمياء_تالتة_ثانوي #Dr_Ahmed_Nabil';
var REEL_MAX_BYTES = 50 * 1024 * 1024; // حد Apps Script وحد إرسال الفيديو من بوت Telegram

// أعمدة تاب Reels
var RC = { NUM: 1, DATE: 2, STATUS: 3, TITLE: 4, CAPTION: 5, TOPIC: 6, VIDEO: 7, FB: 8, YT: 9, NOTES: 10, TGMSG: 11 };
var RST = { READY: 'جاهز', SENT: 'اتبعت للموافقة', APPROVED: 'تمت الموافقة', DONE: 'اتنشر', FAILED: 'فشل' };
var REEL_HEADERS = ['رقم', 'التاريخ', 'الحالة', 'العنوان', 'الكابشن', 'هاشتاج الموضوع', 'ID ملف الفيديو', 'رابط فيسبوك', 'رابط يوتيوب', 'ملاحظات', 'رسالة تيليجرام'];

/* ---------- تجهيز التاب ---------- */

function setupReelsSheet() {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(REELS_SHEET);
  if (!s) s = ss.insertSheet(REELS_SHEET);
  s.getRange(1, 1, 1, REEL_HEADERS.length).setValues([REEL_HEADERS]).setFontWeight('bold');
  s.setFrozenRows(1);
  s.getRange('B:B').setNumberFormat('@'); // التاريخ كنص yyyy-MM-dd
  s.getRange('G:G').setNumberFormat('@'); // ID الفيديو كنص
  s.setRightToLeft(true);
  SpreadsheetApp.getUi().alert('تاب Reels جاهز ✅\nحط في كل صف: الرقم، التاريخ (yyyy-MM-dd)، الحالة "جاهز"، العنوان، الكابشن، هاشتاج الموضوع، و ID ملف الفيديو من Drive.');
}

/* ---------- أدوات الجدول ---------- */

function rsheet_() { return SpreadsheetApp.getActive().getSheetByName(REELS_SHEET); }
function rcell_(row, col) { return rsheet_().getRange(row, col); }
function rtext_(row, col) { return String(rcell_(row, col).getValue() || '').replace(/^'/, '').trim(); }

function reelCaption_(row) {
  var caption = rtext_(row, RC.CAPTION);
  var topic = rtext_(row, RC.TOPIC).replace(/\s+/g, '_');
  if (topic && topic.charAt(0) !== '#') topic = '#' + topic;
  var tags = (topic ? topic + ' ' : '') + REEL_TAGS;
  return (caption ? caption + '\n\n' : '') + tags;
}

function reelBlob_(row) {
  var id = rtext_(row, RC.VIDEO);
  if (!id) throw new Error('مفيش ID ملف فيديو في صف ' + row);
  var file = DriveApp.getFileById(id);
  if (file.getSize() > REEL_MAX_BYTES) throw new Error('الفيديو أكبر من 50 ميجا (' + Math.round(file.getSize() / 1048576) + ' ميجا). صدّره بحجم أصغر.');
  return file.getBlob();
}

/* ---------- الإرسال اليومي للموافقة ---------- */

// بتتنده من dailyJob في Code.gs كل ساعة
function reelsDailyJob_(now) {
  if (!rsheet_()) return;
  if (Number(Utilities.formatDate(now, TZ, 'H')) !== REEL_SEND_HOUR) return;
  var today = cairoDate_(now);
  if (props_().getProperty('LAST_REEL_DATE') === today) return;
  if (sendNextReel_(today)) props_().setProperty('LAST_REEL_DATE', today);
}

function sendReelNow() {
  if (!sendNextReel_(cairoDate_())) SpreadsheetApp.getUi().alert('مفيش ريل جاهز بتاريخ النهارده أو قبله.');
}

function nextReadyReel_(today) {
  var s = rsheet_();
  if (!s) return 0;
  for (var r = 2; r <= s.getLastRow(); r++) {
    if (rtext_(r, RC.STATUS) === RST.READY && rtext_(r, RC.DATE) <= today) return r;
  }
  return 0;
}

function sendNextReel_(today) {
  var row = nextReadyReel_(today);
  if (!row) return false;
  sendReelForApproval_(row);
  return true;
}

function sendReelForApproval_(row) {
  var chat = props_().getProperty('CHAT_ID');
  var caption = reelCaption_(row);
  var keyboard = JSON.stringify({ inline_keyboard: [
    [{ text: '✅ انشر الريل', callback_data: 'rok:' + row }, { text: '✏️ تعديل الكابشن', callback_data: 'red:' + row }],
    [{ text: '⏭ أجّل لبكرة', callback_data: 'rsk:' + row }]
  ]});
  var head = '🎬 ريل رقم ' + rtext_(row, RC.NUM) + ' — ' + rtext_(row, RC.TITLE);
  var full = head + '\n\n' + caption;
  var short = full.length <= 1000;
  var res;
  try {
    res = tgVideo_(chat, reelBlob_(row), short ? full : head, short ? keyboard : null);
  } catch (e) {
    rcell_(row, RC.NOTES).setValue(e.message);
    notify_('❌ ريل رقم ' + rtext_(row, RC.NUM) + ': ' + e.message);
    return;
  }
  if (!res || !res.ok) {
    notify_('❌ الريل ما اتبعتش على Telegram: ' + (res && res.description ? res.description : 'سبب غير معروف'));
    return;
  }
  if (!short) res = tg_('sendMessage', { chat_id: chat, text: caption, reply_markup: keyboard });
  rcell_(row, RC.STATUS).setValue(RST.SENT);
  if (res && res.result) rcell_(row, RC.TGMSG).setValue(res.result.message_id);
}

/* ---------- ضغطات ورسايل Telegram الخاصة بالريلز ---------- */

// بتتنده من handleUpdate_ في Code.gs لأي زرار بيبدأ بحرف r
function handleReelCallback_(data) {
  var parts = data.split(':'), act = parts[0], row = Number(parts[1]);
  var status = rtext_(row, RC.STATUS);
  if (act === 'rok') {
    if (status !== RST.SENT) { notify_('الريل ده اتعالج قبل كده (' + status + ').'); return; }
    rcell_(row, RC.STATUS).setValue(RST.APPROVED);
    publishReel_(row);
  } else if (act === 'red') {
    props_().setProperty('REEL_EDIT_ROW', String(row));
    notify_('✏️ ابعتلي كابشن الريل الجديد كامل في رسالة واحدة. (الهاشتاجات بتتضاف لوحدها)');
  } else if (act === 'rsk') {
    var d = new Date(rtext_(row, RC.DATE) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    rcell_(row, RC.DATE).setValue(Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'));
    rcell_(row, RC.STATUS).setValue(RST.READY);
    notify_('⏭ الريل اتأجّل لبكرة.');
  }
}

// بتتنده من handleUpdate_ قبل منطق البوستات. بترجع true لو الرسالة تخص الريلز.
function handleReelMessage_(text) {
  var editRow = Number(props_().getProperty('REEL_EDIT_ROW') || 0);
  if (editRow && text && text.charAt(0) !== '/') {
    rcell_(editRow, RC.CAPTION).setValue(text.trim());
    props_().deleteProperty('REEL_EDIT_ROW');
    notify_('تمام، ده الريل بالكابشن المعدّل:');
    sendReelForApproval_(editRow);
    return true;
  }
  if (text === '/reel') {
    if (!sendNextReel_(cairoDate_())) notify_('مفيش ريل جاهز بتاريخ النهارده أو قبله.');
    return true;
  }
  return false;
}

/* ---------- النشر على فيسبوك ريلز ---------- */

function publishReel_(row) {
  try {
    var id = uploadFbReel_(row, 'PUBLISHED');
    var link = 'https://www.facebook.com/reel/' + id;
    rcell_(row, RC.FB).setValue(link);
    rcell_(row, RC.STATUS).setValue(RST.DONE);
    rcell_(row, RC.NOTES).setValue('');
    notify_('✅ فيسبوك: الريل اترفع وبيتنشر (ممكن ياخد دقايق لحد ما يظهر).\n' + link);
  } catch (e) {
    rcell_(row, RC.STATUS).setValue(RST.FAILED);
    rcell_(row, RC.NOTES).setValue(e.message);
    notify_('❌ فيسبوك: الريل فشل.\n' + e.message + '\nلما تصلّح المشكلة، رجّع الحالة في الشيت لـ "جاهز".');
  }
}

// الرفع على 3 خطوات حسب Reels Publishing API: start ← رفع الملف ← finish
// state = 'PUBLISHED' للنشر، أو 'DRAFT' للتجربة من غير ما حد يشوفه
function uploadFbReel_(row, state) {
  var token = props_().getProperty('FB_PAGE_TOKEN');
  var blob = reelBlob_(row);

  var start = fbJson_(UrlFetchApp.fetch(GRAPH + PAGE_ID + '/video_reels', {
    method: 'post', payload: { upload_phase: 'start', access_token: token }, muteHttpExceptions: true
  }));
  var videoId = start.video_id;
  if (!videoId) throw new Error('فيسبوك ما رجّعش video_id');

  var bytes = blob.getBytes();
  var up = fbJson_(UrlFetchApp.fetch('https://rupload.facebook.com/video-upload/' + GRAPH.split('/').slice(-2, -1)[0] + '/' + videoId, {
    method: 'post',
    headers: { Authorization: 'OAuth ' + token, offset: '0', file_size: String(bytes.length) },
    contentType: 'application/octet-stream',
    payload: bytes,
    muteHttpExceptions: true
  }));
  if (!up.success) throw new Error('رفع الملف ما نجحش');

  var fin = fbJson_(UrlFetchApp.fetch(GRAPH + PAGE_ID + '/video_reels', {
    method: 'post',
    payload: { upload_phase: 'finish', video_id: videoId, video_state: state, description: reelCaption_(row), access_token: token },
    muteHttpExceptions: true
  }));
  if (!fin.success) throw new Error('خطوة النشر الأخيرة ما نجحتش');

  // استنى شوية واتأكد إن فيسبوك قبل الفيديو (زي الدقة والمدة)
  Utilities.sleep(20000);
  var st = fbJson_(UrlFetchApp.fetch(GRAPH + videoId + '?fields=status&access_token=' + encodeURIComponent(token), { muteHttpExceptions: true }));
  var phases = st.status || {};
  ['uploading_phase', 'processing_phase', 'publishing_phase'].forEach(function (k) {
    if (phases[k] && phases[k].error) throw new Error('فيسبوك رفض الفيديو: ' + phases[k].error.message);
  });
  return videoId;
}

function fbJson_(resp) {
  var j = JSON.parse(resp.getContentText() || '{}');
  if (j.error) throw new Error(j.error.message + (j.error.code === 190 ? '\nتوكن فيسبوك انتهى. شغّل "2) ربط فيسبوك".' : ''));
  return j;
}

/* ---------- تجربة آمنة ---------- */

// بترفع أول ريل "جاهز" كمسودة (DRAFT) على الصفحة: محدش هيشوفه، والحالة في الشيت ما بتتغيرش
function testReelDraft() {
  var ui = SpreadsheetApp.getUi();
  var row = nextReadyReel_('9999-12-31');
  if (!row) { ui.alert('مفيش ريل حالته "جاهز" في تاب Reels.'); return; }
  try {
    var id = uploadFbReel_(row, 'DRAFT');
    ui.alert('التجربة نجحت ✅\nالريل اترفع كمسودة (محدش شايفه). تقدر تشوفه وتمسحه من Meta Business Suite ← Content.\nvideo_id: ' + id);
  } catch (e) {
    ui.alert('التجربة فشلت ❌\n' + e.message);
  }
}

/* ---------- Telegram ---------- */

function tgVideo_(chat, blob, caption, keyboard) {
  var payload = { chat_id: chat, video: blob, supports_streaming: 'true' };
  if (caption) payload.caption = caption;
  if (keyboard) payload.reply_markup = keyboard;
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + props_().getProperty('TG_TOKEN') + '/sendVideo', {
    method: 'post', payload: payload, muteHttpExceptions: true
  });
  return JSON.parse(r.getContentText());
}
