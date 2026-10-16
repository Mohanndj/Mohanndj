'use strict';
// «المالية»: personal finance laid out like the user's own workbook («الخطة الشخصية المالية»):
// budget plans (a month or a «what if» scenario) with income, fixed monthly expenses, periodic
// expenses spread per month, and what is left for savings and emergency accounts; actual spending
// against the plan; debts I owe; «الديون والحقوق»: what I borrowed, what I owe without a loan, and what is owed to me; cost projects (like a wedding).
// The workbook can be imported straight from the phone; nothing is sent anywhere.

const finUi = { tab: 'plans', plan: '', proj: '', month: '', lg: 'debt' };
const EVERY_M = [1, 2, 3, 4, 6, 12, 24];
const money = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US')} ${S.settings.currency || 'ريال'}`;
// amounts as typed on any keyboard: Arabic or Latin digits; «٫» or «.» as the decimal mark; «,» as the
// decimal mark when it is the only separator followed by one or two digits (58,5), else thousands (1,250)
const num = (v) => {
  let s = String(v ?? '').trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/[٬\s]/g, '');
  if (!s.includes('.') && /^-?\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const sum = (arr, f = (x) => x.amount) => arr.reduce((n, x) => n + (Number(f(x)) || 0), 0);
const row = (o) => ({ id: o.id || uid(), name: String(o.name || ''), amount: num(o.amount), ...(o.every != null ? { every: Math.max(1, num(o.every) || 12) } : {}), ...(o.balance != null ? { balance: num(o.balance) } : {}), ...(o.done != null ? { done: !!o.done } : {}), ...(o.done && o.auto ? { auto: true } : {}), ...(o.link ? { link: String(o.link) } : {}) });

function normalizeFinPlan(p) {
  return {
    id: p.id || uid(), name: String(p.name || 'خطة'), kind: p.kind === 'scenario' ? 'scenario' : 'month', month: p.month || '',
    // the plan's own period (a salary day: 27 Sep → 26 Oct); empty means its calendar month
    from: /^\d{4}-\d{2}-\d{2}$/.test(p.from || '') ? p.from : '', to: /^\d{4}-\d{2}-\d{2}$/.test(p.to || '') ? p.to : '',
    income: (p.income || []).map(row), fixed: (p.fixed || []).map(row), periodic: (p.periodic || []).map((x) => row({ ...x, every: x.every ?? 12 })),
    accounts: (p.accounts || []).map((x) => row({ ...x, balance: x.balance ?? 0 })), goal: num(p.goal), notes: String(p.notes || ''), unlinked: Array.isArray(p.unlinked) ? p.unlinked.map(String) : [],
    created: p.created || Date.now(), updated: p.updated || Date.now(),
  };
}
const payments = (list) => (Array.isArray(list) ? list : []).filter((x) => x && x.amount).map((x) => ({ id: x.id || uid(), d: x.d || today(), amount: num(x.amount), note: String(x.note || ''), ...(x.prevNext ? { prevNext: x.prevNext } : {}) }));
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
  return { id: p.id || uid(), name: String(p.name || 'مشروع'), items: (p.items || []).map((x) => row({ ...x, done: !!x.done })), funding: (p.funding || []).map(row), paidFrom: p.paidFrom === 'funding' ? 'funding' : 'outside', note: String(p.note || ''), created: p.created || Date.now(),
    // «الادخار» (savings.js): fed by the monthly plans
    kind: p.kind === 'save' ? 'save' : 'cost', opening: num(p.opening), from: String(p.from || ''), goal: num(p.goal), moves: payments(p.moves),
    overrides: Object.fromEntries(Object.entries(p.overrides && typeof p.overrides === 'object' ? p.overrides : {}).filter(([m]) => /^\d{4}-\d{2}$/.test(m)).map(([m, v]) => [m, num(v)])) };
}
// what is bought no longer needs money: the need is what is left to buy. If the purchases were paid
// out of the project's funding sources, that money is gone from what is available too.
function projCalc(p) {
  const fromPlan = projPlanPaid(p);
  const cost = sum(p.items), bought = sum(p.items.filter((x) => x.done)), fund = sum(p.funding) + fromPlan;
  const left = cost - bought;
  const avail = p.paidFrom === 'funding' ? fund - bought : fund;
  return { cost, bought, left, fund, fromPlan, avail, gap: avail - left, pct: cost ? Math.round((bought / cost) * 100) : 0 };
}
// a plan item and a project with the same name mirror each other (agreed with the user): what is paid
// to «ادخار الحج» in a monthly plan is money available in the project «الحج». The savings project is
// fed by the plans' leftovers instead, so it is never matched.
const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/^(حساب|ادخار|إدخار|توفير|صندوق)\s+/, '').replace(/^ال/, '');
function projectOfRow(x) {
  if (!x || !x.name || spendName(x.name)) return null;
  const k = nameKey(x.name);
  return k.length >= 2 ? S.finProjects.find((pr) => pr.kind !== 'save' && nameKey(pr.name) === k) || null : null;
}
// the amounts written for it in every monthly plan whose period has begun (a later month counts when it starts)
function projPlanLines(pr) {
  if (pr.kind === 'save') return [];
  const out = [];
  for (const p of S.finPlans.filter((x) => x.kind === 'month' && finRange(x) && finRange(x).from <= today())) {
    for (const r of p.fixed) if (r.amount && projectOfRow(r) === pr) out.push({ p, r, amount: r.amount });
    for (const r of p.periodic) if (r.amount && projectOfRow(r) === pr) out.push({ p, r, amount: r.amount / (r.every || 12) });
  }
  return out.sort((a, b) => finRange(a.p).from.localeCompare(finRange(b.p).from));
}
const projPlanPaid = (pr) => sum(projPlanLines(pr), (l) => l.amount);
function normalizeTx(t) {
  return { id: t.id || uid(), d: t.d || today(), amount: num(t.amount), kind: t.kind === 'in' ? 'in' : 'out', item: String(t.item || ''), note: String(t.note || ''), ref: String(t.ref || ''), src: String(t.src || ''), created: t.created || Date.now() };
}

// ---------- calculations ----------
function planCalc(p) {
  const income = sum(p.income), fixed = sum(p.fixed);
  const periodic = sum(p.periodic, (x) => x.amount / (x.every || 12));
  const left = income - fixed - periodic;
  return { income, fixed, periodic, periodicYear: periodic * 12, left, accounts: sum(p.accounts, (x) => x.balance) };
}
// a monthly plan against reality: payments recorded that month (from «اليوم» or «المصروف»), each
// added to its plan item or marked outside the plan. An item ticked «دُفع» with no payment counts
// as paid in full. inHand is what is really left of the income now.
function planRows(p) {
  return [...p.fixed.map((x) => ({ x, list: 'fixed', plan: x.amount })), ...p.periodic.map((x) => ({ x, list: 'periodic', plan: x.amount / (x.every || 12) }))].filter((r) => r.x.name || r.plan);
}
function planActual(p) {
  const c = planCalc(p);
  const txs = p.kind === 'month' && p.month ? S.finTx.filter((t) => inPlan(p, t.d)) : [];
  const outs = txs.filter((t) => t.kind === 'out');
  const rows = planRows(p);
  for (const r of rows) {
    r.spent = sum(outs.filter((t) => t.ref === r.x.id));
    // ticked «دُفع»: paid in full even if only part of it was recorded
    const once = !isSpendRow(r); // a «مصروف …» item has no «دُفع»: only what was spent from it counts
    r.paid = once && r.x.done ? Math.max(r.spent, r.plan) : r.spent;
    r.left = once && r.x.done ? 0 : Math.max(0, r.plan - r.paid);
  }
  const outside = outs.filter((t) => t.ref === 'out');
  const noRow = (t) => t.ref !== 'out' && !rows.some((r) => r.x.id === t.ref);
  const loose = outs.filter((t) => !t.src && noRow(t));
  // a linked payment whose item is no longer in the plan (its source or item deleted) is still a payment
  const strayPays = outs.filter((t) => t.src && noRow(t));
  const paidPlan = sum(rows, (r) => r.paid);
  const extra = sum(txs.filter((t) => t.kind === 'in'));
  const spent = paidPlan + sum(outside) + sum(loose) + sum(strayPays);
  return { ...c, rows, extra, paidPlan, outside, loose, strayPays, spent, toPay: sum(rows, (r) => r.left), inHand: c.income + extra - spent };
}
// adding a payment to an item: once what was paid reaches the planned amount, tick it «دُفع»
function assignTx(t, ref, p) {
  const r = p && planRows(p).find((y) => y.x.id === ref);
  if (r && t.item !== r.x.name) { if (t.item && !t.note) t.note = t.item; t.item = r.x.name; }
  if (ref === 'out' && !t.item) t.item = 'خارج المخطط';
  t.ref = ref;
  if (r && r.x.link) { if (!t.src) payLink(r.x.link, t.amount, t.d, t); return; }
  if (r && !r.x.done && !isSpendRow(r)) { const got = sum(S.finTx.filter((y) => y.kind === 'out' && y.ref === ref && inPlan(p, y.d))); if (r.plan && got >= r.plan - 0.5) { r.x.done = true; r.x.auto = true; } }
}
// what is left of a plan item this month, said plainly: «بقي ٢٥٠ من ٦٠٠ هذا الشهر» or an overrun
function rowRemain(p, rowId, extra = 0) {
  const r = p && rowId && rowId !== 'out' ? planActual(p).rows.find((y) => y.x.id === rowId) : null;
  if (!r) return null;
  const budget = r.list === 'periodic' ? r.x.amount : r.plan;
  const left = budget - r.spent - extra;
  return { name: r.x.name, budget, left, text: left > 0.5 ? `بقي ${money(left)} من ${money(budget)} هذا الشهر` : left > -0.5 ? `استنفدت ${money(budget)} كاملاً` : `⚠️ تجاوزت بـ ${money(-left)} (المخطط ${money(budget)})` };
}
// the same, before recording an amount: what it would leave
const remainAfter = (rm) => (rm.left > 0.5 ? `بعده يبقى ${money(rm.left)} من ${money(rm.budget)}` : rm.left > -0.5 ? `به تستنفد ${money(rm.budget)} كاملاً` : `⚠️ به تتجاوز المخطط (${money(rm.budget)}) بـ ${money(-rm.left)}`);
// a plan item whose name starts with «مصروف» is a spending budget (spent bit by bit, like «مصروف البنزين»);
// any other item is an obligation (rent, an instalment, a bill) paid once and just ticked «دُفع»
const spendName = (name) => /^\s*(ال)?مصروف/.test(name || '');
const isSpendRow = (r) => spendName(r.x.name);
const bareName = (s) => String(s || '').trim().replace(/^(ال)?مصروف\s*/, '').replace(/^ال/, '').trim();
// «بنزين» finds «مصروف البنزين», and the full name finds itself
const rowIs = (r, text) => !!r.x.name && !!String(text || '').trim() && (r.x.name.trim() === String(text).trim() || bareName(r.x.name) === bareName(text));
// the items offered when recording a spending: only «مصروف …» items when the plan has them
function spendRowsOf(p) {
  const rs = p ? planRows(p).filter((r) => r.x.name) : [];
  const sp = rs.filter(isSpendRow);
  return sp.length ? sp : rs;
}
const spendOptions = (p, cur) => `${spendRowsOf(p).map((r) => `<option value="${r.x.id}"${cur === r.x.id ? ' selected' : ''}>${esc(r.x.name)} (${money(r.plan)})</option>`).join('')}<option value="out"${cur === 'out' ? ' selected' : ''}>خارج المخطط له</option>`;
// two kinds of money going out (agreed with the user):
// «المصروفات»: spending from «مصروف …» items, or spending with no item at all (outside the items);
// «المدفوعات لمرة واحدة»: every other item — a debt instalment, a bill, rent — paid once and ticked «دُفع».
function isPayTx(t) {
  if (!t || t.kind !== 'out') return false;
  if (t.src) return true;
  if (!t.ref || t.ref === 'out') return false;
  const p = planForDate(t.d);
  const r = p && planRows(p).find((y) => y.x.id === t.ref);
  return !!r && !isSpendRow(r);
}
function planSplit(p) {
  const a = planActual(p);
  const spendRows = a.rows.filter(isSpendRow), payRows = a.rows.filter((r) => !isSpendRow(r));
  const budget = sum(spendRows, (r) => r.plan), fromItems = sum(spendRows, (r) => r.spent);
  const outside = sum(a.outside) + sum(a.loose);
  return { a, spendRows, payRows, budget, fromItems, outside, spendLeft: budget - fromItems - outside,
    payTotal: sum(payRows, (r) => r.plan) + sum(a.strayPays), payPaid: sum(payRows, (r) => r.paid) + sum(a.strayPays), payLeft: sum(payRows, (r) => r.left) };
}
const refOptions = (p, cur) => `${p ? planRows(p).filter((r) => r.x.name).map((r) => `<option value="${r.x.id}"${cur === r.x.id ? ' selected' : ''}>${esc(r.x.name)} (${money(r.plan)})</option>`).join('') : ''}<option value="out"${cur === 'out' ? ' selected' : ''}>خارج المخطط له</option>`;

// «اليوم»: a small box for what you paid today: the amount, what for, and its item in this month's plan
function spendTodayHTML() {
  const t0 = today(), p = planForDate(t0);
  if (syncPlanLinks(p)) save();
  const all = S.finTx.filter((t) => t.d === t0 && t.kind === 'out').sort((a, b) => a.created - b.created);
  const list = all.filter((t) => !isPayTx(t)), paysToday = all.filter(isPayTx);
  return todayBlock('المصروف', 'finance', `<form class="fin-tx td-spend" id="tdSpend" autocomplete="off">
      <div class="fin-tx-row"><input type="text" inputmode="decimal" id="tdAmt" class="num-in" placeholder="دفعت كم؟" aria-label="المبلغ" data-novoice><input type="text" id="tdWhy" placeholder="لماذا؟ مثل: بنزين" aria-label="ما دفعت له"></div>
      <div class="fin-tx-row"><select id="tdRef" aria-label="بندها في الخطة"><option value="">${p ? 'بندها في الخطة: لاحقاً' : 'لا خطة لهذا الشهر'}</option>${spendOptions(p, '')}</select><button type="submit" class="primary">سجّل</button></div>
      <small class="td-hint" id="tdHint"></small>
    </form>
    ${list.length ? `<ul class="fin-txs td-list">${list.map((t) => `<li class="out"><span><b>−${money(t.amount)}</b> ${esc(t.item || 'بلا بند')}${t.note ? ` <small>${esc(t.note)}</small>` : ''}${t.ref ? '' : ' <small class="late">بلا بند</small>'}</span><button type="button" class="fin-del" data-action="fin-tx-del" data-v="${t.id}" aria-label="حذف">✕</button></li>`).join('')}</ul>
      <p class="note-text">صرفت اليوم ${money(sum(list))}</p>` : ''}
    ${paysToday.length ? `<p class="note-text">ومدفوعات لمرة واحدة اليوم: ${money(sum(paysToday))}</p>` : ''}`);
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
    <div class="fin-legend"><span><i class="fx"></i>الثابتة ${money(c.fixed)}</span><span><i class="pd"></i>الدورية ${money(c.periodic)}</span><span><i class="${c.left >= 0 ? 'sv' : 'neg'}"></i>${c.left >= 0 ? 'المتبقي' : 'العجز'} ${money(Math.abs(c.left))}</span></div>`;
}

// ---------- editable rows (like spreadsheet rows) ----------
function rowsHTML(scope, sid, list, cols, items, opts = {}) {
  const inp = (x, c) => {
    const id = `f-${list}-${x.id}-${c.k}`;
    if (c.k === 'every') return `<select id="${id}" data-fin="${scope}" data-sid="${sid}" data-list="${list}" data-row="${x.id}" data-k="every" aria-label="التكرار">${[...new Set([...EVERY_M, x.every])].sort((a, b) => a - b).map((m) => `<option value="${m}"${x.every === m ? ' selected' : ''}>${m === 1 ? 'كل شهر' : m === 12 ? 'سنوياً' : m === 24 ? 'كل سنتين' : `كل ${m} أشهر`}</option>`).join('')}</select>`;
    // a «مصروف …» item is spent bit by bit, never paid once: no «دُفع» box (an empty cell keeps the row's shape)
    if (c.k === 'done' && scope === 'plan' && spendName(x.name)) return '<span class="fin-chk"></span>';
    if (c.k === 'done') return `<label class="fin-chk"><input type="checkbox" id="${id}" data-fin="${scope}" data-sid="${sid}" data-list="${list}" data-row="${x.id}" data-k="done"${x.done ? ' checked' : ''}><span>${c.label || 'تم'}</span></label>`;
    return `<input type="${c.num ? 'text' : 'text'}" ${c.num ? 'inputmode="decimal" class="num-in"' : ''} id="${id}" data-fin="${scope}" data-sid="${sid}" data-list="${list}" data-row="${x.id}" data-k="${c.k}" value="${esc(c.num ? (x[c.k] || '') : x[c.k])}" placeholder="${c.ph}" aria-label="${c.ph}" autocomplete="off"${c.num ? ' data-novoice' : ''}${x.link && c.k === 'amount' ? ' readonly title="يُعدَّل من مصدره"' : ''}>`;
  };
  return `<div class="fin-rows c${cols.length}">
    ${items.map((x) => `<div class="fin-row${x.done && !(scope === 'plan' && spendName(x.name)) ? ' done' : ''}">${cols.map((c) => inp(x, c)).join('')}<button type="button" class="fin-del" data-action="fin-row-del" data-scope="${scope}" data-sid="${sid}" data-list="${list}" data-v="${x.id}" aria-label="حذف">✕</button>${opts.extra || x.link ? `<small class="fin-x">${[x.link ? `🔗 من ${esc(linkLabel(x.link))} | يُحدَّث تلقائياً` : '', opts.extra ? opts.extra(x) : ''].filter(Boolean).join(' | ')}</small>` : ''}</div>`).join('')}
    <button type="button" class="fin-add" data-action="fin-row-add" data-scope="${scope}" data-sid="${sid}" data-list="${list}">${icon('plus')} ${opts.addLabel || 'بند'}</button>
  </div>`;
}

// ---------- page ----------
function viewFinance() {
  syncAllPlans();
  const tabs = [['plans', 'الخطط'], ['spend', 'المصروف'], ['bills', 'الاشتراكات والفواتير'], ['ledger', 'الديون والحقوق'], ['fines', 'المخالفات'], ['projects', 'المشاريع'], ['later', 'الشراء المؤجّل']];
  const ap = activePlan();
  const c = ap ? planCalc(ap) : null;
  if (finUi.tab === 'debts' || finUi.tab === 'rights') { finUi.lg = finUi.tab === 'debts' ? 'debt' : 'right'; finUi.tab = 'ledger'; }
  const mini = Object.keys(LEDGERS).filter((k) => lgTotal(k));
  const body = ({ plans: finPlansHTML, spend: finSpendHTML, bills: finBillsHTML, ledger: finLedgerHTML, fines: finFinesHTML, projects: finProjectsHTML, later: finLaterHTML }[finUi.tab] || finPlansHTML)();
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>المالية</h2><div class="btn-row">${S.finPlans.length || S.finDebts.length || S.finRights.length || S.finProjects.length || S.subs.length || S.later.length || S.finTx.length ? `<button type="button" class="xls-btn" data-action="fin-export">${icon('sheet')}تصدير إكسل</button>` : ''}<label class="xls-btn fin-import">${icon('sheet')}استيراد إكسل<input type="file" id="finImport" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div></div>
    ${c ? `<button type="button" class="fin-top" data-action="fin-open" data-v="${ap.id}">
      <small>${esc(ap.name)}${ap.month ? ` | ${esc(rangeLabel(ap))}` : ''}</small>
      <div class="fin-tiles"><span><b>${money(c.income)}</b>الدخل</span><span><b>${money(c.fixed + c.periodic)}</b>المصاريف</span><span class="${c.left < 0 ? 'neg' : 'pos'}"><b>${money(c.left)}</b>${c.left < 0 ? 'عجز' : 'المتبقي'}</span></div>
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
  const mini = (c) => `<span class="fin-hnum ${c.left < 0 ? 'neg' : 'pos'}">${c.left < 0 ? 'عجز' : 'المتبقي'} <b>${money(Math.abs(c.left))}</b></span>`;
  return `<section class="section">
    <div class="section-head"><h2>الخطط المعنونة</h2>${addBtn('fin-new-titled', 'خطة معنونة')}</div>
    <p class="note-text explain">خطط تسمّيها بما تشاء: لفترة زمنية («بعد سداد القرض»، «عام ٢٠٢٧») أو لما تتصوره («على فرض الزواج»). اضغط أي خطة لترى تفاصيلها، وانقلها إلى أي شهر.</p>
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
    <label class="field fin-payday"><span>يوم نزول الراتب</span><select id="setPayDay">${[0, ...Array.from({ length: 28 }, (_, i) => i + 1)].map((d) => `<option value="${d}"${(Number(S.settings.payDay) || 0) === d ? ' selected' : ''}>${d ? `يوم ${d} من كل شهر` : 'بداية الشهر (من ١ إلى آخره)'}</option>`).join('')}</select><small class="hint explain">تبدأ كل خطة شهرية جديدة من هذا اليوم وتنتهي في اليوم الذي قبله من الشهر التالي، وتستطيع تعديل أي خطة بنفسها.</small></label>
    ${months.length ? `<div class="book-list">${months.map((p) => { const c = planCalc(p); return `<button type="button" class="fin-card${ap && p.id === ap.id ? ' active' : ''}" data-action="fin-open" data-v="${p.id}">
      <span class="row-between"><b>${esc(planTitle(p))}<small class="fin-range-l"> ${esc(rangeLabel(p))}</small></b><small class="fin-kind">${[p.name && !/^خطة /.test(p.name) ? esc(p.name) : '', ap && p.id === ap.id ? 'الحالية' : ''].filter(Boolean).join(' | ')}</small></span>
      ${splitBar(c)}
    </button>`; }).join('')}</div>`
      : emptyHTML('لا خطط شهرية بعد', 'أنشئ خطة لهذا الشهر: فارغة، أو من الشهر السابق، أو انقل إليها إحدى خططك المعنونة.', addBtn('fin-new-month', 'خطة هذا الشهر'))}
  </section>`;
}

// the two parts of a plan's month: spending (budget, spent from items, spent outside them, left)
// and one-time payments (total, paid, left)
function splitHTML(p, sp = planSplit(p), spendOnly = false) {
  const over = (r) => r.spent > r.plan + 0.5;
  const sBars = sp.spendRows.filter((r) => r.spent).map((r) => hbar(`${esc(r.x.name)}${over(r) ? ' ⚠️' : ''}`, `${money(r.spent)} من ${money(r.plan)}`, r.plan ? Math.min(100, Math.round((r.spent / r.plan) * 100)) : 100, over(r) ? 'var(--high)' : undefined)).join('');
  const spending = sp.budget || sp.fromItems || sp.outside ? `<div class="fin-part">
      <h4>المصروفات</h4>
      <div class="fin-tiles"><span><b>${money(sp.budget)}</b>مجموع بنود المصروف</span><span><b>${money(sp.fromItems + sp.outside)}</b>صُرف منها</span><span class="${sp.spendLeft < 0 ? 'neg' : 'pos'}"><b>${money(sp.spendLeft)}</b>${sp.spendLeft < 0 ? 'تجاوزت' : 'الباقي'}</span></div>
      <p class="fin-split-l">الذي صُرف: من البنود <b>${money(sp.fromItems)}</b> | خارج البنود <b class="${sp.outside ? 'late' : ''}">${money(sp.outside)}</b></p>
      ${sBars ? `<ul class="hbars">${sBars}</ul>` : ''}
    </div>` : '';
  const payments = sp.payRows.length ? `<div class="fin-part">
      <h4>المدفوعات لمرة واحدة</h4>
      <div class="fin-tiles"><span><b>${money(sp.payTotal)}</b>مجموعها</span><span><b>${money(sp.payPaid)}</b>دُفع</span><span class="${sp.payLeft ? '' : 'pos'}"><b>${money(sp.payLeft)}</b>باقٍ دفعه</span></div>
      <ul class="fin-pays">${sp.payRows.map((r) => `<li class="${r.left ? '' : 'ok'}"><span>${r.left ? '○' : '✓'} ${esc(r.x.name)}</span><b>${r.left ? `${money(r.left)} باقٍ` : money(r.paid)}</b></li>`).join('')}</ul>
    </div>` : '';
  return spendOnly ? spending : spending + payments;
}
// the plan's items as one elegant list: name and amount editable in place; a one-time item has a small
// square that turns it green when paid; a «مصروف …» item has none (its spending lives in «المصروف»)
function planListHTML(p, list, scope = 'plan') {
  const isPlan = scope === 'plan';
  const month = isPlan && p.kind === 'month';
  const at = (x, k) => `data-fin="${scope}" data-sid="${p.id}" data-list="${list}" data-row="${x.id}" data-k="${k}"`;
  const PH = { income: 'مصدر الدخل', items: 'البند', funding: 'من أين (مثل: حساب الحج)' };
  const rows = p[list].map((x) => {
    const spend = isPlan && list !== 'income' && spendName(x.name);
    const tick = (month && list !== 'income' && !spend) || (!isPlan && list === 'items');
    const pr = isPlan && list !== 'income' ? projectOfRow(x) : null;
    const sub = [
      list === 'periodic' ? `<select class="pl-every" ${at(x, 'every')} aria-label="كل كم">${[...new Set([...EVERY_M, x.every])].sort((a, b) => a - b).map((m) => `<option value="${m}"${x.every === m ? ' selected' : ''}>${m === 1 ? 'كل شهر' : m === 12 ? 'سنوياً' : m === 24 ? 'كل سنتين' : `كل ${m} أشهر`}</option>`).join('')}</select><span class="num">${money(x.amount / (x.every || 12))} شهرياً</span>` : '',
      x.link ? `🔗 ${esc(linkLabel(x.link))}` : '',
      pr ? `🔗 مشروع «${esc(pr.name)}» | المتوفر ${money(projCalc(pr).avail)}` : '',
      x.link && /^fine:/.test(x.link) && typeof discLine === 'function' ? (() => { const f = S.fines.find((y) => `fine:${y.id}` === x.link); return f && discLine(f) ? esc(discLine(f)) : ''; })() : '',
    ].filter(Boolean);
    return `<li class="pl-row${tick && x.done ? ' paid' : ''}${spend ? ' spend' : ''}">
      <span class="pl-main"><input type="text" class="pl-name" id="pl-n-${x.id}" ${at(x, 'name')} value="${esc(x.name)}" placeholder="${PH[list] || 'اسم البند'}" aria-label="الاسم" autocomplete="off" data-novoice>${sub.length ? `<small class="pl-sub">${sub.join('<i>|</i>')}</small>` : ''}</span>
      <input type="text" inputmode="decimal" class="pl-amt num-in" id="pl-a-${x.id}" ${at(x, 'amount')} value="${x.amount ? digitsOut(Number(x.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })) : ''}" placeholder="المبلغ" aria-label="المبلغ" data-novoice${x.link ? ' readonly title="يُعدَّل من مصدره"' : ''}>
      ${tick ? `<label class="pl-tick" title="${isPlan ? 'دُفع' : 'اشتريته'}"><input type="checkbox" id="pl-t-${x.id}" ${at(x, 'done')}${x.done ? ' checked' : ''} aria-label="${isPlan ? 'دُفع' : 'اشتريته'} «${esc(x.name)}»"><span aria-hidden="true"></span></label>` : '<span class="pl-tick-gap" aria-hidden="true"></span>'}
      <button type="button" class="pl-del" data-action="fin-row-del" data-scope="${scope}" data-sid="${p.id}" data-list="${list}" data-v="${x.id}" aria-label="حذف «${esc(x.name)}»">✕</button>
    </li>`;
  }).join('');
  return `<ul class="pl-list">${rows}</ul>
    <button type="button" class="fin-add" data-action="fin-row-add" data-scope="${scope}" data-sid="${p.id}" data-list="${list}">${icon('plus')} ${{ income: 'دخل', funding: 'مبلغ متوفر' }[list] || 'بند'}</button>`;
}
// the top of a monthly plan, read top to bottom as one sum (as the user asked: the steps must be plain):
//   الدخل − المدفوعات لمرة واحدة − المصروفات = المتبقي (أو العجز)
// with what was paid of the payments and what was spent of the spending under each line
function planSumHTML(p) {
  const sp = planSplit(p), a = sp.a;
  const income = a.income + a.extra;
  const left = income - sp.payTotal - sp.budget;
  const payPct = sp.payTotal ? Math.min(100, Math.round((sp.payPaid / sp.payTotal) * 100)) : 0;
  const spent = sp.fromItems + sp.outside;
  const spendPct = sp.budget ? Math.min(100, Math.round((spent / sp.budget) * 100)) : 0;
  const line = (sign, label, val, cls = '') => `<div class="pc-line ${cls}"><span><i>${sign}</i>${label}</span><b>${money(val)}</b></div>`;
  return `<div class="panel pl-calc">
    ${line('', a.extra ? 'الدخل (ومعه دخل إضافي)' : 'الدخل', income, 'pc-in')}
    ${line('−', 'المدفوعات لمرة واحدة', sp.payTotal)}
    ${sp.payTotal ? `<div class="pc-sub"><div class="progress-line pc-bar"><i style="width:${payPct}%"></i></div><small><span class="ok">دُفع ${money(sp.payPaid)}</span><span>${sp.payLeft ? `باقٍ ${money(sp.payLeft)}` : 'دُفعت كلها ✓'}</span></small></div>` : ''}
    ${line('−', 'المصروفات', sp.budget)}
    ${sp.budget || spent ? `<button type="button" class="pc-sub pc-go" data-action="fin-spend-of" data-v="${p.month}"><div class="progress-line pc-bar spend${spent > sp.budget + 0.5 ? ' over' : ''}"><i style="width:${spendPct}%"></i></div><small><span>صُرف ${money(spent)}</span><span>${sp.spendLeft >= 0 ? `باقٍ ${money(sp.spendLeft)}` : `تجاوزت ${money(-sp.spendLeft)}`} ‹</span></small></button>` : ''}
    ${line('=', left < 0 ? 'العجز' : 'المتبقي', Math.abs(left), left < 0 ? 'pc-out neg' : 'pc-out pos')}
    ${a.loose.length ? `<div class="fin-loose"><h4>مدفوعات لم تُضف إلى بند <small>${a.loose.length}</small></h4>
      <ul>${a.loose.map((t) => `<li><span><b>${money(t.amount)}</b> ${esc(t.item || 'بلا وصف')} <small>${esc(relDate(t.d))}</small></span>
        <select data-assign="${t.id}" data-plan="${p.id}" aria-label="أضفها إلى"><option value="">أضفها إلى…</option>${refOptions(p, '')}</select></li>`).join('')}</ul></div>` : ''}
  </div>`;
}
function planDetailHTML(p) {
  if (syncPlanLinks(p)) save();
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
    ${p.kind === 'month' ? `<div class="grid2 fin-range">
      <label class="field"><span>تبدأ يوم</span><input type="date" id="fp-from" data-fin="plan" data-sid="${p.id}" data-k="from" value="${finRange(p).from}"></label>
      <label class="field"><span>وتنتهي يوم</span><input type="date" id="fp-to" data-fin="plan" data-sid="${p.id}" data-k="to" value="${finRange(p).to}"></label>
    </div><small class="note-text">${plural(planLen(p), "يوم واحد", "يومان", "أيام", "يوماً")}${finRange(p).to < today() ? ' | <b class="late">انتهت فترتها</b>: ما تؤشّره هنا يُسجَّل في آخر يوم منها' : inPlan(p, today()) ? ' | <b class="ok">خطة الفترة الحالية</b>' : ' | لم تبدأ بعد'}<span class="explain">. اجعلها من يوم نزول الراتب إلى اليوم الذي قبله في الشهر التالي.</span></small>` : ''}
    ${(() => { const extra = p.kind === 'month' ? planActual(p).extra : 0; return `<div class="panel"><h3>الدخل <small>${money(c.income + extra)}</small></h3>${planListHTML(p, 'income')}
      ${extra ? `<p class="pl-extra">＋ دخل إضافي سجّلته في هذه الفترة <b>${money(extra)}</b></p>` : ''}</div>`; })()}
    ${p.kind === 'month' ? planSumHTML(p) : splitBar(c)}
    <div class="panel"><h3>المدفوعات والمصروفات الشهرية <small>${money(c.fixed)}</small></h3>
      <p class="note-text explain">المربع الصغير أمام البند يعني «دُفع» فيصير أخضر. البند الذي يبدأ بكلمة «مصروف» تصرف منه على دفعات، فلا مربع له، وتتابعه في تبويب «المصروف».</p>
      ${planListHTML(p, 'fixed')}</div>
    <div class="panel"><h3>المصاريف الدورية <small>${money(c.periodic)} شهرياً | ${money(c.periodicYear)} سنوياً</small></h3>
      <p class="note-text explain">مبالغ لا تُدفع كل شهر (كل سنة أو كل بضعة أشهر)، يُخصَّص لها كل شهر جزء.</p>
      ${planListHTML(p, 'periodic')}</div>
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
  // by the plan's own period (27 Sep – 26 Oct, say); a month with no plan falls back to the calendar month
  const cur = currentPlan();
  const nowKey = cur ? cur.month : today().slice(0, 7);
  const m = finUi.month || nowKey;
  const ap = S.finPlans.find((x) => x.kind === 'month' && x.month === m) || null;
  const txs = S.finTx.filter((t) => (ap ? inPlan(ap, t.d) : t.d.slice(0, 7) === m)).sort((a, b) => b.d.localeCompare(a.d) || b.created - a.created);
  const payT = txs.filter(isPayTx), spendT = txs.filter((t) => !isPayTx(t));
  const out = sum(spendT.filter((t) => t.kind === 'out')), inn = sum(txs.filter((t) => t.kind === 'in'));
  const items = ap ? [...ap.fixed.map((x) => [x.name, x.amount]), ...ap.periodic.map((x) => [x.name, x.amount / (x.every || 12)])].filter(([n]) => n) : [];
  const days = [...new Set(spendT.map((t) => t.d))];
  const prev = (k) => { const d = parse(`${m}-01`); d.setMonth(d.getMonth() + k); return iso(d).slice(0, 7); };
  return `<section class="section">
    <div class="cal-head">
      <div class="nav"><button type="button" data-action="fin-month" data-v="${prev(-1)}" aria-label="الشهر السابق">${icon('prev')}</button></div>
      <div class="titles"><h2>مصروف ${esc(monthName(m))}</h2><small>${ap ? `${esc(rangeLabel(ap))} | مقارنة بخطتها` : 'لا خطة لهذا الشهر لتقارن بها'}</small></div>
      <div class="nav"><button type="button" data-action="fin-month" data-v="${prev(1)}" aria-label="الشهر التالي"${m >= nowKey ? ' disabled' : ''}>${icon('next')}</button></div>
    </div>
    <form class="fin-tx" id="finTxForm" autocomplete="off">
      <div class="seg" role="group" id="txKind"><button type="button" data-action="fin-txkind" data-v="out" aria-pressed="${(finUi.txKind || 'out') === 'out'}">صرفت</button><button type="button" data-action="fin-txkind" data-v="in" aria-pressed="${finUi.txKind === 'in'}">دخل</button></div>
      <div class="fin-tx-row">
        <input type="text" inputmode="decimal" id="txAmount" class="num-in" placeholder="المبلغ" aria-label="المبلغ" data-novoice>
        <input type="text" id="txItem" list="txItems" placeholder="البند" aria-label="البند">
        <datalist id="txItems">${[...new Set([...items.map(([n]) => n), ...S.finTx.map((t) => t.item)])].filter(Boolean).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      </div>
      <div class="fin-tx-row"><input type="text" id="txNote" placeholder="ملاحظة (اختياري)" aria-label="ملاحظة"><input type="date" id="txDate" value="${m === nowKey ? today() : ap ? finRange(ap).from : `${m}-01`}" aria-label="التاريخ"></div>
      <button type="submit" class="primary">سجّل</button>
    </form>
    ${ap ? `<div class="panel">${splitHTML(ap, undefined, true)}${inn ? `<p class="note-text">ودخل إضافي ${money(inn)}.</p>` : ''}</div>` : `<div class="fin-tiles"><span><b>${money(out)}</b>صرفت</span>${inn ? `<span><b>${money(inn)}</b>دخل إضافي</span>` : ''}</div>`}
    <h3 class="fin-sec-h">المصروفات</h3>
    ${days.length ? days.map((d) => `<h3 class="j-month">${esc(relDate(d))}</h3><ul class="fin-txs">${spendT.filter((t) => t.d === d).map((t) => `<li class="${t.kind}"><span><b>${t.kind === 'in' ? '+' : '−'}${money(t.amount)}</b> ${esc(t.item || 'بلا بند')}${t.note ? ` <small>${esc(t.note)}</small>` : ''}</span><button type="button" class="fin-del" data-action="fin-tx-del" data-v="${t.id}" aria-label="حذف">✕</button></li>`).join('')}</ul>`).join('')
      : emptyHTML('لا مصروفات مسجلة', 'سجّل ما تصرفه أولاً بأول، ويقارنه التطبيق بما خططت له لكل بند.')}
    ${payT.length ? `<details class="shop-done fin-paylist"><summary>المدفوعات لمرة واحدة (${payT.length}) | ${money(sum(payT))}</summary><ul class="fin-txs">${payT.map((t) => `<li class="out"><span><b>−${money(t.amount)}</b> ${esc(t.item || 'بلا بند')} <small>${esc(relDate(t.d))}</small></span><button type="button" class="fin-del" data-action="fin-tx-del" data-v="${t.id}" aria-label="حذف">✕</button></li>`).join('')}</ul></details>` : ''}
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
      <small>${isDebt ? 'الدَّين' : 'المبلغ'} ${money(total)} | ${mine ? 'المستلم' : 'المسدد'} ${money(total - left)}${!isDebt && x.date ? ` | ${esc(fmtDate(x.date, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}${isDebt && x.monthly ? ` | القسط ${money(x.monthly)}` : ''}${end && left ? ` | ينتهي ${esc(fmtDate(end, { month: 'long', year: 'numeric' }))}` : ''}</small>
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
    <p class="note-text explain">${L.hint}</p>
    ${list.length ? `<div class="book-list">${list.map((x) => ledgerCard(x, kind)).join('')}</div>` : emptyHTML(`لا شيء في «${L.title}»`, kind === 'debt' ? 'سجّل كل دَين، وسجّل كل دفعة تسددها لترى الباقي ومتى ينتهي.' : kind === 'owe' ? 'سجّل لمن عليك الحق ومبلغه، وسجّل ما تؤديه منه حتى يبرأ.' : 'سجّل عند من لك المال ومتى، وسجّل ما يرده لك.')}
  </section>`;
}

// --- cost projects
function finProjectsHTML() {
  const p = finUi.proj && S.finProjects.find((x) => x.id === finUi.proj);
  if (p && isSaving(p)) return savingDetailHTML(p);
  if (p) {
    const c = projCalc(p);
    const own = sum(p.funding);
    const line = (sign, label, val, cls = '') => `<div class="pc-line ${cls}"><span><i>${sign}</i>${label}</span><b>${money(val)}</b></div>`;
    // read top to bottom: what it costs, what is bought, what is left to buy, what you have, what is missing
    const calc = c.cost ? `${line('', 'التكلفة كاملة', c.cost, 'pc-in')}
      ${c.bought ? line('−', 'ما اشتريته', c.bought) : ''}
      ${c.bought ? line('=', 'المتبقي شراؤه', c.left) : ''}
      ${line('−', 'المتوفر لديك', c.avail)}
      ${c.fromPlan ? `<div class="pc-sub"><small><span>من خططك الشهرية ${money(c.fromPlan)}</span><span>أضفته بنفسك ${money(own)}</span></small></div>` : ''}
      ${line('=', c.gap < 0 ? 'ينقصك' : c.gap > 0 ? 'يفيض' : 'مغطّى تماماً ✓', Math.abs(c.gap), c.gap < 0 ? 'pc-out neg' : 'pc-out pos')}`
      : `${line('', 'من خططك الشهرية', c.fromPlan, 'pc-in')}
      ${line('+', 'أضفته بنفسك', own)}
      ${c.bought && p.paidFrom === 'funding' ? line('−', 'ما اشتريته منه', c.bought) : ''}
      ${line('=', 'المتوفر لديك', c.avail, 'pc-out pos')}`;
    return `<section class="section fin-plan">
      <div class="crumbs"><button type="button" class="back" data-action="fin-close">${icon('back')} المشاريع</button></div>
      <input type="text" class="fin-title" id="fj-name" data-fin="proj" data-sid="${p.id}" data-k="name" value="${esc(p.name)}" aria-label="اسم المشروع" autocomplete="off">
      <div class="panel pl-calc">${calc}
        ${c.cost ? `<div class="progress-line pc-bar"><i style="width:${c.cost ? Math.min(100, Math.round(((c.bought + Math.max(0, c.avail)) / c.cost) * 100)) : 0}%"></i></div>` : ''}</div>
      <div class="panel"><h3>المتوفر لديك <small>${money(c.fromPlan + own)}</small></h3>
        ${c.fromPlan ? `<ul class="pl-list pl-from">${projPlanLines(p).map((l) => `<li class="pl-row"><span>🔗 ${esc(planTitle(l.p))} | «${esc(l.r.name)}»</span><b>${money(l.amount)}</b></li>`).join('')}</ul>` : `<p class="note-text">اكتب في خطتك الشهرية بنداً باسم «${esc(p.name)}» (أو «ادخار ${esc(p.name)}») فيصل مبلغه إلى هنا كل شهر.</p>`}
        ${planListHTML(p, 'funding', 'proj')}</div>
      <div class="panel"><h3>البنود <small>${money(c.cost)}</small></h3>
        <p class="note-text explain">ما يحتاجه المشروع وتكلفته. المربع يعني «اشتريته» فيُخصم من الاحتياج.</p>
        ${planListHTML(p, 'items', 'proj')}
        ${c.bought ? `<div class="field"><b class="note-text">ما اشتريته دفعت ثمنه من:</b><div class="seg" role="group">
          <button type="button" data-action="proj-paid" data-sid="${p.id}" data-v="outside" aria-pressed="${p.paidFrom === 'outside'}">مال آخر</button>
          <button type="button" data-action="proj-paid" data-sid="${p.id}" data-v="funding" aria-pressed="${p.paidFrom === 'funding'}">المتوفر هنا</button></div></div>` : ''}</div>
      <div class="panel"><h3>ملاحظات</h3><textarea id="fj-note" data-fin="proj" data-sid="${p.id}" data-k="note" rows="3">${esc(p.note)}</textarea></div>
      <div class="btn-row"><button type="button" class="danger" data-action="proj-del" data-v="${p.id}">حذف المشروع</button></div>
    </section>`;
  }
  return `<section class="section">
    <div class="section-head"><h2>المشاريع المالية</h2>${addBtn('proj-new', 'مشروع')}</div>
    <p class="note-text explain">لكل مشروع كبير (زواج، سفر، تأثيث، سيارة) بنوده وتكلفتها، ومصادر تمويله، وكم ينقصك. و«الادخار» يجمع ما يبقى من كل خطة شهرية.</p>
    ${savingProject() ? '' : `<button type="button" class="fin-card save-card save-new" data-action="proj-new-save"><span class="row-between"><b>💰 أنشئ مشروع الادخار</b><b>${icon('plus')}</b></span><small>يصل إليه ما يبقى من دخلك كل شهر من خططك الشهرية تلقائياً، فتعرف كم تملك من النقد.</small></button>`}
    ${S.finProjects.some(isSaving) ? `<div class="book-list">${S.finProjects.filter(isSaving).map(savingCardHTML).join('')}</div>` : ''}
    ${S.finProjects.some((x) => !isSaving(x)) ? `<ul class="pl-list pj-list">${S.finProjects.filter((x) => !isSaving(x)).map((x) => { const c = projCalc(x); return `<li><button type="button" class="pl-row pj-row" data-action="proj-open" data-v="${x.id}">
      <span class="pj-main"><b>${esc(x.name)}</b><small>${c.cost ? `${c.gap < 0 ? `ينقصك ${money(-c.gap)}` : c.cost && !c.left ? 'اكتمل ✓' : 'مغطّى ✓'} من ${money(c.left)}` : 'حساب ادخار'}${c.fromPlan ? ' | 🔗 من خططك' : ''}</small>
        ${c.cost ? `<span class="progress-line pc-bar"><i style="width:${Math.min(100, Math.round(((c.bought + Math.max(0, c.avail)) / c.cost) * 100))}%"></i></span>` : ''}</span>
      <span class="pj-amt"><small>المتوفر</small><b>${money(c.avail)}</b></span>
    </button></li>`; }).join('')}</ul>` : S.finProjects.length ? '' : emptyHTML('لا مشاريع', 'أنشئ مشروعاً (الحج، سيولة الطوارئ، الزواج…) واكتب بنداً باسمه في خطتك الشهرية.')}
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
    ${isDebt ? `<label class="field"><span>تاريخ الانتهاء المتوقع (اختياري)</span><input type="date" id="lgEnd" value="${x.end}"><small class="hint explain">إن تركته فارغاً يُحسب من القسط الشهري</small></label>` : ''}
    <label class="field"><span>ملاحظة</span><input type="text" id="lgNote" value="${esc(x.note)}" autocomplete="off"></label>
    ${id && x.payments.length ? `<div class="field"><span>${mine ? 'الدفعات المستلمة' : 'الدفعات المسددة'}</span><ul class="ppl-hist">${x.payments.slice().sort((a, b) => b.d.localeCompare(a.d)).map((p) => `<li><span>${money(p.amount)} | ${esc(dateBoth(p.d, true))}${p.note ? ` | ${esc(p.note)}` : ''}</span><button type="button" class="j-m-del" data-action="lg-pay-del" data-v="${p.id}" aria-label="حذف">✕</button></li>`).join('')}</ul></div>` : ''}
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
  const d = $('pyDate').value || today();
  if (isDebt) { const t = payLink(`debt:${x.id}`, amount, d); const pay = t && x.payments.find((p) => t.src.endsWith(`:${p.id}`)); if (pay) pay.note = $('pyNote').value.trim(); }
  else x.payments.push({ id: uid(), d, amount, note: $('pyNote').value.trim() });
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
  const detail = (f) => f.type === 'plan' ? (() => { const c = planCalc(normalizeFinPlan(f.data.plan)); return `الدخل ${money(c.income)} | المصاريف ${money(c.fixed + c.periodic)} | المتبقي ${money(c.left)}`; })()
    : f.type === 'debts' ? plural(f.data.length, 'دَين واحد', 'دَينان', 'ديون', 'دَيناً')
      : f.type === 'project' ? `${plural(f.data.items.length, 'بند واحد', 'بندان', 'بنود', 'بنداً')}${f.data.funding.length ? ` | ${f.data.funding.length} مصدر تمويل` : ''}` : 'ستُتجاهل';
  const rights = [...new Map(found.filter((f) => f.type === 'plan').flatMap((f) => f.data.rights).map((x) => [x.name, x])).values()];
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>استيراد من الإكسل</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="note-text">وجدت ${plural(found.length, 'صفحة واحدة', 'صفحتين', 'صفحات', 'صفحة')} في الملف. اختر ما تستورده؛ الملف يُقرأ على جوالك ولا يُرسل إلى أي مكان.</p>
    <ul class="fin-imp">${found.map((f, i) => `<li><label class="switch"><input type="checkbox" data-imp="${i}"${f.type === 'skip' ? ' disabled' : ' checked'}><span><b>${esc(f.name)}</b><small>${label[f.type]} | ${esc(detail(f))}</small></span></label></li>`).join('')}</ul>
    ${rights.length ? `<label class="switch"><input type="checkbox" id="impRights" checked><span><b>حقوقي (ما لي عند غيري)</b><small>${plural(rights.length, 'اسم واحد', 'اسمان', 'أسماء', 'اسماً')} | ${money(sum(rights))} (تتكرر في كل صفحة فتُستورد مرة واحدة)</small></span></label>` : ''}
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
const cloneRows = (l) => l.map((x) => { const y = { ...x, id: uid(), ...(x.done != null ? { done: false } : {}) }; delete y.auto; return y; }); // a new plan starts unpaid
function applyPlan(target, src, mode) {
  for (const k of ['income', 'fixed', 'periodic', 'accounts']) {
    if (mode === 'replace') target[k] = cloneRows(src[k]);
    else for (const x of src[k]) if (!target[k].some((y) => y.name && y.name === x.name)) target[k].push(cloneRows([x])[0]);
  }
  if (mode === 'replace' || !target.goal) target.goal = src.goal;
  target.updated = Date.now();
}
const monthPlan = (m) => S.finPlans.find((p) => p.kind === 'month' && p.month === m);
// a monthly plan covers a period: its own dates if set, else its calendar month. Everything that asks
// «which plan is this payment in?» goes by date, not by calendar month.
function finRange(p) {
  if (!p || p.kind !== 'month' || !p.month) return null;
  if (p.from && p.to && p.from <= p.to) return { from: p.from, to: p.to };
  const [y, m] = p.month.split('-').map(Number);
  return { from: `${p.month}-01`, to: iso(new Date(y, m, 0)) };
}
const inPlan = (p, d) => { const r = finRange(p); return !!r && !!d && d >= r.from && d <= r.to; };
const planForDate = (d) => S.finPlans.find((p) => p.kind === 'month' && inPlan(p, d)) || null;
const currentPlan = () => planForDate(today());
const planLen = (p) => { const r = finRange(p); return r ? daysBetween(r.from, r.to) + 1 : 30; };
const rangeLabel = (p) => { const r = finRange(p); return r ? `${fmtDate(r.from, { day: 'numeric', month: 'long' })} – ${fmtDate(r.to, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''; };
// the period a new plan for month m gets: the salary day if set (that day of month m to the day before it next month)
function defaultRange(m) {
  const day = Number(S.settings.payDay) || 0;
  if (!day) return { from: '', to: '' };
  const [y, mo] = m.split('-').map(Number);
  const clamp = (yy, mm) => Math.min(day, new Date(yy, mm, 0).getDate());
  const from = iso(new Date(y, mo - 1, clamp(y, mo)));
  const to = addDays(iso(new Date(y, mo, clamp(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1))), -1);
  return { from, to };
}
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
    </select><small class="hint explain">تُنسخ بنودها (الدخل والمصاريف والحسابات) فتعدّل ما تغيّر فقط.</small></div>
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
    p = normalizeFinPlan({ kind: 'month', month: m, ...defaultRange(m), name: `خطة ${monthName(m)}`, income: [{ name: 'الراتب', amount: 0 }], fixed: [], periodic: [], accounts: [] });
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

// pull: a titled plan into this month | push: this titled plan into a month
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
  if (!target) { target = normalizeFinPlan({ kind: 'month', month: m, ...defaultRange(m), name: `خطة ${monthName(m)}`, income: [], fixed: [], periodic: [], accounts: [] }); S.finPlans.push(target); applyPlan(target, p, 'replace'); }
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
  add([{ v: `${p.kind === 'month' ? (p.name && !/^خطة /.test(p.name) ? p.name : 'خطة شهرية') : 'خطة معنونة'} | صُدّرت ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })} | المبالغ بالـ${S.settings.currency || 'ريال'}`, s: 'sub', span: 4 }]);
  blank();
  const sumHead = add([{ v: 'الدخل', s: 'head' }, { v: 'المصاريف', s: 'head' }, { v: 'المتبقي للادخار', s: 'head' }, { v: 'نسبة الادخار', s: 'head' }]);
  const sumRow = add([null, null, null, null]); // filled once the totals' cells are known
  const a = planActual(p);
  if (p.kind === 'month' && a.spent) {
    add([{ v: 'صرفت فعلياً', s: 'head' }, { v: 'باقٍ دفعه', s: 'head' }, { v: 'خارج المخطط', s: 'head' }, { v: 'المتبقي فعلياً من الدخل', s: 'head' }]);
    add([{ v: a.spent, s: 'num' }, { v: a.toPay, s: 'num' }, { v: sum(a.outside), s: 'num' }, { v: a.inHand, s: a.inHand < 0 ? 'bad' : 'good' }]);
  }
  blank();
  const twoCol = (title, h1, h2, list, key) => {
    add([{ v: title, s: 'sec', span: 4 }]);
    add([{ v: h1, s: 'head', span: 2 }, { v: h2, s: 'head', span: 2 }]);
    const first = R.length + 1;
    for (const x of list.filter((y) => y.name || y[key])) add([{ v: x.done && p.kind === 'month' && !spendName(x.name) ? `${x.name} ✓ دُفع` : x.name, s: 'txt', span: 2 }, { v: x[key] || 0, s: 'num', span: 2 }]);
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
  for (const x of p.periodic.filter((y) => y.name || y.amount)) { const r = R.length + 1; add([{ v: x.done && p.kind === 'month' && !spendName(x.name) ? `${x.name} ✓ دُفع` : x.name, s: 'txt' }, { v: x.every || 12, s: 'num' }, { v: x.amount || 0, s: 'num' }, { f: `IFERROR(C${r}/B${r},0)`, v: (x.amount || 0) / (x.every || 12), s: 'num' }]); }
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
  const R = [[{ v: LEDGERS[lk].title, s: 'title', span: 8 }], [{ v: `${{ debts: 'ما استدنته', owes: 'ما عليّ لغيري ولم يكن ديناً', rights: 'ما لي عند غيري' }[kind]} | صُدّرت ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 8 }], []];
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
  const R = [[{ v: p.name, s: 'title', span: 4 }], [{ v: `مشروع مالي | صُدّر ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 4 }], []];
  R.push(['التكلفة كاملة', 'تم شراؤه', 'المتبقي شراؤه', 'المتوفر'].map((v) => ({ v, s: 'head' })));
  R.push([{ v: cost, s: 'big' }, { v: bought, s: 'big' }, { v: left, s: 'big' }, { v: avail, s: 'big' }]);
  R.push([{ v: gap < 0 ? 'ينقصك' : gap > 0 ? 'يفيض' : 'مغطّى تماماً', s: 'head', span: 2 }, { v: Math.abs(gap), s: gap < 0 ? 'bad' : 'good', span: 2 }], []);
  R.push([{ v: 'البنود', s: 'sec', span: 4 }], [{ v: 'البند', s: 'head', span: 2 }, { v: 'المبلغ', s: 'head' }, { v: 'تم', s: 'head' }]);
  const f = R.length + 1;
  for (const x of p.items) R.push([{ v: x.name, s: 'txt', span: 2 }, { v: x.amount, s: 'num' }, { v: x.done ? '✓' : '', s: 'txt' }]);
  R.push([{ v: 'المجموع', s: 'tot', span: 2 }, R.length >= f ? { f: `SUM(C${f}:C${R.length})`, v: cost, s: 'totnum' } : { v: cost, s: 'totnum' }, { v: '', s: 'tot' }], []);
  // what is available: the monthly plans' items of the same name, then what was added by hand
  const fromPlans = projPlanLines(p);
  if (fromPlans.length || p.funding.length) {
    R.push([{ v: 'المتوفر لديك', s: 'sec', span: 4 }], [{ v: 'المصدر', s: 'head', span: 2 }, { v: 'المبلغ', s: 'head', span: 2 }]);
    const g = R.length + 1;
    for (const l of fromPlans) R.push([{ v: `من ${planTitle(l.p)} («${l.r.name}»)`, s: 'txt', span: 2 }, { v: l.amount, s: 'num', span: 2 }]);
    for (const x of p.funding) R.push([{ v: x.name, s: 'txt', span: 2 }, { v: x.amount, s: 'num', span: 2 }]);
    R.push([{ v: 'المجموع', s: 'tot', span: 2 }, { f: `SUM(C${g}:C${R.length})`, v: fund, s: 'totnum', span: 2 }]);
  }
  if (p.note.trim()) R.push([], [{ v: 'ملاحظات', s: 'sec', span: 4 }], [{ v: p.note.trim(), s: 'note', span: 4 }]);
  return { name: p.name, design: true, widths: [30, 12, 16, 12], rows: R };
}
function spendSheet() {
  const txs = S.finTx.slice().sort((a, b) => a.d.localeCompare(b.d));
  const R = [[{ v: 'المصروف', s: 'title', span: 5 }], [{ v: `كل ما سجّلته | صُدّر ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 5 }], [], ['التاريخ', 'النوع', 'البند', 'المبلغ', 'ملاحظة'].map((v) => ({ v, s: 'head' }))];
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
  for (const id of what.projects || []) { const p = S.finProjects.find((x) => x.id === id); if (p) sheets.push(isSaving(p) ? savingSheet(p) : projectSheet(p)); }
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
    <p class="note-text explain">كل خطة في صفحة مستقلة منسّقة بأقسامها ومجاميعها (بمعادلات تعمل إن عدّلت الأرقام في الإكسل).</p>
    <div class="btn-row"><button type="button" class="ghost" data-action="fin-exp-all" data-v="1">تحديد الكل</button><button type="button" class="ghost" data-action="fin-exp-all" data-v="0">إلغاء التحديد</button></div>
    <div class="fin-exp">
      ${box('summary', 'الملخص المالي', 'الخطط المختارة والديون والحقوق وحقوقي في صفحة واحدة')}
      ${months.length ? `<h4>الخطط الشهرية</h4>${months.map((p) => box(`plan:${p.id}`, esc(planTitle(p)), money(planCalc(p).left) + ' متبقٍ')).join('')}` : ''}
      ${titled.length ? `<h4>الخطط المعنونة</h4>${titled.map((p) => box(`plan:${p.id}`, esc(p.name), money(planCalc(p).left) + ' متبقٍ')).join('')}` : ''}
      <h4>غيرها</h4>
      ${[['debts', 'debt'], ['owes', 'owe'], ['rights', 'right']].map(([key, k]) => (LEDGERS[k].list().length ? box(key, LEDGERS[k].title, `${LEDGERS[k].list().length} | الباقي ${money(lgTotal(k))}`) : '')).join('')}
      ${S.finProjects.map((p) => box(`proj:${p.id}`, esc(p.name), isSaving(p) ? `ادخار | ${money(saveCalc(p).cash)}` : 'مشروع مالي')).join('')}
      ${S.subs.length ? box('subs', 'الاشتراكات والفواتير', `${money(sum(S.subs.filter((s) => s.active), subMonthly))} شهرياً`) : ''}
      ${S.later.length ? box('later', 'الشراء المؤجّل', `${S.later.length} | وفّرت ${money(sum(S.later.filter((x) => x.decision === 'dropped'), (x) => x.price))}`) : ''}
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
  if (el.id === 'setPayDay') { S.settings.payDay = Number(el.value); save(); render(); toast(Number(el.value) ? `الخطط الجديدة تبدأ يوم ${el.value}` : 'الخطط الجديدة من بداية الشهر'); return; }
  if (el.id === 'finImport') { const f = el.files && el.files[0]; el.value = ''; if (f) importWorkbook(f); return; }
  if (!el.dataset || !el.dataset.fin) return;
  const obj = finScope(el.dataset.fin, el.dataset.sid);
  if (!obj) return;
  const k = el.dataset.k;
  const lrow = el.dataset.list && k === 'done' ? obj[el.dataset.list].find((x) => x.id === el.dataset.row) : null;
  if (lrow && lrow.link) {
    const r = finRange(obj);
    if (el.checked) { const d = inPlan(obj, today()) ? today() : today() > r.to ? r.to : r.from; const ls = linkSrc(lrow.link), rest = lrow.amount - (ls ? sum(inPlanList(ls.pays, obj)) : 0); if (rest > 0.5) payLink(lrow.link, rest, d); toast(`سُجّل الدفع في ${linkLabel(lrow.link)} وفي المصروف`); }
    else { unpayLinkPlan(lrow.link, obj); toast('أُلغي دفعه في هذه الخطة'); }
    save(); render(); return;
  }
  if (el.dataset.fin === 'plan' && (k === 'from' || k === 'to')) {
    obj[el.dataset.k] = el.value;
    const r = finRange({ ...obj, from: obj.from || finRange(obj).from, to: obj.to || finRange(obj).to });
    if (!obj.from) obj.from = r.from; if (!obj.to) obj.to = r.to;
    if (obj.from > obj.to) { toast('تاريخ النهاية قبل البداية.'); }
    obj.updated = Date.now(); syncAllPlans(); save(); render(); return;
  }
  if (el.dataset.fin === 'plan' && k === 'month' && !el.dataset.list && obj.kind === 'month') {
    const other = el.value && S.finPlans.find((x) => x !== obj && x.kind === 'month' && x.month === el.value);
    if (other) { toast(`لـ${monthName(el.value)} خطة من قبل.`); render(); return; }
    if (el.value) Object.assign(obj, { month: el.value }, defaultRange(el.value));
    obj.updated = Date.now(); syncAllPlans(); save(); render(); return;
  }
  const val = el.type === 'checkbox' ? el.checked : ['amount', 'balance', 'every', 'goal', 'opening'].includes(k) ? num(el.value) : el.value;
  // ticking «دُفع» on a one-time item of a monthly plan (not linked): the payment is recorded once, dated,
  // so it counts in «اليوم», the spend tab and the report; unticking removes it (tx.src 'tick:<row id>')
  if (el.dataset.fin === 'plan' && k === 'done' && el.dataset.list && obj.kind === 'month') {
    const x = obj[el.dataset.list].find((y) => y.id === el.dataset.row);
    if (x && !x.link && !spendName(x.name)) {
      const key = `tick:${x.id}`;
      if (el.checked) {
        const pr = planRows(obj).find((y) => y.x.id === x.id);
        const got = sum(S.finTx.filter((t) => t.kind === 'out' && t.ref === x.id && inPlan(obj, t.d)));
        const rest = Math.round(((pr ? pr.plan : x.amount) - got) * 100) / 100;
        const rg = finRange(obj), d = inPlan(obj, today()) ? today() : today() > rg.to ? rg.to : rg.from;
        if (rest > 0.5) S.finTx.push(normalizeTx({ amount: rest, kind: 'out', item: x.name, d, ref: x.id, src: key }));
      } else S.finTx = S.finTx.filter((t) => !(t.src === key && inPlan(obj, t.d)));
      x.done = el.checked; delete x.auto;
      obj.updated = Date.now(); save(); render(); return;
    }
  }
  if (el.dataset.list) { const r = obj[el.dataset.list].find((x) => x.id === el.dataset.row); if (r) { r[k] = k === 'name' ? String(val).trim() : val; if (k === 'done') delete r.auto; } }
  else obj[k] = typeof val === 'string' && k !== 'notes' && k !== 'note' ? val.trim() : val;
  obj.updated = Date.now();
  save();
  // a name or amount typed in the lists: redraw a moment later, so the tap that ended the typing
  // (✕, the «دُفع» square, the next field) still lands on what the user saw
  if (el.closest('.pl-list') && (k === 'name' || k === 'amount' || k === 'every')) finRenderSoon(); else render();
});
let finRenderTimer = null;
function finRenderSoon() { clearTimeout(finRenderTimer); finRenderTimer = setTimeout(() => { finRenderTimer = null; if (!document.activeElement || !document.activeElement.closest('.pl-list')) render(); else finRenderSoon(); }, 350); }
const finRenderNow = () => { if (finRenderTimer) { clearTimeout(finRenderTimer); finRenderTimer = null; } };
// deleting a row of a list: the ✕ first turns into «متأكد؟» for 4 seconds; a second press deletes
function rowDelete(el) {
  finRenderNow();
  if (el.classList.contains('pl-del') && !el.classList.contains('armed')) {
    el.classList.add('armed'); el.textContent = 'متأكد؟';
    setTimeout(() => { if (el.isConnected && el.classList.contains('armed')) render(); }, 4000);
    return;
  }
  const obj = finScope(el.dataset.scope, el.dataset.sid);
  const v = el.dataset.v;
  if (!obj || !obj[el.dataset.list]) return;
  // deleting ends any typing: the cursor (and the phone's keyboard) leaves the field, nothing jumps to it
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#view')) document.activeElement.blur();
  const r = obj[el.dataset.list].find((x) => x.id === v);
  if (r && r.link && obj.unlinked) { obj.unlinked.push(r.link); toast('حُذف، ولن يُضاف تلقائياً إلى هذه الخطة'); }
  else toast(`حُذف «${r && r.name ? r.name : 'البند'}»`);
  obj[el.dataset.list] = obj[el.dataset.list].filter((x) => x.id !== v);
  S.finTx = S.finTx.filter((t) => t.src !== `tick:${v}`); // its «دُفع» payment goes with it
  save(); render();
}
// The ✕ answers the touch itself. On a phone the browser may send the tap's click to the «دُفع» square
// next to it (touch adjustment), or the field being typed in may blur and redraw the list first;
// so the press is taken here, the field keeps focus, and the click that follows is swallowed.
let delPress = null;
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.pl-del');
  if (!b) return;
  e.preventDefault();
  delPress = { b, x: e.clientX, y: e.clientY };
});
document.addEventListener('pointerup', (e) => {
  const d = delPress; delPress = null;
  if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
  const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
  document.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 700);
  rowDelete(d.b);
});
document.addEventListener('pointercancel', () => { delPress = null; });
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
    case 'fin-spend-of': finUi.tab = 'spend'; finUi.month = v; finUi.plan = ''; render(); window.scrollTo({ top: 0 }); break;
    case 'fin-tab': finUi.tab = v; finUi.plan = ''; finUi.proj = ''; finUi.month = ''; render(); window.scrollTo({ top: 0 }); break;
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
      // one plan per period: the next month's plan already there opens instead
      const exist = m && S.finPlans.find((x) => x.kind === 'month' && x.month === m);
      if (exist) { finUi.tab = 'plans'; finUi.plan = exist.id; render(); toast(`لـ${monthName(m)} خطة من قبل، فتحتها لك`); break; }
      const clone = (l) => l.map((x) => ({ ...x, id: uid(), ...(x.done != null ? { done: false } : {}) }));
      // the next period follows on from this one's last day
      const rg = src.kind === 'month' && src.from && src.to ? { from: addDays(src.to, 1), to: addDays(addMonths(addDays(src.to, 1), 1), -1) } : src.kind === 'month' ? defaultRange(m) : { from: '', to: '' };
      const p = normalizeFinPlan({ ...src, ...rg, id: uid(), name: src.kind === 'month' ? `خطة ${monthName(m)}` : `${src.name} (نسخة)`, month: m, income: clone(src.income), fixed: clone(src.fixed), periodic: clone(src.periodic), accounts: clone(src.accounts), created: Date.now() });
      S.finPlans.push(p); save(); finUi.tab = 'plans'; finUi.plan = p.id; render(); toast('أُنشئت نسخة، عدّل ما تغيّر');
      break;
    }
    case 'fin-kind': {
      const p = getFinPlan(finUi.plan);
      // never two plans for one month: checked whether or not the plan kept its month
      if (v === 'month') {
        const m = p.month || today().slice(0, 7);
        if (S.finPlans.some((x) => x !== p && x.kind === 'month' && x.month === m)) { toast(`لـ${monthName(m)} خطة من قبل.`); break; }
        if (!p.month) Object.assign(p, { month: m }, defaultRange(m));
      }
      p.kind = v; save(); render(); break;
    }
    case 'fin-active': S.settings.finActive = v; save(); render(); toast('صارت خطتك الحالية'); break;
    case 'fin-del': if (!armed()) break; { const gone = getFinPlan(v); if (gone) { const ids = new Set(planRows(gone).map((r) => `tick:${r.x.id}`)); S.finTx = S.finTx.filter((t) => !ids.has(t.src)); } } S.finPlans = S.finPlans.filter((p) => p.id !== v); if (S.settings.finActive === v) S.settings.finActive = ''; finUi.plan = ''; save(); render(); toast('حُذفت الخطة'); break;
    case 'fin-row-add': {
      const obj = finScope(el.dataset.scope, el.dataset.sid);
      const L = el.dataset.list;
      const r = row({ name: '', amount: 0, ...(L === 'periodic' ? { every: 12 } : {}), ...(L === 'accounts' ? { balance: 0 } : {}), ...(L === 'items' ? { done: false } : {}) });
      obj[L].push(r); save(); render();
      const inp = $(`pl-n-${r.id}`) || $(`f-${L}-${r.id}-name`); if (inp) inp.focus();
      break;
    }
    case 'fin-row-del':
      // the lists' ✕ is handled at the touch itself (below); a key press (Enter) still comes here
      if (el.classList.contains('pl-del') && e.detail !== 0) break;
      rowDelete(el);
      break;
    case 'fin-month': finUi.month = v; render(); break;
    case 'fin-mode': ldraft.mode = v; for (const b of $('fmMode').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'fin-txkind': finUi.txKind = v; for (const b of $('txKind').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'fin-tx-del': { const t = S.finTx.find((x) => x.id === v); unpayTx(t); S.finTx = S.finTx.filter((x) => x.id !== v);
      // an item ticked «دُفع» by its payments (not by hand) is unticked when they no longer cover it
      { const pp = t && t.ref && t.ref !== 'out' && planForDate(t.d); const r = pp && planRows(pp).find((y) => y.x.id === t.ref);
        if (r && r.x.auto && !r.x.link && sum(S.finTx.filter((y) => y.kind === 'out' && y.ref === t.ref && inPlan(pp, y.d))) < r.plan - 0.5) { r.x.done = false; delete r.x.auto; } }       // a payment made by ticking «دُفع»: deleting it unticks its item
      if (t && t.src && t.src.startsWith('tick:')) { const pp = planForDate(t.d); const r = pp && planRows(pp).find((y) => y.x.id === t.src.slice(5)); if (r) { r.x.done = false; delete r.x.auto; } }
      syncAllPlans(); save(); render(); if (t && t.src && !t.src.startsWith('tick:')) toast(`حُذف، وأُلغي من ${linkLabel(t.src.split(':').slice(0, 2).join(':'))}`); break; }
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
      x.payments = x.payments.filter((p) => p.id !== v); if (ldraft.kind === 'debt') { dropPayment(`debt:${x.id}`, v); syncAllPlans(); } save(); openLedger(ldraft.kind, x.id); render();
      break;
    }
    case 'proj-new': { const p = normalizeFinProject({ name: 'مشروع جديد', items: [{ name: '', amount: 0 }], funding: [] }); S.finProjects.push(p); save(); finUi.proj = p.id; render(); break; }
    case 'proj-new-save': {
      const first = S.finPlans.filter((x) => x.kind === 'month' && x.month).map((x) => x.month).sort()[0] || curMonth();
      const p = normalizeFinProject({ kind: 'save', name: 'الادخار', from: first });
      S.finProjects.unshift(p); save(); finUi.proj = p.id; render(); window.scrollTo({ top: 0 });
      toast('أُنشئ. اكتب رصيد البداية إن كان معك مدخرات قبل أول شهر');
      break;
    }
    case 'proj-open': finUi.tab = 'projects'; finUi.proj = v; render(); window.scrollTo({ top: 0 }); break;
    case 'proj-paid': { const p = S.finProjects.find((x) => x.id === el.dataset.sid); if (p) { p.paidFrom = v; save(); render(); } break; }
    case 'proj-del': if (!armed()) break; S.finProjects = S.finProjects.filter((p) => p.id !== v); finUi.proj = ''; save(); render(); break;
  }
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'tdSpend') return;
  e.preventDefault();
  const amount = num($('tdAmt').value);
  if (!amount) { $('tdAmt').focus(); toast('اكتب المبلغ.'); return; }
  const t = normalizeTx({ amount, kind: 'out', item: $('tdWhy').value.trim(), d: today() });
  S.finTx.push(t);
  const p = planForDate(t.d);
  const named = !$('tdRef').value && p && planRows(p).find((r) => rowIs(r, t.item));
  const ref = $('tdRef').value || (named ? named.x.id : '');
  if (ref) assignTx(t, ref, planForDate(t.d));
  save(); render();
  const rm = ref && rowRemain(p, ref);
  toast(`سُجّل ${money(amount)}${rm ? ` | «${rm.name}»: ${rm.text}` : ref ? '' : '. أضفه إلى بنده لاحقاً من الخطة'}`);
});
// while choosing the item (or typing its name), say what is left of it before recording
function tdHintUpdate() {
  const el = $('tdHint');
  if (!el) return;
  const p = currentPlan();
  const why = ($('tdWhy').value || '').trim();
  const named = !$('tdRef').value && p && why && planRows(p).find((r) => rowIs(r, why));
  const rm = rowRemain(p, $('tdRef').value || (named ? named.x.id : ''), num($('tdAmt').value));
  el.textContent = rm ? `«${rm.name}»: ${num($('tdAmt').value) ? remainAfter(rm) : rm.text}` : '';
  el.classList.toggle('late', !!rm && rm.left < -0.5);
}
document.addEventListener('input', (e) => { if (['tdAmt', 'tdWhy'].includes(e.target.id)) tdHintUpdate(); });
document.addEventListener('change', (e) => { if (e.target.id === 'tdRef') tdHintUpdate(); });
document.addEventListener('change', (e) => {
  const id = e.target.dataset && e.target.dataset.assign;
  if (!id || !e.target.value) return;
  const t = S.finTx.find((x) => x.id === id);
  if (!t) return;
  assignTx(t, e.target.value, getFinPlan(e.target.dataset.plan));
  save(); render();
  toast(e.target.value === 'out' ? 'سُجّلت خارج المخطط' : `أُضيفت إلى «${t.item}»`);
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'finTxForm') return;
  e.preventDefault();
  const amount = num($('txAmount').value);
  if (!amount) { $('txAmount').focus(); toast('اكتب المبلغ.'); return; }
  const t = normalizeTx({ amount, kind: finUi.txKind || 'out', item: $('txItem').value.trim(), note: $('txNote').value.trim(), d: $('txDate').value || today() });
  S.finTx.push(t);
  const p = planForDate(t.d);
  const r = t.kind === 'out' && p && planRows(p).find((y) => rowIs(y, t.item));
  if (r) assignTx(t, r.x.id, p);
  const rm = r && rowRemain(p, r.x.id);
  save();
  render();
  $('txAmount').focus();
  toast(rm ? `سُجّل | «${rm.name}»: ${rm.text}` : 'سُجّل');
});

Object.assign(LibraryViews, { finance: viewFinance });
