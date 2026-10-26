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
// a row is the same item as a bill or debt when its name is that name: «فاتورة الكهرباء» = «الكهرباء», «قسط خالد» = «خالد»
// (not a name that merely contains it: «هدية خالد» is not the debt «خالد»)
const linkBare = (s) => normName(s).replace(/^(?:قسط|أقساط|فاتورة|اشتراك|دين|دَين|سداد)\s+/, '').replace(/^ال/, '');
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
  // two devices may each have added the same linked item before they synced: one row per source (its entries move to it)
  const seen = new Map();
  for (const list of ['fixed', 'periodic']) {
    p[list] = p[list].filter((x) => {
      if (!x.link) return true;
      const k = seen.get(x.link);
      if (!k) { seen.set(x.link, x); return true; }
      for (const t of S.finTx) if (t.ref === x.id) t.ref = k.id;
      changed = true;
      return false;
    });
  }
  const srcs = linkSources(p);
  const all = () => [...p.fixed, ...p.periodic];
  for (const s of srcs) {
    if (p.unlinked.includes(s.key)) continue;
    let r = all().find((x) => x.link === s.key);
    // a row the user already wrote for it (from their sheet, say) is linked rather than duplicated
    if (!r && !s.own) {
      const want = [s.match, s.name].filter(Boolean).map(linkBare).filter((x) => x.length >= 2);
      r = want.length && all().find((x) => !x.link && x.name && !spendName(x.name) && want.includes(linkBare(x.name)));
      if (r) {
        r.link = s.key; changed = true;
        // what was already paid on the row in this period (its «دُفع», or spending recorded to it) becomes payments
        // of its source: the row stays paid and is not paid a second time through the bill or debt
        const ls0 = linkSrc(s.key), was = S.finTx.filter((t) => t.kind === 'out' && inPlan(p, t.d) && (t.src === `tick:${r.id}` || (!t.src && t.ref === r.id)));
        const next0 = ls0.kind === 'sub' ? ls0.src.next : '';
        for (const t of was) { const pay = { id: uid(), d: t.d, amount: t.amount, note: '' }; if (next0) { pay.prevNext = next0; pay.planTo = finRange(p).to; } ls0.pays.push(pay); t.src = `${s.key}:${pay.id}`; t.ref = r.id; }
        // the bill paid in full here moves to its next date, as paying it from the plan does
        if (next0 && sum(was, (t) => t.amount) >= s.amount - 0.5 && next0 <= finRange(p).to) { let next = next0; const last = was.reduce((m, t) => (t.d > m ? t.d : m), ''); do { next = addMonths(next, ls0.src.every); } while (next <= last); ls0.src.next = next; }
      }
    }
    const list = s.every > 1 ? 'periodic' : 'fixed';
    if (!r) { r = row({ name: s.name, amount: s.amount, ...(list === 'periodic' ? { every: s.every } : {}), done: false }); r.link = s.key; p[list].push(r); changed = true; }
    else if (!p[list].includes(r)) { p.fixed = p.fixed.filter((x) => x !== r); p.periodic = p.periodic.filter((x) => x !== r); r = row({ ...r, ...(list === 'periodic' ? { every: s.every } : {}) }); if (list === 'fixed') delete r.every; r.link = s.key; p[list].push(r); changed = true; }
    // its payments in this period made before the row existed (or for a row since removed) belong to it, else they count twice
    for (const t of S.finTx) if (t.src && t.src.startsWith(`${s.key}:`) && t.ref !== r.id && inPlan(p, t.d) && !finRowKnown(t.ref)) { t.ref = r.id; changed = true; }
    const ls = linkSrc(s.key);
    const inP = inPlanList(ls.pays, p);
    // its share: put aside this month, or the bill paid in it
    const done = ls.kind === 'sub' && subShare(ls.src) ? inP.some((q) => !q.aside) || sum(inP) >= s.amount / s.every - 0.5 : sum(inP) >= s.amount - 0.5;
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

// a bill paid every few months whose share is in every month's plan (v131, the owner's choice: «دُفع» on a month
// that is not its due month = its share of this month put aside): the share counts as spent in its month, and on
// its due date only what is left of it is paid
const subShare = (s) => s.every > 1 && !s.whole;
// what was put aside for it since it was last paid
function subAside(s) {
  const last = s.paid.filter((q) => !q.aside).reduce((m, q) => (q.d > m ? q.d : m), '');
  return sum(s.paid.filter((q) => q.aside && q.d >= last));
}
// one payment, recorded in its source and as one spending entry
function payLink(key, amount, d, tx, plan) {
  const l = linkSrc(key);
  if (!l || !amount) return null;
  const pay = { id: uid(), d, amount, note: '' };
  l.pays.push(pay);
  // its share put aside in a month that is not its due month: the bill keeps its date
  if (l.kind === 'sub' && subShare(l.src) && plan && !subDueIn(l.src, plan)) pay.aside = true;
  // a bill paid late may move on several cycles: the payment remembers where it was, for undoing it
  // paid from a plan: a bill already due after that plan's period (paid earlier, outside the app) keeps its date
  if (l.kind === 'sub' && !pay.aside) { pay.prevNext = l.src.next; if (plan) pay.planTo = finRange(plan).to; if (!plan || l.src.next <= finRange(plan).to) { let next = l.src.next; do { next = addMonths(next, l.src.every); } while (next <= d); l.src.next = next; } }
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
      const later = l.kind === 'sub' && q.prevNext && !q.aside ? l.pays.slice(i).filter((x) => x.prevNext) : [];
      if (later.length) {
        // later payments stay: the date goes back to where this one found it, and they move it on again by the
        // same rule as when they were made (one paid from a plan whose period ends before the date leaves it)
        let next = q.prevNext;
        for (const x of later) { x.prevNext = next; if (!x.planTo || next <= x.planTo) { let n = 0; do { next = addMonths(next, l.src.every); } while (next <= x.d && ++n < 200); } }
        l.src.next = next;
      } else if (l.kind === 'sub' && !q.aside) l.src.next = q.prevNext || addMonths(l.src.next, -l.src.every);
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
