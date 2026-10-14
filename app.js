'use strict';

// ---------- constants ----------
const KEY = 'mahami-v2';
const OLD_KEY = 'my-tasks-v1';
const LOCALE = 'ar-u-nu-latn';
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
const SNOOZE_MIN = 10;
const MISSED_WINDOW_MIN = 180; // alarms older than this when the app opens are skipped

const ICONS = {
  check: 'M20 6L9 17l-5-5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  repeat: 'M17 2l4 4-4 4M3 11V10a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3',
  note: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  cal: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
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
const fmtDate = (s, opts = { day: 'numeric', month: 'short' }) => parse(s).toLocaleDateString(LOCALE, opts);
const fmtTime = (hm) => new Date(`2000-01-01T${hm}`).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
const fmtStamp = (ts) => new Date(ts).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
function relDate(s) {
  const t = today();
  if (s === t) return 'اليوم';
  if (s === addDays(t, 1)) return 'غداً';
  if (s === addDays(t, -1)) return 'أمس';
  return fmtDate(s);
}
const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const daysWord = (n) => (n === 0 ? '0 يوم' : plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً'));

// ---------- state ----------
function normalize(t) {
  return {
    id: t.id || uid(),
    title: String(t.title || ''),
    priority: PRI[t.priority] ? t.priority : 'mid',
    category: t.category || '',
    due: t.due || '',
    time: t.time || '',
    remind: !!t.remind,
    notes: Array.isArray(t.notes) ? t.notes : [],
    created: t.created || Date.now(),
    done: !!t.done,
    doneAt: t.doneAt || null,
    repeat: t.repeat && Array.isArray(t.repeat.days) ? t.repeat : null,
    completions: t.completions && typeof t.completions === 'object' ? t.completions : {},
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
  s.settings = { name: '', accent: 'teal', theme: 'system', size: 'normal', sound: true, ...(s.settings || {}) };
  s.fired = s.fired || {};
  s.snoozed = s.snoozed || {};
  return s;
}

const S = load();
const ui = { tab: 'today', filter: 'active', q: '', sort: 'smart', cat: '' };

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast('تعذّر الحفظ. قد تكون مساحة التخزين ممتلئة.'); }
}
const getTask = (id) => S.tasks.find((t) => t.id === id);

// ---------- recurrence ----------
const isRepeat = (t) => !!t.repeat;
function occursOn(t, d) {
  const r = t.repeat;
  if (!r || d < r.start || (r.until && d > r.until)) return false;
  return r.days.includes(parse(d).getDay());
}
const doneOn = (t, d) => (isRepeat(t) ? !!t.completions[d] : t.done);
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
  // current streak: walk back over occurrence days; today doesn't break it if not done yet
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
function toggle(id, date) {
  const t = getTask(id);
  if (!t) return;
  if (isRepeat(t)) {
    const d = date || today();
    if (t.completions[d]) delete t.completions[d];
    else t.completions[d] = Date.now();
  } else {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
  }
  save();
  render();
}

function removeTask(id) {
  S.tasks = S.tasks.filter((t) => t.id !== id);
  for (const k of Object.keys(S.fired)) if (k.startsWith(id + '|')) delete S.fired[k];
  for (const k of Object.keys(S.snoozed)) if (k.startsWith(id + '|')) delete S.snoozed[k];
  save();
  render();
}

// ---------- rendering ----------
function itemHTML(t, date) {
  const d = date || today();
  const done = doneOn(t, d);
  const meta = [`<span class="pri p-${t.priority}">${PRI_LABEL[t.priority]}</span>`];
  if (t.category) meta.push(`<span class="cat">${esc(t.category)}</span>`);
  if (isRepeat(t)) meta.push(`<span>${icon('repeat')}${esc(repeatLabel(t))}</span>`);
  else if (t.due) {
    const late = !t.done && t.due < today();
    meta.push(`<span class="${late ? 'late' : ''}">${icon('cal')}${late ? 'متأخرة · ' : ''}${esc(relDate(t.due))}</span>`);
  }
  if (t.time) meta.push(`<span class="num">${t.remind ? icon('bell') : ''}${esc(fmtTime(t.time))}</span>`);
  if (t.notes.length) meta.push(`<span class="num">${icon('note')}${t.notes.length}</span>`);
  return `<li class="task p-${t.priority}${done ? ' done' : ''}">
    <button type="button" class="check" data-action="toggle" data-id="${t.id}" data-date="${d}" aria-pressed="${done}" aria-label="${done ? 'إلغاء الإنجاز' : 'تمت'}">${icon('check')}</button>
    <button type="button" class="t-main" data-action="open" data-id="${t.id}">
      <span class="t-title">${esc(t.title)}</span>
      <span class="meta">${meta.join('')}</span>
    </button>
  </li>`;
}

const emptyHTML = (title, text, action) =>
  `<div class="empty"><strong>${title}</strong><span>${text}</span>${action || ''}</div>`;

function viewToday() {
  const d = today();
  const items = [];
  for (const t of S.tasks) {
    if (isRepeat(t)) { if (occursOn(t, d)) items.push(t); }
    else if (!t.done && t.due && t.due <= d) items.push(t);
    else if (t.done && t.doneAt && iso(new Date(t.doneAt)) === d) items.push(t);
  }
  items.sort((a, b) =>
    doneOn(a, d) - doneOn(b, d) ||
    (a.time || '99').localeCompare(b.time || '99') ||
    PRI[b.priority] - PRI[a.priority]);
  const done = items.filter((t) => doneOn(t, d)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const late = items.filter((t) => !isRepeat(t) && t.due < d).length;
  const open = items.length - done;
  const undated = S.tasks.filter((t) => !isRepeat(t) && !t.done && !t.due).length;

  const summary = items.length
    ? (open ? `باقٍ ${open} من ${items.length}` : 'أنجزت كل مهام اليوم')
    : 'لا شيء مجدول لليوم';
  return `
  <div class="today-card">
    <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div class="txt">
      <b>${summary}</b>
      <span class="muted">${late ? `<span class="late">${late} متأخرة</span> · ` : ''}${undated ? `${undated} بلا تاريخ في «المهام»` : 'تابع تقدمك في «الإحصائيات»'}</span>
    </div>
  </div>
  <section class="section">
    <div class="section-head"><h2>مهام اليوم وأهدافه</h2><small>${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>
    ${items.length
      ? `<ul class="list">${items.map((t) => itemHTML(t, d)).join('')}</ul>`
      : emptyHTML('يومك فارغ', 'أضف مهمة بتاريخ اليوم أو هدفاً يومياً من زر الإضافة.', '<button type="button" class="ghost" data-action="new">إضافة مهمة</button>')}
  </section>`;
}

function categories() {
  return [...new Set(S.tasks.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
}

function viewTasks() {
  const q = ui.q.trim().toLowerCase();
  const t0 = today();
  let list = S.tasks.filter((t) => !isRepeat(t) &&
    (ui.filter === 'all' || (ui.filter === 'done') === t.done) &&
    (!ui.cat || t.category === ui.cat) &&
    (!q || t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.notes.some((n) => n.text.toLowerCase().includes(q))));
  list.sort((a, b) => {
    if (ui.filter === 'done') return (b.doneAt || 0) - (a.doneAt || 0);
    if (ui.sort === 'created') return b.created - a.created;
    if (ui.sort === 'due') return (a.due || '9999').localeCompare(b.due || '9999') || b.created - a.created;
    const lateA = a.due && a.due < t0, lateB = b.due && b.due < t0;
    return lateB - lateA || PRI[b.priority] - PRI[a.priority] || (a.due || '9999').localeCompare(b.due || '9999');
  });
  const cats = categories();
  const seg = [['active', 'الحالية'], ['done', 'المنجزة'], ['all', 'الكل']]
    .map(([v, l]) => `<button type="button" data-action="filter" data-v="${v}" aria-pressed="${ui.filter === v}">${l}</button>`).join('');
  const hasAny = S.tasks.some((t) => !isRepeat(t));
  return `
  <div class="toolbar">
    <input type="search" id="search" placeholder="بحث في المهام والملاحظات" aria-label="بحث" value="${esc(ui.q)}">
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
    ? `<ul class="list">${list.map((t) => itemHTML(t)).join('')}</ul>`
    : hasAny
      ? emptyHTML(q ? 'لا نتائج' : ui.filter === 'done' ? 'لا مهام منجزة بعد' : 'لا مهام حالية', q ? 'جرّب كلمة بحث أخرى.' : 'كل شيء مُنجز هنا.')
      : emptyHTML('لا مهام بعد', 'اضغط زر + لإضافة أول مهمة.', '<button type="button" class="ghost" data-action="new">إضافة مهمة</button>')}`;
}

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
  return `<li class="goal${done ? ' done' : ''}">
    <div class="goal-top">
      <button type="button" class="check" data-action="toggle" data-id="${t.id}" data-date="${t0}" aria-pressed="${done}"
        aria-label="${occursToday ? (done ? 'إلغاء إنجاز اليوم' : 'أنجزته اليوم') : 'ليس مجدولاً اليوم'}"${occursToday ? '' : ' disabled'}>${icon('check')}</button>
      <button type="button" class="t-main" data-action="open" data-id="${t.id}">
        <span class="t-title">${esc(t.title)}</span>
        <span class="meta"><span>${icon('repeat')}${esc(repeatLabel(t))}</span>${t.time ? `<span class="num">${t.remind ? icon('bell') : ''}${esc(fmtTime(t.time))}</span>` : ''}${t.notes.length ? `<span class="num">${icon('note')}${t.notes.length}</span>` : ''}${t.category ? `<span class="cat">${esc(t.category)}</span>` : ''}</span>
      </button>
    </div>
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
      'الهدف المتكرر يظهر في يومك تلقائياً، يومياً أو في أيام تختارها، إلى تاريخ محدد أو بلا نهاية.',
      '<button type="button" class="ghost" data-action="new-goal">إضافة هدف</button>')}</section>`;
  }
  const active = goals.filter((t) => !goalEnded(t)).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const ended = goals.filter(goalEnded);
  return `
  <section class="section">
    <div class="section-head"><h2>الأهداف المتكررة</h2><button type="button" class="ghost" data-action="new-goal">هدف جديد</button></div>
    ${active.length ? `<ul class="list">${active.map(goalHTML).join('')}</ul>` : emptyHTML('لا أهداف جارية', 'كل أهدافك انتهت مدتها.')}
  </section>
  ${ended.length ? `<section class="section"><h2>أهداف انتهت مدتها</h2><ul class="list">${ended.map(goalHTML).join('')}</ul></section>` : ''}`;
}

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
  const days = Object.keys(byDay).sort();
  let best = 0, run = 0, prev = null;
  for (const x of days) {
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
    // RTL: oldest on the right, today on the left
    const x = padL + (N - 1 - i) * bw + gap / 2;
    const v = counts[i];
    const label = `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${v} ${v === 1 ? 'إنجاز' : 'إنجازات'}`;
    let bar = `<rect class="zero" x="${x}" y="${y(0) - 2}" width="${w}" height="2" rx="1"/>`;
    if (v > 0) {
      const top = y(v), h = y(0) - top, r = Math.min(4, h, w / 2);
      bar = `<path class="bar" d="M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y(0)} Z"/>`;
    }
    parts.push(`<g class="col" data-tip="${esc(label)}"><rect class="hit" x="${x - gap / 2}" y="${padT}" width="${bw}" height="${ph + padB}"><title>${esc(label)}</title></rect>${bar}</g>`);
    if (i === N - 1 || (N - 1 - i) % 3 === 0) {
      const txt = i === N - 1 ? 'اليوم' : String(parse(d).getDate());
      parts.push(`<text class="axis" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${txt}</text>`);
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" direction="ltr" role="img" aria-label="الإنجازات في آخر 14 يوماً">${parts.join('')}</svg>`;
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
  <p class="note-text">لديك ${openCount} ${openCount === 1 ? 'مهمة مفتوحة' : 'مهام مفتوحة'} الآن.</p>`;
}

function notifStatus() {
  if (!('Notification' in window)) return '<span class="status-bad">هذا المتصفح لا يدعم الإشعارات. ثبّت التطبيق على الشاشة الرئيسية أولاً.</span>';
  if (Notification.permission === 'granted') return '<span class="status-ok">الإشعارات مفعّلة</span>';
  if (Notification.permission === 'denied') return '<span class="status-bad">الإشعارات محظورة. فعّلها من إعدادات المتصفح أو الجوال.</span>';
  return '<span>الإشعارات غير مفعّلة بعد</span>';
}

function viewSettings() {
  const st = S.settings;
  const segBtn = (action, v, label, cur) => `<button type="button" data-action="${action}" data-v="${v}" aria-pressed="${cur === v}">${label}</button>`;
  return `<div class="settings">
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
    <div class="field"><span>حجم الخط</span>
      <div class="seg">${segBtn('size', 'normal', 'عادي', st.size)}${segBtn('size', 'big', 'كبير', st.size)}</div>
    </div>
  </section>
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
    <h2>البيانات</h2>
    <div class="row-between">
      <span class="note-text">${S.tasks.length} عنصر محفوظ</span>
      <button type="button" class="danger" data-action="wipe">حذف كل البيانات</button>
    </div>
  </section>
  </div>`;
}

const VIEWS = { today: viewToday, tasks: viewTasks, goals: viewGoals, stats: viewStats, settings: viewSettings };

function render() {
  const view = $('view');
  // keep focus/caret in the search box across re-renders
  const active = document.activeElement && document.activeElement.id;
  const caret = active === 'search' ? document.activeElement.selectionStart : null;
  view.innerHTML = VIEWS[ui.tab]();
  if (active === 'search' && $('search')) { $('search').focus(); $('search').setSelectionRange(caret, caret); }
  for (const b of $('tabbar').children) {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  renderGreetingOnly();
  $('cats').innerHTML = categories().map((c) => `<option value="${esc(c)}">`).join('');
}

// ---------- theme ----------
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = () => S.settings.theme === 'dark' || (S.settings.theme === 'system' && mq.matches);
function applyTheme() {
  const root = document.documentElement;
  if (S.settings.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.settings.theme);
  root.setAttribute('data-size', S.settings.size);
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
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- editor sheet ----------
const sheet = $('sheet');
let draft = null;
let draftIsNew = true;

function setKind(kind) {
  draft.kind = kind;
  for (const b of $('fKind').children) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
  $('onceFields').hidden = kind !== 'once';
  $('repeatFields').hidden = kind !== 'repeat';
}

function renderDays() {
  $('fDays').innerHTML =
    `<button type="button" data-action="all-days" aria-pressed="${draft.days.length === 7}">كل يوم</button>` +
    DAY_ORDER.map((d) => `<button type="button" data-action="day" data-v="${d}" aria-pressed="${draft.days.includes(d)}">${DAY_SHORT[d]}</button>`).join('');
}

function renderNotes() {
  const notes = draft.notes;
  $('notesCount').textContent = notes.length ? `(${notes.length})` : '';
  $('notesList').innerHTML = notes.slice().reverse().map((n) => `
    <li class="note"><p>${esc(n.text)}</p>
      <div class="note-foot"><span class="num">${esc(fmtStamp(n.at))}</span>
      <button type="button" data-action="del-note" data-v="${n.id}" class="${armedNote === n.id ? 'armed' : ''}">${armedNote === n.id ? 'تأكيد الحذف' : 'حذف'}</button></div>
    </li>`).join('');
}

function openSheet(id, kind) {
  const t = id ? getTask(id) : null;
  draftIsNew = !t;
  const t0 = today();
  draft = t
    ? { id: t.id, kind: isRepeat(t) ? 'repeat' : 'once', days: t.repeat ? [...t.repeat.days] : [...DAY_ORDER], notes: t.notes.map((n) => ({ ...n })) }
    : { id: uid(), kind: kind || 'once', days: [...DAY_ORDER], notes: [] };
  $('sheetTitle').textContent = t ? (isRepeat(t) ? 'تعديل الهدف' : 'تعديل المهمة') : (kind === 'repeat' ? 'هدف جديد' : 'مهمة جديدة');
  $('fTitle').value = t ? t.title : '';
  $('fPriority').value = t ? t.priority : 'mid';
  $('fCategory').value = t ? t.category : (ui.tab === 'tasks' && ui.cat) || '';
  $('fDue').value = t ? t.due : (ui.tab === 'today' ? t0 : '');
  $('fStart').value = t && t.repeat ? t.repeat.start : t0;
  $('fUntil').value = t && t.repeat ? t.repeat.until || '' : '';
  $('fTime').value = t ? t.time : '';
  $('fRemind').checked = t ? t.remind : false;
  $('fNote').value = '';
  $('delBtn').hidden = !t;
  $('delBtn').classList.remove('armed');
  $('delBtn').textContent = 'حذف';
  armedNote = null;
  setKind(draft.kind);
  renderDays();
  renderNotes();
  if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
  setTimeout(() => { if (!t) $('fTitle').focus(); }, 50);
}

function closeSheet() {
  if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
  draft = null;
}

function readDraft() {
  const title = $('fTitle').value.trim();
  if (!title) return null;
  const existing = getTask(draft.id);
  const base = existing || normalize({ id: draft.id, created: Date.now() });
  const time = $('fTime').value;
  const t = {
    ...base,
    title,
    priority: $('fPriority').value,
    category: $('fCategory').value.trim(),
    time,
    remind: !!time && $('fRemind').checked,
    notes: draft.notes,
  };
  if (draft.kind === 'repeat') {
    const start = $('fStart').value || today();
    let until = $('fUntil').value || null;
    if (until && until < start) until = start;
    t.repeat = { days: draft.days.length ? [...draft.days].sort() : [...DAY_ORDER].sort(), start, until };
    t.due = '';
    t.done = false;
    t.doneAt = null;
  } else {
    t.repeat = null;
    t.due = $('fDue').value || (time ? today() : '');
  }
  return t;
}

function commitDraft() {
  const t = readDraft();
  if (!t) { $('fTitle').focus(); toast('اكتب عنواناً أولاً.'); return false; }
  const i = S.tasks.findIndex((x) => x.id === t.id);
  if (i === -1) S.tasks.push(t); else S.tasks[i] = t;
  // a changed time should be able to ring again today
  for (const k of Object.keys(S.fired)) if (k.startsWith(t.id + '|')) delete S.fired[k];
  save();
  return t;
}

let armedNote = null;
let armTimer = null;
function armReset(fn) { clearTimeout(armTimer); armTimer = setTimeout(fn, 3000); }

$('editor').addEventListener('submit', (e) => {
  e.preventDefault();
  if ($('fNote').value.trim()) addNote();
  const t = commitDraft();
  if (!t) return;
  const wasNew = draftIsNew;
  closeSheet();
  if (t.remind) ensureNotifPermission();
  render();
  toast(wasNew ? 'أُضيفت' : 'حُفظت التعديلات');
});
sheet.addEventListener('close', () => { draft = null; });
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

function addNote() {
  const text = $('fNote').value.trim();
  if (!text) return;
  draft.notes.push({ id: uid(), text, at: Date.now() });
  $('fNote').value = '';
  // notes on an existing task are kept right away
  const t = getTask(draft.id);
  if (t) { t.notes = draft.notes.map((n) => ({ ...n })); save(); render(); }
  renderNotes();
}

// ---------- calendar export (.ics) ----------
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
const icsDate = (d) => d.replace(/-/g, '');
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function buildICS(t) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const date = isRepeat(t) ? t.repeat.start : (t.due || today());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mahami//AR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${t.id}@mahami`, `DTSTAMP:${stamp}`];
  if (t.time) {
    lines.push(`DTSTART:${icsDate(date)}T${t.time.replace(':', '')}00`, 'DURATION:PT15M');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(date, 1))}`);
  }
  lines.push(`SUMMARY:${icsEscape(t.title)}`);
  if (t.notes.length) lines.push(`DESCRIPTION:${icsEscape(t.notes.map((n) => n.text).join('\n—\n'))}`);
  if (isRepeat(t)) {
    const r = t.repeat;
    let rule = r.days.length === 7 ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${r.days.map((d) => ICS_DAYS[d]).join(',')}`;
    if (r.until) rule += `;UNTIL=${icsDate(r.until)}${t.time ? 'T235959' : ''}`;
    lines.push(`RRULE:${rule}`);
  }
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t.title)}`, `TRIGGER:${t.time ? '-PT0M' : 'PT9H'}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR');
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

async function systemNotify(t, key) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const body = t.time ? `الموعد: ${fmtTime(t.time)}` : 'تذكير';
  const opts = {
    body, tag: key, renotify: true, requireInteraction: true, lang: 'ar', dir: 'rtl',
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [200, 100, 200, 100, 400],
    data: { id: t.id, key },
    actions: [{ action: 'done', title: 'تمت' }, { action: 'snooze', title: `غفوة ${SNOOZE_MIN} دقائق` }],
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(t.title, opts);
    else new Notification(t.title, { body, tag: key });
  } catch {}
}

const alarmQueue = [];
function ring(t, key) {
  S.fired[key] = Date.now();
  delete S.snoozed[key];
  save();
  alarmQueue.push({ id: t.id, key });
  showAlarm();
  beep();
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  if (document.visibilityState !== 'visible') systemNotify(t, key);
}

function showAlarm() {
  const cur = alarmQueue[0];
  if (!cur) { $('alarm').hidden = true; return; }
  const t = getTask(cur.id);
  if (!t) { alarmQueue.shift(); showAlarm(); return; }
  $('alarmTitle').textContent = t.title + (t.time ? ` · ${fmtTime(t.time)}` : '');
  $('alarm').hidden = false;
}

function alarmAction(action, id, key) {
  const t = getTask(id);
  const date = key ? key.split('|')[1] : today();
  if (t && action === 'done' && !doneOn(t, date)) toggle(id, date);
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
  const now = new Date();
  const d = iso(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const t of S.tasks) {
    if (!t.remind || !t.time) continue;
    const applies = isRepeat(t) ? occursOn(t, d) : t.due === d;
    if (!applies || doneOn(t, d)) continue;
    const key = `${t.id}|${d}`;
    const snooze = S.snoozed[key];
    if (snooze) { if (Date.now() >= snooze) ring(t, key); continue; }
    if (S.fired[key]) continue;
    const at = minutesOf(t.time);
    if (nowMin < at) continue;
    if (nowMin - at > MISSED_WINDOW_MIN) { S.fired[key] = Date.now(); save(); continue; }
    ring(t, key);
  }
  // forget old alarm records
  const cutoff = Date.now() - 3 * 86400000;
  for (const k of Object.keys(S.fired)) if (S.fired[k] < cutoff) delete S.fired[k];
}

// ---------- backup ----------
function exportData() {
  const data = JSON.stringify({ app: 'mahami', version: 2, exported: new Date().toISOString(), tasks: S.tasks, settings: S.settings }, null, 2);
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

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-tab]');
  if (!el) return;
  if (el.dataset.tab) {
    ui.tab = el.dataset.tab;
    render();
    window.scrollTo({ top: 0 });
    history.replaceState(null, '', '#' + ui.tab);
    return;
  }
  const { action, id, v } = el.dataset;
  switch (action) {
    case 'new': openSheet(null, 'once'); break;
    case 'new-goal': openSheet(null, 'repeat'); break;
    case 'open': openSheet(id); break;
    case 'toggle': toggle(id, el.dataset.date); break;
    case 'filter': ui.filter = v; render(); break;
    case 'cat': ui.cat = v; render(); break;
    case 'close-sheet': closeSheet(); break;
    case 'all-days': draft.days = draft.days.length === 7 ? [] : [...DAY_ORDER]; renderDays(); break;
    case 'day': {
      const d = Number(v);
      draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d];
      renderDays();
      break;
    }
    case 'add-note': addNote(); $('fNote').focus(); break;
    case 'del-note':
      if (armedNote !== v) { armedNote = v; renderNotes(); armReset(() => { armedNote = null; if (draft) renderNotes(); }); break; }
      armedNote = null;
      draft.notes = draft.notes.filter((n) => n.id !== v);
      { const t = getTask(draft.id); if (t) { t.notes = draft.notes.map((n) => ({ ...n })); save(); render(); } }
      renderNotes();
      break;
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
      render();
      downloadFile(`${t.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, '') || 'mahami'}.ics`, buildICS(t), 'text/calendar');
      toast('افتح الملف ليُضاف الموعد ومنبهه إلى تقويمك');
      break;
    }
    case 'accent': S.settings.accent = v; save(); applyTheme(); render(); break;
    case 'theme': S.settings.theme = v; save(); applyTheme(); render(); break;
    case 'size': S.settings.size = v; save(); applyTheme(); render(); break;
    case 'notif': ensureNotifPermission(); break;
    case 'test-alarm':
      unlockAudio();
      alarmQueue.push({ id: '__test', key: '__test' });
      $('alarmTitle').textContent = 'هذا مثال على شكل المنبه وصوته';
      $('alarm').hidden = false;
      setTimeout(beep, 50);
      systemNotify({ title: 'منبه تجريبي من «مهامي»', time: '' }, '__test');
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
    case 'export': exportData(); break;
    case 'import': $('importFile').click(); break;
    case 'wipe':
      if (confirm('سيُحذف كل شيء نهائياً من هذا الجهاز. هل أنت متأكد؟')) {
        S.tasks = []; S.fired = {}; S.snoozed = {}; save(); render(); toast('حُذفت كل البيانات');
      }
      break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { ui.q = e.target.value; render(); }
  if (e.target.id === 'setName') { S.settings.name = e.target.value; save(); renderGreetingOnly(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'sort') { ui.sort = e.target.value; render(); }
  if (e.target.id === 'setSound') { S.settings.sound = e.target.checked; save(); }
  if (e.target.id === 'importFile' && e.target.files[0]) importData(e.target.files[0]);
  if (e.target.id === 'fTime' && e.target.value && !$('fRemind').checked) $('fRemind').checked = true;
});
$('fNote').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); }
});

function renderGreetingOnly() {
  const name = S.settings.name.trim();
  const hello = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  $('greeting').textContent = `${hello}${name ? '، ' + name : ''} · ${fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}`;
}

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
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'alarm-action') alarmAction(m.action, m.id, m.key);
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
  if (params.get('new')) openSheet(null, params.get('new') === 'goal' ? 'repeat' : 'once');
  if (params.toString()) history.replaceState(null, '', location.pathname + location.hash);
  checkAlarms();
  setInterval(checkAlarms, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { checkAlarms(); render(); }
  });
  // re-render once the day changes so "today" stays correct
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); render(); } }, 60000);
})();
