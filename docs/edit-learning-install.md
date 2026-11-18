# تركيب «نتعلم من تعديلاتك» في Apps Script

> **مهم:** الكود الشغال فعلًا في Apps Script هو نسخة طلب الدمج رقم 10 (فرع `feature/system-upgrade`)، مش اللي في `main`. السطور تحت مكتوبة على النسخة الشغالة.

> **الأسهل:** الصق الملفات الجاهزة من `apps-script/next/` (فيها التعديل ده + المحاولة المتأخرة للبوست اليومي). الخطوات تحت لو عاوز تعدّل سطر بسطر.

## الخطوات

1. **نسخة احتياطية:** File → Make a copy، أو انسخ `Code.gs` و`Reels.gs` في ملف على الجهاز.
2. **ملف جديد:** دوس + جنب Files، واختار Script، وسمّيه `Learning`، والزق فيه `apps-script/Learning.gs` كامل، وامسح `myFunction` لو ظهرت، واعمل Save. اتأكد إن آخر `}` اتلصق.
3. **`Code.gs`:** في `handleUpdate_` دوّر على:
   ```js
       cell_(editRow, C.CAPTION).setValue(ensureHashtags_(text));
       props_().deleteProperty('EDIT_ROW');
   ```
   وخليهم كده:
   ```js
       var lnBefore = cellText_(editRow, C.CAPTION);
       cell_(editRow, C.CAPTION).setValue(ensureHashtags_(text));
       if (typeof lnLogEdit_ === 'function') lnLogEdit_('بوست', cellText_(editRow, C.NUM), lnBefore, cellText_(editRow, C.CAPTION), 'تيليجرام'); // Learning.gs
       props_().deleteProperty('EDIT_ROW');
   ```
4. **`Reels.gs`:** في `handleReelMessage_` دوّر على:
   ```js
       rcell_(editRow, RC.CAPTION).setValue(text.trim());
       props_().deleteProperty('REEL_EDIT_ROW');
   ```
   وخليهم كده:
   ```js
       var lnBefore = rtext_(editRow, RC.CAPTION);
       rcell_(editRow, RC.CAPTION).setValue(text.trim());
       if (typeof lnLogEdit_ === 'function') lnLogEdit_('ريل', rtext_(editRow, RC.NUM), lnBefore, text.trim(), 'تيليجرام'); // Learning.gs
       props_().deleteProperty('REEL_EDIT_ROW');
   ```
5. **Save**، وبعدين جرّب: دوس «✏️ تعديل» على أي بوست في تيليجرام وابعت كابشن جديد. لازم يظهر صف في تاب `Edits`.

## الأمان

- مفيش تغيير في أي Trigger ولا Script Property.
- لو `Learning.gs` مش موجود أو حصل فيه خطأ، التعديل نفسه بيتحفظ ويتبعت للموافقة عادي، وبتيجي رسالة «⚠️ ما اتسجلش في تاب Edits».
- **اتجرّب** على نسخة من الكود الشغال ببيانات وهمية في 3 حالات: الملف موجود، والملف مش موجود، وعمل التاب فشل. في التلاتة الكابشن اتحفظ واتبعت للموافقة. ومفيش أسماء دوال أو متغيرات متكررة بين الملفات.
