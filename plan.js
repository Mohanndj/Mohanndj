'use strict';
// «خطِّط» (v97): the weekly planning of the book «هندسة الأسبوع», built on the app's own tasks, goals and projects
// (one source of truth: nothing is copied into a second list). Roles (S.roles) with «شحذ المنشار» always there and
// its four areas; every project, task and goal carries a role, and a project's tasks take their project's role.
// Tabs: أدواري، يومي (today's items by role, a timetable, up to three top priorities), أسبوعي (each role's week,
// the 70% rule) and the week's review (move to next week, shortened if wished, or cancel what was not done;
// three questions). Kept in the tasks (roleId, area, prio, movedFrom) and in S.weeks (review).

const KH_SAW = 'saw';
const KH_AREAS = { health: 'صحي', social: 'اجتماعي', mind: 'معرفي', soul: 'نفسي' };
const KH_RATE = 70; // the golden rule: 70% of the week's plan is on the right track
const KH_PRIO_MAX = 3;
const KH_COLORS = ['#3d7a8a', '#a0522d', '#6b5b95', '#2e7d5b', '#b0662a', '#8a4f7d', '#4a6fa5', '#7b8b2f'];
const KH_SUGGEST = ['عبدٌ لله', 'ابن', 'زوج', 'أب', 'موظف', 'طالب علم', 'صديق', 'صاحب مشروع', 'كاتب'];
const KH_TABS = [['roles', 'أدواري'], ['today', 'يومي'], ['week', 'أسبوعي']];
const KH_WD = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // first letters of the days, from Sunday
const khUi = { tab: 'today', wk: '', review: '', rv: {}, rvq: null };

function normalizeRole(r) { return { id: r.id || uid(), name: String(r.name || '').trim() || 'دور', created: r.created || Date.now() }; }
// «شحذ المنشار» is always there, after the user's own roles
const khWithSaw = (list) => (list.some((r) => r.id === KH_SAW) ? list : [...list, { id: KH_SAW, name: 'شحذ المنشار', created: 0 }]);
const khRoles = () => [...S.roles.filter((r) => r.id !== KH_SAW), ...S.roles.filter((r) => r.id === KH_SAW)];
const khRole = (id) => (id ? S.roles.find((r) => r.id === id) : null);
const khColor = (id) => (id === KH_SAW ? 'var(--goal)' : khRole(id) ? KH_COLORS[S.roles.filter((r) => r.id !== KH_SAW).findIndex((r) => r.id === id) % KH_COLORS.length] : 'var(--task)');
// a project's task takes its project's role (and area); anything else its own. A deleted role is no role
function khRoleIdOf(t) { const p = t.projectId && getProject(t.projectId); const id = p ? p.roleId : t.roleId; return khRole(id) ? id : ''; }
function khAreaOf(t) { const p = t.projectId && getProject(t.projectId); return khRoleIdOf(t) === KH_SAW ? (p ? p.area : t.area) || '' : ''; }
const khRoleName = (id, area) => (khRole(id) ? `${khRole(id).name}${area ? `: ${KH_AREAS[area]}` : ''}` : 'بلا دور');
const khTag = (t) => { const id = khRoleIdOf(t); return `<span class="kh-tag" style="--rc:${khColor(id)}">${esc(khRoleName(id, khAreaOf(t)))}</span>`; };
const khRoleOptions = (sel) => `<option value="">بلا دور</option>${khRoles().map((r) => `<option value="${r.id}"${r.id === sel ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}`;
const khAreaOptions = (sel) => Object.entries(KH_AREAS).map(([k, l]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${l}</option>`).join('');

// ---------- the role field in the task, goal and project editors ----------
function khFillRole(roleId, area) {
  $('fRole').innerHTML = khRoleOptions(khRole(roleId) ? roleId : '');
  $('fArea').innerHTML = khAreaOptions(area || 'health');
  khSyncRoleField();
}
// a task in a project takes its project's role: the field gives way to a line saying so
function khSyncRoleField() {
  if (!$('fRole') || !draft) return;
  const p = draft.kind === 'task' && getProject($('fProject').value);
  $('fRole').hidden = !!p;
  $('fRoleHint').hidden = !p;
  if (p) $('fRoleHint').textContent = khRole(p.roleId) ? `دور مشروعها: ${khRoleName(p.roleId, p.roleId === KH_SAW ? p.area : '')}` : 'مشروعها بلا دور بعد: اختر له دوراً من تعديل المشروع';
  $('fAreaWrap').hidden = !!p || $('fRole').value !== KH_SAW;
}
document.addEventListener('change', (e) => { if (e.target.id === 'fRole' || e.target.id === 'fProject') khSyncRoleField(); if (e.target.id === 'pRole') $('pAreaWrap').hidden = e.target.value !== KH_SAW; });

// ---------- what belongs to a day and to a week ----------
const khWeekOf = (d) => weekStartOf(d);
const khDays = (k) => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(k, i));
// «اليوم»'s own items: the same list, grouped here by role
function khTodayItems(d) {
  return S.tasks.filter((t) => {
    if (isRepeat(t)) return occursOn(t, d);
    if (t.bookId && t.completions && t.completions[d]) return true;
    if (!t.done && t.due && t.due <= d) return true;
    return t.done && t.doneAt && iso(new Date(t.doneAt)) === d;
  }).sort(byTime(d));
}
// the week's plan: a dated task in the week of its date (an undated one in the week it was done), a goal on
// its days in the week (or its deadline), a book's task in the weeks of its sessions; each a share of the week
function khWeekItems(k) {
  const last = addDays(k, 6), inW = (d) => !!d && d >= k && d <= last, out = [];
  for (const t of S.tasks) {
    if (isRepeat(t)) {
      const days = khDays(k).filter((d) => occursOn(t, d));
      if (days.length) out.push({ t, kind: 'rep', days, need: days.length, done: days.filter((d) => t.completions[d]).length });
    } else if (t.bookId) {
      const ses = Object.keys(t.completions || {}).filter(inW);
      if (ses.length || (!t.done && inW(t.due))) out.push({ t, kind: 'book', need: 1, done: ses.length ? 1 : 0 });
    } else if (isGoal(t)) {
      if (inW(t.due)) out.push({ t, kind: 'goal', need: 1, done: t.done ? 1 : isCounted(t) ? Math.min(1, t.count / t.target) : 0 });
    } else if (t.due ? inW(t.due) : t.done && inW(t.doneAt && iso(new Date(t.doneAt)))) out.push({ t, kind: 'task', need: 1, done: t.done ? 1 : 0 });
  }
  return out;
}
const khFrac = (x) => x.done / x.need;
function khWeekPct(k) {
  const xs = khWeekItems(k);
  return xs.length ? Math.round((xs.reduce((n, x) => n + khFrac(x), 0) / xs.length) * 100) : null;
}
const khRec = (k) => S.weeks.find((w) => w.id === k);
// after the review: the share kept from before what was cancelled
const khShownPct = (k) => { const r = khRec(k); return r && r.review ? r.review.pct : khWeekPct(k); };

// ---------- the page ----------
function viewPlan() {
  if (typeof syncReading === 'function') syncReading();
  if (khUi.review) return khReviewHTML(khUi.review);
  return `<div class="seg kh-tabs" role="group" aria-label="أقسام خطِّط">${KH_TABS.map(([v, l]) => `<button type="button" data-action="kh-tab" data-v="${v}" aria-pressed="${khUi.tab === v}">${l}</button>`).join('')}</div>
  ${khUi.tab === 'roles' ? khRolesHTML() : khUi.tab === 'week' ? khWeekHTML() : khTodayHTML()}`;
}

// ---------- أدواري ----------
// what is still open (an ended goal, a done task or a finished project is not waiting for anything)
const khOpenGoal = (t) => isGoal(t) && !goalEnded(t);
const khOpenTask = (t) => !isGoal(t) && !t.done && !t.projectId;
function khRoleCard(r) {
  const own = (t) => khRoleIdOf(t) === r.id;
  const projects = S.projects.filter((p) => !p.doneAt && p.roleId === r.id);
  const goals = S.tasks.filter((t) => khOpenGoal(t) && own(t));
  const tasks = S.tasks.filter((t) => khOpenTask(t) && own(t));
  const saw = r.id === KH_SAW;
  const goalBtn = (t) => `<button type="button" class="kh-link" data-action="open" data-id="${t.id}">${esc(t.title)}${saw && t.area ? ` <small>(${KH_AREAS[t.area]})</small>` : ''}</button>`;
  const counts = [projects.length && plural(projects.length, 'مشروع واحد', 'مشروعان', 'مشاريع', 'مشروعاً'), goals.length && plural(goals.length, 'هدف واحد', 'هدفان', 'أهداف', 'هدفاً'), tasks.length && plural(tasks.length, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')].filter(Boolean);
  const i = khRoles().indexOf(r), mine = khRoles().filter((x) => x.id !== KH_SAW).length;
  return `<div class="kh-role" style="--rc:${khColor(r.id)}">
    <div class="kh-role-head"><b>${esc(r.name)}</b>
      ${saw ? '<span class="kh-fixed">ثابت</span>' : `<div class="kh-role-acts"><button type="button" class="icon-btn" data-action="kh-role-mv" data-v="${r.id}" data-d="-1" aria-label="إلى الأعلى"${i ? '' : ' disabled'}>▲</button><button type="button" class="icon-btn" data-action="kh-role-mv" data-v="${r.id}" data-d="1" aria-label="إلى الأسفل"${i < mine - 1 ? '' : ' disabled'}>▼</button><button type="button" class="ghost sm" data-action="kh-role-edit" data-v="${r.id}">${icon('edit')} تعديل</button></div>`}</div>
    ${counts.length ? `<p class="note-text">${counts.join(' | ')}</p>` : '<p class="note-text">لا شيء لهذا الدور بعد.</p>'}
    ${saw ? '<p class="note-text explain">عنايتك بنفسك لتقوى على أدوارك كلها، بأربعة جوانب: صحي (رياضة ونوم وغذاء)، واجتماعي (صلة وصداقة ومعروف)، ومعرفي (قراءة وتعلّم)، ونفسي (ما يريح نفسك ويرتّبها).</p>' : ''}
    ${projects.length ? `<div class="kh-sub"><small>المشاريع</small><div class="kh-chips">${projects.map((p) => `<button type="button" class="chip" data-action="open-project" data-v="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>` : ''}
    ${goals.length ? `<div class="kh-sub"><small>الأهداف</small><div class="kh-links">${goals.map(goalBtn).join('')}</div></div>` : ''}
    ${tasks.length ? `<details class="kh-sub"><summary><small>المهام (${tasks.length})</small></summary><div class="kh-links">${tasks.map(goalBtn).join('')}</div></details>` : ''}
    <div class="btn-row kh-adds">${addBtn('kh-new', 'مهمة', ` data-role="${r.id}"`)}${addBtn('kh-new-goal', 'هدف', ` data-role="${r.id}"`)}${addBtn('kh-new-project', 'مشروع', ` data-role="${r.id}"`)}</div>
  </div>`;
}
// what has no role yet (all of it, the first time): a role is chosen for each right here
function khUnassignedHTML() {
  const ps = S.projects.filter((p) => !p.doneAt && !khRole(p.roleId));
  const ts = S.tasks.filter((t) => (khOpenGoal(t) || khOpenTask(t)) && !khRoleIdOf(t));
  if (!ps.length && !ts.length) return '';
  const row = (kind, id, name, what) => `<div class="kh-un-row"><span><b>${esc(name)}</b><small>${what}</small></span><select data-kh-assign="${kind}:${id}" aria-label="دور «${esc(name)}»">${khRoleOptions('')}</select></div>`;
  return `<section class="panel kh-un">
    <h3>بلا دور (${ps.length + ts.length})</h3>
    <p class="note-text">اختر لكل واحد دوره. مهام المشروع تأخذ دور مشروعها.</p>
    ${ps.map((p) => row('project', p.id, p.name, 'مشروع')).join('')}
    ${ts.map((t) => row('task', t.id, t.title, isGoal(t) ? 'هدف' : 'مهمة')).join('')}
  </section>`;
}
function khRolesHTML() {
  const names = new Set(S.roles.map((r) => r.name));
  return `<section class="section">
    <div class="section-head"><h2>أدواري</h2></div>
    <p class="note-text explain">قبل أن تسأل: «ماذا أفعل هذا الأسبوع؟» اسأل: «من أكون؟ وما أدواري في هذه الحياة؟». لكل دور حقه، ولكل دور مهمة واحدة كل أسبوع على الأقل. ويمكنك جمع الأدوار المتقاربة في دور واحد، مثل «عائلية (ابن، زوج، أب)».</p>
    ${khUnassignedHTML()}
    <div class="kh-roles">${khRoles().map(khRoleCard).join('')}</div>
    <form class="panel kh-add" data-kh-add autocomplete="off">
      <h3>أضف دوراً</h3>
      <div class="kh-add-row"><input type="text" name="r" placeholder="مثال: عائلية (ابن، زوج، أب)" aria-label="اسم الدور"><button type="submit" class="primary">أضف</button></div>
      ${KH_SUGGEST.some((s) => !names.has(s)) ? `<div class="kh-chips"><small>أدوار مقترحة:</small>${KH_SUGGEST.filter((s) => !names.has(s)).map((s) => `<button type="button" class="chip" data-action="kh-role-suggest" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
    </form>
  </section>`;
}
function khOpenRole(id) {
  const r = khRole(id);
  if (!r) return;
  ldraft = { kind: 'khrole', id, isNew: false };
  const n = S.projects.filter((p) => p.roleId === id).length + S.tasks.filter((t) => t.roleId === id).length;
  $('libForm').innerHTML = `${sheetHead('تعديل الدور')}
    <label class="field"><span>اسم الدور</span><input type="text" id="khRoleName" value="${esc(r.name)}" autocomplete="off"></label>
    ${n ? `<p class="note-text">حذفه لا يحذف شيئاً مما تحته (${n}): يبقى بلا دور حتى تختار له دوراً.</p>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button><button type="button" class="danger" data-action="kh-role-del">حذف الدور</button></div>`;
  showLib();
}
function khSaveRole() {
  const r = khRole(ldraft.id), name = $('khRoleName').value.trim();
  if (!name) { toast('اكتب اسم الدور.'); return false; }
  if (r) r.name = name;
  save();
  return true;
}

// ---------- يومي ----------
const khPrioBtn = (t, d) => { const on = t.prio === d; return `<button type="button" class="kh-pri" data-action="kh-prio" data-id="${t.id}" aria-pressed="${on}">🚩<span>${on ? 'أولوية قصوى' : 'أولوية'}</span></button>`; };
// one item: the app's own row (its tick, its editor), with the role and the priority beside it
const khItem = (t, d, withTag) => `<ul class="list kh-one${t.prio === d ? ' kh-prio-on' : ''}">${itemHTML(t, d, { extra: `<div class="kh-side">${withTag ? khTag(t) : ''}${khPrioBtn(t, d)}</div>` })}</ul>`;
function khTodayHTML() {
  const d = today(), k = khWeekOf(d), last = addDays(k, 6);
  const items = khTodayItems(d);
  const timed = items.filter(hasTime).sort((a, b) => (timeOn(a, d) ?? 9999) - (timeOn(b, d) ?? 9999));
  const un = items.filter((t) => !hasTime(t));
  const np = items.filter((t) => t.prio === d).length;
  const left = (xs) => { const n = xs.filter((t) => !doneOn(t, d)).length; return xs.length ? `<small class="kh-left${n ? '' : ' ok'}">${n ? `بقي ${n}` : 'أنجزتها كلها'}</small>` : ''; };
  let lastL = '';
  const tl = timed.map((t) => { const l = timeLabel(t, d), h = l !== lastL ? `<span class="kh-tl-h">${esc(l)}</span>` : ''; lastL = l; return `${h}<div class="kh-tl-i" style="--rc:${khColor(khRoleIdOf(t))}">${khItem(t, d, true)}</div>`; }).join('');
  const groups = [...khRoles(), null].map((r) => {
    const xs = un.filter((t) => khRoleIdOf(t) === (r ? r.id : ''));
    return xs.length ? `<div class="kh-day-role" style="--rc:${khColor(r ? r.id : '')}"><h3 class="kh-rt">${esc(r ? r.name : 'بلا دور')}</h3>${xs.map((t) => khItem(t, d, false)).join('')}</div>` : '';
  }).join('');
  const later = S.tasks.filter((t) => !isGoal(t) && !t.done && !t.bookId && t.due > d && t.due <= last).sort((a, b) => a.due.localeCompare(b.due));
  const undated = S.tasks.filter((t) => !isGoal(t) && !t.done && !t.bookId && !t.due);
  const pend = (t) => `<div class="kh-pend" style="--rc:${khColor(khRoleIdOf(t))}"><button type="button" class="kh-link" data-action="open" data-id="${t.id}">${esc(t.title)}<small>${esc(khRoleName(khRoleIdOf(t), khAreaOf(t)))}${t.due ? ` | ${esc(dueLabel(t.due))}` : ''}</small></button><button type="button" class="ghost sm" data-action="kh-to-today" data-id="${t.id}">لليوم</button></div>`;
  return `<section class="section">
    <div class="section-head"><h2>يومي</h2><small>${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</small></div>
    ${np ? `<p class="kh-prio-sum">🚩 أولوياتك القصوى اليوم: ${np} من ${KH_PRIO_MAX}</p>` : ''}
    <p class="note-text explain">ما تخرجه كل يوم من خطة أسبوعك، بأدواره. ما له وقت في «جدول يومك» مرتباً بوقته. واجعل أهم ثلاث مهام في يومك «أولوية قصوى»، وإذا أتممت واحدة فأزل عنها الأولوية لتضعها على غيرها. وإن فاتك يوم فلا بأس؛ الأسبوع يسمح بتعويض ما فات.</p>
    ${timed.length ? `<div class="panel kh-block"><div class="row-between"><h3>${icon('clock')} جدول يومك</h3>${left(timed)}</div><div class="kh-tl">${tl}</div></div>` : ''}
    ${un.length ? `<div class="panel kh-block"><div class="row-between"><h3>${timed.length ? 'في أي وقت من يومك' : 'مهام اليوم'}</h3>${left(un)}</div>${groups}</div>` : ''}
    ${items.length ? '' : emptyHTML('لا شيء لهذا اليوم بعد', 'أضف مهمة لليوم، أو انقل إليه من مهام أسبوعك.')}
    <div class="btn-row">${addBtn('kh-new', 'مهمة لليوم', ` data-due="${d}"`)}</div>
    ${later.length ? `<div class="panel kh-block"><h3>من مهام أسبوعك</h3><p class="note-text explain">مهام موعدها في بقية الأسبوع. انقل إلى يومك ما تقدر عليه.</p>${later.map(pend).join('')}</div>` : ''}
    ${undated.length ? `<details class="panel kh-block"><summary><b>بلا موعد (${undated.length})</b></summary>${undated.map(pend).join('')}</details>` : ''}
  </section>`;
}

// ---------- أسبوعي ----------
function khProgressHTML(k) {
  const p = khShownPct(k), n = khWeekItems(k).length;
  const msg = p === null ? 'أضف مهام أسبوعك: لكل دور مهمة واحدة على الأقل.' : p >= KH_RATE ? `أنجزت ${p}٪: أنت في الطريق الصحيح.` : 'القاعدة الذهبية: إن أنجزت ٧٠٪ من خطتك فأنت في الطريق الصحيح. وما بقي تنقله أو تختصره أو تلغيه في المراجعة.';
  return `<div class="panel kh-prog">
    <div class="row-between"><b>إنجاز الأسبوع</b><span class="kh-pct${p !== null && p >= KH_RATE ? ' ok' : ''}">${p === null ? '—' : `${p}٪`}</span></div>
    <div class="kh-track" role="img" aria-label="الإنجاز ${p === null ? 'لم يبدأ' : `${p}٪`}، والهدف ٧٠٪"><i style="width:${p || 0}%"></i><b class="kh-mark" style="inset-inline-start:${KH_RATE}%"></b></div>
    <p class="note-text">${msg}${n ? ` (${plural(n, 'بند واحد', 'بندان', 'بنود', 'بنداً')} في خطة الأسبوع)` : ''}</p>
  </div>`;
}
// a recurring goal in the week: its days as dots, ticked on the day (a day still to come waits)
function khRepRow(x, t0) {
  const t = x.t;
  return `<div class="kh-rep">
    <button type="button" class="kh-link" data-action="open" data-id="${t.id}">${esc(t.title)}${isHabit(t) ? ' <small>(عادة)</small>' : ''}</button>
    <div class="kh-dots">${x.days.map((d) => `<button type="button" class="kh-dot${t.completions[d] ? ' on' : ''}${d === t0 ? ' now' : ''}" data-action="toggle" data-id="${t.id}" data-date="${d}" aria-pressed="${!!t.completions[d]}" aria-label="${esc(AR_DAYS[parse(d).getDay()])}${isCounted(t) ? `: ${countOn(t, d)} من ${t.target}` : ''}"${d > t0 ? ' disabled' : ''}>${isCounted(t) && !t.completions[d] && countOn(t, d) ? countOn(t, d) : KH_WD[parse(d).getDay()]}</button>`).join('')}<small class="kh-cnt${x.done >= x.need ? ' ok' : ''}">${x.done} من ${x.need}</small></div>
  </div>`;
}
function khWeekHTML() {
  const t0 = today(), k = khUi.wk || khWeekOf(t0), last = addDays(k, 6);
  const xs = khWeekItems(k), rec = khRec(k);
  const card = (r) => {
    const id = r ? r.id : '', mine = xs.filter((x) => khRoleIdOf(x.t) === id);
    if (!r && !mine.length) return '';
    const full = mine.filter((x) => khFrac(x) === 1).length;
    const rows = [...mine.filter((x) => x.kind !== 'rep').sort((a, b) => (a.t.due || '').localeCompare(b.t.due || '')).map((x) => `<ul class="list">${itemHTML(x.t, x.t.due && x.t.due >= k && x.t.due <= last ? x.t.due : t0 >= k && t0 <= last ? t0 : k)}</ul>`),
      ...mine.filter((x) => x.kind === 'rep').map((x) => khRepRow(x, t0))];
    return `<div class="kh-role kh-wk" style="--rc:${khColor(id)}">
      <div class="kh-role-head"><b>${esc(r ? r.name : 'بلا دور')}</b>${mine.length ? `<small class="kh-cnt${full === mine.length ? ' ok' : ''}">أنجزت ${full} من ${mine.length}</small>` : ''}</div>
      ${rows.length ? `<div class="kh-rows">${rows.join('')}</div>` : `<p class="note-text">لا شيء لهذا الدور هذا الأسبوع${r && r.id === KH_SAW ? '. مهمة صغيرة لكل جانب تكفي.' : '. مهمة واحدة على الأقل تبقيك حاضراً فيه.'}</p>`}
      ${r ? `<div class="btn-row kh-adds">${addBtn('kh-new', 'مهمة', ` data-role="${r.id}" data-due="${t0 >= k && t0 <= last ? t0 : k}"`)}${addBtn('kh-new-goal', 'هدف', ` data-role="${r.id}"`)}</div>` : ''}
    </div>`;
  };
  return `<section class="section">
    <div class="cal-head">
      <div class="nav"><button type="button" data-action="kh-wk" data-v="-7" aria-label="الأسبوع السابق">${icon('prev')}</button></div>
      <div class="titles"><h2>أسبوعي</h2><small>${esc(fmtDate(k, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(last, { day: 'numeric', month: 'long' }))}</small><small>${esc(fmtHijri(k, { day: 'numeric', month: 'long' }))} – ${esc(fmtHijri(last, { day: 'numeric', month: 'long', year: 'numeric' }))}</small></div>
      <div class="nav"><button type="button" data-action="kh-wk" data-v="7" aria-label="الأسبوع التالي">${icon('next')}</button></div>
    </div>
    ${k !== khWeekOf(t0) ? '<button type="button" class="ghost" data-action="kh-wk-now">العودة إلى هذا الأسبوع</button>' : ''}
    <p class="note-text explain">لكل دور مهمة واحدة على الأقل، ومعها «شحذ المنشار». وما تنجزه في يومك ينعكس هنا.</p>
    ${khProgressHTML(k)}
    ${k <= t0 ? `<button type="button" class="${rec && rec.review ? 'ghost' : 'primary'} kh-rv-btn" data-action="kh-review" data-v="${k}">${rec && rec.review ? `✓ راجعت هذا الأسبوع ${esc(relDate(rec.review.at))}: افتح المراجعة` : 'راجع أسبوعك'}</button>` : ''}
    ${[...khRoles(), null].map(card).join('')}
  </section>`;
}

// ---------- مراجعة الأسبوع ----------
// what can be moved or cancelled: the week's one-time tasks still not done (a goal or a book renews by itself)
const khOpenInWeek = (k) => khWeekItems(k).filter((x) => x.kind === 'task' && !x.t.done).map((x) => x.t);
function khReviewHTML(k) {
  const rec = khRec(k), done = !!(rec && rec.review), xs = khWeekItems(k);
  const open = done ? [] : khOpenInWeek(k);
  khUi.rvq = khUi.rvq || { worked: '', missed: '', change: '', ...(rec && rec.review ? { worked: rec.review.worked, missed: rec.review.missed, change: rec.review.change } : {}) };
  const bal = [...khRoles(), null].map((r) => { const mine = xs.filter((x) => khRoleIdOf(x.t) === (r ? r.id : '')); return [r, mine.filter((x) => khFrac(x) === 1).length, mine.length]; }).filter((x) => x[2]);
  const none = bal.filter(([r, d]) => r && !d);
  return `<div class="crumbs"><button type="button" class="back" data-action="kh-review-close">${icon('back')} أسبوعي</button></div>
  <section class="section">
    <div class="section-head"><h2>مراجعة الأسبوع</h2><small>${esc(fmtDate(k, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(addDays(k, 6), { day: 'numeric', month: 'long' }))}</small></div>
    <p class="note-text explain">لا أحد ينجز كل ما وضعه بدقة. الخطة وسيلة لا غاية، والتقدم بحد ذاته إنجاز. احذر فخ المثالية: أن تظن أنك يجب أن تنجز كل ما كتبته، وفخ الإحباط: أن تتوقف عن التخطيط لأنك لم تنجز كل شيء.</p>
    ${khProgressHTML(k)}
    ${bal.length ? `<div class="panel"><h3>توازن أدوارك</h3>${bal.map(([r, d, n]) => `<div class="kh-bal" style="--rc:${khColor(r ? r.id : '')}"><span>${esc(r ? r.name : 'بلا دور')}</span><span class="kh-track sm"><i style="width:${Math.round((d / n) * 100)}%"></i></span><small>${d} من ${n}</small></div>`).join('')}
      ${none.length ? `<p class="note-text">لم تنجز شيئاً في: ${none.map(([r]) => `«${esc(r.name)}»`).join('، ')}. تذكّر أن تمنح كل دور حقه ولو بأقل الجهد.</p>` : ''}</div>` : ''}
    ${done ? (rec.review.moved || rec.review.dropped.length ? `<p class="note-text">${[rec.review.moved ? `نقلت ${plural(rec.review.moved, 'مهمة واحدة', 'مهمتين', 'مهام', 'مهمة')} إلى الأسبوع التالي` : '', rec.review.dropped.length ? `وألغيت: ${rec.review.dropped.map((x) => `«${esc(x)}»`).join('، ')}` : ''].filter(Boolean).join('، ')}.</p>` : '')
      : open.length ? `<div class="panel"><h3>ما لم يُنجز</h3><p class="note-text">لكل مهمة: انقلها إلى الأسبوع القادم (واختصرها إن شئت)، أو ألغها فتُحذف من مهامك.</p>
      ${open.map((t) => { const c = khUi.rv[t.id] = khUi.rv[t.id] || { act: 'move', text: t.title };
        return `<div class="kh-rv" style="--rc:${khColor(khRoleIdOf(t))}"><b>${esc(t.title)}</b><small>${esc(khRoleName(khRoleIdOf(t), khAreaOf(t)))} | ${esc(dueLabel(t.due))}</small>
          <div class="seg" role="group"><button type="button" data-action="kh-rv-act" data-id="${t.id}" data-v="move" aria-pressed="${c.act === 'move'}">أنقلها</button><button type="button" data-action="kh-rv-act" data-id="${t.id}" data-v="drop" aria-pressed="${c.act === 'drop'}">ألغها</button></div>
          ${c.act === 'move' ? `<label class="field"><span>تُنقل بهذا النص (اختصرها إن شئت)</span><input type="text" data-kh-rvtext="${t.id}" value="${esc(c.text)}" autocomplete="off"></label>` : ''}</div>`; }).join('')}</div>`
        : xs.length ? '<p class="note-text kh-ok">أنجزت كل مهامك هذا الأسبوع. بارك الله في وقتك.</p>' : ''}
    <div class="panel"><h3>وقفة مع نفسك</h3>
      <label class="field"><span>ما الذي نجح هذا الأسبوع؟ (اختياري)</span><textarea rows="2" data-kh-q="worked">${esc(khUi.rvq.worked)}</textarea></label>
      <label class="field"><span>ما الذي لم ينجح؟ ولماذا؟ (اختياري)</span><textarea rows="2" data-kh-q="missed">${esc(khUi.rvq.missed)}</textarea></label>
      <label class="field"><span>ماذا أغيّر في الأسبوع القادم؟ (اختياري)</span><textarea rows="2" data-kh-q="change">${esc(khUi.rvq.change)}</textarea></label>
    </div>
    <button type="button" class="primary" data-action="kh-rv-save" data-v="${k}">${done ? 'احفظ المراجعة' : open.length ? 'احفظ المراجعة وانقل ما اخترت' : 'احفظ المراجعة'}</button>
  </section>`;
}
function khSaveReview(k) {
  let rec = khRec(k);
  if (!rec) { rec = normalizeWeek({ id: k }); S.weeks.push(rec); }
  const q = { worked: khUi.rvq.worked.trim(), missed: khUi.rvq.missed.trim(), change: khUi.rvq.change.trim() };
  let moved = 0;
  const dropped = [];
  if (!rec.review) {
    // the week's share is kept from before anything is cancelled, so cancelling never raises it
    const pct = khWeekPct(k) ?? 0;
    for (const t of khOpenInWeek(k)) {
      const c = khUi.rv[t.id] || { act: 'move', text: t.title };
      if (c.act === 'drop') { dropped.push(t.title); S.tasks = S.tasks.filter((x) => x.id !== t.id); continue; }
      // to the same day of the next week; with the text shortened if it was
      t.due = addDays(t.due, 7);
      t.title = c.text.trim() || t.title;
      t.movedFrom = k;
      moved++;
    }
    rec.review = { at: today(), pct, moved, dropped, ...q };
  } else Object.assign(rec.review, q);
  save();
  return { moved, dropped: dropped.length };
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="kh-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'kh-tab': khUi.tab = v; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-wk': khUi.wk = addDays(khUi.wk || khWeekOf(today()), Number(v)); render(); break;
    case 'kh-wk-now': khUi.wk = ''; render(); break;
    case 'kh-new': openSheet(null, { kind: 'task', due: el.dataset.due || undefined, roleId: el.dataset.role || '' }); break;
    case 'kh-new-goal': openSheet(null, { kind: 'goal', repeat: true, roleId: el.dataset.role || '' }); break;
    case 'kh-new-project': openProjectSheet(null, el.dataset.role || ''); break;
    case 'kh-to-today': { const t = getTask(el.dataset.id); if (!t) break; t.due = today(); save(); render(); toast('صارت لليوم'); break; }
    // three top priorities a day at most; one finished is taken off to give the place to another
    case 'kh-prio': {
      const t = getTask(el.dataset.id), d = today();
      if (!t) break;
      if (t.prio === d) { t.prio = ''; toast('أُزيلت الأولوية'); } else {
        if (khTodayItems(d).filter((x) => x.prio === d).length >= KH_PRIO_MAX) { toast('ثلاث أولويات قصوى في اليوم على الأكثر. أزل الأولوية عن مهمة أتممتها لتضعها هنا'); break; }
        t.prio = d; toast('صارت أولوية قصوى لليوم');
      }
      save(); render();
      break;
    }
    case 'kh-role-suggest': { if (!S.roles.some((r) => r.name === v)) { S.roles.splice(S.roles.findIndex((r) => r.id === KH_SAW), 0, normalizeRole({ name: v })); save(); render(); toast(`أُضيف دور «${v}»`); } break; }
    case 'kh-role-mv': {
      const mine = S.roles.filter((r) => r.id !== KH_SAW), i = mine.findIndex((r) => r.id === v), j = i + Number(el.dataset.d);
      if (i < 0 || j < 0 || j >= mine.length) break;
      [mine[i], mine[j]] = [mine[j], mine[i]];
      S.roles = khWithSaw(mine);
      save(); render();
      break;
    }
    case 'kh-role-edit': khOpenRole(v); break;
    case 'kh-role-del': {
      if (!selArmed(el)) break;
      const id = ldraft.id;
      S.roles = S.roles.filter((r) => r.id !== id);
      // what was under it stays, with no role, until it is given one
      for (const p of S.projects) if (p.roleId === id) { p.roleId = ''; p.area = ''; }
      for (const t of S.tasks) if (t.roleId === id) { t.roleId = ''; t.area = ''; }
      save(); closeLib(); render(); toast('حُذف الدور');
      break;
    }
    case 'kh-review': khUi.review = v; khUi.rv = {}; khUi.rvq = null; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-review-close': khUi.review = ''; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-rv-act': { const t = getTask(el.dataset.id); if (!t) break; const c = khUi.rv[t.id] = khUi.rv[t.id] || { act: 'move', text: t.title }; c.act = v; render(); break; }
    case 'kh-rv-save': {
      const k = v, r = khSaveReview(k);
      khUi.review = ''; khUi.rv = {}; khUi.rvq = null;
      // to the next week, as in the book: what was moved is waiting there
      khUi.wk = addDays(k, 7) === khWeekOf(today()) ? '' : addDays(k, 7);
      render(); window.scrollTo({ top: 0 });
      toast(r.moved ? `حُفظت المراجعة، ونُقل ${plural(r.moved, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')} إلى الأسبوع القادم` : 'حُفظت المراجعة');
      break;
    }
  }
});
document.addEventListener('input', (e) => {
  const q = e.target.dataset && e.target.dataset.khQ;
  if (q && khUi.rvq) khUi.rvq[q] = e.target.value;
  const id = e.target.dataset && e.target.dataset.khRvtext;
  if (id && khUi.rv[id]) khUi.rv[id].text = e.target.value;
});
document.addEventListener('change', (e) => {
  const a = e.target.dataset && e.target.dataset.khAssign;
  if (!a || !e.target.value) return;
  const [kind, id] = a.split(':'), role = e.target.value;
  const x = kind === 'project' ? getProject(id) : getTask(id);
  if (!x) return;
  x.roleId = role;
  x.area = role === KH_SAW ? 'health' : '';
  save(); render();
  toast(`صار في «${khRole(role).name}»`);
});
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-kh-add]')) return;
  e.preventDefault();
  const name = e.target.elements.r.value.trim();
  if (!name) return;
  if (S.roles.some((r) => r.name === name)) { toast('هذا الدور موجود.'); return; }
  S.roles.splice(S.roles.findIndex((r) => r.id === KH_SAW), 0, normalizeRole({ name }));
  save(); render();
  toast(`أُضيف دور «${name}»`);
  const again = document.querySelector('[data-kh-add] input');
  if (again) again.focus();
});
