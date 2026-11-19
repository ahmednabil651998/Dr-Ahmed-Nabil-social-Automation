# إنستجرام — الوضع الحالي (2026-11-19)

> ✅ **2026-11-19: التوكن الجديد (11 صلاحية) اتعمل، و«ربط إنستجرام» نجح: @dr.ahmednabil_chemistry، 834 متابع. فاضل التفعيل بس (خطوة 5 و6 تحت).**
>
> الحالة القديمة: **نص الطريق.** الكود جاهز ومتركّب، وأبّ Meta اتجهّز. فاضل توكن جديد فيه صلاحيات إنستجرام، وبعده التفعيل.
> أي جلسة Claude جاية تبدأ من «الخطوة الجاية» تحت لما د. أحمد يقول «أنا على الكمبيوتر».

## الحساب
- حساب إنستجرام: **@dr.ahmednabil_chemistry**، نوعه **Professional**.
- متربط بصفحة فيسبوك (اتأكدنا من إعدادات الصفحة ← Linked accounts) — 2026-11-19.

## الكود
- `Instagram.gs` موجود في فرع `feature/system-upgrade` (طلب الدمج 10)، ومتركّب فعلًا في Apps Script من 2026-11-17. **مش موجود في `main`** لسه.
- بينشر بوست الصورة اليومي (`igPublishPhoto_`) والريلز (`igPublishReel_`)، وستوري اختياري (`IG_STORY_REELS`).
- لو إنستجرام فشل، فيسبوك بيفضل منشور، وبيجي زرار «🔁 أعد إنستجرام بس».
- الريل لو إنستجرام لسه بيعالجه بيتكمّل في الدقيقة اللي بعدها (`igFinishPending_` من `pollTelegram`).
- بيستخدم نفس توكن الصفحة (`FB_PAGE_TOKEN`)، و`IG_USER_ID` بيتحفظ لوحده أول مرة.

## اللي اتعمل في أبّ Meta (2026-11-19، من Claude in Chrome)
- أبّ `Chemistry Magician Page Poster` (ID `1156816820230277`)، حالته **منشور (Live)**.
- اتضافت حالة استخدام **«إدارة المراسلة والمحتوى على Instagram»** (`INSTAGRAM_BUSINESS`، نسخة تسجيل الدخول بفيسبوك).
- اتضاف فيها: `instagram_basic`، `instagram_content_publish`، `instagram_manage_insights` (حالتهم «جاهز للاختبار»، وده كفاية لحساباتنا لأن د. أحمد أدمن على الأبّ).
- في Graph API Explorer اتعلّم 7 صلاحيات: `pages_show_list`، `pages_read_engagement`، `pages_manage_posts`، `instagram_basic`، `instagram_content_publish`، `instagram_manage_insights`، `business_management`.
- **الرد على الكومنتات (طلب د. أحمد 2026-11-19):** اتضاف لحالة استخدام الصفحة («إدارة كل شيء على صفحتك»): `pages_manage_engagement`، `pages_read_user_content`، `read_insights` (حالتهم «جاهز للاختبار»).
  - في Graph API Explorer لازم يتعلّموا كمان مع الـ 7 اللي فوق، عشان **توكن واحد** يشغّل إنستجرام والكومنتات مع بعض (10 صلاحيات).
  - بعد «ربط فيسبوك»: `COMMENTS_ENABLED` في Settings، وجرّب. `Comments.gs` بيجيب كومنتات **فيسبوك بس** (بوستات وريلز آخر `COMMENTS_DAYS` يوم)، وبيبعت لحد `COMMENTS_PER_RUN` كل ساعة على تيليجرام: ✅ ابعت / ✏️ اكتب رد / 🙈 تجاهل.
  - الرد المقترح بيتكتب أوتوماتيك بس لو `AI_ENABLED` شغال (محتاج `GEMINI_API_KEY`). من غيره الكومنت بيوصل من غير رد مقترح ود. أحمد يكتب الرد.
  - كومنتات إنستجرام مش مدعومة في الكود لسه.

## ليه وقفنا
- زرار **Generate Access Token** بيفتح نافذة موافقة فيسبوك في popup برا تابات Claude، فلازم د. أحمد يوافق بنفسه.
- لصق التوكن و App Secret في «ربط فيسبوك» لازم د. أحمد يعمله بنفسه؛ Claude مش بيكتب توكنات أو أسرار في أي خانة.
- د. أحمد ما كانش جنب الكمبيوتر، فاتأجل لبكرة.

## الخطوة الجاية
1. Claude يفتح Graph API Explorer (`https://developers.facebook.com/tools/explorer/1156816820230277/`) ويعلّم الـ 11 صلاحية (الـ 7 + `pages_manage_engagement` + `pages_read_user_content` + `read_insights` + `instagram_manage_comments`).
2. **د. أحمد:** Generate Access Token ← يختار صفحة د. أحمد نبيل وحساب @dr.ahmednabil_chemistry ← يوافق.
3. **د. أحمد:** الشيت ← إعداد النشر ← **2) ربط فيسبوك** ← يلصق التوكن، وبعده App Secret (أبّ Meta ← إعدادات التطبيق ← أساسي). لازم تطلع «التوكن دائم».
4. Claude: الإضافات ← **ربط إنستجرام** ← لازم يطلع `@dr.ahmednabil_chemistry` وعدد المتابعين.
5. Claude يراجع مقاس قالب الصورة: إنستجرام بيقبل من 4:5 لحد 1.91:1 بس.
6. **بعد موافقة د. أحمد:** `COMMENTS_ENABLED` (الكومنتات أولوية عنده)، و`IG_ENABLED` في تاب Settings، وتجربة بأول بوست. وبعد ما الصور تشتغل: `IG_REELS_ENABLED`.
7. تسجيل النتيجة هنا وفي `README.md`.
