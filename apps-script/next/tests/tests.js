const {makeEnv}=require('./sim.js');const fs=require('fs');
const dir=process.argv[2], liveDir=process.argv[3]||dir.replace(/test$/,'live'), files=fs.readdirSync(dir).filter(f=>f.endsWith('.gs')).map(f=>dir+'/'+f);
const H=['رقم','تاريخ','الحالة','هوك','كابشن','صورة','ملاحظات','tg','fb','ig','النوع'];
const posts=()=>[H,['3','2026-11-17','جاهز','هوك3','كابشن 3\n\n#Dr_Ahmed_Nabil ❤️\n#ويبقي_الاثر ✨','img3'],['4','2026-11-18','جاهز','هوك4','كابشن 4','img4']];
let pass=0,fail=0;const R=[];
function check(name,cond,detail){(cond?pass++:fail++);R.push((cond?'✅ ':'❌ ')+name+(detail?'  ['+detail+']':''))}
const st=(e,r)=>e.sheets.Posts.d[r-1][2];
const cb=(data,id)=>({update_id:id||1,callback_query:{id:'c',from:{id:1},data}});
const msg=(text,id)=>({update_id:id||1,message:{chat:{id:1},text}});

// 1) فشل إرسال تيليجرام (انقطاع) الساعة 5، وبعدين المحاولة المتأخرة
let e=makeEnv({files,posts:posts(),now:'2026-11-18T15:05:00Z',net:{tgThrow:true}});
let threw=false;try{e.ctx.dailyJob()}catch(x){threw=true}
check('1a تيليجرام واقع الساعة 5: dailyJob ما بيقفش بخطأ، والبوست يفضل جاهز، والمحاولة المتأخرة لسه متاحة',!threw&&st(e,2)==='جاهز'&&!e.props.LAST_SENT_DATE&&!e.props.LAST_CATCHUP_DATE);
e.net.tgThrow=false;e.setNow('2026-11-18T16:05:00Z');e.ctx.dailyJob();
check('1b الساعة 6: المحاولة المتأخرة بتبعت بوست 3 مرة واحدة',st(e,2)==='اتبعت للموافقة'&&e.props.LAST_SENT_DATE==='2026-11-18',e.log.tg.filter(x=>/⏰/.test(x)).length+' رسالة ⏰');
e.setNow('2026-11-18T17:05:00Z');const n1=e.log.tg.length;e.ctx.dailyJob();
check('1c الساعة 7: مفيش إرسال تاني',e.log.tg.length===n1&&st(e,3)==='جاهز');

// 1d تيليجرام رد بخطأ HTTP (ok:false) — سلوك موجود قبل كده
e=makeEnv({files,posts:posts(),now:'2026-11-18T15:05:00Z',net:{tgHttpError:true}});e.ctx.dailyJob();
check('1d تيليجرام رجّع خطأ (ok:false): الحالة تفضل "جاهز"، وLAST_SENT_DATE ما يتسجلش',st(e,2)==='جاهز'&&!e.props.LAST_SENT_DATE&&!e.props.LAST_CATCHUP_DATE);
e.net.tgHttpError=false;e.setNow('2026-11-18T16:05:00Z');e.ctx.dailyJob();
check('1e بعد خطأ تيليجرام الساعة 5: المحاولة المتأخرة الساعة 6 بتبعت البوست مرة واحدة',st(e,2)==='اتبعت للموافقة'&&e.props.LAST_SENT_DATE==='2026-11-18');

// 2) فشل النشر على فيسبوك (خطأ من Meta)
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','c','img']],net:{fbError:true},updates:[cb('ok:2')]});
e.ctx.pollTelegram();
check('2 فيسبوك رجّع خطأ: الحالة ترجع "اتبعت للموافقة"، ومفيش إعادة لوحدها',st(e,2)==='اتبعت للموافقة'&&e.log.fbPosts.length===1&&e.log.tg.some(x=>/النشر فشل/.test(x)));
e.ctx.pollTelegram();check('2b الدقيقة اللي بعدها: مفيش محاولة نشر تانية',e.log.fbPosts.length===1);

// 3) انقطاع الاتصال بعد ما فيسبوك نشر فعلًا (Timeout) — الكود الشغال
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','c','img']],net:{fbTimeoutAfterPost:true},updates:[cb('ok:2')]});
e.ctx.pollTelegram();e.net.fbTimeoutAfterPost=false;e.ctx.pollTelegram();
check('3 انقطاع بعد ما فيسبوك نشر: مفيش نشر تاني، والحالة "محتاج مراجعة"',e.log.fbPosts.length===1&&st(e,2)==='محتاج مراجعة','عدد مرات النشر = '+e.log.fbPosts.length);

// 4) Learning.gs مش موجود
e=makeEnv({files:files.filter(f=>!f.endsWith('Learning.gs')),posts:[H,['3','2026-11-18','اتبعت للموافقة','h','قديم','img']],props:{EDIT_ROW:'2'},updates:[msg('كابشن جديد')]});
e.ctx.pollTelegram();
check('4 من غير Learning.gs: التعديل اتحفظ واتبعت للموافقة، ومفيش خطأ',/كابشن جديد/.test(e.sheets.Posts.d[1][4])&&!e.log.tg.some(x=>/❌/.test(x))&&!e.sheets.Edits);

// 4b تعديل عادي بيتسجل مرة واحدة، ولو نفس الرسالة رجعت تاني ما تتسجلش
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','قديم','img']],props:{EDIT_ROW:'2'},updates:[msg('كابشن جديد',5)]});
e.ctx.pollTelegram();e.ctx.handleUpdate_(msg('كابشن جديد',5));
check('4b التعديل بيتسجل في Edits مرة واحدة بس',e.sheets.Edits&&e.sheets.Edits.getLastRow()===2,(e.sheets.Edits?e.sheets.Edits.getLastRow()-1:0)+' صف');
// 4c كابشن بيبدأ بـ "-" أو "=" بيتسجل نص مش معادلة
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','قديم','img']],props:{EDIT_ROW:'2'},updates:[msg('=SUM(A1) - تجربة')]});
e.ctx.pollTelegram();
check('4c كابشن بيبدأ بـ = بيتكتب نص في Edits',String(e.sheets.Edits.d[1][5]).indexOf('=SUM')===0);
// 4d فشل عمل تاب Edits
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','قديم','img']],props:{EDIT_ROW:'2'},updates:[msg('جديد')],net:{insertFails:true}});
e.ctx.pollTelegram();
check('4d فشل عمل تاب Edits: التعديل اتحفظ، وجه تنبيه ⚠️ بس',/جديد/.test(e.sheets.Posts.d[1][4])&&e.log.tg.some(x=>/⚠️ التعديل اتحفظ/.test(x)));

// 5) تعديل بعد الموافقة/النشر من زرار قديم — الكود الشغال
e=makeEnv({files,posts:[H,['3','2026-11-17','اتنشر','h','قديم','img','','','P_old']],updates:[cb('ed:2',1),msg('كابشن تاني',2),cb('ok:2',3)]});
e.ctx.pollTelegram();
check('5 ✏️ على بوست اتنشر من رسالة قديمة: مرفوض، ومفيش نشر تاني',e.log.fbPosts.length===0&&st(e,2)==='اتنشر'&&e.sheets.Posts.d[1][4]==='قديم','اتنشر '+e.log.fbPosts.length+' مرة جديدة');
e=makeEnv({files,posts:[H,['3','2026-11-17','اتنشر','h','قديم','img','','','P_old']],updates:[cb('sk:2')]});
e.ctx.pollTelegram();
check('5b ⏭ أجّل على بوست اتنشر من رسالة قديمة: مرفوض، والحالة فضلت "اتنشر"',st(e,2)==='اتنشر'&&e.sheets.Posts.d[1][1]==='2026-11-17');

// 6) بوست جاهز وميعاده فات
e=makeEnv({files,posts:[H,['3','2026-11-10','جاهز','h','c','img'],['4','2026-11-18','جاهز','h','c','img']],now:'2026-11-18T15:05:00Z'});
e.ctx.dailyJob();check('6 بوست جاهز ميعاده فات: بيتبعت الأول (الأقدم)',st(e,2)==='اتبعت للموافقة'&&st(e,3)==='جاهز');

// 7) تشغيل نفس المهمة مرتين
e=makeEnv({files,posts:posts(),now:'2026-11-18T15:05:00Z'});e.ctx.dailyJob();e.ctx.dailyJob();
check('7 dailyJob مرتين في نفس الساعة: بوست واحد بس',st(e,2)==='اتبعت للموافقة'&&st(e,3)==='جاهز');

// 8) المحاولة المتأخرة والبوست اتنشر من Claude
e=makeEnv({files,posts:[H,['3','2026-11-18','تمت الموافقة','h','c','img']],now:'2026-11-18T16:01:00Z'});
e.ctx.pollTelegram();e.setNow('2026-11-18T16:30:00Z');const before8=e.log.fbPosts.length;e.ctx.dailyJob();
check('8 اتنشر من Claude الساعة 6، والمحاولة المتأخرة ما بعتتش حاجة',before8===1&&!e.log.tg.some(x=>/⏰/.test(x)));

// ---------- Snapshots ----------
const AN=[['المنصة','النوع','رقم','ID','الرابط','تاريخ النشر','آخر تحديث','لايكات','كومنتات','شير','مشاهدات','تفاعل'],
 ['فيسبوك','بوست','1','103991896132654_111','l','2026-11-16 17:30'],['فيسبوك','ريل','1','999888777666','l','2026-11-16 20:00']];
const snRows=e=>e.sheets.Snapshots.d.slice(1).filter(r=>r.length);
e=makeEnv({files,analytics:AN.map(r=>r.slice()),now:'2026-11-18T14:00:00Z'});
e.ctx.snapshotsJob_();check('S1 قبل 48 ساعة: مفيش لقطة',snRows(e).length===0);
e.setNow('2026-11-18T16:00:00Z');e.ctx.snapshotsJob_();
let rows=snRows(e);
check('S2 بعد 48 ساعة: لقطة للبوست بأرقامه ووقتها الفعلي',rows.length===1&&rows[0][4]==='48 ساعة'&&rows[0][7]===40&&rows[0][10]===500&&rows[0][5]==='2026-11-18 18:00'&&rows[0][11]===1200);
check('S3 الـ ID الطويل بيتكتب نص',rows[0][3]==='103991896132654_111');
check('S4 معادلة التفاعل = (H+I+J)/K',rows[0][12]==='=IF(N(K2)>0,(N(H2)+N(I2)+N(J2))/K2,"")','(40+5+3)/500 = 9.6%');
check('S5 عمود O بيقول الرقم ده إيه',/post_total_media_view_unique/.test(rows[0][14]));
e.ctx.snapshotsJob_();check('S6 تشغيل تاني في نفس الساعة: مفيش تكرار',snRows(e).length===1);
e.setNow('2026-11-18T19:00:00Z');e.ctx.snapshotsJob_();rows=snRows(e);
check('S7 الريل منفصل عن البوست، ومقياسه "تشغيلات"',rows.length===2&&rows[1][1]==='ريل'&&/blue_reels_play_count/.test(rows[1][14])&&rows[1][9]==='');
e.setNow('2026-11-23T16:00:00Z');e.ctx.snapshotsJob_();rows=snRows(e);
check('S8 بعد 7 أيام: لقطة جديدة، واللقطة القديمة ما اتغيرتش',rows.length===3&&rows[2][4]==='7 أيام'&&rows[0][4]==='48 ساعة'&&rows[0][7]===40);
// فشل Meta
e=makeEnv({files,analytics:AN.map(r=>r.slice()),now:'2026-11-18T16:00:00Z',net:{graphError:true}});
e.ctx.snapshotsJob_();check('S9 Meta رجّعت خطأ: مفيش صف فاضي',snRows(e).length===0);
e.setNow('2026-11-19T17:00:00Z');e.ctx.snapshotsJob_();e.ctx.snapshotsJob_();
check('S10 بعد 24 ساعة من غير أرقام: مفيش صف، وتنبيه واحد بس',snRows(e).length===0&&e.log.tg.filter(x=>/لقطات الأرقام/.test(x)).length===1);
e.net.graphError=false;e.setNow('2026-11-19T18:00:00Z');e.ctx.snapshotsJob_();
check('S11 الأرقام رجعت بعد ما مهلة البوست خلصت (74 ساعة): مفيش لقطة متأخرة للبوست',snRows(e).filter(r=>r[1]==='بوست'&&r[4]==='48 ساعة').length===0);
check('S11b الريل كان لسه في مهلته (72 ساعة): اتاخدله لقطة',snRows(e).filter(r=>r[1]==='ريل'&&r[4]==='48 ساعة').length===1);
// المقياس اترفض بس
e=makeEnv({files,analytics:AN.slice(0,2).map(r=>r.slice()),now:'2026-11-18T16:00:00Z',net:{metricError:true}});
e.ctx.snapshotsJob_();rows=snRows(e);
check('S12 مقياس الوصول اترفض: الصف بيتكتب بالريأكشنز، والوصول فاضي ومعاه ملاحظة',rows.length===1&&rows[0][10]===''&&/الوصول ما جاش/.test(rows[0][13]));
// تاب Snapshots مش موجود
e=makeEnv({files,analytics:AN.map(r=>r.slice()),now:'2026-11-18T16:00:00Z',snapshots:false});
e.ctx.snapshotsJob_();check('S13 تاب Snapshots مش موجود: بيتعمل وبعدين اللقطة',!!e.sheets.Snapshots&&snRows(e).length===1&&e.sheets.Snapshots.d[0].length===15);
// قفل شغال
e=makeEnv({files,analytics:AN.map(r=>r.slice()),now:'2026-11-18T16:00:00Z'});e.holdDocLock(true);e.ctx.snapshotsJob_();
check('S14 تشغيل تاني ماسك القفل: مفيش كتابة',snRows(e).length===0);
// متقفلة
e=makeEnv({files,analytics:AN.map(r=>r.slice()),now:'2026-11-18T16:00:00Z',snapOff:true});e.ctx.snapshotsJob_();
check('S15 SNAPSHOTS_ENABLED=false: مفيش أي حاجة',snRows(e).length===0&&e.log.graph.length===0);
// بوست قديم وقت التفعيل
e=makeEnv({files,analytics:[AN[0],['فيسبوك','بوست','9','old','l','2026-10-01 17:00']],now:'2026-11-18T16:00:00Z'});e.ctx.snapshotsJob_();
check('S16 بوست قديم وقت التفعيل: مفيش لقطة ولا تنبيه',snRows(e).length===0&&e.log.tg.length===0);
// Snapshots بيوقع بخطأ ما بيوقفش الإرسال
e=makeEnv({files,posts:posts(),analytics:AN.map(r=>r.slice()),now:'2026-11-18T15:05:00Z'});
e.ctx.snRun_=()=>{throw new Error('boom')};e.ctx.dailyJob();
check('S17 خطأ جوه Snapshots: البوست اتبعت عادي قبله، وجه تنبيه',st(e,2)==='اتبعت للموافقة'&&e.log.tg.some(x=>/لقطات الأرقام: boom/.test(x)));
// من غير Snapshots.gs خالص
e=makeEnv({files:files.filter(f=>!f.endsWith('Snapshots.gs')),posts:posts(),now:'2026-11-18T15:05:00Z'});e.ctx.dailyJob();
check('S18 من غير Snapshots.gs: dailyJob شغال عادي',st(e,2)==='اتبعت للموافقة');

// ---------- حماية النشر (P1/P2) ----------
const SENTROW=()=>[H,['3','2026-11-18','اتبعت للموافقة','h','c','img']];
const kb=e=>e.log.tgRaw||[];
// G1 نجاح مع تأكيد
e=makeEnv({files,posts:SENTROW(),updates:[cb('ok:2')]});e.ctx.pollTelegram();
check('G1 نجاح النشر مع تأكيد Meta: "اتنشر" ورقم فيسبوك متسجل، ونشر مرة واحدة',st(e,2)==='اتنشر'&&e.sheets.Posts.d[1][8]==='P_1'&&e.log.fbPosts.length===1&&e.props.LAST_PUBLISHED_DATE);
// G2 انقطاع قبل التأكيد + إعادة تشغيل المهام
e=makeEnv({files,posts:SENTROW(),net:{fbTimeoutAfterPost:true},updates:[cb('ok:2')]});e.ctx.pollTelegram();
const g2p=(e.log.tgRaw||[]).find(p=>/مش متأكد إن بوست رقم 3 اتنشر/.test(p.text||''));const g2msg=!!g2p&&/pv1:2/.test(g2p.reply_markup)&&/pv0:2/.test(g2p.reply_markup);
e.net.fbTimeoutAfterPost=false;for(let i=0;i<5;i++)e.ctx.pollTelegram();e.setNow('2026-11-18T16:05:00Z');e.ctx.dailyJob();e.setNow('2026-11-18T17:05:00Z');e.ctx.dailyJob();
check('G2 انقطاع بعد النشر قبل التأكيد: "محتاج مراجعة"، ورسالة فيها زرارين، ومفيش إعادة بعد 5 دقايق ولا من dailyJob',st(e,2)==='محتاج مراجعة'&&g2msg&&e.log.fbPosts.length===1,'نشر '+e.log.fbPosts.length+' مرة');
// G2b/c/d ردود مش مؤكدة تانية
for(const [k,label] of [['fbHtml','رد HTML (502)'],['fbTransient','خطأ مؤقت code 2'],['fbNoId','رد من غير رقم البوست']]){
  e=makeEnv({files,posts:SENTROW(),net:{[k]:true},updates:[cb('ok:2')]});e.ctx.pollTelegram();e.net[k]=false;e.ctx.pollTelegram();
  check('G2 '+label+': "محتاج مراجعة" ومفيش إعادة لوحدها',st(e,2)==='محتاج مراجعة'&&e.log.fbPosts.length===1);}
// G3 فشل مؤكد: الإعادة اليدوية مسموحة
e=makeEnv({files,posts:SENTROW(),net:{fbError:true},updates:[cb('ok:2',1)]});e.ctx.pollTelegram();
const g3a=st(e,2)==='اتبعت للموافقة';e.net.fbError=false;e.ctx.handleUpdate_(cb('ok:2',2));
check('G3 فشل مؤكد (توكن): يرجع للموافقة، و"انشر" تاني بتنشر عادي',g3a&&st(e,2)==='اتنشر'&&e.log.fbPosts.length===2,'محاولتين: فشلت وبعدين نجحت');
// G4 مراجعة يدوية: اتنشر فعلًا
e=makeEnv({files,posts:[H,['3','2026-11-18','محتاج مراجعة','h','c','img']],updates:[cb('pv1:2',1),cb('pv1:2',2),cb('pv0:2',3)]});e.ctx.pollTelegram();
check('G4 "✅ اتنشر فعلًا": "اتنشر" من غير نشر، والضغط تاني أو "انشره" بعدها مرفوض',st(e,2)==='اتنشر'&&e.log.fbPosts.length===0&&/اتأكد يدوي/.test(e.sheets.Posts.d[1][6]));
// G5 مراجعة يدوية: ما اتنشرش
e=makeEnv({files,posts:[H,['3','2026-11-18','محتاج مراجعة','h','c','img']],updates:[cb('pv0:2',1),cb('pv0:2',2)]});e.ctx.pollTelegram();
check('G5 "🔁 ما اتنشرش، انشره" مرتين: نشر مرة واحدة بس',st(e,2)==='اتنشر'&&e.log.fbPosts.length===1);
// G6 زرار تعديل قديم
e=makeEnv({files,posts:[H,['3','2026-11-17','اتنشر','h','قديم','img','','','P_old']],updates:[cb('ed:2',1),msg('كابشن تاني',2)]});e.ctx.pollTelegram();
check('G6 ✏️ من رسالة قديمة لبوست منشور: مرفوض، والرسالة اللي بعده ما اتعاملتش كتعديل',!e.props.EDIT_ROW&&e.sheets.Posts.d[1][4]==='قديم'&&!e.sheets.Edits);
e=makeEnv({files,posts:[H,['3','2026-11-18','محتاج مراجعة','h','قديم','img']],updates:[cb('ed:2',1),cb('sk:2',2)]});e.ctx.pollTelegram();
check('G6b ✏️ و ⏭ على بوست "محتاج مراجعة": مرفوضين',st(e,2)==='محتاج مراجعة'&&!e.props.EDIT_ROW&&e.sheets.Posts.d[1][1]==='2026-11-18');
e=makeEnv({files,posts:SENTROW(),updates:[cb('ed:2',1),msg('كابشن جديد',2)]});e.ctx.pollTelegram();
check('G6c ✏️ على بوست لسه مستني: شغال عادي',/كابشن جديد/.test(e.sheets.Posts.d[1][4])&&st(e,2)==='اتبعت للموافقة');
// G7 زرار تأجيل قديم ومتكرر
e=makeEnv({files,posts:SENTROW(),updates:[cb('sk:2',1),cb('sk:2',2)]});e.ctx.pollTelegram();
check('G7 ⏭ مرتين على نفس البوست: اتأجّل يوم واحد بس',e.sheets.Posts.d[1][1]==='2026-11-19'&&st(e,2)==='جاهز');
// G8 الضغط المتكرر على "انشر"
e=makeEnv({files,posts:SENTROW(),updates:[cb('ok:2',1),cb('ok:2',2),cb('ok:2',3)]});e.ctx.pollTelegram();
check('G8 "انشر" 3 مرات: نشر مرة واحدة',e.log.fbPosts.length===1&&st(e,2)==='اتنشر');
// G9 بوست ليه رقم فيسبوك وحالته اتغيرت بالغلط لـ "تمت الموافقة"
e=makeEnv({files,posts:[H,['3','2026-11-18','تمت الموافقة','h','c','img','','','P_old']]});e.ctx.pollTelegram();
check('G9 "تمت الموافقة" ومعاه رقم فيسبوك: مفيش نشر',e.log.fbPosts.length===0);
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','c','img','','','P_old']],updates:[cb('ok:2')]});e.ctx.pollTelegram();
check('G9b "انشر" على بوست ليه رقم فيسبوك: مفيش نشر، والحالة "اتنشر"',e.log.fbPosts.length===0&&st(e,2)==='اتنشر');
// G10 المحاولة المتأخرة وفيه بوست "محتاج مراجعة"
e=makeEnv({files,posts:[H,['3','2026-11-18','محتاج مراجعة','h','c','img'],['4','2026-11-18','جاهز','h','c','img']],now:'2026-11-18T16:05:00Z'});e.ctx.dailyJob();
check('G10 المحاولة المتأخرة وفيه بوست "محتاج مراجعة": ما بعتتش بوست جديد',st(e,3)==='جاهز'&&e.log.tg.some(x=>/مراجعتك/.test(x)));
// ---------- الريلز ----------
const RH=['رقم','التاريخ','الحالة','العنوان','الكابشن','الموضوع','فيديو','فيسبوك','يوتيوب','ملاحظات','tg','ig'];
e=makeEnv({files,reels:[RH,['1','2026-11-16','اتنشر','t','c','x','vid','https://www.facebook.com/reel/V0','https://youtube.com/shorts/Y0']],updates:[cb('red:2',1),cb('rsk:2',2)]});e.ctx.pollTelegram();
check('R1 ✏️ و ⏭ على ريل منشور من رسالة قديمة: مرفوضين',e.sheets.Reels.d[1][2]==='اتنشر'&&!e.props.REEL_EDIT_ROW&&e.sheets.Reels.d[1][1]==='2026-11-16');
e=makeEnv({files,reels:[RH,['1','2026-11-18','اتبعت للموافقة','t','c','x','vid']],net:{reelStatusThrow:true},updates:[cb('rok:2')]});
e.ctx.YT_ENABLED=false;e.ctx.reelBlob_=()=>({getBytes:()=>[1,2,3]});e.ctx.pollTelegram();
check('R2 الريل اترفع والتأكيد بس اللي ما وصلش: الرابط اتسجل، ومش "فشل جزئي"',/reel\/V1/.test(e.sheets.Reels.d[1][7])&&e.sheets.Reels.d[1][2]==='اتنشر'&&e.log.reel.filter(x=>x==='finish').length===1);
e=makeEnv({files,reels:[RH,['1','2026-11-18','اتبعت للموافقة','t','c','x','vid']],updates:[cb('rok:2',1),cb('rok:2',2)]});
e.ctx.YT_ENABLED=false;e.ctx.reelBlob_=()=>({getBytes:()=>[1]});e.ctx.pollTelegram();
check('R3 "انشر" على الريل مرتين: رفع مرة واحدة',e.log.reel.filter(x=>x==='finish').length===1);

// ---------- رقم فيسبوك اليدوي + الفحص اليومي ----------
const PG='103991896132654';
const CAP='كابشن البوست التالت فيه كلام كتير عن المذاكرة والتركيز';
const pagePosts={data:[{id:PG+'_555',message:CAP+'\n\n#Dr_Ahmed_Nabil ❤️\n#ويبقي_الاثر ✨',created_time:'2026-11-18T15:01:00+0000',permalink_url:'https://www.facebook.com/x/posts/pfbid0ABC'},
 {id:PG+'_444',message:'بوست تاني خالص',created_time:'2026-11-18T10:00:00+0000',permalink_url:'https://www.facebook.com/x/posts/pfbid0XYZ'}]};
const gfn=url=>{
  if(url.indexOf('/'+PG+'/posts')>=0||url.indexOf(PG+'/posts?')>=0)return pagePosts;
  if(url.indexOf('page_story_id')>=0)return{page_story_id:PG+'_555'};
  if(url.indexOf(PG+'_555?fields=id')>=0)return{id:PG+'_555',created_time:'2026-11-18T15:01:00+0000',permalink_url:'https://www.facebook.com/x/posts/pfbid0ABC'};
  if(url.indexOf(PG+'_555?fields=created_time')>=0)return{created_time:'2026-11-18T15:01:00+0000',permalink_url:'https://www.facebook.com/x/posts/pfbid0ABC',reactions:{summary:{total_count:12}},comments:{summary:{total_count:2}},shares:{count:1}};
  if(url.indexOf(PG+'_55500000?fields=id')>=0)return{id:PG+'_55500000',created_time:'2026-11-18T15:01:00+0000'};
  if(url.indexOf('999_777?fields=id')>=0)return{id:'999_777'};
  if(url.indexOf(PG+'_404?fields=id')>=0)return{error:{message:'Unsupported get request',code:100}};
  return undefined};
const ANH=[['المنصة','النوع','رقم','ID','الرابط','تاريخ النشر','آخر تحديث','لايكات','كومنتات','شير','مشاهدات','تفاعل']];
const reviewRow=()=>[H,['3','2026-11-18','محتاج مراجعة','h',CAP,'img']];
// F1 "اتنشر فعلًا" بيدوّر ويعرض زرار تأكيد، من غير ما يكتب
e=makeEnv({files,posts:reviewRow(),graphFn:gfn,analytics:ANH.map(r=>r.slice()),now:'2026-11-18T15:30:00Z',updates:[cb('pv1:2')]});e.ctx.pollTelegram();
let offer=(e.log.tgRaw||[]).find(p=>/لقيت 1 بوست/.test(p.text||''));
check('F1 «اتنشر فعلًا»: لقى البوست المطابق بس وعرضه بزرار تأكيد، ومفيش رقم اتكتب لسه',st(e,2)==='اتنشر'&&!!offer&&/pid:2:103991896132654_555/.test(offer.reply_markup)&&!e.sheets.Posts.d[1][8]);
e.ctx.handleUpdate_(cb('pid:2:'+PG+'_555',9));
check('F2 دوسة «ده هو»: الرقم اتكتب في I، والبوست اتضاف لـ Analytics',e.sheets.Posts.d[1][8]===PG+'_555'&&e.sheets.Analytics.d.slice(1).filter(r=>r[3]===PG+'_555').length===1);
e.ctx.handleUpdate_(cb('pid:2:'+PG+'_444',10));
check('F3 دوسة تانية على رقم تاني: مرفوضة، والرقم الأول فضل',e.sheets.Posts.d[1][8]===PG+'_555'&&e.log.tg.some(x=>/ليه رقم فيسبوك بالفعل/.test(x)));
e.setNow('2026-11-20T15:10:00Z');e.ctx.snapshotsJob_();
check('F4 بعد 48 ساعة: لقطة البوست اتاخدت بالرقم اليدوي',e.sheets.Snapshots.d.slice(1).filter(r=>r[3]===PG+'_555'&&r[4]==='48 ساعة').length===1);
// F5 ما لقاش البوست
e=makeEnv({files,posts:[H,['3','2026-11-18','محتاج مراجعة','h','نص مش موجود','img']],graphFn:gfn,now:'2026-11-18T15:30:00Z',updates:[cb('pv1:2')]});e.ctx.pollTelegram();
check('F5 «اتنشر فعلًا» والبوست مش لاقيه: رسالة فيها طريقة /fbid',e.log.tg.some(x=>/ما لقيتش البوست/.test(x)&&/\/fbid 3/.test(x)));
// F6 /fbid بأشكال لينك مختلفة
const forms=[[PG+'_555','الرقم كامل'],['55500000','رقم البوست بس'],['https://www.facebook.com/permalink.php?story_fbid=555&id='+PG,'story_fbid'],['https://www.facebook.com/photo/?fbid=888&set=a.1','لينك الصورة (fbid)'],['https://www.facebook.com/x/posts/pfbid0ABC','لينك pfbid'],['https://www.facebook.com/x/posts/555','posts/رقم']];
for(const [f,label] of forms){
  e=makeEnv({files,posts:[H,['3','2026-11-18','اتنشر','h',CAP,'img']],graphFn:gfn,analytics:ANH.map(r=>r.slice()),now:'2026-11-18T15:30:00Z',updates:[msg('/fbid 3 '+f)]});e.ctx.pollTelegram();
  check('F6 /fbid ب'+label+': الرقم الصح اتكتب',e.sheets.Posts.d[1][8]===(f==='55500000'?PG+'_55500000':PG+'_555'),String(e.sheets.Posts.d[1][8]||e.log.tg.slice(-1)[0]));}
// F7 الرفض
const rej=[[[H,['3','2026-11-18','اتبعت للموافقة','h',CAP,'img']],'/fbid 3 '+PG+'_555','بوست لسه مستني موافقة',/بيتسجل بس لبوست حالته/],
 [[H,['3','2026-11-18','اتنشر','h',CAP,'img','','','P_old']],'/fbid 3 '+PG+'_555','بوست ليه رقم',/بالفعل/],
 [[H,['3','2026-11-18','اتنشر','h',CAP,'img']],'/fbid 3 999_777','بوست صفحة تانية',/مش تبع الصفحة/],
 [[H,['3','2026-11-18','اتنشر','h',CAP,'img'],['4','2026-11-17','اتنشر','h','x','img','','',PG+'_555']],'/fbid 3 '+PG+'_555','رقم متسجل لبوست تاني',/متسجل لبوست رقم 4/],
 [[H,['3','2026-11-18','اتنشر','h',CAP,'img']],'/fbid 3 '+PG+'_404','رقم مش موجود على فيسبوك',/ما لقاش البوست/],
 [[H,['3','2026-11-18','اتنشر','h',CAP,'img']],'/fbid 3 كلام','كلام مش لينك',/مش عارف أطلّع/],
 [[H,['3','2026-11-18','اتنشر','h',CAP,'img']],'/fbid 9 '+PG+'_555','رقم بوست مش موجود',/مفيش بوست رقمه 9/],
 [[H,['3','2026-11-18','اتنشر','h',CAP,'img']],'/fbid','من غير بيانات',/اكتبها كده/]];
for(const [rows,cmd,label,re] of rej){
  e=makeEnv({files,posts:rows,graphFn:gfn,now:'2026-11-18T15:30:00Z',updates:[msg(cmd)]});const before=JSON.stringify(e.sheets.Posts.d);e.ctx.pollTelegram();
  check('F7 رفض: '+label+' (مفيش أي تغيير في الشيت)',JSON.stringify(e.sheets.Posts.d)===before&&e.log.tg.some(x=>re.test(x)));}
// F8 /fbid والبوت مستني تعديل كابشن: ما يتعاملش كتعديل
e=makeEnv({files,posts:[H,['3','2026-11-18','اتنشر','h',CAP,'img'],['4','2026-11-18','اتبعت للموافقة','h','قديم','img']],props:{EDIT_ROW:'3'},graphFn:gfn,now:'2026-11-18T15:30:00Z',updates:[msg('/fbid 3 '+PG+'_555')]});e.ctx.pollTelegram();
check('F8 /fbid والبوت مستني تعديل: الرقم اتسجل، والكابشن ما اتغيرش',e.sheets.Posts.d[1][8]===PG+'_555'&&e.sheets.Posts.d[2][4]==='قديم');
// H الفحص اليومي
const hset=[['HEALTH_ENABLED','true'],['LOW_READY_ALERT','0']];
e=makeEnv({files,posts:[H,['3','2026-11-18','محتاج مراجعة','h','c','img'],['4','2026-11-19','جاهز','h','c','img']],settings:hset,now:'2026-11-18T08:05:00Z'});
let hr=e.ctx.runHealth_(false);
check('H1 الفحص اليومي: «محتاج مراجعة» بتظهر كمشكلة',hr.bad.some(x=>/محتاج مراجعة/.test(x)&&/بوست 3/.test(x))&&e.log.tg.some(x=>/محتاج مراجعة/.test(x)));
e=makeEnv({files,posts:[H,['3','2026-11-18','اتنشر','h','c','img'],['4','2026-11-19','جاهز','h','c','img']],settings:hset,now:'2026-11-18T08:05:00Z'});hr=e.ctx.runHealth_(false);
check('H2 الفحص اليومي: «اتنشر» من غير رقم فيسبوك بتظهر ومعاها /fbid',hr.bad.some(x=>/من غير رقم فيسبوك/.test(x)&&/\/fbid/.test(x)));
e=makeEnv({files,posts:[H,['3','2026-11-17','اتنشر','h','c','img','','','P1'],['4','2026-11-19','جاهز','h','c','img']],settings:hset,now:'2026-11-18T08:05:00Z'});hr=e.ctx.runHealth_(false);
const eL=makeEnv({files:fs.readdirSync(liveDir).filter(f=>f.endsWith('.gs')).map(f=>liveDir+'/'+f),posts:[H,['3','2026-11-17','اتنشر','h','c','img','','','P1'],['4','2026-11-19','جاهز','h','c','img']],settings:hset,now:'2026-11-18T08:05:00Z'});
const hrL=eL.ctx.runHealth_(false);
check('H3 من غير حالات جديدة: رسالة الفحص زي الكود الشغال بالظبط',hr.text===hrL.text,hr.bad.length+' مشكلة');
console.log(R.join('\n'));console.log('\nنجح '+pass+' / فشل '+fail);
