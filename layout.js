'use strict';
// Arranging «اليوم» and «المزيد» the way the user likes: the order of their parts, and on «اليوم»
// which parts show at all. Saved in S.settings (todayOrder, todayHidden, moreOrder).

const TODAY_PARTS = [
  ['quote', 'عبارة اليوم'], ['smart', 'الإضافة السريعة'], ['summary', 'ملخص اليوم'], ['prayer', 'أوقات الصلاة'],
  ['hifz', 'الحفظ'], ['habits', 'بناء العادات'], ['health', 'الصحة'], ['books', 'الكتب'], ['benefits', 'الفوائد'],
  ['decisions', 'سجل القرارات'], ['people', 'الأحبّة'], ['bills', 'الاشتراكات والفواتير'], ['later', 'الشراء المؤجّل'],
  ['journal', 'يومياتي وتأملاتي'], ['lists', 'القوائم'], ['tasks', 'المهام والأهداف'],
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
  const names = isToday ? Object.fromEntries(TODAY_PARTS) : Object.fromEntries(moreTiles().map(([k, , n]) => [k, n]));
  const order = isToday ? todayOrder() : orderOf(moreTiles().map(([k]) => k), S.settings.moreOrder);
  ldraft = { kind: 'layout', id: 'x', isNew: false, which, names, order, hidden: isToday ? todayHidden().slice() : [] };
  renderLayout();
  showLib();
}
function renderLayout() {
  const { which, names, order, hidden } = ldraft;
  const isToday = which === 'today';
  $('libForm').innerHTML = `${sheetHead(isToday ? 'رتّب صفحة اليوم' : 'رتّب صفحات المزيد')}
    <p class="note-text">${isToday ? 'غيّر مكان أي قسم بالسهمين، وأخفِ ما لا تريده في «اليوم». الأقسام لا تظهر إلا إن كان فيها ما يخص يومك.' : 'غيّر مكان أي صفحة بالسهمين، فتظهر في «المزيد» بالترتيب الذي تختاره.'}</p>
    <ul class="lay-list">${order.map((k, i) => `<li class="${hidden.includes(k) ? 'off' : ''}">
      <span class="lay-name">${esc(names[k])}</span>
      ${isToday ? `<label class="lay-show"><input type="checkbox" data-lay-show="${k}"${hidden.includes(k) ? '' : ' checked'}><span>${hidden.includes(k) ? 'مخفي' : 'ظاهر'}</span></label>` : ''}
      <button type="button" class="icon-btn lay-mv" data-action="lay-move" data-v="${i}" data-d="-1" aria-label="إلى الأعلى"${i ? '' : ' disabled'}>▲</button>
      <button type="button" class="icon-btn lay-mv" data-action="lay-move" data-v="${i}" data-d="1" aria-label="إلى الأسفل"${i < order.length - 1 ? '' : ' disabled'}>▼</button>
    </li>`).join('')}</ul>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ الترتيب</button><button type="button" class="ghost" data-action="lay-reset">الترتيب الأصلي</button></div>`;
}
function saveLayout() {
  if (ldraft.which === 'today') { S.settings.todayOrder = ldraft.order.slice(); S.settings.todayHidden = ldraft.hidden.slice(); } else S.settings.moreOrder = ldraft.order.slice();
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
  if (action === 'lay-reset') {
    ldraft.order = ldraft.which === 'today' ? TODAY_PARTS.map(([k]) => k) : moreTiles().map(([k]) => k);
    ldraft.hidden = [];
    renderLayout();
  }
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.layShow;
  if (!k || !ldraft || ldraft.kind !== 'layout') return;
  ldraft.hidden = e.target.checked ? ldraft.hidden.filter((x) => x !== k) : [...ldraft.hidden, k];
  renderLayout();
});
