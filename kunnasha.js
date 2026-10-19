'use strict';
// «كناشة القراءة»: a tab of the benefits page for what the reader jots down while reading, each entry a
// title and a text. An entry can be copied into the notes page (it stays here too), and the whole
// notebook exports to Word or Excel. The entries are their own collection: S.kunnasha.

const kunUi = { tab: 'ben', q: '' };

function normalizeKun(k) {
  return { id: k.id || uid(), title: String(k.title || ''), text: String(k.text || ''), created: k.created || Date.now(), updated: k.updated || k.created || Date.now() };
}
const getKun = (id) => S.kunnasha.find((k) => k.id === id);

// the two tabs of the benefits page
const kunTabsHTML = () => `<div class="seg kun-tabs" role="group" aria-label="${esc(pageName('benefits'))}">
    <button type="button" data-action="kun-tab" data-v="ben" aria-pressed="${kunUi.tab !== 'kun'}">💡 ${esc(pageName('benefits'))}${S.benefits.length ? ` (${S.benefits.length})` : ''}</button>
    <button type="button" data-action="kun-tab" data-v="kun" aria-pressed="${kunUi.tab === 'kun'}">📒 كناشة القراءة${S.kunnasha.length ? ` (${S.kunnasha.length})` : ''}</button>
  </div>`;

function viewKunnasha() {
  const q = kunUi.q.trim().toLowerCase();
  const list = S.kunnasha.filter((k) => !q || k.title.toLowerCase().includes(q) || k.text.toLowerCase().includes(q)).sort((a, b) => b.created - a.created);
  return `${moreCrumb()}
  ${kunTabsHTML()}
  <section class="section">
    <div class="section-head"><h2>كناشة القراءة</h2><div class="btn-row">${S.kunnasha.length ? `<button type="button" class="xls-btn word-btn" data-action="kun-docx">${icon('note')}وورد</button>${xlsBtn('kunnasha')}` : ''}${addBtn('kun-new', 'كناشة')}</div></div>
    ${S.kunnasha.length ? `<div class="toolbar"><input type="search" id="kunSearch" placeholder="ابحث في الكناشة" aria-label="بحث" value="${esc(kunUi.q)}"></div>` : ''}
    ${list.length ? `<div class="kun-list">${list.map((k) => `<button type="button" class="kun-card" data-action="kun-open" data-v="${k.id}">
        <strong>${esc(k.title || 'بلا عنوان')}</strong>
        ${k.text ? `<p>${esc(k.text)}</p>` : ''}
        <small>${esc(fmtDate(iso(new Date(k.created)), { day: 'numeric', month: 'long', year: 'numeric' }))}</small>
      </button>`).join('')}</div>`
      : S.kunnasha.length ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى.')
        : emptyHTML('الكناشة فارغة', 'اكتب ما يعنّ لك أثناء القراءة: عنواناً ثم نصاً.', addBtn('kun-new', 'أول كناشة'))}
  </section>`;
}

// ---------- the editor ----------
function openKun(id) {
  const k = id ? getKun(id) : normalizeKun({});
  if (!k) return;
  ldraft = { kind: 'kun', id: k.id, isNew: !id };
  const memos = S.memos.slice().sort((a, b) => b.updated - a.updated);
  const memoName = (m) => excerpt(m.title || noteText(m.html).split('\n')[0] || 'ملاحظة بلا عنوان', 40);
  $('libForm').innerHTML = `${sheetHead(id ? 'كناشة القراءة' : 'كناشة جديدة')}
    <label class="field"><span>العنوان</span><input type="text" id="kunTitle" value="${esc(k.title)}" autocomplete="off" placeholder="عنوان ما تكتبه"></label>
    <label class="field"><span>النص</span><textarea id="kunText" rows="10" dir="auto" placeholder="اكتب ما تشاء…">${esc(k.text)}</textarea></label>
    ${id ? `<div class="kun-copy"><b>انسخها إلى ${esc(pageName('notes'))}</b><small class="note-text">تبقى هنا كما هي، وتُنسخ منها نسخة.</small>
      <div class="btn-row"><select id="kunTarget" aria-label="إلى أي ملاحظة"><option value="">ملاحظة جديدة</option>${memos.map((m) => `<option value="${m.id}">${esc(memoName(m))}</option>`).join('')}</select>
      <button type="button" class="ghost sm" data-action="kun-copy">انسخ</button></div></div>
      <p class="note-text">${esc(`كُتبت ${dateBoth(iso(new Date(k.created)), true)}${k.updated > k.created + 60000 ? ` | عُدّلت ${dateBoth(iso(new Date(k.updated)), true)}` : ''}`)}</p>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? '<button type="button" class="danger" data-action="kun-del">حذف</button>' : ''}</div>`;
  showLib();
  $('libForm').scrollTop = 0;
  if (!id) setTimeout(() => { if ($('kunTitle') && lsheet().open) $('kunTitle').focus(); }, 50);
}
function saveKun() {
  const title = $('kunTitle').value.trim(), text = $('kunText').value.trim();
  if (!title && !text) { toast('اكتب عنواناً أو نصاً.'); return false; }
  const old = getKun(ldraft.id);
  const k = normalizeKun({ ...(old || {}), id: ldraft.id, title, text, updated: Date.now() });
  if (old) Object.assign(old, k); else S.kunnasha.push(k);
  save();
  return true;
}

// ---------- exports ----------
function kunDocx() {
  const ar = (s) => digitsOut(String(s));
  const list = S.kunnasha.slice().sort((a, b) => a.created - b.created);
  const P = [{ style: 'Title', text: 'كناشة القراءة' }];
  list.forEach((k, i) => {
    if (i) P.push({ style: 'Sep', text: '✦   ✦   ✦' });
    P.push({ style: 'Heading1', text: ar(k.title || 'بلا عنوان') });
    // lines are separate paragraphs (a line break inside a justified paragraph stretches the line)
    const lines = k.text.split('\n').map((x) => x.trim()).filter(Boolean);
    lines.forEach((t, j) => P.push({ style: j === lines.length - 1 ? 'Normal' : 'Tight', text: ar(t) }));
  });
  const blob = Docx.build(P, { title: 'كناشة القراءة' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mahami-kunnasha-${today()}.docx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('جُهّز ملف الوورد. تجده في التنزيلات.');
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="kun-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'kun-tab': kunUi.tab = v; render(); break;
    case 'kun-new': openKun(null); break;
    case 'kun-open': openKun(v); break;
    case 'kun-docx': kunDocx(); break;
    // a copy goes to the notes page, into a new note or one already there; the entry stays in the notebook
    case 'kun-copy': {
      const title = $('kunTitle').value.trim(), text = $('kunText').value.trim();
      if (!title && !text) { toast('لا شيء لنسخه.'); break; }
      const k = getKun(ldraft.id);
      const from = `من كناشة القراءة | ${fmtStamp(k ? k.created : Date.now())}`;
      const block = `${title ? `<b>${esc(title)}</b><br>` : ''}${plainToNoteHTML(text)}<br><small>${esc(from)}</small>`;
      const m = $('kunTarget').value && S.memos.find((x) => x.id === $('kunTarget').value);
      if (m) {
        m.html = `${m.html}${m.html ? '<br><br>' : ''}${block}`;
        m.body = noteText(m.html); m.updated = Date.now();
      } else S.memos.push(normalizeMemo({ title: title || excerpt(text.split('\n')[0], 40), html: block }));
      save();
      toast(m ? `نُسخت إلى «${excerpt(m.title || 'الملاحظة', 30)}»` : `نُسخت إلى ملاحظة جديدة في «${pageName('notes')}»`);
      break;
    }
    case 'kun-del': {
      if (!selArmed(el)) break;
      S.kunnasha = S.kunnasha.filter((k) => k.id !== ldraft.id);
      save(); closeLib(); render(); toast('حُذفت');
      break;
    }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'kunSearch') { kunUi.q = e.target.value; render(); }
});
