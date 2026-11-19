/**
 * الأرقام: كل يوم بنسحب أرقام اللي اتنشر (فيسبوك، يوتيوب، إنستجرام) لتاب Analytics.
 * ومنها: التقرير الأسبوعي (أحسن 3 وأضعف 3 + أحسن يوم وساعة)، وإعادة نشر البوستات الناجحة.
 * أي مقياس فيسبوك أو إنستجرام يرفضه (لأنهم بيغيّروا أسماء المقاييس) بيتساب فاضي ومش بيوقف الباقي.
 */

var AC = { PLATFORM: 1, KIND: 2, NUM: 3, ID: 4, LINK: 5, DATE: 6, UPDATED: 7, LIKES: 8, COMMENTS: 9, SHARES: 10, VIEWS: 11, ENG: 12 };

function asheet_() { return SpreadsheetApp.getActive().getSheetByName('Analytics'); }

var ANALYTICS_LAST_ = null; // نتيجة آخر تشغيلة (للتنبيه في analyticsNow)

function analyticsNow() {
  var n = collectAnalytics_();
  var x = ANALYTICS_LAST_;
  var bad = x ? x.errors.length + (x.dead.graph ? 1 : 0) + (x.dead.yt ? 1 : 0) : 0;
  SpreadsheetApp.getUi().alert((bad ? '⚠️ ' : '✅ ') + 'الأرقام اتحدّثت (' + n + ' عنصر اتحدّث بنجاح).' +
    (bad ? '\nفيه مشاكل، والملخص اتبعت على تيليجرام.' : '') + ' شوف تاب Analytics.');
}

function graphGet_(path) {
  var sep = path.indexOf('?') === -1 ? '?' : '&';
  return fbJson_(UrlFetchApp.fetch(GRAPH + path + sep + 'access_token=' + encodeURIComponent(props_().getProperty('FB_PAGE_TOKEN')), { muteHttpExceptions: true }));
}

// safe_(fn): زي الأول بالظبط (بترجع '' لو حصل خطأ) — بتستخدمها Comments.gs كده. الفرق الوحيد إن الخطأ بيتسجل في Logger.
// safe_(fn, ctx, opt): للأرقام. الخطأ بيتجمع في ctx عشان يتبعت ملخص واحد في الآخر، و opt = { scope: 'graph' | 'yt', label, optional }
//   - لو التوكن بايظ أو مفيش صلاحية عامة أو فيسبوك بيقول "كفاية طلبات": بنقفل الـ scope ده كله ومانبعتش طلبات تانية.
//   - مقياس اختياري (زي المشاهدات) لو فشل: الخانة بتتساب فاضية، ولو اتكرر فشله بنبطّل نطلبه في التشغيلة دي.
function safe_(fn, ctx, opt) {
  if (!ctx) {
    try { return fn(); } catch (e) { Logger.log('safe_: ' + (e && e.message ? e.message : e)); return ''; }
  }
  opt = opt || {};
  var scope = opt.scope || 'graph', label = opt.label || scope;
  if (ctx.dead[scope]) return '';
  if (opt.optional && ctx.skip[label]) return '';
  try {
    var v = fn();
    if (!opt.optional) ctx.streak[scope] = 0;
    return v;
  } catch (e) {
    analyticsError_(ctx, e, scope, label, !!opt.optional);
    return '';
  }
}

var FB_TOKEN_CODES = { 102: 1, 190: 1, 463: 1, 467: 1 }; // توكن انتهى أو اتلغى
var FB_RATE_CODES = { 4: 1, 17: 1, 32: 1, 613: 1 };      // طلبات كتير

function analyticsCtx_() { return { dead: {}, skip: {}, optFails: {}, streak: {}, errors: [], optional: [] }; }

function analyticsError_(ctx, e, scope, label, optional) {
  var msg = String(e && e.message ? e.message : e).split('\n')[0];
  var code = e && e.fbCode ? Number(e.fbCode) : 0;
  var perm = code === 10 || (code >= 200 && code <= 299);
  if (FB_TOKEN_CODES[code]) { ctx.dead[scope] = { kind: 'token', msg: msg, code: code }; return; }
  if (FB_RATE_CODES[code]) { ctx.dead[scope] = { kind: 'rate', msg: msg, code: code }; return; }
  if (scope === 'yt' && /invalid_grant|توكن يوتيوب|unauthorized|401|403/i.test(msg)) { ctx.dead[scope] = { kind: 'token', msg: msg, code: code }; return; }
  if (optional) {
    var key = label + ': ' + msg;
    if (ctx.optional.indexOf(key) === -1) ctx.optional.push(key);
    ctx.optFails[label] = (ctx.optFails[label] || 0) + 1;
    if (perm || ctx.optFails[label] >= 3) ctx.skip[label] = 1; // مانكررش طلب مقياس مرفوض على كل منشور
    return;
  }
  if (perm) { ctx.dead[scope] = { kind: 'perm', msg: msg, code: code }; return; }
  ctx.errors.push(label + ': ' + msg);
  ctx.streak[scope] = (ctx.streak[scope] || 0) + 1;
  if (ctx.streak[scope] >= 5) ctx.dead[scope] = { kind: 'streak', msg: '5 أخطاء ورا بعض، آخرها: ' + msg, code: code };
}

function analyticsSummary_(ctx, n) {
  var names = { graph: 'فيسبوك/إنستجرام', yt: 'يوتيوب' };
  var why = { token: 'التوكن انتهى أو اتلغى', perm: 'التوكن ناقصه صلاحية', rate: 'وصلنا لحد الطلبات', streak: 'أخطاء كتير ورا بعض' };
  var lines = [];
  Object.keys(ctx.dead).forEach(function (sc) {
    var d = ctx.dead[sc];
    lines.push('🔑 ' + names[sc] + ': وقفنا الطلبات بدري (' + why[d.kind] + '): ' + d.msg +
      (sc === 'graph' && (d.kind === 'token' || d.kind === 'perm') ? '\n   شغّل "2) ربط فيسبوك" من قايمة الجدول.' : '') +
      (sc === 'yt' && d.kind === 'token' ? '\n   شوف docs/youtube-status.md.' : ''));
  });
  if (ctx.errors.length) {
    lines.push('❌ عناصر ما اتحدّثتش (' + ctx.errors.length + '):\n   • ' + ctx.errors.slice(0, 5).join('\n   • ') +
      (ctx.errors.length > 5 ? '\n   • و ' + (ctx.errors.length - 5) + ' كمان' : ''));
  }
  if (ctx.optional.length) {
    lines.push('ℹ️ مقاييس اختيارية فشلت (الخانة اتسابت فاضية، والباقي اتحدّث عادي):\n   • ' + ctx.optional.slice(0, 5).join('\n   • ') +
      (ctx.optional.length > 5 ? '\n   • و ' + (ctx.optional.length - 5) + ' كمان' : ''));
  }
  if (!lines.length) return '';
  return (ctx.errors.length || Object.keys(ctx.dead).length ? '⚠️' : 'ℹ️') + ' تحديث الأرقام: اتحدّث ' + n + ' عنصر بنجاح.\n\n' + lines.join('\n\n');
}

function collectAnalytics_() {
  var a = asheet_();
  if (!a) throw new Error('تاب Analytics مش موجود. شغّل "تجهيز الإضافات" من القايمة.');
  var maxDays = num_('ANALYTICS_DAYS'), now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  var items = [], ctx = analyticsCtx_();

  // البوستات
  var s = sheet_();
  for (var r = 2; r <= s.getLastRow(); r++) {
    if (ctx.dead.graph) break; // التوكن بايظ: مانبعتش عشرات الطلبات الفاشلة
    if (cellText_(r, C.STATUS) !== ST.DONE) continue;
    var num = cellText_(r, C.NUM), fbId = cellText_(r, C.FBID);
    if (fbId && daysAgo_(cellText_(r, C.DATE)) <= maxDays) items.push(fbPostStats_(fbId, num, ctx));
    var ig = cellText_(r, C.IG);
    if (ig && on_('IG_ENABLED') && daysAgo_(cellText_(r, C.DATE)) <= maxDays) items.push(igStats_(ig, 'بوست', num, ctx));
  }

  // الريلز
  var rs = rsheet_(), ytIds = [], ytNums = {};
  if (rs) {
    for (var q = 2; q <= rs.getLastRow(); q++) {
      if (daysAgo_(rtext_(q, RC.DATE)) > maxDays) continue;
      var rn = rtext_(q, RC.NUM), fb = rtext_(q, RC.FB), yt = rtext_(q, RC.YT), igr = rtext_(q, RC.IG);
      if (fb && !ctx.dead.graph) items.push(fbReelStats_(fb.split('/').pop(), rn, ctx));
      if (yt) { var vid = yt.split('/').pop(); ytIds.push(vid); ytNums[vid] = rn; }
      if (igr && igr.indexOf('pending:') !== 0 && on_('IG_REELS_ENABLED') && !ctx.dead.graph) items.push(igStats_(igr, 'ريل', rn, ctx));
    }
  }
  if (ytIds.length) items = items.concat(ytStats_(ytIds, ytNums, ctx));

  // نحدّث الصف لو موجود، أو نضيف صف جديد (المفتاح: المنصة + ID). العناصر اللي فشلت مابتتكتبش ومابتتحسبش.
  var index = {}, written = 0;
  if (a.getLastRow() > 1) a.getRange(2, 1, a.getLastRow() - 1, AC.ID).getValues().forEach(function (v, i) { index[v[0] + '|' + v[3]] = i + 2; });
  items.forEach(function (it) {
    if (!it || typeof it !== 'object' || !it.id) return;
    var row = [it.platform, it.kind, it.num, it.id, it.link, it.date, now, it.likes, it.comments, it.shares, it.views,
      (Number(it.likes) || 0) + (Number(it.comments) || 0) + (Number(it.shares) || 0)];
    var at = index[it.platform + '|' + it.id];
    if (at) a.getRange(at, 1, 1, row.length).setValues([row]);
    else { a.appendRow(row); index[it.platform + '|' + it.id] = a.getLastRow(); }
    written++;
  });
  ANALYTICS_LAST_ = ctx;
  var summary = analyticsSummary_(ctx, written);
  if (summary) notifySafe_(summary); // رسالة واحدة بس للتشغيلة كلها
  return written;
}

function fbPostStats_(postId, num, ctx) {
  return safe_(function () {
    var j = graphGet_(postId + '?fields=created_time,permalink_url,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares');
    var views = safe_(function () {
      var ins = graphGet_(postId + '/insights?metric=' + encodeURIComponent(setting_('FB_VIEWS_METRIC')));
      return ins.data && ins.data[0] && ins.data[0].values ? ins.data[0].values[0].value : '';
    }, ctx, { scope: 'graph', label: 'مشاهدات بوستات فيسبوك (' + setting_('FB_VIEWS_METRIC') + ')', optional: true });
    return { platform: 'فيسبوك', kind: 'بوست', num: num, id: postId, link: j.permalink_url || ('https://www.facebook.com/' + postId),
      date: fbTime_(j.created_time), likes: tc_(j.reactions), comments: tc_(j.comments), shares: j.shares ? j.shares.count : 0, views: views };
  }, ctx, { scope: 'graph', label: 'فيسبوك بوست ' + num });
}

function fbReelStats_(videoId, num, ctx) {
  return safe_(function () {
    var j = graphGet_(videoId + '?fields=created_time,likes.summary(total_count).limit(0),comments.summary(total_count).limit(0)');
    var views = safe_(function () {
      var ins = graphGet_(videoId + '/video_insights?metric=blue_reels_play_count');
      return ins.data && ins.data[0] && ins.data[0].values ? ins.data[0].values[0].value : '';
    }, ctx, { scope: 'graph', label: 'مشاهدات ريلز فيسبوك', optional: true });
    return { platform: 'فيسبوك', kind: 'ريل', num: num, id: videoId, link: 'https://www.facebook.com/reel/' + videoId,
      date: fbTime_(j.created_time), likes: tc_(j.likes), comments: tc_(j.comments), shares: '', views: views };
  }, ctx, { scope: 'graph', label: 'فيسبوك ريل ' + num });
}

function igStats_(link, kind, num, ctx) {
  return safe_(function () {
    var id = igMediaIdFromLink_(link);
    if (!id) throw new Error('مالقيناش الـ media id للرابط ' + link);
    var j = graphGet_(id + '?fields=timestamp,permalink,like_count,comments_count');
    var views = safe_(function () {
      var ins = graphGet_(id + '/insights?metric=views');
      return ins.data && ins.data[0] && ins.data[0].values ? ins.data[0].values[0].value : '';
    }, ctx, { scope: 'graph', label: 'مشاهدات إنستجرام', optional: true });
    return { platform: 'إنستجرام', kind: kind, num: num, id: id, link: j.permalink || link, date: fbTime_(j.timestamp),
      likes: j.like_count || 0, comments: j.comments_count || 0, shares: '', views: views };
  }, ctx, { scope: 'graph', label: 'إنستجرام ' + kind + ' ' + num });
}

// الرابط اللي بنخزنه هو permalink. بنحتاج الـ media id، فبنحفظ الربط بينهم في Script Properties أول مرة.
function igMediaIdFromLink_(link) {
  if (link.indexOf('ig:') === 0) return link.substring(3);
  var p = props_(), key = 'IGM_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, link)).substring(0, 16);
  var id = p.getProperty(key);
  if (id) return id;
  var list = graphGet_(igUserId_() + '/media?fields=id,permalink&limit=50').data || [];
  list.forEach(function (m) {
    var k = 'IGM_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, m.permalink)).substring(0, 16);
    p.setProperty(k, m.id);
    if (m.permalink === link) id = m.id;
  });
  return id;
}

function ytStats_(ids, nums, ctx) {
  return safe_(function () {
    var out = [], token = ytToken_();
    for (var i = 0; i < ids.length; i += 50) {
      (ytGet_('videos?part=statistics,snippet&id=' + ids.slice(i, i + 50).join(','), token).items || []).forEach(function (v) {
        var st = v.statistics || {};
        out.push({ platform: 'يوتيوب', kind: 'ريل', num: nums[v.id], id: v.id, link: 'https://youtube.com/shorts/' + v.id,
          date: fbTime_(v.snippet.publishedAt), likes: st.likeCount || 0, comments: st.commentCount || 0, shares: '', views: st.viewCount || 0 });
      });
    }
    return out;
  }, ctx, { scope: 'yt', label: 'يوتيوب' }) || [];
}

function tc_(x) { return x && x.summary ? x.summary.total_count : 0; }
function fbTime_(t) { return t ? Utilities.formatDate(new Date(t), TZ, 'yyyy-MM-dd HH:mm') : ''; }

/* ---------- التقرير الأسبوعي ---------- */

function weeklyReportNow() { weeklyReport_(); SpreadsheetApp.getUi().alert('التقرير اتبعت على تيليجرام ✅'); }

function analyticsRows_() {
  var a = asheet_();
  if (!a || a.getLastRow() < 2) return [];
  return a.getRange(2, 1, a.getLastRow() - 1, AC.ENG).getValues().map(function (v) {
    return { platform: v[0], kind: v[1], num: v[2], id: v[3], link: v[4], date: String(v[5]), likes: Number(v[7]) || 0,
      comments: Number(v[8]) || 0, shares: Number(v[9]) || 0, views: Number(v[10]) || 0, eng: Number(v[11]) || 0 };
  });
}

function weeklyReport_() {
  if (on_('ANALYTICS_ENABLED')) collectAnalytics_();
  var all = analyticsRows_();
  var recent = all.filter(function (x) { return daysAgo_(x.date) <= 7; });
  if (recent.length < 3) recent = all.filter(function (x) { return daysAgo_(x.date) <= 30; });
  if (!recent.length) { notify_('📊 التقرير الأسبوعي: لسه مفيش أرقام كفاية.'); return; }
  recent.sort(function (x, y) { return y.eng - x.eng; });
  var line = function (x) { return '• ' + x.platform + ' ' + x.kind + ' ' + x.num + ': ' + x.eng + ' تفاعل' + (x.views ? '، ' + x.views + ' مشاهدة' : '') + '\n  ' + x.link; };
  var totalEng = 0, totalViews = 0;
  recent.forEach(function (x) { totalEng += x.eng; totalViews += x.views; });
  var txt = '📊 التقرير الأسبوعي\nإجمالي: ' + recent.length + ' منشور، ' + totalEng + ' تفاعل، ' + totalViews + ' مشاهدة\n\n🏆 الأحسن:\n' +
    recent.slice(0, 3).map(line).join('\n');
  if (recent.length > 3) txt += '\n\n📉 الأضعف:\n' + recent.slice(-3).reverse().map(line).join('\n');
  txt += bestTime_(all);
  notify_(txt);
}

// أحسن يوم وساعة نشر من كل الأرقام اللي عندنا. اقتراح بس: الميعاد بيتغير من تاب Settings لو انت عاوز.
function bestTime_(all) {
  var rows = all.filter(function (x) { return x.date.length >= 16; });
  if (rows.length < 10) return '\n\n⏰ أحسن ميعاد: محتاجين 10 منشورات على الأقل عشان نحكم (عندنا ' + rows.length + ').';
  var days = ['', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت', 'الحد'];
  var byH = {}, byD = {};
  rows.forEach(function (x) {
    var h = x.date.substring(11, 13);
    var wd = ((new Date(x.date.substring(0, 10) + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1; // 1 = الاتنين ... 7 = الحد
    byH[h] = byH[h] || [0, 0]; byH[h][0] += x.eng; byH[h][1]++;
    byD[wd] = byD[wd] || [0, 0]; byD[wd][0] += x.eng; byD[wd][1]++;
  });
  var best = function (m) { var k = null, v = -1; Object.keys(m).forEach(function (x) { var avg = m[x][0] / m[x][1]; if (m[x][1] >= 2 && avg > v) { v = avg; k = x; } }); return [k, Math.round(v)]; };
  var bh = best(byH), bd = best(byD), hours = Object.keys(byH).length;
  var out = '\n\n⏰ أحسن ميعاد (متوسط التفاعل):';
  if (bd[0]) out += '\n• اليوم: ' + days[bd[0]] + ' (' + bd[1] + ')';
  if (hours < 2) out += '\n• الساعة: كل النشر في نفس الساعة تقريبًا، فمش هنعرف نقارن. جرّب تغيّر SEND_HOUR كام أسبوع.';
  else if (bh[0]) out += '\n• الساعة: ' + bh[0] + ':00 (' + bh[1] + ')';
  return out;
}

/* ---------- إعادة نشر البوستات الناجحة ---------- */

function recycleJob_() {
  var s = sheet_(), all = analyticsRows_().filter(function (x) { return x.platform === 'فيسبوك' && x.kind === 'بوست'; });
  if (all.length < 5) return;
  var sorted = all.map(function (x) { return x.eng; }).sort(function (x, y) { return y - x; });
  var cut = sorted[Math.max(0, Math.floor(sorted.length * 0.2) - 1)]; // أعلى 20%
  var byNum = {};
  all.forEach(function (x) { byNum[String(x.num)] = x; });
  var done = 0, limit = num_('RECYCLE_PER_WEEK');
  for (var r = 2; r <= s.getLastRow() && done < limit; r++) {
    var num = cellText_(r, C.NUM), notes = cellText_(r, C.NOTES), st = byNum[num];
    if (cellText_(r, C.STATUS) !== ST.DONE || !st || st.eng < cut) continue;
    if (daysAgo_(cellText_(r, C.DATE)) < num_('RECYCLE_DAYS')) continue;
    if (notes.indexOf('اتعاد') !== -1 || notes.indexOf('إعادة نشر') !== -1) continue;
    var nr = s.getLastRow() + 1, date = nextFreeDate_(s, C.DATE);
    s.getRange(nr, 1, 1, 7).setValues([[nextNum_(s), date, ST.READY, cellText_(r, C.HOOK), cellText_(r, C.CAPTION), cellText_(r, C.IMG), 'إعادة نشر لبوست رقم ' + num]]);
    s.getRange(nr, C.DATE).setNumberFormat('@').setValue(date);
    cell_(r, C.NOTES).setValue((notes ? notes + ' | ' : '') + 'اتعاد ' + cairoDate_());
    notify_('♻️ بوست رقم ' + num + ' (' + st.eng + ' تفاعل) هيتعاد يوم ' + date + '. هيجيلك للموافقة زي أي بوست، ولو مش عاوزه دوس "أجّل" أو امسح الصف.');
    done++;
  }
}
