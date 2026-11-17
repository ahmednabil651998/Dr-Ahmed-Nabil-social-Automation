/**
 * Analytics.gs — المرحلة A1: اختبار قراءة الأرقام بس.
 *
 * بيعمل إيه: بيقرا أرقام آخر بوست اتنشر من فيسبوك، ويبعت النتيجة على تيليجرام:
 * كل مقياس نجح ✅ أو فشل ❌ وسبب الفشل.
 *
 * مش بيعمل إيه (مقصود):
 * - مش بيكتب أي حاجة في الشيت ولا في Script Properties.
 * - مش بيعمل ولا بيمسح أي Trigger.
 * - مش بيغيّر Code.gs ولا Reels.gs. بيستخدم منهم بس: GRAPH و PAGE_ID و SHEET_NAME و C و ST و tg_ و props_ (قراءة بس).
 *
 * التشغيل: من محرر Apps Script اختار الدالة analyticsTestA1 ودوس Run.
 * كل الأسماء في الملف ده بتبدأ بـ an عشان ما تتعارضش مع أي اسم في الملفات التانية.
 * مفيش أي كود بيتنفذ برا الدوال، عشان الملف ده ما يأثرش على البوست اليومي ولا الريلز.
 */

// لو عاوز تختبر بوست معيّن بدل آخر بوست اتنشر، حط الـ ID بتاعه هنا (زي 103991896132654_1481441435048015)
var AN_TEST_POST_ID = '';

// المقاييس اللي هنجرّبها، كل واحد لوحده عشان فشل واحد ما يخبّيش الباقي
var AN_TEST_METRICS = [
  ['post_total_media_view_unique', 'الوصول (عدد الناس اللي شافوه) — المقياس الجديد'],
  ['post_media_view', 'المشاهدات (عدد مرات الظهور)'],
  ['post_reactions_by_type_total', 'الريأكشنز بالنوع'],
  ['post_impressions_unique', 'الوصول — المقياس القديم', true] // true = متوقع يفشل (Meta وقفته). بنجربه بس عشان نتأكد
];

function analyticsTestA1() {
  var token = props_().getProperty('FB_PAGE_TOKEN');
  var res = [];

  if (!token) {
    anSend_('🧪 اختبار الأرقام (A1)\n❌ مفيش توكن فيسبوك في Script Properties (FB_PAGE_TOKEN). مفيش حاجة اتجربت.');
    return;
  }

  // 1) صلاحيات التوكن
  var scopes = null;
  var dbg = anGet_('debug_token?input_token=' + encodeURIComponent(token), token);
  if (dbg.ok && dbg.json.data) {
    scopes = dbg.json.data.scopes || [];
    var valid = dbg.json.data.is_valid === true;
    res.push(anStep_('صلاحية التوكن (is_valid)', valid, valid ? 'صالح' : '', valid ? '' : 'فيسبوك بيقول التوكن مش صالح'));
    ['pages_read_engagement', 'read_insights'].forEach(function (s) {
      var has = scopes.indexOf(s) !== -1;
      res.push(anStep_('صلاحية ' + s, has, has ? 'موجودة' : '', has ? '' : 'الصلاحية دي مش في التوكن'));
    });
  } else {
    res.push(anStep_('قراءة صلاحيات التوكن (debug_token)', false, '', dbg.error || 'مفيش بيانات'));
  }

  // 2) عدد متابعين الصفحة
  var page = anGet_(PAGE_ID + '?fields=name,followers_count', token);
  var followers = page.ok ? page.json.followers_count : undefined;
  res.push(anStep_('followers_count (متابعين الصفحة)', anIsNum_(followers), followers, page.ok ? 'الحقل مرجعش رقم' : page.error));

  // 3) البوست اللي هنختبره
  var postId = AN_TEST_POST_ID || anLastPublishedPostId_();
  if (!postId) {
    res.push(anStep_('إيجاد بوست منشور', false, '', 'مفيش صف في تاب Posts حالته "' + ST.DONE + '" ومعاه ID فيسبوك'));
    anSend_(anReport_(res, '', ''));
    return;
  }

  // 4) أرقام البوست الأساسية
  var p = anGet_(postId + '?fields=created_time,permalink_url,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares', token);
  var link = '', created = '';
  if (!p.ok) {
    res.push(anStep_('قراءة البوست نفسه', false, '', p.error));
  } else {
    link = p.json.permalink_url || ('https://www.facebook.com/' + postId);
    created = p.json.created_time ? Utilities.formatDate(new Date(p.json.created_time), TZ, 'yyyy-MM-dd HH:mm') : '';
    var reactions = p.json.reactions && p.json.reactions.summary ? p.json.reactions.summary.total_count : undefined;
    var comments = p.json.comments && p.json.comments.summary ? p.json.comments.summary.total_count : undefined;
    res.push(anStep_('reactions (الريأكشنز)', anIsNum_(reactions), reactions, 'الحقل مرجعش رقم'));
    res.push(anStep_('comments (الكومنتات)', anIsNum_(comments), comments, 'الحقل مرجعش رقم'));
    // فيسبوك بيشيل حقل shares خالص لما الشير صفر، فده مش فشل بس بنوضّحه
    if (p.json.shares && anIsNum_(p.json.shares.count)) res.push(anStep_('shares (الشير)', true, p.json.shares.count));
    else res.push(anStep_('shares (الشير)', true, '0 (فيسبوك مبيرجّعش الحقل لما الشير صفر)'));
  }

  // 5) المقاييس من Insights، كل واحد لوحده
  var vals = {};
  AN_TEST_METRICS.forEach(function (m) {
    var r = anGet_(postId + '/insights?metric=' + m[0] + '&period=lifetime', token);
    if (!r.ok) {
      var st = anStep_(m[0] + ' — ' + m[1], false, '', r.error);
      st.expected = m[2] === true; // فشل متوقع: بيتعرض لوحده ومبيتحسبش في النتيجة
      res.push(st);
      return;
    }
    var d = r.json.data && r.json.data[0] && r.json.data[0].values && r.json.data[0].values[0];
    if (!d || d.value === undefined || d.value === null) {
      res.push(anStep_(m[0] + ' — ' + m[1], false, '', 'فيسبوك ما رجّعش خطأ بس ما رجّعش أي قيمة كمان'));
      return;
    }
    var v = d.value;
    var ok = anIsNum_(v) || (typeof v === 'object');
    vals[m[0]] = v;
    res.push(anStep_(m[0] + ' — ' + m[1], ok, typeof v === 'object' ? JSON.stringify(v) : v, 'القيمة مش رقم: ' + JSON.stringify(v)));
  });

  // 6) فحص منطقي: الوصول لازم يبقى أقل من أو يساوي المشاهدات
  var reach = vals.post_total_media_view_unique, views = vals.post_media_view;
  if (anIsNum_(reach) && anIsNum_(views)) {
    var sane = reach <= views;
    res.push(anStep_('فحص منطقي: الوصول ≤ المشاهدات', sane, reach + ' ≤ ' + views, 'الوصول (' + reach + ') أكبر من المشاهدات (' + views + ')، الأرقام محتاجة مراجعة'));
  }

  anSend_(anReport_(res, link || ('https://www.facebook.com/' + postId), created));
}

/* ---------- أدوات الملف ده بس ---------- */

// طلب GET لفيسبوك. بيرجّع {ok, json} أو {ok:false, error} ومبيرميش أخطاء، وبيشيل التوكن من أي رسالة خطأ.
function anGet_(path, token) {
  var sep = path.indexOf('?') === -1 ? '?' : '&';
  var resp, j;
  try {
    resp = UrlFetchApp.fetch(GRAPH + path + sep + 'access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  } catch (e) {
    return { ok: false, error: anClean_('الاتصال فشل: ' + e.message, token) };
  }
  try { j = JSON.parse(resp.getContentText() || '{}'); } catch (e2) {
    return { ok: false, error: 'رد مش مفهوم من فيسبوك (HTTP ' + resp.getResponseCode() + ')' };
  }
  if (j.error) {
    var hint = '';
    if (j.error.code === 190) hint = ' ← التوكن انتهى أو اتلغى';
    else if (j.error.code === 10 || j.error.code === 200) hint = ' ← التوكن ناقصه صلاحية';
    else if (j.error.code === 100) hint = ' ← المقياس أو الحقل مش متاح';
    return { ok: false, error: anClean_('كود ' + j.error.code + ': ' + j.error.message + hint, token) };
  }
  if (resp.getResponseCode() !== 200) return { ok: false, error: 'HTTP ' + resp.getResponseCode() };
  return { ok: true, json: j };
}

function anClean_(text, token) { return token ? String(text).split(token).join('[التوكن]') : String(text); }

function anIsNum_(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }

function anStep_(name, ok, value, error) {
  return { name: name, ok: !!ok, value: (value === undefined || value === null) ? '' : value, error: ok ? '' : (error || 'فشل من غير سبب واضح') };
}

// آخر صف في تاب Posts حالته "اتنشر" ومعاه ID فيسبوك (قراءة بس)
function anLastPublishedPostId_() {
  var s = sheet_();
  if (!s || s.getLastRow() < 2) return '';
  var rows = s.getRange(2, 1, s.getLastRow() - 1, C.FBID).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    var st = String(rows[i][C.STATUS - 1] || '').replace(/^'/, '');
    var id = String(rows[i][C.FBID - 1] || '').replace(/^'/, '').trim();
    if (st === ST.DONE && id) return id;
  }
  return '';
}

function anReport_(res, link, created) {
  var counted = res.filter(function (r) { return !r.expected; });
  var good = counted.filter(function (r) { return r.ok; }).length;
  var lines = ['🧪 اختبار الأرقام (A1) — قراءة بس، مفيش أي كتابة في الشيت'];
  if (link) lines.push('البوست: ' + link + (created ? '\nاتنشر: ' + created : ''));
  lines.push('');
  res.forEach(function (r) {
    var mark = r.ok ? '✅ ' : (r.expected ? '⚪ (فشل متوقع) ' : '❌ ');
    lines.push(mark + r.name + (r.ok ? ': ' + r.value : '\n    السبب: ' + r.error));
  });
  lines.push('');
  lines.push('النتيجة: نجح ' + good + ' من ' + counted.length);
  return lines.join('\n');
}

// بيبعت على تيليجرام على أجزاء (حد الرسالة 4096 حرف)، ولو الإرسال فشل بيرمي خطأ يظهر في المحرر
function anSend_(text) {
  Logger.log(text);
  var parts = [], t = String(text);
  while (t.length > 3800) {
    var cut = t.lastIndexOf('\n', 3800);
    if (cut < 1000) cut = 3800;
    parts.push(t.substring(0, cut));
    t = t.substring(cut);
  }
  parts.push(t);
  parts.forEach(function (part) {
    var r = tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'), text: part });
    if (!r || r.ok !== true) throw new Error('الإرسال على تيليجرام فشل: ' + JSON.stringify(r));
  });
}
