const {makeEnv}=require('./sim.js');const fs=require('fs');
const dir=process.argv[2], files=fs.readdirSync(dir).filter(f=>f.endsWith('.gs')).map(f=>dir+'/'+f);
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
check('1a تيليجرام واقع الساعة 5: dailyJob بيقف بخطأ، والبوست يفضل جاهز',threw&&st(e,2)==='جاهز'&&!e.props.LAST_SENT_DATE);
e.net.tgThrow=false;e.setNow('2026-11-18T16:05:00Z');e.ctx.dailyJob();
check('1b الساعة 6: المحاولة المتأخرة بتبعت بوست 3 مرة واحدة',st(e,2)==='اتبعت للموافقة'&&e.props.LAST_SENT_DATE==='2026-11-18',e.log.tg.filter(x=>/⏰/.test(x)).length+' رسالة ⏰');
e.setNow('2026-11-18T17:05:00Z');const n1=e.log.tg.length;e.ctx.dailyJob();
check('1c الساعة 7: مفيش إرسال تاني',e.log.tg.length===n1&&st(e,3)==='جاهز');

// 1d تيليجرام رد بخطأ HTTP (ok:false) — سلوك موجود قبل كده
e=makeEnv({files,posts:posts(),now:'2026-11-18T15:05:00Z',net:{tgHttpError:true}});e.ctx.dailyJob();
check('1d (قديم) تيليجرام رجّع خطأ: الحالة بتتعلّم "اتبعت" مع إن الرسالة ما وصلتش',st(e,2)==='اتبعت للموافقة','موجود في الكود الشغال، والمحاولة المتأخرة مش بتغطيه، ومهمة Claude 6:07 بتغطيه');

// 2) فشل النشر على فيسبوك (خطأ من Meta)
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','c','img']],net:{fbError:true},updates:[cb('ok:2')]});
e.ctx.pollTelegram();
check('2 فيسبوك رجّع خطأ: الحالة ترجع "اتبعت للموافقة"، ومفيش إعادة لوحدها',st(e,2)==='اتبعت للموافقة'&&e.log.fbPosts.length===1&&e.log.tg.some(x=>/النشر فشل/.test(x)));
e.ctx.pollTelegram();check('2b الدقيقة اللي بعدها: مفيش محاولة نشر تانية',e.log.fbPosts.length===1);

// 3) انقطاع الاتصال بعد ما فيسبوك نشر فعلًا (Timeout) — الكود الشغال
e=makeEnv({files,posts:[H,['3','2026-11-18','اتبعت للموافقة','h','c','img']],net:{fbTimeoutAfterPost:true},updates:[cb('ok:2')]});
e.ctx.pollTelegram();e.net.fbTimeoutAfterPost=false;e.ctx.pollTelegram();
check('3 (قديم، حرج) انقطاع بعد ما فيسبوك نشر: نفس البوست بيتنشر تاني (في نفس الدقيقة وفي اللي بعدها)',e.log.fbPosts.length>1,'عدد مرات النشر = '+e.log.fbPosts.length);

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
check('5 (قديم، حرج) ✏️ على بوست اتنشر: بيتبعت للموافقة تاني، و"انشر" بتنشره مرة تانية',e.log.fbPosts.length===1&&st(e,2)==='اتنشر','اتنشر '+e.log.fbPosts.length+' مرة جديدة');
e=makeEnv({files,posts:[H,['3','2026-11-17','اتنشر','h','قديم','img','','','P_old']],updates:[cb('sk:2')]});
e.ctx.pollTelegram();
check('5b (قديم، حرج) ⏭ أجّل على بوست اتنشر: بيرجع "جاهز" وهيتنشر تاني',st(e,2)==='جاهز');

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
console.log(R.join('\n'));console.log('\nنجح '+pass+' / فشل '+fail);
