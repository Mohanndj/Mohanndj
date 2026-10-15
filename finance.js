'use strict';
// «المالية»: personal finance laid out like the user's own workbook («الخطة الشخصية المالية»):
// budget plans (a month or a «what if» scenario) with income, fixed monthly expenses, periodic
// expenses spread per month, and what is left for savings and emergency accounts; actual spending
// against the plan; debts I owe; money owed to me («الحقوق المالية»); cost projects (like a wedding).
// The workbook can be imported straight from the phone; nothing is sent anywhere.

const finUi = { tab: 'plans', plan: '', proj: '', month: '' };
const EVERY_M = [1, 2, 3, 4, 6, 12, 24];
const money = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US')} ${S.settings.currency || 'ريال'}`;
const num = (v) => { const n = Number(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const sum = (arr, f = (x) => x.amount) => arr.reduce((n, x) => n + (Number(f(x)) || 0), 0);
const row = (o) => ({ id: o.id || uid(), name: String(o.name || ''), amount: num(o.amount), ...(o.every != null ? { every: Math.max(1, num(o.every) || 12) } : {}), ...(o.balance != null ? { balance: num(o.balance) } : {}), ...(o.done != null ? { done: !!o.done } : {}) });

function normalizeFinPlan(p) {
  return {
    id: p.id || uid(), name: String(p.name || 'خطة'), kind: p.kind === 'scenario' ? 'scenario' : 'month', month: p.month || '',
    income: (p.income || []).map(row), fixed: (p.fixed || []).map(row), periodic: (p.periodic || []).map((x) => row({ ...x, every: x.every ?? 12 })),
    accounts: (p.accounts || []).map((x) => row({ ...x, balance: x.balance ?? 0 })), goal: num(p.goal), notes: String(p.notes || ''),
    created: p.created || Date.now(), updated: p.updated || Date.now(),
  };
}
const payments = (list) => (Array.isArray(list) ? list : []).filter((x) => x && x.amount).map((x) => ({ id: x.id || uid(), d: x.d || today(), amount: num(x.amount), note: String(x.note || '') }));
function normalizeDebt(d) {
  return { id: d.id || uid(), name: String(d.name || ''), total: num(d.total), monthly: num(d.monthly), end: d.end || '', note: String(d.note || ''), payments: payments(d.payments), created: d.created || Date.now() };
}
function normalizeRight(d) {
  return { id: d.id || uid(), name: String(d.name || ''), amount: num(d.amount), note: String(d.note || ''), date: d.date || '', payments: payments(d.payments), created: d.created || Date.now() };
}
function normalizeFinProject(p) {
  return { id: p.id || uid(), name: String(p.name || 'مشروع'), items: (p.items || []).map((x) => row({ ...x, done: !!x.done })), funding: (p.funding || []).map(row), note: String(p.note || ''), created: p.created || Date.now() };
}
function normalizeTx(t) {
  return { id: t.id || uid(), d: t.d || today(), amount: num(t.amount), kind: t.kind === 'in' ? 'in' : 'out', item: String(t.item || ''), note: String(t.note || ''), created: t.created || Date.now() };
}

// ---------- calculations ----------
function planCalc(p) {
  const income = sum(p.income), fixed = sum(p.fixed);
  const periodic = sum(p.periodic, (x) => x.amount / (x.every || 12));
  const left = income - fixed - periodic;
  return { income, fixed, periodic, periodicYear: periodic * 12, left, accounts: sum(p.accounts, (x) => x.balance) };
}
const paid = (d) => sum(d.payments);
const debtLeft = (d) => Math.max(0, d.total - paid(d));
const rightLeft = (r) => Math.max(0, r.amount - paid(r));
function debtEnd(d) {
  if (d.end) return d.end;
  if (!d.monthly || !debtLeft(d)) return '';
  const m = Math.ceil(debtLeft(d) / d.monthly);
  const x = parse(today()); x.setMonth(x.getMonth() + m);
  return iso(x);
}
const getFinPlan = (id) => S.finPlans.find((p) => p.id === id);
// the chosen plan, else the latest month plan (imported sheets keep the workbook's order: first sheet first)
const activePlan = () => getFinPlan(S.settings.finActive) || S.finPlans.filter((p) => p.kind === 'month').sort((a, b) => (b.month || '').localeCompare(a.month || ''))[0] || S.finPlans[0] || null;
const monthName = (m) => (m ? parse(`${m}-01`).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }) : '');

// income split bar: fixed / periodic / left
function splitBar(c) {
  const base = Math.max(c.income, c.fixed + c.periodic, 1);
  const seg = (v, cls, label) => (v > 0 ? `<i class="${cls}" style="width:${(v / base) * 100}%" title="${label}"></i>` : '');
  return `<div class="fin-split" role="img" aria-label="توزيع الدخل">${seg(c.fixed, 'fx', 'الثابتة')}${seg(c.periodic, 'pd', 'الدورية')}${seg(c.left, 'sv', 'المتبقي')}</div>
    <div class="fin-legend"><span><i class="fx"></i>الثابتة ${money(c.fixed)}</span><span><i class="pd"></i>الدورية ${money(c.periodic)}</span><span><i class="sv"></i>${c.left >= 0 ? 'المتبقي للادخار' : 'العجز'} ${money(Math.abs(c.left))}</span></div>`;
}

// ---------- editable rows (like spreadsheet rows) ----------
function rowsHTML(scope, sid, list, cols, items, opts = {}) {
  const inp = (x, c) => {
    const id = `f-${list}-${x.id}-${c.k}`;
    if (c.k === 'every') return `<select id="${id}" data-fin="${scope}" data-sid="${sid}" data-list="${list}" data-row="${x.id}" data-k="every" aria-label="التكرار">${[...new Set([...EVERY_M, x.every])].sort((a, b) => a - b).map((m) => `<option value="${m}"${x.every === m ? ' selected' : ''}>${m === 1 ? 'كل شهر' : m === 12 ? 'سنوياً' : m === 24 ? 'كل سنتين' : `كل ${m} أشهر`}</option>`).join('')}</select>`;
    if (c.k === 'done') return `<label class="fin-chk"><input type="checkbox" id="${id}" data-fin="${scope}" data-sid="${sid}" data-list="${list}" data-row="${x.id}" data-k="done"${x.done ? ' checked' : ''}><span>تم</span></label>`;
    return `<input type="${c.num ? 'text' : 'text'}" ${c.num ? 'inputmode="decimal" class="num-in"' : ''} id="${id}" data-fin="${scope}" data-sid="${sid}" data-list="${list}" data-row="${x.id}" data-k="${c.k}" value="${esc(c.num ? (x[c.k] || '') : x[c.k])}" placeholder="${c.ph}" aria-label="${c.ph}" autocomplete="off"${c.num ? ' data-novoice' : ''}>`;
  };
  return `<div class="fin-rows c${cols.length}">
    ${items.map((x) => `<div class="fin-row${x.done ? ' done' : ''}">${cols.map((c) => inp(x, c)).join('')}<button type="button" class="fin-del" data-action="fin-row-del" data-scope="${scope}" data-sid="${sid}" data-list="${list}" data-v="${x.id}" aria-label="حذف">✕</button>${opts.extra ? `<small class="fin-x">${opts.extra(x)}</small>` : ''}</div>`).join('')}
    <button type="button" class="fin-add" data-action="fin-row-add" data-scope="${scope}" data-sid="${sid}" data-list="${list}">${icon('plus')} ${opts.addLabel || 'بند'}</button>
  </div>`;
}

// ---------- page ----------
function viewFinance() {
  const tabs = [['plans', 'الخطط'], ['spend', 'المصروف'], ['debts', 'الديون'], ['rights', 'الحقوق'], ['projects', 'المشاريع']];
  const ap = activePlan();
  const c = ap ? planCalc(ap) : null;
  const debts = sum(S.finDebts, debtLeft), rights = sum(S.finRights, rightLeft);
  const body = { plans: finPlansHTML, spend: finSpendHTML, debts: finDebtsHTML, rights: finRightsHTML, projects: finProjectsHTML }[finUi.tab]();
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>المالية</h2><div class="btn-row">${S.finPlans.length || S.finDebts.length ? xlsBtn('finance') : ''}<label class="xls-btn fin-import">${icon('sheet')}استيراد إكسل<input type="file" id="finImport" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div></div>
    ${c ? `<button type="button" class="fin-top" data-action="fin-open" data-v="${ap.id}">
      <small>${esc(ap.name)}${ap.month ? ` · ${esc(monthName(ap.month))}` : ''}</small>
      <div class="fin-tiles"><span><b>${money(c.income)}</b>الدخل</span><span><b>${money(c.fixed + c.periodic)}</b>المصاريف</span><span class="${c.left < 0 ? 'neg' : 'pos'}"><b>${money(c.left)}</b>${c.left < 0 ? 'عجز' : 'للادخار'}</span></div>
    </button>` : ''}
    ${debts || rights ? `<div class="fin-mini">${debts ? `<button type="button" data-action="fin-tab" data-v="debts">عليّ ديون: <b>${money(debts)}</b></button>` : ''}${rights ? `<button type="button" data-action="fin-tab" data-v="rights">لي عند الناس: <b>${money(rights)}</b></button>` : ''}</div>` : ''}
    <div class="seg seg-wrap" role="group" aria-label="الأقسام">${tabs.map(([v, l]) => `<button type="button" data-action="fin-tab" data-v="${v}" aria-pressed="${finUi.tab === v}">${l}</button>`).join('')}</div>
  </section>
  ${body}`;
}

// --- plans
function finPlansHTML() {
  if (finUi.plan && getFinPlan(finUi.plan)) return planDetailHTML(getFinPlan(finUi.plan));
  const ap = activePlan();
  const list = S.finPlans.slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'month' ? -1 : 1) || (b.month || '').localeCompare(a.month || '') || b.created - a.created);
  return `<section class="section">
    <div class="section-head"><h2>خطط الميزانية</h2><div class="btn-row">${ap ? `<button type="button" class="ghost" data-action="fin-copy" data-v="${ap.id}">نسخة لشهر جديد</button>` : ''}${addBtn('fin-new', 'خطة')}</div></div>
    ${list.length ? `<div class="book-list">${list.map((p) => { const c = planCalc(p); return `<button type="button" class="fin-card${ap && p.id === ap.id ? ' active' : ''}" data-action="fin-open" data-v="${p.id}">
      <span class="row-between"><b>${esc(p.name)}</b><small class="fin-kind">${p.kind === 'month' ? (p.month ? esc(monthName(p.month)) : 'شهرية') : 'افتراضية'}${ap && p.id === ap.id ? ' · الحالية' : ''}</small></span>
      ${splitBar(c)}
    </button>`; }).join('')}</div>`
      : emptyHTML('ابدأ خطتك المالية', 'خطة لكل شهر، أو خطة افتراضية «على فرض…» لتجرّب سيناريو: الدخل، والمصاريف الشهرية الثابتة، والمصاريف الدورية (السنوية أو كل بضعة أشهر) مقسّمة على الأشهر، وما يتبقى للادخار وسيولة الطوارئ. أو استورد ملف الإكسل الذي تعمل عليه.', addBtn('fin-new', 'أول خطة'))}
  </section>`;
}

function planDetailHTML(p) {
  const c = planCalc(p);
  const isActive = activePlan() && activePlan().id === p.id;
  return `<section class="section fin-plan">
    <div class="crumbs"><button type="button" class="back" data-action="fin-close">${icon('back')} الخطط</button></div>
    <input type="text" class="fin-title" id="fp-name" data-fin="plan" data-sid="${p.id}" data-k="name" value="${esc(p.name)}" aria-label="اسم الخطة" autocomplete="off">
    <div class="row-between fin-meta">
      <div class="seg" role="group">${[['month', 'خطة شهر'], ['scenario', 'افتراضية «على فرض»']].map(([v, l]) => `<button type="button" data-action="fin-kind" data-v="${v}" aria-pressed="${p.kind === v}">${l}</button>`).join('')}</div>
      ${p.kind === 'month' ? `<input type="month" id="fp-month" data-fin="plan" data-sid="${p.id}" data-k="month" value="${p.month}" aria-label="الشهر">` : ''}
    </div>
    ${splitBar(c)}
    <div class="panel"><h3>الدخل <small>${money(c.income)}</small></h3>${rowsHTML('plan', p.id, 'income', [{ k: 'name', ph: 'البند' }, { k: 'amount', ph: 'المبلغ', num: true }], p.income, { addLabel: 'دخل' })}</div>
    <div class="panel"><h3>١- المصاريف الشهرية الثابتة <small>${money(c.fixed)}</small></h3>
      <p class="note-text">مبالغ تُدفع كل شهر بشكل ثابت ومكرر.</p>
      ${rowsHTML('plan', p.id, 'fixed', [{ k: 'name', ph: 'البند' }, { k: 'amount', ph: 'المبلغ', num: true }], p.fixed)}</div>
    <div class="panel"><h3>٢- المصاريف الدورية <small>${money(c.periodic)} شهرياً</small></h3>
      <p class="note-text">مبالغ لا تُدفع كل شهر (كل سنة أو كل بضعة أشهر)، يُخصَّص لها كل شهر جزء. سنوياً: ${money(c.periodicYear)}.</p>
      ${rowsHTML('plan', p.id, 'periodic', [{ k: 'name', ph: 'البند' }, { k: 'every' }, { k: 'amount', ph: 'المبلغ', num: true }], p.periodic, { extra: (x) => `${money(x.amount / (x.every || 12))} شهرياً` })}</div>
    <div class="panel"><h3>٣- الادخار وسيولة الطوارئ</h3>
      <div class="fin-left ${c.left < 0 ? 'neg' : 'pos'}"><span>${c.left < 0 ? 'العجز' : 'المتبقي للادخار'}</span><b>${money(Math.abs(c.left))}</b></div>
      <p class="note-text">أولى مبالغ الادخار تكون لبناء سيولة الطوارئ.</p>
      <label class="field"><span>هدف الادخار</span><input type="text" inputmode="decimal" class="num-in" id="fp-goal" data-fin="plan" data-sid="${p.id}" data-k="goal" value="${p.goal || ''}" placeholder="مثال: 15000" data-novoice></label>
      ${p.goal && c.left > 0 ? `<p class="note-text">بمعدل ${money(c.left)} شهرياً تبلغ هدفك بعد ${Math.ceil(p.goal / c.left)} ${Math.ceil(p.goal / c.left) <= 10 ? 'أشهر' : 'شهراً'}.</p>` : ''}
      <h4>الحسابات (الرصيد المتوفر) <small>${money(c.accounts)}</small></h4>
      ${rowsHTML('plan', p.id, 'accounts', [{ k: 'name', ph: 'الحساب' }, { k: 'balance', ph: 'الرصيد', num: true }], p.accounts, { addLabel: 'حساب' })}</div>
    <div class="panel"><h3>ملاحظات</h3><textarea id="fp-notes" data-fin="plan" data-sid="${p.id}" data-k="notes" rows="3" placeholder="مثل: هدف الادخار ١٥ ألفاً بنهاية السنة">${esc(p.notes)}</textarea></div>
    <div class="btn-row">
      ${isActive ? '<span class="note-text">✓ هذه خطتك الحالية</span>' : `<button type="button" class="primary" data-action="fin-active" data-v="${p.id}">اجعلها الخطة الحالية</button>`}
      <button type="button" class="ghost" data-action="fin-copy" data-v="${p.id}">نسخة منها</button>
      <button type="button" class="danger" data-action="fin-del" data-v="${p.id}">حذف</button>
    </div>
  </section>`;
}

// --- actual spending against the current plan
function finSpendHTML() {
  const m = finUi.month || today().slice(0, 7);
  const ap = activePlan();
  const txs = S.finTx.filter((t) => t.d.slice(0, 7) === m).sort((a, b) => b.d.localeCompare(a.d) || b.created - a.created);
  const out = sum(txs.filter((t) => t.kind === 'out')), inn = sum(txs.filter((t) => t.kind === 'in'));
  const items = ap ? [...ap.fixed.map((x) => [x.name, x.amount]), ...ap.periodic.map((x) => [x.name, x.amount / (x.every || 12)])].filter(([n]) => n) : [];
  const spentOn = (name) => sum(txs.filter((t) => t.kind === 'out' && t.item === name));
  const other = sum(txs.filter((t) => t.kind === 'out' && !items.some(([n]) => n === t.item)));
  const days = [...new Set(txs.map((t) => t.d))];
  const prev = (k) => { const d = parse(`${m}-01`); d.setMonth(d.getMonth() + k); return iso(d).slice(0, 7); };
  return `<section class="section">
    <div class="cal-head">
      <div class="nav"><button type="button" data-action="fin-month" data-v="${prev(-1)}" aria-label="الشهر السابق">${icon('prev')}</button></div>
      <div class="titles"><h2>مصروف ${esc(monthName(m))}</h2><small>${ap ? `مقارنة بخطة «${esc(ap.name)}»` : 'أنشئ خطة لتقارن بها'}</small></div>
      <div class="nav"><button type="button" data-action="fin-month" data-v="${prev(1)}" aria-label="الشهر التالي"${m >= today().slice(0, 7) ? ' disabled' : ''}>${icon('next')}</button></div>
    </div>
    <form class="fin-tx" id="finTxForm" autocomplete="off">
      <div class="seg" role="group" id="txKind"><button type="button" data-action="fin-txkind" data-v="out" aria-pressed="${(finUi.txKind || 'out') === 'out'}">صرفت</button><button type="button" data-action="fin-txkind" data-v="in" aria-pressed="${finUi.txKind === 'in'}">دخل</button></div>
      <div class="fin-tx-row">
        <input type="text" inputmode="decimal" id="txAmount" class="num-in" placeholder="المبلغ" aria-label="المبلغ" data-novoice>
        <input type="text" id="txItem" list="txItems" placeholder="البند" aria-label="البند">
        <datalist id="txItems">${[...new Set([...items.map(([n]) => n), ...S.finTx.map((t) => t.item)])].filter(Boolean).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      </div>
      <div class="fin-tx-row"><input type="text" id="txNote" placeholder="ملاحظة (اختياري)" aria-label="ملاحظة"><input type="date" id="txDate" value="${m === today().slice(0, 7) ? today() : `${m}-01`}" aria-label="التاريخ"></div>
      <button type="submit" class="primary">سجّل</button>
    </form>
    <div class="fin-tiles"><span><b>${money(out)}</b>صرفت</span>${inn ? `<span><b>${money(inn)}</b>دخل إضافي</span>` : ''}${ap ? `<span class="${planCalc(ap).fixed + planCalc(ap).periodic - out < 0 ? 'neg' : 'pos'}"><b>${money(planCalc(ap).fixed + planCalc(ap).periodic - out)}</b>المتبقي من المخطط</span>` : ''}</div>
    ${items.length && txs.length ? `<div class="panel"><h3>المخطط والفعلي</h3><ul class="hbars">${items.filter(([n]) => spentOn(n)).map(([n, plan]) => { const s = spentOn(n); return hbar(`${esc(n)}${s > plan ? ' ⚠️' : ''}`, `${money(s)} من ${money(plan)}`, Math.min(100, plan ? Math.round((s / plan) * 100) : 100), s > plan ? 'var(--high)' : undefined); }).join('')}${other ? hbar('خارج الخطة', money(other), 100, 'var(--mid)') : ''}</ul></div>` : ''}
    ${days.length ? days.map((d) => `<h3 class="j-month">${esc(relDate(d))}</h3><ul class="fin-txs">${txs.filter((t) => t.d === d).map((t) => `<li class="${t.kind}"><span><b>${t.kind === 'in' ? '+' : '−'}${money(t.amount)}</b> ${esc(t.item || 'بلا بند')}${t.note ? ` <small>${esc(t.note)}</small>` : ''}</span><button type="button" class="fin-del" data-action="fin-tx-del" data-v="${t.id}" aria-label="حذف">✕</button></li>`).join('')}</ul>`).join('')
      : emptyHTML('لا مصروفات مسجلة', 'سجّل ما تصرفه أولاً بأول، ويقارنه التطبيق بما خططت له لكل بند.')}
  </section>`;
}

// --- debts and rights share one layout
function ledgerCard(x, kind) {
  const isDebt = kind === 'debt';
  const total = isDebt ? x.total : x.amount;
  const left = isDebt ? debtLeft(x) : rightLeft(x);
  const pct = total ? Math.round(((total - left) / total) * 100) : 0;
  const end = isDebt ? debtEnd(x) : '';
  return `<article class="fin-card ledger${left ? '' : ' cleared'}">
    <button type="button" class="hz-main" data-action="${kind}-open" data-v="${x.id}">
      <span class="row-between"><b>${esc(x.name)}</b><b class="${left ? (isDebt ? 'late' : '') : 'ok'}">${left ? money(left) : '✓ انتهى'}</b></span>
      <small>${isDebt ? 'الدَّين' : 'المبلغ'} ${money(total)} · ${isDebt ? 'المسدد' : 'المستلم'} ${money(total - left)}${isDebt && x.monthly ? ` · القسط ${money(x.monthly)}` : ''}${end && left ? ` · ينتهي ${esc(fmtDate(end, { month: 'long', year: 'numeric' }))}` : ''}</small>
      ${x.note ? `<small>${esc(x.note)}</small>` : ''}
    </button>
    <div class="progress-line"><i style="width:${pct}%"></i></div>
    ${left ? `<div class="btn-row"><button type="button" class="ghost" data-action="${kind}-pay" data-v="${x.id}">${isDebt ? 'سدّدت دفعة' : 'استلمت دفعة'}</button></div>` : ''}
  </article>`;
}
function finDebtsHTML() {
  const list = S.finDebts.slice().sort((a, b) => !debtLeft(a) - !debtLeft(b) || debtLeft(b) - debtLeft(a));
  return `<section class="section">
    <div class="section-head"><h2>الديون <small class="num">${money(sum(S.finDebts, debtLeft))}</small></h2>${addBtn('debt-new', 'دَين')}</div>
    ${list.length ? `<div class="book-list">${list.map((x) => ledgerCard(x, 'debt')).join('')}</div>` : emptyHTML('لا ديون', 'سجّل ما عليك من ديون: الدائن، والمبلغ، والقسط الشهري، وسجّل كل دفعة تسددها لترى الباقي ومتى تنتهي.')}
  </section>`;
}
function finRightsHTML() {
  const list = S.finRights.slice().sort((a, b) => !rightLeft(a) - !rightLeft(b) || rightLeft(b) - rightLeft(a));
  return `<section class="section">
    <div class="section-head"><h2>الحقوق المالية <small class="num">${money(sum(S.finRights, rightLeft))}</small></h2>${addBtn('right-new', 'حق')}</div>
    <p class="note-text">المبالغ التي لك عند الآخرين.</p>
    ${list.length ? `<div class="book-list">${list.map((x) => ledgerCard(x, 'right')).join('')}</div>` : emptyHTML('لا حقوق مسجلة', 'سجّل من استدان منك ومتى، وسجّل ما يرده لك.')}
  </section>`;
}

// --- cost projects
function finProjectsHTML() {
  const p = finUi.proj && S.finProjects.find((x) => x.id === finUi.proj);
  if (p) {
    const cost = sum(p.items), fund = sum(p.funding), bought = sum(p.items.filter((x) => x.done));
    return `<section class="section fin-plan">
      <div class="crumbs"><button type="button" class="back" data-action="fin-close">${icon('back')} المشاريع</button></div>
      <input type="text" class="fin-title" id="fj-name" data-fin="proj" data-sid="${p.id}" data-k="name" value="${esc(p.name)}" aria-label="اسم المشروع" autocomplete="off">
      <div class="fin-tiles"><span><b>${money(cost)}</b>التكلفة</span><span><b>${money(fund)}</b>المتوفر</span><span class="${fund - cost < 0 ? 'neg' : 'pos'}"><b>${money(fund - cost)}</b>${fund - cost < 0 ? 'ينقصك' : 'يفيض'}</span></div>
      ${cost ? `<p class="note-text">تم شراء ما قيمته ${money(bought)} (${Math.round((bought / cost) * 100)}٪).</p>` : ''}
      <div class="panel"><h3>البنود</h3>${rowsHTML('proj', p.id, 'items', [{ k: 'name', ph: 'البند' }, { k: 'amount', ph: 'المبلغ', num: true }, { k: 'done' }], p.items)}</div>
      <div class="panel"><h3>مصادر التمويل</h3>${rowsHTML('proj', p.id, 'funding', [{ k: 'name', ph: 'المصدر' }, { k: 'amount', ph: 'المبلغ', num: true }], p.funding, { addLabel: 'مصدر' })}</div>
      <div class="panel"><h3>ملاحظات</h3><textarea id="fj-note" data-fin="proj" data-sid="${p.id}" data-k="note" rows="3">${esc(p.note)}</textarea></div>
      <div class="btn-row"><button type="button" class="danger" data-action="proj-del" data-v="${p.id}">حذف المشروع</button></div>
    </section>`;
  }
  return `<section class="section">
    <div class="section-head"><h2>المشاريع المالية</h2>${addBtn('proj-new', 'مشروع')}</div>
    <p class="note-text">لكل مشروع كبير (زواج، سفر، تأثيث، سيارة) بنوده وتكلفتها، ومصادر تمويله، وكم ينقصك.</p>
    ${S.finProjects.length ? `<div class="book-list">${S.finProjects.map((x) => { const cost = sum(x.items), fund = sum(x.funding); return `<button type="button" class="fin-card" data-action="proj-open" data-v="${x.id}">
      <span class="row-between"><b>${esc(x.name)}</b><b class="${fund - cost < 0 ? 'late' : 'ok'}">${fund - cost < 0 ? `ينقص ${money(cost - fund)}` : 'مغطّى'}</b></span>
      <small>${plural(x.items.length, 'بند واحد', 'بندان', 'بنود', 'بنداً')} · التكلفة ${money(cost)} · المتوفر ${money(fund)}</small>
      <div class="progress-line"><i style="width:${cost ? Math.min(100, Math.round((fund / cost) * 100)) : 0}%"></i></div>
    </button>`; }).join('')}</div>` : emptyHTML('لا مشاريع', 'أنشئ مشروعاً وأضف بنوده ومصادر تمويله.')}
  </section>`;
}

// ---------- ledger editor (debts and rights) ----------
function openLedger(kind, id) {
  const isDebt = kind === 'debt';
  const list = isDebt ? S.finDebts : S.finRights;
  const x = id ? list.find((d) => d.id === id) : (isDebt ? normalizeDebt({}) : normalizeRight({}));
  ldraft = { kind, id: x.id, isNew: !id };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? esc(x.name) : isDebt ? 'دَين جديد' : 'حق جديد'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>${isDebt ? 'اسم الدائن' : 'عند من؟'}</span><input type="text" id="lgName" value="${esc(x.name)}" autocomplete="off"></label>
    <div class="grid2">
      <label class="field"><span>${isDebt ? 'مبلغ الدَّين' : 'المبلغ'}</span><input type="text" inputmode="decimal" class="num-in" id="lgTotal" value="${(isDebt ? x.total : x.amount) || ''}" data-novoice></label>
      ${isDebt ? `<label class="field"><span>القسط الشهري</span><input type="text" inputmode="decimal" class="num-in" id="lgMonthly" value="${x.monthly || ''}" data-novoice></label>`
        : `<label class="field"><span>التاريخ</span><input type="date" id="lgDate" value="${x.date}"></label>`}
    </div>
    ${isDebt ? `<label class="field"><span>تاريخ الانتهاء المتوقع (اختياري)</span><input type="date" id="lgEnd" value="${x.end}"><small class="hint">إن تركته فارغاً يُحسب من القسط الشهري</small></label>` : ''}
    <label class="field"><span>ملاحظة</span><input type="text" id="lgNote" value="${esc(x.note)}" autocomplete="off"></label>
    ${id && x.payments.length ? `<div class="field"><span>${isDebt ? 'الدفعات المسددة' : 'الدفعات المستلمة'}</span><ul class="ppl-hist">${x.payments.slice().sort((a, b) => b.d.localeCompare(a.d)).map((p) => `<li><span>${money(p.amount)} · ${esc(dateBoth(p.d, true))}${p.note ? ` · ${esc(p.note)}` : ''}</span><button type="button" class="j-m-del" data-action="lg-pay-del" data-v="${p.id}" aria-label="حذف">✕</button></li>`).join('')}</ul></div>` : ''}
    <div class="sheet-actions">
      <button type="submit" class="primary">حفظ</button>
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function saveLedger() {
  const isDebt = ldraft.kind === 'debt';
  const list = isDebt ? S.finDebts : S.finRights;
  const name = $('lgName').value.trim();
  if (!name) { toast('اكتب الاسم.'); return false; }
  const old = list.find((d) => d.id === ldraft.id);
  const x = isDebt
    ? normalizeDebt({ ...(old || {}), id: ldraft.id, name, total: num($('lgTotal').value), monthly: num($('lgMonthly').value), end: $('lgEnd').value, note: $('lgNote').value.trim() })
    : normalizeRight({ ...(old || {}), id: ldraft.id, name, amount: num($('lgTotal').value), date: $('lgDate').value, note: $('lgNote').value.trim() });
  if (old) Object.assign(old, x); else list.push(x);
  save();
  return true;
}
function openPayment(kind, id) {
  const isDebt = kind === 'debt';
  const x = (isDebt ? S.finDebts : S.finRights).find((d) => d.id === id);
  ldraft = { kind: 'pay', id, isNew: true, of: kind };
  const left = isDebt ? debtLeft(x) : rightLeft(x);
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${isDebt ? 'دفعة لـ' : 'دفعة من '}${esc(x.name)}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="note-text">الباقي ${money(left)}</p>
    <div class="grid2">
      <label class="field"><span>المبلغ</span><input type="text" inputmode="decimal" class="num-in" id="pyAmount" value="${Math.min(left, (isDebt && x.monthly) || left) || ''}" data-novoice></label>
      <label class="field"><span>التاريخ</span><input type="date" id="pyDate" value="${today()}"></label>
    </div>
    <label class="field"><span>ملاحظة (اختياري)</span><input type="text" id="pyNote" autocomplete="off"></label>
    <div class="sheet-actions"><button type="submit" class="primary">سجّل الدفعة</button></div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function savePayment() {
  const isDebt = ldraft.of === 'debt';
  const x = (isDebt ? S.finDebts : S.finRights).find((d) => d.id === ldraft.id);
  const amount = num($('pyAmount').value);
  if (!amount) { toast('اكتب المبلغ.'); return false; }
  x.payments.push({ id: uid(), d: $('pyDate').value || today(), amount, note: $('pyNote').value.trim() });
  save();
  const left = isDebt ? debtLeft(x) : rightLeft(x);
  toast(left ? `سُجّلت. الباقي ${money(left)}` : isDebt ? `🎉 سددت دَين ${x.name} كاملاً!` : `استلمت حقك من ${x.name} كاملاً`);
  return true;
}

// ---------- import from the user's workbook ----------
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number';
function findCell(sh, test) { for (const [k, v] of sh.cells) if (isStr(v) && test(v)) { const [r, c] = k.split(',').map(Number); return [r, c]; } return null; }
const numRight = (sh, r, c) => { for (let k = 1; k <= 4; k++) { const v = sh.get(r, c + k); if (isNum(v)) return v; } return 0; };

function parseBudgetSheet(sh) {
  const incL = findCell(sh, (v) => v.startsWith('الدخل الشهري'));
  if (!incL) return null;
  const exL = findCell(sh, (v) => v.startsWith('الدخل الاضافي') || v.startsWith('الدخل الإضافي'));
  const income = [{ name: 'الراتب', amount: numRight(sh, ...incL) }];
  if (exL && numRight(sh, ...exL)) income.push({ name: 'الدخل الإضافي', amount: numRight(sh, ...exL) });
  // header row of the three tables
  let hr = 0; const fixedCols = []; let perCol = 0;
  for (const [k, v] of sh.cells) {
    if (v !== 'البند') continue;
    const [r, c] = k.split(',').map(Number);
    if (sh.get(r, c + 1) === 'التكرار') { perCol = c; hr = hr || r; }
    else if (sh.get(r, c + 1) === 'المبلغ') { fixedCols.push(c); hr = hr ? Math.min(hr, r) : r; }
  }
  let end = hr + 16;
  for (const [k, v] of sh.cells) if (isStr(v) && /^(المصاريف الثابتة|مخصص المصاريف|المصاريف الدورية\s*:)/.test(v)) { const r = Number(k.split(',')[0]); if (r > hr && r < end) end = r; }
  const fixed = [], periodic = [];
  for (let r = hr + 1; r < end; r++) {
    for (const c of fixedCols.sort((a, b) => a - b)) { const n = sh.get(r, c); if (isStr(n)) fixed.push({ name: n, amount: isNum(sh.get(r, c + 1)) ? sh.get(r, c + 1) : 0 }); }
    if (perCol) { const n = sh.get(r, perCol); if (isStr(n)) periodic.push({ name: n, every: isNum(sh.get(r, perCol + 1)) ? sh.get(r, perCol + 1) : 12, amount: isNum(sh.get(r, perCol + 2)) ? sh.get(r, perCol + 2) : 0 }); }
  }
  const accounts = [];
  const accL = findCell(sh, (v) => v === 'الحسابات');
  if (accL) for (let r = accL[0] + 1; r < accL[0] + 20; r++) { const n = sh.get(r, accL[1]); if (!isStr(n) || n === 'المجموع') break; accounts.push({ name: n, balance: isNum(sh.get(r, accL[1] + 1)) ? sh.get(r, accL[1] + 1) : 0 }); }
  const rights = [];
  const rL = findCell(sh, (v) => v === 'الحقوق المالية');
  if (rL) for (let r = rL[0] + 1; r < rL[0] + 30; r++) { const n = sh.get(r, rL[1]); if (!isStr(n)) { if (!isStr(sh.get(r + 1, rL[1]))) break; continue; } rights.push({ name: n, amount: isNum(sh.get(r, rL[1] + 1)) ? sh.get(r, rL[1] + 1) : 0 }); }
  const skip = /^(\d+\s*-|المصاريف|أولى مبالغ|حتى راتب|الخطة الشخصية|مخصص|المخصص|المتبقي|مبلغ الادخار$|الادخار وسيولة)/;
  const notes = [...sh.cells.values()].filter((v) => isStr(v) && v.length >= 18 && !skip.test(v));
  return {
    plan: { name: sh.name, kind: /على فرض|بعد|بنهاية|بدون|الدخل مع/.test(sh.name) ? 'scenario' : 'month', income, fixed, periodic, accounts, notes: [...new Set(notes)].join('\n') },
    rights,
  };
}
function parseDebtsSheet(sh) {
  const h = findCell(sh, (v) => v.startsWith('اسم الدائن'));
  if (!h) return null;
  const [r0, c0] = h;
  const out = [];
  for (let r = r0 + 1; r < r0 + 60; r++) {
    const n = sh.get(r, c0);
    if (n === 'المجموع') break;
    if (!isStr(n)) continue;
    const total = sh.get(r, c0 + 1), paidV = sh.get(r, c0 + 2), endV = sh.get(r, c0 + 4);
    let end = '', note = '';
    if (isNum(endV) && endV > 20000) { const d = new Date(Date.UTC(1899, 11, 30) + endV * 86400000); end = d.toISOString().slice(0, 10); } else if (isStr(endV)) note = endV;
    out.push({ name: n, total: isNum(total) ? total : 0, end, note, payments: isNum(paidV) && paidV ? [{ amount: paidV, d: today(), note: 'مسدد قبل الاستيراد' }] : [] });
  }
  return out;
}
// any other sheet: «label → amount» pairs become a cost project; amounts under «المتبقي/التمويل» are funding
function parseProjectSheet(sh) {
  const items = [], funding = [];
  const fundCols = new Set();
  for (const [k, v] of sh.cells) if (isStr(v) && /^(المتبقي|مصادر التمويل|التمويل)$/.test(v)) fundCols.add(Number(k.split(',')[1]));
  const rows = [...new Set([...sh.cells.keys()].map((k) => Number(k.split(',')[0])))].sort((a, b) => a - b);
  for (const r of rows) {
    for (let c = 1; c <= 40; c++) {
      const n = sh.get(r, c);
      if (!isStr(n) || /مجموع|^المتبقي|^مخصص|^البند$|^المبلغ$/.test(n)) continue;
      const amt = isNum(sh.get(r, c + 1)) ? sh.get(r, c + 1) : isNum(sh.get(r, c + 2)) && !isStr(sh.get(r, c + 1)) ? sh.get(r, c + 2) : null;
      // a label without an amount still counts when it sits in a list (labels above or below it)
      if (amt == null && !isStr(sh.get(r + 1, c)) && !isStr(sh.get(r - 1, c))) continue;
      (fundCols.has(c) ? funding : items).push({ name: n, amount: amt || 0 });
    }
  }
  const named = items.filter((x) => x.amount).length + funding.length;
  return named >= 2 ? { name: sh.name, items, funding } : null;
}

async function importWorkbook(file) {
  let sheets;
  try { sheets = await XlsxRead.read(file); }
  catch (e) { toast(e.message === 'unsupported' ? 'متصفحك لا يدعم قراءة الإكسل. حدّث Chrome.' : 'تعذّر قراءة الملف. تأكد أنه ملف إكسل (.xlsx).'); return; }
  const found = [];
  for (const sh of sheets) {
    const b = parseBudgetSheet(sh);
    if (b) { found.push({ type: 'plan', name: sh.name, data: b }); continue; }
    const d = parseDebtsSheet(sh);
    if (d) { found.push({ type: 'debts', name: sh.name, data: d }); continue; }
    const p = parseProjectSheet(sh);
    if (p) found.push({ type: 'project', name: sh.name, data: p });
    else found.push({ type: 'skip', name: sh.name });
  }
  finImportPreview(found);
}
let finFound = [];
function finImportPreview(found) {
  finFound = found;
  ldraft = { kind: 'finimport', id: 'x', isNew: true };
  const label = { plan: 'خطة ميزانية', debts: 'الديون', project: 'مشروع مالي', skip: 'لم أفهم هذه الصفحة' };
  const detail = (f) => f.type === 'plan' ? (() => { const c = planCalc(normalizeFinPlan(f.data.plan)); return `الدخل ${money(c.income)} · المصاريف ${money(c.fixed + c.periodic)} · المتبقي ${money(c.left)}`; })()
    : f.type === 'debts' ? plural(f.data.length, 'دَين واحد', 'دَينان', 'ديون', 'دَيناً')
      : f.type === 'project' ? `${plural(f.data.items.length, 'بند واحد', 'بندان', 'بنود', 'بنداً')}${f.data.funding.length ? ` · ${f.data.funding.length} مصدر تمويل` : ''}` : 'ستُتجاهل';
  const rights = [...new Map(found.filter((f) => f.type === 'plan').flatMap((f) => f.data.rights).map((x) => [x.name, x])).values()];
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>استيراد من الإكسل</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="note-text">وجدت ${plural(found.length, 'صفحة واحدة', 'صفحتين', 'صفحات', 'صفحة')} في الملف. اختر ما تستورده؛ الملف يُقرأ على جوالك ولا يُرسل إلى أي مكان.</p>
    <ul class="fin-imp">${found.map((f, i) => `<li><label class="switch"><input type="checkbox" data-imp="${i}"${f.type === 'skip' ? ' disabled' : ' checked'}><span><b>${esc(f.name)}</b><small>${label[f.type]} · ${esc(detail(f))}</small></span></label></li>`).join('')}</ul>
    ${rights.length ? `<label class="switch"><input type="checkbox" id="impRights" checked><span><b>الحقوق المالية</b><small>${plural(rights.length, 'اسم واحد', 'اسمان', 'أسماء', 'اسماً')} · ${money(sum(rights))} (تتكرر في كل صفحة فتُستورد مرة واحدة)</small></span></label>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">استورد المحدد</button></div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function runFinImport() {
  const n = { plan: 0, debts: 0, project: 0, rights: 0 };
  for (const box of $('libForm').querySelectorAll('[data-imp]')) {
    if (!box.checked) continue;
    const f = finFound[+box.dataset.imp];
    if (f.type === 'plan') { S.finPlans.push(normalizeFinPlan(f.data.plan)); n.plan++; }
    if (f.type === 'project') { S.finProjects.push(normalizeFinProject(f.data)); n.project++; }
    if (f.type === 'debts') for (const d of f.data) if (!S.finDebts.some((x) => x.name === d.name)) { S.finDebts.push(normalizeDebt(d)); n.debts++; }
  }
  if ($('impRights') && $('impRights').checked) {
    for (const f of finFound.filter((x) => x.type === 'plan')) for (const r of f.data.rights) if (!S.finRights.some((x) => x.name === r.name)) { S.finRights.push(normalizeRight(r)); n.rights++; }
  }
  save();
  toast(`استُورد: ${[n.plan && `${n.plan} خطة`, n.debts && `${n.debts} دَين`, n.rights && `${n.rights} حق`, n.project && `${n.project} مشروع`].filter(Boolean).join('، ') || 'لا شيء'}`);
  finUi.tab = n.plan ? 'plans' : n.debts ? 'debts' : n.project ? 'projects' : finUi.tab;
  return true;
}

// ---------- events ----------
function finScope(scope, sid) { return scope === 'plan' ? getFinPlan(sid) : S.finProjects.find((x) => x.id === sid); }
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'finImport') { const f = el.files && el.files[0]; el.value = ''; if (f) importWorkbook(f); return; }
  if (!el.dataset || !el.dataset.fin) return;
  const obj = finScope(el.dataset.fin, el.dataset.sid);
  if (!obj) return;
  const k = el.dataset.k;
  const val = el.type === 'checkbox' ? el.checked : ['amount', 'balance', 'every', 'goal'].includes(k) ? num(el.value) : el.value;
  if (el.dataset.list) { const r = obj[el.dataset.list].find((x) => x.id === el.dataset.row); if (r) r[k] = k === 'name' ? String(val).trim() : val; }
  else obj[k] = typeof val === 'string' && k !== 'notes' && k !== 'note' ? val.trim() : val;
  obj.updated = Date.now();
  save();
  render();
});
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="fin-"], [data-action^="debt-"], [data-action^="right-"], [data-action^="proj-"], [data-action="lg-pay-del"]');
  if (!el) return;
  const { action, v } = el.dataset;
  const armed = () => {
    if (el.classList.contains('armed')) return true;
    el.classList.add('armed'); const t = el.textContent; el.textContent = 'تأكيد الحذف';
    setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = t; } }, 3000);
    return false;
  };
  switch (action) {
    case 'fin-tab': finUi.tab = v; finUi.plan = ''; finUi.proj = ''; render(); window.scrollTo({ top: 0 }); break;
    case 'fin-open': finUi.tab = 'plans'; finUi.plan = v; render(); window.scrollTo({ top: 0 }); break;
    case 'fin-close': finUi.plan = ''; finUi.proj = ''; render(); break;
    case 'fin-new': {
      const m = today().slice(0, 7);
      const p = normalizeFinPlan({ name: `خطة ${monthName(m)}`, month: m, income: [{ name: 'الراتب', amount: 0 }], fixed: [{ name: '', amount: 0 }], periodic: [], accounts: [] });
      S.finPlans.push(p); save(); finUi.plan = p.id; render();
      break;
    }
    case 'fin-copy': {
      const src = getFinPlan(v);
      const d = parse(`${src.month || today().slice(0, 7)}-01`); d.setMonth(d.getMonth() + 1);
      const m = src.kind === 'month' ? iso(d).slice(0, 7) : '';
      const clone = (l) => l.map((x) => ({ ...x, id: uid() }));
      const p = normalizeFinPlan({ ...src, id: uid(), name: src.kind === 'month' ? `خطة ${monthName(m)}` : `${src.name} (نسخة)`, month: m, income: clone(src.income), fixed: clone(src.fixed), periodic: clone(src.periodic), accounts: clone(src.accounts), created: Date.now() });
      S.finPlans.push(p); save(); finUi.tab = 'plans'; finUi.plan = p.id; render(); toast('أُنشئت نسخة، عدّل ما تغيّر');
      break;
    }
    case 'fin-kind': { const p = getFinPlan(finUi.plan); p.kind = v; if (v === 'month' && !p.month) p.month = today().slice(0, 7); save(); render(); break; }
    case 'fin-active': S.settings.finActive = v; save(); render(); toast('صارت خطتك الحالية'); break;
    case 'fin-del': if (!armed()) break; S.finPlans = S.finPlans.filter((p) => p.id !== v); if (S.settings.finActive === v) S.settings.finActive = ''; finUi.plan = ''; save(); render(); toast('حُذفت الخطة'); break;
    case 'fin-row-add': {
      const obj = finScope(el.dataset.scope, el.dataset.sid);
      const L = el.dataset.list;
      const r = row({ name: '', amount: 0, ...(L === 'periodic' ? { every: 12 } : {}), ...(L === 'accounts' ? { balance: 0 } : {}), ...(L === 'items' ? { done: false } : {}) });
      obj[L].push(r); save(); render();
      const inp = $(`f-${L}-${r.id}-name`); if (inp) inp.focus();
      break;
    }
    case 'fin-row-del': { const obj = finScope(el.dataset.scope, el.dataset.sid); obj[el.dataset.list] = obj[el.dataset.list].filter((x) => x.id !== v); save(); render(); break; }
    case 'fin-month': finUi.month = v; render(); break;
    case 'fin-txkind': finUi.txKind = v; for (const b of $('txKind').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'fin-tx-del': S.finTx = S.finTx.filter((t) => t.id !== v); save(); render(); break;
    case 'debt-new': openLedger('debt', null); break;
    case 'debt-open': openLedger('debt', v); break;
    case 'debt-pay': openPayment('debt', v); break;
    case 'right-new': openLedger('right', null); break;
    case 'right-open': openLedger('right', v); break;
    case 'right-pay': openPayment('right', v); break;
    case 'lg-pay-del': {
      const x = (ldraft.kind === 'debt' ? S.finDebts : S.finRights).find((d) => d.id === ldraft.id);
      x.payments = x.payments.filter((p) => p.id !== v); save(); openLedger(ldraft.kind, x.id); render();
      break;
    }
    case 'proj-new': { const p = normalizeFinProject({ name: 'مشروع جديد', items: [{ name: '', amount: 0 }], funding: [] }); S.finProjects.push(p); save(); finUi.proj = p.id; render(); break; }
    case 'proj-open': finUi.proj = v; render(); window.scrollTo({ top: 0 }); break;
    case 'proj-del': if (!armed()) break; S.finProjects = S.finProjects.filter((p) => p.id !== v); finUi.proj = ''; save(); render(); break;
  }
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'finTxForm') return;
  e.preventDefault();
  const amount = num($('txAmount').value);
  if (!amount) { $('txAmount').focus(); toast('اكتب المبلغ.'); return; }
  S.finTx.push(normalizeTx({ amount, kind: finUi.txKind || 'out', item: $('txItem').value.trim(), note: $('txNote').value.trim(), d: $('txDate').value || today() }));
  save();
  render();
  $('txAmount').focus();
  toast('سُجّل');
});

Object.assign(LibraryViews, { finance: viewFinance });
