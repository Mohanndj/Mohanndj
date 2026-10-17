'use strict';
// Minimal Excel (.xlsx) reader, in the browser and offline: unzips with DecompressionStream and
// returns each sheet's cell values (cached results for formulas). Enough to import a workbook.

const XlsxRead = (() => {
  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }

  // the zip's central directory → { name: Uint8Array }
  // (the parts of an Excel file by default; a Word file's text is asked for by name)
  async function unzip(buf, want = /^xl\/(workbook\.xml|sharedStrings\.xml|worksheets\/[^/]+\.xml|_rels\/workbook\.xml\.rels)$/) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const files = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
      p += 46 + nlen + xlen + clen;
      if (!want.test(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const raw = new Uint8Array(buf, start, csize);
      files[name] = method === 8 ? await inflate(raw) : method === 0 ? raw : null;
    }
    return files;
  }

  const colNum = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

  async function read(file) {
    if (typeof DecompressionStream === 'undefined') throw new Error('unsupported');
    const files = await unzip(await file.arrayBuffer());
    const dec = new TextDecoder();
    const xml = (name) => (files[name] ? new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml') : null);
    const text = (el) => [...el.getElementsByTagName('t')].map((t) => t.textContent).join('');
    const shared = [];
    const ss = xml('xl/sharedStrings.xml');
    if (ss) for (const si of ss.getElementsByTagName('si')) shared.push(text(si));
    const rels = {};
    const rx = xml('xl/_rels/workbook.xml.rels');
    if (rx) for (const r of rx.getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target').replace(/^\/?(xl\/)?/, 'xl/');
    const wb = xml('xl/workbook.xml');
    const sheets = [];
    for (const s of wb ? wb.getElementsByTagName('sheet') : []) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const doc = xml(rels[rid]);
      if (!doc) continue;
      const cells = new Map();
      for (const c of doc.getElementsByTagName('c')) {
        const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute('r') || '');
        if (!m) continue;
        const t = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0];
        let val = null;
        if (t === 's' && v) val = shared[Number(v.textContent)] ?? '';
        else if (t === 'inlineStr') val = text(c);
        else if (t === 'str' || t === 'e') val = v ? v.textContent : '';
        else if (t === 'b') val = v ? v.textContent === '1' : null;
        else if (v && v.textContent !== '') val = Number(v.textContent);
        if (val === null || val === '' || (typeof val === 'number' && !Number.isFinite(val))) continue;
        cells.set(`${Number(m[2])},${colNum(m[1])}`, typeof val === 'string' ? val.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').trim() : val); // lines inside a cell stay lines
      }
      sheets.push({ name: s.getAttribute('name'), cells, get: (r, c) => cells.get(`${r},${c}`) });
    }
    return sheets;
  }

  return { read, unzip };
})();
