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
const khUi = { tab: 'today', wk: '', mo: '', yr: '', review: '', rv: {}, rvq: null, st: { mode: 'week' } };

function normalizeRole(r) { return { id: r.id || uid(), name: String(r.name || '').trim() || 'دور', created: r.created || Date.now() }; }
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
document.addEventListener('change', (e) => { if (e.target.id === 'fRole' || e.target.id === 'fProject') khSyncRoleField(); if (e.target.id === 'pRole') $('pAreaWrap').hidden = e.target.value !== KH_SAW; });

// ---------- the plan's months and years (v98), in the calendar chosen for the monthly calendar (S.settings.calType) ----------
// A week belongs to the month it starts in (so a month has four weeks or five). A chosen month is kept as two dates
// (its first day~the next month's first day) and read by its middle, so switching the calendar never spoils it.
const KH_HP = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
const KH_CAL = new Map(); // sums on the calendar alone: kept
const khMemo = new Map(); // sums on the data: cleared on every save and every drawing
const khCalc = (k, fn) => { if (!KH_CAL.has(k)) KH_CAL.set(k, fn()); return KH_CAL.get(k); };
const khMm = (k, fn) => { if (!khMemo.has(k)) khMemo.set(k, fn()); return khMemo.get(k); };
const khCt = () => (calHijri() ? 'h' : 'g');
function khHij(d) { return khCalc(`H${d}`, () => { const p = {}; for (const x of KH_HP.formatToParts(parse(d))) p[x.type] = x.value; return { y: Number(p.year), m: Number(p.month) }; }); }
const khMoStart = (d) => khCalc(`s${khCt()}${d}`, () => (calHijri() ? hMonthStart(d) : `${d.slice(0, 8)}01`));
const khMoNext = (m) => khCalc(`n${khCt()}${m}`, () => (calHijri() ? hMonthNext(m) : khMoStart(addDays(m, 32))));
const khMoPrev = (m) => khMoStart(addDays(m, -1));
function khYrStart(d) { return khCalc(`y${khCt()}${d}`, () => { if (!calHijri()) return `${d.slice(0, 4)}-01-01`; let m = khMoStart(d); for (let i = 0; i < 13 && khHij(m).m !== 1; i++) m = khMoPrev(m); return m; }); }
const khYrNext = (y) => khCalc(`Y${khCt()}${y}`, () => { let m = y; for (let i = 0; i < 12; i++) m = khMoNext(m); return m; });
const khYrPrev = (y) => khYrStart(addDays(y, -1));
const khYrKey = (y) => (calHijri() ? `h${khHij(y).y}` : `g${y.slice(0, 4)}`);
const khYrLabel = (y) => (calHijri() ? `${khHij(y).y} هـ` : `${y.slice(0, 4)} م`);
const khMoLabel = (m) => (calHijri() ? fmtHijri(m, { month: 'long', year: 'numeric' }) : fmtDate(m, { month: 'long', year: 'numeric' }));
const khMoShort = (m) => (calHijri() ? fmtHijri(m, { month: 'long' }) : fmtDate(m, { month: 'long' }));
const khDayLabel = (d) => (calHijri() ? fmtHijri(d, { day: 'numeric', month: 'long' }) : fmtDate(d, { day: 'numeric', month: 'long' }));
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
    ticks: g.ticks && typeof g.ticks === 'object' ? g.ticks : {}, created: g.created || Date.now(),
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
const khVisions = (roleId) => S.kgoals.filter((g) => g.level === 'life' && g.roleId === roleId && g.status !== 'dropped');
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
// «تحقّق» ticked for one month or one week, kept by the date of its middle
const khTicked = (g, from, to) => Object.keys(g.ticks || {}).some((d) => d >= from && d < to);
function khToggleTick(g, from, to) {
  const had = khTicked(g, from, to);
  for (const d of Object.keys(g.ticks)) if (d >= from && d < to) delete g.ticks[d];
  if (!had) g.ticks[addDays(from, Math.floor(khDaysBetween(from, to) / 2))] = true;
  return !had;
}
// a month goal in a month, by its choice: the months picked, or any month of its year since it was made
function mgPlanned(g, m) {
  if (g.months.length) return khInRanges(g.months, m, khMoNext(m));
  if (!g.moN) return false;
  const sp = kgSpan(g), mid = addDays(m, 14);
  return !!sp && mid >= sp[0] && mid < sp[1] && !(g.from && khMoNext(m) <= g.from);
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
  return khMm(`wp${g.id}${k}`, () => {
    if ((g.from && k < g.from) || kgClosedIn(g, k, 'w')) return false;
    const mg = kgOf(g.parent);
    return !!mg && mgPlanned(mg, khMoStart(k)) && (!g.wk.length || g.wk.includes(khWkOrd(k)));
  });
}
// …and while the number of weeks of its month (and of months of its year) is not yet reached
function wgActive(g, k) {
  return khMm(`wa${g.id}${k}`, () => {
    if (!wgPlanned(g, k) || !mgActive(kgOf(g.parent), khMoStart(k))) return false;
    return !g.wkN || khWeeksOf(khMoStart(k)).filter((w) => w < k && wgDone(g, w)).length < g.wkN;
  });
}
// a chain task shows on its days only in its goal's months and weeks (until their number is reached), and not
// after its goal (or one above it) is achieved or cancelled. Called by occursOn (app.js)
function khChainOn(t, d) { const g = kgOf(t.kgoal); return !g || g.level !== 'week' || wgActive(g, weekStartOf(d)); }
// a chain task's day by its own days and its goal's months and weeks, before any number is counted
function khPlannedOn(t, d) {
  const r = t.repeat, g = kgOf(t.kgoal);
  return !!r && !!g && d >= r.start && !(r.until && d > r.until) && r.days.includes(parse(d).getDay()) && wgPlanned(g, weekStartOf(d));
}
// a week goal achieved in a week: ticked, or every one of its days (and its tasks) there done
function wgDone(g, k) {
  return khMm(`wd${g.id}${k}`, () => {
    if (khTicked(g, k, addDays(k, 7))) return true;
    const last = addDays(k, 6);
    let n = 0;
    for (const t of kgTasks(g)) {
      if (isRepeat(t)) { for (const d of khDays(k)) if (khPlannedOn(t, d)) { n++; if (!t.completions[d]) return false; } }
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
    if (isRepeat(t)) { for (const d of khDays(k)) if (occursOn(t, d)) { target++; if (t.completions[d]) done++; } }
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
      const ws = wgWeeks(w, m), need = w.wkN ? Math.min(w.wkN, ws.length) : ws.length;
      target += need; done += Math.min(need, ws.filter((k) => wgDone(w, k)).length);
    }
    return { target, done };
  });
}
const mgDone = (g, m) => khMm(`md${g.id}${m}`, () => khTicked(g, m, khMoNext(m)) || ((x) => x.target > 0 && x.done >= x.target)(mgShare(g, m)));
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
function khChainStart(mg) {
  const ms = mg.months.length ? mg.months.map((r) => khMoStart(khMid(r))).sort() : [khMonth0(kgSpan(mg))].filter(Boolean);
  const w0 = ms.length ? khWeeksOf(ms[0])[0] : '';
  return w0 && w0 > today() ? w0 : today();
}
// …and its last: the end of the last week of its last month (a week is the month's it starts in)
function khChainEnd(mg) {
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
    if (e) t.repeat.until = e < t.repeat.start ? t.repeat.start : e;
  }
}
// a goal and all that is under it: its goals and the recurring tasks of its days go; its tasks for one week stay, unlinked
function kgDrop(g) {
  const ids = new Set(kgSub(g).map((x) => x.id));
  S.tasks = S.tasks.filter((t) => !(ids.has(t.kgoal) && isRepeat(t)));
  for (const t of S.tasks) if (ids.has(t.kgoal)) t.kgoal = '';
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
    if (isRepeat(t)) { const ds = Object.keys(t.completions).filter((d) => t.completions[d] && d >= from && d < to).sort(); if (ds.length) out.push({ t, d: ds[ds.length - 1], n: ds.length }); }
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
  ${({ roles: khRolesHTML, week: khWeekHTML, month: khMonthHTML, year: khYearHTML, life: khLifeHTML, stats: khStatsHTML }[khUi.tab] || khTodayHTML)()}`;
}

// ---------- أدواري ----------
// what is still open (an ended goal, a done task or a finished project is not waiting for anything)
const khOpenGoal = (t) => isGoal(t) && !goalEnded(t);
const khOpenTask = (t) => !isGoal(t) && !t.done && !t.projectId;
function khRoleCard(r) {
  const own = (t) => khRoleIdOf(t) === r.id;
  const projects = S.projects.filter((p) => !p.doneAt && p.roleId === r.id);
  const goals = S.tasks.filter((t) => khOpenGoal(t) && own(t) && !t.kgoal);
  const visions = S.kgoals.filter((g) => g.level === 'life' && g.roleId === r.id && g.status !== 'dropped');
  const years = S.kgoals.filter((g) => g.level === 'year' && kgRoleId(g) === r.id && g.status === 'open' && khYrOfKey(g.period) === khYrStart(today()));
  const tasks = S.tasks.filter((t) => khOpenTask(t) && own(t));
  const saw = r.id === KH_SAW;
  const goalBtn = (t) => `<button type="button" class="kh-link" data-action="open" data-id="${t.id}">${esc(t.title)}${saw && t.area ? ` <small>(${KH_AREAS[t.area]})</small>` : ''}</button>`;
  const counts = [projects.length && plural(projects.length, 'مشروع واحد', 'مشروعان', 'مشاريع', 'مشروعاً'), goals.length && plural(goals.length, 'هدف واحد', 'هدفان', 'أهداف', 'هدفاً'), tasks.length && plural(tasks.length, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')].filter(Boolean);
  const i = khRoles().indexOf(r), mine = khRoles().filter((x) => x.id !== KH_SAW).length;
  return `<div class="kh-role" style="--rc:${khColor(r.id)}">
    <div class="kh-role-head"><b>${esc(r.name)}</b>
      ${saw ? '<span class="kh-fixed">ثابت</span>' : `<div class="kh-role-acts"><button type="button" class="icon-btn" data-action="kh-role-mv" data-v="${r.id}" data-d="-1" aria-label="إلى الأعلى"${i ? '' : ' disabled'}>▲</button><button type="button" class="icon-btn" data-action="kh-role-mv" data-v="${r.id}" data-d="1" aria-label="إلى الأسفل"${i < mine - 1 ? '' : ' disabled'}>▼</button><button type="button" class="ghost sm" data-action="kh-role-edit" data-v="${r.id}">${icon('edit')} تعديل</button></div>`}</div>
    ${visions.length ? `<div class="kh-sub"><small>رؤيتي</small><div class="kh-links">${visions.map((v) => `<button type="button" class="kh-link" data-action="kh-edit-goal" data-v="${v.id}">${esc(v.text)}</button>`).join('')}</div></div>` : ''}
    ${years.length ? `<div class="kh-sub"><small>أهداف السنة</small><div class="kh-links">${years.map((g) => { const x = ygShare(g, khYrStart(today())); return `<button type="button" class="kh-link" data-action="kh-tab" data-v="year">${esc(g.text)}${x.target ? `<small>تحقّق في ${khN(x.done)} من ${KH_UNIT.month(x.target)}</small>` : ''}</button>`; }).join('')}</div></div>` : ''}
    ${counts.length ? `<p class="note-text">${counts.join(' | ')}</p>` : visions.length || years.length ? '' : '<p class="note-text">لا شيء لهذا الدور بعد.</p>'}
    ${saw ? '<p class="note-text explain">عنايتك بنفسك لتقوى على أدوارك كلها، بأربعة جوانب: صحي (رياضة ونوم وغذاء)، واجتماعي (صلة وصداقة ومعروف)، ومعرفي (قراءة وتعلّم)، ونفسي (ما يريح نفسك ويرتّبها).</p>' : ''}
    ${projects.length ? `<div class="kh-sub"><small>المشاريع</small><div class="kh-chips">${projects.map((p) => `<button type="button" class="chip" data-action="open-project" data-v="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>` : ''}
    ${goals.length ? `<div class="kh-sub"><small>الأهداف</small><div class="kh-links">${goals.map(goalBtn).join('')}</div></div>` : ''}
    ${tasks.length ? `<details class="kh-sub"><summary><small>المهام (${tasks.length})</small></summary><div class="kh-links">${tasks.map(goalBtn).join('')}</div></details>` : ''}
    <div class="btn-row kh-adds">${addBtn('kh-new', 'مهمة', ` data-role="${r.id}"`)}${addBtn('kh-new-goal', 'هدف', ` data-role="${r.id}"`)}${addBtn('kh-new-project', 'مشروع', ` data-role="${r.id}"`)}${visions.length ? '' : addBtn('kh-new-vision', 'رؤية', ` data-role="${r.id}"`)}</div>
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
const khLifeBtn = (t) => `<button type="button" class="kh-life" data-action="kh-life" data-id="${t.id}" aria-pressed="${!!t.life}">${t.life ? '✦ في حياتي' : '✦ ينعكس في حياتي؟'}</button>`;
const khItem = (t, d, withTag) => `<ul class="list kh-one${t.prio === d ? ' kh-prio-on' : ''}">${itemHTML(t, d, { extra: `<div class="kh-side">${withTag ? khTag(t) : ''}${khPrioBtn(t, d)}${doneOn(t, d) ? khLifeBtn(t) : ''}</div>` })}</ul>`;
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
    <div class="btn-row">${addBtn('kh-new', 'مهمة لليوم', ` data-due="${d}"`)}${addBtn('kh-plan-pick', 'من خطتك', ` data-k="${k}" data-day="${d}"`)}</div>
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
  const rowsOf = (list) => [...list.filter((x) => x.kind !== 'rep').sort((a, b) => (a.t.due || '').localeCompare(b.t.due || '')).map((x) => `<ul class="list">${itemHTML(x.t, x.t.due && x.t.due >= k && x.t.due <= last ? x.t.due : t0 >= k && t0 <= last ? t0 : k)}</ul>`),
    ...list.filter((x) => x.kind === 'rep').map((x) => khRepRow(x, t0))];
  const card = (r) => {
    const id = r ? r.id : '', mine = xs.filter((x) => khRoleIdOf(x.t) === id);
    const wgs = S.kgoals.filter((g) => g.level === 'week' && kgRoleId(g) === id && wgPlanned(g, k)), under = new Set(wgs.map((g) => g.id));
    if (!r && !mine.length && !wgs.length) return '';
    const full = mine.filter((x) => khFrac(x) === 1).length;
    const rows = [...wgs.map((g) => khWeekNode(g, k, rowsOf(mine.filter((x) => x.t.kgoal === g.id)))), ...rowsOf(mine.filter((x) => !under.has(x.t.kgoal)))];
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

// ---------- the chain's pieces, shown alike in every tab ----------
const khN = (n) => (n ? String(n) : 'صفر');
const KH_UNIT = { week: (n) => plural(n, 'أسبوع واحد', 'أسبوعين', 'أسابيع', 'أسبوعاً'), month: (n) => plural(n, 'شهر واحد', 'شهرين', 'أشهر', 'شهراً'), times: (n) => plural(n, 'مرة واحدة', 'مرتين', 'مرات', 'مرة') };
// a level's share: a bar, and its number in the unit of the level under it
const khProg = (x, unit, tail) => (x.target ? `<div class="kh-gprog"><span class="kh-track sm"><i style="width:${Math.min(100, Math.round((x.done / x.target) * 100))}%"></i></span><small>${khN(x.done)} من ${KH_UNIT[unit](x.target)}${tail ? ` ${tail}` : ''}</small></div>` : '');
const khTickBox = (g, from, to, label) => `<label class="kh-tick"><input type="checkbox" data-kh-tick="${g.id}" data-from="${from}" data-to="${to}"${khTicked(g, from, to) ? ' checked' : ''}><span>${label}</span></label>`;
const khDoneBadge = (label) => `<span class="kh-tick on">${icon('check')}<span>${label}</span></span>`;
const khStat = (g) => (g.status !== 'open' ? ` <span class="kh-st ${g.status}">${KH_GSTAT[g.status]}</span>` : '');
const khCont = (lv, label, attrs) => `<button type="button" class="kh-cont lv-${lv}" data-action="kh-wiz"${attrs}>${icon('plus')}<span>${label}</span></button>`;
const khCtx = (lv, small, text) => `<div class="kh-ctx lv-${lv}"><small>${small}</small><b>${esc(text)}</b></div>`;
function khMonthsText(g) {
  if (g.months.length) {
    const ms = [...new Set(g.months.map((r) => khMoStart(khMid(r))))].sort();
    const cont = ms.every((m, i) => !i || khMoNext(ms[i - 1]) === m);
    return ms.length === 1 ? `في ${khMoLabel(ms[0])}` : cont && ms.length > 2 ? `من ${khMoShort(ms[0])} إلى ${khMoShort(ms[ms.length - 1])}` : `في ${ms.map(khMoShort).join('، ')}`;
  }
  return g.moN ? `${plural(g.moN, 'شهر واحد', 'شهران', 'أشهر', 'شهراً')} من السنة، أيّها كان` : '';
}
const khWeeksText = (g) => (g.wk.length ? `${g.wk.length === 1 ? 'الأسبوع' : 'الأسابيع'}: ${g.wk.map((i) => KH_ORD[i - 1]).join(' و')} من كل شهر` : g.wkN ? `${plural(g.wkN, 'أسبوع واحد', 'أسبوعان', 'أسابيع', 'أسبوعاً')} من كل شهر، أيّها كان` : 'كل الأسابيع');
const khDaysText = (t) => (t.repeat.days.length === 7 ? 'كل يوم' : DAY_ORDER.filter((d) => t.repeat.days.includes(d)).map((d) => AR_DAYS[d]).join(' و'));
// a period's top bar: back and forth, and the way back to now
const khPeriodNav = (title, label, prev, next, action, back) => `<div class="cal-head">
    <div class="nav"><button type="button" data-action="${action}" data-v="${prev}" aria-label="السابق">${icon('prev')}</button></div>
    <div class="titles"><h2>${title}</h2><small>${esc(label)}</small></div>
    <div class="nav"><button type="button" data-action="${action}" data-v="${next}" aria-label="التالي">${icon('next')}</button></div>
  </div>${back ? `<button type="button" class="ghost" data-action="${action}" data-v="">${back}</button>` : ''}`;
const khRoleSec = (r, inner, n) => `<div class="kh-role" style="--rc:${khColor(r ? r.id : '')}"><div class="kh-role-head"><b>${esc(r ? r.name : 'بلا دور')}</b>${n ? `<small class="kh-cnt">${plural(n, 'إنجاز واحد', 'إنجازان', 'إنجازات', 'إنجازاً')}</small>` : ''}</div>${inner}</div>`;

// ---------- شهري ----------
function khMonthNode(g, m) {
  const x = mgShare(g, m), full = x.target > 0 && x.done >= x.target, yg = kgOf(g.parent), ws = kgKids(g, 'week');
  // «a number of any weeks»: boxes by its number; otherwise its weeks by their order in the month
  const slots = (w) => {
    const wks = wgWeeks(w, m), got = wks.filter((k) => wgDone(w, k)).length;
    return w.wkN ? Array.from({ length: Math.min(w.wkN, wks.length) }, (_, i) => `<span class="kh-slot${i < got ? ' on' : ''}">${i < got ? '✓' : '○'}</span>`).join('')
      : wks.map((k) => `<span class="kh-slot${wgDone(w, k) ? ' on' : ''}">${KH_ORD[khWkOrd(k) - 1]}${wgDone(w, k) ? ' ✓' : ''}</span>`).join('');
  };
  return `<div class="kh-node lv-month">
    <button type="button" class="kh-nh" data-action="kh-edit-mg" data-v="${g.id}"><small>هدف الشهر${khStat(g)}</small><b>${esc(g.text)}</b></button>
    ${yg ? `<small class="kh-serve">يخدم سنتك: ${esc(yg.text)}</small>` : ''}
    ${khProg(x, 'week', 'هذا الشهر')}
    ${g.status !== 'open' ? '' : full ? khDoneBadge('تحقّق هذا الشهر') : khTickBox(g, m, khMoNext(m), 'تحقّق هذا الشهر')}
    ${ws.map((w) => `<div class="kh-node lv-week"><button type="button" class="kh-nh" data-action="kh-edit-wg" data-v="${w.id}"><small>هدف الأسبوع: ${esc(khWeeksText(w))}${khStat(w)}</small><b>${esc(w.text)}</b></button>${slots(w) ? `<div class="kh-slots">${slots(w)}</div>` : ''}</div>`).join('')}
    ${!ws.length && g.status === 'open' ? khCont('week', 'أكمل: ثم أسابيعك', ` data-step="2" data-month="${g.id}"`) : ''}
  </div>`;
}
function khMonthHTML() {
  const now = khMoStart(today()), m = khUi.mo ? khMoStart(khUi.mo) : now, end = khMoNext(m), cur = weekStartOf(today());
  // its weeks: those that start in it, each with its share (one still to come has none yet)
  const weeks = khWeeksOf(m).filter((k) => k <= cur || khWeekItems(k).length), pk = (k) => (k > cur ? null : khShownPct(k));
  const pcts = weeks.map(pk).filter((x) => x !== null), avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  const n = khDoneIn(m, end), life = khLifeRec(m, end).length;
  const card = (r) => {
    const gs = S.kgoals.filter((g) => g.level === 'month' && kgRoleId(g) === (r ? r.id : '') && mgPlanned(g, m) && !kgClosedIn(g, m, 'm'));
    if (!r && !gs.length) return '';
    return khRoleSec(r, `${gs.map((g) => khMonthNode(g, m)).join('')}${r && end > today() ? `<div class="btn-row kh-adds">${addBtn('kh-mplan', 'هدف للشهر', ` data-role="${r.id}"`)}</div>` : ''}`, khDoneIn(m, end, r ? r.id : ''));
  };
  return `<section class="section">
    ${khPeriodNav(m === now ? 'شهري' : 'شهر', khMoLabel(m), khMoPrev(m), end, 'kh-mo', m !== now ? 'العودة إلى هذا الشهر' : '')}
    <p class="note-text explain">أهداف الشهر خطوات من أهداف سنتك. الشهر يتحقق بأسابيعه، والأسبوع بأيامه؛ ولك أن تعلّم «تحقّق هذا الشهر» بحكمك أنت.</p>
    <div class="panel kh-stats"><div class="kh-nums"><span><b>${khN(n)}</b>${n === 1 ? 'إنجاز' : 'إنجازات'}</span><span><b>${avg === null ? '—' : `${avg}٪`}</b>متوسط أسابيعه</span><span><b>${khN(life)}</b>في حياتي</span></div>
      ${weeks.length ? `<div class="kh-chips">${weeks.map((k) => { const p = pk(k); return `<button type="button" class="chip${p !== null && p >= KH_RATE ? ' ok' : ''}" data-action="kh-goweek" data-v="${k}">${esc(khDayLabel(k))}: ${p === null ? 'لم يأتِ' : `${p}٪`}</button>`; }).join('')}</div>` : ''}</div>
    ${[...khRoles(), null].map(card).join('')}
  </section>`;
}

// ---------- سنتي ----------
// a year goal's whole chain: its months, their weeks, the tasks of their days
function khChainHTML(yg, y) {
  const live = khYrNext(y) > today(); // a year gone by is shown, not built on
  const dayNode = (t) => {
    const ds = Object.keys(t.completions).filter((d) => t.completions[d] && d >= y && d < khYrNext(y));
    return `<button type="button" class="kh-node lv-day kh-leaf" data-action="open" data-id="${t.id}"><small>${isRepeat(t) ? esc(khDaysText(t)) : `لمرة: ${esc(dueLabel(t.due))}`}${hasTime(t) ? ` | ${esc(timeLabel(t, today()))}` : ''}</small><b>${esc(t.title)}</b>${isRepeat(t) && ds.length ? `<small>أنجزتها ${plural(ds.length, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')} هذه السنة</small>` : !isRepeat(t) && t.done ? '<small>✓ أنجزتها</small>' : ''}</button>`;
  };
  const weekNode = (w) => {
    const ts = kgTasks(w);
    return `<div class="kh-node lv-week"><button type="button" class="kh-nh" data-action="kh-edit-wg" data-v="${w.id}"><small>${esc(khWeeksText(w))}${khStat(w)}</small><b>${esc(w.text)}</b></button>
      ${ts.map(dayNode).join('')}
      ${live && !kgClosedOf(w) ? khCont('day', ts.length ? 'مهمة أخرى لهذا الهدف' : 'أكمل: ثم أيامك', ` data-step="3" data-week="${w.id}"`) : ''}</div>`;
  };
  const monthNode = (m) => {
    const ws = kgKids(m, 'week'), mx = mgYear(m, y);
    return `<div class="kh-node lv-month"><button type="button" class="kh-nh" data-action="kh-edit-mg" data-v="${m.id}"><small>${esc(khMonthsText(m))}${khStat(m)}</small><b>${esc(m.text)}</b></button>
      ${mx.target ? `<small class="kh-serve">تحقّق في ${khN(mx.done)} من ${KH_UNIT.month(mx.target)}</small>` : ''}
      ${ws.map(weekNode).join('')}
      ${!ws.length && live && !kgClosedOf(m) ? khCont('week', 'أكمل: ثم أسابيعك', ` data-step="2" data-month="${m.id}"`) : ''}</div>`;
  };
  const ms = kgKids(yg, 'month'), x = ygShare(yg, y), v = kgOf(yg.parent);
  return `<div class="kh-node lv-year"><button type="button" class="kh-nh" data-action="kh-edit-goal" data-v="${yg.id}"><small>هدف السنة${khStat(yg)}</small><b>${esc(yg.text)}</b></button>
    ${v ? `<small class="kh-serve">يخدم رؤيتك: ${esc(v.text)}</small>` : ''}
    ${khProg(x, 'month')}${x.target && x.done >= x.target ? khDoneBadge('تحقّق في أشهره كلها') : ''}
    ${ms.map(monthNode).join('')}
    ${yg.status === 'open' && live ? khCont('month', ms.length ? 'اربطه بأشهر أخرى' : 'أكمل: ثم أشهرك', ` data-step="1" data-year="${yg.id}"`) : ''}</div>`;
}
function khYearHTML() {
  const now = khYrStart(today()), y = khUi.yr ? khYrStart(khUi.yr) : now, end = khYrNext(y);
  const months = [];
  for (let m = y; m < end; m = khMoNext(m)) months.push(m);
  const counts = months.map((m) => khDoneIn(m, khMoNext(m))), max = Math.max(1, ...counts), n = khDoneIn(y, end);
  const card = (r) => {
    const gs = S.kgoals.filter((g) => g.level === 'year' && kgRoleId(g) === (r ? r.id : '') && khYrOfKey(g.period) === y);
    if (!r && !gs.length) return '';
    return khRoleSec(r, `${gs.length ? `<div class="kh-chain">${gs.map((g) => khChainHTML(g, y)).join('')}</div>` : ''}${r && end > today() ? `<div class="btn-row kh-adds">${addBtn('kh-wiz', 'هدف للسنة', ` data-step="0" data-role="${r.id}" data-yk="${khYrKey(y)}"`)}</div>` : ''}`, khDoneIn(y, end, r ? r.id : ''));
  };
  return `<section class="section">
    ${khPeriodNav(y === now ? 'سنتي' : 'سنة', khYrLabel(y), khYrPrev(y), end, 'kh-yr', y !== now ? 'العودة إلى هذه السنة' : '')}
    <p class="note-text explain">من رؤيتك في كل دور: هدف لسنتك، ثم أشهره، ثم أسابيعها، ثم أيامها. والسنة تتحقق بأشهرها.</p>
    <div class="panel"><div class="row-between"><b>إنجازات السنة</b><span class="kh-pct ok">${khN(n)}</span></div>
      <div class="kh-months">${months.map((m, i) => `<button type="button" class="kh-mo${m === khMoStart(today()) ? ' now' : ''}" data-action="kh-gomonth" data-v="${m}"><span>${esc(khMoShort(m))}</span><span class="kh-track sm"><i style="width:${Math.round((counts[i] / max) * 100)}%"></i></span><small>${khN(counts[i])}</small></button>`).join('')}</div></div>
    ${[...khRoles(), null].map(card).join('')}
  </section>`;
}

// ---------- حياتي ----------
function khLifeHTML() {
  const rec = khLifeRec(), cy = khYrStart(today()), n = khDoneIn('', '9999');
  const reviewed = S.weeks.filter((w) => w.review), avg = reviewed.length ? Math.round(reviewed.reduce((a, w) => a + w.review.pct, 0) / reviewed.length) : null;
  const visionHTML = (v, r) => {
    const ys = kgKids(v, 'year'), now = ys.filter((g) => khYrOfKey(g.period) === cy);
    const p = now.reduce((a, g) => { const x = ygShare(g, cy); return { target: a.target + x.target, done: a.done + x.done }; }, { target: 0, done: 0 });
    return `<div class="kh-node lv-life"><button type="button" class="kh-nh" data-action="kh-edit-goal" data-v="${v.id}"><small>رؤيتي${khStat(v)}</small><b>${esc(v.text)}</b>${v.why ? `<small>${esc(v.why)}</small>` : ''}</button>
      ${p.target ? `<small class="kh-serve">تقدّمك نحوها في ${esc(khYrLabel(cy))}: من أشهر خطة سنتك لها</small>${khProg(p, 'month')}` : ''}
      ${ys.length ? `<div class="kh-kids">${ys.map((g) => `<span>${g.status === 'done' ? '✓' : g.status === 'dropped' ? '✗' : '•'} ${esc(g.text)} <small>(${esc(khKeyLabel(g.period))})</small></span>`).join('')}</div>` : ''}
      ${v.status === 'open' && !now.some((g) => g.status === 'open') ? khCont('year', 'التالي: هدف هذه السنة لهذه الرؤية', ` data-step="0" data-role="${r.id}" data-vision="${v.id}"`) : ''}</div>`;
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
  const wg = kgOf(o.weekId), mg = kgOf(o.monthId || (wg ? wg.parent : '')), yg = kgOf(o.yearId || (mg ? mg.parent : ''));
  const roleId = o.roleId || (yg ? kgRoleId(yg) : '') || (khRoles()[0] || {}).id;
  const step = Number(o.step) || 0;
  ldraft = {
    kind: 'khwiz', id: 'x', isNew: true, step, first: step, edit: o.edit || '', roleId,
    yearId: yg ? yg.id : '', monthId: mg ? mg.id : '', weekId: wg ? wg.id : '',
    vision: yg ? yg.parent : o.vision || (khVisions(roleId)[0] || {}).id || '', vText: '',
    yText: yg ? yg.text : '', why: yg ? yg.why : '', laws: { ...(yg ? yg.laws : {}) }, yk: (yg && yg.period) || o.yk || khYearOpts()[0][0],
    moMode: mg && mg.moN ? 'count' : 'pick', months: mg ? [...mg.months] : [], moN: (mg && mg.moN) || 3, mText: mg ? mg.text : '',
    wkMode: wg && wg.wkN ? 'count' : 'pick', wk: wg ? [...wg.wk] : [], wkN: (wg && wg.wkN) || 2, wText: wg ? wg.text : '',
    // the days: recurring on days chosen, or (a task for one week of its goal) once on a day of that week
    once: !!o.once, k: o.k || weekStartOf(today()), day: o.day || today(), days: [parse(today()).getDay()], dText: o.text || '', cards: [], openTm: -1,
  };
  khWizCards();
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
  w.cards = ls.map((text, i) => {
    let j = prev.findIndex((c, n) => !used.has(n) && c.text === text);
    if (j < 0 && prev[i] && !used.has(i) && !ls.includes(prev[i].text)) j = i; // a line edited in its place
    if (j >= 0) used.add(j);
    const c = j >= 0 ? prev[j] : { days: [...w.days], tm: '', time: '07:00', area: w.roleId === KH_SAW ? 'health' : '', own: false };
    if (!c.own) c.days = [...w.days];
    return { ...c, text };
  });
}
const khDots = (op, on, extra = '') => `<div class="kh-dots">${DAY_ORDER.map((d) => `<button type="button" class="kh-dot${on.includes(d) ? ' on' : ''}" data-action="kh-w" data-op="${op}" data-v="${d}"${extra} aria-pressed="${on.includes(d)}" aria-label="${esc(AR_DAYS[d])}">${KH_WD[d]}</button>`).join('')}</div>`;
const KH_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
function khWizCardsHTML() {
  const w = ldraft;
  if (!w.cards.length) return '';
  return `<div class="kh-ask lv-day"><span class="kh-al">${w.once ? 'مهامّك من هذا الجواب' : 'مهامّك من هذا الجواب: لكل مهمة أيامها ووقتها'}</span>${w.cards.map((c, i) => `<div class="kh-card"><b><span>${i + 1}</span>${esc(c.text)}</b>
      ${w.once ? '' : khDots('cday', c.days, ` data-i="${i}"`)}
      <div class="kh-card-row"><select data-kh-ctm="${i}" aria-label="وقتها"><option value="">بلا وقت</option><option value="clock"${c.tm === 'clock' ? ' selected' : ''}>في ساعة محددة</option>${KH_PRAYERS.map((p) => `<option value="${p}"${c.tm === p ? ' selected' : ''}>مع ${Prayer.NAMES[p]}</option>`).join('')}</select>
        ${c.tm === 'clock' ? `<input type="time" data-kh-ctime="${i}" value="${esc(c.time)}" aria-label="الساعة" data-novoice>` : ''}
        ${w.roleId === KH_SAW ? `<select data-kh-carea="${i}" aria-label="جانبها">${khAreaOptions(c.area)}</select>` : ''}</div></div>`).join('')}</div>${w.once ? '' : khWizShares()}`;
}
// how many times a week, a month and to the end of the year the tasks come to
function khWizShares() {
  const w = ldraft, per = w.cards.reduce((n, c) => n + c.days.length, 0);
  if (!per) return '';
  const wkN = w.wkMode === 'count' ? w.wkN : 0, wk = w.wkMode === 'pick' ? w.wk : [];
  const ms = khSpanMonths(khWizSpan()).filter(khMoOpen).filter((m) => (w.moMode === 'pick' ? khInRanges(w.months, m, khMoNext(m)) : true));
  const inMonth = (m) => { const ks = khWeeksOf(m).filter((k) => k >= weekStartOf(today()) && (!wk.length || wk.includes(khWkOrd(k)))); return (wkN ? Math.min(wkN, ks.length) : ks.length) * per; };
  const full = ms.filter((m) => m > khMoStart(today())).map(inMonth).filter((n) => n > 0), sm = full.length ? full : ms.map(inMonth).filter((n) => n > 0);
  const lo = sm.length ? Math.min(...sm) : 0, hi = sm.length ? Math.max(...sm) : 0;
  let year = ms.reduce((n, m) => n + inMonth(m), 0);
  if (w.moMode === 'count') year = Math.min(year, [...ms.map(inMonth)].sort((a, b) => b - a).slice(0, w.moN).reduce((a, b) => a + b, 0));
  return `<div class="kh-shares"><span class="lv-day"><b>${per}</b>في الأسبوع</span><span class="lv-month"><b>${lo === hi ? hi : `${lo} أو ${hi}`}</b>في الشهر</span><span class="lv-year"><b>${year}</b>حتى آخر السنة</span></div>${lo !== hi ? '<p class="note-text explain">أكثر الأشهر أربعة أسابيع، وبعضها خمسة: فالأسبوع يُحسب للشهر الذي يبدأ فيه.</p>' : ''}`;
}
function khWizDraw() {
  const w = ldraft, edit = w.edit;
  const btns = (next) => (edit
    ? `<div class="sheet-actions"><button type="submit" class="primary">احفظ</button><button type="button" class="danger" data-action="kh-w" data-op="del">حذف</button></div><p class="note-text">${esc(kgDropNote(kgOf(edit === 'month' ? w.monthId : w.weekId)))}</p>`
    : `<div class="sheet-actions"><button type="submit" class="primary">${next}</button>${w.step > w.first ? '<button type="button" class="ghost" data-action="kh-w" data-op="prev">السابق</button>' : ''}${w.step < 3 ? '<button type="button" class="ghost" data-action="kh-w" data-op="later">أكمل لاحقاً</button>' : ''}</div>`);
  const role = esc(khRoleName(w.roleId));
  let body = '';
  if (w.step === 0) {
    const vs = khVisions(w.roleId), yg = kgOf(w.yearId);
    body = `${khWizBar(0)}<h3 class="kh-wh">هدف لسنتك في «${role}»</h3>
      ${vs.length === 1 ? khCtx('life', 'رؤيتك في هذا الدور', vs[0].text)
        : vs.length > 1 ? `<label class="field"><span>يخدم أيّ رؤية؟</span><select id="khwVis">${vs.map((v) => `<option value="${v.id}"${v.id === w.vision ? ' selected' : ''}>${esc(v.text)}</option>`).join('')}</select></label>`
        : `<label class="field kh-q lv-life"><span>ما رؤيتك في «${role}»؟ الصورة التي تريد أن تكون عليها في هذا الدور</span><textarea id="khwVt" rows="2">${esc(w.vText)}</textarea></label>`}
      <p class="kh-qt lv-year">هذه السنة، ما الذي تراه يقرّبك من رؤيتك؟</p>
      ${yg ? '' : `<div class="seg" role="group" aria-label="أيّ سنة؟">${khYearOpts().map(([k, l]) => khWBtn('yk', k, esc(l), k === w.yk)).join('')}</div>`}
      <label class="field kh-q lv-year"><span>اكتب جوابك</span><textarea id="khwY" rows="2">${esc(w.yText)}</textarea></label>
      ${khLawsHTML(w.laws)}
      <label class="field"><span>لماذا تريده؟ (المعنى، اختياري)</span><textarea id="khwWhy" rows="2">${esc(w.why)}</textarea></label>
      ${btns('التالي: الأشهر')}`;
  } else if (w.step === 1) {
    const ms = khSpanMonths(khWizSpan()), left = Math.max(1, ms.filter(khMoOpen).length);
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
    body = `${w.first === 3 ? '<h3 class="kh-wh">مهمة لهذا الهدف</h3>' : `${khWizBar(3)}<h3 class="kh-wh">ثم أيامك</h3>`}
      ${khCtx('week', wg ? `هدف الأسبوع: ${khWeeksText(wg)}` : 'هدف الأسبوع', w.wText)}
      ${w.first === 3 ? `<div class="seg" role="group">${khWBtn('once', '', 'تتكرر في أيامها', !w.once)}${khWBtn('once', '1', 'لمرة في هذا الأسبوع', w.once)}</div>` : ''}
      <p class="kh-qt lv-day">كيف تريد أن يتحقق الهدف من خلال أيامك المختارة؟</p>
      ${w.once ? `<div class="kh-ask lv-day"><span class="kh-al">في أيّ يوم؟</span><div class="kh-chips">${days.map((d) => `<button type="button" class="chip" data-action="kh-w" data-op="oday" data-v="${d}" aria-pressed="${w.day === d}">${esc(dueLabel(d))}</button>`).join('')}</div></div>`
        : `<div class="kh-ask lv-day"><span class="kh-al">في أيّ أيام هذه الأسابيع؟</span>${khDots('day', w.days)}</div>`}
      <label class="field kh-q lv-day"><span>اكتب جوابك: كل مهمة في سطر</span><textarea id="khwD" rows="3">${esc(w.dText)}</textarea></label>
      <div id="khwCards">${khWizCardsHTML()}</div>
      ${btns(w.first === 3 ? 'احفظ' : 'احفظ: من رؤيتي إلى أيامي')}`;
  }
  $('libForm').innerHTML = `${sheetHead(edit ? 'تعديل الهدف' : 'من الرؤية إلى الأيام')}${body}`;
}
// what is written in the step on screen, into the draft
function khWizKeep() {
  const w = ldraft, v = (id) => ($(id) ? $(id).value : null);
  if (w.step === 0) {
    if (v('khwVis') !== null) w.vision = v('khwVis');
    if (v('khwVt') !== null) w.vText = v('khwVt');
    w.yText = v('khwY') ?? w.yText; w.why = v('khwWhy') ?? w.why;
    document.querySelectorAll('#libForm [data-kh-law]').forEach((c) => { w.laws[c.dataset.khLaw] = c.checked; });
  }
  if (w.step === 1) w.mText = v('khwM') ?? w.mText;
  if (w.step === 2) w.wText = v('khwW') ?? w.wText;
  if (w.step === 3) { w.dText = v('khwD') ?? w.dText; khWizCards(); }
}
const khNeed = (id, msg) => { toast(msg); if ($(id)) $(id).focus(); return false; };
// the step on screen, saved; false if something is missing
function khWizCommit() {
  const w = ldraft;
  if (w.step === 0) {
    if (!w.yText.trim()) return khNeed('khwY', 'اكتب هدف سنتك أولاً.');
    let vid = w.vision;
    if (!khVisions(w.roleId).length) {
      if (!w.vText.trim()) return khNeed('khwVt', 'اكتب رؤيتك في هذا الدور أولاً.');
      const vg = normalizeKGoal({ level: 'life', roleId: w.roleId, text: w.vText.trim() });
      S.kgoals.push(vg); vid = w.vision = vg.id; w.vText = '';
    }
    const v = { roleId: w.roleId, text: w.yText.trim(), why: w.why.trim(), laws: { ...w.laws }, parent: vid || '', period: w.yk };
    const yg = kgOf(w.yearId);
    if (yg) Object.assign(yg, v); else { const g = normalizeKGoal({ level: 'year', ...v }); S.kgoals.push(g); w.yearId = g.id; }
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
    if (!w.cards.length) return khNeed('khwD', 'اكتب مهمة واحدة على الأقل، كل مهمة في سطر.');
    const wg = kgOf(w.weekId), mg = wg && kgOf(wg.parent);
    if (!wg || !mg) { toast('هدف الأسبوع لم يعد موجوداً.'); return false; }
    const bad = w.once ? -1 : w.cards.findIndex((c) => !c.days.length);
    if (bad >= 0) { toast(`اختر أيام المهمة ${bad + 1}.`); return false; }
    const start = khChainStart(mg), until = khChainEnd(mg);
    for (const c of w.cards) {
      const when = { time: c.tm === 'clock' ? c.time : '', prayer: c.tm && c.tm !== 'clock' ? { name: c.tm, offset: 0 } : null };
      S.tasks.push(normalize(w.once
        ? { kind: 'task', title: c.text, due: w.day, kgoal: wg.id, roleId: kgRoleId(wg), area: c.area, ...when }
        : { kind: 'goal', title: c.text, repeat: { days: [...c.days].sort(), start, until }, kgoal: wg.id, roleId: kgRoleId(wg), area: c.area, ...when }));
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
  if (w.edit || w.step === 3) { toast(w.edit ? 'حُفظ الهدف' : w.first === 3 ? (w.cards.length > 1 ? 'أُضيفت المهام' : 'أُضيفت المهمة') : 'حُفظ: من رؤيتك إلى أيامك'); return true; }
  w.step++;
  khWizDraw();
  $('libForm').scrollTop = 0;
  render();
  return false;
}

// ---------- a task from the plan: under the week goal it serves ----------
function khPlanPick(k, day) {
  const cy = khYrStart(today()), m = khMoStart(day || addDays(k, 3));
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
    <button type="button" class="kh-nh" data-action="kh-edit-wg" data-v="${g.id}"><small>هدف الأسبوع${khStat(g)}</small><b>${esc(g.text)}</b></button>
    ${act ? khProg(x, 'times', 'هذا الأسبوع') : `<small class="kh-serve">تحقّق في ${KH_UNIT.week(g.wkN)} هذا الشهر، فلا شيء له في بقيته</small>`}
    ${!act || g.status !== 'open' ? '' : full ? khDoneBadge('تحقّق هذا الأسبوع') : khTickBox(g, k, addDays(k, 7), 'تحقّق هذا الأسبوع')}
    ${rows.length ? `<div class="kh-rows">${rows.join('')}</div>` : ''}
    ${act && g.status === 'open' && addDays(k, 6) >= today() ? khCont('day', 'مهمة لهذا الهدف', ` data-step="3" data-week="${g.id}" data-once="1" data-k="${k}"`) : ''}
  </div>`;
}
// a month goal from the plan: from a year goal it serves, or a new one from the vision
function khMonthPick(roleId) {
  const cy = khYrStart(today()), ygs = S.kgoals.filter((g) => g.level === 'year' && kgRoleId(g) === roleId && g.status === 'open' && khYrOfKey(g.period) === cy);
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
      if (occursOn(t, d)) { target++; if (t.completions[d]) done++; } else if (t.completions[d]) { target++; done++; }
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
    case 'kh-tab': khUi.tab = v; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-wk': khUi.wk = addDays(khUi.wk || khWeekOf(today()), Number(v)); render(); break;
    case 'kh-wk-now': khUi.wk = ''; render(); break;
    case 'kh-mo': khUi.mo = v && v !== khMoStart(today()) ? v : ''; render(); break;
    case 'kh-yr': khUi.yr = v && v !== khYrStart(today()) ? v : ''; render(); break;
    case 'kh-goweek': khUi.wk = v === khWeekOf(today()) ? '' : v; khUi.tab = 'week'; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-gomonth': khUi.mo = v === khMoStart(today()) ? '' : v; khUi.tab = 'month'; render(); window.scrollTo({ top: 0 }); break;
    case 'kh-mplan': khMonthPick(el.dataset.role); break;
    case 'kh-stmode': khUi.st = { ...khUi.st, mode: v }; render(); break;
    case 'kh-stgo': { const R = khStatRange(khUi.st); if (v) khUi.st = { ...khUi.st, [R.key]: v }; render(); break; }
    case 'kh-plan-pick': khPlanPick(el.dataset.k, el.dataset.day); break;
    case 'kh-wiz': { const o = el.dataset; khWizard({ step: o.step, roleId: o.role, yk: o.yk, vision: o.vision, yearId: o.year, monthId: o.month, weekId: o.week, once: !!o.once, k: o.k, day: o.day }); break; }
    case 'kh-edit-mg': khWizard({ step: 1, edit: 'month', monthId: v }); break;
    case 'kh-edit-wg': khWizard({ step: 2, edit: 'week', weekId: v }); break;
    case 'kh-edit-goal': khGoalSheet(v); break;
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
      if (op === 'del') { if (!selArmed(el)) break; const g = kgOf(w.edit === 'month' ? w.monthId : w.weekId); if (g) kgDrop(g); save(); closeLib(); render(); toast('حُذف'); break; }
      khWizKeep();
      if (op === 'later') {
        if ([w.yText, w.mText, w.wText, w.dText][w.step].trim() && !khWizCommit()) break;
        closeLib(); render(); toast('حُفظ ما كتبته، وتكمل من زر «أكمل» تحت الهدف في «سنتي»');
        break;
      }
      if (op === 'prev') w.step = Math.max(w.first, w.step - 1);
      if (op === 'yk') w.yk = v;
      if (op === 'momode') w.moMode = v;
      if (op === 'mon') w.moN = Number(v);
      if (op === 'mo') { const m = khMoStart(khMid(v)); w.months = w.months.some((r) => khMoStart(khMid(r)) === m) ? w.months.filter((r) => khMoStart(khMid(r)) !== m) : [...w.months, v]; }
      if (op === 'allmo') w.months = [...w.months.filter((r) => !khMoOpen(khMoStart(khMid(r)))), ...khSpanMonths(khWizSpan()).filter(khMoOpen).map(khMoRange)];
      if (op === 'wkmode') w.wkMode = v;
      if (op === 'wkn') w.wkN = Number(v);
      if (op === 'wk') { const i = Number(v); w.wk = !i ? [] : w.wk.includes(i) ? w.wk.filter((x) => x !== i) : [...w.wk, i].sort(); }
      if (op === 'day') { const d = Number(v); w.days = w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d].sort(); khWizCards(); }
      if (op === 'cday') { const c = w.cards[Number(el.dataset.i)], d = Number(v); if (c) { c.days = c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort(); c.own = true; } }
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
      for (const g of S.kgoals) if (g.roleId === id) g.roleId = '';
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
  // «إحصائياتي»: years from–to
  if (ds.khSt) {
    khUi.st = { ...khUi.st, [ds.khSt]: e.target.value };
    if (khUi.st.y1 && khUi.st.y2 && khUi.st.y1 > khUi.st.y2) khUi.st[ds.khSt === 'y1' ? 'y2' : 'y1'] = e.target.value;
    render();
    return;
  }
  // «تحقّق هذا الشهر/الأسبوع» by the user's own judgement
  if (ds.khTick) {
    const g = kgOf(ds.khTick);
    if (!g) return;
    const on = khToggleTick(g, ds.from, ds.to);
    save(); render();
    if (on) toast('أحسنت. تحقّق هدفك في هذه المدة');
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
