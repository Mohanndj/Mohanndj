'use strict';
// Arranging «اليوم» and «المزيد» the way the user likes: the order of their parts, and on «اليوم»
// which parts show at all. Saved in S.settings (todayOrder, todayHidden, moreOrder).

const TODAY_PARTS = [
  ['close', 'إغلاق اليوم (مساءً)'], ['quote', 'عبارة اليوم'], ['smart', 'الإضافة السريعة'], ['summary', 'ملخص اليوم'], ['prayer', 'أوقات الصلاة'],
  ['hifz', 'الحفظ'], ['study', 'الدراسة'], ['habits', 'بناء العادات'], ['health', 'الصحة'], ['books', 'الكتب'], ['benefits', 'الفوائد'],
  ['decisions', 'سجل القرارات'], ['people', 'الأحبّة'], ['bills', 'الاشتراكات والفواتير'], ['later', 'الشراء المؤجّل'],
  ['journal', 'يومياتي وتأملاتي'], ['spend', 'المصروف'], ['lists', 'القوائم'], ['reminders', 'التذكيرات'], ['tasks', 'المهام والأهداف'],
];

// the saved order, with parts added in later versions slotted in after their default neighbour
function orderOf(defaults, saved) {
  const out = (Array.isArray(saved) ? saved : []).filter((k, i, a) => defaults.includes(k) && a.indexOf(k) === i);
  defaults.forEach((k, i) => {
    if (out.includes(k)) return;
    const prev = defaults.slice(0, i).reverse().find((p) => out.includes(p));
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, k);
  });
  return out;
}
const todayOrder = () => orderOf(TODAY_PARTS.map(([k]) => k), S.settings.todayOrder);
const todayHidden = () => (Array.isArray(S.settings.todayHidden) ? S.settings.todayHidden : []);

function openLayout(which) {
  const isToday = which === 'today';
  const names = isToday ? Object.fromEntries(TODAY_PARTS.map(([k, n]) => [k, PART_PAGE[k] ? pageName(PART_PAGE[k]) : n])) : Object.fromEntries(moreTiles().map(([k, , n]) => [k, n]));
  const order = isToday ? todayOrder() : orderOf(moreTiles().map(([k]) => k), S.settings.moreOrder);
  ldraft = { kind: 'layout', id: 'x', isNew: false, which, names, order, hidden: isToday ? todayHidden().slice() : [], look: JSON.parse(JSON.stringify(moreLook())) };
  renderLayout();
  showLib();
}
// «المزيد» pages can be renamed, given an emoji and a colour, to tell them apart at a glance
const LOOK_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#64748b'];
const moreLook = () => (S.settings.moreLook && typeof S.settings.moreLook === 'object' ? S.settings.moreLook : {});
const lookOf = (k) => moreLook()[k] || {};
// a page's name as the user set it, used wherever the page is named: its own heading, its section on
// «اليوم» and the button to it, the evening close, the report, files exported from it and messages
const PAGE_NAMES = {
  reminders: 'التذكيرات', ideas: 'الأفكار', journal: 'يومياتي وتأملاتي', calendar: 'التقويم', habits: 'العادات', health: 'الصحة', shop: 'القوائم',
  finance: 'المالية', cv: 'سيرتي الذاتية', hifz: 'الحفظ', study: 'الدراسة', people: 'الأحبّة', decisions: 'سجل القرارات', notes: 'الملاحظات',
  books: 'الكتب', benefits: 'الفوائد', archive: 'الأرشيف', inspire: 'الإلهام', report: 'التقارير', stats: 'الإحصائيات',
};
const pageName = (tab) => (lookOf(tab).name || PAGE_NAMES[tab] || '').trim();
// a page's own heading (an h2 that says exactly its default name) takes the name the user gave it
function renameHeads(root) {
  const renamed = Object.keys(PAGE_NAMES).filter((k) => lookOf(k).name);
  if (!renamed.length) return;
  for (const h of root.querySelectorAll('h2, .close-sec > b')) {
    const k = renamed.find((x) => h.firstChild && h.firstChild.nodeType === 3 && h.firstChild.textContent.trim() === PAGE_NAMES[x]);
    if (k) h.firstChild.textContent = pageName(k) + (h.childNodes.length > 1 ? ' ' : '');
  }
}
// «اليوم» parts that are a page's section carry that page's name in «رتّب صفحة اليوم»
const PART_PAGE = { hifz: 'hifz', health: 'health', books: 'books', benefits: 'benefits', decisions: 'decisions', people: 'people', journal: 'journal', lists: 'shop', reminders: 'reminders', study: 'study' };
function renderLayout() {
  const { which, names, order, hidden } = ldraft;
  const isToday = which === 'today';
  $('libForm').innerHTML = `${sheetHead(isToday ? 'رتّب صفحة اليوم' : 'رتّب صفحات المزيد')}
    <p class="note-text explain">${isToday ? 'غيّر مكان أي قسم بالسهمين، وأخفِ ما لا تريده في «اليوم». الأقسام لا تظهر إلا إن كان فيها ما يخص يومك.' : 'غيّر مكان أي صفحة بالسهمين، فتظهر في «المزيد» بالترتيب الذي تختاره.'}</p>
    ${isToday ? '' : '<p class="note-text explain">ولكل صفحة: اكتب علامة تعبيرية واسماً تختاره، واختر لوناً، فتميّزها بنظرة.</p>'}
    <ul class="lay-list">${order.map((k, i) => { const lk = (ldraft.look || {})[k] || {}; return `<li class="${hidden.includes(k) ? 'off' : ''}${isToday ? '' : ' lay-look'}"${!isToday && lk.color ? ` style="--tc:${lk.color}"` : ''}>
      ${isToday ? `<span class="lay-name">${esc(names[k])}</span>` : `<span class="lay-edit">
        <input type="text" class="lay-emoji" data-lay-emoji="${k}" value="${esc(lk.emoji || '')}" placeholder="🙂" maxlength="4" aria-label="علامة تعبيرية" autocomplete="off" data-novoice>
        <input type="text" class="lay-title" data-lay-title="${k}" value="${esc(lk.name || '')}" placeholder="${esc(names[k])}" aria-label="اسم الصفحة" autocomplete="off" data-novoice>
        <span class="lay-colors">${['', ...LOOK_COLORS].map((c) => `<button type="button" class="lay-c${(lk.color || '') === c ? ' on' : ''}" data-action="lay-color" data-v="${k}" data-c="${c}" style="--c:${c || 'transparent'}" aria-label="${c ? 'لون' : 'بلا لون'}"></button>`).join('')}</span>
      </span>`}
      ${isToday ? `<label class="lay-show"><input type="checkbox" data-lay-show="${k}"${hidden.includes(k) ? '' : ' checked'}><span>${hidden.includes(k) ? 'مخفي' : 'ظاهر'}</span></label>` : ''}
      <button type="button" class="icon-btn lay-mv" data-action="lay-move" data-v="${i}" data-d="-1" aria-label="إلى الأعلى"${i ? '' : ' disabled'}>▲</button>
      <button type="button" class="icon-btn lay-mv" data-action="lay-move" data-v="${i}" data-d="1" aria-label="إلى الأسفل"${i < order.length - 1 ? '' : ' disabled'}>▼</button>
    </li>`; }).join('')}</ul>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ الترتيب</button><button type="button" class="ghost" data-action="lay-reset">الترتيب الأصلي</button></div>`;
}
function saveLayout() {
  if (ldraft.which === 'today') { S.settings.todayOrder = ldraft.order.slice(); S.settings.todayHidden = ldraft.hidden.slice(); }
  else {
    S.settings.moreOrder = ldraft.order.slice();
    const look = {};
    for (const [k, v] of Object.entries(ldraft.look || {})) { const x = { name: String(v.name || '').trim(), emoji: String(v.emoji || '').trim(), color: v.color || '' }; if (x.name || x.emoji || x.color) look[k] = x; }
    S.settings.moreLook = look;
  }
  save();
  toast('حُفظ الترتيب');
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="lay-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'lay-open') { openLayout(v); return; }
  if (!ldraft || ldraft.kind !== 'layout') return;
  if (action === 'lay-move') {
    const i = Number(v), j = i + Number(el.dataset.d);
    if (j < 0 || j >= ldraft.order.length) return;
    [ldraft.order[i], ldraft.order[j]] = [ldraft.order[j], ldraft.order[i]];
    renderLayout();
    const again = $('libForm').querySelectorAll('.lay-mv')[j * 2 + (Number(el.dataset.d) < 0 ? 0 : 1)];
    if (again && !again.disabled) again.focus();
  }
  if (action === 'lay-color') {
    ldraft.look[v] = { ...(ldraft.look[v] || {}), color: el.dataset.c };
    renderLayout();
    return;
  }
  if (action === 'lay-reset') {
    ldraft.order = ldraft.which === 'today' ? TODAY_PARTS.map(([k]) => k) : moreTiles().map(([k]) => k);
    ldraft.hidden = [];
    renderLayout();
  }
});
// name and emoji are kept as they are typed (no redraw, so typing is not interrupted)
document.addEventListener('input', (e) => {
  const d = e.target.dataset || {};
  const k = d.layTitle || d.layEmoji;
  if (!k || !ldraft || ldraft.kind !== 'layout') return;
  ldraft.look[k] = { ...(ldraft.look[k] || {}), [d.layTitle ? 'name' : 'emoji']: e.target.value };
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.layShow;
  if (!k || !ldraft || ldraft.kind !== 'layout') return;
  ldraft.hidden = e.target.checked ? ldraft.hidden.filter((x) => x !== k) : [...ldraft.hidden, k];
  renderLayout();
});
