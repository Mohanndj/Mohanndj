'use strict';
// Notes, books, benefits (فوائد), the «المزيد» page and Excel export.
// Loaded before app.js; uses its helpers at call time.

const BOOK_STATUS = { reading: 'أقرؤه الآن', read: 'مقروء', want: 'أريد قراءته', stalled: 'متعثر' };
const BOOK_STATUS_PLURAL = { reading: 'أقرؤها الآن', read: 'المقروءة', want: 'أريد قراءتها', stalled: 'المتعثرة' };
const BOOK_ORDER = ['reading', 'read', 'want', 'stalled'];
const libUi = { memoQ: '', bookStatus: 'reading', bookQ: '', benefitBook: '', benefitQ: '', bookTopic: '', benRead: false };

function normalizeMemo(m) {
  // older notes were plain text; they become HTML for the formatted editor
  const html = typeof m.html === 'string' ? m.html : plainToNoteHTML(m.body || '');
  return {
    id: m.id || uid(), title: String(m.title || ''), html, body: typeof m.html === 'string' ? String(m.body || noteText(html)) : String(m.body || ''),
    pinned: !!m.pinned, created: m.created || Date.now(), updated: m.updated || m.created || Date.now(),
    audios: Array.isArray(m.audios) ? m.audios.filter((a) => a && a.mediaId) : [],
  };
}
// before v70, a book added as «مقروء» from the «أقرؤه الآن» list kept today's auto start date, and so was
// counted as read on the day it was added: started, finished and added the same day, with no reading recorded
const pastReadByMistake = (b) => b.status === 'read' && b.created && b.end && b.end === iso(new Date(b.created)) && (!b.start || b.start === b.end) && !(b.log || []).length && !Number(b.page);
function normalizeBook(b) {
  if (pastReadByMistake(b)) b = { ...b, start: '', end: '' };
  return {
    id: b.id || uid(), title: String(b.title || ''), author: String(b.author || ''),
    status: BOOK_STATUS[b.status] ? b.status : 'want', start: b.start || '',
    end: b.end || '',
    summary: String(b.summary || ''), created: b.created || Date.now(),
    // a book read in the past: no dates asked, only an optional Hijri year
    hyear: /^\d{3,4}$/.test(String(b.hyear || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))) ? String(b.hyear).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)) : '',
    // reading.js: topic, and reading days with pages per session
    // study.js: an enrichment book of a science of «الدراسة»
    studyId: String(b.studyId || ''),
    topic: String(b.topic || '').trim(), rdays: Array.isArray(b.rdays) ? [...new Set(b.rdays.map(Number).filter((d) => d >= 0 && d <= 6))] : [], rpages: Number(b.rpages) > 0 ? Math.round(Number(b.rpages)) : 0,
    pages: Number(b.pages) > 0 ? Math.round(Number(b.pages)) : '', page: Number(b.page) > 0 ? Math.round(Number(b.page)) : 0,
    log: Array.isArray(b.log) ? b.log.filter((e) => e && e.d && Number.isFinite(e.p)) : [],
    // spaced recall of a finished book
    rv: !!b.rv, rvPoints: String(b.rvPoints || ''), rvStep: Number(b.rvStep) || 0, rvDue: b.rvDue || '',
    rvLog: Array.isArray(b.rvLog) ? b.rvLog.filter((e) => e && e.d) : [],
  };
}

const BOOK_RV = [7, 30, 90, 180, 365];
const booksDue = () => S.books.filter((b) => b.rv && b.status === 'read' && b.rvDue && b.rvDue <= today());
function bookReviewLine(b) {
  if (!b.rv || b.status !== 'read' || !b.rvDue) return '';
  const n = daysBetween(today(), b.rvDue);
  return n <= 0 ? '🔁 حان استذكاره' : `🔁 الاستذكار ${b.rvLog.length ? `رقم ${b.rvLog.length + 1} ` : ''}${afterDays(n)}`;
}

// reading speed (pages/day) from recent progress, and days left at that pace
function bookPace(b) {
  if (!b.pages || !b.page) return null;
  const t0 = today();
  const left = Math.max(0, b.pages - b.page);
  const pct = Math.min(100, Math.round((b.page / b.pages) * 100));
  // a reading schedule decides the finish date: the remaining pages, session by session, on its days
  if (b.status === 'reading' && b.rdays && b.rdays.length && b.rpages) {
    let need = Math.ceil(left / b.rpages), d = t0;
    for (let n = 0; need > 0 && n < 2000; n++) { if (b.rdays.includes(parse(d).getDay())) need--; if (need > 0) d = addDays(d, 1); }
    return { pct, left, rate: (b.rpages * b.rdays.length) / 7, eta: left ? daysBetween(t0, d) : 0, byPlan: true };
  }
  // otherwise the pace you really kept: pages gained since a recorded page, over the days since then.
  // The page written when the book was added is where you started, not pages read that day.
  const log = b.log.slice().sort((a, c) => a.d.localeCompare(c.d));
  const base = log.filter((e) => e.d < addDays(t0, -14)).pop() || log[0];
  const days = base ? daysBetween(base.d, t0) : 0;
  const gained = base ? b.page - base.p : 0;
  const rate = days >= 1 && gained > 0 ? gained / days : 0;
  return { pct, left, rate, eta: rate > 0 ? Math.ceil(left / rate) : null };
}
const paceLine = (pc) => (pc.eta == null ? 'سجّل صفحتك في الأيام القادمة ليُقدَّر موعد إنهائه' : pc.byPlan ? `بجدول قراءتك تنهيه ${pc.eta ? afterDays(pc.eta) : 'اليوم'}` : `بسرعتك الحالية (${Math.round(pc.rate * 10) / 10} صفحة يومياً) تنهيه ${afterDays(pc.eta)}`);

// yearly reading goal progress
function readingGoalState() {
  const goal = Number(S.settings.readingGoal) || 0;
  if (!goal) return null;
  const y = today().slice(0, 4);
  const done = S.books.filter((b) => b.status === 'read' && (b.end || '').slice(0, 4) === y).length;
  const dayOfYear = daysBetween(`${y}-01-01`, today()) + 1;
  const yearDays = daysBetween(`${y}-01-01`, `${y}-12-31`) + 1;
  const expected = (goal * dayOfYear) / yearDays;
  const diff = Math.round(done - expected);
  return { goal, done, y, diff, pct: pct(done, goal) };
}
function normalizeBenefit(f) {
  const page = parseInt(f.page, 10);
  // one box for the benefit's text (v75): a recording's written-out text (v70–74 kept it under the recording) joins «نص الفائدة»
  const vs = Array.isArray(f.voices) ? f.voices : [];
  const heard = vs.map((v) => String((v && v.text) || '').trim()).filter((x) => x && !String(f.text || '').includes(x));
  if (heard.length) f = { ...f, text: [String(f.text || '').trim(), ...heard].filter(Boolean).join('\n\n') };
  return {
    id: f.id || uid(), bookId: f.bookId || '', book: String(f.book || ''), page: Number.isFinite(page) ? page : '',
    // text: the benefit itself as read (a quote or its idea); lesson: what can be learnt from it
    title: String(f.title || ''), text: String(f.text || ''), lesson: String(f.lesson || ''), created: f.created || Date.now(),
    actionId: f.actionId || '', lastReview: f.lastReview || '', reviews: Number(f.reviews) || 0,
    // voice notes on it (benvoice.js): the recording stays on the phone, its written-out text with the benefit
    voices: (Array.isArray(f.voices) ? f.voices : []).filter((v) => v && v.id).map((v) => ({ id: v.id, mediaId: String(v.mediaId || ''), dur: Number(v.dur) || 0, text: '', created: v.created || Date.now() })),
  };
}

// ---------- benefit of the day (spaced review) ----------
function reviewPick() {
  const t0 = today();
  if (S.reviewPick && S.reviewPick.d === t0 && getBenefit(S.reviewPick.id)) return getBenefit(S.reviewPick.id);
  const pool = S.benefits.filter((f) => (f.title || f.text || f.lesson) && f.lastReview !== t0);
  if (!pool.length) return null;
  // the one not reviewed for the longest time (never reviewed first)
  pool.sort((a, b) => (a.lastReview || '').localeCompare(b.lastReview || '') || a.created - b.created);
  S.reviewPick = { d: t0, id: pool[0].id };
  save();
  return pool[0];
}
function dailyBenefitHTML() {
  const f = reviewPick();
  if (!f) return '';
  const t0 = today();
  if (f.lastReview === t0) {
    return `<div class="review-card done"><span>أحسنت، راجعت فائدة اليوم «${esc(f.title || 'فائدة')}».</span></div>`;
  }
  const action = f.actionId && getTask(f.actionId);
  return `<div class="review-card">
    <small>${icon('bulb')} فائدة اليوم للمراجعة</small>
    <strong>${esc(f.title || 'فائدة')}</strong>
    <span class="book-line">${icon('book')}${esc(benefitBookTitle(f))}${f.page !== '' ? ` | صفحة ${f.page}` : ''}</span>
    ${benBody(f, 400)}
    <div class="btn-row">
      <button type="button" class="primary" data-action="lib-reviewed" data-v="${f.id}">${icon('check')} راجعتها</button>
      ${action ? `<button type="button" class="ghost" data-action="open" data-id="${action.id}">عرض العمل المرتبط</button>` : `<button type="button" class="ghost" data-action="lib-to-action" data-v="${f.id}">اجعلها مهمة</button>`}
    </div>
  </div>`;
}

const getMemo = (id) => S.memos.find((m) => m.id === id);
const getBook = (id) => S.books.find((b) => b.id === id);
const getBenefit = (id) => S.benefits.find((f) => f.id === id);
const benefitBookTitle = (f) => (f.bookId && getBook(f.bookId) ? getBook(f.bookId).title : f.book) || 'بلا كتاب';
const benefitsOf = (bookId) => S.benefits.filter((f) => f.bookId === bookId);
const excerpt = (s, n) => (s.length > n ? s.slice(0, n).trim() + '…' : s);
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

// a date with its Hijri equivalent, e.g. «16 أكتوبر 2026 | 4 جمادى الأولى 1448 هـ»
function dateBoth(d, short) {
  if (!d) return '';
  const g = fmtDate(d, short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' });
  if (!S.settings.hijri) return g;
  return `${g} | ${fmtHijri(d, short ? { day: 'numeric', month: 'long' } : undefined)}`;
}

// the way back to «المزيد», with this page's own emoji and name if the user gave it one
const moreCrumb = () => { const lk = typeof lookOf === 'function' ? lookOf(ui.tab) : {}; return `<div class="crumbs"><button type="button" class="back" data-tab="more">${icon('back')} المزيد</button>${lk.name || lk.emoji ? `<span class="crumb-page"${lk.color ? ` style="--tc:${lk.color}"` : ''}>${esc([lk.emoji, lk.name].filter(Boolean).join(' '))}</span>` : ''}</div>`; };
const xlsBtn = (kind) => `<button type="button" class="xls-btn" data-action="lib-xls" data-v="${kind}">${icon('sheet')}إكسل</button>`;

// ---------- «المزيد» page ----------
function moreTiles() {
  const readThisYear = S.books.filter((b) => b.status === 'read' && (b.end || '').slice(0, 4) === today().slice(0, 4)).length;
  return [
    // under each name a short fact, or nothing (never a sentence describing the page)
    ['reminders', 'bell', 'التذكيرات', remActive().length ? `باقٍ: ${remActive().length}` : ''],
    ['ideas', 'bulb', 'الأفكار', S.ideas.length ? `لم تُنفّذ: ${S.ideas.filter((x) => IDEA_OPEN.includes(x.status)).length}` : ''],
    ['journal', 'journal', 'يومياتي وتأملاتي', S.journal.length ? `${plural(S.journal.length, 'يومية واحدة', 'يوميتان', 'يوميات', 'يومية')}${jStreak() ? ` | ${daysWord(jStreak())} متتالية` : ' | لم تكتب اليوم'}` : ''],
    ['week', 'cal', 'التخطيط الأسبوعي', ''],
    ['health', 'leaf', 'الصحة', S.meals.length ? `سعرات اليوم: ${dayTotals(mealsOf(parse(today()).getDay())).kcal}` : ''],
    ['shop', 'cart', 'القوائم', S.shop.filter((x) => x.need).length ? `لم يُشطب: ${S.shop.filter((x) => x.need).length}` : ''],
    ['finance', 'wallet', 'المالية', ''],
    ['cv', 'user', 'سيرتي الذاتية', S.cvs.length ? `${plural(S.cvs.length, 'نسخة واحدة', 'نسختان', 'نسخ', 'نسخة')}` : ''],
    ['hifz', 'book', 'الحفظ', S.hifz.length || S.hplans.length ? `${hzDue().length ? `للمراجعة اليوم: ${hzDue().length} | ` : ''}محفوظ: ${S.hifz.filter((h) => h.state === 'review').length}` : ''],
    ['study', 'book', 'الدراسة', S.study.length ? `${studyDue().length ? `للمراجعة اليوم: ${studyDue().length} | ` : ''}العلوم: ${S.study.length}` : ''],
    ['people', 'heart', 'الأحبّة', S.people.length ? `حان التواصل: ${S.people.filter((p) => (contactDue(p) ?? -1) >= 0).length || 'لا أحد'}` : ''],
    ['decisions', 'scale', 'سجل القرارات', S.decisions.length ? `${decDue().length ? `للمراجعة: ${decDue().length} | ` : ''}القرارات: ${S.decisions.length}` : ''],
    ['notes', 'note', 'الملاحظات', S.memos.length ? `${plural(S.memos.length, 'ملاحظة واحدة', 'ملاحظتان', 'ملاحظات', 'ملاحظة')}` : ''],
    ['books', 'book', 'الكتب', S.books.length ? `الكتب: ${S.books.length} | قرأت هذا العام: ${readThisYear}` : ''],
    ['benefits', 'bulb', 'الفوائد', S.benefits.length ? `${plural(S.benefits.length, 'فائدة واحدة', 'فائدتان', 'فوائد', 'فائدة')}` : ''],
    ['archive', 'archive', 'الأرشيف', S.archive.length ? `لم تعد إليها: ${S.archive.filter((a) => !a.revisitedAt).length}` : ''],
    ['inspire', 'spark', 'الإلهام', S.inspire.length ? `عبارات وصور: ${S.inspire.length}` : ''],
    ['report', 'sheet', 'التقارير', ''],
    ['stats', 'chart', 'الإحصائيات', ''],
  ];
}
function viewMore() {
  const all = moreTiles();
  const tiles = orderOf(all.map(([k]) => k), S.settings.moreOrder).map((k) => all.find((t) => t[0] === k));
  return `
  <section class="section">
    <div class="section-head"><h2>المزيد</h2><button type="button" class="ghost sm" data-action="lay-open" data-v="more">${icon('gear')} رتّب الصفحات ولوّنها</button></div>
    <div class="more-grid">${tiles.map(([tab, ic, name, sub]) => { const lk = lookOf(tab); return `<button type="button" class="more-tile${tab === 'stats' ? ' wide' : ''}${lk.color ? ' tinted' : ''}" data-tab="${tab}"${lk.color ? ` style="--tc:${lk.color}"` : ''}>${lk.emoji ? `<span class="tile-emoji" aria-hidden="true">${esc(lk.emoji)}</span>` : icon(ic)}<b>${esc(lk.name || name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`; }).join('')}</div>
  </section>
  <section class="panel">
    <h2>تصدير إلى إكسل</h2>
    <p class="note-text explain">ملف إكسل واحد فيه صفحة لكل قسم: المهام والمشاريع والأهداف والأفكار واليوميات والملاحظات والكتب والفوائد والأرشيف والعبارات. يفتح في Excel وGoogle Sheets.</p>
    <div class="btn-row">
      <button type="button" class="primary" data-action="lib-xls" data-v="all">${icon('sheet')} تصدير الكل</button>
      <button type="button" class="ghost" data-action="lib-xls" data-v="tasks">المهام والمشاريع</button>
      <button type="button" class="ghost" data-action="lib-xls" data-v="goals">الأهداف</button>
    </div>
  </section>`;
}

// ---------- notes ----------
function memoCard(m) {
  return `<button type="button" class="memo" data-action="lib-open-memo" data-v="${m.id}">
    <strong>${m.pinned ? `${icon('pin2')} ` : ''}${esc(m.title || excerpt(m.body.split('\n')[0] || 'بلا عنوان', 40))}</strong>
    ${m.body ? `<div class="memo-preview">${m.html}</div>` : ''}
    ${m.audios.length ? `<span class="book-line">${icon('micro')}${m.audios.length === 1 ? 'تسجيل صوتي' : `${m.audios.length} تسجيلات`} | ${fmtClock(m.audios.reduce((n, a) => n + a.dur, 0))}</span>` : ''}
    <small>${esc(m.updated > m.created + 60000 ? `عُدّلت ${relDate(iso(new Date(m.updated)))}` : relDate(iso(new Date(m.created))))} | ${esc(fmtTime(hmOf(new Date(m.updated).getHours() * 60 + new Date(m.updated).getMinutes())))}</small>
  </button>`;
}

function viewNotes() {
  const q = libUi.memoQ.trim().toLowerCase();
  const list = S.memos.filter((m) => !q || m.title.toLowerCase().includes(q) || m.body.toLowerCase().includes(q))
    .sort((a, b) => b.pinned - a.pinned || b.updated - a.updated);
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الملاحظات</h2><div class="btn-row">${S.memos.length ? xlsBtn('memos') : ''}${addBtn('lib-voice-memo', 'صوتية')}${addBtn('lib-new-memo', 'ملاحظة')}</div></div>
    ${S.memos.length ? `<input type="search" id="memoSearch" placeholder="ابحث في الملاحظات" aria-label="بحث" value="${esc(libUi.memoQ)}">` : ''}
    ${list.length ? `<div class="memo-grid">${list.map(memoCard).join('')}</div>`
      : S.memos.length ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى.')
        : emptyHTML('لا ملاحظات بعد', 'اكتب أفكارك وخواطرك هنا، كل ملاحظة مستقلة بعنوانها.', addBtn('lib-new-memo', 'أول ملاحظة'))}
  </section>`;
}

// ---------- books ----------
function bookLine(b) {
  const t0 = today();
  if (b.status === 'reading') return b.start ? `بدأت ${dateBoth(b.start, true)} | ${daysBetween(b.start, t0) > 0 ? `منذ ${daysWord(daysBetween(b.start, t0))}` : 'اليوم'}` : 'لم تحدد تاريخ البدء';
  if (b.status === 'read') {
    const parts = [];
    if (b.start) parts.push(`من ${dateBoth(b.start, true)}`);
    if (b.end) parts.push(`إلى ${dateBoth(b.end, true)}`);
    if (b.start && b.end) parts.push(`(${daysWord(daysBetween(b.start, b.end) + 1)})`);
    if (!parts.length && b.hyear) parts.push(`قرأته عام ${b.hyear} هـ`);
    return parts.join(' ') || 'مقروء';
  }
  if (b.status === 'stalled') return b.end ? `توقفت ${dateBoth(b.end, true)}` : b.start ? `بدأته ${dateBoth(b.start, true)} وتوقفت` : 'توقفت عن قراءته';
  return `أضيف ${relDate(iso(new Date(b.created)))}`;
}

function bookCard(b) {
  const n = benefitsOf(b.id).length;
  const pace = b.status === 'reading' ? bookPace(b) : null;
  return `<button type="button" class="book-card s-${b.status}" data-action="lib-open-book" data-v="${b.id}">
    <span class="book-top"><strong>${esc(b.title)}</strong>${b.author ? `<small>${esc(b.author)}</small>` : ''}</span>
    <span class="book-line">${icon('cal')}${esc(bookLine(b))}</span>
    ${b.topic || (b.status === 'reading' && scheduleLine(b)) ? `<span class="book-line">${[b.topic ? `<span class="topic-tag">${esc(b.topic)}</span>` : '', libUi.bookTopic ? esc(BOOK_STATUS[b.status]) : '', b.status === 'reading' && scheduleLine(b) ? `📅 ${esc(scheduleLine(b))}` : ''].filter(Boolean).join(' | ')}</span>` : ''}
    ${b.studyId && getSci(b.studyId) ? `<span class="book-line"><span class="topic-tag">${esc(`إثرائي في ${getSci(b.studyId).name}`)}</span></span>` : ''}
    ${pace ? `<span class="pbar"><i style="width:${pace.pct}%"></i></span>
      <span class="book-line">قرأت ${pace.pct}% | صفحة ${b.page} من ${b.pages}${pace.eta != null && pace.left ? ` | ${pace.byPlan ? 'بأيام قراءتك' : 'بسرعتك الحالية'} تنهيه ${pace.eta ? afterDays(pace.eta) : 'اليوم'}` : ''}</span>` : ''}
    ${b.status === 'reading' && !b.pages ? `<span class="book-line">${icon('steps')}أضف عدد صفحاته لتتابع تقدّمك</span>` : ''}
    ${b.summary ? `<p>${esc(excerpt(b.summary, 160))}</p>` : ''}
    ${n ? `<span class="ben-open" role="button" data-action="lib-book-bens" data-v="${b.id}">💡 اعرض فوائده (${n})</span>` : ''}
    ${bookReviewLine(b) ? `<span class="book-line${b.rvDue <= today() ? ' late' : ''}">${esc(bookReviewLine(b))}</span>` : ''}
  </button>`;
}

function viewBooks() {
  syncReading();
  const counts = Object.fromEntries(BOOK_ORDER.map((s) => [s, S.books.filter((b) => b.status === s).length]));
  const st = libUi.bookStatus;
  const q = libUi.bookQ.trim().toLowerCase();
  const topic = bookTopics().includes(libUi.bookTopic) ? libUi.bookTopic : '';
  const list = S.books.filter((b) => (q || topic ? true : b.status === st) && (!topic || b.topic === topic) && (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.summary.toLowerCase().includes(q)))
    .sort((a, b) => (st === 'read' ? (b.end || '').localeCompare(a.end || '') : 0) || b.created - a.created);
  const seg = BOOK_ORDER.map((s) => `<button type="button" data-action="lib-book-status" data-v="${s}" aria-pressed="${!q && st === s}">${BOOK_STATUS_PLURAL[s]} <span class="num">${counts[s]}</span></button>`).join('');
  const empties = {
    reading: ['لا تقرأ كتاباً الآن', 'أضف الكتاب الذي تقرؤه مع تاريخ البدء.'],
    read: ['لا كتب مقروءة بعد', 'عند إنهاء كتاب اختر حالته «مقروء» وسجّل تاريخ الانتهاء وفكرته.'],
    want: ['قائمة القراءة فارغة', 'أضف الكتب التي تنوي قراءتها.'],
    stalled: ['لا كتب متعثرة', 'الكتب التي توقفت عن قراءتها تظهر هنا.'],
  };
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الكتب</h2><div class="btn-row">${S.books.length ? xlsBtn('books') : ''}${addBtn('lib-new-book', 'كتاب')}</div></div>
    ${readingGoalHTML()}
    ${booksDue().length ? `<div class="brv-due"><b>🔁 حان استذكار ${booksDue().length === 1 ? 'كتاب' : `${booksDue().length} كتب`}</b>${booksDue().map((b) => `<button type="button" class="ghost" data-action="lib-book-review" data-v="${b.id}">${esc(b.title)}</button>`).join('')}</div>` : ''}
    ${topicBarHTML()}
    ${topic ? topicCardHTML(topic) : `<div class="seg seg-wrap" role="group" aria-label="حالة الكتب">${seg}</div>`}
    ${S.books.length > 5 ? `<input type="search" id="bookSearch" placeholder="ابحث في كل الكتب" aria-label="بحث" value="${esc(libUi.bookQ)}">` : ''}
    ${list.length ? `<div class="book-list">${list.map(bookCard).join('')}</div>`
      : q ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى.') : emptyHTML(empties[st][0], empties[st][1], addBtn('lib-new-book', 'أضف كتاباً'))}
  </section>`;
}

function readingGoalHTML() {
  const g = readingGoalState();
  if (!g) return `<button type="button" class="goal-cta" data-action="lib-set-goal">${icon('target')} ضع هدفاً لعدد الكتب هذا العام</button>`;
  const status = g.diff > 0 ? `متقدّم بـ ${g.diff} ${g.diff === 1 ? 'كتاب' : 'كتب'} عن خطتك` : g.diff < 0 ? `متأخر بـ ${-g.diff} ${g.diff === -1 ? 'كتاب' : 'كتب'} عن خطتك` : 'على المسار تماماً';
  return `<button type="button" class="reading-goal" data-action="lib-set-goal">
    <span class="row-between"><b>هدف ${g.y}: ${g.done} من ${g.goal} كتاباً</b><small>${g.pct}%</small></span>
    <span class="pbar"><i style="width:${Math.min(100, g.pct)}%"></i></span>
    <small class="${g.diff < 0 ? 'late' : ''}">${status}</small>
  </button>`;
}

// ---------- benefits ----------
// a benefit's body, the same on its page, the book's page, the recall and the daily review:
// its text and each written-out recording in one calm box apiece, then «يُستفاد منها» below them
function benBody(f, max = 0) {
  const cut = (s) => esc(max ? excerpt(s, max) : s);
  return `${f.text ? `<div class="ben-text"><b class="ben-lbl">الفائدة</b>${cut(f.text)}</div>` : ''}${bvTexts(f).map((x) => `<div class="ben-text"><b class="ben-lbl">الفائدة</b>${cut(x)}</div>`).join('')}${f.lesson ? `<div class="ben-lesson"><b class="ben-lbl">يُستفاد منها</b>${cut(f.lesson)}</div>` : ''}`;
}
function benReadHTML(f, withBook) {
  // the benefit's own text and what it teaches, each in its own clearly different box
  const body = benBody(f);
  return `<button type="button" class="ben-read" data-action="lib-open-benefit" data-v="${f.id}">
    <span class="ben-head"><b>${esc(f.title || 'فائدة')}</b><span class="ben-tags">${[withBook ? esc(benefitBookTitle(f)) : '', f.page !== '' ? `صفحة ${f.page}` : ''].filter(Boolean).map((x) => `<small class="dbox">${x}</small>`).join('')}</span></span>${body}</button>`;
}
// «فوائده»: all the benefits of one book, title and text, in page order
function openBookBenefits(id) {
  const b = getBook(id);
  if (!b) return;
  const fx = benefitsOf(id).sort((a, c) => (a.page === '' ? 1e9 : a.page) - (c.page === '' ? 1e9 : c.page));
  ldraft = { kind: 'bookbens', id, isNew: false };
  $('libForm').innerHTML = `${sheetHead(`💡 فوائد «${b.title}»`)}
    ${fx.length ? `<div class="ben-reads">${fx.map((f) => benReadHTML(f, false)).join('')}</div>` : '<p class="note-text">لا فوائد مسجلة من هذا الكتاب.</p>'}
    <div class="sheet-actions"><button type="button" class="ghost" data-action="lib-benefit-from-book">${icon('plus')} أضف فائدة منه</button><button type="button" class="primary" data-action="lib-close">إغلاق</button></div>`;
  showLib();
}
function benefitCard(f) {
  return `<button type="button" class="benefit" data-action="lib-open-benefit" data-v="${f.id}">
    <strong>${esc(f.title || 'فائدة')}</strong>
    <span class="book-line">${icon('book')}${esc(benefitBookTitle(f))}${f.page !== '' ? ` | صفحة ${f.page}` : ''}</span>
    ${benBody(f, 400)}
    ${f.voices && f.voices.length ? `<span class="book-line">🎙 تسجيلات صوتية: ${f.voices.length}</span>` : ''}
    ${f.actionId && getTask(f.actionId) ? `<span class="book-line ok">${icon('check')}تحوّلت إلى عمل: ${esc(getTask(f.actionId).title)}</span>` : ''}
  </button>`;
}

function viewBenefits() {
  const q = libUi.benefitQ.trim().toLowerCase();
  const fb = libUi.benefitBook;
  const titles = [...new Set(S.benefits.map(benefitBookTitle))].sort((a, b) => a.localeCompare(b, 'ar'));
  const list = S.benefits.filter((f) => (!fb || benefitBookTitle(f) === fb) &&
    (!q || f.title.toLowerCase().includes(q) || f.text.toLowerCase().includes(q) || f.lesson.toLowerCase().includes(q) || benefitBookTitle(f).toLowerCase().includes(q)))
    .sort((a, b) => (fb ? (a.page === '' ? 1e9 : a.page) - (b.page === '' ? 1e9 : b.page) : b.created - a.created));
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الفوائد</h2><div class="btn-row">${S.benefits.length ? xlsBtn('benefits') : ''}${addBtn('lib-new-benefit', 'فائدة')}</div></div>
    ${S.benefits.length ? `<div class="toolbar">
      <input type="search" id="benefitSearch" placeholder="ابحث في الفوائد" aria-label="بحث" value="${esc(libUi.benefitQ)}">
      <select id="benefitBook" aria-label="الكتاب"><option value="">كل الكتب</option>${titles.map((t) => `<option value="${esc(t)}"${t === fb ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
    </div>` : ''}
    ${S.benefits.length ? `<div class="btn-row"><button type="button" class="chip" data-action="lib-ben-read" aria-pressed="${libUi.benRead}">📖 العنوان والفائدة فقط</button></div>` : ''}
    ${list.length ? (libUi.benRead ? `<div class="ben-reads">${list.map((f) => benReadHTML(f, !fb)).join('')}</div>` : `<div class="book-list">${list.map(benefitCard).join('')}</div>`)
      : S.benefits.length ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى أو كتاباً آخر.')
        : emptyHTML('لا فوائد بعد', 'سجّل الفائدة: اسم الكتاب ورقم الصفحة وعنوانها، وما يمكن أن تستفيده منها.', addBtn('lib-new-benefit', 'أول فائدة'))}
  </section>`;
}

// ---------- reading panel for statistics ----------
function readingPanelHTML() {
  if (!S.books.length && !S.benefits.length) return '';
  const y = today().slice(0, 4);
  const readYear = S.books.filter((b) => b.status === 'read' && (b.end || '').slice(0, 4) === y);
  const durations = readYear.filter((b) => b.start && b.end).map((b) => daysBetween(b.start, b.end) + 1);
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const counts = BOOK_ORDER.map((s) => [s, S.books.filter((b) => b.status === s).length]);
  const max = Math.max(1, ...counts.map(([, n]) => n));
  return `<section class="panel">
    <h2>القراءة</h2>
    ${(() => { const g = readingGoalState(); return g ? `<p class="note-text">هدف العام: <b>${g.done} من ${g.goal}</b> (${g.pct}%)</p>` : ''; })()}
    <p class="note-text">قرأت <b>${readYear.length}</b> ${readYear.length === 1 ? 'كتاباً' : 'كتب'} هذا العام${avg ? ` | متوسط الكتاب ${daysWord(avg)}` : ''} | سجّلت <b>${S.benefits.length}</b> فائدة</p>
    <ul class="hbars">${counts.map(([s, n]) => hbar(BOOK_STATUS_PLURAL[s], n, (n / max) * 100)).join('')}</ul>
  </section>`;
}

// ---------- shared editor sheet for notes, books and benefits ----------
const lsheet = () => $('libSheet');
let ldraft = null; // { kind, id, isNew, status }
let libArmed = false;

function openLib(kind, id, preset = {}) {
  const isNew = !id;
  ldraft = { kind, id: id || uid(), isNew };
  const f = $('libForm');
  let body = '';
  if (kind === 'memo') {
    const m = id ? getMemo(id) : normalizeMemo({});
    body = `
      <label class="field"><span>العنوان</span><input type="text" id="lTitle" value="${esc(m.title)}" autocomplete="off" placeholder="عنوان الملاحظة"></label>
      <label class="field"><span>النص</span><textarea id="lBody" rows="10" placeholder="اكتب ما تشاء…">${esc(m.body)}</textarea></label>
      <label class="switch"><input type="checkbox" id="lPinned"${m.pinned ? ' checked' : ''}><span>تثبيت في الأعلى</span></label>
      ${id ? `<p class="note-text">أُنشئت ${esc(dateBoth(iso(new Date(m.created)), true))}${m.updated > m.created + 60000 ? ` | عُدّلت ${esc(dateBoth(iso(new Date(m.updated)), true))}` : ''}</p>` : ''}`;
  } else if (kind === 'book') {
    const b = id ? getBook(id) : normalizeBook({ status: preset.status || libUi.bookStatus, start: (preset.status || libUi.bookStatus) === 'reading' ? today() : '', studyId: preset.studyId || '' });
    ldraft.status = b.status;
    const n = id ? benefitsOf(id).length : 0;
    // an existing book opens on two tabs: its data, and its benefits (not under the data)
    ldraft.tab = id && preset.tab === 'bens' ? 'bens' : 'data';
    body = `
      ${id ? `<div class="seg" id="bkTabs" role="group"><button type="button" data-action="lib-bk-tab" data-v="data" aria-pressed="${ldraft.tab === 'data'}">البيانات</button><button type="button" data-action="lib-bk-tab" data-v="bens" aria-pressed="${ldraft.tab === 'bens'}">💡 الفوائد (${n})</button></div>` : ''}
      <div id="bkData"${ldraft.tab === 'bens' ? ' hidden' : ''}>
      <label class="field"><span>اسم الكتاب</span><input type="text" id="lTitle" value="${esc(b.title)}" autocomplete="off" placeholder="مثال: الأيام"></label>
      <label class="field"><span>المؤلف (اختياري)</span><input type="text" id="lAuthor" value="${esc(b.author)}" autocomplete="off" placeholder="مثال: طه حسين"></label>
      ${S.study.length || b.studyId ? `<label class="field"><span>كتاب إثرائي في علم (اختياري)</span><select id="lStudy"><option value="">لا</option>${S.study.map((s) => `<option value="${s.id}"${b.studyId === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
      <div class="field"><span>الحالة</span><div class="seg seg-wrap" id="lStatus">${BOOK_ORDER.map((s) => `<button type="button" data-action="lib-status" data-v="${s}" aria-pressed="${b.status === s}">${BOOK_STATUS[s]}</button>`).join('')}</div></div>
      <div class="grid2">
        <label class="field" id="lStartWrap"><span>تاريخ البدء</span><input type="date" id="lStart" value="${b.start}"><small class="hint" id="lStartH">${esc(b.start ? fmtHijri(b.start) : '')}</small></label>
        <label class="field" id="lEndWrap"><span>تاريخ الانتهاء</span><input type="date" id="lEnd" value="${b.end}"><small class="hint" id="lEndH">${esc(b.end ? fmtHijri(b.end) : '')}</small></label>
      </div>
      <label class="field" id="lYearWrap"><span>سنة القراءة الهجرية (اختياري)</span><input type="text" inputmode="numeric" id="lHyear" value="${esc(b.hyear)}" placeholder="مثال: ١٤٤٢" autocomplete="off" data-novoice></label>
      <div class="grid2">
        <label class="field"><span>عدد صفحات الكتاب</span><input type="number" id="lPages" min="1" inputmode="numeric" value="${b.pages}" placeholder="مثال: 320"></label>
        <label class="field"><span>وصلت إلى صفحة</span><input type="number" id="lPage" min="0" inputmode="numeric" value="${b.page || ''}" placeholder="مثال: 45"></label>
      </div>
      ${(() => { const pc = bookPace(b); return pc ? `<p class="note-text">${pc.pct}% | بقي ${pc.left} صفحة${pc.left ? ` | ${paceLine(pc)}` : ''}</p>` : ''; })()}
      ${bookReadingFieldsHTML(b)}
      <label class="field"><span>فكرة موجزة عن الكتاب</span><textarea id="lSummary" rows="5" placeholder="عمّ يتحدث الكتاب؟ وما أهم ما خرجت به؟">${esc(b.summary)}</textarea></label>
      <div class="brv-box" id="lRvWrap">
        <label class="switch"><input type="checkbox" id="lRv"${b.rv ? ' checked' : ''}><span>🔁 ذكّرني باستذكاره على فترات</span></label>
        <p class="note-text explain">يذكّرك التطبيق بالعودة إليه بعد أسبوع، ثم شهر، ثم ٣ أشهر، ثم ٦ أشهر، ثم سنة، لتستذكر ما سجّلته منه: النقاط التي تكتبها هنا، وفكرته، وفوائدك منه.</p>
        <label class="field" id="lRvPointsW"${b.rv ? '' : ' hidden'}><span>ما الذي أريد أن أتذكره منه تحديداً؟</span><textarea id="lRvPoints" rows="4" placeholder="نقطة في كل سطر">${esc(b.rvPoints)}</textarea></label>
        ${b.rv && b.rvDue ? `<p class="note-text">${esc(bookReviewLine(b))} | ${esc(dateBoth(b.rvDue, true))}${b.rvLog.length ? ` | استذكرته ${b.rvLog.length} ${b.rvLog.length === 1 ? 'مرة' : 'مرات'}` : ''}</p>` : ''}
      </div>
      </div>
      ${id ? `<div id="bkBens"${ldraft.tab === 'bens' ? '' : ' hidden'}><div class="row-between"><span class="note-text">${n ? `${n} ${n === 1 ? 'فائدة' : 'فوائد'} من هذا الكتاب` : 'لا فوائد مسجلة من هذا الكتاب'}</span><button type="button" class="ghost" data-action="lib-benefit-from-book">${icon('plus')} أضف فائدة منه</button></div>
      ${n ? `<div class="bk-bens">${benefitsOf(id).sort((a, c) => (a.page || 0) - (c.page || 0)).map((fb) => `<button type="button" class="bk-ben" data-action="lib-open-benefit" data-v="${fb.id}"><span class="ben-head"><b>${esc(fb.title || 'فائدة')}</b>${fb.page !== '' ? `<small>صفحة ${fb.page}</small>` : ''}</span>${benBody(fb)}</button>`).join('')}</div>` : ''}</div>` : ''}`;
  } else {
    const fx = id ? getBenefit(id) : normalizeBenefit({ bookId: preset.bookId || '', book: preset.book || '' });
    ldraft.voices = (fx.voices || []).map((x) => ({ ...x }));
    const bookTitle = id ? benefitBookTitle(fx) : (preset.bookId ? getBook(preset.bookId).title : preset.book || '');
    body = `
      <label class="field"><span>اسم الكتاب</span><input type="text" id="lBook" value="${esc(bookTitle === 'بلا كتاب' ? '' : bookTitle)}" list="bookTitles" autocomplete="off" placeholder="اختر من كتبك أو اكتب اسماً"></label>
      <datalist id="bookTitles">${S.books.map((b) => `<option value="${esc(b.title)}">`).join('')}</datalist>
      <label class="field"><span>رقم الصفحة</span><input type="number" id="lPage" min="0" inputmode="numeric" value="${fx.page}" placeholder="مثال: 45"></label>
      <label class="field"><span>عنوان الفائدة</span><input type="text" id="lTitle" value="${esc(fx.title)}" autocomplete="off" placeholder="مثال: أثر العادة في النجاح"></label>
      <label class="field"><span>نص الفائدة</span><textarea id="lText" rows="5" placeholder="الفائدة كما قرأتها">${esc(fx.text)}</textarea></label>
      <details class="bv-fold"${(fx.voices || []).length ? ' open' : ''}><summary>🎙 تسجيل صوتي (اختياري)</summary><div id="bvBox"></div></details>
      <label class="field"><span>ما يمكن أن يُستفاد منها</span><textarea id="lLesson" rows="4" placeholder="كيف تطبّقها">${esc(fx.lesson)}</textarea></label>
      ${id ? (fx.actionId && getTask(fx.actionId)
        ? `<div class="row-between"><span class="note-text">${icon('check')} تحوّلت إلى عمل: ${esc(getTask(fx.actionId).title)}</span><button type="button" class="ghost" data-action="open" data-id="${fx.actionId}">عرضه</button></div>`
        : `<div class="btn-row"><button type="button" class="ghost" data-action="lib-to-action" data-v="${id}">اجعلها مهمة</button>${aiBtn('ai-benefit', 'اقترح عملاً منها', ` data-v="${id}"`)}</div>`) : ''}`;
  }
  const titles = { memo: ['ملاحظة جديدة', 'تعديل الملاحظة'], book: ['كتاب جديد', 'تعديل الكتاب'], benefit: ['فائدة جديدة', 'تعديل الفائدة'] };
  f.innerHTML = `
    <div class="sheet-head"><h2>${titles[kind][isNew ? 0 : 1]}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${body}
    <div class="sheet-actions">
      <button type="submit" class="primary">حفظ</button>
      ${isNew ? '' : '<button type="button" class="danger" data-action="lib-delete" id="lDel">حذف</button>'}
    </div>`;
  libArmed = false;
  updateBookEnd();
  if (kind === 'benefit') bvRender();
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  f.scrollTop = 0;
  setTimeout(() => {
    const first = kind === 'benefit' && !preset.bookId && !preset.book ? 'lBook' : kind === 'benefit' ? 'lPage' : 'lTitle';
    const a = document.activeElement;
    if (isNew && d.open && !(a && a.closest && a.closest('#libForm input, #libForm textarea')) && $(first)) $(first).focus();
  }, 50);
}

// only the dates that belong to the state (as the user asked):
// reading → its start only; read after being read here (it has a start) → its end only;
// read in the past (no start) → no dates, an optional Hijri year; stalled → when it stopped; want → nothing
function updateBookEnd() {
  if (!ldraft || ldraft.kind !== 'book') return;
  const st = ldraft.status, started = !!$('lStart').value;
  $('lStartWrap').hidden = st !== 'reading';
  $('lEndWrap').hidden = !((st === 'read' && started) || st === 'stalled');
  $('lYearWrap').hidden = !(st === 'read' && !started);
  $('lEndWrap').querySelector('span').textContent = st === 'stalled' ? 'تاريخ التوقف' : 'تاريخ الانتهاء';
  if ($('lRvWrap')) $('lRvWrap').hidden = ldraft.status !== 'read';
}

// where a benefit was opened from (the book's benefits tab, or its benefits window), to go back to it
function libBackFrom() {
  if (!ldraft) return null;
  const scroll = $('libForm').scrollTop;
  if (ldraft.kind === 'bookbens') return { kind: 'bookbens', id: ldraft.id, scroll };
  if (ldraft.kind === 'book' && ldraft.tab === 'bens') return { kind: 'book', id: ldraft.id, scroll };
  return null;
}
function libBack(back) {
  if (!back) return;
  // an option or a criterion of a decision goes back to its decision, on the tab it came from
  if (back.kind === 'decision') { if (getDec(back.id)) { openDecision(back.id, false, back.tab); $('libForm').scrollTop = back.scroll || 0; } return; }
  if (!getBook(back.id)) return;
  if (back.kind === 'bookbens') openBookBenefits(back.id); else openLib('book', back.id, { tab: 'bens' });
  $('libForm').scrollTop = back.scroll || 0;
}

function closeLib() {
  const d = lsheet();
  if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
  ldraft = null;
}

function saveLib() {
  const { kind, id } = ldraft;
  const v = (x) => ($(x) ? $(x).value.trim() : '');
  if (kind === 'memo') {
    const title = v('lTitle'), body = $('lBody').value;
    if (!title && !body.trim()) { toast('اكتب عنواناً أو نصاً.'); return false; }
    const old = getMemo(id);
    const m = normalizeMemo({ ...(old || {}), id, title, body, pinned: $('lPinned').checked, updated: Date.now() });
    if (old) Object.assign(old, m); else S.memos.push(m);
  } else if (kind === 'book') {
    const title = v('lTitle');
    if (!title) { toast('اكتب اسم الكتاب.'); $('lTitle').focus(); return false; }
    let start = ['reading', 'read'].includes(ldraft.status) ? v('lStart') : ldraft.status === 'stalled' ? v('lStart') : '', end = ['read', 'stalled'].includes(ldraft.status) ? v('lEnd') : '';
    // finished after reading it here: its end defaults to today; a book read in the past keeps no dates
    if (ldraft.status === 'read' && start && !end) end = today();
    // a book read in the past (no start date) keeps no end date: it never counts as read this year
    if (ldraft.status === 'read' && !start) end = '';
    if (ldraft.status === 'reading' && !start) start = today();
    if (start && end && end < start) { toast('تاريخ الانتهاء قبل تاريخ البدء.'); return false; }
    const old = getBook(id);
    const pages = parseInt(v('lPages'), 10) || '';
    let page = Math.max(0, parseInt(v('lPage'), 10) || 0);
    if (pages && page > pages) page = pages;
    const log = old ? [...(old.log || [])] : [];
    if (page !== (old ? old.page : 0)) { const t0 = today(); const i = log.findIndex((e) => e.d === t0); if (i >= 0) log[i].p = page; else log.push({ d: t0, p: page }); }
    // finishing the last page completes the book
    let status = ldraft.status;
    if (pages && page >= pages && status === 'reading') { status = 'read'; end = end || today(); setTimeout(() => toast(`أحسنت! أنهيت «${title}»`), 300); }
    const rv = status === 'read' && $('lRv').checked;
    const rvFields = { rv, rvPoints: $('lRvPoints').value.trim() };
    if (rv && !(old && old.rv)) Object.assign(rvFields, { rvStep: 0, rvDue: addDays(today(), BOOK_RV[0]) });
    const b = normalizeBook({ ...(old || {}), id, title, author: v('lAuthor'), status, start, end, hyear: status === 'read' && !start ? v('lHyear') : '', summary: $('lSummary').value.trim(), pages, page, log, ...rvFields, studyId: $('lStudy') ? $('lStudy').value : old ? old.studyId : '', topic: v('lTopic'), rdays: ldraft.rdays || [], rpages: parseInt(v('lRpages'), 10) || 0 });
    if (old) {
      // keep the benefits' book name in sync
      for (const f of benefitsOf(id)) f.book = title;
      Object.assign(old, b);
    } else S.books.push(b);
    libUi.bookStatus = b.status;
  } else {
    const title = v('lTitle'), text = $('lText') ? $('lText').value.trim() : '', lesson = $('lLesson').value.trim(), bookName = v('lBook');
    const voices = ldraft.voices || [];
    if (!title && !text && !lesson && !voices.length) { toast('اكتب عنوان الفائدة أو نصها.'); return false; }
    const book = S.books.find((b) => b.title === bookName);
    const old = getBenefit(id);
    // a recording removed in the sheet leaves the phone too
    if (old) for (const x of old.voices || []) if (!voices.some((y) => y.id === x.id)) Media.del(x.mediaId).catch(() => {});
    const f = normalizeBenefit({ ...(old || {}), id, title: title || (voices.length && !text ? 'فائدة مسجّلة بالصوت' : ''), text, lesson, page: v('lPage'), bookId: book ? book.id : '', book: bookName, voices });
    if (old) Object.assign(old, f); else S.benefits.push(f);
  }
  save();
  return true;
}

function deleteLib() {
  const { kind, id } = ldraft;
  if (kind === 'memo') S.memos = S.memos.filter((m) => m.id !== id);
  if (kind === 'book') {
    // benefits keep the book's name as text
    for (const f of benefitsOf(id)) { f.book = getBook(id).title; f.bookId = ''; }
    S.books = S.books.filter((b) => b.id !== id);
  }
  if (kind === 'benefit') S.benefits = S.benefits.filter((f) => f.id !== id);
  if (kind === 'quote') S.inspire = S.inspire.filter((x) => x.id !== id);
  if (kind === 'arch') S.archive = S.archive.filter((x) => x.id !== id);
  if (kind === 'idea') S.ideas = S.ideas.filter((x) => x.id !== id);
  if (kind === 'jtpl') S.jtemplates = S.jtemplates.filter((x) => x.id !== id);
  if (kind === 'hifz') S.hifz = S.hifz.filter((x) => x.id !== id);
  if (kind === 'meal') S.meals = S.meals.filter((x) => x.id !== id);
  if (kind === 'sub') { S.subs = S.subs.filter((x) => x.id !== id); S.finTx = S.finTx.filter((t) => !(t.src || '').startsWith(`sub:${id}:`)); syncAllPlans(); }
  if (kind === 'later') S.later = S.later.filter((x) => x.id !== id);
  if (kind === 'debt') { S.finDebts = S.finDebts.filter((x) => x.id !== id); S.finTx = S.finTx.filter((t) => !(t.src || '').startsWith(`debt:${id}:`)); syncAllPlans(); }
  if (kind === 'right' || kind === 'owe') S.finRights = S.finRights.filter((x) => x.id !== id);
  if (kind === 'hplan') { S.hplans = S.hplans.filter((x) => x.id !== id); for (const h of S.hifz) if (h.planId === id) h.planId = ''; }
  if (kind === 'person') S.people = S.people.filter((x) => x.id !== id);
  if (kind === 'decision') S.decisions = S.decisions.filter((x) => x.id !== id);
  if (kind === 'list') deleteList(id);
  if (kind === 'fine') deleteFine(id);
  if (kind === 'quit') S.quits = S.quits.filter((x) => x.id !== id);
  save();
}

// ---------- Excel export ----------
const yesNo = (b) => (b ? 'نعم' : 'لا');
const hijriOf = (d) => (d ? fmtHijri(d) : '');
const stampDate = (ts) => (ts ? iso(new Date(ts)) : '');

function excelSheets(kind) {
  const sheets = [];
  const add = (name, columns, rows) => sheets.push({ name, columns, rows });
  if (kind === 'all' || kind === 'tasks') {
    const tasks = S.tasks.filter((t) => !isGoal(t));
    add('المهام', [
      { title: 'المهمة', width: 34, wrap: true }, { title: 'المشروع', width: 20 }, { title: 'الحالة', width: 10 },
      { title: 'التاريخ', width: 13 }, { title: 'التاريخ الهجري', width: 22 }, { title: 'الوقت', width: 18 },
      { title: 'الأولوية', width: 10 }, { title: 'التصنيف', width: 14 }, { title: 'الخطوات المنجزة', width: 10 },
      { title: 'عدد الخطوات', width: 10 }, { title: 'الخطوات', width: 40, wrap: true }, { title: 'الملاحظات', width: 40, wrap: true },
      { title: 'الوقت المسجل (دقيقة)', width: 12 }, { title: 'تاريخ الإنجاز', width: 13 },
    ], tasks.map((t) => [
      t.title, (projectOf(t) || {}).name || '', t.done ? 'منجزة' : 'حالية', t.due, hijriOf(t.due),
      hasTime(t) ? timeLabel(t, t.due || today()) : '', PRI_LABEL[t.priority], t.category,
      t.subtasks.filter((s) => s.done).length, t.subtasks.length,
      t.subtasks.map((s) => `${s.done ? '✓' : '○'} ${s.text}`).join('\n'), t.notes.map((n) => n.text).join('\n—\n'),
      Math.round(trackedMs(t.id) / 60000), stampDate(t.doneAt),
    ]));
    add('المشاريع', [
      { title: 'المشروع', width: 28 }, { title: 'الوصف', width: 40, wrap: true }, { title: 'موعد الانتهاء', width: 13 },
      { title: 'الموعد الهجري', width: 22 }, { title: 'المهام', width: 9 }, { title: 'المنجزة', width: 9 },
      { title: 'الخطوات', width: 9 }, { title: 'الخطوات المنجزة', width: 10 }, { title: 'نسبة الإنجاز %', width: 12 },
    ], S.projects.map((p) => { const st = projectStats(p.id); return [p.name, p.desc, p.due, hijriOf(p.due), st.total, st.done, st.steps, st.stepsDone, st.progress]; }));
  }
  if (kind === 'all' || kind === 'goals') {
    add('الأهداف', [
      { title: 'الهدف', width: 32, wrap: true }, { title: 'النوع', width: 12 }, { title: 'الأيام', width: 22 },
      { title: 'البداية', width: 13 }, { title: 'النهاية / الموعد', width: 13 }, { title: 'الموعد الهجري', width: 22 },
      { title: 'العدد المطلوب', width: 10 }, { title: 'الوحدة', width: 10 }, { title: 'الإنجاز', width: 12 },
      { title: 'نسبة الالتزام %', width: 12 }, { title: 'السلسلة الحالية (يوم)', width: 12 }, { title: 'عادة', width: 8 }, { title: 'قوة العادة %', width: 11 }, { title: 'مرحلة العادة', width: 18 }, { title: 'الملاحظات', width: 36, wrap: true },
    ], S.tasks.filter(isGoal).map((t) => {
      if (isRepeat(t)) {
        const st = goalStats(t);
        const days = t.repeat.days.length === 7 ? 'يومياً' : DAY_ORDER.filter((d) => t.repeat.days.includes(d)).map((d) => DAY_SHORT[d]).join('، ');
        return [t.title, 'متكرر', days, t.repeat.start, t.repeat.until || 'بلا نهاية', hijriOf(t.repeat.until), t.target, t.unit,
          `${st.hit} من ${st.total} يوم`, st.rate, st.streak, yesNo(isHabit(t)), isHabit(t) ? habitStats(t).strength : '', isHabit(t) ? habitStats(t).stage[0] : '', t.notes.map((n) => n.text).join('\n—\n')];
      }
      return [t.title, 'لمرة واحدة', '', stampDate(t.created), t.due, hijriOf(t.due), t.target, t.unit,
        t.done ? 'تحقق' : `${countOn(t, today())} من ${t.target}`, pct(countOn(t, today()), t.target), '', 'لا', '', '', t.notes.map((n) => n.text).join('\n—\n')];
    }));
  }
  if (kind === 'all' || kind === 'memos') {
    add(pageName('notes'), [
      { title: 'العنوان', width: 28 }, { title: 'النص', width: 70, wrap: true }, { title: 'مثبتة', width: 8 },
      { title: 'تاريخ الإنشاء', width: 13 }, { title: 'آخر تعديل', width: 13 }, { title: 'تسجيلات صوتية', width: 12 },
    ], S.memos.slice().sort((a, b) => b.updated - a.updated).map((m) => [m.title, m.body, yesNo(m.pinned), stampDate(m.created), stampDate(m.updated), m.audios.length || '']));
  }
  if (kind === 'all' || kind === 'books') {
    add(pageName('books'), [
      { title: 'الكتاب', width: 30 }, { title: 'المؤلف', width: 20 }, { title: 'الحالة', width: 13 },
      { title: 'تاريخ البدء', width: 13 }, { title: 'البدء هجري', width: 22 }, { title: 'تاريخ الانتهاء أو التوقف', width: 13 },
      { title: 'الانتهاء هجري', width: 22 }, { title: 'مدة القراءة (يوم)', width: 11 }, { title: 'عدد الصفحات', width: 10 }, { title: 'الصفحة الحالية', width: 10 }, { title: 'فكرة موجزة', width: 60, wrap: true },
      { title: 'عدد الفوائد', width: 10 },
    ], BOOK_ORDER.flatMap((s) => S.books.filter((b) => b.status === s)).map((b) => [
      b.title, b.author, BOOK_STATUS[b.status], b.start, hijriOf(b.start), b.end, hijriOf(b.end),
      b.start && b.end ? daysBetween(b.start, b.end) + 1 : '', b.pages, b.page || '', b.summary, benefitsOf(b.id).length,
    ]));
  }
  if (kind === 'all' || kind === 'benefits') {
    add(pageName('benefits'), [
      { title: 'الكتاب', width: 28 }, { title: 'رقم الصفحة', width: 10 }, { title: 'عنوان الفائدة', width: 32, wrap: true },
      { title: 'نص الفائدة', width: 60, wrap: true }, { title: 'ما يمكن أن يُستفاد منها', width: 70, wrap: true }, { title: 'تاريخ الإضافة', width: 13 },
    ], S.benefits.slice().sort((a, b) => benefitBookTitle(a).localeCompare(benefitBookTitle(b), 'ar') || (a.page === '' ? 1e9 : a.page) - (b.page === '' ? 1e9 : b.page))
      .map((f) => [benefitBookTitle(f), f.page, f.title, [f.text, ...bvTexts(f)].filter(Boolean).join('\n'), f.lesson, stampDate(f.created)]));
  }
  if (kind === 'all' || kind === 'archive') {
    add(pageName('archive'), [
      { title: 'العنوان', width: 36, wrap: true }, { title: 'الرابط', width: 40 }, { title: 'النص', width: 50, wrap: true },
      { title: 'التصنيف', width: 14 }, { title: 'لماذا أحتفظ به', width: 30, wrap: true }, { title: 'رجعت إليه', width: 10 },
      { title: 'حُوّل إلى', width: 10 }, { title: 'تاريخ الحفظ', width: 13 },
    ], S.archive.slice().sort((a, b) => b.created - a.created).map((a) => [a.title, a.url, a.text, a.tag, a.note, yesNo(a.revisitedAt), a.convertedTo, stampDate(a.created)]));
  }
  if (kind === 'all' || kind === 'ideas') {
    add(pageName('ideas'), [
      { title: 'الفكرة', width: 50, wrap: true }, { title: 'تطويرها', width: 60, wrap: true }, { title: 'الوسم', width: 14 },
      { title: 'الحالة', width: 11 }, { title: 'مميزة', width: 8 }, { title: 'حُوّلت إلى', width: 10 }, { title: 'تاريخ التسجيل', width: 13 },
    ], S.ideas.slice().sort((a, b) => b.created - a.created).map((x) => [x.text, x.details, x.tag, IDEA_STATUS[x.status], yesNo(x.star), x.convertedTo, stampDate(x.created)]));
  }
  if (kind === 'all' || kind === 'journal') {
    add(pageName('journal'), [
      { title: 'التاريخ', width: 12 }, { title: 'الهجري', width: 22 }, { title: 'اليوم', width: 10 }, { title: 'القالب', width: 16 },
      { title: 'المزاج', width: 9 }, { title: 'النص', width: 90, wrap: true }, { title: 'عدد الكلمات', width: 10 },
    ], S.journal.filter((j) => !jEmpty(j)).sort((a, b) => b.date.localeCompare(a.date)).map((j) => [j.date, hijriOf(j.date), AR_DAYS[parse(j.date).getDay()], j.tplName, j.mood ? MOODS[j.mood - 1][1] : '',
      [...j.answers.filter((a) => a.a.trim()).map((a) => `${a.q}\n${a.a.trim()}`), j.body.trim()].filter(Boolean).join('\n\n'), wordCount(jText(j))]));
  }
  if (kind === 'all' || kind === 'hifz') {
    add(pageName('hifz'), [
      { title: 'النوع', width: 10 }, { title: 'العنوان', width: 28, wrap: true }, { title: 'المصدر', width: 24 }, { title: 'النص', width: 70, wrap: true },
      { title: 'الحالة', width: 12 }, { title: 'المراجعة القادمة', width: 14 }, { title: 'مرات المراجعة', width: 10 }, { title: 'مرات النسيان', width: 10 },
    ], S.hifz.map((h) => [HIFZ_TYPES[h.type][0], hzTitle(h), h.source, h.text, h.state === 'learn' ? 'أحفظه' : hzFirm(h) ? 'ثابت' : 'في المراجعة', h.due, h.reps, h.lapses]));
  }
  if (kind === 'all' || kind === 'people') {
    add(pageName('people'), [
      { title: 'الاسم', width: 20 }, { title: 'الصلة', width: 14 }, { title: 'الجوال', width: 14 }, { title: 'آخر تواصل', width: 12 }, { title: 'كم مرة تواصلت', width: 10 },
      { title: 'المناسبة', width: 12 }, { title: 'ما يحبه', width: 30, wrap: true }, { title: 'أفكار هدايا', width: 30, wrap: true }, { title: 'ملاحظات', width: 30, wrap: true },
    ], S.people.map((p) => [p.name, REL[p.rel], p.phone, lastContact(p), p.contacts.length, p.birthday, p.likes, p.gifts, p.notes]));
  }
  if (kind === 'all' || kind === 'decisions') {
    add('القرارات', [
      { title: 'القرار', width: 30, wrap: true }, { title: 'التاريخ', width: 12 }, { title: 'لماذا', width: 40, wrap: true }, { title: 'التوقع', width: 30, wrap: true },
      { title: 'الثقة', width: 8 }, { title: 'الحالة وقتها', width: 10 }, { title: 'ما حدث', width: 30, wrap: true }, { title: 'النتيجة', width: 10 }, { title: 'الدرس', width: 30, wrap: true },
      { title: 'حالة القرار', width: 12 }, { title: 'النوع', width: 18 }, { title: 'الخيار المختار', width: 22, wrap: true }, { title: 'آخر موعد للحسم', width: 12 }, { title: 'القرار الآن', width: 12 },
    ], S.decisions.slice().sort((a, b) => b.date.localeCompare(a.date)).map((x) => [x.title, x.date, x.reasons, x.expect, `${x.confidence}%`, DEC_STATE[x.state] || '', x.outcome, x.result ? DEC_RESULT[x.result][0] : '', x.lesson,
      DEC_STATUS[x.status], decKindName(x), x.orig ? x.orig.chosenName : '', x.deadline, x.verdict ? DEC_VERDICT[x.verdict] : '']));
  }
  if (kind === 'all' || kind === 'finance') {
    const flat = [];
    for (const p of S.finPlans) {
      const c = planCalc(p);
      flat.push([p.name, 'الدخل', '', '', c.income]);
      for (const x of p.income) flat.push([p.name, 'دخل', x.name, '', x.amount]);
      for (const x of p.fixed) flat.push([p.name, 'مصاريف شهرية ثابتة', x.name, '', x.amount]);
      for (const x of p.periodic) flat.push([p.name, 'مصاريف دورية', x.name, x.every, Math.round((x.amount / (x.every || 12)) * 100) / 100]);
      flat.push([p.name, 'المتبقي للادخار', '', '', Math.round(c.left * 100) / 100]);
    }
    add('الميزانيات', [{ title: 'الخطة', width: 26 }, { title: 'القسم', width: 18 }, { title: 'البند', width: 24 }, { title: 'كل كم شهر', width: 10 }, { title: 'المبلغ الشهري', width: 14 }], flat);
    add('الديون', [{ title: 'الدائن', width: 22 }, { title: 'الدَّين', width: 12 }, { title: 'المسدد', width: 12 }, { title: 'الباقي', width: 12 }, { title: 'القسط', width: 10 }, { title: 'الانتهاء المتوقع', width: 14 }, { title: 'ملاحظة', width: 30 }],
      S.finDebts.map((d) => [d.name, d.total, paid(d), debtLeft(d), d.monthly, debtEnd(d), d.note]));
    add('الحقوق', [{ title: 'لمن', width: 22 }, { title: 'المبلغ', width: 12 }, { title: 'المسدد', width: 12 }, { title: 'الباقي', width: 12 }, { title: 'ملاحظة', width: 30 }],
      LEDGERS.owe.list().map((r) => [r.name, r.amount, paid(r), rightLeft(r), r.note]));
    add('حقوقي', [{ title: 'عند', width: 22 }, { title: 'المبلغ', width: 12 }, { title: 'المستلم', width: 12 }, { title: 'الباقي', width: 12 }, { title: 'ملاحظة', width: 30 }],
      LEDGERS.right.list().map((r) => [r.name, r.amount, paid(r), rightLeft(r), r.note]));
    add('المصروف', [{ title: 'التاريخ', width: 12 }, { title: 'النوع', width: 8 }, { title: 'البند', width: 22 }, { title: 'المبلغ', width: 12 }, { title: 'ملاحظة', width: 30 }],
      S.finTx.slice().sort((a, b) => b.d.localeCompare(a.d)).map((t) => [t.d, t.kind === 'in' ? 'دخل' : 'صرف', t.item, t.amount, t.note]));
  }
  if (kind === 'all' || kind === 'inspire') {
    add('العبارات', [
      { title: 'العبارة', width: 60, wrap: true }, { title: 'النوع', width: 16 }, { title: 'القائل أو المصدر', width: 24 },
      { title: 'مفضّلة', width: 8 }, { title: 'تاريخ الإضافة', width: 13 },
    ], S.inspire.filter((x) => x.type !== 'image').map((x) => [x.text, QUOTE_KIND[x.type], x.source, yesNo(x.fav), stampDate(x.created)]));
  }
  return sheets;
}

const XLS_NAMES = { finance: 'mahami-finance', hifz: 'mahami-hifz', people: 'mahami-people', decisions: 'mahami-decisions', ideas: 'mahami-ideas', journal: 'mahami-journal', archive: 'mahami-archive', inspire: 'mahami-quotes', all: 'mahami', tasks: 'mahami-tasks', goals: 'mahami-goals', memos: 'mahami-notes', books: 'mahami-books', benefits: 'mahami-benefits' };
function exportExcel(kind) {
  const blob = Xlsx.build(excelSheets(kind));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${XLS_NAMES[kind] || 'mahami'}-${today()}.xlsx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('جُهّز ملف الإكسل. تجده في التنزيلات.');
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="lib-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'lib-new-memo': openMemo(null); break;
    case 'lib-voice-memo': openMemo(null); setTimeout(startRecording, 150); break;
    case 'lib-new-book': openLib('book'); break;
    case 'lib-new-benefit': openLib('benefit'); break;
    case 'lib-open-memo': openMemo(v); break;
    case 'lib-open-book': openLib('book', v); break;
    case 'lib-book-bens': openBookBenefits(v); break;
    case 'lib-ben-read': libUi.benRead = !libUi.benRead; render(); break;
    case 'lib-open-benefit': {
      const back = libBackFrom();
      // the book's own changes are kept before its benefit opens, as when adding one
      if (back && back.kind === 'book' && !saveLib()) break;
      openLib('benefit', v);
      ldraft.back = back;
      break;
    }
    case 'lib-bk-tab':
      ldraft.tab = v;
      $('bkData').hidden = v !== 'data';
      $('bkBens').hidden = v !== 'bens';
      for (const b of $('bkTabs').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      break;
    case 'lib-book-status': libUi.bookStatus = v; libUi.bookQ = ''; render(); break;
    case 'lib-status':
      ldraft.status = v;
      for (const b of $('lStatus').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      // a new book's start date filled in by itself (today, for «أقرؤه الآن») goes when another status is chosen:
      // a book marked «مقروء» right away was read in the past, so it takes no dates
      if (ldraft.isNew && v !== 'reading' && $('lStart').value === today() && !ldraft.startTyped) $('lStart').value = '';
      if (v === 'reading' && !$('lStart').value) $('lStart').value = today();
      // (a book read in the past, with no start date, takes no end date: it is not read this year)
      if (v === 'read' && !$('lEnd').value && $('lStart').value) $('lEnd').value = today();
      updateBookEnd();
      break;
    case 'lib-benefit-from-book': {
      const id = ldraft.id;
      const back = libBackFrom();
      if (ldraft.kind !== 'bookbens' && !saveLib()) break;
      closeLib();
      render();
      openLib('benefit', null, { bookId: id });
      ldraft.back = back;
      break;
    }
    case 'lib-close': { const back = ldraft && ldraft.back; closeLib(); libBack(back); break; }
    case 'lib-delete': {
      if (!libArmed) {
        libArmed = true; el.textContent = 'تأكيد الحذف'; el.classList.add('armed');
        setTimeout(() => { libArmed = false; if (el.isConnected) { el.textContent = 'حذف'; el.classList.remove('armed'); } }, 3000);
        break;
      }
      const back = ldraft.back;
      deleteLib();
      closeLib();
      render();
      libBack(back);
      toast('حُذف');
      break;
    }
    case 'lib-xls': exportExcel(v); break;
    case 'lib-book-review': openBookReview(v); break;
    case 'lib-rv-show': $('brvShow').hidden = false; el.hidden = true; $('brvDone').hidden = false; break;
    case 'lib-rv-later': { const b = getBook(ldraft.id); b.rvDue = addDays(today(), 7); save(); closeLib(); render(); toast('سأذكّرك بعد أسبوع'); break; }
    case 'lib-rv-stop': { const b = getBook(ldraft.id); b.rv = false; save(); closeLib(); render(); toast('أُخرج من المراجعة'); break; }
    case 'lib-reviewed': {
      const f = getBenefit(v);
      if (f) { f.lastReview = today(); f.reviews = (f.reviews || 0) + 1; save(); render(); toast('أحسنت! ستظهر لك فائدة أخرى غداً'); }
      break;
    }
    case 'lib-to-action': benefitToAction(v); break;
    case 'lib-set-goal': {
      const f = $('libForm');
      ldraft = { kind: 'rgoal', id: 'goal', isNew: false };
      f.innerHTML = `<div class="sheet-head"><h2>هدف القراءة لعام ${today().slice(0, 4)}</h2>
        <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <label class="field"><span>كم كتاباً تريد أن تقرأ هذا العام؟</span><input type="number" id="lGoal" min="0" max="500" inputmode="numeric" value="${S.settings.readingGoal || ''}" placeholder="مثال: 24"></label>
        <p class="note-text explain">نقارن ما أنهيته بما يُفترض أن تكون وصلت إليه حتى اليوم، لتعرف هل أنت متقدّم أو متأخر. اكتب ٠ لإلغاء الهدف.</p>
        <div class="sheet-actions"><button type="submit" class="primary">حفظ</button></div>`;
      const d = lsheet();
      if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
      break;
    }
  }
});

// recall a finished book: first try to remember, then compare with what you wrote down
function openBookReview(id) {
  const b = getBook(id);
  ldraft = { kind: 'brev', id, isNew: false };
  const fx = benefitsOf(id);
  const pts = b.rvPoints.split('\n').map((x) => x.trim()).filter(Boolean);
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>🔁 استذكار «${esc(b.title)}»</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="note-text">${b.author ? `${esc(b.author)} | ` : ''}أنهيته ${esc(b.end ? relDate(b.end) : '')}${b.rvLog.length ? ` | الاستذكار رقم ${b.rvLog.length + 1}` : ' | الاستذكار الأول'}</p>
    <label class="field"><span>قبل أن ترى ما سجّلته: ماذا تتذكر من هذا الكتاب؟</span><textarea id="brvRecall" rows="4" placeholder="اكتب ما يحضرك من أفكاره (اختياري)"></textarea></label>
    <button type="button" class="ghost" data-action="lib-rv-show">أظهر ما سجّلته</button>
    <div id="brvShow" class="brv-show" hidden>
      ${pts.length ? `<h3>ما أردت أن أتذكره</h3><ul>${pts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${b.summary ? `<h3>فكرته</h3><p>${esc(b.summary)}</p>` : ''}
      ${fx.length ? `<h3>فوائدي منه (${fx.length})</h3><div class="bk-bens">${fx.sort((a, c) => (a.page || 0) - (c.page || 0)).map((f) => `<div class="bk-ben"><span class="ben-head"><b>${esc(f.title || 'فائدة')}</b>${f.page !== '' ? `<small>صفحة ${f.page}</small>` : ''}</span>${benBody(f)}</div>`).join('')}</div>` : ''}
      ${!pts.length && !b.summary && !fx.length ? '<p class="note-text">لم تسجّل شيئاً من هذا الكتاب بعد. أضف نقاطاً أو فوائد لتستذكرها في المرة القادمة.</p>' : ''}
      ${b.rvLog.filter((e) => e.recall).length ? `<details class="howto"><summary>ما تذكرته في المرات السابقة</summary>${b.rvLog.filter((e) => e.recall).map((e) => `<p><small>${esc(dateBoth(e.d, true))}</small><br>${esc(e.recall)}</p>`).join('')}</details>` : ''}
    </div>
    <div class="sheet-actions">
      <button type="submit" class="primary" id="brvDone" hidden>✓ استذكرته</button>
      <button type="button" class="ghost" data-action="lib-rv-later">بعد أسبوع</button>
      <button type="button" class="ghost" data-action="lib-rv-stop">أوقف الاستذكار</button>
    </div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function saveBookReview() {
  const b = getBook(ldraft.id);
  b.rvLog.push({ d: today(), recall: $('brvRecall').value.trim() });
  b.rvStep = Math.min(b.rvStep + 1, BOOK_RV.length - 1);
  b.rvDue = addDays(today(), BOOK_RV[b.rvStep]);
  save();
  toast(`أحسنت! الاستذكار القادم ${afterDays(BOOK_RV[b.rvStep])}`);
  return true;
}

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'libForm') return;
  e.preventDefault();
  const wasNew = ldraft.isNew;
  if (ldraft.kind === 'rgoal') {
    S.settings.readingGoal = Math.max(0, parseInt($('lGoal').value, 10) || 0);
    save(); closeLib(); render(); toast(S.settings.readingGoal ? 'حُفظ هدف القراءة' : 'أُلغي هدف القراءة');
    return;
  }
  if (ldraft.kind === 'jexport') { if (runJExport()) closeLib(); return; }
  const kind = ldraft.kind, quick = ldraft.quick, back = ldraft.back;
  const saver = { quote: saveQuote, arch: saveArch, idea: saveIdea, jtpl: saveJTpl, hifz: saveHifz, hplan: savePlan, readnote: saveReadNote, layout: saveLayout, list: saveList, fine: saveFine, debt: saveLedger, right: saveLedger, owe: saveLedger, pay: savePayment, finimport: runFinImport, finnew: saveFinNew, finmove: saveFinMove, finexp: runFinExport, meal: saveMeal, mealimp: saveMealImport, sub: saveSub, later: saveLater, cvsec: saveCVSection, person: savePerson, contact: saveContact, decision: saveDecision, quit: saveQuit, slip: saveSlip, brev: saveBookReview, dur: saveDuration, remquick: saveRemQuick, decopt: saveDecOpt, deccrit: saveDecCrit, ssci: saveSci, sbook: saveSBook, slesson: saveLesson, spaste: saveStudyPaste }[kind] || saveLib;
  const silent = ['contact', 'slip', 'brev', 'hifz', 'pay', 'finimport', 'cvsec', 'finmove', 'finexp', 'mealimp', 'layout', 'readnote', 'dur', 'remquick', 'spaste'].includes(kind);
  if (!saver()) return;
  closeLib();
  render();
  libBack(back);
  if (!silent) toast(kind === 'idea' && wasNew ? (quick ? `حُفظت الفكرة في «${pageName('ideas')}»` : 'حُفظت الفكرة') : wasNew ? 'أُضيفت' : 'حُفظت التعديلات');
});

document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'memoSearch') { libUi.memoQ = e.target.value; render(); }
  if (id === 'bookSearch') { libUi.bookQ = e.target.value; render(); }
  if (id === 'benefitSearch') { libUi.benefitQ = e.target.value; render(); }
});
document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (id === 'lRv') $('lRvPointsW').hidden = !e.target.checked;
  if (id === 'benefitBook') { libUi.benefitBook = e.target.value; render(); }
  if (id === 'lStart' && ldraft) ldraft.startTyped = true;
  if (id === 'lStart' && $('lStartH')) $('lStartH').textContent = e.target.value ? fmtHijri(e.target.value) : '';
  if (id === 'lEnd' && $('lEndH')) $('lEndH').textContent = e.target.value ? fmtHijri(e.target.value) : '';
});
document.addEventListener('click', (e) => {
  const d = $('libSheet');
  if (d && e.target === d) closeLib();
});

const LibraryViews = {
  more: viewMore,
  notes: viewNotes,
  books: viewBooks,
  benefits: viewBenefits,
};
