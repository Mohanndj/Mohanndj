'use strict';
// «الصحة»: a weekly meal plan (one menu per weekday) with nutrition values, built by hand or by AI
// to be varied and balanced for the user's goal and tastes; «اليوم» shows today's meals to tick.

const SLOTS = { breakfast: ['الفطور', '🍳'], lunch: ['الغداء', '🍲'], dinner: ['العشاء', '🥗'], snack: ['وجبة خفيفة', '🍎'] };
const NUTR = [['kcal', 'سعرة', 'السعرات'], ['protein', 'غ', 'البروتين'], ['carbs', 'غ', 'الكربوهيدرات'], ['fat', 'غ', 'الدهون'], ['fiber', 'غ', 'الألياف']];
const H_GOALS = { keep: 'المحافظة على الوزن', lose: 'إنقاص الوزن', gain: 'زيادة الوزن والعضل' };
const hUi = { day: -1 };

function normalizeMeal(m) {
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  return {
    id: m.id || uid(), dow: Math.min(6, Math.max(0, Number(m.dow) || 0)), slot: SLOTS[m.slot] ? m.slot : 'lunch',
    name: String(m.name || ''), desc: String(m.desc || ''), ingredients: (Array.isArray(m.ingredients) ? m.ingredients : []).map(String).filter(Boolean),
    kcal: n(m.kcal), protein: n(m.protein), carbs: n(m.carbs), fat: n(m.fat), fiber: n(m.fiber), created: m.created || Date.now(),
  };
}
// per date: which meals were eaten
function normalizeMealDone(x) { return { id: x.id || today(), ids: Array.isArray(x.ids) ? x.ids.map(String) : [] }; }
const hProfile = () => ({ goal: 'keep', kcal: 0, protein: 0, likes: '', avoid: '', snack: true, ...(S.settings.health || {}) });
const mealsOf = (dow) => S.meals.filter((m) => m.dow === dow).sort((a, b) => Object.keys(SLOTS).indexOf(a.slot) - Object.keys(SLOTS).indexOf(b.slot));
const dayTotals = (list) => Object.fromEntries(NUTR.map(([k]) => [k, list.reduce((s, m) => s + m[k], 0)]));
const eatenOn = (d) => (S.mealDone.find((x) => x.id === d) || { ids: [] }).ids;
const NUT_SHORT = { kcal: 'سعرة', protein: 'غ بروتين', carbs: 'غ كربوهيدرات', fat: 'غ دهون', fiber: 'غ ألياف' };
const nutChips = (m) => `<span class="nut">${NUTR.filter(([k]) => m[k]).map(([k]) => `<span>${k === 'kcal' ? '🔥 ' : ''}${m[k]} <small>${NUT_SHORT[k]}</small></span>`).join('')}</span>`;

function totalsBar(t, prof) {
  const target = prof.kcal || 0;
  const macroCal = t.protein * 4 + t.carbs * 4 + t.fat * 9 || 1;
  return `<div class="h-totals">
    <div class="row-between"><b>🔥 ${t.kcal} سعرة${target ? ` <small>من ${target}</small>` : ''}</b>${target ? `<small class="${t.kcal > target * 1.1 ? 'late' : ''}">${Math.round((t.kcal / target) * 100)}٪</small>` : ''}</div>
    ${target ? `<div class="progress-line"><i style="width:${Math.min(100, (t.kcal / target) * 100)}%"></i></div>` : ''}
    <div class="fin-split h-macros" role="img" aria-label="توزيع العناصر"><i class="mp" style="width:${(t.protein * 4 / macroCal) * 100}%"></i><i class="mc" style="width:${(t.carbs * 4 / macroCal) * 100}%"></i><i class="mf" style="width:${(t.fat * 9 / macroCal) * 100}%"></i></div>
    <div class="fin-legend"><span><i class="mp"></i>بروتين ${t.protein} غ${prof.protein ? ` من ${prof.protein}` : ''}</span><span><i class="mc"></i>كربوهيدرات ${t.carbs} غ</span><span><i class="mf"></i>دهون ${t.fat} غ</span><span>ألياف ${t.fiber} غ</span></div>
  </div>`;
}

function mealCard(m, opts = {}) {
  const s = SLOTS[m.slot];
  return `<article class="meal">
    <div class="meal-h"><span class="meal-slot">${s[1]} ${s[0]}</span>
      <span class="btn-row">${AI.on() && !opts.today ? `<button type="button" class="ghost sm" data-action="h-swap" data-v="${m.id}">${icon('repeat')} بدّلها</button>` : ''}${opts.today ? '' : `<button type="button" class="ghost sm" data-action="h-edit" data-v="${m.id}">${icon('edit')}</button>`}</span></div>
    <b>${esc(m.name)}</b>
    ${m.desc ? `<p>${esc(m.desc)}</p>` : ''}
    ${nutChips(m)}
  </article>`;
}

function viewHealth() {
  const prof = hProfile();
  const dowToday = parse(today()).getDay();
  const d = hUi.day >= 0 ? hUi.day : dowToday;
  const list = mealsOf(d);
  const weekRows = WEEK_ORDER.map((w) => ({ w, t: dayTotals(mealsOf(w)), n: mealsOf(w).length }));
  const planned = weekRows.filter((r) => r.n);
  const avg = planned.length ? Math.round(planned.reduce((s, r) => s + r.t.kcal, 0) / planned.length) : 0;
  const distinct = new Set(S.meals.map((m) => m.name.trim())).size;
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الصحة: الطعام</h2>${addBtn('h-new', 'وجبة')}</div>
    <details class="panel h-prof"${S.meals.length ? '' : ' open'}><summary><b>هدفي وتفضيلاتي</b><small>${H_GOALS[prof.goal]}${prof.kcal ? ` · ${prof.kcal} سعرة يومياً` : ''}</small></summary>
      <div class="seg seg-wrap" role="group">${Object.entries(H_GOALS).map(([k, l]) => `<button type="button" data-action="h-goal" data-v="${k}" aria-pressed="${prof.goal === k}">${l}</button>`).join('')}</div>
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
    </div>` : '<p class="note-text">فعّل الذكاء الاصطناعي من الإعدادات ليخطط لك أسبوعاً متنوعاً بقيمه الغذائية، أو أضف وجباتك بنفسك.</p>'}
    <div class="chips h-days" role="tablist" aria-label="أيام الأسبوع">${WEEK_ORDER.map((w) => `<button type="button" class="chip${w === dowToday ? ' is-today' : ''}" role="tab" data-action="h-day" data-v="${w}" aria-pressed="${w === d}">${AR_DAYS[w]}${mealsOf(w).length ? ` <small>${dayTotals(mealsOf(w)).kcal}</small>` : ''}</button>`).join('')}</div>
    ${list.length ? `${totalsBar(dayTotals(list), prof)}<div class="book-list">${list.map((m) => mealCard(m)).join('')}</div>`
      : emptyHTML(`لا وجبات لـ${AR_DAYS[d]}`, AI.on() ? 'اضغط «خطط أسبوعاً متنوعاً» أو أضف وجبة بنفسك.' : 'أضف وجبات هذا اليوم بقيمها الغذائية.', addBtn('h-new', 'وجبة'))}
    ${S.meals.length ? `<div class="panel"><h3>الأسبوع كله</h3>
      <ul class="hbars">${weekRows.map((r) => hbar(AR_DAYS[r.w], r.n ? `${r.t.kcal} سعرة · ${r.t.protein} غ بروتين` : '—', prof.kcal ? Math.min(100, Math.round((r.t.kcal / prof.kcal) * 100)) : Math.min(100, Math.round((r.t.kcal / Math.max(1, ...weekRows.map((x) => x.t.kcal))) * 100)))).join('')}</ul>
      <p class="note-text">متوسط اليوم ${avg} سعرة · ${distinct} وجبة مختلفة في الأسبوع${distinct < 10 && S.meals.length >= 10 ? ' · جرّب تنويعاً أكثر' : ''}.</p>
      <div class="btn-row"><button type="button" class="ghost" data-action="h-shop">${icon('plus')} أضف مكونات الأسبوع إلى قائمة الشراء</button><button type="button" class="ghost" data-action="h-clear">امسح الأسبوع</button></div>
    </div>` : ''}
  </section>`;
}

// «اليوم»: today's meals with a tick
function healthTodayHTML() {
  const t0 = today();
  const list = mealsOf(parse(t0).getDay());
  if (!list.length) return '';
  const eaten = eatenOn(t0);
  const t = dayTotals(list.filter((m) => eaten.includes(m.id)));
  return todayBlock('الصحة', 'health', `<ul class="tlist">${list.map((m) => `<li><button type="button" data-action="h-eat" data-v="${m.id}" class="${eaten.includes(m.id) ? 'done' : ''}"><span class="rm-e">${eaten.includes(m.id) ? '✅' : SLOTS[m.slot][1]}</span><span><b>${SLOTS[m.slot][0]}: ${esc(m.name)}</b><small>${m.kcal} سعرة · ${m.protein} غ بروتين</small></span></button></li>`).join('')}</ul>
    <small class="note-text">أكلت اليوم ${t.kcal} من ${dayTotals(list).kcal} سعرة مخططة</small>`);
}

// ---------- meal editor ----------
function openMeal(id, dow) {
  const m = id ? S.meals.find((x) => x.id === id) : normalizeMeal({ dow, slot: 'lunch' });
  ldraft = { kind: 'meal', id: m.id, isNew: !id, slot: m.slot };
  $('libForm').innerHTML = `${sheetHead(id ? 'تعديل الوجبة' : `وجبة لـ${AR_DAYS[m.dow]}`)}
    <div class="seg seg-wrap" id="mlSlot" role="group">${Object.entries(SLOTS).map(([k, v]) => `<button type="button" data-action="h-slot" data-v="${k}" aria-pressed="${m.slot === k}">${v[1]} ${v[0]}</button>`).join('')}</div>
    <label class="field"><span>الوجبة</span><input type="text" id="mlName" value="${esc(m.name)}" autocomplete="off" placeholder="مثال: كبسة دجاج بالأرز البني"></label>
    <label class="field"><span>المكونات والمقادير</span><textarea id="mlDesc" rows="3" placeholder="مثال: صدر دجاج ١٥٠غ، أرز بني كوب، سلطة">${esc(m.desc)}</textarea></label>
    ${AI.on() ? `<button type="button" class="ghost ai-btn" data-action="h-ai-nutr">${icon('spark')} احسب القيم الغذائية</button>` : ''}
    <div class="h-nut-in">${NUTR.map(([k, u, l]) => `<label class="field"><span>${l}${k === 'kcal' ? '' : ` (${u})`}</span><input type="text" inputmode="numeric" class="num-in" id="ml-${k}" value="${m[k] || ''}" data-novoice></label>`).join('')}</div>
    <label class="field"><span>اليوم</span><select id="mlDow">${WEEK_ORDER.map((w) => `<option value="${w}"${m.dow === w ? ' selected' : ''}>${AR_DAYS[w]}</option>`).join('')}</select></label>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}</div>`;
  libArmed = false;
  showLib();
}
function saveMeal() {
  const name = $('mlName').value.trim();
  if (!name) { toast('اكتب اسم الوجبة.'); return false; }
  const old = S.meals.find((x) => x.id === ldraft.id);
  const m = normalizeMeal({ ...(old || {}), id: ldraft.id, slot: ldraft.slot, name, desc: $('mlDesc').value.trim(), dow: +$('mlDow').value, ...Object.fromEntries(NUTR.map(([k]) => [k, num($('ml-' + k).value)])) });
  if (old) Object.assign(old, m); else S.meals.push(m);
  hUi.day = m.dow;
  save();
  return true;
}

// ---------- AI ----------
const MEAL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['slot', 'name', 'desc', 'ingredients', 'kcal', 'protein', 'carbs', 'fat', 'fiber'],
  properties: {
    slot: { type: 'string', enum: Object.keys(SLOTS) }, name: { type: 'string', description: 'Arabic dish name' },
    desc: { type: 'string', description: 'Arabic: main ingredients with portion sizes, one short line' },
    ingredients: { type: 'array', items: { type: 'string' }, description: 'Arabic shopping items without quantities, e.g. «صدر دجاج»' },
    kcal: { type: 'integer' }, protein: { type: 'integer', description: 'grams' }, carbs: { type: 'integer', description: 'grams' }, fat: { type: 'integer', description: 'grams' }, fiber: { type: 'integer', description: 'grams' },
  },
};
function healthBrief(extra = '') {
  const p = hProfile();
  return [`Goal: ${H_GOALS[p.goal]}.`, p.kcal ? `Daily calories target: ${p.kcal}.` : 'Choose a sensible daily calorie level for an adult with this goal.', p.protein ? `Daily protein target: ${p.protein} g.` : '',
    p.likes ? `Likes: ${p.likes}.` : '', p.avoid ? `Must avoid (allergies/dislikes): ${p.avoid}.` : '', `Meals per day: breakfast, lunch, dinner${p.snack ? ', and one snack' : ''}.`, extra].filter(Boolean).join('\n');
}
const H_SYSTEM = 'You are a careful nutrition planner for an Arabic-speaking user in Saudi Arabia. Plan realistic home meals (Saudi, Gulf, Levantine and simple international dishes), varied across the week: rotate protein sources (chicken, red meat, fish when allowed, eggs, legumes, dairy), grains and vegetables; do not repeat a main dish more than twice a week. Estimate nutrition values honestly per serving. All text in Arabic. Never include anything the user must avoid.';

async function aiWeek(btn, dowOnly) {
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'يخطط…';
  try {
    if (dowOnly != null) {
      const others = S.meals.filter((m) => m.dow !== dowOnly).map((m) => m.name).join('، ');
      const out = await AI.ask({ system: H_SYSTEM, effort: 'medium', maxTokens: 6000, prompt: `${healthBrief(others ? `Other days already have: ${others}. Keep this day different from them.` : '')}\n\nPlan the meals for ${AR_DAYS[dowOnly]}.`,
        schema: { type: 'object', additionalProperties: false, required: ['meals'], properties: { meals: { type: 'array', items: MEAL_SCHEMA } } } });
      S.meals = S.meals.filter((m) => m.dow !== dowOnly).concat(out.meals.map((m) => normalizeMeal({ ...m, dow: dowOnly })));
      hUi.day = dowOnly;
      save(); render(); toast(`خُطّط ${AR_DAYS[dowOnly]}`);
    } else {
      const out = await AI.ask({ system: H_SYSTEM, effort: 'medium', maxTokens: 16000, prompt: `${healthBrief()}\n\nPlan a full week, Saturday to Friday. dow numbers: 0=Sunday … 6=Saturday. Add 2-4 short Arabic tips about this week's balance.`,
        schema: { type: 'object', additionalProperties: false, required: ['days', 'tips'], properties: { days: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['dow', 'meals'], properties: { dow: { type: 'integer' }, meals: { type: 'array', items: MEAL_SCHEMA } } } }, tips: { type: 'array', items: { type: 'string' } } } } });
      const meals = out.days.flatMap((d) => d.meals.map((m) => normalizeMeal({ ...m, dow: d.dow })));
      if (!meals.length) throw new Error('empty');
      S.meals = meals;
      save(); render();
      if (out.tips && out.tips.length) toast(`💡 ${out.tips[0]}`);
      else toast('خُطّط الأسبوع');
    }
  } catch (e) { toast(e.message === 'empty' ? 'لم يرجع الذكاء الاصطناعي خطة. حاول مرة أخرى.' : AI.friendly(e)); }
  if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
}
async function aiSwap(id, btn) {
  const m = S.meals.find((x) => x.id === id);
  btn.disabled = true;
  try {
    const week = S.meals.map((x) => x.name).join('، ');
    const out = await AI.ask({ system: H_SYSTEM, effort: 'low', maxTokens: 3000, prompt: `${healthBrief()}\n\nReplace this ${SLOTS[m.slot][0]} on ${AR_DAYS[m.dow]}: «${m.name}» (${m.kcal} kcal) with a different dish of similar calories, not already in this week: ${week}.`, schema: MEAL_SCHEMA });
    Object.assign(m, normalizeMeal({ ...out, id: m.id, dow: m.dow, slot: m.slot }));
    save(); render(); toast(`بدّلتها بـ«${m.name}»`);
  } catch (e) { toast(AI.friendly(e)); }
  if (btn.isConnected) btn.disabled = false;
}
async function aiNutrition(btn) {
  const name = $('mlName').value.trim(), desc = $('mlDesc').value.trim();
  if (!name && !desc) { toast('اكتب الوجبة ومكوناتها أولاً.'); return; }
  btn.disabled = true;
  try {
    const out = await AI.ask({ system: 'Estimate nutrition values for one serving of the meal described (Arabic input). If quantities are missing assume a typical adult serving.', effort: 'low', maxTokens: 1000, prompt: `${name}\n${desc}`,
      schema: { type: 'object', additionalProperties: false, required: ['kcal', 'protein', 'carbs', 'fat', 'fiber'], properties: Object.fromEntries(NUTR.map(([k]) => [k, { type: 'integer' }])) } });
    for (const [k] of NUTR) $('ml-' + k).value = out[k];
    toast('قيم تقديرية، عدّلها إن شئت');
  } catch (e) { toast(AI.friendly(e)); }
  if (btn.isConnected) btn.disabled = false;
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
    case 'h-goal': S.settings.health = { ...hProfile(), goal: v }; save(); render(); break;
    case 'h-ai-week': aiWeek(el, null); break;
    case 'h-ai-day': aiWeek(el, Number(v)); break;
    case 'h-swap': aiSwap(v, el); break;
    case 'h-ai-nutr': aiNutrition(el); break;
    case 'h-eat': {
      const d = today();
      let rec = S.mealDone.find((x) => x.id === d);
      if (!rec) { rec = normalizeMealDone({ id: d }); S.mealDone.push(rec); }
      rec.ids = rec.ids.includes(v) ? rec.ids.filter((x) => x !== v) : [...rec.ids, v];
      S.mealDone = S.mealDone.filter((x) => x.id >= addDays(d, -60)); // keep two months
      save(); render();
      break;
    }
    case 'h-shop': {
      const items = [...new Set(S.meals.flatMap((m) => m.ingredients).map((x) => x.trim()).filter(Boolean))];
      if (!items.length) { toast('لا مكونات مسجلة. خطط بالذكاء الاصطناعي أو اكتب المكونات.'); break; }
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
  const k = e.target.dataset && e.target.dataset.hp;
  if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : ['kcal', 'protein'].includes(k) ? num(e.target.value) : e.target.value.trim();
  S.settings.health = { ...hProfile(), [k]: v };
  save();
  render();
});

Object.assign(LibraryViews, { health: viewHealth });
