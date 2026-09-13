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
    if(d.defaultsVersion===1)return d;
    const next=structuredClone(d),existing=new Set(next.items.filter(i=>i.type==='link').map(i=>siteKey(i.url)));
    for(const [title,body,href] of defaults)if(!existing.has(siteKey(href))&&next.items.length<10000){next.items.push({id:uid(),type:'link',title,body,url:href,date:'',done:false,favorite:true,created:Date.now()});}
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
      if(i.type==='link')url(i.url);
      if(i.type==='task'&&(!/^\d{4}-\d{2}-\d{2}$/.test(i.date)||!Number.isFinite(Date.parse(i.date))||new Date(i.date).toISOString().slice(0,10)!==i.date))throw Error('タスクの日付が正しくありません。');
      if(i.type==='template'&&!i.body.trim())throw Error('定型文の本文が空です。');
    }return d;
  }
  function sorted(items,field='order'){return [...items].sort((a,b)=>(a[field]??Number.MAX_SAFE_INTEGER)-(b[field]??Number.MAX_SAFE_INTEGER)||Number(b.favorite)-Number(a.favorite)||Number(a.done)-Number(b.done)||b.created-a.created||a.id.localeCompare(b.id));}
  const api={KEY,today,uid,url,initial,upgrade,dayOffset,bucket,validate,sorted};if(typeof module!=='undefined')module.exports=api;else root.Dock=api;
})(globalThis);
