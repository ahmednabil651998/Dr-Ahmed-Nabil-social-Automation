/**
 * Snapshots.gs — المرحلة A2: لقطة ثابتة لأرقام كل بوست وريل بعد 48 ساعة وبعد 7 أيام.
 *
 * ليه: تاب Analytics بيتكتب فوقه كل يوم، فمفيش مقارنة عادلة بين بوست عمره يومين وبوست عمره شهر.
 * هنا كل عنصر بياخد صفين بالكتير في تاب Snapshots، والصف بعد ما يتكتب ما بيتغيرش تاني.
 *
 * بيشتغل إزاي:
 * - snapshotsJob_ بتتنده كل ساعة من dailyJob في Code.gs، **بعد** إرسال البوست اليومي، ومحمية بـ typeof و try.
 * - بتقرا العناصر من تاب Analytics (المنصة، النوع، الـ ID، وقت النشر). أول ما عنصر يعدّي 48 ساعة أو 7 أيام
 *   ومالوش لقطة، بتجيب أرقامه دلوقتي بنفس دوال Analytics.gs وتضيف صف. يعني اللقطة بتتأخر ساعة بالكتير.
 * - لو الأرقام ما جاتش: **مفيش صف بيتكتب**. بتحاول تاني كل ساعة لمدة 24 ساعة بعد الميعاد، وبعدها بتسيب
 *   العنصر ده، وبتبعت تنبيه واحد في اليوم بعدد العناصر اللي ما اتاخدلهاش لقطة.
 * - العناصر اللي ميعادها عدّى بأكتر من 24 ساعة (زي البوستات القديمة وقت التفعيل) ما بتاخدش لقطة،
 *   عشان أرقام بوست عمره شهر ما تتكتبش على إنها "48 ساعة".
 * - معدل التفاعل = (ريأكشنز + كومنتات + شير) ÷ الرقم اللي في عمود K، معادلة في الشيت.
 *   عمود O بيقول الرقم ده إيه بالظبط، لأنه مختلف حسب المنصة (وصول، أو تشغيلات، أو مشاهدات).
 *   فالمعدل يتقارن بس بين صفوف ليها نفس المنصة ونفس النوع.
 *
 * الأمان:
 * - بتضيف صفوف في تاب Snapshots بس (appendRow)، وعمرها ما بتعدّل ولا بتمسح صف موجود.
 * - قفل المستند (Document Lock) بيمنع تشغيلين في نفس الوقت يكتبوا نفس اللقطة. القفل ده منفصل عن قفل
 *   pollTelegram (Script Lock)، فمش بيأخر النشر.
 * - بتقف بعد 5 لقطات أو 90 ثانية، اللي ييجي الأول، عشان حد الـ 6 دقايق.
 * - مفيش Triggers. الـ Script Property الوحيدة: SN_FAIL_NOTE_DATE (عشان التنبيه يتبعت مرة واحدة في اليوم).
 * - بتشتغل بس لو SNAPSHOTS_ENABLED = true في تاب Settings. كل الأسماء بتبدأ بـ sn أو SN_.
 */

var SN_SHEET = 'Snapshots';
var SN_HEADERS = ['المنصة', 'النوع', 'رقم', 'ID', 'اللقطة', 'وقت اللقطة', 'ساعات من النشر',
  'ريأكشنز/لايكات', 'كومنتات', 'شير', 'الوصول/المشاهدات', 'متابعين الصفحة', 'معدل التفاعل', 'ملاحظة', 'عمود K معناه إيه'];
var SN_POINTS = [[48, '48 ساعة'], [168, '7 أيام']];
var SN_RETRY_HOURS = 24;
var SN_MAX_PER_RUN = 5;
var SN_MAX_MS = 90000;

function snapshotsJob_() {
  if (!on_('SNAPSHOTS_ENABLED')) return 0;
  var lock = LockService.getDocumentLock(); // ممكن يرجع null لو السكريبت مش مربوط بالشيت
  if (lock && !lock.tryLock(0)) return 0; // تشغيل تاني شغال دلوقتي
  try {
    return snRun_();
  } finally {
    if (lock) lock.releaseLock();
  }
}

function snRun_() {
  var a = asheet_();
  if (!a || a.getLastRow() < 2) return 0;
  var s = snSheet_();
  var done = {};
  if (s.getLastRow() > 1) {
    s.getRange(2, 1, s.getLastRow() - 1, 5).getValues().forEach(function (v) { done[v[0] + '|' + v[3] + '|' + v[4]] = true; });
  }
  var rows = a.getRange(2, 1, a.getLastRow() - 1, AC.VIEWS).getValues();
  var started = new Date().getTime(), now = new Date(), written = 0, missed = 0, followers = null;
  for (var i = 0; i < rows.length; i++) {
    var it = { platform: String(rows[i][AC.PLATFORM - 1]), kind: String(rows[i][AC.KIND - 1]), num: String(rows[i][AC.NUM - 1]),
      id: String(rows[i][AC.ID - 1]), link: String(rows[i][AC.LINK - 1]) };
    var published = snParse_(rows[i][AC.DATE - 1]);
    if (!it.id || !published) continue;
    var age = (now.getTime() - published.getTime()) / 3600000;
    for (var p = 0; p < SN_POINTS.length; p++) {
      var hours = SN_POINTS[p][0], label = SN_POINTS[p][1], key = it.platform + '|' + it.id + '|' + label;
      if (age < hours || done[key]) continue;
      if (age > hours + SN_RETRY_HOURS) {
        if (age <= hours + 2 * SN_RETRY_HOURS) missed++; // فات ميعاده من قريب ومالوش لقطة
        continue;
      }
      if (written >= SN_MAX_PER_RUN || new Date().getTime() - started > SN_MAX_MS) return snDone_(written, missed);
      var st = snFetch_(it);
      if (!st) continue; // نحاول تاني الساعة الجاية، ومن غير صف فاضي
      if (it.platform === 'فيسبوك' && followers === null) followers = snFollowers_();
      snWrite_(s, it, label, Math.round(age), st, it.platform === 'فيسبوك' ? followers : '');
      done[key] = true;
      written++;
    }
  }
  return snDone_(written, missed);
}

function snDone_(written, missed) {
  if (missed) {
    var p = props_(), today = cairoDate_();
    if (p.getProperty('SN_FAIL_NOTE_DATE') !== today) {
      p.setProperty('SN_FAIL_NOTE_DATE', today);
      try { notify_('⚠️ لقطات الأرقام: ' + missed + ' عنصر ما اتاخدلهوش لقطة في ميعاده، لأن الأرقام ما جاتش من المنصة. ممكن يكون التوكن أو اسم المقياس (FB_VIEWS_METRIC).'); } catch (e) {}
    }
  }
  return written;
}

// بيرجع الأرقام دلوقتي لعنصر واحد، أو null لو ما جاتش. دوال Analytics.gs بترجع '' لو حصل أي خطأ.
function snFetch_(it) {
  var st = null;
  if (it.platform === 'فيسبوك' && it.kind === 'بوست') st = fbPostStats_(it.id, it.num);
  else if (it.platform === 'فيسبوك' && it.kind === 'ريل') st = fbReelStats_(it.id, it.num);
  else if (it.platform === 'يوتيوب') { var o = {}; o[it.id] = it.num; st = (ytStats_([it.id], o) || [])[0]; }
  else if (it.platform === 'إنستجرام') st = igStats_(it.link, it.kind, it.num);
  if (!st || typeof st !== 'object') return null;
  return st;
}

function snFollowers_() {
  var f = safe_(function () { return graphGet_(PAGE_ID + '?fields=followers_count').followers_count; });
  return f === undefined || f === null ? '' : f;
}

function snMetricName_(it) {
  if (it.platform === 'فيسبوك' && it.kind === 'بوست') return 'وصول: ' + setting_('FB_VIEWS_METRIC');
  if (it.platform === 'فيسبوك') return 'تشغيلات الريل: blue_reels_play_count';
  if (it.platform === 'يوتيوب') return 'مشاهدات: viewCount';
  return 'مشاهدات: views';
}

// قيم بتبدأ بـ = أو + أو - أو @ ممكن الشيت يقراها معادلة، والأرقام الطويلة (IDs) ممكن تتحول لرقم وتبوظ.
function snText_(v) {
  var t = String(v === null || v === undefined ? '' : v);
  return /^[=+\-@]/.test(t) || /^\d{6,}/.test(t) ? "'" + t : t;
}

function snWrite_(s, it, label, ageHours, st, followers) {
  var reachMissing = st.views === '' || st.views === null || st.views === undefined;
  s.appendRow([snText_(it.platform), snText_(it.kind), snText_(it.num), snText_(it.id), label,
    Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), ageHours,
    st.likes, st.comments, st.shares, reachMissing ? '' : st.views, followers, '',
    reachMissing ? 'الوصول ما جاش من المنصة، فمعدل التفاعل فاضي' : '', snMetricName_(it)]);
  var row = s.getLastRow();
  s.getRange(row, 13).setFormula('=IF(N(K' + row + ')>0,(N(H' + row + ')+N(I' + row + ')+N(J' + row + '))/K' + row + ',"")')
    .setNumberFormat('0.0%');
}

// وقت النشر في Analytics مكتوب "yyyy-MM-dd HH:mm" بتوقيت القاهرة، والشيت ممكن يحوّله لتاريخ.
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
  } else if (!String(s.getRange(1, SN_HEADERS.length).getValue())) {
    s.getRange(1, SN_HEADERS.length).setValue(SN_HEADERS[SN_HEADERS.length - 1]).setFontWeight('bold'); // عنوان عمود O بس
  }
  return s;
}

// تشغيل يدوي من المحرر للتجربة: بيكتب اللقطات المستحقة دلوقتي ويقولك عددها على تيليجرام.
function snapshotsNow() {
  var n = snapshotsJob_();
  notify_(on_('SNAPSHOTS_ENABLED') ? '📸 لقطات الأرقام: اتكتب ' + n + ' صف في تاب Snapshots.' : 'SNAPSHOTS_ENABLED مقفولة في Settings.');
}
