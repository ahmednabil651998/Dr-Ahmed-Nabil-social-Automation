/**
 * Learning.gs — نتعلم من تعديلات د. أحمد (الفكرة 1 في docs/similar-repos.md).
 *
 * بيعمل إيه: كل ما د. أحمد يعدّل كابشن بوست أو ريل من تيليجرام، بنسجّل الكابشن قبل وبعد
 * في تاب Edits. مهمة Claude الأسبوعية «مراجعة الأسبوع» بتقرا التاب ده وتطلّع قواعد أسلوب
 * تتعرض على د. أحمد (التفاصيل في instructions/edit-learning.md).
 *
 * الأمان:
 * - الدالة الوحيدة اللي بتتنده من برا هي lnLogEdit_، ومكانها في Code.gs و Reels.gs محمي بـ typeof،
 *   فلو الملف ده مش موجود التعديل نفسه بيشتغل عادي.
 * - بتتنده **بعد** ما الكابشن الجديد يتحفظ، وأي خطأ هنا بيتمسك جوه الدالة، فعمره ما يوقف
 *   حفظ التعديل ولا إرساله للموافقة.
 * - بتضيف صف في تاب Edits بس (appendRow، فمش بتكتب فوق صف موجود حتى لو مهمة Claude بتضيف
 *   صف في نفس اللحظة)، وبتعمل التاب لو مش موجود. مفيش Triggers ولا Script Properties.
 * - كل الأسماء بتبدأ بـ ln أو LN_ عشان ما تتعارضش مع الملفات التانية.
 */

var LN_SHEET = 'Edits';
var LN_HEADERS = ['الوقت', 'النوع', 'الرقم', 'من فين', 'قبل التعديل', 'بعد التعديل', 'اتراجع'];

// kind: 'بوست' أو 'ريل'. source: 'تيليجرام' أو 'Claude'.
function lnLogEdit_(kind, num, before, after, source) {
  try {
    before = String(before || '');
    after = String(after || '');
    if (lnNorm_(before) === lnNorm_(after)) return; // مفيش تغيير حقيقي
    lnSheet_().appendRow([Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), lnText_(kind), lnText_(num),
      lnText_(source || 'تيليجرام'), lnText_(before), lnText_(after), '']);
  } catch (e) {
    try { notify_('⚠️ التعديل اتحفظ عادي، بس ما اتسجلش في تاب Edits: ' + e.message); } catch (e2) {}
  }
}

function lnNorm_(t) { return String(t).replace(/\s+/g, ' ').trim(); }

// كابشن بيبدأ بـ = أو + أو - أو @ ممكن الشيت يقراه معادلة، فبنكتبه نص صريح.
function lnText_(v) {
  var t = String(v === null || v === undefined ? '' : v);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function lnSheet_() {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(LN_SHEET);
  if (!s) {
    s = ss.insertSheet(LN_SHEET);
    s.getRange(1, 1, 1, LN_HEADERS.length).setValues([LN_HEADERS]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}
