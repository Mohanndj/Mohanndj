'use strict';
// «خطِّط» (v97): the weekly planning of the book «هندسة الأسبوع», built on the app's own tasks, goals and projects
// (one source of truth: nothing is copied into a second list). Roles (S.roles) with «شحذ المنشار» always there and
// its four areas; every project, task and goal carries a role, and a project's tasks take their project's role.
// Tabs: أدواري، يومي (today's items by role, a timetable, up to three top priorities), أسبوعي (each role's week,
// the 70% rule) and the week's review (move to next week, shortened if wished, or cancel what was not done;
// three questions). Kept in the tasks (roleId, area, prio, movedFrom) and in S.weeks (review).
// v98: from the vision to the days (S.kgoals): a vision in each role, a goal for the year, its months, their weeks
// and the tasks of their days (recurring goals of «اليوم» with kgoal = their week goal); the tabs شهري، سنتي، حياتي;
// and «سجل حياتي» (a task done, marked «✦ ينعكس في حياتي»: t.life).
// v99: «إحصائياتي» in place of the old page «الإحصائيات»: a week, a month, a year or years, counted from what is ticked.

const KH_SAW = 'saw';
const KH_AREAS = { health: 'صحي', social: 'اجتماعي', mind: 'معرفي', soul: 'نفسي' };
const KH_RATE = 70; // the golden rule: 70% of the week's plan is on the right track
const KH_PRIO_MAX = 3;
const KH_COLORS = ['#3d7a8a', '#a0522d', '#6b5b95', '#2e7d5b', '#b0662a', '#8a4f7d', '#4a6fa5', '#7b8b2f'];
const KH_SUGGEST = ['عبدٌ لله', 'ابن', 'زوج', 'أب', 'موظف', 'طالب علم', 'صديق', 'صاحب مشروع', 'كاتب'];
const KH_TABS = [['roles', 'أدواري'], ['today', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري'], ['year', 'سنتي'], ['life', 'حياتي'], ['stats', 'إحصائياتي']];
const KH_WD = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // first letters of the days, from Sunday
const khUi = { tab: 'today', wk: '', mo: '', yr: '', review: '', rv: {}, rvq: null, st: { mode: 'week' }, role: '' };

function normalizeRole(r) { return { id: r.id || uid(), name: String(r.name || '').trim() || 'دور', created: r.created || Date.now(), tpl: r.tpl || '' }; } // (tpl: made by a template, v109)
// «شحذ المنشار» is always there, after the user's own roles
const khWithSaw = (list) => (list.some((r) => r.id === KH_SAW) ? list : [...list, { id: KH_SAW, name: 'شحذ المنشار', created: 0 }]);
const khRoles = () => [...S.roles.filter((r) => r.id !== KH_SAW), ...S.roles.filter((r) => r.id === KH_SAW)];
const khRole = (id) => (id ? S.roles.find((r) => r.id === id) : null);
const khColor = (id) => (id === KH_SAW ? 'var(--goal)' : khRole(id) ? KH_COLORS[S.roles.filter((r) => r.id !== KH_SAW).findIndex((r) => r.id === id) % KH_COLORS.length] : 'var(--task)');
// a project's task takes its project's role (and area), a task of the plan its goal's (v98); anything else its own.
// A deleted role is no role
function khRoleIdOf(t) { const g = t.kgoal && kgOf(t.kgoal); if (g) return kgRoleId(g); const p = t.projectId && getProject(t.projectId); const id = p ? p.roleId : t.roleId; return khRole(id) ? id : ''; }
function khAreaOf(t) { const p = t.projectId && getProject(t.projectId); return khRoleIdOf(t) === KH_SAW ? (p ? p.area : t.area) || '' : ''; }
const khRoleName = (id, area) => (khRole(id) ? `${khRole(id).name}${area ? `: ${KH_AREAS[area]}` : ''}` : 'بلا دور');
const khTag = (t) => { const id = khRoleIdOf(t); return `<span class="kh-tag" style="--rc:${khColor(id)}">${esc(khRoleName(id, khAreaOf(t)))}</span>`; };
const khRoleOptions = (sel) => `<option value="">بلا دور</option>${khRoles().map((r) => `<option value="${r.id}"${r.id === sel ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}`;
const khAreaOptions = (sel) => Object.entries(KH_AREAS).map(([k, l]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${l}</option>`).join('');
// a project serving a year goal (v114, shown with its tasks under the goal in «سنتي»): the open year goals whose year has
// not ended, and the one it serves now (each with its role, which the project takes when it is chosen)
const khYGoalOptions = (sel) => {
  const gs = S.kgoals.filter((g) => g.level === 'year' && (g.id === sel || (!kgClosedOf(g) && (khKeySpan(g.period) || [, '9999'])[1] > today())));
  return `<option value="">لا يخدم هدف سنة</option>${gs.map((g) => `<option value="${g.id}" data-role="${kgRoleId(g)}"${g.id === sel ? ' selected' : ''}>${esc(g.text)} | ${esc(khRoleName(kgRoleId(g)))} | ${esc(khKeyLabel(g.period))}</option>`).join('')}`;
};

// ---------- the role field in the task, goal and project editors ----------
function khFillRole(roleId, area) {
  const ct = draft && getTask(draft.id), g = ct && kgOf(ct.kgoal);
  $('fRole').innerHTML = khRoleOptions(g ? kgRoleId(g) : khRole(roleId) ? roleId : '');
  $('fArea').innerHTML = khAreaOptions(area || 'health');
  khSyncRoleField();
}
// a task in a project takes its project's role, and a task of the plan its goal's: the field gives way to a line saying so
function khSyncRoleField() {
  if (!$('fRole') || !draft) return;
  const p = draft.kind === 'task' && getProject($('fProject').value);
  const ct = getTask(draft.id), g = ct && kgOf(ct.kgoal);
  $('fRole').hidden = !!p || !!g;
  $('fRoleHint').hidden = !p && !g;
  if (g) $('fRoleHint').textContent = `دور هدفها: ${khRoleName(kgRoleId(g))} | ${KH_LEVEL[g.level]}: ${g.text}`;
  else if (p) $('fRoleHint').textContent = khRole(p.roleId) ? `دور مشروعها: ${khRoleName(p.roleId, p.roleId === KH_SAW ? p.area : '')}` : 'مشروعها بلا دور بعد: اختر له دوراً من تعديل المشروع';
  $('fAreaWrap').hidden = !!p || $('fRole').value !== KH_SAW;
}
document.addEventListener('change', (e) => { if (e.target.id === 'tbRole' && $('tbAreaWrap')) $('tbAreaWrap').hidden = e.target.value !== KH_SAW; if (e.target.id === 'fRole' || e.target.id === 'fProject') khSyncRoleField(); if (e.target.id === 'pRole') { $('pAreaWrap').hidden = e.target.value !== KH_SAW; khPYGoalFit(); } if (e.target.id === 'pYGoal') khPRoleFit(); });
// the project's role and the year goal it serves agree: a goal chosen gives its role, a role chosen leaves a goal of another
function khPRoleFit() { const o = $('pYGoal').selectedOptions[0], r = o && o.dataset.role; if (r && khRole(r)) { $('pRole').value = r; $('pAreaWrap').hidden = r !== KH_SAW; } }
function khPYGoalFit() { const o = $('pYGoal').selectedOptions[0], r = o && o.dataset.role; if (r && r !== $('pRole').value) $('pYGoal').value = ''; }

// ---------- the plan's months and years (v98), in the calendar chosen for the monthly calendar (S.settings.calType) ----------
// A week belongs to the month it starts in (so a month has four weeks or five). A chosen month is kept as two dates
// (its first day~the next month's first day) and read by its middle, so switching the calendar never spoils it.
const KH_HP = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
const KH_CAL = new Map(); // sums on the calendar alone: kept
const khMemo = new Map(); // sums on the data: cleared on every save and every drawing
const khCalc = (k, fn) => { if (!KH_CAL.has(k)) KH_CAL.set(k, fn()); return KH_CAL.get(k); };
const khMm = (k, fn) => { if (!khMemo.has(k)) khMemo.set(k, fn()); return khMemo.get(k); };
// a goal's own calendar (v126, the owner's request: «إذا اخترت السنة الهجرية يجب أن تصير الشهور هجرية»): while its chain
// is worked out (its steps, its tasks' first and last days, the weeks it is in) the months are those of its year's calendar
let khForce = '';
const khHj = () => (khForce ? khForce === 'h' : calHijri());
function khIn(c, fn) { const o = khForce; khForce = c === 'h' || c === 'g' ? c : o; try { return fn(); } finally { khForce = o; } }
const kgCal = (g) => { const y = g && kgYear(g); return y && y.period ? y.period[0] : ''; };
const khCt = () => (khHj() ? 'h' : 'g');
function khHij(d) { return khCalc(`H${d}`, () => { const p = {}; for (const x of KH_HP.formatToParts(parse(d))) p[x.type] = x.value; return { y: Number(p.year), m: Number(p.month) }; }); }
const khMoStart = (d) => khCalc(`s${khCt()}${d}`, () => (khHj() ? hMonthStart(d) : `${d.slice(0, 8)}01`));
const khMoNext = (m) => khCalc(`n${khCt()}${m}`, () => (khHj() ? hMonthNext(m) : khMoStart(addDays(m, 32))));
const khMoPrev = (m) => khMoStart(addDays(m, -1));
function khYrStart(d) { return khCalc(`y${khCt()}${d}`, () => { if (!khHj()) return `${d.slice(0, 4)}-01-01`; let m = khMoStart(d); for (let i = 0; i < 13 && khHij(m).m !== 1; i++) m = khMoPrev(m); return m; }); }
const khYrNext = (y) => khCalc(`Y${khCt()}${y}`, () => { let m = y; for (let i = 0; i < 12; i++) m = khMoNext(m); return m; });
const khYrPrev = (y) => khYrStart(addDays(y, -1));
const khYrKey = (y) => (khHj() ? `h${khHij(y).y}` : `g${y.slice(0, 4)}`);
const khYrLabel = (y) => (khHj() ? `${khHij(y).y} هـ` : `${y.slice(0, 4)} م`);
const khMoLabel = (m) => (khHj() ? fmtHijri(m, { month: 'long', year: 'numeric' }) : fmtDate(m, { month: 'long', year: 'numeric' }));
const khMoShort = (m) => (khHj() ? fmtHijri(m, { month: 'long' }) : fmtDate(m, { month: 'long' }));
const khDayLabel = (d) => (khHj() ? fmtHijri(d, { day: 'numeric', month: 'long' }) : fmtDate(d, { day: 'numeric', month: 'long' }));
const khDaysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const khMid = (r) => { const [a, b] = r.split('~'); return addDays(a, Math.floor(khDaysBetween(a, b) / 2)); };
const khInRanges = (rs, from, to) => rs.some((r) => { const d = khMid(r); return d >= from && d < to; });
const khMoRange = (m) => `${m}~${khMoNext(m)}`;
// the weeks that start in [from, to)
function khWeekStarts(from, to) { const out = []; let k = weekStartOf(from); if (k < from) k = addDays(k, 7); for (; k < to; k = addDays(k, 7)) out.push(k); return out; }
const khWeeksOf = (m) => khWeekStarts(m, khMoNext(m));
const khWkOrd = (k) => khWeeksOf(khMoStart(k)).indexOf(k) + 1; // 1 = the month's first week
// a year goal's year («g2026» or «h1448») as two dates, in its own calendar
function khKeySpan(key) {
  return khCalc(`k${key}`, () => {
    const mm = /^([gh])(\d{4})$/.exec(key || '');
    if (!mm) return null;
    const n = Number(mm[2]);
    if (mm[1] === 'g') return [`${n}-01-01`, `${n + 1}-01-01`];
    let d = today();
    for (let i = 0; i < 20 && khHij(d).y !== n; i++) d = addDays(d, (n - khHij(d).y) * 354);
    if (khHij(d).y !== n) return null;
    const ys = (x) => { x = hMonthStart(x); for (let i = 0; i < 13 && khHij(x).m !== 1; i++) x = hMonthStart(addDays(x, -1)); return x; };
    const a = ys(d);
    return [a, ys(addDays(a, 370))];
  });
}
const khKeyLabel = (key) => { const mm = /^([gh])(\d{4})$/.exec(key || ''); return mm ? `${mm[2]} ${mm[1] === 'h' ? 'هـ' : 'م'}` : ''; };
// a year key in the calendar chosen now: the year its middle falls in (a year goal stays in «سنتي» after a switch)
const khYrOfKey = (key) => { const sp = khKeySpan(key); return sp ? khYrStart(addDays(sp[0], Math.floor(khDaysBetween(sp[0], sp[1]) / 2))) : null; };
const khYearOpts = () => { const y = khYrStart(today()), n = khYrNext(y); return [[khYrKey(y), khYrLabel(y)], [khYrKey(n), khYrLabel(n)]]; };
// how many of the months a year goal is tied to fall outside a year (by their middle, as everywhere): they move with it
const khYearOut = (yg, key) => { const sp = khKeySpan(key); return !yg || !sp ? 0 : kgKids(yg, 'month').reduce((n, m) => n + m.months.filter((r) => { const d = khMid(r); return d < sp[0] || d >= sp[1]; }).length, 0); };
// the years a year goal can be moved to (v118, the owner's request: «القدرة على تعديل سنة الهدف السنوي», after a goal written
// in the Gregorian calendar could not go to another Gregorian year once the calendar was Hijri): this year and the next in
// the calendar chosen now, then in the other calendar, and its own year
function khYearChoices(yk) {
  const g = Number(today().slice(0, 4)), h = khHij(today()).y;
  const gs = [[`g${g}`, khKeyLabel(`g${g}`)], [`g${g + 1}`, khKeyLabel(`g${g + 1}`)]], hs = [[`h${h}`, khKeyLabel(`h${h}`)], [`h${h + 1}`, khKeyLabel(`h${h + 1}`)]];
  const all = calHijri() ? [...hs, ...gs] : [...gs, ...hs];
  return all.some(([k]) => k === yk) || !yk ? all : [...all, [yk, khKeyLabel(yk)]];
}
// a year goal moved to another year: the months it is tied to go with it, each to the same month of its own calendar in
// the new year (between calendars, the same month a year on or back, or the new year's nearest month); its tasks follow
const khGNext = (a) => `${addDays(a, 32).slice(0, 8)}01`;
function khRangeShift(r, k) {
  const [a, b] = r.split('~');
  if (a.endsWith('-01') && b === khGNext(a)) { const s = `${Number(a.slice(0, 4)) + k}${a.slice(4)}`; return `${s}~${khGNext(s)}`; }
  const h = khHij(a), ty = h.y + k;
  let x = hMonthStart(addDays(a, Math.round(k * 354.37) + 14));
  for (let i = 0; i < 4; i++) { const q = khHij(x), dm = (ty - q.y) * 12 + (h.m - q.m); if (!dm) break; x = dm > 0 ? hMonthNext(x) : hMonthStart(addDays(x, -1)); }
  return `${x}~${hMonthNext(x)}`;
}
function khRangeInto(r, sp, hij) {
  const inSp = (x) => { const d = khMid(x); return d >= sp[0] && d < sp[1]; };
  if (inSp(r)) return r;
  for (const k of [1, -1, 2, -2, 3, -3]) { const x = khRangeShift(r, k); if (inSp(x)) return x; }
  const d = khMid(r) < sp[0] ? sp[0] : addDays(sp[1], -1), s = hij ? hMonthStart(d) : `${d.slice(0, 8)}01`;
  return `${s}~${hij ? hMonthNext(s) : khGNext(s)}`;
}
function khMoveYear(yg, key) {
  const sp = khKeySpan(key);
  if (!sp || yg.period === key) return;
  yg.period = key;
  for (const m of kgKids(yg, 'month')) {
    m.months = [...new Set(m.months.map((r) => khRangeInto(r, sp, key[0] === 'h')))].sort();
    khSyncStart(m); // (its tasks run in its months of the year it is in now)
  }
}
// said under the years when the year chosen moves its months
const khMoveNote = (yg, yk) => (yg && yk !== yg.period && khYearOut(yg, yk) ? `<p class="note-text">أشهره المربوطة تنتقل معه إلى ${esc(khKeyLabel(yk))}</p>` : '');

// ---------- from the vision to the days (v98): S.kgoals ----------
// A vision in each role (life); a goal for the year that serves it; the months it is in (chosen ones, or a number of
// any months); the weeks of those months (by their order in the month, all of them, or a number of any); and the days:
// recurring goals of «اليوم» itself (S.tasks with kgoal = the week goal) on the days chosen, or tasks for one week.
// Each level is measured by the one under it: the week by its days, the month by its weeks, the year by its months;
// a month or a week can also be ticked «تحقّق» by the user's own judgement.
const KH_LEVEL = { life: 'رؤية', year: 'هدف السنة', month: 'هدف الشهر', week: 'هدف الأسبوع' };
const KH_GSTAT = { open: 'قائم', done: 'تحقق', dropped: 'أُلغي' };
const KH_ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
// the five laws of a goal («هندسة الأسبوع»)
const KH_LAWS = [['clear', 'واضح', 'تعرف منه ما تفعله بالضبط'], ['measured', 'محدد بالكم والوقت', 'عدد معلوم ومدة معلومة'], ['real', 'واقعي', 'في طاقتك الآن، وتكبّره إذا نجحت'], ['meaning', 'له معنى', 'تعرف لماذا تريده'], ['flex', 'مرن', 'تعدّله إن تغيّرت ظروفك ولا تتركه']];
function normalizeKGoal(g) {
  const day = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(x || '') ? x : '');
  return {
    id: g.id || uid(), level: KH_LEVEL[g.level] ? g.level : 'year', roleId: g.roleId || '', text: String(g.text || ''), why: String(g.why || ''),
    laws: g.laws && typeof g.laws === 'object' ? { ...g.laws } : {}, parent: g.parent || '',
    period: /^[gh]\d{4}$/.test(g.period || '') ? g.period : '', // a year goal's year
    months: Array.isArray(g.months) ? g.months.filter((r) => /^\d{4}-\d{2}-\d{2}~\d{4}-\d{2}-\d{2}$/.test(r)) : [], // a month goal's months
    moN: Math.max(0, Math.min(12, Number(g.moN) || 0)), // …or a number of any months
    wk: Array.isArray(g.wk) ? [...new Set(g.wk.map(Number).filter((n) => n >= 1 && n <= 5))].sort() : [], // a week goal's weeks in the month
    wkN: Math.max(0, Math.min(4, Number(g.wkN) || 0)), // …or a number of any weeks
    from: day(g.from), status: KH_GSTAT[g.status] ? g.status : 'open', closedAt: day(g.closedAt),
    ticks: g.ticks && typeof g.ticks === 'object' ? g.ticks : {}, created: g.created || Date.now(), tpl: g.tpl || '', // (tpl: made by a template, v109)
    prev: g.prev || '', // v126: a year goal carried on from the year before («امدده إلى السنة التالية»)
  };
}
const kgOf = (id) => (id ? S.kgoals.find((g) => g.id === id) : null);
const kgKids = (g, lv) => S.kgoals.filter((x) => x.parent === g.id && x.level === lv);
const kgTasks = (g) => S.tasks.filter((t) => t.kgoal === g.id);
function kgSub(g) { const out = [g]; for (let i = 0; i < out.length; i++) out.push(...S.kgoals.filter((x) => x.parent === out[i].id)); return out; }
// a goal's role is its year goal's (or its vision's): what is under it follows it
function kgRoleId(g) { let x = g; for (let i = 0; x && x.level !== 'year' && x.level !== 'life' && i < 4; i++) x = kgOf(x.parent); return x && khRole(x.roleId) ? x.roleId : ''; }
const kgYear = (g) => { let x = g; for (let i = 0; x && x.level !== 'year' && i < 4; i++) x = kgOf(x.parent); return x && x.level === 'year' ? x : null; };
const kgVision = (g) => { let x = g; for (let i = 0; x && x.level !== 'life' && i < 5; i++) x = kgOf(x.parent); return x && x.level === 'life' ? x : null; };
const khVisions = (roleId) => S.kgoals.filter((g) => g.level === 'life' && g.roleId === roleId && g.status === 'open'); // (an achieved vision closes what is under it)
// the year of a goal as two dates (its year goal's, in that goal's own calendar)
const kgSpan = (g) => { const y = kgYear(g); return (y && khKeySpan(y.period)) || null; };
// the months (in the calendar chosen now) whose middle is in a span
const khMonth0 = (sp) => { if (!sp) return null; const m = khMoStart(sp[0]); return addDays(m, 14) < sp[0] ? khMoNext(m) : m; };
function khSpanMonths(sp) { const out = []; if (!sp) return out; for (let m = khMonth0(sp); addDays(m, 14) < sp[1]; m = khMoNext(m)) out.push(m); return out; }
// closing a goal («تحقق» or «أُلغي») closes what is under it: an achieved one after its period, a cancelled one from it
function kgClosedOf(g) { for (let x = g, n = 0; x && n < 6; x = kgOf(x.parent), n++) if (x.status !== 'open') return x; return null; }
function kgClosedIn(g, from, unit) {
  const c = kgClosedOf(g);
  if (!c) return false;
  const at = c.closedAt || today(), s = unit === 'w' ? weekStartOf(at) : khMoStart(at);
  return c.status === 'dropped' ? from >= s : from > s;
}
// (v146: no «تحقّق» ticked by hand for a month or a week, the owner: «الأسبوع ليس عليه تأشيرة لأنه يتغذى من إنجازات الأيام… والشهر
// … ينعكس من حالة أسابيعه»; the ticks of before are kept in the data, `g.ticks`, and not counted)
// a month goal in a month, by its choice: the months picked, or any month of its year since it was made
function mgPlanned(g, m) {
  if (g.months.length) return khInRanges(g.months, m, khMoNext(m));
  if (!g.moN) return false;
  const sp = kgSpan(g), mid = addDays(m, 14);
  const made = g.created ? iso(new Date(g.created)) : g.from;
  return !!sp && mid >= sp[0] && mid < sp[1] && !(made && khMoNext(m) <= made);
}
// …and while its number of months is not yet reached
function mgActive(g, m) {
  return khMm(`ma${g.id}${m}`, () => {
    if (!mgPlanned(g, m) || kgClosedIn(g, m, 'm')) return false;
    if (g.months.length || !g.moN) return true;
    let full = 0;
    for (let x = khMonth0(kgSpan(g)); x && x < m; x = khMoNext(x)) if (mgPlanned(g, x) && mgDone(g, x)) full++;
    return full < g.moN;
  });
}
// a week goal in a week, by its month goal's months and the weeks chosen (before any number is counted)
function wgPlanned(g, k) {
  return khMm(`wp${g.id}${k}`, () => khIn(kgCal(g), () => {
    if ((g.from && k < g.from) || kgClosedIn(g, k, 'w')) return false;
    const mg = kgOf(g.parent);
    return !!mg && mgPlanned(mg, khMoStart(k)) && (!g.wk.length || g.wk.includes(khWkOrd(k)));
  }));
}
// …and while the number of weeks of its month (and of months of its year) is not yet reached
function wgActive(g, k) {
  return khMm(`wa${g.id}${k}`, () => khIn(kgCal(g), () => {
    if (!wgPlanned(g, k) || !mgActive(kgOf(g.parent), khMoStart(k))) return false;
    return !g.wkN || khWeeksOf(khMoStart(k)).filter((w) => w < k && wgDone(g, w)).length < g.wkN;
  }));
}
// a chain task shows on its days only in its goal's months and weeks (until their number is reached), and not
// after its goal (or one above it) is achieved or cancelled. Called by occursOn (app.js)
function khChainOn(t, d) { const g = kgOf(t.kgoal); return !g || g.level !== 'week' || wgActive(g, weekStartOf(d)); }
// a chain task's day by its own days and its goal's months and weeks, before any number is counted
function khPlannedOn(t, d) {
  const r = t.repeat, g = kgOf(t.kgoal);
  return !!r && !!g && d >= r.start && !(r.until && d > r.until) && repDay(r, d) && wgPlanned(g, weekStartOf(d));
}
// a week goal achieved in a week: ticked, or every one of its days (and its tasks) there done
function wgDone(g, k) {
  return khMm(`wd${g.id}${k}`, () => {
    const last = addDays(k, 6);
    let n = 0;
    for (const t of kgTasks(g)) {
      if (isRepeat(t) && t.repeat.per) {
        // «any days»: its number of the week, not every day
        const el = khDays(k).filter((d) => khPlannedOn(t, d));
        if (el.length) { n++; if (khDays(k).filter((d) => t.completions[d]).length < Math.min(t.repeat.per, el.length)) return false; }
      } else if (isRepeat(t)) { for (const d of khDays(k)) if (khPlannedOn(t, d)) { n++; if (!t.completions[d]) return false; } }
      else if (t.due >= k && t.due <= last) { n++; if (!t.done) return false; }
    }
    return n > 0;
  });
}
// the week goal in a week: its days done of its days there (and its tasks for the week)
function wgShare(g, k) {
  let target = 0, done = 0;
  const last = addDays(k, 6);
  for (const t of kgTasks(g)) {
    if (isRepeat(t)) { for (const d of khDays(k)) if (reqOn(t, d)) { target++; if (t.completions[d]) done++; } }
    else if (t.due >= k && t.due <= last) { target++; if (t.done) done++; }
  }
  return { target, done };
}
const wgWeeks = (g, m) => khWeeksOf(m).filter((k) => wgPlanned(g, k));
// the month goal in a month: its weeks achieved, of those asked for
function mgShare(g, m) {
  return khMm(`ms${g.id}${m}`, () => {
    let target = 0, done = 0;
    for (const w of kgKids(g, 'week')) {
      const ws = wgWeeks(w, m).filter((k) => wgDone(w, k) || wgShare(w, k).target > 0), need = w.wkN ? Math.min(w.wkN, ws.length) : ws.length;
      target += need; done += Math.min(need, ws.filter((k) => wgDone(w, k)).length);
    }
    return { target, done };
  });
}
const mgDone = (g, m) => khMm(`md${g.id}${m}`, () => ((x) => x.target > 0 && x.done >= x.target)(mgShare(g, m)));
// the month goal in a year: its months achieved, of those asked for (an achieved goal is whole)
function mgYear(g, y) {
  const weekly = kgKids(g, 'week').length > 0, pl = [];
  for (let m = y; m < khYrNext(y); m = khMoNext(m)) if (mgPlanned(g, m) && !kgClosedIn(g, m, 'm') && (!weekly || mgShare(g, m).target > 0 || mgDone(g, m))) pl.push(m);
  const need = !g.months.length && g.moN ? Math.min(g.moN, pl.length) : pl.length;
  const c = kgClosedOf(g);
  if (c && c.status === 'done') return { target: need, done: need };
  return { target: need, done: Math.min(need, pl.filter((m) => mgDone(g, m)).length) };
}
// the year goal: its months achieved, of those asked for
const ygShare = (g, y) => kgKids(g, 'month').reduce((a, mg) => { const x = mgYear(mg, y); return { target: a.target + x.target, done: a.done + x.done }; }, { target: 0, done: 0 });
// the first day of a chain's tasks: today, or the first week of its first month if that is still to come
function khChainStart(mg) { return khIn(kgCal(mg), () => khChainStart0(mg)); }
function khChainStart0(mg) {
  const ms = mg.months.length ? mg.months.map((r) => khMoStart(khMid(r))).sort() : [khMonth0(kgSpan(mg))].filter(Boolean);
  const w0 = ms.length ? khWeeksOf(ms[0])[0] : '';
  return w0 && w0 > today() ? w0 : today();
}
// …and its last: the end of the last week of its last month (a week is the month's it starts in)
function khChainEnd(mg) { return khIn(kgCal(mg), () => khChainEnd0(mg)); }
function khChainEnd0(mg) {
  const ms = mg.months.length ? mg.months.map((r) => khMoStart(khMid(r))).sort() : khSpanMonths(kgSpan(mg));
  if (!ms.length) return null;
  const last = ms[ms.length - 1], ws = khWeeksOf(last);
  return ws.length ? addDays(ws[ws.length - 1], 6) : addDays(khMoNext(last), -1);
}
// the months of a goal changed: its tasks run from its first (a month added before they began brings them forward,
// never to a day already gone) to the end of its last
function khSyncStart(g) {
  const ids = new Set(kgSub(g).map((x) => x.id));
  for (const t of S.tasks) if (ids.has(t.kgoal) && isRepeat(t)) {
    const wg = kgOf(t.kgoal), mg = wg && kgOf(wg.parent);
    if (!mg) continue;
    const s = khChainStart(mg), e = khChainEnd(mg);
    if (s < t.repeat.start && !Object.keys(t.completions).length) t.repeat.start = s;
    // (a book's reading goal ends when the book is read, never by date: its goal's months alone bound its days, v140)
    if (e && !t.bookId) t.repeat.until = e < t.repeat.start ? t.repeat.start : e;
  }
}
// the calendar changed (or months edited): every chain's first and last days follow its months as they are now
function khResyncChains() { for (const g of S.kgoals.filter((x) => x.level === 'month')) khSyncStart(g); }
// a goal and all that is under it: its goals and the recurring tasks of its days go; its tasks for one week stay, unlinked
function kgDrop(g) {
  const ids = new Set(kgSub(g).map((x) => x.id));
  // (and a book's reading goal stays a book's: reading.js takes it on, v140)
  for (const t of S.tasks.filter((x) => ids.has(x.kgoal) && isRepeat(x) && !x.bookId)) dropTask(t.id);
  for (const t of S.tasks) if (ids.has(t.kgoal)) t.kgoal = '';
  // (a year carried on from it takes its place: its project stays with that year, and serves no goal if there is none)
  const line = khLineOf(g).filter((x) => !ids.has(x.id));
  for (const p of S.projects) if (ids.has(p.ygoal)) p.ygoal = line.length ? line[0].id : '';
  for (const sc of S.study) if (ids.has(sc.ygoal)) sc.ygoal = line.length ? line[0].id : ''; // (a science likewise, v137)
  for (const b of S.books) if (ids.has(b.ygoal)) b.ygoal = line.length ? line[0].id : ''; // (and a book, v140)
  for (const p of S.hplans) if (ids.has(p.ygoal)) p.ygoal = line.length ? line[0].id : ''; // (and a memorising plan, v142)
  for (const x of S.kgoals) if (ids.has(x.prev)) x.prev = ids.has(g.prev) ? '' : g.prev;
  S.kgoals = S.kgoals.filter((x) => !ids.has(x.id));
}
// what goes with it, said before it is deleted
function kgDropNote(g) {
  if (g.level === 'life') return kgKids(g, 'year').length ? 'حذف الرؤية لا يحذف أهداف السنة التي تخدمها: تبقى بلا ربط.' : '';
  const sub = kgSub(g), ng = sub.length - 1, nt = S.tasks.filter((t) => isRepeat(t) && sub.some((x) => x.id === t.kgoal)).length;
  return ng || nt ? `يُحذف معه ما تحته: ${[ng ? plural(ng, 'هدف واحد', 'هدفان', 'أهداف', 'هدفاً') : '', nt ? plural(nt, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة') : ''].filter(Boolean).join(' و')}.` : '';
}
// what was done in a period (as the report counts it: a task done, a day of a recurring goal, a reading session),
// in one role (and one area of «شحذ المنشار») if asked
function khDoneIn(from, to, roleId, area) {
  let n = 0;
  for (const t of S.tasks) {
    if (t.bookId && !getBook(t.bookId)) continue; // (as completionEvents)
    if (roleId !== undefined && khRoleIdOf(t) !== roleId) continue;
    if (area !== undefined && khAreaOf(t) !== area) continue;
    if (isRepeat(t) || t.bookId) for (const d of Object.keys(t.completions || {})) if (t.completions[d] && d >= from && d < to) n++;
    if (!isRepeat(t) && t.done && t.doneAt && !(t.bookId && Object.keys(t.completions || {}).length)) { const d = iso(new Date(t.doneAt)); if (d >= from && d < to) n++; }
  }
  return n;
}
// «سجل حياتي»: what was done and marked «✦ ينعكس في حياتي»
function khLifeRec(from = '', to = '9999') {
  const out = [];
  for (const t of S.tasks) {
    if (!t.life) continue;
    if (isRepeat(t) || (t.bookId && Object.keys(t.completions || {}).length)) { const ds = Object.keys(t.completions).filter((d) => t.completions[d] && d >= from && d < to).sort(); if (ds.length) out.push({ t, d: ds[ds.length - 1], n: ds.length }); }
    else if (t.done && t.doneAt) { const d = iso(new Date(t.doneAt)); if (d >= from && d < to) out.push({ t, d, n: 0 }); }
  }
  return out.sort((a, b) => b.d.localeCompare(a.d));
}

// ---------- what belongs to a day and to a week ----------
const khWeekOf = (d) => weekStartOf(d);
const khDays = (k) => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(k, i));
// «اليوم»'s own items: the same list, grouped here by role
function khTodayItems(d) {
  return S.tasks.filter((t) => {
    if (isRepeat(t)) return occursOn(t, d);
    if (t.bookId && t.completions && t.completions[d]) return true;
    if (dueOpen(t, d)) return true;
    return t.done && t.doneAt && iso(new Date(t.doneAt)) === d;
  }).sort(byTime(d));
}
// (v146) «فاتك يومها» is gone; what it moved or cancelled before (`repeat.mv`, `skip`) stays as it was. What is late and shown:
// a task with a day of its own (or a week: «لأي يوم من أسبوعها»), for one time or on set days of the week but not on most of
// them (five days or more: their misses are in «إحصائياتي» and the report only, as a task of every day and one with no day),
// whatever its importance; the owner: «الكلام محصور على مهمة يومية بلا استثناء من الأيام أو لم يحدد لها وقت هذه هي التي تكون
// متأخراته في التقرير والإحصائية»، «كل ما لها يوم محدد حتى ولو تكرر ولكن ليس لكل أيام الأسبوع… لا تكون غالبة على أيام
// الأسبوع» («خمسة أيام فأكثر»). Its path: at the end of today in «يومي» to the end of its week, then under its week; when its
// month is over, one of importance «قصوى» goes under its month and another stays under its week («القصوى وحدها تنتقل تحت الشهر»)
const KH_LATE_DAYS = 4;
// every late time, {t, d}: a task for one time (its date), a day of a recurring one (each day missed, from the first opening
// of the plan; a reading project's book task, whose date moves with its reading days, is not of it)
function khLateAll() {
  return khMm('lates', () => {
    const t0 = today(), from0 = [S.settings.khMfrom || t0, addDays(t0, -400)].sort()[1], out = [];
    for (const t of S.tasks) {
      if ((t.bookId && !isRepeat(t)) || t.sciId) continue;
      if (isRepeat(t)) {
        const r = t.repeat;
        if (r.per || r.days.length > KH_LATE_DAYS) continue;
        for (let d = [r.start, from0].sort()[1]; d < t0; d = addDays(d, 1)) if (occursOn(t, d) && !t.completions[d] && !(r.skip && r.skip[d])) out.push({ t, d });
      } else if (!t.done && t.due && t.due < t0 && !(t.skip && t.skip[t.due])) out.push({ t, d: t.due });
    }
    return out.sort((x, y) => x.d.localeCompare(y.d));
  });
}
// where it is now: 'day' (its week is this week), 'week' (its week is over, its month is not) or 'month'; a week is of the month it starts in
function khLateAt(x) {
  const w = khWeekOf(x.d);
  return w === khWeekOf(today()) ? 'day' : khMoNext(khMoStart(w)) > today() ? 'week' : 'month';
}
const khLates = (test) => khLateAll().filter((x) => khInRole(x.t) && test(x, khLateAt(x)));
const khLateLab = (x) => `${khRoleName(khRoleIdOf(x.t), khAreaOf(x.t))} | ${!isRepeat(x.t) && x.t.from ? `أسبوعها: ${khDayLabel(x.t.from)}` : `يومها: ${AR_DAYS[parse(x.d).getDay()]} ${khDayLabel(x.d)}`}`;
// what passed its time and is still not done: ticked here, it is done on its day
const khLateRows = (xs) => xs.map((x) => khDayBox(x.t, x.d, `<div class="kh-side">${khImpBtn(x.t)}</div>`, khLateLab(x))).join('');
// «!» on what is not fixed to a day or a week: it shows in every period until it is done, and says why
const khWhyBtn = (text) => `<button type="button" class="kh-why" data-action="kh-why" data-t="${esc(text)}" aria-label="لماذا يظهر هنا؟">!</button>`;
const khWhyOf = (t, d) => (t.repeat && t.repeat.per ? khWhyBtn(`تظهر كل يوم لأنك لم تحدد أيامها: تنجزها ${KH_UNIT.times(t.repeat.per)} في الأسبوع في أي يوم، فإذا اكتمل عددها لم تظهر بقية الأسبوع.`)
  : !isRepeat(t) && t.from && t.due > d ? khWhyBtn('تظهر كل يوم لأنك لم تحدد لها يومًا من أسبوعها، حتى تتمها.') : '');
// the week's plan: a dated task in the week of its date (an undated one in the week it was done), a goal on
// its days in the week (or its deadline), a book's task in the weeks of its sessions; each a share of the week
function khWeekItems(k) {
  const last = addDays(k, 6), inW = (d) => !!d && d >= k && d <= last, out = [];
  for (const t of S.tasks) {
    if (isRepeat(t) && t.repeat.per) {
      // «any days»: its number of the week, ticked on any day
      const q = quotaOf(t, k);
      if (q.need) out.push({ t, kind: 'rep', quota: true, days: khDays(k), need: q.need, done: Math.min(q.done, q.need) });
    } else if (isRepeat(t)) {
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
function khWeekPct(k, rid) {
  const xs = khWeekItems(k).filter((x) => rid === undefined || khRoleIdOf(x.t) === rid);
  return xs.length ? Math.round((xs.reduce((n, x) => n + khFrac(x), 0) / xs.length) * 100) : null;
}
const khRec = (k) => S.weeks.find((w) => w.id === k);
// after the review: the share kept from before what was cancelled
const khShownPct = (k) => { const r = khRec(k); return r && r.review && r.review.pct !== null ? r.review.pct : khWeekPct(k); };

// one role only (v140, the owner's request: «اجعل في خطط سنتي وشهري وأسبوعي ويومي إمكانية عرض ما تحت دور واحد فقط»):
// a row of the roles above the four; what is shown, counted and measured there is that role's alone
const khRoleF = () => (khUi.role && khRole(khUi.role) ? khUi.role : '');
const khInRole = (t) => !khRoleF() || khRoleIdOf(t) === khRoleF();
const khShownRoles = () => (khRoleF() ? khRoles().filter((r) => r.id === khRoleF()) : [...khRoles(), null]);
const khRoleArg = () => (khRoleF() || undefined); // (khDoneIn: one role, or all)
// a week's share: of that role's items (a review keeps the whole week's)
const khPctFor = (k) => (khRoleF() ? khWeekPct(k, khRoleF()) : khShownPct(k));
function khRoleBar() {
  const rs = khRoles();
  if (rs.length < 2) return '';
  return `<div class="chips kh-rolef" role="group" aria-label="اعرض دوراً واحداً"><button type="button" class="chip" data-action="kh-role-f" data-v="" aria-pressed="${!khRoleF()}">كل الأدوار</button>${rs.map((r) => `<button type="button" class="chip" data-action="kh-role-f" data-v="${r.id}" aria-pressed="${khRoleF() === r.id}" style="--rc:${khColor(r.id)}"><i class="kh-rdot"></i>${esc(r.name)}</button>`).join('')}</div>`;
}

// ---------- the page ----------
function viewPlan() {
  if (typeof syncReading === 'function') syncReading();
  if (khUi.review) return khReviewHTML(khUi.review);
  return `<div class="seg kh-tabs" role="group" aria-label="أقسام خطِّط">${KH_TABS.map(([v, l]) => `<button type="button" data-action="kh-tab" data-v="${v}" aria-pressed="${khUi.tab === v}">${l}</button>`).join('')}</div>
  ${['today', 'week', 'month', 'year'].includes(khUi.tab) || !KH_TABS.some(([v]) => v === khUi.tab) ? khRoleBar() : ''}
  ${({ roles: khRolesHTML, week: khWeekHTML, month: khMonthHTML, year: khYearHTML, life: khLifeHTML, stats: khStatsHTML }[khUi.tab] || khTodayHTML)()}`;
}

// ---------- أدواري ----------
// what is still open (an ended goal, a done task or a finished project is not waiting for anything)
const khOpenGoal = (t) => isGoal(t) && !goalEnded(t);
const khOpenTask = (t) => !isGoal(t) && !t.done && !t.projectId;
// moving a project to another role from its role's «تعديل» (its tasks follow it): any other role, or a side of «شحذ المنشار»
const khMoveOptions = (p) => `<option value="" selected>يبقى هنا</option>${khRoles().map((r) => (r.id === KH_SAW
  ? Object.entries(KH_AREAS).filter(([a]) => !(p.roleId === KH_SAW && p.area === a)).map(([a, n]) => `<option value="${KH_SAW}:${a}">${esc(r.name)}: ${n}</option>`).join('')
  : r.id === p.roleId ? '' : `<option value="${r.id}">${esc(r.name)}</option>`)).join('')}`;
// a role's card holds its vision only (the user's choice, v110): the chain of its goals is in «سنتي» (and under its vision in
// «حياتي»), its projects, goals and tasks in their own pages; its projects are still moved from «تعديل»
function khRoleCard(r) {
  const projects = S.projects.filter((p) => !p.doneAt && p.roleId === r.id);
  const visions = S.kgoals.filter((g) => g.level === 'life' && g.roleId === r.id && g.status !== 'dropped');
  const saw = r.id === KH_SAW;
  const i = khRoles().indexOf(r), mine = khRoles().filter((x) => x.id !== KH_SAW).length;
  return `<div class="kh-role" style="--rc:${khColor(r.id)}">
    <div class="kh-role-head"><b>${esc(r.name)}</b>
      ${saw ? `<div class="kh-role-acts"><span class="kh-fixed">ثابت</span>${projects.length ? `<button type="button" class="ghost sm" data-action="kh-role-edit" data-v="${r.id}">${icon('edit')} تعديل</button>` : ''}</div>` : `<div class="kh-role-acts"><button type="button" class="icon-btn" data-action="kh-role-mv" data-v="${r.id}" data-d="-1" aria-label="إلى الأعلى"${i ? '' : ' disabled'}>▲</button><button type="button" class="icon-btn" data-action="kh-role-mv" data-v="${r.id}" data-d="1" aria-label="إلى الأسفل"${i < mine - 1 ? '' : ' disabled'}>▼</button><button type="button" class="ghost sm" data-action="kh-role-edit" data-v="${r.id}">${icon('edit')} تعديل</button></div>`}</div>
    ${visions.length ? `<div class="kh-sub"><small>رؤيتي</small><div class="kh-links">${visions.map((v) => `<button type="button" class="kh-link" data-action="kh-edit-goal" data-v="${v.id}">${esc(v.text)}</button>`).join('')}</div></div>` : ''}
    ${saw ? '<p class="note-text explain">عنايتك بنفسك لتقوى على أدوارك كلها، بأربعة جوانب: صحي (رياضة ونوم وغذاء)، واجتماعي (صلة وصداقة ومعروف)، ومعرفي (قراءة وتعلّم)، ونفسي (ما يريح نفسك ويرتّبها).</p>' : ''}
    ${visions.length ? '' : `<div class="btn-row kh-adds">${addBtn('kh-new-vision', 'رؤية', ` data-role="${r.id}"`)}</div>`}
  </div>`;
}
// what has no role yet (all of it, the first time): a role is chosen for each right here
function khUnassignedHTML() {
  const ps = S.projects.filter((p) => !p.doneAt && !khRole(p.roleId));
  const ts = S.tasks.filter((t) => (khOpenGoal(t) || khOpenTask(t)) && !khRoleIdOf(t) && !t.kgoal);
  const gs = S.kgoals.filter((g) => (g.level === 'life' || g.level === 'year') && !khRole(g.roleId));
  if (!ps.length && !ts.length && !gs.length) return '';
  const row = (kind, id, name, what) => `<div class="kh-un-row"><span><b>${esc(name)}</b><small>${what}</small></span><select data-kh-assign="${kind}:${id}" aria-label="دور «${esc(name)}»">${khRoleOptions('')}</select></div>`;
  return `<section class="panel kh-un">
    <h3>بلا دور (${ps.length + ts.length + gs.length})</h3>
    <p class="note-text">اختر لكل واحد دوره. مهام المشروع تأخذ دور مشروعها.</p>
    ${ps.map((p) => row('project', p.id, p.name, 'مشروع')).join('')}
    ${ts.map((t) => row('task', t.id, t.title, isGoal(t) ? 'هدف' : 'مهمة')).join('')}
    ${gs.map((g) => row('kgoal', g.id, g.text, KH_LEVEL[g.level])).join('')}
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
      <div class="kh-chips"><small>أو ابدأ من قالب جاهز يمر بالخطوات كلها، من الرؤية إلى الأيام، ثم عدّله كما تشاء:</small>${KH_TPLS.map((T) => (khTplOn(T.id) ? `<button type="button" class="ghost sm danger" data-action="kh-tpl-del" data-v="${T.id}">احذف قالب «${T.name}» وابدأ من جديد</button>` : `<button type="button" class="chip" data-action="kh-tpl" data-v="${T.id}">${T.name}</button>`)).join('')}</div>
    </form>
  </section>`;
}
function khOpenRole(id) {
  const r = khRole(id);
  if (!r) return;
  ldraft = { kind: 'khrole', id, isNew: false };
  const saw = id === KH_SAW; // fixed: no new name and no deleting, only moving its projects
  const n = S.projects.filter((p) => p.roleId === id).length + S.tasks.filter((t) => t.roleId === id).length + S.kgoals.filter((g) => g.roleId === id).length;
  const ps = S.projects.filter((p) => !p.doneAt && p.roleId === id);
  $('libForm').innerHTML = `${sheetHead(saw ? `تعديل «${esc(r.name)}»` : 'تعديل الدور')}
    ${saw ? '' : `<label class="field"><span>اسم الدور</span><input type="text" id="khRoleName" value="${esc(r.name)}" autocomplete="off"></label>`}
    ${ps.length ? `<div class="field"><span>نقل مشاريعه إلى دور آخر</span>${ps.map((p) => `<div class="kh-un-row"><span><b>${esc(p.name)}</b>${saw && p.area ? `<small>${KH_AREAS[p.area]}</small>` : ''}</span><select data-kh-mvto="${p.id}" aria-label="انقل «${esc(p.name)}»">${khMoveOptions(p)}</select></div>`).join('')}<small class="note-text explain">تنتقل مع المشروع مهامه، ولا يُنقل شيء حتى تضغط «حفظ».</small></div>` : ''}
    ${n && !saw ? `<p class="note-text">حذفه لا يحذف شيئاً مما تحته (${n}): يبقى بلا دور حتى تختار له دوراً.</p>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${saw ? '' : '<button type="button" class="danger" data-action="kh-role-del">حذف الدور</button>'}</div>`;
  showLib();
}
function khSaveRole() {
  const r = khRole(ldraft.id), el = $('khRoleName'), name = el ? el.value.trim() : '';
  if (el && !name) { toast('اكتب اسم الدور.'); return false; }
  if (el && S.roles.some((x) => x.id !== ldraft.id && x.name === name)) { toast('لك دور بهذا الاسم.'); return false; }
  if (r && el) r.name = name;
  // its projects moved to another role (their tasks follow them, as they take their project's role)
  const moved = [];
  for (const s of document.querySelectorAll('#libForm [data-kh-mvto]')) {
    const p = getProject(s.dataset.khMvto), [role, area = ''] = s.value.split(':');
    if (!p || !khRole(role)) continue;
    p.roleId = role; p.area = role === KH_SAW ? area : '';
    if (kgOf(p.ygoal) && kgRoleId(kgOf(p.ygoal)) && kgRoleId(kgOf(p.ygoal)) !== role) p.ygoal = ''; // (a goal of the role it left)
    moved.push({ p, to: khRoleName(role, p.area) });
  }
  save();
  toast(moved.length === 1 ? `نُقل «${moved[0].p.name}» بمهامه إلى «${moved[0].to}»` : moved.length ? `نُقلت المشاريع بمهامها (${moved.length})` : 'حُفظت التعديلات');
  return true;
}

// ---------- يومي ----------
// (v146) the mark on every task of the plan: its importance «قصوى» (the task's priority `high`, no number to it), or back to «متوسطة»
const khImpBtn = (t) => `<button type="button" class="kh-imp" data-action="kh-imp" data-id="${t.id}" aria-pressed="${t.priority === 'high'}">${t.priority === 'high' ? '★ أهمية قصوى' : '☆ قصوى'}</button>`;
const khPrioBtn = (t, d) => { const on = t.prio === d; return `<button type="button" class="kh-pri" data-action="kh-prio" data-id="${t.id}" aria-pressed="${on}">🚩<span>${on ? 'من الأهم اليوم' : 'الأهم'}</span></button>`; };
// one item: the app's own row (its tick, its editor), with the role and the priority beside it
const khLifeBtn = (t) => `<button type="button" class="kh-life" data-action="kh-life" data-id="${t.id}" aria-pressed="${!!t.life}">${t.life ? '✦ في حياتي' : '✦ ينعكس في حياتي؟'}</button>`;
// (v146) a task as a box of «سنتي»'s day level: its tick, its role (or what is given) and time, its title; the buttons beside
const khDayBox = (t, d, side, lab) => `<div class="kh-node lv-day kh-dbox${doneOn(t, d) ? ' done' : ''}${t.prio === d ? ' kh-prio-on' : ''}" style="--rc:${khColor(khRoleIdOf(t))}">${checkButton(t, d, doneOn(t, d))}<button type="button" class="kh-leaf" data-action="open" data-id="${t.id}"><small>${esc(lab || khRoleName(khRoleIdOf(t), khAreaOf(t)))}${hasTime(t) ? ` | ${esc(timeLabel(t, d))}` : ''}</small><b>${esc(t.title)}</b></button>${side || ''}</div>`;
// set for a day: a recurring task on its day, a task for one time on its date; what has no day of its own («بلا موعد»، «عدد
// أيام أيّها كان»، «لأي يوم من أسبوعها») on today and every day after it until it is done (the owner: «كل ما لم يحدد له يوم يظهر
// كل يوم»); a day gone by: what was done in it, struck (the owner: «المنجز مشطوب»)
function khSetOn(t, d) {
  const t0 = today();
  if (isRepeat(t)) return d < t0 ? !!t.completions[d] : occursOn(t, d);
  if (t.bookId) return !!(t.completions && t.completions[d]) || (d >= t0 && !t.done && t.due === d);
  if (t.done) return !!t.doneAt && iso(new Date(t.doneAt)) === d;
  if (d < t0 || (t.skip && t.skip[t.due])) return false;
  if (!t.due) return !isGoal(t);
  return t.from ? dueOpen(t, d) && d <= t.due : t.due === d;
}
// «يومي» (v146): the seven days of the week, Sunday to Saturday, each with what is set for it, the owner: «اليومي يظهر اليومي
// فقط على مدى أيام الأسبوع من الأحد إلى السبت فأعرف منه ما علي بنظرة شمولية»; «الأهم» and «✦» on today, «★ قصوى» on today
// and the days to come, and at the end of today what of importance «قصوى» passed its day this week
function khTodayHTML() {
  const t0 = today(), k = khWeekOf(t0), last = addDays(k, 6), rf = khRoleF();
  const np = S.tasks.filter((t) => t.prio === t0).length; // (the three of the day, whatever the role shown, undated ones too)
  const side = (t, d) => {
    if (d < t0) return '';
    const b = [khWhyOf(t, d), khImpBtn(t)];
    if (d === t0) {
      b.push(khPrioBtn(t, d));
      if (doneOn(t, d)) b.push(khLifeBtn(t));
      if (!isGoal(t) && !t.due && !t.done && !t.bookId) b.push(`<button type="button" class="ghost sm" data-action="kh-to-today" data-id="${t.id}">لليوم</button>`);
    }
    return `<div class="kh-side">${b.join('')}</div>`;
  };
  const late = khLates((x, at) => at === 'day');
  const day = (d) => {
    const xs = S.tasks.filter((t) => khInRole(t) && khSetOn(t, d)).sort(byTime(d)), n = xs.filter((t) => doneOn(t, d)).length;
    const lt = d === t0 ? late : [];
    return `<div class="kh-dsec${d === t0 ? ' now' : ''}"><div class="kh-dsec-h"><b>${esc(AR_DAYS[parse(d).getDay()])}</b><small>${esc(khDayLabel(d))}</small>${d === t0 ? '<span class="kh-today">اليوم</span>' : ''}${xs.length && d >= t0 ? `<small class="kh-left${n === xs.length ? ' ok' : ''}">${n === xs.length ? 'أنجزتها كلها' : `بقي ${n ? `${xs.length - n} من ${xs.length}` : xs.length}`}</small>` : ''}</div>
      ${xs.map((t) => khDayBox(t, d, side(t, d))).join('') || (d >= t0 ? '<p class="note-text">لا شيء محدد لهذا اليوم.</p>' : '')}
      ${lt.length ? `<div class="kh-late"><b>لم تُنجز في وقتها</b>${khLateRows(lt)}</div>` : ''}</div>`;
  };
  return `<section class="section">
    <div class="section-head"><h2>يومي</h2><small>${esc(fmtDate(k, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(last, { day: 'numeric', month: 'long' }))}</small></div>
    ${khPdfBtn('day')}
    ${np ? `<p class="kh-prio-sum">🚩 «الأهم» اليوم: ${np} من ${KH_PRIO_MAX}</p>` : ''}
    <p class="note-text explain">أيام أسبوعك من الأحد إلى السبت، وفي كل يوم ما حددته له. وما لم تحدد له يوماً يظهر في يومك وما بعده حتى تتمه. وفي الأيام التي مضت ما أنجزته فيها. والمهمة التي أهميتها قصوى إن فات يومها ظهرت في آخر يومك حتى نهاية أسبوعها، ثم تحت أسبوعها، ثم تحت شهرها. واجعل أهم ثلاث مهام في يومك «الأهم».</p>
    ${khPrevReviewCall()}
    <div class="kh-days">${khDays(k).map(day).join('')}</div>
    <div class="btn-row">${addBtn('kh-new', 'مهمة لليوم', ` data-due="${t0}"${rf ? ` data-role="${rf}"` : ''}`)}${addBtn('kh-plan-pick', 'من خطتك', ` data-k="${k}" data-day="${t0}"`)}</div>
  </section>`;
}
// the week before not reviewed yet, with something left in it (a card at the top of «يومي» and «أسبوعي»)
function khPrevReviewCall() {
  const prev = addDays(khWeekOf(today()), -7), rec = khRec(prev);
  if ((rec && rec.review) || !khOpenInWeek(prev).length) return '';
  return `<div class="warn-box"><b>من أسبوعك الماضي ما لم يُنجز.</b><span>راجعه لتنقل ما بقي إلى أسبوع تختاره، أو تلغيه.</span><button type="button" class="primary" data-action="kh-review" data-v="${prev}">راجع الأسبوع الماضي</button></div>`;
}

// ---------- أسبوعي ----------
function khProgressHTML(k) {
  const p = khPctFor(k), n = khWeekItems(k).filter((x) => khInRole(x.t)).length;
  const msg = p === null ? 'أضف مهام أسبوعك: لكل دور مهمة واحدة على الأقل.' : p >= KH_RATE ? `أنجزت ${p}٪: أنت في الطريق الصحيح.` : 'القاعدة الذهبية: إن أنجزت ٧٠٪ من خطتك فأنت في الطريق الصحيح. وما بقي تنقله أو تختصره أو تلغيه في المراجعة.';
  return `<div class="panel kh-prog">
    <div class="row-between"><b>إنجاز الأسبوع${khRoleF() ? ` في «${esc(khRole(khRoleF()).name)}»` : ''}</b><span class="kh-pct${p !== null && p >= KH_RATE ? ' ok' : ''}">${p === null ? '—' : `${p}٪`}</span></div>
    <div class="kh-track" role="img" aria-label="الإنجاز ${p === null ? 'لم يبدأ' : `${p}٪`}، والهدف ٧٠٪"><i style="width:${p || 0}%"></i><b class="kh-mark" style="inset-inline-start:${KH_RATE}%"></b></div>
    <p class="note-text">${msg}${n ? ` (${plural(n, 'بند واحد', 'بندان', 'بنود', 'بنداً')} في خطة الأسبوع)` : ''}</p>
  </div>`;
}
// a recurring goal in the week: its days as dots, ticked on the day (a day still to come waits); a goal of «any days»:
// boxes by its number, ticked on today (or the last day without a tick, in a week gone by)
const khQuotaWhy = (t) => khWhyBtn(`تظهر كل يوم لأنك لم تحدد أيامها: تنجزها ${KH_UNIT.times(t.repeat.per)} في الأسبوع في أي يوم، فإذا اكتمل عددها لم تظهر بقية الأسبوع.`);
function khRepDots(x, t0, k) {
  const t = x.t;
  return x.quota
    ? Array.from({ length: x.need }, (_, i) => `<button type="button" class="kh-dot kh-box${i < x.done ? ' on' : ''}" data-action="kh-box" data-id="${t.id}" data-k="${k}" data-i="${i}" aria-pressed="${i < x.done}" aria-label="${i < x.done ? 'ألغِ مرة' : 'أنجزت مرة'}"${k > t0 && i >= x.done ? ' disabled' : ''}>${i < x.done ? '✓' : ''}</button>`).join('')
    : x.days.map((d) => `<button type="button" class="kh-dot${t.completions[d] ? ' on' : ''}${d === t0 ? ' now' : ''}${t.repeat.skip && t.repeat.skip[d] && !t.completions[d] ? ' skip' : ''}" data-action="toggle" data-id="${t.id}" data-date="${d}" aria-pressed="${!!t.completions[d]}" aria-label="${esc(AR_DAYS[parse(d).getDay()])}${isCounted(t) ? `: ${countOn(t, d)} من ${t.target}` : ''}"${d > t0 ? ' disabled' : ''}>${isCounted(t) && !t.completions[d] && countOn(t, d) ? countOn(t, d) : KH_WD[parse(d).getDay()]}</button>`).join('');
}
const khDotsRow = (x, t0, k) => `<div class="kh-dots">${khRepDots(x, t0, k)}<small class="kh-cnt${x.done >= x.need ? ' ok' : ''}">${x.done} من ${x.need}</small></div>`;
function khRepRow(x, t0, k) {
  const t = x.t;
  return `<div class="kh-rep">
    <div class="kh-rep-t"><button type="button" class="kh-link" data-action="open" data-id="${t.id}">${esc(t.title)}${isHabit(t) ? ' <small>(عادة)</small>' : ''}</button>${x.quota ? khQuotaWhy(t) : ''}</div>
    ${khDotsRow(x, t0, k)}
  </div>`;
}
// (v146) a task under a week goal in «أسبوعي»: a day box as in «سنتي» (its days or its day, and time), its ticks, and «★ قصوى»;
// the owner: «المربعات المتداخلة التي تظهر في سنتي… ومثلها في أسبوعي لكن دون شهري»
function khWkBox(x, t0, k) {
  const t = x.t, last = addDays(k, 6);
  if (x.kind !== 'rep') return khDayBox(t, t.due && t.due >= k && t.due <= last ? t.due : t0 >= k && t0 <= last ? t0 : k, `<div class="kh-side">${khWhyOf(t, t0)}${khImpBtn(t)}</div>`, t.from ? 'لمرة: أي يوم من أسبوعها' : t.due ? `لمرة: ${AR_DAYS[parse(t.due).getDay()]}` : 'لمرة');
  return `<div class="kh-node lv-day kh-dbox kh-wbox" style="--rc:${khColor(khRoleIdOf(t))}"><button type="button" class="kh-leaf" data-action="open" data-id="${t.id}"><small>${esc(khDaysText(t))}${hasTime(t) ? ` | ${esc(timeLabel(t, t0))}` : ''}</small><b>${esc(t.title)}</b></button><div class="kh-side">${x.quota ? khQuotaWhy(t) : ''}${khImpBtn(t)}</div>${khDotsRow(x, t0, k)}</div>`;
}
// what passed its time and is still not done, in a page's end: «لم تُنجز في وقتها»
const khLateBox = (xs, head) => (xs.length ? `<div class="panel kh-late"><b>${head}</b>${khLateRows(xs)}</div>` : '');
// the week's hints: roles with nothing in it, and a side of «شحذ المنشار» with nothing; or the first step, with no roles yet
function khWeekHints(k, xs) {
  const mine = khRoles().filter((r) => r.id !== KH_SAW && (!khRoleF() || r.id === khRoleF()));
  if (!mine.length) return '<div class="panel"><b>ابدأ بأدوارك</b><p class="note-text">من أنت في حياتك؟ ابن، وزوج، وموظف… ثم ضع لكل دور هدفاً.</p><button type="button" class="primary" data-action="kh-tab" data-v="roles">حدّد أدواري</button></div>';
  const lonely = mine.filter((r) => !xs.some((x) => khRoleIdOf(x.t) === r.id) && !S.kgoals.some((g) => g.level === 'week' && kgRoleId(g) === r.id && wgActive(g, k)));
  const sawMiss = khRoleF() && khRoleF() !== KH_SAW ? [] : Object.keys(KH_AREAS).filter((a) => !xs.some((x) => khRoleIdOf(x.t) === KH_SAW && khAreaOf(x.t) === a));
  if (!lonely.length && !sawMiss.length) return '';
  return `<div class="panel kh-hints">${lonely.length ? `<p class="note-text"><b>أدوار بلا مهمة هذا الأسبوع:</b> ${lonely.map((r) => esc(r.name)).join('، ')}. اجعل لكل دور مهمة واحدة على الأقل من خطته، ولو صغيرة.</p>` : ''}${sawMiss.length ? `<p class="note-text"><b>شحذ المنشار:</b> لم تضع شيئاً لجانب ${sawMiss.map((a) => `«${KH_AREAS[a]}»`).join(' و')}.</p>` : ''}</div>`;
}
function khWeekHTML() {
  const t0 = today(), k = khUi.wk || khWeekOf(t0), last = addDays(k, 6);
  // (a week gone by: a task for one time late, or gone under its month, is in «لم تُنجز في وقتها» or there, not twice)
  const gone = k < khWeekOf(t0) ? new Set(khLateAll().filter((x) => !isRepeat(x.t)).map((x) => x.t.id)) : null;
  const xs = khWeekItems(k).filter((x) => !gone || !gone.has(x.t.id)), rec = khRec(k);
  const rowsOf = (list) => [...list.filter((x) => x.kind !== 'rep').sort((a, b) => (a.t.due || '').localeCompare(b.t.due || '')).map((x) => `<ul class="list">${itemHTML(x.t, x.t.due && x.t.due >= k && x.t.due <= last ? x.t.due : t0 >= k && t0 <= last ? t0 : k)}</ul>`),
    ...list.filter((x) => x.kind === 'rep').map((x) => khRepRow(x, t0, k))];
  const card = (r) => {
    const id = r ? r.id : '', mine = xs.filter((x) => khRoleIdOf(x.t) === id);
    const wgs = S.kgoals.filter((g) => g.level === 'week' && kgRoleId(g) === id && wgPlanned(g, k) && mgActive(kgOf(g.parent), khMoStart(k))), under = new Set(wgs.map((g) => g.id));
    if (!r && !mine.length && !wgs.length) return '';
    const full = mine.filter((x) => khFrac(x) === 1).length;
    const rows = [...wgs.map((g) => khWeekNode(g, k, mine.filter((x) => x.t.kgoal === g.id).map((x) => khWkBox(x, t0, k)))), ...rowsOf(mine.filter((x) => !under.has(x.t.kgoal)))];
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
    ${khPdfBtn('week')}
    <p class="note-text explain">لكل دور مهمة واحدة على الأقل، ومعها «شحذ المنشار». وما تنجزه في يومك ينعكس هنا.</p>
    ${k === khWeekOf(t0) ? khPrevReviewCall() : ''}
    ${k === khWeekOf(t0) && t0 === last && !(rec && rec.review) && xs.length ? '<div class="warn-box"><b>اليوم آخر أيام أسبوعك.</b><span>خصّص دقائق لمراجعته قبل أن تبدأ أسبوعك القادم.</span><button type="button" class="primary" data-action="kh-review" data-v="' + k + '">راجع أسبوعك</button></div>' : ''}
    ${khProgressHTML(k)}
    ${khWeekHints(k, xs)}
    ${addDays(k, 6) <= t0 ? `<button type="button" class="${rec && rec.review ? 'ghost' : 'primary'} kh-rv-btn" data-action="kh-review" data-v="${k}">${rec && rec.review ? `✓ راجعت هذا الأسبوع ${esc(relDate(rec.review.at))}: افتح المراجعة` : 'راجع أسبوعك'}</button>` : ''}
    ${khShownRoles().map(card).join('')}
    ${k < khWeekOf(t0) ? khLateBox(khLates((x, at) => khWeekOf(x.d) === k && (at === 'week' || x.t.priority !== 'high')), 'لم تُنجز في وقتها') : ''}
  </section>`;
}

// ---------- مراجعة الأسبوع ----------
// what can be moved or cancelled: the week's one-time tasks still not done (a goal or a book renews by itself)
const khOpenInWeek = (k) => khWeekItems(k).filter((x) => x.kind === 'task' && !x.t.done && !(x.t.due && x.t.due > today()) && !(x.t.skip && x.t.skip[x.t.due])).map((x) => x.t);
function khReviewHTML(k) {
  const rec = khRec(k), done = !!(rec && rec.review), xs = khWeekItems(k);
  const open = done ? [] : khOpenInWeek(k);
  // «the next»: the week after the one reviewed, or this week if that has gone by (a late review); «اختر أسبوعاً»: from it to twelve weeks on
  const now = khWeekOf(today()), next = addDays(k, 7) > now ? addDays(k, 7) : now, wks = Array.from({ length: 12 }, (_, i) => addDays(next, i * 7));
  khUi.rvq = khUi.rvq || { worked: '', missed: '', change: '', ...(rec && rec.review ? { worked: rec.review.worked, missed: rec.review.missed, change: rec.review.change } : {}) };
  const bal = [...khRoles(), null].map((r) => { const mine = xs.filter((x) => khRoleIdOf(x.t) === (r ? r.id : '')); return [r, mine.filter((x) => khFrac(x) === 1).length, mine.length]; }).filter((x) => x[2]);
  const none = bal.filter(([r, d]) => r && !d);
  const wkName = (x) => `${x === next ? (next === now ? 'هذا الأسبوع: ' : 'الأسبوع القادم: ') : ''}${khDayLabel(x)} – ${khDayLabel(addDays(x, 6))}`;
  const pick = (t) => {
    const c = khUi.rv[t.id] = khUi.rv[t.id] || { act: 'move', text: t.title, wk: wks[0], day: '' };
    return `<div class="kh-rv" style="--rc:${khColor(khRoleIdOf(t))}"><b>${esc(t.title)}</b><small>${esc(khRoleName(khRoleIdOf(t), khAreaOf(t)))} | ${esc(dueLabel(t.due))}</small>
      <div class="seg" role="group"><button type="button" data-action="kh-rv-act" data-id="${t.id}" data-v="move" aria-pressed="${c.act === 'move'}">أنقلها</button><button type="button" data-action="kh-rv-act" data-id="${t.id}" data-v="week" aria-pressed="${c.act === 'week'}">أختار أسبوعاً</button><button type="button" data-action="kh-rv-act" data-id="${t.id}" data-v="drop" aria-pressed="${c.act === 'drop'}">ألغها</button></div>
      ${c.act === 'week' ? `<label class="field"><span>الأسبوع</span><select data-kh-rvwk="${t.id}">${wks.map((x) => `<option value="${x}"${x === c.wk ? ' selected' : ''}>${esc(wkName(x))}</option>`).join('')}</select></label>
        <div class="kh-ask"><span class="kh-al">وفي أي يوم منه؟ (إن لم تختر يوماً فهي لأي يوم من أسبوعها)</span><div class="kh-chips">${khDays(c.wk).filter((x) => x >= today()).map((x) => `<button type="button" class="chip" data-action="kh-rv-day" data-id="${t.id}" data-v="${x}" aria-pressed="${c.day === x}">${esc(AR_DAYS[parse(x).getDay()])} <small>${esc(khDayLabel(x))}</small></button>`).join('')}<button type="button" class="chip" data-action="kh-rv-day" data-id="${t.id}" data-v="" aria-pressed="${!c.day}">أي يوم</button></div></div>` : ''}
      ${c.act !== 'drop' ? `<label class="field"><span>تُنقل بهذا النص (اختصرها إن شئت)</span><input type="text" data-kh-rvtext="${t.id}" value="${esc(c.text)}" autocomplete="off"></label>` : ''}</div>`;
  };
  return `<div class="crumbs"><button type="button" class="back" data-action="kh-review-close">${icon('back')} أسبوعي</button></div>
  <section class="section">
    <div class="section-head"><h2>مراجعة الأسبوع</h2><small>${esc(fmtDate(k, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(addDays(k, 6), { day: 'numeric', month: 'long' }))}</small></div>
    <p class="note-text explain">لا أحد ينجز كل ما وضعه بدقة. الخطة وسيلة لا غاية، والتقدم بحد ذاته إنجاز. احذر فخ المثالية: أن تظن أنك يجب أن تنجز كل ما كتبته، وفخ الإحباط: أن تتوقف عن التخطيط لأنك لم تنجز كل شيء.</p>
    ${khProgressHTML(k)}
    ${bal.length ? `<div class="panel"><h3>توازن أدوارك</h3>${bal.map(([r, d, n]) => `<div class="kh-bal" style="--rc:${khColor(r ? r.id : '')}"><span>${esc(r ? r.name : 'بلا دور')}</span><span class="kh-track sm"><i style="width:${Math.round((d / n) * 100)}%"></i></span><small>${d} من ${n}</small></div>`).join('')}
      ${none.length ? `<p class="note-text">لم تنجز شيئاً في: ${none.map(([r]) => `«${esc(r.name)}»`).join('، ')}. تذكّر أن تمنح كل دور حقه ولو بأقل الجهد.</p>` : ''}</div>` : ''}
    ${done ? (rec.review.moved || rec.review.dropped.length ? `<p class="note-text">${[rec.review.moved ? `نقلت ${plural(rec.review.moved, 'مهمة واحدة', 'مهمتين', 'مهام', 'مهمة')}` : '', rec.review.dropped.length ? `وألغيت: ${rec.review.dropped.map((x) => `«${esc(x)}»`).join('، ')}` : ''].filter(Boolean).join('، ')}.</p>` : '')
      : open.length ? `<div class="panel"><h3>ما لم يُنجز</h3><p class="note-text">لكل مهمة: انقلها إلى مثل يومها من الأسبوع القادم، أو إلى أسبوع تختاره ثم يومها منه (واختصرها إن شئت)، أو ألغها فتُحذف من مهامك.</p>
      ${open.map(pick).join('')}</div>`
        : xs.length && khWeekPct(k) === 100 ? '<p class="note-text kh-ok">أنجزت كل مهامك هذا الأسبوع. بارك الله في وقتك.</p>' : ''}
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
    const pct = khWeekPct(k); // (null: nothing was in its plan)
    for (const t of khOpenInWeek(k)) {
      const c = khUi.rv[t.id] || { act: 'move', text: t.title };
      if (c.act === 'drop') { dropped.push(t.title); dropTask(t.id); continue; }
      if (c.act === 'week' && c.wk) {
        // to a week chosen: on a day of it, or on any day of it (shown from its first day until its last)
        if (c.day) { t.due = c.day; t.from = ''; } else { t.due = addDays(c.wk, 6); t.from = c.wk; }
      } else if (t.from) {
        // «any day of its week»: the same week, a week on (a late review: this week)
        const w = addDays(t.from, 7) < khWeekOf(today()) ? khWeekOf(today()) : addDays(t.from, 7);
        t.from = w; t.due = addDays(w, 6);
      } else {
        // to the same day of the next week; with the text shortened if it was
        t.due = addDays(t.due, 7) < today() ? today() : addDays(t.due, 7); // (a late review: today at the earliest)
      }
      t.skip = {};
      t.title = c.text.trim() || t.title;
      t.movedFrom = k;
      moved++;
    }
    rec.review = { at: today(), pct, moved, dropped, ...q };
  } else Object.assign(rec.review, q);
  save();
  return { moved, dropped: dropped.length };
}

// ---------- two ready templates (v109): a role of the family and «شحذ المنشار», each from the vision to the days ----------
// Added as a plan of one's own, to edit as one wishes. What a template made is marked (tpl), so all of it can go and one can start again
// a project is a year goal in its role's chain (v126, the owner's rule: «كل مشروع لا بد أن يكون مرتبطاً برؤية، والرؤية
// مرتبطة بدور»): its year goal, the tasks of its days (under its week goals, recurring or once), and whether it is still
// to be tied to a vision (then «ناقص»); a project's task outside the chain is to be tied to its week by the owner
// a year goal and the years carried on from it, in their order (v126)
function khLineOf(g) { const out = g ? [g] : []; for (let i = 0; i < out.length && i < 30; i++) { const nx = S.kgoals.find((x) => x.prev === out[i].id && x.level === 'year'); if (nx && !out.includes(nx)) out.push(nx); } return out; }
const khNextOf = (g) => S.kgoals.find((x) => x.prev === g.id && x.level === 'year') || null;
// a project's goal measured: the months achieved of those asked for, in the years of its line begun so far, each in
// its own calendar (v126)
function khProjShare(p) {
  const g = p && khProjGoal(p);
  if (!g) return null;
  return khMm(`ps${p.id}`, () => khLineOf(g).reduce((a, y) => {
    const sp = khKeySpan(y.period);
    if (!sp || sp[0] > today()) return a;
    const x = khIn(y.period[0], () => ygShare(y, khYrStart(addDays(sp[0], 15))));
    return { target: a.target + x.target, done: a.done + x.done };
  }, { target: 0, done: 0 }));
}
// the project a year goal is (its own, or the one of the years it is carried on from)
// a task of a week goal's days: in a chain of «خطِّط», whose date, days and time are changed there only (v143, the owner: «كل
// ما كان داخلا ضمن التسلسل لا يمكن تغييره إلا في تسلسله»)
const khInChain = (t) => { const w = t && t.kgoal && kgOf(t.kgoal); return !!(w && w.level === 'week' && kgYear(w)); };
// …and a recurring one of a project's goal is a task, not a goal (v143, the owner: «مهام المشاريع تبقى مهام لا أهداف»)
const khProjTask = (t) => !!(t && isRepeat(t) && khInChain(t) && khMm(`pt${t.id}`, () => khLineOf(kgYear(kgOf(t.kgoal))).some((g) => khProjOfGoal(g))));
// its place in its chain: «سنتي» on its goal's year, the task shown there
function khChainGo(id) {
  const t = getTask(id), yg = t && khInChain(t) && kgYear(kgOf(t.kgoal)), gy = yg && khYrOfKey(yg.period);
  if (!gy) return;
  khUi.tab = 'year'; khUi.yr = gy === khYrStart(today()) ? '' : gy; khUi.role = '';
  go('plan');
  const el = document.querySelector(`#view .kh-leaf[data-id="${id}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('kh-flash'); setTimeout(() => el.classList.remove('kh-flash'), 2500); }
}
// what its date, days and time are, written (in its sheet outside «خطِّط»)
const khWhenText = (t) => [isRepeat(t) ? khDaysText(t) : t.due ? dueLabel(t.due) : 'بلا موعد', hasTime(t) ? timeLabel(t, today()) : ''].filter(Boolean).join(' | ');
const khProjOfGoal = (yg) => S.projects.find((p) => p.ygoal === yg.id) || S.projects.find((p) => p.ygoal && khLineOf(kgOf(p.ygoal)).includes(yg)) || null;
// «المشروع» in the year's step (v126, the owner's request): not a project, a new project of its name, or a project of
// the list. A project left by its goal stays in «المشاريع», serving no goal; one chosen takes its name and its role
function khProjField(w) {
  const ps = S.projects.filter((p) => !p.doneAt || p.id === w.projSel);
  return `<label class="field"><span>المشروع</span><select id="khwProj">
    <option value=""${!w.projSel ? ' selected' : ''}>ليس مشروعاً</option>
    <option value="new"${w.projSel === 'new' ? ' selected' : ''}>اجعله مشروعاً جديداً في صفحة المشاريع</option>
    ${ps.map((p) => `<option value="${p.id}"${p.id === w.projSel ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
}
function khSetProj(yg, sel, roleId) {
  if (!yg) return;
  const cur = khProjOfGoal(yg);
  if (cur && cur.id === sel) { if (cur.ygoal === yg.id) { cur.roleId = roleId; cur.area = ''; khNameProj(yg); } return; }
  // (a year carried on leaves its project's line: it goes on its own)
  if (cur && cur.ygoal !== yg.id) yg.prev = '';
  for (const p of S.projects) if (p.ygoal === yg.id) p.ygoal = '';
  let p = null;
  if (sel === 'new') { p = normalizeProject({ name: yg.text, roleId, ygoal: yg.id, created: Date.now(), color: PROJECT_COLORS[S.projects.length % PROJECT_COLORS.length][0] }); S.projects.push(p); }
  else if (sel) { p = getProject(sel); if (p) Object.assign(p, { ygoal: yg.id, roleId, area: '' }); }
  if (p) { khNameProj(yg); ldraft.projSel = p.id; }
}
// «العلم» in the year's step (v137, the owner's choice: every science is a year goal, as a project is): not a science, or a
// science of «الدراسة» (one goal each); its days' task is then its study sessions (study.js syncStudy)
function khSciField(w) {
  if (!S.study.length || w.bookSel || w.hzSel) return '';
  const yg = kgOf(w.yearId), line = yg ? khLineOf(yg) : [];
  const ss = S.study.filter((s) => s.id === w.sciSel || !sciGoal(s) || line.includes(sciGoal(s)));
  return `<label class="field"><span>العلم</span><select id="khwSci">
    <option value=""${!w.sciSel ? ' selected' : ''}>ليس علماً</option>
    ${ss.map((s) => `<option value="${s.id}"${s.id === w.sciSel ? ' selected' : ''}>${esc(s.emoji ? `${s.emoji} ${s.name}` : s.name)}</option>`).join('')}</select></label>`;
}
function khSetSci(yg, sel) {
  if (!yg) return;
  const cur = sciOfGoal(yg);
  if (cur && cur.id === sel) return;
  for (const s of S.study) if (s.ygoal && khLineOf(kgOf(s.ygoal)).includes(yg)) s.ygoal = '';
  const s = sel && getSci(sel);
  if (s) { s.ygoal = yg.id; s.updated = Date.now(); }
}
// «الكتاب» in the year's step (v140, the owner: «الكتب كلها تدخل ضمن الأدوار ويجري عليها التسلسل»): not a book, or a book
// still to read or being read (one goal each); while it is read, its reading goal is the task of its days (reading.js)
function khBookField(w) {
  if (w.sciSel || w.hzSel) return '';
  const yg = kgOf(w.yearId), line = yg ? khLineOf(yg) : [];
  const bs = S.books.filter((b) => b.id === w.bookSel || (['reading', 'want'].includes(b.status) && (!bookGoal(b) || line.includes(bookGoal(b)))));
  if (!bs.length) return '';
  return `<label class="field"><span>الكتاب</span><select id="khwBook">
    <option value=""${!w.bookSel ? ' selected' : ''}>ليس كتاباً</option>
    ${bs.map((b) => `<option value="${b.id}"${b.id === w.bookSel ? ' selected' : ''}>${esc(b.title)}${b.status === 'reading' ? '' : ` (${esc(BOOK_STATUS[b.status])})`}</option>`).join('')}</select></label>`;
}
function khSetBook(yg, sel) {
  if (!yg) return;
  const cur = bookOfGoal(yg);
  if (cur && cur.id === sel) return;
  for (const b of S.books) if (b.ygoal && khLineOf(kgOf(b.ygoal)).includes(yg)) b.ygoal = '';
  const b = sel && getBook(sel);
  if (b) b.ygoal = yg.id;
}
// «الحفظ» in the year's step (v142, the owner: «أضف كذلك للحفظ ما اتفقنا عليه»): not a plan, or a memorising plan not
// finished (one goal each); its days are then the tasks of its days
function khHzField(w) {
  if (w.sciSel || w.bookSel) return '';
  const yg = kgOf(w.yearId), line = yg ? khLineOf(yg) : [];
  const ps = S.hplans.filter((p) => p.id === w.hzSel || (!p.doneAt && (!hpGoal(p) || line.includes(hpGoal(p)))));
  if (!ps.length) return '';
  return `<label class="field"><span>خطة الحفظ</span><select id="khwHz">
    <option value=""${!w.hzSel ? ' selected' : ''}>ليست خطة حفظ</option>
    ${ps.map((p) => `<option value="${p.id}"${p.id === w.hzSel ? ' selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>`;
}
function khSetHz(yg, sel) {
  if (!yg) return;
  const cur = hpOfGoal(yg);
  if (cur && cur.id === sel) return;
  for (const p of S.hplans) if (p.ygoal && khLineOf(kgOf(p.ygoal)).includes(yg)) p.ygoal = '';
  const p = sel && getPlan(sel);
  if (p) p.ygoal = yg.id;
}
// «انقله إلى السنة التالية» in its step: what is written is saved, then its year after opens to be edited
const khExtBtn = (yg) => (yg && /^[gh]\d{4}$/.test(yg.period) ? `<button type="button" class="kh-cont lv-year" data-action="kh-w" data-op="ext">${icon('plus')}<span>${khNextOf(yg) ? `عدّل سنته التالية (${esc(khKeyLabel(khNextOf(yg).period))})` : `امدده إلى السنة التالية (${esc(khKeyLabel(yg.period[0] + (Number(yg.period.slice(1)) + 1)))})`}</span></button>` : '');
// a year goal written in a calendar turns the whole plan to it (v126, the owner's request: «التاريخ الهجري يقلب كل
// الميلادي إلى هجري والعكس»): «سنتي», «شهري», the steps and the monthly calendar go by the calendar of its year
function khFollowCal(key) {
  const h = (key || '')[0] === 'h';
  if (!/^[gh]\d{4}$/.test(key || '') || h === calHijri()) return;
  S.settings.calType = h ? 'hijri' : 'greg';
  khMemo.clear(); khResyncChains();
  khUi.yr = ''; khUi.mo = '';
  if (typeof ui !== 'undefined') { ui.calH = hMonthStart(today()); ui.calMonth = today().slice(0, 7); }
}
// the project follows the name of the year goal it is linked to (v126, the owner's request)
function khNameProj(yg) { if (yg) for (const p of S.projects) if (p.ygoal === yg.id && yg.text.trim()) p.name = yg.text.trim(); }
// «امدده إلى السنة التالية» (v126, the owner's request): the same path, from the goal to its days, as a goal of the
// year after it in its own calendar, on its own: its months a year on, its weeks, the tasks of its days anew. What is
// changed in either year stays in it; the next year is edited by going to it
function khExtend(yg) {
  const mm = /^([gh])(\d{4})$/.exec(yg.period || '');
  if (!mm || khNextOf(yg)) return khNextOf(yg);
  const key = `${mm[1]}${Number(mm[2]) + 1}`, now = Date.now();
  const ny = normalizeKGoal({ ...yg, id: uid(), period: key, prev: yg.id, status: 'open', closedAt: '', ticks: {}, created: now, tpl: '' });
  S.kgoals.push(ny);
  for (const m of kgKids(yg, 'month')) {
    const nm = normalizeKGoal({ ...m, id: uid(), parent: ny.id, months: [...new Set(m.months.map((r) => khRangeShift(r, 1)))].sort(), status: 'open', closedAt: '', ticks: {}, created: now, from: '', tpl: '' });
    S.kgoals.push(nm);
    for (const wg of kgKids(m, 'week')) {
      const nw = normalizeKGoal({ ...wg, id: uid(), parent: nm.id, status: 'open', closedAt: '', ticks: {}, created: now, from: '', tpl: '' });
      S.kgoals.push(nw);
      const s0 = khChainStart(nm), e0 = khChainEnd(nm);
      for (const t of kgTasks(wg).filter((x) => isRepeat(x) && !x.sciId && !x.bookId)) { // (a science's or a book's one task goes on into it by itself)
        S.tasks.push(normalize({ ...t, id: uid(), kgoal: nw.id, created: now, done: false, doneAt: null, completions: {}, counts: {}, notes: [], subtasks: [], prio: '', life: false, skip: {}, tpl: '', movedFrom: '',
          repeat: { ...t.repeat, start: s0, until: e0 && e0 >= s0 ? e0 : s0, skip: {}, mv: {} } }));
      }
    }
  }
  save();
  return ny;
}
// the tasks of a project: its own, and the tasks of its goal's days (v126), each once
// (v145: every task of its chain, whatever it carries, once (not a book task that left its project, as tasksOf): a recurring one carrying the project's name fell out of both, the owner: «ليش زالت من صفحة مشروعها حين جعلتها متكررة»)
function khProjTasks(p) { const yg = khProjGoal(p), own = tasksOf(p.id); return [...own, ...(yg ? khGoalTasks(yg).filter((t) => !own.includes(t) && !t.left) : [])]; }
const khProjGoal = (p) => { const g = p && kgOf(p.ygoal); return g && g.level === 'year' ? g : null; };
function khGoalTasks(yg) {
  const ws = new Set(khLineOf(yg).flatMap((y) => kgKids(y, 'month')).flatMap((m) => kgKids(m, 'week')).map((w) => w.id));
  return S.tasks.filter((t) => ws.has(t.kgoal) && !(isRepeat(t) && goalEnded(t)));
}
const khProjNeed = (p) => { const g = khProjGoal(p); return !g || !kgOf(g.parent); };
const khLoose = (t) => !(t.kgoal && kgOf(t.kgoal) && kgOf(t.kgoal).level === 'week');
// a project's task tied by the owner to a week goal of its year goal
function khTaskLinkSheet(id) {
  const t = getTask(id), p = t && getProject(t.projectId), yg = khProjGoal(p);
  if (!t || !yg) return;
  const ms = kgKids(yg, 'month');
  ldraft = { kind: 'khlink', id: 'x', isNew: false };
  $('libForm').innerHTML = `${sheetHead('اربطها بأسبوعها')}
    ${khCtx('year', 'هدف السنة', yg.text)}
    <p class="note-text">«${esc(t.title)}»: أيّ هدف أسبوع تخدمه؟</p>
    ${ms.some((m) => kgKids(m, 'week').length) ? ms.map((m) => `<div class="kh-ask lv-month"><span class="kh-al">${esc(m.text)}</span><div class="kh-chips">${kgKids(m, 'week').map((w) => `<button type="button" class="chip" data-action="kh-task-wg" data-v="${t.id}" data-w="${w.id}" aria-pressed="${t.kgoal === w.id}">${esc(w.text)}</button>`).join('')}</div></div>`).join('')
      : `<p class="note-text">لم تبنِ أشهر هذا الهدف وأسابيعه بعد.</p><div class="btn-row">${khCont('month', 'أكمل: ثم أشهرك', ` data-step="1" data-year="${yg.id}"`)}</div>`}`;
  showLib();
}

const KH_TPLS = [
  { id: 'rahm', name: 'عائلية: صلة الرحم', role: 'عائلية (ابن، زوج، أب)', life: 'أن أكون واصلاً لرحمي، قريباً من أهلي',
    why: 'لقوله ﷺ: «من سرّه أن يُبسط له في رزقه، ويُنسأ له في أثره، فليصل رحمه» (متفق عليه)',
    year: 'أتصل بقريب كل أسبوع، فلا تمر السنة إلا وقد وصلت أقاربي كلهم', month: 'أصل في كل شهر أربعة من أقاربي', week: 'قريب واحد كل أسبوع، أبدأ بمن طال انقطاعي عنه',
    days: [{ text: 'الاتصال بقريب للسلام عليه', per: 1, prayer: 'maghrib' }] },
  { id: 'saw', name: 'شحذ المنشار', role: '', life: 'جسد قوي، وعقل يقظ، ونفس مطمئنة، وصِلات طيبة',
    why: 'لقوله ﷺ: «المؤمن القوي خير وأحب إلى الله من المؤمن الضعيف» (رواه مسلم)',
    year: 'أعتني بجوانبي الأربعة كل أسبوع هذه السنة', month: 'مشي منتظم، وكتاب أقرؤه، وأذكار ثابتة، وصلة صديق', week: 'مهمة لكل جانب في كل أسبوع',
    days: [{ area: 'health', text: 'المشي ٣٠ دقيقة', per: 3, prayer: 'fajr' }, { area: 'mind', text: 'قراءة ١٠ صفحات', days: [0, 2, 4], prayer: 'isha' },
      { area: 'soul', text: 'أذكار المساء', days: [0, 1, 2, 3, 4, 5, 6], prayer: 'asr' }, { area: 'social', text: 'الاتصال بصديق للسلام عليه', per: 1, prayer: 'maghrib' }] },
];
const khTplOn = (id) => S.kgoals.some((g) => g.tpl === id);
// as the steps of «هدف للسنة» build it: the vision, this year's goal (with its five laws), its months still to come, all their weeks, and the tasks of the days
function khAddTpl(id) {
  const T = KH_TPLS.find((x) => x.id === id);
  if (!T || khTplOn(id)) return false;
  let roleId = KH_SAW;
  if (T.role) {
    let r = S.roles.find((x) => x.name === T.role);
    if (!r) { r = normalizeRole({ name: T.role, tpl: id }); S.roles.splice(S.roles.findIndex((x) => x.id === KH_SAW), 0, r); }
    roleId = r.id;
  }
  const laws = Object.fromEntries(KH_LAWS.map(([k]) => [k, true])), yk = khYearOpts()[0][0], sp = khKeySpan(yk) || [khYrStart(today()), khYrNext(khYrStart(today()))];
  const months = khSpanMonths(sp).filter((m) => khMoNext(m) > khMoStart(today())).map(khMoRange), from = weekStartOf(today());
  const life = normalizeKGoal({ level: 'life', roleId, text: T.life, why: T.why, tpl: id });
  const year = normalizeKGoal({ level: 'year', roleId, text: T.year, why: T.why, laws, parent: life.id, period: yk, tpl: id });
  const month = normalizeKGoal({ level: 'month', text: T.month, parent: year.id, months, from, tpl: id });
  const week = normalizeKGoal({ level: 'week', text: T.week, parent: month.id, from, tpl: id });
  S.kgoals.push(life, year, month, week);
  const start = khChainStart(month), until = khChainEnd(month);
  for (const c of T.days) S.tasks.push(normalize({ kind: 'goal', title: c.text, repeat: { days: c.per ? [...DAY_ORDER] : [...c.days], start, until, ...(c.per ? { per: c.per } : {}) },
    kgoal: week.id, roleId, area: c.area || '', prayer: { name: c.prayer, offset: 0 }, tpl: id }));
  save();
  return true;
}
// all that a template made and what was put under it goes; the rest of the plan stays (and the role, if something else is in it)
function khRemoveTpl(id) {
  for (let g; (g = S.kgoals.find((x) => x.tpl === id));) kgDrop(g);
  for (const t of S.tasks.filter((x) => x.tpl === id)) dropTask(t.id);
  S.roles = S.roles.filter((r) => r.tpl !== id || S.kgoals.some((g) => g.roleId === r.id) || S.tasks.some((t) => t.roleId === r.id) || S.projects.some((p) => p.roleId === r.id));
  S.roles.forEach((r) => { if (r.tpl === id) r.tpl = ''; });
  save();
}

// ---------- the chain's pieces, shown alike in every tab ----------
const khN = (n) => (n ? String(n) : 'صفر');
const KH_UNIT = { week: (n) => plural(n, 'أسبوع واحد', 'أسبوعين', 'أسابيع', 'أسبوعاً'), month: (n) => plural(n, 'شهر واحد', 'شهرين', 'أشهر', 'شهراً'), times: (n) => plural(n, 'مرة واحدة', 'مرتين', 'مرات', 'مرة') };
// a level's share: a bar, and its number in the unit of the level under it
const khProg = (x, unit, tail) => (x.target ? `<div class="kh-gprog"><span class="kh-track sm"><i style="width:${Math.min(100, Math.round((x.done / x.target) * 100))}%"></i></span><small>${khN(x.done)} من ${KH_UNIT[unit](x.target)}${tail ? ` ${tail}` : ''}</small></div>` : '');
const khDoneBadge = (label) => `<span class="kh-tick on">${icon('check')}<span>${label}</span></span>`;
const khStat = (g) => (g.status !== 'open' ? ` <span class="kh-st ${g.status}">${KH_GSTAT[g.status]}</span>` : '');
const mgAhead = (g) => { const sp = kgSpan(g); if (!sp || kgClosedOf(g)) return false; for (let m = khMoStart(today()); addDays(m, 14) < sp[1]; m = khMoNext(m)) if (mgActive(g, m)) return true; return false; };
// where a year goal's plan stopped («أكمل لاحقاً»): its months, a month goal's weeks, or a week goal's days; shown in «أدواري» and «حياتي» too
function khContOf(yg) {
  const gy = khYrOfKey(yg.period);
  if (yg.status !== 'open' || !gy || khYrNext(gy) <= today()) return '';
  const name = `«${esc(yg.text)}»`, ms = kgKids(yg, 'month');
  if (!ms.length) return khCont('month', `أكمل ${name}: ثم أشهرك`, ` data-step="1" data-year="${yg.id}"`);
  const m = ms.find((x) => !kgKids(x, 'week').length && mgAhead(x));
  if (m) return khCont('week', `أكمل ${name}: ثم أسابيعك`, ` data-step="2" data-month="${m.id}"`);
  const w = ms.filter(mgAhead).flatMap((x) => kgKids(x, 'week')).find((x) => !kgClosedOf(x) && !S.tasks.some((t) => t.kgoal === x.id));
  return w ? khCont('day', `أكمل ${name}: ثم أيامك`, ` data-step="3" data-week="${w.id}"`) : '';
}
const khCont = (lv, label, attrs) => `<button type="button" class="kh-cont lv-${lv}" data-action="kh-wiz"${attrs}>${icon('plus')}<span>${label}</span></button>`;
const khCtx = (lv, small, text) => `<div class="kh-ctx lv-${lv}"><small>${small}</small><b>${esc(text)}</b></div>`;
function khMonthsText(g) { return khIn(kgCal(g), () => khMonthsText0(g)); }
function khMonthsText0(g) {
  if (g.months.length) {
    const ms = [...new Set(g.months.map((r) => khMoStart(khMid(r))))].sort();
    const cont = ms.every((m, i) => !i || khMoNext(ms[i - 1]) === m);
    return ms.length === 1 ? `في ${khMoLabel(ms[0])}` : cont && ms.length > 2 ? `من ${khMoShort(ms[0])} إلى ${khMoShort(ms[ms.length - 1])}` : `في ${ms.map(khMoShort).join('، ')}`;
  }
  return g.moN ? `${plural(g.moN, 'شهر واحد', 'شهران', 'أشهر', 'شهراً')} من السنة، أيّها كان` : '';
}
const khWeeksText = (g) => (g.wk.length ? `${g.wk.length === 1 ? 'الأسبوع' : 'الأسابيع'}: ${g.wk.map((i) => KH_ORD[i - 1]).join(' و')} من كل شهر` : g.wkN ? `${plural(g.wkN, 'أسبوع واحد', 'أسبوعان', 'أسابيع', 'أسبوعاً')} من كل شهر، أيّها كان` : 'كل الأسابيع');
const khDaysText = (t) => (t.repeat.per ? `${plural(t.repeat.per, 'مرة', 'مرتان', 'مرات', 'مرة')} في الأسبوع` : t.repeat.days.length === 7 ? 'كل يوم' : DAY_ORDER.filter((d) => t.repeat.days.includes(d)).map((d) => AR_DAYS[d]).join(' و'));
// a period's top bar: back and forth, and the way back to now
const khPeriodNav = (title, label, prev, next, action, back) => `<div class="cal-head">
    <div class="nav"><button type="button" data-action="${action}" data-v="${prev}" aria-label="السابق">${icon('prev')}</button></div>
    <div class="titles"><h2>${title}</h2><small>${esc(label)}</small></div>
    <div class="nav"><button type="button" data-action="${action}" data-v="${next}" aria-label="التالي">${icon('next')}</button></div>
  </div>${back ? `<button type="button" class="ghost" data-action="${action}" data-v="">${back}</button>` : ''}`;
const khRoleSec = (r, inner, n) => `<div class="kh-role" style="--rc:${khColor(r ? r.id : '')}"><div class="kh-role-head"><b>${esc(r ? r.name : 'بلا دور')}</b>${n ? `<small class="kh-cnt">${plural(n, 'إنجاز واحد', 'إنجازان', 'إنجازات', 'إنجازاً')}</small>` : ''}</div>${inner}</div>`;

// ---------- شهري ----------
// (v146) with its week goals and their tasks inside, as in «سنتي» without the year, the owner: «المربعات المتداخلة التي تظهر في سنتي،
// أريد مثلها يظهر في شهري لكن دون سنتي»; no «تحقّق هذا الشهر» by hand: it is achieved by its weeks
function khMonthNode(g, m) {
  const x = mgShare(g, m), full = x.target > 0 && x.done >= x.target, yg = kgOf(g.parent);
  const live = khMoNext(m) > today(), ws = kgKids(g, 'week').filter((w) => wgWeeks(w, m).length);
  // «a number of any months»: it shows in every month until its number is reached, and says so
  const why = !g.months.length && g.moN ? khWhyBtn(`يظهر كل شهر لأنك لم تحدد أشهره: يتحقق في ${KH_UNIT.month(g.moN)} من السنة أيًّا كانت، فإذا تحقق عددها لم يظهر بقية السنة.`) : '';
  return `<div class="kh-node lv-month">
    <button type="button" class="kh-nh" data-action="kh-edit-mg" data-v="${g.id}"><small>هدف الشهر${khStat(g)}</small><b>${esc(g.text)}</b></button>${why}
    ${yg ? `<small class="kh-serve">يخدم سنتك: ${esc(yg.text)}</small>` : ''}
    ${khProg(x, 'week', 'هذا الشهر')}
    ${g.status === 'open' && full ? khDoneBadge('تحقّق هذا الشهر') : ''}
    ${ws.map((w) => khChainWeek(w, khYrStart(m), live)).join('')}
    ${!ws.length && live && mgAhead(g) ? khCont('week', 'أكمل: ثم أسابيعك', ` data-step="2" data-month="${g.id}"`) : ''}
  </div>`;
}
function khMonthHTML() {
  const now = khMoStart(today()), m = khUi.mo ? khMoStart(khUi.mo) : now, end = khMoNext(m), cur = weekStartOf(today());
  // its weeks: those that start in it, each with its share (one still to come has none yet)
  const weeks = khWeeksOf(m).filter((k) => k <= cur || khWeekItems(k).some((x) => khInRole(x.t))), pk = (k) => (k > cur ? null : khPctFor(k));
  const pcts = weeks.map(pk).filter((x) => x !== null), avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  const n = khDoneIn(m, end, khRoleArg()), life = khLifeRec(m, end).filter((x) => khInRole(x.t)).length;
  const card = (r) => {
    const gs = S.kgoals.filter((g) => g.level === 'month' && kgRoleId(g) === (r ? r.id : '') && mgActive(g, m));
    if (!r && !gs.length) return '';
    return khRoleSec(r, `${gs.map((g) => khMonthNode(g, m)).join('')}${r && end > today() ? `<div class="btn-row kh-adds">${addBtn('kh-mplan', 'هدف للشهر', ` data-role="${r.id}" data-mo="${m}"`)}</div>` : ''}`, khDoneIn(m, end, r ? r.id : ''));
  };
  return `<section class="section">
    ${khPeriodNav(m === now ? 'شهري' : 'شهر', khMoLabel(m), khMoPrev(m), end, 'kh-mo', m !== now ? 'العودة إلى هذا الشهر' : '')}
    ${khPdfBtn('month')}
    <p class="note-text explain">أهداف الشهر خطوات من أهداف سنتك، وتحت كل هدف أسابيعه ثم أيامها. الشهر يتحقق بأسابيعه، والأسبوع بأيامه. وفي آخر الصفحة ما أهميته قصوى ولم تُنجزه في وقته.</p>
    <div class="panel kh-stats"><div class="kh-nums"><span><b>${khN(n)}</b>${n === 1 ? 'إنجاز' : 'إنجازات'}</span><span><b>${avg === null ? '—' : `${avg}٪`}</b>متوسط أسابيعه</span><span><b>${khN(life)}</b>في حياتي</span></div>
      ${weeks.length ? `<div class="kh-chips">${weeks.map((k) => { const p = pk(k); return `<button type="button" class="chip${p !== null && p >= KH_RATE ? ' ok' : ''}" data-action="kh-goweek" data-v="${k}">${esc(khDayLabel(k))}: ${p === null ? (k > cur ? 'لم يأتِ' : 'بلا بنود') : `${p}٪`}</button>`; }).join('')}</div>` : ''}</div>
    ${khShownRoles().map(card).join('')}
    ${m === now ? khWeeksOf(m).filter((k) => k < khWeekOf(today())).map((k) => khLateBox(khLates((x, at) => at === 'week' && khWeekOf(x.d) === k), `لم تُنجز في وقتها: أسبوع ${khDayLabel(k)}`)).join('')
      : m < now ? khLateBox(khLates((x, at) => at === 'month' && x.t.priority === 'high' && khMoStart(khWeekOf(x.d)) === m), 'لم تُنجز في وقتها في هذا الشهر') : ''}
  </section>`;
}

// ---------- سنتي ----------
// a year goal's whole chain: its months, their weeks, the tasks of their days
// a task of the chain as «سنتي» draws it (and «شهري», v146): its days or its day and time (tapped: its own days step, where its day
// and time are changed, v144), its title (tapped: its sheet), what was done of it this year; and «★ قصوى» (v146)
function khChainDay(t, y) {
  const ds = Object.keys(t.completions).filter((d) => t.completions[d] && d >= y && d < khYrNext(y));
  return `<div class="kh-node lv-day kh-dwrap"><button type="button" class="kh-leaf" data-action="open" data-id="${t.id}"><small class="kh-day-edit" data-action="kh-day-edit" data-v="${t.id}">${isRepeat(t) ? esc(khDaysText(t)) : (t.due ? `لمرة: ${esc(dueLabel(t.due))}` : 'لمرة: بلا موعد')}${hasTime(t) ? ` | ${esc(timeLabel(t, today()))}` : ''}</small><b>${esc(t.title)}</b>${isRepeat(t) && ds.length ? `<small>أنجزتها ${plural(ds.length, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')} هذه السنة</small>` : !isRepeat(t) && t.done ? '<small>✓ أنجزتها</small>' : ''}</button>${khImpBtn(t)}</div>`;
}
// a week goal of the chain with its tasks (a year, or a month, gone by is shown, not built on)
function khChainWeek(w, y, live) {
  const ts = kgTasks(w);
  return `<div class="kh-node lv-week"><button type="button" class="kh-nh" data-action="kh-edit-wg" data-v="${w.id}"><small>${esc(khWeeksText(w))}${khStat(w)}</small><b>${esc(w.text)}</b></button>
    ${ts.map((t) => khChainDay(t, y)).join('')}
    ${live && !kgClosedOf(w) && mgAhead(kgOf(w.parent)) ? khCont('day', ts.length ? 'مهمة أخرى لهذا الهدف' : 'أكمل: ثم أيامك', ` data-step="3" data-week="${w.id}"`) : ''}</div>`;
}
function khChainHTML(yg, y) {
  const live = khYrNext(y) > today(); // a year gone by is shown, not built on
  const weekNode = (w) => khChainWeek(w, y, live);
  const monthNode = (m) => {
    const ws = kgKids(m, 'week'), mx = mgYear(m, y);
    return `<div class="kh-node lv-month"><button type="button" class="kh-nh" data-action="kh-edit-mg" data-v="${m.id}"><small>${esc(khMonthsText(m))}${khStat(m)}</small><b>${esc(m.text)}</b></button>
      ${mx.target ? `<small class="kh-serve">تحقّق في ${khN(mx.done)} من ${KH_UNIT.month(mx.target)}</small>` : ''}
      ${ws.map(weekNode).join('')}
      ${!ws.length && live && mgAhead(m) ? khCont('week', 'أكمل: ثم أسابيعك', ` data-step="2" data-month="${m.id}"`) : ''}</div>`;
  };
  const ms = kgKids(yg, 'month'), x = ygShare(yg, y), v = kgOf(yg.parent), nx = khNextOf(yg);
  return `<div class="kh-node lv-year"><button type="button" class="kh-nh" data-action="kh-edit-goal" data-v="${yg.id}"><small>هدف السنة${khStat(yg)}</small><b>${esc(yg.text)}</b></button>
    ${v ? `<small class="kh-serve">يخدم رؤيتك: ${esc(v.text)}</small>` : ''}
    ${khProg(x, 'month')}${x.target && x.done >= x.target ? khDoneBadge('تحقّق في أشهره كلها') : ''}
    ${ms.map(monthNode).join('')}
    ${yg.status === 'open' && live ? khCont('month', ms.length ? 'اربطه بأشهر أخرى' : 'أكمل: ثم أشهرك', ` data-step="1" data-year="${yg.id}"`) : ''}
    ${nx ? `<button type="button" class="kh-cont lv-year" data-action="kh-goyear" data-v="${nx.id}"><span>سنته التالية: ${esc(khKeyLabel(nx.period))}</span></button>` : /^[gh]\d{4}$/.test(yg.period) ? `<button type="button" class="kh-cont lv-year" data-action="kh-extend" data-v="${yg.id}">${icon('plus')}<span>امدده إلى السنة التالية (${esc(khKeyLabel(yg.period[0] + (Number(yg.period.slice(1)) + 1)))})</span></button>` : ''}</div>`;
}
function khYearHTML() {
  const now = khYrStart(today()), y = khUi.yr ? khYrStart(khUi.yr) : now, end = khYrNext(y);
  const months = [];
  for (let m = y; m < end; m = khMoNext(m)) months.push(m);
  const counts = months.map((m) => khDoneIn(m, khMoNext(m), khRoleArg())), max = Math.max(1, ...counts), n = khDoneIn(y, end, khRoleArg());
  const card = (r) => {
    const gs = S.kgoals.filter((g) => g.level === 'year' && kgRoleId(g) === (r ? r.id : '') && khYrOfKey(g.period) === y);
    if (!r && !gs.length) return '';
    return khRoleSec(r, `${gs.length ? `<div class="kh-chain">${gs.map((g) => khChainHTML(g, y)).join('')}</div>` : ''}${r && end > today() ? `<div class="btn-row kh-adds">${addBtn('kh-wiz', 'هدف للسنة', ` data-step="0" data-role="${r.id}" data-yk="${khYrKey(y)}"`)}</div>` : ''}`, khDoneIn(y, end, r ? r.id : ''));
  };
  return `<section class="section">
    ${khPeriodNav(y === now ? 'سنتي' : 'سنة', khYrLabel(y), khYrPrev(y), end, 'kh-yr', y !== now ? 'العودة إلى هذه السنة' : '')}
    ${khPdfBtn('year')}
    ${khYtBtn()}
    <p class="note-text explain">من رؤيتك في كل دور: هدف لسنتك، ثم أشهره، ثم أسابيعها، ثم أيامها. والسنة تتحقق بأشهرها.</p>
    ${khShownRoles().map(card).join('')}
    <div class="panel"><div class="row-between"><b>إنجازات السنة${khRoleF() ? ` في «${esc(khRole(khRoleF()).name)}»` : ''}</b><span class="kh-pct ok">${khN(n)}</span></div>
      <div class="kh-months">${months.map((m, i) => `<button type="button" class="kh-mo${m === khMoStart(today()) ? ' now' : ''}" data-action="kh-gomonth" data-v="${m}"><span>${esc(khMoShort(m))}</span><span class="kh-track sm"><i style="width:${Math.round((counts[i] / max) * 100)}%"></i></span><small>${khN(counts[i])}</small></button>`).join('')}</div></div>
  </section>`;
}

// ---------- حياتي ----------
function khLifeHTML() {
  const rec = khLifeRec(), cy = khYrStart(today()), n = khDoneIn('', '9999');
  const first = [...S.tasks.map((t) => (t.created ? iso(new Date(t.created)) : '')), ...S.weeks.map((w) => w.id)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2000-01-01').sort()[0] || today();
  const wn = khWeekOf(today()), pcts = khWeekStarts(weekStartOf(first), addDays(wn, 7)).filter((k) => k <= wn && khWeekItems(k).length).map(khShownPct).filter((x) => x !== null);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  const visionHTML = (v, r) => {
    const ys = kgKids(v, 'year'), now = ys.filter((g) => khYrOfKey(g.period) === cy);
    const p = now.reduce((a, g) => { const x = ygShare(g, cy); return { target: a.target + x.target, done: a.done + x.done }; }, { target: 0, done: 0 });
    return `<div class="kh-node lv-life"><button type="button" class="kh-nh" data-action="kh-edit-goal" data-v="${v.id}"><small>رؤيتي${khStat(v)}</small><b>${esc(v.text)}</b>${v.why ? `<small>${esc(v.why)}</small>` : ''}</button>
      ${p.target ? `<small class="kh-serve">تقدّمك نحوها في ${esc(khYrLabel(cy))}: من أشهر خطة سنتك لها</small>${khProg(p, 'month')}` : ''}
      ${ys.length ? `<div class="kh-kids">${ys.map((g) => `<button type="button" class="kh-link" data-action="kh-edit-goal" data-v="${g.id}">${g.status === 'done' ? '✓' : g.status === 'dropped' ? '✗' : '•'} ${esc(g.text)} <small>(${esc(khKeyLabel(g.period))})</small></button>`).join('')}</div>` : ''}
      ${ys.map(khContOf).join('')}
      ${r && v.status === 'open' && !now.some((g) => g.status === 'open') ? khCont('year', 'التالي: هدف هذه السنة لهذه الرؤية', ` data-step="0" data-role="${r.id}" data-vision="${v.id}"`) : ''}</div>`;
  };
  const card = (r) => {
    const vs = S.kgoals.filter((g) => g.level === 'life' && (khRole(g.roleId) ? g.roleId : '') === (r ? r.id : ''));
    const mine = rec.filter((a) => khRoleIdOf(a.t) === (r ? r.id : ''));
    if (!r && !vs.length && !mine.length) return '';
    return khRoleSec(r, `${vs.map((v) => visionHTML(v, r)).join('') || (r ? '<p class="note-text">ما الصورة التي تريد أن تكون عليها في هذا الدور؟</p>' : '')}
      ${r ? `<div class="btn-row kh-adds">${addBtn('kh-new-vision', 'رؤية', ` data-role="${r.id}"`)}</div>` : ''}
      ${mine.length ? `<ul class="kh-record">${mine.map((a) => { const v = a.t.kgoal && kgVision(kgOf(a.t.kgoal)); return `<li><span>✦ ${esc(a.t.title)}${a.n ? ` <small>(${KH_UNIT.times(a.n)})</small>` : ''}</span><small>${a.n ? 'آخرها ' : ''}${esc(dueLabel(a.d))}${v ? ` | ${esc(v.text)}` : ''}</small></li>`; }).join('')}</ul>` : ''}`, khDoneIn('', '9999', r ? r.id : ''));
  };
  return `<section class="section">
    <div class="section-head"><h2>حياتي</h2></div>
    <p class="note-text explain">هنا يلتقي كل شيء: رؤيتك في كل دور، وما ينعكس فيها من أيامك وأسابيعك وشهورك وسنينك.</p>
    <div class="panel kh-stats"><div class="kh-nums"><span><b>${khN(n)}</b>كل إنجازاتك</span><span><b>${khN(rec.length)}</b>في سجل حياتي</span><span><b>${avg === null ? '—' : `${avg}٪`}</b>متوسط أسابيعك</span></div></div>
    ${[...khRoles(), null].map(card).join('')}
    ${rec.length ? '' : '<p class="note-text">حين تنجز مهمة في «يومي»، اضغط «✦ ينعكس في حياتي؟» بجانبها لتحفظها هنا في سجل حياتك.</p>'}
  </section>`;
}

// ---------- a vision or a year goal ----------
function khGoalSheet(id, preset = {}) {
  const g = kgOf(id);
  ldraft = { kind: 'khgoal', id: g ? g.id : 'new', isNew: !g, x: g ? normalizeKGoal(g) : normalizeKGoal({ level: 'life', ...preset }) };
  khGoalDraw();
  showLib();
}
const khLawsHTML = (laws) => `<fieldset class="kh-laws"><legend>راعِ في هدفك قوانين الهدف الخمسة:</legend>${KH_LAWS.map(([k, n, d]) => `<label class="kh-law"><input type="checkbox" data-kh-law="${k}"${laws[k] ? ' checked' : ''}><span><b>${n}</b><small>${d}</small></span></label>`).join('')}</fieldset>`;
function khGoalKeep() {
  const x = ldraft.x, v = (id) => ($(id) ? $(id).value : null);
  if (v('kgText') !== null) x.text = v('kgText');
  if (v('kgWhy') !== null) x.why = v('kgWhy');
  if (v('kgUp') !== null) x.parent = v('kgUp');
  if (v('kgPer') !== null) x.period = v('kgPer');
  document.querySelectorAll('#libForm [data-kh-law]').forEach((c) => { x.laws[c.dataset.khLaw] = c.checked; });
}
function khGoalDraw() {
  const { x, isNew } = ldraft, year = x.level === 'year';
  const lock = year && !isNew && kgKids(x, 'month').length > 0;
  const ups = year ? S.kgoals.filter((v) => v.level === 'life' && v.roleId === x.roleId && (v.status === 'open' || v.id === x.parent)) : [];
  const per = khYearOpts();
  if (x.period && !per.some(([k]) => k === x.period)) per.unshift([x.period, khKeyLabel(x.period)]);
  $('libForm').innerHTML = `${sheetHead(isNew ? 'رؤية جديدة' : year ? 'هدف السنة' : 'الرؤية')}
    <label class="field"><span>الدور</span><select id="kgRole">${khRoles().map((r) => `<option value="${r.id}"${r.id === x.roleId ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}${khRole(x.roleId) ? '' : '<option value="" selected>بلا دور</option>'}</select></label>
    <label class="field"><span>${year ? 'الهدف' : 'رؤيتك في هذا الدور: الصورة التي تريد أن تكون عليها فيه'}</span><textarea id="kgText" rows="2">${esc(x.text)}</textarea></label>
    ${year ? `<label class="field"><span>يخدم أيّ رؤية؟</span><select id="kgUp"><option value="">بلا ربط</option>${ups.map((v) => `<option value="${v.id}"${v.id === x.parent ? ' selected' : ''}>${esc(v.text)}</option>`).join('')}</select></label>
      ${lock ? `<p class="note-text">السنة: ${esc(khKeyLabel(x.period))} (ثابتة بعد ربطه بأشهره)</p>` : `<label class="field"><span>السنة</span><select id="kgPer">${per.map(([k, l]) => `<option value="${k}"${k === x.period ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`}` : ''}
    <label class="field"><span>لماذا تريده؟ (المعنى، اختياري)</span><textarea id="kgWhy" rows="2">${esc(x.why)}</textarea></label>
    ${year ? khLawsHTML(x.laws) : ''}
    ${isNew ? '' : `<div class="field"><span>حاله</span><div class="seg" role="group" aria-label="حاله">${Object.entries(KH_GSTAT).map(([k, l]) => `<button type="button" data-action="kh-gst" data-v="${k}" aria-pressed="${x.status === k}">${l}</button>`).join('')}</div></div>`}
    ${isNew ? '' : `<p class="note-text">${esc(kgDropNote(x))}</p>`}
    <div class="sheet-actions"><button type="submit" class="primary">${isNew ? 'أضف' : 'احفظ'}</button>${isNew ? '' : '<button type="button" class="danger" data-action="kh-kg-del">حذف</button>'}</div>`;
}
function khSaveGoal() {
  khGoalKeep();
  const { x } = ldraft, g = kgOf(x.id);
  x.text = x.text.trim(); x.why = x.why.trim();
  if (!x.text) { toast(x.level === 'life' ? 'اكتب رؤيتك أولاً.' : 'اكتب الهدف أولاً.'); return false; }
  if (g && g.status !== x.status) x.closedAt = x.status === 'open' ? '' : today();
  // the year goals serving a vision follow it to its role
  if (g && x.level === 'life' && g.roleId !== x.roleId) for (const y of kgKids(g, 'year')) y.roleId = x.roleId;
  if (g) Object.assign(g, x); else S.kgoals.push(normalizeKGoal({ ...x, id: uid() }));
  save();
  return true;
}

// ---------- the steps from the vision to the days: «هدف للسنة» ----------
// four steps: the year's goal, its months, their weeks, their days. Each step is kept when it is left, so «أكمل
// لاحقاً» keeps what was written and «أكمل» under the goal goes on from there. Each line of the days' answer is a task
// of its own, with its days and its time. o: { step, roleId, yk, vision, yearId, monthId, weekId, edit, once, k, day, text }
const KH_WSTEPS = [['year', 'السنة'], ['month', 'الأشهر'], ['week', 'الأسابيع'], ['day', 'الأيام']];
function khWizard(o = {}) {
  // a task of the days, edited in its own step (v144): its week goal, and its answer as written
  const et = o.task && getTask(o.task);
  if (et) o = { ...o, step: 3, edit: 'day', weekId: et.kgoal, once: !isRepeat(et), k: weekStartOf((!isRepeat(et) && (et.from || et.due)) || today()), day: !isRepeat(et) && !et.from ? et.due : '', text: et.title };
  const wg = kgOf(o.weekId), mg = kgOf(o.monthId || (wg ? wg.parent : '')), yg = kgOf(o.yearId || (mg ? mg.parent : ''));
  const roleId = o.edit === 'year' && yg ? (khRole(yg.roleId) ? yg.roleId : '') : o.roleId || (yg ? kgRoleId(yg) : '') || (khRoles()[0] || {}).id;
  const step = Number(o.step) || 0;
  ldraft = {
    kind: 'khwiz', id: 'x', isNew: true, step, first: step, edit: o.edit || '', roleId, status: yg ? yg.status : 'open', proj: o.proj || '',
    projSel: o.proj || (yg ? (khProjOfGoal(yg) || {}).id || '' : ''),
    sciSel: o.sci || (yg ? (sciOfGoal(yg) || {}).id || '' : ''),
    bookSel: o.book || (yg ? (bookOfGoal(yg) || {}).id || '' : ''),
    hzSel: o.hz || (yg ? (hpOfGoal(yg) || {}).id || '' : ''),
    yearId: yg ? yg.id : '', monthId: mg ? mg.id : '', weekId: wg ? wg.id : '',
    vision: yg ? yg.parent : o.vision || (khVisions(roleId)[0] || {}).id || '', vText: '',
    yText: yg ? yg.text : o.yText || '', why: yg ? yg.why : '', laws: { ...(yg ? yg.laws : {}) }, yk: (yg && yg.period) || o.yk || khYearOpts()[0][0],
    moMode: mg && mg.moN ? 'count' : 'pick', months: mg ? [...mg.months] : [], moN: (mg && mg.moN) || 3, mText: mg ? mg.text : '',
    wkMode: wg && wg.wkN ? 'count' : 'pick', wk: wg ? [...wg.wk] : [], wkN: (wg && wg.wkN) || 2, wText: wg ? wg.text : '',
    // the days: recurring on days chosen, or (a task for one week of its goal) once on a day of that week
    once: !!o.once, k: o.k || weekStartOf(today()), day: o.day || (o.k && o.k > today() ? o.k : today()), days: [parse(today()).getDay()], dMode: 'fixed', per: 3, dText: o.text || '', cards: [], openTm: -1,
  };
  if (et) {
    ldraft.taskId = et.id;
    if (!o.day) ldraft.day = '';
    khWizCards();
    const c = ldraft.cards[0];
    if (c) Object.assign(c, { own: true, imp: et.priority === 'high', tm: et.time ? 'clock' : et.prayer ? et.prayer.name : '', time: et.time || c.time, area: et.area || c.area },
      isRepeat(et) ? { mode: et.repeat.per ? 'count' : 'fixed', per: et.repeat.per || 3, days: [...et.repeat.days] } : {});
  } else khWizCards();
  khWizDraw();
  showLib();
}
const khWizSpan = () => khKeySpan(ldraft.yk) || [khYrStart(today()), khYrNext(khYrStart(today()))];
const khMoOpen = (m) => khMoNext(m) > khMoStart(today()); // a month not yet gone
const khWizBar = (i) => `<div class="kh-steps">${KH_WSTEPS.map(([k, l], j) => `<span class="lv-${k}${j < i ? ' done' : j === i ? ' cur' : ''}"><i>${j < i ? '✓' : j + 1}</i>${l}</span>`).join('')}</div>`;
const khWBtn = (op, v, label, on) => `<button type="button" data-action="kh-w" data-op="${op}" data-v="${v}" aria-pressed="${!!on}">${label}</button>`;
// the cards of the days' answer: each line a task; a card keeps its own settings while its line stays
function khWizCards() {
  const w = ldraft, ls = w.dText.split('\n').map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)-])\s*/, '').trim()).filter(Boolean), prev = w.cards, used = new Set();
  if (w.edit === 'day' && !ls.length) return; // (the task edited, its title cleared to be rewritten: its card waits)
  w.cards = ls.map((text, i) => {
    let j = prev.findIndex((c, n) => !used.has(n) && c.text === text);
    if (j < 0 && prev[i] && !used.has(i) && !ls.includes(prev[i].text)) j = i; // a line edited in its place
    if (j < 0 && w.edit === 'day' && i === 0 && prev[0] && !used.has(0)) j = 0; // (the task edited: its title rewritten, its card kept)
    if (j >= 0) used.add(j);
    const c = j >= 0 ? prev[j] : { mode: w.dMode, per: w.per, days: [...w.days], tm: '', time: '07:00', area: w.roleId === KH_SAW ? 'health' : '', own: false };
    if (!c.own) { c.days = [...w.days]; c.mode = w.dMode; c.per = w.per; }
    return { ...c, text };
  });
}
const khDots = (op, on, extra = '') => `<div class="kh-dots">${DAY_ORDER.map((d) => `<button type="button" class="kh-dot${on.includes(d) ? ' on' : ''}" data-action="kh-w" data-op="${op}" data-v="${d}"${extra} aria-pressed="${on.includes(d)}" aria-label="${esc(AR_DAYS[d])}">${KH_WD[d]}</button>`).join('')}</div>`;
const KH_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
function khWizCardsHTML() {
  const w = ldraft;
  if (!w.cards.length) return '';
  return `<div class="kh-ask lv-day"><span class="kh-al">${w.once ? 'مهامّك من هذا الجواب' : 'مهامّك من هذا الجواب: لكل مهمة أيامها ووقتها'}</span>${w.cards.map((c, i) => `<div class="kh-card"><b><span>${i + 1}</span>${esc(c.text)}</b>
      ${w.once ? '' : `<div class="seg" role="group"><button type="button" data-action="kh-w" data-op="cmode" data-i="${i}" data-v="fixed" aria-pressed="${c.mode !== 'count'}">أيام محددة</button><button type="button" data-action="kh-w" data-op="cmode" data-i="${i}" data-v="count" aria-pressed="${c.mode === 'count'}">عدد أيام أيّها كان</button></div>
      ${c.mode === 'count' ? `<div class="seg kh-nseg" role="group" aria-label="كم مرة في الأسبوع؟">${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" data-action="kh-w" data-op="cper" data-i="${i}" data-v="${n}" aria-pressed="${c.per === n}">${n}</button>`).join('')}</div>` : khDots('cday', c.days, ` data-i="${i}"`)}`}
      <div class="kh-card-row"><select data-kh-ctm="${i}" aria-label="وقتها"><option value="">بلا وقت</option><option value="clock"${c.tm === 'clock' ? ' selected' : ''}>في ساعة محددة</option>${KH_PRAYERS.map((p) => `<option value="${p}"${c.tm === p ? ' selected' : ''}>مع ${Prayer.NAMES[p]}</option>`).join('')}</select>
        ${c.tm === 'clock' ? `<input type="time" data-kh-ctime="${i}" value="${esc(c.time)}" aria-label="الساعة" data-novoice>` : ''}
        ${w.roleId === KH_SAW ? `<select data-kh-carea="${i}" aria-label="جانبها">${khAreaOptions(c.area)}</select>` : ''}
        <button type="button" class="kh-imp" data-action="kh-w" data-op="cimp" data-i="${i}" aria-pressed="${!!c.imp}">${c.imp ? '★ أهمية قصوى' : '☆ قصوى'}</button></div></div>`).join('')}</div>${w.once ? '' : khWizShares()}`;
}
// how many times a week, a month and to the end of the year the tasks come to
function khWizShares() {
  const w = ldraft, per = w.cards.reduce((n, c) => n + (c.mode === 'count' ? c.per : c.days.length), 0);
  if (!per) return '';
  const wkN = w.wkMode === 'count' ? w.wkN : 0, wk = w.wkMode === 'pick' ? w.wk : [];
  const ms = khSpanMonths(khWizSpan()).filter(khMoOpen).filter((m) => (w.moMode === 'pick' ? khInRanges(w.months, m, khMoNext(m)) : true));
  // (this week: only its days still to come; a week with none is not counted)
  const inWeek = (k) => (k > weekStartOf(today()) ? per : w.cards.reduce((n, c) => { const ds = khDays(k).filter((d) => d >= today()); return n + (c.mode === 'count' ? Math.min(c.per, ds.length) : ds.filter((d) => c.days.includes(parse(d).getDay())).length); }, 0));
  const inMonth = (m) => { const ns = khWeeksOf(m).filter((k) => k >= weekStartOf(today()) && (!wk.length || wk.includes(khWkOrd(k)))).map(inWeek).filter((n) => n > 0).sort((a, b) => b - a); return (wkN ? ns.slice(0, wkN) : ns).reduce((a, b) => a + b, 0); };
  const full = ms.filter((m) => m > khMoStart(today())).map(inMonth).filter((n) => n > 0), sm = full.length ? full : ms.map(inMonth).filter((n) => n > 0);
  const lo = sm.length ? Math.min(...sm) : 0, hi = sm.length ? Math.max(...sm) : 0;
  let year = ms.reduce((n, m) => n + inMonth(m), 0);
  if (w.moMode === 'count') year = Math.min(year, [...ms.map(inMonth)].sort((a, b) => b - a).slice(0, w.moN).reduce((a, b) => a + b, 0));
  return `<div class="kh-shares"><span class="lv-day"><b>${per}</b>في الأسبوع</span><span class="lv-month"><b>${lo === hi ? hi : `${lo} أو ${hi}`}</b>في الشهر</span><span class="lv-year"><b>${year}</b>حتى آخر السنة</span></div>${lo !== hi ? '<p class="note-text explain">أكثر الأشهر أربعة أسابيع، وبعضها خمسة: فالأسبوع يُحسب للشهر الذي يبدأ فيه.</p>' : ''}`;
}
function khWizDraw() { return khIn((ldraft.yk || '')[0], khWizDraw0); }
function khWizDraw0() {
  const w = ldraft, edit = w.edit;
  const btns = (next) => (edit
    ? `<div class="sheet-actions"><button type="submit" class="primary">احفظ</button><button type="button" class="danger" data-action="kh-w" data-op="del">حذف</button></div>${edit === 'day' ? '' : `<p class="note-text">${esc(kgDropNote(kgOf(edit === 'year' ? w.yearId : edit === 'month' ? w.monthId : w.weekId)))}</p>`}`
    : `<div class="sheet-actions"><button type="submit" class="primary">${next}</button>${w.step > w.first ? '<button type="button" class="ghost" data-action="kh-w" data-op="prev">السابق</button>' : ''}${w.step < 3 ? '<button type="button" class="ghost" data-action="kh-w" data-op="later">أكمل لاحقاً</button>' : ''}</div>`);
  const role = esc(khRoleName(w.roleId));
  let body = '';
  if (edit === 'year') {
    // a year goal edited in its own step (v115): its question and answer, its laws and meaning, as it was written; and what
    // its editor had: its role, the vision it serves, its year (until it is tied to months), its state, and «حذف»
    // its year can be changed though it has months, to any year offered in either calendar; its months go with it (v118)
    const yg = kgOf(w.yearId);
    const ups = S.kgoals.filter((v) => v.level === 'life' && v.roleId === w.roleId && (v.status === 'open' || v.id === w.vision));
    body = `<h3 class="kh-wh">هدف السنة</h3>
      <label class="field"><span>الدور</span><select id="khwRole">${khRoles().map((r) => `<option value="${r.id}"${r.id === w.roleId ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}${khRole(w.roleId) ? '' : '<option value="" selected>بلا دور</option>'}</select></label>
      ${khProjField(w)}
      ${khSciField(w)}
      ${khBookField(w)}
      ${khHzField(w)}
      <label class="field"><span>يخدم أيّ رؤية؟</span><select id="khwVis"><option value="">بلا ربط</option>${ups.map((v) => `<option value="${v.id}"${v.id === w.vision ? ' selected' : ''}>${esc(v.text)}</option>`).join('')}</select></label>
      <p class="kh-qt lv-year">هذه السنة، ما الذي تراه يقرّبك من رؤيتك؟</p>
      <div class="seg kh-yrs" role="group" aria-label="أيّ سنة؟">${khYearChoices(yg ? yg.period : w.yk).map(([k, l]) => khWBtn('yk', k, esc(l), k === w.yk)).join('')}</div>
      ${khMoveNote(yg, w.yk)}
      <label class="field kh-q lv-year"><span>اكتب جوابك</span><textarea id="khwY" rows="2">${esc(w.yText)}</textarea></label>
      ${khLawsHTML(w.laws)}
      <label class="field"><span>لماذا تريده؟ (المعنى، اختياري)</span><textarea id="khwWhy" rows="2">${esc(w.why)}</textarea></label>
      <div class="field"><span>حاله</span><div class="seg" role="group" aria-label="حاله">${Object.entries(KH_GSTAT).map(([k, l]) => khWBtn('gst', k, l, w.status === k)).join('')}</div></div>
      ${khExtBtn(yg)}
      ${btns()}`;
  } else if (w.step === 0) {
    const vs = khVisions(w.roleId), yg = kgOf(w.yearId);
    const pr = w.projSel && w.projSel !== 'new' && getProject(w.projSel), sc = w.sciSel && getSci(w.sciSel), bk = w.bookSel && getBook(w.bookSel), hp = w.hzSel && getPlan(w.hzSel);
    body = `${khWizBar(0)}<h3 class="kh-wh">${pr ? `مشروع «${esc(pr.name)}»: هدف لسنتك` : sc ? `علم «${esc(sc.name)}»: هدف لسنتك` : bk ? `كتاب «${esc(bk.title)}»: هدف لسنتك` : hp ? `حفظ «${esc(hp.title)}»: هدف لسنتك` : `هدف لسنتك في «${role}»`}</h3>
      ${khProjField(w)}
      ${khSciField(w)}
      ${khBookField(w)}
      ${khHzField(w)}
      ${pr || sc || bk || hp ? `<label class="field"><span>الدور</span><select id="khwRole">${khRoles().map((r) => `<option value="${r.id}"${r.id === w.roleId ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>` : ''}
      ${vs.length === 1 ? khCtx('life', 'رؤيتك في هذا الدور', vs[0].text)
        : vs.length > 1 ? `<label class="field"><span>يخدم أيّ رؤية؟</span><select id="khwVis">${vs.map((v) => `<option value="${v.id}"${v.id === w.vision ? ' selected' : ''}>${esc(v.text)}</option>`).join('')}</select></label>`
        : `<label class="field kh-q lv-life"><span>ما رؤيتك في «${role}»؟ الصورة التي تريد أن تكون عليها في هذا الدور</span><textarea id="khwVt" rows="2">${esc(w.vText)}</textarea></label>`}
      <p class="kh-qt lv-year">هذه السنة، ما الذي تراه يقرّبك من رؤيتك؟</p>
      ${yg ? `<div class="seg kh-yrs" role="group" aria-label="أيّ سنة؟">${khYearChoices(yg.period).map(([k, l]) => khWBtn('yk', k, esc(l), k === w.yk)).join('')}</div>${khMoveNote(yg, w.yk)}` : `<div class="seg kh-yrs" role="group" aria-label="أيّ سنة؟">${khYearChoices(w.yk).map(([k, l]) => khWBtn('yk', k, esc(l), k === w.yk)).join('')}</div>`}
      <label class="field kh-q lv-year"><span>اكتب جوابك</span><textarea id="khwY" rows="2">${esc(w.yText)}</textarea></label>
      ${khLawsHTML(w.laws)}
      <label class="field"><span>لماذا تريده؟ (المعنى، اختياري)</span><textarea id="khwWhy" rows="2">${esc(w.why)}</textarea></label>
      ${khExtBtn(yg)}
      ${btns('التالي: الأشهر')}`;
  } else if (w.step === 1) {
    // (the months still to come, or the number already saved if it is more: an edit late in the year never lowers it)
    const ms = khSpanMonths(khWizSpan()), mg0 = kgOf(w.monthId), left = Math.max(1, ms.filter(khMoOpen).length, (mg0 && mg0.moN) || 0);
    w.moN = Math.min(w.moN, left);
    body = `${edit ? '<h3 class="kh-wh">هدف الشهر</h3>' : `${khWizBar(1)}<h3 class="kh-wh">اربطه بأشهرك</h3>`}
      ${w.yText ? khCtx('year', 'هدف السنة', w.yText) : ''}
      <p class="kh-qt lv-month">كيف تريد أن يرتبط هدف السنة بالأشهر التي تختارها؟</p>
      <div class="kh-ask lv-month"><span class="kh-al">في أيّ الأشهر؟</span>
        <div class="seg" role="group">${khWBtn('momode', 'pick', 'أشهر محددة', w.moMode === 'pick')}${khWBtn('momode', 'count', 'عدد أشهر أيّها كان', w.moMode === 'count')}</div>
        ${w.moMode === 'pick' ? `<div class="kh-chips">${ms.map((m) => `<button type="button" class="chip" data-action="kh-w" data-op="mo" data-v="${khMoRange(m)}" aria-pressed="${w.months.some((r) => khMoStart(khMid(r)) === m)}"${khMoOpen(m) ? '' : ' disabled'}>${esc(khMoShort(m))}</button>`).join('')}</div>
          <button type="button" class="ghost sm" data-action="kh-w" data-op="allmo">كل الأشهر الباقية</button><p class="note-text explain">ما مضى من أشهر السنة لا يُختار.</p>`
        : `<span class="kh-al">كم شهراً من السنة؟</span><div class="seg kh-nseg" role="group">${Array.from({ length: left }, (_, i) => khWBtn('mon', i + 1, i + 1, w.moN === i + 1)).join('')}</div><p class="note-text explain">يظهر لك كل شهر حتى يكتمل عددها، ثم يختفي بقية السنة.</p>`}</div>
      <label class="field kh-q lv-month"><span>اكتب جوابك</span><textarea id="khwM" rows="3">${esc(w.mText)}</textarea></label>
      ${btns('التالي: الأسابيع')}`;
  } else if (w.step === 2) {
    body = `${edit ? '<h3 class="kh-wh">هدف الأسبوع</h3>' : `${khWizBar(2)}<h3 class="kh-wh">ثم أسابيعك</h3>`}
      ${w.mText ? khCtx('month', 'هدف الشهر', w.mText) : ''}
      <p class="kh-qt lv-week">كيف تريد أن يتحقق هذا الهدف من خلال أسابيعك المختارة؟</p>
      <div class="kh-ask lv-week"><span class="kh-al">في أيّ أسابيع هذه الأشهر؟</span>
        <div class="seg" role="group">${khWBtn('wkmode', 'pick', 'أسابيع محددة', w.wkMode === 'pick')}${khWBtn('wkmode', 'count', 'عدد أسابيع أيّها كان', w.wkMode === 'count')}</div>
        ${w.wkMode === 'pick' ? `<div class="kh-chips">${khWBtn('wk', 0, 'كل الأسابيع', !w.wk.length).replace('<button', '<button class="chip"')}${KH_ORD.map((n, i) => khWBtn('wk', i + 1, n, w.wk.includes(i + 1)).replace('<button', '<button class="chip"')).join('')}</div>
          <p class="note-text explain">كل الأسابيع، أو أسابيع بعينها من كل شهر (والخامس في الأشهر التي فيها خمسة أسابيع).</p>`
        : `<span class="kh-al">كم أسبوعاً في الشهر؟</span><div class="seg kh-nseg" role="group">${[1, 2, 3, 4].map((n) => khWBtn('wkn', n, n, w.wkN === n)).join('')}</div><p class="note-text explain">يظهر لك كل أسبوع حتى يكتمل عددها، ثم يختفي بقية الشهر.</p>`}</div>
      <label class="field kh-q lv-week"><span>اكتب جوابك</span><textarea id="khwW" rows="2">${esc(w.wText)}</textarea></label>
      ${btns('التالي: الأيام')}`;
  } else {
    const wg = kgOf(w.weekId), days = khDays(w.k).filter((d) => d >= today());
    body = `${edit === 'day' ? '<h3 class="kh-wh">يومها ووقتها</h3>' : w.first === 3 ? '<h3 class="kh-wh">مهمة لهذا الهدف</h3>' : `${khWizBar(3)}<h3 class="kh-wh">ثم أيامك</h3>`}
      ${khCtx('week', wg ? `هدف الأسبوع: ${khWeeksText(wg)}` : 'هدف الأسبوع', w.wText)}
      ${w.first === 3 ? `<div class="seg" role="group">${khWBtn('once', '', 'تتكرر في أيامها', !w.once)}${khWBtn('once', '1', 'لمرة في هذا الأسبوع', w.once)}</div>` : ''}
      ${edit === 'day' ? '' : '<p class="kh-qt lv-day">كيف تريد أن يتحقق الهدف من خلال أيامك المختارة؟</p>'}
      ${w.once ? `<div class="kh-ask lv-day"><span class="kh-al">في أيّ يوم؟</span><div class="kh-chips">${days.map((d) => `<button type="button" class="chip" data-action="kh-w" data-op="oday" data-v="${d}" aria-pressed="${w.day === d}">${esc(dueLabel(d))}</button>`).join('')}<button type="button" class="chip" data-action="kh-w" data-op="oday" data-v="" aria-pressed="${!w.day}">أي يوم من أسبوعها</button></div>${w.day ? '' : '<p class="note-text explain">تظهر لك كل يوم من أسبوعها حتى تتمها.</p>'}</div>`
        : edit === 'day' ? '' : `<div class="kh-ask lv-day"><span class="kh-al">في أيّ أيام هذه الأسابيع؟</span>
          <div class="seg" role="group">${khWBtn('dmode', 'fixed', 'أيام محددة', w.dMode === 'fixed')}${khWBtn('dmode', 'count', 'عدد أيام أيّها كان', w.dMode === 'count')}</div>
          ${w.dMode === 'fixed' ? khDots('day', w.days) : `<span class="kh-al">كم مرة في الأسبوع؟</span><div class="seg kh-nseg" role="group">${[1, 2, 3, 4, 5, 6].map((n) => khWBtn('dper', n, n, w.per === n)).join('')}</div><p class="note-text explain">تظهر لك كل يوم حتى يكتمل عددها، ثم تختفي بقية الأسبوع، ويظهر هدف الأسبوع متحققاً.</p>`}</div>`}
      <label class="field kh-q lv-day"><span>${edit === 'day' ? 'العنوان' : 'اكتب جوابك: كل مهمة في سطر'}</span><textarea id="khwD" rows="3">${esc(w.dText)}</textarea></label>
      <div id="khwCards">${khWizCardsHTML()}</div>
      ${btns(w.first === 3 ? 'احفظ' : 'احفظ: من رؤيتي إلى أيامي')}`;
  }
  $('libForm').innerHTML = `${sheetHead(edit === 'day' ? 'تعديل المهمة' : edit ? 'تعديل الهدف' : 'من الرؤية إلى الأيام')}${body}`;
}
// what is written in the step on screen, into the draft
function khWizKeep() {
  const w = ldraft, v = (id) => ($(id) ? $(id).value : null);
  if (w.step === 0) {
    if (v('khwVis') !== null) w.vision = v('khwVis');
    if (v('khwVt') !== null) w.vText = v('khwVt');
    if (v('khwProj') !== null) w.projSel = v('khwProj');
    if (v('khwSci') !== null) w.sciSel = v('khwSci');
    if (v('khwBook') !== null) w.bookSel = v('khwBook');
    if (v('khwHz') !== null) w.hzSel = v('khwHz');
    w.yText = v('khwY') ?? w.yText; w.why = v('khwWhy') ?? w.why;
    document.querySelectorAll('#libForm [data-kh-law]').forEach((c) => { w.laws[c.dataset.khLaw] = c.checked; });
  }
  if (w.step === 1) w.mText = v('khwM') ?? w.mText;
  if (w.step === 2) w.wText = v('khwW') ?? w.wText;
  if (w.step === 3) { w.dText = v('khwD') ?? w.dText; khWizCards(); }
}
const khNeed = (id, msg) => { toast(msg); if ($(id)) $(id).focus(); return false; };
// the step on screen, saved; false if something is missing
function khWizCommit() { return khIn((ldraft.yk || '')[0], khWizCommit0); }
function khWizCommit0() {
  const w = ldraft;
  if (w.edit === 'year') {
    if (!w.yText.trim()) return khNeed('khwY', 'اكتب هدف سنتك أولاً.');
    const yg = kgOf(w.yearId);
    if (!yg) { toast('هذا الهدف لم يعد موجوداً.'); return false; }
    if (yg.status !== w.status) yg.closedAt = w.status === 'open' ? '' : today();
    Object.assign(yg, { roleId: w.roleId, text: w.yText.trim(), why: w.why.trim(), laws: { ...w.laws }, parent: w.vision || '', status: w.status });
    khMoveYear(yg, w.yk);
    khSetProj(yg, w.projSel, w.roleId);
    khSetSci(yg, w.sciSel);
    khSetBook(yg, w.bookSel);
    khSetHz(yg, w.hzSel);
    khFollowCal(yg.period);
    save();
    return true;
  }
  if (w.step === 0) {
    if (!w.yText.trim()) return khNeed('khwY', 'اكتب هدف سنتك أولاً.');
    let vid = w.vision || (khVisions(w.roleId)[0] || {}).id || ''; // (the role's one vision, shown without a choice)
    if (!khVisions(w.roleId).length) {
      if (!w.vText.trim()) return khNeed('khwVt', 'اكتب رؤيتك في هذا الدور أولاً.');
      const vg = normalizeKGoal({ level: 'life', roleId: w.roleId, text: w.vText.trim() });
      S.kgoals.push(vg); vid = w.vision = vg.id; w.vText = '';
    }
    const v = { roleId: w.roleId, text: w.yText.trim(), why: w.why.trim(), laws: { ...w.laws }, parent: vid || '', period: w.yk };
    const yg = kgOf(w.yearId);
    if (yg) { const { period, ...rest } = v; Object.assign(yg, rest); khMoveYear(yg, period); const mg = kgOf(w.monthId); if (mg) w.months = [...mg.months]; } else { const g = normalizeKGoal({ level: 'year', ...v }); S.kgoals.push(g); w.yearId = g.id; } // (a moved goal's months step shows them where they went)
    // a project's own year goal (v126): the project takes its role
    khSetProj(kgOf(w.yearId), w.projSel, w.roleId);
    khSetSci(kgOf(w.yearId), w.sciSel); // (a science's year goal, v137)
    khSetBook(kgOf(w.yearId), w.bookSel); // (a book's, v140)
    khSetHz(kgOf(w.yearId), w.hzSel); // (a memorising plan's, v142)
    khFollowCal(w.yk);
  }
  if (w.step === 1) {
    if (w.moMode === 'pick' && !w.months.length) { toast('اختر شهراً واحداً على الأقل.'); return false; }
    if (!w.mText.trim()) return khNeed('khwM', 'اكتب جوابك: كيف يرتبط هدف السنة بأشهرك؟');
    const v = { parent: w.yearId, text: w.mText.trim(), months: w.moMode === 'pick' ? [...w.months] : [], moN: w.moMode === 'count' ? w.moN : 0 };
    const mg = kgOf(w.monthId);
    if (mg) { Object.assign(mg, v); khSyncStart(mg); } else { const g = normalizeKGoal({ level: 'month', from: weekStartOf(today()), ...v }); S.kgoals.push(g); w.monthId = g.id; }
  }
  if (w.step === 2) {
    if (w.wkMode === 'pick' && w.wk.length === 5) w.wk = [];
    if (!w.wText.trim()) return khNeed('khwW', 'اكتب جوابك: كيف يتحقق الهدف في أسابيعك؟');
    const v = { parent: w.monthId, text: w.wText.trim(), wk: w.wkMode === 'pick' ? [...w.wk] : [], wkN: w.wkMode === 'count' ? w.wkN : 0 };
    const wg = kgOf(w.weekId);
    if (wg) { Object.assign(wg, v); khSyncStart(wg); } else { const g = normalizeKGoal({ level: 'week', from: weekStartOf(today()), ...v }); S.kgoals.push(g); w.weekId = g.id; }
  }
  if (w.step === 3) {
    const wg = kgOf(w.weekId), mg = wg && kgOf(wg.parent);
    if (!w.cards.length) return khNeed('khwD', 'اكتب مهمة واحدة على الأقل، كل مهمة في سطر.');
    if (!wg || !mg) { toast('هدف الأسبوع لم يعد موجوداً.'); return false; }
    if (w.once && w.day && !khDays(w.k).includes(w.day)) { toast('اختر يوماً من أيام هذا الأسبوع.'); return false; }
    const bad = w.once ? -1 : w.cards.findIndex((c) => c.mode !== 'count' && !c.days.length);
    if (bad >= 0) { toast(`اختر أيام المهمة ${bad + 1}.`); return false; }
    const start = khChainStart(mg), until = khChainEnd(mg);
    if (!w.once && until && until < start) { toast('مضت أشهر هذا الهدف، فلا أيام بقيت لمهامه.'); return false; }
    // a task edited in its step (v144): its title, its days or day, and its time; what it holds stays (done days, notes…)
    if (w.edit === 'day') {
      const t = getTask(w.taskId), c = w.cards[0];
      if (!t) { toast('هذه المهمة لم تعد موجودة.'); return false; }
      if (w.cards.length > 1) return khNeed('khwD', 'اكتب مهمة واحدة: هذه المهمة وحدها.');
      const when = { time: c.tm === 'clock' ? c.time : '', prayer: c.tm && c.tm !== 'clock' ? { name: c.tm, offset: 0 } : null };
      const keep = isRepeat(t) ? t.repeat : null, s0 = keep && keep.start < start ? keep.start : start;
      const u0 = keep && keep.until && (!until || keep.until < until) ? keep.until : until; // (one that ended stays ended)
      const rep = c.mode === 'count' ? { days: [...DAY_ORDER].sort(), start: s0, until: u0, per: c.per } : { days: [...c.days].sort(), start: s0, until: u0 };
      // what «فاتك يومها» moved or cancelled stays, while its days are the same
      if (keep && String(keep.days) === String(rep.days) && (keep.per || 0) === (rep.per || 0)) for (const k of ['mv', 'skip']) if (keep[k]) rep[k] = keep[k];
      const due = w.day || addDays(w.k, 6), was = isRepeat(t);
      Object.assign(t, { title: c.text, area: c.area, priority: c.imp ? 'high' : t.priority === 'high' ? 'mid' : t.priority, ...when }, w.once
        ? { kind: 'task', due, from: w.day ? '' : w.k, repeat: null, skip: !was && t.due === due ? t.skip : {} }
        : { kind: 'goal', due: '', from: '', repeat: rep });
      if (was !== isRepeat(t)) { t.done = false; t.doneAt = null; } // (once ↔ recurring: it starts undone)
      if (!hasTime(t)) t.alarms = [];
      save();
      return true;
    }
    for (const c of w.cards) {
      const when = { time: c.tm === 'clock' ? c.time : '', prayer: c.tm && c.tm !== 'clock' ? { name: c.tm, offset: 0 } : null };
      // once: on a day of the week, or on any day of it (shown from its first day until its last)
      const rep = c.mode === 'count' ? { days: [...DAY_ORDER].sort(), start, until, per: c.per } : { days: [...c.days].sort(), start, until };
      S.tasks.push(normalize(w.once
        ? { kind: 'task', title: c.text, due: w.day || addDays(w.k, 6), from: w.day ? '' : w.k, kgoal: wg.id, roleId: kgRoleId(wg), area: c.area, priority: c.imp ? 'high' : 'mid', ...when }
        : { kind: 'goal', title: c.text, repeat: rep, kgoal: wg.id, roleId: kgRoleId(wg), area: c.area, priority: c.imp ? 'high' : 'mid', ...when }));
    }
  }
  save();
  return true;
}
// «التالي» (the form's submit): the step saved, then the next one; the last one closes
function khWizNext() {
  khWizKeep();
  if (!khWizCommit()) return false;
  const w = ldraft;
  if (w.edit || w.step === 3) { toast(w.edit === 'day' ? 'حُفظت المهمة' : w.edit ? 'حُفظ الهدف' : w.first === 3 ? (w.cards.length > 1 ? 'أُضيفت المهام' : 'أُضيفت المهمة') : 'حُفظ: من رؤيتك إلى أيامك'); return true; }
  w.step++;
  khWizDraw();
  $('libForm').scrollTop = 0;
  render();
  return false;
}

// ---------- a task from the plan: under the week goal it serves ----------
function khPlanPick(k, day) {
  const cy = khYrStart(today()), m = khMoStart(k);
  const sec = (r) => {
    const wgs = S.kgoals.filter((g) => g.level === 'week' && kgRoleId(g) === r.id && wgActive(g, k));
    // what is not yet complete in its plan: a year goal with no months, a month goal with no weeks
    const ygs = S.kgoals.filter((g) => g.level === 'year' && kgRoleId(g) === r.id && g.status === 'open' && khYrOfKey(g.period) === cy && !kgKids(g, 'month').length);
    const mgs = S.kgoals.filter((g) => g.level === 'month' && kgRoleId(g) === r.id && mgActive(g, m) && !kgKids(g, 'week').length);
    return `<div class="kh-role" style="--rc:${khColor(r.id)}"><div class="kh-role-head"><b>${esc(r.name)}</b></div>
      ${wgs.map((g) => `<button type="button" class="kh-node lv-week kh-leaf" data-action="kh-wiz" data-step="3" data-week="${g.id}" data-once="1" data-k="${k}" data-day="${day || ''}"><small>هدف الأسبوع</small><b>${esc(g.text)}</b>${kgOf(g.parent) ? `<small>يخدم: ${esc(kgOf(g.parent).text)}</small>` : ''}</button>`).join('') || '<p class="note-text">لا هدف لهذا الدور في هذا الأسبوع بعد.</p>'}
      ${ygs.map((g) => khCont('month', `أكمل «${esc(g.text)}»: ثم أشهرك`, ` data-step="1" data-year="${g.id}"`)).join('')}
      ${mgs.map((g) => khCont('week', `أكمل «${esc(g.text)}»: ثم أسابيعك`, ` data-step="2" data-month="${g.id}"`)).join('')}
      ${khCont('year', 'هدف جديد من رؤيتي', ` data-step="0" data-role="${r.id}"`)}</div>`;
  };
  ldraft = { kind: 'khpick', id: 'x', isNew: false };
  $('libForm').innerHTML = `${sheetHead(day ? 'مهمة لليوم من خطتك' : 'مهمة للأسبوع من خطتك')}
    <p class="note-text explain">اختر هدف الأسبوع الذي تخدمه المهمة فتصير تحته. وإن لم يكن للدور هدف بعدُ فأكمل خطته، أو ابدأ من رؤيتك.</p>
    ${khRoles().map(sec).join('')}`;
  showLib();
}

// the week goal in «أسبوعي»: its share of its days, its tick, and its tasks under it
function khWeekNode(g, k, rows) {
  const x = wgShare(g, k), full = x.target > 0 && x.done >= x.target, act = wgActive(g, k);
  return `<div class="kh-node lv-week">
    <button type="button" class="kh-nh" data-action="kh-edit-wg" data-v="${g.id}"><small>هدف الأسبوع${khStat(g)}</small><b>${esc(g.text)}</b></button>${g.wkN && !g.wk.length ? khWhyBtn(`يظهر كل أسبوع لأنك لم تحدد أسابيعه: يتحقق في ${KH_UNIT.week(g.wkN)} من الشهر أيًّا كانت، فإذا تحقق عددها لم يظهر بقية الشهر.`) : ''}
    ${act ? khProg(x, 'times', 'هذا الأسبوع') : g.wkN ? `<small class="kh-serve">تحقّق في ${KH_UNIT.week(g.wkN)} هذا الشهر، فلا شيء له في بقيته</small>` : ''}
    ${act && g.status === 'open' && full ? khDoneBadge('تحقّق هذا الأسبوع') : ''}
    ${rows.length ? `<div class="kh-rows">${rows.join('')}</div>` : ''}
    ${act && g.status === 'open' && addDays(k, 6) >= today() ? khCont('day', 'مهمة لهذا الهدف', ` data-step="3" data-week="${g.id}" data-once="1" data-k="${k}"`) : ''}
  </div>`;
}
// a month goal from the plan: from a year goal it serves, or a new one from the vision
function khMonthPick(roleId, mo) {
  const cy = khYrStart(mo || today()), ygs = S.kgoals.filter((g) => g.level === 'year' && kgRoleId(g) === roleId && g.status === 'open' && khYrOfKey(g.period) === cy);
  if (!ygs.length) { khWizard({ step: 0, roleId, yk: khYrKey(cy) }); return; }
  ldraft = { kind: 'khpick', id: 'x', isNew: false };
  $('libForm').innerHTML = `${sheetHead('هدف للشهر من خطتك')}
    <p class="note-text explain">هدف الشهر خطوة من هدف سنتك: اختر هدف السنة الذي يخدمه، ثم أشهره.</p>
    ${ygs.map((g) => `<button type="button" class="kh-node lv-year kh-leaf" data-action="kh-wiz" data-step="1" data-year="${g.id}"><small>هدف السنة</small><b>${esc(g.text)}</b></button>`).join('')}
    ${khCont('year', 'هدف جديد من رؤيتي', ` data-step="0" data-role="${roleId}"`)}`;
  showLib();
}

// ---------- إحصائياتي (v99) ----------
// a week, a month or a year (in the calendar chosen), or years from–to; counted from what is ticked
const KH_STMODES = [['week', 'الأسبوع'], ['month', 'الشهر'], ['year', 'السنة'], ['range', 'سنوات']];
function khYearsList() {
  const ds = [...S.tasks.map((t) => (t.created ? iso(new Date(t.created)) : '')), ...S.weeks.map((w) => w.id)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= '2000-01-01').sort();
  const first = khYrStart(ds[0] && ds[0] < today() ? ds[0] : today()), out = [];
  for (let y = khYrStart(today()), i = 0; i < 30 && (out.length < 5 || y >= first); i++, y = khYrPrev(y)) out.unshift(y);
  return out;
}
function khStatRange(st) {
  if (st.mode === 'month') { const m = khMoStart(st.m || today()); return { from: m, to: khMoNext(m), title: 'إحصائية الشهر', label: khMoLabel(m), prev: khMoPrev(m), next: khMoNext(m), key: 'm' }; }
  if (st.mode === 'year') { const y = khYrStart(st.y || today()); return { from: y, to: khYrNext(y), title: 'إحصائية السنة', label: khYrLabel(y), prev: khYrPrev(y), next: khYrNext(y), key: 'y' }; }
  if (st.mode === 'range') {
    const ys = khYearsList(), n = (d) => (d ? khYrStart(d) : ''), y2 = ys.includes(n(st.y2)) ? n(st.y2) : ys[ys.length - 1];
    const y1 = ys.includes(n(st.y1)) && n(st.y1) <= y2 ? n(st.y1) : ys[Math.max(0, ys.indexOf(y2) - 2)];
    return { from: y1, to: khYrNext(y2), title: 'إحصائية السنوات', label: y1 === y2 ? khYrLabel(y1) : `من ${khYrLabel(y1)} إلى ${khYrLabel(y2)}`, y1, y2, ys };
  }
  const k = st.k ? weekStartOf(st.k) : khWeekOf(today());
  return { from: k, to: addDays(k, 7), title: 'إحصائية الأسبوع', label: `${khDayLabel(k)} – ${khDayLabel(addDays(k, 6))}`, prev: addDays(k, -7), next: addDays(k, 7), key: 'k' };
}
function khStatsOf(from, to) {
  // a week still to come is not counted (as in «شهري»)
  const now = khWeekOf(today()), ws = khWeekStarts(from, to).filter((k) => k <= now && khWeekItems(k).length);
  const pcts = ws.map(khShownPct).filter((x) => x !== null);
  // a recurring goal (or habit): its days in the weeks begun, and those done (a day done though not its day counts too)
  const rec = S.tasks.filter(isRepeat).map((t) => {
    let target = 0, done = 0;
    for (let d = from < t.repeat.start ? t.repeat.start : from; d < to && weekStartOf(d) <= now && !(t.repeat.until && d > t.repeat.until); d = addDays(d, 1)) {
      if (reqOn(t, d)) { target++; if (t.completions[d]) done++; } else if (t.completions[d]) { target++; done++; }
    }
    return { t, target, done };
  }).filter((x) => x.target);
  return { pcts, avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null, good: pcts.filter((p) => p >= KH_RATE).length,
    done: khDoneIn(from, to), life: khLifeRec(from, to).length,
    byRole: [...khRoles(), null].map((r) => ({ r, n: khDoneIn(from, to, r ? r.id : '') })).filter((x) => x.r || x.n),
    saw: Object.keys(KH_AREAS).map((a) => ({ a, n: khDoneIn(from, to, KH_SAW, a) })), rec };
}
// the bars: the week's days, the month's weeks, the year's months, or the years
function khStatSeries(st, R) {
  const out = [];
  if (st.mode === 'month') return khWeekStarts(R.from, R.to).map((k) => ({ l: `الأسبوع ${KH_ORD[khWkOrd(k) - 1] || ''}`, v: khDoneIn(k, addDays(k, 7)) }));
  if (st.mode === 'year') { for (let m = R.from; m < R.to; m = khMoNext(m)) out.push({ l: khMoShort(m), v: khDoneIn(m, khMoNext(m)) }); return out; }
  if (st.mode === 'range') { for (let y = R.from; y < R.to; y = khYrNext(y)) out.push({ l: khYrLabel(y), v: khDoneIn(y, khYrNext(y)) }); return out; }
  return khDays(R.from).map((d) => ({ l: AR_DAYS[parse(d).getDay()], v: khDoneIn(d, addDays(d, 1)) }));
}
function khStatsHTML() {
  const st = khUi.st, R = khStatRange(st), X = khStatsOf(R.from, R.to), ser = khStatSeries(st, R);
  const row = (label, n, max, val, color) => `<div class="kh-mo kh-srow"><span>${label}</span><span class="kh-track sm"><i style="width:${max ? Math.round((n / max) * 100) : 0}%${color ? `;background:${color}` : ''}"></i></span><small>${val}</small></div>`;
  const top = (xs) => Math.max(1, ...xs);
  return `<section class="section">
    <div class="section-head"><h2>إحصائياتي</h2></div>
    <p class="note-text explain">تُحسب وحدها مما تشطبه في «اليوم» و«يومي» و«أسبوعي»؛ فكلما شطبت أولاً بأول صدقت أرقامك.</p>
    <div class="seg" role="group" aria-label="المدة">${KH_STMODES.map(([v, l]) => `<button type="button" data-action="kh-stmode" data-v="${v}" aria-pressed="${st.mode === v}">${l}</button>`).join('')}</div>
    ${st.mode === 'range' ? `<div class="kh-yrange"><label class="field"><span>من</span><select data-kh-st="y1">${R.ys.map((y) => `<option value="${y}"${y === R.y1 ? ' selected' : ''}>${esc(khYrLabel(y))}</option>`).join('')}</select></label>
        <label class="field"><span>إلى</span><select data-kh-st="y2">${R.ys.map((y) => `<option value="${y}"${y === R.y2 ? ' selected' : ''}>${esc(khYrLabel(y))}</option>`).join('')}</select></label></div>`
      : khPeriodNav(R.title, R.label, R.prev, R.next, 'kh-stgo', '')}
    ${khPdfBtn('stats')}
    <div class="panel kh-stats"><div class="kh-nums kh-n4"><span><b>${khN(X.done)}</b>${X.done === 1 ? 'إنجاز' : 'إنجازات'}</span><span><b>${X.avg === null ? '—' : `${X.avg}٪`}</b>متوسط الأسابيع</span><span><b>${X.pcts.length ? `${khN(X.good)} من ${X.pcts.length}` : '—'}</b>أسابيع بلغت ٧٠٪</span><span><b>${khN(X.life)}</b>في حياتي</span></div></div>
    <div class="panel kh-block"><h3>الإنجازات في ${st.mode === 'week' ? 'أيام الأسبوع' : st.mode === 'month' ? 'أسابيع الشهر' : st.mode === 'year' ? 'شهور السنة' : 'السنوات'}</h3>
      <div class="kh-months">${ser.map((x) => row(esc(x.l), x.v, top(ser.map((y) => y.v)), khN(x.v), 'var(--lv-month)')).join('')}</div></div>
    <div class="panel kh-block"><h3>الإنجاز في كل دور</h3>
      <div class="kh-months">${X.byRole.map((x) => row(`<span class="kh-tag" style="--rc:${khColor(x.r ? x.r.id : '')}">${esc(x.r ? x.r.name : 'بلا دور')}</span>`, x.n, top(X.byRole.map((y) => y.n)), khN(x.n), khColor(x.r ? x.r.id : ''))).join('')}</div></div>
    <div class="panel kh-block"><h3>شحذ المنشار</h3>
      <div class="kh-months">${X.saw.map((x) => row(KH_AREAS[x.a], x.n, top(X.saw.map((y) => y.n)), khN(x.n), 'var(--lv-life)')).join('')}</div></div>
    ${X.rec.length ? `<div class="panel kh-block"><h3>الالتزام بالأهداف المتكررة</h3>
      <div class="kh-months">${X.rec.map((x) => row(esc(x.t.title), x.done, x.target, `${khN(x.done)} من ${x.target}`)).join('')}</div></div>` : ''}
  </section>`;
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="kh-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'kh-role-f': khUi.role = v; render(); break;
    case 'kh-tab': khUi.tab = v; if (el.dataset.yr !== undefined) khUi.yr = el.dataset.yr; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-wk': khUi.wk = addDays(khUi.wk || khWeekOf(today()), Number(v)); render(); break;
    case 'kh-wk-now': khUi.wk = ''; render(); break;
    case 'kh-mo': khUi.mo = v && v !== khMoStart(today()) ? v : ''; render(); break;
    case 'kh-extend': case 'kh-goyear': {
      const g = kgOf(v), nx = g && (action === 'kh-extend' ? khExtend(g) : g);
      if (!nx) break;
      khFollowCal(nx.period); save();
      if (action === 'kh-extend') toast(`مُدّ إلى ${khKeyLabel(nx.period)}: عدّل فيه ما يلزم، ولا يتغير شيء في سنته الحالية.`);
      const y = khYrOfKey(nx.period); khUi.yr = y && y !== khYrStart(today()) ? y : ''; render(); window.scrollTo(0, 0); break;
    }
    case 'kh-yr': khUi.yr = v && v !== khYrStart(today()) ? v : ''; render(); break;
    case 'kh-goweek': khUi.wk = v === khWeekOf(today()) ? '' : v; khUi.tab = 'week'; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-gomonth': khUi.mo = v === khMoStart(today()) ? '' : v; khUi.tab = 'month'; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-mplan': khMonthPick(el.dataset.role, el.dataset.mo); break;
    case 'kh-stmode': khUi.st = { ...khUi.st, mode: v }; render(); break;
    case 'kh-stgo': { const R = khStatRange(khUi.st); if (v) khUi.st = { ...khUi.st, [R.key]: v }; render(); break; }
    case 'kh-plan-pick': khPlanPick(el.dataset.k, el.dataset.day); break;
    case 'kh-wiz': { const o = el.dataset; if (!bookSheetKeep()) break; khWizard({ step: o.step, roleId: o.role, yk: o.yk, vision: o.vision, yearId: o.year, monthId: o.month, weekId: o.week, once: !!o.once, k: o.k, day: o.day }); break; }
    case 'kh-book-link': { if (!bookSheetKeep()) break; const b = getBook(v), g = bookGoal(b); if (!b) break; if (g) khWizard({ step: 0, edit: 'year', yearId: g.id }); else khWizard({ step: 0, book: b.id, yText: `قراءة «${b.title}»` }); break; }
    case 'kh-chain-at': khChainGo(v); break;
    // its day and time: in its own days step (v144)
    case 'kh-chain-go': { const id = draft && draft.id; closeSheet(); if (id) khWizard({ task: id }); break; }
    case 'kh-day-edit': khWizard({ task: v }); break;
    case 'kh-hz-link': { closeLib(); const p = getPlan(v), g = hpGoal(p); if (!p) break; if (g) khWizard({ step: 0, edit: 'year', yearId: g.id }); else khWizard({ step: 0, hz: p.id, yText: `حفظ «${p.title}»` }); break; }
    case 'kh-sci-link': { const sc = getSci(v), g = sciGoal(sc); if (!sc) break; if (g) khWizard({ step: 0, edit: 'year', yearId: g.id }); else khWizard({ step: 0, sci: sc.id, yText: sc.name }); break; }
    case 'kh-proj-link': { const p = getProject(v), g = khProjGoal(p); if (!p) break; if (g) khWizard({ step: 0, edit: 'year', yearId: g.id }); else khWizard({ step: 0, proj: p.id, roleId: khRole(p.roleId) ? p.roleId : '', yText: p.name }); break; }
    case 'kh-task-link': khTaskLinkSheet(v); break;
    case 'kh-task-wg': { const t = getTask(v); if (!t) break; t.kgoal = el.dataset.w; save(); closeLib(); render(); toast('رُبطت بأسبوعها'); break; }
    case 'kh-edit-mg': khWizard({ step: 1, edit: 'month', monthId: v }); break;
    case 'kh-edit-wg': khWizard({ step: 2, edit: 'week', weekId: v }); break;
    case 'kh-edit-goal': if (kgOf(v) && kgOf(v).level === 'year') khWizard({ step: 0, edit: 'year', yearId: v }); else khGoalSheet(v); break; // (a year goal in its own step, as a month's and a week's, v115)
    case 'kh-new-vision': khGoalSheet(null, { level: 'life', roleId: el.dataset.role }); break;
    case 'kh-gst': if (ldraft && ldraft.kind === 'khgoal') { khGoalKeep(); ldraft.x.status = v; khGoalDraw(); } break;
    case 'kh-kg-del': {
      if (!ldraft || ldraft.kind !== 'khgoal' || !selArmed(el)) break;
      const g = kgOf(ldraft.x.id);
      if (g && g.level === 'life') { for (const y of kgKids(g, 'year')) y.parent = ''; S.kgoals = S.kgoals.filter((x) => x.id !== g.id); } else if (g) kgDrop(g);
      save(); closeLib(); render(); toast('حُذف');
      break;
    }
    case 'kh-w': {
      if (!ldraft || ldraft.kind !== 'khwiz') break;
      const w = ldraft, op = el.dataset.op;
      if (op === 'del' && w.edit === 'day') { if (!selArmed(el)) break; dropTask(w.taskId); save(); closeLib(); render(); toast('حُذفت المهمة'); break; }
      if (op === 'del') { if (!selArmed(el)) break; const g = kgOf(w.edit === 'year' ? w.yearId : w.edit === 'month' ? w.monthId : w.weekId); if (g) kgDrop(g); save(); closeLib(); render(); toast('حُذف'); break; }
      khWizKeep();
      if (op === 'later') {
        let vis = false;
        if (w.step === 0 && !w.yText.trim() && w.vText.trim() && !khVisions(w.roleId).length) { S.kgoals.push(normalizeKGoal({ level: 'life', roleId: w.roleId, text: w.vText.trim() })); save(); vis = true; }
        else if ([w.yText, w.mText, w.wText, w.dText][w.step].trim() && !khWizCommit()) break;
        closeLib();
        const yg = kgOf(w.yearId), gy = yg && khYrOfKey(yg.period);
        if (gy) { khUi.tab = 'year'; khUi.yr = gy === khYrStart(today()) ? '' : gy; window.scrollTo({ top: 0 }); }
        render();
        toast(gy ? 'حُفظ ما كتبته، وتكمل من «أكمل» تحت هدفك هنا' : vis ? 'حُفظت رؤيتك، وتكمل من «التالي» تحتها في «حياتي»' : 'لم تكتب شيئاً بعد');
        break;
      }
      if (op === 'ext') {
        if (!khWizCommit()) break;
        const yg = kgOf(w.yearId), had = yg && khNextOf(yg), nx = yg && khExtend(yg);
        if (!nx) break;
        if (!had) toast(`مُدّ إلى ${khKeyLabel(nx.period)}: عدّل فيه ما تريد، ولا يتغير شيء في سنته الحالية.`);
        const y = khYrOfKey(nx.period); khUi.tab = 'year'; khUi.yr = y && y !== khYrStart(today()) ? y : '';
        closeLib(); render(); khWizard({ step: 0, edit: 'year', yearId: nx.id });
        break;
      }
      if (op === 'prev') w.step = Math.max(w.first, w.step - 1);
      if (op === 'yk') w.yk = v;
      if (op === 'gst') w.status = v;
      if (op === 'momode') w.moMode = v;
      if (op === 'mon') w.moN = Number(v);
      if (op === 'mo') khIn((w.yk || '')[0], () => { const m = khMoStart(khMid(v)); w.months = w.months.some((r) => khMoStart(khMid(r)) === m) ? w.months.filter((r) => khMoStart(khMid(r)) !== m) : [...w.months, v]; });
      if (op === 'allmo') khIn((w.yk || '')[0], () => { w.months = [...w.months.filter((r) => !khMoOpen(khMoStart(khMid(r)))), ...khSpanMonths(khWizSpan()).filter(khMoOpen).map(khMoRange)]; });
      if (op === 'wkmode') w.wkMode = v;
      if (op === 'wkn') w.wkN = Number(v);
      if (op === 'wk') { const i = Number(v); w.wk = !i ? [] : w.wk.includes(i) ? w.wk.filter((x) => x !== i) : [...w.wk, i].sort(); }
      if (op === 'day') { const d = Number(v); w.days = w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d].sort(); khWizCards(); }
      if (op === 'cday') { const c = w.cards[Number(el.dataset.i)], d = Number(v); if (c) { c.days = c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort(); c.own = true; } }
      if (op === 'dmode') { w.dMode = v; if (v === 'fixed' && !w.days.length) w.days = [parse(today()).getDay()]; khWizCards(); }
      if (op === 'dper') { w.per = Number(v); khWizCards(); }
      if (op === 'cmode') { const c = w.cards[Number(el.dataset.i)]; if (c) { c.mode = v; c.own = true; if (v === 'fixed' && !c.days.length) c.days = [...w.days]; } }
      if (op === 'cper') { const c = w.cards[Number(el.dataset.i)]; if (c) { c.per = Number(v); c.own = true; } }
      if (op === 'cimp') { const c = w.cards[Number(el.dataset.i)]; if (c) c.imp = !c.imp; } // (its importance «قصوى», v146)
      if (op === 'once') w.once = !!v;
      if (op === 'oday') w.day = v;
      khWizDraw();
      if (op === 'prev') $('libForm').scrollTop = 0;
      break;
    }
    // «سجل حياتي»: what was done, kept as part of the user's life
    case 'kh-life': { const t = getTask(el.dataset.id); if (!t) break; t.life = !t.life; save(); render(); toast(t.life ? 'حُفظت في سجل حياتي' : 'أُزيلت من سجل حياتي'); break; }
    case 'kh-new': openSheet(null, { kind: 'task', due: el.dataset.due || undefined, roleId: el.dataset.role || '' }); break;
    case 'kh-new-goal': openSheet(null, { kind: 'goal', repeat: true, roleId: el.dataset.role || '' }); break;
    case 'kh-new-project': openProjectSheet(null, el.dataset.role || ''); break;
    case 'kh-to-today': { const t = getTask(el.dataset.id); if (!t) break; t.due = today(); t.from = ''; save(); render(); toast('صارت لليوم'); break; }
    case 'kh-imp': { const t = getTask(el.dataset.id); if (!t) break; t.priority = t.priority === 'high' ? 'mid' : 'high'; save(); render(); toast(t.priority === 'high' ? 'صارت أهميتها قصوى' : 'صارت أهميتها متوسطة'); break; }
    // three top priorities a day at most; one finished is taken off to give the place to another
    case 'kh-prio': {
      const t = getTask(el.dataset.id), d = today();
      if (!t) break;
      if (t.prio === d) { t.prio = ''; toast('أُزيلت «الأهم»'); } else {
        if (S.tasks.filter((x) => x.prio === d).length >= KH_PRIO_MAX) { toast('ثلاث مهام «الأهم» في اليوم على الأكثر. أزل «الأهم» عن مهمة أتممتها لتضعها هنا'); break; }
        t.prio = d; toast('صارت من «الأهم» اليوم');
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
      for (const g of S.kgoals) if (g.roleId === id) g.roleId = '';
      save(); closeLib(); render(); toast('حُذف الدور');
      break;
    }
    case 'kh-why': ldraft = { kind: 'khpick', id: 'x', isNew: false }; $('libForm').innerHTML = `${sheetHead('لماذا يظهر هنا؟')}<p class="note-text">${esc(el.dataset.t)}</p><div class="sheet-actions"><button type="button" class="primary" data-action="lib-close">فهمت</button></div>`; showLib(); break;
    // a goal of «any days»: a box is a time done (today, or the last day without a tick in a week gone by); a ticked box takes the last back
    case 'kh-box': {
      const t = getTask(el.dataset.id), k = el.dataset.k, i = Number(el.dataset.i);
      if (!t || !t.repeat || !t.repeat.per) break;
      const got = khDays(k).filter((x) => t.completions[x]);
      if (i < got.length) { toggle(t.id, got[got.length - 1]); break; }
      const free = khDays(k).filter((x) => !t.completions[x] && x <= today()), day = free.includes(today()) ? today() : free[free.length - 1];
      if (!day) { toast('لم يأتِ هذا الأسبوع بعد.'); break; }
      toggle(t.id, day);
      break;
    }
    case 'kh-tpl': if (khAddTpl(v)) { render(); toast('أُضيف القالب إلى خطتك: رؤيته وهدف سنته وأشهره وأسابيعه ومهام أيامه. عدّله كما تشاء'); } break;
    case 'kh-tpl-del': if (!selArmed(el)) break; khRemoveTpl(v); render(); toast('حُذف القالب'); break;
    case 'kh-rv-day': { const c = khUi.rv[el.dataset.id]; if (c) { c.day = v; render(); } break; }
    case 'kh-review': khUi.review = v; khUi.rv = {}; khUi.rvq = null; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-review-close': khUi.review = ''; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-rv-act': { const t = getTask(el.dataset.id); if (!t) break; const c = khUi.rv[t.id] = khUi.rv[t.id] || { act: 'move', text: t.title, wk: '', day: '' }; c.act = v; render(); break; }
    case 'kh-rv-save': {
      const k = v, r = khSaveReview(k);
      khUi.review = ''; khUi.rv = {}; khUi.rvq = null;
      // to the next week, as in the book: what was moved is waiting there
      khUi.wk = addDays(k, 7) === khWeekOf(today()) ? '' : addDays(k, 7);
      render(); window.scrollTo({ top: 0 });
      toast(r.moved ? `حُفظت المراجعة، ونُقلت ${plural(r.moved, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')}` : 'حُفظت المراجعة');
      break;
    }
  }
});
document.addEventListener('input', (e) => {
  // the days' answer: its cards follow its lines as they are written
  if (e.target.id === 'khwD' && ldraft && ldraft.kind === 'khwiz') { ldraft.dText = e.target.value; khWizCards(); $('khwCards').innerHTML = khWizCardsHTML(); return; }
  if (e.target.dataset && e.target.dataset.khCtime !== undefined && ldraft && ldraft.kind === 'khwiz') { const c = ldraft.cards[Number(e.target.dataset.khCtime)]; if (c) c.time = e.target.value; return; }
  const q = e.target.dataset && e.target.dataset.khQ;
  if (q && khUi.rvq) khUi.rvq[q] = e.target.value;
  const id = e.target.dataset && e.target.dataset.khRvtext;
  if (id && khUi.rv[id]) khUi.rv[id].text = e.target.value;
});
document.addEventListener('change', (e) => {
  const ds = e.target.dataset || {};
  // the review: the week chosen for a task (its day is chosen again)
  if (ds.khRvwk) { const c = khUi.rv[ds.khRvwk]; if (c) { c.wk = e.target.value; c.day = ''; render(); } return; }
  // «إحصائياتي»: years from–to
  if (ds.khSt) {
    khUi.st = { ...khUi.st, [ds.khSt]: e.target.value };
    if (khUi.st.y1 && khUi.st.y2 && khUi.st.y1 > khUi.st.y2) khUi.st[ds.khSt === 'y1' ? 'y2' : 'y1'] = e.target.value;
    render();
    return;
  }
  if (e.target.id === 'kgRole' && ldraft && ldraft.kind === 'khgoal') {
    khGoalKeep();
    const x = ldraft.x, up = kgOf(x.parent);
    x.roleId = e.target.value;
    if (up && up.roleId !== x.roleId) x.parent = '';
    khGoalDraw();
    return;
  }
  if (ldraft && ldraft.kind === 'khwiz') {
    if (e.target.id === 'khwVis') { ldraft.vision = e.target.value; return; }
    if (e.target.id === 'khwProj') { khWizKeep(); khWizDraw(); return; }
    if (e.target.id === 'khwSci' || e.target.id === 'khwBook' || e.target.id === 'khwHz') { khWizKeep(); khWizDraw(); return; }
    if (e.target.id === 'khwRole') { khWizKeep(); ldraft.roleId = e.target.value; const up = kgOf(ldraft.vision); if (up && up.roleId !== ldraft.roleId) ldraft.vision = ''; khWizDraw(); return; }
    if (ds.khCtm !== undefined || ds.khCarea !== undefined) khWizKeep(); // (the cards are made again from the lines: first, then the change)
    const c = ldraft.cards[Number(ds.khCtm ?? ds.khCarea ?? -1)];
    if (c && ds.khCtm !== undefined) { c.tm = e.target.value; $('khwCards').innerHTML = khWizCardsHTML(); return; }
    if (c && ds.khCarea !== undefined) { c.area = e.target.value; return; }
  }
  const a = ds.khAssign;
  if (!a || !e.target.value) return;
  const [kind, id] = a.split(':'), role = e.target.value;
  if (kind === 'kgoal') {
    const g = kgOf(id);
    if (!g) return;
    g.roleId = role;
    if (g.level === 'life') for (const y of kgKids(g, 'year')) y.roleId = role;
    save(); render();
    toast(`صار في «${khRole(role).name}»`);
    return;
  }
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
