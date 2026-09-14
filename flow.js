'use strict';
let completedTaskId='',followUpOf='',scheduleEditing='',flowManager='',activeResources=null,setOnly=false,scheduleOnly='';
const emptyResources=()=>({urls:[],template:'',note:'',itemIds:[]});
const hasResources=r=>r&&(r.urls.length||r.template||r.note||r.itemIds.length);
function taskTarget(i){return hasResources(i.resources)?'item:'+i.id:i.actionTarget||'item:'+i.id;}
function fillResources(r=emptyResources()){
  $('#resource-urls').value=r.urls.join('\n');$('#resource-template').value=r.template;$('#resource-note').value=r.note;
  const selected=new Set(r.itemIds);
  $('#resource-items').innerHTML=data.items.filter(i=>['link','template','note'].includes(i.type)).map(i=>`<label class="check-label"><input type="checkbox" name="resourceItem" value="${esc(i.id)}" ${selected.has(i.id)?'checked':''}>${esc(labels[i.type]+': '+i.title)}</label>`).join('')+r.itemIds.filter(id=>!find(id)).map(id=>`<label class="check-label"><input type="checkbox" name="resourceItem" value="${esc(id)}" checked>削除済みの登録（外して保存できます）</label>`).join('');
}
function initFlowEditor(item){
  setOnly=false;scheduleOnly='';$('#editor').classList.remove('set-editor','schedule-editor');
  $('#item-status').value=item?.status||'ready';$('#item-planned').value=item?.plannedOn||'';$('#item-wait-note').value=item?.waitNote||'';
  followUpOf=item?.followUpOf||'';scheduleEditing=item?.repeatId||'';
  const rule=data.schedules?.find(r=>r.id===scheduleEditing);
  $('#item-priority').value=String(item?.priority||0);$('#item-repeat').value=rule?.active?rule.frequency:'none';
  $('#item-set').innerHTML='<option value="">選択しない</option>'+(data.worksets||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  fillResources(item?.resources);$('#resource-fields').open=!!hasResources(item?.resources);
}
function readResources(){return {urls:[...new Set($('#resource-urls').value.split('\n').map(u=>u.trim()).filter(Boolean).map(C.url))],template:$('#resource-template').value,note:$('#resource-note').value,itemIds:[...document.querySelectorAll('#resource-items input:checked')].map(el=>el.value)};}
function saveFlow(next,item,old){
  if(item.type!=='task')return;
  item.status=$('#item-status').value;item.plannedOn=$('#item-planned').value;item.waitNote=$('#item-wait-note').value;item.touchedAt=Date.now();if(C.waiting(item)&&next.timer?.taskId===item.id)C.stopTimer(next);
  item.priority=Number($('#item-priority').value);item.resources=readResources();C.validateResources(item.resources);
  if(followUpOf)item.followUpOf=followUpOf;
  saveReusableSet(next,item);
  const frequency=$('#item-repeat').value;let rule=next.schedules?.find(r=>r.id===scheduleEditing);
  if(frequency==='none'){if(rule)rule.active=false;return;}
  next.schedules??=[];
  if(!rule){rule={id:C.uid(),frequency,active:true,nextDate:C.addDays(item.date,frequency==='daily'?1:7)};next.schedules.push(rule);item.repeatDate=item.date;}
  else if(rule.frequency!==frequency||!rule.active||old&&item.date!==old.date)rule.nextDate=C.addDays(item.date,frequency==='daily'?1:7);
  rule.active=true;rule.frequency=frequency;item.repeatId=rule.id;item.repeatDate??=item.date;
  rule.task={...C.freshTask(item),done:false,completedOn:''};delete rule.task.followUpOf;delete rule.task.repeatId;delete rule.task.repeatDate;
}
function addFollowUp(id){const source=find(id);if(!source)return;$('#reader').close();$('#flow-manager').close();openEditor('task');followUpOf=id;$('#editor-title').textContent='完了した作業の次を追加';$('#item-title').value='';$('#item-priority').value=String(source.priority||0);$('#item-body').value=source.body;$('#item-action').value=source.actionTarget||'';fillResources(source.resources);$('#resource-fields').open=!!hasResources(source.resources);formStart='follow-up';$('#item-title').placeholder=source.title+' の次にすること';}
function renderDailyProgress(){
 const tasks=data.items.filter(i=>i.type==='task'),done=tasks.filter(i=>i.done&&i.completedOn===C.today()).length,left=C.todayTasks(data.items).length,steps=(data.routines||[]).flatMap(g=>g.steps),stepsDone=steps.filter(s=>s.completedOn===C.today()).length,total=done+left+steps.length,finished=done+stepsDone;
 $('#daily-progress').innerHTML=`<div><strong>今日の進み具合 <b>${total?Math.round(finished/total*100):0}%</b></strong><span>タスク ${done}/${done+left} ・いつもの作業 ${stepsDone}/${steps.length} 完了</span></div><progress aria-label="今日の進み具合" max="${total||1}" value="${finished}"></progress>`;
 const excluded=tasks.filter(i=>!i.done&&(C.waiting(i)||i.plannedOn>C.today())).length;if(excluded)$('#daily-progress>div').insertAdjacentHTML('beforeend',`<span>待ち・後日の予定 ${excluded}件は別枠</span>`);
 const first=nextHomeTask();document.querySelectorAll('[data-home-task]').forEach(el=>{const i=find(el.dataset.homeTask);el.classList.toggle('up-next',i.id===first?.id);el.querySelector('small').textContent=(i.id===first?.id?'今やる · ':'')+(i.priority===2?'最重要 · ':i.priority===1?'重要 · ':'')+taskHint(i);});
}
function resourcesHtml(r){
 const links=r.urls.map(u=>`<a href="${esc(C.url(u))}" target="_blank" rel="noopener noreferrer">${esc(u)} ↗</a>`).join('');
 return `${r.urls.length||r.itemIds.some(id=>find(id)?.type==='link')?'<button id="open-resource-urls" class="primary">サイトをまとめて開く ↗</button><p id="resource-launch-status" role="status"></p>':''}<div class="resource-links">${links}</div>${r.template?`<section><h3>定型文 <button id="copy-resource-template">コピー</button></h3><pre>${esc(r.template)}</pre></section>`:''}${r.note?`<section><h3>作業メモ</h3><pre>${esc(r.note)}</pre></section>`:''}${r.itemIds.map(id=>{const i=find(id);return i?`<section class="resource-ref"><strong>${esc(i.title)}</strong>${targetControl('item:'+i.id,i.type==='template'?'コピー':'開く')}${i.type!=='link'?`<pre>${esc(i.body)}</pre>`:''}</section>`:'<p class="missing-target">削除済みの登録があります</p>';}).join('')}`;
}
function renderReaderResources(item){activeResources=item.resources||null;$('#reader-resources').innerHTML=hasResources(activeResources)?resourcesHtml(activeResources):'';if(item.type==='task')$('#reader-resources').insertAdjacentHTML('beforeend',taskTools(item)+`${item.actionTarget?targetControl(item.actionTarget,'関連先を開く'):''}${item.done?`<button data-follow-up="${esc(item.id)}">＋ 次の作業を追加</button>`:''}`);}
function showSet(id){const set=data.worksets?.find(s=>s.id===id);if(!set)return;$('#flow-manager').close();readerId=null;activeResources=set.resources;$('#reader-title').textContent=set.name;$('#reader-body').textContent='';$('#reader-resources').innerHTML=resourcesHtml(set.resources);for(const id of ['reader-done','reader-task','reader-edit','reader-copy'])$('#'+id).hidden=true;$('#reader').showModal();}
function renderHistory(){
 const q=$('#history-search').value.trim().toLocaleLowerCase(),date=$('#history-date').value;
 const rows=data.items.filter(i=>i.type==='task'&&i.done&&(!date||i.completedOn===date)&&[i.title,i.body,i.date,i.completedOn||'',i.resources?.note||''].some(s=>s.toLocaleLowerCase().includes(q))).sort((a,b)=>(b.completedOn||'').localeCompare(a.completedOn||'')||b.created-a.created);
 const count=Number($('#history-results').dataset.limit)||30;
 $('#history-results').innerHTML=`<p>${rows.length}件</p>`+rows.slice(0,count).map(i=>`<article class="history-row"><div><strong>${esc(i.title)}</strong><small>${i.completedOn?'完了 '+esc(i.completedOn):'完了日不明（旧データ）'}</small></div><button data-history-read="${esc(i.id)}">詳細</button><button data-follow-up="${esc(i.id)}">＋ 次へ</button><button data-repeat-task="${esc(i.id)}">もう一度</button></article>`).join('')+(rows.length>count?'<button id="history-more">さらに30件</button>':'');
}
function openFlowManager(mode){flowManager=mode;$('#flow-manager-title').textContent={history:'完了した仕事',schedule:'繰り返しタスク',sets:'作業セット'}[mode];const host=$('#flow-manager-body');
 if(mode==='history'){host.innerHTML='<label>完了タスクを検索<input id="history-search" type="search" placeholder="タイトル・メモ・日付"></label><label>完了日<input id="history-date" type="date"></label><div id="history-results"></div>';renderHistory();}
 if(mode==='schedule')host.innerHTML='<p>起動時・日付変更時に作成。未完了のタスクは残ります。再開すると停止中の分も作成します。</p><button data-new-recurring>＋ 繰り返しを追加</button>'+(data.schedules||[]).map(r=>`<article class="history-row"><div><strong>${esc(r.task.title)}</strong><small>${r.frequency==='daily'?'毎日':'毎週'} · ${r.active?'次回 '+esc(r.nextDate):'停止中'}</small></div><button data-edit-schedule="${esc(r.id)}">編集</button><button data-toggle-schedule="${esc(r.id)}">${r.active?'停止':'再開'}</button></article>`).join('');
 if(mode==='sets')host.innerHTML='<p>タスクの「必要なURL・定型文・メモをまとめる」からセットを保存できます。</p><button data-new-set>＋ セットを作る</button>'+(data.worksets||[]).map(s=>`<article class="history-row"><strong>${esc(s.name)}</strong><button data-show-set="${esc(s.id)}">セットを開く</button><button data-edit-set="${esc(s.id)}">編集</button><button data-delete-set="${esc(s.id)}">削除</button></article>`).join('');
 if(!$('#flow-manager').open)$('#flow-manager').showModal();
}
function autoTasks(){if(blocked)return;try{const next=C.materialize(data);if(next!==data)save(next);}catch(e){$('#notice').textContent=e.message;$('#notice').hidden=false;}}
document.addEventListener('change',e=>{if(e.target.id==='item-set'){const set=data.worksets?.find(s=>s.id===e.target.value);if(set){fillResources(set.resources);$('#workset-name').value=set.name;}}if(e.target.id==='history-date')renderHistory();});
document.addEventListener('input',e=>{if(e.target.id==='history-search'){delete $('#history-results').dataset.limit;renderHistory();}});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.followUp)addFollowUp(b.dataset.followUp);
 if(b.id==='history-open')openFlowManager('history');if(b.id==='schedule-open')openFlowManager('schedule');if(b.id==='sets-open')openFlowManager('sets');
 if(b.id==='history-more'){$('#history-results').dataset.limit=(Number($('#history-results').dataset.limit)||30)+30;renderHistory();}
 if(b.dataset.historyRead){$('#flow-manager').close();openReader(b.dataset.historyRead);}
 if(b.dataset.showSet)showSet(b.dataset.showSet);
 if(b.dataset.toggleSchedule){if(change(d=>{const r=d.schedules.find(s=>s.id===b.dataset.toggleSchedule);r.active=!r.active;}))openFlowManager('schedule');}
 if(b.dataset.editSchedule){const r=data.schedules.find(s=>s.id===b.dataset.editSchedule);$('#flow-manager').close();openEditor('task');scheduleOnly=r.id;$('#editor').classList.add('schedule-editor');$('#editor-title').textContent='今後の繰り返しを編集';$('#item-title').value=r.task.title;$('#item-date').value=r.nextDate;$('#item-body').value=r.task.body;$('#item-action').value=r.task.actionTarget||'';$('#item-priority').value=String(r.task.priority||0);fillResources(r.task.resources);$('#resource-fields').open=!!hasResources(r.task.resources);$('#item-repeat').value=r.active?r.frequency:'none';formStart='schedule-edit';}
 if(b.hasAttribute('data-new-recurring')){$('#flow-manager').close();openEditor('task');$('#item-repeat').value='daily';formStart='new-recurring';}
 if(b.hasAttribute('data-new-set')||b.dataset.editSet){$('#flow-manager').close();openEditor('task');$('#resource-fields').open=true;$('#save-workset').checked=true;if(b.dataset.editSet){$('#item-set').value=b.dataset.editSet;$('#item-set').dispatchEvent(new Event('change',{bubbles:true}));$('#item-title').value=data.worksets.find(s=>s.id===b.dataset.editSet).name;}setOnly=true;$('#editor').classList.add('set-editor');$('#editor-title').textContent='作業セットを保存';formStart='new-set';}
 if(b.dataset.deleteSet){const id=b.dataset.deleteSet;if(await ask('セットを削除しますか？','タスクに保存済みのセット内容は残ります。','削除する'))if(change(d=>{d.worksets=d.worksets.filter(s=>s.id!==id);}))openFlowManager('sets');}
 if(b.id==='open-resource-urls'&&activeResources){const urls=[...new Set([...activeResources.urls,...activeResources.itemIds.map(id=>find(id)).filter(i=>i?.type==='link').map(i=>C.url(i.url))])];let opened=0;for(const url of urls){const tab=window.open('about:blank','_blank');if(tab){tab.opener=null;tab.location.replace(C.url(url));opened++;}}$('#resource-launch-status').textContent=opened===urls.length?`${opened}件のサイトを開きました。定型文はこの画面からコピーできます。`:`${opened}/${urls.length}件を開きました。開けないサイトは下のリンクから個別に開いてください。`;}
 if(b.id==='copy-resource-template'&&activeResources){try{await navigator.clipboard.writeText(activeResources.template);toast('定型文をコピーしました');}catch{const pre=b.closest('section').querySelector('pre'),range=document.createRange();range.selectNodeContents(pre);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);toast('自動コピーできません。選択した本文をコピーしてください。');}}
});
window.addEventListener('focus',autoTasks);

function saveSetOnly(){const name=$('#item-title').value.trim(),resources=readResources();if(!hasResources(resources))throw Error('URL・定型文・メモを追加してください。');const next=structuredClone(data);next.worksets??=[];const id=$('#item-set').value,at=next.worksets.findIndex(s=>s.id===id),set={id:at<0?C.uid():id,name,resources};if(at<0)next.worksets.push(set);else next.worksets[at]=set;C.validate(next);if(save(next)){$('#editor').close();toast('作業セットを保存しました');}else $('#form-error').textContent='保存できませんでした。入力は残っています。';}

function saveScheduleOnly(item){const next=structuredClone(data),r=next.schedules.find(s=>s.id===scheduleOnly);if(!r)throw Error('繰り返し設定が削除されています。');item.priority=Number($('#item-priority').value);item.resources=readResources();saveReusableSet(next,item);C.validate({app:'work-dock',version:1,items:[item]});r.task=item;r.nextDate=item.date;r.active=$('#item-repeat').value!=='none';if(r.active)r.frequency=$('#item-repeat').value;C.validate(next);if(save(next)){$('#editor').close();toast('今後の繰り返しを保存しました');}else $('#form-error').textContent='保存できませんでした。入力は残っています。';}

function saveReusableSet(next,item){
  if($('#save-workset').checked){
    const name=$('#workset-name').value.trim();if(!name)throw Error('セット名を入力してください。');if(!hasResources(item.resources))throw Error('セットにURL・定型文・メモを登録してください。');
    next.worksets??=[];const selected=$('#item-set').value,at=next.worksets.findIndex(s=>s.id===selected),set={id:at<0?C.uid():selected,name,resources:structuredClone(item.resources)};
    if(at<0)next.worksets.push(set);else next.worksets[at]=set;
  }
}
