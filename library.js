'use strict';
// Notes, books, benefits (فوائد), the «المزيد» page and Excel export.
// Loaded before app.js; uses its helpers at call time.

const BOOK_STATUS = { reading: 'أقرؤه الآن', read: 'مقروء', want: 'أريد قراءته', stalled: 'متعثر' };
const BOOK_STATUS_PLURAL = { reading: 'أقرؤها الآن', read: 'المقروءة', want: 'أريد قراءتها', stalled: 'المتعثرة' };
const BOOK_ORDER = ['reading', 'read', 'want', 'stalled'];
const libUi = { memoQ: '', bookStatus: 'reading', bookQ: '', benefitBook: '', benefitQ: '' };

function normalizeMemo(m) {
  return {
    id: m.id || uid(), title: String(m.title || ''), body: String(m.body || ''), pinned: !!m.pinned,
    created: m.created || Date.now(), updated: m.updated || m.created || Date.now(),
  };
}
function normalizeBook(b) {
  return {
    id: b.id || uid(), title: String(b.title || ''), author: String(b.author || ''),
    status: BOOK_STATUS[b.status] ? b.status : 'want', start: b.start || '', end: b.end || '',
    summary: String(b.summary || ''), created: b.created || Date.now(),
  };
}
function normalizeBenefit(f) {
  const page = parseInt(f.page, 10);
  return {
    id: f.id || uid(), bookId: f.bookId || '', book: String(f.book || ''), page: Number.isFinite(page) ? page : '',
    title: String(f.title || ''), lesson: String(f.lesson || ''), created: f.created || Date.now(),
  };
}

const getMemo = (id) => S.memos.find((m) => m.id === id);
const getBook = (id) => S.books.find((b) => b.id === id);
const getBenefit = (id) => S.benefits.find((f) => f.id === id);
const benefitBookTitle = (f) => (f.bookId && getBook(f.bookId) ? getBook(f.bookId).title : f.book) || 'بلا كتاب';
const benefitsOf = (bookId) => S.benefits.filter((f) => f.bookId === bookId);
const excerpt = (s, n) => (s.length > n ? s.slice(0, n).trim() + '…' : s);
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

// a date with its Hijri equivalent, e.g. «16 أكتوبر 2026 · 4 جمادى الأولى 1448 هـ»
function dateBoth(d, short) {
  if (!d) return '';
  const g = fmtDate(d, short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' });
  if (!S.settings.hijri) return g;
  return `${g} · ${fmtHijri(d, short ? { day: 'numeric', month: 'long' } : undefined)}`;
}

const moreCrumb = () => `<div class="crumbs"><button type="button" class="back" data-tab="more">${icon('back')} المزيد</button></div>`;
const xlsBtn = (kind) => `<button type="button" class="xls-btn" data-action="lib-xls" data-v="${kind}">${icon('sheet')}إكسل</button>`;

// ---------- «المزيد» page ----------
function viewMore() {
  const readThisYear = S.books.filter((b) => b.status === 'read' && (b.end || '').slice(0, 4) === today().slice(0, 4)).length;
  const tiles = [
    ['notes', 'note', 'الملاحظات', S.memos.length ? `${S.memos.length} ملاحظة` : 'لا ملاحظات بعد'],
    ['books', 'book', 'الكتب', S.books.length ? `${S.books.length} كتاب · قرأت ${readThisYear} هذا العام` : 'سجّل قراءاتك'],
    ['benefits', 'bulb', 'الفوائد', S.benefits.length ? `${S.benefits.length} فائدة` : 'فوائد من قراءاتك'],
    ['stats', 'chart', 'الإحصائيات', 'إنجازك ومشاريعك وأهدافك'],
    ['timer', 'clock', 'المؤقت', S.timer ? 'يعمل الآن' : 'تتبّع وقتك'],
    ['settings', 'gear', 'الإعدادات', 'المظهر والخط والصلاة والمنبهات'],
  ];
  return `
  <section class="section">
    <h2>المزيد</h2>
    <div class="more-grid">${tiles.map(([tab, ic, name, sub]) => `<button type="button" class="more-tile" data-tab="${tab}">${icon(ic)}<b>${name}</b><small>${esc(sub)}</small></button>`).join('')}</div>
  </section>
  <section class="panel">
    <h2>تصدير إلى إكسل</h2>
    <p class="note-text">ملف إكسل واحد فيه صفحة لكل قسم: المهام والمشاريع والأهداف والملاحظات والكتب والفوائد. يفتح في Excel وGoogle Sheets.</p>
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
    ${m.body ? `<p>${esc(excerpt(m.body, 220))}</p>` : ''}
    <small>${esc(m.updated > m.created + 60000 ? `عُدّلت ${relDate(iso(new Date(m.updated)))}` : relDate(iso(new Date(m.created))))} · ${esc(fmtTime(hmOf(new Date(m.updated).getHours() * 60 + new Date(m.updated).getMinutes())))}</small>
  </button>`;
}

function viewNotes() {
  const q = libUi.memoQ.trim().toLowerCase();
  const list = S.memos.filter((m) => !q || m.title.toLowerCase().includes(q) || m.body.toLowerCase().includes(q))
    .sort((a, b) => b.pinned - a.pinned || b.updated - a.updated);
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الملاحظات</h2><div class="btn-row">${S.memos.length ? xlsBtn('memos') : ''}${addBtn('lib-new-memo', 'ملاحظة')}</div></div>
    ${S.memos.length ? `<input type="search" id="memoSearch" placeholder="ابحث في الملاحظات" aria-label="بحث" value="${esc(libUi.memoQ)}">` : ''}
    ${list.length ? `<div class="memo-grid">${list.map(memoCard).join('')}</div>`
      : S.memos.length ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى.')
        : emptyHTML('لا ملاحظات بعد', 'اكتب أفكارك وخواطرك هنا، كل ملاحظة مستقلة بعنوانها.', addBtn('lib-new-memo', 'أول ملاحظة'))}
  </section>`;
}

// ---------- books ----------
function bookLine(b) {
  const t0 = today();
  if (b.status === 'reading') return b.start ? `بدأت ${dateBoth(b.start, true)} · منذ ${daysWord(Math.max(0, daysBetween(b.start, t0)))}` : 'لم تحدد تاريخ البدء';
  if (b.status === 'read') {
    const parts = [];
    if (b.start) parts.push(`من ${dateBoth(b.start, true)}`);
    if (b.end) parts.push(`إلى ${dateBoth(b.end, true)}`);
    if (b.start && b.end) parts.push(`(${daysWord(daysBetween(b.start, b.end) + 1)})`);
    return parts.join(' ') || 'مقروء';
  }
  if (b.status === 'stalled') return b.start ? `بدأته ${dateBoth(b.start, true)} وتوقفت` : 'توقفت عن قراءته';
  return `أضيف ${relDate(iso(new Date(b.created)))}`;
}

function bookCard(b) {
  const n = benefitsOf(b.id).length;
  return `<button type="button" class="book-card s-${b.status}" data-action="lib-open-book" data-v="${b.id}">
    <span class="book-top"><strong>${esc(b.title)}</strong>${b.author ? `<small>${esc(b.author)}</small>` : ''}</span>
    <span class="book-line">${icon('cal')}${esc(bookLine(b))}</span>
    ${b.summary ? `<p>${esc(excerpt(b.summary, 160))}</p>` : ''}
    ${n ? `<span class="book-line">${icon('bulb')}${n} ${n === 1 ? 'فائدة' : n === 2 ? 'فائدتان' : 'فوائد'}</span>` : ''}
  </button>`;
}

function viewBooks() {
  const counts = Object.fromEntries(BOOK_ORDER.map((s) => [s, S.books.filter((b) => b.status === s).length]));
  const st = libUi.bookStatus;
  const q = libUi.bookQ.trim().toLowerCase();
  const list = S.books.filter((b) => (q ? true : b.status === st) && (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.summary.toLowerCase().includes(q)))
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
    <div class="seg seg-wrap" role="group" aria-label="حالة الكتب">${seg}</div>
    ${S.books.length > 5 ? `<input type="search" id="bookSearch" placeholder="ابحث في كل الكتب" aria-label="بحث" value="${esc(libUi.bookQ)}">` : ''}
    ${list.length ? `<div class="book-list">${list.map(bookCard).join('')}</div>`
      : q ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى.') : emptyHTML(empties[st][0], empties[st][1], addBtn('lib-new-book', 'أضف كتاباً'))}
  </section>`;
}

// ---------- benefits ----------
function benefitCard(f) {
  return `<button type="button" class="benefit" data-action="lib-open-benefit" data-v="${f.id}">
    <strong>${esc(f.title || 'فائدة')}</strong>
    <span class="book-line">${icon('book')}${esc(benefitBookTitle(f))}${f.page !== '' ? ` · ص ${f.page}` : ''}</span>
    ${f.lesson ? `<p>${esc(excerpt(f.lesson, 260))}</p>` : ''}
  </button>`;
}

function viewBenefits() {
  const q = libUi.benefitQ.trim().toLowerCase();
  const fb = libUi.benefitBook;
  const titles = [...new Set(S.benefits.map(benefitBookTitle))].sort((a, b) => a.localeCompare(b, 'ar'));
  const list = S.benefits.filter((f) => (!fb || benefitBookTitle(f) === fb) &&
    (!q || f.title.toLowerCase().includes(q) || f.lesson.toLowerCase().includes(q) || benefitBookTitle(f).toLowerCase().includes(q)))
    .sort((a, b) => (fb ? (a.page === '' ? 1e9 : a.page) - (b.page === '' ? 1e9 : b.page) : b.created - a.created));
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الفوائد</h2><div class="btn-row">${S.benefits.length ? xlsBtn('benefits') : ''}${addBtn('lib-new-benefit', 'فائدة')}</div></div>
    ${S.benefits.length ? `<div class="toolbar">
      <input type="search" id="benefitSearch" placeholder="ابحث في الفوائد" aria-label="بحث" value="${esc(libUi.benefitQ)}">
      <select id="benefitBook" aria-label="الكتاب"><option value="">كل الكتب</option>${titles.map((t) => `<option value="${esc(t)}"${t === fb ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
    </div>` : ''}
    ${list.length ? `<div class="book-list">${list.map(benefitCard).join('')}</div>`
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
    <p class="note-text">قرأت <b>${readYear.length}</b> ${readYear.length === 1 ? 'كتاباً' : 'كتب'} هذا العام${avg ? ` · متوسط الكتاب ${daysWord(avg)}` : ''} · سجّلت <b>${S.benefits.length}</b> فائدة</p>
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
      ${id ? `<p class="note-text">أُنشئت ${esc(dateBoth(iso(new Date(m.created)), true))}${m.updated > m.created + 60000 ? ` · عُدّلت ${esc(dateBoth(iso(new Date(m.updated)), true))}` : ''}</p>` : ''}`;
  } else if (kind === 'book') {
    const b = id ? getBook(id) : normalizeBook({ status: preset.status || libUi.bookStatus, start: (preset.status || libUi.bookStatus) === 'reading' ? today() : '' });
    ldraft.status = b.status;
    const n = id ? benefitsOf(id).length : 0;
    body = `
      <label class="field"><span>اسم الكتاب</span><input type="text" id="lTitle" value="${esc(b.title)}" autocomplete="off" placeholder="مثال: الأيام"></label>
      <label class="field"><span>المؤلف (اختياري)</span><input type="text" id="lAuthor" value="${esc(b.author)}" autocomplete="off" placeholder="مثال: طه حسين"></label>
      <div class="field"><span>الحالة</span><div class="seg seg-wrap" id="lStatus">${BOOK_ORDER.map((s) => `<button type="button" data-action="lib-status" data-v="${s}" aria-pressed="${b.status === s}">${BOOK_STATUS[s]}</button>`).join('')}</div></div>
      <div class="grid2">
        <label class="field"><span>تاريخ البدء</span><input type="date" id="lStart" value="${b.start}"><small class="hint" id="lStartH">${esc(b.start ? fmtHijri(b.start) : '')}</small></label>
        <label class="field" id="lEndWrap"><span>تاريخ الانتهاء</span><input type="date" id="lEnd" value="${b.end}"><small class="hint" id="lEndH">${esc(b.end ? fmtHijri(b.end) : '')}</small></label>
      </div>
      <label class="field"><span>فكرة موجزة عن الكتاب</span><textarea id="lSummary" rows="5" placeholder="عمّ يتحدث الكتاب؟ وما أهم ما خرجت به؟">${esc(b.summary)}</textarea></label>
      ${id ? `<div class="row-between"><span class="note-text">${n ? `${n} ${n === 1 ? 'فائدة' : 'فوائد'} من هذا الكتاب` : 'لا فوائد مسجلة من هذا الكتاب'}</span><button type="button" class="ghost" data-action="lib-benefit-from-book">${icon('plus')} أضف فائدة منه</button></div>` : ''}`;
  } else {
    const fx = id ? getBenefit(id) : normalizeBenefit({ bookId: preset.bookId || '', book: preset.book || '' });
    const bookTitle = id ? benefitBookTitle(fx) : (preset.bookId ? getBook(preset.bookId).title : preset.book || '');
    body = `
      <label class="field"><span>اسم الكتاب</span><input type="text" id="lBook" value="${esc(bookTitle === 'بلا كتاب' ? '' : bookTitle)}" list="bookTitles" autocomplete="off" placeholder="اختر من كتبك أو اكتب اسماً"></label>
      <datalist id="bookTitles">${S.books.map((b) => `<option value="${esc(b.title)}">`).join('')}</datalist>
      <label class="field"><span>رقم الصفحة</span><input type="number" id="lPage" min="0" inputmode="numeric" value="${fx.page}" placeholder="مثال: 45"></label>
      <label class="field"><span>عنوان الفائدة</span><input type="text" id="lTitle" value="${esc(fx.title)}" autocomplete="off" placeholder="مثال: أثر العادة في النجاح"></label>
      <label class="field"><span>ما يمكن أن يُستفاد منها</span><textarea id="lLesson" rows="6" placeholder="اكتب الفائدة وكيف تطبّقها">${esc(fx.lesson)}</textarea></label>`;
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
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  f.scrollTop = 0;
  setTimeout(() => {
    const first = kind === 'benefit' && !preset.bookId && !preset.book ? 'lBook' : kind === 'benefit' ? 'lPage' : 'lTitle';
    const a = document.activeElement;
    if (isNew && d.open && !(a && a.closest && a.closest('#libForm input, #libForm textarea')) && $(first)) $(first).focus();
  }, 50);
}

function updateBookEnd() {
  if (!ldraft || ldraft.kind !== 'book') return;
  $('lEndWrap').hidden = !['read', 'stalled'].includes(ldraft.status);
  $('lEndWrap').querySelector('span').textContent = ldraft.status === 'stalled' ? 'تاريخ التوقف' : 'تاريخ الانتهاء';
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
    let start = v('lStart'), end = ['read', 'stalled'].includes(ldraft.status) ? v('lEnd') : '';
    if (ldraft.status === 'read' && !end) end = today();
    if (ldraft.status === 'reading' && !start) start = today();
    if (start && end && end < start) { toast('تاريخ الانتهاء قبل تاريخ البدء.'); return false; }
    const old = getBook(id);
    const b = normalizeBook({ ...(old || {}), id, title, author: v('lAuthor'), status: ldraft.status, start, end, summary: $('lSummary').value.trim() });
    if (old) {
      // keep the benefits' book name in sync
      for (const f of benefitsOf(id)) f.book = title;
      Object.assign(old, b);
    } else S.books.push(b);
    libUi.bookStatus = b.status;
  } else {
    const title = v('lTitle'), lesson = $('lLesson').value.trim(), bookName = v('lBook');
    if (!title && !lesson) { toast('اكتب عنوان الفائدة أو نصها.'); return false; }
    const book = S.books.find((b) => b.title === bookName);
    const old = getBenefit(id);
    const f = normalizeBenefit({ ...(old || {}), id, title, lesson, page: v('lPage'), bookId: book ? book.id : '', book: bookName });
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
      { title: 'نسبة الالتزام %', width: 12 }, { title: 'السلسلة الحالية (يوم)', width: 12 }, { title: 'الملاحظات', width: 36, wrap: true },
    ], S.tasks.filter(isGoal).map((t) => {
      if (isRepeat(t)) {
        const st = goalStats(t);
        const days = t.repeat.days.length === 7 ? 'يومياً' : DAY_ORDER.filter((d) => t.repeat.days.includes(d)).map((d) => DAY_SHORT[d]).join('، ');
        return [t.title, 'متكرر', days, t.repeat.start, t.repeat.until || 'بلا نهاية', hijriOf(t.repeat.until), t.target, t.unit,
          `${st.hit} من ${st.total} يوم`, st.rate, st.streak, t.notes.map((n) => n.text).join('\n—\n')];
      }
      return [t.title, 'لمرة واحدة', '', stampDate(t.created), t.due, hijriOf(t.due), t.target, t.unit,
        t.done ? 'تحقق' : `${countOn(t, today())} من ${t.target}`, pct(countOn(t, today()), t.target), '', t.notes.map((n) => n.text).join('\n—\n')];
    }));
  }
  if (kind === 'all' || kind === 'memos') {
    add('الملاحظات', [
      { title: 'العنوان', width: 28 }, { title: 'النص', width: 70, wrap: true }, { title: 'مثبتة', width: 8 },
      { title: 'تاريخ الإنشاء', width: 13 }, { title: 'آخر تعديل', width: 13 },
    ], S.memos.slice().sort((a, b) => b.updated - a.updated).map((m) => [m.title, m.body, yesNo(m.pinned), stampDate(m.created), stampDate(m.updated)]));
  }
  if (kind === 'all' || kind === 'books') {
    add('الكتب', [
      { title: 'الكتاب', width: 30 }, { title: 'المؤلف', width: 20 }, { title: 'الحالة', width: 13 },
      { title: 'تاريخ البدء', width: 13 }, { title: 'البدء هجري', width: 22 }, { title: 'تاريخ الانتهاء أو التوقف', width: 13 },
      { title: 'الانتهاء هجري', width: 22 }, { title: 'مدة القراءة (يوم)', width: 11 }, { title: 'فكرة موجزة', width: 60, wrap: true },
      { title: 'عدد الفوائد', width: 10 },
    ], BOOK_ORDER.flatMap((s) => S.books.filter((b) => b.status === s)).map((b) => [
      b.title, b.author, BOOK_STATUS[b.status], b.start, hijriOf(b.start), b.end, hijriOf(b.end),
      b.start && b.end ? daysBetween(b.start, b.end) + 1 : '', b.summary, benefitsOf(b.id).length,
    ]));
  }
  if (kind === 'all' || kind === 'benefits') {
    add('الفوائد', [
      { title: 'الكتاب', width: 28 }, { title: 'رقم الصفحة', width: 10 }, { title: 'عنوان الفائدة', width: 32, wrap: true },
      { title: 'ما يمكن أن يُستفاد منها', width: 70, wrap: true }, { title: 'تاريخ الإضافة', width: 13 },
    ], S.benefits.slice().sort((a, b) => benefitBookTitle(a).localeCompare(benefitBookTitle(b), 'ar') || (a.page === '' ? 1e9 : a.page) - (b.page === '' ? 1e9 : b.page))
      .map((f) => [benefitBookTitle(f), f.page, f.title, f.lesson, stampDate(f.created)]));
  }
  return sheets;
}

const XLS_NAMES = { all: 'mahami', tasks: 'mahami-tasks', goals: 'mahami-goals', memos: 'mahami-notes', books: 'mahami-books', benefits: 'mahami-benefits' };
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
    case 'lib-new-memo': openLib('memo'); break;
    case 'lib-new-book': openLib('book'); break;
    case 'lib-new-benefit': openLib('benefit'); break;
    case 'lib-open-memo': openLib('memo', v); break;
    case 'lib-open-book': openLib('book', v); break;
    case 'lib-open-benefit': openLib('benefit', v); break;
    case 'lib-book-status': libUi.bookStatus = v; libUi.bookQ = ''; render(); break;
    case 'lib-status':
      ldraft.status = v;
      for (const b of $('lStatus').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      if (v === 'reading' && !$('lStart').value) $('lStart').value = today();
      if (v === 'read' && !$('lEnd').value) $('lEnd').value = today();
      updateBookEnd();
      break;
    case 'lib-benefit-from-book': {
      const id = ldraft.id;
      if (!saveLib()) break;
      closeLib();
      render();
      openLib('benefit', null, { bookId: id });
      break;
    }
    case 'lib-close': closeLib(); break;
    case 'lib-delete': {
      if (!libArmed) {
        libArmed = true; el.textContent = 'تأكيد الحذف'; el.classList.add('armed');
        setTimeout(() => { libArmed = false; if (el.isConnected) { el.textContent = 'حذف'; el.classList.remove('armed'); } }, 3000);
        break;
      }
      deleteLib();
      closeLib();
      render();
      toast('حُذف');
      break;
    }
    case 'lib-xls': exportExcel(v); break;
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'libForm') return;
  e.preventDefault();
  const wasNew = ldraft.isNew;
  if (!saveLib()) return;
  closeLib();
  render();
  toast(wasNew ? 'أُضيفت' : 'حُفظت التعديلات');
});

document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'memoSearch') { libUi.memoQ = e.target.value; render(); }
  if (id === 'bookSearch') { libUi.bookQ = e.target.value; render(); }
  if (id === 'benefitSearch') { libUi.benefitQ = e.target.value; render(); }
});
document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (id === 'benefitBook') { libUi.benefitBook = e.target.value; render(); }
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
