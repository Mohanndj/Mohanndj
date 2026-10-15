'use strict';
// Reading, organised:
// 1) A book being read can have reading days in the week and pages per session. It then appears as a
//    recurring goal «اقرأ «الكتاب»» on «اليوم», on those days only (task.bookId ties them). Ticking it
//    moves the book's page on by those pages; the book finished, the goal ends.
// 2) Books (to read or read) can have a topic. Turning a topic on makes it a reading project
//    («مشروع قرائي: الموضوع», project.topic) whose tasks are its books, done when the book is read,
//    and ticking a task there marks the book read.

const bookTopics = () => [...new Set(S.books.map((b) => b.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
const topicProject = (topic) => S.projects.find((p) => p.topic === topic);
const activeBookGoal = (b) => S.tasks.find((t) => t.bookId === b.id && isRepeat(t) && !goalEnded(t));
const pagesWord = (n) => plural(n, 'صفحة واحدة', 'صفحتين', 'صفحات', 'صفحة');
const scheduleLine = (b) => (b.rdays.length && b.rpages ? `${pagesWord(b.rpages)} · ${WEEK_ORDER.filter((d) => b.rdays.includes(d)).map((d) => AR_DAYS[d]).join('، ')}` : '');

let readingChanged = false;
function endGoal(g) {
  if (Object.keys(g.completions).length) g.repeat.until = addDays(today(), -1);
  else S.tasks = S.tasks.filter((t) => t !== g);
  readingChanged = true;
}
function syncBookGoal(b) {
  const g = activeBookGoal(b);
  const want = b.status === 'reading' && b.rdays.length && b.rpages > 0;
  const title = `اقرأ ${pagesWord(b.rpages)} من «${b.title}»`;
  if (!want) { if (g) endGoal(g); return; }
  if (!g) {
    S.tasks.push(normalize({ kind: 'goal', title, category: 'قراءة', repeat: { days: [...b.rdays].sort(), start: today(), until: null }, target: b.rpages, unit: 'صفحة', bookId: b.id, created: Date.now() }));
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
  for (const b of books) {
    const title = `اقرأ «${b.title}»`;
    const read = b.status === 'read';
    const t = S.tasks.find((x) => x.projectId === p.id && x.bookId === b.id && !isRepeat(x));
    if (!t) { S.tasks.push(normalize({ kind: 'task', title, projectId: p.id, bookId: b.id, category: 'قراءة', done: read, doneAt: read ? Date.now() : null, created: Date.now() })); readingChanged = true; }
    else if (t.title !== title || t.done !== read) { t.title = title; t.done = read; t.doneAt = read ? t.doneAt || Date.now() : null; readingChanged = true; }
  }
  const n = S.tasks.length;
  S.tasks = S.tasks.filter((x) => !(x.projectId === p.id && x.bookId && !isRepeat(x) && !books.some((b) => b.id === x.bookId)));
  if (S.tasks.length !== n) readingChanged = true;
}
// keep goals and reading projects in step with the books; saves only when something changed
function syncReading() {
  readingChanged = false;
  for (const b of S.books) syncBookGoal(b);
  for (const g of S.tasks.filter((t) => t.bookId && isRepeat(t) && !goalEnded(t) && !getBook(t.bookId))) endGoal(g);
  for (const p of S.projects.filter((x) => x.topic)) syncTopicProject(p);
  if (readingChanged) save();
}

// the page moves with the goal: ticking today's reading adds its pages, unticking takes them back
function bookAdvance(b, delta) {
  let page = Math.max(0, (b.page || 0) + delta);
  if (b.pages) page = Math.min(b.pages, page);
  b.page = page;
  const t0 = today(), i = b.log.findIndex((e) => e.d === t0);
  if (i >= 0) b.log[i].p = page; else b.log.push({ d: t0, p: page });
  if (b.pages && page >= b.pages && b.status === 'reading') { b.status = 'read'; b.end = b.end || t0; setTimeout(() => toast(`أحسنت! أنهيت «${b.title}»`), 300); }
}
// called by toggle() for a task tied to a book
function readingFromTask(t, d) {
  const b = getBook(t.bookId);
  if (!b) return;
  if (isRepeat(t)) { if (d === today()) bookAdvance(b, t.completions[d] ? t.target : -t.target); }
  else if (t.done && b.status !== 'read') { b.status = 'read'; b.end = b.end || today(); }
  else if (!t.done && b.status === 'read') { b.status = 'reading'; b.end = ''; }
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
    <div class="row-between"><b>موضوع «${esc(topic)}»</b><small>${read} من ${books.length} مقروء</small></div>
    <div class="progress-line"><i style="width:${books.length ? Math.round((read / books.length) * 100) : 0}%"></i></div>
    ${p ? `<p class="note-text">📚 صار مشروعاً قرائياً: كل كتاب فيه مهمة، تُنجز حين تقرؤه.</p>
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
      <p class="note-text">اختر أيامه وعدد الصفحات، فيظهر هدفاً في «اليوم» في هذه الأيام فقط ما دام «أقرؤه الآن»، وكل مرة تُنجزه تتقدم صفحتك.</p>
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
    syncTopicProject(p);
    save(); render();
    toast(`صار «${v}» مشروعاً قرائياً في «المشاريع والمهام»`);
    return;
  }
  if (action === 'rd-topic-off') {
    if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'تأكيد الإيقاف'; return; }
    const p = topicProject(v);
    if (p) { S.tasks = S.tasks.filter((t) => t.projectId !== p.id); S.projects = S.projects.filter((x) => x !== p); }
    save(); render();
    toast('أُوقف المشروع القرائي. الكتب باقية كما هي');
  }
});
