'use strict';

const APP_VERSION = 107;

// ---------- constants ----------
const KEY = 'mahami-v2';
const OLD_KEY = 'my-tasks-v1';
const LOCALE = 'ar-u-nu-latn';
const HIJRI = 'ar-SA-u-ca-islamic-umalqura-nu-latn';
const PRI = { high: 3, mid: 2, low: 1 };
const PRI_LABEL = { high: 'عالية', mid: 'متوسطة', low: 'منخفضة' };
const DAY_ORDER = [0, 1, 2, 3, 4, 5, 6]; // Sunday first
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
// a task's date, plain: «اليوم»، «غداً، السبت ١٧ أكتوبر»، «الاثنين ١٩ أكتوبر»
function dueLabel(s) {
  const r = relDate(s);
  if (r === 'اليوم') return r;
  const full = fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long' });
  return r === 'غداً' || r === 'أمس' ? `${r}، ${full}` : full;
}
// relative day name, or the date with its Hijri day when it is further away
function relDateH(s) {
  const r = relDate(s);
  if (!S.settings.hijri || ['اليوم', 'غداً', 'أمس'].includes(r)) return r;
  return `${r} | ${fmtHijri(s, { day: 'numeric', month: 'long' })}`;
}
const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
// «بعد يومين»، «متأخر يومين»: the dual after a word takes the accusative/genitive form
const afterDays = (n) => (n === 1 ? 'غداً' : n === 2 ? 'بعد يومين' : `بعد ${daysWord(n)}`);
const lateDays = (n) => (n === 2 ? 'متأخر يومين' : `متأخر ${daysWord(n)}`);
const heldDays = (n) => (n === 2 ? 'صمدت يومين' : `صمدت ${daysWord(n)}`);
const daysWord = (n) => (n === 0 ? 'صفر' : plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً'));
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
    bookId: t.bookId || '',
    readPages: t.readPages && typeof t.readPages === 'object' ? t.readPages : {}, // a book task: pages actually read per session day
    readOn: /^\d{4}-\d{2}-\d{2}$/.test(t.readOn || '') ? t.readOn : '', // a reading session moved to another day («للغد» in the evening close)
    // «خطِّط» (plan.js, v97): its role (a project's task takes its project's), the area of «شحذ المنشار»,
    // the day it is a top priority, and the week it was moved from in a review
    roleId: t.roleId || '',
    area: t.area || '',
    prio: /^\d{4}-\d{2}-\d{2}$/.test(t.prio || '') ? t.prio : '',
    movedFrom: t.movedFrom || '',
    // v98: the week goal of «خطِّط» a task of its days serves, and «✦ ينعكس في حياتي» (سجل حياتي)
    kgoal: t.kgoal || '',
    life: !!t.life,
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
    topic: p.topic || '',
    roleId: p.roleId || '', // «خطِّط»: its tasks take this role
    area: p.area || '',
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
  s.fines = (Array.isArray(s.fines) ? s.fines : []).map(normalizeFine);
  s.reports = (Array.isArray(s.reports) ? s.reports : []).map(normalizeReport);
  s.subs = (Array.isArray(s.subs) ? s.subs : []).map(normalizeSub);
  s.later = (Array.isArray(s.later) ? s.later : []).map(normalizeLater);
  s.weeks = (Array.isArray(s.weeks) ? s.weeks : []).map(normalizeWeek);
  s.people = (Array.isArray(s.people) ? s.people : []).map(normalizePerson);
  s.decisions = (Array.isArray(s.decisions) ? s.decisions : []).map(normalizeDecision);
  s.quits = (Array.isArray(s.quits) ? s.quits : []).map(normalizeQuit);
  s.reminders = (Array.isArray(s.reminders) ? s.reminders : []).map(normalizeReminder);
  s.study = (Array.isArray(s.study) ? s.study : []).filter((x) => x && typeof x === 'object').map(normalizeScience);
  s.kunnasha = (Array.isArray(s.kunnasha) ? s.kunnasha : []).filter((x) => x && typeof x === 'object').map(normalizeKun);
  s.roles = khWithSaw((Array.isArray(s.roles) ? s.roles : []).filter((x) => x && typeof x === 'object').map(normalizeRole));
  s.kgoals = (Array.isArray(s.kgoals) ? s.kgoals : []).filter((x) => x && typeof x === 'object').map(normalizeKGoal);
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
  calMonth: today().slice(0, 7), calSel: today(), calH: '', smart: '', timerEnded: null,
};

function save() {
  khMemo.clear(); // the plan's sums are on the data (plan.js)
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast('تعذّر الحفظ. قد تكون مساحة التخزين ممتلئة.'); }
  if (typeof Sync !== 'undefined') Sync.schedule();
  if (typeof pinSoon === 'function') pinSoon();
}
const getTask = (id) => S.tasks.find((t) => t.id === id);
const getProject = (id) => S.projects.find((p) => p.id === id);

// ---------- kinds ----------
const isGoal = (t) => t.kind === 'goal';
const isRepeat = (t) => !!t.repeat;
// a reading goal (bookId) is ticked whole: its pages move the book on (reading.js)
const isCounted = (t) => isGoal(t) && t.target > 1 && !t.bookId;
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
  // a task of the days of a goal in «خطِّط» shows in its goal's months and weeks only (plan.js, v98)
  return r.days.includes(parse(d).getDay()) && (!t.kgoal || khChainOn(t, d));
}
// a reading project's book task is done on a day it holds that day's session
const doneOn = (t, d) => (isRepeat(t) ? !!t.completions[d] : t.done || !!(t.bookId && t.completions && t.completions[d]));
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
    if (d === t0 && !t.completions[d]) continue; // today is not missed while it lasts
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
  // a book's task in a reading project progresses with its pages
  const bk = t.bookId && !isRepeat(t) && typeof getBook === 'function' ? getBook(t.bookId) : null;
  if (bk && bk.pages) return Math.min(1, (bk.page || 0) / bk.pages);
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
  // (a reading session done today can still be taken back, though the book's task moved to its next day)
  if (notYetOn(t, d) && !doneOn(t, d)) { toast(`موعدها ${dueLabel(isRepeat(t) ? d : t.due)}`); return; }
  if (t.bookId && readingSession(t, d)) { save(); render(); return; }
  const wasDone = doneOn(t, d);
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
  if (t.bookId) readingFromTask(t, d);
  save();
  checkGraduation(t);
  render();
  if (!wasDone && (doneOn(t, d) || isCounted(t))) haptic();
  if (!wasDone && doneOn(t, d)) askDuration(t, isRepeat(t) ? d : today());
  const p = projectOf(t);
  if (p && t.done) {
    const st = projectStats(p.id);
    if (st.total && st.done === st.total) toast(`أحسنت! أنجزت كل مهام مشروع «${p.name}»`);
  }
}

function step(id, date, delta) {
  const t = getTask(id);
  if (!t) return;
  if (delta > 0 && notYetOn(t, date)) { toast(`موعدها ${dueLabel(isRepeat(t) ? date : t.due)}`); return; }
  const wasDone = doneOn(t, date);
  setCount(t, date, countOn(t, date) + delta);
  save();
  checkGraduation(t);
  render();
  if (delta > 0) haptic();
  if (!wasDone && doneOn(t, date)) askDuration(t, date);
}
// a short pulse when something is ticked done (Android), unless turned off in the settings
function haptic() { try { if (S.settings.haptic !== false && navigator.vibrate) navigator.vibrate(12); } catch {} }

// a task gone: its timer and alarms go with it (removeTask also saves and redraws; plan.js deletes with dropTask)
function dropTask(id) {
  if (S.timer && S.timer.taskId === id) { S.timer = null; timerNotify(true); }
  S.tasks = S.tasks.filter((t) => t.id !== id);
  for (const k of Object.keys(S.fired)) if (k.startsWith(id + '|')) delete S.fired[k];
  for (const k of Object.keys(S.snoozed)) if (k.startsWith(id + '|')) delete S.snoozed[k];
}
function removeTask(id) {
  dropTask(id);
  save();
  render();
}

// ---------- rendering: items ----------
// a task whose day has not come yet cannot be marked done before it (a goal's date is a deadline, so it can)
const notYet = (t) => !isGoal(t) && !t.done && !!t.due && t.due > today();
// …and a recurring goal's day that has not come yet
const notYetOn = (t, d) => notYet(t) || (isRepeat(t) && !!d && d > today());
function checkButton(t, d, done) {
  if (isRepeat(t) && d > today() && !done) return `<button type="button" class="check later" disabled aria-label="${esc(`يُتاح ${dueLabel(d)}`)}">${icon('check')}</button>`;
  if (notYet(t) && !done) return `<button type="button" class="check later" disabled aria-label="${esc(`يُتاح ${dueLabel(t.due)}`)}">${icon('check')}</button>`;
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
    meta.push(`<span class="${late ? 'late' : ''}">${icon('cal')}${late ? 'متأخرة: ' : t.bookId && !t.done ? 'الجلسة القادمة: ' : ''}${esc(dueLabel(t.due))}</span>`);
  }
  if (hasTime(t)) meta.push(`<span class="num">${icon(t.alarms.length ? 'bell' : t.prayer ? 'moon' : 'clock')}${esc(timeLabel(t, d || t.due || today()))}</span>`);
  if (isCounted(t)) meta.push(`<span class="num count-btn">${countOn(t, d || today())} من ${t.target}${t.unit ? ' ' + esc(t.unit) : ''}</span>`);
  if (t.subtasks.length) meta.push(`<span class="num">${icon('steps')}خطوات: ${t.subtasks.filter((x) => x.done).length} من ${t.subtasks.length}</span>`);
  if (t.notes.length) meta.push(`<span class="num">${icon('note')}${plural(t.notes.length, 'ملاحظة', 'ملاحظتان', 'ملاحظات', 'ملاحظة')}</span>`);
  // a repeating goal: that day's time only («اليوم» is for today), and «استغرقت» once that day is done
  const tracked = isRepeat(t) && d ? sessionsOf(t.id).filter((x) => sessionDay(x) === d).reduce((n, x) => n + x.ms, 0) : trackedMs(t.id);
  // (a book task's reading time is shown with its past sessions, not beside its next date)
  if (tracked >= 60000 && !t.bookId) meta.push(`<span class="num">${icon('clock')}${(isRepeat(t) && d ? doneOn(t, d) : t.done) ? 'استغرقت' : 'عملت عليها'}: ${fmtDur(tracked)}</span>`);
  return meta.join('');
}

function itemHTML(t, date, opts) {
  const d = date || today();
  const done = doneOn(t, d);
  const p = projectOf(t);
  // (the book's pages and sessions are shown in its project and calendar, not on «اليوم», which is today only)
  const bk = t.bookId && !isRepeat(t) && ui.tab !== 'today' ? getBook(t.bookId) : null;
  const steps = !t.done && (t.subtasks.length || (bk && bk.pages)) ? `<span class="mini-progress" aria-hidden="true"><i style="width:${taskProgress(t) * 100}%"></i></span>` : '';
  // a book's task: where the reading stands and its last sessions
  const sess = bk ? Object.keys(t.completions || {}).sort() : [];
  // the sessions with their total time, then the last one with its own day and time
  const readMs = bk ? trackedMs(t.id) : 0;
  const lastD = sess[sess.length - 1];
  const lastMs = lastD ? sessionsOf(t.id).filter((x) => sessionDay(x) === lastD).reduce((n, x) => n + x.ms, 0) : 0;
  const readLine = bk ? `<span class="meta">${[
    bk.pages ? `صفحة ${bk.page || 0} من ${bk.pages}` : bk.page ? `صفحة ${bk.page}` : '',
    sess.length ? `الجلسات: ${sess.length}${readMs >= 60000 ? ` (مجموع مدتها ${fmtDur(readMs)})` : ''}` : '',
    lastD ? `الجلسة الأخيرة: ${esc(relDate(lastD))}${lastMs >= 60000 ? ` (${fmtDur(lastMs)})` : ''}` : '',
  ].filter(Boolean).map((x) => `<span>${x}</span>`).join('')}</span>` : '';
  return `<li class="task p-${t.priority}${done ? ' done' : ''}${isGoal(t) ? ' is-goal' : ''}"${p ? ` style="--pc:${p.color}"` : ''}>
    ${checkButton(t, d, done)}
    <button type="button" class="t-main" data-action="open" data-id="${t.id}">
      <span class="t-title">${esc(t.title)}</span>
      <span class="meta">${metaHTML(t, d, opts)}</span>
      ${readLine}
      ${steps}
    </button>
    ${(opts && opts.extra) || ''}
  </li>`;
}

const emptyHTML = (title, text, action) =>
  `<div class="empty"><strong>${title}</strong><span>${text}</span>${action || ''}</div>`;
// choosing several items to delete together (القوائم، دروس الدراسة): the bar above them, and a delete
// that asks «متأكد؟» on the first tap and deletes on the second
const selBar = (p, n, total) => `<div class="sel-bar" role="toolbar">
    <b>${n ? `المحدد: ${n} من ${total}` : 'اضغط ما تريد حذفه لتحدده'}</b>
    <div class="btn-row"><button type="button" class="ghost sm" data-action="${p}-sel-all">${n === total ? 'ألغِ تحديد الكل' : 'حدّد الكل'}</button>
      <button type="button" class="danger sel-del" data-action="${p}-sel-del"${n ? '' : ' disabled'}>احذف المحدد (${n})</button>
      <button type="button" class="ghost sm" data-action="${p}-sel-done">إلغاء</button></div>
  </div>`;
function selArmed(el) {
  if (el.classList.contains('armed')) return true;
  const label = el.textContent;
  el.classList.add('armed'); el.textContent = 'متأكد؟ اضغط للحذف';
  setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = label; } }, 4000);
  return false;
}
const addBtn = (action, label, extra = '') => `<button type="button" class="add-btn" data-action="${action}"${extra}>${icon('plus')}${label}</button>`;

function itemsOn(d) {
  // (a book task also shows on the days it held a reading session, though its date has moved on)
  return S.tasks.filter((t) => (isRepeat(t) ? occursOn(t, d) : t.due === d || !!(t.bookId && t.completions && t.completions[d])));
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
    ${AI.on() ? `<div class="btn-row smart-ai">${aiBtn('ai-smart', 'افهمها بالذكاء الاصطناعي')}<small class="hint explain">لجملة طويلة أو عدة مهام في فقرة واحدة</small></div>` : ''}
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
  const q = smartRoute(text);
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
  syncReading(); // books' reading goals and project tasks, before today's list is read
  const d = today();
  const items = S.tasks.filter((t) => {
    if (isRepeat(t)) return occursOn(t, d);
    if (t.bookId && t.completions && t.completions[d]) return true; // today's reading session stays, ticked
    if (!t.done && t.due && t.due <= d) return true;
    return t.done && t.doneAt && iso(new Date(t.doneAt)) === d;
  });
  items.sort(byTime(d));
  const done = items.filter((t) => doneOn(t, d)).length;
  const p = pct(done, items.length);
  const late = items.filter((t) => !isRepeat(t) && !t.done && t.due && t.due < d).length;
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
      <span class="muted">${late ? `<span class="late">${late} متأخرة</span>` : ''}${S.settings.hijri ? `${late ? ' | ' : ''}${esc(fmtHijri(d))}` : ''}</span>
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
    reminders: remindersTodayHTML,
    study: studyTodayHTML,
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
  const sub = st.total ? `المهام: ${st.done} من ${st.total}` : 'لا مهام بعد';
  return `<button type="button" class="pcard" data-action="open-project" data-v="${p.id}" style="--pc:${p.color}">
    <span class="pcard-top"><i class="pdot"></i><span class="pname">${esc(p.name)}</span></span>
    <span class="pbar"><i style="width:${st.progress}%"></i></span>
    <span class="psub"><span class="num">أُنجز ${st.progress}%</span><span>${sub}</span></span>
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
    <div class="section-head"><h2>مهام عامة</h2><div class="btn-row">${taskBulkBtn('')}${addBtn('new', 'مهمة')}</div></div>
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
      <span>أُنجز <b class="num">${st.progress}%</b></span>
      <span>المهام: <b class="num">${st.done} من ${st.total}</b></span>
      ${st.steps ? `<span>خطوات داخل المهام: <b class="num">${st.stepsDone} من ${st.steps}</b></span>` : ''}
      ${p.due ? `<span class="${p.due < today() && st.progress < 100 ? 'late' : ''}">${icon('flag')} ينتهي ${esc(relDateH(p.due))}</span>` : ''}
    </div>
  </section>
  <section class="section">
    <div class="section-head"><h2>مهام المشروع</h2><div class="btn-row">${aiBtn('ai-plan', 'خطّط المشروع', ` data-v="${p.id}"`)}${taskBulkBtn(p.id)}${addBtn('new-in-project', 'مهمة', ` data-v="${p.id}"`)}</div></div>
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

// the calendar by Hijri (Umm al-Qura) months too (v97, in «المزيد»): a month from its first day to the next one's
const HDAY_FMT = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric' });
const hDayNum = (d) => Number(HDAY_FMT.format(parse(d)));
const hMonthStart = (d) => addDays(d, 1 - hDayNum(d));
function hMonthNext(start) { let x = addDays(start, 28); while (hDayNum(x) !== 1) x = addDays(x, 1); return x; }
const calHijri = () => S.settings.calType === 'hijri';
// the shown month: [its first day, the next month's first day)
function calSpan() {
  if (calHijri()) { const a = ui.calH || hMonthStart(today()); return [a, hMonthNext(a)]; }
  const [y, m] = ui.calMonth.split('-').map(Number);
  return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 1))];
}
function viewCalendar() {
  const [mStart, mNext] = calSpan(), hij = calHijri();
  const first = parse(mStart);
  const lead = first.getDay(); // weeks start on Sunday
  const daysIn = Math.round((parse(mNext) - first) / 86400000);
  const total = Math.ceil((lead + daysIn) / 7) * 7;
  const t0 = today();
  const cells = [];
  const projectsShown = new Set();
  for (let i = 0; i < total; i++) {
    const d = addDays(mStart, i - lead);
    const out = d < mStart || d >= mNext;
    const items = itemsOn(d);
    if (!out) for (const t of items) if (t.projectId) projectsShown.add(t.projectId);
    // a project's tasks show as one mark of its colour, not one per task
    const seen = new Set();
    const shown = items.filter((t) => !t.projectId || (!seen.has(t.projectId) && seen.add(t.projectId)));
    const marks = shown.slice(0, 4).map((t) => markOf(t, d)).join('') + (shown.length > 4 ? `<span class="more">+${shown.length - 4}</span>` : '');
    const label = `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${items.length ? `، ${items.length} عنصر` : ''}`;
    cells.push(`<button type="button" class="cal-day${out ? ' out' : ''}${d === t0 ? ' today' : ''}${d === ui.calSel ? ' sel' : ''}" data-action="cal-day" data-v="${d}" aria-label="${esc(label)}" aria-pressed="${d === ui.calSel}"><span class="n">${hij ? hDayNum(d) : parse(d).getDate()}</span>${hij ? `<span class="hd">${parse(d).getDate()}</span>` : S.settings.hijri ? `<span class="hd">${esc(fmtHijri(d, { day: 'numeric' }))}</span>` : ''}<span class="marks">${marks}</span></button>`);
  }
  const lastIso = addDays(mNext, -1);
  const g1 = first.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }), g2 = parse(lastIso).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  const h1 = fmtHijri(mStart, { month: 'long', year: 'numeric' });
  const h2 = fmtHijri(lastIso, { month: 'long', year: 'numeric' });
  // the month's own name on top, the other calendar's months under it
  const monthName = hij ? h1 : g1;
  const hijri = hij ? (g1 === g2 ? g1 : `${first.toLocaleDateString(LOCALE, { month: 'long' })} – ${g2}`) : h1 === h2 ? h1 : `${fmtHijri(mStart, { month: 'long' })} – ${h2}`;
  const sel = ui.calSel;
  const selAll = itemsOn(sel).sort(byTime(sel));
  const selItems = selAll.filter((t) => !t.projectId || !getProject(t.projectId));
  const selProjects = [...new Set(selAll.filter((t) => t.projectId && getProject(t.projectId)).map((t) => t.projectId))].map(getProject);
  const legendProjects = [...projectsShown].map(getProject).filter(Boolean);
  return `
  <div class="seg cal-type" role="group" aria-label="التقويم"><button type="button" data-action="cal-type" data-v="greg" aria-pressed="${!hij}">ميلادي</button><button type="button" data-action="cal-type" data-v="hijri" aria-pressed="${hij}">هجري</button></div>
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
      ${t0 < mStart || t0 >= mNext || sel !== t0 ? '<button type="button" class="chip" data-action="cal-today">اليوم</button>' : ''}
    </div>
  </div>
  <section class="section">
    <div class="section-head">
      <h2>${esc(fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
      <div class="btn-row">${addBtn('new-on', 'مهمة', ` data-v="${sel}"`)}${addBtn('new-goal-on', 'هدف', ` data-v="${sel}"`)}</div>
    </div>
    <small class="hint">${esc(fmtHijri(sel))}</small>
    ${selProjects.length ? `<div class="cal-projs">${selProjects.map((p) => { const n = selAll.filter((t) => t.projectId === p.id); const left = n.filter((t) => !doneOn(t, sel)).length; return `<button type="button" class="cal-proj" data-action="open-project" data-v="${p.id}" style="--pc:${p.color}"><i class="m m-proj"></i><b>${esc(p.name)}</b><small>${left ? plural(left, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة') : 'أُنجز ✓'}</small></button>`; }).join('')}</div>` : ''}
    ${selItems.length ? `<ul class="list">${selItems.map((t) => itemHTML(t, sel)).join('')}</ul>` : selProjects.length ? '' : emptyHTML('لا شيء في هذا اليوم', 'أضف مهمة أو هدفاً بتاريخ هذا اليوم.')}
  </section>`;
}

// ---------- view: goals ----------
function stepperHTML(t, d) {
  const c = countOn(t, d);
  return `<div class="stepper-row">
    <div class="stepper">
      <button type="button" data-action="step" data-id="${t.id}" data-date="${d}" data-v="-1" aria-label="إنقاص">−</button>
      <span class="val">${c} من ${t.target}${t.unit ? ' ' + esc(t.unit) : ''}</span>
      <button type="button" data-action="step" data-id="${t.id}" data-date="${d}" data-v="1" aria-label="زيادة">+</button>
    </div>
    <div class="progress-line"><i style="width:${pct(c, t.target)}%"></i></div>
  </div>`;
}

// «الأهداف» was a page of its own until v97; its goals are in «خطِّط» now (أدواري، أسبوعي), and its habits
// («بناء العادات»، «عادات أتركها») on the page «العادات» in «المزيد», as they were
const viewHabits = () => `${moreCrumb()}${habitsSectionHTML()}${quitsSectionHTML()}`;

// ---------- what was done, by day (the report counts it; «إحصائياتي» is in «خطِّط», plan.js, since v99) ----------
// every completed thing with its day: tasks, goals (each day of a recurring goal) and steps
function completionEvents() {
  const ev = [];
  for (const t of S.tasks) {
    if (t.bookId && !getBook(t.bookId)) continue; // a deleted book's sessions went with it (as in «الكتب» in the report)
    const cat = t.category || 'بلا تصنيف';
    // kind: what the report counts it as (a habit day, a reading session, a goal day, a task)
    if (isRepeat(t)) for (const d of Object.keys(t.completions)) ev.push({ d, cat, type: 'goal', kind: isHabit(t) ? 'habit' : t.bookId ? 'read' : 'goal' });
    // (a book task with reading sessions: the sessions are its events, its finishing is not one more)
    else if (t.done && t.doneAt && !(t.bookId && Object.keys(t.completions || {}).length)) ev.push({ d: iso(new Date(t.doneAt)), cat, type: isGoal(t) ? 'goal' : 'task', kind: t.bookId ? 'book' : isGoal(t) ? 'goal' : 'task', projectId: t.projectId });
    // a reading project's book task: each day's reading session is a task done that day
    if (!isRepeat(t) && t.bookId) for (const d of Object.keys(t.completions || {})) ev.push({ d, cat, type: 'task', kind: 'read', projectId: t.projectId });
    for (const s of t.subtasks) if (s.done && s.doneAt) ev.push({ d: iso(new Date(s.doneAt)), type: 'step', projectId: t.projectId });
  }
  return ev;
}

const hbar = (name, value, width, color) =>
  `<li class="hbar"><span class="name">${name}</span><span class="track"><span class="fill" style="width:${width}%;${color ? ` background:${color};` : ''} display:block"></span></span><span class="v">${value}</span></li>`;

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
    <p class="note-text explain">تُحسب على جوالك دون إنترنت، وتستخدمها المهام المرتبطة بالصلاة مثل «بعد العصر».</p>
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
    <p class="note-text">الشروق ${esc(fmtMin(pt.sunrise))}<span class="explain">. تُحسب بتوقيت جوالك، فاختر مدينة في نفس منطقتك الزمنية.</span></p>` : ''}
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
        <span class="big" style="font-family:${esc(fd)}, serif">${name}: الوعي الشخصي</span>
        <small style="font-family:${esc(fb)}, serif">${desc} | اتصل بأبي الساعة 5 العصر</small></button>`).join('')}</div>
    </div>
    <div class="field"><span>الأرقام</span>
      <div class="seg">${segBtn('digits', 'arab', 'عربية ١٢٣', st.digits)}${segBtn('digits', 'latn', 'إنجليزية 123', st.digits)}</div>
    </div>
    <label class="switch"><input type="checkbox" id="setAskTime"${st.askTime !== false ? ' checked' : ''}><span>بعد إنجاز مهمة أو هدف اسألني: كم استغرقت؟</span></label>
    <label class="switch"><input type="checkbox" id="setHaptic"${st.haptic !== false ? ' checked' : ''}><span>اهتزاز خفيف عند إتمام مهمة أو هدف أو عادة</span></label>
    <label class="switch"><input type="checkbox" id="setExplain"${st.explain ? ' checked' : ''}><span>إظهار شرح الخانات والصفحات</span></label>
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
    <div class="field"><span>صوت المنبه (يتكرر ${RING_MIN} دقائق حتى ترد عليه)</span>
      <div class="btn-row" style="flex-wrap:nowrap"><select id="setTone" style="flex:1;min-width:0">${Object.entries(TONES).map(([v, [l]]) => `<option value="${v}"${(st.tone || 'chime') === v ? ' selected' : ''}>${l}</option>`).join('')}</select><button type="button" class="ghost sm" data-action="tone-try">جرّب</button></div></div>
    <p class="note-text explain">يرن المنبه والتطبيق مفتوح أو في الخلفية. الجوال قد يوقف التطبيقات المغلقة تماماً، فللمواعيد المهمة افتح المهمة واضغط «إضافة إلى تقويم الجوال».</p>
  </section>
  <section class="panel">
    <h2>نسخة احتياطية</h2>
    <p class="note-text explain">بياناتك محفوظة على هذا الجهاز فقط. صدّرها لتنقلها إلى جهاز آخر أو تحتفظ بنسخة.</p>
    <div class="btn-row">
      <button type="button" class="ghost" data-action="export">تصدير البيانات</button>
      <button type="button" class="ghost" data-action="import">استيراد من ملف</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
    </div>
  </section>
  <section class="panel">
    <h2>تحديث التطبيق</h2>
    <p class="note-text explain">إذا لم يعمل زر أو قسم، اضغط هنا ليُحمَّل التطبيق من جديد. مهامك لن تُحذف.</p>
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
  today: viewToday, tasks: viewTasks, timer: () => viewTimer(), calendar: () => moreCrumb() + viewCalendar(), habits: viewHabits, plan: viewPlan,
  settings: viewSettings, ...LibraryViews,
};
const MORE_TABS = ['more', 'reminders', 'calendar', 'habits', 'health', 'shop', 'finance', 'cv', 'ideas', 'journal', 'hifz', 'people', 'decisions', 'study', 'notes', 'books', 'benefits', 'inspire', 'archive', 'report'];

function render() {
  const view = $('view');
  khMemo.clear();
  const active = document.activeElement && view.contains(document.activeElement) ? document.activeElement.id : null;
  const caret = active && 'selectionStart' in document.activeElement ? document.activeElement.selectionStart : null;
  // the page stays where it is: redrawing never scrolls to the field that had the cursor
  const y = window.scrollY;
  view.innerHTML = VIEWS[ui.tab]();
  boxLines(view);
  renameHeads(view);
  hydrateImages(view);
  if (window.scrollY !== y) window.scrollTo(0, y);
  if (active && $(active)) {
    $(active).focus({ preventScroll: true });
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
  // the page is remembered as soon as it is shown, not only on leaving (v96)
  saveWhere();
  // an alarm whose task was just ticked or deleted (from the list under it) stops showing
  if (alarmQueue.length) showAlarm();
}

// a descriptive line whose pieces are joined by « | » shows each piece in its own small box,
// so the eye tells them apart at once (one text never runs into another)
function boxLines(root) {
  for (const el of root.querySelectorAll('.book-line, .meta > span, .boxes')) {
    if (el.querySelector('.dbox') || !/ \| /.test(el.textContent)) continue;
    const groups = [[]];
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3 && n.textContent.includes(' | ')) {
        n.textContent.split(' | ').forEach((s, i) => { if (i) groups.push([]); if (s) groups[groups.length - 1].push(document.createTextNode(s)); });
      } else groups[groups.length - 1].push(n);
    }
    el.textContent = '';
    for (const g of groups) { if (!g.length) continue; const b = document.createElement('span'); b.className = 'dbox'; g.forEach((n) => b.append(n)); el.append(b); }
    el.classList.add('boxed');
  }
}

function renderGreeting() {
  const name = S.settings.name.trim();
  const hello = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const t0 = today();
  $('greeting').textContent = `${hello}${name ? '، ' + name : ''} | ${fmtDate(t0, { weekday: 'long', day: 'numeric', month: 'long' })}${S.settings.hijri ? ` | ${fmtHijri(t0)}` : ''}`;
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
// a dot between Arabic digits looks like the Arabic zero («٥٨.٥» reads «٥٨٠٥»), so decimals take «٫»
const toArabicDigits = (s) => s.replace(/(https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+)|[0-9]/g, (m, keep) => keep || AR_DIGITS[m]).replace(/([٠-٩])\s?%/g, '$1٪').replace(/([٠-٩])\.(?=[٠-٩])/g, '$1٫');
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
  root.classList.toggle('show-explain', !!S.settings.explain);
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
  khSyncRoleField(); // a goal has no project: its own role
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
  $('prayerHint').textContent = `الوقت ${['اليوم', 'غداً', 'أمس'].includes(relDate(d)) ? relDate(d) : `في ${relDate(d)}`}: ${fmtMin(pt[p.name] + p.offset)} (${Prayer.NAMES[p.name]} ${fmtMin(pt[p.name])})`;
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
  // an alarm set in the quick add («قبلها بـ 20 دقيقة») shows too, so it can be seen and removed
  const extra = draft.alarms.filter((v) => !ALARM_OPTIONS.some(([o]) => o === v)).map((v) => [v, `قبل ${v < 60 ? `${v} د` : minsWord(v)}`]);
  $('fAlarms').innerHTML = [...ALARM_OPTIONS, ...extra].sort((a, b) => a[0] - b[0]).map(([v, l]) =>
    `<button type="button" data-action="alarm-opt" data-v="${v}" aria-pressed="${draft.alarms.includes(v)}">${l}</button>`).join('');
}

function renderNotes() {
  const notes = draft.notes;
  $('notesCount').textContent = notes.length ? `(${notes.length})` : '';
  // each note can move to the notes page: into a new note or one already there
  const memos = S.memos.slice().sort((a, b) => b.updated - a.updated);
  const memoName = (m) => excerpt(m.title || noteText(m.html).split('\n')[0] || 'ملاحظة بلا عنوان', 40);
  $('notesList').innerHTML = notes.slice().reverse().map((n) => `
    <li class="note"><p>${esc(n.text)}</p>
      <div class="note-foot"><span class="num">${esc(fmtStamp(n.at))}</span>
      <span class="note-btns"><button type="button" data-action="note-move" data-v="${n.id}">إلى ${esc(pageName('notes'))}</button>
      <button type="button" data-action="del-note" data-v="${n.id}" class="${armed === n.id ? 'armed' : ''}">${armed === n.id ? 'تأكيد الحذف' : 'حذف'}</button></span></div>
      ${draft.moveNote === n.id ? `<div class="note-move">
        <select id="nmTarget" aria-label="إلى أي ملاحظة"><option value="">ملاحظة جديدة</option>${memos.map((m) => `<option value="${m.id}">${esc(memoName(m))}</option>`).join('')}</select>
        <button type="button" class="primary sm" data-action="note-move-go" data-v="${n.id}">انقل</button>
        <button type="button" class="ghost sm" data-action="note-move" data-v="">إلغاء</button>
      </div>` : ''}
    </li>`).join('');
}

function renderSubs() {
  const subs = draft.subtasks;
  $('subsCount').textContent = subs.length ? `(${subs.filter((s) => s.done).length} من ${subs.length} منجزة)` : '';
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
    autoAlarm: !t || (!t.alarms.length && !hasTime(t)), // a time given later rings; an alarm turned off stays off
    timeMode: t && t.prayer ? 'prayer' : t && t.time ? 'clock' : 'none',
    fromBenefit: opts.fromBenefit || '',
    onSaved: opts.onSaved || null, // what made it (an idea, an archived item) is marked only once the task is saved
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
  khFillRole(t ? t.roleId : opts.roleId || '', t ? t.area : '');
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
  // an offset not in the list (40 minutes, from the quick add) is added to it as it is, not turned into 15 on saving
  for (const o of [...$('fPrMin').options]) if (o.dataset.extra) o.remove();
  if (![...$('fPrMin').options].some((o) => o.value === absOff)) { const o = new Option(`بـ ${minsWord(Number(absOff))}`, absOff); o.dataset.extra = '1'; $('fPrMin').add(o); }
  $('fPrMin').value = absOff;
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
    roleId: $('fRole').value,
    area: $('fRole').value === KH_SAW ? $('fArea').value : '',
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
      // a time with no deadline is for today, as for a task (it never rang and never showed in «اليوم»)
      t.due = $('fGoalDue').value || (hasTime(t) ? today() : '');
      if (t.target > 1) { t.count = Math.min(t.count, t.target); t.done = t.count >= t.target; t.doneAt = t.done ? (base.doneAt || Date.now()) : null; } else t.count = 0;
    }
    // a changed daily amount re-judges the days already counted (7 of a new 6 is done; 6 of a new 8 is not)
    if (t.repeat && t.counts) for (const [d, n] of Object.entries(t.counts)) {
      if (t.target <= 1) { if (n >= 1) t.completions[d] = t.completions[d] || Date.now(); delete t.counts[d]; continue; }
      if (n >= t.target) { t.counts[d] = t.target; t.completions[d] = t.completions[d] || Date.now(); } else delete t.completions[d];
    }
  } else {
    t.repeat = null;
    t.habit = null;
    t.target = 1;
    t.unit = '';
    t.projectId = $('fProject').value;
    // a project's task takes its project's role, and keeps none of its own
    if (t.projectId) { t.roleId = ''; t.area = ''; }
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
  // a new time may ring again; an edit that leaves the time and alarms as they were does not ring an answered alarm again
  const timing = (x) => JSON.stringify([x.due, x.time, x.prayer, x.alarms, x.repeat && x.repeat.days]);
  if (!was || timing(was) !== timing(t)) for (const k of Object.keys(S.fired)) if (k.startsWith(t.id + '|')) delete S.fired[k];
  save();
  return t;
}

// several tasks at once (v93): each line a task, all with one date and one project
const taskBulkBtn = (pid) => `<button type="button" class="add-btn" data-action="task-bulk" data-v="${pid}">${icon('plus')}عدة مهام</button>`;
function openTaskBulk(pid, roleId = '') {
  ldraft = { kind: 'tbulk', id: '', isNew: true };
  $('libForm').innerHTML = `${sheetHead('عدة مهام مرة واحدة')}
    <label class="field"><span>المهام: كل مهمة في سطر</span><textarea id="tbText" rows="8" placeholder="حجز تذاكر السفر&#10;تجديد الجواز&#10;شراء هدية"></textarea></label>
    <p class="note-text" id="tbCount"></p>
    <label class="field"><span>المشروع</span><select id="tbProject"><option value="">بلا مشروع (مهام عامة)</option>${S.projects.map((p) => `<option value="${p.id}"${p.id === pid ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label class="field"><span>الدور</span><select id="tbRole">${khRoleOptions(roleId)}</select><small class="hint">مهام المشروع تأخذ دور مشروعها.</small></label>
    <label class="field" id="tbAreaWrap"${roleId === KH_SAW ? '' : ' hidden'}><span>الجانب</span><select id="tbArea">${khAreaOptions('health')}</select></label>
    <label class="field"><span>التاريخ (اختياري)</span><input type="date" id="tbDue"></label>
    <div class="sheet-actions"><button type="submit" class="primary">أضفها</button></div>`;
  showLib();
  setTimeout(() => $('tbText') && $('tbText').focus(), 50);
}
const tbCountLine = (n) => (n ? `ستُضاف ${plural(n, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')}` : '');
function saveTaskBulk() {
  const lines = stPasteLines($('tbText').value);
  if (!lines.length) { toast('اكتب المهام، كل مهمة في سطر.'); $('tbText').focus(); return false; }
  const projectId = $('tbProject').value, due = $('tbDue').value, now = Date.now();
  // the first line stays first in «الأحدث»
  const roleId = projectId ? '' : $('tbRole').value;
  S.tasks.push(...lines.map((title, i) => normalize({ kind: 'task', title, projectId, due, roleId, area: roleId === KH_SAW ? ($('tbArea') ? $('tbArea').value : 'health') : '', created: now + lines.length - i })));
  save();
  const p = getProject(projectId);
  setTimeout(() => toast(`أُضيفت ${plural(lines.length, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')}${p ? ` إلى «${p.name}»` : ''}`), 300);
  return true;
}
document.addEventListener('input', (e) => { if (e.target.id === 'tbText' && $('tbCount')) $('tbCount').textContent = digitsOut(tbCountLine(stPasteLines(e.target.value).length)); });

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
  const fromBenefit = draft.fromBenefit, onSaved = draft.onSaved;
  const t = commitDraft();
  if (!t) return;
  if (fromBenefit && getBenefit(fromBenefit)) { getBenefit(fromBenefit).actionId = t.id; save(); }
  if (onSaved) { onSaved(t); save(); }
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

function openProjectSheet(id, roleId = '') {
  const p = id ? getProject(id) : null;
  const used = new Set(S.projects.map((x) => x.color));
  const color = p ? p.color : (PROJECT_COLORS.find(([c]) => !used.has(c)) || PROJECT_COLORS[0])[0];
  pdraft = { id: p ? p.id : uid(), color, isNew: !p, onSaved: null };
  // a delete armed on another project does not carry over to this one
  projArmed = false; $('pDel').classList.remove('armed'); $('pDel').textContent = 'حذف المشروع';
  $('projTitle').textContent = p ? 'تعديل المشروع' : 'مشروع جديد';
  $('pName').value = p ? p.name : '';
  $('pDesc').value = p ? p.desc : '';
  $('pDue').value = p ? p.due : '';
  $('pRole').innerHTML = khRoleOptions(p ? p.roleId : roleId);
  $('pArea').innerHTML = khAreaOptions(p ? p.area : '');
  $('pAreaWrap').hidden = $('pRole').value !== KH_SAW;
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
  const p = normalizeProject({ ...(existing || { created: Date.now() }), id: pdraft.id, name, color: pdraft.color, desc: $('pDesc').value.trim(), due: $('pDue').value, roleId: $('pRole').value, area: $('pRole').value === KH_SAW ? $('pArea').value : '' });
  if (existing) Object.assign(existing, p); else S.projects.push(p);
  if (pdraft.onSaved) pdraft.onSaved(p);
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

// alarm tones, made on the phone itself (no sound files): [frequency, start s, length s, volume, wave]
const TONES = {
  chime: ['جرس مزدوج (الأصلي)', [[880, 0, 0.35, 0.35], [660, 0.45, 0.35, 0.35], [880, 0.9, 0.35, 0.35], [660, 1.35, 0.35, 0.35]]],
  bell: ['ناقوس', [[1046, 0, 1.4, 0.4], [2093, 0, 0.8, 0.12], [1046, 1.5, 1.4, 0.4], [2093, 1.5, 0.8, 0.12]]],
  soft: ['نغمة هادئة', [[523, 0, 0.5, 0.25, 'triangle'], [659, 0.4, 0.5, 0.25, 'triangle'], [784, 0.8, 0.9, 0.25, 'triangle']]],
  rising: ['متصاعد', [[523, 0, 0.3, 0.15], [659, 0.35, 0.3, 0.22], [784, 0.7, 0.3, 0.3], [1046, 1.05, 0.5, 0.4]]],
  fast: ['رنين سريع', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [1000, i * 0.2 + (i > 3 ? 0.4 : 0), 0.12, 0.35, 'square'])],
};
function beep(tone) {
  if (!actx || (!tone && !S.settings.sound)) return;
  try {
    const t0 = actx.currentTime;
    for (const [f, at, len, vol, wave] of (TONES[tone || S.settings.tone] || TONES.chime)[1]) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = wave || 'sine';
      o.frequency.value = f;
      const s = t0 + at;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(vol, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + len);
      o.connect(g).connect(actx.destination);
      o.start(s);
      o.stop(s + len + 0.05);
    }
  } catch {}
}

// an alarm nobody answered keeps ringing for five minutes: the tone every few seconds, and its
// notification again every minute while the app is out of sight, until «تمت» or «غفوة» or closing it
const RING_MIN = 5;
let ringLoop = null;
function keepRinging() {
  if (ringLoop) return;
  const started = Date.now();
  let lastNote = Date.now();
  ringLoop = setInterval(() => {
    showAlarm(); // drops an alarm whose task was done or deleted meanwhile
    const cur = alarmQueue[0];
    if (!cur || Date.now() - started > RING_MIN * 60000) { clearInterval(ringLoop); ringLoop = null; return; }
    beep();
    if (Date.now() - lastNote >= 60000 && document.visibilityState !== 'visible') {
      lastNote = Date.now();
      const t = getTask(cur.id);
      if (t) systemNotify(t.title, alarmBody(t, cur.d, cur.off), cur.key, t.id);
    }
  }, 4000);
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
    icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', vibrate: [200, 100, 200, 100, 400],
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
  return off && left > 0 ? `بعد ${minsWord(left)} | ${when}` : `الآن | ${when}`;
}
function ring(t, key, d, off) {
  S.fired[key] = Date.now();
  delete S.snoozed[key];
  save();
  // the alarm ringing now is the one shown (an older one nobody answered waits behind it), with its own five minutes
  const was = alarmQueue.findIndex((a) => a.key === key);
  if (was !== -1) alarmQueue.splice(was, 1);
  alarmQueue.unshift({ id: t.id, key, d, off });
  showAlarm();
  beep();
  if (ringLoop) { clearInterval(ringLoop); ringLoop = null; }
  keepRinging();
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
  // its task deleted, or done from the list meanwhile: it stops
  if (!t || doneOn(t, cur.d)) { alarmQueue.shift(); showAlarm(); return; }
  const left = minutesLeft(t, cur.d);
  $('alarmKicker').textContent = cur.off && left > 0 ? `تذكير مسبق | بعد ${minsWord(left)}` : 'منبه';
  $('alarmTitle').textContent = `${t.title} | ${timeLabel(t, cur.d)}`;
  $('alarm').hidden = false;
}

function alarmAction(action, id, key) {
  const t = getTask(id);
  const date = key && key.includes('|') ? key.split('|')[1] : today();
  if (t && action === 'done') {
    if (isCounted(t)) { if (notYetOn(t, date)) toast(`موعدها ${dueLabel(date)}`); else { setCount(t, date, t.target); save(); render(); } }
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
  // answered here: its notification (kept until answered) leaves the phone's shade too
  if (key && action !== 'dismiss' && 'serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((reg) => reg && reg.getNotifications({ tag: key })).then((ns) => { for (const n of ns || []) n.close(); }).catch(() => {});
}

function checkAlarms() {
  const now = Date.now();
  const d0 = today();
  // a snoozed alarm rings when its snooze ends, whatever its day (snoozed at 23:55 it rings after midnight);
  // one whose task was done or deleted meanwhile is let go
  let pruned = false;
  for (const [key, sn] of Object.entries(S.snoozed)) {
    const [id, d, off] = key.split('|'), t = getTask(id);
    if (!t || !d || doneOn(t, d)) { delete S.snoozed[key]; pruned = true; continue; }
    if (now >= sn) ring(t, key, d, Number(off) || 0);
  }
  if (pruned) save();
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
        if (S.snoozed[key]) continue; // rings above, when its snooze ends
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
  const data = JSON.stringify({ app: 'mahami', version: APP_VERSION, exported: new Date().toISOString(), tasks: S.tasks, projects: S.projects, sessions: S.sessions, memos: S.memos, books: S.books, benefits: S.benefits, inspire: S.inspire.filter((x) => x.type !== 'image'), archive: S.archive, ideas: S.ideas, journal: S.journal, jtemplates: S.jtemplates, hifz: S.hifz, hplans: S.hplans, finPlans: S.finPlans, finDebts: S.finDebts, finRights: S.finRights, finProjects: S.finProjects, finTx: S.finTx, cvs: S.cvs, meals: S.meals, mealDone: S.mealDone, shop: S.shop, lists: S.lists, fines: S.fines, reports: S.reports, subs: S.subs, later: S.later, weeks: S.weeks, people: S.people, decisions: S.decisions, quits: S.quits, reminders: S.reminders, study: S.study, kunnasha: S.kunnasha, roles: S.roles, kgoals: S.kgoals, settings: S.settings }, null, 2);
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
      for (const [k, f] of [['hifz', normalizeHifz], ['hplans', normalizeHPlan], ['finPlans', normalizeFinPlan], ['finDebts', normalizeDebt], ['finRights', normalizeRight], ['finProjects', normalizeFinProject], ['finTx', normalizeTx], ['cvs', normalizeCV], ['meals', normalizeMeal], ['mealDone', normalizeMealDone], ['shop', normalizeShop], ['lists', normalizeList], ['fines', normalizeFine], ['reports', normalizeReport], ['subs', normalizeSub], ['later', normalizeLater], ['weeks', normalizeWeek], ['people', normalizePerson], ['decisions', normalizeDecision], ['quits', normalizeQuit], ['reminders', normalizeReminder], ['study', normalizeScience], ['kunnasha', normalizeKun], ['roles', normalizeRole], ['kgoals', normalizeKGoal]]) S[k] = (Array.isArray(data[k]) ? data[k] : []).map(f);
      S.roles = khWithSaw(S.roles);
      if (!Array.isArray(data.lists)) S.lists = DEFAULT_LISTS.map(normalizeList);
      // photos stay on this device; imported phrases are added to them
      S.inspire = [...S.inspire.filter((x) => x.type === 'image'), ...(Array.isArray(data.inspire) ? data.inspire : []).filter((x) => x.type !== 'image').map(normalizeInspire)];
      if (data.settings) Object.assign(S.settings, data.settings);
      save();
      applyTheme();
      render();
      toast('تم الاستيراد');
    } catch {
      toast('الملف غير صالح. اختر ملفاً صدّرته من «الوعي الشخصي».');
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
// after a task or goal is done: «كم استغرقت؟», to record its time without running the timer (a session
// like the timer's, so the stats and the reports count it). Not for books (they ask for the idea of the
// day instead), nor when the timer already recorded time for it that day; off from the settings.
function askDuration(t, d) {
  if (S.settings.askTime === false || t.bookId) return;
  if (sessionsOf(t.id).some((x) => sessionDay(x) === d)) return;
  setTimeout(() => {
    if (lsheet().open) return;
    ldraft = { kind: 'dur', id: uid(), isNew: true, taskId: t.id, d };
    $('libForm').innerHTML = `${sheetHead('كم استغرقت؟')}
      <p class="note-text">«${esc(t.title)}»: اختر المدة أو اكتبها، أو تخطَّ.</p>
      <div class="chips wrap dur-chips">${[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => `<button type="button" class="chip" data-action="dur-pick" data-v="${m}">${m < 60 ? `${m} د` : m === 60 ? 'ساعة' : m === 90 ? 'ساعة ونصف' : 'ساعتان'}</button>`).join('')}</div>
      <label class="field"><span>المدة بالدقائق</span><input type="text" inputmode="numeric" id="durMin" class="num-in" placeholder="مثل: ٢٥" data-novoice autocomplete="off"></label>
      <div class="sheet-actions"><button type="submit" class="primary">سجّل الوقت</button><button type="button" class="ghost" data-action="lib-close">تخطَّ</button></div>`;
    showLib();
  }, 250);
}
function saveDuration() {
  const m = Math.round(num($('durMin').value));
  if (!m) return true; // nothing chosen: same as skipping
  const t = getTask(ldraft.taskId);
  const end = ldraft.d === today() ? Date.now() : parse(ldraft.d).getTime() + 12 * 3600000;
  S.sessions.push({ id: uid(), taskId: ldraft.taskId, start: end - m * 60000, end, ms: m * 60000, mode: 'manual' });
  save();
  toast(`سُجّل ${fmtDur(m * 60000)}${t ? ` لـ«${t.title}»` : ''}`);
  return true;
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action="dur-pick"]');
  if (!el) return;
  $('durMin').value = digitsOut(el.dataset.v);
  for (const c of document.querySelectorAll('.dur-chips .chip')) c.setAttribute('aria-pressed', c === el);
});
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
      const opts = { body, tag: 'timer-end', requireInteraction: true, vibrate: [400, 200, 400, 200, 600], lang: 'ar', dir: 'rtl', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png' };
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
  if (Notification.permission === 'granted') return '<p class="note-text explain">عند خروجك من التطبيق يبقى المؤقت ظاهراً في شريط الإشعارات على جوالك وساعتك، وفيه أزرار الإيقاف والإنهاء.</p>';
  if (Notification.permission === 'denied') return '<p class="note-text warn-box">الإشعارات محظورة، لذلك لن يظهر المؤقت خارج التطبيق. فعّلها من إعدادات الجوال: التطبيقات ← الوعي الشخصي (أو Chrome) ← الإشعارات.</p>';
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
      <span class="note-text">${en.phase === 'break' ? 'جاهز لجولة جديدة؟' : `سُجّلت ${plural(en.minutes, 'دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة')} لـ «${esc(t ? t.title : '')}»`}</span></div>
      <div class="t-actions">
        ${en.phase === 'break' ? '' : `<button type="button" class="ghost" data-action="timer-break">استراحة ${minsWord(cfg.brk)}</button>`}
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
      </div>` : S.tasks.some((t) => !t.bookId) ? emptyHTML('لا مهمة باقية', 'أنجزت مهامك كلها. أضف مهمة جديدة لتشغّل لها المؤقت.', addBtn('new', 'مهمة')) : emptyHTML('لا مهام بعد', 'أضف مهمة أولاً ثم شغّل لها المؤقت.', addBtn('new', 'مهمة'))}
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
    <div class="section-head"><h2>وقتك اليوم</h2><b class="num">${todayMs ? fmtDur(todayMs) : 'صفر'}</b></div>
    ${rows.length ? `<ul class="hbars">${rows.map(([id, ms]) => hbar(esc((getTask(id) || {}).title || 'مهمة محذوفة'), fmtDur(ms), (ms / max) * 100)).join('')}</ul>`
      : '<p class="note-text">ابدأ المؤقت لأي مهمة، وسيُسجَّل وقتها هنا وفي الإحصائيات.</p>'}
  </section>
  ${recent.length ? `<section class="panel"><h2>آخر الجلسات</h2><ul class="sessions">${recent.map((x) => `<li><span>${esc((getTask(x.taskId) || {}).title || 'مهمة محذوفة')}</span><span class="num">${esc(relDate(sessionDay(x)))} | ${esc(fmtTime(hmOf(new Date(x.start).getHours() * 60 + new Date(x.start).getMinutes())))} | ${fmtDur(x.ms)}</span></li>`).join('')}</ul></section>` : ''}`;
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
      // what was just changed in the sheet is kept first (as «ics» does)
      if ($('fNote').value.trim()) addNote();
      if ($('fSub').value.trim()) addSub();
      if (!commitDraft()) break;
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
    case 'task-bulk': openTaskBulk(v || ''); break;
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
        btn.textContent = (S.projects.find((p) => p.id === pdraft.id) || {}).topic ? 'تأكيد: تبقى كتبه في «الكتب»' : 'تأكيد: تنتقل مهامه إلى «مهام عامة»';
        setTimeout(() => { projArmed = false; if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = 'حذف المشروع'; } }, 3500);
        break;
      }
      projArmed = false;
      const pid = pdraft.id;
      // a reading project's book tasks go with it (the books stay); other tasks become general tasks
      const gone = S.projects.find((p) => p.id === pid) || {};
      const wasReading = !!gone.topic;
      if (wasReading) S.tasks = S.tasks.filter((t) => !(t.projectId === pid && t.bookId));
      // its tasks keep the role they had through it («خطِّط»), not «بلا دور»
      for (const t of S.tasks) if (t.projectId === pid) { if (!t.roleId && gone.roleId) { t.roleId = gone.roleId; t.area = gone.area || ''; } t.projectId = ''; }
      S.projects = S.projects.filter((p) => p.id !== pid);
      save();
      closeProjectSheet();
      go('tasks', '');
      toast(wasReading ? 'حُذف المشروع القرائي، وبقيت كتبه في «الكتب»' : 'حُذف المشروع، ومهامه الآن في «مهام عامة»');
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
      if (calHijri()) { const [a, b] = calSpan(); if (v < a || v >= b) ui.calH = hMonthStart(v); }
      render();
      break;
    }
    case 'cal-type': {
      // the same day stays chosen; its month in the other calendar is shown
      S.settings.calType = v === 'hijri' ? 'hijri' : 'greg';
      khMemo.clear?.(); if (typeof khResyncChains === 'function') khResyncChains(); // a plan's months are now the other calendar's
      ui.calH = hMonthStart(ui.calSel);
      ui.calMonth = ui.calSel.slice(0, 7);
      save(); render();
      break;
    }
    case 'cal-move': {
      if (calHijri()) {
        const a = calSpan()[0];
        ui.calH = Number(v) > 0 ? hMonthNext(a) : hMonthStart(addDays(a, -1));
        const b = hMonthNext(ui.calH), t0 = today();
        ui.calSel = t0 >= ui.calH && t0 < b ? t0 : ui.calH;
        render();
        break;
      }
      const [y, m] = ui.calMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(v), 1);
      ui.calMonth = iso(d).slice(0, 7);
      ui.calSel = ui.calMonth === today().slice(0, 7) ? today() : iso(d);
      render();
      break;
    }
    case 'cal-today': ui.calMonth = today().slice(0, 7); ui.calH = hMonthStart(today()); ui.calSel = today(); render(); break;
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
    case 'note-move': draft.moveNote = draft.moveNote === v ? '' : v; renderNotes(); break;
    case 'note-move-go': {
      // move one note of this task or goal to the notes page (it leaves the task), with where it came from
      const n = draft.notes.find((x) => x.id === v);
      if (!n) break;
      const from = `من ${draft.kind === 'goal' ? 'هدف' : 'مهمة'} «${$('fTitle').value.trim() || 'بلا عنوان'}» | ${fmtStamp(n.at)}`;
      const block = `${plainToNoteHTML(n.text)}<br><small>${esc(from)}</small>`;
      const target = $('nmTarget') && $('nmTarget').value;
      const m = target && S.memos.find((x) => x.id === target);
      if (m) {
        m.html = `${m.html}${m.html ? '<br><br>' : ''}${block}`;
        m.body = noteText(m.html); m.updated = Date.now();
      } else S.memos.push(normalizeMemo({ title: excerpt(n.text.split('\n')[0], 40), html: block }));
      draft.notes = draft.notes.filter((x) => x.id !== v);
      draft.moveNote = '';
      persistDraftList('notes'); save();
      renderNotes();
      toast(m ? `نُقلت إلى «${excerpt(m.title || 'الملاحظة', 30)}»` : `نُقلت إلى ملاحظة جديدة في «${pageName('notes')}»`);
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
    case 'tone-try': unlockAudio(); beep(($('setTone') || {}).value || 'chime'); break;
    case 'test-alarm':
      unlockAudio();
      alarmQueue.unshift({ id: '__test', key: '__test' });
      showAlarm();
      setTimeout(beep, 50);
      keepRinging();
      systemNotify('منبه تجريبي من «الوعي الشخصي»', 'هكذا ستصلك التنبيهات', '__test', '');
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
    case 'upd-now': location.reload(); break;
    case 'hard-refresh':
      (async () => {
        // only with a working connection: the saved copy is deleted, and without one the app could not open again
        try { if (!navigator.onLine) throw 0; const r = await fetch(`sw.js?check=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw 0; } catch { toast('لا يوجد اتصال بالإنترنت. حدّث التطبيق حين تتصل.'); return; }
        try {
          const scope = new URL('./', location.href).href;
          if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) if (r.scope === scope) await r.unregister();
          if (window.caches) for (const k of await caches.keys()) if (k !== 'mahami-actions' && !k.startsWith('muallim-')) await caches.delete(k);
        } catch {}
        location.reload();
      })();
      break;
    case 'export': exportData(); break;
    case 'import': $('importFile').click(); break;
    case 'wipe':
      if (confirm(Sync.connected() ? 'سيُحذف كل شيء نهائياً من هذا الجهاز ومن نسختك السحابية وكل أجهزتك المزامنة. هل أنت متأكد؟' : 'سيُحذف كل شيء نهائياً من هذا الجهاز. هل أنت متأكد؟')) {
        S.tasks = []; S.projects = []; S.sessions = []; S.memos = []; S.books = []; S.benefits = []; S.inspire = []; S.archive = []; S.ideas = []; S.journal = []; S.jtemplates = DEFAULT_TEMPLATES.map(normalizeJTemplate); S.hifz = []; S.hplans = []; S.finPlans = []; S.finDebts = []; S.finRights = []; S.finProjects = []; S.finTx = []; S.cvs = []; S.meals = []; S.mealDone = []; S.shop = []; S.lists = DEFAULT_LISTS.map(normalizeList); S.fines = []; S.reports = []; S.subs = []; S.later = []; S.weeks = []; S.people = []; S.decisions = []; S.quits = []; S.reminders = []; S.study = []; S.kunnasha = []; S.roles = khWithSaw([]); S.kgoals = []; S.fired = {}; S.snoozed = {}; S.timer = null;
        for (const k of ['health', 'readingGoal', 'payDay', 'closed', 'closeSkip', 'finActive', 'decTpl', 'benCats']) delete S.settings[k];
        try { indexedDB.deleteDatabase('mahami-media'); } catch {}
        save(); render(); toast('حُذفت كل البيانات');
      }
      break;
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'smartForm') return;
  e.preventDefault();
  const q = smartRoute(ui.smart);
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
  toast(`أُضيفت: ${t.title} | ${when}${hasTime(t) ? ' | ' + timeLabel(t, t.due || t.repeat?.start || today()) : ''}`);
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
  if (id === 'setTone') { S.settings.tone = e.target.value; save(); unlockAudio(); beep(e.target.value); }
  if (id === 'setHijri') { S.settings.hijri = e.target.checked; save(); render(); }
  if (id === 'setAskTime') { S.settings.askTime = e.target.checked; save(); toast(S.settings.askTime ? 'سأسألك عن المدة بعد الإنجاز' : 'لن أسألك عن المدة'); }
  if (id === 'setHaptic') { S.settings.haptic = e.target.checked; save(); if (S.settings.haptic) haptic(); toast(S.settings.haptic ? 'سيهتز الجوال اهتزازاً خفيفاً عند الإتمام' : 'أُطفئ الاهتزاز عند الإتمام'); }
  if (id === 'setExplain') { S.settings.explain = e.target.checked; save(); applyTheme(); toast(S.settings.explain ? 'سيظهر الشرح تحت الخانات' : 'أُخفي الشرح'); }
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
  // a page opened with no saved copy in control yet (the first visit, or just after «تحديث التطبيق الآن»): its first
  // takeover is that copy (no bar); a later one is a new version
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update()).catch(() => {});
  // the app opens from its saved copy (sw.js); a new version is saved in the background, then this bar offers it
  // (nothing reloads by itself, so nothing being written is lost)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if ($('updBar')) return;
    const bar = document.createElement('div');
    bar.id = 'updBar'; bar.className = 'upd-bar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>وصل تحديث جديد</span><button type="button" class="primary" data-action="upd-now">حدّث الآن</button>';
    document.body.append(bar);
  });
  // coming back to the app asks for a new version (at most every half hour)
  let swChecked = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - swChecked < 30 * 60000) return;
    swChecked = Date.now();
    navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
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
  if ($('libSheet').open) { const back = ldraft && ldraft.back; closeLib(); libBack(back); return true; }
  if (psheet.open) { closeProjectSheet(); return true; }
  if (sheet.open) { closeSheet(); return true; }
  return false;
}
window.addEventListener('popstate', () => {
  if (leaving) return;
  if (!$('exitBar').hidden) { $('exitBar').hidden = true; } // second back while asking: let it go
  if (closeTopLayer()) { armBack(); return; }
  if (ui.tab === 'tasks' && ui.project) { go('tasks', ''); armBack(); return; }
  if (ui.tab === 'plan' && khUi.review) { khUi.review = ''; render(); armBack(); return; }
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
// a history entry only counts once the user has interacted with the page: on a phone a touch counts when the
// finger lifts (pointerup/click), so an entry added at pointerdown was skipped by the back button and it left at once
// Using the app while «هل تريد الخروج؟» shows (a task opened) means staying: the question goes and back is guarded again
// (else the next back left the app, losing what was open)
for (const ev of ['pointerup', 'click', 'keydown']) document.addEventListener(ev, (e) => {
  if (leaving) return;
  if ($('exitBar').hidden) { armBack(); return; }
  if (!(e.target && e.target.closest && e.target.closest('#exitBar'))) stayInApp();
}, { passive: true, capture: true });

// ---------- where the user was (v95) ----------
// leaving the app and coming back opens the same page at the same place, not «اليوم» from the top (this phone only)
const WHERE_KEY = 'mahami-where';
// a phone may shut the app down (swiped away) before a save made on leaving reaches the storage, so the place
// is saved whenever the page changes or stops scrolling; not before boot has put the user back in place
let whereReady = false, whereTimer = null;
function saveWhere() {
  if (!whereReady) return;
  try {
    localStorage.setItem(WHERE_KEY, JSON.stringify({
      tab: ui.tab, project: ui.project, y: Math.round(window.scrollY),
      sci: studyUi.sci, kun: kunUi.tab, fin: { tab: finUi.tab, plan: finUi.plan, proj: finUi.proj }, kh: khUi.tab,
    }));
  } catch {}
}
function restoreWhere() {
  let w = null;
  try { w = JSON.parse(localStorage.getItem(WHERE_KEY) || 'null'); } catch {}
  if (w && w.tab === 'goals') w.tab = 'plan'; // «الأهداف» became part of «خطِّط» (v98)
  if (w && w.tab === 'stats') { w.tab = 'plan'; w.kh = 'stats'; } // and «الإحصائيات» its «إحصائياتي» (v99)
  if (!w || !VIEWS[w.tab]) return null;
  ui.tab = w.tab;
  ui.project = w.project || '';
  if (w.sci) studyUi.sci = w.sci;
  if (w.kun === 'kun') kunUi.tab = 'kun';
  if (KH_TABS.some(([k]) => k === w.kh)) khUi.tab = w.kh;
  if (w.fin && w.fin.tab) Object.assign(finUi, { tab: w.fin.tab, plan: w.fin.plan || '', proj: w.fin.proj || '' });
  return w;
}
window.addEventListener('pagehide', saveWhere);
window.addEventListener('scroll', () => { clearTimeout(whereTimer); whereTimer = setTimeout(saveWhere, 400); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveWhere(); });

// dialogs closed by the system back gesture still save their work
$('memoEditor').addEventListener('close', () => { if (mstate) { if (recState) stopRecording(); saveMemoNow(); mstate = null; render(); } });
$('viewer').addEventListener('close', () => { if (viewing) closeViewer(); });
$('jEditor').addEventListener('close', () => { if (jstate) { saveJNow(); jstate = null; render(); } });
$('hzStudy').addEventListener('close', () => { if (hzs) { hzs = null; render(); } });

// ---------- boot ----------
(function boot() {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.slice(1);
  // opened from a shortcut or a notification: that page; otherwise where the user left off
  // (a page in the link that is not the start page «#today» nor the place saved is a link to it: «#archive», «#timer»)
  let savedTab = '';
  try { savedTab = (JSON.parse(localStorage.getItem(WHERE_KEY) || 'null') || {}).tab || ''; } catch {}
  const linked = hash !== 'today' && !!VIEWS[hash] && hash !== savedTab;
  const where = params.toString() || linked ? null : restoreWhere();
  if (!where && VIEWS[hash]) ui.tab = hash;
  applyTheme();
  render();
  if (where) {
    history.replaceState(history.state, '', '#' + ui.tab);
    requestAnimationFrame(() => { window.scrollTo(0, where.y || 0); whereReady = true; saveWhere(); });
  } else { whereReady = true; saveWhere(); }
  localizeDigits(document.body);
  document.documentElement.lang = 'ar';
  handleShareLaunch(params);
  if (params.get('action') && params.get('id')) alarmAction(params.get('action'), params.get('id'), params.get('key') || '');
  const nw = params.get('new');
  if (nw === 'idea') { ui.tab = 'ideas'; render(); openIdea(null, { quick: true }); }
  else if (nw === 'reminder') { ui.tab = 'reminders'; render(); setTimeout(() => { const x = document.querySelector('[data-rem-form] input'); if (x) x.focus(); }, 300); }
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
  // a new day: the page, and the pinned notification and icon number (yesterday's count stayed on them until a change)
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (!sheet.open && !psheet.open) render(); if (typeof pinSoon === 'function') pinSoon(); } }, 60000);
})();
