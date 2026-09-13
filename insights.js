(function(root){
  'use strict';
  const apps={
    crm:{name:'CRM',key:'osanai-line-crm-demo-v1',url:'https://hso-hab.github.io/osanai-line-crm/?v=integrated-12'},
    lp:{name:'LP Note',key:'osanai-lp-note-v1',url:'https://hso-hab.github.io/osanai-lp-manager/?v=1.2'},
    ad:{name:'広告管理',key:'osanai-ad-manager-v1',url:'https://hso-hab.github.io/osanai-ad-manager/?v=1.1'}
  };
  // Only read these three existing keys. Never fetch, seed, migrate, or write source data.
  function read(storage,day){
    return Object.entries(apps).map(([id,app])=>{
      const base={id,...app};
      try{
        const raw=storage.getItem(app.key);if(raw===null)return {...base,state:'missing',metrics:[],alerts:[]};
        const d=JSON.parse(raw);let metrics,alerts=[];
        if(id==='crm'){
          if(!Array.isArray(d)||d.length>50000||!d.every(c=>c&&typeof c.id==='string'&&typeof c.name==='string'&&['new','active','waiting','done'].includes(c.status)&&typeof c.owner==='string'&&typeof c.due==='string'&&(!c.due||Dock.validDay(c.due))&&typeof c.next==='string')||new Set(d.map(c=>c.id)).size!==d.length)throw Error('schema');
          const due=d.filter(c=>c.status!=='done'&&c.due&&c.due<=day).length,late=d.filter(c=>c.status!=='done'&&c.due&&c.due<day).length;
          metrics=[['未対応',d.filter(c=>c.status==='new').length],['今日までの要対応',due],['担当未設定',d.filter(c=>c.status!=='done'&&!c.owner).length]];
          if(due)alerts.push({title:`CRM：今日までの要対応 ${due}件${late?`（期限切れ ${late}件）`:''}`,target:'app:crm',urgent:!!late});
          if(!due&&metrics[0][1])alerts.push({title:`CRM：未対応 ${metrics[0][1]}件`,target:'app:crm',urgent:false});
        }else if(id==='lp'){
          root.LP.validate(d);
          const daily=root.LP.daily(d,day),active=daily.filter(l=>l.current),missing=active.filter(l=>!l.record).length,rows=d.records.filter(r=>r.date===day),total=root.LP.sum(rows);
          metrics=[['今日未入力',missing],['修正候補',d.lps.filter(l=>l.status==='revise').length],['今日の入力済み利益',rows.length?total.profit:null,'yen']];
          base.detail=`今日 ${active.length-missing}/${active.length} LP入力済み`;
          if(missing)alerts.push({title:`LP Note：今日未入力 ${missing}件`,target:'app:lp',urgent:false});
          if(metrics[1][1])alerts.push({title:`LP Note：修正候補 ${metrics[1][1]}件`,target:'app:lp',urgent:false});
        }else{
          const parsed=root.AdCore.parseState(raw),rows=parsed.records.filter(r=>r.date===day),total=root.AdCore.total(rows);
          metrics=[['今日の広告費',rows.length?total.spend:null,'yen'],['今日の成果',rows.length?total.conversions:null],['今日の利益',rows.length?total.profit:null,'yen']];
          base.detail=rows.length?`今日 ${rows.length}件の入力分`:'今日の実績は未入力';
          if(!rows.length)alerts.push({title:'広告管理：今日の実績を入力',target:'app:ad',urgent:false});
        }
        return {...base,state:'ready',metrics,alerts};
      }catch{return {...base,state:'error',metrics:[],alerts:[]};}
    });
  }
  root.DockInsights={apps,read};
})(globalThis);
