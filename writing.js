'use strict';
// «مؤلفاتي» (v154, the owner: «أنا أستمع وورد في كتابة الكتب فأريد بدلا يعطني الراحة التي فيه ويغنيني عن 43 ريال
// أدفعها لهم» then «أنا أريده في تطبيق الوعي الشخصي، كيف؟», and his answers: both devices; footnotes, chapters and
// headings and an index, output for print, his current books brought in from Word; Claude to help. Stage 1 of five
// («أ: نعم، ابدأ بالمرحلة ١»): books of chapters written in a full-screen editor (headings, bold, italic, a verse box
// ﴿﴾, a quotation, footnotes), undo, find and replace, word count, saved as one types, in the backup, and a Word file
// with real footnotes at the foot of the page.
// A book is large: it is kept in this device's big store (IndexedDB «mahami-writing»), not in S (localStorage, shared
// with «مساعد المعلم» and written whole at every save), and it is not synced yet (stage 3).

// v156, the owner: «أضف أداة كتابة تتضمن جميع الأدوات والخطوط المتاحة مع القدرة على تكبير الخط وتصغيره … وحذف الحاشية ورقم
// الحاشية في المتن بين قوسين صغيرين … صفحة مؤلفاتي تتضمن ما ييسر كتابة الكتاب، وأخرى مقالة، والثالثة منشورا كلها في تبويبات
// منفصلة … معينة على التركيز فلا تظهر إلا الأدوات في فقاعة صغيرة … ومؤقت جانبي في الأسفل … الحفظ في السحابة», and his answers:
// the size of the text selected; a bubble on a selection and a small floating button; a countdown counted in the report;
// a table, a picture and a page break; an article with its words, reading time, one-tap copy and draft/published; a post
// with one-tap copy and draft/published; the cloud «المضمون السري» (a secret gist of his own, encrypted).
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
  const kind = WR_KINDS[b.kind] ? b.kind : 'book';
  const chapters = (Array.isArray(b.chapters) ? b.chapters : []).map(normalizeWChapter);
  if (kind !== 'book' && !chapters.length) chapters.push(normalizeWChapter({})); // (an article or a post is one text)
  return { id: b.id || uid(), kind, title: typeof b.title === 'string' ? b.title : '', status: b.status === 'pub' ? 'pub' : 'draft', created: Number(b.created) || Date.now(), updated: Number(b.updated) || Date.now(), chapters };
}
// the three tabs (v156): a book of chapters, an article, a post
const WR_KINDS = {
  book: { tab: 'الكتب', one: 'كتاب', none: 'كتاب بلا عنوان' },
  article: { tab: 'المقالات', one: 'مقالة', none: 'مقالة بلا عنوان', pub: 'منشورة' },
  post: { tab: 'المنشورات', one: 'منشور', none: 'منشور', pub: 'منشور ✓' },
};

const wrUi = { list: null, loading: false, book: '', armed: '', find: '', tab: (() => { try { const t = localStorage.getItem('mahami-wrtab'); return WR_KINDS[t] ? t : 'book'; } catch { return 'book'; } })() };
const wrBook = (id) => (wrUi.list || []).find((b) => b.id === id);
function wrLoad() {
  if (wrUi.loading) return;
  wrUi.loading = true;
  WBooks.all().then((l) => { wrUi.list = l.sort((a, c) => c.updated - a.updated); }).catch(() => { wrUi.list = []; })
    .finally(() => { wrUi.loading = false; if (ui.tab === 'writing') render(); });
}
function wrSave(b, soon = 20000) {
  b.updated = Date.now();
  WrCloud.soon(soon); // (to the cloud a little after one stops, and at once on closing)
  return WBooks.put(b).catch(() => toast('تعذّر الحفظ في الجهاز. لا تغلق التطبيق، وصدّر نسخة احتياطية'));
}

// ---------- text helpers ----------
// what a chapter keeps: paragraphs, two levels of headings, a verse box, a quotation, bold, italic, line breaks and
// footnote marks; anything else pasted (Word's own markup) keeps its text only
const WR_BLOCK = /^(P|DIV|H[1-6]|BLOCKQUOTE|LI|TD|TH|DD|DT|CENTER|PRE|ADDRESS|FIGCAPTION|SECTION|ARTICLE|TR)$/;
const WR_HASBLOCK = 'p, div, h1, h2, h3, h4, h5, h6, blockquote, li, td, th, dd, dt, center, pre, address, figcaption, tr, table';
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
      if (WR_BLOCK.test(n.nodeName) && out.textContent && !/\s$/.test(out.textContent)) out.append(' '); // (blocks met inside a line: words stay apart)
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
      if (WR_BLOCK.test(name) && name !== 'TR' && !n.querySelector(WR_HASBLOCK)) {
        flush();
        if (name === 'H1' || name === 'H2') block('h2', '', n);
        else if (/^H[3-6]$/.test(name)) block('h3', '', n);
        else if (name === 'BLOCKQUOTE') block('blockquote', '', n);
        else block('p', n.classList.contains('ayah') ? 'ayah' : '', n);
      } else if (name && (/^(UL|OL|DL|TABLE|TBODY|THEAD|TFOOT|TR|BODY|HTML)$/.test(name) || n.querySelector(WR_HASBLOCK))) {
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
// what the editor's own text keeps (v156): wrClean's, and the tools': underline, strike, a colour, a highlight, a font, a
// size (relative, «em»), a paragraph's alignment, line spacing and indent, lists, a table, a picture of its own (no link to
// elsewhere), a page break and a line; anything else keeps its text
const WR_FONTS = [['', 'خط التطبيق'], ['Amiri', 'أميري'], ['Noto Naskh Arabic', 'نسخ'], ['Scheherazade New', 'شهرزاد'], ['Lateef', 'لطيف'],
  ['Markazi Text', 'مركزي'], ['Harmattan', 'هرمتان'], ['Noto Kufi Arabic', 'كوفي'], ['Reem Kufi', 'ريم كوفي'], ['Cairo', 'القاهرة'],
  ['Tajawal', 'تجوّل'], ['Almarai', 'المراعي'], ['IBM Plex Sans Arabic', 'بلكس'], ['Noto Sans Arabic', 'نوتو'], ['El Messiri', 'المسيري'],
  ['Changa', 'تشانغا'], ['Mada', 'مدى'], ['Readex Pro', 'ريدكس'], ['Aref Ruqaa', 'رقعة'], ['Rakkas', 'رقّاص'], ['Lalezar', 'لاله‌زار'], ['Katibeh', 'كاتبة']];
const WR_FONT_SET = new Set(WR_FONTS.map((f) => f[0]).filter(Boolean));
const wrFontOf = (s) => { const f = String(s || '').split(',')[0].replace(/["']/g, '').trim(); return WR_FONT_SET.has(f) ? f : ''; };
const WR_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;
const WR_TOP = /^(P|H2|H3|BLOCKQUOTE|UL|OL|TABLE|HR)$/;
function wrSafe(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const blockStyle = (src, el) => {
    const st = src.style || {};
    if (/^(right|center|left|justify)$/.test(st.textAlign)) el.style.textAlign = st.textAlign;
    if (/^\d(\.\d+)?$/.test(st.lineHeight || '') && +st.lineHeight >= 1 && +st.lineHeight <= 3) el.style.lineHeight = st.lineHeight;
    const ind = Number(src.dataset && src.dataset.ind);
    if (ind >= 1 && ind <= 6) el.dataset.ind = String(Math.round(ind));
  };
  const kids = (src, dst) => { for (const n of [...src.childNodes]) { const c = conv(n); if (c) dst.append(c); } return dst; };
  const conv = (n) => {
    if (n.nodeType === 3) return document.createTextNode(n.textContent);
    if (n.nodeType !== 1) return null;
    const N = n.nodeName;
    if (/^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|VIDEO|AUDIO|META|LINK|TITLE|XML|INPUT|BUTTON|SELECT|TEXTAREA)$/.test(N)) return null;
    if (N === 'SUP' && n.classList.contains('fn') && n.dataset.fn) {
      const s = document.createElement('sup');
      s.className = 'fn'; s.dataset.fn = n.dataset.fn; s.contentEditable = 'false'; s.textContent = n.textContent || '*';
      return s;
    }
    if (N === 'BR') return document.createElement('br');
    if (N === 'IMG') {
      const src = n.getAttribute('src') || '';
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src)) return null;
      const i = document.createElement('img');
      i.src = src; i.alt = '';
      for (const k of ['w', 'h']) { const v = Number(n.dataset[k]); if (v > 0) i.dataset[k] = String(Math.round(v)); }
      return i;
    }
    if (N === 'DIV' && n.classList.contains('pgbreak')) { const d = document.createElement('div'); d.className = 'pgbreak'; d.contentEditable = 'false'; d.textContent = 'فاصل صفحة'; return d; }
    if (N === 'HR') return document.createElement('hr');
    if (/^(P|DIV|H[1-6]|BLOCKQUOTE|LI|TD|TH)$/.test(N)) {
      const tag = N === 'DIV' ? 'p' : N === 'H1' ? 'h2' : /^H[4-6]$/.test(N) ? 'h3' : N.toLowerCase();
      const el = document.createElement(tag);
      if (tag === 'p' && n.classList.contains('ayah')) el.className = 'ayah';
      blockStyle(n, el);
      return kids(n, el);
    }
    if (/^(UL|OL|TABLE|TBODY|THEAD|TFOOT|TR)$/.test(N)) {
      const el = document.createElement(/^(THEAD|TFOOT)$/.test(N) ? 'tbody' : N.toLowerCase());
      if (N === 'TABLE') el.className = 'wr-tbl';
      return kids(n, el);
    }
    // inline: its marks, each one element (bold, italic, underline, strike), and a span for its colour, highlight, font, size
    const st = n.style || {};
    let top = null, inner = null;
    const wrap = (tag) => { const e = document.createElement(tag); if (inner) inner.append(e); else top = e; inner = e; };
    const deco = `${st.textDecorationLine || ''} ${st.textDecoration || ''}`;
    if (N === 'B' || N === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) wrap('b');
    if (N === 'I' || N === 'EM' || st.fontStyle === 'italic') wrap('i');
    if (N === 'U' || /underline/.test(deco)) wrap('u');
    if (N === 'S' || N === 'STRIKE' || N === 'DEL' || /line-through/.test(deco)) wrap('s');
    const sp = {};
    const color = (st.color || (N === 'FONT' ? n.getAttribute('color') : '') || '').trim();
    if (WR_COLOR.test(color)) sp.color = color;
    const bg = (st.backgroundColor || '').trim();
    if (WR_COLOR.test(bg) && !/^rgba\(.*,\s*0\)$/.test(bg)) sp.backgroundColor = bg;
    const ff = wrFontOf(st.fontFamily || (N === 'FONT' ? n.getAttribute('face') : ''));
    if (ff) sp.fontFamily = `"${ff}"`;
    const fs = /^(\d+(?:\.\d+)?)em$/.exec(st.fontSize || '');
    if (fs && +fs[1] >= 0.5 && +fs[1] <= 4 && +fs[1] !== 1) sp.fontSize = `${+fs[1]}em`;
    if (Object.keys(sp).length) { wrap('span'); Object.assign(inner.style, sp); }
    if (!top) return kids(n, document.createDocumentFragment());
    kids(n, inner);
    return top;
  };
  const out = kids(tpl.content, document.createElement('div'));
  // what stands outside any paragraph (the first line typed, say) is gathered in one
  let loose = null;
  for (const n of [...out.childNodes]) {
    if (n.nodeType === 1 && (WR_TOP.test(n.nodeName) || n.classList.contains('pgbreak'))) { loose = null; continue; }
    if (n.nodeType === 3 && !n.textContent.trim() && !loose) { n.remove(); continue; }
    if (!loose) { loose = document.createElement('p'); n.before(loose); }
    loose.append(n);
  }
  // (an empty text is empty: no paragraph left with nothing in it)
  if (!out.textContent.trim() && !out.querySelector('img, table, hr, .pgbreak, sup.fn')) return '';
  return out.innerHTML;
}
const wrPlain = (html, marks) => {
  const t = document.createElement('template');
  t.innerHTML = (html || '').replace(/<\/(p|h2|h3|blockquote|li|tr)>/g, '$&\n').replace(/<\/t[dh]>/g, '$& ');
  for (const s of t.content.querySelectorAll('div.pgbreak')) s.remove();
  for (const [i, s] of [...t.content.querySelectorAll('sup.fn')].entries()) if (marks) s.textContent = `(${wrNum(i + 1)})`; else s.remove();
  return t.content.textContent;
};
const wrWords = (s) => ((s || '').match(/[\p{L}\p{N}\p{M}]+/gu) || []).length;
const wrChWords = (c) => wrWords(wrPlain(c.html));
const wrBookWords = (b) => b.chapters.reduce((n, c) => n + wrChWords(c), 0);
const wrNoteIds = (html) => { const t = document.createElement('template'); t.innerHTML = html || ''; return [...t.content.querySelectorAll('sup.fn')].map((s) => s.dataset.fn); };
const wrNum = (n) => digitsOut(n);

// ---------- the page ----------
function viewWriting() {
  if (!wrUi.list) { wrLoad(); return `${moreCrumb()}<section class="panel"><p class="note-text">يُفتح…</p></section>`; }
  WrCloud.pull(); // (once: what is in the cloud and not here, or newer there, comes back)
  const b = wrUi.book && wrBook(wrUi.book);
  if (wrUi.book && !b) wrUi.book = '';
  return b ? wrBookHTML(b) : wrListHTML();
}
Object.assign(LibraryViews, { writing: viewWriting });

const wrOf = (k) => wrUi.list.filter((b) => b.kind === k);
const wrReadMin = (n) => Math.max(1, Math.round(n / 180)); // (reading time: about 180 words a minute)
function wrTabsHTML() {
  return `<div class="seg wr-tabs" role="group" aria-label="${esc(pageName('writing'))}">${Object.entries(WR_KINDS).map(([k, v]) => {
    const n = wrOf(k).length;
    return `<button type="button" data-action="wr-tab" data-v="${k}" aria-pressed="${wrUi.tab === k}">${v.tab}${n ? ` (${n})` : ''}</button>`;
  }).join('')}</div>`;
}
function wrListHTML() {
  const k = wrUi.tab, K = WR_KINDS[k], l = wrOf(k);
  const form = k === 'book'
    ? `<form class="wr-new" data-wr-form="book"><input name="t" placeholder="عنوان كتاب جديد" aria-label="عنوان كتاب جديد" autocomplete="off"><button type="submit" class="primary">${icon('plus')} كتاب جديد</button></form>`
    : `<form class="wr-new" data-wr-form="${k}"><input name="t" placeholder="${k === 'article' ? 'عنوان مقالة جديدة' : 'عنوان المنشور (اختياري)'}" aria-label="${k === 'article' ? 'عنوان مقالة جديدة' : 'عنوان المنشور'}" autocomplete="off"><button type="submit" class="primary">${icon('plus')} ${k === 'article' ? 'مقالة جديدة' : 'منشور جديد'}</button></form>`;
  const when = (b) => `آخر تعديل: ${esc(relDate(iso(new Date(b.updated))))}`;
  const row = (b) => {
    if (k === 'book') return `<button type="button" class="wr-book" data-action="wr-open" data-v="${b.id}"><b>${esc(b.title || K.none)}</b><span class="book-line">الفصول: ${b.chapters.length} | الكلمات: ${wrBookWords(b)} | ${when(b)}</span></button>`;
    const c = b.chapters[0], n = wrChWords(c);
    const name = b.title || (k === 'post' ? excerpt(wrPlain(c.html).trim(), 60) : '') || K.none;
    return `<div class="wr-item">
      <button type="button" class="wr-book" data-action="wr-edit" data-v="${b.id}"><b>${esc(name)}</b><span class="book-line">الكلمات: ${n}${k === 'article' ? ` | وقت القراءة: ${wrReadMin(n)} د` : ''} | ${when(b)}</span></button>
      <div class="wr-acts">
        <button type="button" class="chip wr-st" data-action="wr-status" data-v="${b.id}" aria-pressed="${b.status === 'pub'}">${b.status === 'pub' ? `✓ ${K.pub}` : 'مسودة'}</button>
        <button type="button" class="ghost sm" data-action="wr-copy" data-v="${b.id}">نسخ</button>
        <button type="button" class="ghost sm danger-text" data-action="wr-del" data-v="${b.id}">${wrUi.armed === `w:${b.id}` ? 'متأكد؟' : 'حذف'}</button>
      </div></div>`;
  };
  return `${moreCrumb()}
  <section class="panel">
    <div class="section-head"><h2>${esc(pageName('writing'))}</h2></div>
    ${wrTabsHTML()}
    ${form}
    ${l.length ? `<div class="wr-books">${l.map(row).join('')}</div>`
    : `<p class="note-text">${k === 'book' ? 'لا كتب بعد. اكتب عنوان كتابك ثم «كتاب جديد».' : k === 'article' ? 'لا مقالات بعد. اكتب عنوانها ثم «مقالة جديدة».' : 'لا منشورات بعد. اضغط «منشور جديد».'}</p>`}
    ${WrCloud.html()}
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

// an article's or a post's text to paste elsewhere: an article with its title, and its footnotes after it
function wrCopyText(b) {
  const c = b.chapters[0];
  let s = wrPlain(c.html, true).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const ids = wrNoteIds(c.html);
  if (ids.length) s += `\n\n${ids.map((id, i) => `(${wrNum(i + 1)}) ${(c.notes[id] || '').trim()}`).join('\n')}`;
  if (b.kind === 'article' && b.title) s = `${b.title}\n\n${s}`;
  return s;
}
function wrCopy(b) {
  const s = wrCopyText(b);
  if (!s.trim()) { toast('لا نص بعد'); return; }
  (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast('نُسخ النص'), () => toast('تعذّر النسخ'));
}

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-wr-form]');
  if (!f) return;
  e.preventDefault();
  const kind = f.dataset.wrForm;
  if (kind === 'find') { wrUi.find = f.elements.q.value.trim(); render(); return; }
  const t = f.elements.t.value.trim();
  const b = normalizeWBook({ kind, title: t, chapters: [{ title: '' }] });
  wrUi.list.unshift(b);
  wrSave(b);
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
  if (kind === 'book') { wrUi.book = b.id; render(); }
  else { render(); wrEdit(b, b.chapters[0].id); }
});

function wrArm(key) {
  if (wrUi.armed === key) { wrUi.armed = ''; return true; }
  wrUi.armed = key; render();
  setTimeout(() => { if (wrUi.armed === key) { wrUi.armed = ''; if (ui.tab === 'writing') render(); } }, 4000);
  return false;
}
function wrGone(id) { wrUi.list = wrUi.list.filter((x) => x.id !== id); WBooks.del(id).catch(() => {}); WrCloud.gone(id); }

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action^="wr-"]');
  if (!t) return;
  const a = t.dataset.action, v = t.dataset.v;
  if (!['wr-ch-del', 'wr-book-del', 'wr-del'].includes(a)) wrUi.armed = '';
  if (a === 'wr-tab') { wrUi.tab = WR_KINDS[v] ? v : 'book'; try { localStorage.setItem('mahami-wrtab', wrUi.tab); } catch {} render(); return; }
  if (a === 'wr-cloud-set') { go('settings'); return; }
  if (a === 'wr-cloud-now') { WrCloud.soon(0); return; }
  const w = v && wrBook(v);
  if (a === 'wr-edit' && w) { wrEdit(w, w.chapters[0].id); return; }
  if (a === 'wr-status' && w) { w.status = w.status === 'pub' ? 'draft' : 'pub'; wrSave(w, 3000); render(); return; }
  if (a === 'wr-copy' && w) { wrCopy(w); return; }
  if (a === 'wr-del' && w) { if (!wrArm(`w:${v}`)) return; wrGone(v); render(); toast(`حُذف ${w.kind === 'article' ? 'المقالة' : 'المنشور'}`); return; }
  const b = wrUi.book && wrBook(wrUi.book);
  if (a === 'wr-open') { wrUi.book = v; wrUi.find = ''; render(); window.scrollTo(0, 0); }
  else if (a === 'wr-list') { wrUi.book = ''; render(); }
  else if (!b) return;
  else if (a === 'wr-rename') {
    const nt = prompt('عنوان الكتاب', b.title);
    if (nt != null) { b.title = nt.trim(); wrSave(b, 3000); render(); }
  } else if (a === 'wr-ch-new') {
    const c = normalizeWChapter({ title: '' });
    b.chapters.push(c); wrSave(b); wrEdit(b, c.id);
  } else if (a === 'wr-ch') wrEdit(b, v, t.dataset.find ? wrUi.find : '');
  else if (a === 'wr-up' || a === 'wr-down') {
    const i = b.chapters.findIndex((c) => c.id === v), j = a === 'wr-up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= b.chapters.length) return;
    [b.chapters[i], b.chapters[j]] = [b.chapters[j], b.chapters[i]];
    wrSave(b, 3000); render();
  } else if (a === 'wr-ch-del') {
    if (!wrArm(`c:${v}`)) return;
    b.chapters = b.chapters.filter((c) => c.id !== v); wrSave(b, 3000); render(); toast('حُذف الفصل');
  } else if (a === 'wr-book-del') {
    if (!wrArm(`b:${v}`)) return;
    wrGone(v); wrUi.book = ''; render(); toast('حُذف الكتاب');
  } else if (a === 'wr-docx') wrDocxSave(b);
});

// ---------- the editor (a full-screen window like the notes', so the page redrawing never touches it) ----------
let wrState = null; // { book, ch, timer, dirty, hist, hi, htimer, range }
const WR_SVG = {
  close: '<path d="M9 18l6-6-6-6"/>', find: '<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5"/>',
  undo: '<path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3"/>', redo: '<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
  focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', copy: '<path d="M9 9h11v11H9zM5 15H4V4h11v1"/>',
};
const wrSvg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${WR_SVG[k]}</svg>`;
// the tools: [command, its face, its name]; «pal:…» opens a palette under the bar (or above, in focus)
const WR_TOOLS = [
  ['h2', 'عنوان', 'عنوان'], ['h3', 'فرعي', 'عنوان فرعي'], ['p', 'نص', 'نص عادي'], '|',
  ['bold', '<b>غ</b>', 'غامق'], ['italic', '<i>م</i>', 'مائل'], ['underline', '<u>ت</u>', 'تسطير'], ['strike', '<s>ش</s>', 'شطب'], '|',
  ['pal:color', '<span class="tool-color">أ</span>', 'لون الخط'], ['pal:hi', '<span class="tool-hi">أ</span>', 'تظليل'], ['pal:font', 'الخط', 'نوع الخط'],
  ['bigger', 'أ+', 'كبّر النص المحدد'], ['smaller', 'أ−', 'صغّر النص المحدد'], '|',
  ['pal:align', '☰', 'المحاذاة'], ['pal:lh', '↕', 'تباعد الأسطر'], ['ul', '•', 'قائمة نقطية'], ['ol', '١-', 'قائمة مرقّمة'],
  ['indent', '⇤', 'زِد الإزاحة'], ['outdent', '⇥', 'أنقص الإزاحة'], '|',
  ['ayah', '﴿ ﴾', 'آية'], ['quote', '❝', 'اقتباس'], ['note', 'حاشية', 'حاشية سفلية'], '|',
  ['pal:table', 'جدول', 'جدول'], ['image', 'صورة', 'صورة'], ['pgbreak', 'فاصل صفحة', 'فاصل صفحة'], ['hr', '―', 'خط فاصل'], ['clear', 'مسح التنسيق', 'مسح التنسيق'], '|',
  ['undo', wrSvg('undo'), 'تراجع'], ['redo', wrSvg('redo'), 'إعادة'],
];
const wrToolBtn = ([c, face, name]) => `<button type="button" data-wcmd="${c}" aria-label="${name}" title="${name}">${face}</button>`;
// in focus: what a selection needs (the bubble), and what needs none (the floating button)
const WR_BUBBLE = ['bold', 'italic', 'underline', 'strike', 'pal:color', 'pal:hi', 'pal:font', 'bigger', 'smaller', 'clear'];
const WR_FAB = ['h2', 'h3', 'p', 'ayah', 'quote', 'note', 'ul', 'ol', 'pal:align', 'pal:lh', 'pal:table', 'image', 'pgbreak', 'hr', 'undo', 'redo'];
const wrTool = (c) => WR_TOOLS.find((t) => t[0] === c);
function wrDialog() {
  let d = $('wrEditor');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'wrEditor';
  d.className = 'fullscreen';
  d.setAttribute('aria-label', 'محرر الكتابة');
  d.innerHTML = `<div class="me-wrap">
    <div class="me-head">
      <button type="button" class="icon-btn" data-wr="close" aria-label="رجوع وحفظ">${wrSvg('close')}</button>
      <input id="wrTitle" placeholder="عنوان الفصل" aria-label="العنوان" autocomplete="off">
      <button type="button" class="icon-btn" data-wr="copy" id="wrCopyBtn" aria-label="نسخ النص" hidden>${wrSvg('copy')}</button>
      <button type="button" class="icon-btn" data-wr="find" aria-label="بحث واستبدال">${wrSvg('find')}</button>
      <button type="button" class="icon-btn" data-wr="focus" aria-label="وضع التركيز">${wrSvg('focus')}</button>
    </div>
    <div class="me-tools" id="wrTools" role="toolbar" aria-label="أدوات الكتابة">${WR_TOOLS.map((t) => (t === '|' ? '<span class="sep"></span>' : wrToolBtn(t))).join('')}</div>
    <div class="me-pal wr-pal" id="wrPal" hidden></div>
    <div class="me-pal wr-find" id="wrFind" hidden>
      <input id="wrQ" placeholder="ابحث عن" aria-label="ابحث عن" autocomplete="off">
      <input id="wrR" placeholder="استبدله بـ" aria-label="استبدله بـ" autocomplete="off">
      <button type="button" data-wr="next">التالي</button>
      <button type="button" data-wr="rep">استبدل</button>
      <button type="button" data-wr="repall">استبدل الكل</button>
      <small id="wrFound"></small>
    </div>
    <div class="wr-scroll" id="wrScroll">
      <div id="wrBody" class="me-body wr-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="النص" data-placeholder="اكتب هنا…" dir="rtl"></div>
      <div class="wr-notes" id="wrNotes"></div>
    </div>
    <div class="me-foot wr-foot"><small id="wrStatus"></small><button type="button" class="wr-tm" id="wrTmBtn" data-wr="tm" aria-label="مؤقت التركيز">⏱ مؤقت</button></div>
  </div>
  <div class="wr-bubble" id="wrBubble" role="toolbar" aria-label="أدوات النص المحدد" hidden>${WR_BUBBLE.map((c) => wrToolBtn(wrTool(c))).join('')}</div>
  <button type="button" class="wr-fab" id="wrFab" data-wr="fab" aria-label="الأدوات">✎</button>
  <div class="wr-fabmenu" id="wrFabMenu" role="toolbar" aria-label="الأدوات" hidden>${WR_FAB.map((c) => wrToolBtn(wrTool(c))).join('')}
    <button type="button" data-wr="find" aria-label="بحث واستبدال">بحث</button><button type="button" data-wr="focus" class="wr-unfocus">كل الأدوات</button></div>
  <div class="wr-float" id="wrFloat" hidden></div>
  <div class="wr-tmpop" id="wrTmPop" hidden></div>
  <input type="file" id="wrImgIn" accept="image/*" hidden>`;
  document.body.append(d);
  d.addEventListener('close', () => { if (wrState) wrClose(true); });
  d.addEventListener('cancel', (e) => { if (wrPopsClose()) e.preventDefault(); }); // (Escape closes a palette first)
  return d;
}

// the fonts are fetched when the editor first opens (one sheet each, so a name the site lacks spoils only itself);
// the app keeps them for working without the internet
let wrFontsOn = false;
function wrFonts() {
  if (wrFontsOn) return;
  wrFontsOn = true;
  for (const [f] of WR_FONTS) {
    if (!f || f === 'Amiri' || f === 'Aref Ruqaa') continue;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}&display=swap`;
    document.head.append(l);
  }
}
const wrFocusOn = () => { try { return localStorage.getItem('mahami-wrfocus') === '1'; } catch { return false; } };
function wrSetFocus(on, once) {
  if (!once) try { localStorage.setItem('mahami-wrfocus', on ? '1' : '0'); } catch {}
  $('wrEditor').classList.toggle('wr-focus', on);
  wrPopsClose();
  wrBubble();
}

function wrEdit(b, chId, find) {
  const c = b.chapters.find((x) => x.id === chId);
  if (!c) return;
  const d = wrDialog();
  wrFonts();
  wrState = { book: b, ch: c, timer: null, dirty: false, hist: [], hi: -1, htimer: null, range: null, others: wrBookWords(b) - wrChWords(c) };
  const one = b.kind !== 'book';
  $('wrTitle').value = one ? b.title : c.title;
  $('wrTitle').placeholder = b.kind === 'article' ? 'عنوان المقالة' : b.kind === 'post' ? 'عنوان (اختياري، لا يُنسخ)' : 'عنوان الفصل';
  $('wrCopyBtn').hidden = !one;
  d.classList.toggle('wr-arabic', S.settings.digits === 'arab');
  $('wrBody').innerHTML = c.html;
  $('wrNotes').innerHTML = '';
  $('wrFind').hidden = !find;
  $('wrQ').value = find || '';
  $('wrR').value = '';
  $('wrFound').textContent = '';
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  wrRenumber();
  wrMark();
  wrStatus('');
  wrTmShow();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  d.classList.toggle('wr-focus', wrFocusOn());
  wrPopsClose();
  $('wrScroll').scrollTop = 0;
  if (find) setTimeout(() => wrFindNext(), 50);
  else if (!c.html) setTimeout(() => $(c.title || b.title || b.kind === 'post' ? 'wrBody' : 'wrTitle').focus(), 50);
}

function wrClose(fromEvent) {
  if (!wrState) return;
  wrSaveNow();
  clearTimeout(wrState.htimer);
  wrState = null;
  WrCloud.soon(1500);
  try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch {} // (the notes' editor as it was)
  wrPopsClose();
  const d = $('wrEditor');
  if (!fromEvent && d) { if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open'); }
  render();
}

// the words in the editor, from its text alone (its pictures' data and markup left aside: a chapter with photos stays quick)
function wrBodyWords() {
  const w = document.createTreeWalker($('wrBody'), NodeFilter.SHOW_TEXT), parts = [];
  while (w.nextNode()) if (!w.currentNode.parentNode.closest('sup.fn, .pgbreak')) parts.push(w.currentNode.textContent);
  return wrWords(parts.join(' '));
}
function wrStatus(s) {
  if (!wrState) return;
  const b = wrState.book, n = wrBodyWords();
  const words = b.kind === 'book' ? `الكلمات: الفصل ${wrNum(n)} | الكتاب ${wrNum(wrState.others + n)}`
    : b.kind === 'article' ? `الكلمات: ${wrNum(n)} | وقت القراءة: ${wrNum(wrReadMin(n))} د` : `الكلمات: ${wrNum(n)}`;
  $('wrStatus').textContent = `${words}${s ? ` | ${s}` : ''}`;
}
// the editor keeps its own history of the chapter (text, footnotes and the cursor), so «تراجع» also undoes
// a «استبدل الكل», a footnote or a verse box, which the browser's own undo does not know
function wrCaret() {
  const sel = getSelection(), body = $('wrBody');
  if (!sel.rangeCount || !body.contains(sel.anchorNode)) return -1;
  const r = document.createRange(); r.selectNodeContents(body); r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}
function wrSetCaret(n) {
  if (n < 0) return;
  const w = document.createTreeWalker($('wrBody'), NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode;
    if (n <= t.textContent.length) { const r = document.createRange(); r.setStart(t, n); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return; }
    n -= t.textContent.length;
  }
}
function wrMark() {
  if (!wrState) return;
  clearTimeout(wrState.htimer);
  const snap = { html: $('wrBody').innerHTML, notes: JSON.stringify(wrState.ch.notes), caret: wrCaret() };
  const cur = wrState.hist[wrState.hi];
  if (cur && cur.html === snap.html && cur.notes === snap.notes) { cur.caret = snap.caret; return; }
  wrState.hist = wrState.hist.slice(0, wrState.hi + 1);
  wrState.hist.push(snap);
  const most = snap.html.length > 2e6 ? 8 : snap.html.length > 5e5 ? 20 : 60; // (fewer steps kept for a chapter heavy with pictures)
  while (wrState.hist.length > most) wrState.hist.shift();
  wrState.hi = wrState.hist.length - 1;
}
function wrHistory(step) {
  if (!wrState) return;
  wrMark();
  const i = wrState.hi + step;
  if (i < 0 || i >= wrState.hist.length) return;
  wrState.hi = i;
  const snap = wrState.hist[i];
  $('wrBody').innerHTML = snap.html;
  wrState.ch.notes = JSON.parse(snap.notes);
  $('wrNotes').innerHTML = '';
  wrRenumber();
  $('wrBody').focus();
  wrSetCaret(snap.caret);
  wrState.dirty = true;
  clearTimeout(wrState.timer);
  wrState.timer = setTimeout(wrSaveNow, 700);
  wrStatus('يحفظ…');
}
function wrDirty() {
  if (!wrState) return;
  clearTimeout(wrState.htimer);
  wrState.htimer = setTimeout(wrMark, 500);
  wrState.dirty = true;
  clearTimeout(wrState.timer);
  wrState.timer = setTimeout(wrSaveNow, wrState.hist.length && wrState.hist[wrState.hi] && wrState.hist[wrState.hi].html.length > 1e6 ? 2500 : 700);
  wrStatus('يحفظ…');
}
function wrSaveNow() {
  if (!wrState || !wrState.dirty) return;
  clearTimeout(wrState.timer);
  const c = wrState.ch, b = wrState.book;
  if (b.kind === 'book') c.title = $('wrTitle').value.trim(); else b.title = $('wrTitle').value.trim();
  c.html = wrSafe($('wrBody').innerHTML);
  c.updated = Date.now();
  wrState.dirty = false;
  wrSave(b).then(() => wrStatus('حُفظ ✓'));
}

// footnote marks are numbered in the order they stand, between small parentheses «(١)»; the notes under the text follow them
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
    const n = `(${wrNum(i + 1)})`;
    if (m.textContent !== n) m.textContent = n;
  });
  const box = $('wrNotes');
  const ids = marks.map((m) => m.dataset.fn);
  if (!ids.length) { box.innerHTML = ''; return; }
  const have = [...box.querySelectorAll('textarea')].map((x) => x.dataset.fn).join();
  if (have === ids.join()) { box.querySelectorAll('.wr-note b').forEach((x, i) => { x.textContent = `(${wrNum(i + 1)})`; }); return; }
  box.innerHTML = `<h3>الحواشي</h3>${ids.map((id, i) => `<div class="wr-note"><b>(${wrNum(i + 1)})</b><textarea data-fn="${id}" rows="2" aria-label="الحاشية ${i + 1}">${esc(c.notes[id] || '')}</textarea><button type="button" class="ghost sm danger-text" data-wr="fndel" data-fn="${id}">حذف</button></div>`).join('')}`;
}
// a footnote deleted with its mark in the text (two taps; «تراجع» brings it back)
function wrNoteDel(btn) {
  if (btn.dataset.armed !== '1') {
    btn.dataset.armed = '1'; btn.textContent = 'متأكد؟';
    setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'حذف'; } }, 4000);
    return;
  }
  const id = btn.dataset.fn;
  wrMark();
  for (const m of $('wrBody').querySelectorAll(`sup.fn[data-fn="${id}"]`)) m.remove();
  delete wrState.ch.notes[id];
  wrRenumber();
  wrDirty();
  wrMark();
  toast('حُذفت الحاشية ورقمها');
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
// the paragraphs (and list items, table cells) the selection touches
function wrBlocks() {
  const sel = getSelection(), body = $('wrBody');
  if (!sel.rangeCount || !body.contains(sel.anchorNode)) return [];
  const r = sel.getRangeAt(0);
  const pick = () => [...body.querySelectorAll('p, h2, h3, blockquote, li, td, th')].filter((b) => r.intersectsNode(b) && !b.querySelector('p, h2, h3, blockquote, li'));
  let l = pick();
  if (!l.length) { document.execCommand('formatBlock', false, '<p>'); l = pick(); } // (a first line typed outside any paragraph)
  return l;
}
// the selection kept while a palette is open, and put back before a tool works on it
function wrKeep() { const sel = getSelection(); if (wrState && sel.rangeCount && $('wrBody').contains(sel.anchorNode)) wrState.range = sel.getRangeAt(0).cloneRange(); }
function wrBack() {
  const sel = getSelection(), body = $('wrBody');
  if (sel.rangeCount && body.contains(sel.anchorNode)) return;
  body.focus();
  if (wrState && wrState.range && body.contains(wrState.range.startContainer)) { sel.removeAllRanges(); sel.addRange(wrState.range); }
}
const wrExec = (cmd, val, css) => { try { document.execCommand('styleWithCSS', false, !!css); } catch {} return document.execCommand(cmd, false, val); };
// a colour, highlight or font back to the text's own: applied with a marker, then that marker's style taken off
function wrUnstyle(prop, test) {
  for (const sp of [...$('wrBody').querySelectorAll('span, font')]) {
    if (!test(sp)) continue;
    for (const inner of sp.querySelectorAll('span')) inner.style[prop] = '';
    sp.style[prop] = '';
    if (sp.nodeName === 'FONT') { sp.removeAttribute('color'); sp.removeAttribute('face'); }
    if (!sp.getAttribute('style') || !sp.style.length) { if (sp.nodeName === 'SPAN' || !sp.attributes.length) sp.replaceWith(...sp.childNodes); }
  }
}
// the selected text larger or smaller: a step of 15%, between 0.6 and 3 times its paragraph's size
function wrResize(f) {
  const body = $('wrBody'), sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed || !body.contains(sel.anchorNode)) { toast('حدّد النص الذي تريد تكبيره أو تصغيره'); return false; }
  const r = sel.getRangeAt(0);
  let el = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer.childNodes[r.startOffset] || r.startContainer;
  if (el.nodeType !== 1) el = el.parentNode;
  const blk = el.closest('p, h2, h3, blockquote, li, td, th') || body;
  const px = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
  const bp = px(blk), want = Math.min(bp * 3, Math.max(bp * 0.6, px(el) * f));
  wrExec('fontSize', '7');
  const made = [];
  for (const ft of [...body.querySelectorAll('font[size="7"]')]) {
    const sp = document.createElement('span');
    for (const s of ft.querySelectorAll('[style]')) s.style.fontSize = '';
    while (ft.firstChild) sp.append(ft.firstChild);
    ft.replaceWith(sp);
    made.push(sp);
  }
  for (const sp of made) sp.style.fontSize = `${Math.round((want / px(sp.parentNode)) * 100) / 100}em`;
  if (made.length) { const nr = document.createRange(); nr.setStartBefore(made[0]); nr.setEndAfter(made[made.length - 1]); sel.removeAllRanges(); sel.addRange(nr); }
  return true;
}
// a list made of the paragraphs selected, or (on a list of the same kind) undone: by hand, as the browser's own put the
// list inside the paragraph and its cursor at the line's start
function wrList(tag) {
  const T = tag.toUpperCase(), caret = wrCaret();
  const blks = wrBlocks().filter((b) => b.nodeName === 'LI' || b.parentNode === $('wrBody'));
  if (!blks.length) return;
  const move = (from, to) => { to.style.cssText = from.style.cssText; if (from.dataset.ind) to.dataset.ind = from.dataset.ind; if (from.classList.contains('ayah') && to.nodeName === 'P') to.className = 'ayah'; while (from.firstChild) to.append(from.firstChild); };
  if (blks.every((b) => b.nodeName === 'LI' && b.parentNode.nodeName === T)) {
    for (const li of blks) {
      const list = li.parentNode, p = document.createElement('p');
      const after = [...list.children].slice([...list.children].indexOf(li) + 1);
      if (after.length) { const rest = document.createElement(list.nodeName.toLowerCase()); for (const x of after) rest.append(x); list.after(rest); }
      list.after(p); move(li, p); li.remove();
      if (!list.children.length) list.remove();
    }
  } else {
    let list = null;
    for (const b of blks) {
      if (b.nodeName === 'LI') { const old = b.parentNode; if (old.nodeName !== T) { const nl = document.createElement(tag); while (old.firstChild) nl.append(old.firstChild); old.replaceWith(nl); } list = null; continue; }
      const prev = b.previousElementSibling;
      if (!list) { list = prev && prev.nodeName === T ? prev : document.createElement(tag); if (list !== prev) b.before(list); }
      const li = document.createElement('li'); move(b, li); if (!li.firstChild) li.append(document.createElement('br'));
      list.append(li); b.remove();
    }
  }
  wrSetCaret(caret);
}
function wrIndent(step) {
  for (const b of wrBlocks()) {
    const n = Math.min(6, Math.max(0, (Number(b.dataset.ind) || 0) + step));
    if (n) b.dataset.ind = String(n); else delete b.dataset.ind;
  }
}
// a table: inserted with its size, then a row or a column after the cursor's, or one taken away
function wrCell() { const sel = getSelection(); const n = sel.rangeCount && sel.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentNode); return el && $('wrBody').contains(el) ? el.closest('td, th') : null; }
function wrTable(op, rows, cols) {
  const cell = wrCell();
  if (op === 'ins') {
    const tr = `<tr>${'<td><br></td>'.repeat(cols)}</tr>`;
    wrExec('insertHTML', `<table class="wr-tbl"><tbody>${tr.repeat(rows)}</tbody></table><p><br></p>`);
    return;
  }
  if (!cell) return;
  const tr = cell.parentNode, tbl = cell.closest('table'), ci = [...tr.children].indexOf(cell);
  const empty = () => { const td = document.createElement('td'); td.append(document.createElement('br')); return td; };
  if (op === 'row') { const nr = document.createElement('tr'); for (let i = 0; i < tr.children.length; i++) nr.append(empty()); tr.after(nr); }
  else if (op === 'col') { for (const row of tbl.querySelectorAll('tr')) { const c = row.children[ci]; if (c) c.after(empty()); else row.append(empty()); } }
  else if (op === 'rowdel') { if (tbl.querySelectorAll('tr').length > 1) tr.remove(); else tbl.remove(); }
  else if (op === 'coldel') { if (tr.children.length > 1) { for (const row of tbl.querySelectorAll('tr')) if (row.children[ci]) row.children[ci].remove(); } else tbl.remove(); }
  else if (op === 'del') tbl.remove();
}
// a picture from the phone: made smaller (1200 points wide at most) and kept in the text itself
function wrImage(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1200 / img.naturalWidth), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    if (!wrState) return;
    wrBack(); wrMark();
    wrExec('insertHTML', `<img src="${cv.toDataURL('image/jpeg', 0.85)}" data-w="${w}" data-h="${h}" alt="">`);
    wrDirty(); wrMark();
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('تعذّر فتح الصورة'); };
  img.src = url;
}

function wrCmd(cmd) {
  const body = $('wrBody');
  if (cmd.startsWith('pal:')) { wrPal(cmd.slice(4)); return; }
  wrBack();
  if (cmd === 'undo' || cmd === 'redo') { wrHistory(cmd === 'undo' ? -1 : 1); return; }
  if (cmd === 'image') { wrKeep(); $('wrImgIn').value = ''; $('wrImgIn').click(); return; }
  wrMark(); // (what was typed before this change is one step of «تراجع»)
  if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') wrExec(cmd);
  else if (cmd === 'strike') wrExec('strikeThrough');
  else if (cmd === 'bigger' || cmd === 'smaller') { if (!wrResize(cmd === 'bigger' ? 1.15 : 1 / 1.15)) return; }
  else if (cmd === 'ul' || cmd === 'ol') wrList(cmd);
  else if (cmd === 'indent' || cmd === 'outdent') wrIndent(cmd === 'indent' ? 1 : -1);
  else if (cmd === 'pgbreak') wrExec('insertHTML', '<div class="pgbreak" contenteditable="false">فاصل صفحة</div><p><br></p>');
  else if (cmd === 'hr') wrExec('insertHTML', '<hr><p><br></p>');
  else if (cmd === 'clear') {
    // (the footnote marks stay: the browser's own clearing takes a «sup» away)
    const marks = [...body.querySelectorAll('sup.fn')].map((m) => m.dataset.fn).join();
    const before = body.innerHTML;
    wrExec('removeFormat');
    wrUnstyle('fontSize', (sp) => !!sp.style.fontSize && getSelection().containsNode(sp, true));
    if ([...body.querySelectorAll('sup.fn')].map((m) => m.dataset.fn).join() !== marks) { body.innerHTML = before; toast('حدّد النص دون رقم الحاشية لمسح تنسيقه'); return; }
  } else if (cmd === 'h2' || cmd === 'h3' || cmd === 'p' || cmd === 'quote') {
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
    wrPopsClose();
    const ta = $('wrNotes').querySelector(`textarea[data-fn="${id}"]`);
    if (ta) setTimeout(() => { ta.focus(); ta.scrollIntoView({ block: 'center' }); }, 30);
  }
  wrRenumber();
  wrDirty();
  wrMark();
  wrBubble();
}

// the palettes: under the bar, or (in focus) above the bubble or the floating button
const WR_ALIGN = [['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار'], ['justify', 'ضبط']];
const WR_LH = [['1', 'مفرد'], ['1.15', '١٫١٥'], ['1.5', '١٫٥'], ['2', 'مزدوج']];
function wrPalHTML(k) {
  if (k === 'color') return NOTE_COLORS.map(([c, n]) => `<button type="button" class="pal" data-wcolor="${c}" title="${n}" aria-label="لون ${n}" style="${c ? `background:${c}` : ''}">${c ? '' : 'أ'}</button>`).join('');
  if (k === 'hi') return NOTE_HIGHLIGHTS.map(([c, n]) => `<button type="button" class="pal" data-whi="${c}" title="${n}" aria-label="تظليل ${n}" style="${c ? `background:${c}` : ''}">${c ? '' : '✕'}</button>`).join('');
  if (k === 'font') return `<div class="wr-fonts">${WR_FONTS.map(([f, n]) => `<button type="button" data-wfont="${f}" style="${f ? `font-family:'${f}'` : ''}">${n}</button>`).join('')}</div>`;
  if (k === 'align') return WR_ALIGN.map(([v, n]) => `<button type="button" class="chip" data-walign="${v}">${n}</button>`).join('');
  if (k === 'lh') return WR_LH.map(([v, n]) => `<button type="button" class="chip" data-wlh="${v}">${n}</button>`).join('');
  if (k === 'table') return wrCell()
    ? [['row', 'صف بعده'], ['col', 'عمود بعده'], ['rowdel', 'احذف الصف'], ['coldel', 'احذف العمود'], ['del', 'احذف الجدول']].map(([v, n]) => `<button type="button" class="chip${/del/.test(v) ? ' danger-text' : ''}" data-wtbl="${v}">${n}</button>`).join('')
    : `<label class="wr-num">الصفوف <input type="text" inputmode="numeric" id="wrTr" value="${wrNum(3)}" data-novoice></label><label class="wr-num">الأعمدة <input type="text" inputmode="numeric" id="wrTc" value="${wrNum(2)}" data-novoice></label><button type="button" class="primary" data-wtbl="ins">أدرج الجدول</button>`;
  return '';
}
function wrPal(k) {
  const focus = $('wrEditor').classList.contains('wr-focus');
  const host = focus ? $('wrFloat') : $('wrPal');
  wrKeep();
  if (!host.hidden && host.dataset.k === k) { wrPopsClose(); return; }
  wrPopsClose();
  host.dataset.k = k;
  host.innerHTML = wrPalHTML(k);
  host.hidden = false;
  if (focus) $('wrFabMenu').hidden = true;
}
// what floats over the text closes (back, Escape, a tool used); true when something was open
function wrPopsClose() {
  let any = false;
  for (const id of ['wrPal', 'wrFloat', 'wrFabMenu', 'wrTmPop']) { const el = $(id); if (el && !el.hidden) { el.hidden = true; any = true; } }
  return any;
}
// the bubble: in focus, under (or above) the text selected
function wrBubble() {
  const bub = $('wrBubble');
  if (!bub) return;
  const sel = getSelection(), body = $('wrBody');
  const on = wrState && $('wrEditor').classList.contains('wr-focus') && sel.rangeCount && !sel.isCollapsed && body.contains(sel.anchorNode) && body.contains(sel.focusNode);
  if (!on) { if (!$('wrFloat').hidden && $('wrFloat').dataset.k && WR_BUBBLE.includes(`pal:${$('wrFloat').dataset.k}`)) return; bub.hidden = true; return; }
  const r = sel.getRangeAt(0).getBoundingClientRect();
  bub.hidden = false;
  const bw = bub.offsetWidth, bh = bub.offsetHeight;
  let top = r.bottom + 34; // (under the selection's handles; the phone's own menu stands above it)
  if (top + bh > innerHeight - 70) top = Math.max(8, r.top - bh - 44);
  const left = Math.min(innerWidth - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2));
  bub.style.top = `${top}px`;
  bub.style.left = `${left}px`;
}
let wrSelT = 0;
document.addEventListener('selectionchange', () => {
  if (!wrState) return;
  cancelAnimationFrame(wrSelT);
  wrSelT = requestAnimationFrame(() => { wrKeep(); wrBubble(); });
});

// find and replace in this chapter (a match inside one stretch of text)
function wrTextNodes() { const w = document.createTreeWalker($('wrBody'), NodeFilter.SHOW_TEXT); const out = []; while (w.nextNode()) if (!w.currentNode.parentNode.closest('sup.fn, .pgbreak')) out.push(w.currentNode); return out; }
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
  wrMark();
  let n = 0;
  for (const t of wrTextNodes()) { const k = wrCount(t.textContent, q); if (k) { n += k; t.textContent = t.textContent.split(q).join(r); } }
  for (const ta of $('wrNotes').querySelectorAll('textarea')) { const k = wrCount(ta.value, q); if (k) { n += k; ta.value = ta.value.split(q).join(r); wrState.ch.notes[ta.dataset.fn] = ta.value; } }
  $('wrFound').textContent = n ? `استُبدل ${wrNum(n)} مرة في هذا الفصل` : 'لم يوجد في هذا الفصل';
  if (n) { wrDirty(); wrMark(); }
}

// the tools keep the cursor (and the selection) in the text
document.addEventListener('pointerdown', (e) => {
  if (!wrState) return;
  if (e.target.closest('#wrTools button, #wrPal button, #wrBubble button, #wrFabMenu button, #wrFloat button, #wrFab')) e.preventDefault();
  // a tap elsewhere closes what floats (not a tap in it, nor on what opens it)
  if (!e.target.closest('#wrPal, #wrFloat, #wrFabMenu, #wrTmPop, #wrBubble, #wrTools, #wrFab, #wrTmBtn')) wrPopsClose();
});
document.addEventListener('change', (e) => { if (e.target.id === 'wrImgIn' && wrState) wrImage(e.target.files && e.target.files[0]); });
document.addEventListener('click', (e) => {
  if (!wrState) return;
  const t = e.target.closest('[data-wcmd], [data-wr], [data-wcolor], [data-whi], [data-wfont], [data-walign], [data-wlh], [data-wtbl], [data-wtm], #wrBody sup.fn');
  if (!t) return;
  if (t.dataset.wcmd) { const fab = t.closest('#wrFabMenu'); wrCmd(t.dataset.wcmd); if (fab && !t.dataset.wcmd.startsWith('pal:')) $('wrFabMenu').hidden = true; return; }
  // (v157, «اجعل مدخلات التحرير تبقى إذا ضغطتها … ليتسنى لي التنقل بينها»: a font, colour, highlight, alignment or spacing
  // palette stays open with the text still selected, to try one after another; the table's closes)
  const style = (fn, close) => { wrBack(); wrMark(); fn(); if (close) wrPopsClose(); wrRenumber(); wrDirty(); wrMark(); wrBubble(); };
  if (t.dataset.wcolor !== undefined) { const c = t.dataset.wcolor; style(() => { if (c) wrExec('foreColor', c, true); else { wrExec('foreColor', '#010203', true); wrUnstyle('color', (sp) => /rgb\(1, 2, 3\)|#010203/i.test(sp.style.color || sp.getAttribute('color') || '')); } }); return; }
  if (t.dataset.whi !== undefined) { const c = t.dataset.whi; style(() => { if (c) wrExec('hiliteColor', c, true); else { wrExec('hiliteColor', '#010203', true); wrUnstyle('backgroundColor', (sp) => /rgb\(1, 2, 3\)/.test(sp.style.backgroundColor)); } }); return; }
  if (t.dataset.wfont !== undefined) { const f = t.dataset.wfont; style(() => { if (f) wrExec('fontName', f, true); else { wrExec('fontName', 'wr-reset', true); wrUnstyle('fontFamily', (sp) => /wr-reset/.test(sp.style.fontFamily || sp.getAttribute('face') || '')); } }); return; }
  if (t.dataset.walign) { style(() => { for (const b of wrBlocks()) b.style.textAlign = t.dataset.walign; }); return; }
  if (t.dataset.wlh) { style(() => { for (const b of wrBlocks()) b.style.lineHeight = t.dataset.wlh === '1.15' ? '1.15' : t.dataset.wlh; }); return; }
  if (t.dataset.wtbl) {
    const op = t.dataset.wtbl, rd = (id, d) => Math.min(20, Math.max(1, Math.round(num(($(id) || {}).value || '')) || d));
    const rows = rd('wrTr', 3), cols = rd('wrTc', 2);
    style(() => wrTable(op, rows, cols), true);
    return;
  }
  if (t.dataset.wtm) { wrTm(t.dataset.wtm); return; }
  if (t.matches('sup.fn')) { const ta = $('wrNotes').querySelector(`textarea[data-fn="${t.dataset.fn}"]`); if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center' }); } return; }
  const a = t.dataset.wr;
  if (a === 'close') wrClose();
  else if (a === 'copy') { wrSaveNow(); wrCopy(wrState.book); }
  else if (a === 'focus') { $('wrFabMenu').hidden = true; wrSetFocus(!$('wrEditor').classList.contains('wr-focus')); }
  else if (a === 'fab') { const m = $('wrFabMenu'), show = m.hidden; wrPopsClose(); m.hidden = !show; }
  else if (a === 'tm') { const p = $('wrTmPop'), show = p.hidden; wrPopsClose(); if (show) { p.innerHTML = wrTmPopHTML(); p.hidden = false; } }
  else if (a === 'fndel') wrNoteDel(t);
  else if (a === 'find') { $('wrFabMenu').hidden = true; const f = $('wrFind'); f.hidden = !f.hidden; if (!f.hidden) { if ($('wrEditor').classList.contains('wr-focus')) wrSetFocus(false, true); /* (this time only: focus stays his choice) */ const s = getSelection().toString(); if (s && s.length < 80) $('wrQ').value = s; $('wrQ').focus(); } }
  else if (a === 'next') wrFindNext();
  else if (a === 'rep') wrReplace(false);
  else if (a === 'repall') wrReplace(true);
});
// the first line typed stands in a paragraph of its own (outside one, a list or a heading made of it went astray)
document.addEventListener('focusin', (e) => {
  if (!wrState || e.target.id !== 'wrBody' || e.target.firstChild) return;
  const p = document.createElement('p'); p.append(document.createElement('br'));
  e.target.append(p);
  const r = document.createRange(); r.setStart(p, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
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
  if (e.target.id === 'wrBody' && (e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) { e.preventDefault(); wrHistory(e.key.toLowerCase() === 'y' || e.shiftKey ? 1 : -1); }
});
document.addEventListener('beforeinput', (e) => {
  if (!wrState || e.target.id !== 'wrBody') return;
  if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') { e.preventDefault(); wrHistory(e.inputType === 'historyUndo' ? -1 : 1); }
});
// pasted text keeps only what a chapter keeps (Word's own markup goes)
document.addEventListener('paste', (e) => {
  if (!wrState || !(e.target.closest && e.target.closest('#wrBody'))) return;
  const html = e.clipboardData && e.clipboardData.getData('text/html');
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (!html && !text) return;
  e.preventDefault();
  const plain = () => (text || '').split(/\r?\n/).map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
  let clean = html ? wrClean(html) : '';
  if (!clean.replace(/<[^>]+>/g, '').trim() && !/sup class="fn"/.test(clean)) clean = plain(); // (markup that cleans to nothing: its plain text)
  wrMark();
  document.execCommand('insertHTML', false, clean);
  wrRenumber();
  wrDirty();
});
window.addEventListener('pagehide', () => { if (wrState) wrSaveNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && wrState) wrSaveNow(); });

// ---------- the focus timer: a countdown at the bottom side, its minutes counted in «وقت التركيز» in the report ----------
// (kept in this device: it goes on if the editor is closed or the app is, and is counted when it ends)
const WR_TM = 'mahami-wrtimer';
let wrTmS = (() => { try { return JSON.parse(localStorage.getItem(WR_TM)) || null; } catch { return null; } })();
let wrTmI = 0;
const wrTmStore = () => { try { if (wrTmS) localStorage.setItem(WR_TM, JSON.stringify(wrTmS)); else localStorage.removeItem(WR_TM); } catch {} };
const wrTmLeft = () => (!wrTmS ? 0 : wrTmS.end ? Math.max(0, wrTmS.end - Date.now()) : wrTmS.left);
const wrMMSS = (ms) => { const s = Math.ceil(ms / 1000); return wrNum(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); };
function wrTmPopHTML() {
  if (!wrTmS) return `<b>مؤقت التركيز</b><div class="chips wrap">${[15, 25, 45, 60].map((m) => `<button type="button" class="chip" data-wtm="${m}">${wrNum(m)} د</button>`).join('')}</div>
    <div class="wr-tm-own"><input type="text" inputmode="numeric" id="wrTmMin" placeholder="أو اكتب الدقائق" aria-label="الدقائق" data-novoice autocomplete="off"><button type="button" class="primary" data-wtm="own">ابدأ</button></div>`;
  return `<b>بقي ${wrMMSS(wrTmLeft())} من ${wrNum(Math.round(wrTmS.dur / 60000))} د</b><div class="chips wrap">
    <button type="button" class="chip" data-wtm="${wrTmS.end ? 'pause' : 'go'}">${wrTmS.end ? 'أوقفه مؤقتاً' : 'أكمل'}</button>
    <button type="button" class="chip danger-text" data-wtm="stop">أنهِه الآن</button></div>`;
}
function wrTm(a) {
  if (a === 'pause' && wrTmS && wrTmS.end) { wrTmS.left = wrTmLeft(); wrTmS.end = 0; }
  else if (a === 'go' && wrTmS && !wrTmS.end) { wrTmS.end = Date.now() + wrTmS.left; }
  else if (a === 'stop') { wrTmDone(false); }
  else if (!wrTmS) {
    const m = a === 'own' ? Math.round(num(($('wrTmMin') || {}).value || '')) : Number(a);
    if (!(m >= 1 && m <= 600)) { toast('اكتب الدقائق، مثل: ٢٥'); return; }
    const b = wrState && wrState.book;
    wrTmS = { dur: m * 60000, end: Date.now() + m * 60000, left: 0, start: Date.now(), label: b ? (b.title || WR_KINDS[b.kind].none) : '' };
  }
  wrTmStore();
  wrPopsClose();
  wrTmShow();
}
// its time is a session in «وقت التركيز»: all of it when it ends, what passed when it is ended early (a minute at least)
function wrTmDone(full) {
  if (!wrTmS) return;
  const ms = full ? wrTmS.dur : wrTmS.dur - wrTmLeft(), end = full && wrTmS.end ? wrTmS.end : Date.now();
  if (ms >= 60000) {
    S.sessions.push({ id: uid(), taskId: '', start: end - ms, end, ms: Math.round(ms), mode: 'write', label: `الكتابة${wrTmS.label ? `: «${wrTmS.label}»` : ''}` });
    save();
  }
  wrTmS = null;
  wrTmStore();
  if (full) { try { beep(); } catch {} try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {} toast(`انتهى وقت التركيز: ${fmtDur(ms)}`); }
  else if (ms >= 60000) toast(`سُجّل ${fmtDur(ms)} في وقت التركيز`);
}
function wrTmShow() {
  const btn = $('wrTmBtn');
  if (wrTmS && wrTmS.end && wrTmLeft() <= 0) wrTmDone(true);
  if (btn) {
    btn.textContent = !wrTmS ? '⏱ مؤقت' : `${wrTmS.end ? '⏱' : '⏸'} ${wrMMSS(wrTmLeft())}`;
    btn.classList.toggle('on', !!wrTmS);
    const p = $('wrTmPop'); if (p && !p.hidden && !p.contains(document.activeElement)) p.innerHTML = wrTmPopHTML();
  }
  clearInterval(wrTmI);
  if (wrTmS && wrTmS.end) wrTmI = setInterval(wrTmShow, 1000);
}
setTimeout(() => { if (typeof S !== 'undefined') wrTmShow(); }, 1500); // (one that ended while the app was closed is counted)

// ---------- a Word file: the book's title, each chapter from a new page, its headings, and footnotes at the foot ----------
function wrDocx(b) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const x = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const F = 'Amiri'; // (v157: the editor's own font, so the file reads as it was written; Traditional Arabic is not on a phone)
  const notes = [], media = [];
  // (Word reads a paragraph's settings in the schema's order only: bidi stands after the borders and before the spacing)
  const PPR = ['pStyle', 'keepNext', 'pageBreakBefore', 'pBdr', 'bidi', 'spacing', 'ind', 'jc', 'outlineLvl'];
  const ordered = (ppr) => (ppr.match(/<w:(\w+)(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:\1>)/g) || []).concat('<w:bidi/>')
    .sort((m, n) => PPR.indexOf(m.match(/^<w:(\w+)/)[1]) - PPR.indexOf(n.match(/^<w:(\w+)/)[1])).join('');
  // (v156) a run's look: font, bold, italic, strike, colour, size (the paragraph's own times its «em»), underline, highlight
  const hex = (c) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
    if (m) return [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase();
    const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || '');
    return h ? (h[1].length === 3 ? h[1].replace(/./g, '$&$&') : h[1]).toUpperCase() : '';
  };
  const rpr = (f) => `<w:rPr>${f.font ? `<w:rFonts w:ascii="${x(f.font)}" w:hAnsi="${x(f.font)}" w:cs="${x(f.font)}"/>` : ''}${f.b ? '<w:b/><w:bCs/>' : ''}${f.i ? '<w:i/><w:iCs/>' : ''}${f.s ? '<w:strike/>' : ''}${f.color ? `<w:color w:val="${f.color}"/>` : ''}${f.em && f.em !== 1 ? `<w:sz w:val="${Math.round(f.base * f.em)}"/><w:szCs w:val="${Math.round(f.base * f.em)}"/>` : ''}${f.u ? '<w:u w:val="single"/>' : ''}${f.hi ? `<w:shd w:val="clear" w:color="auto" w:fill="${f.hi}"/>` : ''}<w:rtl/></w:rPr>`;
  const run = (text, f) => text.split('\n').map((line, i) => `<w:r>${rpr(f)}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`).join('');
  const EMU = 9525, MAXW = 5731510; // (a picture as wide as the page's text at most)
  const pic = (img) => {
    const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(img.getAttribute('src') || '');
    if (!m) return '';
    const bin = atob(m[2]), data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const n = media.length + 1, ext = m[1] === 'png' ? 'png' : 'jpeg';
    media.push({ name: `word/media/image${n}.${ext}`, data, ext });
    const w = Number(img.dataset.w) || 600, h = Number(img.dataset.h) || 400;
    const cx = Math.min(w * EMU, MAXW), cy = Math.round((cx * h) / w);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="صورة ${n}"/>`
      + `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
      + `<pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
      + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  // a footnote mark between small parentheses «(١)», numbered in its chapter as in the editor (Word's own number left aside)
  // (v157) a footnote's number is Word's own (in Arabic digits when the app shows them, from one in each chapter), between
  // small parentheses: a mark of the app's own text («customMarkFollows») came out «1(١)» where Word's own number is shown too
  const FR = '<w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr>';
  // (the parentheses held on the right by a right-to-left mark, so a footnote's number at a line's start reads «(١)» not «()١»)
  const NF = S.settings.digits === 'arab' ? 'hindiNumbers' : 'decimal';
  const runs = (node, f, ch) => [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent ? run(n.textContent, f) : '';
    if (n.nodeType !== 1) return '';
    const N = n.nodeName;
    if (N === 'BR') return '<w:r><w:br/></w:r>';
    if (N === 'IMG') return pic(n);
    if (N === 'SUP' && n.classList.contains('fn')) {
      notes.push(ch.notes[n.dataset.fn] || '');
      return `<w:r>${FR}<w:t>\u200F(</w:t></w:r><w:r>${FR}<w:footnoteReference w:id="${notes.length}"/></w:r><w:r>${FR}<w:t>)\u200F</w:t></w:r>`;
    }
    const st = n.style || {}, g = { ...f };
    if (N === 'B' || N === 'STRONG') g.b = true;
    if (N === 'I' || N === 'EM') g.i = true;
    if (N === 'U') g.u = true;
    if (N === 'S' || N === 'STRIKE') g.s = true;
    if (st.color && hex(st.color)) g.color = hex(st.color);
    if (st.backgroundColor && hex(st.backgroundColor)) g.hi = hex(st.backgroundColor);
    if (wrFontOf(st.fontFamily)) g.font = wrFontOf(st.fontFamily);
    const em = /^([\d.]+)em$/.exec(st.fontSize || '');
    if (em) g.em = (g.em || 1) * +em[1];
    return runs(n, g, ch);
  }).join('');
  const BASE = { Normal: 32, Title: 56, Heading1: 44, Heading2: 38, Heading3: 34, Ayah: 34, Quote: 32 };
  const JC = { right: 'left', left: 'right', center: 'center', justify: 'both' }; // (in a right-to-left paragraph Word reads «left» as its start)
  const pprOf = (el) => {
    const st = el.style || {};
    let o = '';
    if (/^\d(\.\d+)?$/.test(st.lineHeight || '')) o += `<w:spacing w:line="${Math.round(240 * +st.lineHeight)}" w:lineRule="auto"/>`;
    const ind = Number(el.dataset && el.dataset.ind) || 0;
    if (ind) o += `<w:ind w:left="${567 * ind}"/>`;
    if (JC[st.textAlign]) o += `<w:jc w:val="${JC[st.textAlign]}"/>`;
    return o;
  };
  const para = (style, inner, extra = '') => `<w:p><w:pPr>${ordered(`<w:pStyle w:val="${style}"/>${extra}`)}</w:pPr>${inner}</w:p>`;
  const styleOf = (el) => (el.nodeName === 'H2' ? 'Heading2' : el.nodeName === 'H3' ? 'Heading3' : el.nodeName === 'BLOCKQUOTE' ? 'Quote' : el.classList.contains('ayah') ? 'Ayah' : 'Normal');
  const block = (el, ch) => {
    const N = el.nodeName;
    if (N === 'DIV' && el.classList.contains('pgbreak')) return '<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
    if (N === 'HR') return para('Normal', '', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>');
    if (N === 'UL' || N === 'OL') return [...el.children].filter((li) => li.nodeName === 'LI').map((li, i) => {
      const lead = N === 'UL' ? '• ' : `${wrNum(i + 1)}- `, ind = 567 * (1 + (Number(li.dataset.ind) || 0));
      return para('Normal', run(lead, { base: 32 }) + runs(li, { base: 32 }, ch), `<w:ind w:left="${ind}" w:hanging="283"/>${pprOf(li).replace(/<w:ind[^>]*\/>/, '')}`);
    }).join('');
    if (N === 'TABLE') {
      const rows = [...el.querySelectorAll('tr')], cols = Math.max(1, ...rows.map((r) => r.children.length)), cw = Math.floor(9026 / cols);
      const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('');
      return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${bd}</w:tblBorders></w:tblPr><w:tblGrid>${`<w:gridCol w:w="${cw}"/>`.repeat(cols)}</w:tblGrid>`
        + rows.map((r) => `<w:tr>${[...r.children].map((c) => {
          // (its paragraphs, lists and the text between them, each kept: loose lines gather in a paragraph)
          let inner = '', loose = document.createElement('div');
          const flush = () => { if (loose.childNodes.length) inner += para('Normal', runs(loose, { base: 32 }, ch), pprOf(c)); loose = document.createElement('div'); };
          for (const k of [...c.childNodes]) {
            if (k.nodeType === 1 && /^(P|H2|H3|BLOCKQUOTE|UL|OL|HR|TABLE)$/.test(k.nodeName)) { flush(); inner += k.nodeName === 'TABLE' ? para('Normal', runs(k, { base: 32 }, ch)) : block(k, ch); }
            else loose.append(k.cloneNode(true));
          }
          flush();
          if (!inner) inner = para('Normal', '');
          return `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/></w:tcPr>${inner}</w:tc>`;
        }).join('')}</w:tr>`).join('') + '</w:tbl><w:p><w:pPr><w:bidi/></w:pPr></w:p>';
    }
    const style = styleOf(el);
    return para(style, runs(el, { base: BASE[style] }, ch), pprOf(el));
  };
  function sect(first) {
    return `<w:sectPr>${first ? '<w:footerReference w:type="first" r:id="rIdF2"/>' : ''}<w:footerReference w:type="default" r:id="rIdF1"/>`
      + `<w:footnotePr><w:numFmt w:val="${NF}"/><w:numStart w:val="1"/><w:numRestart w:val="eachSect"/></w:footnotePr><w:type w:val="continuous"/>`
      + '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
      + `<w:pgNumType w:fmt="${NF}"/>${first ? '<w:titlePg/>' : ''}<w:bidi/></w:sectPr>`;
  }
  let body = para('Title', run(b.title || 'كتاب بلا عنوان', {}));
  b.chapters.forEach((ch, idx) => {
    body += para('Heading1', run(ch.title || `فصل ${wrNum(idx + 1)}`, {}), '<w:pageBreakBefore/>');
    const tpl = document.createElement('template');
    tpl.innerHTML = wrSafe(ch.html);
    for (const el of tpl.content.children) body += block(el, ch);
    // (each chapter a section of its own, so its footnotes start again from one; its first page is its heading's)
    if (idx < b.chapters.length - 1) body += `<w:p><w:pPr><w:bidi/>${sect(idx === 0)}</w:pPr></w:p>`;
  });
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}${sect(b.chapters.length < 2)}</w:body></w:document>`;
  // (v157) the page: A4, its number at the foot on the right (in the app's digits), none on the title page
  const ftr = (inner) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr xmlns:w="${W}"><w:p><w:pPr><w:bidi/></w:pPr>${inner}</w:p></w:ftr>`;
  const fnPara = (inner, first) => `<w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:bidi/></w:pPr>${first ? `<w:r>${FR}<w:t>\u200F(</w:t></w:r><w:r>${FR}<w:footnoteRef/></w:r><w:r>${FR}<w:t>)\u200F</w:t></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve"> </w:t></w:r>` : ''}${inner}</w:p>`;
  const footnotes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes xmlns:w="${W}">`
    + '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>'
    + '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'
    + notes.map((t, i) => `<w:footnote w:id="${i + 1}">${(t || '').split(/\r?\n/).map((line, k) => fnPara(run(line, {}), !k)).join('')}</w:footnote>`).join('')
    + '</w:footnotes>';
  const pstyle = (id, name, rpr, ppr, extra = '') => `<w:style w:type="paragraph"${id === 'Normal' ? ' w:default="1"' : ''} w:styleId="${id}"><w:name w:val="${name}"/>${id === 'Normal' ? '' : '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'}${extra}<w:qFormat/><w:pPr>${ordered(ppr)}</w:pPr><w:rPr>${rpr}<w:rtl/></w:rPr></w:style>`;
  const sz = (n) => `<w:sz w:val="${n}"/><w:szCs w:val="${n}"/>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:eastAsia="${F}"/>${sz(32)}<w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
${pstyle('Normal', 'Normal', '', '<w:jc w:val="both"/>')}
${pstyle('Title', 'Title', `<w:b/><w:bCs/>${sz(56)}`, '<w:spacing w:before="2400" w:after="480"/>')}
${pstyle('Heading1', 'heading 1', `<w:b/><w:bCs/>${sz(44)}`, '<w:keepNext/><w:spacing w:before="240" w:after="240"/><w:outlineLvl w:val="0"/>')}
${pstyle('Heading2', 'heading 2', `<w:b/><w:bCs/>${sz(38)}`, '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/>')}
${pstyle('Heading3', 'heading 3', `<w:b/><w:bCs/>${sz(34)}`, '<w:keepNext/><w:spacing w:before="180" w:after="80"/><w:outlineLvl w:val="2"/>')}
${pstyle('Ayah', 'Ayah', `<w:b/><w:bCs/>${sz(34)}`, '<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:left w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:right w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/></w:pBdr><w:spacing w:before="160" w:after="160"/><w:ind w:left="567" w:right="567"/>')}
${pstyle('Quote', 'Quote', `<w:color w:val="444444"/>`, '<w:spacing w:before="120" w:after="120"/><w:ind w:left="567" w:right="567"/><w:jc w:val="both"/>')}
${pstyle('FootnoteText', 'footnote text', sz(24), '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/>', '')}
<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
</w:styles>`;
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
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
<Relationship Id="rIdF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
<Relationship Id="rIdF2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>
${media.map((m, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.${m.ext}"/>`).join('\n')}
</Relationships>` },
    { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:doNotExpandShiftReturn/><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:themeFontLang w:val="en-US" w:bidi="ar-SA"/></w:settings>` },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/footnotes.xml', data: footnotes },
    { name: 'word/document.xml', data: doc },
    { name: 'word/footer1.xml', data: ftr('<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:rtl/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>') },
    { name: 'word/footer2.xml', data: ftr('') },
    ...media.map((m) => ({ name: m.name, data: m.data })),
  ];
  return new Blob([Xlsx.zip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function wrDocxSave(b) {
  try { downloadBlob(wrDocx(b), `mahami-book-${today()}.docx`); toast('حُفظ ملف وورد'); }
  catch { toast('تعذّر صنع ملف وورد'); }
}

// ---------- the cloud (v156, «الحفظ في السحابة بحيث لا يضيع ما كتبت لأي عارض», and his «افعل المضمون السري»): each work
// in a secret gist of his own GitHub account (the one «المزامنة» uses, whose key reaches gists only), apart from the sync's,
// and locked (AES-GCM): the key is in his settings, which «المزامنة» carries, so one with the gist's link alone reads
// nothing. Sent a little after he stops writing and on closing; what is missing here, or newer there, comes back.
const WrCloud = (() => {
  const KEY = 'mahami-wrcloud';
  const DESC = 'Mahami writing — مؤلفاتي في الوعي الشخصي (مقفلة؛ لا تعدّلها يدوياً)';
  let st = (() => { try { return { sent: {}, gone: [], big: [], ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { sent: {}, gone: [], big: [] }; } })();
  let timer = 0, busy = false, pulled = false, retry = 0, wait = 0;
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const linked = () => typeof Sync !== 'undefined' && Sync.linked && Sync.linked();
  const ready = () => linked() && Sync.synced(); // (after a first sync, so the key in the cloud is known here)
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
  const pipe = async (u8, T) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new T('gzip'))).arrayBuffer());
  async function key(make) {
    if (!S.settings.wrKey) {
      if (!make) return null;
      S.settings.wrKey = b64(crypto.getRandomValues(new Uint8Array(32)));
      save();
      Sync.syncNow(); // (the key to the cloud with his settings, at once)
    }
    return crypto.subtle.importKey('raw', unb64(S.settings.wrKey), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function seal(obj) {
    const k = await key(true);
    let data = new TextEncoder().encode(JSON.stringify(obj)), z = 0;
    if (typeof CompressionStream !== 'undefined') { data = await pipe(data, CompressionStream); z = 1; }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return JSON.stringify({ v: 1, z, iv: b64(iv), d: b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, data))) });
  }
  async function open(text) {
    const o = JSON.parse(text), k = await key(false);
    if (!k) throw new Error('nokey');
    let data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, k, unb64(o.d)));
    if (o.z) data = await pipe(data, DecompressionStream);
    return JSON.parse(new TextDecoder().decode(data));
  }
  async function gist() {
    if (st.gist) return st.gist;
    for (let page = 1; page <= 5; page++) {
      const l = await Sync.api(`/gists?per_page=100&page=${page}`);
      const hit = l.find((g) => g.description === DESC);
      if (hit) { st.gist = hit.id; store(); return hit.id; }
      if (l.length < 100) break;
    }
    const g = await Sync.api('/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files: { 'README.txt': { content: 'مؤلفات تطبيق «الوعي الشخصي»، مقفلة. لا تعدّلها يدوياً.' } } }) });
    st.gist = g.id; st.sent = {}; st.gone = []; store(); // (a new place: nothing of his is there yet)
    return g.id;
  }
  const refresh = () => { if (ui.tab === 'writing' && !wrState && !wrUi.book) render(); };
  // a failure is retried later, a minute and then longer (never at once: the page redrawn would ask again and again);
  // its gist gone (deleted, or another GitHub account linked): everything goes up again to a new one
  const fail = (e) => {
    st.err = (e && e.message) || 'error';
    if (st.err === 'notfound') { st.gist = ''; st.sent = {}; st.gone = []; }
    store();
    wait = Math.min(wait ? wait * 2 : 60000, 1800000);
    retry = Date.now() + wait;
    if (st.err !== 'auth') soon(wait);
  };
  async function push() {
    if (busy || !ready()) return;
    if (!navigator.onLine) { st.err = 'offline'; store(); return; }
    // the lock's key reaches the cloud with his settings before anything locked with it does (else a phone lost before
    // the next sync would leave what was sent unreadable); a key changed (a backup brought in) locks everything again
    if (!S.settings.wrKey) await key(true);
    if (!Sync.inCloud('wrKey')) { Promise.resolve(Sync.syncNow()).then((done) => { if (done && Sync.inCloud('wrKey')) soon(300); }); wait = Math.min(wait ? wait * 2 : 5000, 1800000); soon(wait); return; }
    const kid = S.settings.wrKey.slice(0, 8);
    if (st.kid !== kid) { st.kid = kid; st.sent = {}; store(); }
    busy = true;
    let more = false;
    try {
      const list = wrUi.list || await WBooks.all();
      const id = await gist();
      const files = {}, sent = {};
      let size = 0;
      for (const b of list) {
        if (st.sent[b.id] === b.updated) continue;
        const c = await seal(b);
        if (c.length > 9e6) { if (!st.big.includes(b.id)) st.big.push(b.id); continue; } // (GitHub gives back a file this large only by «git»)
        st.big = st.big.filter((x) => x !== b.id);
        if (size && size + c.length > 6e6) { more = true; break; } // (a few works a time when they are large)
        files[`w-${b.id}.json`] = { content: c }; sent[b.id] = b.updated; size += c.length;
      }
      const gone = st.gone.filter((g) => !list.some((b) => b.id === g));
      for (const g of gone) files[`w-${g}.json`] = null;
      if (Object.keys(files).length) await Sync.api(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files }) });
      Object.assign(st.sent, sent);
      for (const g of gone) delete st.sent[g];
      st.gone = st.gone.filter((g) => !gone.includes(g));
      // a work deleted here while it was going up: it goes from there too
      for (const w of Object.keys(sent)) if (wrUi.list && !wrUi.list.some((b) => b.id === w)) { st.gone.push(w); more = true; }
      st.at = Date.now(); st.err = ''; wait = 0; retry = 0;
      store();
    } catch (e) { fail(e); more = false; }
    finally { busy = false; refresh(); }
    if (more) soon(1000);
  }
  function soon(ms) {
    clearTimeout(timer);
    if (!linked()) return;
    timer = setTimeout(push, ms);
  }
  async function pull() {
    if (pulled || busy || !ready() || !navigator.onLine || !wrUi.list || Date.now() < retry) return;
    pulled = true;
    busy = true; // (no upload meanwhile: a deletion asked while it reads stays asked)
    try {
      const id = await gist();
      const g = await Sync.api(`/gists/${id}`);
      let back = 0, bad = 0;
      // a work counted as sent whose file is not there (deleted on GitHub): it goes up again
      for (const w of Object.keys(st.sent)) if (!(g.files || {})[`w-${w}.json`]) delete st.sent[w];
      st.gone = st.gone.filter((w) => (g.files || {})[`w-${w}.json`]); // (only what is there can be deleted there)
      for (const [name, f] of Object.entries(g.files || {})) {
        const m = /^w-(.+)\.json$/.exec(name);
        if (!m || st.gone.includes(m[1]) || (wrState && wrState.book.id === m[1])) continue;
        let w;
        try {
          const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
          w = normalizeWBook(await open(text));
        } catch { bad++; continue; }
        const here = wrBook(w.id);
        if (!here) { wrUi.list.push(w); await WBooks.put(w); back++; st.sent[w.id] = w.updated; }
        else if (w.updated > here.updated) { Object.assign(here, w); await WBooks.put(here); back++; st.sent[w.id] = w.updated; }
        else if (w.updated === here.updated) st.sent[w.id] = w.updated;
      }
      st.bad = bad; st.err = '';
      store();
      if (back) { wrUi.list.sort((a, c) => c.updated - a.updated); toast(`عاد من السحابة: ${back}`); }
      refresh();
      soon(2000); // (what is newer here goes up)
      wait = 0; retry = 0;
    } catch (e) { pulled = false; busy = false; fail(e); refresh(); } // (asked again after «retry», not on the redraw)
    finally { busy = false; }
  }
  function html() {
    if (!linked()) return `<div class="wr-cloud"><p class="note-text">☁️ السحابة: غير مربوطة. اربط «المزامنة» في «الإعدادات» ليُحفظ ما تكتبه في حسابك مقفلاً، فلا يضيع.</p><button type="button" class="ghost sm" data-action="wr-cloud-set">افتح «الإعدادات»</button></div>`;
    if (!Sync.synced()) return '<p class="note-text wr-cloud">☁️ السحابة: تنتظر أول مزامنة.</p>';
    const left = (wrUi.list || []).filter((b) => st.sent[b.id] !== b.updated && !st.big.includes(b.id)).length + st.gone.length;
    const msg = st.err === 'offline' ? 'لا إنترنت الآن: يُرفع ما كتبته حين يعود.'
      : st.err === 'auth' ? 'رمز GitHub لم يعد صالحاً: أعد ربط «المزامنة».'
      : st.err ? 'تعذّر الرفع، يُعاد بعد قليل.'
      : left ? `لم يُرفع بعد: ${wrNum(left)}`
      : `محفوظ في السحابة ✓${st.at ? ` | آخر رفع: ${esc(relDate(iso(new Date(st.at))))} ${esc(fmtTime(hmOf(new Date(st.at).getHours() * 60 + new Date(st.at).getMinutes())))}` : ''}`;
    const big = st.big.map((w) => wrBook(w)).filter(Boolean).map((b) => `«${esc(b.title || WR_KINDS[b.kind].none)}»`);
    return `<div class="wr-cloud"><p class="note-text">☁️ ${msg}${st.bad ? ` | لم يُفتح من السحابة: ${wrNum(st.bad)}` : ''}${big.length ? ` | أكبر من أن يُرفع (صوره كثيرة): ${big.join('، ')}` : ''}</p>${left || st.err ? '<button type="button" class="ghost sm" data-action="wr-cloud-now">ارفع الآن</button>' : ''}</div>`;
  }
  // a work deleted here goes from the cloud too
  function gone(id) { if (st.sent[id] != null && !st.gone.includes(id)) st.gone.push(id); delete st.sent[id]; store(); soon(3000); }
  // «حذف كل البيانات»: the cloud's copy goes with the rest
  function wipe() {
    const id = st.gist;
    if (id && linked()) Sync.api(`/gists/${id}`, { method: 'DELETE' }).catch(() => {});
    st = { sent: {}, gone: [], big: [] }; pulled = false;
    try { localStorage.removeItem(KEY); } catch {}
  }
  window.addEventListener('online', () => { retry = 0; wait = 0; soon(3000); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() >= retry) soon(5000); });
  return { soon, pull, html, gone, wipe, _st: () => st };
})();
