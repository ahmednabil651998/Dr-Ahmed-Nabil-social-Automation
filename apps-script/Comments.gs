/**
 * الرد على الكومنتات: كل ساعة بنجيب الكومنتات الجديدة على اللي اتنشر في آخر أيام،
 * (بس الكومنتات اللي الصفحة/الحساب/القناة ما ردتش عليها)، الذكاء الاصطناعي يقترح رد، ويتبعتلك على تيليجرام: ✅ رد / ✏️ عدّل / 🙈 تجاهل.
 * مفيش أي رد بيتنشر من غير ما انت تدوس.
 * محتاج صلاحية pages_manage_engagement و pages_read_user_content في توكن الصفحة (شوف docs/rollout.md).
 *
 * COMMENTS_SCOPE = all (الافتراضي): كومنتات كل بوستات الصفحة في آخر COMMENTS_DAYS يوم، حتى اللي اتنشرت بإيدك.
 * COMMENTS_SCOPE = system: اللي النظام نشره بس (السلوك القديم).
 * IG_COMMENTS_ENABLED = true: كمان كومنتات إنستجرام (محتاج instagram_manage_comments). الرد بيتنشر كـ reply على الكومنت.
 */

var CMC = { ID: 1, POST: 2, NAME: 3, TEXT: 4, DATE: 5, REPLY: 6, STATUS: 7, TGMSG: 8, PLATFORM: 9 };
var CM_FB = 'فيسبوك', CM_IG = 'إنستجرام', CM_YT = 'يوتيوب';
var CMS = { NEW: 'جديد', SENT: 'اتبعت', DONE: 'اترد', SKIP: 'اتجاهل' };

function csheet_() { return SpreadsheetApp.getActive().getSheetByName('Comments'); }

function commentsJob_() {
  var c = csheet_();
  if (!c) return;
  var known = {};
  if (c.getLastRow() > 1) c.getRange(2, 1, c.getLastRow() - 1, 1).getValues().forEach(function (r) { known[String(r[0])] = 1; });

  if (!String(c.getRange(1, CMC.PLATFORM).getValue())) c.getRange(1, CMC.PLATFORM).setValue('المنصة').setFontWeight('bold');

  var days = num_('COMMENTS_DAYS'), fresh = [];
  fbCommentTargets_(days).forEach(function (id) {
    var list = safe_(function () { return graphGet_(id + '/comments?fields=id,from,message,created_time,comments.limit(25){from}&filter=toplevel&order=reverse_chronological&limit=25').data; }) || [];
    list.forEach(function (cm) {
      if (known[cm.id] || !cm.message) return;
      if (cm.from && String(cm.from.id) === PAGE_ID) return; // كومنتات الصفحة نفسها
      if (cm.comments && (cm.comments.data || []).some(function (x) { return x.from && String(x.from.id) === PAGE_ID; })) return; // الصفحة ردت عليه
      known[cm.id] = 1;
      fresh.push([cm.id, id, cm.from ? cm.from.name : '', cm.message, fbTime_(cm.created_time), '', CMS.NEW, '', CM_FB]);
    });
  });
  if (on_('IG_COMMENTS_ENABLED')) igNewComments_(days, known).forEach(function (r) { fresh.push(r); });
  if (on_('YT_COMMENTS_ENABLED')) ytNewComments_(days, known).forEach(function (r) { fresh.push(r); });
  if (fresh.length) c.getRange(c.getLastRow() + 1, 1, fresh.length, 9).setValues(fresh);

  // نبعت أقدم الكومنتات الجديدة الأول، بحد أقصى كل ساعة
  var limit = num_('COMMENTS_PER_RUN'), sent = 0;
  for (var k = 2; k <= c.getLastRow() && sent < limit; k++) {
    if (String(c.getRange(k, CMC.STATUS).getValue()) !== CMS.NEW) continue;
    sendCommentForApproval_(k);
    sent++;
  }
}

// البوستات والريلز اللي بنجيب كومنتاتها على فيسبوك
function fbCommentTargets_(days) {
  var targets = {}, s = sheet_();
  for (var r = 2; r <= s.getLastRow(); r++) {
    if (cellText_(r, C.FBID) && daysAgo_(cellText_(r, C.DATE)) <= days) targets[cellText_(r, C.FBID)] = 1;
  }
  var rs = rsheet_();
  if (rs) for (var q = 2; q <= rs.getLastRow(); q++) {
    var fb = rtext_(q, RC.FB);
    if (fb && daysAgo_(rtext_(q, RC.DATE)) <= days) targets[fb.split('/').pop()] = 1;
  }
  if (String(setting_('COMMENTS_SCOPE') || 'all').toLowerCase() !== 'system') {
    var since = Math.floor(new Date().getTime() / 1000) - days * 86400;
    var posts = safe_(function () { return graphGet_(PAGE_ID + '/published_posts?fields=id&since=' + since + '&limit=50').data; }) || [];
    posts.forEach(function (p) { targets[p.id] = 1; });
  }
  return Object.keys(targets);
}

// كومنتات إنستجرام الجديدة على بوستات وريلز آخر days يوم
function igNewComments_(days, known) {
  var out = [], igId = safe_(function () { return igUserId_(); });
  if (!igId) return out;
  var me = safe_(function () { return igAccount_().username; }) || '';
  var media = safe_(function () { return graphGet_(igId + '/media?fields=id,timestamp&limit=25').data; }) || [];
  media.forEach(function (m) {
    if (daysAgo_(String(m.timestamp || '').substring(0, 10)) > days) return;
    var list = safe_(function () { return graphGet_(m.id + '/comments?fields=id,text,username,timestamp,replies{username}&limit=25').data; }) || [];
    list.forEach(function (cm) {
      if (known[cm.id] || !cm.text) return;
      if (me && cm.username === me) return; // كومنتات الحساب نفسه
      if (me && cm.replies && (cm.replies.data || []).some(function (x) { return x.username === me; })) return; // الحساب رد عليه
      known[cm.id] = 1;
      out.push([cm.id, m.id, cm.username || '', cm.text, fbTime_(cm.timestamp), '', CMS.NEW, '', CM_IG]);
    });
  });
  return out;
}

function sendCommentForApproval_(row) {
  var c = csheet_(), v = c.getRange(row, 1, 1, 9).getValues()[0];
  var reply = String(v[CMC.REPLY - 1] || '');
  if (!reply && on_('AI_ENABLED')) {
    reply = safe_(function () {
      return ai_([{ text: replyPrompt_(String(v[CMC.TEXT - 1]), String(v[CMC.PLATFORM - 1] || CM_FB)) }], false);
    });
    if (reply) c.getRange(row, CMC.REPLY).setValue(reply);
  }
  var kb = [[{ text: '✏️ اكتب رد', callback_data: 'cme:' + row }, { text: '🙈 تجاهل', callback_data: 'cmx:' + row }]];
  if (reply) kb.unshift([{ text: '✅ ابعت الرد', callback_data: 'cmo:' + row }]);
  var res = tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'),
    text: '💬 ' + (v[CMC.PLATFORM - 1] || CM_FB) + ' — كومنت من ' + (v[CMC.NAME - 1] || 'متابع') + ':\n"' + v[CMC.TEXT - 1] + '"\n\n' + (reply ? 'الرد المقترح:\n' + reply : '(مفيش رد مقترح)'),
    reply_markup: JSON.stringify({ inline_keyboard: kb }) });
  c.getRange(row, CMC.STATUS).setValue(CMS.SENT);
  if (res && res.result) c.getRange(row, CMC.TGMSG).setValue(res.result.message_id);
}

function handleCommentCallback_(data) {
  var parts = data.split(':'), act = parts[0], row = Number(parts[1]), c = csheet_();
  var status = String(c.getRange(row, CMC.STATUS).getValue());
  if (status === CMS.DONE || status === CMS.SKIP) { notify_('الكومنت ده اتعالج قبل كده (' + status + ').'); return; }
  if (act === 'cmo') postCommentReply_(row, String(c.getRange(row, CMC.REPLY).getValue()));
  else if (act === 'cme') {
    props_().setProperty('CM_EDIT_ROW', String(row));
    notify_('✏️ ابعتلي الرد اللي عاوزه في رسالة واحدة.');
  } else if (act === 'cmx') {
    c.getRange(row, CMC.STATUS).setValue(CMS.SKIP);
    notify_('🙈 اتجاهل.');
  }
}

// بترجع true لو الرسالة كانت رد على كومنت
function handleCommentMessage_(text) {
  var row = Number(props_().getProperty('CM_EDIT_ROW') || 0);
  if (!row || !text || text.charAt(0) === '/') return false;
  props_().deleteProperty('CM_EDIT_ROW');
  csheet_().getRange(row, CMC.REPLY).setValue(text.trim());
  postCommentReply_(row, text.trim());
  return true;
}

function postCommentReply_(row, msg) {
  var c = csheet_();
  if (!msg) { notify_('مفيش رد. دوس "✏️ اكتب رد".'); return; }
  var plat = String(c.getRange(row, CMC.PLATFORM).getValue()) || CM_FB, ig = plat === CM_IG, yt = plat === CM_YT;
  try {
    if (yt) ytReply_(String(c.getRange(row, CMC.ID).getValue()), msg);
    else fbJson_(UrlFetchApp.fetch(GRAPH + c.getRange(row, CMC.ID).getValue() + (ig ? '/replies' : '/comments'), {
      method: 'post', payload: { message: msg, access_token: props_().getProperty('FB_PAGE_TOKEN') }, muteHttpExceptions: true
    }));
    c.getRange(row, CMC.STATUS).setValue(CMS.DONE);
    notify_('✅ الرد اتنشر على ' + plat + '.');
  } catch (e) {
    var hint = yt ? 'توكن يوتيوب محتاج صلاحية youtube.force-ssl: موافقة جديدة من OAuth Playground بحساب 998 وحدّث YT_REFRESH_TOKEN (شوف docs/youtube-status.md).'
                  : 'التوكن محتاج صلاحية ' + (ig ? 'instagram_manage_comments' : 'pages_manage_engagement') + ' (شوف docs/rollout.md).';
    notify_('❌ الرد ما اتنشرش: ' + e.message + (/permission|insufficient|forbidden|scope/i.test(e.message) ? '\n' + hint : ''));
  }
}

/* ---------- يوتيوب (بتوكن حساب 998 بتاع Reels.gs) ---------- */

// كومنتات يوتيوب الجديدة على كل فيديوهات القناة في آخر days يوم
function ytNewComments_(days, known) {
  var out = [], ch = ytChannelId_();
  if (!ch) return out;
  var r = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&order=time&maxResults=50&textFormat=plainText&allThreadsRelatedToChannelId=' + ch,
    { headers: { Authorization: 'Bearer ' + ytToken_() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) { notify_('⚠️ كومنتات يوتيوب: ' + r.getContentText().substring(0, 300)); return out; }
  (JSON.parse(r.getContentText()).items || []).forEach(function (t) {
    var top = t.snippet && t.snippet.topLevelComment, sn = top && top.snippet;
    if (!sn || known[top.id] || !sn.textOriginal) return;
    if (sn.authorChannelId && sn.authorChannelId.value === ch) return; // كومنتات القناة نفسها
    if (t.replies && (t.replies.comments || []).some(function (x) { return x.snippet && x.snippet.authorChannelId && x.snippet.authorChannelId.value === ch; })) return; // القناة ردت عليه
    if (daysAgo_(String(sn.publishedAt || '').substring(0, 10)) > days) return;
    known[top.id] = 1;
    out.push([top.id, sn.videoId || t.snippet.videoId || '', sn.authorDisplayName || '', sn.textOriginal, fbTime_(sn.publishedAt), '', CMS.NEW, '', CM_YT]);
  });
  return out;
}

function ytChannelId_() {
  var p = props_(), id = p.getProperty('YT_CHANNEL_ID');
  if (id) return id;
  var r = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
    { headers: { Authorization: 'Bearer ' + ytToken_() }, muteHttpExceptions: true });
  var it = (JSON.parse(r.getContentText()).items || [])[0];
  if (!it) { notify_('⚠️ كومنتات يوتيوب: مش لاقي قناة لتوكن يوتيوب.'); return ''; }
  p.setProperty('YT_CHANNEL_ID', it.id);
  return it.id;
}

// الرد على كومنت يوتيوب (parentId = ID الكومنت الأساسي)
function ytReply_(parentId, msg) {
  var r = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ytToken_() },
    payload: JSON.stringify({ snippet: { parentId: parentId, textOriginal: msg } })
  });
  if (r.getResponseCode() !== 200) throw new Error('يوتيوب (' + r.getResponseCode() + '): ' + r.getContentText().substring(0, 300));
}

// تجربة من المحرر: بتجيب كومنتات يوتيوب آخر 14 يوم وتقولك عددها من غير ما تكتب حاجة
function ytCommentsTest() {
  var n = ytNewComments_(14, {});
  notify_('🎬 تجربة كومنتات يوتيوب: لقيت ' + n.length + ' كومنت في آخر 14 يوم' + (n[0] ? '\nأولهم: "' + String(n[0][3]).substring(0, 80) + '"' : '') + '.');
}

/* ---------- أسلوب الرد: نتعلم من ردود د. أحمد الحقيقية على القناة والصفحة ---------- */

function replyPrompt_(comment, platform) {
  var ex = safe_(function () { return replyExamples_(); }) || [];
  if (!ex.length) {
    return BRAND_VOICE + '\n\nده كومنت من طالب على ' + platform + ':\n"' + comment + '"\n' +
      'اكتب رد قصير (سطر أو اتنين) بالعامية المصرية باسم د. أحمد: دافي ومشجّع. لو سؤال كيمياء جاوب باختصار وبدقة، ولو مش متأكد قوله يسأل في الحصة. رجّع الرد بس من غير أي شرح.';
  }
  var shots = ex.map(function (e, i) { return (i + 1) + ') كومنت: "' + e.q + '"\n   رد د. أحمد: "' + e.a + '"'; }).join('\n');
  return 'إنت بتكتب ردود باسم د. أحمد نبيل (مدرس كيمياء) على كومنتات طلبته. دي ردوده الحقيقية اللي كتبها بنفسه قبل كده:\n\n' + shots +
    '\n\nقلّد أسلوبه في الأمثلة دي بالظبط: نفس الطول تقريبًا، نفس الكلمات والتعبيرات اللي بيكررها، نفس الإيموجي (ولو مش بيستخدم إيموجي ما تحطش)، ونفس طريقة كلامه مع الطلبة. ما تزوّدش رسمية ولا كلام زيادة.\n' +
    'لو الكومنت سؤال كيمياء جاوب بدقة وباختصار زي ما هو بيعمل، ولو مش متأكد من الإجابة قول للطالب يسأل في الحصة.\n\n' +
    'الكومنت الجديد (على ' + platform + '):\n"' + comment + '"\n\nرجّع الرد بس، من غير علامات تنصيص ولا أي شرح.';
}

// بيجمع لحد 20 مثال (كومنت ← رد القناة/الصفحة) ويحفظهم يوم. لو مفيش أمثلة، الرد بيرجع للأسلوب العام.
function replyExamples_() {
  var p = props_(), raw = p.getProperty('REPLY_EXAMPLES'), at = Number(p.getProperty('REPLY_EXAMPLES_AT') || 0);
  if (raw && new Date().getTime() - at < 86400000) return JSON.parse(raw);
  var ex = [], cut = function (t) { return String(t || '').replace(/\s+/g, ' ').trim().substring(0, 280); };
  if (on_('YT_COMMENTS_ENABLED')) safe_(function () {
    var ch = ytChannelId_();
    var r = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&order=time&maxResults=100&textFormat=plainText&allThreadsRelatedToChannelId=' + ch,
      { headers: { Authorization: 'Bearer ' + ytToken_() }, muteHttpExceptions: true });
    (JSON.parse(r.getContentText()).items || []).forEach(function (t) {
      var q = t.snippet.topLevelComment.snippet.textOriginal;
      ((t.replies && t.replies.comments) || []).forEach(function (x) {
        if (x.snippet.authorChannelId && x.snippet.authorChannelId.value === ch && x.snippet.textOriginal) ex.push({ q: cut(q), a: cut(x.snippet.textOriginal) });
      });
    });
  });
  safe_(function () {
    var posts = graphGet_(PAGE_ID + '/published_posts?fields=comments.limit(25){message,comments.limit(10){from,message}}&limit=25').data || [];
    posts.forEach(function (po) {
      ((po.comments && po.comments.data) || []).forEach(function (cm) {
        ((cm.comments && cm.comments.data) || []).forEach(function (x) {
          if (x.from && String(x.from.id) === PAGE_ID && x.message && cm.message) ex.push({ q: cut(cm.message), a: cut(x.message) });
        });
      });
    });
  });
  if (!ex.length) return raw ? JSON.parse(raw) : [];
  ex = ex.slice(0, 20);
  var json = JSON.stringify(ex);
  while (json.length > 8500 && ex.length > 3) { ex.pop(); json = JSON.stringify(ex); }
  p.setProperty('REPLY_EXAMPLES', json);
  p.setProperty('REPLY_EXAMPLES_AT', String(new Date().getTime()));
  return ex;
}

// تجربة من المحرر: بتوريك على تيليجرام كام مثال لقى من ردودك، وأول مثالين
function replyStyleTest() {
  props_().deleteProperty('REPLY_EXAMPLES_AT');
  var ex = replyExamples_();
  notify_('✍️ أسلوب الرد: لقيت ' + ex.length + ' رد من ردودك القديمة.' + ex.slice(0, 2).map(function (e) { return '\n\n• "' + e.q + '"\n← "' + e.a + '"'; }).join(''));
}
