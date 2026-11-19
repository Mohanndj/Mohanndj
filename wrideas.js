'use strict';
// «أفكار عاجلة» in «مؤلفاتي» (v179, his request: «أضع فيها أفكار عاجلة كيلا أنساها تعتمد على الشطب
// إذا انتهيت منها» then «أريدها في مساحة يمكنني أن أكتب فيها بتفصيل يعني صفحة أدخلها»): each tab
// (books, articles, posts) has a page of its own ideas, each a title and details, ticked off when done.
// Their own collection: S.wrIdeas (synced and in the backup, unlike the works themselves).

wrUi.ideas = false;

function normalizeWrIdea(x) {
  return {
    id: x.id || uid(), kind: WR_KINDS[x.kind] ? x.kind : 'book', title: String(x.title || ''), text: String(x.text || ''),
    done: /^\d{4}-\d{2}-\d{2}$/.test(x.done || '') ? x.done : '', created: x.created || Date.now(), updated: x.updated || x.created || Date.now(),
  };
}
const getWrIdea = (id) => S.wrIdeas.find((x) => x.id === id);
const wrIdeasOf = (k) => S.wrIdeas.filter((x) => x.kind === k);

// the button in each tab
function wrIdeasBtn(k) {
  const l = wrIdeasOf(k), left = l.filter((x) => !x.done).length, done = l.length - left;
  return `<button type="button" class="wr-book wr-ideas-btn" data-action="wri-page"><b>📝 أفكار عاجلة</b><span class="book-line">${l.length ? `باقية: ${left ? left : 'لا شيء'}${done ? ` | تم: ${done}` : ''}` : 'لا أفكار بعد'}</span></button>`;
}

// the page
function wrIdeasHTML() {
  const k = wrUi.tab, l = wrIdeasOf(k);
  const open = l.filter((x) => !x.done).sort((a, b) => b.created - a.created);
  const done = l.filter((x) => x.done).sort((a, b) => b.done.localeCompare(a.done) || b.updated - a.updated);
  const card = (x) => `<div class="wri-card${x.done ? ' done' : ''}">
      <button type="button" class="wri-tick" data-action="wri-tick" data-v="${x.id}" aria-pressed="${!!x.done}" aria-label="${esc(x.done ? `أعد «${x.title || 'الفكرة'}»` : `انتهيت من «${x.title || 'الفكرة'}»`)}">${x.done ? '✓' : ''}</button>
      <button type="button" class="wri-body" data-action="wri-open" data-v="${x.id}"><b>${esc(x.title || excerpt(x.text.split('\n')[0], 60) || 'فكرة بلا عنوان')}</b>
        ${x.text && x.title ? `<span class="wri-text">${esc(x.text)}</span>` : ''}
        <small>${esc(x.done ? `انتهيت منها: ${relDate(x.done)}` : relDate(iso(new Date(x.created))))}</small></button>
    </div>`;
  return `${moreCrumb()}
  <section class="panel">
    <button type="button" class="ghost sm wri-back" data-action="wri-back">‹ رجوع إلى «${esc(WR_KINDS[k].tab)}»</button>
    <div class="section-head"><h2>أفكار عاجلة: ${esc(WR_KINDS[k].tab)}</h2></div>
    <button type="button" class="primary wri-new" data-action="wri-new">${icon('plus')} فكرة جديدة</button>
    ${open.length ? `<div class="wri-list">${open.map(card).join('')}</div>` : `<p class="note-text">${l.length ? 'انتهيت من كل أفكارك ✓' : 'لا أفكار بعد. اضغط «فكرة جديدة» واكتبها قبل أن تنساها.'}</p>`}
    ${done.length ? `<details class="shop-done"><summary>تم (${done.length}) | اضغط الدائرة لتعيد الفكرة</summary><div class="wri-list">${done.map(card).join('')}</div></details>` : ''}
  </section>`;
}

// one idea, to write in detail
function openWrIdea(id) {
  const x = id ? getWrIdea(id) : normalizeWrIdea({ kind: wrUi.tab });
  if (!x) return;
  ldraft = { kind: 'wridea', id: x.id, isNew: !id, wk: x.kind };
  $('libForm').innerHTML = `${sheetHead(id ? 'فكرة عاجلة' : 'فكرة عاجلة جديدة')}
    <label class="field"><span>العنوان</span><input type="text" id="wriTitle" value="${esc(x.title)}" autocomplete="off" placeholder="الفكرة في سطر"></label>
    <label class="field"><span>التفاصيل</span><textarea id="wriText" rows="14" dir="auto" placeholder="اكتب ما تشاء…">${esc(x.text)}</textarea></label>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? `<button type="button" class="ghost" data-action="wri-done">${x.done ? '↩ أعدها' : '✓ انتهيت منها'}</button><button type="button" class="danger" data-action="wri-del">حذف</button>` : ''}</div>`;
  showLib();
  $('libForm').scrollTop = 0;
  if (!id) setTimeout(() => { if ($('wriTitle') && lsheet().open) $('wriTitle').focus(); }, 50);
}
function wrIdeaKeep() { // what is in the window, into the idea (false: nothing written)
  const title = $('wriTitle').value.trim(), text = $('wriText').value.trim();
  if (!title && !text) return false;
  const old = getWrIdea(ldraft.id);
  const x = normalizeWrIdea({ ...(old || { kind: ldraft.wk }), id: ldraft.id, title, text, updated: Date.now() });
  if (old) Object.assign(old, x); else S.wrIdeas.push(x);
  return old || x;
}
function saveWrIdea() {
  if (!wrIdeaKeep()) { toast('اكتب عنواناً أو تفاصيل.'); return false; }
  save();
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="wri-"]');
  if (!el) return;
  const a = el.dataset.action, v = el.dataset.v;
  if (a === 'wri-page') { wrUi.ideas = true; render(); scrollTo(0, 0); return; }
  if (a === 'wri-back') { wrUi.ideas = false; render(); return; }
  if (a === 'wri-new') { openWrIdea(null); return; }
  if (a === 'wri-open') { openWrIdea(v); return; }
  if (a === 'wri-tick') {
    const x = getWrIdea(v);
    if (!x) return;
    x.done = x.done ? '' : today(); x.updated = Date.now();
    if (x.done) haptic();
    save(); render();
    return;
  }
  if (a === 'wri-done') { // what is written is kept, then ticked or brought back
    const x = wrIdeaKeep();
    if (!x) { toast('اكتب عنواناً أو تفاصيل.'); return; }
    x.done = x.done ? '' : today(); x.updated = Date.now();
    save(); closeLib(); render();
    toast(x.done ? 'انتهيت منها ✓' : 'أُعيدت إلى أفكارك');
    return;
  }
  if (a === 'wri-del') {
    if (!selArmed(el)) return;
    S.wrIdeas = S.wrIdeas.filter((x) => x.id !== ldraft.id);
    save(); closeLib(); render(); toast('حُذفت');
  }
});
