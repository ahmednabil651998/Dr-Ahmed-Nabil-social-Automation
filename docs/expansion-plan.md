# خطة التوسّع: إنستجرام + تيك توك + الرد على الكومنتات بالـ AI

> الحالة (2026-11-16): **خطة متفق عليها، لسه ما اتنفذش منها حاجة.** هنمشي فيها مرحلة مرحلة، وكل مرحلة تتجرب قبل اللي بعدها.

## الصورة النهائية المستهدفة

| المنصة | النشر | الرد على الكومنتات |
|---|---|---|
| فيسبوك | أوتوماتيك ✅ (شغال) | AI + موافقة Telegram |
| إنستجرام | أوتوماتيك بالكامل (Public) | AI + موافقة Telegram |
| تيك توك | نص-أوتوماتيك: مسودة في التطبيق + كابشن جاهز على Telegram | يدوي (غالبًا مفيش API) |
| يوتيوب | نص-أوتوماتيك: البوت يبعت الفيديو + العنوان + الوصف (شوف `docs/youtube-status.md`) | AI + موافقة Telegram |

## الشروط (زي باقي النظام)
- مجاني، من غير جهاز ولا سيرفر، كله Google Apps Script (Rhino ← ES5 بس).
- مفيش توكنز في الريبو؛ كله في Script Properties.
- البوست اليومي والريلز الحالية ما يتأثروش؛ الكود الجديد في دوال/ملفات منفصلة.

## المصادر اللي اتبصّ عليها (فكرة بس، مش هننسخ ريبو)
- `kentzu213/auto-post-tool` — ملف `apps/api/src/modules/publisher/services/tiktok.publisher.ts`: بيجرب Direct Post، ولو اتقفل (403 / `scope_not_aligned`) بيرجع لـ Inbox Draft. الـ `LIMITATIONS.md` بتاعهم بيأكد إن تيك توك عندهم Draft بس من غير مراجعة.
- `Jee-vim/clip-pipe` — رفع بالـ API الرسمي + إشعار Telegram لكل منصة.

---

## المرحلة A — إنستجرام ريلز (أوتوماتيك بالكامل)

**ليه سهل:** طريقة "Instagram API with Facebook Login" بتستخدم **توكن الصفحة** اللي معانا، والرفع على نفس `rupload.facebook.com` اللي `uploadFbReel_` بيستخدمه.

**المطلوب من د. أحمد:**
1. حساب إنستجرام **Professional** (Business/Creator) ومربوط بصفحة فيسبوك.
2. إضافة صلاحيات `instagram_basic` و`instagram_content_publish` لتطبيق Meta، وموافقة مرة واحدة لتوكن صفحة جديد.

**الكود (`uploadIgReel_` في `Reels.gs`):**
1. `GET /{page-id}?fields=instagram_business_account` ← نجيب `IG_USER_ID` ونخزنه في Script Properties.
2. `POST /{ig-user-id}/media` بـ `media_type=REELS` و`upload_type=resumable` و`caption`.
3. `POST https://rupload.facebook.com/ig-api-upload/{ver}/{container-id}` بالـ headers: `Authorization: OAuth <token>`، `offset: 0`، `file_size: <الحجم الحقيقي>` والفيديو binary من Drive.
4. نسأل `GET /{container-id}?fields=status_code` لحد `FINISHED` (الحاوية بتنتهي بعد 24 ساعة).
5. `POST /{ig-user-id}/media_publish?creation_id=...` ← نسجل الرابط في عمود جديد "رابط إنستجرام".
- يدخل في `publishReel_` كمنصة زيادة، ويستفيد من "فشل جزئي" + "🔁 أعد المحاولة" الموجودين.
- الحد: 50 منشور API في 24 ساعة — أكتر من كفاية.

## المرحلة B — تيك توك (مسودة + كابشن على Telegram)

**ليه نص-أوتوماتيك:** من غير مراجعة تيك توك، النشر المباشر بيتقفل؛ المتاح هو Inbox Draft (scope `video.upload` بس).

**المطلوب من د. أحمد:** حساب TikTok for Developers + تطبيق فيه Login Kit و Content Posting API، وموافقة مرة واحدة.

**الكود (`Tiktok.gs` جديد):**
1. OAuth بـ PKCE: `code_challenge` = SHA-256 بصيغة **HEX** (مش base64) ← `Utilities.computeDigest`. الـ redirect = رابط Web App بتاع السكريبت (`doGet`).
2. التوكن بيقعد 24 ساعة، الـ refresh token سنة ← تجديد أوتوماتيك قبل كل رفع.
3. `POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/` بـ `source: FILE_UPLOAD` و`video_size` = **الحجم الحقيقي** (ريبو auto-post-tool بيحط 10MB ثابت لو مفيش حجم — غلط ما نكررهوش)، `total_chunk_count: 1`.
4. `PUT upload_url` بـ `Content-Range: bytes 0-(size-1)/size`.
5. البوت يبعت الكابشن + الهاشتاجات جاهزين للنسخ، ود. أحمد ينشر من إشعار تيك توك.
- حد UrlFetchApp حوالي 50MB للطلب ← كفاية للريلز العادية.

**لازم يتأكد قبل التنفيذ:** هل التطبيق في وضع Sandbox يقدر يرفع مسودات على الحساب الحقيقي، ولا محتاج مراجعة تيك توك الأولى (app review) الأول.

## المرحلة C — الرد على الكومنتات بالـ AI

**الفلو:** trigger كل 10–15 دقيقة يقرا الكومنتات الجديدة ← الـ AI يصنّفها ويكتب الرد ← Telegram: "✅ ابعت / ✏️ عدّل / ⏭️ تجاهل" ← الرد يتنشر.
- **مفيش رد علمي يتنشر من غير موافقة** (صفحة مدرس — أي غلطة بتبان).
- التصنيف: سؤال علمي (رد للمراجعة) / شكر (رد قصير، ممكن أوتوماتيك لو د. أحمد وافق) / سبام (تجاهل).
- تعليمات الأسلوب ثابتة في `prompts/` (مصري، المصطلحات العلمية بالإنجليزي).
- نسجل آخر كومنت اتعالج في Script Properties عشان ما يتكررش.

**بالترتيب:**
1. **فيسبوك:** `GET /{post-id}/comments` و `POST /{comment-id}/comments` بتوكن الصفحة. صلاحيات: `pages_manage_engagement`، `pages_read_user_content`.
2. **إنستجرام:** `GET /{media-id}/comments` و `POST /{comment-id}/replies`. صلاحية: `instagram_manage_comments`.
3. **يوتيوب:** `commentThreads.list` و `comments.insert` — قفل الـ Private على الرفع بس، الكومنتات شغالة. القناة على حساب 998 ← **مشروع Apps Script صغير منفصل بحساب 998** للكومنتات بس (أبسط من Google Cloud + OAuth).
4. **تيك توك:** غالبًا مفيش API رد على الكومنتات للحسابات العادية — يتأكد، وإلا يفضل يدوي.

**موديل الـ AI:** Gemini (خطة مجانية) عشان شرط المجانية، أو Claude API (مدفوع بس رخيص) لو د. أحمد حب جودة أعلى. حدود الخطة المجانية لازم تتأكد وقت التنفيذ. المفتاح في Script Properties.

---

## الخطوة الجاية
1. د. أحمد يتأكد إن حساب إنستجرام Professional ومربوط بالصفحة ← نبدأ المرحلة A.
2. بالتوازي: كومنتات فيسبوك (المرحلة C-1) لأن التوكن والبوت جاهزين.
