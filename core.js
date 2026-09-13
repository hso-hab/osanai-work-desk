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
  const bucket=i=>i.done?'done':i.date<today()?'overdue':i.date===today()?'today':i.date===dayOffset(1)?'tomorrow':'later';
  function validate(d){
    if(!d||d.app!=='work-dock'||d.version!==1||!Array.isArray(d.items)||d.items.length>10000)throw Error('Work Dockのバックアップではないか、件数が上限を超えています。');
    if(d.defaultsVersion!==undefined&&d.defaultsVersion!==1)throw Error('初期リンク情報の形式が正しくありません。');
    const ids=new Set();
    for(const i of d.items){
      if(!i||typeof i.id!=='string'||!i.id||i.id.length>100||ids.has(i.id))throw Error('項目IDが不正です。');ids.add(i.id);
      if(!['link','task','template','note'].includes(i.type)||typeof i.title!=='string'||!i.title.trim()||i.title.length>120||typeof i.body!=='string'||i.body.length>20000||typeof i.url!=='string'||i.url.length>4000||typeof i.date!=='string'||typeof i.done!=='boolean'||typeof i.favorite!=='boolean'||!Number.isFinite(i.created))throw Error('項目の形式が正しくありません。');
      for(const field of ['order','favoriteOrder','lastUsed','useCount'])if(i[field]!==undefined&&(!Number.isSafeInteger(i[field])||i[field]<0))throw Error('並び順・利用履歴の形式が正しくありません。');
      for(const [field,max] of [['category',40],['actionTarget',120],['sourceId',100]])if(i[field]!==undefined&&(typeof i[field]!=='string'||i[field].length>max))throw Error('カテゴリ・関連作業の形式が正しくありません。');
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
    }return d;
  }
  function sorted(items,field='order'){return [...items].sort((a,b)=>(a[field]??Number.MAX_SAFE_INTEGER)-(b[field]??Number.MAX_SAFE_INTEGER)||Number(b.favorite)-Number(a.favorite)||Number(a.done)-Number(b.done)||b.created-a.created||a.id.localeCompare(b.id));}
  function validDay(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
  const todayTasks=items=>sorted(items.filter(i=>i.type==='task'&&!i.done&&i.date<=today())).sort((a,b)=>a.date.localeCompare(b.date));
  const api={KEY,today,uid,url,initial,upgrade,dayOffset,bucket,validate,sorted,validDay,todayTasks};if(typeof module!=='undefined')module.exports=api;else root.Dock=api;
})(globalThis);
