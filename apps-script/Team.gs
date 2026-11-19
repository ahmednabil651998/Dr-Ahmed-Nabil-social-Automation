/**
 * الفريق (زي مريم): عضو الفريق يقدر يضيف أفكار ويكتب كابشنات في الشيت،
 * بس عمود "الحالة" وتاب Settings محميين ليك انت بس. يعني محدش غيرك يقدر يحط "تمت الموافقة" فيتنشر حاجة.
 * الموافقة نفسها بتفضل من تيليجرام بتاعك أو من Claude بس.
 */

function addTeamMember() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('إضافة عضو للفريق', 'اكتب الإيميل (Gmail):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var email = r.getResponseText().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { ui.alert('الإيميل مش مظبوط.'); return; }
  var ss = SpreadsheetApp.getActive();
  ss.addEditor(email);
  protectForOwner_();
  ui.alert('تم ✅\n' + email + ' يقدر يعدّل الشيت دلوقتي، بس عمود "الحالة" في Posts و Reels، وتابات Settings و Comments، محميين ليك انت بس.\n' +
    'ملحوظة: الكابشن اللي اتوافق عليه ممكن يتعدل بعد الموافقة، فخلّي الفريق يشتغل على صفوف "فكرة" و"مسودة" بس.');
}

// بيحمي أعمدة الحالة والتابات الحساسة (آمن لو اتشغل أكتر من مرة)
function protectForOwner_() {
  var ss = SpreadsheetApp.getActive(), me = Session.getEffectiveUser();
  // حسابات تانية ليها حق الموافقة (زي حسابك التاني اللي Claude بيعدّل بيه الشيت): Script Property اسمها APPROVER_EMAILS، مفصولة بفاصلة
  var allowed = [me.getEmail()].concat(String(props_().getProperty('APPROVER_EMAILS') || '').split(',')
    .map(function (x) { return x.trim(); }).filter(function (x) { return x; }));
  var lock = function (range, label) {
    ss.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { if (p.getDescription() === label) p.remove(); });
    var pr = range.protect().setDescription(label);
    pr.addEditors(allowed);
    pr.removeEditors(pr.getEditors().filter(function (u) { return allowed.indexOf(u.getEmail()) === -1; }));
    if (pr.canDomainEdit()) pr.setDomainEdit(false);
  };
  lock(sheet_().getRange(1, C.STATUS, sheet_().getMaxRows(), 1), 'حالة البوستات - د. أحمد بس');
  var rs = rsheet_();
  if (rs) lock(rs.getRange(1, RC.STATUS, rs.getMaxRows(), 1), 'حالة الريلز - د. أحمد بس');
  ['Settings', 'Comments'].forEach(function (n) {
    var t = ss.getSheetByName(n);
    if (t) lock(t.getRange(1, 1, t.getMaxRows(), t.getMaxColumns()), n + ' - د. أحمد بس');
  });
}
