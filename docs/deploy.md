# رفع الكود من الريبو على Apps Script (clasp)

بدل لصق الكود في المحرر من المتصفح: الكود يترفع من الريبو مرة واحدة، ومفيش ملف يتلصق ناقص.

## الإعداد (مرة واحدة، من الكمبيوتر)
1. فعّل **Google Apps Script API** لحساب **ahmednabil651999**: https://script.google.com/home/usersettings
2. نزّل Node.js، وبعدين من الـ terminal:
   ```
   npm install -g @google/clasp@2
   clasp login
   ```
   سجّل بحساب **999**. هيتعمل ملف اسمه `.clasprc.json` في فولدر المستخدم.
3. على GitHub: الريبو ← Settings ← Secrets and variables ← Actions ← New secret
   - الاسم: `CLASPRC_JSON`
   - القيمة: محتوى ملف `.clasprc.json` كله.
   > الملف ده زي الباسورد: ما تبعتهوش لحد، وما تحطوش في الريبو.
4. **الـ manifest (مهم قبل أول رفع):** في محرر Apps Script ← Project Settings ← علّم "Show appsscript.json in editor". افتح `appsscript.json` وانسخ محتواه في ملف جديد في الريبو: `apps-script/appsscript.json`.
   ده بيضمن إن الرفع ما يمسحش الإعدادات الحالية (المنطقة الزمنية والخدمات زي YouTube).

## الرفع
GitHub ← Actions ← **Deploy Apps Script** ← Run workflow ← اكتب `deploy` ← Run.

الـ Action:
- بيتأكد إن كل ملف `.gs` سليم (syntax) قبل الرفع.
- بيرفع كل ملفات `apps-script/` وبيمسح أي ملف مؤقت في المشروع مش موجود في الريبو.

بعد الرفع: افتح الشيت (Refresh) وشغّل **الإضافات ← فحص شامل للسيستم**.

## النقل لـ V8 (بعدين)
المشروع شغال على Rhino (القديم). الكود كله ES5، فشغال على V8 كمان.
لما الـ manifest يبقى في الريبو: غيّر `"runtimeVersion": "DEPRECATED_ES5"` لـ `"runtimeVersion": "V8"`، وارفع، وجرّب `/post` و`/reel` و"تجربة آمنة". لو فيه أي مشكلة رجّعها وارفع تاني.
