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
  // (v186) a footnote with formatting (lists, bold, colour…) keeps it here; its words stay in «notes» for every other reader
  const nhtml = {};
  if (c.nhtml && typeof c.nhtml === 'object') for (const [k, v] of Object.entries(c.nhtml)) if (typeof v === 'string' && v && k in notes) nhtml[k] = v;
  return { id: c.id || uid(), title: typeof c.title === 'string' ? c.title : '', html: typeof c.html === 'string' ? c.html : '', notes, nhtml, updated: Number(c.updated) || Date.now() };
}
function normalizeWBook(b) {
  b = b && typeof b === 'object' ? b : {};
  const kind = WR_KINDS[b.kind] ? b.kind : 'book';
  const chapters = (Array.isArray(b.chapters) ? b.chapters : []).map(normalizeWChapter);
  if (kind !== 'book' && !chapters.length) chapters.push(normalizeWChapter({})); // (an article or a post is one text)
  return { id: b.id || uid(), kind, title: typeof b.title === 'string' ? b.title : '', status: b.status === 'pub' ? 'pub' : 'draft', ayc: WR_AYC[b.ayc] ? b.ayc : '', fnc: WR_FNC[b.fnc] ? b.fnc : '', fnb: WR_FNB[b.fnb] ? b.fnb : '', fnh: WR_FNH[b.fnh] ? b.fnh : '', fns: WR_FNS[b.fns] ? b.fns : '', pst: WR_PST[b.pst] ? b.pst : '', mark: wrMarkOk(b.mark), created: Number(b.created) || Date.now(), updated: Number(b.updated) || Date.now(), chapters };
}
// (v185) the bookmark of a book, «أعرف بها أين توقفت»: its chapter, where it stands in that chapter's text (counted in letters),
// and the words that follow it (to find it again if text was written before it)
function wrMarkOk(m) {
  return m && typeof m === 'object' && typeof m.ch === 'string' && m.ch ? { ch: m.ch, at: Math.max(0, Number(m.at) || 0), snip: typeof m.snip === 'string' ? m.snip.slice(0, 40) : '' } : null;
}
const wrMarkCh = (b) => b.mark && b.chapters.find((c) => c.id === b.mark.ch);
// (v183) the colour of what stands between ﴿ and ﴾ in a book, chosen for each book: [its name, its colour in Word]
const WR_AYC = { blue: ['أزرق', '1D4ED8'], maroon: ['عنابي', '7F1D1D'] };
// (v197) the footnotes' colour per book, «أضف القدرة على جعل الحاشية بلون مغاير»: each footnote's number in the text and its words
const WR_FNC = { blue: ['أزرق', '1D4ED8'], maroon: ['عنابي', '7F1D1D'], green: ['أخضر', '15803D'], gray: ['رمادي', '6B7280'] };
// (v198) the footnotes' look per book, in the same palette: a calm background for each footnote's box, a calm marker over
// its whole text (what he marked by hand keeps its own colour), and their size (Word's footnote text in half-points)
const WR_FNB = { ivory: ['عاجي', 'F8F4EA'], olive: ['زيتوني', 'EEF2E6'], sand: ['رملي', 'F3ECE0'], slate: ['رمادي مزرق', 'ECEFF3'] };
const WR_FNH = { ivory: ['عاجي', 'EFE9D8'], olive: ['زيتوني', 'DFE6D3'], sand: ['رملي', 'ECE3CF'], slate: ['رمادي مزرق', 'DFE4EA'] };
const WR_FNS = { small: ['أصغر', 20], big: ['أكبر', 28] };
// (v200) the pages' look per book, his words: «القدرة على تنسيق الصفحات بشكل مريح للعين ولو نشرته على تلك الهيئة لجذبت
// كثيرًا», his choice «الإصلاح + التنسيقان» (pictures shown first): in «الورق», the PDF and Word. M: the page's margins
// (pixels at 96 to the inch), tw: the same in Word's twips; '' is the look before (v157)
const WR_PST = { classic: { n: 'الكلاسيكي', M: 118, tw: 1770, font: 'Amiri' }, modern: { n: 'الحديث', M: 106, tw: 1590, font: 'Noto Naskh Arabic' } };
const wrPstOf = (b) => (b && b.kind === 'book' && WR_PST[b.pst] ? b.pst : '');
// the margins of book «b» for the measures of the pages (`WP`) and the sheets
function wrGeo(b) { const p = WR_PST[wrPstOf(b)]; WP.M = p ? p.M : 96; return wrPstOf(b); }
const wrPstFont = (pst) => (WR_PST[pst] ? WR_PST[pst].font : 'Amiri');
// a chapter's heading in a look: «الفصل الأول» over its title (not when the title says it already), an ornament or a bar
const WR_ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون'];
const wrChOrd = (i) => (WR_ORD[i] ? `الفصل ${WR_ORD[i]}` : `الفصل ${wrNum(i + 1)}`);
const WR_LABELED = /^\s*(ال)?(فصل|باب|مبحث|مطلب|مقدمة|خاتمة|تمهيد|قسم|جزء|كتاب|مدخل|توطئة|فهرس|ملحق|تقديم|إهداء)/;
function wrChParts(title, ci, pst) {
  const t = (title || '').trim();
  if (!pst) return { t: t || `فصل ${wrNum(ci + 1)}` };
  if (!t) return { t: wrChOrd(ci) };
  return WR_LABELED.test(t) ? { t } : { t, cap: wrChOrd(ci), big: pst === 'modern' ? wrNum(ci + 1) : '' };
}
function wrChHead(h, title, ci, pst) {
  const p = wrChParts(title, ci, pst);
  h.replaceChildren();
  h.classList.toggle('wh', !!pst);
  if (!pst) { h.textContent = p.t; return; }
  const add = (cls, t) => { const s = document.createElement('span'); s.className = cls; s.textContent = t; h.append(s); };
  if (p.big) add('wh-big', p.big);
  if (p.cap) add('wh-cap', p.cap);
  add('wh-t', p.t);
  add(pst === 'classic' ? 'wh-orn' : 'wh-bar', pst === 'classic' ? '❁ ❁ ❁' : '');
}
// the running head over a page (not a chapter's first): the book's title; in «الحديث» its chapter's at the other side
function wrHeadHTML(pst, book, chapter) {
  if (!pst) return '';
  return pst === 'modern' ? `<span>${esc(book)}</span><span>${esc(chapter)}</span>` : `<span>${esc(book)}</span>`;
}
const WR_FN = [['fnc', 'لون الحواشي:', WR_FNC, 'بلا لون'], ['fnb', 'خلفية الحواشي:', WR_FNB, 'بلا'], ['fnh', 'تظليل نص الحواشي:', WR_FNH, 'بلا'], ['fns', 'حجم الحواشي:', WR_FNS, 'عادي']];
// the three tabs (v156): a book of chapters, an article, a post
const WR_KINDS = {
  book: { tab: 'الكتب', one: 'كتاب', none: 'كتاب بلا عنوان' },
  article: { tab: 'المقالات', one: 'مقالة', none: 'مقالة بلا عنوان', pub: 'منشورة' },
  post: { tab: 'المنشورات', one: 'منشور', none: 'منشور', pub: 'منشور ✓' },
};

const wrUi = { list: null, loading: false, book: '', armed: '', find: '', imp: null, tab: (() => { try { const t = localStorage.getItem('mahami-wrtab'); return WR_KINDS[t] ? t : 'book'; } catch { return 'book'; } })() };
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
    if (N === 'DIV' && n.classList.contains('pgbreak')) { const d = document.createElement('div'); d.className = 'pgbreak'; d.contentEditable = 'false'; d.textContent = 'صفحة جديدة'; return d; }
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
      const st0 = Number(n.getAttribute('start')); // (a numbered list carried on from before, as Word had it)
      if (N === 'OL' && st0 > 1 && st0 < 1e5) el.setAttribute('start', String(Math.round(st0)));
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

// ---------- a footnote written with the text's own tools (v186, his words: «تحرير الهوامش من نفس محرر نص المتن») ----------
// it keeps what the text keeps, less what Word cannot hold in a footnote: headings, a verse box, a quotation, a footnote,
// a table, a picture, a page break and a line (their words stay, as plain lines)
const WR_NOTE_NO = new Set(['h2', 'h3', 'ayah', 'quote', 'note', 'pal:table', 'image', 'pgbreak', 'hr', 'stars']);
function wrNoteSafe(html) {
  const t = document.createElement('template');
  t.innerHTML = wrSafe(html);
  const c = t.content;
  for (const el of c.querySelectorAll('sup.fn, img, hr, .pgbreak')) el.remove();
  for (const el of c.querySelectorAll('table')) { const p = document.createElement('p'); p.textContent = el.textContent; el.replaceWith(p); }
  for (const el of c.querySelectorAll('h2, h3, blockquote')) {
    const p = document.createElement('p');
    p.style.cssText = el.style.cssText; if (el.dataset.ind) p.dataset.ind = el.dataset.ind;
    p.append(...el.childNodes); el.replaceWith(p);
  }
  for (const el of c.querySelectorAll('p.ayah')) el.removeAttribute('class');
  const d = document.createElement('div'); d.append(c);
  return d.textContent.trim() ? d.innerHTML : '';
}
// its words, line by line, a list's lines with their «•» or «١-» (for copying, searching and anything that reads text)
function wrNoteText(html) {
  const t = document.createElement('template');
  t.innerHTML = (html || '').replace(/<br\s*\/?>/gi, '\n');
  const lines = [];
  for (const el of t.content.children) {
    if (el.nodeName === 'UL' || el.nodeName === 'OL') [...el.children].forEach((li, i) => lines.push(`${el.nodeName === 'UL' ? '• ' : `${wrNum((Number(el.getAttribute('start')) || 1) + i)}- `}${li.textContent}`));
    else lines.push(el.textContent);
  }
  return lines.join('\n').replace(/\u00a0/g, ' ').trim();
}
const wrNoteLines = (text) => (text || '').split(/\r?\n/).map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
const wrNoteHTML = (c, id) => (c.nhtml && c.nhtml[id]) || wrNoteLines(c.notes[id] || '');
// what is written in a footnote, read into the chapter: its words always, its formatting when it has some
function wrNoteRead(ed) {
  if (!wrState || !ed || !ed.isConnected) return;
  const c = wrState.ch, id = ed.dataset.fn;
  if (!id || !(id in c.notes)) return;
  const h = wrNoteSafe(ed.innerHTML);
  c.notes[id] = wrNoteText(h);
  if (!c.nhtml) c.nhtml = {};
  if (h && /<(b|i|u|s|span|ul|ol)\b|style=|data-ind/.test(h)) c.nhtml[id] = h; else delete c.nhtml[id];
}
// where the tools work: the footnote being written in, else the text
function wrEd() { const n = wrState && wrState.noteEd; return n && n.isConnected ? n : $('wrBody'); }
function wrNoteBar() {
  const d = $('wrEditor'), ed = wrState && wrState.noteEd && wrState.noteEd.isConnected ? wrState.noteEd : null;
  if (!d) return;
  d.classList.toggle('wr-in-note', !!ed);
  const tip = $('wrNTip');
  if (!tip) return;
  tip.hidden = !ed;
  if (ed) { const i = [...$('wrNotes').querySelectorAll('.wr-fn-ed')].indexOf(ed); tip.textContent = `تكتب في الحاشية (${wrNum(i + 1)}): أدوات الكتابة تعمل فيها`; }
}

// ---------- the page ----------
function viewWriting() {
  if (!wrUi.list) { wrLoad(); return `${moreCrumb()}<section class="panel"><p class="note-text">يُفتح…</p></section>`; }
  WrCloud.pull(); // (once: what is in the cloud and not here, or newer there, comes back)
  if (wrUi.imp) return wrImpHTML(); // (v158: a book from a Word file, its preview first)
  if (wrUi.ideas && !wrUi.book) return wrIdeasHTML(); // (v179: «أفكار عاجلة» of this tab)
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
    ? `<form class="wr-new" data-wr-form="book"><input name="t" placeholder="عنوان كتاب جديد" aria-label="عنوان كتاب جديد" autocomplete="off"><button type="submit" class="primary">${icon('plus')} كتاب جديد</button></form>
      <button type="button" class="ghost wr-imp-btn" data-action="wr-imp-pick">${icon('sheet')} أدخل كتاباً من وورد</button><input type="file" id="wrDocxIn" accept=".docx,.dotx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>`
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
    ${wrIdeasBtn(k)}
    ${form}
    ${l.length ? `<div class="wr-books">${l.map(row).join('')}</div>`
    : `<p class="note-text">${k === 'book' ? 'لا كتب بعد. اكتب عنوان كتابك ثم «كتاب جديد».' : k === 'article' ? 'لا مقالات بعد. اكتب عنوانها ثم «مقالة جديدة».' : 'لا منشورات بعد. اضغط «منشور جديد».'}</p>`}
    ${WrCloud.html()}
  </section>`;
}

function wrBookHTML(b) {
  const notes = b.chapters.reduce((n, c) => n + wrNoteIds(c.html).length, 0);
  const del = wrUi.armed === `b:${b.id}`, mk = wrMarkCh(b);
  return `${moreCrumb()}
  <div class="crumbs"><button type="button" class="back" data-action="wr-list">${icon('back')} ${esc(pageName('writing'))}</button></div>
  <section class="panel">
    <div class="section-head"><h2>${esc(b.title || 'كتاب بلا عنوان')}</h2><button type="button" class="ghost sm" data-action="wr-rename">${icon('edit')} العنوان</button></div>
    <p class="book-line">الفصول: ${b.chapters.length} | الكلمات: ${wrBookWords(b)} | الحواشي: ${notes}</p>
    ${mk ? `<button type="button" class="wr-mk-go" data-action="wr-ch" data-v="${mk.id}"><span aria-hidden="true">🔖</span><span>علامتك: ${esc(mk.title || `فصل ${wrNum(b.chapters.indexOf(mk) + 1)}`)}</span><small>افتح عندها</small></button>` : ''}
    ${b.chapters.length ? `<div class="wr-chs">${b.chapters.map((c, i) => `<div class="wr-ch">
      <button type="button" class="wr-ch-open" data-action="wr-ch" data-v="${c.id}"><b>${mk === c ? '<span class="wr-mk-tag" aria-label="فيه علامتك">🔖</span> ' : ''}${esc(c.title || `فصل ${wrNum(i + 1)}`)}</b><small>الكلمات: ${wrChWords(c)}</small></button>
      <button type="button" class="icon-btn" data-action="wr-up" data-v="${c.id}" aria-label="إلى الأعلى"${i ? '' : ' disabled'}>▲</button>
      <button type="button" class="icon-btn" data-action="wr-down" data-v="${c.id}" aria-label="إلى الأسفل"${i < b.chapters.length - 1 ? '' : ' disabled'}>▼</button>
      <button type="button" class="ghost sm danger-text" data-action="wr-ch-del" data-v="${c.id}">${wrUi.armed === `c:${c.id}` ? 'متأكد؟' : 'حذف'}</button>
    </div>`).join('')}</div>` : '<p class="note-text">لا فصول بعد.</p>'}
    <div class="btn-row"><button type="button" class="primary" data-action="wr-ch-new">${icon('plus')} فصل جديد</button>
      <button type="button" class="ghost" data-action="wr-docx"${b.chapters.length ? '' : ' disabled'}>${icon('sheet')} ملف وورد</button>
      <button type="button" class="ghost" data-action="wr-pdf"${b.chapters.length ? '' : ' disabled'}>📄 صفحات PDF</button></div>
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
    b.chapters = b.chapters.filter((c) => c.id !== v); if (b.mark && b.mark.ch === v) b.mark = null; wrSave(b, 3000); render(); toast('حُذف الفصل');
  } else if (a === 'wr-book-del') {
    if (!wrArm(`b:${v}`)) return;
    wrGone(v); wrUi.book = ''; render(); toast('حُذف الكتاب');
  } else if (a === 'wr-docx') wrDocxSave(b);
  else if (a === 'wr-pdf') wrPdfOpen(b);
});

// ---------- the editor (a full-screen window like the notes', so the page redrawing never touches it) ----------
let wrState = null; // { book, ch, timer, dirty, hist, hi, htimer, range }
const WR_SVG = {
  close: '<path d="M9 18l6-6-6-6"/>', find: '<path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5"/>',
  undo: '<path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3"/>', redo: '<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
  focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>', copy: '<path d="M9 9h11v11H9zM5 15H4V4h11v1"/>',
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
  ['pal:table', 'جدول', 'جدول'], ['image', 'صورة', 'صورة'], ['pgbreak', 'صفحة جديدة', 'صفحة جديدة'], ['hr', '―', 'خط فاصل'], ['stars', '❊❊❊', 'فاصل نجوم'], ['clear', 'مسح التنسيق', 'مسح التنسيق'], '|',
  ['undo', wrSvg('undo'), 'تراجع'], ['redo', wrSvg('redo'), 'إعادة'],
];
const wrToolBtn = ([c, face, name]) => `<button type="button" data-wcmd="${c}" aria-label="${name}" title="${name}">${face}</button>`;
// in focus: what a selection needs (the bubble), and what needs none (the floating button)
const WR_BUBBLE = ['bold', 'italic', 'underline', 'strike', 'pal:color', 'pal:hi', 'pal:font', 'bigger', 'smaller', 'clear'];
const WR_FAB = ['h2', 'h3', 'p', 'ayah', 'quote', 'note', 'ul', 'ol', 'pal:align', 'pal:lh', 'pal:table', 'image', 'pgbreak', 'hr', 'stars', 'undo', 'redo'];
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
      <button type="button" class="icon-btn wr-bmk-btn" data-wr="bmk" aria-label="علامة: أين توقفت" title="علامة: أين توقفت" hidden>🔖</button>
      <button type="button" class="icon-btn wr-paper-btn" data-wr="paper" aria-label="الكتابة في أوراق كالوورد" title="الكتابة في أوراق كالوورد" aria-pressed="false" hidden>📄</button>
      <button type="button" class="icon-btn wr-ayc-btn" data-wr="ayc" aria-label="لون الآيات" title="لون الآيات" hidden>﴿﴾</button>
      <button type="button" class="icon-btn wr-fnc-btn" data-wr="fnc" aria-label="لون الحواشي" title="لون الحواشي" hidden>(١)</button>
      <button type="button" class="icon-btn" data-wr="theme" aria-label="لون الصفحة" title="لون الصفحة">${wrSvg('theme')}</button>
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
      <span class="wr-bmk" id="wrBmk" aria-hidden="true" hidden>🔖</span>
    </div>
    <div class="me-foot wr-foot"><small id="wrStatus"></small><button type="button" class="wr-tm wr-zoom" id="wrZoomBtn" data-wr="zoom">🔍 كبّر الورقة</button><button type="button" class="wr-tm" id="wrTmBtn" data-wr="tm" aria-label="مؤقت التركيز">⏱ مؤقت</button></div>
  </div>
  <div class="wr-bubble" id="wrBubble" role="toolbar" aria-label="أدوات النص المحدد" hidden>${WR_BUBBLE.map((c) => wrToolBtn(wrTool(c))).join('')}</div>
  <button type="button" class="wr-fab" id="wrFab" data-wr="fab" aria-label="الأدوات">✎</button>
  <div class="wr-fabmenu" id="wrFabMenu" role="toolbar" aria-label="الأدوات" hidden>${WR_FAB.map((c) => wrToolBtn(wrTool(c))).join('')}
    <button type="button" data-wr="bmk" class="wr-bmk-fab" aria-label="علامة: أين توقفت">🔖 علامة</button><button type="button" data-wr="paper" aria-pressed="false">📄 الورق</button><button type="button" data-wr="find" aria-label="بحث واستبدال">بحث</button><button type="button" data-wr="focus" class="wr-unfocus">كل الأدوات</button></div>
  <div class="wr-float" id="wrFloat" hidden></div>
  <div class="wr-tmpop" id="wrTmPop" hidden></div>
  <input type="file" id="wrImgIn" accept="image/*" hidden>
`;
  document.body.append(d);
  d.addEventListener('close', () => { if (wrState) wrClose(true); });
  d.addEventListener('cancel', (e) => { if (wrPopsClose() || (typeof wrIdeasClose === 'function' && wrIdeasClose())) e.preventDefault(); }); // (Escape closes a palette first)
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
// v163 («ألوان للصفحة تريح العين»، his choice: a button to pick from): the editor's page colours, kept on this device
const WR_THEMES = [['', 'كالتطبيق'], ['paper', 'ورقي دافئ'], ['night', 'ليلي هادئ'], ['green', 'أخضر فاتح']];
const wrThemeOf = () => { try { const v = localStorage.getItem('mahami-wrtheme') || ''; return WR_THEMES.some(([k]) => k === v) ? v : ''; } catch { return ''; } };
function wrSetTheme(v) {
  try { localStorage.setItem('mahami-wrtheme', v); } catch {}
  const d = $('wrEditor');
  if (!d) return;
  for (const [k] of WR_THEMES) if (k) d.classList.toggle(`wr-th-${k}`, k === v);
  for (const b of d.querySelectorAll('[data-wtheme]')) b.classList.toggle('on', b.dataset.wtheme === v);
}
// v190 («تلوين الصفحات a4 بألوان ورقية هادئة», his choice: inside «لون الصفحة»): the colour of the A4 sheets in paper
// mode, on screen only (Word stays white), kept on this device
const WR_SHEETS = [['', 'أبيض', '#fff'], ['ivory', 'عاجي', '#fbf6e9'], ['cream', 'كريمي', '#f5ecd7'], ['sand', 'رملي فاتح', '#efe6d2'], ['sage', 'أخضر ورقي', '#edf2e6'], ['mist', 'رمادي مزرق', '#ecf0f3']];
const wrSheetOf = () => { try { const v = localStorage.getItem('mahami-wrsheet') || ''; return WR_SHEETS.some(([k]) => k === v) ? v : ''; } catch { return ''; } };
function wrSetSheet(v) {
  try { localStorage.setItem('mahami-wrsheet', v); } catch {}
  const d = $('wrEditor');
  if (!d) return;
  const c = (WR_SHEETS.find(([k]) => k === v) || WR_SHEETS[0])[2];
  d.style.setProperty('--wrp-bg', c);
  for (const b of d.querySelectorAll('[data-wsheet]')) b.classList.toggle('on', b.dataset.wsheet === v);
}
// (v183) what stands between ﴿ and ﴾ in the text takes the book's colour: painted over the text (CSS highlights), so
// nothing is added to what is written, saved or undone; painted again whenever the text changes
let wrAycObs = null;
function wrAycPaint() {
  if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined') return;
  const d = $('wrEditor'), body = $('wrBody');
  if (!d || !body || !d.dataset.ayc) { CSS.highlights.delete('wr-ayah'); return; }
  const hl = new Highlight(), w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let open = null, n;
  while ((n = w.nextNode())) {
    for (let i = 0; i < n.data.length; i++) {
      const c = n.data[i];
      if (c === '﴿') open = [n, i];
      else if (c === '﴾' && open) { const r = new Range(); r.setStart(open[0], open[1]); r.setEnd(n, i + 1); hl.add(r); open = null; }
    }
  }
  CSS.highlights.set('wr-ayah', hl);
}
// (v197, v198) the footnotes' look of the open book (none for an article or a post, or once the editor closes)
function wrFnSet(b) {
  const d = $('wrEditor');
  if (!d) return;
  for (const [k, , vals] of WR_FN) { const v = b && b[k]; if (vals[v]) d.dataset[k] = v; else delete d.dataset[k]; }
  wrFnhPaint();
  if (wrPaperIs()) wrPaperLay(); // (a footnote's size moves the sheets' lines)
}
// (v198) the marker over the footnotes' whole text: painted over it (CSS highlights), so nothing enters what is written;
// what he marked by hand stays in its own colour
function wrFnhPaint() {
  if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined') return;
  const d = $('wrEditor');
  if (!d || !d.dataset.fnh) { CSS.highlights.delete('wr-fnh'); return; }
  const hl = new Highlight();
  for (const ed of d.querySelectorAll('.wr-fn-ed')) {
    const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.data.trim()) continue;
      const own = n.parentElement.closest('[style*="background"]');
      if (own && ed.contains(own)) continue;
      const r = new Range(); r.selectNodeContents(n); hl.add(r);
    }
  }
  CSS.highlights.set('wr-fnh', hl);
}
function wrAycSet(v) {
  const d = $('wrEditor');
  if (!d) return;
  if (WR_AYC[v]) d.dataset.ayc = v; else delete d.dataset.ayc;
  if (!wrAycObs && typeof MutationObserver !== 'undefined') {
    let q = 0;
    wrAycObs = new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; wrAycPaint(); wrBmkPaint(); wrFnhPaint(); }); });
    wrAycObs.observe($('wrBody'), { childList: true, characterData: true, subtree: true });
    wrAycObs.observe($('wrNotes'), { childList: true, characterData: true, subtree: true });
  }
  wrAycPaint();
}
// (v185) the bookmark («🔖 علامة»): one for each book, put where the cursor stands; the chapter it is in opens at it.
// Shown over the text (a colour on the word and 🔖 beside its line), so nothing enters what is written, saved or exported.
// While the chapter is open it is a live range, which moves with what is written before it; saving writes where it stands.
function wrBmkRange(n) {
  const body = $('wrBody'), w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT), r = document.createRange();
  let last = null;
  while (w.nextNode()) {
    const t = w.currentNode; last = t;
    if (n <= t.data.length) { r.setStart(t, n); r.collapse(true); return r; }
    n -= t.data.length;
  }
  if (last) r.setStart(last, last.data.length); else r.setStart(body, 0);
  r.collapse(true);
  return r;
}
function wrBmkAt(r) { const x = document.createRange(); x.selectNodeContents($('wrBody')); x.setEnd(r.startContainer, r.startOffset); return x.toString().length; }
// where a saved mark stands now: its words nearest to where it was, else where it was
function wrBmkFind(m) {
  const full = $('wrBody').textContent;
  for (const q of [m.snip, m.snip.slice(0, 12)]) {
    if (!q || q.trim().length < 3) continue;
    let best = -1, i = full.indexOf(q);
    while (i !== -1) { if (best < 0 || Math.abs(i - m.at) < Math.abs(best - m.at)) best = i; i = full.indexOf(q, i + 1); }
    if (best >= 0) return best;
  }
  return Math.min(m.at, full.length);
}
function wrBmkLive() {
  if (!wrState) return null;
  const b = wrState.book, m = b.kind === 'book' && b.mark && b.mark.ch === wrState.ch.id ? b.mark : null;
  if (!m) { wrState.bmk = null; return null; }
  const r = wrState.bmk;
  if (r && r.startContainer.nodeType === 3 && $('wrBody').contains(r.startContainer)) return r;
  return (wrState.bmk = wrBmkRange(wrBmkFind(m))); // (the text was put back whole, as «تراجع» does)
}
function wrBmkKeep() {
  const r = wrBmkLive();
  if (!r) return;
  const at = wrBmkAt(r);
  wrState.book.mark = { ch: wrState.ch.id, at, snip: $('wrBody').textContent.slice(at, at + 40) };
}
function wrBmkPaint() {
  const chip = $('wrBmk');
  const hl = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
  const r = wrBmkLive();
  if (!r) { if (hl) CSS.highlights.delete('wr-bmk'); if (chip) chip.hidden = true; return; }
  // the word that follows the mark (or the word it ends)
  const t = r.startContainer, i = r.startOffset, w = document.createRange();
  let j = i; while (j < t.data.length && j - i < 25 && !/\s/.test(t.data[j])) j++;
  let k = i; if (j === i) while (k > 0 && i - k < 25 && !/\s/.test(t.data[k - 1])) k--; // (at a word's end: that word)
  w.setStart(t, k); w.setEnd(t, j);
  if (hl) CSS.highlights.set('wr-bmk', new Highlight(w));
  const sc = $('wrScroll'); let rc = w.getClientRects()[0]; if (!rc || !rc.height) rc = t.parentNode.getBoundingClientRect(); // (an empty spot: its line)
  chip.hidden = false;
  chip.style.top = `${Math.max(0, rc.top - sc.getBoundingClientRect().top + sc.scrollTop + rc.height / 2 - 9)}px`;
}
// on opening the chapter that holds it: there, in the middle of the screen
function wrBmkOpen(go) {
  wrState.bmk = null;
  wrBmkPaint();
  if (!go || !wrState.bmk) return;
  const to = () => { const c = $('wrBmk'); if (!wrState || !c || c.hidden) return; wrBmkPaint(); const sc = $('wrScroll'); sc.scrollTop = Math.max(0, c.offsetTop - sc.clientHeight / 2); };
  to(); setTimeout(() => { to(); const c = $('wrBmk'); if (c && !c.hidden) wrFlash(c); }, 250);
}
function wrBmkPalHTML() {
  const b = wrState && wrState.book, m = b && b.mark, mc = b && wrMarkCh(b), here = mc && mc.id === wrState.ch.id;
  const where = !mc ? '' : here ? 'علامتك في هذا الفصل' : `علامتك في «${esc(mc.title || `فصل ${wrNum(b.chapters.indexOf(mc) + 1)}`)}»`;
  return `${where ? `<span class="wr-ayc-l">${where}</span>` : ''}<button type="button" class="chip" data-wbmk="set">${m && mc ? (here ? 'انقلها إلى المؤشر' : 'ضعها عند المؤشر') : 'ضع العلامة عند المؤشر'}</button>${mc ? '<button type="button" class="chip danger-text" data-wbmk="del">أزل العلامة</button>' : ''}`;
}
function wrBmkDo(k) {
  if (!wrState || wrState.book.kind !== 'book') return;
  const b = wrState.book;
  if (k === 'del') { b.mark = null; wrState.bmk = null; wrSave(b); wrBmkPaint(); wrPopsClose(); toast('أُزيلت العلامة'); return; }
  let at = wrCaret();
  if (at < 0) { // no cursor in the text: the top of what is on the screen
    const sc = $('wrScroll').getBoundingClientRect(), body = $('wrBody');
    const br = body.getBoundingClientRect(), y = Math.max(sc.top, br.top) + 24, x = Math.min(sc.right, br.right) - 10; // (v187: on the sheets the text is narrower than the screen)
    const cr = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    at = cr && body.contains(cr.startContainer) ? wrBmkAt(cr) : 0;
  }
  b.mark = { ch: wrState.ch.id, at, snip: $('wrBody').textContent.slice(at, at + 40) };
  wrState.bmk = wrBmkRange(at);
  wrSave(b);
  wrBmkPaint();
  wrPopsClose();
  const c = $('wrBmk'); if (c && !c.hidden) wrFlash(c);
  toast('وُضعت العلامة 🔖');
}
window.addEventListener('resize', () => { if (!wrState) return; if (wrPaperIs()) { wrPaperZoomSet(); wrPaperLay(); } wrBmkPaint(); });
const wrFocusOn = () => { try { return localStorage.getItem('mahami-wrfocus') === '1'; } catch { return false; } };
function wrSetFocus(on, once) {
  if (!once) try { localStorage.setItem('mahami-wrfocus', on ? '1' : '0'); } catch {}
  $('wrEditor').classList.toggle('wr-focus', on);
  wrPopsClose();
  wrBubble();
  if (typeof Voice !== 'undefined' && Voice.place) Voice.place(); // v162: the mic follows the timer's new place
}

function wrEdit(b, chId, find) {
  const c = b.chapters.find((x) => x.id === chId);
  if (!c) return;
  const d = wrDialog();
  wrFonts();
  if (!c.nhtml) c.nhtml = {};
  wrState = { book: b, ch: c, timer: null, dirty: false, hist: [], hi: -1, htimer: null, range: null, noteEd: null, others: wrBookWords(b) - wrChWords(c) };
  d.classList.remove('wr-in-note');
  const one = b.kind !== 'book';
  $('wrTitle').value = one ? b.title : c.title;
  $('wrTitle').placeholder = b.kind === 'article' ? 'عنوان المقالة' : b.kind === 'post' ? 'عنوان (اختياري، لا يُنسخ)' : 'عنوان الفصل';
  $('wrCopyBtn').hidden = !one;
  $('wrEditor').querySelector('[data-wr="ayc"]').hidden = one;
  $('wrEditor').querySelector('[data-wr="fnc"]').hidden = one;
  for (const x of $('wrEditor').querySelectorAll('[data-wr="bmk"], [data-wr="paper"]')) x.hidden = one;
  wrPaperSet(false, true); // (the sheets of the work before go: they come back below once this one is in)
  wrAycSet(one ? '' : b.ayc);
  wrFnSet(one ? null : b);
  d.classList.toggle('wr-arabic', S.settings.digits === 'arab');
  d.classList.toggle('wr-mic', typeof Voice !== 'undefined' && Voice.ready()); // (v198) room for the mic beside the timer
  $('wrBody').innerHTML = c.html;
  wrStarsMark($('wrBody'));
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
  if (typeof wrIdeaLight === 'function') wrIdeaLight(); // (v181) the yellow light of the book's ideas
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  d.classList.toggle('wr-focus', wrFocusOn());
  wrSetTheme(wrThemeOf());
  wrSetSheet(wrSheetOf());
  wrPopsClose();
  if (!one && wrPaperOn()) wrPaperSet(true, true); // (v187) on the sheets, as he left the editor
  $('wrScroll').scrollTop = 0;
  wrBmkOpen(!find);
  if (find) setTimeout(() => wrFindNext(), 50);
  else if (!c.html) setTimeout(() => $(c.title || b.title || b.kind === 'post' ? 'wrBody' : 'wrTitle').focus(), 50);
}

function wrClose(fromEvent) {
  if (!wrState) return;
  wrSaveNow();
  wrPaperSet(false, true);
  clearTimeout(wrState.htimer);
  wrState = null;
  if (typeof wrIdeasClose === 'function') wrIdeasClose();
  WrCloud.soon(1500);
  wrAycSet('');
  wrFnSet(null);
  wrBmkPaint();
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
function wrCaret(body = $('wrBody')) {
  const sel = getSelection();
  if (!sel.rangeCount || !body.contains(sel.anchorNode)) return -1;
  const r = document.createRange(); r.selectNodeContents(body); r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}
function wrSetCaret(n, root = $('wrBody')) {
  if (n < 0) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode;
    if (n <= t.textContent.length) { const r = document.createRange(); r.setStart(t, n); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return; }
    n -= t.textContent.length;
  }
}
// the cursor at the end of a footnote
function wrCaretEnd(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
const wrNotesSnap = (c) => JSON.stringify({ n: c.notes, h: c.nhtml || {} });
function wrMark() {
  if (!wrState) return;
  clearTimeout(wrState.htimer);
  const snap = { html: $('wrBody').innerHTML, notes: wrNotesSnap(wrState.ch), caret: wrCaret() };
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
  wrStarsMark($('wrBody'));
  const ns = JSON.parse(snap.notes);
  wrState.ch.notes = ns.n; wrState.ch.nhtml = ns.h;
  const was = wrState.noteEd && wrState.noteEd.dataset.fn;
  wrState.noteEd = null;
  $('wrNotes').innerHTML = '';
  wrRenumber();
  const ned = was && $('wrNotes').querySelector(`.wr-fn-ed[data-fn="${was}"]`);
  if (ned) { ned.focus(); wrCaretEnd(ned); } else { $('wrBody').focus(); wrSetCaret(snap.caret); }
  wrState.dirty = true;
  clearTimeout(wrState.timer);
  wrState.timer = setTimeout(wrSaveNow, 700);
  wrStatus('يحفظ…');
}
// v189 (his words: «ليش صارت النجوم الفاصلة بين الفقرات كلها يمين، أليست المفترض أن تكون في الوسط؟», then «نفذهما» for
// «أ: أي سطر كله نجوم أو علامات فصل يتوسّط وحده» and «ب: أداة «فاصل نجوم»»): a plain paragraph made only of stars or
// separating marks stands in the middle, unless he chose its alignment himself; shown so, not written into the text.
const WR_STARS = /^[\s*＊❊✻✱✲✳✴✵✶✷✸✹✺❉❋❃❂❁❀✿✽✾★☆✦✧⁂⁎⁑۞•·∙◆◇❖◈~ـ\-–—=°○●#×✕+]+$/u;
function wrIsStars(el) {
  if (!el || el.nodeName !== 'P' || el.classList.contains('ayah') || (el.style && el.style.textAlign)) return false;
  if (el.querySelector('img, sup.fn, table')) return false;
  const t = el.textContent;
  return /\S/.test(t) && WR_STARS.test(t);
}
function wrStarsMark(root) {
  if (!root) return;
  for (const p of root.children) if (p.nodeName === 'P') p.classList.toggle('wr-stars', wrIsStars(p));
}
// (the tool: a line of its own after the paragraph the cursor is in, or that empty line itself; the cursor goes on below it)
function wrStarsInsert(body) {
  const top = wrBlock();
  const sp = document.createElement('p'); sp.textContent = '❊ ❊ ❊';
  const next = document.createElement('p'); next.append(document.createElement('br'));
  if (top && top.nodeName === 'P' && !top.classList.contains('ayah') && !top.textContent.trim() && !top.querySelector('img, sup.fn, table, hr')) top.replaceWith(sp, next);
  else if (top) top.after(sp, next);
  else body.append(sp, next);
  const r = document.createRange(); r.setStart(next, 0); r.collapse(true);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
}
function wrDirty() {
  if (!wrState) return;
  wrStarsMark($('wrBody'));
  if (wrState.noteEd) wrNoteRead(wrState.noteEd); // (v186) a footnote's words and formatting into the chapter
  wrPaperSoon(); // (v187) the sheets follow what is written
  clearTimeout(wrState.htimer);
  wrState.htimer = setTimeout(wrMark, 500);
  wrState.dirty = true;
  clearTimeout(wrState.timer);
  wrState.timer = setTimeout(wrSaveNow, wrState.hist.length && wrState.hist[wrState.hi] && wrState.hist[wrState.hi].html.length > 1e6 ? 2500 : 700);
  wrStatus('يحفظ…');
}
// v165 (his words: «نص المنشور يصغر إذا خرجت وطولت في الخارج مع إني واضعه على حجم مريح للعين»): text typed in place of
// enlarged text has its size written by the browser in pixels, which wrSafe does not keep (sizes are kept relative,
// «em»); so it looked large and was saved at the usual size. Before saving, such a size is made relative to its paragraph.
function wrEmSizes() {
  const body = $('wrBody');
  if (!body) return;
  for (const el of body.querySelectorAll('[style*="font-size"]')) {
    const v = el.style.fontSize;
    if (!v || /^\d+(\.\d+)?em$/.test(v)) continue;
    const px = parseFloat(getComputedStyle(el).fontSize), base = parseFloat(getComputedStyle(el.parentNode).fontSize);
    const em = px > 0 && base > 0 ? Math.round(Math.min(4, Math.max(0.5, px / base)) * 100) / 100 : 1;
    el.style.fontSize = em === 1 ? '' : `${em}em`;
  }
}

function wrSaveNow() {
  if (!wrState || !wrState.dirty) return;
  clearTimeout(wrState.timer);
  const c = wrState.ch, b = wrState.book;
  if (b.kind === 'book') c.title = $('wrTitle').value.trim(); else b.title = $('wrTitle').value.trim();
  wrEmSizes();
  wrBmkKeep();
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
      const from = c.notes[id] != null ? c : wrState.book.chapters.find((x) => x.notes[id] != null);
      const text = from ? from.notes[id] : '', fmt = from && from.nhtml ? from.nhtml[id] : '';
      if (seen.has(id)) { id = uid(); m.dataset.fn = id; }
      c.notes[id] = text;
      if (!c.nhtml) c.nhtml = {};
      if (fmt) c.nhtml[id] = fmt;
    }
    seen.add(id);
    m.contentEditable = 'false';
    const n = `(${wrNum(i + 1)})`;
    if (m.textContent !== n) m.textContent = n;
  });
  const box = $('wrNotes');
  const ids = marks.map((m) => m.dataset.fn);
  if (!ids.length) { box.innerHTML = ''; wrPaperSoon(); return; }
  const have = [...box.querySelectorAll('.wr-fn-ed')].map((x) => x.dataset.fn).join();
  if (have === ids.join()) { box.querySelectorAll('.wr-note > b').forEach((x, i) => { x.textContent = `(${wrNum(i + 1)})`; }); wrNoteBar(); wrPaperSoon(); return; }
  // (v186) each footnote is written like the text, with its tools
  box.innerHTML = `<h3>الحواشي</h3><p class="wr-ntip" id="wrNTip" hidden></p>${ids.map((id, i) => `<div class="wr-note"><b data-wr="fngo" data-fn="${id}" role="button" aria-label="إلى موضعها في النص">(${wrNum(i + 1)})</b><div class="wr-fn-ed" contenteditable="true" role="textbox" aria-multiline="true" dir="rtl" data-fn="${id}" aria-label="الحاشية ${i + 1}">${wrNoteHTML(c, id)}</div><button type="button" class="ghost sm danger-text" data-wr="fndel" data-fn="${id}">حذف</button></div>`).join('')}`;
  wrNoteBar();
  wrPaperLay(); // (v187) at once: a new footnote stands at the foot of its sheet
}
// between a footnote and its mark: the one gone to is in the middle of the screen and glows a moment
// (an animation, not a class: nothing of it goes into the text, its saves or its undo steps)
function wrFlash(el) {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--accent-soft').trim() || '#ccfbf1';
  try { el.animate([{ backgroundColor: c, boxShadow: `0 0 0 3px ${c}` }, { backgroundColor: c, boxShadow: `0 0 0 3px ${c}`, offset: 0.4 }, { backgroundColor: 'transparent', boxShadow: '0 0 0 3px transparent' }], { duration: 1500, easing: 'ease-out' }); } catch {}
}
function wrToNote(id) {
  const ta = $('wrNotes').querySelector(`.wr-fn-ed[data-fn="${id}"]`);
  if (!ta) return;
  ta.focus({ preventScroll: true }); wrCaretEnd(ta); ta.scrollIntoView({ block: 'center' }); wrFlash(ta.closest('.wr-note'));
}
function wrToMark(id) {
  const m = $('wrBody').querySelector(`sup.fn[data-fn="${id}"]`);
  if (!m) return;
  // (the cursor just after the number, to write on from there)
  const r = document.createRange(); r.setStartAfter(m); r.collapse(true);
  $('wrBody').focus({ preventScroll: true });
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  m.scrollIntoView({ block: 'center' }); wrFlash(m);
  setTimeout(() => { if (m.isConnected) m.scrollIntoView({ block: 'center' }); }, 350); // (again once the phone's keyboard is up)
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
  if (wrState.ch.nhtml) delete wrState.ch.nhtml[id];
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
  const body = wrEd();
  if (!body.contains(n)) return null;
  while (n && n.parentNode !== body) n = n.parentNode;
  return n && n.nodeType === 1 ? n : null;
}
// the paragraphs (and list items, table cells) the selection touches
function wrBlocks() {
  const sel = getSelection(), body = wrEd();
  if (!sel.rangeCount || !body.contains(sel.anchorNode)) return [];
  const r = sel.getRangeAt(0);
  const pick = () => [...body.querySelectorAll('p, h2, h3, blockquote, li, td, th')].filter((b) => r.intersectsNode(b) && !b.querySelector('p, h2, h3, blockquote, li'));
  let l = pick();
  if (!l.length) { document.execCommand('formatBlock', false, '<p>'); l = pick(); } // (a first line typed outside any paragraph)
  return l;
}
// the selection kept while a palette is open, and put back before a tool works on it
// (v186) and which one the tools work in: the text, or the footnote the selection is in
function wrKeep() {
  const sel = getSelection();
  if (!wrState || !sel.rangeCount || !sel.anchorNode) return;
  const a = sel.anchorNode, el = a.nodeType === 1 ? a : a.parentNode;
  const ed = el && el.closest ? el.closest('#wrBody, #wrNotes .wr-fn-ed') : null;
  if (!ed) return;
  const note = ed.id === 'wrBody' ? null : ed;
  if (note !== (wrState.noteEd || null)) { wrState.noteEd = note; wrNoteBar(); }
  wrState.range = sel.getRangeAt(0).cloneRange();
}
function wrBack() {
  const sel = getSelection(), body = wrEd();
  if (sel.rangeCount && body.contains(sel.anchorNode)) return;
  body.focus();
  if (wrState && wrState.range && body.contains(wrState.range.startContainer)) { sel.removeAllRanges(); sel.addRange(wrState.range); }
}
const wrExec = (cmd, val, css) => { try { document.execCommand('styleWithCSS', false, !!css); } catch {} return document.execCommand(cmd, false, val); };
// a colour, highlight or font back to the text's own: applied with a marker, then that marker's style taken off
function wrUnstyle(prop, test) {
  for (const sp of [...wrEd().querySelectorAll('span, font')]) {
    if (!test(sp)) continue;
    for (const inner of sp.querySelectorAll('span')) inner.style[prop] = '';
    sp.style[prop] = '';
    if (sp.nodeName === 'FONT') { sp.removeAttribute('color'); sp.removeAttribute('face'); }
    if (!sp.getAttribute('style') || !sp.style.length) { if (sp.nodeName === 'SPAN' || !sp.attributes.length) sp.replaceWith(...sp.childNodes); }
  }
}
// the selected text larger or smaller: a step of 15%, between 0.6 and 3 times its paragraph's size
function wrResize(f) {
  const body = wrEd(), sel = getSelection();
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
  const root = wrEd(), T = tag.toUpperCase(), caret = wrCaret(root);
  const blks = wrBlocks().filter((b) => b.nodeName === 'LI' || b.parentNode === root);
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
  wrSetCaret(caret, root);
}
function wrIndent(step) {
  for (const b of wrBlocks()) {
    const n = Math.min(6, Math.max(0, (Number(b.dataset.ind) || 0) + step));
    if (n) b.dataset.ind = String(n); else delete b.dataset.ind;
  }
}
// a table: inserted with its size, then a row or a column after the cursor's, or one taken away
function wrCell() { const sel = getSelection(); const n = sel.rangeCount && sel.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentNode); return el && wrEd().contains(el) ? el.closest('td, th') : null; }
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
  if (wrState && wrState.noteEd && wrState.noteEd.isConnected && WR_NOTE_NO.has(cmd)) { toast('هذه الأداة لا تعمل في الحاشية'); return; }
  const body = wrEd();
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
  else if (cmd === 'pgbreak') wrExec('insertHTML', '<div class="pgbreak" contenteditable="false">صفحة جديدة</div><p><br></p>');
  else if (cmd === 'hr') wrExec('insertHTML', '<hr><p><br></p>');
  else if (cmd === 'stars') wrStarsInsert(body);
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
    const ta = $('wrNotes').querySelector(`.wr-fn-ed[data-fn="${id}"]`);
    if (ta) setTimeout(() => { ta.focus(); wrCaretEnd(ta); ta.scrollIntoView({ block: 'center' }); }, 30);
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
  if (k === 'ayc') { const on = (wrState && wrState.book.ayc) || ''; return '<span class="wr-ayc-l">لون الآيات:</span>' + [['', 'بلا لون'], ...Object.entries(WR_AYC).map(([v, [n]]) => [v, n])].map(([v, n]) => `<button type="button" class="wr-thb${v === on ? ' on' : ''}" data-wayc="${v}"${v ? ` data-ayc="${v}"` : ''}>${n}</button>`).join(''); }
  if (k === 'fnc') return WR_FN.map(([key, lab, vals, none]) => { // (v197, v198) colour, background, marker and size
    const on = (wrState && wrState.book[key]) || '', o = Object.entries(vals).map(([v, [n]]) => [v, n]);
    const list = key === 'fns' ? [o[0], ['', none], o[1]] : [['', none], ...o];
    return `<div class="wr-fn-row"><span class="wr-ayc-l">${lab}</span>${list.map(([v, n]) => `<button type="button" class="wr-thb${v === on ? ' on' : ''}" data-wfk="${key}" data-wfv="${v}"${v && key !== 'fns' ? ` data-${key}="${v}"` : ''}>${n}</button>`).join('')}</div>`;
  }).join('');
  if (k === 'bmk') return wrBmkPalHTML();
  if (k === 'theme') {
    const on = wrThemeOf(), sh = wrSheetOf();
    return WR_THEMES.map(([v, n]) => `<button type="button" class="wr-thb${v === on ? ' on' : ''}" data-wtheme="${v}"${v ? ` data-th="${v}"` : ''}>${n}</button>`).join('')
      + (wrState && wrState.book.kind === 'book' ? '<span class="wr-pal-br"></span><span class="wr-ayc-l">لون الورقة:</span>' + WR_SHEETS.map(([v, n, c]) => `<button type="button" class="wr-thb${v === sh ? ' on' : ''}" data-wsheet="${v}" style="background:${c};color:#3a2e20">${n}</button>`).join('')
        + '<span class="wr-pal-br"></span><span class="wr-ayc-l">تنسيق الصفحات:</span>' + [['', 'الحالي'], ...Object.entries(WR_PST).map(([v, o]) => [v, o.n])].map(([v, n]) => `<button type="button" class="wr-thb${v === wrPstOf(wrState.book) ? ' on' : ''}" data-wpst="${v}">${n}</button>`).join('') : '');
  }
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
  const sel = getSelection(), body = wrEd();
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
      if (wrState) wrState.found = r.cloneRange(); // (v196: «استبدل» replaces it though the cursor went to «استبدله بـ»)
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
    const sel = getSelection(), f = wrState && wrState.found;
    if (!(sel.rangeCount && sel.toString() === q && $('wrBody').contains(sel.anchorNode)) && f && f.toString() === q && $('wrBody').contains(f.startContainer)) { sel.removeAllRanges(); sel.addRange(f); }
    if (sel.rangeCount && sel.toString() === q && $('wrBody').contains(sel.anchorNode)) { $('wrBody').focus(); document.execCommand('insertText', false, r); wrDirty(); }
    if (wrState) wrState.found = null;
    wrFindNext();
    return;
  }
  wrMark();
  let n = 0;
  for (const t of wrTextNodes()) { const k = wrCount(t.textContent, q); if (k) { n += k; t.textContent = t.textContent.split(q).join(r); } }
  for (const ed of $('wrNotes').querySelectorAll('.wr-fn-ed')) {
    let m = 0;
    const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    for (const t of (() => { const l = []; while (w.nextNode()) l.push(w.currentNode); return l; })()) { const k = wrCount(t.textContent, q); if (k) { m += k; t.textContent = t.textContent.split(q).join(r); } }
    if (m) { n += m; const keep = wrState.noteEd; wrState.noteEd = ed; wrNoteRead(ed); wrState.noteEd = keep; }
  }
  $('wrFound').textContent = n ? `استُبدل ${wrNum(n)} مرة في هذا الفصل` : 'لم يوجد في هذا الفصل';
  if (n) { wrDirty(); wrMark(); }
}

// the tools keep the cursor (and the selection) in the text
document.addEventListener('pointerdown', (e) => {
  if (!wrState) return;
  if (e.target.closest('#wrTools button, #wrPal button, #wrBubble button, #wrFabMenu button, #wrFloat button, #wrFab, [data-wr="theme"], [data-wr="ayc"], [data-wr="fnc"], [data-wr="bmk"]')) e.preventDefault();
  // a tap elsewhere closes what floats (not a tap in it, nor on what opens it)
  if (!e.target.closest('#wrPal, #wrFloat, #wrFabMenu, #wrTmPop, #wrBubble, #wrTools, #wrFab, #wrTmBtn, [data-wr="theme"], [data-wr="ayc"], [data-wr="fnc"], [data-wr="bmk"]')) wrPopsClose();
});
document.addEventListener('change', (e) => { if (e.target.id === 'wrImgIn' && wrState) wrImage(e.target.files && e.target.files[0]); });
document.addEventListener('click', (e) => {
  if (!wrState) return;
  const t = e.target.closest('[data-wcmd], [data-wr], [data-wcolor], [data-whi], [data-wfont], [data-walign], [data-wlh], [data-wtbl], [data-wtm], [data-wtheme], [data-wsheet], [data-wpst], [data-wayc], [data-wfk], [data-wbmk], #wrBody sup.fn');
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
  if (t.dataset.wayc !== undefined) { // (v183) kept with the book; the palette stays open
    if (!wrState) return;
    wrState.book.ayc = t.dataset.wayc;
    wrState.book.updated = Date.now();
    wrSave(wrState.book);
    wrAycSet(t.dataset.wayc);
    for (const x of document.querySelectorAll('[data-wayc]')) x.classList.toggle('on', x.dataset.wayc === t.dataset.wayc);
    return;
  }
  if (t.dataset.wfk) { // (v197, v198) kept with the book, as the verses' colour; the palette stays open
    if (!wrState) return;
    const k = t.dataset.wfk;
    wrState.book[k] = t.dataset.wfv;
    wrState.book.updated = Date.now();
    wrSave(wrState.book);
    wrFnSet(wrState.book);
    for (const x of document.querySelectorAll(`[data-wfk="${k}"]`)) x.classList.toggle('on', x.dataset.wfv === t.dataset.wfv);
    return;
  }
  if (t.dataset.wbmk) { wrBmkDo(t.dataset.wbmk); return; }
  if (t.dataset.wsheet !== undefined) { wrSetSheet(t.dataset.wsheet); return; }
  if (t.dataset.wpst !== undefined) { // (v200) kept with the book; the palette stays open; the sheets laid out again
    if (!wrState) return;
    wrState.book.pst = t.dataset.wpst;
    wrState.book.updated = Date.now();
    wrSave(wrState.book);
    for (const x of document.querySelectorAll('[data-wpst]')) x.classList.toggle('on', x.dataset.wpst === t.dataset.wpst);
    if (wrPaperIs()) { wrPaperSet(false, true); wrPaperSet(true, true); }
    else toast('يظهر التنسيق في «الورق» 📄 وفي PDF وملف وورد');
    return;
  }
  if (t.dataset.wtheme !== undefined) { wrSetTheme(t.dataset.wtheme); return; } // (the palette stays open, to try one after another)
  if (t.matches('sup.fn')) { wrToNote(t.dataset.fn); return; }
  const a = t.dataset.wr;
  if (a === 'close') wrClose();
  else if (a === 'theme') wrPal('theme');
  else if (a === 'ayc') wrPal('ayc');
  else if (a === 'fnc') wrPal('fnc');
  else if (a === 'bmk') wrPal('bmk');
  else if (a === 'copy') { wrSaveNow(); wrCopy(wrState.book); }
  else if (a === 'focus') { $('wrFabMenu').hidden = true; wrSetFocus(!$('wrEditor').classList.contains('wr-focus')); }
  else if (a === 'fab') { const m = $('wrFabMenu'), show = m.hidden; wrPopsClose(); m.hidden = !show; }
  else if (a === 'tm') { const p = $('wrTmPop'), show = p.hidden; wrPopsClose(); if (show) { p.innerHTML = wrTmPopHTML(); p.hidden = false; } }
  else if (a === 'paper') { $('wrFabMenu').hidden = true; wrPaperSet(!wrPaperIs()); toast(wrPaperIs() ? 'تكتب الآن في أوراق كالوورد' : 'رجعت إلى المحرر المعتاد'); }
  else if (a === 'zoom') wrZoomToggle();
  else if (a === 'fndel') wrNoteDel(t);
  else if (a === 'fngo') wrToMark(t.dataset.fn);
  else if (a === 'find') { $('wrFabMenu').hidden = true; const f = $('wrFind'); f.hidden = !f.hidden; if (!f.hidden) { if ($('wrEditor').classList.contains('wr-focus')) wrSetFocus(false, true); /* (this time only: focus stays his choice) */ const s = getSelection().toString(); if (s && s.length < 80) $('wrQ').value = s; $('wrQ').focus(); } }
  else if (a === 'next') wrFindNext();
  else if (a === 'rep') wrReplace(false);
  else if (a === 'repall') wrReplace(true);
});
// (v196, «إذا كبرت نص فقرة النص الذي بعدها بعد زر الإدخال يبقى صغيرا»): the new empty line after enlarged (or made
// smaller) text takes that size: an empty span of it holds the cursor, and what is typed beside it (the phone's
// keyboard can put it outside) goes into it
function wrKeepSize() {
  const sel = getSelection(), body = $('wrBody');
  if (!sel.rangeCount || !sel.isCollapsed) return;
  let blk = sel.anchorNode; if (blk.nodeType !== 1) blk = blk.parentNode;
  blk = blk.closest && blk.closest('p, h2, h3, li, blockquote');
  if (!blk || !body.contains(blk) || blk.textContent.trim() || blk.querySelector('img, table, sup.fn, span[style*="font-size"]')) return; // (what the browser carried over stays)
  const prev = blk.previousElementSibling || (blk.nodeName === 'LI' && blk.parentNode.previousElementSibling);
  if (!prev || prev.nodeName !== blk.nodeName) return;
  // the size he gave (the «أ+»/«أ−» spans' em), not the page's own sizes (a footnote number, a verse box in «الورق»)
  const w = document.createTreeWalker(prev, NodeFilter.SHOW_TEXT);
  let last = null; while (w.nextNode()) if (w.currentNode.textContent.trim() && !w.currentNode.parentNode.closest('sup.fn')) last = w.currentNode;
  if (!last) return;
  let f = 1;
  for (let n = last.parentNode; n && n !== prev; n = n.parentNode) { const m = /^([\d.]+)em$/.exec((n.style && n.style.fontSize) || ''); if (m) f *= Number(m[1]); }
  if (Math.abs(f - 1) < 0.02) return;
  const sp = document.createElement('span');
  sp.style.fontSize = `${Math.round(f * 100) / 100}em`;
  sp.dataset.keep = '1';
  sp.append(document.createElement('br'));
  blk.replaceChildren(sp);
  const r = document.createRange(); r.setStart(sp, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
}
// what the phone's keyboard typed beside that span (only it: the line holds nothing else) goes into it
function wrAdoptSize() {
  const sel = getSelection(); if (!sel.rangeCount) return;
  const t = sel.anchorNode; if (!t || t.nodeType !== 3) return;
  const blk = t.parentNode;
  if (!blk || !/^(P|H2|H3|LI|BLOCKQUOTE)$/.test(blk.nodeName) || !$('wrBody').contains(blk)) return;
  const sp = blk.querySelector(':scope > span[data-keep]');
  if (!sp) return;
  if (sp.textContent) { delete sp.dataset.keep; return; }
  if ([...blk.childNodes].some((c) => c !== sp && c !== t && !(c.nodeName === 'BR' || (c.nodeType === 3 && !c.textContent)))) return;
  if ([...sp.childNodes].some((c) => c.nodeName !== 'BR')) return;
  const off = sel.anchorOffset;
  for (const c of [...blk.childNodes]) if (c !== sp && c !== t) c.remove();
  sp.replaceChildren(t);
  delete sp.dataset.keep;
  const r = document.createRange(); r.setStart(t, off); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
}
document.addEventListener('compositionend', (e) => { if (wrState && e.target.id === 'wrBody') setTimeout(() => { wrAdoptSize(); wrDirty(); }, 0); });
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
      wrKeepSize(); // (v196)
    }
    if (!e.isComposing && /^insert(Text|ReplacementText)$/.test(e.inputType || '')) wrAdoptSize();
    wrRenumber(); wrDirty();
    // (typing ends the trying: an open palette goes, and the bubble with a selection gone; a tool's own change, «format…», does not)
    if (/^(insert(Text|Paragraph|LineBreak|ReplacementText|CompositionText|FromPaste)|delete)/.test(e.inputType || '')) { wrPopsClose(); wrBubble(); }
  }
  else if (e.target.id === 'wrTitle') wrDirty();
  else if (e.target.matches && e.target.matches('#wrNotes .wr-fn-ed')) {
    if (wrState.noteEd !== e.target) { wrState.noteEd = e.target; wrNoteBar(); }
    wrDirty();
    if (/^(insert(Text|Paragraph|LineBreak|ReplacementText|CompositionText|FromPaste)|delete)/.test(e.inputType || '')) { wrPopsClose(); wrBubble(); }
  }
});
// (v186) the tools go to the footnote written in, or back to the text
document.addEventListener('focusin', (e) => {
  if (!wrState || !e.target.closest) return;
  const note = e.target.closest('#wrNotes .wr-fn-ed');
  if (note) {
    if (!note.firstChild) { const p = document.createElement('p'); p.append(document.createElement('br')); note.append(p); wrCaretEnd(note); }
    if (wrState.noteEd !== note) { wrState.noteEd = note; wrNoteBar(); }
  } else if ((e.target.id === 'wrBody' || e.target.id === 'wrTitle') && wrState.noteEd) { wrState.noteEd = null; wrNoteBar(); }
});
document.addEventListener('keydown', (e) => {
  if (!wrState) return;
  if (e.target.id === 'wrTitle' && e.key === 'Enter') { e.preventDefault(); $('wrBody').focus(); }
  if ((e.target.id === 'wrQ' || e.target.id === 'wrR') && e.key === 'Enter') { e.preventDefault(); wrFindNext(); }
  if ((e.target.id === 'wrBody' || (e.target.matches && e.target.matches('#wrNotes .wr-fn-ed'))) && (e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) { e.preventDefault(); wrHistory(e.key.toLowerCase() === 'y' || e.shiftKey ? 1 : -1); }
});
document.addEventListener('beforeinput', (e) => {
  if (!wrState || !(e.target.id === 'wrBody' || (e.target.matches && e.target.matches('#wrNotes .wr-fn-ed')))) return;
  if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') { e.preventDefault(); wrHistory(e.inputType === 'historyUndo' ? -1 : 1); }
  if (e.inputType === 'deleteContentBackward' && e.cancelable && e.target.id === 'wrBody' && wrPgUnbreak(e.target)) e.preventDefault(); // (a keyboard's delete it cannot stop: as it was)
});
// (v202) erasing before the first word after a new page takes the new page away: its words go back on the sheet before
function wrPgUnbreak(body) {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  let blk = sel.anchorNode;
  while (blk && blk.parentNode !== body) blk = blk.parentNode;
  const br = blk && blk.previousElementSibling;
  if (!br || !br.classList.contains('pgbreak')) return false;
  const rg = document.createRange(); rg.setStart(blk, 0); rg.setEnd(sel.anchorNode, sel.anchorOffset);
  const got = rg.cloneContents();
  if (rg.toString().replace(/\s/g, '') || got.querySelector('img, table, hr, sup') || got.querySelectorAll('li').length > 1) return false;
  wrMark(); br.remove(); wrDirty();
  return true;
}
// pasted text keeps only what a chapter keeps (Word's own markup goes)
document.addEventListener('paste', (e) => {
  const inNote = !!(e.target.closest && e.target.closest('#wrNotes .wr-fn-ed'));
  if (!wrState || !(e.target.closest && (e.target.closest('#wrBody') || inNote))) return;
  const html = e.clipboardData && e.clipboardData.getData('text/html');
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (!html && !text) return;
  e.preventDefault();
  const plain = () => (text || '').split(/\r?\n/).map((l) => `<p>${esc(l) || '<br>'}</p>`).join('');
  let clean = html ? wrClean(html) : '';
  if (!clean.replace(/<[^>]+>/g, '').trim() && !/sup class="fn"/.test(clean)) clean = plain(); // (markup that cleans to nothing: its plain text)
  if (inNote) clean = wrNoteSafe(clean) || plain(); // (v186: a footnote keeps what a footnote can hold)
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
  const PST = wrPstOf(b); // (v200) the pages' look of the book
  const F = PST ? WR_PST[PST].font : 'Amiri'; // (v157: the editor's own font, so the file reads as it was written; Traditional Arabic is not on a phone)
  const notes = [], media = [];
  // (Word reads a paragraph's settings in the schema's order only: bidi stands after the borders and before the spacing)
  const PPR = ['pStyle', 'keepNext', 'pageBreakBefore', 'pBdr', 'shd', 'bidi', 'spacing', 'ind', 'jc', 'outlineLvl'];
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
  // (v183) the text between ﴿ and ﴾ in the book's colour, as in the editor
  const AYC = WR_AYC[b.ayc] ? WR_AYC[b.ayc][1] : '';
  let inAy = false, ayOff = false;
  const ayRun = (text, f) => (!AYC || ayOff ? run(text, f) : text.split(/([﴿﴾])/).map((t) => {
    if (!t) return '';
    if (t === '﴿') inAy = true;
    const o = run(t, inAy ? { ...f, color: AYC } : f);
    if (t === '﴾') inAy = false;
    return o;
  }).join(''));
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
  const FNC = WR_FNC[b.fnc] ? WR_FNC[b.fnc][1] : ''; // (v197) the footnotes' colour: their numbers and their words
  const FR = `<w:rPr><w:rStyle w:val="FootnoteReference"/>${FNC ? `<w:color w:val="${FNC}"/>` : ''}<w:rtl/></w:rPr>`;
  // (v198) the footnotes' background (their paragraphs), marker (their words) and size (their style), as in the editor
  const FNB = WR_FNB[b.fnb] ? `<w:shd w:val="clear" w:color="auto" w:fill="${WR_FNB[b.fnb][1]}"/>` : '';
  const FNH = WR_FNH[b.fnh] ? WR_FNH[b.fnh][1] : '';
  const FNS = WR_FNS[b.fns] ? WR_FNS[b.fns][1] : 24;
  const FF = { base: FNS, ...(FNC ? { color: FNC } : {}), ...(FNH ? { hi: FNH } : {}) };
  // (the parentheses held on the right by a right-to-left mark, so a footnote's number at a line's start reads «(١)» not «()١»)
  const NF = S.settings.digits === 'arab' ? 'hindiNumbers' : 'decimal';
  const runs = (node, f, ch) => [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent ? ayRun(n.textContent, f) : '';
    if (n.nodeType !== 1) return '';
    const N = n.nodeName;
    if (N === 'BR') return '<w:r><w:br/></w:r>';
    if (N === 'IMG') return pic(n);
    if (N === 'SUP' && n.classList.contains('fn')) {
      notes.push({ t: ch.notes[n.dataset.fn] || '', h: (ch.nhtml && ch.nhtml[n.dataset.fn]) || '' });
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
    else if (wrIsStars(el)) o += '<w:jc w:val="center"/>'; // (v189: a line of stars in the middle)
    return o;
  };
  const para = (style, inner, extra = '') => `<w:p><w:pPr>${ordered(`<w:pStyle w:val="${style}"/>${extra}`)}</w:pPr>${inner}</w:p>`;
  const styleOf = (el) => (el.nodeName === 'H2' ? 'Heading2' : el.nodeName === 'H3' ? 'Heading3' : el.nodeName === 'BLOCKQUOTE' ? 'Quote' : el.classList.contains('ayah') ? 'Ayah' : 'Normal');
  // (v200) a paragraph of the text in the book's look: «الكلاسيكي» its first line in (not after a heading, a verse, a
  // quote or at the chapter's start) and no room after it; «الحديث» room after it
  const lookP = (ppr, first) => {
    const sp = PST === 'classic' ? 'w:after="0"' : 'w:after="270"';
    ppr = /<w:spacing /.test(ppr) ? ppr.replace('<w:spacing ', `<w:spacing ${sp} `) : `${ppr}<w:spacing ${sp}/>`;
    if (PST === 'classic') { const fl = `w:firstLine="${first ? 0 : 448}"`; ppr = /<w:ind /.test(ppr) ? ppr.replace('<w:ind ', `<w:ind ${fl} `) : `${ppr}<w:ind ${fl}/>`; }
    return ppr;
  };
  let pFirst = true;
  const block = (el, ch, top) => {
    const N = el.nodeName;
    inAy = false; // (a ﴿ left open does not colour the paragraphs after it)
    if (N === 'DIV' && el.classList.contains('pgbreak')) return '<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
    if (N === 'HR') return para('Normal', '', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>');
    if (N === 'UL' || N === 'OL') return [...el.children].filter((li) => li.nodeName === 'LI').map((li, i) => {
      const lead = N === 'UL' ? '• ' : `${wrNum((Number(el.getAttribute('start')) || 1) + i)}- `, ind = 567 * (1 + (Number(li.dataset.ind) || 0));
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
    const look = PST && top && style === 'Normal' && N === 'P' && !wrIsStars(el);
    return para(style, runs(el, { base: BASE[style] }, ch), look ? lookP(pprOf(el), pFirst) : pprOf(el));
  };
  function sect(first) {
    return `<w:sectPr>${first ? '<w:footerReference w:type="first" r:id="rIdF2"/>' : ''}<w:footerReference w:type="default" r:id="rIdF1"/>`
      + `<w:footnotePr><w:numFmt w:val="${NF}"/><w:numStart w:val="1"/><w:numRestart w:val="eachSect"/></w:footnotePr><w:type w:val="continuous"/>`
      + '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
      + `<w:pgNumType w:fmt="${NF}"/>${first ? '<w:titlePg/>' : ''}<w:bidi/></w:sectPr>`;
  }
  // (v200) in a look: each chapter a section that starts a new page, its first page without the running head (the
  // title's section none at all), its page's number on every page but the title's; the head of «الحديث» names the chapter
  const hdrs = [];
  const szv = (n) => `<w:sz w:val="${n}"/><w:szCs w:val="${n}"/>`;
  const tw = PST ? WR_PST[PST].tw : 1440;
  function sectL(kind, i) {
    const h = kind === 'title' ? 'rIdH0' : PST === 'modern' ? `rIdH${i + 1}` : 'rIdH1';
    return `<w:sectPr><w:headerReference w:type="default" r:id="${h}"/><w:headerReference w:type="first" r:id="rIdH0"/>`
      + `<w:footerReference w:type="default" r:id="${kind === 'title' ? 'rIdF2' : 'rIdF1'}"/><w:footerReference w:type="first" r:id="${kind === 'title' ? 'rIdF2' : 'rIdF1'}"/>`
      + `<w:footnotePr><w:numFmt w:val="${NF}"/><w:numStart w:val="1"/><w:numRestart w:val="eachSect"/></w:footnotePr><w:type w:val="nextPage"/>`
      + `<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${tw}" w:right="${tw}" w:bottom="${tw}" w:left="${tw}" w:header="708" w:footer="708" w:gutter="0"/>`
      + `<w:pgNumType w:fmt="${NF}"/><w:titlePg/><w:bidi/></w:sectPr>`;
  }
  const rawRun = (t, rp) => `<w:r><w:rPr>${rp}<w:rtl/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const chHead = (ch, idx) => {
    const p = wrChParts(ch.title, idx, PST), out = [];
    const C = PST === 'classic', JCX = C ? '<w:jc w:val="center"/>' : '<w:jc w:val="left"/>';
    if (p.big) out.push(['', rawRun(p.big, `<w:b/><w:bCs/><w:color w:val="E4ECE9"/>${szv(144)}`), `<w:keepNext/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>${JCX}`]);
    if (p.cap) out.push(['', rawRun(p.cap, C ? `<w:color w:val="8A6D3B"/>${szv(30)}` : `<w:b/><w:bCs/><w:color w:val="3F7D6E"/>${szv(26)}`), `<w:keepNext/><w:spacing w:after="60"/>${JCX}`]);
    out.push(['Heading1', rawRun(p.t, `<w:b/><w:bCs/><w:color w:val="${C ? '2B2B2B' : '1F3B35'}"/>${szv(C ? 60 : 52)}`), `<w:spacing w:after="${C ? 60 : 120}"/>${JCX}`]);
    out.push(['', C ? rawRun('❁ ❁ ❁', `<w:color w:val="B08D57"/>${szv(32)}`) : rawRun('━━━━', `<w:color w:val="3F7D6E"/>${szv(24)}`), `<w:spacing w:after="${C ? 700 : 600}"/>${JCX}`]);
    out[0][2] = out[0][2].replace(/<w:spacing /, `<w:spacing w:before="${C ? 2600 : 1000}" `);
    return out.map(([st, inner, ppr]) => `<w:p><w:pPr>${ordered(`${st ? `<w:pStyle w:val="${st}"/>` : ''}${ppr}`)}</w:pPr>${inner}</w:p>`).join('');
  };
  let body = para('Title', run(b.title || 'كتاب بلا عنوان', {}));
  if (PST && b.chapters.length) body += `<w:p><w:pPr><w:bidi/>${sectL('title')}</w:pPr></w:p>`;
  b.chapters.forEach((ch, idx) => {
    if (PST) {
      body += chHead(ch, idx);
      if (PST === 'modern') hdrs[idx] = wrChParts(ch.title, idx, PST).t;
    } else body += para('Heading1', run(ch.title || `فصل ${wrNum(idx + 1)}`, {}), '<w:pageBreakBefore/>');
    const tpl = document.createElement('template');
    tpl.innerHTML = wrSafe(ch.html);
    pFirst = true;
    for (const el of tpl.content.children) {
      body += block(el, ch, true);
      pFirst = el.nodeName !== 'P' || el.classList.contains('ayah') || wrIsStars(el) || el.classList.contains('pgbreak');
      if (el.nodeName === 'DIV' && el.classList.contains('pgbreak')) pFirst = true;
    }
    // (each chapter a section of its own, so its footnotes start again from one; its first page is its heading's)
    if (idx < b.chapters.length - 1) body += `<w:p><w:pPr><w:bidi/>${PST ? sectL('ch', idx) : sect(idx === 0)}</w:pPr></w:p>`;
  });
  const lastSect = PST && b.chapters.length ? sectL('ch', b.chapters.length - 1) : sect(b.chapters.length < 2);
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}${lastSect}</w:body></w:document>`;
  // (v200) the running heads: none (H0); the book's title in the middle (H1, «الكلاسيكي»); or the book's title at the
  // start and the chapter's at the end (one for each chapter, «الحديث»)
  const hdr = (inner, ppr) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr xmlns:w="${W}"><w:p><w:pPr>${ppr}</w:pPr>${inner}</w:p></w:hdr>`;
  const BT = b.title || 'كتاب بلا عنوان';
  const hdrParts = !PST ? [] : [{ id: 'rIdH0', name: 'header0.xml', data: hdr('', '<w:bidi/>') }].concat(PST === 'classic'
    ? [{ id: 'rIdH1', name: 'header1.xml', data: hdr(rawRun(BT, `<w:color w:val="8A8A8A"/>${szv(24)}`), '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="D9CFBF"/></w:pBdr><w:bidi/><w:jc w:val="center"/>') }]
    : b.chapters.map((c, i) => ({ id: `rIdH${i + 1}`, name: `header${i + 1}.xml`, data: hdr(rawRun(BT, `<w:color w:val="6F8A84"/>${szv(21)}`) + '<w:r><w:rPr><w:rtl/></w:rPr><w:tab/></w:r>' + rawRun(hdrs[i] || '', `<w:color w:val="6F8A84"/>${szv(21)}`), `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="E2E8E6"/></w:pBdr><w:tabs><w:tab w:val="end" w:pos="${11906 - 2 * tw}"/></w:tabs><w:bidi/>`) })));
  // (v157) the page: A4, its number at the foot on the right (in the app's digits), none on the title page
  const ftr = (inner) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr xmlns:w="${W}"><w:p><w:pPr><w:bidi/></w:pPr>${inner}</w:p></w:ftr>`;
  const fnPara = (inner, first, ppr = '') => `<w:p><w:pPr>${ordered(`<w:pStyle w:val="FootnoteText"/>${FNB}${ppr}`)}</w:pPr>${first ? `<w:r>${FR}<w:t>\u200F(</w:t></w:r><w:r>${FR}<w:footnoteRef/></w:r><w:r>${FR}<w:t>)\u200F</w:t></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve"> </w:t></w:r>` : ''}${inner}</w:p>`;
  // (v186) a footnote with its formatting: its paragraphs, and its lists' lines each with its «•» or «١-», as in the text
  const fnBody = (n) => {
    if (!n.h) return (n.t || '').split(/\r?\n/).map((line, k) => fnPara(run(line, FF), !k)).join('');
    const tpl = document.createElement('template');
    tpl.innerHTML = n.h;
    const out = [];
    ayOff = true; // (the verses' colour is the text's, as in the editor: not in a footnote)
    for (const el of tpl.content.children) {
      if (el.nodeName === 'UL' || el.nodeName === 'OL') {
        [...el.children].filter((li) => li.nodeName === 'LI').forEach((li, i) => {
          const lead = el.nodeName === 'UL' ? '• ' : `${wrNum((Number(el.getAttribute('start')) || 1) + i)}- `;
          out.push([run(lead, FF) + runs(li, FF, null), `<w:ind w:left="${425 * (1 + (Number(li.dataset.ind) || 0))}" w:hanging="283"/>${pprOf(li).replace(/<w:ind[^>]*\/>/, '')}`]);
        });
      } else out.push([runs(el, FF, null), pprOf(el)]);
    }
    ayOff = false;
    if (!out.length) out.push(['', '']);
    return out.map(([inner, ppr], k) => fnPara(inner, !k, ppr)).join('');
  };
  const footnotes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes xmlns:w="${W}">`
    + '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>'
    + '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:bidi/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'
    + notes.map((n, i) => `<w:footnote w:id="${i + 1}">${fnBody(n)}</w:footnote>`).join('')
    + '</w:footnotes>';
  const pstyle = (id, name, rpr, ppr, extra = '') => `<w:style w:type="paragraph"${id === 'Normal' ? ' w:default="1"' : ''} w:styleId="${id}"><w:name w:val="${name}"/>${id === 'Normal' ? '' : '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'}${extra}<w:qFormat/><w:pPr>${ordered(ppr)}</w:pPr><w:rPr>${rpr}<w:rtl/></w:rPr></w:style>`;
  const sz = (n) => `<w:sz w:val="${n}"/><w:szCs w:val="${n}"/>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:eastAsia="${F}"/>${szv(PST === 'modern' ? 28 : 32)}<w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="120" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
${pstyle('Normal', 'Normal', '', '<w:jc w:val="both"/>')}
${pstyle('Title', 'Title', `<w:b/><w:bCs/>${szv(56)}`, '<w:spacing w:before="2400" w:after="480"/>')}
${pstyle('Heading1', 'heading 1', `<w:b/><w:bCs/>${szv(44)}`, '<w:keepNext/><w:spacing w:before="240" w:after="240"/><w:outlineLvl w:val="0"/>')}
${pstyle('Heading2', 'heading 2', `<w:b/><w:bCs/>${szv(38)}`, '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/>')}
${pstyle('Heading3', 'heading 3', `<w:b/><w:bCs/>${szv(34)}`, '<w:keepNext/><w:spacing w:before="180" w:after="80"/><w:outlineLvl w:val="2"/>')}
${PST === 'classic' ? pstyle('Ayah', 'Ayah', `<w:b/><w:bCs/>${szv(34)}`, '<w:spacing w:before="160" w:after="160"/><w:jc w:val="center"/>')
  : PST === 'modern' ? pstyle('Ayah', 'Ayah', `<w:b/><w:bCs/>${szv(34)}`, '<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="8FB3AA"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F2F6F5"/><w:spacing w:before="160" w:after="270"/>')
  : pstyle('Ayah', 'Ayah', `<w:b/><w:bCs/>${szv(34)}`, '<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:left w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/><w:right w:val="single" w:sz="4" w:space="4" w:color="0F6E5E"/></w:pBdr><w:spacing w:before="160" w:after="160"/><w:ind w:left="567" w:right="567"/>')}
${pstyle('Quote', 'Quote', `<w:color w:val="444444"/>`, '<w:spacing w:before="120" w:after="120"/><w:ind w:left="567" w:right="567"/><w:jc w:val="both"/>')}
${pstyle('FootnoteText', 'footnote text', szv(FNS), '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/>', '')}
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
<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>${hdrParts.map((h) => `\n<Override PartName="/word/${h.name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`).join('')}
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
<Relationship Id="rIdF2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>${hdrParts.map((h) => `\n<Relationship Id="${h.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="${h.name}"/>`).join('')}
${media.map((m, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.${m.ext}"/>`).join('\n')}
</Relationships>` },
    { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:doNotExpandShiftReturn/><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:themeFontLang w:val="en-US" w:bidi="ar-SA"/></w:settings>` },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/footnotes.xml', data: footnotes },
    { name: 'word/document.xml', data: doc },
    { name: 'word/footer1.xml', data: ftr(`<w:fldSimple w:instr=" PAGE "><w:r><w:rPr>${PST === 'modern' ? `<w:b/><w:bCs/><w:color w:val="3F7D6E"/>${szv(24)}` : PST === 'classic' ? '<w:color w:val="555555"/>' : ''}<w:rtl/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`) },
    ...hdrParts.map((h) => ({ name: `word/${h.name}`, data: h.data })),
    { name: 'word/footer2.xml', data: ftr('') },
    ...media.map((m) => ({ name: m.name, data: m.data })),
  ];
  return new Blob([Xlsx.zip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
// ---------- the pages as the book's Word file makes them (A4, its margins, Amiri, the styles' sizes and spacing, each
// chapter from a new page, the footnotes at the foot of their page), laid out out of sight to count the pages before a
// chapter, for the sheets of «الورق» to number theirs as the book does. (v186's «عرض الصفحات» view of them was taken
// away in v188 at his word: «ما يحتاج».)
const WP = { W: 794, H: 1123, M: 96, foot: 47 }; // (pixels at 96 to the inch: A4, margins of an inch, the footer 708 twips up)
// a block of the chapter as Word writes it: lists as lines with their «•» or «١-», the verse colour of the book
function wrPgBlocks(html, ayc, step = 37.8) {
  const tpl = document.createElement('template');
  tpl.innerHTML = wrSafe(html);
  const out = [];
  for (const el of [...tpl.content.children]) {
    if (el.nodeName === 'UL' || el.nodeName === 'OL') {
      [...el.children].filter((li) => li.nodeName === 'LI').forEach((li, i) => {
        const p = document.createElement('p');
        p.className = 'wp-li';
        p.style.cssText = li.style.cssText;
        p.style.paddingRight = `${step * (1 + (Number(li.dataset.ind) || 0))}px`;
        p.append(el.nodeName === 'UL' ? '• ' : `${wrNum((Number(el.getAttribute('start')) || 1) + i)}- `, ...li.childNodes);
        out.push(p);
      });
    } else out.push(el);
  }
  for (const el of out) if (wrIsStars(el)) el.classList.add('wr-stars'); // (v189)
  if (ayc) for (const el of out) wrPgAyc(el, ayc);
  return out;
}
// (as in the Word file: what stands between ﴿ and ﴾ in a paragraph takes the book's colour)
function wrPgAyc(el, color) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), list = [];
  while (w.nextNode()) list.push(w.currentNode);
  let open = false;
  for (const t of list) {
    const parts = t.data.split(/([﴿﴾])/);
    if (parts.length === 1 && !open) continue;
    const frag = document.createDocumentFragment();
    for (const s of parts) {
      if (!s) continue;
      if (s === '﴿') open = true;
      if (open) { const sp = document.createElement('span'); sp.style.color = color; sp.textContent = s; frag.append(sp); } else frag.append(s);
      if (s === '﴾') open = false;
    }
    t.replaceWith(frag);
  }
}
// a footnote at the foot of the page: «(١)» then its words, its lists' lines each on its own
function wrPgNote(c, id, n) {
  const box = document.createElement('div');
  box.className = 'wp-fn';
  const h = c.nhtml && c.nhtml[id];
  const blocks = h ? wrPgBlocks(h, '', 28.3) : wrNoteLines(c.notes[id] || '').length ? [...(() => { const t = document.createElement('template'); t.innerHTML = wrNoteLines(c.notes[id] || ''); return t.content.children; })()] : [];
  if (!blocks.length) blocks.push(document.createElement('p'));
  blocks[0].prepend(`(${wrNum(n)}) `);
  box.append(...blocks);
  return box;
}
// (v187) out of sight, the number of the pages before chapter «upto» (the title's and the chapters' before it), for
// the sheets of «الورق» to number their pages as the book does
async function wrPagesBefore(upto) {
  if (!wrState || wrState.book.kind !== 'book') return;
  const box = document.createElement('div'); box.className = 'wp-hold'; $('wrEditor').append(box); // (out of sight and clipped: the editor does not widen)
  const r = await wrPgLay(wrState.book, box, () => !!wrState && wrState.ch.id === upto, upto);
  box.remove();
  return r ? r.n : undefined;
}
// the book's pages laid out in «box», out of sight: to chapter «upto» ({ n: the pages before it }), or all of them
// ({ pages, starts: the first page of each chapter, lab }); null when «alive» says the work is no longer wanted
async function wrPgLay(b, box, alive, upto) {
  const pst = wrGeo(b), PF = wrPstFont(pst);
  try { await Promise.all([document.fonts.load('16px Amiri'), document.fonts.load('bold 16px Amiri'), document.fonts.load(`16px "${PF}"`), document.fonts.load(`bold 16px "${PF}"`)]); await document.fonts.ready; } catch {}
  if (!alive()) return null;
  wrGeo(b); // (again: the sheets of another book may have been laid out meanwhile)
  // the place pages are made in, at their true size, out of sight
  const lab = document.createElement('div');
  lab.className = pst ? `wp-lab wpst-${pst}` : 'wp-lab';
  if (pst) lab.style.setProperty('--wp-m', `${WP.M}px`);
  box.append(lab);
  // a line of Amiri as Word spaces it: its own height, times 1.25 («300» of «240»)
  const probe = document.createElement('span'); probe.className = 'wp-probe'; probe.textContent = 'كتاب'; lab.append(probe);
  const one = probe.getBoundingClientRect().height / 100 || 1.6;
  probe.remove();
  lab.style.setProperty('--wp-lh', String(Math.round(one * 1.25 * 1000) / 1000));
  lab.style.setProperty('--wp-l1', String(Math.round(one * 1000) / 1000));
  if (WR_FNS[b.fns]) lab.style.setProperty('--wp-fns', `${WR_FNS[b.fns][1] * 2 / 3}px`); // (v199: the footnotes' size of the book, as «الورق» and Word have it)
  const AYC = WR_AYC[b.ayc] ? `#${WR_AYC[b.ayc][1]}` : '';
  const pages = [];
  let pg = null, body = null, fns = null;
  const CH = WP.H - 2 * WP.M;
  const newPage = () => {
    pg = document.createElement('div'); pg.className = 'wp-page';
    body = document.createElement('div'); body.className = 'wp-body';
    fns = document.createElement('div'); fns.className = 'wp-fns';
    pg.append(body, fns);
    lab.append(pg);
    pages.push(pg);
  };
  const fits = () => body.offsetHeight + (fns.childElementCount ? fns.offsetHeight : 0) <= CH + 0.5;
  // a block and its footnotes on the page; true if they fit
  const put = (el, ch, nums) => {
    body.append(el);
    const added = [];
    for (const m of el.querySelectorAll('sup.fn')) { const n = wrPgNote(ch, m.dataset.fn, nums[m.dataset.fn] || 0); fns.append(n); added.push(n); }
    if (fits()) return true;
    el.remove(); for (const n of added) n.remove();
    return false;
  };
  // the words of a paragraph up to a point, and from it on
  const cut = (el, node, off) => {
    const a = document.createRange(); a.setStart(el, 0); a.setEnd(node, off);
    const z = document.createRange(); z.setStart(node, off); z.setEnd(el, el.childNodes.length);
    const first = el.cloneNode(false), rest = el.cloneNode(false);
    first.append(a.cloneContents()); rest.append(z.cloneContents());
    first.classList.add('wp-cont'); // (its last line spread as Word spreads a line that goes on)
    if (el.classList.contains('wp-li')) rest.classList.add('wp-li-more');
    rest.classList.add('wp-rest'); // (v200: not a paragraph's first line, so no indent in «الكلاسيكي»)
    return [first, rest];
  };
  const place = (el, ch, nums, fresh) => {
    if (put(el, ch, nums)) return;
    // a paragraph goes on to the next page from the last word that fits
    if (/^(P|BLOCKQUOTE)$/.test(el.nodeName) && !el.querySelector('img, table')) {
      const pts = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const t = w.currentNode; for (let i = 0; i < t.data.length; i++) if (t.data[i] === ' ') pts.push([t, i + 1]); }
      let lo = 0, hi = pts.length - 1, best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, [f] = cut(el, ...pts[mid]);
        if (put(f, ch, nums)) { f.remove(); for (const m of f.querySelectorAll('sup.fn')) { const x = fns.lastElementChild; if (x) x.remove(); } best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (best >= 0) {
        const [f, rest] = cut(el, ...pts[best]);
        put(f, ch, nums);
        newPage();
        place(rest, ch, nums, true);
        return;
      }
    }
    if (!fresh && body.childElementCount) {
      // a heading does not stay alone at a page's foot: it goes over with what follows it
      const last = body.lastElementChild, carry = last && /^(H1|H2|H3)$/.test(last.nodeName) && body.childElementCount > 1 ? last : null;
      const k = carry ? carry.querySelectorAll('sup.fn').length : 0, cfn = k ? [...fns.children].slice(-k) : []; // (its footnotes go over with it)
      newPage();
      if (carry) { body.append(carry); for (const n of cfn) fns.append(n); }
      place(el, ch, nums, !carry);
      return;
    }
    // (too tall for a page of its own: it stands there as it is)
    body.append(el);
    for (const m of el.querySelectorAll('sup.fn')) fns.append(wrPgNote(ch, m.dataset.fn, nums[m.dataset.fn] || 0));
  };
  newPage();
  const t = document.createElement('div'); t.className = 'wp-title'; t.textContent = b.title || 'كتاب بلا عنوان';
  body.append(t);
  const starts = [];
  for (let ci = 0; ci < b.chapters.length; ci++) {
    if (!alive()) return null;
    const ch = b.chapters[ci], nums = {};
    if (upto && ch.id === upto) return { n: pages.length };
    wrNoteIds(ch.html).forEach((id, i) => { nums[id] = i + 1; });
    newPage();
    starts.push(pages.length - 1);
    const h = document.createElement('h1'); wrChHead(h, ch.title, ci, pst);
    body.append(h);
    for (const el of wrPgBlocks(ch.html, AYC)) {
      if (el.nodeName === 'DIV' && el.classList.contains('pgbreak')) { newPage(); continue; }
      if (el.nodeName === 'HR') { const p = document.createElement('p'); p.className = 'wp-hr'; p.append(document.createElement('br')); place(p, ch, nums); continue; }
      if (el.nodeName === 'IMG') { const p = document.createElement('p'); p.append(el); place(p, ch, nums); continue; }
      if (el.nodeName === 'TABLE') { place(el, ch, nums); const p = document.createElement('p'); p.append(document.createElement('br')); place(p, ch, nums); continue; }
      place(el, ch, nums);
    }
    await new Promise((ok) => setTimeout(ok, 0)); // (the screen breathes between chapters)
  }
  return upto ? null : { pages, starts, lab };
}

// ---------- (v199, his words: «اجعل لي القدرة على تصدير صفحات مختارة من كتبي pdf», his choices «ج: الاثنان معاً»
// (from a page to a page, and chapters) and «أ: أرقامها في الكتاب»): the pages he picks, laid out as the book's Word
// file makes them (as «الورق» numbers them), footnotes at the foot of their page, the page's number under it, the
// verse and footnote colours of the book; then the print window, to keep them as PDF.
let wrPdfJob = 0;
function wrPdfOpen(b) {
  const job = ++wrPdfJob;
  ldraft = { kind: 'wrpdf', id: b.id, isNew: false, lay: null };
  $('libForm').innerHTML = `${sheetHead('تصدير صفحات PDF')}<div id="wpdBody"><p class="note-text">أرتّب صفحات الكتاب…</p></div>`;
  showLib();
  wrFonts();
  const box = document.createElement('div'); box.className = 'wp-hold'; document.body.append(box);
  $('libSheet').addEventListener('close', () => box.remove(), { once: true }); // (the pages laid out go with the window)
  const alive = () => job === wrPdfJob && ldraft && ldraft.kind === 'wrpdf' && ldraft.id === b.id && $('libSheet').open;
  wrPgLay(b, box, alive).then((r) => {
    if (!r || !alive()) return;
    ldraft.lay = r; ldraft.book = b;
    wrPdfBody();
  }, () => { if (alive()) $('wpdBody').innerHTML = '<p class="note-text">تعذّر ترتيب الصفحات.</p>'; });
}
const wrPgWord = (n) => (n === 1 ? 'صفحة واحدة' : n === 2 ? 'صفحتان' : `${wrNum(n)} ${n > 10 ? 'صفحة' : 'صفحات'}`);
const wrPdfRange = (rm) => `<div class="wpd-range"><label class="field"><span>من صفحة</span><input inputmode="numeric" data-wpd="a" autocomplete="off"></label><label class="field"><span>إلى صفحة</span><input inputmode="numeric" data-wpd="z" autocomplete="off"></label>${rm ? '<button type="button" class="icon-btn" data-action="wr-pdf-rm" aria-label="احذف هذا المدى">✕</button>' : ''}</div>`;
// (each page's place in the book: page 1 is the title's, unnumbered as in the Word file)
function wrPdfBody() {
  const { lay, book: b } = ldraft, n = lay.pages.length, N = wrNum;
  const span = (i) => [lay.starts[i] + 1, i + 1 < lay.starts.length ? lay.starts[i + 1] : n];
  const sp = (a, z) => (a === z ? `ص ${N(a)}` : `ص ${N(a)}–${N(z)}`);
  $('wpdBody').innerHTML = `<p class="note-text">الكتاب: ${wrPgWord(n)}، بأرقام صفحاته في «الورق».</p>
    <div class="wpd-sec"><b>من صفحة إلى صفحة</b>${wrPdfRange(false)}<div id="wpdMore"></div>
      <button type="button" class="ghost sm" data-action="wr-pdf-add">＋ مدى آخر</button></div>
    <div class="wpd-sec"><b>أو فصول مختارة</b>
      <label class="wpd-ch"><input type="checkbox" data-wpd="c" data-a="1" data-z="1"><span>صفحة العنوان (${sp(1, 1)})</span></label>
      ${b.chapters.map((c, i) => { const [a, z] = span(i); return `<label class="wpd-ch"><input type="checkbox" data-wpd="c" data-a="${a}" data-z="${z}"><span>${esc(c.title || `فصل ${N(i + 1)}`)} (${sp(a, z)})</span></label>`; }).join('')}</div>
    <p class="note-text" id="wpdSum"></p>
    <div class="sheet-actions"><button type="submit" class="primary">صدّر PDF</button></div>`;
  wrPdfSum();
}
// the pages picked: each range, and each chapter ticked (one page once, in the book's order)
function wrPdfPicked() {
  const n = ldraft.lay.pages.length, set = new Set(), f = $('libForm');
  const pg = (x) => { const v = Math.round(num(x)); return v ? Math.min(n, Math.max(1, v)) : 0; };
  for (const r of f.querySelectorAll('.wpd-range')) {
    let a = pg(r.querySelector('[data-wpd="a"]').value), z = pg(r.querySelector('[data-wpd="z"]').value);
    if (!a && !z) continue;
    a = a || z; z = z || a; if (a > z) [a, z] = [z, a];
    for (let i = a; i <= z; i++) set.add(i);
  }
  for (const c of f.querySelectorAll('[data-wpd="c"]:checked')) for (let i = +c.dataset.a; i <= +c.dataset.z; i++) set.add(i);
  return [...set].sort((x, y) => x - y);
}
function wrPdfSum() {
  const el = $('wpdSum');
  if (!el) return;
  const p = wrPdfPicked();
  if (!p.length) { el.textContent = 'لم تختر صفحات بعد.'; return; }
  // the picked pages as runs: «من ١٤ إلى ٢٠، و٣١»
  const runs = [];
  for (const x of p) { const r = runs[runs.length - 1]; if (r && r[1] === x - 1) r[1] = x; else runs.push([x, x]); }
  const said = runs.map(([a, z]) => (a === z ? wrNum(a) : `من ${wrNum(a)} إلى ${wrNum(z)}`)).join('، و');
  el.textContent = `سيُصدَّر: ${wrPgWord(p.length)} (${said})، بحواشيها أسفل كل صفحة وأرقامها.`;
}
// the print window, with the pages picked (copies: the laid-out pages stay as they are for another export)
function wrPdfGo() {
  if (!ldraft.lay) { toast('انتظر حتى تُرتَّب الصفحات.'); return false; }
  const p = wrPdfPicked();
  if (!p.length) { toast('اختر صفحات أولاً.'); return false; }
  const { lay, book: b } = ldraft;
  let box = document.getElementById('print');
  if (!box) { box = document.createElement('div'); box.id = 'print'; document.body.appendChild(box); }
  let ps = document.getElementById('pageSize');
  if (!ps) { ps = document.createElement('style'); ps.id = 'pageSize'; document.head.appendChild(ps); }
  ps.textContent = '@page{size:A4 portrait;margin:0}';
  const pst = wrPstOf(b), starts = new Set(lay.starts);
  box.className = pst ? `wpp wpst-${pst}` : 'wpp';
  for (const k of ['--wp-lh', '--wp-l1', '--wp-fns', '--wp-m']) { const v = lay.lab.style.getPropertyValue(k); if (v) box.style.setProperty(k, v); else box.style.removeProperty(k); }
  const fnc = WR_FNC[b.fnc] ? `#${WR_FNC[b.fnc][1]}` : '', fnb = WR_FNB[b.fnb] ? `#${WR_FNB[b.fnb][1]}` : '', fnh = WR_FNH[b.fnh] ? `#${WR_FNH[b.fnh][1]}` : '';
  box.replaceChildren(...p.map((i) => {
    const pg = lay.pages[i - 1].cloneNode(true);
    if (i > 1) { const nb = document.createElement('div'); nb.className = 'wp-num'; nb.textContent = wrNum(i); pg.append(nb); }
    if (pst && i > 1 && !starts.has(i - 1)) { // (v200) the running head, as the book's look has it
      let ci = 0; lay.starts.forEach((s, k) => { if (s <= i - 1) ci = k; });
      const hd = document.createElement('div'); hd.className = 'wp-hd';
      hd.innerHTML = wrHeadHTML(pst, b.title || 'كتاب بلا عنوان', wrChParts(b.chapters[ci] && b.chapters[ci].title, ci, pst).t);
      pg.append(hd);
    }
    // (as the Word file has them: the footnote's number in the text and its words in its colour, its paragraphs on
    // their background, its words marked)
    if (fnc) for (const x of pg.querySelectorAll('.wp-body sup.fn, .wp-fn')) x.style.color = fnc;
    if (fnb) for (const x of pg.querySelectorAll('.wp-fn')) x.style.background = fnb;
    if (fnh) for (const fn of pg.querySelectorAll('.wp-fn')) {
      const w = document.createTreeWalker(fn, NodeFilter.SHOW_TEXT), ts = [];
      while (w.nextNode()) if (w.currentNode.data.trim()) ts.push(w.currentNode);
      for (const t of ts) {
        const bg = t.parentElement.closest('[style*="background"]');
        if (bg && bg !== fn && fn.contains(bg)) continue; // (words he marked himself keep their colour)
        const m = document.createElement('span'); m.style.background = fnh; t.replaceWith(m); m.append(t);
      }
    }
    return pg;
  }));
  toast('اختر «حفظ PDF» أو «حفظ في الملفات» من نافذة الطباعة');
  setTimeout(() => window.print(), 300);
  return true;
}
document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.wpd) wrPdfSum(); });
// (the keyboard's «Go» in a page's box does not print before he has picked them all: it closes the keyboard)
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.wpd) { e.preventDefault(); e.target.blur(); } });
document.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.wpd) wrPdfSum(); });
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action="wr-pdf-add"], [data-action="wr-pdf-rm"]');
  if (!t || !ldraft || ldraft.kind !== 'wrpdf') return;
  if (t.dataset.action === 'wr-pdf-rm') { t.closest('.wpd-range').remove(); wrPdfSum(); return; }
  const tpl = document.createElement('template');
  tpl.innerHTML = wrPdfRange(true);
  $('wpdMore').append(tpl.content);
  $('wpdMore').lastElementChild.querySelector('input').focus();
});

// ---------- «الورق» (v187, his words: «كنت أقصد أن يكون نفس الوورد التحرير كله في صفحة كالورد», his choices
// «أ: زر يبدّل بينهما» and «ج: الاثنتان بزر تكبير»): the chapter written on A4 sheets as its Word file makes them (the
// measures of `WP`), its words going on to the next sheet by themselves, a line at a time, its footnotes written
// at the foot of their sheet and the page's number under it. The text stays the one editor (#wrBody): beside it, out of
// the text, a column of floats (#wrFlow) — the height a sheet holds, then the room between two sheets — which its lines
// go around, so a paragraph goes on to the next sheet from the line that does not fit, as Word's does.
const WRP = { G: 32 }; // (the grey between two sheets)
let wrPaperRO = null;
const wrPaperOn = () => { try { return localStorage.getItem('mahami-wrpaper') === '1'; } catch { return false; } };
const wrZoomBig = () => { try { return localStorage.getItem('mahami-wrzoom') === 'big'; } catch { return false; } };
function wrPaperIs() { return !!$('wrPaper'); }
function wrPaperSet(on, keep) {
  if (!wrState) return;
  on = !!on && wrState.book.kind === 'book';
  if (!keep) try { localStorage.setItem('mahami-wrpaper', on ? '1' : '0'); } catch {}
  const d = $('wrEditor'), sc = $('wrScroll'), body = $('wrBody'), notes = $('wrNotes');
  for (const x of d.querySelectorAll('[data-wr="paper"]')) x.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (!on) {
    const pp = $('wrPaper');
    if (!pp) return;
    if (wrPaperRO) wrPaperRO.disconnect();
    for (const x of body.querySelectorAll('.pgbreak')) x.style.marginBottom = ''; // (v200: the room under a new page is the sheets')
    sc.prepend(body, notes);
    pp.remove();
    for (const n of notes.querySelectorAll('.wr-note')) n.style.top = '';
    d.classList.remove('wr-paper', 'wr-zbig');
    sc.style.removeProperty('--wp-lh'); sc.style.removeProperty('--wp-l1');
    wrBmkPaint(); wrAycPaint(); wrFnhPaint(); // (v198) moving the text and footnotes empties what was painted over them
    return;
  }
  d.classList.toggle('wr-zbig', wrZoomBig());
  const pst = wrGeo(wrState.book), PF = wrPstFont(pst);
  if (wrPaperIs()) { wrPaperLay(); return; }
  const pp = document.createElement('div');
  pp.id = 'wrPaper'; pp.className = pst ? `wrp-paper wpst-${pst}` : 'wrp-paper';
  if (pst) pp.style.setProperty('--wp-m', `${WP.M}px`);
  pp.innerHTML = '<div class="wrp-sheets" id="wrSheets" aria-hidden="true"></div><div class="wrp-flow" id="wrFlow" aria-hidden="true"></div><h1 class="wrp-h1" id="wrPH1"></h1>';
  sc.prepend(pp);
  pp.append(body, notes);
  wrAycPaint(); wrFnhPaint();
  d.classList.add('wr-paper');
  wrState.pgFrom = 0;
  if (typeof ResizeObserver === 'function') { if (!wrPaperRO) wrPaperRO = new ResizeObserver(() => wrPaperSoon()); wrPaperRO.observe(body); }
  // the line of Amiri as Word spaces it (as in the measure of the pages, `WP`), once the font is there
  const lines = () => {
    const probe = document.createElement('span'); probe.className = 'wp-probe'; probe.textContent = 'كتاب'; pp.append(probe);
    const one = probe.getBoundingClientRect().height / 100 / (wrPaperZoom() || 1) || 1.6;
    probe.remove();
    sc.style.setProperty('--wp-lh', String(Math.round(one * 1.25 * 1000) / 1000));
    sc.style.setProperty('--wp-l1', String(Math.round(one * 1000) / 1000));
  };
  wrPaperZoomSet();
  lines();
  wrPaperLay(true);
  const ch = wrState.ch.id;
  (async () => {
    try { await Promise.all([document.fonts.load('16px Amiri'), document.fonts.load('bold 16px Amiri'), document.fonts.load(`16px "${PF}"`), document.fonts.load(`bold 16px "${PF}"`)]); await document.fonts.ready; } catch {}
    if (!wrState || wrState.ch.id !== ch || !wrPaperIs()) return;
    lines(); wrPaperLay(true);
    // the number of its first page in the book
    const n = await wrPagesBefore(ch);
    if (!wrState || wrState.ch.id !== ch || !wrPaperIs() || typeof n !== 'number') return;
    wrGeo(wrState.book);
    wrState.pgFrom = n; wrPaperLay(true);
  })();
}
// the sheets on the screen's width («الورقة كاملة»), or larger, the line read at ease, the sheet moved sideways («مكبّرة»)
function wrPaperZoom() {
  const sc = $('wrScroll'); if (!sc) return 1;
  const fit = Math.min(1, (sc.clientWidth - 16) / WP.W);
  return Math.round((wrZoomBig() ? Math.max(fit, Math.min(1, 0.8)) : fit) * 1000) / 1000;
}
function wrPaperZoomSet() {
  const pp = $('wrPaper'); if (!pp) return;
  pp.style.zoom = String(wrPaperZoom());
  const b = $('wrZoomBtn'); if (b) b.textContent = wrZoomBig() ? '🔍 الورقة كاملة' : '🔍 كبّر الورقة';
}
function wrZoomToggle() {
  try { localStorage.setItem('mahami-wrzoom', wrZoomBig() ? 'fit' : 'big'); } catch {}
  $('wrEditor').classList.toggle('wr-zbig', wrZoomBig());
  const sc = $('wrScroll'), pp = $('wrPaper');
  if (!pp) return;
  // (v196: the line he writes in stays before him: the cursor's, or the first line on the screen; the middle of the
  // screen kept before was often an empty part of the sheet, so the zoom looked as if it did nothing)
  const top = sc.getBoundingClientRect().top, body = $('wrBody'), sel = getSelection();
  let at = null;
  const rr = sel.rangeCount && body.contains(sel.anchorNode) ? sel.getRangeAt(0) : null, rc = rr && rr.getClientRects()[0];
  if (rc && rc.top >= top && rc.bottom <= top + sc.clientHeight) {
    let n = rr.startContainer; if (n.nodeType !== 1) n = n.parentNode;
    at = { el: n, dy: rc ? rc.top - n.getBoundingClientRect().top : 0, y: sc.clientHeight / 3 };
  } else {
    const blk = [...body.children].find((b) => b.getBoundingClientRect().bottom > top + 4);
    if (blk) { const bt = blk.getBoundingClientRect().top; at = { el: blk, dy: Math.max(0, top - bt), y: Math.max(0, bt - top) }; }
  }
  const k0 = at ? at.dy / (at.el.getBoundingClientRect().height || 1) : 0;
  wrPaperZoomSet();
  if (at) { const r1 = at.el.getBoundingClientRect(); sc.scrollTop += r1.top + k0 * r1.height - top - at.y; }
  sc.scrollLeft = 0;
  wrPaperLay(true);
}
let wrPaperT = 0;
// a touch on a sheet out of the text (its margins, below its last line): the cursor in the text, at its end if below it
document.addEventListener('pointerup', (e) => {
  const pp = $('wrPaper');
  if (!wrState || !pp || !pp.contains(e.target) || e.target.closest('#wrBody, .wr-note') || wrState.noteEd || String(getSelection())) return;
  const body = $('wrBody');
  body.focus({ preventScroll: true });
  if (e.clientY > body.getBoundingClientRect().bottom) {
    const last = body.lastElementChild;
    if (last) wrCaretEnd(last);
  }
});
function wrPaperSoon() { if (!wrPaperIs()) return; clearTimeout(wrPaperT); wrPaperT = setTimeout(() => wrPaperLay(), 90); }
// where each sheet ends: the footnotes of its marks at its foot, the room they take off its text, again until it holds
function wrPaperLay(now) {
  const pp = $('wrPaper');
  if (!pp || !wrState) return;
  const body = $('wrBody'), flow = $('wrFlow'), sheets = $('wrSheets'), notes = $('wrNotes'), h1 = $('wrPH1');
  const CH = WP.H - 2 * WP.M, STEP = WP.H + WRP.G;
  const one = parseFloat(getComputedStyle($('wrScroll')).getPropertyValue('--wp-l1')) || 1.6;
  const SEP = one * 21.333; // (the short line over the footnotes, as Word draws it)
  const ci = wrState.book.chapters.indexOf(wrState.ch), pst = wrPstOf(wrState.book);
  wrChHead(h1, $('wrTitle').value, ci, pst);
  const hd = wrHeadHTML(pst, wrState.book.title || 'كتاب بلا عنوان', wrChParts($('wrTitle').value, ci, pst).t);
  const fresh = (pp.dataset.w || '') !== String(WP.W);
  pp.dataset.w = String(WP.W);
  const scale = () => pp.getBoundingClientRect().width / WP.W || 1;
  const ids = [...body.querySelectorAll('sup.fn')].map((m) => m.dataset.fn);
  const boxes = {}; for (const n of notes.querySelectorAll('.wr-note')) { const ed = n.querySelector('.wr-fn-ed'); if (ed) boxes[ed.dataset.fn] = n; }
  const k = scale();
  const nh = {}; for (const id of ids) nh[id] = boxes[id] ? boxes[id].getBoundingClientRect().height / k : 0;
  let foot = [], n = 1, at = {};
  const build = (trail = true) => {
    let h = '';
    for (let i = 0; i < n; i++) {
      const f = Math.min(foot[i] || 0, CH - 3 * one * 21.333);
      h += `<div class="wrp-push" style="height:${CH - f}px"></div>`;
      if (trail || i < n - 1) h += `<div class="wrp-gap" style="height:${f + 2 * WP.M + WRP.G}px"></div>`; // (while laid out, one after the last sheet too: words past it are counted on a sheet of their own)
    }
    flow.innerHTML = h;
    wrPaperBreaks(body, flow, k, STEP);
  };
  // (v201) each sheet's room for its footnotes as Word finds it, sheet by sheet (`wrPaperGuess`), then read: a sheet
  // whose words still run under its footnotes is set again, the sheets after it guessed again from it. (It was every
  // sheet a mark had stood on in any round, begun from the last layout's rooms: rooms stayed on sheets their marks had
  // left, and after some writing the sheets emptied, a paragraph alone on each, or the words ran under the footnotes.)
  const tried = [], fixed = [];
  let real = [], last = 1;
  const read = () => {
    build();
    const top = flow.getBoundingClientRect().top;
    const end = (body.getBoundingClientRect().bottom - top) / k;
    const pages = Math.max(1, Math.floor(Math.max(0, end - 0.5) / STEP) + 1);
    at = {};
    for (const m of body.querySelectorAll('sup.fn')) {
      const y = (m.getBoundingClientRect().top - top) / k;
      at[m.dataset.fn] = Math.min(pages - 1, Math.max(0, Math.floor(y / STEP)));
    }
    last = pages;
    real = new Array(last).fill(0);
    for (const id of Object.keys(at)) real[at[id]] += nh[id] || 0;
    for (let i = 0; i < last; i++) if (real[i]) real[i] += SEP;
  };
  const us = wrPaperUnits(body, flow, k, nh, SEP, CH - 3 * one * 21.333), guess = (pre) => wrPaperGuess(us, pre, STEP, CH, nh, SEP, CH - 3 * one * 21.333);
  foot = guess([]);
  // (a picture or a table taller than a sheet goes under every sheet added for it: the sheets stop a few past the guess)
  const lim = Math.max(1, foot.length) + 3, grow = () => { while (last > n && n < lim) { n = Math.min(last, lim); read(); } };
  n = Math.max(1, foot.length); read(); grow();
  // a sheet whose words run under its footnotes (the guess a little off): its room as they need, again until it holds
  // (a mark whose room sends its line on and back: the larger, that line goes over)
  for (let round = 0; round < 6 + 3 * lim; round++) {
    let j = -1;
    for (let i = 0; i < Math.min(last, lim); i++) if (!fixed[i] && (real[i] || 0) > (foot[i] || 0) + 0.5) { j = i; break; }
    if (j < 0) break;
    tried[j] = tried[j] || [foot[j] || 0];
    if (tried[j].some((v) => Math.abs(v - real[j]) < 0.5)) { foot[j] = Math.max(foot[j] || 0, real[j]); fixed[j] = true; }
    else { foot[j] = real[j]; tried[j].push(real[j]); }
    const g = guess(foot.slice(0, j + 1));
    for (let i = j + 1; i < Math.max(last, g.length); i++) { foot[i] = g[i] || 0; tried[i] = null; fixed[i] = false; }
    foot.length = Math.max(j + 1, last, g.length);
    n = Math.min(foot.length, lim); read(); grow();
  }
  foot.length = Math.min(last, lim); // (the sheets the words reach)
  n = foot.length; build(false);
  // the sheets, their numbers, the line over their footnotes; and each footnote at the foot of its sheet
  const from = wrState.pgFrom || 0;
  pp.style.height = `${n * STEP - WRP.G - 2 * WP.M}px`;
  let sh = '';
  for (let i = 0; i < n; i++) {
    const f = Math.min(real[i] || 0, CH - 3 * one * 21.333);
    sh += `<div class="wrp-sheet" style="top:${i * STEP}px">${hd && i ? `<i class="wrp-hd">${hd}</i>` : ''}${f ? `<i class="wrp-sep" style="top:${WP.M + CH - f + one * 10.67}px"></i>` : ''}${from ? `<b class="wrp-no">${wrNum(from + i + 1)}</b>` : ''}</div>`;
  }
  sheets.innerHTML = sh;
  const y0 = {};
  for (const id of ids) {
    const b = boxes[id]; if (!b) continue;
    const pg = at[id] || 0, f = Math.min(real[pg] || 0, CH - 3 * one * 21.333);
    if (y0[pg] == null) y0[pg] = WP.M + pg * STEP + CH - f + SEP;
    b.style.top = `${y0[pg]}px`;
    y0[pg] += nh[id];
  }
  wrBmkPaint();
}

// (v201) a guess of each sheet's footnotes' room, so that the layout above holds in a few reads and not one a sheet:
// the words laid out once in one column (`wrPaperUnits`: their lines, a table, a picture, a new page), each line that
// the sheet's foot (its footnotes' room) does not hold going on to the next sheet's top, as the column of floats does;
// sheet by sheet. The sheets already found (`pre`) keep their rooms.
function wrPaperUnits(body, flow, k, nh = {}, SEP = 0, CAP = 1e9) {
  flow.innerHTML = '';
  for (const x of body.querySelectorAll('.pgbreak')) x.style.marginBottom = '';
  // (v203) a table goes on row by row, as Word's (each row its own box between the sheets; a whole table taller than a
  // sheet stood under every sheet added for it, the sheets left empty); a row taller than a sheet, its cells one under
  // another, their lines going on (the mark is the view's only: the saved text keeps no class on a row, `wrSafe`)
  const rows = [...body.querySelectorAll('table.wr-tbl tr')];
  for (const tr of rows) tr.classList.remove('wrp-tall');
  const room = (tr) => { let f = 0; for (const m of tr.querySelectorAll('sup.fn')) f += nh[m.dataset.fn] || 0; return WP.H - 2 * WP.M - (f ? Math.min(f + SEP, CAP) : 0); }; // (its footnotes' room under it too)
  const tall = rows.filter((tr) => tr.getBoundingClientRect().height / k > room(tr) - 2);
  for (const tr of tall) tr.classList.add('wrp-tall');
  const top = flow.getBoundingClientRect().top, rs = [], lhs = new Map();
  const lh = (el) => { if (!lhs.has(el)) lhs.set(el, parseFloat(getComputedStyle(el).lineHeight) || 0); return lhs.get(el); };
  const add = (t, b, o) => rs.push(Object.assign({ t: (t - top) / k, b: (b - top) / k }, o));
  const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const el = tw.currentNode.parentElement; if (el.closest('tr:not(.wrp-tall), .pgbreak, sup')) continue; // (a mark's raised figure is no line)
    const rg = document.createRange(); rg.selectNodeContents(tw.currentNode);
    const h = lh(el.closest('p, li, td, th, h2, h3, blockquote, div') || el) * k;
    const hd = !!el.closest('h2, h3') || null; // (v202) a heading's lines: it goes on with the words under it
    for (const r of rg.getClientRects()) { if (r.height < 1) continue; const m = (r.top + r.bottom) / 2, hh = Math.max(h, r.height) / 2; add(m - hh, m + hh, hd && { hd }); }
  }
  for (const x of body.querySelectorAll('img, tr, hr, .pgbreak')) { if (x.nodeName === 'TR' ? x.classList.contains('wrp-tall') : x.parentElement.closest('tr:not(.wrp-tall)')) continue; const r = x.getBoundingClientRect(); add(r.top, r.bottom, x.classList.contains('pgbreak') ? { brk: x } : null); }
  for (const m of body.querySelectorAll('sup.fn')) { const r = m.getBoundingClientRect(); add(r.top, r.bottom, { id: m.dataset.fn }); }
  rs.sort((a, b) => a.t - b.t);
  const us = [];
  for (const r of rs) {
    const u = us[us.length - 1];
    if (u && r.t < u.b - 2) {
      if (r.id) u.ids.push(r.id);
      else if (u.mk) { u.t = r.t; u.b = r.b; u.mk = false; u.hd = !!r.hd; } // (a mark raised over its line's top: the line is the unit)
      else { u.b = Math.max(u.b, r.b); u.hd = u.hd && !!r.hd; }
      if (r.brk) u.brk = r.brk;
      continue;
    }
    us.push({ t: r.t, b: r.b, ids: r.id ? [r.id] : [], brk: r.brk || null, mk: !!r.id, hd: !!r.hd });
  }
  return us;
}
function wrPaperGuess(us, pre, STEP, CH, nh, SEP, CAP) {
  const foot = [], need = (ids) => { let r = 0; for (const id of ids) r += nh[id] || 0; return r ? r + SEP : 0; };
  let u = 0, off = 0;
  for (let i = 0; u < us.length && i < 400; i++) {
    // as Word: the lines it holds with their marks' footnotes under them; the room the first line it does not hold
    // would leave stays empty, so that line goes on (a sheet already found keeps its room)
    const ids = [], nids = [], base = i * STEP, given = i < pre.length;
    let v = u, o = off, f = given ? pre[i] : 0;
    for (; v < us.length; v++) {
      const x = us[v], y0 = x.t + o, y1 = x.b + o, first = v === u;
      if (!first) {
        if (given ? y1 > base + CH - Math.min(f, CAP) + 0.5 : y1 > base + CH - Math.min(need([...ids, ...x.ids]), CAP) + 0.5) {
          // (v202) as Word: a heading is not left alone at the foot of a sheet, it goes on with its words
          let w = v;
          while (!given && w - 1 > u && us[w - 1].hd) w--;
          if (w < v && !us[w - 1].hd) { ids.length = nids[w - u]; v = w; }
          const z = us[v], z0 = z.t + o, z1 = z.b + o;
          if (!given) f = Math.max(need(ids), Math.min(CAP, base + CH - z1 + 1));
          o += (i + 1) * STEP - z0; break;
        }
      }
      nids[v - u] = ids.length; ids.push(...x.ids);
      if (x.brk && !(first && x.brk.previousElementSibling)) { v++; if (v < us.length) o += (i + 1) * STEP - (us[v].t + o); break; }
    }
    if (!given && v >= us.length) f = need(ids);
    if (!given && v < us.length && us[v - 1] && us[v - 1].brk) f = need(ids);
    foot[i] = f; u = v; off = o;
  }
  return foot;
}

// (v200, «صفحة جديدة»: it was a dashed line on the sheet, the words going on under it) what follows a new page starts
// at the top of the next sheet: room under it to there, out of the text (the saved text has no style on it, `wrSafe`).
// A new page that stands at a sheet's top already (its line went over by itself) adds none.
function wrPaperBreaks(body, flow, k, STEP) {
  const bs = body.querySelectorAll('.pgbreak');
  if (!bs.length) return;
  for (const x of bs) x.style.marginBottom = '';
  const top = flow.getBoundingClientRect().top;
  for (const x of bs) {
    const r = x.getBoundingClientRect(), y0 = (r.top - top) / k, y1 = (r.bottom - top) / k;
    const pg = Math.floor(y0 / STEP);
    if (y0 - pg * STEP < 2 && x.previousElementSibling) continue;
    const to = (pg + 1) * STEP;
    if (to - y1 > 8) x.style.marginBottom = `${to - y1}px`;
  }
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
