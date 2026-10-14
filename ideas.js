'use strict';
// «الأفكار»: capture whatever comes to mind in one tap, then grow it, park it or turn it into work.
// A quick box sits at the top of the page and a 💡 button in the header opens it from anywhere.
// Writing #word in the text files the idea under that tag.

const IDEA_STATUS = { new: 'جديدة', grow: 'أطوّرها', later: 'لاحقاً', done: 'نُفّذت', drop: 'تركتها' };
const IDEA_OPEN = ['new', 'grow', 'later'];
const ideaUi = { q: '', filter: 'open', tag: '', star: false };

function normalizeIdea(x) {
  return {
    id: x.id || uid(), text: String(x.text || ''), details: String(x.details || ''), tag: String(x.tag || ''),
    status: IDEA_STATUS[x.status] ? x.status : 'new', star: !!x.star,
    created: x.created || Date.now(), updated: x.updated || x.created || Date.now(), convertedTo: x.convertedTo || '',
  };
}
const getIdea = (id) => S.ideas.find((x) => x.id === id);
const ideaTags = () => [...new Set(S.ideas.map((x) => x.tag).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));

// «تطبيق للقراءة #مشاريع» → text «تطبيق للقراءة», tag «مشاريع»
function splitTag(s) {
  let tag = '';
  const text = s.replace(/(^|\s)#([^\s#]+)/g, (m, sp, t) => { if (!tag) tag = t.replace(/_/g, ' '); return ''; }).replace(/\s{2,}/g, ' ').trim();
  return { text, tag };
}

function addIdea(raw, extra = {}) {
  const { text, tag } = splitTag(raw);
  if (!text) return null;
  const idea = normalizeIdea({ text, tag: tag || extra.tag || '', ...extra, ...(tag ? { tag } : {}) });
  S.ideas.push(idea);
  save();
  return idea;
}

function ideaCard(x) {
  const [head, ...rest] = x.text.split('\n');
  const body = [rest.join('\n').trim(), x.details].filter(Boolean).join('\n');
  return `<article class="idea-card s-${x.status}">
    <button type="button" class="idea-star" data-action="idea-star" data-v="${x.id}" aria-pressed="${x.star}" aria-label="${x.star ? 'إلغاء التمييز' : 'تمييز الفكرة'}">${icon('star')}</button>
    <button type="button" class="arch-main" data-action="idea-open" data-v="${x.id}">
      <strong>${esc(head)}</strong>
      ${body ? `<p>${esc(excerpt(body, 220))}</p>` : ''}
      <span class="book-line"><span class="idea-st">${IDEA_STATUS[x.status]}</span> · ${esc(relDate(iso(new Date(x.created))))}${x.tag ? ` · <span class="cat">${esc(x.tag)}</span>` : ''}${x.convertedTo ? ` · ${icon('check')}${esc(x.convertedTo)}` : ''}</span>
    </button>
  </article>`;
}

function viewIdeas() {
  const q = ideaUi.q.trim().toLowerCase();
  const list = S.ideas.filter((x) =>
    (ideaUi.filter === 'all' || (ideaUi.filter === 'open') === IDEA_OPEN.includes(x.status)) &&
    (!ideaUi.tag || x.tag === ideaUi.tag) && (!ideaUi.star || x.star) &&
    (!q || [x.text, x.details, x.tag].some((s) => s.toLowerCase().includes(q))))
    .sort((a, b) => b.star - a.star || b.created - a.created);
  const open = S.ideas.filter((x) => IDEA_OPEN.includes(x.status)).length;
  const tags = ideaTags();
  const seg = [['open', `مفتوحة ${open}`], ['closed', 'نُفّذت أو تُركت'], ['all', 'الكل']]
    .map(([v, l]) => `<button type="button" data-action="idea-filter" data-v="${v}" aria-pressed="${ideaUi.filter === v}">${l}</button>`).join('');
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الأفكار</h2><div class="btn-row">${S.ideas.length ? xlsBtn('ideas') : ''}</div></div>
    <form class="idea-quick" id="ideaQuick" autocomplete="off">
      <textarea id="ideaQuickText" rows="2" placeholder="ما الذي خطر لك؟ اكتبه قبل أن يطير… (‎#وسم للتصنيف)" aria-label="فكرة جديدة"></textarea>
      <button type="submit" class="primary">${icon('plus')}احفظ</button>
    </form>
    ${S.ideas.length ? `<input type="search" id="ideaSearch" placeholder="ابحث في أفكارك" aria-label="بحث" value="${esc(ideaUi.q)}">
      <div class="seg" role="group" aria-label="عرض">${seg}</div>
      <div class="chips" role="group" aria-label="التصنيف">
        <button type="button" class="chip" data-action="idea-starred" aria-pressed="${ideaUi.star}">★ المميزة</button>
        ${tags.length ? `<button type="button" class="chip" data-action="idea-tag" data-v="" aria-pressed="${!ideaUi.tag}">كل الوسوم</button>${tags.map((t) => `<button type="button" class="chip" data-action="idea-tag" data-v="${esc(t)}" aria-pressed="${ideaUi.tag === t}">${esc(t)}</button>`).join('')}` : ''}
      </div>` : ''}
    ${list.length ? `<div class="book-list">${list.map(ideaCard).join('')}</div>`
      : S.ideas.length ? emptyHTML('لا نتائج', 'جرّب كلمة أو تصفية أخرى.')
        : emptyHTML('سجّل أول فكرة', 'كل ما يطرأ عليك: مشروع، عنوان كتاب، حلّ لمشكلة، هدية لشخص… اكتبه في المربع أعلاه، أو اضغط 💡 في أعلى التطبيق من أي صفحة.')}
  </section>`;
}

// ---------- editor (shared library sheet) ----------
function openIdea(id, opts = {}) {
  const x = id ? getIdea(id) : normalizeIdea({ tag: ideaUi.tag });
  ldraft = { kind: 'idea', id: x.id, isNew: !id, status: x.status, quick: !!opts.quick };
  const f = $('libForm');
  const st = Object.entries(IDEA_STATUS).map(([v, l]) => `<button type="button" data-action="idea-status" data-v="${v}" aria-pressed="${x.status === v}">${l}</button>`).join('');
  f.innerHTML = `
    <div class="sheet-head"><h2>${id ? 'فكرة' : '💡 فكرة جديدة'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>الفكرة</span><textarea id="iText" rows="3" placeholder="اكتبها كما خطرت لك">${esc(x.text)}</textarea></label>
    ${opts.quick ? '' : `
    <label class="field"><span>طوّرها</span><textarea id="iDetails" rows="5" placeholder="لماذا هي مهمة؟ كيف أنفّذها؟ ما الخطوة الأولى؟">${esc(x.details)}</textarea></label>
    ${AI.on() ? `<button type="button" class="ghost ai-btn" data-action="idea-ai">${icon('spark')} طوّرها بالذكاء الاصطناعي</button>` : ''}
    <div class="field"><span>الحالة</span><div class="seg seg-wrap" id="iStatus" role="group">${st}</div></div>`}
    <div class="grid2">
      <label class="field"><span>الوسم</span><input type="text" id="iTag" value="${esc(x.tag)}" list="ideaTags" autocomplete="off" placeholder="مشاريع، كتابة، عمل…"></label>
      <label class="switch idea-star-sw"><input type="checkbox" id="iStar"${x.star ? ' checked' : ''}><span>فكرة مميزة ★</span></label>
    </div>
    <datalist id="ideaTags">${ideaTags().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    ${opts.quick ? '' : `<div class="field"><span>حوّلها إلى</span>
      <div class="btn-row">
        <button type="button" class="ghost" data-action="idea-to" data-v="task">مهمة</button>
        <button type="button" class="ghost" data-action="idea-to" data-v="project">مشروع</button>
        <button type="button" class="ghost" data-action="idea-to" data-v="memo">ملاحظة</button>
      </div>
    </div>
    ${id ? `<p class="note-text">سُجّلت ${esc(dateBoth(iso(new Date(x.created)), true))} · ${esc(fmtTime(hmOf(new Date(x.created).getHours() * 60 + new Date(x.created).getMinutes())))}</p>` : ''}`}
    <div class="sheet-actions">
      <button type="submit" class="primary">${id ? 'حفظ' : 'احفظ الفكرة'}</button>
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  if (!id) setTimeout(() => { if (ldraft && ldraft.kind === 'idea' && document.activeElement !== $('iText')) $('iText').focus(); }, 60);
}

function readIdea() {
  const old = getIdea(ldraft.id);
  const { text, tag } = splitTag($('iText').value.trim());
  return normalizeIdea({
    ...(old || {}), id: ldraft.id, text, tag: $('iTag').value.trim() || tag,
    details: $('iDetails') ? $('iDetails').value.trim() : old ? old.details : '',
    status: ldraft.status, star: $('iStar').checked, updated: Date.now(),
  });
}
function saveIdea() {
  const x = readIdea();
  if (!x.text) { toast('اكتب الفكرة أولاً.'); return false; }
  const old = getIdea(x.id);
  if (old) Object.assign(old, x); else S.ideas.push(x);
  save();
  return true;
}

function ideaConvert(kind) {
  const x = readIdea();
  if (!x.text) { toast('اكتب الفكرة أولاً.'); return; }
  const [title, ...rest] = x.text.split('\n');
  const body = [rest.join('\n').trim(), x.details].filter(Boolean).join('\n');
  x.convertedTo = { task: 'مهمة', project: 'مشروع', memo: 'ملاحظة' }[kind];
  if (x.status === 'new') x.status = 'grow';
  const old = getIdea(x.id);
  if (old) Object.assign(old, x); else S.ideas.push(x);
  save();
  closeLib();
  if (kind === 'task') {
    openSheet(null, { prefill: normalize({ id: uid(), kind: 'task', title, category: x.tag, notes: body ? [{ id: uid(), text: body, at: Date.now() }] : [], created: Date.now() }) });
  } else if (kind === 'project') {
    openProjectSheet(null);
    $('pName').value = title;
    if ($('pDesc')) $('pDesc').value = body;
  } else {
    const m = normalizeMemo({ title, html: plainToNoteHTML(body), body });
    S.memos.push(m);
    save();
    openMemo(m.id);
  }
  render();
}

async function ideaAI(btn) {
  const text = $('iText').value.trim();
  if (!text) { toast('اكتب الفكرة أولاً.'); return; }
  btn.disabled = true;
  const label = btn.innerHTML;
  btn.textContent = 'جارٍ التفكير…';
  try {
    const out = await AI.ask({
      system: 'أنت مساعد يطوّر الأفكار الشخصية باختصار وبالعربية. اكتب نصاً عادياً بلا Markdown ولا رموز نجمية، بهذه العناوين كل منها في سطر يليه نقاط تبدأ بـ «- »: لماذا تستحق؟ / كيف أنفّذها؟ / الخطوة الأولى اليوم / ما الذي قد يعيقها؟ اجعل كل قسم من نقطتين إلى ثلاث، عملية ومحددة.',
      prompt: `الفكرة: ${text}${$('iDetails').value.trim() ? `\nما كتبته عنها: ${$('iDetails').value.trim()}` : ''}`,
      effort: 'low',
      maxTokens: 3000,
    });
    const d = $('iDetails');
    if (d && out) { d.value = (d.value.trim() ? d.value.trim() + '\n\n' : '') + out.trim(); d.dispatchEvent(new Event('input', { bubbles: true })); }
  } catch (e) {
    toast(AI.friendly(e));
  }
  if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="idea-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'idea-quick': openIdea(null, { quick: true }); break;
    case 'idea-open': openIdea(v); break;
    case 'idea-filter': ideaUi.filter = v; render(); break;
    case 'idea-tag': ideaUi.tag = v; render(); break;
    case 'idea-starred': ideaUi.star = !ideaUi.star; render(); break;
    case 'idea-star': { const x = getIdea(v); if (x) { x.star = !x.star; x.updated = Date.now(); save(); render(); } break; }
    case 'idea-status':
      ldraft.status = v;
      for (const b of $('iStatus').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      break;
    case 'idea-to': ideaConvert(v); break;
    case 'idea-ai': ideaAI(el); break;
  }
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'ideaQuick') return;
  e.preventDefault();
  const ta = $('ideaQuickText');
  const idea = addIdea(ta.value, { tag: ideaUi.tag });
  if (!idea) { ta.focus(); return; }
  ta.value = '';
  if (ideaUi.filter === 'closed') ideaUi.filter = 'open';
  render();
  $('ideaQuickText').focus();
  toast(idea.tag ? `حُفظت في «${idea.tag}»` : 'حُفظت الفكرة');
});
// Enter saves from the quick box (Shift+Enter for a new line)
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'ideaQuickText' || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  $('ideaQuick').requestSubmit();
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'ideaSearch') { ideaUi.q = e.target.value; render(); }
});

Object.assign(LibraryViews, { ideas: viewIdeas });
