/**
 * صورة البوست أوتوماتيك — ببلاش:
 * 1) Claude بيكتب "برومبت الصورة" (مشهد من غير أي كتابة) في عمود M.
 * 2) Cloudflare Workers AI (موديل FLUX.1 schnell، حد مجاني كل يوم) بيرسم الخلفية.
 * 3) قالب Google Slides بتاعك: الخلفية بتتحط ورا كل حاجة، والهوك بيتكتب بالعربي كنص حقيقي مكان {{HOOK1}} و {{HOOK2}}،
 *    وصورتك واللوجو والشريط زي ما انت مصممهم في القالب.
 * 4) الصورة بتتصدّر PNG في فولدر الصور على Drive، والـ ID بيتحط في عمود F.
 * لو Cloudflare فشل (أو الحد خلص) الصورة بتطلع بخلفية القالب نفسه، فالبوست مش بيقف.
 * محتاج في Script Properties: CF_ACCOUNT_ID و CF_API_TOKEN (شوف docs/rollout.md).
 */

var POSTS_FOLDER_ID = '1ATeQJ1NAnYZpZzddvpIJF26LAfXtPSNK'; // فولدر صور البوستات
var CF_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

/* ---------- Cloudflare ---------- */

function cfImage_(prompt) {
  var p = props_(), acc = p.getProperty('CF_ACCOUNT_ID'), tok = p.getProperty('CF_API_TOKEN');
  if (!acc || !tok) throw new Error('مفيش CF_ACCOUNT_ID أو CF_API_TOKEN في Script Properties');
  var r = UrlFetchApp.fetch('https://api.cloudflare.com/client/v4/accounts/' + acc + '/ai/run/' + CF_IMAGE_MODEL, {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok },
    payload: JSON.stringify({ prompt: String(prompt).substring(0, 2000), steps: 4 }), muteHttpExceptions: true
  });
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() === 429) throw new Error('حد Cloudflare المجاني خلص النهارده (بيتجدد 2 بالليل بتوقيت القاهرة)');
  if (!j.success || !j.result || !j.result.image) {
    throw new Error('Cloudflare: ' + (j.errors && j.errors.length ? j.errors[0].message : r.getResponseCode()));
  }
  return Utilities.newBlob(Utilities.base64Decode(j.result.image), 'image/jpeg', 'bg.jpg');
}

/* ---------- القالب ---------- */

// قالب خاص بنوع البوست (العمود D في تاب Templates)، وإلا القالب العام من Settings
function templateFor_(type) {
  var t = SpreadsheetApp.getActive().getSheetByName('Templates');
  if (t && type && t.getLastRow() > 1 && t.getLastColumn() >= 4) {
    var rows = t.getRange(2, 1, t.getLastRow() - 1, 4).getValues();
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === String(type).trim() && rows[i][3]) return String(rows[i][3]).trim();
  }
  return setting_('IMAGE_TEMPLATE_ID');
}

// بيرجّع { blob: صورة PNG، note: ملاحظة لو الخلفية فشلت }
function renderImage_(hook, prompt, type) {
  var tplId = templateFor_(type);
  if (!tplId) throw new Error('مفيش قالب صورة. شغّل "الإضافات ← اعمل قالب الصورة".');
  var parts = String(hook || '').split('/');
  var h1 = (parts[0] || '').trim(), h2 = parts.slice(1).join(' ').trim();
  var bg = null, note = '';
  if (prompt) {
    try { bg = cfImage_(prompt + ', ' + setting_('IMAGE_STYLE')); }
    catch (e) { note = '⚠️ الخلفية ما اتعملتش (' + e.message + ')، فالصورة طلعت بخلفية القالب.'; }
  }
  var copy = DriveApp.getFileById(tplId).makeCopy('tmp-post-image');
  try {
    var pres = SlidesApp.openById(copy.getId()), slide = pres.getSlides()[0];
    if (bg) {
      // الخلفية مربعة: بنكبّرها على عرض الصفحة ونوسّطها، والزيادة فوق وتحت بتتقص في التصدير
      var W = pres.getPageWidth(), H = pres.getPageHeight(), size = Math.max(W, H);
      var img = slide.insertImage(bg);
      img.setWidth(size).setHeight(size).setLeft((W - size) / 2).setTop((H - size) / 2);
      img.sendToBack();
    }
    pres.replaceAllText('{{HOOK1}}', h1);
    pres.replaceAllText('{{HOOK2}}', h2);
    pres.saveAndClose();
    var resp = UrlFetchApp.fetch('https://docs.google.com/presentation/d/' + copy.getId() + '/export/png?pageid=' + slide.getObjectId(), {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) throw new Error('تصدير الصورة من Slides فشل (' + resp.getResponseCode() + ')');
    return { blob: resp.getBlob().setContentType('image/png'), note: note };
  } finally {
    copy.setTrashed(true);
  }
}

function renderPostImage_(row) {
  var res = renderImage_(cellText_(row, C.HOOK), cellText_(row, C.IMGP), cellText_(row, C.TYPE));
  var f = DriveApp.getFolderById(POSTS_FOLDER_ID).createFile(res.blob.setName('post-' + cellText_(row, C.NUM) + '.png'));
  cell_(row, C.IMG).setValue(f.getId());
  return res.note;
}

/* ---------- من القايمة ---------- */

// بيعمل قالب مبدئي في Google Slides. بعدها افتحه وحط صورتك الباهتة واللوجو والخط اللي يعجبك.
// المهم: سيب {{HOOK1}} و {{HOOK2}} مكتوبين في المكان اللي الهوك يظهر فيه.
function createImageTemplate() {
  var ui = SpreadsheetApp.getUi();
  var pres = SlidesApp.create('قالب صورة بوست - د. أحمد نبيل');
  var slide = pres.getSlides()[0];
  slide.getPageElements().forEach(function (e) { e.remove(); });
  var W = pres.getPageWidth(), H = pres.getPageHeight();
  slide.getBackground().setSolidFill('#0B1F3A');

  var ribbon = slide.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, W * 0.08, H * 0.6, W * 0.84, H * 0.28);
  ribbon.getFill().setSolidFill('#13294B', 0.88);
  ribbon.getBorder().setTransparent();
  var hook = ribbon.getText();
  hook.setText('{{HOOK1}}\n{{HOOK2}}');
  hook.getTextStyle().setFontFamily('Cairo').setFontSize(30).setBold(true).setForegroundColor('#FFFFFF');
  hook.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER).setTextDirection(SlidesApp.TextDirection.RIGHT_TO_LEFT);
  ribbon.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);

  var logo = slide.insertTextBox('Dr Ahmed Nabil\nThe Chemistry Magician', W * 0.03, H * 0.04, W * 0.4, H * 0.14);
  logo.getText().getTextStyle().setFontFamily('Montserrat').setFontSize(13).setBold(true).setForegroundColor('#E8B84A');
  pres.saveAndClose();

  // نسجّل الـ ID في تاب Settings
  var st = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET), saved = false;
  if (st && st.getLastRow() > 1) {
    var keys = st.getRange(2, 1, st.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) if (keys[i][0] === 'IMAGE_TEMPLATE_ID') { st.getRange(i + 2, 2).setNumberFormat('@').setValue(pres.getId()); saved = true; }
  }
  SETTINGS_CACHE_ = null;
  ui.alert('القالب اتعمل ✅' + (saved ? '' : ' (شغّل "تجهيز الإضافات" الأول عشان الـ ID يتسجل في Settings)') +
    '\n\nافتحه وظبّطه:\nhttps://docs.google.com/presentation/d/' + pres.getId() + '/edit\n\n' +
    '• حط صورتك (Format options ← Adjustments ← Transparency عشان تبقى باهتة) واللوجو.\n' +
    '• غيّر الألوان والخط زي ما تحب.\n• سيب {{HOOK1}} و {{HOOK2}} مكتوبين مكان الهوك.\n' +
    '• أي صورة خلفية بتيجي من Cloudflare بتتحط ورا كل حاجة، فخلي الشريط والكلام فوقها واضحين.\n\nوبعدها جرّب "تجربة صورة".');
}

// بتعمل صورة تجربة وتبعتها على تيليجرام، من غير ما تلمس الشيت
function testPostImage() {
  var ui = SpreadsheetApp.getUi();
  try {
    var res = renderImage_('خطوة صغيرة كل يوم / توصلك بعيد',
      'a determined Egyptian high school student studying chemistry at a desk at night, glowing lab flasks, warm lamp light', '');
    tgPhoto_(props_().getProperty('CHAT_ID'), res.blob, '🖼 صورة تجربة' + (res.note ? '\n' + res.note : ''), null);
    ui.alert('الصورة اتبعتت على تيليجرام ✅' + (res.note ? '\n' + res.note : ''));
  } catch (e) {
    ui.alert('التجربة فشلت ❌\n' + e.message);
  }
}
