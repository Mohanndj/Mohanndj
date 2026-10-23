'use strict';
// Bills, subscriptions and debt instalments appear by themselves as items in this month's plan (and
// later months'), each row carrying `link` ('sub:<id>' or 'debt:<id>'). A payment is entered once and
// lands everywhere: paying from the plan, from «اليوم», from «المصروف», from the bills page or from
// the debt page records the payment in its source, one spending entry (tx.src ties them), and ticks
// the plan item «دُفع». Deleting either side removes the other.

const curMonth = () => today().slice(0, 7);
const inMonth = (list, m) => list.filter((x) => x.d.slice(0, 7) === m);
const inPlanList = (list, p) => list.filter((x) => !x.pre && inPlan(p, x.d)); // «مسدد قبل الاستيراد» belongs to no plan
function linkSrc(key) {
  const [kind, id] = String(key || '').split(':');
  const src = kind === 'sub' ? S.subs.find((s) => s.id === id) : kind === 'debt' ? S.finDebts.find((d) => d.id === id) : kind === 'fine' ? S.fines.find((f) => f.id === id) : null;
  return src ? { kind, src, pays: kind === 'sub' ? src.paid : src.payments } : null;
}
// a bill's date falls in plan p's period (its next date or one after it), or it is late and p is this period's plan
function subDueIn(s, p) {
  const { from, to } = finRange(p);
  if (s.next < from && inPlan(p, today())) return true;
  for (let k = 0, d = s.next; d <= to && k < 200; k++, d = addMonths(s.next, k * s.every)) if (d >= from) return true;
  return false;
}
// what should be in plan p (its own period)
function linkSources(p) {
  const out = [];
  for (const s of S.subs) if (s.active && s.amount) {
    // «كاملاً في خطة شهر موعده»: the whole amount, only in a plan whose period has its date (or a payment of it, or it is late)
    if (s.whole && s.every > 1) { if (subDueIn(s, p) || sum(inPlanList(s.paid, p))) out.push({ key: `sub:${s.id}`, name: s.name, amount: s.amount, every: 1 }); }
    else out.push({ key: `sub:${s.id}`, name: s.name, amount: s.amount, every: s.every });
  }
  for (const d of S.finDebts) {
    const paidIn = sum(inPlanList(d.payments, p));
    if (d.monthly && (debtLeft(d) > 0 || paidIn)) out.push({ key: `debt:${d.id}`, name: `قسط ${d.name}`, match: d.name, amount: Math.min(d.monthly, debtLeft(d) + paidIn), every: 1 });
  }
  // a traffic violation stays in the plan until it is paid
  for (const f of S.fines) {
    const paidIn = sum(inPlanList(f.payments, p));
    // each violation is its own item (never joined to another row): its kind, place and date
    // only when the user chose to put it in the plan (it may wait for later); one paid in this plan stays
    if ((f.plan && fineLeft(f) > 0) || paidIn) out.push({ key: `fine:${f.id}`, name: `${fineName(f)} (${fmtDate(f.date, { day: 'numeric', month: 'short' })})`, amount: fineLeft(f) + paidIn, every: 1, own: true });
  }
  return out;
}
const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const finRowKnown = (id) => !!id && S.finPlans.some((q) => q.fixed.some((x) => x.id === id) || q.periodic.some((x) => x.id === id));
// keep a monthly plan of this month or later in step with its sources; past months stay as they were
function syncPlanLinks(p) {
  if (!p || p.kind !== 'month' || !p.month) return false;
  // a past plan keeps its items as they were; only its linked items' «دُفع» follows the payments made in it
  if (finRange(p).to < today()) {
    let ch = false;
    for (const r of [...p.fixed, ...p.periodic]) {
      if (!r.link) continue;
      const ls = linkSrc(r.link);
      if (!ls) continue;
      const done = sum(inPlanList(ls.pays, p)) >= r.amount - 0.5;
      if (!!r.done !== done) { r.done = done; ch = true; }
    }
    return ch;
  }
  let changed = false;
  const srcs = linkSources(p);
  const all = () => [...p.fixed, ...p.periodic];
  for (const s of srcs) {
    if (p.unlinked.includes(s.key)) continue;
    let r = all().find((x) => x.link === s.key);
    // a row the user already wrote for it (from their sheet, say) is linked rather than duplicated
    if (!r && !s.own) { const want = normName(s.match || s.name); r = want.length >= 3 && all().find((x) => !x.link && x.name && !spendName(x.name) && (normName(x.name).includes(want) || (normName(x.name).length >= 3 && want.includes(normName(x.name))))); if (r) { r.link = s.key; changed = true; } }
    const list = s.every > 1 ? 'periodic' : 'fixed';
    if (!r) { r = row({ name: s.name, amount: s.amount, ...(list === 'periodic' ? { every: s.every } : {}), done: false }); r.link = s.key; p[list].push(r); changed = true; }
    else if (!p[list].includes(r)) { p.fixed = p.fixed.filter((x) => x !== r); p.periodic = p.periodic.filter((x) => x !== r); r = row({ ...r, ...(list === 'periodic' ? { every: s.every } : {}) }); if (list === 'fixed') delete r.every; r.link = s.key; p[list].push(r); changed = true; }
    // its payments in this period made before the row existed (or for a row since removed) belong to it, else they count twice
    for (const t of S.finTx) if (t.src && t.src.startsWith(`${s.key}:`) && t.ref !== r.id && inPlan(p, t.d) && !finRowKnown(t.ref)) { t.ref = r.id; changed = true; }
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
function payLink(key, amount, d, tx, plan) {
  const l = linkSrc(key);
  if (!l || !amount) return null;
  const pay = { id: uid(), d, amount, note: '' };
  l.pays.push(pay);
  // a bill paid late may move on several cycles: the payment remembers where it was, for undoing it
  // paid from a plan: a bill already due after that plan's period (paid earlier, outside the app) keeps its date
  if (l.kind === 'sub') { pay.prevNext = l.src.next; if (!plan || l.src.next <= finRange(plan).to) { let next = l.src.next; do { next = addMonths(next, l.src.every); } while (next <= d); l.src.next = next; } }
  let r = rowOfLink(key, d);
  if (!tx) { tx = normalizeTx({ amount, kind: 'out', item: r ? r.name : l.src.name, d }); S.finTx.push(tx); }
  tx.src = `${key}:${pay.id}`;
  // the plan's item may only appear now (a fine out of the plan, paid in this period): tie the entry to it after the sync
  syncAllPlans();
  r = rowOfLink(key, d);
  if (r) tx.ref = r.id;
  return tx;
}
// undo: remove the source payment of a spending entry (or the entry of a source payment)
function unpayTx(t) {
  if (!t || !t.src) return;
  const [kind, id, payId] = t.src.split(':');
  const l = linkSrc(`${kind}:${id}`);
  if (l) {
    const i = l.pays.findIndex((p) => p.id === payId);
    if (i >= 0) {
      const [q] = l.pays.splice(i, 1);
      const after = l.kind === 'sub' && q.prevNext && l.pays.slice(i).find((x) => x.prevNext);
      if (after) {
        // a later payment stays: the date goes back only by what this one moved it, and the later one now starts from here
        let n = 0; for (let d = q.prevNext; d < after.prevNext && n < 200; n++) d = addMonths(d, l.src.every);
        for (let k = 0; k < n; k++) l.src.next = addMonths(l.src.next, -l.src.every);
        after.prevNext = q.prevNext;
      } else if (l.kind === 'sub') l.src.next = q.prevNext || addMonths(l.src.next, -l.src.every);
    }
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
