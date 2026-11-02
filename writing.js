'use strict';
// «مؤلفاتي» (v154, the owner: «أنا أستمع وورد في كتابة الكتب فأريد بدلا يعطني الراحة التي فيه ويغنيني عن 43 ريال
// أدفعها لهم» then «أنا أريده في تطبيق الوعي الشخصي، كيف؟», and his answers: both devices; footnotes, chapters and
// headings and an index, output for print, his current books brought in from Word; Claude to help. Stage 1 of five
// («أ: نعم، ابدأ بالمرحلة ١»): books of chapters written in a full-screen editor (headings, bold, italic, a verse box
// ﴿﴾, a quotation, footnotes), undo, find and replace, word count, saved as one types, in the backup, and a Word file
// with real footnotes at the foot of the page.
// A book is large: it is kept in this device's big store (IndexedDB «mahami-writing»), not in S (localStorage, shared
// with «مساعد المعلم» and written whole at every save), and it is not synced yet (stage 3).

const WBooks = (() => {
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((ok, no) => {
    const r = indexedDB.open('mahami-writing', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('books', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { dbp = null; no(r.error); };
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((ok, no) => {
      const t = d.transaction('books', mode);
      const st = t.objectStore('books');
      const req = fn(st);
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => no(t.error);
      t.onabort = () => no(t.error);
    });
  };
  return {
    all: () => tx('readonly', (s) => s.getAll()).then((l) => (l || []).map(normalizeWBook)),
    put: (b) => tx('readwrite', (s) => s.put(b)),
    del: (id) => tx('readwrite', (s) => s.delete(id)),
    clear: () => tx('readwrite', (s) => s.clear()),
    forget: () => { if (dbp) dbp.then((d) => d.close()).catch(() => {}); dbp = null; },
  };
})();

function normalizeWChapter(c) {
  c = c && typeof c === 'object' ? c : {};
  const notes = {};
  if (c.notes && typeof c.notes === 'object') for (const [k, v] of Object.entries(c.notes)) if (typeof v === 'string') notes[k] = v;
  return { id: c.id || uid(), title: typeof c.title === 'string' ? c.title : '', html: typeof c.html === 'string' ? c.html : '', notes, updated: Number(c.updated) || Date.now() };
}
function normalizeWBook(b) {
  b = b && typeof b === 'object' ? b : {};
  return { id: b.id || uid(), title: typeof b.title === 'string' ? b.title : '', created: Number(b.created) || Date.now(), updated: Number(b.updated) || Date.now(), chapters: (Array.isArray(b.chapters) ? b.chapters : []).map(normalizeWChapter) };
}

const wrUi = { list: null, loading: false, book: '', armed: '', find: '' };
const wrBook = (id) => (wrUi.list || []).find((b) => b.id === id);
function wrLoad() {
  if (wrUi.loading) return;
  wrUi.loading = true;
  WBooks.all().then((l) => { wrUi.list = l.sort((a, c) => c.updated - a.updated); }).catch(() => { wrUi.list = []; })
    .finally(() => { wrUi.loading = false; if (ui.tab === 'writing') render(); });
}
function wrSave(b) {
  b.updated = Date.now();
  return WBooks.put(b).catch(() => toast('تعذّر الحفظ في الجهاز. لا تغلق التطبيق، وصدّر نسخة احتياطية'));
}

// ---------- text helpers ----------
// what a chapter keeps: paragraphs, two levels of headings, a verse box, a quotation, bold, italic, line breaks and
// footnote marks; anything else pasted (Word's own markup) keeps its text only
const WR_DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'META', 'LINK', 'TITLE', 'XML']);
function wrClean(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const inline = (node, out) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) { out.append(n.textContent); continue; }
      if (n.nodeType !== 1 || WR_DROP.has(n.nodeName)) continue;
      if (n.nodeName === 'SUP' && n.classList.contains('fn') && n.dataset.fn) {
        const s = document.createElement('sup');
        s.className = 'fn'; s.dataset.fn = n.dataset.fn; s.contentEditable = 'false'; s.textContent = n.textContent || '*';
        out.append(s); continue;
      }
      if (n.nodeName === 'BR') { out.append(document.createElement('br')); continue; }
      const st = n.style || {};
      const bold = n.nodeName === 'B' || n.nodeName === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600;
      const ital = n.nodeName === 'I' || n.nodeName === 'EM' || st.fontStyle === 'italic';
      let target = out;
      if (bold) { const b = document.createElement('b'); out.append(b); target = b; }
      if (ital) { const i = document.createElement('i'); target.append(i); target = i; }
      inline(n, target);
    }
  };
  const out = document.createElement('div');
  const block = (tag, cls, src) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    inline(src, el);
    if (el.textContent.trim() || el.querySelector('sup.fn')) out.append(el);
    else if (tag === 'p') { el.append(document.createElement('br')); out.append(el); }
  };
  let loose = null; // text and inline marks outside any block gather in one paragraph
  const flush = () => { if (loose) { if (loose.textContent.trim() || loose.querySelector('sup.fn')) out.append(loose); loose = null; } };
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 1 && WR_DROP.has(n.nodeName)) continue;
      const name = n.nodeType === 1 ? n.nodeName : '';
      if (/^(P|DIV|H[1-6]|BLOCKQUOTE|LI|TR|SECTION|ARTICLE)$/.test(name) && !n.querySelector('p, div, h1, h2, h3, h4, h5, h6, blockquote, li, tr')) {
        flush();
        if (name === 'H1' || name === 'H2') block('h2', '', n);
        else if (/^H[3-6]$/.test(name)) block('h3', '', n);
        else if (name === 'BLOCKQUOTE') block('blockquote', '', n);
        else block('p', n.classList.contains('ayah') ? 'ayah' : '', n);
      } else if (/^(DIV|BLOCKQUOTE|UL|OL|LI|TABLE|TBODY|THEAD|TR|TD|SECTION|ARTICLE|BODY|HTML|FONT|SPAN)$/.test(name) && n.querySelector('p, div, h1, h2, h3, h4, h5, h6, blockquote, li, tr')) {
        flush(); walk(n);
      } else {
        if (!loose) loose = document.createElement('p');
        const tmp = document.createElement('div');
        tmp.append(n.cloneNode(true));
        inline(tmp, loose);
      }
    }
  };
  walk(tpl.content);
  flush();
  return out.innerHTML;
}
const wrPlain = (html) => { const t = document.createElement('template'); t.innerHTML = (html || '').replace(/<\/(p|h2|h3|blockquote)>/g, '$&\n'); for (const s of t.content.querySelectorAll('sup.fn')) s.remove(); return t.content.textContent; };
const wrWords = (s) => ((s || '').match(/[\p{L}\p{N}\p{M}]+/gu) || []).length;
const wrChWords = (c) => wrWords(wrPlain(c.html));
const wrBookWords = (b) => b.chapters.reduce((n, c) => n + wrChWords(c), 0);
const wrNoteIds = (html) => { const t = document.createElement('template'); t.innerHTML = html || ''; return [...t.content.querySelectorAll('sup.fn')].map((s) => s.dataset.fn); };
const wrNum = (n) => digitsOut(n);

// ---------- the page ----------
function viewWriting() {
  if (!wrUi.list) { wrLoad(); return `${moreCrumb()}<section class="panel"><p class="note-text">يُفتح…</p></section>`; }
  const b = wrUi.book && wrBook(wrUi.book);
  if (wrUi.book && !b) wrUi.book = '';
  return b ? wrBookHTML(b) : wrListHTML();
}
Object.assign(LibraryViews, { writing: viewWriting });

function wrListHTML() {
  const l = wrUi.list;
  return `${moreCrumb()}
  <section class="panel">
    <div class="section-head"><h2>${esc(pageName('writing'))}</h2></div>
    <form class="wr-new" data-wr-form="book"><input name="t" placeholder="عنوان كتاب جديد" aria-label="عنوان كتاب جديد" autocomplete="off"><button type="submit" class="primary">${icon('plus')} كتاب جديد</button></form>
    ${l.length ? `<div class="wr-books">${l.map((b) => `<button type="button" class="wr-book" data-action="wr-open" data-v="${b.id}"><b>${esc(b.title || 'كتاب بلا عنوان')}</b><span class="book-line">الفصول: ${b.chapters.length} | الكلمات: ${wrBookWords(b)} | آخر تعديل: ${esc(relDate(iso(new Date(b.updated))))}</span></button>`).join('')}</div>`
    : '<p class="note-text">لا كتب بعد. اكتب عنوان كتابك ثم «كتاب جديد».</p>'}
    <p class="note-text explain">الكتب محفوظة في هذا الجهاز وفي «النسخة الاحتياطية»، ولا تُزامَن بعد بين الجوال والكمبيوتر: اكتب الكتاب الواحد في جهاز واحد.</p>
  </section>`;
}

function wrBookHTML(b) {
  const notes = b.chapters.reduce((n, c) => n + wrNoteIds(c.html).length, 0);
  const del = wrUi.armed === `b:${b.id}`;
  return `${moreCrumb()}
  <div class="crumbs"><button type="button" class="back" data-action="wr-list">${icon('back')} ${esc(pageName('writing'))}</button></div>
  <section class="panel">
    <div class="section-head"><h2>${esc(b.title || 'كتاب بلا عنوان')}</h2><button type="button" class="ghost sm" data-action="wr-rename">${icon('edit')} العنوان</button></div>
    <p class="book-line">الفصول: ${b.chapters.length} | الكلمات: ${wrBookWords(b)} | الحواشي: ${notes}</p>
    ${b.chapters.length ? `<div class="wr-chs">${b.chapters.map((c, i) => `<div class="wr-ch">
      <button type="button" class="wr-ch-open" data-action="wr-ch" data-v="${c.id}"><b>${esc(c.title || `فصل ${wrNum(i + 1)}`)}</b><small>الكلمات: ${wrChWords(c)}</small></button>
      <button type="button" class="icon-btn" data-action="wr-up" data-v="${c.id}" aria-label="إلى الأعلى"${i ? '' : ' disabled'}>▲</button>
      <button type="button" class="icon-btn" data-action="wr-down" data-v="${c.id}" aria-label="إلى الأسفل"${i < b.chapters.length - 1 ? '' : ' disabled'}>▼</button>
      <button type="button" class="ghost sm danger-text" data-action="wr-ch-del" data-v="${c.id}">${wrUi.armed === `c:${c.id}` ? 'متأكد؟' : 'حذف'}</button>
    </div>`).join('')}</div>` : '<p class="note-text">لا فصول بعد.</p>'}
    <div class="btn-row"><button type="button" class="primary" data-action="wr-ch-new">${icon('plus')} فصل جديد</button>
      <button type="button" class="ghost" data-action="wr-docx"${b.chapters.length ? '' : ' disabled'}>${icon('sheet')} ملف وورد</button></div>
  </section>
  <section class="panel">
    <h2>البحث في الكتاب</h2>
    <form class="wr-new" data-wr-form="find"><input name="q" value="${esc(wrUi.find)}" placeholder="كلمة أو عبارة" aria-label="ابحث في الكتاب" autocomplete="off"><button type="submit" class="ghost">ابحث</button></form>
    ${wrUi.find ? wrFindHTML(b) : ''}
  </section>
  <section class="panel">
    <button type="button" class="danger" data-action="wr-book-del" data-v="${b.id}">${del ? 'متأكد؟ سيُحذف الكتاب كله' : 'حذف الكتاب'}</button>
  </section>`;
}

const wrCount = (text, q) => { let n = 0, i = 0; if (!q) return 0; while ((i = text.indexOf(q, i)) !== -1) { n++; i += q.length; } return n; };
function wrFindHTML(b) {
  const q = wrUi.find;
  const hits = b.chapters.map((c, i) => ({ c, i, n: wrCount(wrPlain(c.html), q) + wrNoteIds(c.html).reduce((s, id) => s + wrCount(c.notes[id] || '', q), 0) })).filter((h) => h.n);
  if (!hits.length) return '<p class="note-text">لم يوجد في الكتاب.</p>';
  return `<p class="book-line">وُجد: ${hits.reduce((s, h) => s + h.n, 0)} مرة في ${hits.length} ${hits.length === 1 ? 'فصل' : 'فصول'}</p>
  <div class="wr-chs">${hits.map((h) => `<button type="button" class="wr-ch-open" data-action="wr-ch" data-v="${h.c.id}" data-find="1"><b>${esc(h.c.title || `فصل ${wrNum(h.i + 1)}`)}</b><small>${h.n} مرة</small></button>`).join('')}</div>`;
}

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-wr-form]');
  if (!f) return;
  e.preventDefault();
  if (f.dataset.wrForm === 'book') {
    const t = f.elements.t.value.trim();
    const b = normalizeWBook({ title: t, chapters: [{ title: '' }] });
    wrUi.list.unshift(b);
    wrSave(b);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
    wrUi.book = b.id;
    render();
  } else {
    wrUi.find = f.elements.q.value.trim();
    render();
  }
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action^="wr-"]');
  if (!t) return;
  const a = t.dataset.action, v = t.dataset.v;
  const b = wrUi.book && wrBook(wrUi.book);
  if (a !== 'wr-ch-del' && a !== 'wr-book-del') wrUi.armed = '';
  if (a === 'wr-open') { wrUi.book = v; wrUi.find = ''; render(); window.scrollTo(0, 0); }
  else if (a === 'wr-list') { wrUi.book = ''; render(); }
  else if (!b) return;
  else if (a === 'wr-rename') {
    const nt = prompt('عنوان الكتاب', b.title);
    if (nt != null) { b.title = nt.trim(); wrSave(b); render(); }
  } else if (a === 'wr-ch-new') {
    const c = normalizeWChapter({ title: '' });
    b.chapters.push(c); wrSave(b); wrEdit(b, c.id);
  } else if (a === 'wr-ch') wrEdit(b, v, t.dataset.find ? wrUi.find : '');
  else if (a === 'wr-up' || a === 'wr-down') {
    const i = b.chapters.findIndex((c) => c.id === v), j = a === 'wr-up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= b.chapters.length) return;
    [b.chapters[i], b.chapters[j]] = [b.chapters[j], b.chapters[i]];
    wrSave(b); render();
  } else if (a === 'wr-ch-del') {
    if (wrUi.armed !== `c:${v}`) { wrUi.armed = `c:${v}`; render(); setTimeout(() => { if (wrUi.armed === `c:${v}`) { wrUi.armed = ''; if (ui.tab === 'writing') render(); } }, 4000); return; }
    wrUi.armed = '';
    b.chapters = b.chapters.filter((c) => c.id !== v); wrSave(b); render(); toast('حُذف الفصل');
  } else if (a === 'wr-book-del') {
    if (wrUi.armed !== `b:${v}`) { wrUi.armed = `b:${v}`; render(); setTimeout(() => { if (wrUi.armed === `b:${v}`) { wrUi.armed = ''; if (ui.tab === 'writing') render(); } }, 4000); return; }
    wrUi.armed = '';
    wrUi.list = wrUi.list.filter((x) => x.id !== v); wrUi.book = '';
    WBooks.del(v).catch(() => {}); render(); toast('حُذف الكتاب');
  } else if (a === 'wr-docx') wrDocxSave(b);
});

// ---------- the editor (a full-screen window like the notes', so the page redrawing never touches it) ----------
let wrState = null; // { book, ch, timer, dirty, found }
function wrDialog() {
  let d = $('wrEditor');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'wrEditor';
  d.className = 'fullscreen';
  d.setAttribute('aria-label', 'محرر الفصل');
  d.innerHTML = `<div class="me-wrap">
    <div class="me-head">
      <button type="button" class="icon-btn" data-wr="close" aria-label="رجوع وحفظ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button>
      <input id="wrTitle" placeholder="عنوان الفصل" aria-label="عنوان الفصل" autocomplete="off">
      <button type="button" class="icon-btn" data-wr="find" aria-label="بحث واستبدال"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5"/></svg></button>
    </div>
    <div class="me-tools" id="wrTools" role="toolbar" aria-label="أدوات الكتابة">
      <button type="button" data-wcmd="h2" aria-label="عنوان">عنوان</button>
      <button type="button" data-wcmd="h3" aria-label="عنوان فرعي">فرعي</button>
      <button type="button" data-wcmd="p" aria-label="نص عادي">نص</button>
      <span class="sep"></span>
      <button type="button" data-wcmd="bold" aria-label="غامق"><b>غ</b></button>
      <button type="button" data-wcmd="italic" aria-label="مائل"><i>م</i></button>
      <span class="sep"></span>
      <button type="button" data-wcmd="ayah" aria-label="آية">﴿ ﴾</button>
      <button type="button" data-wcmd="quote" aria-label="اقتباس">❝</button>
      <button type="button" data-wcmd="note" aria-label="حاشية سفلية">حاشية</button>
      <span class="sep"></span>
      <button type="button" data-wcmd="undo" aria-label="تراجع"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3"/></svg></button>
      <button type="button" data-wcmd="redo" aria-label="إعادة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/></svg></button>
    </div>
    <div class="me-pal wr-find" id="wrFind" hidden>
      <input id="wrQ" placeholder="ابحث عن" aria-label="ابحث عن" autocomplete="off">
      <input id="wrR" placeholder="استبدله بـ" aria-label="استبدله بـ" autocomplete="off">
      <button type="button" data-wr="next">التالي</button>
      <button type="button" data-wr="rep">استبدل</button>
      <button type="button" data-wr="repall">استبدل الكل</button>
      <small id="wrFound"></small>
    </div>
    <div class="wr-scroll" id="wrScroll">
      <div id="wrBody" class="me-body wr-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="نص الفصل" data-placeholder="اكتب هنا…" dir="rtl"></div>
      <div class="wr-notes" id="wrNotes"></div>
    </div>
    <div class="me-foot"><small id="wrStatus"></small></div>
  </div>`;
  document.body.append(d);
  d.addEventListener('close', () => { if (wrState) wrClose(true); });
  return d;
}

function wrEdit(b, chId, find) {
  const c = b.chapters.find((x) => x.id === chId);
  if (!c) return;
  const d = wrDialog();
  wrState = { book: b, ch: c, timer: null, dirty: false };
  $('wrTitle').value = c.title;
  $('wrBody').innerHTML = c.html;
  $('wrFind').hidden = !find;
  $('wrQ').value = find || '';
  $('wrR').value = '';
  $('wrFound').textContent = '';
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  wrRenumber();
  wrStatus('');
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  $('wrScroll').scrollTop = 0;
  if (find) setTimeout(() => wrFindNext(), 50);
  else if (!c.html) setTimeout(() => $(c.title ? 'wrBody' : 'wrTitle').focus(), 50);
}

function wrClose(fromEvent) {
  if (!wrState) return;
  wrSaveNow();
  wrState = null;
  const d = $('wrEditor');
  if (!fromEvent && d) { if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open'); }
  render();
}

function wrStatus(s) {
  if (!wrState) return;
  const c = wrState.ch;
  $('wrStatus').textContent = `الكلمات: الفصل ${wrNum(wrWords(wrPlain($('wrBody').innerHTML)))} | الكتاب ${wrNum(wrBookWords(wrState.book) - wrChWords(c) + wrWords(wrPlain($('wrBody').innerHTML)))}${s ? ` | ${s}` : ''}`;
}
function wrDirty() {
  if (!wrState) return;
  wrState.dirty = true;
  clearTimeout(wrState.timer);
  wrState.timer = setTimeout(wrSaveNow, 700);
  wrStatus('يحفظ…');
}
function wrSaveNow() {
  if (!wrState || !wrState.dirty) return;
  clearTimeout(wrState.timer);
  const c = wrState.ch;
  c.title = $('wrTitle').value.trim();
  c.html = wrClean($('wrBody').innerHTML);
  c.updated = Date.now();
  wrState.dirty = false;
  wrSave(wrState.book).then(() => wrStatus('حُفظ ✓'));
}

// footnote marks are numbered in the order they stand; the notes list under the text follows them
function wrRenumber() {
  if (!wrState) return;
  const c = wrState.ch;
  const marks = [...$('wrBody').querySelectorAll('sup.fn')];
  const seen = new Set();
  marks.forEach((m, i) => {
    let id = m.dataset.fn;
    if (seen.has(id) || !(id in c.notes)) { // a mark copied, or brought from another chapter: its own note
      const text = c.notes[id] != null ? c.notes[id] : (wrState.book.chapters.find((x) => x.notes[id] != null) || { notes: {} }).notes[id] || '';
      if (seen.has(id)) { id = uid(); m.dataset.fn = id; }
      c.notes[id] = text;
    }
    seen.add(id);
    m.contentEditable = 'false';
    const n = wrNum(i + 1);
    if (m.textContent !== n) m.textContent = n;
  });
  const box = $('wrNotes');
  const ids = marks.map((m) => m.dataset.fn);
  if (!ids.length) { box.innerHTML = ''; return; }
  const have = [...box.querySelectorAll('textarea')].map((x) => x.dataset.fn).join();
  if (have === ids.join()) { box.querySelectorAll('.wr-note b').forEach((x, i) => { x.textContent = wrNum(i + 1); }); return; }
  box.innerHTML = `<h3>الحواشي</h3>${ids.map((id, i) => `<label class="wr-note"><b>${wrNum(i + 1)}</b><textarea data-fn="${id}" rows="2" aria-label="الحاشية ${i + 1}">${esc(c.notes[id] || '')}</textarea></label>`).join('')}`;
}

// the paragraph the cursor is in
function wrBlock() {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.getRangeAt(0).startContainer;
  const body = $('wrBody');
  if (!body.contains(n)) return null;
  while (n && n.parentNode !== body) n = n.parentNode;
  return n && n.nodeType === 1 ? n : null;
}
function wrCmd(cmd) {
  const body = $('wrBody');
  body.focus();
  if (cmd === 'undo' || cmd === 'redo' || cmd === 'bold' || cmd === 'italic') { try { document.execCommand('styleWithCSS', false, false); } catch {} document.execCommand(cmd); }
  else if (cmd === 'h2' || cmd === 'h3' || cmd === 'p' || cmd === 'quote') {
    const want = cmd === 'quote' ? 'blockquote' : cmd;
    const blk = wrBlock();
    document.execCommand('formatBlock', false, `<${blk && blk.nodeName.toLowerCase() === want && cmd !== 'p' ? 'p' : want}>`);
    const nb = wrBlock(); if (nb) nb.classList.remove('ayah');
  } else if (cmd === 'ayah') {
    let blk = wrBlock();
    if (!blk || blk.nodeName !== 'P') { document.execCommand('formatBlock', false, '<p>'); blk = wrBlock(); }
    if (!blk) return;
    if (blk.classList.contains('ayah')) blk.classList.remove('ayah');
    else {
      blk.classList.add('ayah');
      const tx = blk.textContent.trim();
      if (tx && !tx.startsWith('﴿')) blk.insertBefore(document.createTextNode('﴿'), blk.firstChild);
      if (tx && !tx.endsWith('﴾')) blk.append(document.createTextNode('﴾'));
    }
  } else if (cmd === 'note') {
    // (put in place by hand: the browser's own insertion dropped a mark typed at a paragraph's end outside it)
    const id = uid();
    wrState.ch.notes[id] = '';
    const sel = getSelection();
    if (!sel.rangeCount || !body.contains(sel.anchorNode)) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const sup = document.createElement('sup');
    sup.className = 'fn'; sup.dataset.fn = id; sup.contentEditable = 'false'; sup.textContent = '*';
    if (r.startContainer === body) { const p = document.createElement('p'); p.append(sup); r.insertNode(p); } else r.insertNode(sup);
    r.setStartAfter(sup); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
    wrRenumber();
    const ta = $('wrNotes').querySelector(`textarea[data-fn="${id}"]`);
    if (ta) setTimeout(() => { ta.focus(); ta.scrollIntoView({ block: 'center' }); }, 30);
  }
  wrDirty();
}

// find and replace in this chapter (a match inside one stretch of text)
function wrTextNodes() { const w = document.createTreeWalker($('wrBody'), NodeFilter.SHOW_TEXT); const out = []; while (w.nextNode()) if (!w.currentNode.parentNode.closest('sup.fn')) out.push(w.currentNode); return out; }
function wrFindNext() {
  const q = $('wrQ').value;
  if (!q) return false;
  const nodes = wrTextNodes();
  const sel = getSelection();
  let startNode = null, startOff = 0;
  if (sel.rangeCount && $('wrBody').contains(sel.anchorNode)) { const r = sel.getRangeAt(0); startNode = r.endContainer; startOff = r.endOffset; }
  let from = startNode ? nodes.indexOf(startNode) : -1;
  const order = from >= 0 ? [...nodes.slice(from), ...nodes.slice(0, from + 1)] : nodes;
  for (let k = 0; k < order.length; k++) {
    const n = order[k];
    const i = n.textContent.indexOf(q, k === 0 && n === startNode ? startOff : 0);
    if (i !== -1) {
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + q.length);
      sel.removeAllRanges(); sel.addRange(r);
      const el = n.parentNode; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      $('wrFound').textContent = `في هذا الفصل: ${wrNum(wrCount(wrPlain($('wrBody').innerHTML), q))}`;
      return true;
    }
  }
  $('wrFound').textContent = 'لم يوجد في هذا الفصل';
  return false;
}
function wrReplace(all) {
  const q = $('wrQ').value, r = $('wrR').value;
  if (!q) return;
  if (!all) {
    const sel = getSelection();
    if (sel.rangeCount && sel.toString() === q && $('wrBody').contains(sel.anchorNode)) { $('wrBody').focus(); document.execCommand('insertText', false, r); wrDirty(); }
    wrFindNext();
    return;
  }
  let n = 0;
  for (const t of wrTextNodes()) { const k = wrCount(t.textContent, q); if (k) { n += k; t.textContent = t.textContent.split(q).join(r); } }
  for (const ta of $('wrNotes').querySelectorAll('textarea')) { const k = wrCount(ta.value, q); if (k) { n += k; ta.value = ta.value.split(q).join(r); wrState.ch.notes[ta.dataset.fn] = ta.value; } }
  $('wrFound').textContent = n ? `استُبدل ${wrNum(n)} مرة في هذا الفصل` : 'لم يوجد في هذا الفصل';
  if (n) wrDirty();
}

// the toolbar keeps the cursor in the text
document.addEventListener('pointerdown', (e) => { if (e.target.closest('#wrTools button')) e.preventDefault(); });
document.addEventListener('click', (e) => {
  if (!wrState) return;
  const t = e.target.closest('[data-wcmd], [data-wr], #wrBody sup.fn');
  if (!t) return;
  if (t.dataset.wcmd) { wrCmd(t.dataset.wcmd); return; }
  if (t.matches('sup.fn')) { const ta = $('wrNotes').querySelector(`textarea[data-fn="${t.dataset.fn}"]`); if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center' }); } return; }
  const a = t.dataset.wr;
  if (a === 'close') wrClose();
  else if (a === 'find') { const f = $('wrFind'); f.hidden = !f.hidden; if (!f.hidden) { const s = getSelection().toString(); if (s && s.length < 80) $('wrQ').value = s; $('wrQ').focus(); } }
  else if (a === 'next') wrFindNext();
  else if (a === 'rep') wrReplace(false);
  else if (a === 'repall') wrReplace(true);
});
document.addEventListener('input', (e) => {
  if (!wrState) return;
  if (e.target.id === 'wrBody') {
    // a new line after a verse box or a quotation is plain text (the browser carried their look over)
    if (e.inputType === 'insertParagraph') {
      const blk = wrBlock();
      if (blk && !blk.textContent.trim() && (blk.classList.contains('ayah') || blk.nodeName === 'BLOCKQUOTE')) {
        if (blk.nodeName === 'BLOCKQUOTE') document.execCommand('formatBlock', false, '<p>');
        const nb = wrBlock(); if (nb) nb.classList.remove('ayah');
      }
    }
    wrRenumber(); wrDirty();
  }
  else if (e.target.id === 'wrTitle') wrDirty();
  else if (e.target.matches && e.target.matches('#wrNotes textarea')) { wrState.ch.notes[e.target.dataset.fn] = e.target.value; wrDirty(); }
});
document.addEventListener('keydown', (e) => {
  if (!wrState) return;
  if (e.target.id === 'wrTitle' && e.key === 'Enter') { e.preventDefault(); $('wrBody').focus(); }
  if ((e.target.id === 'wrQ' || e.target.id === 'wrR') && e.key === 'Enter') { e.preventDefault(); wrFindNext(); }
});
// pasted text keeps only what a chapter keeps (Word's own markup goes)
document.addEventListener('paste', (e) => {
  if (!wrState || !(e.target.closest && e.target.closest('#wrBody'))) return;
  const html = e.clipboardData && e.clipboardData.getData('text/html');
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (!html && !text) return;
  e.preventDefault();
  const clean = html ? wrClean(html) : (text || '').split(/\r?\n/).map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
  document.execCommand('insertHTML', false, clean);
  wrRenumber();
  wrDirty();
});
window.addEventListener('pagehide', () => { if (wrState) wrSaveNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && wrState) wrSaveNow(); });

// ---------- a Word file: the book's title, each chapter from a new page, its headings, and footnotes at the foot ----------
function wrDocx(b) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const x = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const F = 'Traditional Arabic';
  const notes = [];
  const run = (text, f) => text.split('\n').map((line, i) => `<w:r><w:rPr>${f.b ? '<w:b/><w:bCs/>' : ''}${f.i ? '<w:i/><w:iCs/>' : ''}<w:rtl/></w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`).join('');
  const runs = (node, f, ch) => [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent ? run(n.textContent, f) : '';
    if (n.nodeType !== 1) return '';
    if (n.nodeName === 'BR') return '<w:r><w:br/></w:r>';
    if (n.nodeName === 'SUP' && n.classList.contains('fn')) {
      notes.push(ch.notes[n.dataset.fn] || '');
      return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr><w:footnoteReference w:id="${notes.length}"/></w:r>`;
    }
    return runs(n, { b: f.b || n.nodeName === 'B' || n.nodeName === 'STRONG', i: f.i || n.nodeName === 'I' || n.nodeName === 'EM' }, ch);
  }).join('');
  const para = (style, inner, extra = '') => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}<w:bidi/></w:pPr>${inner}</w:p>`;
  let body = para('Title', run(b.title || 'كتاب بلا عنوان', {}));
  b.chapters.forEach((ch, idx) => {
    body += para('Heading1', run(ch.title || `فصل ${idx + 1}`, {}), '<w:pageBreakBefore/>');
    const tpl = document.createElement('template');
    tpl.innerHTML = wrClean(ch.html);
    for (const el of tpl.content.children) {
      const style = el.nodeName === 'H2' ? 'Heading2' : el.nodeName === 'H3' ? 'Heading3' : el.nodeName === 'BLOCKQUOTE' ? 'Quote' : el.classList.contains('ayah') ? 'Ayah' : 'Normal';
      body += para(style, runs(el, {}, ch));
    }
  });
  const sect = '<w:sectPr><w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr>';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}${sect}</w:body></w:document>`;
  const fnPara = (inner, first) => `<w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:bidi/></w:pPr>${first ? '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr><w:footnoteRef/></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve"> </w:t></w:r>' : ''}${inner}</w:p>`;
  const footnotes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes xmlns:w="${W}">`
    + '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>'
    + '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'
    + notes.map((t, i) => `<w:footnote w:id="${i + 1}">${(t || '').split(/\r?\n/).map((line, k) => fnPara(run(line, {}), !k)).join('')}</w:footnote>`).join('')
    + '</w:footnotes>';
  // (Word reads a paragraph's settings in the schema's order only: bidi stands after the borders and before the spacing)
  const PPR = ['keepNext', 'pageBreakBefore', 'pBdr', 'bidi', 'spacing', 'ind', 'jc', 'outlineLvl'];
  const ordered = (ppr) => (ppr.match(/<w:(\w+)(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:\1>)/g) || []).concat('<w:bidi/>')
    .sort((m, n) => PPR.indexOf(m.match(/^<w:(\w+)/)[1]) - PPR.indexOf(n.match(/^<w:(\w+)/)[1])).join('');
  const pstyle = (id, name, rpr, ppr, extra = '') => `<w:style w:type="paragraph"${id === 'Normal' ? ' w:default="1"' : ''} w:styleId="${id}"><w:name w:val="${name}"/>${id === 'Normal' ? '' : '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'}${extra}<w:qFormat/><w:pPr>${ordered(ppr)}</w:pPr><w:rPr>${rpr}<w:rtl/></w:rPr></w:style>`;
  const sz = (n) => `<w:sz w:val="${n}"/><w:szCs w:val="${n}"/>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:eastAsia="${F}"/>${sz(32)}<w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
${pstyle('Normal', 'Normal', '', '<w:jc w:val="both"/>')}
${pstyle('Title', 'Title', `<w:b/><w:bCs/>${sz(56)}`, '<w:spacing w:before="2400" w:after="480"/><w:jc w:val="center"/>')}
${pstyle('Heading1', 'heading 1', `<w:b/><w:bCs/>${sz(44)}`, '<w:keepNext/><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>')}
${pstyle('Heading2', 'heading 2', `<w:b/><w:bCs/>${sz(38)}`, '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/>')}
${pstyle('Heading3', 'heading 3', `<w:b/><w:bCs/>${sz(34)}`, '<w:keepNext/><w:spacing w:before="180" w:after="80"/><w:outlineLvl w:val="2"/>')}
${pstyle('Ayah', 'Ayah', `<w:b/><w:bCs/>${sz(34)}`, '<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:left w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:right w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/></w:pBdr><w:spacing w:before="160" w:after="160"/><w:ind w:left="567" w:right="567"/><w:jc w:val="center"/>')}
${pstyle('Quote', 'Quote', `<w:color w:val="444444"/>`, '<w:spacing w:before="120" w:after="120"/><w:ind w:left="567" w:right="567"/><w:jc w:val="both"/>')}
${pstyle('FootnoteText', 'footnote text', sz(24), '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/>', '')}
<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
</w:styles>`;
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(b.title || '')}</dc:title></cp:coreProperties>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
</Relationships>` },
    { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:doNotExpandShiftReturn/></w:compat><w:themeFontLang w:val="en-US" w:bidi="ar-SA"/></w:settings>` },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/footnotes.xml', data: footnotes },
    { name: 'word/document.xml', data: doc },
  ];
  return new Blob([Xlsx.zip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function wrDocxSave(b) {
  try { downloadBlob(wrDocx(b), `mahami-book-${today()}.docx`); toast('حُفظ ملف وورد'); }
  catch { toast('تعذّر صنع ملف وورد'); }
}
