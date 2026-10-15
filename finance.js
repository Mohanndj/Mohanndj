'use strict';
// «المالية»: personal finance laid out like the user's own workbook («الخطة الشخصية المالية»):
// budget plans (a month or a «what if» scenario) with income, fixed monthly expenses, periodic
// expenses spread per month, and what is left for savings and emergency accounts; actual spending
// against the plan; debts I owe; «الديون والحقوق»: what I borrowed, what I owe without a loan, and what is owed to me; cost projects (like a wedding).
// The workbook can be imported straight from the phone; nothing is sent anywhere.

const finUi = { tab: 'plans', plan: '', proj: '', month: '', lg: 'debt' };
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
  // dir 'in': «حقوقي», money others owe me. dir 'out': «الحقوق», what I owe others that was not a loan.
  return { id: d.id || uid(), dir: d.dir === 'out' ? 'out' : 'in', name: String(d.name || ''), amount: num(d.amount), note: String(d.note || ''), date: d.date || '', payments: payments(d.payments), created: d.created || Date.now() };
}
// the three ledgers: «الديون» what I borrowed, «الحقوق» what I owe without a loan, «حقوقي» what is owed to me
const LEDGERS = {
  debt: { title: 'الديون', one: 'دَين', hint: 'ما استدنته: الدائن، والمبلغ، والقسط الشهري.', list: () => S.finDebts },
  owe: { title: 'الحقوق', one: 'حق عليّ', hint: 'ما عليّ لغيري ولم يكن ديناً: أمانة، أو أجرة، أو نصيب، أو التزام.', list: () => S.finRights.filter((r) => r.dir === 'out') },
  right: { title: 'حقوقي', one: 'حق لي', hint: 'ما لي عند غيري.', list: () => S.finRights.filter((r) => r.dir !== 'out') },
};
const lgLeft = (kind) => (kind === 'debt' ? debtLeft : rightLeft);
const lgTotal = (kind) => sum(LEDGERS[kind].list(), lgLeft(kind));
function normalizeFinProject(p) {
  return { id: p.id || uid(), name: String(p.name || 'مشروع'), items: (p.items || []).map((x) => row({ ...x, done: !!x.done })), funding: (p.funding || []).map(row), paidFrom: p.paidFrom === 'funding' ? 'funding' : 'outside', note: String(p.note || ''), created: p.created || Date.now() };
}
// what is bought no longer needs money: the need is what is left to buy. If the purchases were paid
// out of the project's funding sources, that money is gone from what is available too.
function projCalc(p) {
  const cost = sum(p.items), bought = sum(p.items.filter((x) => x.done)), fund = sum(p.funding);
  const left = cost - bought;
  const avail = p.paidFrom === 'funding' ? fund - bought : fund;
  return { cost, bought, left, fund, avail, gap: avail - left, pct: cost ? Math.round((bought / cost) * 100) : 0 };
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
    <div class="fin-legend"><span><i class="fx"></i>الثابتة ${money(c.fixed)}</span><span><i class="pd"></i>الدورية ${money(c.periodic)}</span><span><i class="${c.left >= 0 ? 'sv' : 'neg'}"></i>${c.left >= 0 ? 'المتبقي للادخار' : 'العجز'} ${money(Math.abs(c.left))}</span></div>`;
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
  const tabs = [['plans', 'الخطط'], ['spend', 'المصروف'], ['bills', 'الاشتراكات والفواتير'], ['ledger', 'الديون والحقوق'], ['projects', 'المشاريع'], ['later', 'الشراء المؤجّل']];
  const ap = activePlan();
  const c = ap ? planCalc(ap) : null;
  if (finUi.tab === 'debts' || finUi.tab === 'rights') { finUi.lg = finUi.tab === 'debts' ? 'debt' : 'right'; finUi.tab = 'ledger'; }
  const mini = Object.keys(LEDGERS).filter((k) => lgTotal(k));
  const body = ({ plans: finPlansHTML, spend: finSpendHTML, bills: finBillsHTML, ledger: finLedgerHTML, projects: finProjectsHTML, later: finLaterHTML }[finUi.tab] || finPlansHTML)();
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>المالية</h2><div class="btn-row">${S.finPlans.length || S.finDebts.length || S.finRights.length || S.finProjects.length || S.subs.length || S.later.length || S.finTx.length ? `<button type="button" class="xls-btn" data-action="fin-export">${icon('sheet')}تصدير إكسل</button>` : ''}<label class="xls-btn fin-import">${icon('sheet')}استيراد إكسل<input type="file" id="finImport" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div></div>
    ${c ? `<button type="button" class="fin-top" data-action="fin-open" data-v="${ap.id}">
      <small>${esc(ap.name)}${ap.month ? ` · ${esc(monthName(ap.month))}` : ''}</small>
      <div class="fin-tiles"><span><b>${money(c.income)}</b>الدخل</span><span><b>${money(c.fixed + c.periodic)}</b>المصاريف</span><span class="${c.left < 0 ? 'neg' : 'pos'}"><b>${money(c.left)}</b>${c.left < 0 ? 'عجز' : 'للادخار'}</span></div>
    </button>` : ''}
    ${mini.length ? `<div class="fin-mini">${mini.map((k) => `<button type="button" data-action="fin-lg" data-v="${k}">${{ debt: 'عليّ ديون', owe: 'عليّ حقوق', right: 'لي عند غيري' }[k]}: <b>${money(lgTotal(k))}</b></button>`).join('')}</div>` : ''}
    <div class="seg seg-wrap" role="group" aria-label="الأقسام">${tabs.map(([v, l]) => `<button type="button" data-action="fin-tab" data-v="${v}" aria-pressed="${finUi.tab === v}">${l}</button>`).join('')}</div>
  </section>
  ${body}`;
}

// --- plans
const planTitle = (p) => (p.kind === 'month' ? (p.month ? monthName(p.month) : 'شهر غير محدد') : p.name);
function finPlansHTML() {
  if (finUi.plan && getFinPlan(finUi.plan)) return planDetailHTML(getFinPlan(finUi.plan));
  const ap = activePlan();
  const titled = S.finPlans.filter((p) => p.kind !== 'month').sort((a, b) => a.created - b.created);
  const months = S.finPlans.filter((p) => p.kind === 'month').sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const mini = (c) => `<span class="fin-hnum ${c.left < 0 ? 'neg' : 'pos'}">${c.left < 0 ? 'عجز' : 'للادخار'} <b>${money(Math.abs(c.left))}</b></span>`;
  return `<section class="section">
    <div class="section-head"><h2>الخطط المعنونة</h2>${addBtn('fin-new-titled', 'خطة معنونة')}</div>
    <p class="note-text">خطط تسمّيها بما تشاء: لفترة زمنية («بعد سداد القرض»، «عام ٢٠٢٧») أو لما تتصوره («على فرض الزواج»). اضغط أي خطة لترى تفاصيلها، وانقلها إلى أي شهر.</p>
    <div class="fin-hscroll" role="list">
      ${titled.map((p) => { const c = planCalc(p); return `<button type="button" role="listitem" class="fin-hcard${ap && p.id === ap.id ? ' active' : ''}" data-action="fin-open" data-v="${p.id}">
        <b>${esc(p.name)}</b>
        <span class="fin-hrow"><small>الدخل</small><span>${money(c.income)}</span></span>
        <span class="fin-hrow"><small>المصاريف</small><span>${money(c.fixed + c.periodic)}</span></span>
        ${mini(c)}
        <span class="fin-split sm">${[['fx', c.fixed], ['pd', c.periodic], ['sv', c.left]].map(([k, v]) => (v > 0 ? `<i class="${k}" style="width:${(v / Math.max(c.income, c.fixed + c.periodic, 1)) * 100}%"></i>` : '')).join('')}</span>
      </button>`; }).join('')}
      <button type="button" role="listitem" class="fin-hcard add" data-action="fin-new-titled">${icon('plus')}<b>خطة معنونة</b><small>لفترة أو لتصوّر</small></button>
    </div>
  </section>
  <section class="section">
    <div class="section-head"><h2>الخطط الشهرية</h2>${addBtn('fin-new-month', 'خطة شهر')}</div>
    ${months.length ? `<div class="book-list">${months.map((p) => { const c = planCalc(p); return `<button type="button" class="fin-card${ap && p.id === ap.id ? ' active' : ''}" data-action="fin-open" data-v="${p.id}">
      <span class="row-between"><b>${esc(planTitle(p))}</b><small class="fin-kind">${[p.name && !/^خطة /.test(p.name) ? esc(p.name) : '', ap && p.id === ap.id ? 'الحالية' : ''].filter(Boolean).join(' · ')}</small></span>
      ${splitBar(c)}
    </button>`; }).join('')}</div>`
      : emptyHTML('لا خطط شهرية بعد', 'أنشئ خطة لهذا الشهر: فارغة، أو من الشهر السابق، أو انقل إليها إحدى خططك المعنونة.', addBtn('fin-new-month', 'خطة هذا الشهر'))}
  </section>`;
}

function planDetailHTML(p) {
  const c = planCalc(p);
  const isActive = activePlan() && activePlan().id === p.id;
  return `<section class="section fin-plan">
    <div class="crumbs row-between"><button type="button" class="back" data-action="fin-close">${icon('back')} الخطط</button>
      <span class="btn-row">${p.kind === 'month' ? '<button type="button" class="ghost" data-action="fin-pull">انقل إليها خطة معنونة</button>' : '<button type="button" class="ghost" data-action="fin-push">انقلها إلى شهر</button>'}
      <button type="button" class="xls-btn" data-action="fin-xls-plan" data-v="${p.id}">${icon('sheet')}إكسل</button></span></div>
    ${p.kind === 'month' ? `<p class="fin-month-title">${esc(planTitle(p))}</p>` : ''}
    <input type="text" class="fin-title" id="fp-name" data-fin="plan" data-sid="${p.id}" data-k="name" value="${esc(p.name)}" aria-label="اسم الخطة" autocomplete="off">
    <div class="row-between fin-meta">
      <div class="seg" role="group">${[['month', 'خطة شهرية'], ['scenario', 'خطة معنونة']].map(([v, l]) => `<button type="button" data-action="fin-kind" data-v="${v}" aria-pressed="${p.kind === v}">${l}</button>`).join('')}</div>
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
  const isDebt = kind === 'debt', mine = kind === 'right';
  const total = isDebt ? x.total : x.amount;
  const left = isDebt ? debtLeft(x) : rightLeft(x);
  const pct = total ? Math.round(((total - left) / total) * 100) : 0;
  const end = isDebt ? debtEnd(x) : '';
  return `<article class="fin-card ledger${left ? '' : ' cleared'}">
    <button type="button" class="hz-main" data-action="${kind}-open" data-v="${x.id}">
      <span class="row-between"><b>${esc(x.name)}</b><b class="${left ? (mine ? '' : 'late') : 'ok'}">${left ? money(left) : '✓ انتهى'}</b></span>
      <small>${isDebt ? 'الدَّين' : 'المبلغ'} ${money(total)} · ${mine ? 'المستلم' : 'المسدد'} ${money(total - left)}${!isDebt && x.date ? ` · ${esc(fmtDate(x.date, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}${isDebt && x.monthly ? ` · القسط ${money(x.monthly)}` : ''}${end && left ? ` · ينتهي ${esc(fmtDate(end, { month: 'long', year: 'numeric' }))}` : ''}</small>
      ${x.note ? `<small>${esc(x.note)}</small>` : ''}
    </button>
    <div class="progress-line"><i style="width:${pct}%"></i></div>
    ${left ? `<div class="btn-row"><button type="button" class="ghost" data-action="${kind}-pay" data-v="${x.id}">${mine ? 'استلمت دفعة' : 'سدّدت دفعة'}</button></div>` : ''}
  </article>`;
}
function finLedgerHTML() {
  const kind = LEDGERS[finUi.lg] ? finUi.lg : 'debt';
  const L = LEDGERS[kind], left = lgLeft(kind);
  const list = L.list().slice().sort((a, b) => !left(a) - !left(b) || left(b) - left(a));
  const xls = { debt: 'debts', owe: 'owes', right: 'rights' }[kind];
  return `<section class="section">
    <div class="seg lg-seg" role="group" aria-label="الديون والحقوق">${Object.entries(LEDGERS).map(([k, l]) => `<button type="button" data-action="fin-lg" data-v="${k}" aria-pressed="${k === kind}">${l.title}${lgTotal(k) ? ` <small class="num">${money(lgTotal(k))}</small>` : ''}</button>`).join('')}</div>
    <div class="section-head"><h2>${L.title} <small class="num">${money(lgTotal(kind))}</small></h2><div class="btn-row">${list.length ? `<button type="button" class="xls-btn" data-action="fin-xls-one" data-v="${xls}">${icon('sheet')}إكسل</button>` : ''}${addBtn(`${kind}-new`, L.one)}</div></div>
    <p class="note-text">${L.hint}</p>
    ${list.length ? `<div class="book-list">${list.map((x) => ledgerCard(x, kind)).join('')}</div>` : emptyHTML(`لا شيء في «${L.title}»`, kind === 'debt' ? 'سجّل كل دَين، وسجّل كل دفعة تسددها لترى الباقي ومتى ينتهي.' : kind === 'owe' ? 'سجّل لمن عليك الحق ومبلغه، وسجّل ما تؤديه منه حتى يبرأ.' : 'سجّل عند من لك المال ومتى، وسجّل ما يرده لك.')}
  </section>`;
}

// --- cost projects
function finProjectsHTML() {
  const p = finUi.proj && S.finProjects.find((x) => x.id === finUi.proj);
  if (p) {
    const c = projCalc(p);
    return `<section class="section fin-plan">
      <div class="crumbs"><button type="button" class="back" data-action="fin-close">${icon('back')} المشاريع</button></div>
      <input type="text" class="fin-title" id="fj-name" data-fin="proj" data-sid="${p.id}" data-k="name" value="${esc(p.name)}" aria-label="اسم المشروع" autocomplete="off">
      <div class="fin-tiles"><span><b>${money(c.left)}</b>المتبقي شراؤه</span><span><b>${money(c.avail)}</b>المتوفر</span><span class="${c.gap < 0 ? 'neg' : 'pos'}"><b>${c.gap ? money(Math.abs(c.gap)) : '✓'}</b>${c.gap < 0 ? 'ينقصك' : c.gap > 0 ? 'يفيض' : 'مغطّى تماماً'}</span></div>
      ${c.cost ? `<p class="note-text">التكلفة كاملة ${money(c.cost)}، اشتريت منها ما قيمته ${money(c.bought)} (${c.pct}٪)${c.bought ? '، فخُصم من الاحتياج' : ''}.</p>
      <div class="progress-line"><i style="width:${c.pct}%"></i></div>` : ''}
      ${c.bought ? `<div class="field"><b class="note-text">ما اشتريته دفعت ثمنه من:</b><div class="seg" role="group">
        <button type="button" data-action="proj-paid" data-sid="${p.id}" data-v="outside" aria-pressed="${p.paidFrom === 'outside'}">خارج مصادر التمويل</button>
        <button type="button" data-action="proj-paid" data-sid="${p.id}" data-v="funding" aria-pressed="${p.paidFrom === 'funding'}">مصادر التمويل المذكورة</button></div>
        <small class="note-text">${p.paidFrom === 'funding' ? 'خُصم ثمن ما اشتريته من المتوفر أيضاً، لأنه دُفع منه.' : 'المتوفر باقٍ كما هو، لأنك دفعت من مال آخر.'}</small></div>` : ''}
      <div class="panel"><h3>البنود</h3>${rowsHTML('proj', p.id, 'items', [{ k: 'name', ph: 'البند' }, { k: 'amount', ph: 'المبلغ', num: true }, { k: 'done' }], p.items)}</div>
      <div class="panel"><h3>مصادر التمويل</h3>${rowsHTML('proj', p.id, 'funding', [{ k: 'name', ph: 'المصدر' }, { k: 'amount', ph: 'المبلغ', num: true }], p.funding, { addLabel: 'مصدر' })}</div>
      <div class="panel"><h3>ملاحظات</h3><textarea id="fj-note" data-fin="proj" data-sid="${p.id}" data-k="note" rows="3">${esc(p.note)}</textarea></div>
      <div class="btn-row"><button type="button" class="danger" data-action="proj-del" data-v="${p.id}">حذف المشروع</button></div>
    </section>`;
  }
  return `<section class="section">
    <div class="section-head"><h2>المشاريع المالية</h2>${addBtn('proj-new', 'مشروع')}</div>
    <p class="note-text">لكل مشروع كبير (زواج، سفر، تأثيث، سيارة) بنوده وتكلفتها، ومصادر تمويله، وكم ينقصك.</p>
    ${S.finProjects.length ? `<div class="book-list">${S.finProjects.map((x) => { const c = projCalc(x); return `<button type="button" class="fin-card" data-action="proj-open" data-v="${x.id}">
      <span class="row-between"><b>${esc(x.name)}</b><b class="${c.gap < 0 ? 'late' : 'ok'}">${c.gap < 0 ? `ينقص ${money(-c.gap)}` : c.cost && !c.left ? 'اكتمل ✓' : 'مغطّى'}</b></span>
      <small>${plural(x.items.length, 'بند واحد', 'بندان', 'بنود', 'بنداً')} · المتبقي شراؤه ${money(c.left)} · المتوفر ${money(c.avail)}${c.bought ? ` · اشتريت ${c.pct}٪` : ''}</small>
      <div class="progress-line"><i style="width:${c.cost ? Math.min(100, Math.round(((c.bought + Math.max(0, c.avail)) / c.cost) * 100)) : 0}%"></i></div>
    </button>`; }).join('')}</div>` : emptyHTML('لا مشاريع', 'أنشئ مشروعاً وأضف بنوده ومصادر تمويله.')}
  </section>`;
}

// ---------- ledger editor (debts and rights) ----------
function openLedger(kind, id) {
  const isDebt = kind === 'debt', mine = kind === 'right';
  const list = isDebt ? S.finDebts : S.finRights;
  const x = id ? list.find((d) => d.id === id) : (isDebt ? normalizeDebt({}) : normalizeRight({ dir: mine ? 'in' : 'out' }));
  ldraft = { kind, id: x.id, isNew: !id };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? esc(x.name) : isDebt ? 'دَين جديد' : mine ? 'حق لي عند غيري' : 'حق عليّ لغيري'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>${isDebt ? 'اسم الدائن' : mine ? 'عند من؟' : 'لمن؟'}</span><input type="text" id="lgName" value="${esc(x.name)}" autocomplete="off"></label>
    <div class="grid2">
      <label class="field"><span>${isDebt ? 'مبلغ الدَّين' : 'المبلغ'}</span><input type="text" inputmode="decimal" class="num-in" id="lgTotal" value="${(isDebt ? x.total : x.amount) || ''}" data-novoice></label>
      ${isDebt ? `<label class="field"><span>القسط الشهري</span><input type="text" inputmode="decimal" class="num-in" id="lgMonthly" value="${x.monthly || ''}" data-novoice></label>`
        : `<label class="field"><span>التاريخ</span><input type="date" id="lgDate" value="${x.date}"></label>`}
    </div>
    ${isDebt ? `<label class="field"><span>تاريخ الانتهاء المتوقع (اختياري)</span><input type="date" id="lgEnd" value="${x.end}"><small class="hint">إن تركته فارغاً يُحسب من القسط الشهري</small></label>` : ''}
    <label class="field"><span>ملاحظة</span><input type="text" id="lgNote" value="${esc(x.note)}" autocomplete="off"></label>
    ${id && x.payments.length ? `<div class="field"><span>${mine ? 'الدفعات المستلمة' : 'الدفعات المسددة'}</span><ul class="ppl-hist">${x.payments.slice().sort((a, b) => b.d.localeCompare(a.d)).map((p) => `<li><span>${money(p.amount)} · ${esc(dateBoth(p.d, true))}${p.note ? ` · ${esc(p.note)}` : ''}</span><button type="button" class="j-m-del" data-action="lg-pay-del" data-v="${p.id}" aria-label="حذف">✕</button></li>`).join('')}</ul></div>` : ''}
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
    : normalizeRight({ ...(old || {}), dir: ldraft.kind === 'owe' ? 'out' : 'in', id: ldraft.id, name, amount: num($('lgTotal').value), date: $('lgDate').value, note: $('lgNote').value.trim() });
  if (old) Object.assign(old, x); else list.push(x);
  save();
  return true;
}
function openPayment(kind, id) {
  const isDebt = kind === 'debt', mine = kind === 'right';
  const x = (isDebt ? S.finDebts : S.finRights).find((d) => d.id === id);
  ldraft = { kind: 'pay', id, isNew: true, of: kind };
  const left = isDebt ? debtLeft(x) : rightLeft(x);
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${mine ? 'دفعة من ' : 'دفعة لـ'}${esc(x.name)}</h2>
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
  toast(left ? `سُجّلت. الباقي ${money(left)}` : isDebt ? `🎉 سددت دَين ${x.name} كاملاً!` : ldraft.of === 'owe' ? `🎉 أدّيت حق ${x.name} كاملاً` : `استلمت حقك من ${x.name} كاملاً`);
  return true;
}

// ---------- import from the user's workbook ----------
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number';
function findCell(sh, test) { for (const [k, v] of sh.cells) if (isStr(v) && test(v)) { const [r, c] = k.split(',').map(Number); return [r, c]; } return null; }
const numRight = (sh, r, c) => { for (let k = 1; k <= 4; k++) { const v = sh.get(r, c + k); if (isNum(v)) return v; } return 0; };

// «راتب شهر ١٠» → a month plan for October (this year); any other sheet name → a titled plan
function sheetMonth(name) {
  const m = /^(?:راتب|خطة|مصاريف)?\s*شهر\s*([0-9٠-٩]{1,2})$/.exec(name.trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const n = m ? Number(m[1]) : 0;
  if (!n || n > 12) return { kind: 'scenario' };
  return { kind: 'month', month: `${today().slice(0, 4)}-${String(n).padStart(2, '0')}` };
}
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
    plan: { name: sh.name, ...sheetMonth(sh.name), income, fixed, periodic, accounts, notes: [...new Set(notes)].join('\n') },
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
    ${rights.length ? `<label class="switch"><input type="checkbox" id="impRights" checked><span><b>حقوقي (ما لي عند غيري)</b><small>${plural(rights.length, 'اسم واحد', 'اسمان', 'أسماء', 'اسماً')} · ${money(sum(rights))} (تتكرر في كل صفحة فتُستورد مرة واحدة)</small></span></label>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">استورد المحدد</button></div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function runFinImport() {
  const n = { plan: 0, debts: 0, project: 0, rights: 0 };
  for (const box of $('libForm').querySelectorAll('[data-imp]')) {
    if (!box.checked) continue;
    const f = finFound[+box.dataset.imp];
    if (f.type === 'plan') {
      const pl = normalizeFinPlan(f.data.plan);
      if (pl.kind === 'month' && monthPlan(pl.month)) { pl.kind = 'scenario'; pl.month = ''; }
      S.finPlans.push(pl); n.plan++;
    }
    if (f.type === 'project') { S.finProjects.push(normalizeFinProject(f.data)); n.project++; }
    if (f.type === 'debts') for (const d of f.data) if (!S.finDebts.some((x) => x.name === d.name)) { S.finDebts.push(normalizeDebt(d)); n.debts++; }
  }
  if ($('impRights') && $('impRights').checked) {
    for (const f of finFound.filter((x) => x.type === 'plan')) for (const r of f.data.rights) if (!S.finRights.some((x) => x.name === r.name)) { S.finRights.push(normalizeRight(r)); n.rights++; }
  }
  save();
  toast(`استُورد: ${[n.plan && `${n.plan} خطة`, n.debts && `${n.debts} دَين`, n.rights && `${n.rights} حق`, n.project && `${n.project} مشروع`].filter(Boolean).join('، ') || 'لا شيء'}`);
  if (!n.plan && (n.debts || n.rights)) finUi.lg = n.debts ? 'debt' : 'right';
  finUi.tab = n.plan ? 'plans' : n.debts || n.rights ? 'ledger' : n.project ? 'projects' : finUi.tab;
  return true;
}

// ---------- new plans and moving plans into months ----------
const cloneRows = (l) => l.map((x) => ({ ...x, id: uid() }));
function applyPlan(target, src, mode) {
  for (const k of ['income', 'fixed', 'periodic', 'accounts']) {
    if (mode === 'replace') target[k] = cloneRows(src[k]);
    else for (const x of src[k]) if (!target[k].some((y) => y.name && y.name === x.name)) target[k].push({ ...x, id: uid() });
  }
  if (mode === 'replace' || !target.goal) target.goal = src.goal;
  target.updated = Date.now();
}
const monthPlan = (m) => S.finPlans.find((p) => p.kind === 'month' && p.month === m);
function nextFreeMonth() {
  let d = parse(`${today().slice(0, 7)}-01`);
  for (let i = 0; i < 24; i++) { const m = iso(d).slice(0, 7); if (!monthPlan(m)) return m; d.setMonth(d.getMonth() + 1); }
  return today().slice(0, 7);
}
const sheetHead = (t) => `<div class="sheet-head"><h2>${t}</h2><button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
const showLib = () => { const d = lsheet(); if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); };
const planOptions = (list, sel) => list.map((p) => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.kind === 'month' ? planTitle(p) : p.name)}</option>`).join('');

function openFinNew(kind) {
  const titled = S.finPlans.filter((p) => p.kind !== 'month');
  const months = S.finPlans.filter((p) => p.kind === 'month').sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  ldraft = { kind: 'finnew', id: 'x', isNew: true, pk: kind };
  $('libForm').innerHTML = `${sheetHead(kind === 'month' ? 'خطة شهر جديدة' : 'خطة معنونة جديدة')}
    ${kind === 'month' ? `<label class="field"><span>الشهر</span><input type="month" id="fnMonth" value="${nextFreeMonth()}"></label>`
      : `<label class="field"><span>عنوان الخطة</span><input type="text" id="fnName" autocomplete="off" placeholder="مثال: بعد سداد القرض العقاري، على فرض الزواج"></label>`}
    <div class="field"><span>ابدأ من</span><select id="fnFrom">
      <option value="">خطة فارغة</option>
      ${months.length ? `<optgroup label="الخطط الشهرية">${planOptions(months, kind === 'month' ? months[0].id : '')}</optgroup>` : ''}
      ${titled.length ? `<optgroup label="الخطط المعنونة">${planOptions(titled)}</optgroup>` : ''}
    </select><small class="hint">تُنسخ بنودها (الدخل والمصاريف والحسابات) فتعدّل ما تغيّر فقط.</small></div>
    <div class="sheet-actions"><button type="submit" class="primary">أنشئ الخطة</button></div>`;
  showLib();
}
function saveFinNew() {
  const kind = ldraft.pk;
  const src = getFinPlan($('fnFrom').value);
  let p;
  if (kind === 'month') {
    const m = $('fnMonth').value || today().slice(0, 7);
    if (monthPlan(m)) { toast(`لديك خطة لـ${monthName(m)} من قبل، افتحها أو انقل إليها خطة.`); return false; }
    p = normalizeFinPlan({ kind: 'month', month: m, name: `خطة ${monthName(m)}`, income: [{ name: 'الراتب', amount: 0 }], fixed: [], periodic: [], accounts: [] });
  } else {
    const name = $('fnName').value.trim();
    if (!name) { toast('اكتب عنوان الخطة.'); return false; }
    p = normalizeFinPlan({ kind: 'scenario', name, income: [{ name: 'الراتب', amount: 0 }], fixed: [], periodic: [], accounts: [] });
  }
  if (src) { applyPlan(p, src, 'replace'); p.notes = src.notes; }
  S.finPlans.push(p);
  save();
  finUi.tab = 'plans'; finUi.plan = p.id;
  return true;
}

// pull: a titled plan into this month · push: this titled plan into a month
function openFinMove(dir) {
  const p = getFinPlan(finUi.plan);
  ldraft = { kind: 'finmove', id: p.id, isNew: true, dir };
  const titled = S.finPlans.filter((x) => x.kind !== 'month');
  if (dir === 'pull' && !titled.length) { toast('لا خطط معنونة بعد. أنشئ واحدة من صفحة الخطط.'); return; }
  $('libForm').innerHTML = `${sheetHead(dir === 'pull' ? `انقل خطة معنونة إلى ${esc(planTitle(p))}` : `انقل «${esc(p.name)}» إلى شهر`)}
    ${dir === 'pull' ? `<label class="field"><span>الخطة المعنونة</span><select id="fmSrc">${planOptions(titled)}</select></label>`
      : `<label class="field"><span>الشهر</span><input type="month" id="fmMonth" value="${nextFreeMonth()}"></label><p class="note-text" id="fmHint"></p>`}
    <div class="field" id="fmModeW"><span>إذا كان في الشهر بنود</span><div class="seg" id="fmMode" role="group">
      <button type="button" data-action="fin-mode" data-v="replace" aria-pressed="true">استبدلها ببنود الخطة</button>
      <button type="button" data-action="fin-mode" data-v="add" aria-pressed="false">أضف البنود الناقصة فقط</button>
    </div></div>
    <div class="sheet-actions"><button type="submit" class="primary">انقل</button></div>`;
  ldraft.mode = 'replace';
  showLib();
  updateMoveHint();
}
function updateMoveHint() {
  if (!ldraft || ldraft.kind !== 'finmove' || ldraft.dir !== 'push') return;
  const m = $('fmMonth').value;
  const ex = monthPlan(m);
  $('fmHint').textContent = ex ? `لديك خطة لـ${monthName(m)}، ستُحدَّث.` : `ستُنشأ خطة جديدة لـ${monthName(m)}.`;
  $('fmModeW').hidden = !ex;
}
function saveFinMove() {
  const p = getFinPlan(ldraft.id);
  if (ldraft.dir === 'pull') {
    const src = getFinPlan($('fmSrc').value);
    applyPlan(p, src, ldraft.mode);
    save();
    toast(`نُقلت «${src.name}» إلى ${planTitle(p)}`);
    return true;
  }
  const m = $('fmMonth').value;
  if (!m) { toast('اختر الشهر.'); return false; }
  let target = monthPlan(m);
  if (!target) { target = normalizeFinPlan({ kind: 'month', month: m, name: `خطة ${monthName(m)}`, income: [], fixed: [], periodic: [], accounts: [] }); S.finPlans.push(target); applyPlan(target, p, 'replace'); }
  else applyPlan(target, p, ldraft.mode);
  save();
  finUi.plan = target.id;
  toast(`نُقلت إلى ${monthName(m)}`);
  return true;
}

// ---------- elegant Excel ----------
function planSheet(p) {
  const c = planCalc(p);
  const R = [];
  const add = (row) => { R.push(row); return R.length; };
  const blank = () => add([]);
  add([{ v: p.kind === 'month' ? planTitle(p) : p.name, s: 'title', span: 4 }]);
  add([{ v: `${p.kind === 'month' ? (p.name && !/^خطة /.test(p.name) ? p.name : 'خطة شهرية') : 'خطة معنونة'} · صُدّرت ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })} · المبالغ بالـ${S.settings.currency || 'ريال'}`, s: 'sub', span: 4 }]);
  blank();
  const sumHead = add([{ v: 'الدخل', s: 'head' }, { v: 'المصاريف', s: 'head' }, { v: 'المتبقي للادخار', s: 'head' }, { v: 'نسبة الادخار', s: 'head' }]);
  const sumRow = add([null, null, null, null]); // filled once the totals' cells are known
  blank();
  const twoCol = (title, h1, h2, list, key) => {
    add([{ v: title, s: 'sec', span: 4 }]);
    add([{ v: h1, s: 'head', span: 2 }, { v: h2, s: 'head', span: 2 }]);
    const first = R.length + 1;
    for (const x of list.filter((y) => y.name || y[key])) add([{ v: x.name, s: 'txt', span: 2 }, { v: x[key] || 0, s: 'num', span: 2 }]);
    const last = R.length;
    const tot = add([{ v: 'المجموع', s: 'tot', span: 2 }, { f: last >= first ? `SUM(C${first}:C${last})` : '0', v: sum(list, (x) => x[key]), s: 'totnum', span: 2 }]);
    blank();
    return `C${tot}`;
  };
  const inc = twoCol('الدخل', 'البند', 'المبلغ', p.income, 'amount');
  const fix = twoCol('١- المصاريف الشهرية الثابتة', 'البند', 'المبلغ', p.fixed, 'amount');
  add([{ v: '٢- المصاريف الدورية', s: 'sec', span: 4 }]);
  add([{ v: 'البند', s: 'head' }, { v: 'كل كم شهر', s: 'head' }, { v: 'المبلغ', s: 'head' }, { v: 'المخصص الشهري', s: 'head' }]);
  const pf = R.length + 1;
  for (const x of p.periodic.filter((y) => y.name || y.amount)) { const r = R.length + 1; add([{ v: x.name, s: 'txt' }, { v: x.every || 12, s: 'num' }, { v: x.amount || 0, s: 'num' }, { f: `IFERROR(C${r}/B${r},0)`, v: (x.amount || 0) / (x.every || 12), s: 'num' }]); }
  const pl = R.length;
  const per = add([{ v: 'المخصص الشهري للمصاريف الدورية', s: 'tot', span: 3 }, { f: pl >= pf ? `SUM(D${pf}:D${pl})` : '0', v: c.periodic, s: 'totnum' }]);
  add([{ v: 'مخصصها السنوي', s: 'tot', span: 3 }, { f: `D${per}*12`, v: c.periodicYear, s: 'totnum' }]);
  blank();
  add([{ v: '٣- الادخار وسيولة الطوارئ', s: 'sec', span: 4 }]);
  const left = add([{ v: 'المتبقي للادخار', s: 'tot', span: 2 }, { f: `${inc}-${fix}-D${per}`, v: c.left, s: c.left < 0 ? 'bad' : 'good', span: 2 }]);
  if (p.goal) {
    const g = add([{ v: 'هدف الادخار', s: 'txt', span: 2 }, { v: p.goal, s: 'num', span: 2 }]);
    add([{ v: 'عدد الأشهر لبلوغ الهدف', s: 'txt', span: 2 }, { f: `IFERROR(ROUNDUP(C${g}/C${left},0),"")`, v: c.left > 0 ? Math.ceil(p.goal / c.left) : '', s: 'num', span: 2 }]);
  }
  blank();
  if (p.accounts.length) twoCol('الحسابات (الرصيد المتوفر)', 'الحساب', 'الرصيد', p.accounts, 'balance');
  if (p.notes.trim()) { add([{ v: 'ملاحظات', s: 'sec', span: 4 }]); add([{ v: p.notes.trim(), s: 'note', span: 4 }]); }
  R[sumRow - 1] = [{ f: inc, v: c.income, s: 'big' }, { f: `${fix}+D${per}`, v: c.fixed + c.periodic, s: 'big' }, { f: `C${left}`, v: c.left, s: c.left < 0 ? 'bad' : 'good' }, { f: `IFERROR(C${left}/${inc},0)`, v: c.income ? c.left / c.income : 0, s: 'pct' }];
  return { name: p.kind === 'month' ? planTitle(p) : p.name, design: true, widths: [34, 16, 18, 18], rows: R };
}
function ledgerSheet(kind) {
  const isDebt = kind === 'debts', mine = kind === 'rights';
  const lk = { debts: 'debt', owes: 'owe', rights: 'right' }[kind];
  const list = LEDGERS[lk].list();
  const R = [[{ v: LEDGERS[lk].title, s: 'title', span: 8 }], [{ v: `${{ debts: 'ما استدنته', owes: 'ما عليّ لغيري ولم يكن ديناً', rights: 'ما لي عند غيري' }[kind]} · صُدّرت ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 8 }], []];
  R.push([isDebt ? 'الدائن' : mine ? 'عند' : 'لمن', isDebt ? 'الدَّين' : 'المبلغ', mine ? 'المستلم' : 'المسدد', 'الباقي', isDebt ? 'القسط الشهري' : 'التاريخ', isDebt ? 'الانتهاء المتوقع' : '', 'النسبة', 'ملاحظة'].map((v) => ({ v, s: 'head' })));
  const first = R.length + 1;
  for (const x of list) {
    const r = R.length + 1;
    const total = isDebt ? x.total : x.amount;
    R.push([{ v: x.name, s: 'txt' }, { v: total, s: 'num' }, { v: paid(x), s: 'num' }, { f: `B${r}-C${r}`, v: total - paid(x), s: 'num' }, isDebt ? { v: x.monthly || '', s: 'num' } : { v: x.date ? fmtDate(x.date, { day: 'numeric', month: 'short', year: 'numeric' }) : '', s: 'txt' },
      { v: isDebt && debtEnd(x) && debtLeft(x) ? fmtDate(debtEnd(x), { month: 'long', year: 'numeric' }) : '', s: 'txt' }, { f: `IFERROR(C${r}/B${r},0)`, v: total ? paid(x) / total : 0, s: 'pct' }, { v: x.note, s: 'txt' }]);
  }
  const last = R.length;
  const tot = (col, v) => ({ f: last >= first ? `SUM(${col}${first}:${col}${last})` : '0', v, s: 'totnum' });
  R.push([{ v: 'المجموع', s: 'tot' }, tot('B', sum(list, (x) => (isDebt ? x.total : x.amount))), tot('C', sum(list, paid)), tot('D', sum(list, isDebt ? debtLeft : rightLeft)), { v: '', s: 'tot' }, { v: '', s: 'tot' }, { v: '', s: 'tot' }, { v: '', s: 'tot' }]);
  const pays = list.flatMap((x) => x.payments.map((p) => ({ ...p, who: x.name }))).sort((a, b) => a.d.localeCompare(b.d));
  if (pays.length) {
    R.push([], [{ v: mine ? 'سجل الدفعات المستلمة' : 'سجل الدفعات المسددة', s: 'sec', span: 8 }], ['التاريخ', isDebt ? 'الدائن' : mine ? 'من' : 'لمن', 'المبلغ', 'ملاحظة'].map((v, i) => ({ v, s: 'head', span: i === 3 ? 5 : 1 })));
    for (const p of pays) R.push([{ v: fmtDate(p.d, { day: 'numeric', month: 'short', year: 'numeric' }), s: 'txt' }, { v: p.who, s: 'txt' }, { v: p.amount, s: 'num' }, { v: p.note, s: 'txt', span: 5 }]);
  }
  return { name: LEDGERS[lk].title, design: true, widths: [22, 13, 13, 13, 14, 16, 10, 26], rows: R };
}
function projectSheet(p) {
  const { cost, fund, bought, left, avail, gap } = projCalc(p);
  const R = [[{ v: p.name, s: 'title', span: 4 }], [{ v: `مشروع مالي · صُدّر ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 4 }], []];
  R.push(['التكلفة كاملة', 'تم شراؤه', 'المتبقي شراؤه', 'المتوفر'].map((v) => ({ v, s: 'head' })));
  R.push([{ v: cost, s: 'big' }, { v: bought, s: 'big' }, { v: left, s: 'big' }, { v: avail, s: 'big' }]);
  R.push([{ v: gap < 0 ? 'ينقصك' : gap > 0 ? 'يفيض' : 'مغطّى تماماً', s: 'head', span: 2 }, { v: Math.abs(gap), s: gap < 0 ? 'bad' : 'good', span: 2 }], []);
  R.push([{ v: 'البنود', s: 'sec', span: 4 }], [{ v: 'البند', s: 'head', span: 2 }, { v: 'المبلغ', s: 'head' }, { v: 'تم', s: 'head' }]);
  const f = R.length + 1;
  for (const x of p.items) R.push([{ v: x.name, s: 'txt', span: 2 }, { v: x.amount, s: 'num' }, { v: x.done ? '✓' : '', s: 'txt' }]);
  R.push([{ v: 'المجموع', s: 'tot', span: 2 }, { f: `SUM(C${f}:C${R.length})`, v: cost, s: 'totnum' }, { v: '', s: 'tot' }], []);
  if (p.funding.length) {
    R.push([{ v: 'مصادر التمويل', s: 'sec', span: 4 }], [{ v: 'المصدر', s: 'head', span: 2 }, { v: 'المبلغ', s: 'head', span: 2 }]);
    const g = R.length + 1;
    for (const x of p.funding) R.push([{ v: x.name, s: 'txt', span: 2 }, { v: x.amount, s: 'num', span: 2 }]);
    R.push([{ v: 'المجموع', s: 'tot', span: 2 }, { f: `SUM(C${g}:C${R.length})`, v: fund, s: 'totnum', span: 2 }]);
  }
  if (p.note.trim()) R.push([], [{ v: 'ملاحظات', s: 'sec', span: 4 }], [{ v: p.note.trim(), s: 'note', span: 4 }]);
  return { name: p.name, design: true, widths: [30, 12, 16, 12], rows: R };
}
function spendSheet() {
  const txs = S.finTx.slice().sort((a, b) => a.d.localeCompare(b.d));
  const R = [[{ v: 'المصروف', s: 'title', span: 5 }], [{ v: `كل ما سجّلته · صُدّر ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 5 }], [], ['التاريخ', 'النوع', 'البند', 'المبلغ', 'ملاحظة'].map((v) => ({ v, s: 'head' }))];
  const f = R.length + 1;
  for (const t of txs) R.push([{ v: fmtDate(t.d, { day: 'numeric', month: 'short', year: 'numeric' }), s: 'txt' }, { v: t.kind === 'in' ? 'دخل' : 'صرف', s: 'txt' }, { v: t.item, s: 'txt' }, { v: t.kind === 'in' ? t.amount : -t.amount, s: 'num' }, { v: t.note, s: 'txt' }]);
  if (txs.length) R.push([{ v: 'الصافي', s: 'tot', span: 3 }, { f: `SUM(D${f}:D${R.length})`, v: sum(txs, (t) => (t.kind === 'in' ? t.amount : -t.amount)), s: 'totnum' }, { v: '', s: 'tot' }]);
  return { name: 'المصروف', design: true, widths: [16, 9, 22, 14, 28], rows: R };
}
function summarySheet(plans) {
  const R = [[{ v: 'الملخص المالي', s: 'title', span: 6 }], [{ v: `صُدّر ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 6 }], []];
  if (plans.length) {
    R.push([{ v: 'الخطط', s: 'sec', span: 6 }], ['الخطة', 'النوع', 'الدخل', 'المصاريف', 'المتبقي', 'نسبة الادخار'].map((v) => ({ v, s: 'head' })));
    for (const p of plans) { const c = planCalc(p); R.push([{ v: p.kind === 'month' ? planTitle(p) : p.name, s: 'txt' }, { v: p.kind === 'month' ? 'شهرية' : 'معنونة', s: 'txt' }, { v: c.income, s: 'num' }, { v: c.fixed + c.periodic, s: 'num' }, { v: c.left, s: c.left < 0 ? 'bad' : 'good' }, { v: c.income ? c.left / c.income : 0, s: 'pct' }]); }
    R.push([]);
  }
  R.push([{ v: 'الديون والحقوق', s: 'sec', span: 6 }]);
  for (const [k, label, st] of [['debt', 'الباقي من الديون (ما استدنته)', 'bad'], ['owe', 'الباقي من الحقوق (ما عليّ لغيري)', 'bad'], ['right', 'الباقي من حقوقي (ما لي عند غيري)', 'good']]) {
    const l = LEDGERS[k].list();
    R.push([{ v: label, s: 'tot', span: 2 }, { v: lgTotal(k), s: st, span: 2 }, { v: `${l.filter(lgLeft(k)).length} اسم`, s: 'txt', span: 2 }]);
  }
  return { name: 'الملخص', design: true, widths: [30, 12, 15, 15, 15, 13], rows: R };
}
// what: { summary, plans: [ids], debts, rights, projects: [ids], spend }
function finWorkbook(what) {
  const sheets = [];
  const plans = (what.plans || []).map(getFinPlan).filter(Boolean);
  if (what.summary) sheets.push(summarySheet(plans));
  for (const p of plans) sheets.push(planSheet(p));
  if (what.debts) sheets.push(ledgerSheet('debts'));
  if (what.owes) sheets.push(ledgerSheet('owes'));
  if (what.rights) sheets.push(ledgerSheet('rights'));
  for (const id of what.projects || []) { const p = S.finProjects.find((x) => x.id === id); if (p) sheets.push(projectSheet(p)); }
  if (what.subs && S.subs.length) sheets.push(subsSheet());
  if (what.later && S.later.length) sheets.push(laterSheet());
  if (what.spend && S.finTx.length) sheets.push(spendSheet());
  return sheets;
}
function saveWorkbook(sheets, name) {
  if (!sheets.length) { toast('اختر شيئاً لتصديره.'); return false; }
  const url = URL.createObjectURL(Xlsx.build(sheets));
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.xlsx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('جُهّز ملف الإكسل. تجده في التنزيلات.');
  return true;
}
function openFinExport() {
  ldraft = { kind: 'finexp', id: 'x', isNew: true };
  const months = S.finPlans.filter((p) => p.kind === 'month').sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const titled = S.finPlans.filter((p) => p.kind !== 'month');
  const box = (key, label, sub2 = '', on = true) => `<label class="switch"><input type="checkbox" data-exp="${key}"${on ? ' checked' : ''}><span><b>${label}</b>${sub2 ? `<small>${sub2}</small>` : ''}</span></label>`;
  $('libForm').innerHTML = `${sheetHead('تصدير إلى إكسل')}
    <p class="note-text">كل خطة في صفحة مستقلة منسّقة بأقسامها ومجاميعها (بمعادلات تعمل إن عدّلت الأرقام في الإكسل).</p>
    <div class="btn-row"><button type="button" class="ghost" data-action="fin-exp-all" data-v="1">تحديد الكل</button><button type="button" class="ghost" data-action="fin-exp-all" data-v="0">إلغاء التحديد</button></div>
    <div class="fin-exp">
      ${box('summary', 'الملخص المالي', 'الخطط المختارة والديون والحقوق وحقوقي في صفحة واحدة')}
      ${months.length ? `<h4>الخطط الشهرية</h4>${months.map((p) => box(`plan:${p.id}`, esc(planTitle(p)), money(planCalc(p).left) + ' للادخار')).join('')}` : ''}
      ${titled.length ? `<h4>الخطط المعنونة</h4>${titled.map((p) => box(`plan:${p.id}`, esc(p.name), money(planCalc(p).left) + ' للادخار')).join('')}` : ''}
      <h4>غيرها</h4>
      ${[['debts', 'debt'], ['owes', 'owe'], ['rights', 'right']].map(([key, k]) => (LEDGERS[k].list().length ? box(key, LEDGERS[k].title, `${LEDGERS[k].list().length} · الباقي ${money(lgTotal(k))}`) : '')).join('')}
      ${S.finProjects.map((p) => box(`proj:${p.id}`, esc(p.name), 'مشروع مالي')).join('')}
      ${S.subs.length ? box('subs', 'الاشتراكات والفواتير', `${money(sum(S.subs.filter((s) => s.active), subMonthly))} شهرياً`) : ''}
      ${S.later.length ? box('later', 'الشراء المؤجّل', `${S.later.length} · وفّرت ${money(sum(S.later.filter((x) => x.decision === 'dropped'), (x) => x.price))}`) : ''}
      ${S.finTx.length ? box('spend', 'المصروف المسجّل', `${S.finTx.length} عملية`) : ''}
    </div>
    <div class="sheet-actions"><button type="submit" class="primary">${icon('sheet')} صدّر</button></div>`;
  showLib();
}
function runFinExport() {
  const what = { plans: [], projects: [] };
  for (const c of $('libForm').querySelectorAll('[data-exp]')) {
    if (!c.checked) continue;
    const [k, id] = c.dataset.exp.split(':');
    if (k === 'plan') what.plans.push(id); else if (k === 'proj') what.projects.push(id); else what[k] = true;
  }
  return saveWorkbook(finWorkbook(what), `mahami-finance-${today()}`);
}

// ---------- events ----------
function finScope(scope, sid) { return scope === 'plan' ? getFinPlan(sid) : S.finProjects.find((x) => x.id === sid); }
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'fmMonth') { updateMoveHint(); return; }
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
  const el = e.target.closest('[data-action^="fin-"], [data-action^="debt-"], [data-action^="right-"], [data-action^="owe-"], [data-action^="proj-"], [data-action="lg-pay-del"]');
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
    case 'fin-new': case 'fin-new-month': openFinNew('month'); break;
    case 'fin-new-titled': openFinNew('scenario'); break;
    case 'fin-pull': openFinMove('pull'); break;
    case 'fin-push': openFinMove('push'); break;
    case 'fin-export': openFinExport(); break;
    case 'fin-xls-plan': saveWorkbook(finWorkbook({ plans: [v] }), `mahami-plan-${today()}`); break;
    case 'fin-xls-one': saveWorkbook(finWorkbook({ [v]: true }), `mahami-${v}-${today()}`); break;
    case 'fin-exp-all': for (const c of $('libForm').querySelectorAll('[data-exp]')) c.checked = v === '1'; break;
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
    case 'fin-mode': ldraft.mode = v; for (const b of $('fmMode').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'fin-txkind': finUi.txKind = v; for (const b of $('txKind').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'fin-tx-del': S.finTx = S.finTx.filter((t) => t.id !== v); save(); render(); break;
    case 'debt-new': openLedger('debt', null); break;
    case 'debt-open': openLedger('debt', v); break;
    case 'debt-pay': openPayment('debt', v); break;
    case 'right-new': openLedger('right', null); break;
    case 'right-open': openLedger('right', v); break;
    case 'right-pay': openPayment('right', v); break;
    case 'owe-new': openLedger('owe', null); break;
    case 'owe-open': openLedger('owe', v); break;
    case 'owe-pay': openPayment('owe', v); break;
    case 'fin-lg': finUi.tab = 'ledger'; finUi.lg = v; render(); break;
    case 'lg-pay-del': {
      const x = (ldraft.kind === 'debt' ? S.finDebts : S.finRights).find((d) => d.id === ldraft.id);
      x.payments = x.payments.filter((p) => p.id !== v); save(); openLedger(ldraft.kind, x.id); render();
      break;
    }
    case 'proj-new': { const p = normalizeFinProject({ name: 'مشروع جديد', items: [{ name: '', amount: 0 }], funding: [] }); S.finProjects.push(p); save(); finUi.proj = p.id; render(); break; }
    case 'proj-open': finUi.proj = v; render(); window.scrollTo({ top: 0 }); break;
    case 'proj-paid': { const p = S.finProjects.find((x) => x.id === el.dataset.sid); if (p) { p.paidFrom = v; save(); render(); } break; }
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
