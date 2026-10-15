'use strict';
// Bills, subscriptions and debt instalments appear by themselves as items in this month's plan (and
// later months'), each row carrying `link` ('sub:<id>' or 'debt:<id>'). A payment is entered once and
// lands everywhere: paying from the plan, from «اليوم», from «المصروف», from the bills page or from
// the debt page records the payment in its source, one spending entry (tx.src ties them), and ticks
// the plan item «دُفع». Deleting either side removes the other.

const curMonth = () => today().slice(0, 7);
const inMonth = (list, m) => list.filter((x) => x.d.slice(0, 7) === m);
const inPlanList = (list, p) => list.filter((x) => inPlan(p, x.d));
function linkSrc(key) {
  const [kind, id] = String(key || '').split(':');
  const src = kind === 'sub' ? S.subs.find((s) => s.id === id) : kind === 'debt' ? S.finDebts.find((d) => d.id === id) : kind === 'fine' ? S.fines.find((f) => f.id === id) : null;
  return src ? { kind, src, pays: kind === 'sub' ? src.paid : src.payments } : null;
}
// what should be in plan p (its own period)
function linkSources(p) {
  const out = [];
  for (const s of S.subs) if (s.active && s.amount) out.push({ key: `sub:${s.id}`, name: s.name, amount: s.amount, every: s.every });
  for (const d of S.finDebts) {
    const paidIn = sum(inPlanList(d.payments, p));
    if (d.monthly && (debtLeft(d) > 0 || paidIn)) out.push({ key: `debt:${d.id}`, name: `قسط ${d.name}`, match: d.name, amount: Math.min(d.monthly, debtLeft(d) + paidIn), every: 1 });
  }
  // a traffic violation stays in the plan until it is paid
  for (const f of S.fines) {
    const paidIn = sum(inPlanList(f.payments, p));
    // each violation is its own item (never joined to another row): its kind, place and date
    if (fineLeft(f) > 0 || paidIn) out.push({ key: `fine:${f.id}`, name: `${fineName(f)} (${fmtDate(f.date, { day: 'numeric', month: 'short' })})`, amount: fineLeft(f) + paidIn, every: 1, own: true });
  }
  return out;
}
const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// keep a monthly plan of this month or later in step with its sources; past months stay as they were
function syncPlanLinks(p) {
  if (!p || p.kind !== 'month' || !p.month || finRange(p).to < today()) return false;
  let changed = false;
  const srcs = linkSources(p);
  const all = () => [...p.fixed, ...p.periodic];
  for (const s of srcs) {
    if (p.unlinked.includes(s.key)) continue;
    let r = all().find((x) => x.link === s.key);
    // a row the user already wrote for it (from their sheet, say) is linked rather than duplicated
    if (!r && !s.own) { const want = normName(s.match || s.name); r = want.length >= 3 && all().find((x) => !x.link && x.name && (normName(x.name).includes(want) || (normName(x.name).length >= 3 && want.includes(normName(x.name))))); if (r) { r.link = s.key; changed = true; } }
    const list = s.every > 1 ? 'periodic' : 'fixed';
    if (!r) { r = row({ name: s.name, amount: s.amount, ...(list === 'periodic' ? { every: s.every } : {}), done: false }); r.link = s.key; p[list].push(r); changed = true; }
    else if (!p[list].includes(r)) { p.fixed = p.fixed.filter((x) => x !== r); p.periodic = p.periodic.filter((x) => x !== r); r = row({ ...r, ...(list === 'periodic' ? { every: s.every } : {}) }); r.link = s.key; p[list].push(r); changed = true; }
    const ls = linkSrc(s.key);
    const done = sum(inPlanList(ls.pays, p)) >= s.amount - 0.5;
    if (s.own && r.name !== s.name) { r.name = s.name; changed = true; }
    if (r.amount !== s.amount || (list === 'periodic' && r.every !== s.every) || !!r.done !== done) { r.amount = s.amount; if (list === 'periodic') r.every = s.every; r.done = done; changed = true; }
  }
  // a source that was deleted, stopped or paid off leaves the plan
  for (const list of ['fixed', 'periodic']) {
    const keep = p[list].filter((x) => !x.link || srcs.some((s) => s.key === x.link));
    if (keep.length !== p[list].length) { p[list] = keep; changed = true; }
  }
  return changed;
}
function syncAllPlans() {
  let changed = false;
  for (const p of S.finPlans) if (syncPlanLinks(p)) changed = true;
  if (changed) save();
}
const rowOfLink = (key, d) => { const p = planForDate(d); return p ? [...p.fixed, ...p.periodic].find((x) => x.link === key) : null; };
const linkLabel = (key) => { const l = linkSrc(key); return l ? (l.kind === 'sub' ? `${BILL_KIND[l.src.kind]} «${l.src.name}»` : l.kind === 'fine' ? `المخالفات المرورية${discLine(l.src) ? ` | ${discLine(l.src)}` : ''}` : `دَين «${l.src.name}»`) : ''; };

// one payment, recorded in its source and as one spending entry
function payLink(key, amount, d, tx) {
  const l = linkSrc(key);
  if (!l || !amount) return null;
  const pay = { id: uid(), d, amount, note: '' };
  l.pays.push(pay);
  if (l.kind === 'sub') { let next = l.src.next; do { next = addMonths(next, l.src.every); } while (next <= d); l.src.next = next; }
  const r = rowOfLink(key, d);
  if (!tx) { tx = normalizeTx({ amount, kind: 'out', item: r ? r.name : l.src.name, d }); S.finTx.push(tx); }
  tx.src = `${key}:${pay.id}`;
  if (r) tx.ref = r.id;
  syncAllPlans();
  return tx;
}
// undo: remove the source payment of a spending entry (or the entry of a source payment)
function unpayTx(t) {
  if (!t || !t.src) return;
  const [kind, id, payId] = t.src.split(':');
  const l = linkSrc(`${kind}:${id}`);
  if (l) {
    const i = l.pays.findIndex((p) => p.id === payId);
    if (i >= 0) { l.pays.splice(i, 1); if (l.kind === 'sub') l.src.next = addMonths(l.src.next, -l.src.every); }
  }
}
function dropPayment(key, payId) {
  S.finTx = S.finTx.filter((t) => t.src !== `${key}:${payId}`);
}
// unticking a linked item: undo its payments within the plan's period
function unpayLinkPlan(key, p) {
  const mine = (x) => x.src && x.src.startsWith(`${key}:`) && inPlan(p, x.d);
  for (const t of S.finTx.filter(mine)) unpayTx(t);
  S.finTx = S.finTx.filter((x) => !mine(x));
  const l = linkSrc(key);
  if (l) { const left = inPlanList(l.pays, p); for (const q of left) l.pays.splice(l.pays.indexOf(q), 1); }
  syncAllPlans();
}
