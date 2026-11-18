// محاكي Apps Script: شيت وهمي + تيليجرام وفيسبوك وهميين. مفيش أي اتصال حقيقي.
const fs=require('fs'),vm=require('vm');
function Sheet(name,rows){const d=rows.map(r=>r.slice());return{name,d,
  getLastRow:()=>{let n=d.length;while(n>0&&(d[n-1]||[]).every(x=>x===''||x===undefined))n--;return n},
  getLastColumn:()=>Math.max(0,...d.map(r=>r.length)),
  getRange(r,c,nr,nc){nr=nr||1;nc=nc||1;const self=this;return{
    getValue:()=>{const v=(d[r-1]||[])[c-1];return v===undefined?'':v},
    getValues:()=>{const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const v=(d[r-1+i]||[])[c-1+j];row.push(v===undefined?'':v)}o.push(row)}return o},
    setValue(v){while(d.length<r)d.push([]);d[r-1][c-1]=v;return this},
    setValues(v){v.forEach((row,i)=>row.forEach((x,j)=>{while(d.length<r+i)d.push([]);d[r-1+i][c-1+j]=x}));return this},
    setFormula(v){return this.setValue(v)},setNumberFormat(){return this},setFontWeight(){return this}}},
  appendRow(row){const n=this.getLastRow();while(d.length<n+1)d.push([]);d[n]=row.map(x=>typeof x==='string'&&x[0]==="'"?x.slice(1):x)},
  setFrozenRows(){}}}
function makeEnv(opts){
  opts=opts||{};
  const sheets={};const add=(n,rows)=>sheets[n]=Sheet(n,rows);
  add('Posts',opts.posts||[['رقم','تاريخ','الحالة','هوك','كابشن','صورة','ملاحظات','tg','fb','ig','النوع']]);
  add('Reels',opts.reels||[['رقم']]);
  add('Settings',[['k','v'],['SEND_HOUR','17'],['REEL_SEND_HOUR','19'],['LOW_READY_ALERT','0'],['TG_MODE','polling'],['ANALYTICS_HOUR','3'],['HEALTH_HOUR','10'],['REPORT_DAY','5'],['REPORT_HOUR','12'],['SNAPSHOTS_ENABLED',opts.snapOff?'false':'true'],['FB_VIEWS_METRIC','post_total_media_view_unique'],['ANALYTICS_ENABLED','false'],['HEALTH_ENABLED','false'],['REPORT_ENABLED','false'],['COMMENTS_ENABLED','false'],['IG_ENABLED','false'],['IG_REELS_ENABLED','false']].concat(opts.settings||[]));
  if(opts.analytics)add('Analytics',opts.analytics);
  if(opts.snapshots!==false)add('Snapshots',[['المنصة','النوع','رقم','ID','اللقطة']]);
  const props=Object.assign({CHAT_ID:'1',TG_TOKEN:'x',FB_PAGE_TOKEN:'y'},opts.props||{});
  const log={tg:[],fbPosts:[],graph:[],reel:[]};
  const net=opts.net||{};
  let docLockHeld=!!opts.docLockHeld;
  const ctx={console,JSON,Math,
   SpreadsheetApp:{getActive:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>{if(net.insertFails)throw new Error('insert denied');return add(n,[])}}),getUi:()=>({alert(){}})},
   PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]===undefined?null:props[k],setProperty:(k,v)=>{props[k]=String(v)},deleteProperty:k=>{delete props[k]},getProperties:()=>props})},
   LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}}),getDocumentLock:()=>({tryLock:()=>!docLockHeld&&(docLockHeld=true),releaseLock(){docLockHeld=false}})},
   Utilities:{formatDate:(d,tz,f)=>{const t=new Date(d.getTime()+2*3600e3);const p=n=>String(n).padStart(2,'0');
     const Y=t.getUTCFullYear(),M=p(t.getUTCMonth()+1),D=p(t.getUTCDate()),H=t.getUTCHours(),mi=p(t.getUTCMinutes());
     if(tz==='UTC'&&f==='yyyy-MM-dd')return d.toISOString().slice(0,10);
     return f==='H'?String(H):f==='u'?String(t.getUTCDay()||7):f==='yyyy-MM-dd'?`${Y}-${M}-${D}`:f==='yyyy-ww'?'2026-47':`${Y}-${M}-${D} ${p(H)}:${mi}`},
     parseDate:(s)=>{const[a,b]=s.split(' ');const[y,m,dd]=a.split('-');const[h,mi]=b.split(':');return new Date(Date.UTC(+y,+m-1,+dd,+h-2,+mi))},
     base64EncodeWebSafe:x=>'b',sleep(){},computeDigest:()=>[1],DigestAlgorithm:{MD5:1},newBlob:()=>({})},
   DriveApp:{getFileById:()=>({getBlob:()=>({getBytes:()=>[],setBytes(){},getContentType:()=>'image/png'})})},
   ScriptApp:{getProjectTriggers:()=>[{getHandlerFunction:()=>'dailyJob'},{getHandlerFunction:()=>'pollTelegram'}]},
   CacheService:{getScriptCache:()=>({get:()=>null,put(){}})},
   UrlFetchApp:{fetch:(url,o)=>{
     if(url.indexOf('api.telegram.org')>=0){
       if(net.tgThrow)throw new Error('Address unavailable (telegram)');
       const p=(o&&o.payload)||{};log.tgRaw=(log.tgRaw||[]).concat([p]);log.tg.push(p.text||(p.photo?'[photo] '+(p.caption||'').slice(0,20):url.split('/').pop()));
       if(url.indexOf('getUpdates')>=0)return{getContentText:()=>JSON.stringify({ok:true,result:opts.updates?opts.updates.splice(0):[]})};
       return{getContentText:()=>net.tgHttpError?'{"ok":false,"description":"Bad Request"}':'{"ok":true,"result":{"message_id":'+(100+log.tg.length)+'}}'}}
     if(url.indexOf('/photos')>=0){ // نشر بوست فيسبوك
       log.fbPosts.push(o.payload.caption.slice(0,25));
       if(net.fbTimeoutAfterPost)throw new Error('Timeout: graph.facebook.com');
       if(net.fbError)return{getContentText:()=>'{"error":{"message":"Invalid token","code":190}}'};
       if(net.fbTransient)return{getContentText:()=>'{"error":{"message":"Service temporarily unavailable","code":2,"is_transient":true}}'};
       if(net.fbHtml)return{getContentText:()=>'<html>502 Bad Gateway</html>'};
       if(net.fbNoId)return{getContentText:()=>'{}'};
       return{getContentText:()=>'{"post_id":"P_'+log.fbPosts.length+'"}'}}
     if(url.indexOf('/video_reels')>=0){log.reel.push(o.payload.upload_phase);return{getContentText:()=>o.payload.upload_phase==='start'?'{"video_id":"V1"}':'{"success":true}'}}
     if(url.indexOf('rupload.facebook.com')>=0)return{getContentText:()=>'{"success":true}'};
     if(url.indexOf('V1?fields=status')>=0){if(net.reelStatusThrow)throw new Error('Timeout: graph.facebook.com');return{getContentText:()=>'{"status":{}}'}}
     log.graph.push(url.split('?')[0].split('/').slice(-2).join('/'));
     if(net.graphError)return{getContentText:()=>'{"error":{"message":"(#100) metric invalid","code":100}}'};
     if(url.indexOf('/insights')>=0){ if(net.metricError)return{getContentText:()=>'{"error":{"message":"(#100) invalid metric","code":100}}'};
       return{getContentText:()=>'{"data":[{"values":[{"value":500}]}]}'}}
     if(url.indexOf('followers_count')>=0)return{getContentText:()=>'{"followers_count":1200}'};
     if(url.indexOf('video_insights')>=0)return{getContentText:()=>'{"data":[{"values":[{"value":300}]}]}'};
     return{getContentText:()=>'{"created_time":"2026-11-16T15:30:00+0000","reactions":{"summary":{"total_count":40}},"comments":{"summary":{"total_count":5}},"shares":{"count":3},"likes":{"summary":{"total_count":20}}}'};
   }},
  };
  let nowIso=opts.now||'2026-11-18T15:05:00Z';
  ctx.Date=class extends Date{constructor(...a){a.length?super(...a):super(nowIso)}static now(){return new Date(nowIso).getTime()}};
  ctx.Date.UTC=Date.UTC;
  vm.createContext(ctx);
  for(const f of opts.files)vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
  return{ctx,sheets,props,log,net,setNow:x=>{nowIso=x},holdDocLock:v=>{docLockHeld=v}};
}
module.exports={makeEnv};
