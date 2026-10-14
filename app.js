'use strict';

const APP_VERSION = 6;

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
const ALARM_OPTIONS = [
  [0, 'في الموعد'], [5, 'قبل 5 د'], [10, 'قبل 10 د'], [15, 'قبل 15 د'], [30, 'قبل 30 د'],
  [60, 'قبل ساعة'], [120, 'قبل ساعتين'], [1440, 'قبل يوم'],
];
const SNOOZE_MIN = 10;
const MISSED_WINDOW_MIN = 180; // alarms older than this when the app opens are skipped
const SMART_EXAMPLES = [
  'ذكرني أتصل بأبوي بكرة الساعة 5 العصر وقبلها بربع ساعة',
  'اشرب 8 أكواب ماء كل يوم لمدة شهر',
  'قراءة القرآن بعد الفجر يومياً',
  'اجتماع الفريق كل أحد وثلاثاء الساعة 9 الصبح #عمل',
  'دفع الفاتورة يوم الخميس مهم',
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
const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const daysWord = (n) => (n === 0 ? '0 يوم' : plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً'));
const minsWord = (n) => (n === 15 ? 'ربع ساعة' : n === 30 ? 'نصف ساعة' : n % 1440 === 0 ? plural(n / 1440, 'يوم', 'يومين', 'أيام', 'يوماً')
  : n % 60 === 0 ? plural(n / 60, 'ساعة', 'ساعتين', 'ساعات', 'ساعة') : plural(n, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'));

// ---------- state ----------
function normalize(t) {
  const target = Math.max(1, Math.min(999, Number(t.target) || 1));
  return {
    id: t.id || uid(),
    title: String(t.title || ''),
    priority: PRI[t.priority] ? t.priority : 'mid',
    category: t.category || '',
    due: t.due || '',
    time: t.time || '',
    prayer: t.prayer && t.prayer.name ? { name: t.prayer.name, offset: Number(t.prayer.offset) || 0 } : null,
    alarms: Array.isArray(t.alarms) ? t.alarms.map(Number) : (t.remind && t.time ? [0] : []),
    notes: Array.isArray(t.notes) ? t.notes : [],
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    created: t.created || Date.now(),
    done: !!t.done,
    doneAt: t.doneAt || null,
    repeat: t.repeat && Array.isArray(t.repeat.days) ? t.repeat : null,
    completions: t.completions && typeof t.completions === 'object' ? t.completions : {},
    target,
    unit: t.unit || '',
    counts: t.counts && typeof t.counts === 'object' ? t.counts : {},
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
  s.settings = { name: '', accent: 'teal', theme: 'system', size: 'normal', font: 'mix', sound: true, prayer: null, ...(s.settings || {}) };
  s.settings.timer = { mode: 'up', minutes: 25, brk: 5, awake: true, lastTask: '', ...(s.settings.timer || {}) };
  s.fired = s.fired || {};
  s.snoozed = s.snoozed || {};
  s.timer = s.timer || null;
  s.sessions = Array.isArray(s.sessions) ? s.sessions : [];
  return s;
}

const S = load();
const ui = { tab: 'today', filter: 'active', q: '', sort: 'smart', cat: '', calMonth: today().slice(0, 7), calSel: today(), smart: '', timerEnded: null };

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast('تعذّر الحفظ. قد تكون مساحة التخزين ممتلئة.'); }
}
const getTask = (id) => S.tasks.find((t) => t.id === id);

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

// minutes after midnight for the task on date d, or null
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

// ---------- recurrence ----------
const isRepeat = (t) => !!t.repeat;
function occursOn(t, d) {
  const r = t.repeat;
  if (!r || d < r.start || (r.until && d > r.until)) return false;
  return r.days.includes(parse(d).getDay());
}
const doneOn = (t, d) => (isRepeat(t) ? !!t.completions[d] : t.done);
const countOn = (t, d) => (t.completions[d] && !t.counts[d] ? t.target : t.counts[d] || 0);
const goalEnded = (t) => isRepeat(t) && t.repeat.until && t.repeat.until < today();

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
  return { total, hit, rate: total ? Math.round((hit / total) * 100) : 0, streak };
}

// ---------- actions ----------
function setCount(t, d, n) {
  n = Math.max(0, Math.min(t.target, n));
  if (n) t.counts[d] = n; else delete t.counts[d];
  if (n >= t.target) t.completions[d] = t.completions[d] || Date.now();
  else delete t.completions[d];
}

function toggle(id, date) {
  const t = getTask(id);
  if (!t) return;
  if (isRepeat(t)) {
    const d = date || today();
    if (t.target > 1) {
      const c = countOn(t, d);
      setCount(t, d, c >= t.target ? 0 : c + 1);
    } else if (t.completions[d]) delete t.completions[d];
    else t.completions[d] = Date.now();
  } else {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
  }
  save();
  render();
}

function step(id, date, delta) {
  const t = getTask(id);
  if (!t) return;
  setCount(t, date, countOn(t, date) + delta);
  save();
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
  const counted = isRepeat(t) && t.target > 1;
  const label = counted ? `${countOn(t, d)} من ${t.target}${t.unit ? ' ' + t.unit : ''}، اضغط للزيادة` : done ? 'إلغاء الإنجاز' : 'تمت';
  return `<button type="button" class="check${counted ? ' counted' : ''}" data-action="toggle" data-id="${t.id}" data-date="${d}" aria-pressed="${done}" aria-label="${esc(label)}">${icon('check')}${counted ? `<span class="cnt">${countOn(t, d)}</span>` : ''}</button>`;
}

function metaHTML(t, d) {
  const meta = [`<span class="pri p-${t.priority}">${PRI_LABEL[t.priority]}</span>`];
  if (t.category) meta.push(`<span class="cat">${esc(t.category)}</span>`);
  if (isRepeat(t)) meta.push(`<span>${icon('repeat')}${esc(repeatLabel(t))}</span>`);
  else if (t.due) {
    const late = !t.done && t.due < today();
    meta.push(`<span class="${late ? 'late' : ''}">${icon('cal')}${late ? 'متأخرة · ' : ''}${esc(relDate(t.due))}</span>`);
  }
  if (hasTime(t)) meta.push(`<span class="num">${icon(t.alarms.length ? 'bell' : t.prayer ? 'moon' : 'clock')}${esc(timeLabel(t, d || t.due || today()))}</span>`);
  if (isRepeat(t) && t.target > 1) meta.push(`<span class="num count-btn">${countOn(t, d || today())}/${t.target}${t.unit ? ' ' + esc(t.unit) : ''}</span>`);
  if (t.subtasks.length) meta.push(`<span class="num">${icon('steps')}${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}</span>`);
  if (t.notes.length) meta.push(`<span class="num">${icon('note')}${t.notes.length}</span>`);
  const tracked = trackedMs(t.id);
  if (tracked >= 60000) meta.push(`<span class="num">${icon('clock')}${fmtDur(tracked)}</span>`);
  return meta.join('');
}

function itemHTML(t, date) {
  const d = date || today();
  const done = doneOn(t, d);
  return `<li class="task p-${t.priority}${done ? ' done' : ''}">
    ${checkButton(t, d, done)}
    <button type="button" class="t-main" data-action="open" data-id="${t.id}">
      <span class="t-title">${esc(t.title)}</span>
      <span class="meta">${metaHTML(t, d)}</span>
    </button>
  </li>`;
}

const emptyHTML = (title, text, action) =>
  `<div class="empty"><strong>${title}</strong><span>${text}</span>${action || ''}</div>`;

function itemsOn(d) {
  const items = [];
  for (const t of S.tasks) {
    if (isRepeat(t)) { if (occursOn(t, d)) items.push(t); }
    else if (t.due === d) items.push(t);
  }
  return items;
}

const byTime = (d) => (a, b) =>
  doneOn(a, d) - doneOn(b, d) ||
  (timeOn(a, d) ?? 9999) - (timeOn(b, d) ?? 9999) ||
  PRI[b.priority] - PRI[a.priority];

// ---------- view: today ----------
function prayerStripHTML() {
  const d = today();
  const pt = prayerTimes(d);
  if (!pt) {
    return `<div class="prayer-cta"><span>${icon('moon')} أضف مدينتك لتظهر أوقات الصلاة وتربط مهامك بها</span><button type="button" class="ghost" data-tab="settings">إعداد</button></div>`;
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = Prayer.PRAYERS.find((p) => pt[p] > nowMin) || 'fajr';
  return `<div class="prayers" aria-label="أوقات الصلاة اليوم">${Prayer.PRAYERS.map((p) =>
    `<div class="${p === next ? 'next' : ''}">${Prayer.NAMES[p]}<b>${esc(fmtMin(pt[p]))}</b></div>`).join('')}</div>`;
}

function smartHTML() {
  return `<form class="smart" id="smartForm" autocomplete="off">
    <label class="smart-label" for="smartIn">${icon('spark')} اكتب بكلامك وسأفهم الموعد والتكرار</label>
    <div class="smart-row">
      <input type="text" id="smartIn" value="${esc(ui.smart)}" placeholder="مثال: ذكرني أتصل بأبوي بكرة الساعة 5 العصر" enterkeyhint="done">
      <button type="submit" class="primary">إضافة</button>
    </div>
    <div id="smartPreview">${smartPreviewHTML()}</div>
  </form>`;
}

function smartToTask(r) {
  const t0 = today();
  const t = normalize({
    id: uid(), title: r.title, priority: r.priority, category: r.category,
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
    // "الساعة 5" said after 5 o'clock means tomorrow
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
  const r = SmartParse.parse(text);
  if (!r.title) return '<div class="parsed"><span class="tag warn">اكتب ما تريد فعله</span></div>';
  const t = smartToTask(r);
  const d = isRepeat(t) ? t.repeat.start : t.due || today();
  const tags = [`<span class="tag title">${esc(t.title)}</span>`];
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
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const late = items.filter((t) => !isRepeat(t) && t.due < d).length;
  const open = items.length - done;
  const undated = S.tasks.filter((t) => !isRepeat(t) && !t.done && !t.due).length;
  const summary = items.length ? (open ? `باقٍ ${open} من ${items.length}` : 'أنجزت كل مهام اليوم') : 'لا شيء مجدول لليوم';
  return `
  ${smartHTML()}
  <div class="today-card">
    <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div class="txt">
      <b>${summary}</b>
      <span class="muted">${late ? `<span class="late">${late} متأخرة</span> · ` : ''}${undated ? `${undated} بلا تاريخ في «المهام»` : esc(fmtHijri(d))}</span>
    </div>
  </div>
  ${prayerStripHTML()}
  <section class="section">
    <div class="section-head"><h2>مهام اليوم وأهدافه</h2><small>${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>
    ${items.length
      ? `<ul class="list">${items.map((t) => itemHTML(t, d)).join('')}</ul>`
      : emptyHTML('يومك فارغ', 'اكتب في المربع أعلاه أو اضغط زر الإضافة.')}
  </section>`;
}

// ---------- view: tasks ----------
function categories() {
  return [...new Set(S.tasks.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
}

function viewTasks() {
  const q = ui.q.trim().toLowerCase();
  const t0 = today();
  const list = S.tasks.filter((t) => !isRepeat(t) &&
    (ui.filter === 'all' || (ui.filter === 'done') === t.done) &&
    (!ui.cat || t.category === ui.cat) &&
    (!q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) ||
      t.notes.some((n) => n.text.toLowerCase().includes(q)) || t.subtasks.some((n) => n.text.toLowerCase().includes(q))));
  list.sort((a, b) => {
    if (ui.filter === 'done') return (b.doneAt || 0) - (a.doneAt || 0);
    if (ui.sort === 'created') return b.created - a.created;
    if (ui.sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999') || (timeOn(a, a.due) ?? 9999) - (timeOn(b, b.due) ?? 9999);
    const lateA = a.due && a.due < t0, lateB = b.due && b.due < t0;
    return lateB - lateA || PRI[b.priority] - PRI[a.priority] || (a.due || '9999').localeCompare(b.due || '9999');
  });
  const cats = categories();
  const seg = [['active', 'الحالية'], ['done', 'المنجزة'], ['all', 'الكل']]
    .map(([v, l]) => `<button type="button" data-action="filter" data-v="${v}" aria-pressed="${ui.filter === v}">${l}</button>`).join('');
  const hasAny = S.tasks.some((t) => !isRepeat(t));
  return `
  <div class="toolbar">
    <input type="search" id="search" placeholder="بحث في المهام والخطوات والملاحظات" aria-label="بحث" value="${esc(ui.q)}">
    <div class="seg" role="group" aria-label="عرض">${seg}</div>
    <select id="sort" aria-label="الترتيب">
      <option value="smart"${ui.sort === 'smart' ? ' selected' : ''}>الأهم أولاً</option>
      <option value="due"${ui.sort === 'due' ? ' selected' : ''}>حسب التاريخ</option>
      <option value="created"${ui.sort === 'created' ? ' selected' : ''}>الأحدث</option>
    </select>
  </div>
  ${cats.length ? `<div class="chips" role="group" aria-label="التصنيف">
    <button type="button" class="chip" data-action="cat" data-v="" aria-pressed="${!ui.cat}">كل التصنيفات</button>
    ${cats.map((c) => `<button type="button" class="chip" data-action="cat" data-v="${esc(c)}" aria-pressed="${ui.cat === c}">${esc(c)}</button>`).join('')}
  </div>` : ''}
  ${list.length
    ? `<ul class="list">${list.map((t) => itemHTML(t, t.due || t0)).join('')}</ul>`
    : hasAny
      ? emptyHTML(q ? 'لا نتائج' : ui.filter === 'done' ? 'لا مهام منجزة بعد' : 'لا مهام حالية', q ? 'جرّب كلمة بحث أخرى.' : 'كل شيء مُنجز هنا.')
      : emptyHTML('لا مهام بعد', 'اضغط زر + لإضافة أول مهمة.', '<button type="button" class="ghost" data-action="new">إضافة مهمة</button>')}`;
}

// ---------- view: calendar ----------
function viewCalendar() {
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() - 6 + 7) % 7; // weeks start on Saturday
  const daysIn = new Date(y, m, 0).getDate();
  const total = Math.ceil((lead + daysIn) / 7) * 7;
  const t0 = today();
  const cells = [];
  for (let i = 0; i < total; i++) {
    const d = iso(new Date(y, m - 1, 1 - lead + i));
    const out = d.slice(0, 7) !== ui.calMonth;
    const items = itemsOn(d);
    const marks = items.slice(0, 4).map((t) => `<i class="${doneOn(t, d) ? 'done' : 'p-' + t.priority}"></i>`).join('') +
      (items.length > 4 ? `<span class="more">+${items.length - 4}</span>` : '');
    const label = `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${items.length ? `، ${items.length} عنصر` : ''}`;
    cells.push(`<button type="button" class="cal-day${out ? ' out' : ''}${d === t0 ? ' today' : ''}${d === ui.calSel ? ' sel' : ''}" data-action="cal-day" data-v="${d}" aria-label="${esc(label)}" aria-pressed="${d === ui.calSel}"><span class="n">${parse(d).getDate()}</span><span class="marks">${marks}</span></button>`);
  }
  const monthName = first.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  const lastIso = iso(new Date(y, m, 0));
  const h1 = fmtHijri(iso(first), { month: 'long', year: 'numeric' });
  const h2 = fmtHijri(lastIso, { month: 'long', year: 'numeric' });
  const hijri = h1 === h2 ? h1 : `${fmtHijri(iso(first), { month: 'long' })} – ${h2}`;
  const sel = ui.calSel;
  const selItems = itemsOn(sel).sort(byTime(sel));
  return `
  <div class="cal-head">
    <div class="nav"><button type="button" data-action="cal-move" data-v="-1" aria-label="الشهر السابق">${icon('prev')}</button></div>
    <div class="titles"><h2>${esc(monthName)}</h2><small>${esc(hijri)}</small></div>
    <div class="nav">
      <button type="button" data-action="cal-move" data-v="1" aria-label="الشهر التالي">${icon('next')}</button>
    </div>
  </div>
  <div class="cal">
    <div class="cal-grid">
      ${DAY_ORDER.map((d) => `<div class="cal-dow">${DAY_SHORT[d]}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="cal-legend">
      <span><i style="background:var(--high)"></i>عالية</span><span><i style="background:var(--mid)"></i>متوسطة</span>
      <span><i style="background:var(--low)"></i>منخفضة</span><span><i style="background:var(--line)"></i>منجزة</span>
      ${ui.calMonth !== t0.slice(0, 7) || sel !== t0 ? '<button type="button" class="chip" data-action="cal-today" style="margin-inline-start:auto">اليوم</button>' : ''}
    </div>
  </div>
  <section class="section">
    <div class="section-head">
      <h2>${esc(fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
      <button type="button" class="ghost" data-action="new-on" data-v="${sel}">إضافة لهذا اليوم</button>
    </div>
    <small class="hint">${esc(fmtHijri(sel))}</small>
    ${selItems.length ? `<ul class="list">${selItems.map((t) => itemHTML(t, sel)).join('')}</ul>` : emptyHTML('لا شيء في هذا اليوم', 'اضغط «إضافة لهذا اليوم» لتضيف مهمة بتاريخه.')}
  </section>`;
}

// ---------- view: goals ----------
function goalHTML(t) {
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
  const counted = t.target > 1;
  const c = countOn(t, t0);
  const counter = counted && occursToday ? `
    <div class="row-between">
      <div class="stepper">
        <button type="button" data-action="step" data-id="${t.id}" data-v="-1" aria-label="إنقاص">−</button>
        <span class="val">${c} / ${t.target}${t.unit ? ' ' + esc(t.unit) : ''}</span>
        <button type="button" data-action="step" data-id="${t.id}" data-v="1" aria-label="زيادة">+</button>
      </div>
    </div>
    <div class="progress-line"><i style="width:${(c / t.target) * 100}%"></i></div>` : '';
  return `<li class="goal${done ? ' done' : ''}">
    <div class="goal-top">
      ${occursToday ? checkButton(t, t0, done) : `<button type="button" class="check" disabled aria-label="ليس مجدولاً اليوم">${icon('check')}</button>`}
      <button type="button" class="t-main" data-action="open" data-id="${t.id}">
        <span class="t-title">${esc(t.title)}</span>
        <span class="meta">${metaHTML(t, t0).replace(/<span class="pri[^>]*>[^<]*<\/span>/, '')}</span>
      </button>
    </div>
    ${counter}
    ${notStarted ? `<p class="note-text">يبدأ ${esc(relDate(t.repeat.start))}</p>` : `
    <div class="goal-stats">
      <span>السلسلة الحالية: <b>${daysWord(st.streak)}</b></span>
      <span>نسبة الالتزام: <b>${st.rate}%</b> (${st.hit}/${st.total})</span>
    </div>
    <div class="dots" aria-label="آخر 7 أيام">${dots.join('')}</div>`}
  </li>`;
}

function viewGoals() {
  const goals = S.tasks.filter(isRepeat);
  if (!goals.length) {
    return `<section class="section"><h2>الأهداف المتكررة</h2>${emptyHTML('لا أهداف بعد',
      'الهدف المتكرر يظهر في يومك تلقائياً، يومياً أو في أيام تختارها، إلى تاريخ محدد أو بلا نهاية. ويمكن أن يكون بعدد، مثل 8 أكواب ماء.',
      '<button type="button" class="ghost" data-action="new-goal">إضافة هدف</button>')}</section>`;
  }
  const t0 = today();
  const active = goals.filter((t) => !goalEnded(t)).sort((a, b) => (timeOn(a, t0) ?? 9999) - (timeOn(b, t0) ?? 9999));
  const ended = goals.filter(goalEnded);
  return `
  <section class="section">
    <div class="section-head"><h2>الأهداف المتكررة</h2><button type="button" class="ghost" data-action="new-goal">هدف جديد</button></div>
    ${active.length ? `<ul class="list">${active.map(goalHTML).join('')}</ul>` : emptyHTML('لا أهداف جارية', 'كل أهدافك انتهت مدتها.')}
  </section>
  ${ended.length ? `<section class="section"><h2>أهداف انتهت مدتها</h2><ul class="list">${ended.map(goalHTML).join('')}</ul></section>` : ''}`;
}

// ---------- view: stats ----------
function completionEvents() {
  const ev = [];
  for (const t of S.tasks) {
    if (isRepeat(t)) for (const d of Object.keys(t.completions)) ev.push({ d, cat: t.category || 'بلا تصنيف' });
    else if (t.done && t.doneAt) ev.push({ d: iso(new Date(t.doneAt)), cat: t.category || 'بلا تصنيف' });
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

function focusPanelHTML() {
  const t0 = today();
  const weekStart = addDays(t0, -6);
  const week = S.sessions.filter((x) => sessionDay(x) >= weekStart);
  if (!S.sessions.length) return '';
  const todayMs = week.filter((x) => sessionDay(x) === t0).reduce((n, x) => n + x.ms, 0);
  const weekMs = week.reduce((n, x) => n + x.ms, 0);
  const by = {};
  for (const x of week) by[x.taskId] = (by[x.taskId] || 0) + x.ms;
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = rows.length ? rows[0][1] : 1;
  return `<section class="panel">
    <h2>وقت التركيز</h2>
    <p class="note-text">اليوم <b>${fmtDur(todayMs)}</b> · آخر 7 أيام <b>${fmtDur(weekMs)}</b></p>
    ${rows.length ? `<ul class="hbars">${rows.map(([id, ms]) => `<li class="hbar"><span class="name">${esc((getTask(id) || {}).title || 'مهمة محذوفة')}</span><span class="track"><span class="fill" style="width:${(ms / max) * 100}%; display:block"></span></span><span class="v">${fmtDur(ms)}</span></li>`).join('')}</ul>` : ''}
  </section>`;
}

function viewStats() {
  const ev = completionEvents();
  const byDay = {};
  for (const e of ev) byDay[e.d] = (byDay[e.d] || 0) + 1;
  const t0 = today();
  const week = Array.from({ length: 7 }, (_, i) => byDay[addDays(t0, -i)] || 0).reduce((a, b) => a + b, 0);
  const { cur, best } = streaks(byDay);
  const byCat = {};
  for (const e of ev) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catMax = cats.length ? cats[0][1] : 1;
  const goals = S.tasks.filter((t) => isRepeat(t) && t.repeat.start <= t0).map((t) => ({ t, st: goalStats(t) }));
  const openCount = S.tasks.filter((t) => !isRepeat(t) && !t.done).length;
  const subsDone = S.tasks.reduce((n, t) => n + t.subtasks.filter((x) => x.done).length, 0);
  return `
  <div class="tiles">
    <div class="tile"><b>${byDay[t0] || 0}</b><span>أنجزت اليوم</span></div>
    <div class="tile"><b>${week}</b><span>آخر 7 أيام</span></div>
    <div class="tile"><b>${ev.length}</b><span>إجمالي الإنجازات</span></div>
    <div class="tile"><b>${cur}</b><span>أيام متتالية · الأفضل ${best}</span></div>
  </div>
  <section class="panel chart">
    <h2>الإنجازات في آخر 14 يوماً</h2>
    <div class="readout" id="readout">المس عموداً لترى تفاصيل اليوم.</div>
    ${chartSVG(byDay)}
  </section>
  ${focusPanelHTML()}
  <section class="panel">
    <h2>حسب التصنيف</h2>
    ${cats.length ? `<ul class="hbars">${cats.map(([c, n]) => `<li class="hbar"><span class="name">${esc(c)}</span><span class="track"><span class="fill" style="width:${(n / catMax) * 100}%; display:block"></span></span><span class="v">${n}</span></li>`).join('')}</ul>`
      : '<p class="note-text">ستظهر هنا بعد أن تنجز أول مهمة.</p>'}
  </section>
  <section class="panel">
    <h2>الالتزام بالأهداف</h2>
    ${goals.length ? `<ul class="hbars">${goals.map(({ t, st }) => `<li class="hbar"><span class="name" title="${esc(t.title)}">${esc(t.title)}</span><span class="track"><span class="fill" style="width:${st.rate}%; display:block"></span></span><span class="v">${st.rate}%</span></li>`).join('')}</ul>`
      : '<p class="note-text">أضف هدفاً متكرراً لتتابع نسبة التزامك به.</p>'}
  </section>
  <p class="note-text">لديك ${openCount} ${openCount === 1 ? 'مهمة مفتوحة' : 'مهام مفتوحة'} الآن${subsDone ? `، وأنجزت ${subsDone} خطوة داخل مهامك` : ''}.</p>`;
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
    <div class="prayers">${['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].filter((p) => p !== 'sunrise').map((p) => `<div>${Prayer.NAMES[p]}<b>${esc(fmtMin(pt[p]))}</b></div>`).join('')}</div>
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
    <div class="field"><span>حجم الخط</span>
      <div class="seg">${segBtn('size', 'normal', 'عادي', st.size)}${segBtn('size', 'big', 'كبير', st.size)}</div>
    </div>
  </section>
  ${prayerSettingsHTML()}
  <section class="panel">
    <h2>المنبهات</h2>
    <p class="note-text" id="notifStatus">${notifStatus()}</p>
    <div class="btn-row">
      ${'Notification' in window && Notification.permission === 'default' ? '<button type="button" class="primary" data-action="notif">تفعيل الإشعارات</button>' : ''}
      <button type="button" class="ghost" data-action="test-alarm">تجربة المنبه</button>
    </div>
    <label class="switch"><input type="checkbox" id="setSound"${st.sound ? ' checked' : ''}><span>صوت التنبيه داخل التطبيق</span></label>
    <p class="note-text">يرن المنبه والتطبيق مفتوح أو في الخلفية. الجوال قد يوقف التطبيقات المغلقة تماماً، فللمواعيد المهمة افتح المهمة واضغط «إضافة إلى تقويم الجوال» ليرن من تقويم جوالك حتى لو كان التطبيق مغلقاً.</p>
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
      <span class="note-text">${S.tasks.length} عنصر محفوظ</span>
      <button type="button" class="danger" data-action="wipe">حذف كل البيانات</button>
    </div>
  </section>
  </div>`;
}

const VIEWS = { today: viewToday, tasks: viewTasks, timer: () => viewTimer(), calendar: viewCalendar, goals: viewGoals, stats: viewStats, settings: viewSettings };

function render() {
  const view = $('view');
  const active = document.activeElement && view.contains(document.activeElement) ? document.activeElement.id : null;
  const caret = active && 'selectionStart' in document.activeElement ? document.activeElement.selectionStart : null;
  view.innerHTML = VIEWS[ui.tab]();
  if (active && $(active)) {
    $(active).focus();
    try { if (caret != null) $(active).setSelectionRange(caret, caret); } catch {}
  }
  for (const b of document.querySelectorAll('[data-tab]')) {
    if (b.closest('#view')) continue;
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  document.body.dataset.tab = ui.tab;
  tickTimer();
  renderGreeting();
  $('cats').innerHTML = categories().map((c) => `<option value="${esc(c)}">`).join('');
}

function renderGreeting() {
  const name = S.settings.name.trim();
  const hello = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  $('greeting').textContent = `${hello}${name ? '، ' + name : ''} · ${fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}`;
}

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

// ---------- editor sheet ----------
const sheet = $('sheet');
let draft = null;
let draftIsNew = true;
let armed = null; // id of a note/step waiting for a second tap to delete
let armTimer = null;
function armReset(fn) { clearTimeout(armTimer); armTimer = setTimeout(fn, 3000); }

function setKind(kind) {
  draft.kind = kind;
  for (const b of $('fKind').children) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
  $('onceFields').hidden = kind !== 'once';
  $('repeatFields').hidden = kind !== 'repeat';
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

function updatePrayerHint() {
  if (!draft || draft.timeMode !== 'prayer') return;
  $('fPrMin').hidden = $('fPrRel').value === 'at';
  const d = draft.kind === 'repeat' ? ($('fStart').value || today()) : ($('fDue').value || today());
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

function openSheet(id, opts = {}) {
  const existing = id ? getTask(id) : null;
  const t = existing || opts.prefill || null;
  draftIsNew = !existing;
  const t0 = today();
  const kind = t ? (isRepeat(t) ? 'repeat' : 'once') : opts.kind || 'once';
  draft = {
    id: t ? t.id : uid(),
    kind,
    days: t && t.repeat ? [...t.repeat.days] : [...DAY_ORDER],
    notes: t ? t.notes.map((n) => ({ ...n })) : [],
    subtasks: t ? t.subtasks.map((n) => ({ ...n })) : [],
    alarms: t ? [...t.alarms] : [],
    autoAlarm: !t || !t.alarms.length,
    timeMode: t && t.prayer ? 'prayer' : t && t.time ? 'clock' : 'none',
  };
  $('sheetTitle').textContent = existing ? (isRepeat(existing) ? 'تعديل الهدف' : 'تعديل المهمة') : (kind === 'repeat' ? 'هدف جديد' : 'مهمة جديدة');
  $('fTitle').value = t ? t.title : '';
  $('fPriority').value = t ? t.priority : 'mid';
  $('fCategory').value = t ? t.category : (ui.tab === 'tasks' && ui.cat) || '';
  $('fDue').value = t ? t.due : opts.due || (ui.tab === 'today' ? t0 : '');
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
  $('timerSec').hidden = !existing;
  if (existing) {
    const ms = trackedMs(existing.id);
    const n = sessionsOf(existing.id).length;
    $('timerTotal').textContent = ms ? `سجّلت ${fmtDur(ms)} في ${n} ${n === 1 ? 'جلسة' : n === 2 ? 'جلستين' : 'جلسات'}` : 'لم تسجّل وقتاً لهذه المهمة بعد.';
  }
  $('delBtn').classList.remove('armed');
  $('delBtn').textContent = 'حذف';
  armed = null;
  setKind(kind);
  setTimeMode(draft.timeMode);
  renderDays();
  renderNotes();
  renderSubs();
  if (typeof sheet.showModal === 'function') { if (!sheet.open) sheet.showModal(); } else sheet.setAttribute('open', '');
  $('editor').scrollTop = 0;
  setTimeout(() => { if (!t) $('fTitle').focus(); }, 50);
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
    title,
    priority: $('fPriority').value,
    category: $('fCategory').value.trim(),
    notes: draft.notes,
    subtasks: draft.subtasks,
    time: draft.timeMode === 'clock' ? $('fTime').value : '',
    prayer: draft.timeMode === 'prayer' ? readPrayer() : null,
  };
  t.alarms = hasTime(t) ? [...draft.alarms].sort((a, b) => a - b) : [];
  if (draft.kind === 'repeat') {
    const start = $('fStart').value || today();
    let until = $('fUntil').value || null;
    if (until && until < start) until = start;
    t.repeat = { days: (draft.days.length ? [...draft.days] : [...DAY_ORDER]).sort(), start, until };
    t.target = Math.max(1, Math.min(999, parseInt($('fTarget').value, 10) || 1));
    t.unit = t.target > 1 ? $('fUnit').value.trim() : '';
    t.due = '';
    t.done = false;
    t.doneAt = null;
  } else {
    t.repeat = null;
    t.due = $('fDue').value || (hasTime(t) ? today() : '');
  }
  return t;
}

function commitDraft() {
  const t = readDraft();
  if (!t) { $('fTitle').focus(); toast('اكتب عنواناً أولاً.'); return null; }
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
  draft.subtasks.push({ id: uid(), text, done: false });
  $('fSub').value = '';
  persistDraftList('subtasks');
  renderSubs();
}

$('editor').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('fNote').value.trim()) addNote();
  if ($('fSub').value.trim()) addSub();
  const t = commitDraft();
  if (!t) return;
  const wasNew = draftIsNew;
  closeSheet();
  if (t.alarms.length) ensureNotifPermission();
  render();
  toast(wasNew ? 'أُضيفت' : 'حُفظت التعديلات');
});
sheet.addEventListener('close', () => { draft = null; });
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
$('fSub').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
$('fNote').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } });
for (const id of ['fPrRel', 'fPrName', 'fPrMin', 'fDue', 'fStart']) $(id).addEventListener('change', updatePrayerHint);

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
  lines.push(`SUMMARY:${icsEscape(t.title)}`);
  const desc = [];
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
function alarmBody(t, d, off) {
  const when = timeLabel(t, d);
  const m = timeOn(t, d);
  const left = m == null ? 0 : Math.round((parse(d).getTime() + m * 60000 - Date.now()) / 60000);
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
  const m = timeOn(t, cur.d);
  const left = m == null ? 0 : Math.round((parse(cur.d).getTime() + m * 60000 - Date.now()) / 60000);
  $('alarmKicker').textContent = cur.off && left > 0 ? `تذكير مسبق · بعد ${minsWord(left)}` : 'منبه';
  $('alarmTitle').textContent = `${t.title} · ${timeLabel(t, cur.d)}`;
  $('alarm').hidden = false;
}

function alarmAction(action, id, key) {
  const t = getTask(id);
  const date = key && key.includes('|') ? key.split('|')[1] : today();
  if (t && action === 'done') {
    if (isRepeat(t) && t.target > 1) { setCount(t, date, t.target); save(); render(); }
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
  const data = JSON.stringify({ app: 'mahami', version: 3, exported: new Date().toISOString(), tasks: S.tasks, settings: S.settings }, null, 2);
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
    // nearest listed city gives a sensible default calculation method
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
  S.timer = { taskId, mode, phase, planned: mode === 'down' ? minutes * 60000 : 0, start: now, startedAt: now, acc: 0, running: true };
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
      const title = tm.phase === 'break' ? 'انتهت الاستراحة' : `انتهى الوقت: ${timerTitle(tm)}`;
      const body = tm.phase === 'break' ? 'جاهز لجولة جديدة؟' : `أنهيت ${fmtDur(tm.planned)} من التركيز`;
      const opts = { body, tag: 'timer-end', requireInteraction: true, vibrate: [400, 200, 400, 200, 600], lang: 'ar', dir: 'rtl', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
      if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
    } catch {}
  }
}

function tickTimer() {
  const tm = S.timer;
  const bar = $('timerBar');
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

function timerTaskOptions(selected) {
  const t0 = today();
  const todays = S.tasks.filter((t) => (isRepeat(t) ? occursOn(t, t0) : !t.done && t.due && t.due <= t0));
  const others = S.tasks.filter((t) => !isRepeat(t) && !t.done && !todays.includes(t));
  const goals = S.tasks.filter((t) => isRepeat(t) && !todays.includes(t) && !goalEnded(t));
  const opt = (t) => `<option value="${t.id}"${t.id === selected ? ' selected' : ''}>${esc(t.title)}</option>`;
  return [['اليوم', todays], ['مهام أخرى', others], ['أهداف', goals]]
    .filter(([, l]) => l.length).map(([g, l]) => `<optgroup label="${g}">${l.map(opt).join('')}</optgroup>`).join('');
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
      <p class="note-text">يظهر المؤقت في إشعار على جوالك وساعتك، وفيه أزرار الإيقاف والإنهاء.</p>
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
      </div>` : emptyHTML('لا مهام بعد', 'أضف مهمة أولاً ثم شغّل لها المؤقت.', '<button type="button" class="ghost" data-action="new">إضافة مهمة</button>')}
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
    ${rows.length ? `<ul class="hbars">${rows.map(([id, ms]) => `<li class="hbar"><span class="name">${esc((getTask(id) || {}).title || 'مهمة محذوفة')}</span><span class="track"><span class="fill" style="width:${(ms / max) * 100}%; display:block"></span></span><span class="v">${fmtDur(ms)}</span></li>`).join('')}</ul>`
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
      if (t && isRepeat(t) && t.target > 1) { setCount(t, today(), t.target); save(); render(); }
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
      history.replaceState(null, '', '#timer');
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
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-tab]');
  if (!el) return;
  if (el.dataset.tab) {
    if (el.dataset.close) closeSheet();
    ui.tab = el.dataset.tab;
    render();
    window.scrollTo({ top: 0 });
    history.replaceState(null, '', '#' + ui.tab);
    return;
  }
  const { action, id, v } = el.dataset;
  switch (action) {
    case 'new': openSheet(null, { kind: 'once', due: ui.tab === 'calendar' ? ui.calSel : undefined }); break;
    case 'new-goal': openSheet(null, { kind: 'repeat' }); break;
    case 'new-on': openSheet(null, { kind: 'once', due: v }); break;
    case 'open': openSheet(id); break;
    case 'toggle': toggle(id, el.dataset.date); break;
    case 'step': step(id, today(), Number(v)); break;
    case 'filter': ui.filter = v; render(); break;
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
      if (s) { s.done = el.checked; persistDraftList('subtasks'); renderSubs(); }
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
    case 'geo': useLocation(); break;
    case 'notif': ensureNotifPermission(); break;
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
      if (confirm('سيُحذف كل شيء نهائياً من هذا الجهاز. هل أنت متأكد؟')) {
        S.tasks = []; S.fired = {}; S.snoozed = {}; save(); render(); toast('حُذفت كل البيانات');
      }
      break;
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'smartForm') return;
  e.preventDefault();
  const r = SmartParse.parse(ui.smart);
  if (!r.title) { toast('اكتب ما تريد فعله، مثل: اتصل بأبوي بكرة الساعة 5'); return; }
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
  if (id === 'setCity') setCity(e.target.value);
  if (id === 'setMethod' && S.settings.prayer) { S.settings.prayer.method = e.target.value; save(); render(); }
  if (id === 'setAsr' && S.settings.prayer) { S.settings.prayer.asr = e.target.value; save(); render(); }
  if (id === 'importFile' && e.target.files[0]) importData(e.target.files[0]);
  if (id === 'fTime' && e.target.value && draft && !draft.alarms.length) { draft.alarms = [0]; renderAlarms(); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('#fKind button, #fTimeMode button');
  if (!b || !draft) return;
  if (b.dataset.kind) { setKind(b.dataset.kind); updatePrayerHint(); }
  if (b.dataset.mode) setTimeMode(b.dataset.mode);
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
    if (!hadController || reloading || sheet.open) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'alarm-action') alarmAction(m.action, m.id, m.key);
    if (m.type === 'timer-pending') applyPendingTimerActions();
  });
}

// ---------- boot ----------
(function boot() {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.slice(1);
  if (VIEWS[hash]) ui.tab = hash;
  applyTheme();
  render();
  if (params.get('action') && params.get('id')) alarmAction(params.get('action'), params.get('id'), params.get('key') || '');
  if (params.get('new')) openSheet(null, { kind: params.get('new') === 'goal' ? 'repeat' : 'once' });
  if (params.toString()) history.replaceState(null, '', location.pathname + location.hash);
  checkAlarms();
  setInterval(checkAlarms, 15000);
  applyPendingTimerActions();
  setInterval(tickTimer, 1000);
  updateWakeLock();
  document.addEventListener('visibilitychange', () => {
    updateWakeLock();
    if (document.visibilityState === 'visible') { applyPendingTimerActions(); checkAlarms(); if (!sheet.open) render(); }
  });
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (!sheet.open) render(); } }, 60000);
})();
