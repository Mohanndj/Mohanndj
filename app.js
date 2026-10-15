'use strict';

const APP_VERSION = 32;

// ---------- constants ----------
const KEY = 'mahami-v2';
const OLD_KEY = 'my-tasks-v1';
const LOCALE = 'ar-u-nu-latn';
const HIJRI = 'ar-SA-u-ca-islamic-umalqura-nu-latn';
const PRI = { high: 3, mid: 2, low: 1 };
const PRI_LABEL = { high: 'عالية', mid: 'متوسطة', low: 'منخفضة' };
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first
const DAY_SHORT = { 6: 'سبت', 0: 'أحد', 1: 'اثنين', 2: 'ثلاثاء', 3: 'أربعاء', 4: 'خميس', 5: 'جمعة' };
const ACCENTS = {
  teal: { name: 'أخضر مزرق', light: '#0f766e', dark: '#3fb8a9' },
  blue: { name: 'أزرق', light: '#1d5fd1', dark: '#6f9eff' },
  plum: { name: 'بنفسجي', light: '#7e3fb8', dark: '#c49af0' },
  rose: { name: 'وردي', light: '#b4234a', dark: '#f07a98' },
  amber: { name: 'عنبري', light: '#a45a0a', dark: '#eda54a' },
  graphite: { name: 'رمادي', light: '#3b4656', dark: '#aab6c6' },
};
// project colours: readable on light and dark backgrounds, and distinct from the goal colour
const PROJECT_COLORS = [
  ['#2f6fdb', 'أزرق'], ['#d9480f', 'برتقالي'], ['#7c3aed', 'بنفسجي'], ['#0f8a5f', 'أخضر'],
  ['#d6336c', 'وردي'], ['#0e8aa3', 'فيروزي'], ['#8a5a2b', 'بني'], ['#5c6b7a', 'رمادي'],
];
const ALARM_OPTIONS = [
  [0, 'في الموعد'], [5, 'قبل 5 د'], [10, 'قبل 10 د'], [15, 'قبل 15 د'], [30, 'قبل 30 د'],
  [60, 'قبل ساعة'], [120, 'قبل ساعتين'], [1440, 'قبل يوم'],
];
const SNOOZE_MIN = 10;
const MISSED_WINDOW_MIN = 180; // alarms older than this when the app opens are skipped
const SMART_EXAMPLES = [
  'ذكرني أتصل بأبوي بكرة الساعة 5 العصر',
  'اشرب 8 أكواب ماء كل يوم لمدة شهر',
  'قراءة القرآن بعد الفجر يومياً',
];

const ICONS = {
  check: 'M20 6L9 17l-5-5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  repeat: 'M17 2l4 4-4 4M3 11V10a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3',
  note: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  cal: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  steps: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  prev: 'M9 18l6-6-6-6',
  next: 'M15 18l-6-6 6-6',
  pin: 'M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  plus: 'M12 5v14M5 12h14',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  back: 'M9 18l6-6-6-6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  sheet: 'M4 3h16v18H4zM4 9h16M4 15h16M10 3v18',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  cart: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6M9 21h.01M18 21h.01',
  leaf: 'M5 21c0-9 6-15 15-16-1 9-7 15-15 16zM5 21l7-7',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  heart: 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z',
  scale: 'M12 3v18M8 21h8M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
  journal: 'M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5zM9 3v18M12 8h4M12 12h4',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  micro: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  pin2: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z',
  chart: 'M4 4v16h16M8 16v-4M12 16V8M16 16v-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15l1.6 1-2 3.4-1.8-.6a7 7 0 0 1-1.7 1L15 22h-4l-.5-2.2a7 7 0 0 1-1.7-1l-1.8.6-2-3.4 1.6-1a7 7 0 0 1 0-2l-1.6-1 2-3.4 1.8.6a7 7 0 0 1 1.7-1L11 2h4l.5 2.2a7 7 0 0 1 1.7 1l1.8-.6 2 3.4-1.6 1a7 7 0 0 1 0 2z',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

// ---------- small helpers ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => new Date(s + 'T00:00');
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const minutesOf = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const hmOf = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const fmtDate = (s, opts = { day: 'numeric', month: 'short' }) => parse(s).toLocaleDateString(LOCALE, opts);
const fmtTime = (hm) => new Date(`2000-01-01T${hm}`).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
const fmtMin = (min) => fmtTime(hmOf(min));
const fmtStamp = (ts) => new Date(ts).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
function fmtHijri(s, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  try { return parse(s).toLocaleDateString(HIJRI, opts); } catch { return ''; }
}
function relDate(s) {
  const t = today();
  if (s === t) return 'اليوم';
  if (s === addDays(t, 1)) return 'غداً';
  if (s === addDays(t, -1)) return 'أمس';
  return fmtDate(s);
}
// relative day name, or the date with its Hijri day when it is further away
function relDateH(s) {
  const r = relDate(s);
  if (!S.settings.hijri || ['اليوم', 'غداً', 'أمس'].includes(r)) return r;
  return `${r} · ${fmtHijri(s, { day: 'numeric', month: 'long' })}`;
}
const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
// «بعد يومين»، «متأخر يومين»: the dual after a word takes the accusative/genitive form
const afterDays = (n) => (n === 1 ? 'غداً' : n === 2 ? 'بعد يومين' : `بعد ${daysWord(n)}`);
const lateDays = (n) => (n === 2 ? 'متأخر يومين' : `متأخر ${daysWord(n)}`);
const heldDays = (n) => (n === 2 ? 'صمدت يومين' : `صمدت ${daysWord(n)}`);
const daysWord = (n) => (n === 0 ? '0 يوم' : plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً'));
const minsWord = (n) => (n === 15 ? 'ربع ساعة' : n === 30 ? 'نصف ساعة' : n % 1440 === 0 ? plural(n / 1440, 'يوم', 'يومين', 'أيام', 'يوماً')
  : n % 60 === 0 ? plural(n / 60, 'ساعة', 'ساعتين', 'ساعات', 'ساعة') : plural(n, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ---------- state ----------
function normalize(t) {
  const target = Math.max(1, Math.min(999, Number(t.target) || 1));
  const repeat = t.repeat && Array.isArray(t.repeat.days) ? t.repeat : null;
  return {
    id: t.id || uid(),
    kind: t.kind === 'goal' || t.kind === 'task' ? t.kind : repeat ? 'goal' : 'task',
    projectId: t.projectId || '',
    title: String(t.title || ''),
    priority: PRI[t.priority] ? t.priority : 'mid',
    category: t.category || '',
    due: t.due || '',
    time: t.time || '',
    prayer: t.prayer && t.prayer.name ? { name: t.prayer.name, offset: Number(t.prayer.offset) || 0 } : null,
    alarms: Array.isArray(t.alarms) ? t.alarms.map(Number) : (t.remind && t.time ? [0] : []),
    notes: Array.isArray(t.notes) ? t.notes : [],
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map((s) => ({ id: s.id || uid(), text: String(s.text || ''), done: !!s.done, doneAt: s.doneAt || (s.done ? Date.now() : null) })) : [],
    created: t.created || Date.now(),
    done: !!t.done,
    doneAt: t.doneAt || null,
    repeat,
    completions: t.completions && typeof t.completions === 'object' ? t.completions : {},
    target,
    unit: t.unit || '',
    counts: t.counts && typeof t.counts === 'object' ? t.counts : {},
    count: Number(t.count) || 0, // progress of a one-time counted goal
    habit: repeat ? normalizeHabit(t.habit) : null,
  };
}

function normalizeProject(p) {
  return {
    id: p.id || uid(),
    name: String(p.name || 'مشروع'),
    color: p.color || PROJECT_COLORS[0][0],
    desc: p.desc || '',
    due: p.due || '',
    created: p.created || Date.now(),
    doneAt: p.doneAt || null,
  };
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!s) {
    s = { tasks: [] };
    try {
      const old = JSON.parse(localStorage.getItem(OLD_KEY));
      if (Array.isArray(old)) s.tasks = old.map((o) => ({ ...o, doneAt: o.done ? o.created : null }));
    } catch {}
  }
  s.tasks = (s.tasks || []).map(normalize);
  s.projects = (Array.isArray(s.projects) ? s.projects : []).map(normalizeProject);
  s.settings = { name: '', accent: 'teal', theme: 'system', size: 'normal', font: 'mix', digits: 'arab', hijri: true, sound: true, prayer: null, ...(s.settings || {}) };
  s.memos = (Array.isArray(s.memos) ? s.memos : []).map(normalizeMemo);
  s.books = (Array.isArray(s.books) ? s.books : []).map(normalizeBook);
  s.benefits = (Array.isArray(s.benefits) ? s.benefits : []).map(normalizeBenefit);
  s.inspire = (Array.isArray(s.inspire) ? s.inspire : []).map(normalizeInspire);
  s.archive = (Array.isArray(s.archive) ? s.archive : []).map(normalizeArchive);
  s.ideas = (Array.isArray(s.ideas) ? s.ideas : []).map(normalizeIdea);
  s.journal = (Array.isArray(s.journal) ? s.journal : []).map(normalizeJournal);
  s.jtemplates = (Array.isArray(s.jtemplates) ? s.jtemplates : DEFAULT_TEMPLATES).map(normalizeJTemplate);
  s.hifz = (Array.isArray(s.hifz) ? s.hifz : []).map(normalizeHifz);
  s.hplans = (Array.isArray(s.hplans) ? s.hplans : []).map(normalizeHPlan);
  s.finPlans = (Array.isArray(s.finPlans) ? s.finPlans : []).map(normalizeFinPlan);
  s.finDebts = (Array.isArray(s.finDebts) ? s.finDebts : []).map(normalizeDebt);
  s.finRights = (Array.isArray(s.finRights) ? s.finRights : []).map(normalizeRight);
  s.finProjects = (Array.isArray(s.finProjects) ? s.finProjects : []).map(normalizeFinProject);
  s.finTx = (Array.isArray(s.finTx) ? s.finTx : []).map(normalizeTx);
  s.cvs = (Array.isArray(s.cvs) ? s.cvs : []).map(normalizeCV);
  s.meals = (Array.isArray(s.meals) ? s.meals : []).map(normalizeMeal);
  s.mealDone = (Array.isArray(s.mealDone) ? s.mealDone : []).map(normalizeMealDone);
  s.shop = (Array.isArray(s.shop) ? s.shop : []).map(normalizeShop);
  s.lists = (Array.isArray(s.lists) ? s.lists : DEFAULT_LISTS).map(normalizeList);
  s.subs = (Array.isArray(s.subs) ? s.subs : []).map(normalizeSub);
  s.later = (Array.isArray(s.later) ? s.later : []).map(normalizeLater);
  s.weeks = (Array.isArray(s.weeks) ? s.weeks : []).map(normalizeWeek);
  s.people = (Array.isArray(s.people) ? s.people : []).map(normalizePerson);
  s.decisions = (Array.isArray(s.decisions) ? s.decisions : []).map(normalizeDecision);
  s.quits = (Array.isArray(s.quits) ? s.quits : []).map(normalizeQuit);
  s.settings.timer = { mode: 'up', minutes: 25, brk: 5, awake: true, lastTask: '', ...(s.settings.timer || {}) };
  s.fired = s.fired || {};
  s.snoozed = s.snoozed || {};
  s.timer = s.timer || null;
  s.sessions = Array.isArray(s.sessions) ? s.sessions : [];
  return s;
}

const S = load();
const ui = {
  tab: 'today', project: '', filter: 'active', projFilter: 'active', q: '', sort: 'smart', cat: '',
  calMonth: today().slice(0, 7), calSel: today(), smart: '', timerEnded: null,
};

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast('تعذّر الحفظ. قد تكون مساحة التخزين ممتلئة.'); }
  if (typeof Sync !== 'undefined') Sync.schedule();
}
const getTask = (id) => S.tasks.find((t) => t.id === id);
const getProject = (id) => S.projects.find((p) => p.id === id);

// ---------- kinds ----------
const isGoal = (t) => t.kind === 'goal';
const isRepeat = (t) => !!t.repeat;
const isCounted = (t) => isGoal(t) && t.target > 1;
const projectOf = (t) => (t.projectId ? getProject(t.projectId) : null);
const tasksOf = (pid) => S.tasks.filter((t) => t.projectId === pid && !isGoal(t));

// ---------- prayer times ----------
const prayerMemo = new Map();
function prayerTimes(d) {
  const cfg = S.settings.prayer;
  if (!cfg) return null;
  const k = `${d}|${cfg.lat}|${cfg.lng}|${cfg.method}|${cfg.asr}`;
  if (!prayerMemo.has(k)) prayerMemo.set(k, Prayer.times(d, cfg));
  return prayerMemo.get(k);
}
function prayerPhrase(p) {
  const name = Prayer.NAMES[p.name];
  if (!p.offset) return `مع ${name}`;
  const w = minsWord(Math.abs(p.offset));
  return `${p.offset < 0 ? 'قبل' : 'بعد'} ${name} ${/^\d/.test(w) ? 'بـ ' + w : 'ب' + w}`;
}

function timeOn(t, d) {
  if (t.prayer) {
    const pt = prayerTimes(d);
    return pt ? pt[t.prayer.name] + t.prayer.offset : null;
  }
  return t.time ? minutesOf(t.time) : null;
}
const hasTime = (t) => !!(t.time || t.prayer);
function timeLabel(t, d) {
  const m = timeOn(t, d);
  if (t.prayer) return prayerPhrase(t.prayer) + (m != null ? ` (${fmtMin(m)})` : '');
  return m != null ? fmtMin(m) : '';
}

// ---------- recurrence and progress ----------
function occursOn(t, d) {
  const r = t.repeat;
  if (!r || d < r.start || (r.until && d > r.until)) return false;
  return r.days.includes(parse(d).getDay());
}
const doneOn = (t, d) => (isRepeat(t) ? !!t.completions[d] : t.done);
function countOn(t, d) {
  if (!isRepeat(t)) return t.done && !t.count ? t.target : t.count;
  return t.completions[d] && !t.counts[d] ? t.target : t.counts[d] || 0;
}
const goalEnded = (t) => isRepeat(t) ? !!(t.repeat.until && t.repeat.until < today()) : t.done;

function repeatLabel(t) {
  const r = t.repeat;
  const days = r.days.length === 7 ? 'يومياً' : DAY_ORDER.filter((d) => r.days.includes(d)).map((d) => DAY_SHORT[d]).join('، ');
  return days + (r.until ? ` حتى ${fmtDate(r.until)}` : ' بلا نهاية');
}

function goalStats(t) {
  const t0 = today();
  const end = t.repeat.until && t.repeat.until < t0 ? t.repeat.until : t0;
  let total = 0, hit = 0;
  for (let d = t.repeat.start; d <= end; d = addDays(d, 1)) {
    if (!occursOn(t, d)) continue;
    total++;
    if (t.completions[d]) hit++;
  }
  let streak = 0;
  for (let d = end; d >= t.repeat.start; d = addDays(d, -1)) {
    if (!occursOn(t, d)) continue;
    if (t.completions[d]) streak++;
    else if (d === t0) continue;
    else break;
  }
  return { total, hit, rate: pct(hit, total), streak };
}

// progress of a task counting its steps; a done task counts as complete
function taskProgress(t) {
  if (t.done) return 1;
  if (!t.subtasks.length) return 0;
  return t.subtasks.filter((s) => s.done).length / t.subtasks.length;
}
function projectStats(pid) {
  const list = tasksOf(pid);
  const steps = list.flatMap((t) => t.subtasks);
  const done = list.filter((t) => t.done).length;
  const progress = list.length ? Math.round((list.reduce((n, t) => n + taskProgress(t), 0) / list.length) * 100) : 0;
  const late = list.filter((t) => !t.done && t.due && t.due < today()).length;
  return { total: list.length, done, steps: steps.length, stepsDone: steps.filter((s) => s.done).length, progress, late };
}

// ---------- actions ----------
function setCount(t, d, n) {
  n = Math.max(0, Math.min(t.target, n));
  if (!isRepeat(t)) {
    t.count = n;
    const wasDone = t.done;
    t.done = n >= t.target;
    t.doneAt = t.done ? (wasDone ? t.doneAt : Date.now()) : null;
    return;
  }
  if (n) t.counts[d] = n; else delete t.counts[d];
  if (n >= t.target) t.completions[d] = t.completions[d] || Date.now();
  else delete t.completions[d];
}

function toggle(id, date) {
  const t = getTask(id);
  if (!t) return;
  const d = date || today();
  if (isCounted(t)) {
    const c = countOn(t, d);
    setCount(t, d, c >= t.target ? 0 : c + 1);
  } else if (isRepeat(t)) {
    if (t.completions[d]) delete t.completions[d];
    else t.completions[d] = Date.now();
  } else {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
  }
  save();
  checkGraduation(t);
  render();
  const p = projectOf(t);
  if (p && t.done) {
    const st = projectStats(p.id);
    if (st.total && st.done === st.total) toast(`أحسنت! أنجزت كل مهام مشروع «${p.name}»`);
  }
}

function step(id, date, delta) {
  const t = getTask(id);
  if (!t) return;
  setCount(t, date, countOn(t, date) + delta);
  save();
  checkGraduation(t);
  render();
}

function removeTask(id) {
  if (S.timer && S.timer.taskId === id) { S.timer = null; timerNotify(true); }
  S.tasks = S.tasks.filter((t) => t.id !== id);
  for (const k of Object.keys(S.fired)) if (k.startsWith(id + '|')) delete S.fired[k];
  for (const k of Object.keys(S.snoozed)) if (k.startsWith(id + '|')) delete S.snoozed[k];
  save();
  render();
}

// ---------- rendering: items ----------
function checkButton(t, d, done) {
  const counted = isCounted(t);
  const label = counted ? `${countOn(t, d)} من ${t.target}${t.unit ? ' ' + t.unit : ''}، اضغط للزيادة` : done ? 'إلغاء الإنجاز' : 'تمت';
  return `<button type="button" class="check${counted ? ' counted' : ''}" data-action="toggle" data-id="${t.id}" data-date="${d}" aria-pressed="${done}" aria-label="${esc(label)}">${icon('check')}${counted ? `<span class="cnt">${countOn(t, d)}</span>` : ''}</button>`;
}

const projectChip = (p) => `<span class="proj" style="--pc:${p.color}"><i></i>${esc(p.name)}</span>`;

function metaHTML(t, d, opts = {}) {
  const meta = [];
  if (isGoal(t) && !opts.noKind) meta.push(`<span class="kind-goal">${isHabit(t) ? 'عادة' : isRepeat(t) ? 'هدف متكرر' : 'هدف'}</span>`);
  const p = projectOf(t);
  if (p && !opts.noProject) meta.push(projectChip(p));
  if (!opts.noPriority) meta.push(`<span class="pri p-${t.priority}">${PRI_LABEL[t.priority]}</span>`);
  if (t.category) meta.push(`<span class="cat">${esc(t.category)}</span>`);
  if (isRepeat(t)) meta.push(`<span>${icon('repeat')}${esc(repeatLabel(t))}</span>`);
  else if (t.due && !opts.noDue) {
    const late = !t.done && t.due < today();
    meta.push(`<span class="${late ? 'late' : ''}">${icon('cal')}${late ? 'متأخرة · ' : ''}${esc(relDateH(t.due))}</span>`);
  }
  if (hasTime(t)) meta.push(`<span class="num">${icon(t.alarms.length ? 'bell' : t.prayer ? 'moon' : 'clock')}${esc(timeLabel(t, d || t.due || today()))}</span>`);
  if (isCounted(t)) meta.push(`<span class="num count-btn">${countOn(t, d || today())}/${t.target}${t.unit ? ' ' + esc(t.unit) : ''}</span>`);
  if (t.subtasks.length) meta.push(`<span class="num">${icon('steps')}${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}</span>`);
  if (t.notes.length) meta.push(`<span class="num">${icon('note')}${t.notes.length}</span>`);
  const tracked = trackedMs(t.id);
  if (tracked >= 60000) meta.push(`<span class="num">${icon('clock')}${fmtDur(tracked)}</span>`);
  return meta.join('');
}

function itemHTML(t, date, opts) {
  const d = date || today();
  const done = doneOn(t, d);
  const p = projectOf(t);
  const steps = !t.done && t.subtasks.length ? `<span class="mini-progress" aria-hidden="true"><i style="width:${taskProgress(t) * 100}%"></i></span>` : '';
  return `<li class="task p-${t.priority}${done ? ' done' : ''}${isGoal(t) ? ' is-goal' : ''}"${p ? ` style="--pc:${p.color}"` : ''}>
    ${checkButton(t, d, done)}
    <button type="button" class="t-main" data-action="open" data-id="${t.id}">
      <span class="t-title">${esc(t.title)}</span>
      <span class="meta">${metaHTML(t, d, opts)}</span>
      ${steps}
    </button>
  </li>`;
}

const emptyHTML = (title, text, action) =>
  `<div class="empty"><strong>${title}</strong><span>${text}</span>${action || ''}</div>`;
const addBtn = (action, label, extra = '') => `<button type="button" class="add-btn" data-action="${action}"${extra}>${icon('plus')}${label}</button>`;

function itemsOn(d) {
  return S.tasks.filter((t) => (isRepeat(t) ? occursOn(t, d) : t.due === d));
}

const byTime = (d) => (a, b) =>
  doneOn(a, d) - doneOn(b, d) ||
  (timeOn(a, d) ?? 9999) - (timeOn(b, d) ?? 9999) ||
  PRI[b.priority] - PRI[a.priority];

function categories() {
  return [...new Set(S.tasks.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
}

// ---------- view: today ----------
function prayerStripHTML() {
  const d = today();
  const pt = prayerTimes(d);
  if (!pt) return ''; // «اليوم» holds only today's matters; the city is set in the settings
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = Prayer.PRAYERS.find((p) => pt[p] > nowMin) || 'fajr';
  return `<div class="prayers" aria-label="أوقات الصلاة اليوم">${Prayer.PRAYERS.map((p) =>
    `<div class="${p === next ? 'next' : ''}">${Prayer.NAMES[p]}<b>${esc(fmtMin(pt[p]))}</b></div>`).join('')}</div>`;
}

function smartHTML() {
  return `<form class="smart" id="smartForm" autocomplete="off">
    <label class="smart-label" for="smartIn">${icon('spark')} أضف بسرعة بكلامك</label>
    <div class="smart-row">
      <input type="text" id="smartIn" value="${esc(ui.smart)}" placeholder="${smartAll() ? 'مهمة، أو: دفعت ١٥٠ بنزين، اشتر حليب، فكرة: …' : 'مثال: اتصل بأبي بكرة الساعة 5 العصر'}" enterkeyhint="done">
      <button type="submit" class="primary">إضافة</button>
    </div>
    ${AI.on() ? `<div class="btn-row smart-ai">${aiBtn('ai-smart', 'افهمها بالذكاء الاصطناعي')}<small class="hint">لجملة طويلة أو عدة مهام في فقرة واحدة</small></div>` : ''}
    <div id="smartPreview">${smartPreviewHTML()}</div>
  </form>`;
}

function smartToTask(r) {
  const t0 = today();
  const proj = r.category ? S.projects.find((p) => p.name === r.category) : null;
  const t = normalize({
    id: uid(), kind: r.kind === 'repeat' ? 'goal' : 'task', title: r.title, priority: r.priority,
    category: proj ? '' : r.category, projectId: proj ? proj.id : '',
    time: r.prayer ? '' : r.time, prayer: r.prayer,
    alarms: (r.time || r.prayer) ? [0, ...r.before.filter((b) => b > 0)] : [],
    created: Date.now(),
  });
  t.alarms = [...new Set(t.alarms)].sort((a, b) => a - b);
  if (r.kind === 'repeat') {
    t.repeat = { days: (r.days && r.days.length ? r.days : [...DAY_ORDER]).sort(), start: r.start || t0, until: r.until || null };
    t.target = r.target || 1;
    t.unit = r.target > 1 ? r.unit : '';
  } else {
    t.due = r.due || '';
    if (r.autoDue && t.due === t0) {
      const m = timeOn(t, t0);
      const now = new Date();
      if (m != null && m <= now.getHours() * 60 + now.getMinutes()) t.due = addDays(t0, 1);
    }
  }
  return t;
}

function smartPreviewHTML() {
  const text = ui.smart.trim();
  if (!text) {
    return `<div class="examples" aria-label="أمثلة">${SMART_EXAMPLES.map((e) => `<button type="button" data-action="example" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div>`;
  }
  const q = smartAll() && routeSmart(text);
  if (q) return routePreviewHTML(q);
  const r = SmartParse.parse(text);
  if (!r.title) return '<div class="parsed"><span class="tag warn">اكتب ما تريد فعله</span></div>';
  const t = smartToTask(r);
  const d = isRepeat(t) ? t.repeat.start : t.due || today();
  const tags = [`<span class="tag title">${esc(t.title)}</span>`];
  tags.push(`<span class="tag">${isGoal(t) ? 'هدف متكرر' : 'مهمة'}</span>`);
  const p = projectOf(t);
  if (p) tags.push(`<span class="tag">${icon('folder')}${esc(p.name)}</span>`);
  if (isRepeat(t)) tags.push(`<span class="tag">${icon('repeat')}${esc(repeatLabel(t))}</span>`);
  else if (t.due) tags.push(`<span class="tag">${icon('cal')}${esc(relDate(t.due))}</span>`);
  if (hasTime(t)) tags.push(`<span class="tag">${icon(t.prayer ? 'moon' : 'clock')}${esc(timeLabel(t, d))}</span>`);
  if (t.prayer && !S.settings.prayer) tags.push('<span class="tag warn">حدّد مدينتك في الإعدادات</span>');
  for (const a of t.alarms.filter((x) => x > 0)) tags.push(`<span class="tag">${icon('bell')}قبل ${esc(minsWord(a))}</span>`);
  if (t.target > 1) tags.push(`<span class="tag">${icon('target')}${t.target} ${esc(t.unit)} يومياً</span>`);
  if (t.priority !== 'mid') tags.push(`<span class="tag">${icon('flag')}أولوية ${PRI_LABEL[t.priority]}</span>`);
  if (t.category) tags.push(`<span class="tag">${icon('tag')}${esc(t.category)}</span>`);
  return `<div class="parsed">${tags.join('')}</div>
    <div class="smart-actions"><button type="button" class="ghost" data-action="smart-edit">تعديل قبل الإضافة</button></div>`;
}

function viewToday() {
  const d = today();
  const items = S.tasks.filter((t) => {
    if (isRepeat(t)) return occursOn(t, d);
    if (!t.done && t.due && t.due <= d) return true;
    return t.done && t.doneAt && iso(new Date(t.doneAt)) === d;
  });
  items.sort(byTime(d));
  const done = items.filter((t) => doneOn(t, d)).length;
  const p = pct(done, items.length);
  const late = items.filter((t) => !isRepeat(t) && t.due < d).length;
  const open = items.length - done;
  const summary = items.length ? (open ? `باقٍ ${open} من ${items.length}` : 'أنجزت كل ما لديك اليوم') : 'لا شيء مجدول لليوم';
  const parts = {
    close: closeTodayHTML,
    quote: dailyQuoteHTML,
    smart: smartHTML,
    summary: () => `<div class="today-card">
    <div class="ring" style="--p:${p}"><span>${p}%</span></div>
    <div class="txt">
      <b>${summary}</b>
      <span class="muted">${late ? `<span class="late">${late} متأخرة</span> · ` : ''}${esc(fmtHijri(d))}</span>
    </div>
  </div>`,
    prayer: () => todayBlock('أوقات الصلاة', '', prayerStripHTML()),
    hifz: hifzTodayHTML,
    habits: todayHabitsHTML,
    health: healthTodayHTML,
    books: booksTodayHTML,
    benefits: () => todayBlock('الفوائد', 'benefits', dailyBenefitHTML()),
    decisions: decisionsTodayHTML,
    people: peopleTodayHTML,
    bills: billsTodayHTML,
    later: laterTodayHTML,
    journal: () => todayBlock('يومياتي وتأملاتي', 'journal', journalTodayHTML()),
    spend: spendTodayHTML,
    lists: shopTodayHTML,
    tasks: () => `<section class="section">
    <div class="section-head"><h2>المهام والأهداف</h2>${addBtn('new', 'مهمة')}</div>
    ${items.some((t) => !isHabit(t))
      ? `<ul class="list">${items.filter((t) => !isHabit(t)).map((t) => itemHTML(t, d)).join('')}</ul>`
      : emptyHTML('لا مهام لليوم', 'المهام التي تاريخها اليوم وأهدافك اليومية تظهر هنا، وعاداتك في «بناء العادات» أعلاه.')}
  </section>`,
  };
  const hidden = todayHidden();
  return `${todayOrder().filter((k) => !hidden.includes(k)).map((k) => parts[k]()).join('\n')}
  <div class="lay-open"><button type="button" class="ghost sm" data-action="lay-open" data-v="today">${icon('gear')} رتّب صفحة اليوم</button></div>`;
}

// ---------- view: tasks & projects ----------
function projectCardHTML(p) {
  const st = projectStats(p.id);
  const sub = st.total ? `${st.done}/${st.total} مهام${st.steps ? ` · ${st.stepsDone}/${st.steps} خطوات` : ''}` : 'لا مهام بعد';
  return `<button type="button" class="pcard" data-action="open-project" data-v="${p.id}" style="--pc:${p.color}">
    <span class="pcard-top"><i class="pdot"></i><span class="pname">${esc(p.name)}</span></span>
    <span class="pbar"><i style="width:${st.progress}%"></i></span>
    <span class="psub"><span class="num">${st.progress}%</span><span>${sub}</span></span>
    ${st.late ? `<span class="late psub">${st.late} متأخرة</span>` : ''}
  </button>`;
}

function taskToolbar(filterKey, withSearch) {
  const cur = ui[filterKey];
  const seg = [['active', 'الحالية'], ['done', 'المنجزة'], ['all', 'الكل']]
    .map(([v, l]) => `<button type="button" data-action="filter" data-k="${filterKey}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('');
  return `<div class="toolbar">
    ${withSearch ? `<input type="search" id="search" placeholder="ابحث في كل المهام" aria-label="بحث" value="${esc(ui.q)}">` : ''}
    <div class="seg" role="group" aria-label="عرض">${seg}</div>
    <select id="sort" aria-label="الترتيب">
      <option value="smart"${ui.sort === 'smart' ? ' selected' : ''}>الأهم أولاً</option>
      <option value="due"${ui.sort === 'due' ? ' selected' : ''}>حسب التاريخ</option>
      <option value="created"${ui.sort === 'created' ? ' selected' : ''}>الأحدث</option>
    </select>
  </div>`;
}

function sortTasks(list, filter) {
  const t0 = today();
  return list.sort((a, b) => {
    if (filter === 'done') return (b.doneAt || 0) - (a.doneAt || 0);
    if (ui.sort === 'created') return b.created - a.created;
    if (ui.sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999') || (timeOn(a, a.due) ?? 9999) - (timeOn(b, b.due) ?? 9999);
    const lateA = a.due && a.due < t0, lateB = b.due && b.due < t0;
    return a.done - b.done || lateB - lateA || PRI[b.priority] - PRI[a.priority] || (a.due || '9999').localeCompare(b.due || '9999');
  });
}
const matchFilter = (t, f) => f === 'all' || (f === 'done') === t.done;

function viewTasks() {
  if (ui.project && getProject(ui.project)) return viewProject(getProject(ui.project));
  ui.project = '';
  const q = ui.q.trim().toLowerCase();
  if (q) {
    const hits = S.tasks.filter((t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) ||
      t.notes.some((n) => n.text.toLowerCase().includes(q)) || t.subtasks.some((n) => n.text.toLowerCase().includes(q)) ||
      ((projectOf(t) || {}).name || '').toLowerCase().includes(q));
    return `${taskToolbar('filter', true)}
      <section class="section"><div class="section-head"><h2>نتائج البحث</h2><small>${hits.length}</small></div>
      ${hits.length ? `<ul class="list">${sortTasks(hits, 'all').map((t) => itemHTML(t, t.due || today())).join('')}</ul>` : emptyHTML('لا نتائج', 'جرّب كلمة أخرى.')}</section>`;
  }
  const projects = S.projects.slice().sort((a, b) => (!!a.doneAt - !!b.doneAt) || a.created - b.created);
  const general = sortTasks(S.tasks.filter((t) => !isGoal(t) && !t.projectId && matchFilter(t, ui.filter)), ui.filter);
  const anyGeneral = S.tasks.some((t) => !isGoal(t) && !t.projectId);
  return `
  <section class="section">
    <div class="section-head"><h2>المشاريع</h2>${addBtn('new-project', 'مشروع')}</div>
    ${projects.length
      ? `<div class="pgrid">${projects.map(projectCardHTML).join('')}</div>`
      : emptyHTML('لا مشاريع بعد', 'المشروع يجمع مهام لهدف واحد، مثل «تجهيز السفر» أو «مشروع التخرج». ولكل مهمة خطوات.', addBtn('new-project', 'أنشئ أول مشروع'))}
  </section>
  <section class="section">
    <div class="section-head"><h2>مهام عامة</h2>${addBtn('new', 'مهمة')}</div>
    ${anyGeneral ? taskToolbar('filter', true) : ''}
    ${general.length
      ? `<ul class="list">${general.map((t) => itemHTML(t, t.due || today())).join('')}</ul>`
      : anyGeneral ? emptyHTML(ui.filter === 'done' ? 'لا مهام منجزة بعد' : 'لا مهام حالية', 'كل شيء مُنجز هنا.')
        : emptyHTML('لا مهام عامة', 'المهام التي لا تتبع مشروعاً تظهر هنا.')}
  </section>`;
}

function viewProject(p) {
  const st = projectStats(p.id);
  const list = sortTasks(tasksOf(p.id).filter((t) => matchFilter(t, ui.projFilter)), ui.projFilter);
  return `
  <div class="crumbs"><button type="button" class="back" data-action="close-project">${icon('back')} كل المشاريع</button></div>
  <section class="phead" style="--pc:${p.color}">
    <div class="row-between">
      <h2><i class="pdot"></i>${esc(p.name)}</h2>
      <button type="button" class="ghost" data-action="edit-project" data-v="${p.id}">${icon('edit')} تعديل</button>
    </div>
    ${p.desc ? `<p class="note-text">${esc(p.desc)}</p>` : ''}
    <div class="pbar big"><i style="width:${st.progress}%"></i></div>
    <div class="pstats">
      <span><b class="num">${st.progress}%</b> الإنجاز</span>
      <span><b class="num">${st.done}/${st.total}</b> مهام</span>
      <span><b class="num">${st.stepsDone}/${st.steps}</b> خطوات</span>
      ${p.due ? `<span class="${p.due < today() && st.progress < 100 ? 'late' : ''}">${icon('flag')} ينتهي ${esc(relDateH(p.due))}</span>` : ''}
    </div>
  </section>
  <section class="section">
    <div class="section-head"><h2>مهام المشروع</h2><div class="btn-row">${aiBtn('ai-plan', 'خطّط المشروع', ` data-v="${p.id}"`)}${addBtn('new-in-project', 'مهمة', ` data-v="${p.id}"`)}</div></div>
    ${st.total ? taskToolbar('projFilter', false) : ''}
    ${list.length
      ? `<ul class="list">${list.map((t) => itemHTML(t, t.due || today(), { noProject: true })).join('')}</ul>`
      : st.total ? emptyHTML('لا شيء هنا', ui.projFilter === 'done' ? 'لم تنجز مهام بعد.' : 'أنجزت كل مهام المشروع.')
        : emptyHTML('المشروع فارغ', 'أضف أول مهمة، ثم افتحها لتضيف لها خطوات.', addBtn('new-in-project', 'أضف مهمة', ` data-v="${p.id}"`))}
  </section>`;
}

// ---------- view: calendar ----------
function markOf(t, d) {
  const p = projectOf(t);
  const cls = ['m', isGoal(t) ? 'm-goal' : p ? 'm-proj' : 'm-task', doneOn(t, d) ? 'm-done' : ''].join(' ');
  return `<i class="${cls}"${p ? ` style="--pc:${p.color}"` : ''}></i>`;
}

function viewCalendar() {
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() - 6 + 7) % 7; // weeks start on Saturday
  const daysIn = new Date(y, m, 0).getDate();
  const total = Math.ceil((lead + daysIn) / 7) * 7;
  const t0 = today();
  const cells = [];
  const projectsShown = new Set();
  for (let i = 0; i < total; i++) {
    const d = iso(new Date(y, m - 1, 1 - lead + i));
    const out = d.slice(0, 7) !== ui.calMonth;
    const items = itemsOn(d);
    if (!out) for (const t of items) if (t.projectId) projectsShown.add(t.projectId);
    const marks = items.slice(0, 4).map((t) => markOf(t, d)).join('') + (items.length > 4 ? `<span class="more">+${items.length - 4}</span>` : '');
    const label = `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${items.length ? `، ${items.length} عنصر` : ''}`;
    cells.push(`<button type="button" class="cal-day${out ? ' out' : ''}${d === t0 ? ' today' : ''}${d === ui.calSel ? ' sel' : ''}" data-action="cal-day" data-v="${d}" aria-label="${esc(label)}" aria-pressed="${d === ui.calSel}"><span class="n">${parse(d).getDate()}</span>${S.settings.hijri ? `<span class="hd">${esc(fmtHijri(d, { day: 'numeric' }))}</span>` : ''}<span class="marks">${marks}</span></button>`);
  }
  const monthName = first.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  const lastIso = iso(new Date(y, m, 0));
  const h1 = fmtHijri(iso(first), { month: 'long', year: 'numeric' });
  const h2 = fmtHijri(lastIso, { month: 'long', year: 'numeric' });
  const hijri = h1 === h2 ? h1 : `${fmtHijri(iso(first), { month: 'long' })} – ${h2}`;
  const sel = ui.calSel;
  const selItems = itemsOn(sel).sort(byTime(sel));
  const legendProjects = [...projectsShown].map(getProject).filter(Boolean);
  return `
  <div class="cal-head">
    <div class="nav"><button type="button" data-action="cal-move" data-v="-1" aria-label="الشهر السابق">${icon('prev')}</button></div>
    <div class="titles"><h2>${esc(monthName)}</h2><small>${esc(hijri)}</small></div>
    <div class="nav"><button type="button" data-action="cal-move" data-v="1" aria-label="الشهر التالي">${icon('next')}</button></div>
  </div>
  <div class="cal">
    <div class="cal-grid">
      ${DAY_ORDER.map((d) => `<div class="cal-dow">${DAY_SHORT[d]}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="cal-legend">
      <span><i class="m m-task"></i>مهمة</span>
      <span><i class="m m-goal"></i>هدف</span>
      ${legendProjects.map((p) => `<span><i class="m m-proj" style="--pc:${p.color}"></i>${esc(p.name)}</span>`).join('')}
      <span><i class="m m-task m-done"></i>منجز</span>
      ${ui.calMonth !== t0.slice(0, 7) || sel !== t0 ? '<button type="button" class="chip" data-action="cal-today">اليوم</button>' : ''}
    </div>
  </div>
  <section class="section">
    <div class="section-head">
      <h2>${esc(fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
      <div class="btn-row">${addBtn('new-on', 'مهمة', ` data-v="${sel}"`)}${addBtn('new-goal-on', 'هدف', ` data-v="${sel}"`)}</div>
    </div>
    <small class="hint">${esc(fmtHijri(sel))}</small>
    ${selItems.length ? `<ul class="list">${selItems.map((t) => itemHTML(t, sel)).join('')}</ul>` : emptyHTML('لا شيء في هذا اليوم', 'أضف مهمة أو هدفاً بتاريخ هذا اليوم.')}
  </section>`;
}

// ---------- view: goals ----------
function stepperHTML(t, d) {
  const c = countOn(t, d);
  return `<div class="stepper-row">
    <div class="stepper">
      <button type="button" data-action="step" data-id="${t.id}" data-date="${d}" data-v="-1" aria-label="إنقاص">−</button>
      <span class="val">${c} / ${t.target}${t.unit ? ' ' + esc(t.unit) : ''}</span>
      <button type="button" data-action="step" data-id="${t.id}" data-date="${d}" data-v="1" aria-label="زيادة">+</button>
    </div>
    <div class="progress-line"><i style="width:${pct(c, t.target)}%"></i></div>
  </div>`;
}

function recurringGoalHTML(t) {
  const t0 = today();
  const occursToday = occursOn(t, t0);
  const done = occursToday && !!t.completions[t0];
  const st = goalStats(t);
  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(t0, -i);
    const occ = occursOn(t, d);
    const cls = !occ ? 'off' : t.completions[d] ? 'hit' : d < t0 ? 'miss' : '';
    dots.push(`<span class="dot ${cls}${d === t0 ? ' today' : ''}" title="${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))}"><i></i>${DAY_SHORT[parse(d).getDay()].slice(0, 2)}</span>`);
  }
  const notStarted = t.repeat.start > t0;
  return `<li class="goal${done ? ' done' : ''}">
    <div class="goal-top">
      ${occursToday ? checkButton(t, t0, done) : `<button type="button" class="check" disabled aria-label="ليس مجدولاً اليوم">${icon('check')}</button>`}
      <button type="button" class="t-main" data-action="open" data-id="${t.id}">
        <span class="t-title">${esc(t.title)}</span>
        <span class="meta">${metaHTML(t, t0, { noPriority: true, noKind: true })}</span>
      </button>
    </div>
    ${isCounted(t) && occursToday ? stepperHTML(t, t0) : ''}
    ${notStarted ? `<p class="note-text">يبدأ ${esc(relDate(t.repeat.start))}</p>` : `
    <div class="goal-stats">
      <span>السلسلة الحالية: <b>${daysWord(st.streak)}</b></span>
      <span>الالتزام: <b>${st.rate}%</b> (${st.hit}/${st.total})</span>
    </div>
    <div class="dots" aria-label="آخر 7 أيام">${dots.join('')}</div>`}
  </li>`;
}

function onceGoalHTML(t) {
  const t0 = today();
  const left = t.due && !t.done ? Math.round((parse(t.due) - parse(t0)) / 86400000) : null;
  const deadline = t.due ? (t.done ? `أُنجز ${t.doneAt ? esc(relDate(iso(new Date(t.doneAt)))) : ''}`
    : left < 0 ? `<span class="late">تأخر ${daysWord(-left)}</span>` : left === 0 ? 'الموعد اليوم' : `باقٍ ${daysWord(left)} (${esc(relDateH(t.due))})`) : (t.done ? 'أُنجز' : 'بلا موعد نهائي');
  return `<li class="goal${t.done ? ' done' : ''}">
    <div class="goal-top">
      ${checkButton(t, t0, t.done)}
      <button type="button" class="t-main" data-action="open" data-id="${t.id}">
        <span class="t-title">${esc(t.title)}</span>
        <span class="meta">${metaHTML(t, t0, { noPriority: true, noKind: true, noDue: true })}</span>
      </button>
    </div>
    ${isCounted(t) && !t.done ? stepperHTML(t, t0) : ''}
    <div class="goal-stats"><span>${icon('flag')} ${deadline}</span></div>
  </li>`;
}

function viewGoals() {
  const goals = S.tasks.filter(isGoal);
  const t0 = today();
  const recurring = goals.filter((t) => isRepeat(t) && !isHabit(t) && !goalEnded(t)).sort((a, b) => (timeOn(a, t0) ?? 9999) - (timeOn(b, t0) ?? 9999));
  const once = goals.filter((t) => !isRepeat(t) && !t.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const finished = goals.filter((t) => goalEnded(t) && !(isHabit(t) && habitStats(t).graduated));
  return `
  ${habitsSectionHTML()}
  ${quitsSectionHTML()}
  <section class="section">
    <div class="section-head"><h2>أهداف متكررة</h2>${addBtn('new-goal', 'هدف متكرر')}</div>
    ${recurring.length ? `<ul class="list">${recurring.map(recurringGoalHTML).join('')}</ul>`
      : emptyHTML('لا أهداف متكررة', 'عادة تتكرر يومياً أو في أيام تختارها، إلى تاريخ محدد أو بلا نهاية. مثل «8 أكواب ماء يومياً».')}
  </section>
  <section class="section">
    <div class="section-head"><h2>أهداف لمرة واحدة</h2>${addBtn('new-goal-once', 'هدف')}</div>
    ${once.length ? `<ul class="list">${once.map(onceGoalHTML).join('')}</ul>`
      : emptyHTML('لا أهداف لمرة واحدة', 'هدف تحققه مرة حتى موعد تحدده، مثل «قراءة 12 كتاباً قبل نهاية السنة».')}
  </section>
  ${finished.length ? `<section class="section"><div class="section-head"><h2>أهداف مكتملة أو منتهية</h2><small>${finished.length}</small></div>
    <ul class="list">${finished.map((t) => (isRepeat(t) ? recurringGoalHTML(t) : onceGoalHTML(t))).join('')}</ul></section>` : ''}`;
}

// ---------- view: stats ----------
// every completed thing with its day: tasks, goals (each day of a recurring goal) and steps
function completionEvents() {
  const ev = [];
  for (const t of S.tasks) {
    const cat = t.category || 'بلا تصنيف';
    if (isRepeat(t)) for (const d of Object.keys(t.completions)) ev.push({ d, cat, type: 'goal' });
    else if (t.done && t.doneAt) ev.push({ d: iso(new Date(t.doneAt)), cat, type: isGoal(t) ? 'goal' : 'task', projectId: t.projectId });
    for (const s of t.subtasks) if (s.done && s.doneAt) ev.push({ d: iso(new Date(s.doneAt)), type: 'step', projectId: t.projectId });
  }
  return ev;
}

function streaks(byDay) {
  const t0 = today();
  let cur = 0;
  let d = byDay[t0] ? t0 : addDays(t0, -1);
  while (byDay[d]) { cur++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = null;
  for (const x of Object.keys(byDay).sort()) {
    run = prev && addDays(prev, 1) === x ? run + 1 : 1;
    best = Math.max(best, run);
    prev = x;
  }
  return { cur, best };
}

function chartSVG(byDay) {
  const t0 = today();
  const N = 14;
  const days = Array.from({ length: N }, (_, i) => addDays(t0, i - (N - 1)));
  const counts = days.map((d) => byDay[d] || 0);
  let max = Math.max(4, ...counts);
  max = Math.ceil(max / 2) * 2;
  const W = 560, H = 190, padL = 6, padR = 30, padT = 10, padB = 26;
  const pw = W - padL - padR, ph = H - padT - padB;
  const bw = pw / N, gap = 6, w = bw - gap;
  const y = (v) => padT + ph - (v / max) * ph;
  const parts = [];
  for (const v of [0, max / 2, max]) {
    parts.push(`<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`);
    parts.push(`<text class="axis" x="${W - padR + 6}" y="${y(v) + 4}" text-anchor="start">${v}</text>`);
  }
  days.forEach((d, i) => {
    const x = padL + (N - 1 - i) * bw + gap / 2; // RTL: today on the left
    const v = counts[i];
    const label = `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${v} ${v === 1 ? 'إنجاز' : 'إنجازات'}`;
    let bar = `<rect class="zero" x="${x}" y="${y(0) - 2}" width="${w}" height="2" rx="1"/>`;
    if (v > 0) {
      const top = y(v), r = Math.min(4, y(0) - top, w / 2);
      bar = `<path class="bar" d="M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y(0)} Z"/>`;
    }
    parts.push(`<g class="col" data-tip="${esc(label)}"><rect class="hit" x="${x - gap / 2}" y="${padT}" width="${bw}" height="${ph + padB}"><title>${esc(label)}</title></rect>${bar}</g>`);
    if (i === N - 1 || (N - 1 - i) % 3 === 0) {
      parts.push(`<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${i === N - 1 ? 'اليوم' : parse(d).getDate()}</text>`);
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" direction="ltr" role="img" aria-label="الإنجازات في آخر 14 يوماً">${parts.join('')}</svg>`;
}

const hbar = (name, value, width, color) =>
  `<li class="hbar"><span class="name">${name}</span><span class="track"><span class="fill" style="width:${width}%;${color ? ` background:${color};` : ''} display:block"></span></span><span class="v">${value}</span></li>`;

function focusPanelHTML() {
  if (!S.sessions.length) return '';
  const t0 = today();
  const weekStart = addDays(t0, -6);
  const week = S.sessions.filter((x) => sessionDay(x) >= weekStart);
  const todayMs = week.filter((x) => sessionDay(x) === t0).reduce((n, x) => n + x.ms, 0);
  const weekMs = week.reduce((n, x) => n + x.ms, 0);
  const by = {};
  for (const x of week) by[x.taskId] = (by[x.taskId] || 0) + x.ms;
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = rows.length ? rows[0][1] : 1;
  return `<section class="panel">
    <h2>وقت التركيز</h2>
    <p class="note-text">اليوم <b>${fmtDur(todayMs)}</b> · آخر 7 أيام <b>${fmtDur(weekMs)}</b></p>
    ${rows.length ? `<ul class="hbars">${rows.map(([id, ms]) => hbar(esc((getTask(id) || {}).title || 'مهمة محذوفة'), fmtDur(ms), (ms / max) * 100)).join('')}</ul>` : ''}
  </section>`;
}

function viewStats() {
  const ev = completionEvents();
  const main = ev.filter((e) => e.type !== 'step');
  const byDay = {};
  for (const e of main) byDay[e.d] = (byDay[e.d] || 0) + 1;
  const t0 = today();
  const weekStart = addDays(t0, -6);
  const week = main.filter((e) => e.d >= weekStart).length;
  const stepsWeek = ev.filter((e) => e.type === 'step' && e.d >= weekStart).length;
  const { cur, best } = streaks(byDay);
  const byCat = {};
  for (const e of main) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catMax = cats.length ? cats[0][1] : 1;
  const recurring = S.tasks.filter((t) => isRepeat(t) && !isHabit(t) && t.repeat.start <= t0).map((t) => ({ t, st: goalStats(t) }));
  const once = S.tasks.filter((t) => isGoal(t) && !isRepeat(t));
  const tasks = S.tasks.filter((t) => !isGoal(t));
  const projects = S.projects.map((p) => ({ p, st: projectStats(p.id) })).filter((x) => x.st.total);

  return `
  <div class="tiles">
    <div class="tile"><b>${byDay[t0] || 0}</b><span>أنجزت اليوم</span></div>
    <div class="tile"><b>${week}</b><span>آخر 7 أيام</span></div>
    <div class="tile"><b>${stepsWeek}</b><span>خطوات في 7 أيام</span></div>
    <div class="tile"><b>${cur}</b><span>أيام متتالية · الأفضل ${best}</span></div>
  </div>
  <section class="panel chart">
    <h2>المهام والأهداف المنجزة في آخر 14 يوماً</h2>
    <div class="readout" id="readout">المس عموداً لترى تفاصيل اليوم.</div>
    ${chartSVG(byDay)}
  </section>
  <section class="panel">
    <h2>المشاريع</h2>
    ${projects.length ? `<ul class="hbars">${projects.map(({ p, st }) => hbar(`<span class="proj" style="--pc:${p.color}"><i></i>${esc(p.name)}</span>`, `${st.progress}%`, st.progress, p.color)).join('')}</ul>
      <p class="note-text">النسبة تحسب المهام المنجزة وخطوات المهام التي لم تكتمل بعد.</p>`
      : '<p class="note-text">أنشئ مشروعاً وأضف له مهاماً لترى تقدّمه هنا.</p>'}
  </section>
  <section class="panel">
    <h2>الأهداف</h2>
    ${recurring.length || once.length ? `<ul class="hbars">
      ${recurring.map(({ t, st }) => hbar(esc(t.title), `${st.rate}%`, st.rate)).join('')}
      ${once.map((t) => { const v = pct(countOn(t, t0), t.target); return hbar(esc(t.title), t.done ? 'تحقق' : `${v}%`, t.done ? 100 : v); }).join('')}
    </ul><p class="note-text">المتكرر: نسبة الأيام التي التزمت فيها. لمرة واحدة: مقدار ما تحقق.</p>`
      : '<p class="note-text">أضف هدفاً لتتابع التزامك به.</p>'}
  </section>
  ${habitsPanelHTML()}
  ${focusPanelHTML()}
  ${readingPanelHTML()}
  <section class="panel">
    <h2>حسب التصنيف</h2>
    ${cats.length ? `<ul class="hbars">${cats.map(([c, n]) => hbar(esc(c), n, (n / catMax) * 100)).join('')}</ul>`
      : '<p class="note-text">ستظهر هنا بعد أن تنجز أول مهمة.</p>'}
  </section>
  <p class="note-text">لديك ${tasks.filter((t) => !t.done).length} مهام مفتوحة من أصل ${tasks.length}، و${S.projects.length} ${S.projects.length === 1 ? 'مشروع' : 'مشاريع'}.</p>`;
}

// ---------- view: settings ----------
function notifStatus() {
  if (!('Notification' in window)) return '<span class="status-bad">هذا المتصفح لا يدعم الإشعارات. ثبّت التطبيق على الشاشة الرئيسية أولاً.</span>';
  if (Notification.permission === 'granted') return '<span class="status-ok">الإشعارات مفعّلة</span>';
  if (Notification.permission === 'denied') return '<span class="status-bad">الإشعارات محظورة. فعّلها من إعدادات المتصفح أو الجوال.</span>';
  return '<span>الإشعارات غير مفعّلة بعد</span>';
}

function prayerSettingsHTML() {
  const cfg = S.settings.prayer;
  const cityVal = cfg ? cfg.city : '';
  const pt = prayerTimes(today());
  return `<section class="panel">
    <h2>أوقات الصلاة</h2>
    <p class="note-text">تُحسب على جوالك دون إنترنت، وتستخدمها المهام المرتبطة بالصلاة مثل «بعد العصر».</p>
    <label class="field"><span>المدينة</span>
      <select id="setCity">
        <option value=""${!cfg ? ' selected' : ''}>لا أريد أوقات الصلاة</option>
        ${cfg && cfg.city === 'here' ? `<option value="here" selected>موقعي الحالي</option>` : ''}
        ${Prayer.CITIES.map((c) => `<option value="${c.id}"${cityVal === c.id ? ' selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </label>
    <div class="btn-row"><button type="button" class="ghost" data-action="geo">${icon('pin')} استخدم موقعي الحالي</button></div>
    ${cfg ? `
    <div class="grid2">
      <label class="field"><span>طريقة الحساب</span>
        <select id="setMethod">${Object.entries(Prayer.METHODS).map(([k, m]) => `<option value="${k}"${cfg.method === k ? ' selected' : ''}>${m.name}</option>`).join('')}</select>
      </label>
      <label class="field"><span>العصر</span>
        <select id="setAsr"><option value="standard"${cfg.asr !== 'hanafi' ? ' selected' : ''}>الجمهور</option><option value="hanafi"${cfg.asr === 'hanafi' ? ' selected' : ''}>الحنفي</option></select>
      </label>
    </div>
    <div class="prayers">${Prayer.PRAYERS.map((p) => `<div>${Prayer.NAMES[p]}<b>${esc(fmtMin(pt[p]))}</b></div>`).join('')}</div>
    <p class="note-text">الشروق ${esc(fmtMin(pt.sunrise))}. تُحسب بتوقيت جوالك، فاختر مدينة في نفس منطقتك الزمنية.</p>` : ''}
  </section>`;
}

function viewSettings() {
  const st = S.settings;
  const segBtn = (action, v, label, cur) => `<button type="button" data-action="${action}" data-v="${v}" aria-pressed="${cur === v}">${label}</button>`;
  return `<div class="settings">
  <h2>التخصيص والإعدادات</h2>
  <section class="panel">
    <h2>شخصي</h2>
    <label class="field"><span>اسمك (يظهر في التحية)</span><input type="text" id="setName" value="${esc(st.name)}" autocomplete="off" placeholder="مثال: مهند"></label>
  </section>
  <section class="panel">
    <h2>المظهر</h2>
    <div class="field"><span>لون التطبيق</span>
      <div class="swatches">${Object.entries(ACCENTS).map(([k, a]) => `<button type="button" class="swatch" data-action="accent" data-v="${k}" aria-pressed="${st.accent === k}" aria-label="${a.name}" title="${a.name}" style="background:${isDark() ? a.dark : a.light}"></button>`).join('')}</div>
    </div>
    <div class="field"><span>الوضع</span>
      <div class="seg">${segBtn('theme', 'system', 'تلقائي', st.theme)}${segBtn('theme', 'light', 'فاتح', st.theme)}${segBtn('theme', 'dark', 'داكن', st.theme)}</div>
    </div>
    <div class="field"><span>الخط</span>
      <div class="font-pick">${[
        ['mix', 'رقعة ونسخ', 'العناوين بالرقعة والنصوص بالنسخ', '"Aref Ruqaa"', '"Amiri"'],
        ['naskh', 'نسخ', 'خط النسخ في كل التطبيق', '"Amiri"', '"Amiri"'],
        ['ruqaa', 'رقعة', 'خط الرقعة في كل التطبيق', '"Aref Ruqaa"', '"Aref Ruqaa"'],
      ].map(([v, name, desc, fd, fb]) => `<button type="button" data-action="font" data-v="${v}" aria-pressed="${(st.font || 'mix') === v}">
        <span class="big" style="font-family:${esc(fd)}, serif">${name}: مهامي اليوم</span>
        <small style="font-family:${esc(fb)}, serif">${desc} · اتصل بأبي الساعة 5 العصر</small></button>`).join('')}</div>
    </div>
    <div class="field"><span>الأرقام</span>
      <div class="seg">${segBtn('digits', 'arab', 'عربية ١٢٣', st.digits)}${segBtn('digits', 'latn', 'إنجليزية 123', st.digits)}</div>
    </div>
    <label class="switch"><input type="checkbox" id="setHijri"${st.hijri ? ' checked' : ''}><span>إظهار التاريخ الهجري بجانب الميلادي</span></label>
    <div class="field"><span>حجم الخط</span>
      <div class="seg">${segBtn('size', 'normal', 'عادي', st.size)}${segBtn('size', 'big', 'كبير', st.size)}</div>
    </div>
  </section>
  ${smartSettingsHTML()}
  ${Sync.settingsHTML()}
  ${aiSettingsHTML()}
  ${Voice.settingsHTML()}
  ${prayerSettingsHTML()}
  <section class="panel">
    <h2>المنبهات</h2>
    <p class="note-text" id="notifStatus">${notifStatus()}</p>
    <div class="btn-row">
      ${'Notification' in window && Notification.permission === 'default' ? '<button type="button" class="primary" data-action="notif">تفعيل الإشعارات</button>' : ''}
      <button type="button" class="ghost" data-action="test-alarm">تجربة المنبه</button>
    </div>
    <label class="switch"><input type="checkbox" id="setSound"${st.sound ? ' checked' : ''}><span>صوت التنبيه داخل التطبيق</span></label>
    <p class="note-text">يرن المنبه والتطبيق مفتوح أو في الخلفية. الجوال قد يوقف التطبيقات المغلقة تماماً، فللمواعيد المهمة افتح المهمة واضغط «إضافة إلى تقويم الجوال».</p>
  </section>
  <section class="panel">
    <h2>نسخة احتياطية</h2>
    <p class="note-text">بياناتك محفوظة على هذا الجهاز فقط. صدّرها لتنقلها إلى جهاز آخر أو تحتفظ بنسخة.</p>
    <div class="btn-row">
      <button type="button" class="ghost" data-action="export">تصدير البيانات</button>
      <button type="button" class="ghost" data-action="import">استيراد من ملف</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
    </div>
  </section>
  <section class="panel">
    <h2>تحديث التطبيق</h2>
    <p class="note-text">إذا لم يعمل زر أو قسم، اضغط هنا ليُحمَّل التطبيق من جديد. مهامك لن تُحذف.</p>
    <div class="row-between"><button type="button" class="ghost" data-action="hard-refresh">تحديث التطبيق الآن</button><span class="note-text">الإصدار ${APP_VERSION}</span></div>
  </section>
  <section class="panel">
    <h2>البيانات</h2>
    <div class="row-between">
      <span class="note-text">${S.tasks.length} مهمة وهدف، ${S.projects.length} مشروع، ${S.memos.length} ملاحظة، ${S.books.length} كتاب، ${S.benefits.length} فائدة، ${S.inspire.length} عبارة وصورة</span>
      <button type="button" class="danger" data-action="wipe">حذف كل البيانات</button>
    </div>
  </section>
  </div>`;
}

const VIEWS = {
  today: viewToday, tasks: viewTasks, timer: () => viewTimer(), calendar: viewCalendar, goals: viewGoals,
  stats: () => moreCrumb() + viewStats(), settings: viewSettings, ...LibraryViews,
};
const MORE_TABS = ['more', 'week', 'health', 'shop', 'finance', 'cv', 'ideas', 'journal', 'hifz', 'people', 'decisions', 'notes', 'books', 'benefits', 'inspire', 'archive', 'report', 'stats'];

function render() {
  const view = $('view');
  const active = document.activeElement && view.contains(document.activeElement) ? document.activeElement.id : null;
  const caret = active && 'selectionStart' in document.activeElement ? document.activeElement.selectionStart : null;
  view.innerHTML = VIEWS[ui.tab]();
  hydrateImages(view);
  if (active && $(active)) {
    $(active).focus();
    try { if (caret != null) $(active).setSelectionRange(caret, caret); } catch {}
  }
  const navTab = MORE_TABS.includes(ui.tab) ? 'more' : ui.tab;
  for (const b of document.querySelectorAll('[data-tab]')) {
    if (b.closest('#view') || b.closest('dialog')) continue;
    const cur = b.closest('#tabbar') ? navTab : ui.tab;
    if (b.dataset.tab === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  document.body.dataset.view = ui.tab;
  tickTimer();
  renderGreeting();
  $('cats').innerHTML = categories().map((c) => `<option value="${esc(c)}">`).join('');
}

function renderGreeting() {
  const name = S.settings.name.trim();
  const hello = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const t0 = today();
  $('greeting').textContent = `${hello}${name ? '، ' + name : ''} · ${fmtDate(t0, { weekday: 'long', day: 'numeric', month: 'long' })}${S.settings.hijri ? ` · ${fmtHijri(t0)}` : ''}`;
}

function go(tab, project) {
  ui.tab = tab;
  if (project !== undefined) ui.project = project;
  render();
  window.scrollTo({ top: 0 });
  history.replaceState(history.state, '', '#' + tab);
}

// ---------- Arabic-Indic numerals ----------
// Every number shown on screen is converted (text only: input values, attributes and stored data
// keep Western digits so dates, sorting and Excel stay correct).
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
// links and e-mail addresses keep their digits
const toArabicDigits = (s) => s.replace(/(https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+)|[0-9]/g, (m, keep) => keep || AR_DIGITS[m]).replace(/([٠-٩])\s?%/g, '$1٪');
const digitsOut = (s) => (S.settings.digits === 'arab' ? toArabicDigits(String(s)) : String(s));
const SKIP_DIGITS = new Set(['TEXTAREA', 'SCRIPT', 'STYLE', 'TITLE']);
// editable text, and anything marked data-latin (an English CV, phone numbers), keeps its digits
const inEditable = (n) => { const el = n.nodeType === 1 ? n : n.parentNode; return !!(el && el.closest && el.closest('[contenteditable], [data-latin]')); };
function localizeDigits(root) {
  if (S.settings.digits !== 'arab' || !root) return;
  if (root.nodeType === 3) {
    if (/[0-9]/.test(root.nodeValue) && !(root.parentNode && SKIP_DIGITS.has(root.parentNode.nodeName)) && !inEditable(root)) setDigits(root);
    return;
  }
  if (root.nodeType !== 1 || SKIP_DIGITS.has(root.nodeName) || inEditable(root)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (/[0-9]/.test(n.nodeValue) && !SKIP_DIGITS.has(n.parentNode.nodeName) && !inEditable(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) setDigits(n);
}
// only write when something changed: rewriting a link's digits as-is would re-fire the observer forever
function setDigits(n) { const v = toArabicDigits(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
new MutationObserver((muts) => {
  if (S.settings.digits !== 'arab') return;
  for (const m of muts) {
    if (m.type === 'characterData') localizeDigits(m.target);
    else for (const n of m.addedNodes) localizeDigits(n);
  }
}).observe(document.body, { subtree: true, childList: true, characterData: true });

// ---------- theme ----------
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = () => S.settings.theme === 'dark' || (S.settings.theme === 'system' && mq.matches);
function applyTheme() {
  const root = document.documentElement;
  if (S.settings.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.settings.theme);
  root.setAttribute('data-size', S.settings.size);
  root.setAttribute('data-font', S.settings.font || 'mix');
  const a = ACCENTS[S.settings.accent] || ACCENTS.teal;
  root.style.setProperty('--accent', isDark() ? a.dark : a.light);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark() ? '#0e1513' : a.light;
}
mq.addEventListener?.('change', () => { applyTheme(); if (ui.tab === 'settings') render(); });

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

// ---------- task / goal editor ----------
const sheet = $('sheet');
let draft = null;
let draftIsNew = true;
let armed = null; // id of a note/step waiting for a second tap to delete
let armTimer = null;
function armReset(fn) { clearTimeout(armTimer); armTimer = setTimeout(fn, 3000); }

function setKind(kind) {
  draft.kind = kind;
  for (const b of $('fKind').children) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
  const goal = kind === 'goal';
  $('taskFields').hidden = goal;
  $('goalFields').hidden = !goal;
  $('subsSec').hidden = goal;
  $('sheetTitle').textContent = draftIsNew ? (goal ? 'هدف جديد' : 'مهمة جديدة') : (goal ? 'تعديل الهدف' : 'تعديل المهمة');
  setGoalMode(draft.mode); // may rename the sheet to «عادة جديدة»
}

// goal types: recurring, one-time, or a habit (with its own fields)
function setGoalMode(mode) {
  const others = activeHabits(draft.id).length;
  const habitFull = others >= HABIT_MAX && mode !== 'habit';
  draft.mode = mode;
  draft.repeat = mode !== 'once';
  for (const b of $('fRepeatMode').children) {
    b.setAttribute('aria-pressed', String(b.dataset.rep === mode));
    if (b.dataset.rep === 'habit') b.disabled = habitFull;
  }
  const goal = draft.kind === 'goal';
  $('repeatFields').hidden = !goal || mode !== 'repeat';
  $('onceGoalFields').hidden = !goal || mode !== 'once';
  $('targetBox').hidden = !goal || mode === 'habit';
  $('habitSection').hidden = !goal || mode !== 'habit';
  $('targetHint').textContent = mode === 'repeat' ? 'مثال: 8 أكواب ماء يومياً. اترك العدد 1 لهدف يُنجز بضغطة واحدة.' : 'مثال: قراءة 12 كتاباً. اترك العدد 1 لهدف يُنجز بضغطة واحدة.';
  $('targetLabel').textContent = mode === 'repeat' ? 'العدد المطلوب يومياً' : 'العدد المطلوب';
  $('habitSlots').textContent = habitFull
    ? `لديك ${HABIT_MAX} عادات قيد البناء، أكمل إحداها لتضيف غيرها.`
    : `عاداتك قيد البناء: ${others + (mode === 'habit' ? 1 : 0)} من ${HABIT_MAX}`;
  if (goal) {
    const label = mode === 'habit' ? 'العادة' : 'الهدف';
    $('sheetTitle').textContent = draftIsNew ? (mode === 'habit' ? 'عادة جديدة' : 'هدف جديد') : `تعديل ${label}`;
  }
  updatePrayerHint();
}

function renderHabitDays() {
  $('hDays').innerHTML =
    `<button type="button" data-action="hall-days" aria-pressed="${draft.hdays.length === 7}">كل يوم</button>` +
    `<button type="button" data-action="hwork-days" aria-pressed="${draft.hdays.length === 5 && [0, 1, 2, 3, 4].every((d) => draft.hdays.includes(d))}">أيام الدوام</button>` +
    DAY_ORDER.map((d) => `<button type="button" data-action="hday" data-v="${d}" aria-pressed="${draft.hdays.includes(d)}">${DAY_SHORT[d]}</button>`).join('');
}

function setTimeMode(mode) {
  draft.timeMode = mode;
  for (const b of $('fTimeMode').children) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  $('clockFields').hidden = mode !== 'clock';
  $('prayerFields').hidden = mode !== 'prayer';
  $('alarmField').hidden = mode === 'none';
  if (mode !== 'none') {
    if (!draft.alarms.length && draft.autoAlarm) draft.alarms = [0];
    draft.autoAlarm = false;
  }
  renderAlarms();
  updatePrayerHint();
}

function draftDate() {
  if (draft.kind === 'goal') return draft.mode === 'habit' ? ($('hStart').value || today()) : draft.mode === 'repeat' ? ($('fStart').value || today()) : ($('fGoalDue').value || today());
  return $('fDue').value || today();
}

function updatePrayerHint() {
  if (!draft || draft.timeMode !== 'prayer') return;
  $('fPrMin').hidden = $('fPrRel').value === 'at';
  const d = draftDate();
  const pt = prayerTimes(d);
  if (!pt) { $('prayerHint').innerHTML = 'لم تحدد مدينتك بعد. <button type="button" class="ghost" data-tab="settings" data-close="1">حدّدها الآن</button>'; return; }
  const p = readPrayer();
  $('prayerHint').textContent = `الوقت في ${relDate(d)}: ${fmtMin(pt[p.name] + p.offset)} (${Prayer.NAMES[p.name]} ${fmtMin(pt[p.name])})`;
}
function readPrayer() {
  const rel = $('fPrRel').value;
  const mins = Number($('fPrMin').value);
  return { name: $('fPrName').value, offset: rel === 'before' ? -mins : rel === 'after' ? mins : 0 };
}

function renderDays() {
  $('fDays').innerHTML =
    `<button type="button" data-action="all-days" aria-pressed="${draft.days.length === 7}">كل يوم</button>` +
    `<button type="button" data-action="work-days" aria-pressed="${draft.days.length === 5 && [0, 1, 2, 3, 4].every((d) => draft.days.includes(d))}">أيام الدوام</button>` +
    DAY_ORDER.map((d) => `<button type="button" data-action="day" data-v="${d}" aria-pressed="${draft.days.includes(d)}">${DAY_SHORT[d]}</button>`).join('');
}

function renderAlarms() {
  $('fAlarms').innerHTML = ALARM_OPTIONS.map(([v, l]) =>
    `<button type="button" data-action="alarm-opt" data-v="${v}" aria-pressed="${draft.alarms.includes(v)}">${l}</button>`).join('');
}

function renderNotes() {
  const notes = draft.notes;
  $('notesCount').textContent = notes.length ? `(${notes.length})` : '';
  $('notesList').innerHTML = notes.slice().reverse().map((n) => `
    <li class="note"><p>${esc(n.text)}</p>
      <div class="note-foot"><span class="num">${esc(fmtStamp(n.at))}</span>
      <button type="button" data-action="del-note" data-v="${n.id}" class="${armed === n.id ? 'armed' : ''}">${armed === n.id ? 'تأكيد الحذف' : 'حذف'}</button></div>
    </li>`).join('');
}

function renderSubs() {
  const subs = draft.subtasks;
  $('subsCount').textContent = subs.length ? `(${subs.filter((s) => s.done).length}/${subs.length})` : '';
  $('subsList').innerHTML = subs.map((s) => `
    <li class="sub${s.done ? ' done' : ''}">
      <input type="checkbox" data-action="toggle-sub" data-v="${s.id}"${s.done ? ' checked' : ''} aria-label="تمت الخطوة">
      <span>${esc(s.text)}</span>
      <button type="button" data-action="del-sub" data-v="${s.id}" class="${armed === s.id ? 'armed' : ''}">${armed === s.id ? 'تأكيد' : 'حذف'}</button>
    </li>`).join('');
}

function renderProjectSelect(selected) {
  $('fProject').innerHTML = `<option value="">بلا مشروع (مهام عامة)</option>` +
    S.projects.map((p) => `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
}

// opts: { kind: 'task'|'goal', repeat: bool, due, projectId, prefill }
function openSheet(id, opts = {}) {
  const existing = id ? getTask(id) : null;
  const t = existing || opts.prefill || null;
  draftIsNew = !existing;
  const t0 = today();
  const kind = t ? t.kind : opts.kind || 'task';
  draft = {
    id: t ? t.id : uid(),
    kind,
    repeat: t ? isRepeat(t) : kind === 'goal' && opts.repeat !== false,
    days: t && t.repeat ? [...t.repeat.days] : [...DAY_ORDER],
    notes: t ? t.notes.map((n) => ({ ...n })) : [],
    subtasks: t ? t.subtasks.map((n) => ({ ...n })) : [],
    alarms: t ? [...t.alarms] : [],
    autoAlarm: !t || !t.alarms.length,
    timeMode: t && t.prayer ? 'prayer' : t && t.time ? 'clock' : 'none',
    fromBenefit: opts.fromBenefit || '',
  };
  draft.mode = t ? (isHabit(t) ? 'habit' : isRepeat(t) ? 'repeat' : 'once') : opts.habit ? 'habit' : draft.repeat ? 'repeat' : 'once';
  draft.hdays = t && isHabit(t) ? [...t.repeat.days] : [...DAY_ORDER];
  $('aiStepsSlot').innerHTML = aiBtn('ai-steps', 'اقترح خطوات');
  const hb = t && t.habit ? t.habit : null;
  $('hStart').value = t && isHabit(t) ? t.repeat.start : t0;
  $('hTarget').value = t && isHabit(t) ? t.target : 1;
  $('hUnit').value = t && isHabit(t) ? t.unit : '';
  $('fIdentity').value = hb ? hb.identity : '';
  $('fCue').value = hb ? hb.cue : '';
  $('fTiny').value = hb ? hb.tiny : '';
  $('fReward').value = hb ? hb.reward : '';
  $('fHabitDays').value = String(hb ? hb.days : 66);
  $('fTitle').value = t ? t.title : '';
  $('fPriority').value = t ? t.priority : 'mid';
  $('fCategory').value = t ? t.category : '';
  renderProjectSelect(t ? t.projectId : opts.projectId || '');
  $('fDue').value = t && !isGoal(t) ? t.due : opts.due || (ui.tab === 'today' ? t0 : '');
  $('fGoalDue').value = t && isGoal(t) && !isRepeat(t) ? t.due : (kind === 'goal' && opts.due) || '';
  $('fStart').value = t && t.repeat ? t.repeat.start : opts.due || t0;
  $('fUntil').value = t && t.repeat ? t.repeat.until || '' : '';
  $('fTarget').value = t ? t.target : 1;
  $('fUnit').value = t ? t.unit : '';
  $('fTime').value = t ? t.time : '';
  const p = t && t.prayer ? t.prayer : { name: 'asr', offset: 15 };
  $('fPrName').value = p.name;
  $('fPrRel').value = p.offset < 0 ? 'before' : p.offset > 0 ? 'after' : 'at';
  const absOff = String(Math.abs(p.offset) || 15);
  $('fPrMin').value = [...$('fPrMin').options].some((o) => o.value === absOff) ? absOff : '15';
  $('fNote').value = '';
  $('fSub').value = '';
  $('delBtn').hidden = !existing;
  $('delBtn').classList.remove('armed');
  $('delBtn').textContent = 'حذف';
  $('timerSec').hidden = !existing;
  if (existing) {
    const ms = trackedMs(existing.id);
    const n = sessionsOf(existing.id).length;
    $('timerTotal').textContent = ms ? `سجّلت ${fmtDur(ms)} في ${n} ${n === 1 ? 'جلسة' : n === 2 ? 'جلستين' : 'جلسات'}` : 'لم تسجّل وقتاً بعد.';
  }
  armed = null;
  setKind(kind);
  setTimeMode(draft.timeMode);
  renderDays();
  renderHabitDays();
  renderNotes();
  renderSubs();
  if (typeof sheet.showModal === 'function') { if (!sheet.open) sheet.showModal(); } else sheet.setAttribute('open', '');
  $('editor').scrollTop = 0;
  // focus the title for new items, unless the user already moved to another field
  setTimeout(() => { const a = document.activeElement; if (!t && sheet.open && !(a && a.closest && a.closest('#editor input, #editor textarea, #editor select'))) $('fTitle').focus(); }, 50);
}

function closeSheet() {
  if (typeof sheet.close === 'function') { if (sheet.open) sheet.close(); } else sheet.removeAttribute('open');
  draft = null;
}

function readDraft() {
  const title = $('fTitle').value.trim();
  if (!title) return null;
  const existing = getTask(draft.id);
  const base = existing || normalize({ id: draft.id, created: Date.now() });
  const t = {
    ...base,
    kind: draft.kind,
    title,
    priority: $('fPriority').value,
    category: $('fCategory').value.trim(),
    notes: draft.notes,
    time: draft.timeMode === 'clock' ? $('fTime').value : '',
    prayer: draft.timeMode === 'prayer' ? readPrayer() : null,
  };
  t.alarms = hasTime(t) ? [...draft.alarms].sort((a, b) => a - b) : [];
  if (draft.kind === 'goal') {
    t.projectId = '';
    t.target = Math.max(1, Math.min(999, parseInt($('fTarget').value, 10) || 1));
    t.unit = t.target > 1 ? $('fUnit').value.trim() : '';
    if (draft.mode === 'habit') {
      // a habit keeps its own days, start, amount and build plan; it runs until it is established
      t.repeat = { days: (draft.hdays.length ? [...draft.hdays] : [...DAY_ORDER]).sort(), start: $('hStart').value || today(), until: null };
      t.target = Math.max(1, Math.min(999, parseInt($('hTarget').value, 10) || 1));
      t.unit = t.target > 1 ? $('hUnit').value.trim() : '';
      t.due = '';
      t.done = false;
      t.doneAt = null;
      t.habit = normalizeHabit({
        ...(base.habit || {}), identity: $('fIdentity').value.trim(), cue: $('fCue').value.trim(),
        tiny: $('fTiny').value.trim(), reward: $('fReward').value.trim(), days: $('fHabitDays').value,
      });
    } else if (draft.repeat) {
      const start = $('fStart').value || today();
      let until = $('fUntil').value || null;
      if (until && until < start) until = start;
      t.repeat = { days: (draft.days.length ? [...draft.days] : [...DAY_ORDER]).sort(), start, until };
      t.due = '';
      t.done = false;
      t.doneAt = null;
      t.habit = null;
    } else {
      t.repeat = null;
      t.habit = null;
      t.due = $('fGoalDue').value || '';
      if (t.target > 1) { t.count = Math.min(t.count, t.target); t.done = t.count >= t.target; t.doneAt = t.done ? (base.doneAt || Date.now()) : null; }
    }
  } else {
    t.repeat = null;
    t.habit = null;
    t.target = 1;
    t.unit = '';
    t.projectId = $('fProject').value;
    t.subtasks = draft.subtasks;
    t.due = $('fDue').value || (hasTime(t) ? today() : '');
  }
  return t;
}

function commitDraft() {
  const t = readDraft();
  if (!t) { $('fTitle').focus(); toast('اكتب عنواناً أولاً.'); return null; }
  const was = getTask(t.id);
  if (isHabit(t) && !(was && isHabit(was)) && activeHabits(t.id).length >= HABIT_MAX) {
    toast(`لا يمكن بناء أكثر من ${HABIT_MAX} عادات في وقت واحد. أكمل إحداها أولاً.`);
    return null;
  }
  const i = S.tasks.findIndex((x) => x.id === t.id);
  if (i === -1) S.tasks.push(t); else S.tasks[i] = t;
  for (const k of Object.keys(S.fired)) if (k.startsWith(t.id + '|')) delete S.fired[k]; // new time may ring again
  save();
  return t;
}

// notes and steps on an existing task are kept right away
function persistDraftList(field) {
  const t = getTask(draft.id);
  if (t) { t[field] = draft[field].map((n) => ({ ...n })); save(); render(); }
}

function addNote() {
  const text = $('fNote').value.trim();
  if (!text) return;
  draft.notes.push({ id: uid(), text, at: Date.now() });
  $('fNote').value = '';
  persistDraftList('notes');
  renderNotes();
}
function addSub() {
  const text = $('fSub').value.trim();
  if (!text) return;
  draft.subtasks.push({ id: uid(), text, done: false, doneAt: null });
  $('fSub').value = '';
  persistDraftList('subtasks');
  renderSubs();
}

$('editor').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('fNote').value.trim()) addNote();
  if ($('fSub').value.trim()) addSub();
  const fromBenefit = draft.fromBenefit;
  const t = commitDraft();
  if (!t) return;
  if (fromBenefit && getBenefit(fromBenefit)) { getBenefit(fromBenefit).actionId = t.id; save(); }
  const wasNew = draftIsNew;
  closeSheet();
  if (t.alarms.length) ensureNotifPermission();
  render();
  const p = projectOf(t);
  toast(wasNew ? `أُضيفت${p ? ` إلى «${p.name}»` : ''}` : 'حُفظت التعديلات');
});
sheet.addEventListener('close', () => { draft = null; });
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
$('fSub').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
$('fNote').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } });
for (const id of ['fPrRel', 'fPrName', 'fPrMin', 'fDue', 'fStart', 'fGoalDue', 'hStart']) $(id).addEventListener('change', updatePrayerHint);

// ---------- project editor ----------
const psheet = $('projSheet');
let pdraft = null;

function openProjectSheet(id) {
  const p = id ? getProject(id) : null;
  const used = new Set(S.projects.map((x) => x.color));
  const color = p ? p.color : (PROJECT_COLORS.find(([c]) => !used.has(c)) || PROJECT_COLORS[0])[0];
  pdraft = { id: p ? p.id : uid(), color, isNew: !p };
  $('projTitle').textContent = p ? 'تعديل المشروع' : 'مشروع جديد';
  $('pName').value = p ? p.name : '';
  $('pDesc').value = p ? p.desc : '';
  $('pDue').value = p ? p.due : '';
  $('pDel').hidden = !p;
  $('pDel').classList.remove('armed');
  $('pDel').textContent = 'حذف المشروع';
  renderProjectColors();
  if (typeof psheet.showModal === 'function') { if (!psheet.open) psheet.showModal(); } else psheet.setAttribute('open', '');
  setTimeout(() => { const a = document.activeElement; if (!p && psheet.open && !(a && a.closest && a.closest('#projForm input, #projForm textarea'))) $('pName').focus(); }, 50);
}
function renderProjectColors() {
  $('pColors').innerHTML = PROJECT_COLORS.map(([c, n]) =>
    `<button type="button" class="swatch" data-action="p-color" data-v="${c}" aria-pressed="${pdraft.color === c}" aria-label="${n}" title="${n}" style="background:${c}"></button>`).join('');
}
function closeProjectSheet() {
  if (typeof psheet.close === 'function') { if (psheet.open) psheet.close(); } else psheet.removeAttribute('open');
  pdraft = null;
}
$('projForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('pName').value.trim();
  if (!name) { $('pName').focus(); toast('اكتب اسماً للمشروع.'); return; }
  const existing = getProject(pdraft.id);
  const p = normalizeProject({ ...(existing || { created: Date.now() }), id: pdraft.id, name, color: pdraft.color, desc: $('pDesc').value.trim(), due: $('pDue').value });
  if (existing) Object.assign(existing, p); else S.projects.push(p);
  save();
  const isNew = pdraft.isNew;
  closeProjectSheet();
  if (isNew) go('tasks', p.id); else render();
  toast(isNew ? 'أُنشئ المشروع. أضف له مهاماً الآن.' : 'حُفظ المشروع');
});
psheet.addEventListener('click', (e) => { if (e.target === psheet) closeProjectSheet(); });

// ---------- calendar export (.ics) ----------
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
const icsDate = (d) => d.replace(/-/g, '');
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function buildICS(t) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const date = isRepeat(t) ? t.repeat.start : (t.due || today());
  const m = timeOn(t, date);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mahami//AR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${t.id}@mahami`, `DTSTAMP:${stamp}`];
  if (m != null) lines.push(`DTSTART:${icsDate(date)}T${hmOf(m).replace(':', '')}00`, 'DURATION:PT15M');
  else lines.push(`DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(date, 1))}`);
  const p = projectOf(t);
  lines.push(`SUMMARY:${icsEscape(t.title)}`);
  const desc = [];
  if (p) desc.push(`المشروع: ${p.name}`);
  if (t.prayer) desc.push(`${prayerPhrase(t.prayer)} (وقت التقويم ثابت ولا يتغير مع مواعيد الصلاة)`);
  if (t.subtasks.length) desc.push(t.subtasks.map((s) => `${s.done ? '✓' : '○'} ${s.text}`).join('\n'));
  if (t.notes.length) desc.push(t.notes.map((n) => n.text).join('\n—\n'));
  if (desc.length) lines.push(`DESCRIPTION:${icsEscape(desc.join('\n\n'))}`);
  if (isRepeat(t)) {
    const r = t.repeat;
    let rule = r.days.length === 7 ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${r.days.map((d) => ICS_DAYS[d]).join(',')}`;
    if (r.until) rule += `;UNTIL=${icsDate(r.until)}${m != null ? 'T235959' : ''}`;
    lines.push(`RRULE:${rule}`);
  }
  const alarms = m != null ? (t.alarms.length ? t.alarms : [0]) : [];
  for (const off of alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t.title)}`, `TRIGGER:-PT${off}M`, 'END:VALARM');
  if (m == null) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t.title)}`, 'TRIGGER:PT9H', 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- alarms ----------
let actx = null;
function unlockAudio() {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch {}
}
document.addEventListener('pointerdown', unlockAudio, { passive: true });

function beep() {
  if (!S.settings.sound || !actx) return;
  try {
    const t0 = actx.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = i % 2 ? 660 : 880;
      const s = t0 + i * 0.45;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.35, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
      o.connect(g).connect(actx.destination);
      o.start(s);
      o.stop(s + 0.4);
    }
  } catch {}
}

async function ensureNotifPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  try { await Notification.requestPermission(); } catch {}
  if (ui.tab === 'settings') render();
}

async function systemNotify(title, body, key, id) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  title = digitsOut(title); body = digitsOut(body);
  const opts = {
    body, tag: key, renotify: true, requireInteraction: true, lang: 'ar', dir: 'rtl',
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [200, 100, 200, 100, 400],
    data: { id, key },
    actions: [{ action: 'done', title: 'تمت' }, { action: 'snooze', title: `غفوة ${SNOOZE_MIN} دقائق` }],
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, { body, tag: key });
  } catch {}
}

const alarmQueue = [];
function minutesLeft(t, d) {
  const m = timeOn(t, d);
  return m == null ? 0 : Math.round((parse(d).getTime() + m * 60000 - Date.now()) / 60000);
}
function alarmBody(t, d, off) {
  const when = timeLabel(t, d);
  const left = minutesLeft(t, d);
  return off && left > 0 ? `بعد ${minsWord(left)} · ${when}` : `الآن · ${when}`;
}
function ring(t, key, d, off) {
  S.fired[key] = Date.now();
  delete S.snoozed[key];
  save();
  alarmQueue.push({ id: t.id, key, d, off });
  showAlarm();
  beep();
  try { if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate([300, 150, 300]); } catch {}
  if (document.visibilityState !== 'visible') systemNotify(t.title, alarmBody(t, d, off), key, t.id);
}

function showAlarm() {
  const cur = alarmQueue[0];
  if (!cur) { $('alarm').hidden = true; return; }
  if (cur.id === '__test') {
    $('alarmKicker').textContent = 'منبه تجريبي';
    $('alarmTitle').textContent = 'هذا شكل المنبه وصوته';
    $('alarm').hidden = false;
    return;
  }
  const t = getTask(cur.id);
  if (!t) { alarmQueue.shift(); showAlarm(); return; }
  const left = minutesLeft(t, cur.d);
  $('alarmKicker').textContent = cur.off && left > 0 ? `تذكير مسبق · بعد ${minsWord(left)}` : 'منبه';
  $('alarmTitle').textContent = `${t.title} · ${timeLabel(t, cur.d)}`;
  $('alarm').hidden = false;
}

function alarmAction(action, id, key) {
  const t = getTask(id);
  const date = key && key.includes('|') ? key.split('|')[1] : today();
  if (t && action === 'done') {
    if (isCounted(t)) { setCount(t, date, t.target); save(); render(); }
    else if (!doneOn(t, date)) toggle(id, date);
  }
  if (t && action === 'snooze') {
    S.snoozed[key] = Date.now() + SNOOZE_MIN * 60000;
    save();
    toast(`سيرن مجدداً بعد ${SNOOZE_MIN} دقائق`);
  }
  const i = alarmQueue.findIndex((a) => a.key === key);
  if (i !== -1) alarmQueue.splice(i, 1);
  showAlarm();
}

function checkAlarms() {
  const now = Date.now();
  const d0 = today();
  for (const t of S.tasks) {
    if (!t.alarms.length || !hasTime(t)) continue;
    // a "day before" alarm belongs to tomorrow's occurrence
    for (const d of [d0, addDays(d0, 1), addDays(d0, 2)]) {
      const applies = isRepeat(t) ? occursOn(t, d) : t.due === d;
      if (!applies || doneOn(t, d)) continue;
      const m = timeOn(t, d);
      if (m == null) continue;
      const at = parse(d).getTime() + m * 60000;
      for (const off of t.alarms) {
        const fireAt = at - off * 60000;
        const key = `${t.id}|${d}|${off}`;
        const sn = S.snoozed[key];
        if (sn) { if (now >= sn) ring(t, key, d, off); continue; }
        if (S.fired[key] || now < fireAt) continue;
        if (now - fireAt > MISSED_WINDOW_MIN * 60000) { S.fired[key] = now; save(); continue; }
        ring(t, key, d, off);
      }
    }
  }
  const cutoff = now - 4 * 86400000;
  for (const k of Object.keys(S.fired)) if (S.fired[k] < cutoff) delete S.fired[k];
}

// ---------- backup ----------
function exportData() {
  const data = JSON.stringify({ app: 'mahami', version: APP_VERSION, exported: new Date().toISOString(), tasks: S.tasks, projects: S.projects, sessions: S.sessions, memos: S.memos, books: S.books, benefits: S.benefits, inspire: S.inspire.filter((x) => x.type !== 'image'), archive: S.archive, ideas: S.ideas, journal: S.journal, jtemplates: S.jtemplates, hifz: S.hifz, hplans: S.hplans, finPlans: S.finPlans, finDebts: S.finDebts, finRights: S.finRights, finProjects: S.finProjects, finTx: S.finTx, cvs: S.cvs, meals: S.meals, mealDone: S.mealDone, shop: S.shop, lists: S.lists, subs: S.subs, later: S.later, weeks: S.weeks, people: S.people, decisions: S.decisions, quits: S.quits, settings: S.settings }, null, 2);
  downloadFile(`mahami-${today()}.json`, data, 'application/json');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.tasks)) throw new Error('bad');
      if (!confirm(`سيستبدل هذا بياناتك الحالية بـ ${data.tasks.length} عنصر من الملف. متابعة؟`)) return;
      S.tasks = data.tasks.map(normalize);
      S.projects = (Array.isArray(data.projects) ? data.projects : []).map(normalizeProject);
      if (Array.isArray(data.sessions)) S.sessions = data.sessions;
      S.memos = (Array.isArray(data.memos) ? data.memos : []).map(normalizeMemo);
      S.books = (Array.isArray(data.books) ? data.books : []).map(normalizeBook);
      S.benefits = (Array.isArray(data.benefits) ? data.benefits : []).map(normalizeBenefit);
      S.archive = (Array.isArray(data.archive) ? data.archive : []).map(normalizeArchive);
      S.ideas = (Array.isArray(data.ideas) ? data.ideas : []).map(normalizeIdea);
      S.journal = (Array.isArray(data.journal) ? data.journal : []).map(normalizeJournal);
      if (Array.isArray(data.jtemplates)) S.jtemplates = data.jtemplates.map(normalizeJTemplate);
      for (const [k, f] of [['hifz', normalizeHifz], ['hplans', normalizeHPlan], ['finPlans', normalizeFinPlan], ['finDebts', normalizeDebt], ['finRights', normalizeRight], ['finProjects', normalizeFinProject], ['finTx', normalizeTx], ['cvs', normalizeCV], ['meals', normalizeMeal], ['mealDone', normalizeMealDone], ['shop', normalizeShop], ['lists', normalizeList], ['subs', normalizeSub], ['later', normalizeLater], ['weeks', normalizeWeek], ['people', normalizePerson], ['decisions', normalizeDecision], ['quits', normalizeQuit]]) S[k] = (Array.isArray(data[k]) ? data[k] : []).map(f);
      if (!Array.isArray(data.lists)) S.lists = DEFAULT_LISTS.map(normalizeList);
      // photos stay on this device; imported phrases are added to them
      S.inspire = [...S.inspire.filter((x) => x.type === 'image'), ...(Array.isArray(data.inspire) ? data.inspire : []).filter((x) => x.type !== 'image').map(normalizeInspire)];
      if (data.settings) Object.assign(S.settings, data.settings);
      save();
      applyTheme();
      render();
      toast('تم الاستيراد');
    } catch {
      toast('الملف غير صالح. اختر ملفاً صدّرته من «مهامي».');
    }
  };
  reader.readAsText(file);
}

// ---------- prayer settings ----------
function setCity(id) {
  if (!id) { S.settings.prayer = null; }
  else if (id !== 'here') {
    const c = Prayer.CITIES.find((x) => x.id === id);
    const prev = S.settings.prayer;
    S.settings.prayer = { city: c.id, label: c.name, lat: c.lat, lng: c.lng, method: c.method, asr: prev ? prev.asr : 'standard' };
  }
  save();
  render();
}
function useLocation() {
  if (!navigator.geolocation) { toast('جهازك لا يتيح تحديد الموقع. اختر مدينتك من القائمة.'); return; }
  toast('جارٍ تحديد موقعك…');
  navigator.geolocation.getCurrentPosition((pos) => {
    const prev = S.settings.prayer;
    const { latitude: lat, longitude: lng } = pos.coords;
    const near = Prayer.CITIES.reduce((a, c) => ((c.lat - lat) ** 2 + (c.lng - lng) ** 2 < (a.lat - lat) ** 2 + (a.lng - lng) ** 2 ? c : a));
    S.settings.prayer = { city: 'here', label: 'موقعي الحالي', lat, lng, method: prev ? prev.method : near.method, asr: prev ? prev.asr : 'standard' };
    save();
    render();
    toast('حُدّثت أوقات الصلاة حسب موقعك');
  }, () => toast('لم نتمكن من تحديد موقعك. اسمح بالموقع أو اختر مدينتك من القائمة.'), { timeout: 15000, maximumAge: 86400000 });
}

// ---------- timer (count-up and countdown) ----------
const fmtDur = (ms) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'أقل من دقيقة';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} س${r ? ` ${r} د` : ''}` : `${r} د`;
};
const sessionsOf = (id) => S.sessions.filter((x) => x.taskId === id);
const trackedMs = (id) => sessionsOf(id).reduce((n, x) => n + x.ms, 0);
const sessionDay = (x) => iso(new Date(x.end));
const timerTitle = (tm) => (getTask(tm.taskId) || {}).title || 'بلا مهمة';

let wakeLock = null;
async function updateWakeLock() {
  const want = S.timer && S.timer.running && S.settings.timer.awake && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

async function timerNotify(close) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (!reg) return;
    if (close || !S.timer) { (await reg.getNotifications({ tag: 'timer' })).forEach((n) => n.close()); return; }
    const [title, opts] = TimerShared.notification(S.timer, timerTitle(S.timer));
    await reg.showNotification(title, opts);
  } catch {}
}

function startTimer(taskId, mode, minutes, phase = 'work') {
  if (S.timer) finishTimer();
  unlockAudio();
  const now = Date.now();
  S.timer = { taskId, mode, phase, planned: mode === 'down' ? minutes * 60000 : 0, start: now, startedAt: now, acc: 0, running: true, ar: S.settings.digits === 'arab' };
  if (phase === 'work') S.settings.timer.lastTask = taskId;
  ui.timerEnded = null;
  save();
  ensureNotifPermission().then(() => timerNotify());
  updateWakeLock();
  render();
}

function applyTimerAction(action, ts = Date.now()) {
  if (!S.timer) return;
  if (action === 'timer-stop') { finishTimer(ts); return; }
  S.timer = TimerShared.apply(S.timer, action, ts);
  save();
  timerNotify();
  updateWakeLock();
  render();
}

// save the session (work phase only) and clear the timer
function finishTimer(ts = Date.now(), quiet) {
  const tm = S.timer;
  if (!tm) return;
  let ms = TimerShared.elapsed(tm, ts);
  if (tm.mode === 'down') ms = Math.min(ms, tm.planned);
  if (tm.phase === 'work' && ms >= 30000) {
    S.sessions.push({ id: uid(), taskId: tm.taskId, start: tm.startedAt, end: ts, ms: Math.round(ms), mode: tm.mode });
  }
  S.timer = null;
  save();
  timerNotify(true);
  updateWakeLock();
  if (!quiet) { render(); if (tm.phase === 'work' && ms >= 30000) toast(`سُجّل ${fmtDur(ms)} لـ «${(getTask(tm.taskId) || {}).title || ''}»`); }
}

function cancelTimer() {
  S.timer = null;
  ui.timerEnded = null;
  save();
  timerNotify(true);
  updateWakeLock();
  render();
}

async function countdownEnded(tm, endTs) {
  const late = Date.now() - endTs > 5 * 60000;
  finishTimer(endTs, true);
  ui.timerEnded = { taskId: tm.taskId, phase: tm.phase, minutes: Math.round(tm.planned / 60000) };
  render();
  if (late) return;
  beep();
  try { if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 600]); } catch {}
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      const title = digitsOut(tm.phase === 'break' ? 'انتهت الاستراحة' : `انتهى الوقت: ${timerTitle(tm)}`);
      const body = digitsOut(tm.phase === 'break' ? 'جاهز لجولة جديدة؟' : `أنهيت ${fmtDur(tm.planned)} من التركيز`);
      const opts = { body, tag: 'timer-end', requireInteraction: true, vibrate: [400, 200, 400, 200, 600], lang: 'ar', dir: 'rtl', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
      if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
    } catch {}
  }
}

function tickTimer() {
  const tm = S.timer;
  const bar = $('timerBar');
  document.body.classList.toggle('has-timer', !!tm && ui.tab !== 'timer');
  if (!tm) { bar.hidden = true; return; }
  const e = TimerShared.elapsed(tm);
  if (tm.mode === 'down' && e >= tm.planned) { countdownEnded(tm, tm.start + (tm.planned - tm.acc)); return; }
  const shown = tm.mode === 'down' ? tm.planned - e : e;
  bar.hidden = ui.tab === 'timer';
  bar.classList.toggle('paused', !tm.running);
  $('timerBarClock').textContent = TimerShared.clock(shown);
  $('timerBarTitle').textContent = tm.phase === 'break' ? 'استراحة' : timerTitle(tm);
  const d = $('tDisplay');
  if (d) {
    d.textContent = TimerShared.clock(shown);
    const p = tm.mode === 'down' ? (e / tm.planned) * 100 : ((e % 3600000) / 3600000) * 100;
    $('tRing').style.setProperty('--p', p.toFixed(2));
  }
}

// actions pressed on the notification (phone or watch) while the page was asleep
async function applyPendingTimerActions() {
  if (!('caches' in window)) return;
  try {
    const c = await caches.open('mahami-actions');
    const res = await c.match('pending');
    if (!res) return;
    const list = await res.json();
    await c.delete('pending');
    for (const a of list.sort((x, y) => x.ts - y.ts)) applyTimerAction(a.action, a.ts);
  } catch {}
}

function timerNotifNote() {
  if (!('Notification' in window)) return '<p class="note-text">هذا المتصفح لا يعرض الإشعارات. ثبّت التطبيق على الشاشة الرئيسية ليظهر المؤقت خارجه.</p>';
  if (Notification.permission === 'granted') return '<p class="note-text">عند خروجك من التطبيق يبقى المؤقت ظاهراً في شريط الإشعارات على جوالك وساعتك، وفيه أزرار الإيقاف والإنهاء.</p>';
  if (Notification.permission === 'denied') return '<p class="note-text warn-box">الإشعارات محظورة، لذلك لن يظهر المؤقت خارج التطبيق. فعّلها من إعدادات الجوال: التطبيقات ← مهامي (أو Chrome) ← الإشعارات.</p>';
  return '<div class="warn-box"><span>ليبقى المؤقت ظاهراً في شريط الإشعارات بعد خروجك من التطبيق، فعّل الإشعارات.</span><button type="button" class="primary" data-action="notif-timer">تفعيل الإشعارات</button></div>';
}

function timerTaskOptions(selected) {
  const t0 = today();
  const todays = S.tasks.filter((t) => (isRepeat(t) ? occursOn(t, t0) : !t.done && t.due && t.due <= t0));
  const opt = (t) => `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${esc(t.title)}</option>`;
  const groups = [['اليوم', todays]];
  for (const p of S.projects) groups.push([`مشروع: ${p.name}`, tasksOf(p.id).filter((t) => !t.done && !todays.includes(t))]);
  groups.push(['مهام عامة', S.tasks.filter((t) => !isGoal(t) && !t.projectId && !t.done && !todays.includes(t))]);
  groups.push(['أهداف', S.tasks.filter((t) => isGoal(t) && !todays.includes(t) && !goalEnded(t))]);
  return groups.filter(([, l]) => l.length).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(opt).join('')}</optgroup>`).join('');
}

function viewTimer() {
  const tm = S.timer;
  const cfg = S.settings.timer;
  let card;
  if (tm) {
    const e = TimerShared.elapsed(tm);
    const shown = tm.mode === 'down' ? tm.planned - e : e;
    const p = tm.mode === 'down' ? (e / tm.planned) * 100 : ((e % 3600000) / 3600000) * 100;
    const sub = tm.phase === 'break' ? 'استراحة' : tm.mode === 'down' ? `متبقٍ من ${fmtDur(tm.planned)}` : 'الوقت المستغرق';
    card = `<section class="timer-card" aria-live="off">
      <div class="t-task">${tm.phase === 'break' ? 'استراحة قصيرة' : esc(timerTitle(tm))}</div>
      <div class="t-ring${tm.running ? '' : ' paused'}" id="tRing" style="--p:${p.toFixed(2)}">
        <div class="t-inner"><div class="t-digits" id="tDisplay">${TimerShared.clock(shown)}</div><div class="t-sub">${tm.running ? sub : 'متوقف مؤقتاً'}</div></div>
      </div>
      <div class="t-actions">
        ${tm.running ? '<button type="button" class="ghost" data-action="timer-pause">إيقاف مؤقت</button>' : '<button type="button" class="primary" data-action="timer-resume">استئناف</button>'}
        <button type="button" class="${tm.running ? 'primary' : 'ghost'}" data-action="timer-stop">${tm.phase === 'break' ? 'إنهاء الاستراحة' : 'إنهاء وحفظ'}</button>
        <button type="button" class="danger" data-action="timer-cancel" id="tCancel">إلغاء</button>
      </div>
      ${timerNotifNote()}
    </section>`;
  } else if (ui.timerEnded) {
    const en = ui.timerEnded;
    const t = getTask(en.taskId);
    card = `<section class="timer-card">
      <div class="t-ended"><strong>${en.phase === 'break' ? 'انتهت الاستراحة' : 'أحسنت! انتهى الوقت'}</strong>
      <span class="note-text">${en.phase === 'break' ? 'جاهز لجولة جديدة؟' : `سُجّلت ${en.minutes} دقيقة لـ «${esc(t ? t.title : '')}»`}</span></div>
      <div class="t-actions">
        ${en.phase === 'break' ? '' : `<button type="button" class="ghost" data-action="timer-break">استراحة ${cfg.brk} دقائق</button>`}
        <button type="button" class="primary" data-action="timer-again">جولة ${en.phase === 'break' ? 'جديدة' : 'أخرى'} (${cfg.minutes} د)</button>
        ${t && !doneOn(t, today()) && en.phase !== 'break' ? '<button type="button" class="ghost" data-action="timer-done-task">تمت المهمة</button>' : ''}
        <button type="button" data-action="timer-close-end">إغلاق</button>
      </div>
    </section>`;
  } else {
    const opts = timerTaskOptions(cfg.lastTask);
    const seg = (v, l) => `<button type="button" data-action="timer-mode" data-v="${v}" aria-pressed="${cfg.mode === v}">${l}</button>`;
    const chip = (action, v, cur, l) => `<button type="button" class="chip" data-action="${action}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`;
    card = `<section class="timer-card">
      <div class="t-task">مؤقت المهام</div>
      ${opts ? `<div class="timer-form">
        <label class="field"><span>المهمة</span><select id="tTask">${opts}</select></label>
        <div class="field"><span>النوع</span><div class="seg">${seg('up', 'يحسب الوقت المستغرق')}${seg('down', 'عدّ تنازلي')}</div></div>
        ${cfg.mode === 'down' ? `
        <div class="field"><span>مدة التركيز</span><div class="chips wrap">${[15, 25, 30, 45, 60, 90].map((m) => chip('timer-min', m, cfg.minutes, `${m} د`)).join('')}
          <input type="number" id="tCustom" min="1" max="600" inputmode="numeric" value="${cfg.minutes}" aria-label="مدة مخصصة بالدقائق" style="width:6em"></div></div>
        <div class="field"><span>الاستراحة بعدها</span><div class="chips wrap">${[5, 10, 15].map((m) => chip('timer-brk', m, cfg.brk, `${m} د`)).join('')}</div></div>` : ''}
        <label class="switch"><input type="checkbox" id="tAwake"${cfg.awake ? ' checked' : ''}><span>إبقاء الشاشة مضاءة أثناء المؤقت</span></label>
        <button type="button" class="primary t-start" data-action="timer-start">ابدأ</button>
      </div>` : emptyHTML('لا مهام بعد', 'أضف مهمة أولاً ثم شغّل لها المؤقت.', addBtn('new', 'مهمة'))}
    </section>`;
  }
  const t0 = today();
  const todays = S.sessions.filter((x) => sessionDay(x) === t0);
  const todayMs = todays.reduce((n, x) => n + x.ms, 0);
  const byTask = {};
  for (const x of todays) byTask[x.taskId] = (byTask[x.taskId] || 0) + x.ms;
  const rows = Object.entries(byTask).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  const recent = S.sessions.slice(-8).reverse();
  return `${card}
  <section class="panel">
    <div class="section-head"><h2>وقتك اليوم</h2><b class="num">${todayMs ? fmtDur(todayMs) : '0 د'}</b></div>
    ${rows.length ? `<ul class="hbars">${rows.map(([id, ms]) => hbar(esc((getTask(id) || {}).title || 'مهمة محذوفة'), fmtDur(ms), (ms / max) * 100)).join('')}</ul>`
      : '<p class="note-text">ابدأ المؤقت لأي مهمة، وسيُسجَّل وقتها هنا وفي الإحصائيات.</p>'}
  </section>
  ${recent.length ? `<section class="panel"><h2>آخر الجلسات</h2><ul class="sessions">${recent.map((x) => `<li><span>${esc((getTask(x.taskId) || {}).title || 'مهمة محذوفة')}</span><span class="num">${esc(relDate(sessionDay(x)))} · ${esc(fmtTime(hmOf(new Date(x.start).getHours() * 60 + new Date(x.start).getMinutes())))} · ${fmtDur(x.ms)}</span></li>`).join('')}</ul></section>` : ''}`;
}

let timerArmed = false;
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="timer-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  const cfg = S.settings.timer;
  switch (action) {
    case 'timer-start': {
      const id = $('tTask') && $('tTask').value;
      if (!id) break;
      startTimer(id, cfg.mode, cfg.minutes);
      break;
    }
    case 'timer-pause': applyTimerAction('timer-pause'); break;
    case 'timer-resume': applyTimerAction('timer-resume'); break;
    case 'timer-stop': applyTimerAction('timer-stop'); break;
    case 'timer-cancel':
      if (!timerArmed) {
        timerArmed = true; el.textContent = 'تأكيد الإلغاء (لن يُحفظ)'; el.classList.add('armed');
        setTimeout(() => { timerArmed = false; if (el.isConnected) { el.textContent = 'إلغاء'; el.classList.remove('armed'); } }, 3000);
        break;
      }
      timerArmed = false;
      cancelTimer();
      break;
    case 'timer-mode': cfg.mode = v; save(); render(); break;
    case 'timer-min': cfg.minutes = Number(v); save(); render(); break;
    case 'timer-brk': cfg.brk = Number(v); save(); render(); break;
    case 'timer-break': startTimer(ui.timerEnded.taskId, 'down', cfg.brk, 'break'); break;
    case 'timer-again': startTimer(ui.timerEnded.taskId, 'down', cfg.minutes); break;
    case 'timer-done-task': {
      const en = ui.timerEnded;
      ui.timerEnded = null;
      const t = getTask(en.taskId);
      if (t && isCounted(t)) { setCount(t, today(), t.target); save(); render(); }
      else if (t && !doneOn(t, today())) toggle(t.id, today());
      else render();
      break;
    }
    case 'timer-close-end': ui.timerEnded = null; render(); break;
    case 'timer-for': {
      const id = draft && draft.id;
      if (!id || !getTask(id)) break;
      closeSheet();
      ui.tab = 'timer';
      startTimer(id, cfg.mode, cfg.minutes);
      history.replaceState(history.state, '', '#timer');
      break;
    }
  }
});
document.addEventListener('change', (e) => {
  const cfg = S.settings.timer;
  if (e.target.id === 'tTask') { cfg.lastTask = e.target.value; save(); }
  if (e.target.id === 'tAwake') { cfg.awake = e.target.checked; save(); updateWakeLock(); }
  if (e.target.id === 'tCustom') { const n = parseInt(e.target.value, 10); if (n > 0) { cfg.minutes = Math.min(600, n); save(); render(); } }
});

// ---------- events ----------
let projArmed = false;
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-tab]');
  if (!el || el === document.body) return;
  if (el.dataset.tab) {
    if (el.dataset.close) closeSheet();
    // tapping «المهام» again returns from a project to the list
    go(el.dataset.tab, el.dataset.tab === 'tasks' && ui.tab === 'tasks' ? '' : undefined);
    return;
  }
  const { action, id, v } = el.dataset;
  switch (action) {
    case 'new': openSheet(null, { kind: 'task', due: ui.tab === 'calendar' ? ui.calSel : undefined, projectId: ui.tab === 'tasks' ? ui.project : '' }); break;
    case 'new-in-project': openSheet(null, { kind: 'task', projectId: v }); break;
    case 'new-goal': openSheet(null, { kind: 'goal', repeat: true }); break;
    case 'new-habit':
      if (activeHabits().length >= HABIT_MAX) { toast(`لديك ${HABIT_MAX} عادات قيد البناء. أكمل إحداها لتضيف غيرها.`); break; }
      openSheet(null, { kind: 'goal', repeat: true, habit: true });
      break;
    case 'new-goal-once': openSheet(null, { kind: 'goal', repeat: false }); break;
    case 'new-on': openSheet(null, { kind: 'task', due: v }); break;
    case 'new-goal-on': openSheet(null, { kind: 'goal', repeat: false, due: v }); break;
    case 'new-project': openProjectSheet(null); break;
    case 'edit-project': openProjectSheet(v); break;
    case 'open-project': go('tasks', v); break;
    case 'close-project': go('tasks', ''); break;
    case 'p-color': pdraft.color = v; renderProjectColors(); break;
    case 'close-project-sheet': closeProjectSheet(); break;
    case 'delete-project': {
      const btn = $('pDel');
      if (!projArmed) {
        projArmed = true;
        btn.classList.add('armed');
        btn.textContent = 'تأكيد: تنتقل مهامه إلى «مهام عامة»';
        setTimeout(() => { projArmed = false; if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = 'حذف المشروع'; } }, 3500);
        break;
      }
      projArmed = false;
      const pid = pdraft.id;
      for (const t of S.tasks) if (t.projectId === pid) t.projectId = '';
      S.projects = S.projects.filter((p) => p.id !== pid);
      save();
      closeProjectSheet();
      go('tasks', '');
      toast('حُذف المشروع، ومهامه الآن في «مهام عامة»');
      break;
    }
    case 'open': openSheet(id); break;
    case 'toggle': toggle(id, el.dataset.date); break;
    case 'step': step(id, el.dataset.date || today(), Number(v)); break;
    case 'filter': ui[el.dataset.k || 'filter'] = v; render(); break;
    case 'cat': ui.cat = v; render(); break;
    case 'example': ui.smart = v; render(); $('smartIn').focus(); break;
    case 'smart-edit': {
      const r = SmartParse.parse(ui.smart);
      if (!r.title) break;
      openSheet(null, { prefill: smartToTask(r) });
      break;
    }
    case 'cal-day': {
      ui.calSel = v;
      if (v.slice(0, 7) !== ui.calMonth) ui.calMonth = v.slice(0, 7);
      render();
      break;
    }
    case 'cal-move': {
      const [y, m] = ui.calMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(v), 1);
      ui.calMonth = iso(d).slice(0, 7);
      ui.calSel = ui.calMonth === today().slice(0, 7) ? today() : iso(d);
      render();
      break;
    }
    case 'cal-today': ui.calMonth = today().slice(0, 7); ui.calSel = today(); render(); break;
    case 'close-sheet': closeSheet(); break;
    case 'all-days': draft.days = draft.days.length === 7 ? [] : [...DAY_ORDER]; renderDays(); break;
    case 'work-days': draft.days = [0, 1, 2, 3, 4]; renderDays(); break;
    case 'hall-days': draft.hdays = draft.hdays.length === 7 ? [] : [...DAY_ORDER]; renderHabitDays(); break;
    case 'hwork-days': draft.hdays = [0, 1, 2, 3, 4]; renderHabitDays(); break;
    case 'hday': {
      const d = Number(v);
      draft.hdays = draft.hdays.includes(d) ? draft.hdays.filter((x) => x !== d) : [...draft.hdays, d];
      renderHabitDays();
      break;
    }
    case 'day': {
      const d = Number(v);
      draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d];
      renderDays();
      break;
    }
    case 'alarm-opt': {
      const n = Number(v);
      draft.alarms = draft.alarms.includes(n) ? draft.alarms.filter((x) => x !== n) : [...draft.alarms, n];
      renderAlarms();
      break;
    }
    case 'add-note': addNote(); $('fNote').focus(); break;
    case 'add-sub': addSub(); $('fSub').focus(); break;
    case 'toggle-sub': {
      const s = draft.subtasks.find((x) => x.id === v);
      if (s) { s.done = el.checked; s.doneAt = s.done ? Date.now() : null; persistDraftList('subtasks'); renderSubs(); }
      break;
    }
    case 'del-note':
    case 'del-sub': {
      const field = action === 'del-note' ? 'notes' : 'subtasks';
      const rerender = field === 'notes' ? renderNotes : renderSubs;
      if (armed !== v) { armed = v; rerender(); armReset(() => { armed = null; if (draft) rerender(); }); break; }
      armed = null;
      draft[field] = draft[field].filter((n) => n.id !== v);
      persistDraftList(field);
      rerender();
      break;
    }
    case 'delete-task': {
      const btn = $('delBtn');
      if (!btn.classList.contains('armed')) {
        btn.classList.add('armed');
        btn.textContent = 'تأكيد الحذف';
        armReset(() => { btn.classList.remove('armed'); btn.textContent = 'حذف'; });
        break;
      }
      const delId = draft.id;
      closeSheet();
      removeTask(delId);
      toast('حُذفت');
      break;
    }
    case 'ics': {
      const t = commitDraft();
      if (!t) break;
      draftIsNew = false;
      $('delBtn').hidden = false;
      render();
      downloadFile(`${t.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, '') || 'mahami'}.ics`, buildICS(t), 'text/calendar');
      toast('افتح الملف ليُضاف الموعد ومنبهه إلى تقويمك');
      break;
    }
    case 'accent': S.settings.accent = v; save(); applyTheme(); render(); break;
    case 'theme': S.settings.theme = v; save(); applyTheme(); render(); break;
    case 'size': S.settings.size = v; save(); applyTheme(); render(); break;
    case 'font': S.settings.font = v; save(); applyTheme(); render(); break;
    case 'digits':
      if (S.settings.digits === v) break;
      S.settings.digits = v; save();
      location.reload(); // simplest way to redraw every number on the page
      break;
    case 'geo': useLocation(); break;
    case 'notif': ensureNotifPermission(); break;
    case 'notif-timer': ensureNotifPermission().then(() => { timerNotify(); render(); }); break;
    case 'test-alarm':
      unlockAudio();
      alarmQueue.unshift({ id: '__test', key: '__test' });
      showAlarm();
      setTimeout(beep, 50);
      systemNotify('منبه تجريبي من «مهامي»', 'هكذا ستصلك التنبيهات', '__test', '');
      break;
    case 'alarm-done':
    case 'alarm-snooze':
    case 'alarm-dismiss': {
      const cur = alarmQueue[0];
      if (!cur) { $('alarm').hidden = true; break; }
      if (cur.id === '__test') { alarmQueue.shift(); showAlarm(); break; }
      alarmAction(action === 'alarm-done' ? 'done' : action === 'alarm-snooze' ? 'snooze' : 'dismiss', cur.id, cur.key);
      break;
    }
    case 'hard-refresh':
      (async () => {
        try {
          if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
          if (window.caches) for (const k of await caches.keys()) if (k !== 'mahami-actions') await caches.delete(k);
        } catch {}
        location.reload();
      })();
      break;
    case 'export': exportData(); break;
    case 'import': $('importFile').click(); break;
    case 'wipe':
      if (confirm(Sync.connected() ? 'سيُحذف كل شيء نهائياً من هذا الجهاز ومن نسختك السحابية وكل أجهزتك المزامنة. هل أنت متأكد؟' : 'سيُحذف كل شيء نهائياً من هذا الجهاز. هل أنت متأكد؟')) {
        S.tasks = []; S.projects = []; S.sessions = []; S.memos = []; S.books = []; S.benefits = []; S.inspire = []; S.archive = []; S.ideas = []; S.journal = []; S.jtemplates = DEFAULT_TEMPLATES.map(normalizeJTemplate); S.hifz = []; S.hplans = []; S.finPlans = []; S.finDebts = []; S.finRights = []; S.finProjects = []; S.finTx = []; S.cvs = []; S.meals = []; S.mealDone = []; S.shop = []; S.lists = DEFAULT_LISTS.map(normalizeList); S.subs = []; S.later = []; S.weeks = []; S.people = []; S.decisions = []; S.quits = []; S.fired = {}; S.snoozed = {}; S.timer = null;
        try { indexedDB.deleteDatabase('mahami-media'); } catch {}
        save(); render(); toast('حُذفت كل البيانات');
      }
      break;
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'smartForm') return;
  e.preventDefault();
  const q = smartAll() && routeSmart(ui.smart);
  if (q) { const msg = runRoute(q); ui.smart = ''; render(); toast(msg); return; }
  const r = SmartParse.parse(ui.smart);
  if (!r.title) { toast('اكتب ما تريد فعله، مثل: اتصل بأبي بكرة الساعة 5'); return; }
  const t = smartToTask(r);
  S.tasks.push(t);
  save();
  ui.smart = '';
  render();
  if (t.alarms.length) ensureNotifPermission();
  const when = isRepeat(t) ? repeatLabel(t) : t.due ? relDate(t.due) : 'بلا تاريخ';
  toast(`أُضيفت: ${t.title} · ${when}${hasTime(t) ? ' · ' + timeLabel(t, t.due || t.repeat?.start || today()) : ''}`);
});

document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'search') { ui.q = e.target.value; render(); }
  if (id === 'smartIn') { ui.smart = e.target.value; $('smartPreview').innerHTML = smartPreviewHTML(); }
  if (id === 'setName') { S.settings.name = e.target.value; save(); renderGreeting(); }
});
document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (id === 'sort') { ui.sort = e.target.value; render(); }
  if (id === 'setSound') { S.settings.sound = e.target.checked; save(); }
  if (id === 'setHijri') { S.settings.hijri = e.target.checked; save(); render(); }
  if (id === 'setCity') setCity(e.target.value);
  if (id === 'setMethod' && S.settings.prayer) { S.settings.prayer.method = e.target.value; save(); render(); }
  if (id === 'setAsr' && S.settings.prayer) { S.settings.prayer.asr = e.target.value; save(); render(); }
  if (id === 'importFile' && e.target.files[0]) importData(e.target.files[0]);
  if (id === 'fTime' && e.target.value && draft && !draft.alarms.length) { draft.alarms = [0]; renderAlarms(); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('#fKind button, #fTimeMode button, #fRepeatMode button');
  if (!b || !draft) return;
  if (b.dataset.kind) { setKind(b.dataset.kind); updatePrayerHint(); }
  if (b.dataset.mode) setTimeMode(b.dataset.mode);
  if (b.dataset.rep && !b.disabled) setGoalMode(b.dataset.rep);
});

// chart readout (hover / touch)
document.addEventListener('pointerover', (e) => {
  const col = e.target.closest && e.target.closest('.col');
  if (!col || !$('readout')) return;
  document.querySelectorAll('.col.on').forEach((c) => c.classList.remove('on'));
  col.classList.add('on');
  $('readout').textContent = col.dataset.tip;
});

// ---------- install prompt ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  try { await deferredInstall.userChoice; } catch {}
  deferredInstall = null;
  $('installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; toast('ثُبّت التطبيق'); });

// ---------- service worker ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update()).catch(() => {});
  // a new version took over: reload once so every file comes from it
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || sheet.open || psheet.open) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'alarm-action') alarmAction(m.action, m.id, m.key);
    if (m.type === 'timer-pending') applyPendingTimerActions();
  });
}

// ---------- back button & exit confirmation ----------
// The back button first closes what is open, then returns to «اليوم»; on «اليوم» it asks before leaving.
let leaving = false;
function armBack() {
  if (!(history.state && history.state.mahamiGuard)) history.pushState({ mahamiGuard: 1 }, '', location.href);
}
let exitTimer = null;
function askExit() {
  $('exitBar').hidden = false;
  clearTimeout(exitTimer);
  exitTimer = setTimeout(() => { if (!$('exitBar').hidden) stayInApp(); }, 8000);
}
function stayInApp() {
  $('exitBar').hidden = true;
  clearTimeout(exitTimer);
  armBack();
}
function closeTopLayer() {
  if (typeof mstate !== 'undefined' && mstate) { closeMemo(); return true; }
  if (typeof jstate !== 'undefined' && jstate) { closeJournal(); return true; }
  if (typeof hzs !== 'undefined' && hzs) { closeStudy(); return true; }
  if ($('viewer').open) { closeViewer(); return true; }
  if ($('aiSheet').open) { closeAIPreview(); return true; }
  if ($('libSheet').open) { closeLib(); return true; }
  if (psheet.open) { closeProjectSheet(); return true; }
  if (sheet.open) { closeSheet(); return true; }
  return false;
}
window.addEventListener('popstate', () => {
  if (leaving) return;
  if (!$('exitBar').hidden) { $('exitBar').hidden = true; } // second back while asking: let it go
  if (closeTopLayer()) { armBack(); return; }
  if (ui.tab === 'tasks' && ui.project) { go('tasks', ''); armBack(); return; }
  if (MORE_TABS.includes(ui.tab) && ui.tab !== 'more') { go('more'); armBack(); return; }
  if (ui.tab !== 'today') { go('today'); armBack(); return; }
  askExit(); // not re-armed: pressing back again leaves the app
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-exit]');
  if (!b) return;
  if (b.dataset.exit === 'stay') { stayInApp(); return; }
  leaving = true;
  $('exitBar').hidden = true;
  if (S.timer) timerNotify();
  try { window.close(); } catch {}
  // a web app can't always close itself; the guard is already gone, so one more back leaves
  setTimeout(() => { leaving = false; if (!document.hidden) toast('اضغط زر الرجوع مرة أخرى للخروج'); }, 300);
});
// a history entry only counts once the user has interacted with the page
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { if ($('exitBar').hidden && !leaving) armBack(); }, { passive: true });

// dialogs closed by the system back gesture still save their work
$('memoEditor').addEventListener('close', () => { if (mstate) { saveMemoNow(); mstate = null; render(); } });
$('viewer').addEventListener('close', () => { if (viewing) closeViewer(); });
$('jEditor').addEventListener('close', () => { if (jstate) { saveJNow(); jstate = null; render(); } });
$('hzStudy').addEventListener('close', () => { if (hzs) { hzs = null; render(); } });

// ---------- boot ----------
(function boot() {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.slice(1);
  if (VIEWS[hash]) ui.tab = hash;
  applyTheme();
  render();
  localizeDigits(document.body);
  document.documentElement.lang = 'ar';
  handleShareLaunch(params);
  if (params.get('action') && params.get('id')) alarmAction(params.get('action'), params.get('id'), params.get('key') || '');
  const nw = params.get('new');
  if (nw === 'idea') { ui.tab = 'ideas'; render(); openIdea(null, { quick: true }); }
  else if (nw === 'journal') { ui.tab = 'journal'; render(); openJournal(null, (suggestedTpl() || {}).id); }
  else if (nw) openSheet(null, nw === 'goal' ? { kind: 'goal', repeat: true } : { kind: 'task' });
  if (params.toString()) history.replaceState(null, '', location.pathname + location.hash);
  checkAlarms();
  setInterval(checkAlarms, 15000);
  applyPendingTimerActions();
  Sync.start();
  setInterval(tickTimer, 1000);
  updateWakeLock();
  // Android's file picker sends the app to the background, and coming back re-renders the page,
  // replacing the <input type=file>: the chosen file then arrives on a detached input whose change
  // event the document listeners never hear. Re-attach it for a moment and pass the event on.
  document.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== 'file' || el.dataset.picker) return;
    el.dataset.picker = '1';
    el.addEventListener('change', () => {
      if (el.isConnected || !el.files || !el.files.length) return;
      el.hidden = true;
      document.body.appendChild(el);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.remove();
    });
  }, true);
  document.addEventListener('visibilitychange', () => {
    updateWakeLock();
    // leaving the app: refresh the timer's notification bar so it stays visible outside
    if (document.visibilityState === 'hidden' && S.timer) timerNotify();
    if (document.visibilityState === 'visible') { applyPendingTimerActions(); checkAlarms(); if (!sheet.open && !psheet.open) render(); }
  });
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (!sheet.open && !psheet.open) render(); } }, 60000);
})();
