'use strict';
// «قائمة الشراء»: what the house or I need. Ticking an item strikes it through and keeps it under
// «تم شراؤه», so recurring needs come back with one tap instead of being typed again.

const SHOP_CATS = { home: ['البيت', '🏠'], me: ['شخصي', '👤'] };
const shopUi = { cat: 'home', q: '' };

function normalizeShop(x) {
  return {
    id: x.id || uid(), name: String(x.name || ''), cat: SHOP_CATS[x.cat] ? x.cat : 'home', need: x.need !== false,
    qty: String(x.qty || ''), boughtAt: x.boughtAt || '', times: Number(x.times) || 0, created: x.created || Date.now(), updated: x.updated || Date.now(),
  };
}
// add names to the list: an existing item (needed or bought before) is reused, not duplicated
function addToShop(names, cat) {
  let n = 0;
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const ex = S.shop.find((x) => x.name === name && x.cat === cat);
    if (ex) { if (!ex.need) { ex.need = true; ex.updated = Date.now(); n++; } continue; }
    S.shop.push(normalizeShop({ name, cat })); n++;
  }
  save();
  return n;
}

function shopListHTML(compact) {
  const cat = shopUi.cat;
  const items = S.shop.filter((x) => x.cat === cat);
  const need = items.filter((x) => x.need).sort((a, b) => b.updated - a.updated);
  const t0 = today();
  // bought today stay visible (struck through); older ones fold away under «تم شراؤه»
  const boughtToday = items.filter((x) => !x.need && x.boughtAt === t0);
  const bought = items.filter((x) => !x.need && x.boughtAt !== t0).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name, 'ar'));
  const row = (x) => `<li class="${x.need ? '' : 'got'}"><button type="button" class="shop-item" data-action="shop-toggle" data-v="${x.id}" aria-pressed="${!x.need}">
      <span class="shop-box" aria-hidden="true">${x.need ? '' : '✓'}</span><span class="shop-name">${esc(x.name)}${x.qty ? ` <small>${esc(x.qty)}</small>` : ''}</span>
    </button>${compact ? '' : `<button type="button" class="fin-del" data-action="shop-del" data-v="${x.id}" aria-label="حذف نهائي">✕</button>`}</li>`;
  const counts = Object.fromEntries(Object.keys(SHOP_CATS).map((k) => [k, S.shop.filter((x) => x.cat === k && x.need).length]));
  return `<div class="seg shop-cats" role="group">${Object.entries(SHOP_CATS).map(([k, v]) => `<button type="button" data-action="shop-cat" data-v="${k}" aria-pressed="${cat === k}">${v[1]} ${v[0]}${counts[k] ? ` <span class="num">${counts[k]}</span>` : ''}</button>`).join('')}</div>
    <form class="idea-quick shop-add" data-shop-form autocomplete="off">
      <input type="text" name="what" placeholder="${cat === 'home' ? 'ماذا يحتاج البيت؟' : 'ماذا تحتاج؟'} مثل: حليب، خبز" aria-label="أضف إلى قائمة الشراء">
      <button type="submit" class="primary">${icon('plus')}</button>
    </form>
    ${need.length || boughtToday.length ? `<ul class="shop-list">${need.map(row).join('')}${boughtToday.map(row).join('')}</ul>` : '<p class="note-text">لا شيء ينقص. أضف ما تتذكره قبل أن تنساه.</p>'}
    ${bought.length ? `<details class="shop-done"><summary>تم شراؤه (${bought.length}) · اضغط أي شيء لتعيده إلى القائمة</summary><ul class="shop-list">${bought.map(row).join('')}</ul></details>` : ''}`;
}

// «اليوم»
function shopTodayHTML() {
  return todayBlock('قائمة الشراء', 'shop', shopListHTML(true));
}
function viewShop() {
  return `${moreCrumb()}<section class="section"><h2>قائمة الشراء</h2>
    <p class="note-text">ما تشتريه يُشطب ولا يُحذف: يبقى في «تم شراؤه» لتعيده بضغطة حين تحتاجه مرة أخرى. ✕ يحذفه نهائياً.</p>
    ${shopListHTML(false)}</section>`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="shop-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'shop-cat') { shopUi.cat = v; render(); return; }
  const x = S.shop.find((i) => i.id === v);
  if (!x) return;
  if (action === 'shop-toggle') {
    if (x.need) { x.need = false; x.boughtAt = today(); x.times++; } else { x.need = true; }
    x.updated = Date.now();
    save(); render();
  }
  if (action === 'shop-del') { S.shop = S.shop.filter((i) => i.id !== v); save(); render(); }
});
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-shop-form]')) return;
  e.preventDefault();
  const inp = e.target.elements.what;
  const names = inp.value.split(/[،,\n]+/);
  const n = addToShop(names, shopUi.cat);
  inp.value = '';
  render();
  const again = document.querySelector('[data-shop-form] input');
  if (again) again.focus();
  if (!n && names.some((s) => s.trim())) toast('موجود في القائمة');
});

Object.assign(LibraryViews, { shop: viewShop });
