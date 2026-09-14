(function(root){
  'use strict';
  const KEY='osanai-work-dock-v1';
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const uid=()=>globalThis.crypto.randomUUID();
  function url(value){let s=value.trim();if(!/^[a-z][a-z0-9+.-]*:/i.test(s))s='https://'+s;const u=new URL(s);if(!['http:','https:'].includes(u.protocol)||!u.hostname||u.username||u.password)throw Error('http / https のURLを入力してください。');return u.href;}
  const defaults=[
    ['CRM','顧客・LINE対応の管理','https://hso-hab.github.io/osanai-line-crm/?v=integrated-12'],
    ['LP Note','LP管理・実績の入力','https://hso-hab.github.io/osanai-lp-manager/?v=1.2'],
    ['広告管理（Ad Note）','広告の実績・収支管理','https://hso-hab.github.io/osanai-ad-manager/?v=1.1']
  ];
  const siteKey=value=>{const u=new URL(url(value));return u.origin+u.pathname.replace(/\/$/,'');};
  function upgrade(d){
    if(d.defaultsVersion===1&&d.routines!==undefined)return d;
    const next=structuredClone(d),existing=new Set(next.items.filter(i=>i.type==='link').map(i=>siteKey(i.url)));
    if(d.defaultsVersion!==1)for(const [title,body,href] of defaults)if(!existing.has(siteKey(href))&&next.items.length<10000){next.items.push({id:uid(),type:'link',title,body,url:href,date:'',done:false,favorite:true,created:Date.now()});}
    if(next.routines===undefined)next.routines=[['朝',[['CRMの要対応を確認','app:crm'],['今日の予定を整理','view:task']]],['日中',[['顧客対応を進める','app:crm']]],['締め作業',[['LP実績を入力','app:lp'],['広告実績を入力','app:ad'],['バックアップを保存','backup']]]].map(([name,steps])=>({id:uid(),name,steps:steps.map(([title,target])=>({id:uid(),title,target,completedOn:''}))}));
    next.defaultsVersion=1;return next;
  }
  const initial=()=>upgrade({app:'work-dock',version:1,items:[]});
  function dayOffset(days){const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  const waiting=i=>['waiting','review'].includes(i.status);
  const bucket=i=>i.done?'done':waiting(i)?'waiting':i.plannedOn>today()?'deferred':i.date<today()?'overdue':(i.date===today()||i.plannedOn&&i.plannedOn<=today())?'today':i.date===dayOffset(1)?'tomorrow':'later';
  function validate(d){
    if(!d||d.app!=='work-dock'||d.version!==1||!Array.isArray(d.items)||d.items.length>10000)throw Error('Work Dockのバックアップではないか、件数が上限を超えています。');
    if(d.defaultsVersion!==undefined&&d.defaultsVersion!==1)throw Error('初期リンク情報の形式が正しくありません。');
    if(d.homePrefs!==undefined&&(!d.homePrefs||Array.isArray(d.homePrefs)||typeof d.homePrefs!=='object'||Object.values(d.homePrefs).some(v=>typeof v!=='boolean')))throw Error('ホームの表示設定が正しくありません。');
    const ids=new Set();
    for(const i of d.items){
      if(!i||typeof i.id!=='string'||!i.id||i.id.length>100||ids.has(i.id))throw Error('項目IDが不正です。');ids.add(i.id);
      if(!['link','task','template','note'].includes(i.type)||typeof i.title!=='string'||!i.title.trim()||i.title.length>120||typeof i.body!=='string'||i.body.length>20000||typeof i.url!=='string'||i.url.length>4000||typeof i.date!=='string'||typeof i.done!=='boolean'||typeof i.favorite!=='boolean'||!Number.isFinite(i.created))throw Error('項目の形式が正しくありません。');
      for(const field of ['order','favoriteOrder','lastUsed','useCount','homeOrder'])if(i[field]!==undefined&&(!Number.isSafeInteger(i[field])||i[field]<0))throw Error('並び順・利用履歴の形式が正しくありません。');
      for(const [field,max] of [['category',40],['actionTarget',120],['sourceId',100]])if(i[field]!==undefined&&(typeof i[field]!=='string'||i[field].length>max))throw Error('カテゴリ・関連作業の形式が正しくありません。');
      if(i.homeOrderDay!==undefined&&!validDay(i.homeOrderDay))throw Error('作業順の日付が正しくありません。');
      if(i.completedOn!==undefined&&i.completedOn!==''&&!validDay(i.completedOn))throw Error('完了日の形式が正しくありません。');
      if(i.type==='link')url(i.url);
      if(i.type==='task'&&(!/^\d{4}-\d{2}-\d{2}$/.test(i.date)||!Number.isFinite(Date.parse(i.date))||new Date(i.date).toISOString().slice(0,10)!==i.date))throw Error('タスクの日付が正しくありません。');
      if(i.type==='template'&&!i.body.trim())throw Error('定型文の本文が空です。');
    }
    if(d.routines!==undefined){
      if(!Array.isArray(d.routines)||d.routines.length>30)throw Error('作業グループは30件以内にしてください。');
      const routineIds=new Set();
      for(const r of d.routines){
        if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||routineIds.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>40||!Array.isArray(r.steps)||r.steps.length>50)throw Error('作業グループの形式が正しくありません。');routineIds.add(r.id);
        for(const s of r.steps){if(!s||typeof s.id!=='string'||!s.id||s.id.length>100||routineIds.has(s.id)||typeof s.title!=='string'||!s.title.trim()||s.title.length>120||typeof s.target!=='string'||s.target.length>120||typeof s.completedOn!=='string'||s.completedOn!==''&&!validDay(s.completedOn))throw Error('定型作業の形式が正しくありません。');routineIds.add(s.id);}
      }
    }validateFlow(d);validateMomentum(d);return d;
  }
  function sorted(items,field='order'){return [...items].sort((a,b)=>(a[field]??Number.MAX_SAFE_INTEGER)-(b[field]??Number.MAX_SAFE_INTEGER)||Number(b.favorite)-Number(a.favorite)||Number(a.done)-Number(b.done)||b.created-a.created||a.id.localeCompare(b.id));}
  function validDay(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
  function todayTasks(items){
    const day=today(),rows=sorted(items.filter(i=>i.type==='task'&&!i.done&&!waiting(i)&&!(i.plannedOn>day)&&(i.date<=day||i.plannedOn&&i.plannedOn<=day))).sort((a,b)=>Number(b.date<day)-Number(a.date<day)||(b.priority||0)-(a.priority||0)||Number(stale(b))-Number(stale(a))||a.date.localeCompare(b.date));
    // Manual order is only for this day; date/priority warnings remain unchanged.
    return rows.sort((a,b)=>(a.homeOrderDay===day?(a.homeOrder??Number.MAX_SAFE_INTEGER):Number.MAX_SAFE_INTEGER)-(b.homeOrderDay===day?(b.homeOrder??Number.MAX_SAFE_INTEGER):Number.MAX_SAFE_INTEGER));
  }
  function addDays(day,n){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function validateResources(r){
    if(r===undefined)return;
    if(!r||!Array.isArray(r.urls)||r.urls.length>20||!Array.isArray(r.itemIds)||r.itemIds.length>50||typeof r.template!=='string'||r.template.length>20000||typeof r.note!=='string'||r.note.length>20000)throw Error('作業セットの形式が正しくありません。');
    for(const u of r.urls){if(typeof u!=='string'||u.length>4000)throw Error('URLが長すぎます。');url(u);}
    if(r.itemIds.some(id=>typeof id!=='string'||id.length>100))throw Error('関連項目の形式が正しくありません。');
  }
  function validateFlow(d){
    for(const i of d.items){
      if(i.priority!==undefined&&![0,1,2].includes(i.priority))throw Error('重要度が正しくありません。');
      for(const key of ['repeatId','followUpOf'])if(i[key]!==undefined&&(typeof i[key]!=='string'||i[key].length>100))throw Error('関連タスク情報が正しくありません。');
      if(i.repeatDate!==undefined&&!validDay(i.repeatDate))throw Error('繰り返し日が正しくありません。');
      validateResources(i.resources);
    }
    const ids=new Set();
    for(const key of ['schedules','worksets']){
      if(d[key]===undefined)continue;
      if(!Array.isArray(d[key])||d[key].length>200)throw Error('繰り返し・セットは各200件までです。');
      for(const r of d[key]){
        if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||ids.has(r.id))throw Error('繰り返し・セットIDが不正です。');ids.add(r.id);
        if(key==='worksets'){if(typeof r.name!=='string'||!r.name.trim()||r.name.length>120)throw Error('セット名を入力してください。');validateResources(r.resources);if(!r.resources)throw Error('セット内容がありません。');}
        else {if(!['daily','weekly'].includes(r.frequency)||!validDay(r.nextDate)||typeof r.active!=='boolean')throw Error('繰り返し設定が正しくありません。');validate({app:'work-dock',version:1,items:[r.task]});if(r.task.type!=='task')throw Error('繰り返し元がタスクではありません。');}
      }
    }
  }
  function materialize(d,day=today()){
    if(!(d.schedules||[]).some(r=>r.active&&r.nextDate<=day))return d;
    const next=structuredClone(d),existing=new Set(next.items.filter(i=>i.repeatId).map(i=>i.repeatId+':'+i.repeatDate));
    for(const r of next.schedules){while(r.active&&r.nextDate<=day){
      const key=r.id+':'+r.nextDate;
      if(!existing.has(key)){
        if(next.items.length>=10000)throw Error('タスクが上限に達しました。バックアップ後、不要な完了履歴を整理してください。');
        next.items.push({...freshTask(r.task),id:uid(),date:r.nextDate,done:false,completedOn:'',created:Date.now(),repeatId:r.id,repeatDate:r.nextDate});existing.add(key);
      }
      r.nextDate=addDays(r.nextDate,r.frequency==='daily'?1:7);
    }}return next;
  }
  function localDay(ms){const d=new Date(ms);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function stale(i,day=today()){return !i.done&&localDay(i.touchedAt??i.created)<=addDays(day,-3);}
  function attention(items){return todayTasks(items).concat(sorted(items.filter(i=>i.type==='task'&&!i.done&&!waiting(i)&&!(i.plannedOn>today())&&i.date>today()&&!(i.plannedOn&&i.plannedOn<=today())&&(i.date<=dayOffset(3)||stale(i)))).sort((a,b)=>a.date.localeCompare(b.date)||(b.priority||0)-(a.priority||0)));}
  function freshTask(source){const i=structuredClone(source);for(const k of ['plannedOn','touchedAt','waitNote','repeatId','repeatDate','followUpOf','order','homeOrder','homeOrderDay','completedOn'])delete i[k];i.status='ready';i.done=false;return i;}
  function validateMomentum(d){
    for(const i of d.items){
      if(i.status!==undefined&&!['ready','waiting','review'].includes(i.status))throw Error('タスクの状態が正しくありません。');
      if(i.plannedOn!==undefined&&i.plannedOn!==''&&!validDay(i.plannedOn))throw Error('作業予定日が正しくありません。');
      if(i.touchedAt!==undefined&&(!Number.isSafeInteger(i.touchedAt)||i.touchedAt<0))throw Error('最終作業日時が正しくありません。');
      if(i.waitNote!==undefined&&(typeof i.waitNote!=='string'||i.waitNote.length>300))throw Error('待ちのメモは300文字までです。');
    }
    if(d.timeEntries!==undefined){
      if(!Array.isArray(d.timeEntries)||d.timeEntries.length>50000)throw Error('時間記録は5万件までです。');
      const ids=new Set();for(const e of d.timeEntries){if(!e||typeof e.id!=='string'||!e.id||e.id.length>100||ids.has(e.id)||typeof e.taskId!=='string'||!e.taskId||e.taskId.length>100||typeof e.title!=='string'||e.title.length>120||!validDay(e.day)||!Number.isSafeInteger(e.seconds)||e.seconds<=0||e.seconds>86400)throw Error('時間記録の形式が正しくありません。');ids.add(e.id);}
    }
    if(d.timer!=null&&(!d.timer||typeof d.timer.taskId!=='string'||!d.items.some(i=>i.id===d.timer.taskId&&i.type==='task'&&!i.done&&!waiting(i))||!Number.isSafeInteger(d.timer.startedAt)||d.timer.startedAt<0||d.timer.startedAt>8640000000000000))throw Error('計測中のタスク情報が正しくありません。');
  }
  function stopTimer(d,now=Date.now()){
    if(!d.timer)return;const {taskId,startedAt}=d.timer,item=d.items.find(i=>i.id===taskId);let from=startedAt;
    if(now<from)throw Error('時計が開始時刻より前です。時間記録から計測を取り消して手入力してください。');
    const entries=[];while(from<now){const midnight=new Date(from);midnight.setHours(24,0,0,0);const to=Math.min(now,midnight.getTime()),seconds=Math.floor((to-from)/1000);if(seconds)entries.push({id:uid(),taskId,title:item?.title||'削除済みタスク',day:localDay(from),seconds});from=to;if(entries.length>50000)throw Error('計測期間が長すぎます。計測を取り消して手入力してください。');}
    d.timeEntries??=[];d.timeEntries.push(...entries);d.timer=null;if(item)item.touchedAt=now;
  }
  function weekSummary(d,day=today()){
    const weekday=new Date(day+'T12:00:00').getDay(),start=addDays(day,-((weekday+6)%7)),end=addDays(start,6),tasks=d.items.filter(i=>i.type==='task');
    const done=tasks.filter(i=>i.done&&i.completedOn>=start&&i.completedOn<=end),remaining=tasks.filter(i=>!i.done&&i.date<=end&&localDay(i.created)<=end),totals=new Map();
    for(const e of d.timeEntries||[])if(e.day>=start&&e.day<=end){const row=totals.get(e.taskId)||{id:e.taskId,title:tasks.find(i=>i.id===e.taskId)?.title||e.title,seconds:0};row.seconds+=e.seconds;totals.set(e.taskId,row);}
    return {start,end,done,remaining,time:[...totals.values()].sort((a,b)=>b.seconds-a.seconds)};
  }
  const api={waiting,localDay,stale,attention,freshTask,stopTimer,weekSummary,addDays,materialize,validateResources,KEY,today,uid,url,initial,upgrade,dayOffset,bucket,validate,sorted,validDay,todayTasks};if(typeof module!=='undefined')module.exports=api;else root.Dock=api;
})(globalThis);
