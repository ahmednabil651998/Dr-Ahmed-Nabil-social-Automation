/**
 * الإعدادات + تجهيز التابات الجديدة
 * كل إعداد له قيمة افتراضية هنا. لو فيه تاب اسمه "Settings" في الشيت، القيمة اللي فيه بتغلب.
 * كل الإضافات الجديدة مقفولة افتراضيًا (false)، فالسيستم بيفضل شغال زي ما هو لحد ما تفعّل الميزة من التاب.
 */

var SETTINGS_SHEET = 'Settings';

// [المفتاح, القيمة الافتراضية, الشرح]
var SETTINGS_LIST = [
  ['SEND_HOUR', '17', 'ساعة إرسال بوست النهارده للموافقة (0-23 بتوقيت القاهرة)'],
  ['REEL_SEND_HOUR', '19', 'ساعة إرسال ريل النهارده للموافقة'],
  ['LOW_READY_ALERT', '2', 'لما البوستات الجاهزة تقل عن الرقم ده يجيلك تنبيه'],
  ['TG_MODE', 'polling', 'polling = السيستم يسأل تيليجرام كل دقيقة، webhook = تيليجرام يبعت لحظيًا (محتاج Cloudflare Worker)'],
  ['HEALTH_ENABLED', 'false', 'فحص يومي للتوكنز والتريجرز والمحتوى الجاهز'],
  ['HEALTH_HOUR', '10', 'ساعة الفحص اليومي'],
  ['IG_ENABLED', 'false', 'نشر البوستات على إنستجرام بعد فيسبوك'],
  ['IG_REELS_ENABLED', 'false', 'نشر الريلز على إنستجرام'],
  ['IG_STORY_REELS', 'false', 'نشر الريل كمان كستوري على إنستجرام'],
  ['TIKTOK_HELPER', 'false', 'بعد نشر الريل يبعتلك الفيديو والكابشن جاهزين لتيك توك'],
  ['AI_ENABLED', 'false', 'Gemini (ببلاش): يسمع الفويس والريلز ويحوّلهم نص، ويقترح ردود الكومنتات'],
  ['AI_MODEL', 'gemini-2.5-flash', 'اسم موديل Gemini'],
  ['CLAUDE_WRITER_ENABLED', 'false', 'مهمة Claude المجدولة تكتب البوستات والريلز اللي حالتها "اكتبها" (من اشتراكك)'],
  ['CLAUDE_TIMES', '10:43 الصبح و 8:43 بالليل', 'مواعيد مهمة Claude (للعرض بس، الميعاد نفسه بيتغير من المهمة)'],
  ['IMAGES_ENABLED', 'false', 'صورة البوست تتعمل لوحدها: خلفية من Cloudflare + الهوك بالعربي من قالب Slides'],
  ['IMAGE_TEMPLATE_ID', '', 'ID قالب Google Slides (بيتملى لوحده من "اعمل قالب الصورة")'],
  ['IMAGE_STYLE', 'cinematic soft lighting, deep navy and warm gold tones, clean background, high detail, no text, no letters, no words, no logos', 'الستايل اللي بيتضاف لكل برومبت صورة'],
  ['ANALYTICS_ENABLED', 'false', 'سحب أرقام البوستات والريلز كل يوم لتاب Analytics'],
  ['ANALYTICS_HOUR', '3', 'ساعة سحب الأرقام'],
  ['ANALYTICS_DAYS', '60', 'نحدّث أرقام اللي اتنشر في آخر كام يوم'],
  ['FB_VIEWS_METRIC', 'post_impressions_unique', 'اسم مقياس الوصول في فيسبوك (لو فيسبوك غيّره بنغيره من هنا)'],
  ['REPORT_ENABLED', 'false', 'تقرير أسبوعي على تيليجرام: أحسن 3 وأضعف 3 + أحسن ميعاد'],
  ['REPORT_DAY', '5', 'يوم التقرير (1 = الاتنين ... 5 = الجمعة ... 7 = الحد)'],
  ['REPORT_HOUR', '12', 'ساعة التقرير'],
  ['RECYCLE_ENABLED', 'false', 'إعادة نشر البوستات الناجحة (بتتبعت للموافقة زي أي بوست)'],
  ['RECYCLE_DAYS', '90', 'أقل عدد أيام قبل ما البوست يتعاد'],
  ['RECYCLE_PER_WEEK', '1', 'كام بوست يتعاد في الأسبوع بالكتير'],
  ['COMMENTS_ENABLED', 'false', 'اقتراح ردود على الكومنتات والموافقة عليها من تيليجرام'],
  ['COMMENTS_DAYS', '14', 'نتابع كومنتات اللي اتنشر في آخر كام يوم'],
  ['COMMENTS_PER_RUN', '5', 'أقصى عدد كومنتات تتبعت لك كل ساعة'],
  ['IDEAS_FROM_COMMENTS', 'false', 'كل جمعة: مهمة Claude تطلّع من كومنتات الأسبوع الأسئلة المتكررة وتكتب منها أفكار بوستات']
];

var SETTINGS_CACHE_ = null;

function settings_() {
  if (SETTINGS_CACHE_) return SETTINGS_CACHE_;
  var m = {};
  SETTINGS_LIST.forEach(function (s) { m[s[0]] = s[1]; });
  var sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0] || '').trim();
      if (k) m[k] = String(r[1] === null ? '' : r[1]).trim();
    });
  }
  SETTINGS_CACHE_ = m;
  return m;
}

function setting_(key) { var v = settings_()[key]; return v === undefined ? '' : v; }
function num_(key) { return Number(setting_(key)); }
function on_(key) { var v = String(setting_(key)).toLowerCase(); return v === 'true' || v === 'yes' || v === '1' || v === 'نعم'; }

/* ---------- تجهيز التابات الجديدة (مرة واحدة، وآمن لو اتشغل تاني) ---------- */

var EXTRA_TABS = {
  Settings: ['المفتاح', 'القيمة', 'الشرح'],
  Analytics: ['المنصة', 'النوع', 'رقم', 'ID', 'الرابط', 'تاريخ النشر', 'آخر تحديث', 'لايكات/ريأكشنز', 'كومنتات', 'شير', 'مشاهدات/وصول', 'التفاعل'],
  Comments: ['ID الكومنت', 'ID البوست', 'الاسم', 'الكومنت', 'التاريخ', 'الرد المقترح', 'الحالة', 'رسالة تيليجرام'],
  Templates: ['النوع', 'شكل البوست (لـ Claude)', 'هاشتاجات إضافية (اختياري)', 'ID قالب Slides للنوع ده (اختياري)']
};

function setupExtras() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(EXTRA_TABS).forEach(function (name) {
    var s = ss.getSheetByName(name) || ss.insertSheet(name);
    var h = EXTRA_TABS[name];
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    s.setFrozenRows(1);
    s.setRightToLeft(true);
  });
  // الـ IDs الطويلة لازم تفضل نص، وإلا الشيت بيقرّبها ويبوّظها
  ss.getSheetByName('Analytics').getRange('D:D').setNumberFormat('@');
  ss.getSheetByName('Comments').getRange('A:B').setNumberFormat('@');
  // الإعدادات: نضيف بس المفاتيح الناقصة، وما نلمسش اللي انت غيّرته
  var st = ss.getSheetByName(SETTINGS_SHEET), have = {};
  if (st.getLastRow() > 1) st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().forEach(function (r) { have[r[0]] = 1; });
  var add = SETTINGS_LIST.filter(function (s) { return !have[s[0]]; });
  if (add.length) st.getRange(st.getLastRow() + 1, 1, add.length, 3).setNumberFormat('@').setValues(add);
  // القوالب: أنواع البوستات من دليل الأفكار
  var tp = ss.getSheetByName('Templates');
  if (tp.getLastRow() < 2) {
    tp.getRange(2, 1, 4, 3).setValues([
      ['تحفيز', 'هوك قصير من سطرين، بعده نص طويل محفّز بالعامية المصرية، ونصايح مذاكرة عملية، وسطر تفاعل في الآخر', ''],
      ['نصيحة مذاكرة', 'هوك سؤال، بعده خطوات مرقّمة قصيرة، وسؤال للمتابعين في الآخر', ''],
      ['معلومة كيمياء', 'هوك "تعرف إن...؟"، بعده المعلومة ببساطة ومثال من المنهج، وسؤال صغير يختبر الطالب', ''],
      ['سؤال امتحان', 'سؤال اختيار من متعدد من منهج تالتة ثانوي، والإجابة في أول كومنت', '']
    ]);
  }
  // أعمدة جديدة في Posts و Reels
  var ps = ss.getSheetByName(SHEET_NAME);
  ps.getRange(1, C.IG).setValue('رابط إنستجرام').setFontWeight('bold');
  ps.getRange(1, C.TYPE).setValue('النوع').setFontWeight('bold');
  ps.getRange(1, C.REQ).setValue('الطلب لـ Claude').setFontWeight('bold');
  ps.getRange(1, C.IMGP).setValue('برومبت الصورة').setFontWeight('bold');
  var rs = ss.getSheetByName(REELS_SHEET);
  if (rs) {
    rs.getRange(1, RC.IG).setValue('رابط إنستجرام').setFontWeight('bold');
    rs.getRange(1, RC.REQ).setValue('الطلب لـ Claude').setFontWeight('bold');
  }
  SETTINGS_CACHE_ = null;
  SpreadsheetApp.getUi().alert('الإضافات اتجهزت ✅\nكل الميزات الجديدة مقفولة. فعّل اللي انت عاوزه من تاب Settings (غيّر false لـ true).');
}

/* ---------- أدوات مشتركة ---------- */

// أول تاريخ فاضي بعد آخر تاريخ مستخدم في عمود (عشان المحتوى الجديد ما يتزاحمش مع المجدول)
function nextFreeDate_(sheet, col) {
  var today = cairoDate_(), maxD = today;
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var d = String(r[0] || '').replace(/^'/, '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > maxD) maxD = d;
    });
  }
  var x = new Date(maxD + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + 1);
  return Utilities.formatDate(x, 'UTC', 'yyyy-MM-dd');
}

function nextNum_(sheet) {
  var mx = 0;
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) { var n = Number(r[0]); if (n > mx) mx = n; });
  }
  return mx + 1;
}

function daysAgo_(dateStr) {
  if (!dateStr) return 99999;
  var d = new Date(String(dateStr).substring(0, 10) + 'T12:00:00Z');
  if (isNaN(d.getTime())) return 99999;
  return Math.floor((new Date().getTime() - d.getTime()) / 86400000);
}

function esc_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// الشغل الإضافي اللي بيتنده كل ساعة من dailyJob. كل حاجة لوحدها في try عشان عطل واحد ما يوقفش الباقي.
function extrasHourly_(now) {
  var h = Number(Utilities.formatDate(now, TZ, 'H'));
  var day = Number(Utilities.formatDate(now, TZ, 'u'));
  var jobs = [
    ['الفحص اليومي', function () { if (on_('HEALTH_ENABLED') && h === num_('HEALTH_HOUR')) runHealth_(false); }],
    ['الأرقام', function () { if (on_('ANALYTICS_ENABLED') && h === num_('ANALYTICS_HOUR')) collectAnalytics_(); }],
    ['الكومنتات', function () { if (on_('COMMENTS_ENABLED')) commentsJob_(); }],
    ['التقرير الأسبوعي', function () {
      if (day !== num_('REPORT_DAY') || h !== num_('REPORT_HOUR')) return;
      var wk = Utilities.formatDate(now, TZ, 'yyyy-ww');
      if (props_().getProperty('LAST_WEEKLY') === wk) return;
      props_().setProperty('LAST_WEEKLY', wk);
      if (on_('REPORT_ENABLED')) weeklyReport_();
      if (on_('RECYCLE_ENABLED')) recycleJob_();
    }],
    ['تجهيز اللي Claude كتبه', function () { writtenJob_(); }]
  ];
  jobs.forEach(function (j) {
    try { j[1](); } catch (e) { notify_('❌ خطأ في ' + j[0] + ': ' + e.message); }
  });
}
