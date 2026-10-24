'use strict';
// Benefits extras (v93): categories the user names (S.settings.benCats, each benefit's `cats`), many benefits
// pasted at once (each book name or page number starts a new one, shown in a preview before saving), the apps
// a benefit goes to with its text copied (S.settings.benApps, e.g. NotebookLM; S.settings.benGo opens one after
// a new benefit is saved) and a Word file of the benefits, all of them or one category.

const benUi = { cat: '' }; // '' every category | '-' none | a category id

const benCats = () => (Array.isArray(S.settings.benCats) ? S.settings.benCats.filter((c) => c && c.id && c.name) : []);
const benApps = () => (Array.isArray(S.settings.benApps) ? S.settings.benApps.filter((a) => a && a.id && a.url && benAppUrl(String(a.url))) : []);
const benCatName = (id) => (benCats().find((c) => c.id === id) || {}).name || '';
const benCatList = (f) => (f.cats || []).map(benCatName).filter(Boolean);
const benCatNames = (f) => benCatList(f).join(' | ');
const benCatOk = (f) => !benUi.cat || (benUi.cat === '-' ? !benCatList(f).length : (f.cats || []).includes(benUi.cat));
// a new benefit takes the category being shown
const benNewCats = () => (benUi.cat && benUi.cat !== '-' && benCatName(benUi.cat) ? [benUi.cat] : []);
const benCatsLine = (f) => (benCatList(f).length ? `<span class="book-line">🏷 ${esc(benCatNames(f))}</span>` : '');

function benCatSelectHTML() {
  const cats = benCats();
  if (!cats.length) return '';
  if (benUi.cat && benUi.cat !== '-' && !benCatName(benUi.cat)) benUi.cat = '';
  return `<select id="benefitCat" aria-label="التصنيف"><option value="">كل التصنيفات</option>${cats.map((c) => `<option value="${c.id}"${benUi.cat === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="-"${benUi.cat === '-' ? ' selected' : ''}>بلا تصنيف</option></select>`;
}
const benToolsHTML = () => `<button type="button" class="chip" data-action="ben-imp">📥 عدة فوائد مرة واحدة</button><button type="button" class="chip" data-action="ben-cats">🏷 التصنيفات</button><button type="button" class="chip" data-action="ben-apps">🔗 تطبيقاتي</button>`;

// ---------- choosing categories (the benefit's editor and the paste sheet) ----------
function benCatPickHTML(sel) {
  return `<div class="field"><span>التصنيف (اختياري)</span><div class="chips wrap" id="benCatPick">${benCats().map((c) => `<button type="button" class="chip" data-action="ben-cat-pick" data-v="${c.id}" aria-pressed="${sel.includes(c.id)}">${esc(c.name)}</button>`).join('')}</div>
    <div class="ben-cat-new"><input type="text" id="benCatNew" placeholder="تصنيف جديد" autocomplete="off" data-novoice aria-label="تصنيف جديد"><button type="button" class="ghost sm" data-action="ben-cat-quick">أضف</button></div></div>`;
}
function benCatCreate(name) {
  name = name.replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const same = benCats().find((c) => c.name === name);
  if (same) return same;
  const c = { id: uid(), name };
  S.settings.benCats = [...benCats(), c];
  save();
  return c;
}

// ---------- managing the categories ----------
function openBenCats() {
  ldraft = { kind: 'bencats', id: '', isNew: false };
  const cats = benCats();
  const n = (id) => S.benefits.filter((f) => (f.cats || []).includes(id)).length;
  $('libForm').innerHTML = `${sheetHead('🏷 تصنيفات الفوائد')}
    <p class="note-text explain">صنّف بها فوائدك، واعرض كل تصنيف وحده، وصدّره في ملف وورد. حذف التصنيف لا يحذف فوائده.</p>
    ${cats.length ? `<div class="bc-list">${cats.map((c) => `<div class="bc-row"><input type="text" data-bcat="${c.id}" value="${esc(c.name)}" aria-label="اسم التصنيف" autocomplete="off" data-novoice><small class="dbox">${n(c.id) ? plural(n(c.id), 'فائدة واحدة', 'فائدتان', 'فوائد', 'فائدة') : 'لا فوائد'}</small><button type="button" class="ghost sm" data-action="ben-cat-del" data-v="${c.id}">حذف</button></div>`).join('')}</div>` : '<p class="note-text">لا تصنيفات بعد.</p>'}
    <div class="ben-cat-new"><input type="text" id="bcNew" placeholder="تصنيف جديد، مثل: التربية" autocomplete="off" data-novoice aria-label="تصنيف جديد"><button type="button" class="ghost" data-action="ben-cat-add">أضف</button></div>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button></div>`;
  showLib();
}
// names typed in the list are kept before the list is drawn again
function benCatsRenames() {
  const cats = benCats().map((c) => ({ ...c }));
  for (const el of document.querySelectorAll('[data-bcat]')) {
    const c = cats.find((x) => x.id === el.dataset.bcat), name = el.value.replace(/\s+/g, ' ').trim();
    if (c && name && !cats.some((x) => x !== c && x.name === name)) c.name = name;
  }
  S.settings.benCats = cats;
}
function saveBenCats() {
  benCatsRenames();
  if ($('bcNew').value.trim()) benCatCreate($('bcNew').value);
  save();
  setTimeout(() => toast('حُفظت التصنيفات'), 300);
  return true;
}

// ---------- apps a benefit goes to ----------
function benAppsRowHTML() {
  const apps = benApps();
  return apps.length ? `<div class="ben-apps"><small>انسخها وانتقل إلى:</small><div class="btn-row">${apps.map((a) => `<button type="button" class="chip" data-action="ben-app-go" data-v="${a.id}">↗ ${esc(a.name)}</button>`).join('')}</div></div>` : '';
}
// only web links and app links; never a script
function benAppUrl(u) {
  u = u.trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = `https://${u}`;
  return /^(javascript|data|vbscript|file):/i.test(u) ? '' : u;
}
function openBenApps() {
  const apps = benApps(), go = S.settings.benGo || '';
  // with no app listed yet the choice below is not a choice: the first app added becomes it
  ldraft = { kind: 'benapps', id: '', isNew: false, hadApps: apps.length > 0 };
  $('libForm').innerHTML = `${sheetHead('🔗 تطبيقاتي للفوائد')}
    <p class="note-text explain">من محرر الفائدة تنتقل إلى التطبيق مباشرة، ويُنسخ نص الفائدة لتلصقه هناك. ويمكن أن ينقلك التطبيق إليه وحده بعد حفظ كل فائدة جديدة.</p>
    ${apps.length ? `<div class="bc-list">${apps.map((a) => `<div class="ba-row"><input type="text" data-bapp="${a.id}" data-k="name" value="${esc(a.name)}" aria-label="اسم التطبيق" autocomplete="off" data-novoice><input type="url" dir="ltr" data-bapp="${a.id}" data-k="url" value="${esc(a.url)}" aria-label="رابطه" autocomplete="off" data-novoice><button type="button" class="ghost sm" data-action="ben-app-del" data-v="${a.id}">حذف</button></div>`).join('')}</div>` : ''}
    <div class="field"><span>أضف تطبيقاً</span>
      <div class="ba-row"><input type="text" id="baName" placeholder="الاسم، مثل: NotebookLM" autocomplete="off" aria-label="اسم التطبيق" data-novoice><input type="url" dir="ltr" id="baUrl" placeholder="https://notebooklm.google.com" autocomplete="off" aria-label="رابطه" data-novoice><button type="button" class="ghost sm" data-action="ben-app-add">أضف</button></div>
      ${apps.some((a) => /notebooklm/i.test(a.url)) ? '' : '<div class="btn-row"><button type="button" class="chip" data-action="ben-app-nlm">＋ NotebookLM</button></div>'}
    </div>
    <label class="field"><span>بعد حفظ فائدة جديدة</span><select id="baGo"><option value="">ابقَ في التطبيق</option>${apps.map((a) => `<option value="${a.id}"${go === a.id ? ' selected' : ''}>انسخها وانقلني إلى ${esc(a.name)}</option>`).join('')}</select></label>
    <label class="switch"><input type="checkbox" id="baRecShare"${S.settings.benRecShare !== false ? ' checked' : ''}><span>بعد انتهاء التسجيل الصوتي افتح قائمة الإرسال فوراً</span></label>
    <p class="note-text explain">الجوال لا يسمح بإرسال ملف إلى تطبيق بعينه دون قائمته، فتُفتح القائمة وحدها بعد التسجيل. وإن ضغطت مطولاً على التطبيق فيها واخترت «تثبيت» صار أولها دائماً.</p>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button></div>`;
  showLib();
}
function benAppsEdits() {
  const apps = benApps().map((a) => ({ ...a }));
  for (const el of document.querySelectorAll('[data-bapp]')) {
    const a = apps.find((x) => x.id === el.dataset.bapp);
    if (!a) continue;
    if (el.dataset.k === 'name' && el.value.trim()) a.name = el.value.trim();
    if (el.dataset.k === 'url' && benAppUrl(el.value)) a.url = benAppUrl(el.value);
  }
  S.settings.benApps = apps;
  if ($('baGo') && ldraft && ldraft.hadApps) S.settings.benGo = $('baGo').value;
  if ($('baRecShare')) S.settings.benRecShare = $('baRecShare').checked;
}
function benAppAdd() {
  const url = benAppUrl($('baUrl').value);
  if (!url) { toast('اكتب رابط التطبيق.'); $('baUrl').focus(); return false; }
  let name = $('baName').value.trim();
  if (!name) { try { name = new URL(url).hostname.replace(/^www\./, ''); } catch { name = 'تطبيق'; } }
  const id = uid(), first = !benApps().length;
  S.settings.benApps = [...benApps(), { id, name, url }];
  if (first && !S.settings.benGo) S.settings.benGo = id;
  return true;
}
function saveBenApps() {
  benAppsEdits();
  if ($('baUrl').value.trim() && !benAppAdd()) return false;
  if (!benApps().some((a) => a.id === S.settings.benGo)) S.settings.benGo = '';
  save();
  setTimeout(() => toast('حُفظت تطبيقاتك'), 300);
  return true;
}
const benCopyText = (f) => [f.title, [f.book, f.page !== '' && f.page != null ? `صفحة ${f.page}` : ''].filter(Boolean).join(' | '), f.text, f.lesson ? `يُستفاد منها: ${f.lesson}` : ''].filter(Boolean).join('\n');
// the copy is written inside the tap itself (a phone refuses it later), then the app opens
function benGoTo(app, f) {
  const txt = benCopyText(f);
  if (txt && navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
  window.open(app.url, '_blank', 'noopener');
  toast(txt ? `نُسخت الفائدة، الصقها في ${app.name}` : `فُتح ${app.name}`);
}
function benGoAfterSave(id) {
  const app = benApps().find((a) => a.id === S.settings.benGo), f = getBenefit(id);
  if (app && f) benGoTo(app, { ...f, book: benefitBookTitle(f) === 'بلا كتاب' ? '' : benefitBookTitle(f) });
}

// ---------- many benefits pasted at once ----------
const BEN_NUM = (s) => parseInt(String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)), 10);
const benKey = (s) => String(s || '').replace(/[ً-ْـ«»"'“”()[\]]/g, '').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
const benBookOf = (name) => { const k = benKey(name); return k ? S.books.find((b) => benKey(b.title) === k) : null; };
// «الموافقات» or «كتاب: الموافقات» (a label, quotes and brackets are not part of the name)
const benBookName = (s) => String(s || '').replace(/^\s*(?:[-•*–]|[0-9٠-٩]+\s*[-.):])\s*/, '').replace(/^(?:اسم\s+)?(?:ال)?كتاب\s*[:：]\s*/, '').replace(/[«»"“”()[\]]/g, '').replace(/[\s،,:：\-–|]+$/, '').trim();
const BEN_PAGE = /(^|[\s(\[،,:：\-–|])(?:ال)?(?:صفحة|ص)\s*[:：.\-]?\s*([0-9٠-٩۰-۹]+)(?:\s*(?:[-–—]|إلى)\s*[0-9٠-٩۰-۹]+)?\s*[)\]]?/;
const benShort = (s) => s.length <= 60 && !/[.!؟?]\s*$/.test(s) && !/[.!؟?]\s/.test(s);

function benParse(text, defBook) {
  const out = [], dropped = [];
  let cur = null, carry = benBookName(defBook || ''), field = 'text', prevBlank = true, lastLine = -1;
  const fresh = () => ({ book: carry, page: '', title: '', text: [], lesson: [], ownBook: false });
  const has = (b) => b && (b.title || b.text.some((x) => x.trim()) || b.lesson.some((x) => x.trim()));
  const close = () => { if (cur && (has(cur) || cur.page !== '' || cur.ownBook)) out.push(cur); cur = null; field = 'text'; };
  const start = (book, page) => {
    close();
    cur = fresh();
    if (book) { cur.book = book; cur.ownBook = true; carry = book; }
    if (page !== undefined) cur.page = page;
  };
  const push = (s) => { if (!cur) cur = fresh(); cur[field].push(s); lastLine = cur[field].length - 1; };
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const L = raw.trim();
    if (!L) { if (cur && cur[field].length) cur[field].push(''); prevBlank = true; continue; }
    let m;
    // a line of dashes or stars ends a benefit
    if (/^(?![.\s]+$)[-–—_*=~•.\s]{3,}$/.test(L)) { close(); prevBlank = true; continue; }
    if ((m = L.match(/^(?:اسم\s+)?(?:ال)?كتاب\s*[:：]\s*(.+)$/))) {
      const pm = m[1].match(BEN_PAGE);
      const book = benBookName(pm ? m[1].slice(0, pm.index + pm[1].length) : m[1]);
      if (cur && !has(cur) && !cur.ownBook) { cur.book = book; cur.ownBook = true; carry = book; if (pm) cur.page = BEN_NUM(pm[2]); } else start(book, pm ? BEN_NUM(pm[2]) : undefined);
      const after = pm ? m[1].slice(pm.index + pm[0].length).replace(/^[\s:：\-–،,)]+/, '') : '';
      if (after) push(after);
      prevBlank = false; continue;
    }
    if ((m = L.match(/^(?:عنوان\s+الفائدة|العنوان)\s*[:：]\s*(.*)$/))) { if (cur && (cur.title || cur.text.some((x) => x.trim()))) start(); if (!cur) cur = fresh(); cur.title = m[1].trim(); prevBlank = false; continue; }
    if ((m = L.match(/^(?:نص\s+الفائدة|الفائدة)\s*[:：]\s*(.*)$/))) { if (cur && cur.text.some((x) => x.trim())) start(); field = 'text'; if (m[1].trim()) push(m[1].trim()); prevBlank = false; continue; }
    if ((m = L.match(/^(?:ما\s+)?(?:يمكن\s+أن\s+)?(?:يُ?ستفاد|يستفاد)(?:\s+منها)?\s*[:：]\s*(.*)$/))) { field = 'lesson'; if (m[1].trim()) push(m[1].trim()); prevBlank = false; continue; }
    const pm = L.replace(/^\s*(?:[-•*–]|[0-9٠-٩]+\s*[-.)])\s+/, '').match(BEN_PAGE);
    if (pm) {
      const line = L.replace(/^\s*(?:[-•*–]|[0-9٠-٩]+\s*[-.)])\s+/, '');
      const before = benBookName(line.slice(0, pm.index + pm[1].length));
      const after = line.slice(pm.index + pm[0].length).replace(/^[\s:：\-–،,)]+/, '');
      // a page heads a benefit when it opens the line, or follows a book's name at the start of a block
      const known = before && benBookOf(before);
      if (!before || known || ((prevBlank || !cur) && benShort(before))) {
        const page = BEN_NUM(pm[2]);
        if (!before && cur && cur.page === '' && !has(cur)) cur.page = page;
        else if (!before && cur && cur.page === '' && field === 'text' && !cur.title && !cur.lesson.length && cur.text.filter((x) => x.trim()).length === 1 && benShort(cur.text.find((x) => x.trim()).trim()) && !cur.ownBook) {
          // «الموافقات» alone on a line, then «ص ٢٣»: that line was the book's name
          cur.book = benBookName(cur.text.find((x) => x.trim())); cur.ownBook = true; carry = cur.book; cur.text = []; cur.page = page;
        } else if (!before && cur && has(cur) && lastLine >= 0 && cur[field].length && cur[field][cur[field].length - 1].trim() && benShort(cur[field][cur[field].length - 1].trim()) && cur[field].length >= 2 && !cur[field][cur[field].length - 2].trim()) {
          // the name of the next book closes the benefit before it: «…نص الفائدة» blank «الاعتصام» «ص ٤٠»
          const name = benBookName(cur[field].pop());
          while (cur[field].length && !cur[field][cur[field].length - 1].trim()) cur[field].pop();
          start(name, page);
        } else start(before, page);
        if (after) push(after);
        prevBlank = false; continue;
      }
    }
    // a book of the library alone on its line
    if ((prevBlank || !cur) && benBookOf(benBookName(L)) && benKey(benBookName(L)) === benKey(L.replace(/^(?:اسم\s+)?(?:ال)?كتاب\s*[:：]\s*/, ''))) {
      const book = benBookOf(benBookName(L)).title;
      if (cur && !has(cur) && !cur.ownBook) { cur.book = book; cur.ownBook = true; carry = book; } else start(book);
      prevBlank = false; continue;
    }
    push(L);
    prevBlank = false;
  }
  close();
  const list = [];
  for (const b of out) {
    const txt = b.text.join('\n').replace(/\n{3,}/g, '\n\n').trim(), lesson = b.lesson.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const bk = benBookOf(b.book);
    const item = { book: bk ? bk.title : b.book, bookId: bk ? bk.id : '', page: b.page, title: b.title, text: txt, lesson };
    if (!txt && !b.title && !lesson) dropped.push(item); else list.push(item);
  }
  return { list, dropped };
}
function openBenImport() {
  ldraft = { kind: 'benimp', id: '', isNew: true, cats: benNewCats(), seen: null, voices: [] };
  benImpDraft = ldraft;
  $('libForm').innerHTML = `${sheetHead('📥 عدة فوائد مرة واحدة')}
    <p class="note-text">الصق النص كما هو: كلما جاء اسم كتاب أو رقم صفحة بدأت فائدة جديدة، وتُعرض عليك قبل الحفظ.</p>
    <details class="bv-fold"><summary>أشكال يفهمها</summary><div class="bi-help">
      <pre>الموافقات
ص ٢٣
نص الفائدة…

الموافقات ص ٤٠
نص فائدة أخرى…

كتاب: الاعتصام | صفحة: ١٥
العنوان: عنوان الفائدة (اختياري)
الفائدة: نصها…
يُستفاد منها: … (اختياري)</pre>
      <p class="note-text">إن لم يُذكر الكتاب فالفائدة من الكتاب الذي قبلها. وسطر من الشرطات «---» يفصل بين فائدتين.</p></div></details>
    <label class="field"><span>النص</span><textarea id="biText" rows="10" placeholder="الصق الفوائد هنا"></textarea></label>
    <details class="bv-fold"><summary>🎙 تسجيل صوتي (اختياري)</summary><p class="note-text">للتفريغ فقط: أرسله إلى تطبيق التفريغ، ثم الصق نصه في «النص». لا يُحفظ التسجيل بعد الحفظ أو الإغلاق.</p><div id="bvBox"></div></details>
    <label class="field"><span>الكتاب إن لم يُذكر في أول النص (اختياري)</span><input type="text" id="biBook" list="biBooks" autocomplete="off" placeholder="اختر من كتبك أو اكتب اسماً"></label>
    <datalist id="biBooks">${S.books.map((b) => `<option value="${esc(b.title)}">`).join('')}</datalist>
    ${benCats().length ? benCatPickHTML(ldraft.cats) : ''}
    <div id="biPrev"></div>
    <div class="sheet-actions"><button type="button" class="ghost" data-action="ben-imp-prev">اعرض المعاينة</button><button type="submit" class="primary">احفظها</button></div>`;
  showLib();
  bvRender();
  setTimeout(() => $('biText') && $('biText').focus(), 50);
}
// a recording made here is only for writing it out: it leaves the phone when the sheet closes
let benImpDraft = null;
document.addEventListener('close', (e) => {
  if (!e.target || e.target.id !== 'libSheet' || !benImpDraft || ldraft === benImpDraft) return;
  for (const v of benImpDraft.voices || []) Media.del(v.mediaId).catch(() => {});
  benImpDraft = null;
}, true);
const benImpKey = () => `${$('biText').value}\u0001${$('biBook').value}`;
function benImpPreview() {
  const r = benParse($('biText').value, $('biBook').value);
  ldraft.seen = benImpKey();
  ldraft.parsed = r;
  const fresh = [...new Set(r.list.filter((f) => f.book && !f.bookId).map((f) => f.book))];
  const nobook = r.list.filter((f) => !f.book).length;
  $('biPrev').innerHTML = !r.list.length && !r.dropped.length ? '<p class="note-text">لا شيء لعرضه. الصق الفوائد أولاً.</p>' : `<div class="bi-sum">
      <b>${r.list.length ? `ستُحفظ ${plural(r.list.length, 'فائدة واحدة', 'فائدتان', 'فوائد', 'فائدة')}` : 'لن تُحفظ أي فائدة'}</b>
      ${fresh.length ? `<span class="dbox">كتب ليست في كتبك: ${fresh.map((x) => `«${esc(x)}»`).join('، ')}</span>` : ''}
      ${nobook ? `<span class="dbox warn">بلا كتاب: ${nobook}</span>` : ''}
      ${r.dropped.length ? `<span class="dbox warn">لن يُحفظ ${plural(r.dropped.length, 'موضع واحد', 'موضعان', 'مواضع', 'موضعاً')} بلا نص: ${r.dropped.map((f) => esc([f.book, f.page !== '' ? `صفحة ${f.page}` : ''].filter(Boolean).join(' ') || 'بلا كتاب')).join('، ')}</span>` : ''}
    </div>
    <div class="ben-reads">${r.list.map((f, i) => `<div class="ben-read"><span class="ben-head"><b>${i + 1}) ${esc(f.title || 'فائدة')}</b><span class="ben-tags">${[f.book ? `📖 ${esc(f.book)}${f.bookId ? '' : ' (ليس في كتبك)'}` : 'بلا كتاب', f.page !== '' ? `صفحة ${f.page}` : ''].filter(Boolean).map((x) => `<small class="dbox">${x}</small>`).join('')}</span></span>${benBody(f)}</div>`).join('')}</div>`;
  $('biPrev').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function saveBenImport() {
  // the preview is shown before anything is saved, and again if the text changed since
  if (ldraft.seen !== benImpKey()) { benImpPreview(); return false; }
  const list = ldraft.parsed.list;
  if (!list.length) { toast('لا فوائد لحفظها.'); return false; }
  const now = Date.now();
  S.benefits.push(...list.map((f, i) => normalizeBenefit({ ...f, cats: ldraft.cats || [], created: now + list.length - i })));
  save();
  setTimeout(() => toast(`أُضيفت ${plural(list.length, 'فائدة واحدة', 'فائدتان', 'فوائد', 'فائدة')}`), 300);
  return true;
}

// ---------- the benefits in Word ----------
function openBenWord() {
  ldraft = { kind: 'benword', id: '', isNew: false };
  const cats = benCats(), n = (id) => S.benefits.filter((f) => (f.cats || []).includes(id)).length;
  const none = S.benefits.filter((f) => !benCatList(f).length).length;
  const pre = benUi.cat && (benUi.cat === '-' || benCatName(benUi.cat)) ? benUi.cat : '';
  $('libForm').innerHTML = `${sheetHead(`${esc(pageName('benefits'))} في ملف وورد`)}
    <label class="field"><span>ما الذي تصدّره؟</span><select id="bwWhat">
      <option value="">كل الفوائد (${S.benefits.length})</option>
      ${cats.map((c) => `<option value="${c.id}"${pre === c.id ? ' selected' : ''}>تصنيف: ${esc(c.name)} (${n(c.id)})</option>`).join('')}
      ${cats.length ? `<option value="-"${pre === '-' ? ' selected' : ''}>بلا تصنيف (${none})</option>` : ''}
    </select></label>
    <label class="field"><span>رتّبها</span><select id="bwGroup">
      ${cats.length ? '<option value="cat">بالتصنيفات</option>' : ''}<option value="book">بالكتب</option>
    </select></label>
    <div class="sheet-actions"><button type="submit" class="primary">${icon('note')} نزّل ملف الوورد</button></div>`;
  showLib();
}
function runBenWord() {
  const what = $('bwWhat').value, group = $('bwGroup').value;
  const list = S.benefits.filter((f) => !what || (what === '-' ? !benCatList(f).length : (f.cats || []).includes(what)));
  if (!list.length) { toast('لا فوائد في هذا الاختيار.'); return false; }
  const ar = (s) => digitsOut(String(s));
  const byBook = (a, b) => benefitBookTitle(a).localeCompare(benefitBookTitle(b), 'ar') || (a.page === '' ? 1e9 : a.page) - (b.page === '' ? 1e9 : b.page);
  const groups = [];
  if (group === 'cat' && what === '') {
    for (const c of benCats()) { const g = list.filter((f) => (f.cats || []).includes(c.id)); if (g.length) groups.push([c.name, g]); }
    const rest = list.filter((f) => !benCatList(f).length);
    if (rest.length) groups.push(['بلا تصنيف', rest]);
  } else for (const t of [...new Set(list.map(benefitBookTitle))].sort((a, b) => a.localeCompare(b, 'ar'))) groups.push([t, list.filter((f) => benefitBookTitle(f) === t)]);
  const name = what === '-' ? 'بلا تصنيف' : what ? benCatName(what) : '';
  const head = `${pageName('benefits')}${name ? `: ${name}` : ''}`;
  const P = [{ style: 'Title', text: head }, { style: 'Meta', text: ar(`${plural(list.length, 'فائدة واحدة', 'فائدتان', 'فوائد', 'فائدة')} | ${dateBoth(today(), true)}`), center: true }];
  const lines = (s, last) => { const xs = String(s).split('\n').map((x) => x.trim()).filter(Boolean); xs.forEach((t, j) => P.push({ style: j === xs.length - 1 && last ? 'Normal' : 'Tight', text: ar(t) })); };
  groups.forEach(([g, fs], gi) => {
    if (gi) P.push({ style: 'Sep', text: '✦   ✦   ✦' });
    P.push({ style: 'Heading1', text: ar(g) });
    for (const f of fs.slice().sort(byBook)) {
      P.push({ style: 'Question', text: ar(f.title || 'فائدة') });
      const where = [group === 'cat' && what === '' ? benefitBookTitle(f) : group === 'book' ? '' : benefitBookTitle(f), f.page !== '' ? `صفحة ${f.page}` : '', group === 'book' ? benCatNames(f) : ''].filter(Boolean).join(' | ');
      if (where) P.push({ style: 'Meta', text: ar(where) });
      const body = [f.text, ...bvTexts(f)].filter(Boolean).join('\n');
      if (body) lines(body, !f.lesson);
      if (f.lesson) lines(`يُستفاد منها: ${f.lesson}`, true);
    }
  });
  const blob = Docx.build(P, { title: head });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mahami-benefits-${today()}.docx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setTimeout(() => toast('جُهّز ملف الوورد. تجده في التنزيلات.'), 300);
  return true;
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="ben-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'ben-imp': openBenImport(); break;
    case 'ben-imp-prev': benImpPreview(); break;
    case 'ben-cats': openBenCats(); break;
    case 'ben-apps': openBenApps(); break;
    case 'ben-word': openBenWord(); break;
    case 'ben-cat-pick': {
      if (!ldraft || !ldraft.cats) break;
      ldraft.cats = ldraft.cats.includes(v) ? ldraft.cats.filter((x) => x !== v) : [...ldraft.cats, v];
      el.setAttribute('aria-pressed', ldraft.cats.includes(v));
      break;
    }
    // a category made from the benefit's editor is chosen for it at once
    case 'ben-cat-quick': {
      const c = benCatCreate($('benCatNew').value);
      if (!c || !ldraft || !ldraft.cats) { $('benCatNew').focus(); break; }
      if (!ldraft.cats.includes(c.id)) ldraft.cats.push(c.id);
      $('benCatPick').innerHTML = benCats().map((x) => `<button type="button" class="chip" data-action="ben-cat-pick" data-v="${x.id}" aria-pressed="${ldraft.cats.includes(x.id)}">${esc(x.name)}</button>`).join('');
      $('benCatNew').value = '';
      break;
    }
    case 'ben-cat-add': {
      const name = $('bcNew').value.trim();
      if (!name) { $('bcNew').focus(); break; }
      benCatsRenames();
      benCatCreate(name);
      openBenCats();
      render();
      setTimeout(() => $('bcNew') && $('bcNew').focus(), 50);
      break;
    }
    case 'ben-cat-del': {
      if (!selArmed(el)) break;
      benCatsRenames();
      S.settings.benCats = benCats().filter((c) => c.id !== v);
      for (const f of S.benefits) if ((f.cats || []).includes(v)) f.cats = f.cats.filter((x) => x !== v);
      if (benUi.cat === v) benUi.cat = '';
      save(); openBenCats(); render();
      break;
    }
    case 'ben-app-nlm': $('baName').value = 'NotebookLM'; $('baUrl').value = 'https://notebooklm.google.com'; break;
    case 'ben-app-add': {
      benAppsEdits();
      if (!benAppAdd()) break;
      save(); openBenApps();
      break;
    }
    case 'ben-app-del': {
      if (!selArmed(el)) break;
      benAppsEdits();
      S.settings.benApps = benApps().filter((a) => a.id !== v);
      if (S.settings.benGo === v) S.settings.benGo = '';
      save(); openBenApps();
      break;
    }
    // from the benefit's editor: what is written in it now goes with it
    case 'ben-app-go': {
      const app = benApps().find((a) => a.id === v);
      if (!app) break;
      const val = (x) => ($(x) ? $(x).value.trim() : '');
      benGoTo(app, { title: val('lTitle'), book: val('lBook'), page: val('lPage'), text: val('lText'), lesson: val('lLesson') });
      break;
    }
  }
});
