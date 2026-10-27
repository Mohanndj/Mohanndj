'use strict';
// «الدراسة»: the sciences studied, each with ONE approved textbook at a time (a text with its commentary,
// or a book), studied lesson by lesson (lessons by topic, as the user divides them). Other books on the
// subject are enrichment: real books in «الكتب» (they count as reading), shown here under their science.
// Lessons go through stages the user names, then come back for spaced review.

const STUDY_RV = [1, 3, 7, 14, 30, 60, 120];
const STUDY_STAGES = ['قرأت المتن', 'سمعت الشرح', 'لخّصت الدرس'];
const SBOOK_STATUS = { current: 'الكتاب المعتمد', next: 'التالي في السلّم', done: 'أتممته' };
const SBOOK_KIND = { matn: 'متن بشرحه', book: 'كتاب' };
const SHARH_KIND = { recorded: 'شرح مسجّل', written: 'شرح مكتوب' };
const studyUi = { sci: '', selMode: false, sel: new Set(), qq: '', qsort: 'new', qtopic: '' };

const stList = (a, f) => (Array.isArray(a) ? a.filter((x) => x && typeof x === 'object').map(f) : []);
const stDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
function normalizeLesson(l) {
  const done = {};
  for (const [k, v] of Object.entries(l.done && typeof l.done === 'object' ? l.done : {})) if (stDate(v)) done[k] = v;
  return {
    id: l.id || uid(), title: String(l.title || ''), ref: String(l.ref || ''), sharhRef: String(l.sharhRef || ''), done, completedAt: stDate(l.completedAt),
    summary: String(l.summary || ''), note: String(l.note || ''),
    cards: stList(l.cards, (c) => ({ id: c.id || uid(), q: String(c.q || ''), a: String(c.a || '') })).filter((c) => c.q.trim() || c.a.trim()),
    issues: stList(l.issues, (c) => ({ id: c.id || uid(), text: String(c.text || ''), answer: String(c.answer || ''), solved: !!c.solved })).filter((c) => c.text.trim()),
    rvStep: Math.max(0, Number(l.rvStep) || 0), rvDue: stDate(l.rvDue), rvLog: (Array.isArray(l.rvLog) ? l.rvLog : []).filter(stDate),
  };
}
function normalizeSBook(b) {
  const sh = b.sharh && typeof b.sharh === 'object' ? b.sharh : {};
  return {
    id: b.id || uid(), title: String(b.title || ''), author: String(b.author || ''), kind: SBOOK_KIND[b.kind] ? b.kind : 'matn',
    sharh: { title: String(sh.title || ''), by: String(sh.by || ''), kind: SHARH_KIND[sh.kind] ? sh.kind : '', link: String(sh.link || '') },
    status: SBOOK_STATUS[b.status] ? b.status : 'next', started: stDate(b.started), finished: stDate(b.finished), note: String(b.note || ''),
    lessons: stList(b.lessons, normalizeLesson), created: b.created || Date.now(),
  };
}
function normalizeScience(s) {
  const stages = stList(s.stages, (x) => ({ id: x.id || uid(), name: String(x.name || '').trim() })).filter((x) => x.name);
  return {
    id: s.id || uid(), name: String(s.name || ''), emoji: String(s.emoji || ''), note: String(s.note || ''),
    days: Array.isArray(s.days) ? [...new Set(s.days.map(Number).filter((d) => d >= 0 && d <= 6))] : [], per: Math.max(1, Math.min(10, Math.round(Number(s.per) || 1))),
    stages: stages.length ? stages : STUDY_STAGES.map((name) => ({ id: uid(), name })),
    books: stList(s.books, normalizeSBook),
    // quiz.js: the tests of this science, each with its questions and attempts
    quizzes: stList(s.quizzes, normalizeQuiz), created: s.created || Date.now(), updated: s.updated || Date.now(),
    ygoal: String(s.ygoal || ''), // «خطِّط» (v137): the year goal this science is, from the vision down to its days
  };
}
const getSci = (id) => S.study.find((s) => s.id === id);
const sciBook = (s) => s.books.find((b) => b.status === 'current') || null;
const sciEnrich = (s) => S.books.filter((b) => b.studyId === s.id);
// a lesson is done when every stage of its science is ticked
const lessonDone = (s, l) => s.stages.every((x) => l.done[x.id]);
const nextLessons = (s) => { const b = sciBook(s); return b ? b.lessons.filter((l) => !l.completedAt) : []; };
const studyDue = () => S.study.flatMap((s) => s.books.flatMap((b) => b.lessons.filter((l) => l.completedAt && l.rvDue && l.rvDue <= today()).map((l) => ({ s, b, l }))));
// its study days: a science in «خطِّط» studies on the days of the tasks the owner wrote in its line (v141), others on their own
const sciDayName = (s) => (sciGoal(s) ? [...new Set(sciPlanTasks(s).map(khDaysText))].join('، ') : s.days.length === 7 ? 'كل يوم' : WEEK_ORDER.filter((d) => s.days.includes(d)).map((d) => AR_DAYS[d]).join('، '));
const lessonNo = (b, l) => b.lessons.indexOf(l) + 1;

// ---------- a science in «خطِّط» (v137: linked as a project is) ----------
// A science is a year goal of a role's vision (s.ygoal). Its study tasks are the tasks of its days the owner writes in that
// goal's line, ticked by hand as any task of the days (v141, the owner: «مهام الدراسة هي فقط المتسلسلة، لا شيء يدرج هناك
// كمهمة إن لم تكن متسلسلة»): the app makes no task of its own for it, and its study days are those tasks' days. (v137–v140
// made one, t.sciId, done by the lessons: it goes)
const sciGoal = (s) => { const g = s && kgOf(s.ygoal); return g && g.level === 'year' ? g : null; };
const sciOfGoal = (yg) => (yg ? S.study.find((s) => sciGoal(s) && khLineOf(sciGoal(s)).includes(yg)) || null : null);
const sciNeedLink = (s) => { const g = sciGoal(s); return !g || !kgOf(g.parent); };
// the recurring tasks of its goal's days, as the owner wrote them in its line
const sciPlanTasks = (s) => (sciGoal(s) ? khGoalTasks(sciGoal(s)).filter((x) => isRepeat(x) && !x.sciId && !x.bookId) : []);
// a study day: one of its tasks' in «خطِّط» (req: as the totals count it, a goal of «any days» asking its number of the week)
const sciStudyOn = (s, d, req) => (sciGoal(s) ? sciPlanTasks(s).some((t) => (req ? reqOn : occursOn)(t, d)) : s.days.includes(parse(d).getDay()));
// «دراسة العقيدة», «العقيدة», «عقيدة»: the same name, without its vowels, «ال» or a leading «دراسة»
const sciBare = (v) => String(v || '').replace(/[ً-ْـ]/g, '').trim().replace(/^(دراسة|مذاكرة|درس)\s+/, '').split(/\s+/).map((w) => w.replace(/^ال/, '')).join(' ');
// kept true to its line on every redraw: no task of the app's own (one made by v137–v140 is removed), and its
// study days those of its tasks there (v141; a goal of «any days» has none fixed: it shows as its tasks' text)
function syncStudy() {
  let changed = false;
  // (its days «done» were its lessons and reviews, which stay in the science and the report: it goes whole)
  if (S.tasks.some((x) => x.sciId)) { S.tasks = S.tasks.filter((x) => !x.sciId); changed = true; }
  // a task of its line closed by v139 as the science's «written twice» (its days had gone to the app's task), or by v140 as
  // a book's: it goes on, once (one it had none done in was deleted then, and is written anew by the owner)
  if (!S.settings.fix141) {
    S.settings.fix141 = true; changed = true;
    const back = (yg, same) => {
      const ws = new Set(khLineOf(yg).flatMap((y) => kgKids(y, 'month')).flatMap((m) => kgKids(m, 'week')).map((w) => w.id));
      for (const x of S.tasks.filter((x) => ws.has(x.kgoal) && isRepeat(x) && !x.sciId && !x.bookId && ['2026-10-26', '2026-10-27'].includes(x.repeat.until) && same(x.title))) {
        const e = khChainEnd(kgOf(kgOf(x.kgoal).parent));
        x.repeat.until = e && e >= x.repeat.start ? e : null;
      }
    };
    for (const s of S.study.filter(sciGoal)) back(sciGoal(s), (v) => sciBare(v) === sciBare(s.name));
    for (const b of S.books.filter(bookGoal)) back(bookGoal(b), (v) => bookBare(v) === bookBare(b.title));
  }
  for (const s of S.study.filter(sciGoal)) {
    const days = [...new Set(sciPlanTasks(s).filter((t) => !t.repeat.per).flatMap((t) => t.repeat.days))].sort();
    if (String(days) !== String([...s.days].sort())) { s.days = days; changed = true; }
  }
  if (changed) save();
}

// ---------- «اليوم»: the next lessons on a study day, and the reviews due ----------
// (a science in «خطِّط»: on the days of its tasks there, v141)
function studyTodayHTML() {
  const t0 = today(), rows = [];
  for (const s of S.study) {
    const b = sciBook(s);
    if (!b || !sciStudyOn(s, t0)) continue;
    // lessons finished today stay, struck through, until the day ends
    for (const l of b.lessons.filter((x) => x.completedAt === t0)) rows.push(tRow(s.emoji || '📘', `${s.name}: ${l.title}`, `الدرس ${lessonNo(b, l)} من ${b.lessons.length}`, 'study-lesson', `${s.id}|${b.id}|${l.id}`, true));
    for (const l of nextLessons(s).slice(0, Math.max(0, s.per - b.lessons.filter((x) => x.completedAt === t0).length))) {
      const left = s.stages.filter((x) => !l.done[x.id]).map((x) => x.name);
      rows.push(tRow(s.emoji || '📘', `${s.name}: ${l.title}`, `الدرس ${lessonNo(b, l)} من ${b.lessons.length}${left.length < s.stages.length ? ` | باقٍ: ${left.join('، ')}` : ''}`, 'study-lesson', `${s.id}|${b.id}|${l.id}`));
    }
  }
  for (const { s, b, l } of studyDue()) rows.push(tRow('🔁', `راجع: ${l.title}`, `${s.name} | ${b.title}`, 'study-review', `${s.id}|${b.id}|${l.id}`));
  return todayBlock('الدراسة', 'study', tList(rows));
}

// ---------- the page ----------
function sciCard(s) {
  const b = sciBook(s), nx = nextLessons(s), due = studyDue().filter((x) => x.s.id === s.id).length;
  const done = b ? b.lessons.filter((l) => l.completedAt).length : 0, n = b ? b.lessons.length : 0;
  return `<button type="button" class="book-card st-card" data-action="study-open" data-v="${s.id}">
    <span class="book-top"><strong>${esc(s.emoji ? `${s.emoji} ${s.name}` : s.name)}</strong>${b ? `<small>${esc(b.title)}</small>` : ''}</span>
    ${b ? `${n ? `<span class="pbar"><i style="width:${Math.round((done / n) * 100)}%"></i></span>` : ''}
      <span class="book-line">${[n ? `أتممت ${done || 'صفر'} من ${plural(n, 'درس واحد', 'درسين', 'دروس', 'درساً')}` : 'لا دروس بعد', nx[0] ? `الدرس القادم: ${nx[0].title}` : n ? 'أتممت دروسه كلها' : ''].filter(Boolean).map(esc).join(' | ')}</span>`
    : '<span class="book-line">لا كتاب معتمد بعد</span>'}
    ${sciNeedLink(s) ? '<span class="psub kh-need-tag">ناقص: اربطه برؤية</span>' : ''}
    <span class="book-line">${[sciDayName(s) ? `أيام الدراسة: ${sciDayName(s)}` : 'بلا أيام محددة', due ? `للمراجعة اليوم: ${due}` : '', sciEnrich(s).length ? `كتب إثرائية: ${sciEnrich(s).length}` : '', s.quizzes.length ? `الاختبارات: ${s.quizzes.length}` : ''].filter(Boolean).map(esc).join(' | ')}</span>
  </button>`;
}
function lessonRow(s, b, l, next) {
  // choosing lessons to delete together: a tap selects the lesson instead of opening it
  if (studyUi.selMode) {
    const on = studyUi.sel.has(l.id);
    return `<li class="st-lesson${on ? ' sel' : ''}"><button type="button" data-action="study-sel" data-v="${l.id}" aria-pressed="${on}">
      <span class="sel-box" aria-hidden="true">${on ? '✓' : ''}</span><span class="st-no">${lessonNo(b, l)}</span>
      <span class="st-body"><b>${esc(l.title)}</b></span></button></li>`;
  }
  const due = l.completedAt && l.rvDue && l.rvDue <= today();
  return `<li class="st-lesson${l.completedAt ? ' done' : ''}${next ? ' next' : ''}"><button type="button" data-action="study-lesson" data-v="${s.id}|${b.id}|${l.id}">
    <span class="st-no">${lessonNo(b, l)}</span>
    <span class="st-body"><b>${esc(l.title)}</b>${next ? '<small class="st-next">الدرس القادم</small>' : ''}${l.ref || l.sharhRef ? `<small class="st-ref">${esc([l.ref && `من الكتاب: ${l.ref}`, l.sharhRef && `من الشرح: ${l.sharhRef}`].filter(Boolean).join(' | '))}</small>` : ''}
      <span class="st-stages">${s.stages.map((x) => `<small class="${l.done[x.id] ? 'on' : ''}">${l.done[x.id] ? '✓ ' : ''}${esc(x.name)}</small>`).join('')}</span>
      ${due ? '<small class="late">حان وقت مراجعته</small>' : l.completedAt && l.rvDue ? `<small class="st-rv">المراجعة القادمة: ${esc(relDate(l.rvDue))}</small>` : ''}
    </span></button></li>`;
}
function viewStudy() {
  const s = studyUi.sci && getSci(studyUi.sci);
  if (!s) {
    studyUi.sci = '';
    return `${moreCrumb()}
    <section class="section">
      <div class="section-head"><h2>الدراسة</h2>${addBtn('study-sci-new', 'علم')}</div>
      <p class="note-text explain">لكل علم كتاب دراسي معتمد واحد بشرحه المعتمد، تدرسه درساً درساً، ثم تراجع الدروس على فترات. وما سواه في موضوعه كتب إثرائية تُحسب في «الكتب».</p>
      ${studyDue().length ? `<div class="dec-due"><b>للمراجعة اليوم: ${plural(studyDue().length, 'درس واحد', 'درسان', 'دروس', 'درساً')}</b></div>` : ''}
      ${S.study.length ? `<div class="book-list">${S.study.map(sciCard).join('')}</div>`
        : emptyHTML('أضف أول علم تدرسه', 'مثل: الفقه، النحو، أصول الفقه، العقيدة. ثم كتابه المعتمد ودروسه.', addBtn('study-sci-new', 'علم'))}
    </section>`;
  }
  const b = sciBook(s), en = sciEnrich(s);
  const doneN = b ? b.lessons.filter((l) => l.completedAt).length : 0, nx = nextLessons(s);
  const fact = (label, value) => `<div class="st-fact"><small>${esc(label)}</small><b>${esc(value)}</b></div>`;
  const sharh = b && (b.sharh.title || b.sharh.by) ? [b.sharh.title, b.sharh.by].filter(Boolean).join('، ') + (b.sharh.kind ? ` (${SHARH_KIND[b.sharh.kind]})` : '') : '';
  // one way back (to the sciences), the science's settings as labelled facts, then each part in its own section
  return `<div class="crumbs"><button type="button" class="back" data-action="study-back">${icon('back')} ${esc(pageName('study'))}</button></div>
  <section class="section">
    <div class="section-head"><h2>${esc(s.emoji ? `${s.emoji} ${s.name}` : s.name)}</h2><button type="button" class="ghost sm" data-action="study-sci-edit" data-v="${s.id}">${icon('edit')} تعديل العلم</button></div>
    <div class="st-facts">
      ${fact('أيام الدراسة', sciDayName(s) || 'لم تُحدَّد')}
      ${fact('في كل جلسة', plural(s.per, 'درس واحد', 'درسان', 'دروس', 'درساً'))}
    </div>
    <div class="st-fact"><small>مراحل الدرس</small><span class="st-chips">${s.stages.map((x) => `<span>${esc(x.name)}</span>`).join('')}</span></div>
    ${s.note ? `<p class="st-note">${esc(s.note)}</p>` : ''}
    ${sciPlanHTML(s)}
  </section>
  <section class="section st-sec">
    <h2>الكتاب المعتمد</h2>
    ${b ? `<button type="button" class="st-book" data-action="study-book-edit" data-v="${b.id}">
      <span class="st-book-title"><strong>${esc(b.title)}</strong>${b.author ? `<small>${esc(b.author)}</small>` : ''}</span>
      <span class="st-rows">
        <span><small>النوع</small>${esc(SBOOK_KIND[b.kind])}</span>
        ${sharh ? `<span><small>الشرح المعتمد</small>${esc(sharh)}</span>` : ''}
        ${b.started ? `<span><small>بدأته</small>${esc(relDate(b.started))}</span>` : ''}
      </span>
      ${b.lessons.length ? `<span class="st-prog"><span class="pbar"><i style="width:${Math.round((doneN / b.lessons.length) * 100)}%"></i></span>
        <span>${esc(`أتممت ${doneN || 'صفر'} من ${plural(b.lessons.length, 'درس واحد', 'درسين', 'دروس', 'درساً')}`)}</span>
        ${nx[0] ? `<span><small>الدرس القادم:</small> ${esc(nx[0].title)}</span>` : '<span>أتممت دروسه كلها ✓</span>'}</span>` : ''}
    </button>
    ${b.sharh.link ? `<a class="ghost st-link" href="${esc(b.sharh.link)}" target="_blank" rel="noopener">▶ افتح الشرح</a>` : ''}`
    : emptyHTML('لا كتاب معتمد', 'أضف الكتاب الذي تدرسه الآن في هذا العلم، متناً بشرحه أو كتاباً.', addBtn('study-book-new', 'كتاب'))}
  </section>
  ${b ? `<section class="section st-sec">
    <div class="section-head"><h2>الدروس${b.lessons.length ? ` <small>(${b.lessons.length})</small>` : ''}</h2>${studyUi.selMode ? '' : `<div class="btn-row">${b.lessons.length ? '<button type="button" class="ghost sm" data-action="study-sel-mode">☑ تحديد</button>' : ''}<button type="button" class="ghost sm" data-action="study-paste" data-v="${b.id}">ألصق قائمة دروس</button>${addBtn('study-lesson-new', 'درس', ` data-v="${b.id}"`)}</div>`}</div>
    ${b.lessons.length ? `<ol class="st-lessons">${b.lessons.map((l) => lessonRow(s, b, l, nx[0] === l)).join('')}</ol>${studyUi.selMode ? selBar('study', b.lessons.filter((l) => studyUi.sel.has(l.id)).length, b.lessons.length) : ''}` : emptyHTML('لا دروس بعد', 'أضف دروس الكتاب بموضوعاتها، واحداً واحداً أو بلصق قائمتها كاملة (كل سطر درس).')}
  </section>` : ''}
  ${quizSectionHTML(s)}
  <section class="section st-sec">
    <div class="section-head"><h2>كتب إثرائية${en.length ? ` <small>(${en.length})</small>` : ''}</h2>${addBtn('study-enrich-new', 'كتاب إثرائي')}</div>
    ${en.length ? `<div class="book-list">${en.map((x) => `<button type="button" class="book-card s-${x.status}" data-action="lib-open-book" data-v="${x.id}"><span class="book-top"><strong>${esc(x.title)}</strong>${x.author ? `<small>${esc(x.author)}</small>` : ''}</span><span class="book-line">${esc(BOOK_STATUS[x.status])}</span></button>`).join('')}</div>`
      : `<p class="note-text">كتب في موضوع هذا العلم تقرؤها للإثراء. تُضاف إلى «${esc(pageName('books'))}» وتُحسب في قراءتك، وتظهر هنا أيضاً.</p>`}
  </section>`;
}

// its place in «خطِّط» (v137): the year goal it is, or what is missing (a science is a year goal of a role's vision, as a project is)
function sciPlanHTML(s) {
  const g = sciGoal(s);
  if (sciNeedLink(s)) return `<div class="kh-need"><b>ناقص: اربطه برؤية دوره</b><span>العلم هدف لسنتك في تسلسل الدور والرؤية، وجلسات دراسته مهام أيامه في «خطِّط».</span><button type="button" class="primary" data-action="kh-sci-link" data-v="${s.id}">أكمل: من الرؤية إلى الأيام</button></div>`;
  return `<div class="st-facts">
      <div class="st-fact"><small>هدف السنة</small><b>${esc(g.text)}</b></div>
      <div class="st-fact"><small>الدور</small><b>${esc(khRoleName(kgRoleId(g)))}</b></div>
    </div>
    <div class="btn-row">${khContOf(g)}<button type="button" class="ghost sm" data-action="kh-sci-link" data-v="${s.id}">${icon('edit')} هدف السنة</button></div>`;
}
// the year goals it can be: open, its year not ended, not another science's
function sciGoalOptions(s) {
  const gs = S.kgoals.filter((g) => g.level === 'year' && (g.id === s.ygoal || (!kgClosedOf(g) && (khKeySpan(g.period) || [, '9999'])[1] > today() && !S.study.some((x) => x.id !== s.id && x.ygoal === g.id) && !S.books.some((b) => b.ygoal === g.id))));
  return `<option value="">لم يُربط بعد</option>${gs.map((g) => `<option value="${g.id}"${g.id === s.ygoal ? ' selected' : ''}>${esc(g.text)} | ${esc(khRoleName(kgRoleId(g)))} | ${esc(khKeyLabel(g.period))}</option>`).join('')}`;
}

// ---------- the science ----------
function openSci(id) {
  const s = id ? getSci(id) : normalizeScience({});
  ldraft = { kind: 'ssci', id: s.id, isNew: !id, days: s.days.slice(), stages: s.stages.map((x) => ({ ...x })) };
  $('libForm').innerHTML = `${sheetHead(id ? 'العلم' : 'علم جديد')}
    <div class="grid2"><label class="field"><span>اسم العلم</span><input type="text" id="scName" value="${esc(s.name)}" autocomplete="off" placeholder="مثال: الفقه"></label>
      <label class="field"><span>علامة (اختياري)</span><input type="text" id="scEmoji" value="${esc(s.emoji)}" autocomplete="off" placeholder="📘" data-novoice></label></div>
    ${sciGoal(s) ? `<div class="field"><span>أيام الدراسة</span><p class="note-text">${esc(sciDayName(s) || 'لم تُحدَّد بعد')}: من «خطِّط»، أيام مهامه في هدف هذا العلم، وتُعدَّل منها.</p></div>`
      : `<div class="field"><span>أيام الدراسة</span><div class="seg seg-wrap" id="scDays" role="group">${WEEK_ORDER.map((d) => `<button type="button" data-action="study-day" data-v="${d}" aria-pressed="${s.days.includes(d)}">${AR_DAYS[d]}</button>`).join('')}</div></div>`}
    <label class="field"><span>الدروس في الجلسة</span><input type="number" id="scPer" min="1" max="10" inputmode="numeric" value="${s.per}" data-novoice></label>
    <label class="field"><span>هدف السنة في «خطِّط»</span><select id="scGoal">${sciGoalOptions(s)}</select></label>
    <div class="field"><span>مراحل الدرس (يكتمل الدرس حين تُنجز كلها)</span><div id="scStages">${stStageRows()}</div><button type="button" class="ghost sm" data-action="study-stage-add">${icon('plus')} مرحلة</button></div>
    <label class="field"><span>ملاحظة (اختياري)</span><textarea id="scNote" rows="2">${esc(s.note)}</textarea></label>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? '<button type="button" class="danger" data-action="study-sci-del">حذف</button>' : ''}</div>`;
  showLib();
  $('libForm').scrollTop = 0;
}
const stStageRows = () => ldraft.stages.map((x, i) => `<div class="dec-num st-stage"><input type="text" id="scSt-${i}" value="${esc(x.name)}" autocomplete="off"><button type="button" class="fin-del" data-action="study-stage-del" data-i="${i}" aria-label="حذف"${ldraft.stages.length < 2 ? ' disabled' : ''}>✕</button></div>`).join('');
const stReadStages = () => ldraft.stages.forEach((x, i) => { if ($(`scSt-${i}`)) x.name = $(`scSt-${i}`).value; });
function saveSci() {
  const name = $('scName').value.trim();
  if (!name) { toast('اكتب اسم العلم.'); return false; }
  stReadStages();
  const stages = ldraft.stages.filter((x) => x.name.trim());
  if (!stages.length) { toast('اترك مرحلة واحدة على الأقل للدرس.'); return false; }
  const old = getSci(ldraft.id);
  const s = normalizeScience({ ...(old || {}), id: ldraft.id, name, emoji: $('scEmoji').value.trim(), days: ldraft.days, per: $('scPer').value, stages, note: $('scNote').value.trim(), ygoal: $('scGoal').value, updated: Date.now() });
  // a stage added later: lessons already complete stay complete (they were done before it existed)
  if (old) for (const b of s.books) for (const l of b.lessons) if (l.completedAt) for (const x of s.stages) if (!l.done[x.id]) l.done[x.id] = l.completedAt;
  if (old) Object.assign(old, s); else { S.study.push(s); studyUi.sci = s.id; }
  // a stage removed: a lesson whose remaining stages are all ticked is now complete (and gets its reviews)
  if (old) for (const b of old.books) for (const l of b.lessons) stComplete(old, l);
  save();
  // a new science not linked yet: its steps open, from the vision to its days (as a new project's do)
  if (!old && sciNeedLink(s) && !sciGoal(s)) setTimeout(() => khWizard({ step: 0, sci: s.id, yText: s.name }), 0);
  return true;
}

// ---------- a textbook ----------
// (its place in «سلّم العلم» is not chosen here: that section went in v86, and «التالي»/«أتممته» hid the book with no way back)
function openSBook(sciId, bookId) {
  const s = getSci(sciId);
  const b = bookId ? s.books.find((x) => x.id === bookId) : normalizeSBook({ status: sciBook(s) ? 'next' : 'current' });
  ldraft = { kind: 'sbook', id: b.id, sci: sciId, isNew: !bookId, bkind: b.kind, status: b.status, shkind: b.sharh.kind };
  $('libForm').innerHTML = `${sheetHead(bookId ? 'الكتاب الدراسي' : 'كتاب دراسي')}
    <p class="note-text">${esc(s.name)}</p>
    <label class="field"><span>اسم الكتاب</span><input type="text" id="sbTitle" value="${esc(b.title)}" autocomplete="off" placeholder="مثال: الآجرومية"></label>
    <label class="field"><span>المؤلف (اختياري)</span><input type="text" id="sbAuthor" value="${esc(b.author)}" autocomplete="off"></label>
    <div class="field"><span>نوعه</span><div class="seg" id="sbKind" role="group">${Object.entries(SBOOK_KIND).map(([k, v]) => `<button type="button" data-action="study-bkind" data-v="${k}" aria-pressed="${b.kind === k}">${v}</button>`).join('')}</div></div>
    <div class="dec-remind"><b>الشرح المعتمد (اختياري)</b>
      <label class="field"><span>اسم الشرح</span><input type="text" id="sbShTitle" value="${esc(b.sharh.title)}" autocomplete="off" placeholder="مثال: شرح الآجرومية"></label>
      <label class="field"><span>الشارح</span><input type="text" id="sbShBy" value="${esc(b.sharh.by)}" autocomplete="off"></label>
      <div class="seg" id="sbShKind" role="group">${Object.entries(SHARH_KIND).map(([k, v]) => `<button type="button" data-action="study-shkind" data-v="${k}" aria-pressed="${b.sharh.kind === k}">${v}</button>`).join('')}</div>
      <label class="field"><span>رابطه (اختياري)</span><input type="url" id="sbShLink" value="${esc(b.sharh.link)}" autocomplete="off" placeholder="https://" dir="ltr" data-novoice></label>
    </div>
    <label class="field"><span>ملاحظة (اختياري)</span><textarea id="sbNote" rows="2">${esc(b.note)}</textarea></label>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${bookId ? `<button type="button" class="danger" data-action="study-book-del">${b.lessons.length ? `حذف (مع ${plural(b.lessons.length, 'درسه', 'درسيه', 'دروسه', 'درساً')})` : 'حذف'}</button>` : ''}</div>`;
  showLib();
  $('libForm').scrollTop = 0;
}
function saveSBook() {
  const s = getSci(ldraft.sci);
  if (!s) return false;
  const title = $('sbTitle').value.trim();
  if (!title) { toast('اكتب اسم الكتاب.'); return false; }
  const old = s.books.find((x) => x.id === ldraft.id);
  const status = ldraft.status;
  const b = normalizeSBook({ ...(old || {}), id: ldraft.id, title, author: $('sbAuthor').value.trim(), kind: ldraft.bkind, status, note: $('sbNote').value.trim(),
    sharh: { title: $('sbShTitle').value.trim(), by: $('sbShBy').value.trim(), kind: ldraft.shkind, link: $('sbShLink').value.trim() } });
  if (status === 'current' && !b.started) b.started = today();
  if (status === 'done' && !b.finished) b.finished = today();
  if (status !== 'done') b.finished = '';
  // one approved textbook per science: the one that was approved goes back to «التالي»
  let moved = null;
  if (status === 'current') for (const x of s.books) if (x.id !== b.id && x.status === 'current') { x.status = 'next'; moved = x; }
  if (old) Object.assign(old, b); else s.books.push(b);
  s.updated = Date.now();
  save();
  if (moved) setTimeout(() => toast(`صار «${b.title}» المعتمد، و«${moved.title}» التالي في السلّم`), 300);
  return true;
}

// ---------- a lesson ----------
function openLesson(sciId, bookId, lessonId) {
  const s = getSci(sciId), b = s && s.books.find((x) => x.id === bookId);
  if (!b) return;
  const l = lessonId ? b.lessons.find((x) => x.id === lessonId) : normalizeLesson({});
  if (!l) return;
  ldraft = { kind: 'slesson', id: l.id, sci: sciId, book: bookId, isNew: !lessonId, done: { ...l.done }, cards: l.cards.map((c) => ({ ...c })), issues: l.issues.map((c) => ({ ...c })) };
  const n = lessonId ? lessonNo(b, l) : b.lessons.length + 1;
  $('libForm').innerHTML = `${sheetHead(lessonId ? `الدرس ${n}` : 'درس جديد')}
    <p class="note-text">${esc(`${s.name} | ${b.title}`)}</p>
    <label class="field"><span>موضوع الدرس</span><input type="text" id="slTitle" value="${esc(l.title)}" autocomplete="off" placeholder="مثال: باب المياه"></label>
    <div class="grid2"><label class="field"><span>من الكتاب (اختياري)</span><input type="text" id="slRef" value="${esc(l.ref)}" autocomplete="off" placeholder="مثال: ص ١٠–١٤"></label>
      <label class="field"><span>من الشرح (اختياري)</span><input type="text" id="slShRef" value="${esc(l.sharhRef)}" autocomplete="off" placeholder="مثال: المقطع ٣"></label></div>
    <div class="field"><span>المراحل</span><div class="st-checks">${s.stages.map((x) => `<button type="button" class="st-check" data-action="study-stage" data-v="${x.id}" aria-pressed="${!!ldraft.done[x.id]}"><span class="shop-box">${ldraft.done[x.id] ? '✓' : ''}</span>${esc(x.name)}${ldraft.done[x.id] ? ` <small>${esc(relDate(ldraft.done[x.id]))}</small>` : ''}</button>`).join('')}</div></div>
    <label class="field"><span>ملخّص الدرس</span><textarea id="slSummary" rows="4" placeholder="بكلامك">${esc(l.summary)}</textarea></label>
    <div class="field"><span>مسائل للمراجعة (سؤال وجوابه)</span><div id="slCards">${stCardRows()}</div><button type="button" class="ghost sm" data-action="study-card-add">${icon('plus')} مسألة</button></div>
    <div class="field"><span>إشكالات أبحث عنها</span><div id="slIssues">${stIssueRows()}</div><button type="button" class="ghost sm" data-action="study-issue-add">${icon('plus')} إشكال</button></div>
    <label class="field"><span>ملاحظة (اختياري)</span><textarea id="slNote" rows="2">${esc(l.note)}</textarea></label>
    ${lessonId ? `<div class="btn-row"><button type="button" class="ghost sm" data-action="study-move" data-v="-1"${n === 1 ? ' disabled' : ''}>↑ قدّمه</button><button type="button" class="ghost sm" data-action="study-move" data-v="1"${n === b.lessons.length ? ' disabled' : ''}>↓ أخّره</button></div>` : ''}
    ${l.completedAt ? `<p class="note-text">${esc(`أتممته: ${relDate(l.completedAt)}${l.rvLog.length ? ` | راجعته: ${plural(l.rvLog.length, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')}` : ''}${l.rvDue ? ` | المراجعة القادمة: ${relDate(l.rvDue)}` : ''}`)}</p>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${lessonId ? '<button type="button" class="danger" data-action="study-lesson-del">حذف</button>' : ''}</div>`;
  showLib();
  $('libForm').scrollTop = 0;
}
const stCardRows = () => ldraft.cards.map((c, i) => `<div class="dec-risk"><div class="row-between"><input type="text" id="slQ-${i}" value="${esc(c.q)}" autocomplete="off" placeholder="السؤال"><button type="button" class="fin-del" data-action="study-card-del" data-i="${i}" aria-label="حذف">✕</button></div><textarea id="slA-${i}" rows="2" placeholder="الجواب">${esc(c.a)}</textarea></div>`).join('');
const stIssueRows = () => ldraft.issues.map((c, i) => `<div class="dec-risk"><div class="row-between"><input type="text" id="slI-${i}" value="${esc(c.text)}" autocomplete="off" placeholder="ما الذي أشكل عليك؟"><button type="button" class="fin-del" data-action="study-issue-del" data-i="${i}" aria-label="حذف">✕</button></div><input type="text" id="slIA-${i}" value="${esc(c.answer)}" autocomplete="off" placeholder="الجواب إن وجدته"><label class="switch"><input type="checkbox" id="slIS-${i}"${c.solved ? ' checked' : ''}><span>حُلّ الإشكال</span></label></div>`).join('');
// what is typed in the questions and issues is kept before their lists are redrawn
function stReadRows() {
  ldraft.cards.forEach((c, i) => { if ($(`slQ-${i}`)) { c.q = $(`slQ-${i}`).value; c.a = $(`slA-${i}`).value; } });
  ldraft.issues.forEach((c, i) => { if ($(`slI-${i}`)) { c.text = $(`slI-${i}`).value; c.answer = $(`slIA-${i}`).value; c.solved = $(`slIS-${i}`).checked; } });
}
function saveLesson() {
  const s = getSci(ldraft.sci), b = s && s.books.find((x) => x.id === ldraft.book);
  if (!b) return false;
  const title = $('slTitle').value.trim();
  if (!title) { toast('اكتب موضوع الدرس.'); return false; }
  stReadRows();
  const old = b.lessons.find((x) => x.id === ldraft.id);
  const l = normalizeLesson({ ...(old || {}), id: ldraft.id, title, ref: $('slRef').value.trim(), sharhRef: $('slShRef').value.trim(), done: ldraft.done,
    summary: $('slSummary').value.trim(), note: $('slNote').value.trim(), cards: ldraft.cards, issues: ldraft.issues });
  stComplete(s, l);
  if (old) Object.assign(old, l); else b.lessons.push(l);
  s.updated = Date.now();
  save();
  return true;
}
// every stage ticked: the lesson is complete and its first review is the next day; a stage unticked opens it again
function stComplete(s, l) {
  if (lessonDone(s, l)) {
    if (!l.completedAt) { l.completedAt = today(); l.rvStep = 0; l.rvDue = addDays(today(), STUDY_RV[0]); }
  } else if (l.completedAt) { l.completedAt = ''; l.rvDue = ''; l.rvStep = 0; }
}

// ---------- a review ----------
function openStudyReview(sciId, bookId, lessonId) {
  const s = getSci(sciId), b = s && s.books.find((x) => x.id === bookId), l = b && b.lessons.find((x) => x.id === lessonId);
  if (!l) return;
  ldraft = { kind: 'sreview', id: l.id, sci: sciId, book: bookId, isNew: false };
  const open = l.issues.filter((c) => !c.solved);
  $('libForm').innerHTML = `${sheetHead('مراجعة درس')}
    <p class="note-text">${esc(`${s.name} | ${b.title} | الدرس ${lessonNo(b, l)}`)}</p>
    <h3 class="dec-h">${esc(l.title)}</h3>
    ${l.cards.length ? `<p class="note-text">أجب في نفسك، ثم اكشف الجواب.</p><div class="st-cards">${l.cards.map((c) => `<details class="st-qa"><summary>${esc(c.q || '…')}</summary><p>${esc(c.a || 'لا جواب مكتوب')}</p></details>`).join('')}</div>` : '<p class="note-text">لا مسائل مكتوبة لهذا الدرس؛ استحضر أهم ما فيه ثم انظر في ملخّصه.</p>'}
    ${l.summary ? `<details class="st-qa"><summary>ملخّص الدرس</summary><p>${esc(l.summary)}</p></details>` : ''}
    ${open.length ? `<div class="dec-remind"><b>إشكالات لم تُحل بعد</b><ul class="dec-cautions">${open.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul></div>` : ''}
    <div class="sheet-actions"><button type="button" class="primary" data-action="study-rv-ok">راجعته</button><button type="button" class="ghost" data-action="study-rv-hard">صعب عليّ، أعده غداً</button></div>`;
  showLib();
  $('libForm').scrollTop = 0;
}

// ---------- pasting a list of lessons ----------
function openStudyPaste(sciId, bookId) {
  const b = getSci(sciId).books.find((x) => x.id === bookId);
  ldraft = { kind: 'spaste', id: bookId, sci: sciId, isNew: false };
  $('libForm').innerHTML = `${sheetHead('ألصق قائمة الدروس')}
    <p class="note-text">${esc(b.title)}: كل سطر درس بموضوعه، بالترتيب. تُضاف بعد الدروس الموجودة.</p>
    <textarea id="spText" rows="10" placeholder="مقدمة الكتاب&#10;باب المياه&#10;باب الآنية"></textarea>
    <p class="note-text" id="spCount"></p>
    <div class="sheet-actions"><button type="submit" class="primary">أضفها</button></div>`;
  showLib();
  setTimeout(() => $('spText') && $('spText').focus(), 50);
}
// numbering and bullets at the start of a line are not part of the topic
// (a numbering «١.» «2)» «3-» goes; a time, a date or a decimal at the start «10:30» «2026-10-25» «3.5» stays)
const stPasteLines = (t) => t.split('\n').map((x) => x.replace(/^\s*(?:[-•*–]|[0-9٠-٩]+\s*[-.):](?![0-9٠-٩])|\(\s*[0-9٠-٩]+\s*\))\s*/, '').trim()).filter(Boolean);
function saveStudyPaste() {
  const b = getSci(ldraft.sci).books.find((x) => x.id === ldraft.id);
  const lines = stPasteLines($('spText').value);
  if (!lines.length) { toast('الصق الدروس، كل سطر درس.'); return false; }
  b.lessons.push(...lines.map((title) => normalizeLesson({ title })));
  save();
  setTimeout(() => toast(`أُضيف ${plural(lines.length, 'درس واحد', 'درسان', 'دروس', 'درساً')}`), 300);
  return true;
}

// ---------- events ----------
const stIds = (v) => String(v || '').split('|');
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="study-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  const armed = (label) => { if (el.classList.contains('armed')) return true; el.classList.add('armed'); el.textContent = 'متأكد؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = label; } }, 4000); return false; };
  switch (action) {
    case 'study-open': studyUi.sci = v; studyUi.selMode = false; studyUi.sel.clear(); studyUi.qq = ''; studyUi.qtopic = ''; render(); window.scrollTo({ top: 0 }); break;
    case 'study-back': studyUi.sci = ''; studyUi.selMode = false; studyUi.sel.clear(); render(); window.scrollTo({ top: 0 }); break;
    case 'study-sci-new': openSci(null); break;
    // choosing several lessons of the approved book and deleting them together
    case 'study-sel-mode': studyUi.selMode = true; studyUi.sel.clear(); render(); break;
    case 'study-sel-done': studyUi.selMode = false; studyUi.sel.clear(); render(); break;
    case 'study-sel': studyUi.sel.has(v) ? studyUi.sel.delete(v) : studyUi.sel.add(v); render(); break;
    case 'study-sel-all': {
      const b = getSci(studyUi.sci) && sciBook(getSci(studyUi.sci));
      if (!b) break;
      if (b.lessons.every((l) => studyUi.sel.has(l.id))) studyUi.sel.clear(); else b.lessons.forEach((l) => studyUi.sel.add(l.id));
      render(); break;
    }
    case 'study-sel-del': {
      const s = getSci(studyUi.sci), b = s && sciBook(s);
      const n = b ? b.lessons.filter((l) => studyUi.sel.has(l.id)).length : 0;
      if (!n || !selArmed(el)) break;
      b.lessons = b.lessons.filter((l) => !studyUi.sel.has(l.id));
      s.updated = Date.now();
      studyUi.selMode = false; studyUi.sel.clear();
      save(); render(); toast(`حُذف ${plural(n, 'درس واحد', 'درسان', 'دروس', 'درساً')}`);
      break;
    }
    case 'study-sci-edit': openSci(v); break;
    case 'study-day': { const d = Number(v); ldraft.days = ldraft.days.includes(d) ? ldraft.days.filter((x) => x !== d) : [...ldraft.days, d]; el.setAttribute('aria-pressed', String(ldraft.days.includes(d))); break; }
    case 'study-stage-add': stReadStages(); ldraft.stages.push({ id: uid(), name: '' }); $('scStages').innerHTML = stStageRows(); $(`scSt-${ldraft.stages.length - 1}`).focus(); break;
    case 'study-stage-del': stReadStages(); if (ldraft.stages.length > 1) ldraft.stages.splice(+el.dataset.i, 1); $('scStages').innerHTML = stStageRows(); break;
    // deleting a science: its textbooks and lessons go with it; its enrichment books stay in «الكتب»
    case 'study-sci-del': {
      if (!armed('حذف')) break;
      const id = ldraft.id;
      S.study = S.study.filter((s) => s.id !== id);
      for (const b of S.books) if (b.studyId === id) b.studyId = '';
      studyUi.sci = ''; save(); closeLib(); render(); toast('حُذف العلم، وبقيت كتبه الإثرائية في الكتب');
      break;
    }
    case 'study-book-new': openSBook(studyUi.sci, null); break;
    case 'study-book-edit': openSBook(studyUi.sci, v); break;
    case 'study-bkind': ldraft.bkind = v; for (const b of $('sbKind').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'study-shkind': ldraft.shkind = ldraft.shkind === v ? '' : v; for (const b of $('sbShKind').children) b.setAttribute('aria-pressed', String(b.dataset.v === ldraft.shkind)); break;
    case 'study-bstatus': ldraft.status = v; for (const b of $('sbStatus').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'study-book-del': {
      if (!armed('حذف')) break;
      const s = getSci(ldraft.sci);
      s.books = s.books.filter((b) => b.id !== ldraft.id);
      save(); closeLib(); render(); toast('حُذف الكتاب');
      break;
    }
    case 'study-lesson-new': openLesson(studyUi.sci, v, null); break;
    case 'study-lesson': { const [s, b, l] = stIds(v); openLesson(s, b, l); break; }
    case 'study-review': { const [s, b, l] = stIds(v); openStudyReview(s, b, l); break; }
    case 'study-paste': openStudyPaste(studyUi.sci, v); break;
    case 'study-stage': {
      ldraft.done[v] ? delete ldraft.done[v] : (ldraft.done[v] = today());
      el.setAttribute('aria-pressed', String(!!ldraft.done[v]));
      el.querySelector('.shop-box').textContent = ldraft.done[v] ? '✓' : '';
      break;
    }
    case 'study-card-add': stReadRows(); ldraft.cards.push({ id: uid(), q: '', a: '' }); $('slCards').innerHTML = stCardRows(); $(`slQ-${ldraft.cards.length - 1}`).focus(); break;
    case 'study-card-del': stReadRows(); ldraft.cards.splice(+el.dataset.i, 1); $('slCards').innerHTML = stCardRows(); break;
    case 'study-issue-add': stReadRows(); ldraft.issues.push({ id: uid(), text: '', answer: '', solved: false }); $('slIssues').innerHTML = stIssueRows(); $(`slI-${ldraft.issues.length - 1}`).focus(); break;
    case 'study-issue-del': stReadRows(); ldraft.issues.splice(+el.dataset.i, 1); $('slIssues').innerHTML = stIssueRows(); break;
    // moving a lesson keeps what is being edited: it is saved first
    case 'study-move': {
      const { sci, book, id } = ldraft;
      if (!saveLesson()) break;
      const b = getSci(sci).books.find((x) => x.id === book);
      const i = b.lessons.findIndex((x) => x.id === id), j = i + Number(v);
      if (j < 0 || j >= b.lessons.length) break;
      [b.lessons[i], b.lessons[j]] = [b.lessons[j], b.lessons[i]];
      save(); render(); openLesson(sci, book, id);
      break;
    }
    case 'study-lesson-del': {
      if (!armed('حذف')) break;
      const b = getSci(ldraft.sci).books.find((x) => x.id === ldraft.book);
      b.lessons = b.lessons.filter((l) => l.id !== ldraft.id);
      save(); closeLib(); render(); toast('حُذف الدرس');
      break;
    }
    case 'study-rv-ok': case 'study-rv-hard': {
      const b = getSci(ldraft.sci).books.find((x) => x.id === ldraft.book), l = b.lessons.find((x) => x.id === ldraft.id);
      l.rvLog.push(today());
      l.rvStep = action === 'study-rv-ok' ? Math.min(l.rvStep + 1, STUDY_RV.length - 1) : 0;
      l.rvDue = addDays(today(), action === 'study-rv-ok' ? STUDY_RV[l.rvStep] : 1);
      save(); closeLib(); render(); toast(`المراجعة القادمة ${relDate(l.rvDue)}`);
      break;
    }
    // an enrichment book is an ordinary book of «الكتب», tied to this science
    case 'study-enrich-new': openLib('book', null, { studyId: studyUi.sci, status: 'want' }); break;
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'spText') { const n = stPasteLines(e.target.value).length; $('spCount').textContent = n ? `سيُضاف ${plural(n, 'درس واحد', 'درسان', 'دروس', 'درساً')}` : ''; }
});

Object.assign(LibraryViews, { study: viewStudy });
