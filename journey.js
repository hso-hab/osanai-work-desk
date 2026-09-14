'use strict';
// One working surface; all mutations use the existing atomic, conflict-aware save path.
let reviewDay='',reviewEvening=false,journeyResourcesOpen=false;
function workControl(i,label=''){
  return `<button class="work-launch" data-work-start="${esc(i.id)}">${esc(label||(data.timer?.taskId===i.id?'作業に戻る':i.pausedAt?'再開':'作業開始'))}</button>`;
}
function workResources(i){
  const r=i.resources||emptyResources();
  return `${i.body?`<section><h3>この仕事のメモ</h3><pre>${esc(i.body)}</pre></section>`:''}${r.urls.length?`<section><h3>使うURL <button data-work-open-urls="${esc(i.id)}">まとめて開く ↗</button></h3><div class="resource-links">${r.urls.map(u=>`<a href="${esc(C.url(u))}" target="_blank" rel="noopener noreferrer">${esc(u)} ↗</a>`).join('')}</div><p id="work-launch-status" role="status"></p></section>`:''}${r.template?`<section><h3>定型文 <button data-work-copy="${esc(i.id)}">コピー</button></h3><pre>${esc(r.template)}</pre></section>`:''}${r.note?`<section><h3>作業メモ</h3><pre>${esc(r.note)}</pre></section>`:''}${r.itemIds.map(id=>{const ref=find(id);return ref?`<section><h3>${esc(ref.title)} ${targetControl('item:'+ref.id,ref.type==='template'?'コピー':'開く')}</h3>${ref.type!=='link'?`<pre>${esc(ref.body)}</pre>`:''}</section>`:'<p>削除済みの登録があります。</p>';}).join('')}${i.actionTarget?`<section><h3>関連先</h3>${targetControl(i.actionTarget,'関連先を開く')}</section>`:''}${!i.body&&!hasResources(r)&&!i.actionTarget?'<p class="group-empty">資料の登録は不要です。そのまま作業を進められます。</p>':''}`;
}
function renderJourney(){
  const host=$('#work-focus');if(view!=='all'||query)return;
  const active=find(data.timer?.taskId),next=nextHomeTask(),i=active||next;
  const paused=C.todayTasks(data.items).filter(t=>t.pausedAt&&t.id!==active?.id);
  const open=$('#work-materials')?.open??journeyResourcesOpen;
  host.innerHTML=i?`<div class="work-focus-head"><div><p class="eyebrow">${active?'作業中':homeCompleted?'次はこの仕事':'ここから始める'}</p><h2>${esc(i.title)}</h2><p>${esc(taskHint(i))}</p></div><div class="work-focus-actions">${active?`<button class="primary" data-action="toggle" data-id="${esc(i.id)}">完了して次へ →</button><button data-work-pause="${esc(i.id)}">中断</button>`:workControl(i)}<button data-carry-task="${esc(i.id)}">明日へ</button><button class="subtle" data-task-tools="${esc(i.id)}">詳細</button></div></div><p class="work-guide">${active?'資料を見ながら、このまま進められます。中断・完了で時間を記録。':'開始すると時間計測と資料表示をまとめて行います。完了後は次の仕事をご案内。'}</p><details id="work-materials" ${active||open?'open':''}><summary>必要なURL・定型文・メモ</summary><div class="work-materials">${workResources(i)}</div></details>`:'<div class="work-focus-head"><div><p class="eyebrow">今日の作業</p><h2>いま着手する仕事はありません</h2><p>下の入力欄から追加できます。待ち・明日の予定はそのまま残っています。</p></div><button data-review-open>今日のまとめを見る</button></div>';
  if(paused.length)host.insertAdjacentHTML('beforeend',`<details class="paused-work"><summary>中断した仕事 ${paused.length}件 · あとから再開</summary>${paused.map(t=>`<div><strong>${esc(t.title)}</strong>${workControl(t,'再開')}</div>`).join('')}</details>`);
  renderDayReview();
}
function renderDayReview(){
  const report=C.daySummary(data),host=$('#day-review'),evening=new Date().getHours()>=17;
  if(reviewDay!==C.today()){reviewDay=C.today();reviewEvening=false;host.open=false;}
  if(evening&&!reviewEvening){host.open=true;reviewEvening=true;}
  $('#day-review-summary').textContent=`今日のまとめ · 完了 ${report.done.length}件 / 残り ${report.remaining.length}件 / 記録 ${duration(report.seconds)}`;
  const rows=(items,kind)=>items.length?`<ul>${items.map(i=>`<li><span>${esc(i.title)}</span><small>${kind==='time'?duration(i.seconds):kind==='done'?'完了':C.waiting(i)?statusNames[i.status]:i.plannedOn>C.today()?'翌日以降へ繰越':data.timer?.taskId===i.id?'作業中':i.pausedAt?'中断中':'未完了'}</small></li>`).join('')}</ul>`:'<p class="group-empty">なし</p>';
  $('#day-review-body').innerHTML=`<p>${esc(C.today())} · 自動集計（現在の状態）。残りには今日分の繰越・待ちも含みます。計測中の時間は停止後に反映します。</p><div class="day-review-actions"><button data-work-wrap>今日はここまで${data.timer?'（計測を止める）':''}</button>${C.todayTasks(data.items).length?'<button data-work-carry-all>今日の残りを明日へ</button>':''}</div><div class="day-review-grid"><section><h3>完了した仕事 ${report.done.length}</h3>${rows(report.done,'done')}</section><section><h3>残った仕事 ${report.remaining.length}</h3>${rows(report.remaining,'left')}</section><section><h3>作業時間 ${duration(report.seconds)}</h3>${rows(report.time,'time')}</section></div>`;
}
function returnToWork(){
  for(const id of ['reader','momentum-dialog','flow-manager'])$('#'+id).close();
  view='all';query='';$('#search').value='';render();
  $('#work-focus').scrollIntoView({block:'start',behavior:'instant'});
  $('#work-focus button')?.focus({preventScroll:true});
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.workStart){const id=b.dataset.workStart;if(data.timer?.taskId===id){returnToWork();return;}if(change(d=>C.startWork(d,id))){journeyResourcesOpen=true;homeCompleted='';renderNext();returnToWork();toast('作業を開始しました。中断・完了で時間を記録します。');}}
  if(b.dataset.workPause){const id=b.dataset.workPause;if(data.timer?.taskId!==id)return;if(change(d=>C.stopTimer(d))){journeyResourcesOpen=false;renderJourney();$('#work-focus .work-focus-actions button')?.focus({preventScroll:true});toast('中断しました。資料を残して、あとから再開できます。',true);}}
  if(b.hasAttribute('data-work-wrap')){if(data.timer&&!change(d=>C.stopTimer(d)))return;renderJourney();$('#day-review').open=true;$('#day-review').scrollIntoView({block:'start'});toast('今日のまとめを更新しました。残った仕事はそのまま保持しています。');}
  if(b.hasAttribute('data-review-open')){$('#day-review').hidden=false;$('#day-review').open=true;$('#day-review').scrollIntoView({block:'start'});}
  if(b.hasAttribute('data-work-carry-all'))$('#carry-today')?.click();
  if(b.dataset.workOpenUrls){const i=find(b.dataset.workOpenUrls);if(!i)return;let opened=0;const urls=[...new Set(i.resources?.urls||[])];for(const u of urls){const tab=window.open('about:blank','_blank');if(tab){tab.opener=null;tab.location.replace(C.url(u));opened++;}}$('#work-launch-status').textContent=`${opened}/${urls.length}件を開きました。開けない場合は個別のリンクから開いてください。`;}
  if(b.dataset.workCopy){const i=find(b.dataset.workCopy);if(!i?.resources?.template)return;try{await navigator.clipboard.writeText(i.resources.template);toast('定型文をコピーしました');}catch{const pre=b.closest('section').querySelector('pre'),range=document.createRange();range.selectNodeContents(pre);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);toast('自動コピーできません。選択した本文をコピーしてください。');}}
});
// Recheck the evening threshold without interrupting work or opening another screen.
setInterval(()=>{if(view==='all'&&!query)renderDayReview();},60000);
