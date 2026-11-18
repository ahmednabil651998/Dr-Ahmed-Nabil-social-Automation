/**
 * Snapshots.gs — المرحلة A2: لقطة ثابتة لأرقام كل بوست وريل بعد 48 ساعة وبعد 7 أيام.
 *
 * ليه: تاب Analytics بيتكتب فوقه كل يوم، فمفيش مقارنة عادلة بين بوست عمره يومين وبوست عمره شهر.
 * هنا كل عنصر بياخد صفين بس في تاب Snapshots، وبعد ما الصف يتكتب ما بيتغيرش تاني.
 *
 * بيشتغل إزاي:
 * - snapshotsJob_ بتتنده كل ساعة من dailyJob (Code.gs)، ومحمية بـ typeof هناك.
 * - بتقرا العناصر من تاب Analytics (المنصة، الـ ID، وقت النشر). أول ما عنصر يعدّي 48 ساعة أو 7 أيام
 *   ومالوش لقطة، بتجيب أرقامه دلوقتي بنفس دوال Analytics.gs وتكتب صف جديد. يعني اللقطة متأخرة ساعة بالكتير.
 * - معدل التفاعل = (ريأكشنز + كومنتات + شير) ÷ الوصول، معادلة في الشيت، مش بالكود.
 * - لو الأرقام ما جاتش (مقياس اترفض أو التوكن)، بتحاول تاني كل ساعة لمدة 24 ساعة. بعدها بتكتب الصف
 *   فاضي ومعاه "ما قدرناش نجيب الأرقام"، عشان ما تفضلش تحاول على طول.
 * - العناصر اللي عدّى ميعادها بأكتر من 48 ساعة (زي البوستات القديمة وقت تفعيل الميزة) ما بتاخدش لقطة،
 *   عشان أرقام بوست عمره شهر ما تتكتبش على إنها "48 ساعة".
 *
 * الأمان: بتكتب في تاب Snapshots بس (وبتعمله لو مش موجود). مفيش Triggers ولا Script Properties.
 * بتشتغل بس لو SNAPSHOTS_ENABLED = true في تاب Settings. كل الأسماء بتبدأ بـ sn أو SN_.
 */

var SN_SHEET = 'Snapshots';
var SN_HEADERS = ['المنصة', 'النوع', 'رقم', 'ID', 'اللقطة', 'وقت اللقطة', 'ساعات من النشر',
  'ريأكشنز/لايكات', 'كومنتات', 'شير', 'الوصول/المشاهدات', 'متابعين الصفحة', 'معدل التفاعل', 'ملاحظة'];
var SN_POINTS = [[48, '48 ساعة'], [168, '7 أيام']];
var SN_GIVE_UP_HOURS = 24;
var SN_MAX_PER_RUN = 10; // عشان حد الـ 6 دقايق

function snapshotsJob_() {
  if (!on_('SNAPSHOTS_ENABLED')) return 0;
  var a = asheet_();
  if (!a || a.getLastRow() < 2) return 0;
  var s = snSheet_();
  var done = {};
  if (s.getLastRow() > 1) {
    s.getRange(2, 1, s.getLastRow() - 1, 5).getValues().forEach(function (v) { done[v[0] + '|' + v[3] + '|' + v[4]] = true; });
  }
  var rows = a.getRange(2, 1, a.getLastRow() - 1, AC.VIEWS).getValues();
  var now = new Date(), written = 0, followers = null;
  for (var i = 0; i < rows.length && written < SN_MAX_PER_RUN; i++) {
    var it = { platform: String(rows[i][AC.PLATFORM - 1]), kind: String(rows[i][AC.KIND - 1]), num: String(rows[i][AC.NUM - 1]),
      id: String(rows[i][AC.ID - 1]), link: String(rows[i][AC.LINK - 1]) };
    var published = snParse_(rows[i][AC.DATE - 1]);
    if (!it.id || !published) continue;
    var age = (now.getTime() - published.getTime()) / 3600000;
    for (var p = 0; p < SN_POINTS.length; p++) {
      var hours = SN_POINTS[p][0], label = SN_POINTS[p][1];
      if (age < hours || done[it.platform + '|' + it.id + '|' + label]) continue;
      if (age > hours + 2 * SN_GIVE_UP_HOURS) continue; // عنصر قديم (الميزة اتفعّلت بعد ميعاده): مفيش لقطة بأرقام مش في وقتها
      var st = age <= hours + SN_GIVE_UP_HOURS ? snFetch_(it) : null;
      if (!st && age <= hours + SN_GIVE_UP_HOURS) continue; // نحاول تاني الساعة الجاية
      if (followers === null) followers = snFollowers_();
      snWrite_(s, it, label, Math.round(age), st, followers);
      done[it.platform + '|' + it.id + '|' + label] = true;
      written++;
    }
  }
  return written;
}

// بيرجع الأرقام دلوقتي لعنصر واحد، أو null لو ما جاتش.
function snFetch_(it) {
  var st = null;
  if (it.platform === 'فيسبوك' && it.kind === 'بوست') st = fbPostStats_(it.id, it.num);
  else if (it.platform === 'فيسبوك') st = fbReelStats_(it.id, it.num);
  else if (it.platform === 'يوتيوب') { var o = {}; o[it.id] = it.num; st = ytStats_([it.id], o)[0]; }
  else if (it.platform === 'إنستجرام') st = igStats_(it.link, it.kind, it.num);
  if (!st || (st.likes === '' && st.views === '')) return null;
  return st;
}

function snFollowers_() {
  return safe_(function () { return graphGet_(PAGE_ID + '?fields=followers_count').followers_count; }) || '';
}

function snWrite_(s, it, label, ageHours, st, followers) {
  var row = s.getLastRow() + 1;
  var v = st || { likes: '', comments: '', shares: '', views: '' };
  s.getRange(row, 1, 1, 12).setValues([[it.platform, it.kind, it.num, it.id, label,
    Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), ageHours,
    v.likes, v.comments, v.shares, v.views, it.platform === 'فيسبوك' ? followers : '']]);
  s.getRange(row, 4).setNumberFormat('@').setValue(it.id); // الـ ID رقم طويل، لازم يفضل نص
  s.getRange(row, 13).setFormula('=IF(N(K' + row + ')>0,(N(H' + row + ')+N(I' + row + ')+N(J' + row + '))/K' + row + ',"")')
    .setNumberFormat('0.0%');
  s.getRange(row, 14).setValue(st ? '' : 'ما قدرناش نجيب الأرقام');
}

// وقت النشر في Analytics بيتكتب "yyyy-MM-dd HH:mm" بتوقيت القاهرة، والشيت ممكن يحوله لتاريخ.
function snParse_(v) {
  if (v instanceof Date) return v;
  var t = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return null;
  if (t.length === 10) t += ' 00:00';
  try { return Utilities.parseDate(t.substring(0, 16), TZ, 'yyyy-MM-dd HH:mm'); } catch (e) { return null; }
}

function snSheet_() {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(SN_SHEET);
  if (!s) {
    s = ss.insertSheet(SN_SHEET);
    s.getRange(1, 1, 1, SN_HEADERS.length).setValues([SN_HEADERS]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

// تشغيل يدوي من المحرر للتجربة: بيكتب اللقطات المستحقة دلوقتي ويقولك عددها على تيليجرام.
function snapshotsNow() {
  var n = snapshotsJob_();
  notify_(on_('SNAPSHOTS_ENABLED') ? '📸 لقطات الأرقام: اتكتب ' + n + ' صف في تاب Snapshots.' : 'SNAPSHOTS_ENABLED مقفولة في Settings.');
}
