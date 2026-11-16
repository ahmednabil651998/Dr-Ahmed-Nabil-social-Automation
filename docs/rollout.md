# خطوات تفعيل الإضافات (بالترتيب)

> القاعدة: **ميزة واحدة في المرة.** فعّلها، جرّبها، وبعدين اللي بعدها.
> كل ميزة بتتفعّل من تاب `Settings` (غيّر `false` لـ `true`)، وبتتقفل بنفس الطريقة لو حصلت مشكلة.
> لحد ما تغيّر أي حاجة في `Settings`، السيستم بيشتغل **بالظبط زي النهارده**.

## 0) تركيب الكود (مرة واحدة)
- **الطريقة الجديدة:** clasp + GitHub Actions (`docs/deploy.md`).
- **أو الطريقة القديمة:** في محرر Apps Script اعمل الملفات الجديدة (`Settings`، `Health`، `Instagram`، `AI`، `Analytics`، `Comments`، `Web`، `Team`)، والصق كل واحد من الريبو، وحدّث `Code.gs` و`Reels.gs`. اتأكد إن طول كل ملف زي الريبو.
- افتح الشيت (Refresh) ← **إعداد النشر ← الإضافات ← تجهيز الإضافات**. ده بيعمل التابات `Settings` و`Analytics` و`Comments` و`Templates`، وعمودين جداد في `Posts` و`Reels`.
- شغّل **فحص شامل للسيستم**. لازم يطلع كله تمام قبل ما تكمّل.

## 1) الفحص اليومي ← `HEALTH_ENABLED`
مفيش متطلبات. كل يوم الساعة 10 يجيلك سطر "كله تمام"، أو قايمة بالمشاكل. وتقدر تبعت `/health` في أي وقت.

## 2) الأرقام ← `ANALYTICS_ENABLED`
- شغّل **تحديث الأرقام دلوقتي** وشوف تاب Analytics.
- لو عمود المشاهدات فضل فاضي لبوستات فيسبوك: فيسبوك غيّر اسم المقياس. جرّب تحط `post_media_view` في `FB_VIEWS_METRIC`.
- لو فيسبوك رجّع خطأ صلاحيات: التوكن محتاج `read_insights` (شوف "صلاحيات فيسبوك" تحت).

## 3) التقرير الأسبوعي ← `REPORT_ENABLED`
كل جمعة الساعة 12. جرّبه بـ `/report`.

## 4) الذكاء الاصطناعي ← `AI_ENABLED`
1. اعمل مفتاح Gemini مجاني من https://aistudio.google.com ← Get API key.
2. Apps Script ← Project Settings ← Script Properties ← أضف `GEMINI_API_KEY`.
3. فعّل `AI_ENABLED` وجرّب:
   - `/idea طالب بيذاكر ومش فاكر حاجة` ← بوست جديد بحالة "فكرة".
   - فويس فيه فكرة ← نفس النتيجة.
   - فيديو ريل (أقل من 20 ميجا) ← ريل "مسودة" + زرار "✅ خليه جاهز".
> ملحوظة: في الحد المجاني، جوجل ممكن تستخدم اللي بتبعته لـ Gemini في تحسين منتجاتها. ما تبعتش بيانات طلاب شخصية.

## 5) إنستجرام ← `IG_ENABLED` ثم `IG_REELS_ENABLED`
1. حساب إنستجرام لازم يكون **Business أو Creator**، ومتربط بصفحة فيسبوك (من إعدادات الصفحة ← Linked accounts).
2. في أبّ Meta (`Chemistry Magician Page Poster`) ضيف منتج **Instagram** لو مش موجود.
3. اعمل توكن جديد من Graph API Explorer بالصلاحيات اللي تحت، وشغّل **2) ربط فيسبوك** تاني.
4. **الإضافات ← ربط إنستجرام**: لازم يطلع اسم الحساب.
5. فعّل `IG_ENABLED`، واستنى بوست بكرة (أو `/post`). لو إنستجرام فشل، فيسبوك بيفضل منشور ويجيلك زرار "🔁 أعد إنستجرام بس".
6. بعد ما الصور تشتغل، فعّل `IG_REELS_ENABLED`.
> إنستجرام بيقبل الصور من 4:5 لحد 1.91:1 بس. لو صورة البوست أعرض من كده هيرفضها.

## 6) الكومنتات ← `COMMENTS_ENABLED`
محتاج صلاحية `pages_manage_engagement` و `pages_read_user_content`. كل ساعة بيجيلك لحد 5 كومنتات، وكل واحد معاه رد مقترح: ✅ ابعت / ✏️ اكتب رد / 🙈 تجاهل.
بعدها تقدر تفعّل `IDEAS_FROM_COMMENTS` (كل جمعة).

## 7) إعادة نشر الناجح ← `RECYCLE_ENABLED`
محتاج تاب Analytics يكون فيه 5 بوستات على الأقل. بيختار من أعلى 20%، اللي عدّى عليهم 90 يوم، بوست واحد في الأسبوع. الصف الجديد بيتبعت للموافقة عادي.

## 8) تيك توك ← `TIKTOK_HELPER`
بعد ما أي ريل يتنشر، البوت يبعتلك الفيديو والكابشن جاهزين، فتنشره من التطبيق في أقل من دقيقة.
**النشر الأوتوماتيك:** محتاج أبّ على https://developers.tiktok.com فيه Content Posting API، ولينك سياسة الخصوصية (نفس Google Doc بتاع Meta)، ومراجعة من تيك توك. لحد ما المراجعة تتقبل، أي فيديو من الـ API بيتنشر Private بس.

## 9) الداش بورد والـ Webhook
1. Apps Script ← Deploy ← New deployment ← النوع **Web app** ← Execute as: **Me** ← Who has access: **Anyone** ← Deploy. انسخ الرابط اللي آخره `/exec`.
2. **الإضافات ← رابط الداش بورد**: ده رابطك (فيه مفتاح سري، ما تشاركهوش).
3. **Webhook (اختياري):**
   - اعمل حساب مجاني على https://dash.cloudflare.com ← Workers ← Create ← الصق `cloudflare/worker.js` ← Deploy.
   - من الشيت: **تفعيل Webhook** ← الصق رابط `/exec` ورابط الـ Worker.
   - حط القيمتين اللي هيظهروا في الـ Worker (Settings ← Variables، كـ Secret).
   - غيّر `TG_MODE` لـ `webhook`، وجرّب `/help`: لازم الرد يوصل في ثانية.
   - للرجوع: **إلغاء Webhook** + `TG_MODE = polling`.
> لو غيّرت الكود بعدين، اعمل **Manage deployments ← Edit ← New version**، عشان الـ Web App ياخد الكود الجديد.

## 10) الفريق
1. لو Claude بيوافق من حساب تاني (زي 998): أضف Script Property اسمها `APPROVER_EMAILS` وقيمتها الإيميل ده، **قبل** الخطوة الجاية، وإلا موافقة Claude هتتمنع.
2. **الإضافات ← إضافة عضو للفريق** ← إيميل مريم.

## صلاحيات فيسبوك (للتوكن الجديد)
لما تعمل التوكن من Graph API Explorer، اختار:
`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `business_management`

وبعدين **2) ربط فيسبوك** تاني. توكن الصفحة الجديد بيفضل دائم زي القديم.
