/**
 * ريلز صفحة د. أحمد نبيل - فيسبوك ريلز + يوتيوب Shorts
 * الريل بيتبعت على Telegram للموافقة، وبعد "انشر" بيترفع على فيسبوك ريلز وبعده يوتيوب Shorts.
 * الملف ده بيستخدم نفس التوكنز والدوال المشتركة اللي في Code.gs (props_, tg_, notify_, GRAPH, PAGE_ID, TZ).
 * يوتيوب بيترفع بتوكن حساب 998 (صاحب القناة) عن طريق مشروع Google Cloud "drahmed-youtube" على حساب 999.
 * محتاج في Script Properties: YT_CLIENT_ID و YT_CLIENT_SECRET و YT_REFRESH_TOKEN (شوف docs/youtube-status.md).
 */

var REELS_SHEET = 'Reels';
var REEL_SEND_HOUR = 19; // القيمة الافتراضية. الساعة الفعلية من تاب Settings (REEL_SEND_HOUR) لو موجود
var REEL_TAGS = '#ثانوية_عامة #كيمياء_تالتة_ثانوي #Dr_Ahmed_Nabil';
var YT_ENABLED = true; // شغال: الرفع بتوكن 998 اتجرب ونجح 2026-11-16 (شوف docs/youtube-status.md)
var YT_CHANNEL_TITLE = 'Dr Ahmed Nabil - Chemistry'; // القناة اللي لازم يتنشر عليها
var YT_CATEGORY = '27'; // Education
var REEL_MAX_BYTES = 50 * 1024 * 1024; // حد Apps Script وحد إرسال الفيديو من بوت Telegram

// أعمدة تاب Reels
var RC = { NUM: 1, DATE: 2, STATUS: 3, TITLE: 4, CAPTION: 5, TOPIC: 6, VIDEO: 7, FB: 8, YT: 9, NOTES: 10, TGMSG: 11, IG: 12 };
var RST = { READY: 'جاهز', SENT: 'اتبعت للموافقة', APPROVED: 'تمت الموافقة', DONE: 'اتنشر', FAILED: 'فشل جزئي' };
var REEL_HEADERS = ['رقم', 'التاريخ', 'الحالة', 'العنوان', 'الكابشن', 'هاشتاج الموضوع', 'ID ملف الفيديو', 'رابط فيسبوك', 'رابط يوتيوب', 'ملاحظات', 'رسالة تيليجرام', 'رابط إنستجرام'];

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

function reelTopicTag_(row) {
  var topic = rtext_(row, RC.TOPIC).replace(/\s+/g, '_');
  if (topic && topic.charAt(0) !== '#') topic = '#' + topic;
  return topic;
}

// عنوان يوتيوب: العنوان + هاشتاج الموضوع + #shorts (يوتيوب بيقبل 100 حرف بالكتير)
function ytTitle_(row) {
  var title = rtext_(row, RC.TITLE) || 'Dr Ahmed Nabil';
  var tail = ' ' + (reelTopicTag_(row) ? reelTopicTag_(row) + ' ' : '') + '#shorts';
  if (title.length + tail.length > 100) title = title.substring(0, 100 - tail.length - 1) + '…';
  return title + tail;
}

function ytDescription_(row) {
  return reelCaption_(row) + ' #shorts';
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
  if (Number(Utilities.formatDate(now, TZ, 'H')) !== num_('REEL_SEND_HOUR')) return;
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
  var fits = full.length <= 1000;
  var res;
  try {
    res = tgVideo_(chat, reelBlob_(row), fits ? full : head, fits ? keyboard : null);
  } catch (e) {
    rcell_(row, RC.NOTES).setValue(e.message);
    notify_('❌ ريل رقم ' + rtext_(row, RC.NUM) + ': ' + e.message);
    return;
  }
  if (!res || !res.ok) {
    notify_('❌ الريل ما اتبعتش على Telegram: ' + (res && res.description ? res.description : 'سبب غير معروف'));
    return;
  }
  if (!fits) res = tg_('sendMessage', { chat_id: chat, text: caption, reply_markup: keyboard });
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
  } else if (act === 'rre') {
    if (status !== RST.FAILED) { notify_('الريل ده مش محتاج إعادة (' + status + ').'); return; }
    notify_('🔁 بعيد المحاولة على المنصة اللي فشلت بس...');
    publishReel_(row);
  } else if (act === 'rdy') {
    if (status !== RST_DRAFT) { notify_('الريل ده مش مسودة (' + status + ').'); return; }
    rcell_(row, RC.STATUS).setValue(RST.READY);
    notify_('✅ الريل رقم ' + rtext_(row, RC.NUM) + ' بقى "جاهز"، وهيتبعتلك للموافقة يوم ' + rtext_(row, RC.DATE) + '.');
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
  var retry = /^\/retry(\d+)$/.exec(text);
  if (retry) {
    var rr = Number(retry[1]);
    if (rtext_(rr, RC.STATUS) !== RST.FAILED) notify_('الريل ده مش محتاج إعادة (' + rtext_(rr, RC.STATUS) + ').');
    else { notify_('🔁 بعيد المحاولة على المنصة اللي فشلت بس...'); publishReel_(rr); }
    return true;
  }
  if (text === '/reel') {
    if (!sendNextReel_(cairoDate_())) notify_('مفيش ريل جاهز بتاريخ النهارده أو قبله.');
    return true;
  }
  return false;
}

/* ---------- الموافقة من Claude ---------- */

// Claude بيغيّر حالة الريل في الشيت لـ "تمت الموافقة"، وهنا بننشره خلال دقيقة (بتتنده من pollTelegram في Code.gs جوه نفس القفل).
// ريل واحد بس في كل مرة عشان حد الـ 6 دقايق. الريل اللي له رابط فيسبوك اتنشر قبل كده فبيتخطى.
function publishApprovedReels_() {
  var s = rsheet_();
  if (!s) return;
  for (var r = 2; r <= s.getLastRow(); r++) {
    if (rtext_(r, RC.STATUS) === RST.APPROVED && !rtext_(r, RC.FB)) {
      notify_('🎬 وصلت موافقتك من Claude، بنشر ريل رقم ' + rtext_(r, RC.NUM) + '...');
      props_().setProperty('LAST_REEL_DATE', cairoDate_()); // عشان تيليجرام ما يبعتش ريل تاني النهارده
      publishReel_(r);
      return;
    }
  }
}

/* ---------- النشر على فيسبوك ريلز ---------- */

// بينشر على كل منصة لسه ما اتنشرش عليها (لو المنصة ليها رابط في الشيت بيتخطاها، عشان الإعادة ما تكررش النشر)
function publishReel_(row) {
  var failed = [];

  if (!rtext_(row, RC.FB)) {
    try {
      var fbId = uploadFbReel_(row, 'PUBLISHED');
      var fbLink = 'https://www.facebook.com/reel/' + fbId;
      rcell_(row, RC.FB).setValue(fbLink);
      notify_('✅ فيسبوك: الريل اترفع وبيتنشر (ممكن ياخد دقايق لحد ما يظهر).\n' + fbLink);
    } catch (e) {
      failed.push('فيسبوك: ' + e.message);
      notify_('❌ فيسبوك: الريل فشل.\n' + e.message);
    }
  }

  if (YT_ENABLED && !rtext_(row, RC.YT)) {
    try {
      var ytId = uploadYtShort_(row, 'public');
      var ytLink = 'https://youtube.com/shorts/' + ytId;
      rcell_(row, RC.YT).setValue(ytLink);
      notify_('✅ يوتيوب: الـ Short اترفع.\n' + ytLink);
    } catch (e) {
      failed.push('يوتيوب: ' + e.message);
      notify_('❌ يوتيوب: الـ Short فشل.\n' + e.message);
    }
  }

  if (on_('IG_REELS_ENABLED') && !rtext_(row, RC.IG)) {
    try {
      var igLink = igPublishReel_(row, 'REELS'); // Instagram.gs
      rcell_(row, RC.IG).setValue(igLink);
      if (igLink.indexOf('pending:') === 0) notify_('⏳ إنستجرام لسه بيعالج الريل، هيتنشر لوحده خلال دقايق ويوصلك إشعار.');
      else notify_('✅ إنستجرام: الريل اتنشر.\n' + igLink);
    } catch (e) {
      failed.push('إنستجرام: ' + e.message);
      notify_('❌ إنستجرام: الريل فشل.\n' + e.message);
    }
  }

  if (failed.length) {
    rcell_(row, RC.STATUS).setValue(RST.FAILED);
    rcell_(row, RC.NOTES).setValue(failed.join('\n'));
    tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'),
      text: 'لما تصلّح المشكلة دوس الزرار ده، وهيعيد المنصة اللي فشلت بس:',
      reply_markup: JSON.stringify({ inline_keyboard: [[{ text: '🔁 أعد المحاولة', callback_data: 'rre:' + row }]] }) });
  } else {
    var wasDone = rtext_(row, RC.STATUS) === RST.DONE;
    rcell_(row, RC.STATUS).setValue(RST.DONE);
    rcell_(row, RC.NOTES).setValue('');
    if (!wasDone) {
      // إضافات بعد النشر الناجح (كل واحدة مقفولة لحد ما تفعّلها من Settings)
      if (on_('IG_STORY_REELS')) { try { notify_(igPublishReel_(row, 'STORIES').indexOf('pending:') === 0 ? '⚠️ ستوري إنستجرام لسه بتتعالج ومش هتتنشر. جرّب ريل أقصر.' : '✅ إنستجرام: الستوري اتنشرت.'); } catch (e) { notify_('⚠️ ستوري إنستجرام: ' + e.message); } }
      if (on_('TIKTOK_HELPER')) { try { tiktokHelper_(row); } catch (e) { notify_('⚠️ تيك توك: ' + e.message); } }
    }
  }
}

/* ---------- النشر على يوتيوب Shorts ---------- */

// privacy = 'public' للنشر، أو 'private' للتجربة
// الرفع على خطوتين (resumable): بنبعت البيانات ← يوتيوب يرجّع رابط ← نرفع الفيديو عليه
function uploadYtShort_(row, privacy) {
  var token = ytToken_();
  checkYtChannel_(token);
  var blob = reelBlob_(row).setContentType('video/mp4');
  var resource = {
    snippet: { title: ytTitle_(row), description: ytDescription_(row), categoryId: YT_CATEGORY },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false }
  };
  var init = UrlFetchApp.fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'post', contentType: 'application/json; charset=UTF-8', payload: JSON.stringify(resource),
    headers: { Authorization: 'Bearer ' + token, 'X-Upload-Content-Type': 'video/mp4' }, muteHttpExceptions: true
  });
  if (init.getResponseCode() !== 200) throw new Error('يوتيوب (بداية الرفع): ' + init.getContentText());
  var h = init.getHeaders();
  var url = h['Location'] || h['location'];
  if (!url) throw new Error('يوتيوب ما رجّعش رابط الرفع');
  var up = UrlFetchApp.fetch(url, {
    method: 'put', contentType: 'video/mp4', payload: blob.getBytes(),
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  var v = JSON.parse(up.getContentText());
  if (!v || !v.id) throw new Error('يوتيوب (رفع الفيديو): ' + up.getContentText());
  if (privacy === 'public' && v.status && v.status.privacyStatus !== 'public') {
    notify_('⚠️ يوتيوب رفع الفيديو بس خلاه ' + v.status.privacyStatus + ' مش Public. افتحه من YouTube Studio وخليه Public بإيدك.');
  }
  return v.id;
}

// توكن مؤقت (ساعة) لحساب 998 من الـ Refresh token المتخزن في Script Properties
function ytToken_() {
  var p = props_();
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { client_id: p.getProperty('YT_CLIENT_ID'), client_secret: p.getProperty('YT_CLIENT_SECRET'),
               refresh_token: p.getProperty('YT_REFRESH_TOKEN'), grant_type: 'refresh_token' }
  });
  var j = JSON.parse(r.getContentText());
  if (!j.access_token) throw new Error('توكن يوتيوب: ' + (j.error_description || j.error || r.getResponseCode()));
  return j.access_token;
}

function ytGet_(path, token) {
  var r = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/' + path, {
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('يوتيوب: ' + r.getContentText());
  return JSON.parse(r.getContentText());
}

// بيتأكد إن التوكن تبع القناة الصح، مش قناة تانية
function checkYtChannel_(token) {
  var items = ytGet_('channels?part=snippet&mine=true', token || ytToken_()).items || [];
  if (!items.length) throw new Error('الحساب ده مالوش قناة يوتيوب.');
  var title = items[0].snippet.title;
  // بنقارن الحروف والأرقام بس، عشان المسافات والشرَط في اسم القناة ما تفرقش
  var norm = function (x) { return String(x).replace(/[^A-Za-z0-9]/g, '').toLowerCase(); };
  if (norm(title) !== norm(YT_CHANNEL_TITLE)) throw new Error('السكريبت متربط بقناة "' + title + '" مش "' + YT_CHANNEL_TITLE + '".');
  return title;
}

// تتشغل من المحرر بعد إضافة الـ Script Properties: بتطبع القناة اللي التوكن تبعها
function ytWhoAmI() {
  var items = ytGet_('channels?part=snippet&mine=true', ytToken_()).items || [];
  Logger.log(items.length ? ('القناة: ' + items[0].snippet.title + ' | ' + items[0].id) : 'التوكن ده مالوش قناة');
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

// بترفع أول ريل "جاهز" على يوتيوب كـ Private (محدش يشوفه) عشان نتأكد إن الربط شغال
function testYtPrivate() {
  var ui = SpreadsheetApp.getUi();
  var row = nextReadyReel_('9999-12-31');
  if (!row) { ui.alert('مفيش ريل حالته "جاهز" في تاب Reels.'); return; }
  try {
    var id = uploadYtShort_(row, 'private');
    props_().setProperty('YT_TEST_VIDEO', id);
    ui.alert('تجربة يوتيوب نجحت ✅\nالفيديو اترفع Private على قناة ' + YT_CHANNEL_TITLE + '.\nhttps://youtube.com/shorts/' + id);
  } catch (e) {
    ui.alert('تجربة يوتيوب فشلت ❌\n' + e.message);
  }
}

// بتمسح فيديو التجربة من يوتيوب
function deleteYtTestVideo() {
  var id = props_().getProperty('YT_TEST_VIDEO');
  if (!id) return 'مفيش فيديو تجربة متسجل';
  var r = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/videos?id=' + id, {
    method: 'delete', headers: { Authorization: 'Bearer ' + ytToken_() }, muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 204) throw new Error('يوتيوب (مسح): ' + r.getContentText());
  props_().deleteProperty('YT_TEST_VIDEO');
  return 'اتمسح: ' + id;
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
