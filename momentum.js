'use strict';
let momentumMode='',momentumTask='',weekDay='',momentumLimit=30,timeDraftRaw=null;
const statusNames={ready:'着手できる',waiting:'待ち',review:'確認待ち'};
function duration(seconds){const minutes=Math.floor(seconds/60);return minutes>=60?`${Math.floor(minutes/60)}時間${minutes%60}分`:minutes?`${minutes}分`:`${Math.floor(seconds)}秒`;}
function taskHint(i){return [taskDate(i),!i.done&&data.timer?.taskId===i.id?'作業中':!i.done&&i.pausedAt?'中断中':'',!i.done&&C.waiting(i)?statusNames[i.status]:'',i.plannedOn?'作業予定 '+i.plannedOn:'',!i.done&&C.stale(i)?'3日以上動きなし':''].filter(Boolean).join(' · ');}
function taskTools(i){return `<section class="task-tools" data-tools-for="${esc(i.id)}"><p>${esc(taskHint(i))}</p>${i.waitNote?`<p>待ちメモ：${esc(i.waitNote)}</p>`:''}<div class="task-tool-actions">${!i.done&&!C.waiting(i)?`<button data-timer-task="${esc(i.id)}" class="primary">${data.timer?.taskId===i.id?'■ 停止して記録':'▶ 時間を計る'}</button>`:''}<button data-time-task="${esc(i.id)}">時間記録・手入力</button><button data-repeat-task="${esc(i.id)}">もう一度</button>${!i.done?`<button data-carry-task="${esc(i.id)}">明日へ繰り越す</button>`:''}</div>${!i.done?`<label>状態<select data-task-status="${esc(i.id)}">${Object.entries(statusNames).map(([key,name])=>`<option value="${key}" ${(i.status||'ready')===key?'selected':''}>${name}</option>`).join('')}</select></label>`:''}<button data-tool-edit="${esc(i.id)}">期限・予定日・待ちメモを編集</button><button data-speed-undo ${undoState?'':'disabled'}>↶ 元に戻す</button></section>`;}
function renderMomentumHome(){
 const day=C.today(),all=data.items.filter(i=>i.type==='task'&&!i.done),waiting=all.filter(C.waiting),deferred=all.filter(i=>!C.waiting(i)&&i.plannedOn>day),upcoming=C.attention(data.items).filter(i=>i.date>day&&!(i.plannedOn&&i.plannedOn<=day)),first=nextHomeTask();
 $('#momentum-queue').innerHTML=(upcoming.length?`<div class="attention-list"><h3>早めに確認 <small>${upcoming.length}件</small></h3>${upcoming.slice(0,3).map(i=>`<article class="attention-row ${i.id===first?.id?'up-next':''}"><div><strong>${esc(i.title)}</strong><small>${i.id===first?.id?'今やる · ':''}${esc(taskHint(i))}</small></div><button data-task-tools="${esc(i.id)}">確認</button></article>`).join('')}${upcoming.length>3?'<button data-view="task" class="subtle">全タスクで確認 →</button>':''}</div>`:'')+`<div class="queue-secondary"><button data-queue-mode="waiting">待ち・確認待ち ${waiting.length}</button><button data-queue-mode="deferred">後日の予定 ${deferred.length}</button>${C.todayTasks(data.items).length?'<button id="carry-today">今日の残りを明日へ</button>':''}</div>`;
 document.querySelectorAll('[data-home-task]').forEach(el=>el.classList.toggle('is-stale',C.stale(find(el.dataset.homeTask))));
}
function renderTimer(){
 const t=data.timer,host=$('#active-timer');host.hidden=!t;if(!t)return;const i=find(t.taskId);
 host.innerHTML=`<div><strong>計測中：${esc(i?.title||'タスク')}</strong><span id="timer-elapsed">${duration(Math.max(0,(Date.now()-t.startedAt)/1000))}</span><small>閉じている間も継続。停止後に記録します。</small></div><button data-timer-task="${esc(t.taskId)}">■ 停止</button><button data-time-task="${esc(t.taskId)}">記録・修正</button>`;
}
function showMomentum(mode,id=''){
 momentumMode=mode;momentumTask=id;momentumLimit=30;weekDay||=C.today();timeDraftRaw=raw;
 if(mode==='tools'&&$('#reader').open)$('#reader').close();
 renderMomentumDialog();if(!$('#momentum-dialog').open)$('#momentum-dialog').showModal();
}
function refreshMomentumDialog(){
 if($('#momentum-dialog').open){
  if(momentumMode==='time'){
   if(timeDraftRaw!==raw)$('#time-error').textContent='データが更新されました。日付と分数を確認して、もう一度追加してください。';
   renderTimeEntries();
  }else renderMomentumDialog();
 }
 if($('#reader').open&&readerId&&find(readerId))renderReaderResources(find(readerId));
}
function renderMomentumDialog(){
 const host=$('#momentum-body'),title=$('#momentum-title'),i=find(momentumTask);
 if(momentumMode==='tools'){title.textContent=i?.title||'削除済みのタスク';host.innerHTML=i?taskTools(i):'<p>このタスクは削除されました。</p>';}
 if(momentumMode==='time'){
  title.textContent='時間記録：'+(i?.title||'削除済みタスク');
  host.innerHTML=`<p>開始／停止で記録、または分数を手入力。停止忘れは記録を削除して入れ直せます。</p><div id="time-active"></div><form id="time-form"><div class="flow-fields-row"><label>作業日<input id="time-day" type="date" value="${C.today()}" required></label><label>作業時間（分）<input id="time-minutes" type="number" min="1" max="1440" step="1" required inputmode="numeric" placeholder="例：25"></label></div><button class="primary" type="submit">時間を追加</button><p id="time-error" role="alert"></p></form><div id="time-entries"></div>`;renderTimeEntries();
 }
 if(momentumMode==='waiting'||momentumMode==='deferred'){
  const rows=data.items.filter(i=>i.type==='task'&&!i.done&&(momentumMode==='waiting'?C.waiting(i):!C.waiting(i)&&i.plannedOn>C.today()));
  title.textContent=momentumMode==='waiting'?'待ち・確認待ち':'後日の作業予定';host.innerHTML=`<p>「今やる」から分けています。${momentumMode==='waiting'?'返答が来たら「着手できる」に戻します。':'予定日になると今日の候補に戻ります。期限そのものは変えません。'}</p>`+rows.slice(0,momentumLimit).map(i=>`<article class="history-row"><div><strong>${esc(i.title)}</strong><small>${esc(taskHint(i))}</small>${i.waitNote?`<small>${esc(i.waitNote)}</small>`:''}</div><button data-task-tools="${esc(i.id)}">確認・変更</button><button data-ready-task="${esc(i.id)}">${momentumMode==='waiting'?'着手できるに戻す':'今日に戻す'}</button></article>`).join('')+(rows.length?'':'<p>該当するタスクはありません。</p>')+(rows.length>momentumLimit?'<button id="momentum-more">さらに30件</button>':'');
 }
 if(momentumMode==='week'){
  const w=C.weekSummary(data,weekDay),total=w.time.reduce((sum,i)=>sum+i.seconds,0),list=(rows,kind)=>rows.slice(0,momentumLimit).map(i=>`<article class="history-row"><div><strong>${esc(i.title)}</strong><small>${kind==='time'?duration(i.seconds):kind==='done'?'完了 '+i.completedOn:taskHint(i)}</small>${kind==='time'?`<progress aria-label="${esc(i.title)}の時間割合" max="${total||1}" value="${i.seconds}"></progress>`:''}</div>${find(i.id)?`<button data-task-tools="${esc(i.id)}">詳細</button>`:''}</article>`).join('')||'<p>該当なし</p>';
  title.textContent='週の振り返り';host.innerHTML=`<div class="week-nav"><button id="week-prev">← 前の週</button><button id="week-current">今週</button><button id="week-next">次の週 →</button></div><p><strong>${w.start} 〜 ${w.end}</strong></p><div class="week-stats"><div><strong>${w.done.length}</strong>完了した仕事</div><div><strong>${w.remaining.length}</strong>今も残っている仕事</div><div><strong>${duration(total)}</strong>記録した時間</div></div><p>月曜〜日曜。残りは「週末までが期限で、現在も未完了」の仕事（待ちを含む）。過去時点の再現ではありません。計測中の時間は停止後に反映します。</p><details open><summary>時間を使った仕事</summary>${list(w.time,'time')}</details><details><summary>完了した仕事 ${w.done.length}件</summary>${list(w.done,'done')}</details><details><summary>残っている仕事 ${w.remaining.length}件</summary>${list(w.remaining,'remaining')}</details>${Math.max(w.time.length,w.done.length,w.remaining.length)>momentumLimit?'<button id="momentum-more">さらに30件</button>':''}`;
 }
}
function renderTimeEntries(){
 if(!$('#time-entries'))return;
 const entries=(data.timeEntries||[]).filter(e=>e.taskId===momentumTask).sort((a,b)=>b.day.localeCompare(a.day));
 $('#time-active').innerHTML=data.timer?.taskId===momentumTask?`<p>計測中です。</p><button data-timer-task="${esc(momentumTask)}">停止して記録</button><button id="discard-timer">計測を取り消す</button>`:'';
 $('#time-entries').innerHTML=`<p>合計 ${duration(entries.reduce((s,e)=>s+e.seconds,0))} · ${entries.length}件</p>`+entries.slice(0,momentumLimit).map(e=>`<article class="history-row"><div>${esc(e.day)}<strong> ${duration(e.seconds)}</strong></div><button data-delete-time="${esc(e.id)}">削除</button></article>`).join('')+(entries.length>momentumLimit?'<button id="momentum-more">さらに30件</button>':'');
}
function carryTasks(ids){return change(d=>{for(const i of d.items)if(ids.includes(i.id)&&!i.done&&!C.waiting(i)){if(d.timer?.taskId===i.id)C.stopTimer(d);i.plannedOn=C.dayOffset(1);i.workDay=C.today();i.touchedAt=Date.now();}});}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='week-open')showMomentum('week');
 if(b.dataset.taskTools)showMomentum('tools',b.dataset.taskTools);
 if(b.dataset.timeTask){$('#reader').close();showMomentum('time',b.dataset.timeTask);}
 if(b.dataset.queueMode)showMomentum(b.dataset.queueMode);
 if(b.id==='momentum-more'){momentumLimit+=30;if(momentumMode==='time')renderTimeEntries();else renderMomentumDialog();}
 if(['week-prev','week-next','week-current'].includes(b.id)){weekDay=b.id==='week-current'?C.today():C.addDays(weekDay,b.id==='week-prev'?-7:7);renderMomentumDialog();}
 if(b.dataset.toolEdit){$('#momentum-dialog').close();$('#reader').close();openEditor('task',b.dataset.toolEdit);}
 if(b.dataset.repeatTask){const i=find(b.dataset.repeatTask);if(!i)return;if(change(d=>d.items.push({...C.freshTask(i),id:C.uid(),created:Date.now(),date:C.today(),favorite:false,followUpOf:i.id}))){toast('同じ仕事を今日に再登録しました（時間・待ち・繰り返し設定は引き継ぎません）');}}
 if(b.dataset.carryTask){if(carryTasks([b.dataset.carryTask])){toast('元の期限を残して、作業予定を明日にしました');}}
 if(b.id==='carry-today'){
  const ids=C.todayTasks(data.items).map(i=>i.id),expected=raw;if(await ask('今日の残りを明日へ繰り越しますか？',`${ids.length}件の作業予定を明日にします。元の期限は残し、待ち・確認待ちは変更しません。`,'明日へ繰り越す')){if(raw!==expected){toast('データが更新されました。確認し直してください。');return;}if(carryTasks(ids))toast(`${ids.length}件を明日の予定にしました`);}
 }
 if(b.dataset.readyTask){if(change(d=>{const i=d.items.find(i=>i.id===b.dataset.readyTask);if(i){i.status='ready';i.plannedOn=C.today();i.touchedAt=Date.now();}}))toast('今日の着手候補に戻しました');}
 if(b.dataset.timerTask){const id=b.dataset.timerTask,i=find(id);if(!i||i.done||C.waiting(i))return;const stopping=data.timer?.taskId===id;
  if(change(d=>{C.stopTimer(d);if(!stopping){C.startWork(d,id);}})){toast(stopping?'作業時間を記録しました':'計測を開始しました。別の計測は停止して記録します。');}
 }
 if(b.id==='discard-timer'||b.dataset.deleteTime){const expected=raw;if(await ask(b.id==='discard-timer'?'計測を取り消しますか？':'この時間記録を削除しますか？','必要な時間はあとから分数で手入力できます。','取り消す')){if(raw!==expected){toast('更新がありました。確認し直してください。');return;}const before=structuredClone(data);if(change(d=>{if(b.id==='discard-timer')d.timer=null;else d.timeEntries=d.timeEntries.filter(x=>x.id!==b.dataset.deleteTime);})){undoState=before;toast('取り消しました',true);}}}
});
document.addEventListener('change',e=>{
 const id=e.target.dataset.taskStatus;if(!id)return;const status=e.target.value;
 if(change(d=>{const i=d.items.find(i=>i.id===id);if(!i)return;if(status!=='ready'&&d.timer?.taskId===id)C.stopTimer(d);i.status=status;i.touchedAt=Date.now();}))toast('状態を変更しました');else refreshMomentumDialog();
});
document.addEventListener('submit',e=>{
 if(e.target.id!=='time-form')return;e.preventDefault();
 if(timeDraftRaw!==raw){timeDraftRaw=raw;$('#time-error').textContent='データが更新されました。入力内容を確認して、もう一度追加してください。';return;}
 const day=$('#time-day').value,minutes=Number($('#time-minutes').value),i=find(momentumTask);
 if(!i||!C.validDay(day)||day>C.today()||!Number.isInteger(minutes)||minutes<1||minutes>1440){$('#time-error').textContent='今日までの日付と1〜1440分を入力してください。';return;}
 if(change(d=>{d.timeEntries??=[];d.timeEntries.push({id:C.uid(),taskId:i.id,title:i.title,day,seconds:minutes*60});d.items.find(x=>x.id===i.id).touchedAt=Date.now();})){timeDraftRaw=raw;$('#time-minutes').value='';$('#time-error').textContent='記録しました。';}else $('#time-error').textContent='保存できませんでした。入力内容は残しています。空き容量や保存設定を確認してください。';
});
setInterval(()=>{const el=document.querySelector('#timer-elapsed');if(el&&data?.timer)el.textContent=duration(Math.max(0,(Date.now()-data.timer.startedAt)/1000));},1000);
