'use strict';
// «سيرتي الذاتية»: a very flexible CV. Several versions (e.g. one per kind of job, Arabic and English),
// each with its own sections that can be added, renamed, reordered, hidden or removed, and any item
// hidden without deleting it. Section kinds: text, entries (job, degree, course…), tags with level
// (skills, languages), simple list, and label/value facts. Three looks; exports to Word and PDF.

const CV_TYPES = { text: 'نص', entries: 'سجلات (خبرة، تعليم، دورة…)', tags: 'مهارات بمستوى', list: 'قائمة', facts: 'معلومات (عنوان وقيمة)' };
const CV_THEMES = { classic: 'كلاسيكي', modern: 'عصري', minimal: 'بسيط' };
const CV_ACCENTS = ['#0f6e5e', '#1f4e79', '#7a1f3d', '#8a5a00', '#3b3b3b', '#5b3fa0'];
const CV_SUGGEST = { ar: ['المشاريع', 'العمل التطوعي', 'الجوائز', 'العضويات', 'المنشورات والأبحاث', 'الهوايات', 'المراجع'], en: ['Projects', 'Volunteering', 'Awards', 'Memberships', 'Publications', 'Interests', 'References'] };
const LEVELS = { ar: ['', 'مبتدئ', 'متوسط', 'جيد', 'متقدم', 'خبير'], en: ['', 'Beginner', 'Intermediate', 'Good', 'Advanced', 'Expert'] };
const cvUi = { id: '', mode: 'edit', open: '' };

const cvItem = (x) => ({ id: x.id || uid(), hidden: !!x.hidden, ...x });
function defaultSections(lang) {
  const ar = lang !== 'en';
  const s = (type, title, extra = {}) => ({ id: uid(), type, title, hidden: false, text: '', items: [], ...extra });
  return [
    s('text', ar ? 'نبذة عني' : 'Profile'),
    s('entries', ar ? 'الخبرات العملية' : 'Experience'),
    s('entries', ar ? 'المؤهلات العلمية' : 'Education'),
    s('entries', ar ? 'الدورات والشهادات' : 'Courses & Certificates'),
    s('tags', ar ? 'المهارات' : 'Skills'),
    s('tags', ar ? 'اللغات' : 'Languages', { items: [cvItem({ name: ar ? 'العربية' : 'Arabic', level: 5 })] }),
    s('list', ar ? 'الإنجازات' : 'Achievements'),
    s('facts', ar ? 'معلومات شخصية' : 'Personal details', { hidden: true, items: ar ? [cvItem({ label: 'الجنسية', value: '' }), cvItem({ label: 'الحالة الاجتماعية', value: '' })] : [cvItem({ label: 'Nationality', value: '' })] }),
  ];
}
function normalizeCV(c) {
  const lang = c.lang === 'en' ? 'en' : 'ar';
  return {
    id: c.id || uid(), name: String(c.name || (lang === 'en' ? 'English CV' : 'السيرة العامة')), lang,
    theme: CV_THEMES[c.theme] ? c.theme : 'classic', accent: c.accent || CV_ACCENTS[0], photo: c.photo || '',
    person: { name: '', title: '', phone: '', email: '', city: '', ...(c.person || {}), links: ((c.person && c.person.links) || []).map(cvItem) },
    sections: (Array.isArray(c.sections) ? c.sections : defaultSections(lang)).map((s) => ({ id: s.id || uid(), type: CV_TYPES[s.type] ? s.type : 'list', title: String(s.title || ''), hidden: !!s.hidden, text: String(s.text || ''), items: (s.items || []).map(cvItem) })),
    created: c.created || Date.now(), updated: c.updated || Date.now(),
  };
}
const curCV = () => S.cvs.find((c) => c.id === cvUi.id) || S.cvs[0] || null;
const getSec = (cv, sid) => cv.sections.find((s) => s.id === sid);
const visible = (arr) => arr.filter((x) => !x.hidden);
const lines = (s) => String(s || '').split('\n').map((x) => x.replace(/^[•\-–*]\s*/, '').trim()).filter(Boolean);
const period = (x, en) => [x.from, x.current ? (en ? 'Present' : 'حتى الآن') : x.to].filter(Boolean).join(' – ');

// ---------- the CV itself (preview, print) ----------
function cvDocHTML(cv) {
  const en = cv.lang === 'en';
  const p = cv.person;
  const contact = [p.phone && `<span dir="ltr" data-latin>${esc(p.phone)}</span>`, p.email && `<span dir="ltr" data-latin>${esc(p.email)}</span>`, p.city && esc(p.city), ...visible(p.links).filter((l) => l.url).map((l) => `<a href="${esc(/^https?:/.test(l.url) ? l.url : `https://${l.url}`)}" target="_blank" rel="noopener" dir="ltr">${esc(l.label || l.url.replace(/^https?:\/\/(www\.)?/, ''))}</a>`)].filter(Boolean);
  const sec = (s) => {
    let body = '';
    if (s.type === 'text') { if (!s.text.trim()) return ''; body = lines(s.text).map((l) => `<p>${esc(l)}</p>`).join(''); }
    else {
      const items = visible(s.items);
      if (!items.length) return '';
      if (s.type === 'entries') body = items.map((x) => `<div class="cv-entry">
        <div class="cv-eh"><b>${esc(x.title)}</b>${period(x, en) ? `<span class="cv-date">${esc(period(x, en))}</span>` : ''}</div>
        ${x.org || x.place ? `<div class="cv-org">${esc([x.org, x.place].filter(Boolean).join(en ? ', ' : '، '))}</div>` : ''}
        ${lines(x.desc).length ? `<ul>${lines(x.desc).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
      if (s.type === 'tags') body = `<ul class="cv-tags">${items.filter((x) => x.name).map((x) => `<li>${esc(x.name)}${x.level ? `<span class="cv-lvl" aria-label="${LEVELS[cv.lang][x.level]}">${'●'.repeat(x.level)}<i>${'●'.repeat(5 - x.level)}</i></span>` : ''}</li>`).join('')}</ul>`;
      if (s.type === 'list') body = `<ul>${items.filter((x) => x.text).map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>`;
      if (s.type === 'facts') { const f = items.filter((x) => x.label && x.value); if (!f.length) return ''; body = `<dl class="cv-facts">${f.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>`; }
    }
    return `<section class="cv-sec t-${s.type}"><h2>${esc(s.title)}</h2>${body}</section>`;
  };
  return `<article class="cv-doc th-${cv.theme}" dir="${en ? 'ltr' : 'rtl'}" lang="${cv.lang}"${en ? ' data-latin' : ''} style="--cv:${esc(cv.accent)}">
    <header class="cv-head">
      ${cv.photo ? `<img class="cv-photo" data-img="${esc(cv.photo)}" alt="">` : ''}
      <div><h1>${esc(p.name || (en ? 'Your name' : 'اسمك'))}</h1>${p.title ? `<p class="cv-title">${esc(p.title)}</p>` : ''}
      ${contact.length ? `<p class="cv-contact">${contact.join('<span class="sep">|</span>')}</p>` : ''}</div>
    </header>
    ${visible(cv.sections).map(sec).join('')}
  </article>`;
}

// ---------- editor ----------
const ib = (attrs, val, ph, extra = '') => `<input type="text" ${attrs} value="${esc(val || '')}" placeholder="${ph}" aria-label="${ph}" autocomplete="off"${extra}>`;
const ctlBtns = (act, ids, i, n, hidden) => `<span class="cv-ctl">
  <button type="button" data-action="${act}-move" ${ids} data-d="-1" aria-label="تقديم"${i ? '' : ' disabled'}>${icon('prev')}</button>
  <button type="button" data-action="${act}-move" ${ids} data-d="1" aria-label="تأخير"${i < n - 1 ? '' : ' disabled'}>${icon('next')}</button>
  <button type="button" data-action="${act}-hide" ${ids} aria-pressed="${!!hidden}" aria-label="${hidden ? 'إظهار' : 'إخفاء'}">${hidden ? '🙈' : '👁'}</button>
  <button type="button" class="j-m-del" data-action="${act}-del" ${ids} aria-label="حذف">✕</button></span>`;

function itemEditor(cv, s, x, i, n) {
  const en = cv.lang === 'en';
  const at = (k) => `id="cv-${x.id}-${k}" data-cv="item" data-sid="${s.id}" data-iid="${x.id}" data-k="${k}"`;
  const ids = `data-sid="${s.id}" data-v="${x.id}"`;
  if (s.type === 'entries') return `<div class="cv-item${x.hidden ? ' off' : ''}">
    <div class="row-between"><b>${esc(x.title || (en ? 'New entry' : 'سجل جديد'))}</b>${ctlBtns('cvi', ids, i, n, x.hidden)}</div>
    ${ib(at('title'), x.title, en ? 'Title / degree' : 'المسمى أو المؤهل')}
    <div class="grid2">${ib(at('org'), x.org, en ? 'Organisation' : 'الجهة')}${ib(at('place'), x.place, en ? 'City' : 'المدينة')}</div>
    <div class="grid2">${ib(at('from'), x.from, en ? 'From (e.g. 2021)' : 'من (مثال: ٢٠٢١)')}${x.current ? `<span class="cv-now">${en ? 'Present' : 'حتى الآن'}</span>` : ib(at('to'), x.to, en ? 'To' : 'إلى')}</div>
    <label class="switch"><input type="checkbox" ${at('current')}${x.current ? ' checked' : ''}><span>${en ? 'Current' : 'ما زلت فيه'}</span></label>
    <textarea ${at('desc')} rows="3" placeholder="${en ? 'Achievements, one per line' : 'المهام والإنجازات، كل واحدة في سطر'}">${esc(x.desc || '')}</textarea>
    ${AI.on() ? `<button type="button" class="ghost ai-btn" data-action="cv-ai-desc" data-sid="${s.id}" data-v="${x.id}">${icon('spark')} ${en ? 'Polish with AI' : 'حسّن الصياغة'}</button>` : ''}
  </div>`;
  if (s.type === 'tags') return `<div class="cv-row${x.hidden ? ' off' : ''}">${ib(at('name'), x.name, en ? 'Skill' : 'المهارة')}
    <select ${at('level')} aria-label="المستوى">${LEVELS[cv.lang].map((l, k) => `<option value="${k}"${(x.level || 0) === k ? ' selected' : ''}>${l || (en ? 'No level' : 'بلا مستوى')}</option>`).join('')}</select>${ctlBtns('cvi', ids, i, n, x.hidden)}</div>`;
  if (s.type === 'facts') return `<div class="cv-row${x.hidden ? ' off' : ''}">${ib(at('label'), x.label, en ? 'Label' : 'العنوان')}${ib(at('value'), x.value, en ? 'Value' : 'القيمة')}${ctlBtns('cvi', ids, i, n, x.hidden)}</div>`;
  return `<div class="cv-row${x.hidden ? ' off' : ''}">${ib(at('text'), x.text, en ? 'Item' : 'البند')}${ctlBtns('cvi', ids, i, n, x.hidden)}</div>`;
}

function sectionEditor(cv, s, i, n) {
  const en = cv.lang === 'en';
  const open = cvUi.open === s.id;
  const count = s.type === 'text' ? (s.text.trim() ? '✓' : '') : visible(s.items).length || '';
  return `<div class="cv-sec-ed${s.hidden ? ' off' : ''}${open ? ' open' : ''}">
    <div class="cv-sec-h">
      <button type="button" class="cv-toggle" data-action="cv-open" data-v="${s.id}" aria-expanded="${open}"><b>${esc(s.title || '—')}</b><small>${CV_TYPES[s.type]}${count ? ` · ${count}` : ''}${s.hidden ? ' · مخفي' : ''}</small></button>
      ${ctlBtns('cvs', `data-v="${s.id}"`, i, n, s.hidden)}
    </div>
    ${open ? `<div class="cv-sec-b">
      ${ib(`id="cv-${s.id}-title" data-cv="sec" data-sid="${s.id}" data-k="title"`, s.title, en ? 'Section title' : 'عنوان القسم')}
      ${s.type === 'text' ? `<textarea id="cv-${s.id}-text" data-cv="sec" data-sid="${s.id}" data-k="text" rows="5" placeholder="${en ? 'A short summary of who you are and what you offer' : 'من أنت وماذا تقدّم، في سطور قليلة'}">${esc(s.text)}</textarea>
        ${AI.on() ? `<button type="button" class="ghost ai-btn" data-action="cv-ai-summary" data-sid="${s.id}">${icon('spark')} ${en ? 'Write it from my CV' : 'اكتبها من بيانات سيرتي'}</button>` : ''}`
        : `${s.items.map((x, k) => itemEditor(cv, s, x, k, s.items.length)).join('')}
        <button type="button" class="fin-add" data-action="cv-item-add" data-sid="${s.id}">${icon('plus')} ${en ? 'Add' : 'إضافة'}</button>`}
    </div>` : ''}
  </div>`;
}

function viewCV() {
  const cv = curCV();
  if (!cv) {
    return `${moreCrumb()}<section class="section"><h2>سيرتي الذاتية</h2>
      ${emptyHTML('ابدأ سيرتك الذاتية', 'سيرة مرنة: أقسام تضيفها وتسمّيها وترتّبها كما تشاء، وتُخفي ما لا يناسب وظيفة معيّنة دون حذفه، ونسخ متعددة (عامة، لوظيفة بعينها، بالإنجليزية)، وثلاثة أشكال، وتصدير وورد وPDF.',
        `<div class="btn-row">${addBtn('cv-new', 'سيرة بالعربية', ' data-v="ar"')}${addBtn('cv-new', 'English CV', ' data-v="en"')}</div>`)}</section>`;
  }
  cvUi.id = cv.id;
  const en = cv.lang === 'en';
  const p = cv.person;
  const pa = (k) => `id="cv-p-${k}" data-cv="person" data-k="${k}"`;
  return `${moreCrumb()}
  <section class="section cv-page">
    <div class="section-head"><h2>سيرتي الذاتية</h2><div class="btn-row">
      <button type="button" class="xls-btn word-btn" data-action="cv-word">${icon('note')}وورد</button>
      <button type="button" class="xls-btn" data-action="cv-pdf">PDF</button>
    </div></div>
    <div class="chips" role="group" aria-label="النسخ">${S.cvs.map((c) => `<button type="button" class="chip" data-action="cv-pick" data-v="${c.id}" aria-pressed="${c.id === cv.id}">${esc(c.name)}</button>`).join('')}
      <button type="button" class="chip" data-action="cv-dup">${icon('plus')} نسخة منها</button></div>
    <div class="seg" role="group"><button type="button" data-action="cv-mode" data-v="edit" aria-pressed="${cvUi.mode === 'edit'}">تحرير</button><button type="button" data-action="cv-mode" data-v="preview" aria-pressed="${cvUi.mode === 'preview'}">معاينة</button></div>
    ${cvUi.mode === 'preview' ? `<div class="cv-frame">${cvDocHTML(cv)}</div>` : `
    <details class="panel cv-style" id="cvStyle"${cvUi.styleOpen ? ' open' : ''}><summary><b>اسم النسخة والشكل</b><small>${esc(cv.name)} · ${CV_THEMES[cv.theme]} · ${en ? 'English' : 'العربية'}</small></summary>
      ${ib('id="cv-name" data-cv="cv" data-k="name"', cv.name, 'اسم النسخة (مثل: لوظيفة مدير مشاريع)')}
      <div class="field"><span>اللغة</span><div class="seg" role="group">${[['ar', 'العربية (من اليمين)'], ['en', 'English (LTR)']].map(([v, l]) => `<button type="button" data-action="cv-set" data-k="lang" data-v="${v}" aria-pressed="${cv.lang === v}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>الشكل</span><div class="seg" role="group">${Object.entries(CV_THEMES).map(([v, l]) => `<button type="button" data-action="cv-set" data-k="theme" data-v="${v}" aria-pressed="${cv.theme === v}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>اللون</span><div class="swatches">${CV_ACCENTS.map((c) => `<button type="button" class="swatch" style="--c:${c}" data-action="cv-set" data-k="accent" data-v="${c}" aria-pressed="${cv.accent === c}" aria-label="${c}"></button>`).join('')}</div></div>
      <div class="field"><span>الصورة الشخصية (اختيارية)</span><div class="btn-row">
        <label class="ghost cv-photo-btn">${cv.photo ? 'تغيير الصورة' : 'أضف صورة'}<input type="file" id="cvPhoto" accept="image/*" hidden></label>
        ${cv.photo ? '<button type="button" class="ghost" data-action="cv-photo-del">إزالة الصورة</button>' : ''}</div></div>
      <div class="btn-row"><button type="button" class="danger" data-action="cv-del">حذف هذه النسخة</button></div>
    </details>
    <div class="panel"><h3>${en ? 'Personal' : 'البيانات الأساسية'}</h3>
      ${ib(pa('name'), p.name, en ? 'Full name' : 'الاسم الكامل')}
      ${ib(pa('title'), p.title, en ? 'Headline (e.g. Project Manager)' : 'المسمى (مثال: مدير مشاريع)')}
      <div class="grid2">${ib(pa('phone'), p.phone, en ? 'Phone' : 'الجوال', ' dir="ltr" inputmode="tel" data-novoice')}${ib(pa('email'), p.email, en ? 'Email' : 'البريد', ' dir="ltr" inputmode="email" data-novoice')}</div>
      ${ib(pa('city'), p.city, en ? 'City, Country' : 'المدينة')}
      <div class="cv-links">${p.links.map((l, k) => `<div class="cv-row">${ib(`id="cv-l-${l.id}-label" data-cv="link" data-iid="${l.id}" data-k="label"`, l.label, en ? 'Label (LinkedIn)' : 'الاسم (لينكدإن)')}${ib(`id="cv-l-${l.id}-url" data-cv="link" data-iid="${l.id}" data-k="url"`, l.url, 'https://', ' dir="ltr" data-novoice')}<span class="cv-ctl"><button type="button" class="j-m-del" data-action="cv-link-del" data-v="${l.id}" aria-label="حذف">✕</button></span></div>`).join('')}
        <button type="button" class="fin-add" data-action="cv-link-add">${icon('plus')} ${en ? 'Link' : 'رابط (لينكدإن، موقع، معرض أعمال)'}</button></div>
    </div>
    <h3 class="j-month">${en ? 'Sections' : 'الأقسام'} <small>${en ? 'tap to edit · ↑↓ order · 👁 show/hide' : 'اضغط القسم لتحريره · ↑↓ للترتيب · 👁 للإظهار والإخفاء'}</small></h3>
    <div class="cv-secs">${cv.sections.map((s, i) => sectionEditor(cv, s, i, cv.sections.length)).join('')}</div>
    <button type="button" class="add-btn" data-action="cv-sec-new">${icon('plus')} ${en ? 'New section' : 'قسم جديد'}</button>`}
  </section>`;
}

// ---------- new section (sheet) ----------
function openCVSection() {
  const cv = curCV();
  ldraft = { kind: 'cvsec', id: cv.id, isNew: true, type: 'entries' };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>قسم جديد</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>العنوان</span><input type="text" id="csTitle" list="csSug" autocomplete="off" placeholder="${cv.lang === 'en' ? 'e.g. Projects' : 'مثال: المشاريع'}"></label>
    <datalist id="csSug">${CV_SUGGEST[cv.lang].map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="chips wrap">${CV_SUGGEST[cv.lang].map((t) => `<button type="button" class="chip" data-action="cv-sug" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="field"><span>نوع المحتوى</span><div class="seg seg-wrap" id="csType" role="group">${Object.entries(CV_TYPES).map(([k, l]) => `<button type="button" data-action="cv-sectype" data-v="${k}" aria-pressed="${k === 'entries'}">${l}</button>`).join('')}</div></div>
    <div class="sheet-actions"><button type="submit" class="primary">أضف القسم</button></div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function saveCVSection() {
  const cv = curCV();
  const title = $('csTitle').value.trim();
  if (!title) { toast('اكتب عنوان القسم.'); return false; }
  const s = { id: uid(), type: ldraft.type, title, hidden: false, text: '', items: ldraft.type === 'text' ? [] : [cvItem({})] };
  cv.sections.push(s);
  cvUi.open = s.id;
  cv.updated = Date.now();
  save();
  return true;
}

// ---------- exports ----------
function exportCVWord() {
  const cv = curCV();
  const en = cv.lang === 'en';
  const p = cv.person;
  const P = [{ style: 'Title', text: p.name || '' }];
  if (p.title) P.push({ style: 'Meta', text: p.title, center: true });
  const contact = [p.phone, p.email, p.city, ...visible(p.links).map((l) => l.url)].filter(Boolean).join('  |  ');
  if (contact) P.push({ style: 'Meta', text: contact, center: true });
  for (const s of visible(cv.sections)) {
    const items = visible(s.items);
    if (s.type === 'text' ? !s.text.trim() : !items.length) continue;
    P.push({ style: 'Heading1', text: s.title });
    if (s.type === 'text') lines(s.text).forEach((l) => P.push({ text: l }));
    if (s.type === 'entries') for (const x of items) {
      P.push({ style: 'Question', runs: [{ text: x.title || '', bold: true }, ...(period(x, en) ? [{ text: `   ${period(x, en)}` }] : [])] });
      if (x.org || x.place) P.push({ style: 'Meta', text: [x.org, x.place].filter(Boolean).join(en ? ', ' : '، ') });
      lines(x.desc).forEach((l, k, a) => P.push({ style: k === a.length - 1 ? 'Normal' : 'Tight', text: `•  ${l}` }));
    }
    if (s.type === 'tags') P.push({ text: items.filter((x) => x.name).map((x) => (x.level ? `${x.name} (${LEVELS[cv.lang][x.level]})` : x.name)).join(en ? '  ·  ' : '  ·  ') });
    if (s.type === 'list') items.filter((x) => x.text).forEach((x, k, a) => P.push({ style: k === a.length - 1 ? 'Normal' : 'Tight', text: `•  ${x.text}` }));
    if (s.type === 'facts') items.filter((x) => x.label && x.value).forEach((x, k, a) => P.push({ style: k === a.length - 1 ? 'Normal' : 'Tight', runs: [{ text: `${x.label}: `, bold: true }, { text: x.value }] }));
  }
  const blob = Docx.build(P, { title: p.name || 'CV', rtl: !en, font: en ? 'Calibri' : 'Traditional Arabic', accent: cv.accent.replace('#', '').toUpperCase() });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // an ASCII name: some phones and browsers drop non-Latin download names
  const slug = (p.name || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  a.download = `cv-${slug || cv.lang}-${today()}.docx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('جُهّز ملف الوورد. تجده في التنزيلات.');
}
async function exportCVPdf() {
  const cv = curCV();
  let box = $('cvPrint');
  if (!box) { box = document.createElement('div'); box.id = 'cvPrint'; document.body.append(box); }
  box.innerHTML = cvDocHTML(cv);
  await hydrateImages(box);
  document.body.classList.add('print-cv');
  const done = () => { document.body.classList.remove('print-cv'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  toast('اختر «حفظ بتنسيق PDF» من نافذة الطباعة');
  setTimeout(() => window.print(), 300);
}

// ---------- AI ----------
async function cvAI(kind, sid, iid, btn) {
  const cv = curCV();
  const en = cv.lang === 'en';
  btn.disabled = true;
  try {
    if (kind === 'desc') {
      const x = getSec(cv, sid).items.find((i) => i.id === iid);
      const out = await AI.ask({
        system: `You improve CV bullet points${en ? ' in English' : ' in Arabic'}. Strong action verbs, concrete results, concise, no invented facts or numbers. Return one bullet per line, no symbols at line start.`,
        prompt: `Role: ${x.title}\nOrganisation: ${x.org}\nCurrent text:\n${x.desc || '(empty: suggest 3 typical bullets for this role, marked as suggestions to edit)'}`,
        effort: 'low', maxTokens: 2000,
      });
      if (out) { x.desc = out.trim(); save(); render(); }
    } else {
      const s = getSec(cv, sid);
      const facts = cv.sections.filter((z) => z.type !== 'text' && !z.hidden).map((z) => `${z.title}: ${visible(z.items).map((i) => [i.title, i.org, i.name, i.text].filter(Boolean).join(' - ')).join('; ')}`).join('\n');
      const out = await AI.ask({
        system: `Write a professional CV profile summary${en ? ' in English' : ' in Arabic'}: 3 to 4 sentences, first person implied, confident, based only on the facts given.`,
        prompt: `Name: ${cv.person.name}\nHeadline: ${cv.person.title}\n${facts}`,
        effort: 'low', maxTokens: 1500,
      });
      if (out) { s.text = out.trim(); save(); render(); }
    }
  } catch (e) { toast(AI.friendly(e)); }
  if (btn.isConnected) btn.disabled = false;
}

// ---------- events ----------
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'cvPhoto') {
    const f = el.files && el.files[0]; el.value = '';
    if (!f) return;
    try {
      const blob = await shrinkImage(f);
      const cv = curCV(); const id = uid();
      await Media.put(id, blob);
      if (cv.photo) Media.del(cv.photo).catch(() => {});
      cv.photo = id; save(); render();
    } catch { toast('تعذّر فتح الصورة.'); }
    return;
  }
  if (!el.dataset || !el.dataset.cv) return;
  const cv = curCV();
  if (!cv) return;
  const { k } = el.dataset;
  const val = el.type === 'checkbox' ? el.checked : k === 'level' ? Number(el.value) : el.value.trim ? (el.tagName === 'TEXTAREA' ? el.value.replace(/\s+$/, '') : el.value.trim()) : el.value;
  const where = el.dataset.cv;
  if (where === 'cv') cv[k] = val;
  if (where === 'person') cv.person[k] = val;
  if (where === 'link') { const l = cv.person.links.find((x) => x.id === el.dataset.iid); if (l) l[k] = val; }
  if (where === 'sec') getSec(cv, el.dataset.sid)[k] = val;
  if (where === 'item') { const it = getSec(cv, el.dataset.sid).items.find((x) => x.id === el.dataset.iid); if (it) it[k] = val; }
  cv.updated = Date.now();
  save();
  if (el.type === 'checkbox' || el.tagName === 'SELECT' || k === 'title') render();
});
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="cv"]');
  if (!el) return;
  const { action, v } = el.dataset;
  const cv = curCV();
  const move = (arr, id, d) => { const i = arr.findIndex((x) => x.id === id), k = i + d; if (i < 0 || k < 0 || k >= arr.length) return; [arr[i], arr[k]] = [arr[k], arr[i]]; };
  const done = () => { if (cv) cv.updated = Date.now(); save(); render(); };
  switch (action) {
    case 'cv-new': { const c = normalizeCV({ lang: v }); S.cvs.push(c); cvUi.id = c.id; cvUi.mode = 'edit'; done(); break; }
    case 'cv-pick': cvUi.id = v; cvUi.open = ''; render(); break;
    case 'cv-dup': {
      const copy = JSON.parse(JSON.stringify(cv));
      const c = normalizeCV({ ...copy, id: uid(), name: `${cv.name} (نسخة)`, created: Date.now() });
      for (const s of c.sections) { s.id = uid(); for (const x of s.items) x.id = uid(); }
      S.cvs.push(c); cvUi.id = c.id; done(); toast('أُنشئت نسخة: عدّلها لوظيفة بعينها، وأخفِ ما لا يلزم');
      break;
    }
    case 'cv-mode': cvUi.mode = v; render(); break;
    case 'cv-set': cv[el.dataset.k] = v; done(); break;
    case 'cv-del': {
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'تأكيد حذف النسخة'; break; }
      if (cv.photo) Media.del(cv.photo).catch(() => {});
      S.cvs = S.cvs.filter((c) => c.id !== cv.id); cvUi.id = ''; save(); render(); toast('حُذفت النسخة');
      break;
    }
    case 'cv-photo-del': Media.del(cv.photo).catch(() => {}); cv.photo = ''; done(); break;
    case 'cv-open': cvUi.open = cvUi.open === v ? '' : v; render(); break;
    case 'cvs-move': move(cv.sections, v, Number(el.dataset.d)); done(); break;
    case 'cvs-hide': { const s = getSec(cv, v); s.hidden = !s.hidden; done(); break; }
    case 'cvs-del': {
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'احذف؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = '✕'; } }, 3000); break; }
      cv.sections = cv.sections.filter((s) => s.id !== v); done();
      break;
    }
    case 'cvi-move': move(getSec(cv, el.dataset.sid).items, v, Number(el.dataset.d)); done(); break;
    case 'cvi-hide': { const it = getSec(cv, el.dataset.sid).items.find((x) => x.id === v); it.hidden = !it.hidden; done(); break; }
    case 'cvi-del': { const s = getSec(cv, el.dataset.sid); s.items = s.items.filter((x) => x.id !== v); done(); break; }
    case 'cv-item-add': {
      const s = getSec(cv, el.dataset.sid);
      const it = cvItem(s.type === 'tags' ? { name: '', level: 0 } : s.type === 'facts' ? { label: '', value: '' } : s.type === 'list' ? { text: '' } : { title: '' });
      s.items.push(it); done();
      const first = $(`cv-${it.id}-${{ tags: 'name', facts: 'label', list: 'text' }[s.type] || 'title'}`); if (first) first.focus();
      break;
    }
    case 'cv-link-add': { const l = cvItem({ label: '', url: '' }); cv.person.links.push(l); done(); $(`cv-l-${l.id}-label`)?.focus(); break; }
    case 'cv-link-del': cv.person.links = cv.person.links.filter((x) => x.id !== v); done(); break;
    case 'cv-sec-new': openCVSection(); break;
    case 'cv-sug': $('csTitle').value = v; break;
    case 'cv-sectype': ldraft.type = v; for (const b of $('csType').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'cv-word': exportCVWord(); break;
    case 'cv-pdf': exportCVPdf(); break;
    case 'cv-ai-desc': cvAI('desc', el.dataset.sid, v, el); break;
    case 'cv-ai-summary': cvAI('summary', el.dataset.sid, '', el); break;
  }
});

// keep «الشكل» open across re-renders
document.addEventListener('toggle', (e) => { if (e.target.id === 'cvStyle') cvUi.styleOpen = e.target.open; }, true);

Object.assign(LibraryViews, { cv: viewCV });
