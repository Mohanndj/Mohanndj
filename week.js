'use strict';
// «التخطيط الأسبوعي»: the week (Saturday to Friday) as seven short rows. One day opens at a time,
// so the page never gets crowded: its tasks, moving a task to another day, adding one. Recurring
// goals are summed up in one line. Undated and overdue tasks wait in a tray to be given a day.

const weekUi = { start: '', open: '', move: '' };
const weekStartOf = (d) => addDays(d, -((parse(d).getDay() + 1) % 7)); // Saturday
function normalizeWeek(w) { return { id: w.id || weekStartOf(today()), focus: [0, 1, 2].map((i) => String((w.focus || [])[i] || '')), note: String(w.note || '') }; }
const weekRec = (start) => S.weeks.find((w) => w.id === start);
const tasksOnDay = (d) => S.tasks.filter((t) => !isGoal(t) && t.due === d).sort((a, b) => a.done - b.done || (timeOn(a, d) ?? 9999) - (timeOn(b, d) ?? 9999));
const goalsOnDay = (d) => S.tasks.filter((t) => isGoal(t) && isRepeat(t) && occursOn(t, d));

function dayChips(taskId, cur, start) {
  return `<div class="wk-move" role="group" aria-label="انقل إلى">${[0, 1, 2, 3, 4, 5, 6].map((i) => { const d = addDays(start, i); return `<button type="button" class="chip" data-action="wk-to" data-id="${taskId}" data-v="${d}" aria-pressed="${d === cur}">${AR_DAYS[parse(d).getDay()]}</button>`; }).join('')}<button type="button" class="chip" data-action="wk-to" data-id="${taskId}" data-v="">بلا موعد</button></div>`;
}
function wkTaskRow(t, d, start) {
  const moving = weekUi.move === t.id;
  return `<li class="wk-task${t.done ? ' done' : ''}">
    <div class="wk-line">${checkButton(t, d, t.done)}<button type="button" class="t-main" data-action="open" data-id="${t.id}"><span class="t-title">${esc(t.title)}</span>${hasTime(t) ? `<span class="meta"><span class="num">${esc(timeLabel(t, d))}</span></span>` : ''}</button>
      ${t.done ? '' : `<button type="button" class="ghost sm" data-action="wk-move" data-v="${t.id}" aria-expanded="${moving}">نقل</button>`}</div>
    ${moving ? dayChips(t.id, d, start) : ''}
  </li>`;
}

function viewWeek() {
  const t0 = today();
  const start = weekUi.start || weekStartOf(t0);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
  const open = weekUi.open && days.includes(weekUi.open) ? weekUi.open : days.includes(t0) ? t0 : days[0];
  const rec = weekRec(start) || normalizeWeek({ id: start });
  const max = Math.max(1, ...days.map((d) => tasksOnDay(d).length));
  const tray = S.tasks.filter((t) => !isGoal(t) && !t.done && (!t.due || t.due < (start < t0 ? start : t0)));
  const end = days[6];
  return `${moreCrumb()}
  <section class="section wk">
    <div class="cal-head">
      <div class="nav"><button type="button" data-action="wk-nav" data-v="-7" aria-label="الأسبوع السابق">${icon('prev')}</button></div>
      <div class="titles"><h2>${esc(fmtDate(start, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(end, { day: 'numeric', month: 'long' }))}</h2><small>${esc(fmtHijri(start, { day: 'numeric', month: 'long' }))} – ${esc(fmtHijri(end, { day: 'numeric', month: 'long' }))}${start === weekStartOf(t0) ? ' · هذا الأسبوع' : ''}</small></div>
      <div class="nav"><button type="button" data-action="wk-nav" data-v="7" aria-label="الأسبوع التالي">${icon('next')}</button></div>
    </div>
    ${start !== weekStartOf(t0) ? '<button type="button" class="ghost" data-action="wk-now">العودة إلى هذا الأسبوع</button>' : ''}
    <div class="panel wk-focus"><h3>أولويات الأسبوع</h3>
      ${rec.focus.map((f, i) => `<input type="text" id="wkf-${i}" data-wk="${i}" value="${esc(f)}" placeholder="${['أهم شيء هذا الأسبوع', 'الثاني', 'الثالث'][i]}" autocomplete="off">`).join('')}
    </div>
    <ul class="wk-days">${days.map((d) => {
      const tasks = tasksOnDay(d), goals = goalsOnDay(d);
      const left = tasks.filter((t) => !t.done).length;
      const isOpen = d === open;
      return `<li class="wk-day${d === t0 ? ' today' : ''}${d < t0 ? ' past' : ''}${isOpen ? ' open' : ''}">
        <button type="button" class="wk-head" data-action="wk-open" data-v="${d}" aria-expanded="${isOpen}">
          <span class="wk-name"><b>${AR_DAYS[parse(d).getDay()]}</b><small>${esc(fmtDate(d, { day: 'numeric', month: 'short' }))}</small></span>
          <span class="wk-load"><i style="width:${(tasks.length / max) * 100}%"></i></span>
          <span class="wk-sum">${tasks.length ? `${left ? `${left} ${left === 1 ? 'مهمة' : left === 2 ? 'مهمتان' : 'مهام'}` : 'أنجزت كل مهامه ✓'}` : 'فارغ'}${goals.length ? ` · ${goals.length} ${goals.length === 1 ? 'هدف' : 'أهداف'}` : ''}</span>
        </button>
        ${isOpen ? `<div class="wk-body">
          ${tasks.length ? `<ul class="wk-tasks">${tasks.map((t) => wkTaskRow(t, d, start)).join('')}</ul>` : '<p class="note-text">لا مهام في هذا اليوم.</p>'}
          ${goals.length ? `<p class="wk-goals">${icon('repeat')} ${goals.map((g) => esc(g.title)).join('، ')}</p>` : ''}
          <form class="idea-quick wk-add" data-wk-add="${d}" autocomplete="off"><input type="text" name="t" placeholder="أضف مهمة ليوم ${AR_DAYS[parse(d).getDay()]}" aria-label="مهمة جديدة"><button type="submit" class="primary">${icon('plus')}</button></form>
        </div>` : ''}
      </li>`;
    }).join('')}</ul>
    ${tray.length ? `<details class="panel wk-tray"${weekUi.trayOpen ? ' open' : ''} id="wkTray"><summary><b>بلا موعد أو متأخرة (${tray.length})</b><small>اختر لكل مهمة يومها</small></summary>
      <ul class="wk-tasks">${tray.map((t) => wkTaskRow(t, t.due || '', start)).join('')}</ul></details>` : ''}
  </section>`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="wk-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'wk-nav': weekUi.start = addDays(weekUi.start || weekStartOf(today()), Number(v)); weekUi.open = ''; weekUi.move = ''; render(); break;
    case 'wk-now': weekUi.start = ''; weekUi.open = ''; render(); break;
    case 'wk-open': weekUi.open = weekUi.open === v ? 'none' : v; weekUi.move = ''; render(); break;
    case 'wk-move': weekUi.move = weekUi.move === v ? '' : v; render(); break;
    case 'wk-to': {
      const t = getTask(el.dataset.id);
      if (!t) break;
      t.due = v;
      weekUi.move = '';
      if (v) weekUi.open = v;
      save(); render();
      toast(v ? `نُقلت إلى ${AR_DAYS[parse(v).getDay()]}` : 'صارت بلا موعد');
      break;
    }
  }
});
document.addEventListener('toggle', (e) => { if (e.target.id === 'wkTray') weekUi.trayOpen = e.target.open; }, true);
document.addEventListener('change', (e) => {
  const i = e.target.dataset && e.target.dataset.wk;
  if (i == null) return;
  const start = weekUi.start || weekStartOf(today());
  let rec = weekRec(start);
  if (!rec) { rec = normalizeWeek({ id: start }); S.weeks.push(rec); }
  rec.focus[+i] = e.target.value.trim();
  save();
});
document.addEventListener('submit', (e) => {
  const d = e.target.dataset && e.target.dataset.wkAdd;
  if (!d) return;
  e.preventDefault();
  const title = e.target.elements.t.value.trim();
  if (!title) return;
  S.tasks.push(normalize({ id: uid(), kind: 'task', title, due: d, created: Date.now() }));
  save();
  weekUi.open = d;
  render();
  const again = document.querySelector(`[data-wk-add="${d}"] input`);
  if (again) again.focus();
});

Object.assign(LibraryViews, { week: viewWeek });
