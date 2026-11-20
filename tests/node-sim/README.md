# اختبارات محاكاة Node (مش Apps Script الحقيقي)

بتشغّل ملفات `apps-script/*.gs` جوه Node مع Mocks لـ SpreadsheetApp / UrlFetchApp / DriveApp / Utilities.
بتثبت منطق الكود بس، **مش** بتثبت التوافق التشغيلي في Apps Script (Rhino، الكوتا، صلاحيات Drive، ردود Telegram/Facebook الحقيقية).

```
cd tests/node-sim
npm install acorn@8.11.3          # لفحص ES5 بس
node es5check.js ../../apps-script
node tests.js ../../apps-script AFTER
```
