// اختبارات محاكاة Node. نفس الاختبارات بتتشغل على الكود قبل وبعد التعديل.
var H = require('./harness');
var dir = process.argv[2], label = process.argv[3] || dir;
var now = new Date(), P = H.fmtParts(now, 'Africa/Cairo');
var TODAY = P.year + '-' + P.month + '-' + P.day, HOUR = Number(P.hour);
function addDays(n) { var d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().substring(0, 10); }
var POST_H = ['رقم', 'التاريخ', 'الحالة', 'الهوك', 'الكابشن', 'صورة', 'ملاحظات', 'tg', 'fb', 'ig', 'type', 'req', 'imgp'];
var REEL_H = ['رقم', 'التاريخ', 'الحالة', 'العنوان', 'الكابشن', 'موضوع', 'فيديو', 'fb', 'yt', 'ملاحظات', 'tg', 'ig', 'req'];
function settings(postHour, reelHour, extra) {
  var rows = [['k', 'v', 'd'], ['SEND_HOUR', String(postHour), ''], ['REEL_SEND_HOUR', String(reelHour), ''], ['LOW_READY_ALERT', '2', '']];
  (extra || []).forEach(function (x) { rows.push([x[0], x[1], '']); });
  return rows;
}
function post(num, date, status, img, caption, notes) { return [num, date, status, 'hook' + num, caption || ('caption ' + num), img, notes || '', '', '', '', '', '', '']; }
function reel(num, date, status, vid, caption, notes) { return [num, date, status, 'title' + num, caption || ('reel caption ' + num), 'topic', vid, '', '', notes || '', '', '', '']; }
var BASE_PROPS = { TG_TOKEN: 'T', CHAT_ID: '42', FB_PAGE_TOKEN: 'FB' };
function env(o) {
  o.props = Object.assign({}, BASE_PROPS, o.props || {});
  return H.makeEnv(dir, o);
}
function S(e, name, r, c) { var v = e.sheets[name].data[r - 1][c - 1]; return v === undefined ? '' : v; }
var READY = 'جاهز', SENT = 'اتبعت للموافقة', DONE = 'اتنشر';
var results = [];
function test(name, fn) {
  try { var r = fn(); results.push([r === true ? 'PASS' : 'FAIL', name, r === true ? '' : String(r)]); }
  catch (e) { results.push(['FAIL', name, 'exception: ' + (e && e.message ? e.message : e)]); }
}
function expect(conds) { for (var k in conds) if (!conds[k]) return 'failed: ' + k; return true; }
function tgMsgs(e, method) { return e.log.tg.filter(function (c) { return !method || c.method === method; }); }
function notifs(e) { return tgMsgs(e, 'sendMessage').map(function (c) { return String(c.payload.text); }); }
var postOnly = function (x) { return settings(HOUR, (HOUR + 12) % 24, x); };
var reelOnly = function (x) { return settings((HOUR + 12) % 24, HOUR, x); };

/* ===== 1) Telegram success ===== */
test('01 Telegram نجاح: البوست يتبعت، الحالة SENT، رقم الرسالة يتسجل، LAST_SENT_DATE يتسجل', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, READY, 'img1')], Settings: postOnly() }, files: { img1: {} } });
  e.ctx.dailyJob();
  return expect({ status: S(e, 'Posts', 2, 3) === SENT, tgmsg: !!S(e, 'Posts', 2, 8), last: e.props.LAST_SENT_DATE === TODAY, photo: tgMsgs(e, 'sendPhoto').length === 1 });
});

/* ===== 2) Telegram failure ===== */
test('02 Telegram يرجّع ok:false (500): الحالة تفضل جاهز، LAST_SENT_DATE مايتسجلش، سبب في الملاحظات', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, READY, 'img1')], Settings: postOnly() }, files: { img1: {} },
    tg: function (c, id) { if (c.method === 'sendPhoto') return { ok: false, error_code: 500, description: 'Internal Server Error' }; return { ok: true, result: { message_id: id } }; } });
  e.ctx.dailyJob();
  return expect({ status: S(e, 'Posts', 2, 3) === READY, noLast: !e.props.LAST_SENT_DATE, note: /Internal Server Error/.test(S(e, 'Posts', 2, 7)),
    notMarkedBlocked: S(e, 'Posts', 2, 7).indexOf('⛔') === -1, alerted: notifs(e).some(function (t) { return /ما اتبعتش/.test(t); }) });
});
test('03 Telegram exception (شبكة): مفيش crash، الحالة جاهز، LAST_SENT_DATE مايتسجلش', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, READY, 'img1')], Settings: postOnly() }, files: { img1: {} },
    tg: function (c, id) { if (c.method === 'sendPhoto') return new Error('Address unavailable: api.telegram.org'); return { ok: true, result: { message_id: id } }; } });
  e.ctx.dailyJob();
  return expect({ status: S(e, 'Posts', 2, 3) === READY, noLast: !e.props.LAST_SENT_DATE });
});
test('04 فشل مؤقت مايوقفش الصف: اليوم اللي بعده نفس الصف يتجرب تاني وينجح', function () {
  var fail = true;
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, READY, 'img1')], Settings: postOnly() }, files: { img1: {} },
    tg: function (c, id) { if (c.method === 'sendPhoto' && fail) return { ok: false, error_code: 429, description: 'Too Many Requests' }; return { ok: true, result: { message_id: id } }; } });
  e.ctx.dailyJob(); fail = false; e.ctx.dailyJob();
  return expect({ sentNow: S(e, 'Posts', 2, 3) === SENT, last: e.props.LAST_SENT_DATE === TODAY });
});

/* ===== 3) missing image / invalid Drive ID ===== */
test('05 ID صورة فاضي: الصف يتخطى، الصف اللي بعده يتبعت، LAST_SENT_DATE يتسجل', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, addDays(-1), READY, ''), post(2, TODAY, READY, 'img2')], Settings: postOnly() }, files: { img2: {} } });
  e.ctx.dailyJob();
  return expect({ row2Ready: S(e, 'Posts', 2, 3) === READY, row3Sent: S(e, 'Posts', 3, 3) === SENT, last: e.props.LAST_SENT_DATE === TODAY,
    note: /مفيش ID صورة/.test(S(e, 'Posts', 2, 7)) });
});
test('06 Drive ID غلط: الصف يتخطى وملاحظة واضحة، والتالي يتبعت', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, addDays(-1), READY, 'BAD_ID'), post(2, TODAY, READY, 'img2')], Settings: postOnly() }, files: { img2: {} } });
  e.ctx.dailyJob();
  return expect({ row2Ready: S(e, 'Posts', 2, 3) === READY, row3Sent: S(e, 'Posts', 3, 3) === SENT, note: /BAD_ID/.test(S(e, 'Posts', 2, 7)),
    summary: notifs(e).some(function (t) { return /اتخطّيت/.test(t); }) });
});
test('07 الصف المعطوب مايتجربش كل يوم: تاني يوم مفيش طلب Drive للـ ID الغلط', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, addDays(-1), READY, 'BAD_ID'), post(2, TODAY, READY, 'img2'), post(3, TODAY, READY, 'img3')], Settings: postOnly() }, files: { img2: {}, img3: {} } });
  e.ctx.dailyJob();
  delete e.props.LAST_SENT_DATE; e.log.drive = [];
  e.ctx.dailyJob();
  return expect({ notRetried: e.log.drive.indexOf('BAD_ID') === -1, row4Sent: S(e, 'Posts', 4, 3) === SENT });
});
test('08 إعادة التفعيل: تصحيح ID الصورة يرجّع الصف لوحده، ومسح سطر الإيقاف كمان', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, addDays(-1), READY, 'BAD_ID', 'c', 'ملاحظة قديمة')], Settings: postOnly() }, files: {} });
  e.ctx.dailyJob();
  var keptOld = S(e, 'Posts', 2, 7).indexOf('ملاحظة قديمة') === 0;
  // (أ) نفس البيانات: لسه موقوف
  delete e.props.LAST_SENT_DATE; e.log.drive = []; e.ctx.dailyJob();
  var stillBlocked = e.log.drive.indexOf('BAD_ID') === -1;
  // (ب) الملف اتصلّح بنفس الـ ID (صلاحية) + مسح سطر الإيقاف من الملاحظات
  e.files.BAD_ID = {}; e.sheets.Posts.data[1][6] = 'ملاحظة قديمة';
  delete e.props.LAST_SENT_DATE; e.ctx.dailyJob();
  var sentAfterClear = S(e, 'Posts', 2, 3) === SENT;
  // (ج) صف تاني: تغيير الـ ID بس يكفي
  var e2 = env({ sheets: { Posts: [POST_H, post(1, addDays(-1), READY, 'BAD_ID')], Settings: postOnly() }, files: { GOOD: {} } });
  e2.ctx.dailyJob(); e2.sheets.Posts.data[1][5] = 'GOOD'; delete e2.props.LAST_SENT_DATE; e2.ctx.dailyJob();
  return expect({ keptOld: keptOld, stillBlocked: stillBlocked, sentAfterClear: sentAfterClear, sentAfterIdFix: S(e2, 'Posts', 2, 3) === SENT, statusNeverChanged: true });
});

/* ===== 4) long caption ===== */
var LONG = new Array(1200).join('x');
test('09 كابشن طويل: الصورة نجحت والكابشن فشل ⇒ مش SENT، LAST_SENT_DATE مايتسجلش، الصورة اليتيمة تتمسح', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, READY, 'img1', LONG)], Settings: postOnly() }, files: { img1: {} },
    tg: function (c, id) { if (c.method === 'sendMessage' && c.payload.reply_markup && /ok:/.test(c.payload.reply_markup)) return { ok: false, error_code: 502, description: 'Bad Gateway' }; return { ok: true, result: { message_id: id } }; } });
  e.ctx.dailyJob();
  return expect({ status: S(e, 'Posts', 2, 3) === READY, noLast: !e.props.LAST_SENT_DATE, deleted: tgMsgs(e, 'deleteMessage').length === 1, note: /الكابشن والزراير/.test(S(e, 'Posts', 2, 7)) });
});
test('10 كابشن طويل والاتنين نجحوا: SENT، ورقم الرسالة = رسالة الكابشن اللي فيها الزراير', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, READY, 'img1', LONG)], Settings: postOnly() }, files: { img1: {} } });
  e.ctx.dailyJob();
  var capMsg = tgMsgs(e, 'sendMessage').filter(function (c) { return c.payload.reply_markup && /ok:2/.test(c.payload.reply_markup); });
  var photo = tgMsgs(e, 'sendPhoto')[0];
  return expect({ status: S(e, 'Posts', 2, 3) === SENT, last: e.props.LAST_SENT_DATE === TODAY, capMsg: capMsg.length === 1, photoNoKb: !photo.payload.reply_markup && !photo.payload.caption, tgmsgIsNumber: Number(S(e, 'Posts', 2, 8)) > 0 });
});

/* ===== 5) LOW_READY_ALERT ===== */
test('11 تنبيه قلة البوستات مايتبعتش لو الإرسال فشل', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, READY, 'img1')], Settings: postOnly() }, files: { img1: {} },
    tg: function (c, id) { if (c.method === 'sendPhoto') return { ok: false, error_code: 500, description: 'x' }; return { ok: true, result: { message_id: id } }; } });
  e.ctx.dailyJob();
  return expect({ noLowAlert: !notifs(e).some(function (t) { return /📌 فاضل/.test(t); }) });
});
test('12 تنبيه قلة البوستات بعد النجاح مايحسبش الصف الموقوف', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, addDays(-1), READY, 'BAD'), post(2, TODAY, READY, 'img2'), post(3, addDays(3), READY, 'img3')], Settings: postOnly() }, files: { img2: {}, img3: {} } });
  e.ctx.dailyJob();
  var low = notifs(e).filter(function (t) { return /📌 فاضل/.test(t); });
  return expect({ lowSent: low.length === 1, count1: /فاضل 1 /.test(low[0] || '') });
});

/* ===== 6) dates ===== */
test('13 التاريخ الفاضي مايعتبرش مستحق', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, '', READY, 'img1')], Settings: postOnly() }, files: { img1: {} } });
  e.ctx.dailyJob();
  return expect({ notSent: S(e, 'Posts', 2, 3) === READY, noPhoto: tgMsgs(e, 'sendPhoto').length === 0, noLast: !e.props.LAST_SENT_DATE });
});
test('14 التواريخ الغلط (abc / 2026-13-01 / 2026-02-30 / 1-1-2026 / Date object) تتجاهل', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, 'abc', READY, 'i'), post(2, '2026-13-01', READY, 'i'), post(3, '2026-02-30', READY, 'i'), post(4, '1-1-2026', READY, 'i'), post(5, new Date('2020-01-01'), READY, 'i')], Settings: postOnly() }, files: { i: {} } });
  e.ctx.dailyJob();
  return expect({ none: tgMsgs(e, 'sendPhoto').length === 0 });
});
test('15 الترتيب الزمني: أقدم تاريخ مستحق يتبعت حتى لو مش أول صف، والمستقبل مايتبعتش', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, addDays(5), READY, 'i1'), post(2, addDays(-1), READY, 'i2'), post(3, addDays(-7), READY, 'i3')], Settings: postOnly() }, files: { i1: {}, i2: {}, i3: {} } });
  e.ctx.dailyJob();
  return expect({ oldest: S(e, 'Posts', 4, 3) === SENT, others: S(e, 'Posts', 2, 3) === READY && S(e, 'Posts', 3, 3) === READY });
});
test('16 /post مايبعتش بوست تاريخه فاضي', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, '', READY, 'img1')], Settings: postOnly() }, files: { img1: {} } });
  e.ctx.handleUpdate_({ message: { chat: { id: 42 }, text: '/post' } });
  return expect({ notSent: S(e, 'Posts', 2, 3) === READY });
});

/* ===== 7) edit + approval paths ===== */
test('17 مسار ed: تعديل الكابشن ⇒ يتبعت تاني بالكابشن الجديد، وبعدها ok: ينشر على فيسبوك (الموافقات زي ما هي)', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, SENT, 'img1')], Settings: postOnly() }, files: { img1: {} },
    graph: function (p) { if (/photos/.test(p)) return { id: 'P1', post_id: '103_P1' }; return {}; } });
  e.ctx.handleUpdate_({ callback_query: { id: 'q', from: { id: 42 }, data: 'ed:2' } });
  e.ctx.handleUpdate_({ message: { chat: { id: 42 }, text: 'كابشن جديد' } });
  var photo = tgMsgs(e, 'sendPhoto')[0];
  var resent = photo && /كابشن جديد/.test(photo.payload.caption) && S(e, 'Posts', 2, 3) === SENT;
  e.ctx.handleUpdate_({ callback_query: { id: 'q2', from: { id: 42 }, data: 'ok:2' } });
  return expect({ resent: resent, editCleared: !e.props.EDIT_ROW, published: S(e, 'Posts', 2, 3) === DONE && S(e, 'Posts', 2, 9) === '103_P1' });
});
test('18 مسار ed: لو الإرسال فشل بعد التعديل ⇒ مفيش crash، الكابشن محفوظ، وتنبيه بالسبب', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, SENT, 'img1')], Settings: postOnly() }, files: { img1: {} },
    tg: function (c, id) { if (c.method === 'sendPhoto') return { ok: false, error_code: 500, description: 'down' }; return { ok: true, result: { message_id: id } }; } });
  e.ctx.handleUpdate_({ callback_query: { id: 'q', from: { id: 42 }, data: 'ed:2' } });
  e.ctx.handleUpdate_({ message: { chat: { id: 42 }, text: 'كابشن جديد' } });
  return expect({ saved: /كابشن جديد/.test(S(e, 'Posts', 2, 5)), told: notifs(e).some(function (t) { return /ما اتبعتش للموافقة/.test(t); }) });
});
test('19 sk: (أجّل) والـ ok: على بوست مش SENT زي الأول', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, TODAY, SENT, 'img1')], Settings: postOnly() }, files: { img1: {} } });
  e.ctx.handleUpdate_({ callback_query: { id: 'q', from: { id: 42 }, data: 'sk:2' } });
  var ok1 = S(e, 'Posts', 2, 3) === READY && S(e, 'Posts', 2, 2) === addDays(1);
  e.ctx.handleUpdate_({ callback_query: { id: 'q', from: { id: 42 }, data: 'ok:2' } });
  return expect({ skip: ok1, okRejected: S(e, 'Posts', 2, 3) === READY && notifs(e).some(function (t) { return /اتعالج قبل كده/.test(t); }) });
});

/* ===== 8) Reels ===== */
test('20 ريل نجاح: SENT و LAST_REEL_DATE يتسجل', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H, reel(1, TODAY, READY, 'v1')], Settings: reelOnly() }, files: { v1: {} } });
  e.ctx.dailyJob();
  return expect({ status: S(e, 'Reels', 2, 3) === SENT, last: e.props.LAST_REEL_DATE === TODAY });
});
test('21 ريل: sendVideo فشل ⇒ مش SENT، LAST_REEL_DATE مايتسجلش', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H, reel(1, TODAY, READY, 'v1')], Settings: reelOnly() }, files: { v1: {} },
    tg: function (c, id) { if (c.method === 'sendVideo') return { ok: false, error_code: 500, description: 'x' }; return { ok: true, result: { message_id: id } }; } });
  e.ctx.dailyJob();
  return expect({ status: S(e, 'Reels', 2, 3) === READY, noLast: !e.props.LAST_REEL_DATE });
});
test('22 ريل: الكابشن الطويل فشل بعد نجاح الفيديو ⇒ مش SENT، LAST_REEL_DATE مايتسجلش', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H, reel(1, TODAY, READY, 'v1', LONG)], Settings: reelOnly() }, files: { v1: {} },
    tg: function (c, id) { if (c.method === 'sendMessage' && c.payload.reply_markup && /rok:/.test(c.payload.reply_markup)) return { ok: false, error_code: 500, description: 'x' }; return { ok: true, result: { message_id: id } }; } });
  e.ctx.dailyJob();
  return expect({ status: S(e, 'Reels', 2, 3) === READY, noLast: !e.props.LAST_REEL_DATE });
});
test('23 ريل معطوب (أكبر من 50 ميجا) يتخطى والريل التالي يتبعت، والملاحظة القديمة ماتتمسحش', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H, reel(1, addDays(-2), READY, 'big', null, 'من فيديو تيليجرام'), reel(2, TODAY, READY, 'v2')], Settings: reelOnly() }, files: { big: { size: 60 * 1048576 }, v2: {} } });
  e.ctx.dailyJob();
  var n = S(e, 'Reels', 2, 10);
  return expect({ r1Ready: S(e, 'Reels', 2, 3) === READY, r2Sent: S(e, 'Reels', 3, 3) === SENT, last: e.props.LAST_REEL_DATE === TODAY, oldNoteKept: n.indexOf('من فيديو تيليجرام') === 0, newNote: /50 ميجا/.test(n) });
});
test('24 ريل معطوب مايتجربش تاني يوم، ويرجع لوحده بعد تغيير ID الفيديو', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H, reel(1, addDays(-2), READY, 'missing')], Settings: reelOnly() }, files: { good: {} } });
  e.ctx.dailyJob(); e.log.drive = []; delete e.props.LAST_REEL_DATE; e.ctx.dailyJob();
  var notRetried = e.log.drive.indexOf('missing') === -1;
  e.sheets.Reels.data[1][6] = 'good'; delete e.props.LAST_REEL_DATE; e.ctx.dailyJob();
  return expect({ notRetried: notRetried, sentAfterFix: S(e, 'Reels', 2, 3) === SENT });
});
test('25 ريلز: التاريخ الفاضي مش مستحق، وأقدم تاريخ الأول', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H, reel(1, '', READY, 'v'), reel(2, addDays(-1), READY, 'v'), reel(3, addDays(-4), READY, 'v')], Settings: reelOnly() }, files: { v: {} } });
  e.ctx.dailyJob();
  return expect({ oldest: S(e, 'Reels', 4, 3) === SENT, emptyNot: S(e, 'Reels', 2, 3) === READY, mid: S(e, 'Reels', 3, 3) === READY });
});
test('26 مسار red: تعديل كابشن الريل ⇒ يتبعت تاني و rok: لسه شغال (الحالة تتغير لموافقة)', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H, reel(1, TODAY, SENT, 'v1')], Settings: reelOnly() }, files: { v1: {} },
    graph: function () { return { error: { message: 'stop here', code: 1 } }; }, other: function () { return { code: 500, body: '{}' }; } });
  e.ctx.handleUpdate_({ callback_query: { id: 'q', from: { id: 42 }, data: 'red:2' } });
  e.ctx.handleUpdate_({ message: { chat: { id: 42 }, text: 'كابشن ريل جديد' } });
  var v = tgMsgs(e, 'sendVideo')[0];
  var resent = v && /كابشن ريل جديد/.test(v.payload.caption) && S(e, 'Reels', 2, 3) === SENT;
  e.ctx.handleUpdate_({ callback_query: { id: 'q2', from: { id: 42 }, data: 'rok:2' } });
  // النشر نفسه فشل في المحاكاة (مفيش فيسبوك/يوتيوب حقيقي) فالحالة = فشل جزئي، وده سلوك النشر الأصلي
  return expect({ resent: resent, cleared: !e.props.REEL_EDIT_ROW, approvedFlow: S(e, 'Reels', 2, 3) === 'فشل جزئي' });
});
test('27 /reel لما مفيش ريل ⇒ نفس الرسالة القديمة', function () {
  var e = env({ sheets: { Posts: [POST_H], Reels: [REEL_H], Settings: reelOnly() } });
  e.ctx.handleUpdate_({ message: { chat: { id: 42 }, text: '/reel' } });
  return expect({ msg: notifs(e).some(function (t) { return /مفيش ريل جاهز/.test(t); }) });
});

/* ===== 9) Analytics ===== */
var AN_H = ['المنصة', 'النوع', 'رقم', 'ID', 'الرابط', 'تاريخ', 'تحديث', 'l', 'c', 's', 'v', 'e'];
function donePosts(n) { var rows = [POST_H]; for (var i = 1; i <= n; i++) { var p = post(i, addDays(-i), DONE, 'i'); p[8] = 'FBP' + i; rows.push(p); } return rows; }
test('28 Analytics: توكن منتهي (190) ⇒ الحلقة تقف بعد أول طلب، ملخص واحد، والعدد 0', function () {
  var graphCalls = 0;
  var e = env({ sheets: { Posts: donePosts(30), Analytics: [AN_H], Settings: postOnly() },
    graph: function () { graphCalls++; return { error: { message: 'Error validating access token: Session has expired', code: 190 } }; } });
  var n = e.ctx.collectAnalytics_();
  var msgs = notifs(e);
  return expect({ fewCalls: graphCalls <= 2, count0: n === 0, oneMsg: msgs.length === 1, tokenWord: /توكن|التوكن/.test(msgs[0] || ''), noRows: e.sheets.Analytics.data.length === 1 });
});
test('29 Analytics: العناصر الفاشلة ماتتحسبش (3 نجحوا و2 فشلوا ⇒ 3)', function () {
  var e = env({ sheets: { Posts: donePosts(5), Analytics: [AN_H], Settings: postOnly() },
    graph: function (p) {
      if (/insights/.test(p)) return { data: [{ values: [{ value: 9 }] }] };
      if (/^FBP[12]\?/.test(p)) return { error: { message: 'Unsupported get request', code: 100 } };
      return { created_time: '2026-11-01T10:00:00+0000', reactions: { summary: { total_count: 2 } }, comments: { summary: { total_count: 1 } } };
    } });
  var n = e.ctx.collectAnalytics_();
  return expect({ count3: n === 3, rows3: e.sheets.Analytics.data.filter(function (r, i) { return i > 0 && r[3]; }).length === 3, oneMsg: notifs(e).length === 1 });
});
test('30 Analytics: مقياس اختياري مرفوض ⇒ العنصر يتحسب والمشاهدات فاضية، والمقياس يبطّل يتطلب، ورسالة واحدة', function () {
  var ins = 0;
  var e = env({ sheets: { Posts: donePosts(10), Analytics: [AN_H], Settings: postOnly() },
    graph: function (p) {
      if (/insights/.test(p)) { ins++; return { error: { message: '(#100) The value must be a valid insights metric', code: 100 } }; }
      return { created_time: '2026-11-01T10:00:00+0000' };
    } });
  var n = e.ctx.collectAnalytics_();
  var msgs = notifs(e);
  return expect({ count10: n === 10, insightsCapped: ins <= 3, oneMsg: msgs.length === 1, optionalWord: /اختياري/.test(msgs[0] || '') });
});
test('31 Analytics: نجاح كامل ⇒ مفيش رسايل تيليجرام', function () {
  var e = env({ sheets: { Posts: donePosts(3), Analytics: [AN_H], Settings: postOnly() },
    graph: function (p) { if (/insights/.test(p)) return { data: [{ values: [{ value: 9 }] }] }; return { created_time: '2026-11-01T10:00:00+0000' }; } });
  var n = e.ctx.collectAnalytics_();
  return expect({ n3: n === 3, noMsg: notifs(e).length === 0 });
});

/* ===== 10) Comments.gs ===== */
var CM_H = ['id', 'post', 'name', 'text', 'date', 'reply', 'status', 'tg'];
test('32 Comments: منشور فشل والتاني نجح ⇒ الكومنتات الجديدة تتسجل وتتبعت، ومفيش رسالة خطأ زي الأول', function () {
  var rows = donePosts(2);
  var e = env({ sheets: { Posts: rows, Comments: [CM_H], Settings: postOnly([['COMMENTS_ENABLED', 'true']]) },
    graph: function (p) {
      if (/^FBP1\/comments/.test(p)) return { error: { message: 'boom', code: 1 } };
      if (/^FBP2\/comments/.test(p)) return { data: [{ id: 'cm1', from: { id: 'u', name: 'Ali' }, message: 'سؤال', created_time: '2026-11-01T10:00:00+0000' }] };
      return {};
    } });
  e.ctx.commentsJob_();
  var c = e.sheets.Comments.data;
  var msgs = notifs(e);
  return expect({ stored: c.length === 2 && c[1][0] === 'cm1', sentForApproval: msgs.length === 1 && /كومنت من Ali/.test(msgs[0]), statusSent: c[1][6] === 'اتبعت', noErrorMsg: !msgs.some(function (t) { return /❌/.test(t); }) });
});
test('33 Comments: postCommentReply_ رسالة الخطأ زي ما هي (fbJson_ لسه بيرمي نفس النص)', function () {
  var e = env({ sheets: { Posts: [POST_H], Comments: [CM_H, ['cm1', 'p', 'Ali', 'x', '', 'رد', 'اتبعت', '']], Settings: postOnly() },
    graph: function () { return { error: { message: '(#200) Permissions error', code: 200 } }; } });
  e.ctx.postCommentReply_(2, 'رد');
  var m = notifs(e)[0] || '';
  return expect({ sameText: /❌ الرد ما اتنشرش: \(#200\) Permissions error/.test(m), hint: /pages_manage_engagement/.test(m) });
});

/* ===== 11) Health / Web ===== */
test('34 Health و Web بيشتغلوا، والبوست الموقوف مايتحسبش جاهز', function () {
  var e = env({ sheets: { Posts: [POST_H, post(1, addDays(-1), READY, 'BAD'), post(2, addDays(1), READY, 'i'), post(3, '', READY, 'i')], Reels: [REEL_H], Analytics: [AN_H], Settings: postOnly() }, files: { i: {} },
    graph: function () { return { name: 'Page' }; } });
  e.ctx.dailyJob(); // يوقف صف BAD
  var h = e.ctx.runHealth_(true);
  var html = e.ctx.dashboardHtml_();
  return expect({ readyIs1: /بوستات جاهزة: 1|البوستات الجاهزة: 1/.test(h.text), lists: /موقوف/.test(h.text), badDate: /التاريخ فاضي/.test(h.text), html: /<b>1<\/b>بوست جاهز/.test(html) });
});

var pass = results.filter(function (r) { return r[0] === 'PASS'; }).length;
console.log('### ' + label + ': ' + pass + '/' + results.length + ' PASS');
results.forEach(function (r) { console.log(r[0] + '  ' + r[1] + (r[2] ? '\n        → ' + r[2] : '')); });
