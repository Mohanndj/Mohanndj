'use strict';
// «الحفظ»: Quran, hadith, poetry and other texts, learnt with memory aids then kept with spaced review.
// Learning: the text can be shown whole, as the first letter of each word, with every third word
// hidden, or fully hidden; tapping a hidden word reveals it. Once memorised, the item enters review:
// «نسيت / صعب / جيد / سهل» set the next review (1 day → 3 days → weeks → months).

const HIFZ_TYPES = { quran: ['القرآن', '📖'], hadith: ['الحديث', '📜'], poem: ['الشعر', '🪶'], other: ['نصوص أخرى', '✒️'] };
const SURAHS = 'الفاتحة البقرة آل_عمران النساء المائدة الأنعام الأعراف الأنفال التوبة يونس هود يوسف الرعد إبراهيم الحجر النحل الإسراء الكهف مريم طه الأنبياء الحج المؤمنون النور الفرقان الشعراء النمل القصص العنكبوت الروم لقمان السجدة الأحزاب سبأ فاطر يس الصافات ص الزمر غافر فصلت الشورى الزخرف الدخان الجاثية الأحقاف محمد الفتح الحجرات ق الذاريات الطور النجم القمر الرحمن الواقعة الحديد المجادلة الحشر الممتحنة الصف الجمعة المنافقون التغابن الطلاق التحريم الملك القلم الحاقة المعارج نوح الجن المزمل المدثر القيامة الإنسان المرسلات النبأ النازعات عبس التكوير الانفطار المطففين الانشقاق البروج الطارق الأعلى الغاشية الفجر البلد الشمس الليل الضحى الشرح التين العلق القدر البينة الزلزلة العاديات القارعة التكاثر العصر الهمزة الفيل قريش الماعون الكوثر الكافرون النصر المسد الإخلاص الفلق الناس'.split(' ').map((s) => s.replace('_', ' '));
const AYAT = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];
const hzUi = { type: '', q: '' };

function normalizeHifz(h) {
  return {
    id: h.id || uid(), type: HIFZ_TYPES[h.type] ? h.type : 'other', title: String(h.title || ''), text: String(h.text || ''),
    source: String(h.source || ''), surah: Number(h.surah) || 0, from: Number(h.from) || 0, to: Number(h.to) || 0,
    state: h.state === 'review' ? 'review' : 'learn', interval: Number(h.interval) || 0, ease: Number(h.ease) || 2.5,
    due: h.due || '', reps: Number(h.reps) || 0, lapses: Number(h.lapses) || 0, last: h.last || '', learnedAt: h.learnedAt || '',
    created: h.created || Date.now(),
  };
}
const getHz = (id) => S.hifz.find((h) => h.id === id);
const hzDue = () => S.hifz.filter((h) => h.state === 'review' && h.due && h.due <= today());
const hzFirm = (h) => h.state === 'review' && h.interval >= 21;
const hzTitle = (h) => h.title || (h.type === 'quran' && h.surah ? `${SURAHS[h.surah - 1]} ${h.from}${h.to > h.from ? `–${h.to}` : ''}` : excerpt(h.text.split('\n')[0] || 'بلا عنوان', 40));
const hzWords = (h) => (h.text.trim() ? h.text.replace(/﴿[^﴾]*﴾/g, ' ').trim().split(/\s+/).length : 0);

// ---------- spaced review ----------
function hzNext(h, grade) {
  const n = { ...h };
  if (grade === 'again') { n.interval = 1; n.ease = Math.max(1.3, n.ease - 0.2); n.lapses++; n.reps = 0; }
  else if (grade === 'hard') { n.interval = Math.max(1, Math.round((n.interval || 1) * 1.2)); n.ease = Math.max(1.3, n.ease - 0.15); n.reps++; }
  else if (grade === 'good') { n.interval = n.reps === 0 ? 1 : n.reps === 1 ? 3 : Math.round(n.interval * n.ease); n.reps++; }
  else { n.interval = n.reps === 0 ? 3 : Math.round(Math.max(n.interval, 3) * n.ease * 1.3); n.ease += 0.15; n.reps++; }
  n.interval = Math.min(n.interval, 365);
  n.due = addDays(today(), n.interval);
  n.last = today();
  return n;
}
const inDays = (n) => (n <= 1 ? 'غداً' : n < 30 ? `${afterDays(n)}` : n < 365 ? `بعد ${Math.round(n / 30)} ${Math.round(n / 30) <= 2 ? 'شهر' : 'أشهر'}` : 'بعد سنة');

// ---------- poems: read whatever was pasted into abyat ----------
// Copied poems come as «صدر * عجز», with the halves on separate lines, split by tabs or wide
// spaces, numbered, or with blank lines between abyat. mode: auto | pairs (two lines = one bayt) | sep (one line = one bayt)
const SHATR_SEP = /\s*(?:\*+|…+|\.{3,}|\t+|\s{2,}|\s[-–—|]{1,3}\s)\s*/;
const cleanPoemLine = (l) => l.replace(/[\u200f\u200e\u00a0]/g, ' ').trim()
  .replace(/^[\(\[]?[0-9٠-٩]+[\)\]\.\-–:،]?\s+/, '') // leading «1-», «(٢)», «3.»
  .replace(/ـ{2,}/g, 'ـ').trim();
function parsePoem(text, mode = 'auto') {
  const lines = text.split('\n').map(cleanPoemLine).filter(Boolean);
  if (mode === 'auto') mode = lines.filter((l) => SHATR_SEP.test(l)).length >= lines.length / 2 ? 'sep' : lines.length > 1 && lines.length % 2 === 0 ? 'pairs' : 'sep';
  if (mode === 'pairs') {
    const out = [];
    for (let i = 0; i < lines.length; i += 2) out.push([lines[i].split(SHATR_SEP).join(' '), (lines[i + 1] || '').split(SHATR_SEP).join(' ')]);
    return out;
  }
  return lines.map((l) => { const [a, ...b] = l.split(SHATR_SEP); return [a.trim(), b.join(' ').trim()]; });
}
// the canonical form kept in storage: one bayt per line, «صدر * عجز»
const poemToText = (abyat) => abyat.map(([a, b]) => (b ? `${a} * ${b}` : a)).join('\n');

// ---------- the text, rendered for memorising ----------
// mode: full | letters | gaps | hidden
function hzTextHTML(h, mode) {
  const lines = h.text.split('\n').map((l) => l.trim()).filter(Boolean);
  let k = 0;
  const words = (s) => s.split(/\s+/).filter(Boolean).map((w) => {
    if (/^﴿[^﴾]*﴾$/.test(w)) return `<span class="hz-mark">${esc(w)}</span>`;
    k++;
    const hide = mode === 'hidden' || (mode === 'gaps' && k % 3 === 0);
    if (mode === 'letters') {
      const m = w.match(/^[^ء-ي\w]*([ء-ي\w][ً-ْٰ]*)/);
      return `<span class="hz-w hz-l" data-w="${esc(w)}">${esc(m ? m[0] : w.slice(0, 1))}${m && /[ب-ي]/.test(m[1][0]) && !/[اأإآدذرزوؤءةى]/.test(m[1][0]) ? 'ـ' : ''}</span>`;
    }
    return hide ? `<span class="hz-w hz-hid" data-w="${esc(w)}">${esc(w)}</span>` : `<span class="hz-w">${esc(w)}</span>`;
  }).join(' ');
  if (h.type === 'poem') {
    // poem-only views: «إخفاء العجز» hides the second half, «أوائل الأشطر» keeps the first word of each half
    const as = (m, s) => { const save = mode; mode = m; const r = words(s); mode = save; return r; };
    const shatr = (s, second) => {
      if (mode === 'sadr') return as(second ? 'hidden' : 'full', s);
      if (mode === 'shatr') { const [first, ...rest] = s.split(/\s+/).filter(Boolean); return first ? `${as('full', first)} ${as('hidden', rest.join(' '))}` : ''; }
      return words(s);
    };
    return `<div class="hz-poem">${parsePoem(h.text).map(([a, b], i) => `<div class="hz-bayt${b ? '' : ' single'}">
      <button type="button" class="hz-n" data-hz="bayt" aria-label="أظهر البيت ${i + 1}">${i + 1}</button>
      <span class="hz-s1">${shatr(a, false)}</span>${b ? `<span class="hz-s2">${shatr(b, true)}</span>` : ''}
    </div>`).join('')}</div>`;
  }
  return `<div class="hz-text${h.type === 'quran' ? ' quran' : ''}">${lines.map((l) => `<p>${words(l)}</p>`).join('')}</div>`;
}

// ---------- page ----------
function hzCard(h) {
  const t = HIFZ_TYPES[h.type];
  const st = h.state === 'learn' ? '<span class="hz-st learn">أحفظه الآن</span>'
    : h.due <= today() ? '<span class="hz-st due">حان مراجعته</span>'
      : `<span class="hz-st">${hzFirm(h) ? 'ثابت · ' : ''}المراجعة ${esc(inDays(daysBetween(today(), h.due)))}</span>`;
  return `<button type="button" class="hz-card t-${h.type}" data-action="hz-open" data-v="${h.id}">
    <span class="hz-emoji">${t[1]}</span>
    <span class="hz-main"><b>${esc(hzTitle(h))}</b>${h.source ? `<small>${esc(h.source)}</small>` : ''}
      <span class="book-line">${st} · ${plural(hzWords(h), 'كلمة واحدة', 'كلمتان', 'كلمات', 'كلمة')}${h.lapses ? ` · نسيته ${h.lapses === 1 ? 'مرة' : `${h.lapses} مرات`}` : ''}</span></span>
  </button>`;
}

function viewHifz() {
  const due = hzDue();
  const learning = S.hifz.filter((h) => h.state === 'learn');
  const q = hzUi.q.trim().toLowerCase();
  const list = S.hifz.filter((h) => (!hzUi.type || h.type === hzUi.type) && (!q || [h.title, h.text, h.source].some((s) => s.toLowerCase().includes(q))))
    .sort((a, b) => (a.state === 'learn' ? 0 : 1) - (b.state === 'learn' ? 0 : 1) || (a.due || '').localeCompare(b.due || '') || b.created - a.created);
  const by = (type) => S.hifz.filter((h) => h.type === type && h.state === 'review').length;
  const ayat = S.hifz.filter((h) => h.type === 'quran' && h.state === 'review' && h.surah).reduce((n, h) => n + Math.max(1, h.to - h.from + 1), 0);
  const seg = [['', 'الكل'], ...Object.entries(HIFZ_TYPES).map(([k, v]) => [k, v[0]])]
    .map(([v, l]) => `<button type="button" data-action="hz-type" data-v="${v}" aria-pressed="${hzUi.type === v}">${l}</button>`).join('');
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الحفظ</h2><div class="btn-row">${S.hifz.length ? xlsBtn('hifz') : ''}${addBtn('hz-new', 'نص')}</div></div>
    ${S.hifz.length ? `<div class="j-stats">
      <span><b>${due.length}</b> للمراجعة اليوم</span>
      <span><b>${S.hifz.filter((h) => h.state === 'review').length}</b> محفوظ</span>
      <span><b>${S.hifz.filter(hzFirm).length}</b> ثابت</span>
    </div>
    <p class="note-text">${[ayat ? `${ayat} آية` : '', by('hadith') ? plural(by('hadith'), 'حديث واحد', 'حديثان', 'أحاديث', 'حديثاً') : '', by('poem') ? `${by('poem')} من القصائد والأبيات` : ''].filter(Boolean).join(' · ') || 'ابدأ بحفظ أول نص ثم أدخله المراجعة.'}</p>` : ''}
    ${due.length ? `<button type="button" class="primary hz-go" data-action="hz-review">${icon('repeat')} ابدأ مراجعة اليوم (${due.length})</button>`
      : S.hifz.some((h) => h.state === 'review') ? '<p class="hz-done">✓ لا مراجعة مستحقة اليوم. أحسنت!</p>' : ''}
    ${learning.length ? `<div class="hz-learning"><h3>أحفظها الآن</h3><div class="book-list">${learning.map(hzCard).join('')}</div></div>` : ''}
    ${S.hifz.length ? `<div class="seg seg-wrap" role="group" aria-label="النوع">${seg}</div>
      ${S.hifz.length > 6 ? `<input type="search" id="hzSearch" placeholder="ابحث في محفوظاتك" aria-label="بحث" value="${esc(hzUi.q)}">` : ''}
      ${list.filter((h) => h.state === 'review').length ? `<div class="book-list">${list.filter((h) => h.state === 'review').map(hzCard).join('')}</div>` : emptyHTML('لا شيء هنا بعد', 'النصوص التي تحفظها تنتقل إلى هنا لتراجعها في أوقات متباعدة.')}`
      : emptyHTML('ابدأ الحفظ', 'أضف آيات (يجلب التطبيق نصها تلقائياً) أو حديثاً أو أبياتاً. احفظها بمساعدة إخفاء الكلمات وأوائل الحروف، ثم يذكّرك التطبيق بمراجعتها قبل أن تنساها: بعد يوم، ثم ثلاثة أيام، ثم أسابيع، ثم أشهر.', addBtn('hz-new', 'أول نص'))}
  </section>`;
}

// ---------- editor ----------
function openHifz(id) {
  const h = id ? getHz(id) : normalizeHifz({ type: hzUi.type || 'quran' });
  ldraft = { kind: 'hifz', id: h.id, isNew: !id, type: h.type };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? 'تعديل النص' : 'نص جديد للحفظ'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="seg seg-wrap" id="hType" role="group" aria-label="النوع">${Object.entries(HIFZ_TYPES).map(([k, v]) => `<button type="button" data-action="hz-set-type" data-v="${k}" aria-pressed="${h.type === k}">${v[1]} ${v[0]}</button>`).join('')}</div>
    <div id="hQuran" class="hz-quran"${h.type === 'quran' ? '' : ' hidden'}>
      <label class="field"><span>السورة</span><select id="hSurah">${SURAHS.map((s, i) => `<option value="${i + 1}"${h.surah === i + 1 ? ' selected' : ''}>${i + 1}. ${s} (${AYAT[i]})</option>`).join('')}</select></label>
      <div class="grid2">
        <label class="field"><span>من آية</span><input type="number" id="hFrom" min="1" inputmode="numeric" value="${h.from || 1}"></label>
        <label class="field"><span>إلى آية</span><input type="number" id="hTo" min="1" inputmode="numeric" value="${h.to || ''}" placeholder="مثال: 5"></label>
      </div>
      <button type="button" class="ghost" data-action="hz-fetch">${icon('book')} اجلب نص الآيات</button>
    </div>
    <label class="field"><span id="hTitleL">${h.type === 'quran' ? 'عنوان (اختياري)' : 'العنوان'}</span><input type="text" id="hTitle" value="${esc(h.title)}" autocomplete="off" placeholder="${{ quran: 'يُكتب تلقائياً من السورة والآيات', hadith: 'مثال: إنما الأعمال بالنيات', poem: 'مثال: لامية ابن الوردي', other: 'مثال: متن الآجرومية' }[h.type]}"></label>
    <label class="field"><span>النص</span><textarea id="hText" rows="7" placeholder="${h.type === 'poem' ? 'الصق القصيدة كما هي من أي موقع، وسيرتّبها التطبيق' : 'اكتب النص أو الصقه هنا'}">${esc(h.text)}</textarea></label>
    <div class="hz-poemtools" id="hPoemTools"${h.type === 'poem' ? '' : ' hidden'}>
      <div class="field"><span>كيف وصلت الأبيات؟</span><div class="seg seg-wrap" id="hPoemMode" role="group">
        <button type="button" data-action="hz-pmode" data-v="auto" aria-pressed="true">اكتشاف تلقائي</button>
        <button type="button" data-action="hz-pmode" data-v="pairs" aria-pressed="false">كل سطرين بيت</button>
        <button type="button" data-action="hz-pmode" data-v="sep" aria-pressed="false">كل سطر بيت</button>
      </div></div>
      <div class="hz-preview" id="hPoemPrev" aria-live="polite"></div>
      ${id ? '' : `<label class="field"><span>قسّمها للحفظ</span><select id="hSplit"><option value="0">بطاقة واحدة</option><option value="4">كل ٤ أبيات بطاقة</option><option value="5" selected>كل ٥ أبيات بطاقة</option><option value="8">كل ٨ أبيات بطاقة</option><option value="10">كل ١٠ أبيات بطاقة</option></select></label>
      <p class="note-text">القصيدة الطويلة تُحفظ أسهل مقطعاً مقطعاً، ولكل مقطع مراجعته الخاصة.</p>`}
    </div>
    <label class="field" id="hSourceW"${h.type === 'quran' ? ' hidden' : ''}><span>${h.type === 'poem' ? 'الشاعر' : h.type === 'hadith' ? 'الراوي والمصدر' : 'المصدر'}</span><input type="text" id="hSource" value="${esc(h.source)}" autocomplete="off" placeholder="${h.type === 'hadith' ? 'مثال: عن عمر رضي الله عنه، متفق عليه' : ''}"></label>
    ${id && h.state === 'review' ? `<p class="note-text">في المراجعة · المراجعة القادمة ${esc(dateBoth(h.due, true))} · روجع ${h.reps} ${h.reps === 1 ? 'مرة' : 'مرات'}</p>` : ''}
    <div class="sheet-actions">
      <button type="submit" class="primary">${id ? 'حفظ' : 'أضف وابدأ الحفظ'}</button>
      ${id && h.state === 'review' ? '<button type="button" class="ghost" data-action="hz-relearn">أعده للحفظ</button>' : ''}
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  poemPreview();
}

function setHzType(type) {
  ldraft.type = type;
  for (const b of $('hType').children) b.setAttribute('aria-pressed', String(b.dataset.v === type));
  $('hQuran').hidden = type !== 'quran';
  $('hSourceW').hidden = type === 'quran';
  $('hSourceW').querySelector('span').textContent = type === 'poem' ? 'الشاعر' : type === 'hadith' ? 'الراوي والمصدر' : 'المصدر';
  $('hTitleL').textContent = type === 'quran' ? 'عنوان (اختياري)' : 'العنوان';
  $('hText').placeholder = type === 'poem' ? 'الصق القصيدة كما هي من أي موقع، وسيرتّبها التطبيق' : 'اكتب النص أو الصقه هنا';
  $('hPoemTools').hidden = type !== 'poem';
  poemPreview();
}

// live preview of how the pasted poem was read
function poemPreview() {
  const box = $('hPoemPrev');
  if (!box || !ldraft || ldraft.type !== 'poem') return;
  const ab = parsePoem($('hText').value, ldraft.pmode || 'auto');
  const halves = ab.filter(([, b]) => !b).length;
  box.innerHTML = ab.length ? `<div class="row-between"><b>معاينة: ${plural(ab.length, 'بيت واحد', 'بيتان', 'أبيات', 'بيتاً')}</b>${halves && ab.length > 1 ? '<small class="late">أبيات بلا عجز؟ جرّب «كل سطرين بيت»</small>' : ''}</div>
    ${hzTextHTML({ type: 'poem', text: poemToText(ab.slice(0, 40)) }, 'full')}${ab.length > 40 ? '<p class="note-text">…</p>' : ''}` : '';
}

function quranRange() {
  const s = +$('hSurah').value, max = AYAT[s - 1];
  const from = Math.min(max, Math.max(1, parseInt($('hFrom').value, 10) || 1));
  const to = Math.min(max, Math.max(from, parseInt($('hTo').value, 10) || from));
  return { s, from, to };
}

// the ayat's text from the open Quran API (needs internet); the user can always paste it instead
async function fetchAyat(btn) {
  const { s, from, to } = quranRange();
  btn.disabled = true;
  const label = btn.innerHTML;
  btn.textContent = 'جارٍ الجلب…';
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${s}/quran-uthmani?offset=${from - 1}&limit=${to - from + 1}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const ayahs = (data.data && data.data.ayahs) || [];
    if (!ayahs.length) throw new Error('empty');
    const num = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
    $('hText').value = ayahs.map((a) => {
      let t = a.text.trim();
      // the API puts the basmala inside the first ayah of most surahs
      if (a.numberInSurah === 1 && s !== 1 && s !== 9) t = t.split(/\s+/).slice(4).join(' ');
      return `${t} ﴿${num(a.numberInSurah)}﴾`;
    }).join('\n');
    $('hFrom').value = from; $('hTo').value = to;
    toast(`جُلبت ${to - from + 1} ${to - from + 1 <= 10 && to - from + 1 >= 3 ? 'آيات' : 'آية'}`);
  } catch {
    toast('تعذّر جلب الآيات. تحقق من الإنترنت، أو الصق النص بنفسك.');
  }
  if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
}

function saveHifz() {
  const old = getHz(ldraft.id);
  const type = ldraft.type;
  let text = $('hText').value.trim();
  if (!text) { toast(type === 'quran' ? 'اجلب نص الآيات أو الصقه.' : 'اكتب النص.'); return false; }
  const q = type === 'quran' ? quranRange() : { s: 0, from: 0, to: 0 };
  const title = $('hTitle').value.trim(), source = type === 'quran' ? '' : $('hSource').value.trim();
  if (type === 'poem') {
    const ab = parsePoem(text, ldraft.pmode || 'auto');
    const size = !old && $('hSplit') ? +$('hSplit').value : 0;
    // a long poem becomes one card per part, each with its own review
    if (size && ab.length > size) {
      const parts = [];
      for (let i = 0; i < ab.length; i += size) parts.push(normalizeHifz({ type, title: `${title || excerpt(ab[0][0], 30)} (${i + 1}–${Math.min(i + size, ab.length)})`, text: poemToText(ab.slice(i, i + size)), source }));
      S.hifz.push(...parts);
      save();
      toast(`قُسّمت إلى ${parts.length} ${parts.length <= 10 ? 'مقاطع' : 'مقطعاً'}، ابدأ بالأول`);
      setTimeout(() => openStudy('learn', parts[0].id), 50);
      return true;
    }
    text = poemToText(ab);
  }
  const h = normalizeHifz({ ...(old || {}), id: ldraft.id, type, text, title, source, surah: q.s, from: q.from, to: q.to });
  if (old) Object.assign(old, h); else S.hifz.push(h);
  save();
  if (!old) setTimeout(() => openStudy('learn', h.id), 50);
  return true;
}

// ---------- study (full screen): learning one text, or reviewing what is due ----------
let hzs = null; // { mode: 'learn'|'review', queue: [ids], i, view, shown, done }
function openStudy(mode, id) {
  const queue = mode === 'review' ? hzDue().sort((a, b) => a.due.localeCompare(b.due)).map((h) => h.id) : [id];
  if (!queue.length) { toast('لا مراجعة مستحقة الآن.'); return; }
  hzs = { mode, queue, i: 0, view: mode === 'learn' ? 'full' : 'hidden', shown: false, done: 0 };
  renderStudy();
  const d = $('hzStudy');
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function closeStudy() {
  hzs = null;
  const d = $('hzStudy');
  if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
  render();
}

function renderStudy() {
  const h = getHz(hzs.queue[hzs.i]);
  if (!h) { closeStudy(); return; }
  const t = HIFZ_TYPES[h.type];
  const views = h.type === 'poem'
    ? [['full', 'كاملة'], ['sadr', 'إخفاء العجز'], ['shatr', 'أوائل الأشطر'], ['letters', 'أوائل الكلمات'], ['gaps', 'إخفاء بعض الكلمات'], ['hidden', 'إخفاء الكل']]
    : [['full', 'النص كاملاً'], ['letters', 'أوائل الكلمات'], ['gaps', 'إخفاء بعض الكلمات'], ['hidden', 'إخفاء الكل']];
  $('hzHead').innerHTML = `<b>${t[1]} ${esc(hzTitle(h))}</b><small>${hzs.mode === 'review' ? `مراجعة ${hzs.i + 1} من ${hzs.queue.length}` : 'مرحلة الحفظ'}${h.source ? ` · ${esc(h.source)}` : ''}</small>`;
  const grades = [['again', 'نسيت'], ['hard', 'صعب'], ['good', 'جيد'], ['easy', 'سهل']];
  $('hzBody').innerHTML = `
    <div class="seg seg-wrap hz-views" role="group" aria-label="طريقة العرض">${views.map(([v, l]) => `<button type="button" data-hz="view" data-v="${v}" aria-pressed="${hzs.view === v}">${l}</button>`).join('')}</div>
    <p class="note-text">${hzs.view === 'full' ? (h.type === 'poem' ? 'اقرأها بتمهّل بيتاً بيتاً، ثم جرّب «إخفاء العجز»: تقرأ الصدر وتكمل العجز من ذاكرتك، ثم «أوائل الأشطر» فـ«إخفاء الكل».' : 'اقرأه بتمهّل مرات، ثم جرّب «أوائل الكلمات» فـ«إخفاء الكل».')
      : `سمّع من ذاكرتك، واضغط على أي كلمة مخفية لتظهرها${h.type === 'poem' ? '، أو على رقم البيت ليظهر كله' : ''}.`}</p>
    ${hzTextHTML(h, hzs.view)}`;
  $('hzFoot').innerHTML = hzs.mode === 'learn'
    ? `<button type="button" class="primary" data-hz="learned">✓ حفظته، أدخله المراجعة</button><button type="button" class="ghost" data-hz="edit">تعديل النص</button><button type="button" class="ghost" data-hz="close">لاحقاً</button>`
    : !hzs.shown && hzs.view !== 'full'
      ? `<button type="button" class="primary" data-hz="show">أظهر النص للتحقق</button>`
      : `<div class="hz-grades">${grades.map(([g, l]) => { const n = hzNext(h, g); return `<button type="button" class="g-${g}" data-hz="grade" data-v="${g}"><b>${l}</b><small>${esc(inDays(n.interval))}</small></button>`; }).join('')}</div>`;
}

document.addEventListener('click', (e) => {
  const w = e.target.closest('#hzBody .hz-hid, #hzBody .hz-l');
  if (w) { w.textContent = w.dataset.w; w.classList.remove('hz-hid', 'hz-l'); w.classList.add('hz-shown'); return; }
  const el = e.target.closest('[data-hz]');
  if (!el) return;
  if (el.dataset.hz === 'bayt') {
    for (const x of el.parentNode.querySelectorAll('.hz-hid, .hz-l')) { x.textContent = x.dataset.w; x.classList.remove('hz-hid', 'hz-l'); x.classList.add('hz-shown'); }
    return;
  }
  if (!hzs) return;
  const h = getHz(hzs.queue[hzs.i]);
  switch (el.dataset.hz) {
    case 'close': closeStudy(); break;
    case 'edit': { const id = h.id; closeStudy(); openHifz(id); break; }
    case 'view': hzs.view = el.dataset.v; if (hzs.view === 'full') hzs.shown = true; renderStudy(); break;
    case 'show': hzs.view = 'full'; hzs.shown = true; renderStudy(); break;
    case 'learned':
      Object.assign(h, { state: 'review', reps: 0, interval: 1, due: addDays(today(), 1), learnedAt: today(), last: today() });
      save();
      toast('أحسنت! ستراجعه غداً ثم في أوقات متباعدة');
      closeStudy();
      break;
    case 'grade': {
      Object.assign(h, hzNext(h, el.dataset.v));
      save();
      hzs.done++;
      hzs.i++;
      hzs.shown = false;
      hzs.view = 'hidden';
      if (hzs.i >= hzs.queue.length) { toast(`أتممت مراجعة اليوم (${hzs.done}). بارك الله فيك`); closeStudy(); } else renderStudy();
      break;
    }
  }
});

// ---------- page events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="hz-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'hz-new': openHifz(null); break;
    case 'hz-open': {
      const h = getHz(v);
      if (h && h.state === 'learn') openStudy('learn', v); else openHifz(v);
      break;
    }
    case 'hz-type': hzUi.type = v; render(); break;
    case 'hz-set-type': setHzType(v); break;
    case 'hz-pmode':
      ldraft.pmode = v;
      for (const b of $('hPoemMode').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      poemPreview();
      break;
    case 'hz-fetch': fetchAyat(el); break;
    case 'hz-review': openStudy('review'); break;
    case 'hz-relearn': {
      const h = getHz(ldraft.id);
      Object.assign(h, { state: 'learn', reps: 0, interval: 0, due: '' });
      save(); closeLib(); render(); openStudy('learn', h.id);
      break;
    }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'hText') poemPreview();
  if (e.target.id === 'hzSearch') { hzUi.q = e.target.value; render(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'hSurah' && !$('hTo').value) $('hTo').value = Math.min(AYAT[+e.target.value - 1], 5);
});

Object.assign(LibraryViews, { hifz: viewHifz });
