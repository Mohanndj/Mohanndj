'use strict';
// «القوائم»: lists of things not to forget: shopping for the house or for me, packing for a trip, and
// any list you add. Ticking an item strikes it through and keeps it under «تم», so recurring needs
// come back with one tap. Whatever is left unticked in any list stays on «اليوم» until it is done.

const LIST_ICONS = ['🏠', '👤', '🛒', '✈️', '🧳', '🎒', '🎁', '💊', '📚', '🧰', '🍼', '📝'];
const DEFAULT_LISTS = [{ id: 'home', name: 'مشتريات البيت', icon: '🏠' }, { id: 'me', name: 'مشترياتي الشخصية', icon: '👤' }];
const shopUi = { cat: 'home' };

function normalizeList(x) {
  return { id: x.id || uid(), name: String(x.name || 'قائمة'), icon: LIST_ICONS.includes(x.icon) ? x.icon : '📝', created: x.created || Date.now() };
}
function normalizeShop(x) {
  return {
    id: x.id || uid(), name: String(x.name || ''), cat: String(x.cat || 'home'), need: x.need !== false,
    qty: String(x.qty || ''), boughtAt: x.boughtAt || '', times: Number(x.times) || 0, created: x.created || Date.now(), updated: x.updated || Date.now(),
  };
}
const getList = (id) => S.lists.find((l) => l.id === id);
const curList = () => getList(shopUi.cat) || S.lists[0];
const listItems = (id) => S.shop.filter((x) => x.cat === id);
const listLeft = (id) => listItems(id).filter((x) => x.need).length;
// an item whose list is gone (an old backup, or a sync that brought items first) joins the first list
function adoptOrphans() {
  if (!S.lists.length) return;
  const home = getList('home') || S.lists[0];
  for (const x of S.shop) if (!getList(x.cat)) x.cat = home.id;
}

// add names to a list: an existing item (needed or done before) is reused, not duplicated
function addToShop(names, cat) {
  if (!getList(cat)) {
    if (!S.lists.length || cat === 'home') S.lists.unshift(normalizeList(DEFAULT_LISTS.find((l) => l.id === 'home')));
    if (!getList(cat)) cat = S.lists[0].id;
  }
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

const t0Done = (x) => !x.need && x.boughtAt === today();
function itemRow(x, compact) {
  return `<li class="${x.need ? '' : 'got'}"><button type="button" class="shop-item" data-action="shop-toggle" data-v="${x.id}" aria-pressed="${!x.need}">
      <span class="shop-box" aria-hidden="true">${x.need ? '' : '✓'}</span><span class="shop-name">${esc(x.name)}${x.qty ? ` <small>${esc(x.qty)}</small>` : ''}</span>
    </button>${compact ? '' : `<button type="button" class="fin-del" data-action="shop-del" data-v="${x.id}" aria-label="حذف نهائي">✕</button>`}</li>`;
}
const addForm = (l) => `<form class="idea-quick shop-add" data-shop-form autocomplete="off">
    <input type="text" name="what" placeholder="أضف إلى «${esc(l.name)}»، مثل: حليب، شاحن" aria-label="أضف بنداً">
    <button type="submit" class="primary">${icon('plus')}</button>
  </form>`;

// «اليوم»: one list at a time behind its button, so lists never mix. Each button shows what is
// left unticked in it; the first list with something left opens until you pick another.
function shopTodayHTML() {
  if (!S.lists.length) return '';
  adoptOrphans();
  if (!shopUi.picked || !getList(shopUi.cat)) { const first = S.lists.find((l) => listLeft(l.id)); shopUi.cat = (first || S.lists[0]).id; }
  const l = curList();
  const items = listItems(l.id).filter((x) => x.need || t0Done(x)).sort((a, b) => b.need - a.need || b.updated - a.updated);
  const btns = S.lists.length > 1 ? `<div class="seg seg-wrap shop-cats" role="group" aria-label="القوائم">${S.lists.map((x) => `<button type="button" data-action="shop-cat" data-v="${x.id}" aria-pressed="${x.id === l.id}">${x.icon} ${esc(x.name)}${listLeft(x.id) ? ` <span class="num">${listLeft(x.id)}</span>` : ''}</button>`).join('')}</div>` : '';
  return todayBlock('القوائم', 'shop', `${btns}
    ${addForm(l)}
    ${items.length ? `<ul class="shop-list">${items.map((x) => itemRow(x, true)).join('')}</ul>` : `<p class="note-text">لا شيء باقٍ في «${esc(l.name)}» ✓</p>`}`);
}

function viewShop() {
  adoptOrphans();
  const l = curList();
  if (!l) return `${moreCrumb()}<section class="section"><h2>القوائم</h2>${emptyHTML('لا قوائم', 'أنشئ قائمة لما لا تريد نسيانه.')}<button type="button" class="primary" data-action="shop-list-new">${icon('plus')} قائمة جديدة</button></section>`;
  const items = listItems(l.id);
  const need = items.filter((x) => x.need).sort((a, b) => b.updated - a.updated);
  const doneToday = items.filter(t0Done);
  const done = items.filter((x) => !x.need && !t0Done(x)).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name, 'ar'));
  const allDone = items.filter((x) => !x.need);
  return `${moreCrumb()}<section class="section">
    <h2>القوائم</h2>
    <p class="note-text explain">ما تشطبه لا يُحذف: يبقى في «تم» لتعيده بضغطة حين تحتاجه مرة أخرى. وكل ما بقي دون شطب يظهر لك في «اليوم».</p>
    <div class="chips list-chips" role="group" aria-label="القوائم">${S.lists.map((x) => `<button type="button" class="chip" data-action="shop-cat" data-v="${x.id}" aria-pressed="${x.id === l.id}">${x.icon} ${esc(x.name)}${listLeft(x.id) ? ` <span class="num">${listLeft(x.id)}</span>` : ''}</button>`).join('')}<button type="button" class="chip" data-action="shop-list-new">${icon('plus')} قائمة</button></div>
    <div class="section-head"><h3>${l.icon} ${esc(l.name)}</h3><button type="button" class="ghost sm" data-action="shop-list-edit" data-v="${l.id}">${icon('edit')} تعديل</button></div>
    ${addForm(l)}
    ${need.length || doneToday.length ? `<ul class="shop-list">${need.map((x) => itemRow(x)).join('')}${doneToday.map((x) => itemRow(x)).join('')}</ul>` : `<p class="note-text">${items.length ? 'شطبت كل ما فيها ✓' : 'القائمة فارغة. أضف ما تتذكره قبل أن تنساه.'}</p>`}
    ${done.length ? `<details class="shop-done"><summary>تم (${done.length}) | اضغط أي بند لتعيده إلى القائمة</summary><ul class="shop-list">${done.map((x) => itemRow(x)).join('')}</ul></details>` : ''}
    ${allDone.length > 1 ? `<button type="button" class="ghost" data-action="shop-reset" data-v="${l.id}">${icon('repeat')} أعد كل البنود إلى القائمة</button><small class="note-text explain">مفيد لقائمة تتكرر، مثل أغراض السفر.</small>` : ''}
  </section>`;
}

// list editor: name, icon, delete
function openListEditor(id) {
  const l = id ? getList(id) : normalizeList({ icon: '✈️' });
  ldraft = { kind: 'list', id: l.id, isNew: !id, icon: l.icon };
  $('libForm').innerHTML = `${sheetHead(id ? 'تعديل القائمة' : 'قائمة جديدة')}
    <label class="field"><span>اسم القائمة</span><input type="text" id="lsName" value="${id ? esc(l.name) : ''}" placeholder="مثل: أغراض السفر" autocomplete="off"></label>
    <div class="field"><span>الرمز</span><div class="chips">${LIST_ICONS.map((i) => `<button type="button" class="chip" data-action="shop-icon" data-v="${i}" aria-pressed="${i === l.icon}">${i}</button>`).join('')}</div></div>
    <div class="sheet-actions">
      <button type="submit" class="primary">حفظ</button>
      ${id ? `<button type="button" class="danger" data-action="lib-delete">حذف القائمة${listItems(id).length ? ` وبنودها (${listItems(id).length})` : ''}</button>` : ''}
    </div>`;
  libArmed = false;
  showLib();
  if (!id) setTimeout(() => $('lsName').focus(), 50);
}
function saveList() {
  const name = $('lsName').value.trim();
  if (!name) { toast('اكتب اسم القائمة.'); return false; }
  const old = getList(ldraft.id);
  if (old) Object.assign(old, { name, icon: ldraft.icon });
  else { S.lists.push(normalizeList({ id: ldraft.id, name, icon: ldraft.icon })); shopUi.cat = ldraft.id; }
  save();
  return true;
}
function deleteList(id) {
  S.lists = S.lists.filter((l) => l.id !== id);
  S.shop = S.shop.filter((x) => x.cat !== id);
  if (shopUi.cat === id) shopUi.cat = S.lists[0] ? S.lists[0].id : '';
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="shop-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'shop-cat') { shopUi.cat = v; shopUi.picked = true; render(); return; }
  if (action === 'shop-list-new') { openListEditor(null); return; }
  if (action === 'shop-list-edit') { openListEditor(v); return; }
  if (action === 'shop-icon') { ldraft.icon = v; for (const b of el.parentElement.children) b.setAttribute('aria-pressed', String(b === el)); return; }
  if (action === 'shop-reset') {
    for (const x of listItems(v)) if (!x.need) { x.need = true; x.updated = Date.now(); }
    save(); render(); toast('عادت كل البنود إلى القائمة');
    return;
  }
  const x = S.shop.find((i) => i.id === v);
  if (!x) return;
  if (action === 'shop-toggle') {
    // ticking keeps today's list open (the ticked item stays visible, crossed out, until the day ends);
    // unticking an item ticked today by mistake takes its count back
    shopUi.picked = true;
    if (x.need) { x.need = false; x.boughtAt = today(); x.times++; } else { if (x.boughtAt === today() && x.times > 0) x.times--; x.need = true; }
    x.updated = Date.now();
    save(); render();
  }
  if (action === 'shop-del') { S.shop = S.shop.filter((i) => i.id !== v); save(); render(); }
});
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-shop-form]')) return;
  e.preventDefault();
  const f = e.target.elements;
  const cat = (curList() || {}).id;
  shopUi.picked = true;
  const names = f.what.value.split(/[،,\n]+/);
  const n = addToShop(names, cat);
  render();
  const again = document.querySelector('[data-shop-form] input[name=what]');
  if (again) again.focus();
  if (!n && names.some((s) => s.trim())) toast('موجود في القائمة');
});

Object.assign(LibraryViews, { shop: viewShop });
