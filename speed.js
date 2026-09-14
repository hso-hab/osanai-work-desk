'use strict';
// Daily interactions. Business data still goes through the shared atomic save path.
let batchMode=false,batchIds=new Set(),batchRaw=null,batchContext='',homeDrag=null,touchDrag=null;
const homeSections={tools:['振り返り・繰り返し・作業セット','.flow-toolbar'],progress:['進捗','#daily-progress'],metrics:['仕事の状況','.home-metrics'],routines:['いつもの作業','.home-routines'],recent:['最近使ったサイト','#recent-section'],copies:['よく使う定型文','#quick-copy-section'],notes:['メモ','#home-notes'],alerts:['関連アプリの要対応','#app-alerts']};
function syncUndo(){document.querySelectorAll('[data-speed-undo]').forEach(b=>b.disabled=!undoState);$('#undo').hidden=!undoState;}
function undoLast(){if(!undoState){toast('取り消せる操作はありません。');return;}if(save(undoState)){homeCompleted='';completedTaskId='';batchIds.clear();render();toast('元に戻しました');}}
function manualToday(){return data.items.some(i=>i.type==='task'&&i.homeOrderDay===C.today());}
function todayHandle(i){return `<button class="today-handle" draggable="true" data-today-drag="${esc(i.id)}" aria-label="${esc(i.title)}の順番を変更" title="ドラッグで移動・Alt＋↑↓でも移動">⠿</button>`;}
function speedRowActions(i){return `<div class="home-direct">${targetControl(taskTarget(i),'着手')}<button data-timer-task="${esc(i.id)}" aria-label="${esc(i.title)}の${data.timer?.taskId===i.id?'時間計測を停止':'時間計測を開始'}">${data.timer?.taskId===i.id?'■ 停止':'▶ 計測'}</button><button data-carry-task="${esc(i.id)}" aria-label="${esc(i.title)}を明日へ繰り越す">明日へ</button><button data-task-tools="${esc(i.id)}" aria-label="${esc(i.title)}の時間・状態・繰越">操作</button><button class="subtle" data-action="edit" data-id="${esc(i.id)}" aria-label="${esc(i.title)}を編集">⋯</button></div>`;}
function quickFocus(){view='all';query='';$('#search').value='';render();$('#home-quick-title').focus();$('#home-quick-title').scrollIntoView({block:'center',behavior:'instant'});}
function renderSpeed(){
  syncUndo();
  document.querySelectorAll('[data-home-pref]').forEach(el=>el.checked=data.homePrefs?.[el.dataset.homePref]!==false);
  const context=view+'|'+query+'|'+taskScope+'|'+showDone;
  if(batchContext!==context||batchRaw!==raw){batchIds.clear();batchRaw=raw;batchContext=context;}
  const home=view==='all'&&!query;
  for(const [key,[,selector]] of Object.entries(homeSections))if(home)$(selector).hidden=data.homePrefs?.[key]===false;
  if(home)$('#home-access').hidden=data.homePrefs?.recent===false&&data.homePrefs?.copies===false;else $('#home-access').hidden=false;
  const host=home?$('.home-today'):$('#board [data-panel=task]');
  document.querySelectorAll('.batch-toolbar,.batch-select').forEach(el=>el.remove());
  if(!host)return;
  const toolbar=document.createElement('div');toolbar.className='batch-toolbar';
  toolbar.innerHTML=`<div class="queue-controls"><button data-batch-toggle aria-pressed="${batchMode}">${batchMode?'選択を終了':'まとめて操作'}</button>${home?'<button data-add="task">詳細入力</button>':''}${home?`<span class="queue-order-label">${manualToday()?'手動の作業順':'期限・重要度順'}</span>${manualToday()?'<button data-order-reset>自動順に戻す</button>':''}`:''}</div><div class="batch-actions" ${batchMode?'':'hidden'}><button data-batch-all>表示中を全選択</button><strong data-batch-count>0件選択</strong><button data-batch="done">完了</button><button data-batch="carry">明日へ</button><select data-batch-status aria-label="選んだタスクの状態変更"><option value="">状態を変更…</option><option value="ready">着手できる</option><option value="waiting">待ち</option><option value="review">確認待ち</option></select></div>`;
  host.querySelector('form').after(toolbar);
  if(batchMode)host.querySelectorAll('[data-home-task],.item.type-task:not(.done)').forEach(row=>{const id=row.dataset.homeTask||row.dataset.itemId,i=find(id),label=document.createElement('label');label.className='batch-select';label.innerHTML=`<input type="checkbox" data-batch-id="${esc(id)}" aria-label="${esc(i.title)}を選択" ${batchIds.has(id)?'checked':''}>`;row.prepend(label);});
  updateBatch();
}
function updateBatch(){
  document.querySelectorAll('[data-batch-id]').forEach(el=>{el.checked=batchIds.has(el.dataset.batchId);el.closest('article').classList.toggle('is-selected',el.checked);});
  const count=$('[data-batch-count]');if(count)count.textContent=batchIds.size+'件選択';
  document.querySelectorAll('[data-batch], [data-batch-status]').forEach(b=>b.disabled=!batchIds.size);
}
function applyBatch(action){
  if(!batchIds.size)return;
  if(batchRaw!==raw){batchIds.clear();render();toast('更新がありました。タスクを選び直してください。');return;}
  const ids=new Set(batchIds);let count=0;
  if(change(d=>{for(const i of d.items){if(!ids.has(i.id)||i.type!=='task')continue;if(i.done)continue;
    if(d.timer?.taskId===i.id&&(action!=='ready'))C.stopTimer(d);
    if(action==='done'){i.done=true;i.completedOn=C.today();i.status='ready';}
    else if(action==='carry'){i.plannedOn=C.dayOffset(1);}
    else i.status=action;
    i.touchedAt=Date.now();count++;
  }})){batchIds.clear();homeCompleted='';completedTaskId='';renderNext();updateBatch();toast(`${count}件を${action==='done'?'完了しました':action==='carry'?'明日の予定にしました（期限・待ち状態は維持）':'状態変更しました'}。`,true);}
}
function moveToday(id,targetId,expected=raw){
  if(expected!==raw){toast('更新がありました。順番を確認してやり直してください。');return;}
  const rows=C.todayTasks(data.items),from=rows.findIndex(i=>i.id===id),to=rows.findIndex(i=>i.id===targetId);if(from<0||to<0||from===to)return;
  const [moved]=rows.splice(from,1);rows.splice(to,0,moved);const ranks=new Map(rows.map((i,n)=>[i.id,n]));
  if(change(d=>{for(const i of d.items)if(ranks.has(i.id)){i.homeOrder=ranks.get(i.id);i.homeOrderDay=C.today();}})){
    toast('今日の作業順を保存しました。期限の警告はそのままです。');$(`[data-today-drag="${CSS.escape(id)}"]`)?.focus();
  }
}
function showHomeSettings(){
  $('#speed-title').textContent='ホームの表示';$('#speed-body').innerHTML='<p>使う項目だけ表示できます。登録データは消えません。今日のタスクと計測中の表示は常に残ります。</p>'+Object.entries(homeSections).map(([key,[title]])=>`<label class="check-label"><input type="checkbox" data-home-pref="${key}" ${data.homePrefs?.[key]===false?'':'checked'}>${title}</label>`).join('')+'<button data-home-reset>すべて表示に戻す</button>';
  $('#speed-dialog').showModal();
}
function showShortcuts(){
  $('#speed-title').textContent='キーボードで素早く';$('#speed-body').innerHTML='<dl class="shortcut-list"><dt>N</dt><dd>ホームのタスク追加へ</dd><dt>Enter</dt><dd>タイトルを入力して今日に追加。そのまま次を入力</dd><dt>/</dt><dd>検索へ</dd><dt>Esc</dt><dd>検索・一括選択を解除／ダイアログを閉じる</dd><dt>Ctrl / ⌘ + Z</dt><dd>直前の変更を元に戻す</dd><dt>Alt + ↑ / ↓</dt><dd>⠿ にフォーカスして今日の作業順を変更</dd><dt>Ctrl / ⌘ + Enter</dt><dd>選択したタスクをまとめて完了</dd><dt>?</dt><dd>この一覧を開く</dd></dl><p>文字入力中は N・/ などを実行しません。入力欄の Ctrl / ⌘ + Z は通常の文字の取り消しです。アプリの取り消しは次の保存・再読み込み・別タブ更新まで使えます。</p>';
  $('#speed-dialog').showModal();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-speed-undo'))undoLast();
  if(b.id==='home-settings')showHomeSettings();if(b.id==='shortcuts-open')showShortcuts();
  if(b.hasAttribute('data-home-reset')){if(change(d=>{delete d.homePrefs;})){$('#speed-dialog').close();toast('ホームの項目をすべて表示しました');}}
  if(b.hasAttribute('data-batch-toggle')){batchMode=!batchMode;batchIds.clear();renderSpeed();}
  if(b.hasAttribute('data-batch-all')){const ids=[...document.querySelectorAll('[data-batch-id]')].map(e=>e.dataset.batchId);const all=ids.length&&ids.every(id=>batchIds.has(id));batchIds=all?new Set():new Set(ids);batchRaw=raw;updateBatch();}
  if(b.dataset.batch)applyBatch(b.dataset.batch);
  if(b.hasAttribute('data-order-reset')){if(change(d=>{for(const i of d.items){delete i.homeOrder;delete i.homeOrderDay;}}))toast('期限・重要度の自動順に戻しました');}
});
document.addEventListener('change',e=>{
  if(e.target.dataset.batchId){if(e.target.checked)batchIds.add(e.target.dataset.batchId);else batchIds.delete(e.target.dataset.batchId);batchRaw=raw;updateBatch();}
  if(e.target.hasAttribute('data-batch-status')&&e.target.value){applyBatch(e.target.value);e.target.value='';}
  if(e.target.dataset.homePref){const key=e.target.dataset.homePref,value=e.target.checked;if(change(d=>{d.homePrefs??={};d.homePrefs[key]=value;}))toast('ホームの表示を保存しました');else e.target.checked=data.homePrefs?.[key]!==false;}
});
document.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return;
  const typing=e.target.closest('input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable]:not([contenteditable=false])'),modal=document.querySelector('dialog[open]');
  if(!typing&&!e.altKey&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){if(!modal){e.preventDefault();undoLast();}return;}
  if(modal)return;
  if(e.key==='Escape'){if(typing&&e.target.id!=='search')return;query='';$('#search').value='';batchMode=false;batchIds.clear();render();if(e.target.id==='search')e.target.blur();return;}
  if(typing)return;
  const handle=e.target.closest('[data-today-drag]');if(handle&&e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const rows=C.todayTasks(data.items),at=rows.findIndex(i=>i.id===handle.dataset.todayDrag),next=rows[at+(e.key==='ArrowUp'?-1:1)];if(next)moveToday(handle.dataset.todayDrag,next.id);return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&batchIds.size){e.preventDefault();applyBatch('done');return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key.toLowerCase()==='n'){e.preventDefault();quickFocus();}if(e.key==='?'){e.preventDefault();showShortcuts();}
});
document.addEventListener('dragstart',e=>{const handle=e.target.closest('[data-today-drag]');if(!handle)return;homeDrag={id:handle.dataset.todayDrag,raw};e.dataTransfer.setData('text/plain',homeDrag.id);e.dataTransfer.effectAllowed='move';handle.closest('article').classList.add('dragging');});
document.addEventListener('dragover',e=>{const row=e.target.closest('[data-home-task]');if(!homeDrag||!row)return;e.preventDefault();e.dataTransfer.dropEffect='move';markTodayTarget(row);});
document.addEventListener('drop',e=>{const row=e.target.closest('[data-home-task]');if(!homeDrag||!row)return;e.preventDefault();const drag=homeDrag;clearTodayDrag();moveToday(drag.id,row.dataset.homeTask,drag.raw);});
function markTodayTarget(row){document.querySelectorAll('[data-home-task].drop-target').forEach(e=>e.classList.remove('drop-target'));row?.classList.add('drop-target');}
function clearTodayDrag(){homeDrag=null;touchDrag=null;document.querySelectorAll('[data-home-task]').forEach(e=>e.classList.remove('dragging','drop-target'));}
document.addEventListener('dragend',clearTodayDrag);
document.addEventListener('pointerdown',e=>{const h=e.target.closest('[data-today-drag]');if(!h||e.pointerType==='mouse')return;touchDrag={id:h.dataset.todayDrag,raw,pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false,target:null};h.setPointerCapture(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!touchDrag||touchDrag.pointer!==e.pointerId)return;if(Math.hypot(e.clientX-touchDrag.x,e.clientY-touchDrag.y)<7&&!touchDrag.moved)return;touchDrag.moved=true;const q=$('#today-queue'),box=q.getBoundingClientRect();if(e.clientY<box.top+35)q.scrollTop-=14;if(e.clientY>box.bottom-35)q.scrollTop+=14;const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-home-task]');touchDrag.target=row?.dataset.homeTask;markTodayTarget(row);});
document.addEventListener('pointerup',e=>{if(!touchDrag||touchDrag.pointer!==e.pointerId)return;const drag=touchDrag;clearTodayDrag();if(drag.moved&&drag.target)moveToday(drag.id,drag.target,drag.raw);});
document.addEventListener('pointercancel',e=>{if(touchDrag?.pointer===e.pointerId)clearTodayDrag();});
