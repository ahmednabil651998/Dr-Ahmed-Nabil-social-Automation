# يوتيوب Shorts — الوضع الحالي (2026-11-16)

> الحالة: **شغال** (`YT_ENABLED = true`). لما د. أحمد يدوس "انشر" على Telegram، الريل بيتنشر على فيسبوك وبعدين يوتيوب Shorts **Public** على قناة `Dr Ahmed Nabil - Chemistry` (حساب 998).

## إزاي الرفع شغال (من 2026-11-16)
- مشروع Google Cloud اسمه **`drahmed-youtube`** على حساب **ahmednabil651999**، فيه YouTube Data API v3 متفعّل، وشاشة الموافقة (اسم الأب `Dr Ahmed Nabil Reels`) **In production** — مهم: في وضع Testing الـ Refresh token بيبوظ كل 7 أيام.
- OAuth Client من نوع Web application، والـ redirect هو `https://developers.google.com/oauthplayground`.
- د. أحمد وافق مرة واحدة بحساب **998** من OAuth Playground (scope: `https://www.googleapis.com/auth/youtube`)، والـ Refresh token اتحفظ.
- في Script Properties: `YT_CLIENT_ID` و `YT_CLIENT_SECRET` و `YT_REFRESH_TOKEN` (مش في الريبو).
- `Reels.gs`: `ytToken_` بتجيب توكن ساعة من الـ Refresh token، و`uploadYtShort_` بترفع resumable بـ `UrlFetchApp` (مابقيناش نستخدم خدمة YouTube المدمجة اللي بترفع على حساب 999)، و`checkYtChannel_` بتتأكد من القناة (بتقارن الحروف والأرقام بس عشان الشَرطة والمسافات)، و`ytWhoAmI` للتأكد من الربط.
- تجربة: ريل Private اترفع على القناة الأساسية (`QBpO6rfLH0E`) بالعنوان والوصف صح، واتمسح بـ `deleteYtTestVideo`.

## لو الرفع وقف
- "توكن يوتيوب: invalid_grant" ← الـ Refresh token اتلغى (مثلًا تغيير باسورد 998 أو سحب الصلاحية). اعمل موافقة جديدة من OAuth Playground بحساب 998 وحدّث `YT_REFRESH_TOKEN`.
- "السكريبت متربط بقناة …" ← التوكن تبع قناة تانية. شغّل `ytWhoAmI` وشوف.
- الـ Client secret موجود في ملف JSON عند د. أحمد. لو اتسرّب: اعمل secret جديد من Google Cloud ← Clients.

## تجربة القفل (2026-11-16) — النتيجة: مفيش قفل ✅
- اتعملت قناة تجربة على حساب **ahmednabil651999** (اسمها `Ahmed Nabil`، ID `UC1QyXJwWsUj2rLB06g5DBYA`).
- ملف مؤقت في Apps Script (دالة `testYtLock`) رفع أول ريل "جاهز" بـ `YouTube.Videos.insert` بحالة **unlisted**، من غير `checkYtChannel_`.
- يوتيوب رجّع `privacyStatus: unlisted`، والفيديو `ewyeMAA8YlI` (`test - delete`) اشتغل من Incognito، وبعد ~17 ساعة لسه **Unlisted** في Studio من غير قفل.
- يعني الرفع من مشروع Apps Script الافتراضي (غير متراجع) **مش بيتقفل Private** دلوقتي. القفل بيتحدد على مستوى المشروع مش القناة، فالنتيجة تنطبق على القناة الأساسية لما نرفع بنفس الطريقة. (مصدر على النت قال إن يوتيوب بطّل القفل ده، رغم إن صفحة المساعدة الرسمية لسه بتذكره.)
- الملف المؤقت اتمسح. فيديو التجربة `ewyeMAA8YlI` لسه على قناة 999 (Unlisted) — يتمسح يدويًا من Studio.

## الخطوة الجاية
- أول ريل حقيقي: "انشر" مرة واحدة ← فيسبوك + يوتيوب، ونتأكد إن الـ Short طلع Public.
- بعدها: تيك توك (المرحلة 3).

## اللي اتعمل
- كود النشر على يوتيوب اتكتب في `Reels.gs`: `uploadYtShort_`، `checkYtChannel_` (بيتأكد إن القناة هي `Dr Ahmed Nabil Chemistry`)، `ytTitle_` (العنوان + هاشتاج الموضوع + `#shorts`، أقصاه 100 حرف)، `ytDescription_`.
- `publishReel_` بينشر على كل منصة لسه ما اتنشرش عليها، ولو منصة فشلت الحالة بتبقى "فشل جزئي" ويتبعت زرار "🔁 أعد المحاولة" (`rre:`) بيعيد المنصة اللي فشلت بس.
- خدمة **YouTube Data API v3** اتضافت للمشروع (Services ← YouTube)، وحساب `ahmednabil651999` وافق على صلاحية يوتيوب.

## ليه متوقف — مشكلتين
1. **القناة على حساب تاني:** قناة `Dr Ahmed Nabil Chemistry` على حساب **ahmednabil651998@gmail.com**، والسكريبت شغال بحساب **ahmednabil651999@gmail.com**. يوتيوب رد إن حساب 999 "مالوش قناة". Apps Script بيرفع على قناة الحساب اللي شغال بيه بس.
   - الحل التقني: مشروع Google Cloud بمفتاح OAuth خاص، ود. أحمد يوافق مرة واحدة بحساب 998 (من Incognito عشان تعدد الحسابات بيبوّظ شاشة الموافقة).
2. **قفل Private (اتحل — شوف تجربة 2026-11-16 فوق):** أي فيديو بيترفع من مشروع API **مش متراجع** (اتعمل بعد 28 يوليو 2020) بيتقفل Private، **وما ينفعش يتعمل Public لا من الـ API ولا من YouTube Studio**، ومفيش استئناف. الحل الوحيد: مراجعة يوتيوب (YouTube API Services Compliance Audit) — ببلاش بس بتاخد أسابيع ومش مضمونة لأداة شخصية.

## الاختيارات اللي اتعرضت على د. أحمد (مستني قراره)
1. نقدّم على المراجعة → بعد القبول يبقى أوتوماتيك Public بالكامل.
2. أداة مدفوعة متراجعة (ضد شرط المجانية).
3. **نص-أوتوماتيك (المقترح):** بعد "انشر" الريل يتنشر على فيسبوك أوتوماتيك، والبوت يبعت الفيديو + عنوان يوتيوب + الوصف جاهزين للنسخ، ود. أحمد يرفعه من تطبيق يوتيوب في أقل من دقيقة (Public فورًا). ممكن يتعمل مع (1) في نفس الوقت.

## ملاحظات تقنية للي هيكمّل
- المشروع على **Rhino (legacy runtime)** → ES5 بس.
- تعديل الكود في المحرر اتعمل من المتصفح المدمج عن طريق `monaco.editor.getModel(...).setValue(...)` وبعدين Ctrl+S، والتأكد بمقارنة طول الملف بالريبو.
- شاشات موافقة جوجل (OAuth) بتفتح popup، والمتصفح المدمج بيمنعها → لازم د. أحمد يدوس بنفسه. من الموبايل: Incognito + حساب واحد + Desktop site.
