/**
 * الذكاء الاصطناعي (Gemini API — فيه حد مجاني). المفتاح في Script Properties باسم GEMINI_API_KEY.
 * - فويس أو /idea على البوت ← بوست جديد بحالة "فكرة" في تاب Posts
 * - فيديو على البوت ← ريل جديد بحالة "مسودة" في تاب Reels، وزرار "خليه جاهز"
 * - "اقترح أفكار" لما البوستات الجاهزة تقل، والأسئلة المتكررة في الكومنتات ← أفكار
 * المحتوى اللي بيطلع ده مسودة دايمًا: مفيش حاجة بتتنشر من غير موافقتك.
 */

var REELS_FOLDER_ID = '1Sc_SWF6G8H83WNmHyj9twRwBh38p7ze3'; // فولدر "صفحة د. أحمد نبيل - الريلز"
var TG_FILE_MAX = 20 * 1024 * 1024;   // حد تحميل الملفات من بوت تيليجرام
var AI_INLINE_MAX = 14 * 1024 * 1024; // أكبر ملف نبعته لـ Gemini جوه الطلب نفسه
var ST_IDEA = 'فكرة';
var RST_DRAFT = 'مسودة';

var BRAND_VOICE =
  'انت بتكتب لصفحة د. أحمد نبيل "The Chemistry Magician"، مدرس كيمياء لطلاب تالتة ثانوي في مصر.\n' +
  'الأسلوب: عامية مصرية، محفّز ومشجّع، مليان نصايح مذاكرة عملية، قريب من الطالب ومن غير مبالغة.\n' +
  'الهوك: جملة قصيرة من سطرين مفصولين بـ " / " (بيتكتب على الصورة).\n' +
  'الكابشن: نص طويل محفّز، وسطر تفاعل في الآخر. ما تحطش أي هاشتاجات (بتتضاف لوحدها).\n' +
  'ممنوع تنقل نص من حد تاني، وممنوع معلومات كيمياء غلط.';

/* ---------- الاتصال بـ Gemini ---------- */

// parts: [{text: ...}, {inline_data: {mime_type, data}}]. json = true يرجّع object.
function ai_(parts, json) {
  var key = props_().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('مفيش GEMINI_API_KEY في Script Properties.');
  var body = { contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0.8 } };
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

function templatesText_() {
  var t = SpreadsheetApp.getActive().getSheetByName('Templates');
  if (!t || t.getLastRow() < 2) return '';
  return 'أنواع البوستات وشكل كل نوع:\n' + t.getRange(2, 1, t.getLastRow() - 1, 2).getValues()
    .filter(function (r) { return r[0]; }).map(function (r) { return '- ' + r[0] + ': ' + r[1]; }).join('\n');
}

// هاشتاجات إضافية للنوع ده (لو انت كتبتها في تاب Templates)
function templateTags_(type) {
  var t = SpreadsheetApp.getActive().getSheetByName('Templates');
  if (!t || !type || t.getLastRow() < 2) return '';
  var rows = t.getRange(2, 1, t.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === String(type).trim()) return String(rows[i][2] || '').trim();
  return '';
}

function recentHooks_(n) {
  var s = sheet_(), out = [];
  for (var r = Math.max(2, s.getLastRow() - n + 1); r <= s.getLastRow(); r++) { var h = cellText_(r, C.HOOK); if (h) out.push(h); }
  return out;
}

/* ---------- ملفات تيليجرام ---------- */

function tgDownload_(fileId) {
  var f = tg_('getFile', { file_id: fileId });
  if (!f.ok) throw new Error('تيليجرام: ' + (f.description || 'مش قادر أحمّل الملف') + ' (الحد 20 ميجا)');
  return UrlFetchApp.fetch('https://api.telegram.org/file/bot' + props_().getProperty('TG_TOKEN') + '/' + f.result.file_path).getBlob();
}

/* ---------- فكرة (فويس أو نص) ← بوست ---------- */

function addPostIdea_(idea) {
  var s = sheet_(), row = s.getLastRow() + 1;
  var caption = idea.caption;
  var extra = templateTags_(idea.type);
  if (extra) caption = String(caption).trim() + '\n\n' + extra;
  s.getRange(row, 1, 1, 7).setValues([[nextNum_(s), '', ST_IDEA, idea.hook || '', ensureHashtags_(caption), '', idea.note || '']]);
  if (idea.type) s.getRange(row, C.TYPE).setValue(idea.type);
  return row;
}

// audioBlob أو text (واحد منهم). mime = نوع الصوت (تيليجرام بيرجّع الملف من غير نوع مظبوط)
function ideaToPost_(audioBlob, text, mime) {
  var prompt = BRAND_VOICE + '\n\n' + templatesText_() + '\n\n' +
    (audioBlob ? 'ده فويس من د. أحمد فيه فكرة بوست. افهم الفكرة واكتب منها بوست.' : 'دي فكرة بوست من د. أحمد: ' + text) +
    '\nرجّع JSON بالشكل ده بس: {"type":"نوع من الأنواع","hook":"سطر / سطر","caption":"الكابشن"}';
  var parts = [{ text: prompt }];
  if (audioBlob) parts.push({ inline_data: { mime_type: mime || 'audio/ogg', data: Utilities.base64Encode(audioBlob.getBytes()) } });
  var j = ai_(parts, true);
  if (!j.caption) throw new Error('Gemini ما كتبش كابشن');
  var row = addPostIdea_({ type: j.type, hook: j.hook, caption: j.caption, note: (audioBlob ? 'من فويس تيليجرام ' : 'من /idea ') + cairoDate_() });
  notify_('💡 اتضاف بوست جديد (صف ' + row + ') بحالة "فكرة":\n\nالهوك: ' + (j.hook || '-') + '\n\n' + j.caption +
    '\n\nلما الصورة تجهز: حط ID الصورة والتاريخ وغيّر الحالة لـ "جاهز".');
}

/* ---------- فيديو ← ريل ---------- */

function videoToReel_(msg) {
  var v = msg.video || msg.document;
  if (v.file_size && v.file_size > TG_FILE_MAX) {
    notify_('⚠️ الفيديو أكبر من 20 ميجا، والبوت مش بيقدر يحمّل أكبر من كده. ارفعه على فولدر الريلز في Drive وحط الـ ID في تاب Reels.');
    return;
  }
  notify_('🎬 وصل الفيديو، بجهّز الريل...');
  var blob = tgDownload_(v.file_id).setName('reel-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmm') + '.mp4').setContentType('video/mp4');
  var file = DriveApp.getFolderById(REELS_FOLDER_ID).createFile(blob);
  var hint = msg.caption || '';
  var prompt = BRAND_VOICE + '\n\nده ريل لصفحة د. أحمد.' + (hint ? ' ملاحظة منه: ' + hint : '') +
    '\nاكتب له: عنوان قصير (أقل من 70 حرف)، وكابشن قصير ومحفّز، وهاشتاج موضوع واحد بالعربي من كلمة أو اتنين (من غير #).' +
    '\nرجّع JSON بالشكل ده بس: {"title":"...","caption":"...","topic":"..."}';
  var parts = [{ text: prompt }];
  if (blob.getBytes().length <= AI_INLINE_MAX) parts.push({ inline_data: { mime_type: 'video/mp4', data: Utilities.base64Encode(blob.getBytes()) } });
  else if (!hint) parts[0].text += '\n(الفيديو كبير ومش متبعت، اكتب كابشن عام عن مذاكرة الكيمياء)';
  var j = ai_(parts, true);
  var s = rsheet_(), row = s.getLastRow() + 1;
  var vals = [];
  vals[RC.NUM - 1] = nextNum_(s); vals[RC.DATE - 1] = nextFreeDate_(s, RC.DATE); vals[RC.STATUS - 1] = RST_DRAFT;
  vals[RC.TITLE - 1] = j.title || ''; vals[RC.CAPTION - 1] = j.caption || ''; vals[RC.TOPIC - 1] = j.topic || '';
  vals[RC.VIDEO - 1] = file.getId(); vals[RC.FB - 1] = ''; vals[RC.YT - 1] = ''; vals[RC.NOTES - 1] = 'من فيديو تيليجرام'; vals[RC.TGMSG - 1] = '';
  s.getRange(row, 1, 1, RC.TGMSG).setValues([vals]);
  tg_('sendMessage', { chat_id: props_().getProperty('CHAT_ID'),
    text: '🎬 ريل جديد (صف ' + row + ') بحالة "مسودة"، ومتحدد له ' + vals[RC.DATE - 1] + ':\n\nالعنوان: ' + vals[RC.TITLE - 1] + '\n\n' + reelCaption_(row),
    reply_markup: JSON.stringify({ inline_keyboard: [[{ text: '✅ خليه جاهز', callback_data: 'rdy:' + row }]] }) });
}

/* ---------- اقتراح أفكار ---------- */

// context: نص إضافي (زي كومنتات الطلاب)
function aiSuggestIdeas_(n, context, note) {
  var prompt = BRAND_VOICE + '\n\n' + templatesText_() +
    '\n\nآخر بوستات اتكتبت (ما تكررهاش):\n- ' + recentHooks_(30).join('\n- ') +
    (context ? '\n\n' + context : '') +
    '\n\nاقترح ' + n + ' أفكار بوستات جديدة ومختلفة. رجّع JSON array بس: [{"type":"...","hook":"سطر / سطر","caption":"..."}]';
  var arr = ai_([{ text: prompt }], true);
  if (!arr || !arr.length) throw new Error('Gemini ما اقترحش أفكار');
  var hooks = [];
  arr.slice(0, n).forEach(function (i) {
    if (!i.caption) return;
    addPostIdea_({ type: i.type, hook: i.hook, caption: i.caption, note: (note || 'اقتراح AI ') + cairoDate_() });
    hooks.push('• ' + (i.hook || i.type));
  });
  notify_('💡 اتضاف ' + hooks.length + ' أفكار في تاب Posts بحالة "فكرة":\n' + hooks.join('\n') + '\n\nراجعهم، وحط صورة وتاريخ للي عاجبك وخليه "جاهز".');
}

// كل أسبوع: الأسئلة اللي بتتكرر في الكومنتات ← أفكار بوستات
function ideasFromComments_() {
  var c = SpreadsheetApp.getActive().getSheetByName('Comments');
  if (!c || c.getLastRow() < 2) return;
  var texts = c.getRange(2, 1, c.getLastRow() - 1, 5).getValues()
    .filter(function (r) { return daysAgo_(r[4]) <= 7 && r[3]; }).map(function (r) { return String(r[3]).substring(0, 300); });
  if (texts.length < 5) return;
  aiSuggestIdeas_(3, 'دي كومنتات الطلاب الأسبوع ده. طلّع الأسئلة والمشاكل اللي بتتكرر وابني عليها الأفكار:\n- ' + texts.slice(0, 150).join('\n- '), 'من كومنتات الأسبوع ');
}
