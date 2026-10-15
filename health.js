'use strict';
// «الصحة»: a weekly meal plan (one menu per weekday). Each meal is a list of items (رز، دجاج، سلطة…)
// with their own nutrition values and food groups, so «اليوم» can tick only what was actually eaten.
// Goals include «التكامل الغذائي»: covering every food group across the week, not weight.
// The plan can be built by hand, by AI, or imported from an Excel file.

const SLOTS = { breakfast: ['الفطور', '🍳'], lunch: ['الغداء', '🍲'], dinner: ['العشاء', '🥗'], snack: ['وجبة خفيفة', '🍎'] };
const NUTR = [['kcal', 'سعرة', 'السعرات'], ['protein', 'غ', 'البروتين'], ['carbs', 'غ', 'الكربوهيدرات'], ['fat', 'غ', 'الدهون'], ['fiber', 'غ', 'الألياف']];
const NUT_SHORT = { kcal: 'سعرة', protein: 'غ بروتين', carbs: 'غ كربوهيدرات', fat: 'غ دهون', fiber: 'غ ألياف' };
const H_GOALS = { balance: 'التكامل الغذائي', keep: 'المحافظة على الوزن', lose: 'إنقاص الوزن', gain: 'زيادة الوزن والعضل' };
// food groups and the servings a week that a balanced diet usually reaches
const GROUPS = { veg: ['خضروات', '🥦', 21], fruit: ['فواكه', '🍊', 14], grain: ['حبوب كاملة', '🌾', 14], protein: ['بروتين', '🍗', 14], fish: ['أسماك', '🐟', 2], legume: ['بقوليات', '🫘', 4], dairy: ['ألبان', '🥛', 14], fat: ['دهون صحية ومكسرات', '🥑', 7] };
const hUi = { day: -1 };

const nInt = (v) => Math.max(0, Math.round(Number(v) || 0));
function normalizeItem(x) {
  return { id: x.id || uid(), name: String(x.name || ''), qty: String(x.qty || ''), groups: (Array.isArray(x.groups) ? x.groups : []).filter((g) => GROUPS[g]), ...Object.fromEntries(NUTR.map(([k]) => [k, nInt(x[k])])) };
}
function normalizeMeal(m) {
  let items = (Array.isArray(m.items) ? m.items : []).map(normalizeItem);
  // older meals were one block: keep them as a single item
  if (!items.length && m.name && (m.kcal || m.desc)) items = [normalizeItem({ name: m.name, qty: m.desc, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: m.fiber })];
  return { id: m.id || uid(), dow: Math.min(6, Math.max(0, Number(m.dow) || 0)), slot: SLOTS[m.slot] ? m.slot : 'lunch', name: String(m.name || ''), items, created: m.created || Date.now() };
}
function normalizeMealDone(x) { return { id: x.id || today(), ids: Array.isArray(x.ids) ? x.ids.map(String) : [] }; }
const hProfile = () => ({ goal: 'balance', kcal: 0, protein: 0, likes: '', avoid: '', snack: true, ...(S.settings.health || {}) });
const SLOT_ORDER = Object.keys(SLOTS);
const mealsOf = (dow) => S.meals.filter((m) => m.dow === dow).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
const sumItems = (items) => Object.fromEntries(NUTR.map(([k]) => [k, items.reduce((s, x) => s + x[k], 0)]));
const dayTotals = (meals) => sumItems(meals.flatMap((m) => m.items));
const eatenOn = (d) => (S.mealDone.find((x) => x.id === d) || { ids: [] }).ids;
const nutChips = (t) => `<span class="nut">${NUTR.filter(([k]) => t[k]).map(([k]) => `<span>${k === 'kcal' ? '🔥 ' : ''}${t[k]} <small>${NUT_SHORT[k]}</small></span>`).join('')}</span>`;
const groupIcons = (g) => g.map((k) => `<span title="${GROUPS[k][0]}">${GROUPS[k][1]}</span>`).join('');

function totalsBar(t, prof, eaten) {
  const target = prof.kcal || 0;
  const macroCal = t.protein * 4 + t.carbs * 4 + t.fat * 9 || 1;
  return `<div class="h-totals">
    <div class="row-between"><b>🔥 ${eaten ? `أكلت ${eaten.kcal} من ` : ''}${t.kcal} سعرة${target ? ` <small>· هدفك ${target}</small>` : ''}</b>${target ? `<small class="${t.kcal > target * 1.1 ? 'late' : ''}">${Math.round((t.kcal / target) * 100)}٪</small>` : ''}</div>
    ${eaten ? `<div class="progress-line"><i style="width:${t.kcal ? Math.min(100, (eaten.kcal / t.kcal) * 100) : 0}%"></i></div>` : ''}
    <div class="fin-split h-macros" role="img" aria-label="توزيع العناصر"><i class="mp" style="width:${(t.protein * 4 / macroCal) * 100}%"></i><i class="mc" style="width:${(t.carbs * 4 / macroCal) * 100}%"></i><i class="mf" style="width:${(t.fat * 9 / macroCal) * 100}%"></i></div>
    <div class="fin-legend"><span><i class="mp"></i>بروتين ${t.protein} غ${prof.protein ? ` من ${prof.protein}` : ''}</span><span><i class="mc"></i>كربوهيدرات ${t.carbs} غ</span><span><i class="mf"></i>دهون ${t.fat} غ</span><span>ألياف ${t.fiber} غ</span></div>
  </div>`;
}

// a meal with its items; on today's day each item gets a tick for «I ate this»
function mealCard(m, tick) {
  const s = SLOTS[m.slot];
  const eaten = tick ? eatenOn(today()) : [];
  const t = sumItems(m.items);
  return `<article class="meal">
    <div class="meal-h"><span class="meal-slot">${s[1]} ${s[0]}${m.name ? ` · <b>${esc(m.name)}</b>` : ''}</span>
      <span class="btn-row">${AI.on() ? `<button type="button" class="ghost sm" data-action="h-swap" data-v="${m.id}">${icon('repeat')} بدّلها</button>` : ''}<button type="button" class="ghost sm" data-action="h-edit" data-v="${m.id}" aria-label="تعديل">${icon('edit')}</button></span></div>
    <ul class="meal-items">${m.items.map((x) => `<li${tick && eaten.includes(x.id) ? ' class="ate"' : ''}>
      ${tick ? `<button type="button" class="shop-box h-tick" data-action="h-eat" data-v="${x.id}" aria-pressed="${eaten.includes(x.id)}" aria-label="أكلت ${esc(x.name)}">${eaten.includes(x.id) ? '✓' : ''}</button>` : ''}
      <span class="mi-name">${esc(x.name)}${x.qty ? ` <small>${esc(x.qty)}</small>` : ''}</span>
      <span class="mi-g">${groupIcons(x.groups)}</span><span class="mi-k">${x.kcal || ''}</span>
    </li>`).join('')}</ul>
    ${nutChips(t)}
  </article>`;
}

// planned servings of each food group this week, against what a balanced week reaches
function coverageHTML() {
  const count = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, 0]));
  for (const m of S.meals) for (const x of m.items) for (const g of x.groups) count[g]++;
  const rows = Object.entries(GROUPS).map(([g, [l, ic, rec]]) => ({ g, l: `${ic} ${l}`, n: count[g], rec, pct: Math.min(100, Math.round((count[g] / rec) * 100)) }));
  const weak = rows.filter((r) => r.pct < 60);
  const score = Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length);
  return `<div class="panel"><h3>التكامل الغذائي في خطة الأسبوع <small>${score}٪</small></h3>
    <ul class="hbars">${rows.map((r) => hbar(r.l, `${r.n} من ${r.rec} حصة`, r.pct, r.pct < 60 ? 'var(--high)' : r.pct < 100 ? 'var(--mid)' : undefined)).join('')}</ul>
    <p class="note-text">${weak.length ? `ينقص خطتك: ${weak.map((r) => r.l).join('، ')}.${AI.on() ? ' «خطط أسبوعاً متنوعاً» يراعي ذلك.' : ''}` : 'خطتك تغطي المجموعات الغذائية كلها. أحسنت!'}</p></div>`;
}

function viewHealth() {
  const prof = hProfile();
  const dowToday = parse(today()).getDay();
  const d = hUi.day >= 0 ? hUi.day : dowToday;
  const list = mealsOf(d);
  const isToday = d === dowToday;
  const eatenIds = isToday ? eatenOn(today()) : [];
  const weekRows = WEEK_ORDER.map((w) => ({ w, t: dayTotals(mealsOf(w)), n: mealsOf(w).length }));
  const planned = weekRows.filter((r) => r.n);
  const avg = planned.length ? Math.round(planned.reduce((s, r) => s + r.t.kcal, 0) / planned.length) : 0;
  const distinct = new Set(S.meals.flatMap((m) => m.items.map((x) => x.name.trim()))).size;
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الصحة: الطعام</h2><div class="btn-row"><label class="xls-btn fin-import">${icon('sheet')}استيراد إكسل<input type="file" id="hImport" accept=".xlsx" hidden></label>${addBtn('h-new', 'وجبة')}</div></div>
    <details class="panel h-prof"${S.meals.length ? '' : ' open'}><summary><b>هدفي وتفضيلاتي</b><small>${H_GOALS[prof.goal]}${prof.kcal ? ` · ${prof.kcal} سعرة يومياً` : ''}</small></summary>
      <div class="seg seg-wrap" role="group">${Object.entries(H_GOALS).map(([k, l]) => `<button type="button" data-action="h-goal" data-v="${k}" aria-pressed="${prof.goal === k}">${l}</button>`).join('')}</div>
      ${prof.goal === 'balance' ? '<p class="note-text">التكامل الغذائي: أن يغطي طعامك المجموعات الغذائية كلها كل أسبوع (الخضروات، الفواكه، الحبوب الكاملة، البروتين، الأسماك، البقوليات، الألبان، الدهون الصحية) دون التركيز على الوزن.</p>' : ''}
      <div class="grid2">
        <label class="field"><span>السعرات اليومية (اختياري)</span><input type="text" inputmode="numeric" class="num-in" id="hpKcal" data-hp="kcal" value="${prof.kcal || ''}" placeholder="مثال: 2000" data-novoice></label>
        <label class="field"><span>البروتين اليومي غ (اختياري)</span><input type="text" inputmode="numeric" class="num-in" id="hpProtein" data-hp="protein" value="${prof.protein || ''}" placeholder="مثال: 120" data-novoice></label>
      </div>
      <label class="field"><span>ما أحبه</span><input type="text" id="hpLikes" data-hp="likes" value="${esc(prof.likes)}" placeholder="مثال: الأكل السعودي، الدجاج، الشوفان"></label>
      <label class="field"><span>ما أتجنبه أو لدي حساسية منه</span><input type="text" id="hpAvoid" data-hp="avoid" value="${esc(prof.avoid)}" placeholder="مثال: المأكولات البحرية، اللاكتوز"></label>
      <label class="switch"><input type="checkbox" id="hpSnack" data-hp="snack"${prof.snack ? ' checked' : ''}><span>أضف وجبة خفيفة كل يوم</span></label>
    </details>
    ${AI.on() ? `<div class="btn-row h-ai">
      <button type="button" class="primary" data-action="h-ai-week">${icon('spark')} خطط أسبوعاً متنوعاً</button>
      <button type="button" class="ghost" data-action="h-ai-day" data-v="${d}">${icon('spark')} خطط ${AR_DAYS[d]} فقط</button>
    </div>` : '<p class="note-text">فعّل الذكاء الاصطناعي من الإعدادات ليخطط لك أسبوعاً متكاملاً بقيمه الغذائية، أو أضف وجباتك بنفسك، أو استورد خطتك من ملف إكسل.</p>'}
    <div class="chips h-days" role="tablist" aria-label="أيام الأسبوع">${WEEK_ORDER.map((w) => `<button type="button" class="chip${w === dowToday ? ' is-today' : ''}" role="tab" data-action="h-day" data-v="${w}" aria-pressed="${w === d}">${AR_DAYS[w]}${mealsOf(w).length ? ` <small>${dayTotals(mealsOf(w)).kcal}</small>` : ''}</button>`).join('')}</div>
    ${list.length ? `${totalsBar(dayTotals(list), prof, isToday ? sumItems(list.flatMap((m) => m.items).filter((x) => eatenIds.includes(x.id))) : null)}
      ${isToday ? '<p class="note-text">اليوم: أشّر على ما أكلته فعلاً من كل وجبة.</p>' : ''}
      <div class="book-list">${list.map((m) => mealCard(m, isToday)).join('')}</div>`
      : emptyHTML(`لا وجبات لـ${AR_DAYS[d]}`, AI.on() ? 'اضغط «خطط أسبوعاً متنوعاً» أو أضف وجبة بنفسك.' : 'أضف وجبات هذا اليوم بأصنافها وقيمها الغذائية.', addBtn('h-new', 'وجبة'))}
    ${S.meals.length ? `${coverageHTML()}<div class="panel"><h3>الأسبوع كله</h3>
      <ul class="hbars">${weekRows.map((r) => hbar(AR_DAYS[r.w], r.n ? `${r.t.kcal} سعرة · ${r.t.protein} غ بروتين` : '—', prof.kcal ? Math.min(100, Math.round((r.t.kcal / prof.kcal) * 100)) : Math.min(100, Math.round((r.t.kcal / Math.max(1, ...weekRows.map((x) => x.t.kcal))) * 100)))).join('')}</ul>
      <p class="note-text">متوسط اليوم ${avg} سعرة · ${distinct} صنفاً مختلفاً في الأسبوع.</p>
      <div class="btn-row"><button type="button" class="ghost" data-action="h-shop">${icon('plus')} أضف أصناف الأسبوع إلى قائمة الشراء</button><button type="button" class="ghost" data-action="h-clear">امسح الأسبوع</button></div>
    </div>` : ''}
  </section>`;
}

// «اليوم»: today's meals; tick each item eaten
function healthTodayHTML() {
  const t0 = today();
  const list = mealsOf(parse(t0).getDay());
  if (!list.length) return '';
  const eaten = eatenOn(t0);
  const all = list.flatMap((m) => m.items);
  const t = sumItems(all.filter((x) => eaten.includes(x.id)));
  return todayBlock('الصحة', 'health', `${list.map((m) => `<div class="h-today-meal"><b>${SLOTS[m.slot][1]} ${SLOTS[m.slot][0]}${m.name ? `: ${esc(m.name)}` : ''}</b>
      <div class="h-chips">${m.items.map((x) => `<button type="button" class="h-chip" data-action="h-eat" data-v="${x.id}" aria-pressed="${eaten.includes(x.id)}">${eaten.includes(x.id) ? '✓ ' : ''}${esc(x.name)}</button>`).join('')}</div></div>`).join('')}
    <small class="note-text">أكلت ${t.kcal} من ${sumItems(all).kcal} سعرة مخططة · ${t.protein} غ بروتين</small>`);
}

// ---------- meal editor: the meal's items, each with its values ----------
function openMeal(id, dow) {
  const m = id ? S.meals.find((x) => x.id === id) : normalizeMeal({ dow, slot: 'lunch', items: [normalizeItem({})] });
  ldraft = { kind: 'meal', id: m.id, isNew: !id, slot: m.slot, items: m.items.map((x) => ({ ...x, groups: [...x.groups] })) };
  renderMealForm(m);
  libArmed = false;
  showLib();
}
function itemRowHTML(x, i) {
  const at = (k) => `id="mi-${i}-${k}" data-mi="${i}" data-k="${k}"`;
  return `<div class="mi-ed">
    <div class="row-between"><input type="text" ${at('name')} value="${esc(x.name)}" placeholder="الصنف (مثل: أرز بني)" aria-label="الصنف"><input type="text" ${at('qty')} value="${esc(x.qty)}" placeholder="المقدار" aria-label="المقدار" class="mi-qty"><button type="button" class="fin-del" data-action="h-item-del" data-v="${i}" aria-label="حذف">✕</button></div>
    <div class="h-nut-in">${NUTR.map(([k, u, l]) => `<input type="text" inputmode="numeric" class="num-in" ${at(k)} value="${x[k] || ''}" placeholder="${l === 'السعرات' ? 'سعرات' : l.replace('ال', '')}" aria-label="${l}" data-novoice>`).join('')}</div>
    <div class="chips wrap mi-groups">${Object.entries(GROUPS).map(([g, [l, ic]]) => `<button type="button" class="chip" data-action="h-item-g" data-i="${i}" data-v="${g}" aria-pressed="${x.groups.includes(g)}">${ic} ${l}</button>`).join('')}</div>
  </div>`;
}
function renderMealForm(m) {
  $('libForm').innerHTML = `${sheetHead(ldraft.isNew ? `وجبة لـ${AR_DAYS[m.dow]}` : 'تعديل الوجبة')}
    <div class="seg seg-wrap" id="mlSlot" role="group">${Object.entries(SLOTS).map(([k, v]) => `<button type="button" data-action="h-slot" data-v="${k}" aria-pressed="${ldraft.slot === k}">${v[1]} ${v[0]}</button>`).join('')}</div>
    <div class="grid2">
      <label class="field"><span>اسم الوجبة (اختياري)</span><input type="text" id="mlName" value="${esc(m.name)}" autocomplete="off" placeholder="مثال: كبسة دجاج"></label>
      <label class="field"><span>اليوم</span><select id="mlDow">${WEEK_ORDER.map((w) => `<option value="${w}"${m.dow === w ? ' selected' : ''}>${AR_DAYS[w]}</option>`).join('')}</select></label>
    </div>
    <div class="field"><span>أصناف الوجبة</span><div id="mlItems">${ldraft.items.map(itemRowHTML).join('')}</div>
      <button type="button" class="fin-add" data-action="h-item-add">${icon('plus')} صنف</button></div>
    ${AI.on() ? `<button type="button" class="ghost ai-btn" data-action="h-ai-nutr">${icon('spark')} احسب القيم الغذائية والمجموعات للأصناف</button>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${ldraft.isNew ? '' : '<button type="button" class="danger" data-action="lib-delete">حذف</button>'}</div>`;
}
function readMealItems() {
  for (const el of $('libForm').querySelectorAll('[data-mi]')) {
    const x = ldraft.items[+el.dataset.mi];
    const k = el.dataset.k;
    x[k] = NUTR.some(([n]) => n === k) ? nInt(num(el.value)) : el.value.trim();
  }
}
function saveMeal() {
  readMealItems();
  const items = ldraft.items.filter((x) => x.name.trim()).map(normalizeItem);
  if (!items.length) { toast('أضف صنفاً واحداً على الأقل.'); return false; }
  const old = S.meals.find((x) => x.id === ldraft.id);
  const m = normalizeMeal({ ...(old || {}), id: ldraft.id, slot: ldraft.slot, name: $('mlName').value.trim(), dow: +$('mlDow').value, items });
  if (old) Object.assign(old, m); else S.meals.push(m);
  hUi.day = m.dow;
  save();
  return true;
}

// ---------- AI ----------
const FOOD_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['name', 'qty', 'groups', 'kcal', 'protein', 'carbs', 'fat', 'fiber'],
  properties: {
    name: { type: 'string', description: 'Arabic food item, e.g. «أرز بني»' }, qty: { type: 'string', description: 'Arabic portion, e.g. «كوب» or «١٥٠ غ»' },
    groups: { type: 'array', items: { type: 'string', enum: Object.keys(GROUPS) }, description: 'food groups this item counts for (one serving each)' },
    kcal: { type: 'integer' }, protein: { type: 'integer', description: 'grams' }, carbs: { type: 'integer', description: 'grams' }, fat: { type: 'integer', description: 'grams' }, fiber: { type: 'integer', description: 'grams' },
  },
};
const MEAL_SCHEMA = { type: 'object', additionalProperties: false, required: ['slot', 'name', 'items'], properties: { slot: { type: 'string', enum: SLOT_ORDER }, name: { type: 'string', description: 'short Arabic dish name' }, items: { type: 'array', items: FOOD_SCHEMA } } };
const WEEK_SCHEMA = { type: 'object', additionalProperties: false, required: ['days', 'tips'], properties: { days: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['dow', 'meals'], properties: { dow: { type: 'integer', description: '0=Sunday … 6=Saturday' }, meals: { type: 'array', items: MEAL_SCHEMA } } } }, tips: { type: 'array', items: { type: 'string' } } } };
function healthBrief(extra = '') {
  const p = hProfile();
  const goal = p.goal === 'balance'
    ? 'Goal: complete, balanced nutrition (التكامل الغذائي), not weight change. Over the week cover every food group: about 3 vegetable and 2 fruit servings a day, whole grains, varied protein, fish twice a week (if allowed), legumes 3–4 times, dairy daily, healthy fats and nuts. Rotate colours and micronutrient sources.'
    : `Goal: ${H_GOALS[p.goal]}.`;
  return [goal, p.kcal ? `Daily calories target: ${p.kcal}.` : 'Choose a sensible daily calorie level for an adult.', p.protein ? `Daily protein target: ${p.protein} g.` : '',
    p.likes ? `Likes: ${p.likes}.` : '', p.avoid ? `Must avoid (allergies/dislikes): ${p.avoid}.` : '', `Meals per day: breakfast, lunch, dinner${p.snack ? ', and one snack' : ''}.`,
    'Split each meal into its separate food items (each with a portion, nutrition values and food groups) so the user can tick the items they actually ate.', extra].filter(Boolean).join('\n');
}
const H_SYSTEM = 'You are a careful nutrition planner for an Arabic-speaking user in Saudi Arabia. Plan realistic home meals (Saudi, Gulf, Levantine and simple international dishes), varied across the week; do not repeat a main dish more than twice a week. Estimate nutrition values honestly per item portion. All text in Arabic. Never include anything the user must avoid.';
const toMeals = (days) => (days || []).flatMap((d) => (d.meals || []).map((m) => normalizeMeal({ ...m, dow: d.dow }))).filter((m) => m.items.length);

async function aiWeek(btn, dowOnly) {
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'يخطط…';
  try {
    if (dowOnly != null) {
      const others = S.meals.filter((m) => m.dow !== dowOnly).flatMap((m) => m.items.map((x) => x.name)).join('، ');
      const out = await AI.ask({ system: H_SYSTEM, effort: 'medium', maxTokens: 8000, prompt: `${healthBrief(others ? `Other days already have: ${others}. Keep this day different and fill food groups the week lacks.` : '')}\n\nPlan the meals for ${AR_DAYS[dowOnly]}.`,
        schema: { type: 'object', additionalProperties: false, required: ['meals'], properties: { meals: { type: 'array', items: MEAL_SCHEMA } } } });
      S.meals = S.meals.filter((m) => m.dow !== dowOnly).concat(toMeals([{ dow: dowOnly, meals: out.meals }]));
      hUi.day = dowOnly;
      save(); render(); toast(`خُطّط ${AR_DAYS[dowOnly]}`);
    } else {
      const out = await AI.ask({ system: H_SYSTEM, effort: 'medium', maxTokens: 16000, prompt: `${healthBrief()}\n\nPlan a full week, Saturday to Friday. Add 2-4 short Arabic tips about this week's balance.`, schema: WEEK_SCHEMA });
      const meals = toMeals(out.days);
      if (!meals.length) throw new Error('empty');
      S.meals = meals;
      save(); render();
      toast(out.tips && out.tips.length ? `💡 ${out.tips[0]}` : 'خُطّط الأسبوع');
    }
  } catch (e) { toast(e.message === 'empty' ? 'لم يرجع الذكاء الاصطناعي خطة. حاول مرة أخرى.' : AI.friendly(e)); }
  if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
}
async function aiSwap(id, btn) {
  const m = S.meals.find((x) => x.id === id);
  btn.disabled = true;
  try {
    const week = S.meals.map((x) => x.name || x.items.map((i) => i.name).join(' و')).join('، ');
    const out = await AI.ask({ system: H_SYSTEM, effort: 'low', maxTokens: 4000, prompt: `${healthBrief()}\n\nReplace this ${SLOTS[m.slot][0]} on ${AR_DAYS[m.dow]}: «${m.name || m.items.map((i) => i.name).join(' و')}» (${sumItems(m.items).kcal} kcal) with a different dish of similar calories, not already in this week: ${week}.`, schema: MEAL_SCHEMA });
    Object.assign(m, normalizeMeal({ ...out, id: m.id, dow: m.dow, slot: m.slot, created: m.created }));
    save(); render(); toast(`بدّلتها بـ«${m.name}»`);
  } catch (e) { toast(AI.friendly(e)); }
  if (btn.isConnected) btn.disabled = false;
}
async function aiNutrition(btn) {
  readMealItems();
  const items = ldraft.items.filter((x) => x.name.trim());
  if (!items.length) { toast('اكتب الأصناف أولاً.'); return; }
  btn.disabled = true;
  try {
    const out = await AI.ask({ system: 'Estimate nutrition values and food groups for each food item (Arabic input) for the given portion; if a portion is missing assume a typical adult serving and write it in Arabic. Keep the item names exactly as given.', effort: 'low', maxTokens: 3000,
      prompt: items.map((x) => `${x.name}${x.qty ? ` — ${x.qty}` : ''}`).join('\n'),
      schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: FOOD_SCHEMA } } } });
    out.items.forEach((r, i) => { if (items[i]) Object.assign(items[i], { ...normalizeItem(r), id: items[i].id, name: items[i].name, qty: items[i].qty || r.qty }); });
    renderMealForm(normalizeMeal({ id: ldraft.id, dow: +$('mlDow').value, name: $('mlName').value, slot: ldraft.slot }));
    toast('قيم تقديرية، عدّلها إن شئت');
  } catch (e) { toast(AI.friendly(e)); }
  if (btn.isConnected) btn.disabled = false;
}

// ---------- import a meal plan from Excel ----------
const DAY_NAMES = [['الأحد', 0], ['الاثنين', 1], ['الإثنين', 1], ['الثلاثاء', 2], ['الأربعاء', 3], ['الاربعاء', 3], ['الخميس', 4], ['الجمعة', 5], ['السبت', 6]];
const dayOf = (s) => { const t = String(s).trim(); const hit = DAY_NAMES.find(([n]) => t === n || t.startsWith(n) || t === n.replace('ال', '')); if (hit) return hit[1]; const m = /^(?:اليوم|يوم|day)\s*([0-9٠-٩])/i.exec(t.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return m ? WEEK_ORDER[(Number(m[1]) - 1) % 7] : null; };
const slotOf = (s) => { const t = String(s).trim(); return /فطور|إفطار|افطار|breakfast/i.test(t) ? 'breakfast' : /غداء|غدا|lunch/i.test(t) ? 'lunch' : /عشاء|عشا|dinner/i.test(t) ? 'dinner' : /خفيف|سناك|تصبير|snack/i.test(t) ? 'snack' : null; };
const splitItems = (txt) => String(txt).split(/\s*(?:\n|\+|،|,|؛|\s-\s|\s و\s)\s*/).map((x) => x.trim()).filter(Boolean);
// layouts: days down and meals across (or the reverse), or one row per item with day/meal columns
function parseMealSheet(sh) {
  const cells = [...sh.cells.entries()].map(([k, v]) => { const [r, c] = k.split(',').map(Number); return { r, c, v }; });
  const out = [];
  const nutCols = {};
  // long format: a header row with «اليوم» and a meal/item column
  const head = cells.find((x) => typeof x.v === 'string' && /^اليوم$/.test(x.v.trim()));
  if (head) {
    const row = cells.filter((x) => x.r === head.r && typeof x.v === 'string');
    const colOf = (re) => (row.find((x) => re.test(x.v)) || {}).c;
    const cSlot = colOf(/الوجبة|الوقت/), cItem = colOf(/الصنف|الطعام|الأكلة|المكون|البند/), cQty = colOf(/المقدار|الكمية/);
    for (const [k, re] of [['kcal', /سعر/], ['protein', /بروتين/], ['carbs', /كربو|نشويات/], ['fat', /دهون/], ['fiber', /ألياف|الياف/]]) nutCols[k] = colOf(re);
    if (cItem) {
      let lastDay = null, lastSlot = 'lunch';
      for (let r = head.r + 1; r <= head.r + 500; r++) {
        const dv = sh.get(r, head.c); if (dv != null && dayOf(dv) != null) lastDay = dayOf(dv);
        const sv = cSlot ? sh.get(r, cSlot) : null; if (sv != null && slotOf(sv)) lastSlot = slotOf(sv);
        const it = sh.get(r, cItem);
        if (lastDay == null || it == null || String(it).trim() === '') continue;
        out.push({ dow: lastDay, slot: lastSlot, item: { name: String(it).trim(), qty: cQty ? String(sh.get(r, cQty) ?? '') : '', ...Object.fromEntries(Object.entries(nutCols).filter(([, c]) => c).map(([k2, c]) => [k2, Number(sh.get(r, c)) || 0])) } });
      }
      if (out.length) return out;
    }
  }
  // grid: day names in one column/row, meal names in the other
  const dayCells = cells.filter((x) => typeof x.v === 'string' && dayOf(x.v) != null);
  const slotCells = cells.filter((x) => typeof x.v === 'string' && slotOf(x.v) && x.v.length < 20);
  if (dayCells.length >= 2 && slotCells.length >= 2) {
    const daysDown = new Set(dayCells.map((x) => x.c)).size < new Set(dayCells.map((x) => x.r)).size;
    for (const dcell of dayCells) for (const scell of slotCells) {
      const r = daysDown ? dcell.r : scell.r, c = daysDown ? scell.c : dcell.c;
      // meal labels head the columns above the days, or run down a column below the day headers
      if (daysDown ? scell.r >= dcell.r : scell.r <= dcell.r) continue;
      const v = sh.get(r, c);
      if (v == null || typeof v !== 'string') continue;
      for (const name of splitItems(v)) out.push({ dow: dayOf(dcell.v), slot: slotOf(scell.v), item: { name } });
    }
  }
  return out;
}
function rowsToMeals(rows) {
  const by = new Map();
  for (const x of rows) {
    const k = `${x.dow}|${x.slot}`;
    if (!by.has(k)) by.set(k, normalizeMeal({ dow: x.dow, slot: x.slot, items: [] }));
    by.get(k).items.push(normalizeItem(x.item));
  }
  return [...by.values()];
}
const sheetText = (sheets) => sheets.map((sh) => {
  const rows = new Map();
  for (const [k, v] of sh.cells) { const [r, c] = k.split(',').map(Number); if (!rows.has(r)) rows.set(r, []); rows.get(r).push([c, v]); }
  return `## ${sh.name}\n${[...rows.entries()].sort((a, b) => a[0] - b[0]).map(([r, cs]) => `${r}: ${cs.sort((a, b) => a[0] - b[0]).map(([c, v]) => `[${c}] ${v}`).join(' | ')}`).join('\n')}`;
}).join('\n\n').slice(0, 30000);

async function importMealPlan(file) {
  let sheets;
  try { sheets = await XlsxRead.read(file); } catch { toast('تعذّر قراءة الملف. تأكد أنه ملف إكسل (.xlsx).'); return; }
  let meals = rowsToMeals(sheets.flatMap(parseMealSheet));
  let via = 'file';
  if (AI.on()) {
    toast('يقرأ الذكاء الاصطناعي ملفك…');
    try {
      const out = await AI.ask({ system: H_SYSTEM, effort: 'medium', maxTokens: 16000,
        prompt: `The user exported their meal plan from Excel. Below is every non-empty cell as «row: [column] value». Rebuild the plan exactly: keep every dish and item name and portion as written (do not invent or drop items, do not rename). Map day names to dow (0=Sunday … 6=Saturday); if days are numbered (اليوم 1…7) map day 1 to Saturday. Split a cell listing several foods into separate items. Use nutrition values from the sheet when present; otherwise estimate them and the food groups.\n\n${sheetText(sheets)}`,
        schema: WEEK_SCHEMA });
      const m2 = toMeals(out.days);
      if (m2.length) { meals = m2; via = 'ai'; }
    } catch (e) { if (!meals.length) { toast(AI.friendly(e)); return; } }
  }
  if (!meals.length) { toast('لم أجد في الملف أياماً ووجبات. اجعل أسماء الأيام (السبت…) والوجبات (فطور، غداء، عشاء) في الملف، أو فعّل الذكاء الاصطناعي ليقرأه.'); return; }
  ldraft = { kind: 'mealimp', id: 'x', isNew: true, meals };
  $('libForm').innerHTML = `${sheetHead('استيراد خطة الطعام')}
    <p class="note-text">${via === 'ai' ? 'قرأها الذكاء الاصطناعي من ملفك.' : 'قُرئت من ملفك مباشرة.'} وجدت ${plural(meals.length, 'وجبة واحدة', 'وجبتين', 'وجبات', 'وجبة')} في ${plural(new Set(meals.map((m) => m.dow)).size, 'يوم واحد', 'يومين', 'أيام', 'يوماً')}:</p>
    <ul class="fin-imp">${WEEK_ORDER.filter((w) => meals.some((m) => m.dow === w)).map((w) => `<li><b>${AR_DAYS[w]}</b><small>${meals.filter((m) => m.dow === w).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)).map((m) => `${SLOTS[m.slot][0]}: ${m.items.map((x) => x.name).join('، ')}`).map(esc).join(' · ')}</small></li>`).join('')}</ul>
    ${!via || via === 'file' ? '<p class="note-text">القيم الغذائية غير موجودة في الملف؟ افتح أي وجبة واضغط «احسب القيم الغذائية»، أو فعّل الذكاء الاصطناعي ثم استورد الملف من جديد.</p>' : ''}
    <div class="seg" id="miMode" role="group"><button type="button" data-action="h-imp-mode" data-v="replace" aria-pressed="true">استبدل خطتي بها</button><button type="button" data-action="h-imp-mode" data-v="add" aria-pressed="false">أضفها إلى خطتي</button></div>
    <div class="sheet-actions"><button type="submit" class="primary">اعتمد الخطة</button></div>`;
  ldraft.mode = 'replace';
  showLib();
}
function saveMealImport() {
  if (ldraft.mode === 'replace') S.meals = ldraft.meals; else S.meals.push(...ldraft.meals);
  save();
  toast('اعتُمدت خطة الطعام');
  return true;
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="h-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'h-day': hUi.day = Number(v); render(); break;
    case 'h-new': openMeal(null, hUi.day >= 0 ? hUi.day : parse(today()).getDay()); break;
    case 'h-edit': openMeal(v); break;
    case 'h-slot': ldraft.slot = v; for (const b of $('mlSlot').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'h-item-add': readMealItems(); ldraft.items.push(normalizeItem({})); $('mlItems').innerHTML = ldraft.items.map(itemRowHTML).join(''); $(`mi-${ldraft.items.length - 1}-name`).focus(); break;
    case 'h-item-del': readMealItems(); ldraft.items.splice(+v, 1); $('mlItems').innerHTML = ldraft.items.map(itemRowHTML).join(''); break;
    case 'h-item-g': { const x = ldraft.items[+el.dataset.i]; x.groups = x.groups.includes(v) ? x.groups.filter((g) => g !== v) : [...x.groups, v]; el.setAttribute('aria-pressed', String(x.groups.includes(v))); break; }
    case 'h-goal': S.settings.health = { ...hProfile(), goal: v }; save(); render(); break;
    case 'h-ai-week': aiWeek(el, null); break;
    case 'h-ai-day': aiWeek(el, Number(v)); break;
    case 'h-swap': aiSwap(v, el); break;
    case 'h-ai-nutr': aiNutrition(el); break;
    case 'h-imp-mode': ldraft.mode = v; for (const b of $('miMode').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'h-eat': {
      const d = today();
      let rec = S.mealDone.find((x) => x.id === d);
      if (!rec) { rec = normalizeMealDone({ id: d }); S.mealDone.push(rec); }
      rec.ids = rec.ids.includes(v) ? rec.ids.filter((x) => x !== v) : [...rec.ids, v];
      S.mealDone = S.mealDone.filter((x) => x.id >= addDays(d, -400)); // a year, for the monthly report
      save(); render();
      break;
    }
    case 'h-shop': {
      const items = [...new Set(S.meals.flatMap((m) => m.items.map((x) => x.name)).map((x) => x.trim()).filter(Boolean))];
      if (!items.length) { toast('لا أصناف في الخطة.'); break; }
      const n = addToShop(items, 'home');
      toast(n ? `أُضيف ${n} إلى قائمة الشراء` : 'كلها موجودة في قائمة الشراء');
      break;
    }
    case 'h-clear':
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'تأكيد مسح الأسبوع'; break; }
      S.meals = []; save(); render(); toast('مُسحت خطة الأسبوع');
      break;
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'hImport') { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importMealPlan(f); return; }
  const k = e.target.dataset && e.target.dataset.hp;
  if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : ['kcal', 'protein'].includes(k) ? num(e.target.value) : e.target.value.trim();
  S.settings.health = { ...hProfile(), [k]: v };
  save();
  render();
});

Object.assign(LibraryViews, { health: viewHealth });
