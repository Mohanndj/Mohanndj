'use strict';
// «الإلهام»: motivational phrases, affirmations and photos.
// Photos are resized on the phone and kept in IndexedDB (localStorage is too small for them).

const QUOTE_KIND = { motivation: 'عبارة تحفيزية', affirmation: 'عبارة توكيدية' };
const inspUi = { filter: 'all' };

function normalizeInspire(x) {
  return {
    id: x.id || uid(), type: ['motivation', 'affirmation', 'image'].includes(x.type) ? x.type : 'motivation',
    text: String(x.text || ''), source: String(x.source || ''), imageId: x.imageId || '',
    fav: !!x.fav, created: x.created || Date.now(),
  };
}

// ---------- image store ----------
const Media = (() => {
  let dbp = null;
  const urls = new Map();
  function db() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('mahami-media', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('images');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('images', mode);
      const req = fn(t.objectStore('images'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    put: (id, blob) => tx('readwrite', (s) => s.put(blob, id)),
    del: (id) => { if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } return tx('readwrite', (s) => s.delete(id)); },
    async url(id) {
      if (urls.has(id)) return urls.get(id);
      const blob = await tx('readonly', (s) => s.get(id));
      if (!blob) return '';
      const u = URL.createObjectURL(blob);
      urls.set(id, u);
      return u;
    },
  };
})();

// resize to at most 1600 px on the long side, JPEG ~85%
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1600;
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('decode')); };
    img.src = src;
  });
}

async function addImages(files) {
  let n = 0;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    try {
      const blob = await shrinkImage(f);
      const imageId = uid();
      await Media.put(imageId, blob);
      S.inspire.push(normalizeInspire({ type: 'image', imageId }));
      n++;
    } catch { toast('تعذّر فتح إحدى الصور.'); }
  }
  if (n) { save(); render(); toast(n === 1 ? 'أُضيفت الصورة' : `أُضيفت ${n} صور`); }
}

// fill <img data-img="id"> after each render
async function hydrateImages(root = document) {
  for (const img of root.querySelectorAll('img[data-img]')) {
    const id = img.dataset.img;
    try {
      const u = await Media.url(id);
      if (u && img.dataset.img === id) img.src = u;
      else if (!u) img.closest('.photo')?.classList.add('missing');
    } catch {}
  }
}

// ---------- phrase of the day ----------
function quoteOfDay() {
  const qs = S.inspire.filter((x) => x.type !== 'image' && x.text);
  if (!qs.length) return null;
  const n = Math.floor(parse(today()).getTime() / 86400000);
  const favs = qs.filter((x) => x.fav);
  const pool = favs.length && n % 2 ? favs : qs; // favourites come up more often
  return pool[n % pool.length];
}

function dailyQuoteHTML() {
  const q = quoteOfDay();
  if (!q) return '';
  return `<button type="button" class="daily-quote" data-tab="inspire">
    <small>${icon('spark')} عبارة اليوم</small>
    <q>${esc(q.text)}</q>
    ${q.source ? `<cite>${esc(q.source)}</cite>` : ''}
  </button>`;
}

// ---------- page ----------
function quoteCard(x) {
  return `<button type="button" class="quote-card k-${x.type}" data-action="insp-open" data-v="${x.id}">
    <small>${QUOTE_KIND[x.type]}${x.fav ? ' · ' + icon('star') : ''}</small>
    <q>${esc(x.text)}</q>
    ${x.source ? `<cite>${esc(x.source)}</cite>` : ''}
  </button>`;
}

function viewInspire() {
  const f = inspUi.filter;
  const counts = {
    all: S.inspire.length,
    motivation: S.inspire.filter((x) => x.type === 'motivation').length,
    affirmation: S.inspire.filter((x) => x.type === 'affirmation').length,
    image: S.inspire.filter((x) => x.type === 'image').length,
  };
  const seg = [['all', 'الكل'], ['motivation', 'تحفيزية'], ['affirmation', 'توكيدية'], ['image', 'صور']]
    .map(([v, l]) => `<button type="button" data-action="insp-filter" data-v="${v}" aria-pressed="${f === v}">${l} <span class="num">${counts[v]}</span></button>`).join('');
  const sorted = S.inspire.slice().sort((a, b) => b.fav - a.fav || b.created - a.created);
  const quotes = sorted.filter((x) => x.type !== 'image' && (f === 'all' || f === x.type));
  const photos = sorted.filter((x) => x.type === 'image' && (f === 'all' || f === 'image'));
  const q = quoteOfDay();
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الإلهام</h2>
      <div class="btn-row">${counts.motivation + counts.affirmation ? xlsBtn('inspire') : ''}${addBtn('insp-new', 'عبارة')}${addBtn('insp-photo', 'صورة')}</div></div>
    <input type="file" id="inspFile" accept="image/*" multiple hidden>
    ${q && f === 'all' ? `<div class="daily-quote big"><small>${icon('spark')} عبارة اليوم</small><q>${esc(q.text)}</q>${q.source ? `<cite>${esc(q.source)}</cite>` : ''}</div>` : ''}
    ${S.inspire.length ? `<div class="seg seg-wrap" role="group" aria-label="عرض">${seg}</div>` : ''}
    ${quotes.length ? `<div class="quote-list">${quotes.map(quoteCard).join('')}</div>` : ''}
    ${photos.length ? `<div class="photo-grid">${photos.map((x) => `<button type="button" class="photo" data-action="insp-view" data-v="${x.id}" aria-label="${esc(x.text || 'صورة')}"><img data-img="${x.imageId}" alt="${esc(x.text || '')}">${x.fav ? `<span class="fav">${icon('star')}</span>` : ''}</button>`).join('')}</div>` : ''}
    ${!quotes.length && !photos.length ? (S.inspire.length
      ? emptyHTML('لا شيء هنا', 'اختر تبويباً آخر أو أضف جديداً.')
      : emptyHTML('مكان لما يلهمك', 'أضف عبارات تحفيزية تدفعك للعمل، وعبارات توكيدية تكررها لنفسك مثل «أنا قادر على الالتزام»، وصوراً لأهدافك. تظهر لك «عبارة اليوم» في الصفحة الرئيسية.',
        `<div class="btn-row">${addBtn('insp-new', 'أول عبارة')}${addBtn('insp-photo', 'صورة')}</div>`)) : ''}
    ${counts.image ? '<p class="note-text">الصور محفوظة على هذا الجهاز فقط، ولا تدخل في ملف النسخة الاحتياطية.</p>' : ''}
  </section>`;
}

// ---------- editors ----------
function openQuote(id, type) {
  const x = id ? S.inspire.find((i) => i.id === id) : normalizeInspire({ type: type || (inspUi.filter === 'affirmation' ? 'affirmation' : 'motivation') });
  const f = $('libForm');
  ldraft = { kind: 'quote', id: x.id, isNew: !id, type: x.type };
  f.innerHTML = `
    <div class="sheet-head"><h2>${id ? 'تعديل العبارة' : 'عبارة جديدة'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="seg" id="qType">${['motivation', 'affirmation'].map((k) => `<button type="button" data-action="insp-type" data-v="${k}" aria-pressed="${x.type === k}">${k === 'motivation' ? 'تحفيزية' : 'توكيدية'}</button>`).join('')}</div>
    <label class="field"><span>العبارة</span><textarea id="qText" rows="4" placeholder="${x.type === 'affirmation' ? 'مثال: أنا أستحق النجاح وأعمل له كل يوم' : 'مثال: ابدأ من حيث أنت، واستخدم ما لديك'}">${esc(x.text)}</textarea></label>
    <label class="field"><span>القائل أو المصدر (اختياري)</span><input type="text" id="qSource" value="${esc(x.source)}" autocomplete="off"></label>
    <label class="switch"><input type="checkbox" id="qFav"${x.fav ? ' checked' : ''}><span>مفضّلة (تظهر أكثر في «عبارة اليوم»)</span></label>
    <div class="sheet-actions">
      <button type="submit" class="primary">حفظ</button>
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  setTimeout(() => { if (!id) $('qText').focus(); }, 60);
}

function saveQuote() {
  const text = $('qText').value.trim();
  if (!text) { toast('اكتب العبارة.'); $('qText').focus(); return false; }
  const old = S.inspire.find((i) => i.id === ldraft.id);
  const x = normalizeInspire({ ...(old || {}), id: ldraft.id, type: ldraft.type, text, source: $('qSource').value.trim(), fav: $('qFav').checked });
  if (old) Object.assign(old, x); else S.inspire.push(x);
  save();
  return true;
}

// full-screen photo viewer
let viewing = null;
async function openViewer(id) {
  const x = S.inspire.find((i) => i.id === id);
  if (!x) return;
  viewing = id;
  const d = $('viewer');
  $('vImg').removeAttribute('src');
  $('vCaption').value = x.text;
  $('vFav').setAttribute('aria-pressed', String(x.fav));
  $('vDel').classList.remove('armed');
  $('vDel').textContent = 'حذف';
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  $('vImg').src = await Media.url(x.imageId);
}
function closeViewer() {
  if (viewing) {
    const x = S.inspire.find((i) => i.id === viewing);
    if (x && x.text !== $('vCaption').value.trim()) { x.text = $('vCaption').value.trim(); save(); }
  }
  viewing = null;
  const d = $('viewer');
  if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
  render();
}

// ---------- events ----------
let inspArmed = false;
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="insp-"], [data-vaction]');
  if (!el) return;
  const { action, v, vaction } = el.dataset;
  if (vaction) {
    const x = S.inspire.find((i) => i.id === viewing);
    if (vaction === 'close') closeViewer();
    if (vaction === 'fav' && x) { x.fav = !x.fav; save(); $('vFav').setAttribute('aria-pressed', String(x.fav)); }
    if (vaction === 'delete' && x) {
      const b = $('vDel');
      if (!inspArmed) {
        inspArmed = true; b.classList.add('armed'); b.textContent = 'تأكيد الحذف';
        setTimeout(() => { inspArmed = false; if (b.isConnected) { b.classList.remove('armed'); b.textContent = 'حذف'; } }, 3000);
        return;
      }
      inspArmed = false;
      Media.del(x.imageId).catch(() => {});
      S.inspire = S.inspire.filter((i) => i.id !== x.id);
      save();
      viewing = null;
      closeViewer();
      toast('حُذفت الصورة');
    }
    return;
  }
  switch (action) {
    case 'insp-filter': inspUi.filter = v; render(); break;
    case 'insp-new': openQuote(null); break;
    case 'insp-open': openQuote(v); break;
    case 'insp-photo': $('inspFile').click(); break;
    case 'insp-view': openViewer(v); break;
    case 'insp-type':
      ldraft.type = v;
      for (const b of $('qType').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      break;
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'inspFile' && e.target.files.length) { addImages([...e.target.files]); e.target.value = ''; }
});

Object.assign(LibraryViews, { inspire: viewInspire });
