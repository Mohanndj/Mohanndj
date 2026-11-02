'use strict';
// «مؤلفاتي»: a book brought in from a Word file (v158, stage 2 of the plan, the owner: «طيب باقي استيراد ملفات وورد والحفاظ على
// فصولها ونحوها», and his answers: «أ: نعم» to what is kept and what is not, the whole book in one file, and chapter titles
// «ب: بخط كبير غامق فقط»). A preview shows the chapters found before anything is saved, and a chapter can be joined to the one
// before it; a book of the app's own Word file comes back as it went out.

const WR_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WR_HL = { yellow: 'FFFF00', green: '00FF00', cyan: '00FFFF', magenta: 'FF00FF', blue: '0000FF', red: 'FF0000', darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000', darkYellow: '808000', darkGray: '808080', lightGray: 'C0C0C0', black: '000000' };

// the parts of a .docx, read in the phone (no internet)
async function wrDocxRead(file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  if (head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0) throw new Error('old'); // (a .doc, or a .docx locked by a password)
  if (head[0] !== 0x50 || head[1] !== 0x4B) throw new Error('notword');
  let files;
  try { files = await XlsxRead.unzip(buf, /^(word\/(document|styles|numbering|footnotes|endnotes)\.xml|word\/_rels\/document\.xml\.rels|word\/media\/.+|docProps\/core\.xml)$/); } catch { throw new Error('notword'); }
  if (!files['word/document.xml']) throw new Error('notword');
  const dec = new TextDecoder();
  const xml = (n) => (files[n] ? new DOMParser().parseFromString(dec.decode(files[n]), 'application/xml') : null);
  return { doc: xml('word/document.xml'), styles: xml('word/styles.xml'), numbering: xml('word/numbering.xml'), foot: xml('word/footnotes.xml'), end: xml('word/endnotes.xml'), rels: xml('word/_rels/document.xml.rels'), core: xml('docProps/core.xml'), files };
}

// the Word file → { title, chapters: [{ title, html, notes }], dropped: {...} }
async function wrFromDocx(file) {
  const P = await wrDocxRead(file);
  const kids = (el, name) => (el ? [...el.childNodes].filter((n) => n.nodeType === 1 && (!name || n.localName === name)) : []);
  const kid = (el, name) => kids(el, name)[0] || null;
  const val = (el) => (el ? el.getAttributeNS(WR_W, 'val') || el.getAttribute('w:val') || '' : '');
  const on = (el) => !!el && !/^(0|false|off|none)$/.test(val(el));
  const dropped = { comments: 0, textbox: 0, toc: 0, header: 0, deep: 0, images: 0, endnotes: 0, math: 0, sym: 0, fonts: new Set(), symbols: new Set() };

  // styles: each one's run look and paragraph settings, following «basedOn»
  const styles = {};
  for (const s of kids(P.styles && P.styles.documentElement, 'style')) {
    const id = s.getAttributeNS(WR_W, 'styleId') || s.getAttribute('w:styleId');
    styles[id] = { name: (val(kid(s, 'name')) || '').toLowerCase(), based: val(kid(s, 'basedOn')), rPr: kid(s, 'rPr'), pPr: kid(s, 'pPr') };
  }
  // (a paragraph without a style of its own takes the default one, «Normal» in most files)
  const defPara = kids(P.styles && P.styles.documentElement, 'style').find((s) => s.getAttributeNS(WR_W, 'type') === 'paragraph' && /^(1|true|on)$/.test(s.getAttributeNS(WR_W, 'default') || ''));
  const defParaId = defPara ? defPara.getAttributeNS(WR_W, 'styleId') || '' : '';
  const pStyleId = (p) => val(kid(kid(p, 'pPr'), 'pStyle')) || defParaId;
  const chain = (id) => { const out = []; for (let k = 0; id && styles[id] && k < 20; k++) { out.push(styles[id]); id = styles[id].based; } return out; };
  const runLook = (rPr, into = {}) => {
    if (!rPr) return into;
    for (const n of kids(rPr)) {
      const L = n.localName;
      if (L === 'b' || L === 'bCs') into.b = on(n);
      else if (L === 'i' || L === 'iCs') into.i = on(n);
      else if (L === 'u') into.u = val(n) !== 'none';
      else if (L === 'strike' || L === 'dstrike') into.s = on(n);
      else if (L === 'color') { const c = val(n); into.color = /^[0-9a-f]{6}$/i.test(c) && c.toLowerCase() !== '000000' ? c : ''; }
      else if (L === 'szCs' || (L === 'sz' && !kid(rPr, 'szCs'))) into.sz = Number(val(n)) || into.sz; // (Arabic text's own size first)
      else if (L === 'highlight') into.hi = WR_HL[val(n)] || '';
      else if (L === 'shd') { const f = n.getAttributeNS(WR_W, 'fill') || ''; if (/^[0-9a-f]{6}$/i.test(f)) into.hi = f; }
      else if (L === 'rFonts') into.font = n.getAttributeNS(WR_W, 'cs') || n.getAttributeNS(WR_W, 'ascii') || into.font;
    }
    if (into.hi && /^(f[0-9a-f]){3}$/i.test(into.hi)) into.hi = ''; // (a white or near-white shade is the page's own)
    return into;
  };
  // the look a style gives its runs (the farthest base first, so the nearer one wins)
  const styleLook = (id) => chain(id).reverse().reduce((acc, s) => runLook(s.rPr, acc), {});
  const defLook = runLook(P.styles ? kid(P.styles.getElementsByTagNameNS(WR_W, 'rPrDefault')[0], 'rPr') : null);
  const pSetting = (p, name) => {
    const own = kid(kid(p, 'pPr'), name);
    if (own) return own;
    for (const s of chain(pStyleId(p))) { const e = kid(s.pPr, name); if (e) return e; }
    return null;
  };
  // a paragraph's heading level: «heading N», «Title», or its outline level (0 is the first)
  const levelOf = (p) => {
    if (chain(pStyleId(p)).some((s) => s.name === 'toc heading')) return null; // (Word's «المحتويات» over its own contents)
    for (const s of chain(pStyleId(p))) { const m = /^heading (\d)$/.exec(s.name); if (m) return Number(m[1]); if (s.name === 'title') return 0; }
    const o = pSetting(p, 'outlineLvl');
    return o && val(o) !== '' && Number(val(o)) < 9 ? Number(val(o)) + 1 : null;
  };
  const styleName = (p) => chain(pStyleId(p)).map((s) => s.name);

  // lists: a numbered paragraph's kind from numbering.xml (a bullet, or a number), each level's first number, and the count
  // it shares (lists of one pattern count on together, as in Word, unless one starts again)
  const lists = {};
  if (P.numbering) {
    const abs = {};
    for (const a of kids(P.numbering.documentElement, 'abstractNum')) {
      const lvls = {};
      for (const l of kids(a, 'lvl')) lvls[l.getAttributeNS(WR_W, 'ilvl')] = { fmt: val(kid(l, 'numFmt')), start: Number(val(kid(l, 'start'))) || 1 };
      abs[a.getAttributeNS(WR_W, 'abstractNumId')] = lvls;
    }
    for (const n of kids(P.numbering.documentElement, 'num')) {
      const id = n.getAttributeNS(WR_W, 'numId'), aid = val(kid(n, 'abstractNumId')), lvls = { ...(abs[aid] || {}) };
      let own = false;
      for (const o of kids(n, 'lvlOverride')) {
        const k = o.getAttributeNS(WR_W, 'ilvl'), so = kid(o, 'startOverride');
        if (so) { own = true; lvls[k] = { ...(lvls[k] || { fmt: 'decimal' }), start: Number(val(so)) || 1 }; }
      }
      lists[id] = { lvls, count: own ? `n${id}` : `a${aid}` };
    }
  }
  const listOf = (p) => {
    const np = pSetting(p, 'numPr');
    if (!np) return '';
    const id = val(kid(np, 'numId'));
    if (!id || id === '0') return '';
    const L = lists[id] || { lvls: {}, count: `n${id}` }, lv = L.lvls[val(kid(np, 'ilvl')) || '0'] || { fmt: 'decimal', start: 1 };
    const kind = lv.fmt === 'bullet' ? 'ul' : lv.fmt === 'none' ? '' : 'ol';
    return kind && { kind, id: L.count, start: lv.start, lvl: Math.min(6, Number(val(kid(np, 'ilvl'))) || 0) };
  };

  // the footnotes (and endnotes, which come in as footnotes): plain text, a line for each paragraph
  const notesOf = (xmlDoc, tag) => {
    const out = {};
    if (!xmlDoc) return out;
    for (const f of xmlDoc.getElementsByTagNameNS(WR_W, tag)) {
      const id = f.getAttributeNS(WR_W, 'id');
      if (Number(id) <= 0 || f.getAttributeNS(WR_W, 'type')) continue;
      // (the number's own place marked, so only the app's «(١)» around it is taken, not a «(» the note begins with)
      out[id] = [...f.getElementsByTagNameNS(WR_W, 'p')].map((p) => [...p.getElementsByTagNameNS('*', '*')]
        .map((e) => (e.localName === 'footnoteRef' || e.localName === 'endnoteRef' ? '\u0001' : e.localName === 't' && e.parentNode.localName === 'r' ? e.textContent : e.localName === 'tab' || e.localName === 'br' ? ' ' : '')).join(''))
        .join('\n').replace(/^\s*‏?\(\s*\u0001\s*\)‏?/, '').replace(/\u0001/g, '').trim();
    }
    return out;
  };
  const feet = notesOf(P.foot, 'footnote'), ends = notesOf(P.end, 'endnote');

  // pictures: by their link in the document's relations
  const rels = {};
  if (P.rels) for (const r of P.rels.documentElement.childNodes) if (r.nodeType === 1) rels[r.getAttribute('Id')] = r.getAttribute('Target');
  const images = []; // [{ key, bytes, ext }] made smaller after the text is read

  // body size: the size most of the text is written in
  const sizeCount = {};
  const body = kid(P.doc.documentElement, 'body');
  const allParas = [...body.getElementsByTagNameNS(WR_W, 'p')];
  const effLook = (p, r) => {
    const rp = kid(r, 'rPr');
    const base = { ...defLook, ...styleLook(pStyleId(p)) };
    const ch = rp ? styleLook(val(kid(rp, 'rStyle'))) : {};
    return runLook(rp, { ...base, ...ch });
  };
  const headCount = {}; // (a heading's size is the text's only when there is nothing but headings)
  for (const p of allParas) {
    const into = levelOf(p) == null ? sizeCount : headCount;
    for (const r of p.getElementsByTagNameNS(WR_W, 'r')) {
      const t = [...r.getElementsByTagNameNS(WR_W, 't')].map((x) => x.textContent).join('');
      if (!t.trim()) continue;
      const sz = effLook(p, r).sz || 24;
      into[sz] = (into[sz] || 0) + t.length;
    }
  }
  const baseSz = Number(Object.entries(Object.keys(sizeCount).length ? sizeCount : headCount).sort((a, c) => c[1] - a[1])[0]?.[0]) || 24;

  // a paragraph → its HTML (runs, footnotes, pictures, breaks), and what it says about itself
  const esc2 = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const noteIds = {};
  let breakAfter = false;
  const runsHTML = (p, node, info) => {
    let h = '';
    for (const n of kids(node)) {
      const L = n.localName;
      if (L === 'del' || L === 'moveFrom' || L === 'pPr' || L === 'commentRangeStart' || L === 'commentRangeEnd' || L === 'proofErr' || L === 'bookmarkStart' || L === 'bookmarkEnd') continue;
      if (L === 'ins' || L === 'moveTo' || L === 'hyperlink' || L === 'smartTag' || L === 'customXml' || L === 'fldSimple' || L === 'dir' || L === 'bdo') { h += runsHTML(p, n, info); continue; }
      if (L === 'AlternateContent') { h += runsHTML(p, kid(n, 'Choice') || kid(n, 'Fallback') || n, info); continue; }
      if (L === 'oMath' || L === 'oMathPara') { // (an equation: its text kept, in one line)
        const t = [...n.getElementsByTagName('*')].filter((e) => e.localName === 't').map((e) => e.textContent).join('');
        if (t) { h += esc2(t); info.text += t; info.seen = true; info.bold.push(false); info.sizes.push(baseSz); dropped.math++; }
        continue;
      }
      if (L === 'sdt') { h += runsHTML(p, kid(n, 'sdtContent') || n, info); continue; }
      if (L !== 'r') continue;
      const look = effLook(p, n);
      let inner = '', said = '';
      for (const c of kids(n)) {
        const C = c.localName;
        if (C === 't') { inner += esc2(c.textContent); said += c.textContent; if (c.textContent.trim()) info.seen = true; }
        else if (C === 'tab' || C === 'ptab') { inner += ' '; said += ' '; }
        else if (C === 'br' || C === 'cr') {
          // (a page break before any of the paragraph's text goes before it, else after it)
          if (C === 'br' && /^(page|column)$/.test(c.getAttributeNS(WR_W, 'type'))) { if (info.seen) breakAfter = true; else info.breakBefore = true; }
          else { inner += '<br>'; said += ' '; }
        } else if (C === 'sym') { // (a symbol from a font: kept when it is a letter of its own, not a picture of the font's)
          const ch = parseInt(c.getAttributeNS(WR_W, 'char') || '', 16);
          if (ch && !(ch >= 0xe000 && ch <= 0xf8ff)) { const t = String.fromCodePoint(ch); inner += esc2(t); said += t; info.seen = true; }
          else { dropped.sym++; dropped.symbols.add(c.getAttributeNS(WR_W, 'font') || ''); }
        }
        else if (C === 'footnoteReference' || C === 'endnoteReference') {
          const id = c.getAttributeNS(WR_W, 'id'), text = C === 'footnoteReference' ? feet[id] : ends[id];
          if (text == null) continue;
          if (C === 'endnoteReference') dropped.endnotes++;
          const nid = uid(); noteIds[nid] = text; info.notes++;
          inner += `<sup class="fn" data-fn="${nid}">*</sup>`;
        } else if (C === 'drawing' || C === 'pict' || C === 'object' || C === 'AlternateContent') {
          if (c.getElementsByTagNameNS(WR_W, 'txbxContent').length) { dropped.textbox++; continue; }
          const blip = c.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')[0];
          const vimg = [...c.getElementsByTagName('*')].find((e) => e.localName === 'imagedata');
          const rid = blip ? blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') : vimg ? vimg.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') : '';
          const target = rels[rid] && `word/${rels[rid].replace(/^\.?\//, '').replace(/^word\//, '')}`;
          if (target && P.files[target]) { // (one picture used again is made smaller once)
            let im = images.find((x) => x.target === target);
            if (!im) { im = { key: `wrimg${images.length}`, target, bytes: P.files[target], ext: (target.split('.').pop() || '').toLowerCase() }; images.push(im); }
            inner += `<img data-key="${im.key}">`; info.images++;
          }
          else dropped.images++;
        }
      }
      if (!inner) continue;
      info.text += said;
      // (a run of spaces only, or of a footnote's mark only, says nothing of the line's boldness or size)
      if (said.trim()) { info.bold.push(!!look.b); info.sizes.push(look.sz || baseSz); }
      // the look kept: marks, a colour, a highlight, a font of the app's, a size apart from the text's
      let open = '', close = '';
      const wrap = (tag) => { open += `<${tag}>`; close = `</${tag}>${close}`; };
      if (look.b) wrap('b');
      if (look.i) wrap('i');
      if (look.u) wrap('u');
      if (look.s) wrap('s');
      const st = [];
      if (look.color) st.push(`color:#${look.color}`);
      if (look.hi) st.push(`background-color:#${look.hi}`);
      const f = (look.font || '').trim();
      if (f && WR_FONT_SET.has(f)) { if (f !== 'Amiri') st.push(`font-family:'${f}'`); } else if (f) dropped.fonts.add(f);
      const em = look.sz ? Math.round((look.sz / baseSz) * 100) / 100 : 1;
      if (em !== 1 && em >= 0.5 && em <= 4) st.push(`font-size:${em}em`);
      if (st.length) { open += `<span style="${st.join(';')}">`; close = `</span>${close}`; }
      h += open + inner + close;
    }
    return h;
  };

  // the blocks of the body, in order: paragraphs, tables, page breaks
  const blocks = [];
  const jcOf = (p) => {
    const j = val(pSetting(p, 'jc')); const bidiEl = pSetting(p, 'bidi'); const rtl = bidiEl ? on(bidiEl) : true;
    if (j === 'center') return 'center';
    if (j === 'both' || j === 'distribute' || !j) return '';
    const start = j === 'start' || (rtl ? j === 'left' : j === 'right');
    return rtl ? (start ? 'right' : 'left') : (start ? 'left' : 'right');
  };
  const paraBlock = (p) => {
    const info = { text: '', bold: [], sizes: [], notes: 0, images: 0 };
    breakAfter = false;
    if (styleName(p).some((n) => /^toc( \d| heading)$/.test(n))) { dropped.toc++; return; } // (Word's own contents, and its heading)
    if (pSetting(p, 'pageBreakBefore') && on(pSetting(p, 'pageBreakBefore'))) blocks.push({ kind: 'break' });
    let html = runsHTML(p, p, info);
    if (info.breakBefore) blocks.push({ kind: 'break' });
    html = html.replace(/‏\(\s*(<sup class="fn"[^>]*>\*<\/sup>)\s*\)‏/g, '$1'); // (the app's own «(١)»)
    const names = styleName(p);
    blocks.push({
      kind: 'p', html, text: info.text.replace(/\s+/g, ' ').trim(), level: levelOf(p), list: listOf(p), jc: jcOf(p),
      bold: info.bold.length > 0 && info.bold.every(Boolean), size: Math.max(0, ...info.sizes),
      ayah: names.includes('ayah'), quote: names.some((n) => /quote|اقتباس/.test(n)), empty: !info.text.trim() && !info.notes && !info.images,
    });
    if (breakAfter || kid(kid(p, 'pPr'), 'sectPr')) blocks.push({ kind: 'break' });
  };
  const tableBlock = (tbl) => {
    let h = '<table class="wr-tbl"><tbody>', text = '';
    // (a cell's paragraphs, and a table inside it as lines of its own, so none of its text is lost)
    const cellParas = (node, out) => {
      for (const n of kids(node)) {
        if (n.localName === 'p') {
          const info = { text: '', bold: [], sizes: [], notes: 0, images: 0 };
          out.push(`<p>${runsHTML(n, n, info) || '<br>'}</p>`); text += ` ${info.text}`;
        } else if (n.localName === 'tbl') { for (const tr of kids(n, 'tr')) for (const tc of kids(tr, 'tc')) cellParas(tc, out); }
        else if (n.localName === 'sdt') cellParas(kid(n, 'sdtContent') || n, out);
        else if (n.localName === 'customXml') cellParas(n, out);
      }
      return out;
    };
    for (const tr of kids(tbl, 'tr')) {
      h += '<tr>';
      for (const tc of kids(tr, 'tc')) h += `<td>${cellParas(tc, []).join('') || '<br>'}</td>`;
      h += '</tr>';
    }
    blocks.push({ kind: 'table', html: `${h}</tbody></table>`, text: text.replace(/\s+/g, ' ').trim() });
  };
  const walk = (node) => {
    for (const n of kids(node)) {
      if (n.localName === 'p') paraBlock(n);
      else if (n.localName === 'tbl') tableBlock(n);
      else if (n.localName === 'sdt') {
        const gal = [...n.getElementsByTagNameNS(WR_W, 'docPartGallery')].map(val).join(' ');
        const instr = [...n.getElementsByTagNameNS(WR_W, 'instrText')].map((x) => x.textContent).join(' ');
        if (/Table of Contents/i.test(gal) || /\bTOC\b/.test(instr)) { dropped.toc++; continue; } // (Word's own contents: the app makes its own)
        walk(kid(n, 'sdtContent') || n);
      } else if (n.localName === 'customXml') walk(n);
    }
  };
  walk(body);
  dropped.comments = P.doc.getElementsByTagNameNS(WR_W, 'commentReference').length;
  dropped.header = (P.rels ? [...P.rels.documentElement.childNodes].filter((r) => r.nodeType === 1 && /\/(header|footer)$/.test(r.getAttribute('Type') || '')).length : 0) ? 1 : 0;

  // chapters: at «heading 1» (or a style based on it, or the outline's first level); without one, at the short bold lines in
  // the largest size that comes more than once (the book's own title once in a larger size is its title)
  const paras = blocks.filter((b) => b.kind === 'p' && !b.empty);
  let isChapter, isSub;
  if (paras.some((b) => b.level === 1)) {
    isChapter = (b) => b.level === 1;
    isSub = (b) => (b.level >= 2 ? b.level : 0);
  } else {
    const cand = paras.filter((b) => b.bold && b.text.split(' ').length <= 12 && b.size >= baseSz * 1.1);
    const tiers = {};
    for (const b of cand) tiers[b.size] = (tiers[b.size] || 0) + 1;
    const sizes = Object.keys(tiers).map(Number).filter((s) => tiers[s] >= 2).sort((a, c) => c - a);
    const top = sizes[0], next = sizes[1];
    isChapter = (b) => top && b.kind === 'p' && cand.includes(b) && b.size === top;
    isSub = (b) => (next && cand.includes(b) && b.size === next ? 2 : 0);
  }
  // the book's title: a «Title» paragraph, else the largest line before the first chapter, else the file's name
  const firstCh = blocks.findIndex((b) => b.kind === 'p' && isChapter(b));
  const front = (firstCh < 0 ? [] : blocks.slice(0, firstCh)).filter((b) => b.kind === 'p' && !b.empty);
  const titleBlock = blocks.find((b) => b.kind === 'p' && b.level === 0 && b.text) || (front.length ? front.slice().sort((a, c) => c.size - a.size)[0] : null);
  const title = (titleBlock && titleBlock.text) || file.name.replace(/\.(docx|dotx)$/i, '');
  const chapters = [];
  let cur = null; // (a short line just before a chapter's title, «الباب الأول», joins it)
  const blockHTML = (b) => {
    if (b.kind === 'break') return '<div class="pgbreak">فاصل صفحة</div>';
    if (b.kind === 'table') return b.html;
    const sub = isSub(b);
    // (a heading's or a verse box's own look is the editor's: the bold and the size that made it one are not carried)
    const plain = (h) => h.replace(/<\/?b>/g, '').replace(/font-size:[^;"]+;?/g, '').replace(/ style=""/g, '');
    if (sub) { if (sub > 3) dropped.deep++; return `<${sub === 2 ? 'h2' : 'h3'}>${plain(b.html)}</${sub === 2 ? 'h2' : 'h3'}>`; }
    const style = b.jc ? ` style="text-align:${b.jc}"` : '';
    if (b.ayah) return `<p class="ayah"${style}>${plain(b.html)}</p>`;
    if (b.quote) return `<blockquote${style}>${b.html}</blockquote>`;
    return `<p${style}>${b.html || '<br>'}</p>`;
  };
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k];
    if (b.kind === 'p' && isChapter(b)) {
      // the short line before it, after the last break (only empty lines between), is part of its title
      let j = k - 1; while (j >= 0 && blocks[j].kind === 'p' && blocks[j].empty) j--;
      let lead = '';
      const at = cur ? cur.items.lastIndexOf(blocks[j]) : -1;
      if (j >= 0 && blocks[j].kind === 'p' && !isChapter(blocks[j]) && blocks[j].text.split(' ').length <= 4 && blocks[j].jc === 'center' && at >= 0 && cur.items.slice(at + 1).every((x) => x.kind === 'p' && x.empty)) {
        let i2 = j - 1; while (i2 >= 0 && blocks[i2].kind === 'p' && blocks[i2].empty) i2--;
        if (i2 < 0 || blocks[i2].kind === 'break') { lead = blocks[j].text; cur.items.splice(cur.items.indexOf(blocks[j]), 1); }
      }
      cur = { title: lead ? `${lead}: ${b.text}` : b.text, items: [] };
      chapters.push(cur);
      // (a footnote or a picture on the title itself opens the chapter's text, so it is not lost)
      const keep = (b.html.match(/<sup class="fn"[^>]*>\*<\/sup>|<img data-key="[^"]+">/g) || []).join(' ');
      if (keep) cur.items.push({ kind: 'p', html: keep, text: '', jc: '', empty: false });
      continue;
    }
    if (b === titleBlock) continue; // (the book's title is its name, not a line of it)
    // (what comes before the first chapter is a chapter of its own, «بداية الكتاب»)
    if (!cur) { cur = { title: 'بداية الكتاب', items: [] }; chapters.push(cur); }
    cur.items.push(b);
  }
  // each chapter's HTML: lists gathered (a list's numbers carried on after a break in it, a deeper level a list of its own,
  // indented), no break or empty line at its edges, one empty line at most in a row
  const counts = {};
  for (const c of chapters) {
    const items = c.items.slice();
    while (items.length && (items[0].kind === 'break' || (items[0].kind === 'p' && items[0].empty))) items.shift();
    while (items.length && (items[items.length - 1].kind === 'break' || (items[items.length - 1].kind === 'p' && items[items.length - 1].empty))) items.pop();
    let h = '', list = '', lastEmpty = false;
    for (const b of items) {
      if (b.kind === 'p' && b.list && !isSub(b)) {
        const L = b.list, key = `${L.kind}|${L.id}|${L.lvl}`, cn = counts[L.id] || (counts[L.id] = []);
        cn[L.lvl] = (cn[L.lvl] || L.start - 1) + 1; cn.length = L.lvl + 1;
        if (list !== key) {
          if (list) h += `</${list.split('|')[0]}>`;
          h += L.kind === 'ol' && cn[L.lvl] !== 1 ? `<ol start="${cn[L.lvl]}">` : `<${L.kind}>`; list = key;
        }
        h += `<li${L.lvl ? ` data-ind="${L.lvl}"` : ''}>${b.html}</li>`; lastEmpty = false; continue;
      }
      if (list) { h += `</${list.split('|')[0]}>`; list = ''; }
      if (b.kind === 'p' && b.empty) { if (lastEmpty) continue; lastEmpty = true; } else lastEmpty = false;
      h += blockHTML(b);
    }
    if (list) h += `</${list.split('|')[0]}>`;
    c.html = h;
    c.words = wrWords(c.items.filter((b) => b.kind !== 'break').map((b) => b.text || '').join(' '));
    c.notes = {};
    for (const m of h.matchAll(/data-fn="([^"]+)"/g)) c.notes[m[1]] = noteIds[m[1]];
    delete c.items;
  }
  // a chapter with nothing in it (Word's «المحتويات» before its own contents) is not brought in
  const empty = chapters.filter((c) => !c.words && !/<(img|table)/.test(c.html));
  for (const c of empty) chapters.splice(chapters.indexOf(c), 1);
  dropped.emptyChapters = empty.map((c) => c.title);
  // the pictures, made smaller (1200 points wide at most) and kept in the text
  const srcs = {};
  for (const im of images) {
    let src = '';
    try {
      const type = im.ext === 'png' ? 'image/png' : im.ext === 'gif' ? 'image/gif' : im.ext === 'bmp' ? 'image/bmp' : im.ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const url = URL.createObjectURL(new Blob([im.bytes], { type }));
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 1200 / img.naturalWidth), w = Math.round(img.naturalWidth * k), hh = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.drawImage(img, 0, 0, w, hh);
      URL.revokeObjectURL(url);
      src = `<img src="${cv.toDataURL('image/jpeg', 0.85)}" data-w="${w}" data-h="${hh}" alt="">`;
    } catch { dropped.images++; }
    srcs[im.key] = src;
  }
  if (images.length) for (const c of chapters) c.html = c.html.replace(/<img data-key="(wrimg\d+)">/g, (x, k) => srcs[k] || '');
  return { title, chapters, dropped: { ...dropped, fonts: [...dropped.fonts], symbols: [...dropped.symbols].filter(Boolean) } };
}

// ---------- the preview, then the book ----------
async function wrImport(file) {
  const busy = { busy: true, name: file.name };
  wrUi.imp = busy;
  render();
  try {
    const r = await wrFromDocx(file);
    if (wrUi.imp !== busy) return; // («رجوع» while it read: nothing to show)
    if (!r.chapters.length) throw new Error('empty');
    wrUi.imp = { ...r, keep: r.chapters.map(() => true), name: file.name };
  } catch (e) {
    if (wrUi.imp !== busy) return;
    wrUi.imp = { err: e.message === 'old' ? 'هذا ملف وورد قديم (‎.doc‎) أو مقفل بكلمة سر. افتحه في وورد أو مستندات قوقل واحفظه بصيغة ‎.docx‎ ثم أدخله.'
      : e.message === 'notword' ? 'هذا ليس ملف وورد (‎.docx‎).' : e.message === 'empty' ? 'لم يُوجد في الملف نص.' : 'تعذّرت قراءة الملف.', name: file.name };
  }
  render();
}
// a chapter unticked joins the one before it (its title a sub-heading in it)
function wrImpChapters(imp) {
  const out = [];
  imp.chapters.forEach((c, i) => {
    if (imp.keep[i] || !out.length) out.push({ title: c.title, html: c.html, notes: { ...c.notes }, words: c.words });
    else { const p = out[out.length - 1]; p.html += `<h2>${esc(c.title)}</h2>${c.html}`; Object.assign(p.notes, c.notes); p.words += c.words; }
  });
  return out;
}
function wrImpHTML() {
  const m = wrUi.imp;
  const head = `${moreCrumb()}<div class="crumbs"><button type="button" class="back" data-action="wr-imp-x">${icon('back')} ${esc(pageName('writing'))}</button></div>`;
  if (m.busy) return `${head}<section class="panel"><h2>إدخال كتاب من وورد</h2><p class="note-text"><span class="spin"></span> يقرأ «${esc(m.name)}»…</p></section>`;
  if (m.err) return `${head}<section class="panel"><h2>إدخال كتاب من وورد</h2><p class="warn-box">${esc(m.err)}</p><button type="button" class="ghost" data-action="wr-imp-x">رجوع</button></section>`;
  const chs = wrImpChapters(m), d = m.dropped;
  const notes = chs.reduce((n, c) => n + Object.keys(c.notes).length, 0);
  const imgs = chs.reduce((n, c) => n + (c.html.match(/<img /g) || []).length, 0);
  const tbls = chs.reduce((n, c) => n + (c.html.match(/<table/g) || []).length, 0);
  const size = chs.reduce((n, c) => n + c.html.length, 0);
  const gone = [
    d.toc && 'فهرس وورد الآلي (يصنع التطبيق فهرسه)',
    d.emptyChapters.length && `فصل بلا نص: ${d.emptyChapters.map((t) => `«${esc(t)}»`).join('، ')}`,
    d.header && 'رأس الصفحة وتذييلها',
    d.comments && `التعليقات: ${wrNum(d.comments)}`,
    d.textbox && `مربعات النص: ${wrNum(d.textbox)}`,
    d.images && `صور لم تُقرأ: ${wrNum(d.images)}`,
    d.deep && 'عناوين أعمق من «فرعي» صارت «فرعي»',
    d.endnotes && `الحواشي الختامية صارت حواشي سفلية: ${wrNum(d.endnotes)}`,
    d.fonts.length && `خطوط ليست في التطبيق صارت خط المحرر: ${d.fonts.map(esc).join('، ')}`,
    d.sym && `رموز من خطوط خاصة لا تُقرأ حروفاً: ${wrNum(d.sym)}${d.symbols.length ? ` (${d.symbols.map(esc).join('، ')})` : ''}`,
    d.math && `المعادلات صارت نصاً في سطر: ${wrNum(d.math)}`,
    'الغامق والمائل داخل الحاشية، وتباعد الأسطر وإزاحة أول السطر',
  ].filter(Boolean);
  return `${head}
  <section class="panel">
    <h2>إدخال كتاب من وورد</h2>
    <label class="field"><span>عنوان الكتاب</span><input id="wrImpTitle" value="${esc(m.title)}" autocomplete="off"></label>
    <p class="book-line">الفصول: ${chs.length} | الكلمات: ${chs.reduce((n, c) => n + c.words, 0)} | الحواشي: ${notes} | الصور: ${imgs} | الجداول: ${tbls}</p>
    ${size > 9e6 ? '<p class="warn-box">الكتاب أكبر من أن يُرفع إلى السحابة (صوره كثيرة)؛ يبقى في جوالك وفي النسخة الاحتياطية.</p>' : ''}
    <h3>الفصول</h3>
    <p class="note-text">ألغِ علامة الفصل الذي ليس فصلاً فيُضمّ إلى ما قبله ويصير عنوانه عنواناً فرعياً فيه.</p>
    <div class="wr-imp-chs">${m.chapters.map((c, i) => `<label class="wr-imp-ch"><input type="checkbox" data-wr-imp="${i}"${m.keep[i] ? ' checked' : ''}${i ? '' : ' disabled'}><span><b>${esc(c.title)}</b><small>الكلمات: ${c.words}${Object.keys(c.notes).length ? ` | الحواشي: ${Object.keys(c.notes).length}` : ''}</small></span></label>`).join('')}</div>
    <h3>لم يُدخل</h3>
    <ul class="wr-imp-gone">${gone.map((g) => `<li>${g}</li>`).join('')}</ul>
    <div class="btn-row"><button type="button" class="primary" data-action="wr-imp-go">أدخله</button><button type="button" class="ghost" data-action="wr-imp-x">إلغاء</button></div>
  </section>`;
}
document.addEventListener('input', (e) => { if (e.target.id === 'wrImpTitle' && wrUi.imp && wrUi.imp.chapters) wrUi.imp.title = e.target.value; });
document.addEventListener('change', (e) => {
  if (e.target.id === 'wrDocxIn' && e.target.files && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ''; wrImport(f); }
  else if (e.target.dataset && e.target.dataset.wrImp != null && wrUi.imp && wrUi.imp.keep) { wrUi.imp.keep[Number(e.target.dataset.wrImp)] = e.target.checked; render(); }
});
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action^="wr-imp"]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'wr-imp-pick') { $('wrDocxIn').click(); return; }
  if (a === 'wr-imp-x') { wrUi.imp = null; render(); return; }
  if (a === 'wr-imp-go' && wrUi.imp && wrUi.imp.chapters) {
    const m = wrUi.imp, title = ($('wrImpTitle') || {}).value || m.title;
    const b = normalizeWBook({ kind: 'book', title: title.trim(), chapters: wrImpChapters(m).map((c) => ({ title: c.title, html: wrSafe(c.html), notes: c.notes })) });
    wrUi.list.unshift(b);
    wrSave(b, 3000);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
    wrUi.imp = null; wrUi.book = b.id;
    render(); window.scrollTo(0, 0);
    toast(`أُدخل الكتاب: ${b.chapters.length} ${b.chapters.length === 1 ? 'فصل' : 'فصول'}`);
  }
});
