/**
 * الذكاء الاصطناعي — كل حاجة ببلاش:
 * - Gemini (حد مجاني، المفتاح GEMINI_API_KEY في Script Properties): "الودان" بس. بيسمع الفويس والريل ويحوّلهم نص،
 *   وبيقترح ردود سريعة على الكومنتات.
 * - Claude (من اشتراك د. أحمد، عن طريق مهمة Claude المجدولة "كاتب محتوى الصفحة"): هو اللي بيكتب البوستات والريلز.
 *
 * الطابور في الشيت:
 *   فويس / /idea / زرار "اقترح أفكار" / فيديو  ←  صف حالته "اكتبها" (والفكرة الخام في عمود الطلب)
 *   مهمة Claude بتكتب المحتوى  ←  الحالة "اتكتبت"
 *   writtenJob_ هنا: البوست تتعمل له صورة (Image.gs) ويتبعتلك على تيليجرام بزرار "جدوله"، والريل بزرار "خليه جاهز"
 * مفيش حاجة بتتنشر من غير موافقتك.
 */

var REELS_FOLDER_ID = '1Sc_SWF6G8H83WNmHyj9twRwBh38p7ze3'; // فولدر "صفحة د. أحمد نبيل - الريلز"
var TG_FILE_MAX = 20 * 1024 * 1024;   // حد تحميل الملفات من بوت تيليجرام
var AI_INLINE_MAX = 14 * 1024 * 1024; // أكبر ملف نبعته لـ Gemini جوه الطلب نفسه
var ST_IDEA = 'فكرة';
var ST_WRITE = 'اكتبها';   // مستني Claude يكتبه
var ST_WRITTEN = 'اتكتبت'; // Claude كتبه، ومستني السكريبت يعمل الصورة ويبعتهولك
var RST_DRAFT = 'مسودة';

var BRAND_VOICE =
  'انت بترد باسم د. أحمد نبيل "The Chemistry Magician"، مدرس كيمياء لطلاب تالتة ثانوي في مصر.\n' +
  'الأسلوب: عامية مصرية، دافي ومشجّع، قريب من الطالب ومن غير مبالغة. ممنوع معلومات كيمياء غلط.';

/* ---------- Gemini ---------- */

// parts: [{text: ...}, {inline_data: {mime_type, data}}]. json = true يرجّع object.
function ai_(parts, json) {
  var key = props_().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('مفيش GEMINI_API_KEY في Script Properties.');
  var body = { contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0.4 } };
  if (json) body.generationConfig.responseMimeType = 'application/json';
  var r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(setting_('AI_MODEL')) + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'post', contentType: 'application/json; charset=UTF-8', payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var j = JSON.parse(r.getContentText() || '{}');
  if (j.error) throw new Error('Gemini: ' + j.error.message);
  var c = j.candidates && j.candidates[0];
  var txt = c && c.content && c.content.parts ? c.content.parts.map(function (p) { return p.text || ''; }).join('') : '';
  if (!txt) throw new Error('Gemini ما رجّعش رد' + (c && c.finishReason ? ' (' + c.finishReason + ')' : ''));
  if (!json) return txt.trim();
  try { return JSON.parse(txt.replace(/^```json\s*|```\s*$/g, '')); }
  catch (e) { throw new Error('Gemini رجّع رد مش مفهوم'); }
}

// بيحوّل الكلام اللي في ملف صوت أو فيديو لنص زي ما اتقال
function transcribe_(blob, mime) {
  return ai_([
    { text: 'اكتب الكلام اللي في الملف ده بالظبط زي ما اتقال (عامية مصرية، والمصطلحات العلمية زي ما اتنطقت). لو مفيش كلام اكتب "(مفيش كلام)" وبعدها سطر بيوصف اللي بيحصل. اكتب النص بس من غير أي شرح.' },
    { inline_data: { mime_type: mime, data: Utilities.base64Encode(blob.getBytes()) } }
  ], false);
}

function tgDownload_(fileId) {
  var f = tg_('getFile', { file_id: fileId });
  if (!f.ok) throw new Error('تيليجرام: ' + (f.description || 'مش قادر أحمّل الملف') + ' (الحد 20 ميجا)');
  return UrlFetchApp.fetch('https://api.telegram.org/file/bot' + props_().getProperty('TG_TOKEN') + '/' + f.result.file_path).getBlob();
}

/* ---------- الطابور: فكرة ← "اكتبها" ---------- */

function queueIdea_(raw, note) {
  var s = sheet_(), row = s.getLastRow() + 1;
  s.getRange(row, 1, 1, 7).setValues([[nextNum_(s), '', ST_WRITE, '', '', '', note || '']]);
  s.getRange(row, C.REQ).setValue(raw);
  return row;
}

function claudeEta_() {
  return 'هتتكتب في ميعاد Claude الجاي (' + setting_('CLAUDE_TIMES') + ')، والصورة بتتعمل بعدها لوحدها ويوصلك على تيليجرام.';
}

// /idea فكرتك — مش محتاجة أي AI، الفكرة بتدخل الطابور على طول
function ideaFromText_(text) {
  var row = queueIdea_(text, 'من /idea ' + cairoDate_());
  notify_('✅ الفكرة اتسجلت (صف ' + row + '). ' + claudeEta_());
}

function ideaFromVoice_(au) {
  if (!on_('AI_ENABLED')) { notify_('الفويس محتاج AI_ENABLED = true في تاب Settings. لحد كده ابعت الفكرة مكتوبة بعد /idea'); return; }
  notify_('🎙 وصل الفويس، بسمعه...');
  var text = transcribe_(tgDownload_(au.file_id), au.mime_type || 'audio/ogg');
  var row = queueIdea_(text, 'من فويس تيليجرام ' + cairoDate_());
  notify_('✅ سمعت: "' + (text.length > 300 ? text.substring(0, 300) + '…' : text) + '"\n\nاتسجلت (صف ' + row + '). ' + claudeEta_());
}

// زرار "اقترح 5 أفكار": Claude يكتب أفكار جديدة من عنده
function requestIdeas_(n) {
  for (var i = 0; i < n; i++) queueIdea_('فكرة جديدة من عندك: اختار النوع اللي البوستات الأخيرة ناقصاه، وما تكررش فكرة قديمة.', 'طلب أفكار ' + cairoDate_());
  notify_('💡 طلبت ' + n + ' أفكار جديدة. ' + claudeEta_());
}

/* ---------- فيديو ← ريل ---------- */

function videoToReel_(msg) {
  var v = msg.video || msg.document;
  if (v.file_size && v.file_size > TG_FILE_MAX) {
    notify_('⚠️ الفيديو أكبر من 20 ميجا، والبوت مش بيقدر يحمّل أكبر من كده. ارفعه على فولدر الريلز في Drive وحط الـ ID في تاب Reels، واكتب "اكتبها" في الحالة.');
    return;
  }
  notify_('🎬 وصل الفيديو، بحفظه...');
  var blob = tgDownload_(v.file_id).setName('reel-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmm') + '.mp4').setContentType('video/mp4');
  var file = DriveApp.getFolderById(REELS_FOLDER_ID).createFile(blob);
  var req = msg.caption ? 'ملاحظة د. أحمد: ' + msg.caption : '';
  if (on_('AI_ENABLED') && blob.getBytes().length <= AI_INLINE_MAX) {
    try { req += (req ? '\n\n' : '') + 'الكلام اللي في الريل:\n' + transcribe_(blob, 'video/mp4'); }
    catch (e) { req += (req ? '\n' : '') + '(ما قدرتش أسمع الريل: ' + e.message + ')'; }
  }
  var s = rsheet_(), row = s.getLastRow() + 1, vals = [];
  for (var i = 0; i < RC.TGMSG; i++) vals.push('');
  vals[RC.NUM - 1] = nextNum_(s); vals[RC.DATE - 1] = nextFreeDate_(s, RC.DATE); vals[RC.STATUS - 1] = ST_WRITE;
  vals[RC.VIDEO - 1] = file.getId(); vals[RC.NOTES - 1] = 'من فيديو تيليجرام';
  s.getRange(row, 1, 1, RC.TGMSG).setValues([vals]);
  s.getRange(row, RC.REQ).setValue(req || '(مفيش نص — بص على الفيديو نفسه)');
  notify_('✅ الريل اتحفظ (صف ' + row + ')، ومتحدد له ' + vals[RC.DATE - 1] + '. العنوان والكابشن هيتكتبوا في ميعاد Claude الجاي (' + setting_('CLAUDE_TIMES') + ') ويوصلوك على تيليجرام.');
}

/* ---------- بعد ما Claude يكتب ---------- */

// كل ساعة (من extrasHourly_): أي حاجة حالتها "اتكتبت" تتجهز وتتبعتلك
function writtenJob_() {
  var s = sheet_(), done = 0;
  for (var r = 2; r <= s.getLastRow() && done < 3; r++) { // 3 بالكتير كل ساعة عشان حد الـ 6 دقايق
    if (cellText_(r, C.STATUS) !== ST_WRITTEN) continue;
    prepareWrittenPost_(r);
    done++;
  }
  var rs = rsheet_();
  if (!rs) return;
  for (var q = 2; q <= rs.getLastRow(); q++) {
    if (rtext_(q, RC.STATUS) !== ST_WRITTEN) continue;
    rcell_(q, RC.STATUS).setValue(RST_DRAFT);
    tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'),
      text: '🎬 Claude كتب الريل (صف ' + q + ')، ومتحدد له ' + rtext_(q, RC.DATE) + ':\n\nالعنوان: ' + rtext_(q, RC.TITLE) + '\n\n' + reelCaption_(q),
      reply_markup: JSON.stringify({ inline_keyboard: [[{ text: '✅ خليه جاهز', callback_data: 'rdy:' + q }]] }) });
  }
}

function prepareWrittenPost_(row) {
  // الهاشتاجات: الإضافية من تاب Templates (لو فيه) + الثابتين
  var caption = cellText_(row, C.CAPTION).trim(), extra = templateTags_(cellText_(row, C.TYPE));
  if (extra && caption.indexOf(extra) === -1) caption += '\n\n' + extra;
  cell_(row, C.CAPTION).setValue(ensureHashtags_(caption));
  var imgNote = '';
  if (on_('IMAGES_ENABLED') && !cellText_(row, C.IMG)) {
    try { imgNote = renderPostImage_(row); } // Image.gs
    catch (e) { imgNote = '⚠️ الصورة ما اتعملتش: ' + e.message; }
  }
  cell_(row, C.STATUS).setValue(ST_IDEA);
  var chat = props_().getProperty('CHAT_ID');
  var text = '📝 Claude كتب بوست (صف ' + row + '):\n\nالهوك: ' + cellText_(row, C.HOOK) + '\n\n' + cellText_(row, C.CAPTION) + (imgNote ? '\n\n' + imgNote : '');
  var kb = JSON.stringify({ inline_keyboard: [[{ text: '✅ جدوله', callback_data: 'sch:' + row }]] });
  var imgId = cellText_(row, C.IMG);
  if (imgId && text.length <= 1000) { tgPhoto_(chat, DriveApp.getFileById(imgId).getBlob(), text, kb); return; }
  if (imgId) tgPhoto_(chat, DriveApp.getFileById(imgId).getBlob(), '🖼 صورة بوست صف ' + row, null);
  tg_('sendMessage', { chat_id: chat, text: text + (imgId ? '' : '\n\n(مفيش صورة: حط ID صورة في عمود F قبل ما تجدوله)'), reply_markup: kb });
}

// زرار "جدوله": أول يوم فاضي + "جاهز"، وبعدها بيتبعتلك للموافقة في ميعاده زي أي بوست
function scheduleIdea_(row) {
  if (cellText_(row, C.STATUS) !== ST_IDEA) { notify_('البوست ده مش "فكرة" (' + cellText_(row, C.STATUS) + ').'); return; }
  if (!cellText_(row, C.IMG)) { notify_('البوست ده مالوش صورة. حط ID الصورة في عمود F الأول.'); return; }
  var d = nextFreeDate_(sheet_(), C.DATE);
  cell_(row, C.DATE).setNumberFormat('@').setValue(d);
  cell_(row, C.STATUS).setValue(ST.READY);
  notify_('📅 اتجدول يوم ' + d + '، وهيتبعتلك للموافقة في ميعاده.');
}

// هاشتاجات إضافية للنوع ده (لو انت كتبتها في تاب Templates)
function templateTags_(type) {
  var t = SpreadsheetApp.getActive().getSheetByName('Templates');
  if (!t || !type || t.getLastRow() < 2) return '';
  var rows = t.getRange(2, 1, t.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === String(type).trim()) return String(rows[i][2] || '').trim();
  return '';
}
