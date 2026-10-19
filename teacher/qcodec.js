'use strict';
// Packs a test (or a student's answers) into a short text that fits in a link or a WhatsApp
// message, and back. Shared by the teacher's app and the students' page (q.html).

const QCodec = (() => {
  const b64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (s) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(t, (c) => c.charCodeAt(0)); };
  const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  async function pack(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === 'undefined') return `j${b64(bytes)}`;
    return `z${b64(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  }
  async function unpack(s) {
    s = String(s || '').trim();
    const kind = s[0], body = unb64(s.slice(1));
    const bytes = kind === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  // the right answers of a test and one student's answers → how many are right
  const score = (qs, answers) => qs.reduce((n, q, i) => n + (answers[i] !== undefined && answers[i] !== null && answers[i] === q[3] ? 1 : 0), 0);
  return { pack, unpack, score };
})();
