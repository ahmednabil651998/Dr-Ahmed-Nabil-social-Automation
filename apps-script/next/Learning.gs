/**
 * Learning.gs — نتعلم من تعديلات د. أحمد (الفكرة 1 في docs/similar-repos.md).
 *
 * بيعمل إيه: كل ما د. أحمد يعدّل كابشن بوست أو ريل من تيليجرام، بنسجّل الكابشن قبل وبعد
 * في تاب Edits. مهمة Claude الأسبوعية "التعلم من تعديلاتك" بتقرا التاب ده وتطلّع قواعد
 * أسلوب تتعرض على د. أحمد (التفاصيل في instructions/edit-learning.md).
 *
 * الأمان:
 * - الدالة الوحيدة اللي بتتنده من برا هي lnLogEdit_، ومكانها في Code.gs و Reels.gs
 *   محمي بـ typeof، فلو الملف ده اتمسح التعديل نفسه بيشتغل عادي.
 * - أي خطأ هنا بيتمسك جوه الدالة، فعمره ما يوقف حفظ التعديل ولا إرساله للموافقة.
 * - بيكتب في تاب Edits بس (وبيعمله لو مش موجود). مفيش Triggers ولا Script Properties.
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
    var s = lnSheet_();
    var row = s.getLastRow() + 1;
    s.getRange(row, 1, 1, LN_HEADERS.length)
      .setNumberFormat('@') // نص عادي، عشان أي كابشن يبدأ بـ = أو + ما يتقريش كمعادلة
      .setValues([[Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), kind, String(num || ''),
        source || 'تيليجرام', before, after, '']]);
  } catch (e) {
    try { notify_('⚠️ التعديل اتحفظ عادي، بس ما اتسجلش في تاب Edits: ' + e.message); } catch (e2) {}
  }
}

function lnNorm_(t) { return String(t).replace(/\s+/g, ' ').trim(); }

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
