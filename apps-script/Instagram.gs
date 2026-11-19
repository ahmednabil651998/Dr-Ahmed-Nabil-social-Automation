/**
 * النشر على إنستجرام بنفس أبّ Meta وتوكن الصفحة.
 * محتاج: حساب إنستجرام Business أو Creator متربط بصفحة فيسبوك، والتوكن فيه صلاحيات
 * instagram_basic و instagram_content_publish (شوف docs/rollout.md).
 *
 * الصور: إنستجرام بياخد رابط صورة عام بس (مش ملف). فبنرفع الصورة على فيسبوك "غير منشورة"
 * (محدش بيشوفها)، وناخد رابطها، وبعد النشر على إنستجرام نمسحها.
 * الريلز: بنرفع الفيديو نفسه (resumable)، ولو إنستجرام اتأخر في المعالجة بنكمّل في الدقيقة اللي بعدها.
 */

function igToken_() { return props_().getProperty('FB_PAGE_TOKEN'); }

function igUserId_() {
  var p = props_(), id = p.getProperty('IG_USER_ID');
  if (id) return id;
  var j = fbJson_(UrlFetchApp.fetch(GRAPH + PAGE_ID + '?fields=instagram_business_account&access_token=' + encodeURIComponent(igToken_()), { muteHttpExceptions: true }));
  if (!j.instagram_business_account) throw new Error('الصفحة مش متربطة بحساب إنستجرام Business/Creator، أو التوكن مفيهوش صلاحية instagram_basic.');
  id = j.instagram_business_account.id;
  p.setProperty('IG_USER_ID', id);
  return id;
}

function igAccount_() {
  return fbJson_(UrlFetchApp.fetch(GRAPH + igUserId_() + '?fields=username,followers_count&access_token=' + encodeURIComponent(igToken_()), { muteHttpExceptions: true }));
}

// من القايمة: بيلاقي حساب إنستجرام ويتأكد إن الربط شغال (من غير ما ينشر حاجة)
function connectInstagram() {
  var ui = SpreadsheetApp.getUi();
  props_().deleteProperty('IG_USER_ID');
  try {
    var a = igAccount_();
    ui.alert('إنستجرام متربط ✅\n@' + a.username + ' (' + (a.followers_count || 0) + ' متابع)\nفعّل IG_ENABLED و IG_REELS_ENABLED من تاب Settings لما تكون جاهز.');
  } catch (e) {
    ui.alert('إنستجرام مش متربط ❌\n' + e.message + '\n\nالخطوات في docs/rollout.md (جزء إنستجرام).');
  }
}

function igPost_(path, payload) {
  payload.access_token = igToken_();
  return fbJson_(UrlFetchApp.fetch(GRAPH + path, { method: 'post', payload: payload, muteHttpExceptions: true }));
}

function igPermalink_(mediaId) {
  try {
    var j = fbJson_(UrlFetchApp.fetch(GRAPH + mediaId + '?fields=permalink&access_token=' + encodeURIComponent(igToken_()), { muteHttpExceptions: true }));
    return j.permalink || ('ig:' + mediaId);
  } catch (e) { return 'ig:' + mediaId; }
}

/* ---------- بوست صورة ---------- */

function igPublishPhoto_(row) {
  var token = igToken_();
  var blob = stripImageMeta_(DriveApp.getFileById(cellText_(row, C.IMG)).getBlob());
  // 1) صورة غير منشورة على فيسبوك عشان ناخد رابط عام
  var ph = fbJson_(UrlFetchApp.fetch(GRAPH + PAGE_ID + '/photos', {
    method: 'post', payload: { source: blob, published: 'false', access_token: token }, muteHttpExceptions: true
  }));
  try {
    var info = fbJson_(UrlFetchApp.fetch(GRAPH + ph.id + '?fields=images&access_token=' + encodeURIComponent(token), { muteHttpExceptions: true }));
    var imgs = info.images || [];
    if (!imgs.length) throw new Error('فيسبوك ما رجّعش رابط للصورة');
    // 2) نعمل البوست على إنستجرام وننشره
    var cont = igPost_(igUserId_() + '/media', { image_url: imgs[0].source, caption: igCaption_(ensureHashtags_(cellText_(row, C.CAPTION))) });
    igWaitReady_(cont.id, 60);
    var pub = igPost_(igUserId_() + '/media_publish', { creation_id: cont.id });
    return igPermalink_(pub.id);
  } finally {
    // 3) نمسح الصورة المؤقتة من فيسبوك
    try { UrlFetchApp.fetch(GRAPH + ph.id + '?access_token=' + encodeURIComponent(token), { method: 'delete', muteHttpExceptions: true }); } catch (e) {}
  }
}

// إنستجرام بيقبل 2200 حرف و 30 هاشتاج بالكتير
function igCaption_(text) {
  var t = String(text || '');
  return t.length > 2200 ? t.substring(0, 2199) + '…' : t;
}

// بيستنى لحد ما إنستجرام يخلّص معالجة الملف. بيرجّع true لو خلص، false لو لسه (نكمّل بعدين).
function igWaitReady_(containerId, maxSeconds) {
  var waited = 0;
  while (waited <= maxSeconds) {
    var j = fbJson_(UrlFetchApp.fetch(GRAPH + containerId + '?fields=status_code,status&access_token=' + encodeURIComponent(igToken_()), { muteHttpExceptions: true }));
    if (j.status_code === 'FINISHED') return true;
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') throw new Error('إنستجرام رفض الملف: ' + (j.status || j.status_code));
    Utilities.sleep(10000);
    waited += 10;
  }
  return false;
}

/* ---------- ريل (أو ستوري) ---------- */

// بيرجّع رابط الريل، أو 'pending:<id>' لو إنستجرام لسه بيعالج (igFinishPending_ بتكمّل)
function igPublishReel_(row, mediaType) {
  var bytes = reelBlob_(row).getBytes();
  var payload = { media_type: mediaType || 'REELS', upload_type: 'resumable' };
  if (payload.media_type === 'REELS') { payload.caption = igCaption_(reelCaption_(row)); payload.share_to_feed = 'true'; }
  var cont = igPost_(igUserId_() + '/media', payload);
  if (!cont.uri) throw new Error('إنستجرام ما رجّعش رابط الرفع');
  var up = UrlFetchApp.fetch(cont.uri, {
    method: 'post', contentType: 'application/octet-stream', payload: bytes,
    headers: { Authorization: 'OAuth ' + igToken_(), offset: '0', file_size: String(bytes.length) }, muteHttpExceptions: true
  });
  var uj = JSON.parse(up.getContentText() || '{}');
  if (up.getResponseCode() !== 200 || uj.success === false) throw new Error('رفع الفيديو على إنستجرام: ' + up.getContentText());
  if (!igWaitReady_(cont.id, 40)) return 'pending:' + cont.id; // قصير عشان حد الـ 6 دقايق
  var pub = igPost_(igUserId_() + '/media_publish', { creation_id: cont.id });
  return igPermalink_(pub.id);
}

// بتتنده كل دقيقة من pollTelegram: تكمّل نشر الريلز اللي إنستجرام كان لسه بيعالجها
function igFinishPending_() {
  var s = rsheet_();
  if (!s || !on_('IG_REELS_ENABLED')) return;
  for (var r = 2; r <= s.getLastRow(); r++) {
    var v = rtext_(r, RC.IG);
    if (v.indexOf('pending:') !== 0) continue;
    var id = v.substring(8);
    try {
      if (!igWaitReady_(id, 0)) continue;
      var pub = igPost_(igUserId_() + '/media_publish', { creation_id: id });
      var link = igPermalink_(pub.id);
      rcell_(r, RC.IG).setValue(link);
      notify_('✅ إنستجرام: الريل رقم ' + rtext_(r, RC.NUM) + ' اتنشر.\n' + link);
      if (rtext_(r, RC.STATUS) === RST.FAILED) publishReel_(r); // نشوف لو فيه منصة تانية فاضلة
    } catch (e) {
      rcell_(r, RC.IG).setValue('');
      rcell_(r, RC.STATUS).setValue(RST.FAILED);
      rcell_(r, RC.NOTES).setValue('إنستجرام: ' + e.message);
      notify_('❌ إنستجرام: الريل رقم ' + rtext_(r, RC.NUM) + ' فشل.\n' + e.message + '\nدوس "🔁 أعد المحاولة" من آخر رسالة للريل ده، أو ابعت /retry' + r);
    }
  }
}

/* ---------- تيك توك (نص-أوتوماتيك لحد ما مراجعة تيك توك تتقبل) ---------- */

function tiktokHelper_(row) {
  var caption = reelCaption_(row).replace(/#Dr_Ahmed_Nabil/, '#Dr_Ahmed_Nabil #fyp');
  var res = tgVideo_(props_().getProperty('CHAT_ID'), reelBlob_(row), '📱 تيك توك: احفظ الفيديو وانشره من التطبيق. الكابشن في الرسالة الجاية جاهز للنسخ.', null);
  if (res && res.ok) notify_(caption);
}
