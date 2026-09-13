(function(root){
  'use strict';
  const FIELDS=['spend','clicks','visits','conversions','revenue','other'];
  const empty=()=>({app:'lp-note',schema:1,lps:[],versions:[],records:[]});
  const day=d=>{const t=new Date(d+'T00:00:00Z');return /^20\d\d-\d\d-\d\d$/.test(d)&&Number.isFinite(+t)&&t.toISOString().slice(0,10)===d;};
  const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const diff=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const ratio=(a,b,k=1)=>b>0?a/b*k:null;
  function sum(rows){const t=Object.fromEntries(FIELDS.map(k=>[k,0]));for(const r of rows)for(const k of FIELDS)t[k]+=r[k];return {...t,days:rows.length,profit:t.revenue-t.spend-t.other,cpc:ratio(t.spend,t.clicks),cpv:ratio(t.spend,t.visits),cpa:ratio(t.spend,t.conversions),cvr:ratio(t.conversions,t.clicks,100),sendRate:ratio(t.visits,t.clicks,100),closeRate:ratio(t.conversions,t.visits,100),roas:ratio(t.revenue,t.spend,100),margin:ratio(t.revenue-t.spend-t.other,t.revenue,100)};}
  function validate(d){
    const fail=m=>{throw Error(m);};
    if(!d||d.app!=='lp-note'||d.schema!==1||!['lps','versions','records'].every(k=>Array.isArray(d[k])))fail('LP Noteのバックアップではありません。');
    if(d.lps.length>500||d.versions.length>5000||d.records.length>10000)fail('上限（LP 500件・履歴5,000件・実績10,000件）を超えています。');
    const str=(s,n=200)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
    const ids=new Set();for(const list of [d.lps,d.versions,d.records])for(const r of list){if(!r||!str(r.id,100)||ids.has(r.id))fail('IDが不正または重複しています。');ids.add(r.id);}
    const lpids=new Set(d.lps.map(l=>l.id));
    const url=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&s.length<=2000;}catch{return false;}};
    for(const l of d.lps){
      if(!str(l.name,100))fail('LP名を100文字以内で入力してください。');
      if(l.favorite!==undefined&&typeof l.favorite!=='boolean')fail('お気に入りの形式が不正です。');
      if(l.status!==undefined&&!['','continue','watch','revise'].includes(l.status))fail('判断ステータスが不正です。');
      if(l.nextMemo!==undefined&&(typeof l.nextMemo!=='string'||l.nextMemo.length>2000))fail('次の修正メモは2,000文字以内で入力してください。');
    }
    const keys=new Set();for(const v of d.versions){
      if(!lpids.has(v.lpId)||!str(v.label,60)||!str(v.owner,100)||!str(v.note,2000)||!day(v.date)||!url(v.url))fail('変更履歴の担当者・バージョン・日付・URL・内容を確認してください。');
      for(const k of [v.lpId+'@'+v.date,v.lpId+'#'+v.label]){if(keys.has(k))fail('同じLPの公開日・バージョン名は重複できません。1日1バージョンです。');keys.add(k);}
    }
    for(const l of d.lps)if(!d.versions.some(v=>v.lpId===l.id))fail('LPには初版の情報が必要です。');
    const recKeys=new Set();for(const r of d.records){
      if(!lpids.has(r.lpId)||!day(r.date)||r.date>today()||typeof r.memo!=='string'||r.memo.length>1000)fail('実績の日付・LP・メモを確認してください。未来日の実績は登録できません。');
      if(FIELDS.some(k=>!Number.isSafeInteger(r[k])||r[k]<0||r[k]>(['clicks','visits','conversions'].includes(k)?1e9:1e10)))fail('金額・件数は範囲内の0以上の整数にしてください。');
      if(!versionAt(d,r.lpId,r.date))fail('初版公開日より前の実績は登録できません。');
      const key=r.lpId+'@'+r.date;if(recKeys.has(key))fail('このLP・日付の実績は登録済みです。既存の実績を編集してください。');recKeys.add(key);
    }
    return d;
  }
  const versions=(d,id)=>d.versions.filter(v=>v.lpId===id).sort((a,b)=>a.date.localeCompare(b.date));
  const versionAt=(d,id,date)=>versions(d,id).filter(v=>v.date<=date).at(-1);
  function comparison(d,id,versionId,window=7,asOf=today()){
    const vs=versions(d,id),i=vs.findIndex(v=>v.id===versionId),v=vs[i];
    if(i<=0)return {available:false,reason:'初版のため、変更前の比較対象がありません。'};
    const prev=vs[i-1],next=vs[i+1],last=shift(asOf,-1);
    const n=Math.max(0,Math.min(window,diff(v.date,prev.date),diff(last,v.date)+1,next?diff(next.date,v.date):window));
    if(!n)return {available:false,reason:'変更後の集計は公開翌日から確認できます（当日は比較対象外）。'};
    const beforeStart=shift(v.date,-n),beforeEnd=shift(v.date,-1),afterStart=v.date,afterEnd=shift(v.date,n-1);
    const rows=d.records.filter(r=>r.lpId===id),before=sum(rows.filter(r=>r.date>=beforeStart&&r.date<=beforeEnd)),after=sum(rows.filter(r=>r.date>=afterStart&&r.date<=afterEnd));
    return {available:true,n,beforeStart,beforeEnd,afterStart,afterEnd,before,after,complete:before.days===n&&after.days===n};
  }
  function daily(d,asOf=today()){
    const beforeStart=shift(asOf,-14),beforeEnd=shift(asOf,-8),afterStart=shift(asOf,-7),afterEnd=shift(asOf,-1);
    const grouped=new Map(d.lps.map(l=>[l.id,[]]));for(const r of d.records)grouped.get(r.lpId)?.push(r);
    return d.lps.map(lp=>{
      const rows=grouped.get(lp.id),current=versionAt(d,lp.id,asOf),record=rows.find(r=>r.date===asOf),previous=rows.filter(r=>r.date<asOf).sort((a,b)=>b.date.localeCompare(a.date))[0];
      const before=sum(rows.filter(r=>r.date>=beforeStart&&r.date<=beforeEnd)),after=sum(rows.filter(r=>r.date>=afterStart&&r.date<=afterEnd));
      const complete=before.days===7&&after.days===7,delta=complete?after.profit-before.profit:null;
      const trend=!current?'scheduled':!complete?'insufficient':delta<0?'bad':delta>0?(after.profit<0?'recovering':'good'):'flat';
      return {lp,current,record,previous,before,after,complete,delta,trend,beforeStart,beforeEnd,afterStart,afterEnd};
    });
  }
  function sample(){const d=empty(),t=today(),start=shift(t,-28);for(let i=0;i<3;i++){
    const id='demo-lp-'+i;d.lps.push({id,name:['スピード申込 LP','安心サポート LP','スマホ専用 LP'][i],favorite:i<2,status:['continue','watch','revise'][i],nextMemo:['申込ボタンの文言を短くする。','よくある質問をフォームの直前へ。','スマホの冒頭でメリットを伝える。'][i]});
    d.versions.push({id:id+'-v1',lpId:id,label:'v1.0',date:start,owner:['小山','佐藤','田中'][i],url:'https://example.com/lp-'+(i+1),note:'初版公開。基本構成で配信を開始。'}, {id:id+'-v2',lpId:id,label:'v1.1',date:shift(t,-14),owner:['小山','佐藤','田中'][i],url:'https://example.com/lp-'+(i+1),note:['ファーストビューの見出しを短くし、申込ボタンを追加。','入力フォームを5項目から3項目へ短縮。','キービジュアルと訴求を変更。'][i]});
    for(let j=0;j<28;j++){const improve=j>=14,conv=[improve?10:6,improve?8:5,improve?3:5][i]+j%3+(j>=21?[2,0,-2][i]:0);d.records.push({id:id+'-r'+j,lpId:id,date:shift(start,j),spend:4000+i*800+j%3*100,clicks:180+i*20,visits:40+conv*2,conversions:conv,revenue:conv*1100,other:500,memo:''});}
    }return validate(d);}
  const api={FIELDS,empty,day,shift,diff,today,ratio,sum,validate,versions,versionAt,comparison,daily,sample};
  if(typeof module!=='undefined')module.exports=api;else root.LP=api;
})(typeof window!=='undefined'?window:globalThis);
