'use strict';
let homeInsights=[],homeChecked='',homeGroup=null,homeCompleted='',homeSourceId='',templateCategory='',routineDraft=null,routineExpectedRaw=null,routineInitial='';
const homeNumber=n=>n===null?'—':new Intl.NumberFormat('ja-JP').format(n);
function targetOptions(selected=''){
  const options=[['','なし'],...Object.entries(DockInsights.apps).map(([id,a])=>['app:'+id,a.name]),['view:task','タスク一覧'],['backup','バックアップ'],...data.items.filter(i=>['link','template','note'].includes(i.type)).map(i=>['item:'+i.id,`${labels[i.type]}：${i.title}`])];
  if(selected&&!options.some(([key])=>key===selected))options.push([selected,'登録先が削除されています']);
  return options.map(([key,title])=>`<option value="${esc(key)}" ${selected===key?'selected':''}>${esc(title)}</option>`).join('');
}
function targetControl(target,label='開く ↗',extra=''){
  if(target.startsWith('app:')){const app=DockInsights.apps[target.slice(4)];if(app)return `<a class="work-launch" data-open-app="${target.slice(4)}" href="${app.url}" target="_blank" rel="noopener noreferrer" ${extra}>${esc(label)}</a>`;}
  if(target.startsWith('item:')){const i=find(target.slice(5));if(!i)return '<span class="missing-target">登録先なし</span>';if(i.type==='link')return `<a class="work-launch" data-open-id="${esc(i.id)}" href="${esc(C.url(i.url))}" target="_blank" rel="noopener noreferrer" ${extra}>${esc(label)}</a>`;}
  return `<button class="work-launch" data-run-target="${esc(target)}" ${extra}>${esc(label)}</button>`;
}
function refreshInsights(){
  try{homeInsights=DockInsights.read(localStorage,C.today());}catch{homeInsights=Object.entries(DockInsights.apps).map(([id,a])=>({...a,id,state:'error',metrics:[],alerts:[]}));}
  homeChecked=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
}
function renderMetrics(){
  $('#app-metrics').innerHTML=homeInsights.map(a=>`<article class="metric-app" data-app="${a.id}"><div class="metric-title"><strong>${a.name}</strong>${targetControl('app:'+a.id)}</div>${a.state==='ready'?`<div class="metric-values">${a.metrics.map(([name,value,unit])=>`<div><span>${name}</span><strong class="${value<0?'negative':''}">${value!==null&&unit==='yen'?'¥':''}${homeNumber(value)}</strong></div>`).join('')}</div>${a.detail?`<small>${esc(a.detail)}</small>`:''}`:`<p class="metric-state ${a.state==='error'?'negative':''}">${a.state==='missing'?'このブラウザに保存データなし':'データを読み取れません。元アプリで確認してください。'}</p>`}</article>`).join('');
  $('#insight-time').textContent=homeChecked+' 確認';
  $('#app-alerts').innerHTML=homeInsights.flatMap(a=>a.alerts).sort((a,b)=>Number(b.urgent)-Number(a.urgent)).map(a=>`<div class="app-alert ${a.urgent?'urgent':''}"><span>${esc(a.title)}</span>${targetControl(a.target,'対応する ↗')}</div>`).join('');
}
function homeTaskRow(i){return `<article class="home-task ${C.bucket(i)==='overdue'?'is-overdue':''}" data-home-task="${esc(i.id)}">${todayHandle(i)}<button class="task-toggle" data-action="toggle" data-id="${esc(i.id)}" aria-label="${esc(i.title)}を完了にする"><span></span></button><div class="home-task-title"><strong>${esc(i.title)}</strong><small>${esc(taskHint(i))}</small></div>${speedRowActions(i)}</article>`;}
function activeRoutine(){const groups=data.routines||[];if(!groups.some(g=>g.id===homeGroup)){const hour=new Date().getHours(),index=hour<12?0:hour<17?1:2;homeGroup=groups[Math.min(index,groups.length-1)]?.id;}return groups.find(g=>g.id===homeGroup);}
function nextHomeTask(){const rows=C.todayTasks(data.items);return rows.find(i=>i.id===data.timer?.taskId)||(manualToday()?rows[0]:rows.find(i=>!i.pausedAt)||rows[0]);}
function renderNext(){
  const host=$('#next-action');host.hidden=!homeCompleted;if(!homeCompleted)return;
  const next=nextHomeTask(),group=activeRoutine(),step=group?.steps.find(s=>s.completedOn!==C.today());
  host.innerHTML=`<div><small>✓ ${esc(homeCompleted)} を完了</small><strong>${next?'次：'+esc(next.title):step?'次：'+esc(step.title):'今日のタスクとこのグループは完了です'}</strong></div>${next?workControl(next,'次の作業へ →'):step?targetControl(step.target||'routine-step:'+step.id,'次の作業へ →'):targetControl('backup','バックアップを保存')}${completedTaskId&&find(completedTaskId)?.done?`<button data-follow-up="${esc(completedTaskId)}">＋ 次の作業を追加</button>`:''}<button id="dismiss-next" class="subtle" aria-label="次の作業案内を閉じる">×</button>`;
}
function renderHome(){
  const visible=view==='all'&&!query;document.body.classList.toggle('home-view',visible);$('#home').hidden=!visible;$('#home-notes').hidden=!visible;
  renderNext();
  if(visible)document.querySelector('.home-grid').append($('#home-access'));else $('#home').after($('#home-access'));
  if(!visible)return;
  const tasks=C.todayTasks(data.items),late=tasks.filter(i=>i.date<C.today()),today=tasks.filter(i=>i.date>=C.today());
  $('#home-count').textContent=tasks.length+'件';
  $('#today-queue').innerHTML=(manualToday()?[['manual','今日の作業順',tasks]]:[['overdue','⚠ 期限切れ',late],['today','今日',today]]).map(([id,title,rows])=>`<section data-home-bucket="${id}"><h3>${title}<span>${rows.length}</span></h3>${rows.length?rows.slice(0,limit['home-'+id]||6).map(homeTaskRow).join('')+(rows.length>(limit['home-'+id]||6)?`<button data-more="home-${id}" class="show-more">さらに20件表示</button>`:''):`<p class="group-empty">${id==='overdue'?'期限切れなし':'今日の未完了タスクはありません'}</p>`}</section>`).join('');
  renderMetrics();renderRoutines();renderNext();renderDailyProgress();renderMomentumHome();
  const notes=C.sorted(data.items.filter(i=>i.type==='note')).slice(0,3);
  $('#home-notes').innerHTML=`<div class="section-heading"><h2>メモから次の仕事へ</h2><div><button data-add="note" class="subtle">＋ メモ</button><button data-view="note" class="subtle">すべて →</button></div></div><div class="home-note-list">${notes.map(i=>`<div class="home-note"><button class="subtle" data-action="read" data-id="${esc(i.id)}">${esc(i.title)}</button><button data-action="note-task" data-id="${esc(i.id)}">タスク化</button></div>`).join('')||'<p class="group-empty">メモを追加すると、ここからタスクにできます。</p>'}</div>`;
}
function renderRoutines(){
  const group=activeRoutine(),groups=data.routines||[],all=groups.flatMap(g=>g.steps),done=all.filter(s=>s.completedOn===C.today()).length;
  $('#routine-progress').textContent=`${done}/${all.length} 完了`;
  $('#routine-tabs').innerHTML=groups.map(g=>`<button data-routine-group="${esc(g.id)}" aria-pressed="${g.id===homeGroup}">${esc(g.name)} <small>${g.steps.filter(s=>s.completedOn===C.today()).length}/${g.steps.length}</small></button>`).join('');
  $('#routine-steps').innerHTML=group?group.steps.map((s,index)=>`<article class="routine-step ${s.completedOn===C.today()?'done':''}" data-step="${esc(s.id)}"><button class="task-toggle" data-step-toggle="${esc(s.id)}" aria-label="${esc(s.title)}を${s.completedOn===C.today()?'未完了に戻す':'完了にする'}" aria-pressed="${s.completedOn===C.today()}"><span>${s.completedOn===C.today()?'✓':''}</span></button><span class="step-index">${index+1}</span><strong>${esc(s.title)}</strong>${s.target?targetControl(s.target,s.target.startsWith('item:')&&find(s.target.slice(5))?.type==='template'?'コピー':'始める'):''}</article>`).join('')||'<p class="group-empty">編集から作業を追加してください。</p>':'<p class="group-empty">編集からグループを追加できます。</p>';
}
function noteToTask(id){
  const note=find(id);if(!note)return;const existing=data.items.find(i=>i.type==='task'&&i.sourceId===id&&!i.done);
  if($('#reader').open)$('#reader').close();
  if(existing){openEditor('task',existing.id);toast('このメモから作成済みのタスクを開きました');return;}
  openEditor('task');homeSourceId=id;$('#item-title').value=note.title;$('#item-body').value=note.body;$('#editor-title').textContent='メモをタスクにする';formStart='note-conversion';
}
function renderTemplateFilter(){
  const cats=[...new Set(data.items.filter(i=>i.type==='template').map(i=>i.category||'未分類'))].sort((a,b)=>a.localeCompare(b,'ja'));
  if(templateCategory&&!cats.includes(templateCategory))templateCategory='';
  return `<div class="category-filter"><label>カテゴリ<select id="template-filter"><option value="">すべて</option>${cats.map(cat=>`<option ${templateCategory===cat?'selected':''} value="${esc(cat)}">${esc(cat)}</option>`).join('')}</select></label></div>`;
}
function syncRoutineDraft(){if(!routineDraft)return;document.querySelectorAll('[data-edit-group]').forEach(el=>{const g=routineDraft.find(g=>g.id===el.dataset.editGroup);g.name=el.querySelector('[data-group-name]').value;el.querySelectorAll('[data-edit-step]').forEach(row=>{const s=g.steps.find(s=>s.id===row.dataset.editStep);s.title=row.querySelector('[data-step-title]').value;s.target=row.querySelector('[data-step-target]').value;});});}
function renderRoutineEditor(){
  $('#routine-edit-list').innerHTML=routineDraft.map((g,gi)=>`<section class="edit-group" data-edit-group="${esc(g.id)}"><div class="edit-group-head"><label>グループ名<input data-group-name maxlength="40" value="${esc(g.name)}"></label><button data-remove-group="${esc(g.id)}" aria-label="グループを削除">削除</button></div>${g.steps.map((s,si)=>`<div class="edit-step" data-edit-step="${esc(s.id)}"><label>作業名<input data-step-title maxlength="120" value="${esc(s.title)}"></label><label>使うアプリ・登録項目<select data-step-target>${targetOptions(s.target)}</select></label><div class="edit-step-actions"><button data-step-up="${esc(s.id)}" ${si===0?'disabled':''} aria-label="作業を上へ">↑</button><button data-step-down="${esc(s.id)}" ${si===g.steps.length-1?'disabled':''} aria-label="作業を下へ">↓</button><button data-remove-step="${esc(s.id)}">削除</button></div></div>`).join('')}<button data-add-step="${esc(g.id)}">＋ 作業</button><button data-group-up="${esc(g.id)}" ${gi===0?'disabled':''} aria-label="グループを上へ">↑ グループ</button></section>`).join('');
}
function openRoutineEditor(){routineDraft=structuredClone(data.routines||[]);routineExpectedRaw=raw;routineInitial=JSON.stringify(routineDraft);$('#routine-error').textContent='';renderRoutineEditor();$('#routine-editor').showModal();}
function routineDirty(){syncRoutineDraft();return routineDraft&&JSON.stringify(routineDraft)!==routineInitial;}
async function closeRoutineEditor(){if(routineDirty()&&!await ask('変更を破棄しますか？','作業グループに未保存の変更があります。','破棄する'))return;$('#routine-editor').close();}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='refresh-insights'){refreshInsights();renderMetrics();toast('保存データを再確認しました');}
  if(b.id==='dismiss-next'){homeCompleted='';renderNext();}
  if(b.id==='reader-task')noteToTask(readerId);
  if(b.dataset.routineGroup){homeGroup=b.dataset.routineGroup;renderRoutines();renderNext();}
  if(b.hasAttribute('data-run-target')){
    const target=b.dataset.runTarget;if(target==='backup')backupOpen();else if(target==='view:task'){view='task';render();}else if(target.startsWith('item:')){const i=find(target.slice(5));if(!i)toast('登録先が削除されています');else if(i.type==='template')copyItem(i.id,b);else openReader(i.id);}else if(target.startsWith('routine-step:')){const el=document.querySelector(`[data-step="${CSS.escape(target.slice(13))}"]`);el?.scrollIntoView({block:'nearest'});el?.querySelector('button')?.focus();}else toast('使うアプリはグループの編集から設定できます');
  }
  if(b.dataset.stepToggle){const id=b.dataset.stepToggle,s=data.routines?.flatMap(g=>g.steps).find(s=>s.id===id);if(!s)return;const completed=s.completedOn!==C.today();completedTaskId='';if(change(d=>{d.routines.flatMap(g=>g.steps).find(s=>s.id===id).completedOn=completed?C.today():'';})){homeCompleted=completed?s.title:'';renderNext();toast(completed?'作業を完了しました':'未完了に戻しました');}}
  if(b.id==='routine-manage')openRoutineEditor();
  if(b.id==='routine-save'){
    syncRoutineDraft();if(raw!==routineExpectedRaw){$('#routine-error').textContent='別タブまたは他の操作で更新されました。変更を控え、開き直してください。';return;}
    try{const next=structuredClone(data);next.routines=routineDraft;C.validate(next);if(save(next))$('#routine-editor').close();else $('#routine-error').textContent='保存できませんでした。入力は残っています。';}catch(err){$('#routine-error').textContent=err.message;}
  }
  if(!b.closest('#routine-editor')||b.id==='routine-save'||b.dataset.close)return;
  syncRoutineDraft();
  if(b.id==='routine-add'){if(routineDraft.length>=30){$('#routine-error').textContent='グループは30件までです';return;}routineDraft.push({id:C.uid(),name:'新しいグループ',steps:[]});}
  if(b.dataset.removeGroup){if(!await ask('グループを削除しますか？','含まれる定型作業も削除します。登録元の項目は残ります。','削除する'))return;routineDraft=routineDraft.filter(g=>g.id!==b.dataset.removeGroup);}
  if(b.dataset.groupUp){const at=routineDraft.findIndex(g=>g.id===b.dataset.groupUp);if(at>0)[routineDraft[at-1],routineDraft[at]]=[routineDraft[at],routineDraft[at-1]];}
  for(const g of routineDraft){
    if(b.dataset.addStep===g.id){if(g.steps.length>=50){$('#routine-error').textContent='各グループの作業は50件までです';return;}g.steps.push({id:C.uid(),title:'新しい作業',target:'',completedOn:''});}
    if(b.dataset.removeStep)g.steps=g.steps.filter(s=>s.id!==b.dataset.removeStep);
    const id=b.dataset.stepUp||b.dataset.stepDown,at=g.steps.findIndex(s=>s.id===id),to=at+(b.dataset.stepUp?-1:1);if(id&&at>=0&&to>=0&&to<g.steps.length)[g.steps[at],g.steps[to]]=[g.steps[to],g.steps[at]];
  }
  if(b.id==='routine-add'||Object.keys(b.dataset).some(k=>['removeGroup','groupUp','addStep','removeStep','stepUp','stepDown'].includes(k)))renderRoutineEditor();
});
document.addEventListener('change',e=>{if(e.target.id==='template-filter'){templateCategory=e.target.value;limit={};render();}});
document.addEventListener('submit',e=>{if(e.target.id!=='home-quick-task')return;e.preventDefault();const title=$('#home-quick-title').value.trim();if(!title)return;if(change(d=>d.items.push({id:C.uid(),type:'task',title,body:'',url:'',date:C.today(),done:false,favorite:false,created:Date.now()}))){$('#home-quick-title').value='';toast('今日のタスクを追加しました');$('#home-quick-title').focus();}});
document.addEventListener('DOMContentLoaded',()=>{$('#routine-editor').addEventListener('cancel',e=>{e.preventDefault();closeRoutineEditor();});});
window.addEventListener('beforeunload',e=>{if($('#routine-editor').open&&routineDirty()){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===null||Object.values(DockInsights.apps).some(a=>a.key===e.key)){refreshInsights();if(view==='all'&&!query)renderMetrics();}});
window.addEventListener('focus',()=>{refreshInsights();if(view==='all'&&!query)renderMetrics();});
