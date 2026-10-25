'use strict';
// «خطِّط»: printing the plan (v109). The plan of a day, a week, a month or a year, and the statistics, each on one A4 page
// that is saved as a PDF from the print window (or printed, to hang on a wall). The page is built in #print (never seen on
// the screen), narrowed or shrunk to fit one page, and printed. It is read from the plan as it is (plan.js), and kept short.

const KH_PAGE = { day: [718, 1047, 'A4 portrait'], week: [1047, 718, 'A4 landscape'], month: [718, 1047, 'A4 portrait'], year: [718, 1047, 'A4 portrait'], stats: [718, 1047, 'A4 portrait'] }; // in points, margins of 10mm gone
const KH_PNAME = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر', year: 'السنة', stats: 'الإحصائية' };
const KH_PRINT_IC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>';
const khPdfBtn = (level) => `<div class="kh-pd-row"><button type="button" class="ghost kh-pdf" data-action="kh-print" data-v="${level}">${KH_PRINT_IC}<span>${level === 'stats' ? 'حفظ الإحصائية' : `طباعة خطة ${KH_PNAME[level]}`} <small>PDF</small></span></button></div>`;

const khPdBx = (on) => `<i class="pd-bx${on ? ' on' : ''}"></i>`;
const khPdLines = (n) => '<i class="pd-ln"></i>'.repeat(Math.max(0, n));
function khPdHead(title, sub, sub2, stat) {
  // the logo is an image, not text: some PDF programs drop the marks of a font
  return `<header class="pd-head"><div class="pd-title"><img class="pd-logo" src="icons/icon-192.png" alt=""><div><h1>${title}</h1><p>${sub}${sub2 ? `<br><span>${sub2}</span>` : ''}</p></div></div>${stat ? `<div class="pd-stat">${stat}</div>` : ''}</header>`;
}
const khPdFoot = '<footer class="pd-foot"><span>إن أنجزت ٧٠٪ من خطتك فأنت في الطريق الصحيح، وما بقي تنقله أو تختصره أو تلغيه.</span><span>الوعي الشخصي | خطِّط</span></footer>';
const khPdName = (t, k) => `${hasTime(t) ? `<small class="pd-tm">${esc(timeLabel(t, k))}</small> ` : ''}${khAreaOf(t) ? `<small>${KH_AREAS[khAreaOf(t)]}</small> ` : ''}${esc(t.title)}`;
const khPdDate = (d, o) => esc(fmtDate(d, o)), khPdHij = (d, o) => esc(fmtHijri(d, o));
const khPdWeekLabel = (k) => `${khPdDate(k, { day: 'numeric', month: 'long' })} – ${khPdDate(addDays(k, 6), { day: 'numeric', month: 'long' })}`;

// ---------- the day: its items by role, the priorities boxed, and lines to write on ----------
function khPdDay(d) {
  const items = khTodayItems(d);
  const li = (t) => `<li${t.prio === d ? ' class="pd-pri"' : ''}>${khPdBx(doneOn(t, d))}<span>${khPdName(t, d)}</span></li>`;
  const groups = [...khRoles(), null].map((r) => {
    const xs = items.filter((t) => khRoleIdOf(t) === (r ? r.id : '')).sort((a, b) => (timeOn(a, d) ?? 9999) - (timeOn(b, d) ?? 9999));
    return xs.length ? `<section class="pd-block" style="--rc:${khColor(r ? r.id : '')}"><h2>${esc(r ? r.name : 'بلا دور')}</h2><ul class="pd-list">${xs.map(li).join('')}</ul></section>` : '';
  }).join('');
  return `${khPdHead('خطة اليوم', khPdDate(d, { weekday: 'long', day: 'numeric', month: 'long' }), khPdHij(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}
    <div class="pd-grid">${groups || '<p class="pd-empty">لا مهام لهذا اليوم بعد.</p>'}</div>
    <section class="pd-block"><h2>أُضيف اليوم</h2><ul class="pd-list pd-fill"><li class="pd-ln-i">${khPdBx(false)}<span></span></li></ul></section>${khPdFoot}`;
}

// ---------- the week: a table, the roles and their tasks against the seven days, a box where a task is asked ----------
function khPdWeek(k) {
  const days = khDays(k), xs = khWeekItems(k), p = khShownPct(k);
  const rows = [...khRoles(), null].map((r) => {
    const mine = xs.filter((x) => khRoleIdOf(x.t) === (r ? r.id : ''));
    if (!r && !mine.length) return '';
    const items = mine.map((x) => {
      const t = x.t;
      if (x.kind === 'rep') return { t, cells: days.map((d) => (x.quota ? (t.completions[d] ? khPdBx(true) : '') : x.days.includes(d) ? khPdBx(!!t.completions[d]) : '')), end: x.quota ? Array.from({ length: x.need }, (_, i) => khPdBx(i < x.done)).join('') : `${x.done}/${x.need}` };
      const once = !t.from, done = x.done >= x.need;
      return { t, cells: days.map((d) => (once && t.due === d ? khPdBx(done) : '')), end: once ? (done ? '✓' : '') : khPdBx(done) };
    });
    const list = items.length ? items : [{ t: null, cells: days.map(() => ''), end: '' }];
    return list.map((it, i) => `<tr style="--rc:${khColor(r ? r.id : '')}">${i ? '' : `<th class="pd-role" rowspan="${list.length}">${esc(r ? r.name : 'بلا دور')}</th>`}<td class="pd-task">${it.t ? khPdName(it.t, k) : '—'}</td>${it.cells.map((c) => `<td class="pd-c">${c}</td>`).join('')}<td class="pd-c pd-end">${it.end}</td></tr>`).join('');
  }).join('');
  return `${khPdHead('خطة الأسبوع', khPdWeekLabel(k), `${khPdHij(k, { day: 'numeric', month: 'long' })} – ${khPdHij(addDays(k, 6), { day: 'numeric', month: 'long', year: 'numeric' })}`, p === null ? '' : `<b>${p}٪</b><span>الإنجاز</span>`)}
    <table class="pd-week"><thead><tr><th>الدور</th><th>المهمة</th>${days.map((d) => `<th class="pd-c">${KH_WD[parse(d).getDay()]}<small>${parse(d).getDate()}</small></th>`).join('')}<th class="pd-c">الإنجاز</th></tr></thead><tbody>${rows}</tbody></table>${khPdFoot}`;
}

// a month's or a year's blocks by role: its goals (ticked if achieved) and its recurring goals with their share
function khPdBlocks(level, from, to) {
  const rec = khStatsOf(from, to).rec;
  return `<div class="pd-grid">${[...khRoles(), null].map((r) => {
    const id = r ? r.id : '';
    const gs = level === 'year'
      ? [...S.kgoals.filter((g) => g.level === 'life' && (khRole(g.roleId) ? g.roleId : '') === id && g.status !== 'dropped').map((g) => ({ g, tag: 'رؤية', ok: g.status === 'done' })),
        ...S.kgoals.filter((g) => g.level === 'year' && kgRoleId(g) === id && khYrOfKey(g.period) === from).map((g) => { const x = ygShare(g, from); return { g, tag: 'هدف السنة', ok: g.status === 'done' || (x.target > 0 && x.done >= x.target) }; })]
      : S.kgoals.filter((g) => g.level === 'month' && kgRoleId(g) === id && mgActive(g, from)).map((g) => ({ g, tag: 'هدف الشهر', ok: g.status === 'done' || mgDone(g, from) }));
    const hs = rec.filter((x) => khRoleIdOf(x.t) === id && !isHabit(x.t));
    const once = khDoneIn(from, to, id);
    if (!gs.length && !hs.length && !once) return '';
    return `<section class="pd-block" style="--rc:${khColor(id)}"><h2>${esc(r ? r.name : 'بلا دور')}</h2>
      ${gs.map(({ g, tag, ok }) => `<p class="pd-goal${ok ? ' done' : ''}"><small>${tag}</small> ${ok ? '✓ ' : ''}${esc(g.text)}</p>`).join('')}
      ${hs.map((x) => `<div class="pd-share"><span>${esc(x.t.title)}</span><span class="pd-bar"><i style="width:${Math.round((x.done / x.target) * 100)}%"></i></span><b>${x.done}/${x.target}</b></div>`).join('')}
      ${once ? `<p class="pd-once">أنجزت ${once} ${once === 1 ? 'مرة' : 'مرات'} في هذه المدة</p>` : ''}</section>`;
  }).join('') || '<p class="pd-empty">لا أهداف ولا مهام في هذه المدة بعد.</p>'}</div>`;
}
function khPdMonth(m) {
  const end = khMoNext(m), all = khWeekStarts(m, end), cur = khWeekOf(today());
  const pk = (k) => (k > cur ? null : khShownPct(k)), pcts = all.map(pk).filter((x) => x !== null);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null, n = khDoneIn(m, end);
  // each week of the month: its dates, its share, its tasks for one time, and lines to write on
  const cell = (k) => {
    const p = pk(k), ts = khWeekItems(k).filter((x) => x.kind === 'task').map((x) => x.t).slice(0, 6);
    return `<section class="pd-mo pd-wk${k === cur ? ' now' : ''}"><h3><span>الأسبوع ${KH_ORD[khWkOrd(k) - 1] || ''}</span>${p === null ? '' : `<b>${p}٪</b>`}</h3><small class="pd-dates">${khPdWeekLabel(k)}</small>
      ${ts.map((t) => `<p class="pd-mg" style="--rc:${khColor(khRoleIdOf(t))}">${t.done ? '✓ ' : ''}${esc(t.title)}</p>`).join('')}${khPdLines(4 - ts.length)}</section>`;
  };
  return `${khPdHead('خطة الشهر', esc(khMoLabel(m)), '', `${n ? `<b>${n}</b><span>${n === 1 ? 'إنجاز' : 'إنجازات'}</span>` : ''}${avg === null ? '' : `<b>${avg}٪</b><span>متوسط أسابيعه</span>`}`)}
    ${khPdBlocks('month', m, end)}<h2 class="pd-sec">أسابيع الشهر</h2><div class="pd-year pd-weeksgrid">${all.map(cell).join('')}</div>${khPdFoot}`;
}
function khPdYear(y) {
  const end = khYrNext(y), months = [];
  for (let m = y; m < end; m = khMoNext(m)) months.push(m);
  const n = khDoneIn(y, end);
  // the twelve months: their goals, their achievements, and lines to write on (a year plan for a wall)
  const cell = (m) => {
    const c = khDoneIn(m, khMoNext(m)), gs = S.kgoals.filter((g) => g.level === 'month' && mgActive(g, m));
    return `<section class="pd-mo${m === khMoStart(today()) ? ' now' : ''}"><h3><span>${esc(khMoShort(m))}</span>${c ? `<b>${c}</b>` : ''}</h3>
      ${gs.map((g) => `<p class="pd-mg" style="--rc:${khColor(kgRoleId(g))}">${g.status === 'done' || mgDone(g, m) ? '✓ ' : ''}${esc(g.text)}</p>`).join('')}${khPdLines(3 - gs.length)}</section>`;
  };
  return `${khPdHead('خطة السنة', esc(khYrLabel(y)), '', n ? `<b>${n}</b><span>${n === 1 ? 'إنجاز' : 'إنجازات'}</span>` : '')}
    ${khPdBlocks('year', y, end)}<h2 class="pd-sec">شهور السنة</h2><div class="pd-year">${months.map(cell).join('')}</div>${khPdFoot}`;
}
// the statistics of the period chosen in «إحصائياتي»
function khPdStats() {
  const st = khUi.st, R = khStatRange(st), X = khStatsOf(R.from, R.to), ser = khStatSeries(st, R), max = Math.max(1, ...ser.map((x) => x.v));
  const bar = (v, all) => `<span class="pd-bar"><i style="width:${all ? Math.round((v / all) * 100) : 0}%"></i></span>`;
  const top = (xs) => Math.max(1, ...xs);
  return `${khPdHead(R.title, esc(R.label), '')}
    <div class="pd-nums"><span><b>${X.done}</b>إنجاز</span><span><b>${X.avg === null ? '—' : `${X.avg}٪`}</b>متوسط الأسابيع</span><span><b>${X.pcts.length ? `${X.good} من ${X.pcts.length}` : '—'}</b>أسابيع بلغت ٧٠٪</span><span><b>${X.life}</b>في حياتي</span></div>
    <div class="pd-months pd-series" style="--n:${ser.length}">${ser.map((x) => `<span><i style="height:${Math.round((x.v / max) * 100)}%"></i><b>${x.v || ''}</b><small>${esc(x.l)}</small></span>`).join('')}</div>
    <div class="pd-grid">
      <section class="pd-block"><h2>الإنجاز في كل دور</h2>${X.byRole.map((x) => `<div class="pd-share" style="--rc:${khColor(x.r ? x.r.id : '')}"><span>${esc(x.r ? x.r.name : 'بلا دور')}</span>${bar(x.n, top(X.byRole.map((y) => y.n)))}<b>${x.n}</b></div>`).join('')}</section>
      <section class="pd-block" style="--rc:var(--lv-life)"><h2>شحذ المنشار</h2>${X.saw.map((x) => `<div class="pd-share"><span>${KH_AREAS[x.a]}</span>${bar(x.n, top(X.saw.map((y) => y.n)))}<b>${x.n}</b></div>`).join('')}</section>
      ${X.rec.length ? `<section class="pd-block"><h2>الالتزام بالأهداف المتكررة</h2>${X.rec.map((x) => `<div class="pd-share"><span>${esc(x.t.title)}</span>${bar(x.done, x.target)}<b>${x.done}/${x.target}</b></div>`).join('')}</section>` : ''}
    </div>${khPdFoot}`;
}

// builds the page, fits it on one page (writing lines fill what is left; what is too long is shrunk), and opens the print window
function khPrint(level) {
  const [W, H, size] = KH_PAGE[level];
  const html = level === 'day' ? khPdDay(today()) : level === 'stats' ? khPdStats() : level === 'week' ? khPdWeek(khUi.wk || khWeekOf(today()))
    : level === 'month' ? khPdMonth(khMoStart(khUi.mo || today())) : khPdYear(khYrStart(khUi.yr || today()));
  let box = document.getElementById('print');
  if (!box) { box = document.createElement('div'); box.id = 'print'; document.body.appendChild(box); }
  let pg = document.getElementById('pageSize');
  if (!pg) { pg = document.createElement('style'); pg.id = 'pageSize'; document.head.appendChild(pg); }
  pg.textContent = `@page{size:${size};margin:10mm}`;
  box.innerHTML = `<div class="pd" dir="rtl" style="width:${W}px">${html}</div>`;
  box.className = 'measure';
  const d = box.firstElementChild, fill = d.querySelector('.pd-fill');
  // lines to write on, while there is room (a line is about 30 points)
  if (fill) {
    for (let i = 0; i < 40 && d.scrollHeight < H - 34; i++) fill.insertAdjacentHTML('beforeend', `<li class="pd-ln-i">${khPdBx(false)}<span></span></li>`);
    while (d.scrollHeight > H && fill.children.length > 1) fill.lastElementChild.remove();
  }
  // the months of a year and the weeks of a month: a line is added to every cell, row by row, until the page is full
  const grid = d.querySelector('.pd-year');
  if (grid) {
    const rows = new Set([...grid.children].map((c) => c.offsetTop)).size || 1;
    for (let i = 0; i < 40 && d.scrollHeight + 20 * rows < H - 4; i++) [...grid.children].forEach((c) => c.insertAdjacentHTML('beforeend', '<i class="pd-ln"></i>'));
  }
  // too long: shrunk to fit one page, the width widened by as much so it still fills the page
  let s = 1;
  for (let i = 0; i < 3 && d.scrollHeight * s > H; i++) { s = Math.min(s, (H / d.scrollHeight) * s); d.style.width = `${W / s}px`; d.style.zoom = s; }
  box.className = '';
  toast('اختر «حفظ PDF» أو «حفظ في الملفات» من نافذة الطباعة');
  setTimeout(() => window.print(), 300);
}
// a word before printing: the paper is for the wall, the figures are kept by ticking in the app
function khPrintSheet(level) {
  if (level === 'stats') return khPrint(level);
  ldraft = { kind: 'khpick', id: 'x', isNew: false };
  $('libForm').innerHTML = `${sheetHead('قبل أن تطبع')}
    <p class="note-text">اطبعها وعلّقها على الجدار إن شئت، لكن ارجع إلى هنا أولاً بأول واملأ الخانات؛ لترى إحصائيات منجزاتك آلياً في «إحصائياتي».</p>
    <div class="sheet-actions"><button type="button" class="primary" data-action="kh-print-go" data-v="${level}">${KH_PRINT_IC}<span>طباعة خطة ${KH_PNAME[level]}، أو حفظها PDF</span></button><button type="button" class="ghost" data-action="lib-close">إلغاء</button></div>`;
  showLib();
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action="kh-print"], [data-action="kh-print-go"]');
  if (!el) return;
  if (el.dataset.action === 'kh-print') khPrintSheet(el.dataset.v);
  else { closeLib(); khPrint(el.dataset.v); }
});
