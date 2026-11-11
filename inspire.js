'use strict';
// «الإلهام»: motivational phrases, affirmations and photos.
// Photos are resized on the phone and kept in IndexedDB (localStorage is too small for them).

const QUOTE_KIND = { motivation: 'عبارة تحفيزية', affirmation: 'عبارة توكيدية' };
const inspUi = { filter: 'all', aff: null };

function normalizeInspire(x) {
  return {
    id: x.id || uid(), type: ['motivation', 'affirmation', 'image'].includes(x.type) ? x.type : 'motivation',
    text: String(x.text || ''), source: String(x.source || ''), imageId: x.imageId || '',
    fav: !!x.fav, created: x.created || Date.now(), tab: String(x.tab || ''),
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
        // «حذف كل البيانات» deletes the store: this open connection lets go of it (else the deletion waited, and media
        // saved after it was lost at the next start), and what was shown from it is let go too
        r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); }; res(d); };
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

// shown until the user adds phrases of their own
const STARTER_QUOTES = [
  { text: 'قليلٌ دائم خيرٌ من كثيرٍ منقطع.', source: '' },
  { text: 'إنّ الله يحب إذا عمل أحدكم عملاً أن يتقنه.', source: 'حديث شريف' },
  { text: 'ابدأ من حيث أنت، واستعمل ما لديك، وافعل ما تستطيع.', source: '' },
  { text: 'أنا قادر على إنجاز ما خططت له اليوم، خطوةً خطوة.', source: '' },
  { text: 'كل يوم أقترب من أهدافي بعمل صغير لا أتركه.', source: '' },
  { text: 'من سار على الدرب وصل.', source: '' },
  { text: 'النجاح مجموع جهود صغيرة تتكرر كل يوم.', source: '' },
  { text: 'احرص على ما ينفعك، واستعن بالله ولا تعجز.', source: 'حديث شريف' },
  { text: 'أنا أستحق الخير، وأسعى إليه بثقة وهدوء.', source: '' },
  { text: 'ما لا يُدرك كلّه لا يُترك جُلّه.', source: '' },
];
function dailyQuoteHTML() {
  let q = quoteOfDay();
  const starter = !q;
  if (starter) q = STARTER_QUOTES[Math.floor(parse(today()).getTime() / 86400000) % STARTER_QUOTES.length];
  return `<button type="button" class="daily-quote" data-tab="inspire">
    <small>${icon('spark')} ${esc(pageName('inspire'))}${starter ? ` | أضف عباراتك من صفحة ${esc(pageName('inspire'))}` : ''}</small>
    <q>${esc(q.text)}</q>
    ${q.source ? `<cite>${esc(q.source)}</cite>` : ''}
  </button>`;
}

// ---------- page ----------
function quoteCard(x) {
  return `<button type="button" class="quote-card k-${x.type}" data-action="insp-open" data-v="${x.id}">
    <small>${QUOTE_KIND[x.type]}${x.fav ? ' | ' + icon('star') : ''}</small>
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
  // (v169) the affirmations in the tab chosen, when he has named tabs
  const atab = f === 'affirmation' ? affPick() : null;
  const quotes = sorted.filter((x) => x.type !== 'image' && (f === 'all' || f === x.type) && (atab === null || affTabOf(x) === atab));
  const photos = sorted.filter((x) => x.type === 'image' && (f === 'all' || f === 'image'));
  const q = quoteOfDay();
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الإلهام</h2>
      <div class="btn-row">${counts.motivation + counts.affirmation ? xlsBtn('inspire') : ''}${addBtn('insp-new', 'عبارة')}${addBtn('insp-photo', 'صورة')}</div></div>
    <input type="file" id="inspFile" accept="image/*" multiple hidden>
    ${q && f === 'all' ? `<div class="daily-quote big"><small>${icon('spark')} عبارة اليوم</small><q>${esc(q.text)}</q>${q.source ? `<cite>${esc(q.source)}</cite>` : ''}</div>` : ''}
    ${S.inspire.length ? `<div class="seg seg-wrap" role="group" aria-label="عرض">${seg}</div>` : ''}
    ${f === 'affirmation' ? affTabsHTML(atab) : ''}
    ${quotes.length ? `<div class="quote-list">${quotes.map(quoteCard).join('')}</div>` : ''}
    ${photos.length ? `<div class="photo-grid">${photos.map((x) => `<button type="button" class="photo" data-action="insp-view" data-v="${x.id}" aria-label="${esc(x.text || 'صورة')}"><img data-img="${x.imageId}" alt="${esc(x.text || '')}">${x.fav ? `<span class="fav">${icon('star')}</span>` : ''}</button>`).join('')}</div>` : ''}
    ${!quotes.length && !photos.length ? (S.inspire.length
      ? emptyHTML('لا شيء هنا', 'اختر تبويباً آخر أو أضف جديداً.')
      : emptyHTML('مكان لما يلهمك', 'أضف عبارات تحفيزية تدفعك للعمل، وعبارات توكيدية تكررها لنفسك مثل «أنا قادر على الالتزام»، وصوراً لأهدافك. تظهر لك «عبارة اليوم» في الصفحة الرئيسية.',
        `<div class="btn-row">${addBtn('insp-new', 'أول عبارة')}${addBtn('insp-photo', 'صورة')}</div>`)) : ''}
    ${counts.image ? '<p class="note-text explain">الصور محفوظة على هذا الجهاز فقط، ولا تدخل في ملف النسخة الاحتياطية.</p>' : ''}
  </section>`;
}

// ---------- editors ----------
function openQuote(id, type) {
  const x = id ? S.inspire.find((i) => i.id === id) : normalizeInspire({ type: type || (inspUi.filter === 'affirmation' ? 'affirmation' : 'motivation'), tab: inspUi.filter === 'affirmation' ? affPick() || '' : '' });
  const f = $('libForm');
  ldraft = { kind: 'quote', id: x.id, isNew: !id, type: x.type };
  f.innerHTML = `
    <div class="sheet-head"><h2>${id ? 'تعديل العبارة' : 'عبارة جديدة'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="seg" id="qType">${['motivation', 'affirmation'].map((k) => `<button type="button" data-action="insp-type" data-v="${k}" aria-pressed="${x.type === k}">${k === 'motivation' ? 'تحفيزية' : 'توكيدية'}</button>`).join('')}</div>
    <label class="field"><span>العبارة</span><textarea id="qText" rows="4" placeholder="${x.type === 'affirmation' ? 'مثال: أنا أستحق النجاح وأعمل له كل يوم' : 'مثال: ابدأ من حيث أنت، واستخدم ما لديك'}">${esc(x.text)}</textarea></label>
    ${affTabs().length ? `<label class="field" id="qTabWrap"${x.type === 'affirmation' ? '' : ' hidden'}><span>التبويب</span><select id="qTab"><option value="">بلا تبويب</option>${affTabs().map((t) => `<option value="${t.id}"${affTabOf(x) === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
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
  const tab = ldraft.type === 'affirmation' ? ($('qTab') ? $('qTab').value : (old && old.tab) || '') : '';
  const x = normalizeInspire({ ...(old || {}), id: ldraft.id, type: ldraft.type, text, source: $('qSource').value.trim(), fav: $('qFav').checked, tab });
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
      if ($('qTabWrap')) $('qTabWrap').hidden = v !== 'affirmation';
      break;
    case 'insp-tab': inspUi.aff = v; render(); break;
    case 'insp-tab-new': openAffTab(''); break;
    case 'insp-tab-edit': openAffTab(v); break;
    case 'insp-tab-del': {
      if (!selArmed(el)) break;
      const t = affTabs().find((x) => x.id === ldraft.id);
      S.settings.affTabs = affTabs().filter((x) => x.id !== ldraft.id);
      for (const x of S.inspire) if (x.tab === ldraft.id) x.tab = ''; // (its phrases stay, with no tab)
      inspUi.aff = null;
      save(); closeLib(); render(); toast(`حُذف التبويب${t ? ` «${t.name}»` : ''}، وبقيت عباراته`);
      break;
    }
    case 'insp-aff-open': { const st = affState(); st.open = !st.open; affKeep(st); render(); break; }
    case 'insp-aff-tab': { const st = affState(); st.tab = v; affKeep(st); render(); break; }
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'inspFile' && e.target.files.length) { addImages([...e.target.files]); e.target.value = ''; }
});

// ---------- (v169) affirmations in tabs he names, read in full on «اليوم» ----------
// his request: «صفحة تتضمن توكيدات وتبويبات أختار عنوانها مثلا توكيدات الطمأنينة وتوكيدات العلاقات وهكذا مطوية إذا ضغطت
// فتحت لي كلها بحيث تكون قراءتها سلسلة وهي بدل الإلهام في اليوم»; the tabs are written in «الإلهام» (his answer «ب»)
const affTabs = () => (Array.isArray(S.settings.affTabs) ? S.settings.affTabs.filter((t) => t && t.id) : []);
// a phrase's tab: one of his tabs, or none (its tab deleted on another device too)
const affTabOf = (x) => (x.tab && affTabs().some((t) => t.id === x.tab) ? x.tab : '');
const affOf = (tab) => S.inspire.filter((x) => x.type === 'affirmation' && x.text && affTabOf(x) === tab).sort((a, b) => b.fav - a.fav || b.created - a.created);
// the tab shown in «الإلهام»: null while he has no tabs (all the affirmations, as before); «بلا تبويب» for the old ones
function affPick() {
  if (!affTabs().length) return null;
  const ids = [...(affOf('').length ? [''] : []), ...affTabs().map((t) => t.id)];
  if (!ids.includes(inspUi.aff)) inspUi.aff = ids[0];
  return inspUi.aff;
}
function affTabsHTML(atab) {
  const tabs = [...(affTabs().length && affOf('').length ? [{ id: '', name: 'بلا تبويب' }] : []), ...affTabs()];
  const cur = affTabs().find((t) => t.id === atab);
  return `<div class="chips aff-tabs" role="group" aria-label="تبويبات التوكيدات">${tabs.map((t) => `<button type="button" class="chip" data-action="insp-tab" data-v="${t.id}" aria-pressed="${t.id === atab}">${esc(t.name)}${affOf(t.id).length ? ` <span class="num">${affOf(t.id).length}</span>` : ''}</button>`).join('')}<button type="button" class="chip" data-action="insp-tab-new">＋ تبويب</button></div>
    ${cur ? `<div class="btn-row"><button type="button" class="ghost sm" data-action="insp-tab-edit" data-v="${cur.id}">تعديل التبويب</button></div>` : ''}`;
}
// a tab named, or renamed and deleted (its phrases stay, with no tab)
function openAffTab(id) {
  const t = affTabs().find((x) => x.id === id);
  ldraft = { kind: 'afftab', id: t ? t.id : uid(), isNew: !t };
  $('libForm').innerHTML = `${sheetHead(t ? 'تعديل التبويب' : 'تبويب جديد')}
    <label class="field"><span>اسم التبويب</span><input type="text" id="afName" value="${esc(t ? t.name : '')}" placeholder="مثال: توكيدات الطمأنينة" autocomplete="off"></label>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${t ? '<button type="button" class="danger" data-action="insp-tab-del">حذف</button>' : ''}</div>
    ${t ? '<p class="note-text explain">حذف التبويب لا يحذف عباراته: تبقى في «توكيدية» بلا تبويب.</p>' : ''}`;
  showLib();
  setTimeout(() => { if (!t) $('afName').focus(); }, 60);
}
function saveAffTab() {
  const name = $('afName').value.trim();
  if (!name) { toast('اكتب اسم التبويب.'); $('afName').focus(); return false; }
  const tabs = affTabs(), t = tabs.find((x) => x.id === ldraft.id);
  if (t) t.name = name; else tabs.push({ id: ldraft.id, name });
  S.settings.affTabs = tabs;
  inspUi.filter = 'affirmation'; inspUi.aff = ldraft.id;
  save();
  toast(t ? 'حُفظ التبويب' : `أُضيف التبويب «${name}»: أضف إليه عباراتك`);
  return true;
}
// «اليوم»: folded, or open on the tab he left it on, on this phone only (not synced)
function affState() { try { return { open: false, tab: '', ...JSON.parse(localStorage.getItem('mahami-aff') || '{}') }; } catch { return { open: false, tab: '' }; } }
function affKeep(st) { try { localStorage.setItem('mahami-aff', JSON.stringify({ open: !!st.open, tab: st.tab || '' })); } catch {} }
// «بدل الإلهام في اليوم»: «عبارة اليوم» hidden once (his answer «أ: يُخفى»); brought back from «رتّب صفحة اليوم»
function affOnce() {
  if (S.settings.affOnce) return;
  S.settings.affOnce = true;
  const h = todayHidden();
  if (!h.includes('quote')) S.settings.todayHidden = [...h, 'quote'];
  save();
}
function affTodayHTML() {
  affOnce();
  const st = affState(), tabs = affTabs().filter((t) => affOf(t.id).length), cur = tabs.find((t) => t.id === st.tab) || tabs[0];
  const body = !st.open ? ''
    : !cur ? `<p class="note-text">اكتب توكيداتك في تبويبات من «${esc(pageName('inspire'))}». <button type="button" class="ghost sm" data-tab="inspire">${esc(pageName('inspire'))}</button></p>`
      : `${tabs.length > 1 ? `<div class="chips aff-tabs" role="group" aria-label="تبويبات التوكيدات">${tabs.map((t) => `<button type="button" class="chip" data-action="insp-aff-tab" data-v="${t.id}" aria-pressed="${t.id === cur.id}">${esc(t.name)}</button>`).join('')}</div>` : `<h3 class="aff-one">${esc(cur.name)}</h3>`}
        <div class="aff-read">${affOf(cur.id).map((x) => `<p>${esc(x.text)}${x.source ? `<cite>${esc(x.source)}</cite>` : ''}</p>`).join('')}</div>`;
  return `<section class="section aff-today">
    <button type="button" class="aff-head" data-action="insp-aff-open" aria-expanded="${st.open}"><span>${icon('spark')} التوكيدات</span><span class="aff-arrow" aria-hidden="true">${st.open ? '▲' : '▼'}</span></button>
    ${body}
  </section>`;
}

Object.assign(LibraryViews, { inspire: viewInspire });
