'use strict';
// «الإلهام»: motivational phrases, affirmations and photos.
// Photos are resized on the phone and kept in IndexedDB (localStorage is too small for them).

const QUOTE_KIND = { motivation: 'عبارة تحفيزية', affirmation: 'عبارة توكيدية' };
const inspUi = { filter: 'all', aff: null };

function normalizeInspire(x) {
  return {
    id: x.id || uid(), type: ['motivation', 'affirmation', 'image'].includes(x.type) ? x.type : 'motivation',
    text: String(x.text || ''), source: String(x.source || ''), imageId: x.imageId || '',
    fav: !!x.fav, created: x.created || Date.now(), tab: String(x.tab || ''), html: typeof x.html === 'string' ? x.html : '',
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
    ${qxBody(q)}
    ${q.source ? `<cite>${esc(q.source)}</cite>` : ''}
  </button>`;
}

// ---------- page ----------
function quoteCard(x) {
  return `<button type="button" class="quote-card k-${x.type}" data-action="insp-open" data-v="${x.id}">
    <small>${QUOTE_KIND[x.type]}${x.fav ? ' | ' + icon('star') : ''}</small>
    ${qxBody(x)}
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
    ${q && f === 'all' ? `<div class="daily-quote big"><small>${icon('spark')} عبارة اليوم</small>${qxBody(q)}${q.source ? `<cite>${esc(q.source)}</cite>` : ''}</div>` : ''}
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
    <div class="field q-field"><span>العبارة</span>${qxToolsHTML()}<div id="qText" class="q-edit q-rich${S.settings.digits === 'arab' ? ' q-ar' : ''}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="العبارة" data-ph="${x.type === 'affirmation' ? 'مثال: أنا أستحق النجاح وأعمل له كل يوم' : 'مثال: ابدأ من حيث أنت، واستخدم ما لديك'}">${qxEditHTML(x)}</div></div>
    ${affTabs().length ? `<label class="field" id="qTabWrap"${x.type === 'affirmation' ? '' : ' hidden'}><span>التبويب</span><select id="qTab"><option value="">بلا تبويب</option>${affTabs().map((t) => `<option value="${t.id}"${affTabOf(x) === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    <label class="field"><span>القائل أو المصدر (اختياري)</span><input type="text" id="qSource" value="${esc(x.source)}" autocomplete="off"></label>
    <label class="switch"><input type="checkbox" id="qFav"${x.fav ? ' checked' : ''}><span>مفضّلة (تظهر أكثر في «عبارة اليوم»)</span></label>
    <div class="sheet-actions">
      <button type="submit" class="primary">حفظ</button>
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  qxHist = [];
  qxFontsFor(x.html);
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  setTimeout(() => { if (!id) qxFocusEnd(); }, 60);
}

function saveQuote() {
  // (v170) the phrase as formatted, and its plain text with its lines (for the sheet, sync and every other reader)
  const html = qxSafe($('qText').innerHTML), text = qxPlain(html);
  if (!text) { toast('اكتب العبارة.'); qxFocusEnd(); return false; }
  const old = S.inspire.find((i) => i.id === ldraft.id);
  const tab = ldraft.type === 'affirmation' ? ($('qTab') ? $('qTab').value : (old && old.tab) || '') : '';
  const x = normalizeInspire({ ...(old || {}), id: ldraft.id, type: ldraft.type, text, source: $('qSource').value.trim(), fav: $('qFav').checked, tab, html: qxRich(html) ? html : '' });
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
// (kept in memory too: a phone whose storage refuses still opens and folds it)
function affState() {
  if (!inspUi.affSt) { inspUi.affSt = { open: false, tab: '' }; try { Object.assign(inspUi.affSt, JSON.parse(localStorage.getItem('mahami-aff') || '{}')); } catch {} }
  return inspUi.affSt;
}
function affKeep(st) { inspUi.affSt = { open: !!st.open, tab: st.tab || '' }; try { localStorage.setItem('mahami-aff', JSON.stringify(inspUi.affSt)); } catch {} }
// «بدل الإلهام في اليوم»: «عبارة اليوم» hidden once (his answer «أ: يُخفى»); brought back from «رتّب صفحة اليوم»
function affOnce() {
  if (S.settings.affOnce) return;
  S.settings.affOnce = true;
  const h = todayHidden();
  if (!h.includes('quote')) S.settings.todayHidden = [...h, 'quote'];
  save();
}
function affTodayHTML() {
  const st = affState(), tabs = affTabs().filter((t) => affOf(t.id).length), cur = tabs.find((t) => t.id === st.tab) || tabs[0];
  const body = !st.open ? ''
    : !cur ? `<p class="note-text">اكتب توكيداتك في تبويبات من «${esc(pageName('inspire'))}». <button type="button" class="ghost sm" data-tab="inspire">${esc(pageName('inspire'))}</button></p>`
      : `${tabs.length > 1 ? `<div class="chips aff-tabs" role="group" aria-label="تبويبات التوكيدات">${tabs.map((t) => `<button type="button" class="chip" data-action="insp-aff-tab" data-v="${t.id}" aria-pressed="${t.id === cur.id}">${esc(t.name)}</button>`).join('')}</div>` : `<h3 class="aff-one">${esc(cur.name)}</h3>`}
        <div class="aff-read">${affOf(cur.id).map((x) => `<div class="aff-q">${qxBody(x, true)}${x.source ? `<cite>${esc(x.source)}</cite>` : ''}</div>`).join('')}</div>`;
  return `<section class="section aff-today">
    <button type="button" class="aff-head" data-action="insp-aff-open" aria-expanded="${st.open}"><span>${icon('spark')} التوكيدات</span><span class="aff-arrow" aria-hidden="true">${st.open ? '▲' : '▼'}</span></button>
    ${body}
  </section>`;
}

// ---------- (v170) a phrase formatted as in «مؤلفاتي», and shown as it was formatted ----------
// his request: «اجعل نافذة التوكيدات في اليوم تظهر بنفس التنسيق الذي أضعه في نفس صفحة التعبئة، وكذلك اجعل لي القدرة على تنسيق
// النص كما في كتاباتي»; his answers: its lines kept with the new formatting, «مؤلفاتي»'s text tools, every phrase
// what a phrase keeps: «مؤلفاتي»'s own (wrSafe), less what its tools here do not make; a heading is «h3» (an «h2» the
// size of a page's name would be renamed by renameHeads)
function qxSafe(html) {
  const t = document.createElement('template');
  t.innerHTML = typeof wrSafe === 'function' ? wrSafe(html || '') : '';
  for (const e of t.content.querySelectorAll('img, table, hr, .pgbreak, sup.fn')) e.remove();
  for (const h of t.content.querySelectorAll('h2')) { const n = document.createElement('h3'); n.style.cssText = h.style.cssText; while (h.firstChild) n.append(h.firstChild); h.replaceWith(n); }
  for (const e of t.content.querySelectorAll('[data-ind]')) delete e.dataset.ind;
  return t.innerHTML.trim();
}
// its text, line by line
function qxPlain(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h2|h3|blockquote|li)>/gi, '$&\n');
  return t.content.textContent.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// formatted beyond its lines: anything but plain paragraphs (those stay a text, shown as before)
function qxRich(html) {
  const t = document.createElement('template');
  t.innerHTML = html || '';
  return [...t.content.querySelectorAll('*')].some((e) => !(e.nodeName === 'BR' || (e.nodeName === 'P' && !e.attributes.length)));
}
// the formatting shown while it is still this phrase's text (a text edited elsewhere goes back to plain)
function qxShown(x) {
  if (!x || !x.html) return '';
  const h = qxSafe(x.html), same = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return h && same(qxPlain(h)) === same(x.text) ? h : '';
}
function qxFontsFor(html) { if (/font-family/i.test(html || '') && typeof wrFonts === 'function') wrFonts(); }
// a phrase as it is shown: formatted as he formatted it, or its text with its lines (between «…» as before)
function qxBody(x, bare) {
  const h = qxShown(x);
  if (h) { qxFontsFor(h); return `<div class="q-rich${S.settings.digits === 'arab' ? ' q-ar' : ''}">${h}</div>`; }
  return bare ? `<div class="q-lines">${esc(x.text)}</div>` : `<q class="q-lines">${esc(x.text)}</q>`;
}
function qxEditHTML(x) {
  const h = qxShown(x);
  if (h) return h;
  const ls = String(x.text || '').split('\n');
  return x.text ? ls.map((l) => `<p>${l ? esc(l) : '<br>'}</p>`).join('') : '<p><br></p>';
}
function qxFocusEnd() {
  const el = $('qText');
  if (!el) return;
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
// «مؤلفاتي»'s text tools, by his choice (no table, picture, footnote, page break)
const QX_TOOLS = [['h3', 'عنوان', 'عنوان'], ['p', 'نص', 'نص عادي'], ['bold', '<b>غ</b>', 'غامق'], ['italic', '<i>م</i>', 'مائل'], ['underline', '<u>ت</u>', 'تسطير'], ['strike', '<s>ش</s>', 'شطب'],
  ['pal:color', '<span class="tool-color">أ</span>', 'لون الخط'], ['pal:hi', '<span class="tool-hi">أ</span>', 'تظليل'], ['pal:font', 'الخط', 'نوع الخط'], ['bigger', 'أ+', 'كبّر النص المحدد'], ['smaller', 'أ−', 'صغّر النص المحدد'],
  ['pal:align', '☰', 'المحاذاة'], ['pal:lh', '↕', 'تباعد الأسطر'], ['ul', '•', 'قائمة نقطية'], ['ol', '١-', 'قائمة مرقّمة'], ['ayah', '﴿ ﴾', 'آية'], ['quote', '❝', 'اقتباس'],
  ['clear', 'مسح التنسيق', 'مسح التنسيق'], ['undo', '↶', 'تراجع']];
const qxToolsHTML = () => `<div class="q-tools" role="toolbar" aria-label="تنسيق العبارة">${QX_TOOLS.map(([c, f, n]) => `<button type="button" data-qcmd="${c}" aria-label="${n}" title="${n}">${f}</button>`).join('')}</div><div class="q-pal" id="qPal" hidden></div>`;
// «تراجع»: what the phrase was before each tool and each pause in typing
let qxHist = [], qxTyping = 0, qxRange = null;
const qxEl = () => $('qText');
function qxMark() { const el = qxEl(); if (!el) return; const h = el.innerHTML; if (qxHist[qxHist.length - 1] !== h) qxHist.push(h); if (qxHist.length > 60) qxHist.shift(); }
function qxUndo() {
  const el = qxEl(); if (!el) return;
  while (qxHist.length && qxHist[qxHist.length - 1] === el.innerHTML) qxHist.pop();
  if (!qxHist.length) { toast('لا شيء تتراجع عنه'); return; }
  el.innerHTML = qxHist.pop();
  qxFocusEnd();
}
function qxKeep() { const s = getSelection(), el = qxEl(); if (el && s.rangeCount && el.contains(s.anchorNode)) qxRange = s.getRangeAt(0).cloneRange(); }
function qxBack() {
  const s = getSelection(), el = qxEl();
  if (!el || (s.rangeCount && el.contains(s.anchorNode))) return;
  el.focus();
  if (qxRange && el.contains(qxRange.startContainer)) { s.removeAllRanges(); s.addRange(qxRange); }
}
const qxExec = (cmd, val, css) => { try { document.execCommand('styleWithCSS', false, !!css); } catch {} return document.execCommand(cmd, false, val); };
// the paragraph the cursor is in, and those the selection touches
function qxBlock() {
  const s = getSelection(), el = qxEl();
  if (!el || !s.rangeCount) return null;
  let n = s.getRangeAt(0).startContainer;
  if (!el.contains(n)) return null;
  while (n && n.parentNode !== el) n = n.parentNode;
  return n && n.nodeType === 1 ? n : null;
}
function qxBlocks() {
  const s = getSelection(), el = qxEl();
  if (!el || !s.rangeCount || !el.contains(s.anchorNode)) return [];
  const r = s.getRangeAt(0);
  const pick = () => [...el.querySelectorAll('p, h3, blockquote, li')].filter((b) => r.intersectsNode(b) && !b.querySelector('p, h3, blockquote, li'));
  let l = pick();
  if (!l.length) { document.execCommand('formatBlock', false, '<p>'); l = pick(); }
  return l;
}
function qxUnstyle(prop, test) {
  for (const sp of [...qxEl().querySelectorAll('span, font')]) {
    if (!test(sp)) continue;
    for (const inner of sp.querySelectorAll('span')) inner.style[prop] = '';
    sp.style[prop] = '';
    if (sp.nodeName === 'FONT') { sp.removeAttribute('color'); sp.removeAttribute('face'); }
    if (!sp.getAttribute('style') || !sp.style.length) { if (sp.nodeName === 'SPAN' || !sp.attributes.length) sp.replaceWith(...sp.childNodes); }
  }
}
// the selected text larger or smaller, as in «مؤلفاتي»: 15% a step, between 0.6 and 3 times its paragraph's size
function qxResize(f) {
  const el = qxEl(), s = getSelection();
  if (!s.rangeCount || s.isCollapsed || !el.contains(s.anchorNode)) { toast('حدّد النص الذي تريد تكبيره أو تصغيره'); return false; }
  const r = s.getRangeAt(0);
  let n = r.startContainer.nodeType === 3 ? r.startContainer.parentNode : r.startContainer.childNodes[r.startOffset] || r.startContainer;
  if (n.nodeType !== 1) n = n.parentNode;
  const blk = n.closest('p, h3, blockquote, li') || el;
  const px = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
  const bp = px(blk), want = Math.min(bp * 3, Math.max(bp * 0.6, px(n) * f));
  qxExec('fontSize', '7');
  const made = [];
  for (const ft of [...el.querySelectorAll('font[size="7"]')]) {
    const sp = document.createElement('span');
    for (const x of ft.querySelectorAll('[style]')) x.style.fontSize = '';
    while (ft.firstChild) sp.append(ft.firstChild);
    ft.replaceWith(sp);
    made.push(sp);
  }
  for (const sp of made) sp.style.fontSize = `${Math.round((want / px(sp.parentNode)) * 100) / 100}em`;
  if (made.length) { const nr = document.createRange(); nr.setStartBefore(made[0]); nr.setEndAfter(made[made.length - 1]); s.removeAllRanges(); s.addRange(nr); }
  return true;
}
// a list of the paragraphs selected, or (on a list of the same kind) undone, by hand as in «مؤلفاتي»
function qxList(tag) {
  const T = tag.toUpperCase(), el = qxEl();
  const blks = qxBlocks().filter((b) => b.nodeName === 'LI' || b.parentNode === el);
  if (!blks.length) return;
  const move = (from, to) => { to.style.cssText = from.style.cssText; if (from.classList.contains('ayah') && to.nodeName === 'P') to.className = 'ayah'; while (from.firstChild) to.append(from.firstChild); };
  let last = null;
  if (blks.every((b) => b.nodeName === 'LI' && b.parentNode.nodeName === T)) {
    for (const li of blks) {
      const list = li.parentNode, p = document.createElement('p');
      const after = [...list.children].slice([...list.children].indexOf(li) + 1);
      if (after.length) { const rest = document.createElement(list.nodeName.toLowerCase()); for (const x of after) rest.append(x); list.after(rest); }
      list.after(p); move(li, p); li.remove(); last = p;
      if (!list.children.length) list.remove();
    }
  } else {
    let list = null;
    for (const b of blks) {
      if (b.nodeName === 'LI') { const old = b.parentNode; if (old.nodeName !== T) { const nl = document.createElement(tag); while (old.firstChild) nl.append(old.firstChild); old.replaceWith(nl); } list = null; last = b; continue; }
      const prev = b.previousElementSibling;
      if (!list) { list = prev && prev.nodeName === T ? prev : document.createElement(tag); if (list !== prev) b.before(list); }
      const li = document.createElement('li'); move(b, li); if (!li.firstChild) li.append(document.createElement('br'));
      list.append(li); b.remove(); last = li;
    }
  }
  if (last) { const r = document.createRange(); r.selectNodeContents(last); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}
function qxPalHTML(k) {
  if (k === 'color') return NOTE_COLORS.map(([c, n]) => `<button type="button" class="pal" data-qcolor="${c}" title="${n}" aria-label="لون ${n}" style="${c ? `background:${c}` : ''}">${c ? '' : 'أ'}</button>`).join('');
  if (k === 'hi') return NOTE_HIGHLIGHTS.map(([c, n]) => `<button type="button" class="pal" data-qhi="${c}" title="${n}" aria-label="تظليل ${n}" style="${c ? `background:${c}` : ''}">${c ? '' : '✕'}</button>`).join('');
  if (k === 'font') return `<div class="wr-fonts">${WR_FONTS.map(([f, n]) => `<button type="button" data-qfont="${f}" style="${f ? `font-family:'${f}'` : ''}">${n}</button>`).join('')}</div>`;
  if (k === 'align') return WR_ALIGN.map(([v, n]) => `<button type="button" class="chip" data-qalign="${v}">${n}</button>`).join('');
  if (k === 'lh') return WR_LH.map(([v, n]) => `<button type="button" class="chip" data-qlh="${v}">${n}</button>`).join('');
  return '';
}
function qxCmd(cmd) {
  const el = qxEl();
  if (!el) return;
  if (cmd.startsWith('pal:')) {
    const k = cmd.slice(4), pal = $('qPal');
    qxKeep();
    if (!pal.hidden && pal.dataset.k === k) { pal.hidden = true; return; }
    if (k === 'font' && typeof wrFonts === 'function') wrFonts();
    pal.dataset.k = k; pal.innerHTML = qxPalHTML(k); pal.hidden = false;
    return;
  }
  qxBack();
  if (cmd === 'undo') { qxUndo(); return; }
  qxMark();
  if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') qxExec(cmd);
  else if (cmd === 'strike') qxExec('strikeThrough');
  else if (cmd === 'bigger' || cmd === 'smaller') qxResize(cmd === 'bigger' ? 1.15 : 1 / 1.15);
  else if (cmd === 'ul' || cmd === 'ol') qxList(cmd);
  else if (cmd === 'clear') { qxExec('removeFormat'); qxUnstyle('fontSize', (sp) => !!sp.style.fontSize && getSelection().containsNode(sp, true)); }
  else if (cmd === 'h3' || cmd === 'p' || cmd === 'quote') {
    const want = cmd === 'quote' ? 'blockquote' : cmd, blk = qxBlock();
    document.execCommand('formatBlock', false, `<${blk && blk.nodeName.toLowerCase() === want && cmd !== 'p' ? 'p' : want}>`);
    const nb = qxBlock(); if (nb) nb.classList.remove('ayah');
  } else if (cmd === 'ayah') {
    let blk = qxBlock();
    if (!blk || blk.nodeName !== 'P') { document.execCommand('formatBlock', false, '<p>'); blk = qxBlock(); }
    if (!blk) return;
    if (blk.classList.contains('ayah')) blk.classList.remove('ayah');
    else {
      blk.classList.add('ayah');
      const tx = blk.textContent.trim();
      if (tx && !tx.startsWith('﴿')) blk.insertBefore(document.createTextNode('﴿'), blk.firstChild);
      if (tx && !tx.endsWith('﴾')) blk.append(document.createTextNode('﴾'));
    }
  }
}
// the tools keep the cursor and the selection in the phrase
document.addEventListener('pointerdown', (e) => {
  if (!qxEl()) return;
  if (e.target.closest('.q-tools button, #qPal button')) e.preventDefault();
  else if (!e.target.closest('#qPal, .q-tools')) { const p = $('qPal'); if (p) p.hidden = true; }
});
document.addEventListener('selectionchange', () => { if (qxEl()) qxKeep(); });
document.addEventListener('click', (e) => {
  const el = qxEl();
  if (!el) return;
  const t = e.target.closest('[data-qcmd], [data-qcolor], [data-qhi], [data-qfont], [data-qalign], [data-qlh]');
  if (!t) return;
  if (t.dataset.qcmd) { qxCmd(t.dataset.qcmd); return; }
  // (a palette stays open with the text still selected, to try one after another, as in «مؤلفاتي»)
  qxBack(); qxMark();
  if (t.dataset.qcolor !== undefined) { const c = t.dataset.qcolor; if (c) qxExec('foreColor', c, true); else { qxExec('foreColor', '#010203', true); qxUnstyle('color', (sp) => /rgb\(1, 2, 3\)|#010203/i.test(sp.style.color || sp.getAttribute('color') || '')); } }
  else if (t.dataset.qhi !== undefined) { const c = t.dataset.qhi; if (c) qxExec('hiliteColor', c, true); else { qxExec('hiliteColor', '#010203', true); qxUnstyle('backgroundColor', (sp) => /rgb\(1, 2, 3\)/.test(sp.style.backgroundColor)); } }
  else if (t.dataset.qfont !== undefined) { const f = t.dataset.qfont; if (f) qxExec('fontName', f, true); else { qxExec('fontName', 'wr-reset', true); qxUnstyle('fontFamily', (sp) => /wr-reset/.test(sp.style.fontFamily || sp.getAttribute('face') || '')); } }
  else if (t.dataset.qalign) { for (const b of qxBlocks()) b.style.textAlign = t.dataset.qalign; }
  else if (t.dataset.qlh) { for (const b of qxBlocks()) b.style.lineHeight = t.dataset.qlh; }
});
document.addEventListener('focusin', (e) => {
  if (e.target.id !== 'qText' || e.target.firstChild) return; // (only an empty field: a loose line is gathered on save)
  const p = document.createElement('p'); p.append(document.createElement('br'));
  e.target.append(p);
  const r = document.createRange(); r.setStart(p, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'qText') return;
  // a new line after a verse box or a quotation is plain text
  if (e.inputType === 'insertParagraph') {
    const blk = qxBlock();
    if (blk && !blk.textContent.trim() && (blk.classList.contains('ayah') || blk.nodeName === 'BLOCKQUOTE')) {
      if (blk.nodeName === 'BLOCKQUOTE') document.execCommand('formatBlock', false, '<p>');
      const nb = qxBlock(); if (nb) nb.classList.remove('ayah');
    }
  }
  clearTimeout(qxTyping); qxTyping = setTimeout(qxMark, 700);
});
document.addEventListener('beforeinput', (e) => {
  if (e.target.id !== 'qText') return;
  if (e.inputType === 'historyUndo') { e.preventDefault(); qxUndo(); }
  else if (e.inputType !== 'historyRedo') { clearTimeout(qxTyping); if (!qxHist.length) qxMark(); }
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'qText' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); qxUndo(); }
});
// what is pasted keeps what «مؤلفاتي» keeps (headings, bold, italic, its lines)
document.addEventListener('paste', (e) => {
  if (!(e.target.closest && e.target.closest('#qText'))) return;
  const cd = e.clipboardData;
  if (!cd) return;
  e.preventDefault();
  qxMark();
  const html = cd.getData('text/html');
  if (html && typeof wrClean === 'function') qxExec('insertHTML', qxSafe(wrClean(html)));
  else qxExec('insertText', cd.getData('text/plain'));
});

Object.assign(LibraryViews, { inspire: viewInspire });
