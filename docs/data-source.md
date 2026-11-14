# مصدر البيانات (Google Sheet)

البيانات الحية لأتمتة البوست اليومي (الجدول، حالة كل بوست، الصور) مش موجودة في الريبو ده - موجودة في Google Sheets لأنها بتتغير يوميًا.

- **Google account:** ahmednabil651999@gmail.com
- **Sheet ID:** `1QIrCfqUEor8Wlz8PTTvoMyYvQEAPOlL0TxvtUKZ3iiU`
- **Tab:** `Posts`
- **Drive folder ID (الصور):** `1ATeQJ1NAnYZpZzddvpIJF26LAfXtPSNK`

## بنية تاب "Posts" (تقريبًا)
كل صف = بوست واحد، وفيه عمود للحالة بيتغير أثناء الفلو:
- `pending` — لسه متبعت للمراجعة على تيليجرام
- `approved` — تمت الموافقة وجاهز للنشر
- `edit_requested` / `edited` — طلب تعديل أو تم تعديله

> للتفاصيل الكاملة والـ IDs التانية (Apps Script project, Facebook Page, Meta App) راجع `instructions/daily-post.md`.
