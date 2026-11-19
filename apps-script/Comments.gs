/**
 * الرد على الكومنتات: كل ساعة بنجيب الكومنتات الجديدة على اللي اتنشر في آخر أيام،
 * الذكاء الاصطناعي يقترح رد، ويتبعتلك على تيليجرام: ✅ رد / ✏️ عدّل / 🙈 تجاهل.
 * مفيش أي رد بيتنشر من غير ما انت تدوس.
 * محتاج صلاحية pages_manage_engagement في توكن الصفحة (شوف docs/rollout.md).
 */

var CMC = { ID: 1, POST: 2, NAME: 3, TEXT: 4, DATE: 5, REPLY: 6, STATUS: 7, TGMSG: 8 };
var CMS = { NEW: 'جديد', SENT: 'اتبعت', DONE: 'اترد', SKIP: 'اتجاهل' };

function csheet_() { return SpreadsheetApp.getActive().getSheetByName('Comments'); }

function commentsJob_() {
  var c = csheet_();
  if (!c) return;
  var known = {};
  if (c.getLastRow() > 1) c.getRange(2, 1, c.getLastRow() - 1, 1).getValues().forEach(function (r) { known[String(r[0])] = 1; });

  // المنشورات اللي بنتابعها
  var targets = [], days = num_('COMMENTS_DAYS'), s = sheet_();
  for (var r = 2; r <= s.getLastRow(); r++) {
    if (cellText_(r, C.FBID) && daysAgo_(cellText_(r, C.DATE)) <= days) targets.push(cellText_(r, C.FBID));
  }
  var rs = rsheet_();
  if (rs) for (var q = 2; q <= rs.getLastRow(); q++) {
    var fb = rtext_(q, RC.FB);
    if (fb && daysAgo_(rtext_(q, RC.DATE)) <= days) targets.push(fb.split('/').pop());
  }

  var fresh = [];
  targets.forEach(function (id) {
    var list = safe_(function () { return graphGet_(id + '/comments?fields=id,from,message,created_time&filter=toplevel&order=reverse_chronological&limit=25').data; }) || [];
    list.forEach(function (cm) {
      if (known[cm.id] || !cm.message) return;
      if (cm.from && String(cm.from.id) === PAGE_ID) return; // كومنتات الصفحة نفسها
      known[cm.id] = 1;
      fresh.push([cm.id, id, cm.from ? cm.from.name : '', cm.message, fbTime_(cm.created_time), '', CMS.NEW, '']);
    });
  });
  if (fresh.length) c.getRange(c.getLastRow() + 1, 1, fresh.length, 8).setValues(fresh);

  // نبعت أقدم الكومنتات الجديدة الأول، بحد أقصى كل ساعة
  var limit = num_('COMMENTS_PER_RUN'), sent = 0;
  for (var k = 2; k <= c.getLastRow() && sent < limit; k++) {
    if (String(c.getRange(k, CMC.STATUS).getValue()) !== CMS.NEW) continue;
    sendCommentForApproval_(k);
    sent++;
  }
}

function sendCommentForApproval_(row) {
  var c = csheet_(), v = c.getRange(row, 1, 1, 8).getValues()[0];
  var reply = String(v[CMC.REPLY - 1] || '');
  if (!reply && on_('AI_ENABLED')) {
    reply = safe_(function () {
      return ai_([{ text: BRAND_VOICE + '\n\nده كومنت من طالب على بوست في الصفحة:\n"' + v[CMC.TEXT - 1] + '"\n' +
        'اكتب رد قصير (سطر أو اتنين) بالعامية المصرية باسم د. أحمد: دافي ومشجّع. لو سؤال كيمياء جاوب باختصار وبدقة، ولو مش متأكد قوله يسأل في الحصة. رجّع الرد بس من غير أي شرح.' }], false);
    });
    if (reply) c.getRange(row, CMC.REPLY).setValue(reply);
  }
  var kb = [[{ text: '✏️ اكتب رد', callback_data: 'cme:' + row }, { text: '🙈 تجاهل', callback_data: 'cmx:' + row }]];
  if (reply) kb.unshift([{ text: '✅ ابعت الرد', callback_data: 'cmo:' + row }]);
  var res = tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'),
    text: '💬 كومنت من ' + (v[CMC.NAME - 1] || 'متابع') + ':\n"' + v[CMC.TEXT - 1] + '"\n\n' + (reply ? 'الرد المقترح:\n' + reply : '(مفيش رد مقترح)'),
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
  try {
    fbJson_(UrlFetchApp.fetch(GRAPH + c.getRange(row, CMC.ID).getValue() + '/comments', {
      method: 'post', payload: { message: msg, access_token: props_().getProperty('FB_PAGE_TOKEN') }, muteHttpExceptions: true
    }));
    c.getRange(row, CMC.STATUS).setValue(CMS.DONE);
    notify_('✅ الرد اتنشر.');
  } catch (e) {
    notify_('❌ الرد ما اتنشرش: ' + e.message + (/permission/i.test(e.message) ? '\nالتوكن محتاج صلاحية pages_manage_engagement (شوف docs/rollout.md).' : ''));
  }
}
