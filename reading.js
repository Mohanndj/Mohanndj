'use strict';
// Reading, organised:
// 1) A book being read can have reading days in the week and pages per session (the plan). Ticking a
//    session asks how far you really read, and only that moves the book's page; finished, its reading stops.
// 2) Books (to read or read) can have a topic. Turning a topic on makes it a reading project
//    («مشروع قرائي: الموضوع», project.topic) whose tasks are its books, done when the book is read.
// A book shows in ONE place only: in its project's task if its topic is a project (the task then
// carries the reading days: it is due on the next reading day, and ticking it there is today's
// session), otherwise as a recurring goal on «اليوم» (task.bookId ties them).

const bookTopics = () => [...new Set(S.books.map((b) => b.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
const topicProject = (topic) => S.projects.find((p) => p.topic === topic);
const activeBookGoal = (b) => S.tasks.find((t) => t.bookId === b.id && isRepeat(t) && !t.repeat.until);
// read today from any of the book's tasks (its goal or its project task)
const readToday = (b) => S.tasks.some((x) => x.bookId === b.id && x.completions && x.completions[today()]);
const pagesWord = (n) => plural(n, 'صفحة واحدة', 'صفحتين', 'صفحات', 'صفحة');
const scheduled = (b) => b.status === 'reading' && b.rdays.length > 0 && b.rpages > 0;
const inReadingProject = (b) => !!(b.topic && topicProject(b.topic));
// the next reading day from today (today itself if its session is not done yet)
function nextReadingDay(b, t) {
  // a session moved to another day («للغد») is due that day, until it is read or the day has passed
  if (t && t.readOn && t.readOn >= today() && !t.completions[t.readOn]) return t.readOn;
  for (let i = 0; i < 8; i++) { const d = addDays(today(), i); if (b.rdays.includes(parse(d).getDay()) && !(t && t.completions[d]) && !(i === 0 && readToday(b))) return d; }
  return '';
}
const scheduleLine = (b) => (b.rdays.length && b.rpages ? `${pagesWord(b.rpages)} | ${WEEK_ORDER.filter((d) => b.rdays.includes(d)).map((d) => AR_DAYS[d]).join('، ')}` : '');

let readingChanged = false;
// a goal read today stays until the end of today (still shown ticked, and its session counted)
function endGoal(g) {
  if (Object.keys(g.completions).length) g.repeat.until = g.completions[today()] ? today() : addDays(today(), -1);
  else S.tasks = S.tasks.filter((t) => t !== g);
  readingChanged = true;
}
function syncBookGoal(b) {
  const g = activeBookGoal(b);
  const want = scheduled(b) && !inReadingProject(b);
  const title = `اقرأ ${pagesWord(b.rpages)} من «${b.title}»`;
  if (!want) { if (g) endGoal(g); return; }
  if (!g) {
    // the book's goal ended today or yesterday (finished then unticked, or moved and back): it continues
    const recent = S.tasks.find((t) => t.bookId === b.id && isRepeat(t) && t.repeat.until && t.repeat.until >= addDays(today(), -1));
    if (recent) { recent.repeat.until = null; readingChanged = true; return; }
    const ng = normalize({ kind: 'goal', title, category: 'قراءة', repeat: { days: [...b.rdays].sort(), start: today(), until: null }, target: b.rpages, unit: 'صفحة', bookId: b.id, created: Date.now() });
    // already read today in its project (the book just left it): today's session shows done here too
    // with the pages that session read, so undoing it here takes back those pages (not the planned ones)
    const was = readToday(b) && S.tasks.find((x) => x.bookId === b.id && x.completions && x.completions[today()]);
    if (was) { ng.completions[today()] = Date.now(); if (Number.isFinite((was.readPages || {})[today()])) ng.readPages[today()] = was.readPages[today()]; }
    S.tasks.push(ng);
    readingChanged = true;
    return;
  }
  const days = [...b.rdays].sort();
  if (g.title !== title || g.target !== b.rpages || g.repeat.days.join() !== days.join() || g.unit !== 'صفحة') {
    Object.assign(g, { title, target: b.rpages, unit: 'صفحة' });
    g.repeat.days = days;
    readingChanged = true;
  }
}
function syncTopicProject(p) {
  const books = S.books.filter((b) => b.topic === p.topic);
  // a book read in the past is done on the day it was finished, not on the day the project was made
  const readAt = (b) => (!b.end ? null : b.end === today() ? Date.now() : parse(b.end).getTime() + 12 * 3600000);
  for (const b of books) {
    const sch = scheduled(b);
    const title = sch ? `اقرأ ${pagesWord(b.rpages)} من «${b.title}»` : `اقرأ «${b.title}»`;
    const read = b.status === 'read';
    let t = S.tasks.find((x) => x.projectId === p.id && x.bookId === b.id && !isRepeat(x));
    if (!t) { t = normalize({ kind: 'task', title, projectId: p.id, bookId: b.id, category: 'قراءة', done: read, doneAt: read ? readAt(b) : null, created: Date.now() }); S.tasks.push(t); readingChanged = true; }
    // a scheduled book: the task is due on its next reading day, so «اليوم» shows it on those days only
    const due = sch && !read ? nextReadingDay(b, t) : '';
    if (t.title !== title || t.done !== read || t.due !== due) { t.title = title; t.done = read; t.doneAt = read ? t.doneAt || readAt(b) : null; t.due = due; readingChanged = true; }
  }
  const n = S.tasks.length;
  S.tasks = S.tasks.filter((x) => !(x.projectId === p.id && x.bookId && !isRepeat(x) && !books.some((b) => b.id === x.bookId)));
  if (S.tasks.length !== n) readingChanged = true;
}
// keep goals and reading projects in step with the books; saves only when something changed
function syncReading() {
  readingChanged = false;
  for (const b of S.books) syncBookGoal(b);
  for (const g of S.tasks.filter((t) => t.bookId && isRepeat(t) && !t.repeat.until && !getBook(t.bookId))) endGoal(g);
  for (const p of S.projects.filter((x) => x.topic)) syncTopicProject(p);
  // a book's reading task left outside its reading project (the project deleted, or the topic
  // changed) is a duplicate: the book already shows as its goal or in its current project
  const n = S.tasks.length;
  S.tasks = S.tasks.filter((t) => {
    if (!t.bookId || isRepeat(t) || t.done) return true;
    const p = t.projectId && S.projects.find((x) => x.id === t.projectId);
    const b = getBook(t.bookId);
    return !!(p && p.topic && b && b.topic === p.topic);
  });
  if (S.tasks.length !== n) readingChanged = true;
  if (readingChanged) save();
}

// the page moves by the pages actually read (written after the session), never by the planned pages.
// A past day's reading is recorded on that day: its log entry gets the pages, and later entries move on.
function bookAdvance(b, delta, day) {
  const t0 = today(), d = day || t0;
  if (!delta) return;
  if (d !== t0) return bookAdvancePast(b, delta, d);
  const i = b.log.findIndex((e) => e.d === t0);
  let page = Math.max(0, (b.page || 0) + delta);
  if (b.pages) page = Math.min(b.pages, page);
  // going back goes no further than where today started
  if (delta < 0 && i >= 0 && Number.isFinite(b.log[i].from)) page = Math.max(page, b.log[i].from);
  const before = b.page || 0;
  b.page = page;
  // a session that finished the book today, taken back: the book is being read again
  if (delta < 0 && b.status === 'read' && b.end === t0 && (!b.pages || page < b.pages)) { b.status = 'reading'; b.end = ''; }
  // today's entry keeps the page the day started from, so the report counts what was read today
  if (i >= 0) {
    if (!Number.isFinite(b.log[i].from) && !b.log.some((e) => e.d < t0)) b.log[i].from = before;
    b.log[i].p = page;
  } else b.log.push({ d: t0, p: page, from: before });
  if (b.pages && page >= b.pages && b.status === 'reading') { b.status = 'read'; b.end = b.end || t0; setTimeout(() => toast(`أحسنت! أنهيت «${b.title}»`), 300); }
}
function bookAdvancePast(b, delta, d) {
  let page = Math.max(0, (b.page || 0) + delta);
  if (b.pages) page = Math.min(b.pages, page);
  const real = page - (b.page || 0);
  if (!real) return;
  b.log.sort((x, y) => x.d.localeCompare(y.d));
  let e = b.log.find((x) => x.d === d);
  if (!e) {
    const prev = b.log.filter((x) => x.d < d).pop(), next = b.log.find((x) => x.d > d);
    const base = prev ? prev.p : next ? (Number.isFinite(next.from) ? next.from : next.p) : b.page || 0;
    e = { d, p: base, from: base };
    b.log.push(e);
    b.log.sort((x, y) => x.d.localeCompare(y.d));
  }
  e.p = Math.max(Number.isFinite(e.from) ? e.from : 0, e.p + real);
  for (const x of b.log) if (x.d > d) { x.p += real; if (Number.isFinite(x.from)) x.from += real; }
  b.page = page;
  if (b.pages && page >= b.pages && b.status === 'reading') { b.status = 'read'; b.end = b.end || b.log[b.log.length - 1].d; setTimeout(() => toast(`أحسنت! أنهيت «${b.title}»`), 300); }
  else if (b.status === 'read' && b.pages && page < b.pages && b.end && b.end >= d) { b.status = 'reading'; b.end = ''; }
}
// pages a session added; sessions before v64 moved the page by the plan when ticked (the goal's only today)
function sessionPages(b, t, d) {
  t.readPages = t.readPages || {};
  if (Number.isFinite(t.readPages[d])) return { n: t.readPages[d], day: d };
  return { n: isRepeat(t) ? (d === today() ? t.target : 0) : b.rpages, day: today() };
}
// a session taken back takes back the pages it added
function undoSession(b, t, d) {
  const { n, day } = sessionPages(b, t, d);
  if (n) bookAdvance(b, -n, day);
  delete t.readPages[d];
}
function startSession(b, t, d) {
  t.readPages = t.readPages || {};
  t.readPages[d] = 0;
  askReadingNote(b, t, d);
}
// called by toggle() first: a scheduled book's project task ticks the day's session, not the whole book
function readingSession(t, d) {
  const b = getBook(t.bookId);
  // a session is never in the future: the task lists pass its due date (the next reading day), read today
  const day = d && d < today() ? d : today();
  // (a session that just finished the book can still be unticked)
  if (!b || isRepeat(t) || !t.projectId || !(scheduled(b) || t.completions[day])) return false;
  if (t.completions[day]) { delete t.completions[day]; undoSession(b, t, day); }
  else { t.completions[day] = Date.now(); startSession(b, t, day); }
  syncReading();
  return true;
}
// after a reading session, one sheet: the pages actually read (they move the book), how long it took,
// and the idea of the day; each optional. The planned pages are a hope, not what was read.
function askReadingNote(b, t, day) {
  setTimeout(() => {
    if (lsheet().open) return;
    const d = day || today();
    const past = d !== today();
    const askTime = !!t && S.settings.askTime !== false && !sessionsOf(t.id).some((x) => sessionDay(x) === d);
    ldraft = { kind: 'readnote', id: uid(), isNew: true, bookId: b.id, taskId: t ? t.id : '', d, askTime, past };
    const where = `كنت في صفحة ${b.page || 0}${b.pages ? ` من ${b.pages}` : ''}`;
    $('libForm').innerHTML = `${sheetHead('جلسة القراءة')}
      <p class="note-text">«${esc(b.title)}»${past ? ` | ${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}` : ''}</p>
      ${past ? `<label class="field"><span>كم صفحة قرأت في ذلك اليوم؟</span><input type="text" inputmode="numeric" id="rnRead" class="num-in" placeholder="مثل: ١٥" data-novoice autocomplete="off"><small class="hint">${where} الآن.</small></label>`
        : `<label class="field"><span>إلى أي صفحة وصلت؟</span><input type="text" inputmode="numeric" id="rnPage" class="num-in" placeholder="${esc(digitsOut(where))}" data-novoice autocomplete="off"><small class="hint">${where}</small></label>`}
      ${askTime ? `<div class="field"><span>كم استغرقت؟</span>
        <div class="chips wrap dur-chips">${[5, 10, 15, 20, 30, 45, 60, 90].map((m) => `<button type="button" class="chip" data-action="dur-pick" data-v="${m}">${m < 60 ? `${m} د` : m === 60 ? 'ساعة' : 'ساعة ونصف'}</button>`).join('')}</div>
        <input type="text" inputmode="numeric" id="durMin" class="num-in" placeholder="أو اكتب الدقائق، مثل: ٢٥" data-novoice autocomplete="off"></div>` : ''}
      <label class="field"><span>ما أهم فكرة اليوم؟</span><textarea id="rnText" rows="4" placeholder="فكرة أو فائدة أو سؤال خرجت به"></textarea></label>
      <div class="sheet-actions"><button type="submit" class="primary">احفظ</button><button type="button" class="ghost" data-action="lib-close">تخطَّ</button></div>`;
    showLib();
    setTimeout(() => { const x = $(past ? 'rnRead' : 'rnPage'); if (x) x.focus(); }, 60);
  }, 250);
}
function saveReadNote() {
  const b = getBook(ldraft.bookId);
  const t = getTask(ldraft.taskId);
  const d = ldraft.d;
  const said = [];
  // the pages actually read: «إلى أي صفحة وصلت؟» today, or «كم صفحة قرأت؟» for a past day
  if (b && t && t.completions[d]) {
    let n = 0;
    // only the number typed counts («ص ١٦٠» = 160); an entry with no number changes nothing (it was read as page 0)
    const digits = (id) => ($(id).value.match(/[0-9٠-٩۰-۹]+/) || [''])[0];
    if (ldraft.past) n = Math.max(0, Math.round(num(digits('rnRead')) || 0));
    else { const v = digits('rnPage'); if (v) n = Math.round(num(v)) - (b.page || 0); }
    if (n) {
      const before = b.page || 0;
      bookAdvance(b, n, d);
      const real = (b.page || 0) - before;
      t.readPages = t.readPages || {};
      t.readPages[d] = (t.readPages[d] || 0) + real;
      if (real) said.push(`${real > 0 ? `قرأت ${pagesWord(real)}` : `رجعت ${pagesWord(-real)}`} | وصلت صفحة ${b.page}${b.pages ? ` من ${b.pages}` : ''}`);
    }
  }
  // the time, recorded like the timer's (a session of the book's task, counted in the stats and reports)
  const m = ldraft.askTime && $('durMin') ? Math.round(num($('durMin').value)) : 0;
  if (m > 0 && ldraft.taskId) {
    // on the session's own day (a past day ticked in the calendar is recorded on that day)
    const end = d === today() ? Date.now() : parse(d).getTime() + 12 * 3600000;
    S.sessions.push({ id: uid(), taskId: ldraft.taskId, start: end - m * 60000, end, ms: m * 60000, mode: 'manual' });
    said.push(`سُجّل ${fmtDur(m * 60000)}`);
  }
  const text = $('rnText').value.trim();
  if (text) {
    const first = text.split(/\n|[.؟!]/)[0].trim();
    S.benefits.push(normalizeBenefit({ bookId: b ? b.id : '', book: b ? b.title : '', page: b ? b.page || '' : '', title: excerpt(first, 60), text }));
    said.push(`حُفظت الفكرة في فوائد «${b ? b.title : 'الكتاب'}»`);
  }
  syncReading();
  save();
  if (said.length) toast(said.join(' | '));
  return true;
}
// a finished book's end date, kept for the day its task is unticked: ticking it again (a mistake undone)
// gives the book its own date back, not today's (it was then counted in this year's reading goal)
const readEndUndo = {};
// called by toggle() for a task tied to a book
function readingFromTask(t, d) {
  const b = getBook(t.bookId);
  if (!b) return;
  if (isRepeat(t)) {
    // the session is ticked; the sheet then asks how many pages were really read (on its own day)
    if (t.completions[d]) startSession(b, t, d);
    else undoSession(b, t, d);
  }
  else if (t.done && b.status !== 'read') { b.status = 'read'; const u = readEndUndo[b.id]; b.end = b.end || (u && u.on === today() ? u.end : today()); delete readEndUndo[b.id]; }
  else if (!t.done && b.status === 'read') { readEndUndo[b.id] = { end: b.end, on: today() }; b.status = 'reading'; b.end = ''; }
}

// the books page: topics as buttons, and the selected topic's reading project
function topicBarHTML() {
  const topics = bookTopics();
  if (!topics.length) return '';
  const cur = libUi.bookTopic;
  return `<div class="chips topic-chips" role="group" aria-label="الموضوعات"><button type="button" class="chip" data-action="rd-topic" data-v="" aria-pressed="${!cur}">كل الموضوعات</button>${topics.map((t) => `<button type="button" class="chip" data-action="rd-topic" data-v="${esc(t)}" aria-pressed="${cur === t}">${topicProject(t) ? '📚 ' : ''}${esc(t)} <span class="num">${S.books.filter((b) => b.topic === t).length}</span></button>`).join('')}</div>`;
}
function topicCardHTML(topic) {
  const books = S.books.filter((b) => b.topic === topic);
  const read = books.filter((b) => b.status === 'read').length;
  const p = topicProject(topic);
  return `<div class="panel topic-card">
    <div class="row-between"><b>${p ? esc(p.name) : `موضوع «${esc(topic)}»`}</b><small>${read} من ${books.length} مقروء</small></div>
    <div class="progress-line"><i style="width:${books.length ? Math.round((read / books.length) * 100) : 0}%"></i></div>
    ${p ? `<p class="note-text">📚 مشروع قرائي ✓</p>
      <div class="btn-row"><button type="button" class="primary" data-action="open-project" data-v="${p.id}">افتح المشروع</button><button type="button" class="ghost" data-action="rd-topic-off" data-v="${esc(topic)}">أوقف المشروع</button></div>`
    : `<button type="button" class="ghost" data-action="rd-topic-on" data-v="${esc(topic)}">${icon('folder')} اجعله مشروعاً قرائياً</button>`}
  </div>`;
}
// the book editor: topic and reading days
function bookReadingFieldsHTML(b) {
  ldraft.rdays = [...b.rdays];
  return `<label class="field"><span>الموضوع (اختياري)</span><input type="text" id="lTopic" value="${esc(b.topic)}" list="bookTopicList" autocomplete="off" placeholder="مثل: سيرة، فقه، إدارة"><datalist id="bookTopicList">${bookTopics().map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
    <div class="brv-box">
      <b>📅 أيام القراءة</b>
      <p class="note-text explain">اختر أيامه وعدد الصفحات، فيظهر هدفاً في «اليوم» في هذه الأيام فقط ما دام «أقرؤه الآن»، وكل مرة تُنجزه تتقدم صفحتك.</p>
      <div class="chips" role="group" aria-label="أيام القراءة">${WEEK_ORDER.map((d) => `<button type="button" class="chip" data-action="rd-day" data-v="${d}" aria-pressed="${b.rdays.includes(d)}">${AR_DAYS[d]}</button>`).join('')}</div>
      <label class="field"><span>الصفحات في كل مرة</span><input type="number" id="lRpages" min="1" inputmode="numeric" value="${b.rpages || ''}" placeholder="مثال: 20"></label>
    </div>`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="rd-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'rd-day') {
    const d = Number(v);
    ldraft.rdays = ldraft.rdays.includes(d) ? ldraft.rdays.filter((x) => x !== d) : [...ldraft.rdays, d];
    el.setAttribute('aria-pressed', String(ldraft.rdays.includes(d)));
    return;
  }
  if (action === 'rd-topic') { libUi.bookTopic = v; render(); return; }
  if (action === 'rd-topic-on') {
    if (topicProject(v)) return;
    const p = normalizeProject({ name: `مشروع قرائي: ${v}`, color: PROJECT_COLORS[5][0], desc: `كتب موضوع «${v}»`, topic: v });
    S.projects.push(p);
    syncReading();
    save(); render();
    toast(`صار «${v}» مشروعاً قرائياً في «المشاريع والمهام»`);
    return;
  }
  if (action === 'rd-topic-off') {
    if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'تأكيد الإيقاف'; return; }
    const p = topicProject(v);
    if (p) { S.tasks = S.tasks.filter((t) => t.projectId !== p.id); S.projects = S.projects.filter((x) => x !== p); }
    syncReading(); save(); render();
    toast('أُوقف المشروع القرائي. الكتب باقية كما هي');
  }
});
