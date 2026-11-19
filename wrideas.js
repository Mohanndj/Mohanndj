'use strict';
// «أفكار عاجلة» in «مؤلفاتي» (v179, his request: «أضع فيها أفكار عاجلة كيلا أنساها تعتمد على الشطب
// إذا انتهيت منها» then «أريدها في مساحة يمكنني أن أكتب فيها بتفصيل يعني صفحة أدخلها»): each tab
// (books, articles, posts) has a page of its own ideas, each a title and details, ticked off when done.
// Their own collection: S.wrIdeas (synced and in the backup, unlike the works themselves).
// v181 (his words: «عدل الخطأ الموجود في قلب التفصيل، وأضف خانة أستطيع من خلالها وضع اسم الكتاب، واقتصر على أفكار بدلا من
// أفكار عاجلة، واجعل ارتباطها بالكتاب يجعل تظهر في أيقونة منبثقة عائمة داخل الكتاب الذي يخصها بحيث أحرر وهي معي وعلامتها ضوء
// أصفر» and «كذلك أضف القدر على وضع نقاط»): «أفكار»; an idea of the books tab may name one of his books (`book`), and in
// that book's editor a yellow light floats, opening its ideas beside the text; the details are written right to left,
// with a button for points «• ».

wrUi.ideas = false;

function normalizeWrIdea(x) {
  return {
    id: x.id || uid(), kind: WR_KINDS[x.kind] ? x.kind : 'book', title: String(x.title || ''), text: String(x.text || ''), book: String(x.book || ''),
    done: /^\d{4}-\d{2}-\d{2}$/.test(x.done || '') ? x.done : '', created: x.created || Date.now(), updated: x.updated || x.created || Date.now(),
  };
}
const getWrIdea = (id) => S.wrIdeas.find((x) => x.id === id);
const wrIdeasOf = (k) => S.wrIdeas.filter((x) => x.kind === k);

// the button in each tab
function wrIdeasBtn(k) {
  const l = wrIdeasOf(k), left = l.filter((x) => !x.done).length, done = l.length - left;
  return `<button type="button" class="wr-book wr-ideas-btn" data-action="wri-page"><b>💡 أفكار</b><span class="book-line">${l.length ? `باقية: ${left ? left : 'لا شيء'}${done ? ` | تم: ${done}` : ''}` : 'لا أفكار بعد'}</span></button>`;
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
        <small>${esc([wrIdeaBook(x) ? `الكتاب: ${wrIdeaBook(x).title || WR_KINDS.book.none}` : '', x.done ? `انتهيت منها: ${relDate(x.done)}` : relDate(iso(new Date(x.created)))].filter(Boolean).join(' | '))}</small></button>
    </div>`;
  return `${moreCrumb()}
  <section class="panel">
    <button type="button" class="ghost sm wri-back" data-action="wri-back">‹ رجوع إلى «${esc(WR_KINDS[k].tab)}»</button>
    <div class="section-head"><h2>أفكار: ${esc(WR_KINDS[k].tab)}</h2></div>
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
  const books = x.kind === 'book' && wrUi.list ? wrUi.list.filter((b) => b.kind === 'book') : [];
  $('libForm').innerHTML = `${sheetHead(id ? 'فكرة' : 'فكرة جديدة')}
    <label class="field"><span>العنوان</span><input type="text" id="wriTitle" value="${esc(x.title)}" autocomplete="off" placeholder="الفكرة في سطر" dir="rtl"></label>
    ${x.kind === 'book' ? `<label class="field"><span>الكتاب</span><select id="wriBook"><option value="">بلا كتاب</option>${books.map((b) => `<option value="${b.id}"${b.id === x.book ? ' selected' : ''}>${esc(b.title || WR_KINDS.book.none)}</option>`).join('')}${x.book && !books.some((b) => b.id === x.book) ? `<option value="${esc(x.book)}" selected>كتاب ليس في هذا الجهاز</option>` : ''}</select></label>` : ''}
    <div class="field"><span class="row-between"><span>التفاصيل</span><button type="button" class="ghost sm" data-action="wri-dot" aria-label="نقطة جديدة">• نقطة</button></span><textarea id="wriText" rows="14" dir="rtl" placeholder="اكتب ما تشاء…">${esc(x.text)}</textarea></div>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? `<button type="button" class="ghost" data-action="wri-done">${x.done ? '↩ أعدها' : '✓ انتهيت منها'}</button><button type="button" class="danger" data-action="wri-del">حذف</button>` : ''}</div>`;
  showLib();
  $('libForm').scrollTop = 0;
  if (!id) setTimeout(() => { if ($('wriTitle') && lsheet().open) $('wriTitle').focus(); }, 50);
}
function wrIdeaKeep() { // what is in the window, into the idea (false: nothing written)
  const title = $('wriTitle').value.trim(), text = $('wriText').value.replace(/\n[ \t]*•[ \t]*$/, '').trim();
  if (!title && !text) return false;
  const old = getWrIdea(ldraft.id);
  const x = normalizeWrIdea({ ...(old || { kind: ldraft.wk }), id: ldraft.id, title, text, ...($('wriBook') ? { book: $('wriBook').value } : {}), updated: Date.now() });
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
  if (a === 'wri-dot') { wrIdeaDot(); return; }
  if (a === 'wri-light') { wrIdeasPop(!$('wrIdeasPop') || $('wrIdeasPop').hidden); return; }
  if (a === 'wri-ltick') {
    const x = getWrIdea(v);
    if (!x) return;
    x.done = today(); x.updated = Date.now();
    haptic(); save();
    wrIdeaLight();
    toast('انتهيت منها ✓');
    return;
  }
  if (a === 'wri-del') {
    if (!selArmed(el)) return;
    S.wrIdeas = S.wrIdeas.filter((x) => x.id !== ldraft.id);
    save(); closeLib(); render(); toast('حُذفت');
  }
});

const wrIdeaBook = (x) => (x.kind === 'book' && x.book && wrUi.list ? wrUi.list.find((b) => b.id === x.book && b.kind === 'book') : null);

// «• نقطة»: a point at the start of the line (a new line first, when the line has text)
function wrIdeaDot() {
  const t = $('wriText');
  if (!t) return;
  const v = t.value, at = t.selectionStart ?? v.length, start = v.lastIndexOf('\n', at - 1) + 1;
  const line = v.slice(start, at);
  t.focus();
  if (/^\s*•\s*$/.test(line)) return; // (a point already, waiting for its words)
  if (line.trim()) t.setRangeText('\n• ', at, at, 'end');
  else t.setRangeText('• ', start, at, 'end');
}
// Enter after a point: the next line starts with a point; Enter on an empty point ends the points
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.id !== 'wriText' || e.shiftKey) return;
  const t = e.target, v = t.value, at = t.selectionStart;
  if (at !== t.selectionEnd) return;
  const start = v.lastIndexOf('\n', at - 1) + 1, line = v.slice(start, at);
  if (!/^\s*•/.test(line)) return;
  e.preventDefault();
  if (/^\s*•\s*$/.test(line)) t.setRangeText('', start, at, 'end');
  else t.setRangeText('\n• ', at, at, 'end');
});
// on a phone the keyboard may not send «Enter» as a key: the new line is read after it is written
document.addEventListener('input', (e) => {
  if (e.target.id !== 'wriText' || e.inputType !== 'insertLineBreak' && !(e.inputType === 'insertText' && e.data === null)) return;
  const t = e.target, v = t.value, at = t.selectionStart;
  if (v[at - 1] !== '\n') return;
  const prev = v.lastIndexOf('\n', at - 2) + 1, line = v.slice(prev, at - 1);
  if (!/^\s*•/.test(line)) return;
  if (/^\s*•\s*$/.test(line)) t.setRangeText('', prev, at, 'end');
  else t.setRangeText('• ', at, at, 'end');
});

// the yellow light in a book's editor: there when the book has ideas not done; it opens them beside the text
const wrBookIdeas = (id) => S.wrIdeas.filter((x) => x.kind === 'book' && x.book === id && !x.done).sort((a, b) => b.created - a.created);
function wrIdeaLight() {
  const d = $('wrEditor');
  if (!d) return;
  if (!$('wrIdeasBtn')) d.insertAdjacentHTML('beforeend', `<button type="button" class="wr-light" id="wrIdeasBtn" data-action="wri-light" aria-label="أفكار هذا الكتاب" hidden>💡<span id="wrIdeasN"></span></button><div class="wr-ideas" id="wrIdeasPop" hidden></div>`);
  const b = wrState && wrState.book, l = b && b.kind === 'book' ? wrBookIdeas(b.id) : [];
  $('wrIdeasBtn').hidden = !l.length;
  $('wrIdeasN').textContent = l.length ? digitsOut(String(l.length)) : '';
  if (!l.length) { $('wrIdeasPop').hidden = true; return; }
  if (!$('wrIdeasPop').hidden) wrIdeasPop(true);
}
function wrIdeasPop(open) {
  const pop = $('wrIdeasPop');
  if (!pop) return;
  if (!open) { pop.hidden = true; return; }
  const l = wrState ? wrBookIdeas(wrState.book.id) : [];
  pop.innerHTML = `<div class="wr-ideas-head"><b>💡 أفكار هذا الكتاب</b><button type="button" class="icon-btn" data-action="wri-light" aria-label="إغلاق">✕</button></div>
    <div class="wr-ideas-list">${l.map((x) => `<div class="wri-card"><button type="button" class="wri-tick" data-action="wri-ltick" data-v="${x.id}" aria-label="${esc(`انتهيت من «${x.title || 'الفكرة'}»`)}"></button>
      <div class="wri-body"><b>${esc(x.title || 'فكرة بلا عنوان')}</b>${x.text ? `<span class="wr-ideas-text">${esc(x.text)}</span>` : ''}</div></div>`).join('')}</div>`;
  pop.hidden = false;
}
// back (and Escape) closes the ideas before the editor
function wrIdeasClose() { const p = $('wrIdeasPop'); if (p && !p.hidden) { p.hidden = true; return true; } return false; }
