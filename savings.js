'use strict';
// «الادخار»: a financial project of its own kind that every monthly plan feeds. Each finished month
// adds what was really left of its income (from the payments you recorded; if you recorded none,
// the plan's «المتبقي للادخار»), and you can correct any month by hand. With a starting balance and
// deposits or withdrawals by hand, it tells you how much cash you have. The current month shows as
// expected, and is added when the month ends.

const isSaving = (p) => p.kind === 'save';
const savingProject = () => S.finProjects.find(isSaving);

function saveCalc(p) {
  const t0 = today();
  const plans = S.finPlans.filter((x) => x.kind === 'month' && x.month && x.month >= (p.from || '0000') && finRange(x).from <= t0).sort((a, b) => finRange(a).from.localeCompare(finRange(b).from));
  const months = [...new Set(plans.map((x) => x.month))];
  const rows = months.map((m) => {
    const a = planActual(monthPlan(m));
    const cur = inPlan(monthPlan(m), t0) ? m : '';
    const tracked = a.spent > 0;
    // a finished month: what was really left; this month: what is left after paying the rest of its plan
    const auto = Math.round((tracked ? (m === cur ? a.inHand - a.toPay : a.inHand) : a.left) * 100) / 100;
    const set = p.overrides[m];
    return { m, auto, tracked, manual: set != null, amount: set != null ? set : auto, pending: m === cur };
  });
  const done = rows.filter((r) => !r.pending);
  const fromMonths = sum(done, (r) => r.amount);
  const moves = sum(p.moves);
  const cash = p.opening + fromMonths + moves;
  const pend = rows.find((r) => r.pending);
  return { rows, fromMonths, moves, cash, pending: pend ? pend.amount : 0, expected: cash + (pend ? pend.amount : 0), pct: p.goal ? Math.max(0, Math.min(100, Math.round((cash / p.goal) * 100))) : 0 };
}

function savingCardHTML(x) {
  const c = saveCalc(x);
  return `<button type="button" class="fin-card save-card" data-action="proj-open" data-v="${x.id}">
    <span class="row-between"><b>💰 ${esc(x.name)}</b><b class="${c.cash < 0 ? 'late' : 'ok'}">${money(c.cash)}</b></span>
    <small>نقدك المدخر الآن${c.pending ? ` · ويُتوقع من هذا الشهر ${money(c.pending)}` : ''}${x.goal ? ` · الهدف ${money(x.goal)} (${c.pct}٪)` : ''}</small>
    ${x.goal ? `<div class="progress-line"><i style="width:${c.pct}%"></i></div>` : ''}
  </button>`;
}

function savingDetailHTML(p) {
  const c = saveCalc(p);
  const ap = activePlan();
  const accounts = ap ? sum(ap.accounts, (x) => x.balance) : 0;
  const src = (r) => (r.manual ? 'عدّلته بيدك' : r.tracked ? 'فعلي: الدخل ناقص ما صرفته' : 'على الورق: من الخطة');
  return `<section class="section fin-plan">
    <div class="crumbs"><button type="button" class="back" data-action="fin-close">${icon('back')} المشاريع</button></div>
    <input type="text" class="fin-title" id="fj-name" data-fin="proj" data-sid="${p.id}" data-k="name" value="${esc(p.name)}" aria-label="اسم المشروع" autocomplete="off">
    <div class="save-hero"><small>نقدك المدخر الآن</small><b class="${c.cash < 0 ? 'neg' : ''}">${money(c.cash)}</b>
      ${c.pending ? `<small>ويُتوقع أن يُضاف آخر هذا الشهر ${money(c.pending)} بعد دفع ما بقي من مصاريفه، فيصير ${money(c.expected)}</small>` : ''}</div>
    ${p.goal ? `<div class="progress-line"><i style="width:${c.pct}%"></i></div><p class="note-text">بلغت ${c.pct}٪ من هدفك ${money(p.goal)}${c.cash < p.goal ? `، بقي ${money(p.goal - c.cash)}` : ' ✓'}.</p>` : ''}
    <div class="fin-tiles"><span><b>${money(p.opening)}</b>رصيد البداية</span><span><b>${money(c.fromMonths)}</b>ادخار الأشهر</span><span><b>${money(c.moves)}</b>إيداع وسحب</span></div>
    ${accounts ? `<p class="note-text">أرصدة حساباتك في خطة «${esc(planTitle(ap))}»: ${money(accounts)}${Math.abs(accounts - c.cash) > 0.5 ? ` · الفرق عن هنا ${money(accounts - c.cash)}. إن كانت أرصدتك أدق، أضف الفرق إيداعاً أو سحباً.` : ' · مطابقة ✓'}</p>` : ''}

    <div class="panel"><h3>ادخار كل شهر <small>${money(c.fromMonths)}</small></h3>
      <p class="note-text">يأتي وحده من خططك الشهرية: ما بقي فعلاً من الدخل بعد ما سجّلته من مصروف، أو «المتبقي للادخار» إن لم تسجّل شيئاً. صحّح أي شهر بكتابة المبلغ.</p>
      ${c.rows.length ? `<ul class="save-months">${c.rows.slice().reverse().map((r) => `<li class="${r.pending ? 'pending' : ''}">
        <span><b>${esc(monthName(r.m))}</b><small>${r.pending ? 'هذا الشهر: المتوقع، ويُضاف عند انتهائه' : src(r)}</small></span>
        <input type="text" inputmode="decimal" class="num-in" data-save-ov="${p.id}" data-m="${r.m}" value="${r.amount}" aria-label="ادخار ${esc(monthName(r.m))}" data-novoice>
        ${r.manual ? `<button type="button" class="ghost sm" data-action="save-auto" data-sid="${p.id}" data-v="${r.m}" title="ارجع للحساب التلقائي (${money(r.auto)})">تلقائي</button>` : '<span></span>'}
      </li>`).join('')}</ul>` : '<p class="note-text">لا خطط شهرية بعد. أنشئ خطة لكل شهر فيصل ادخارها إلى هنا.</p>'}
    </div>

    <div class="panel"><h3>إيداع أو سحب بيدك <small>${money(c.moves)}</small></h3>
      <form class="fin-tx save-move" id="svMove" data-sid="${p.id}" autocomplete="off">
        <div class="seg" role="group" id="svKind">${[['in', 'أودعت'], ['out', 'سحبت']].map(([v, l]) => `<button type="button" data-action="save-kind" data-v="${v}" aria-pressed="${(finUi.svKind || 'in') === v}">${l}</button>`).join('')}</div>
        <div class="fin-tx-row"><input type="text" inputmode="decimal" id="svAmt" class="num-in" placeholder="المبلغ" aria-label="المبلغ" data-novoice><input type="text" id="svNote" placeholder="لماذا؟ مثل: مكافأة، سفر" aria-label="ملاحظة"></div>
        <button type="submit" class="primary">سجّل</button>
      </form>
      ${p.moves.length ? `<ul class="fin-txs">${p.moves.slice().sort((a, b) => b.d.localeCompare(a.d)).map((x) => `<li class="${x.amount < 0 ? 'out' : 'in'}"><span><b>${x.amount < 0 ? '−' : '+'}${money(Math.abs(x.amount))}</b> ${esc(x.note || (x.amount < 0 ? 'سحب' : 'إيداع'))} <small>${esc(relDate(x.d))}</small></span><button type="button" class="fin-del" data-action="save-move-del" data-sid="${p.id}" data-v="${x.id}" aria-label="حذف">✕</button></li>`).join('')}</ul>` : ''}
    </div>

    <div class="panel"><h3>الإعدادات</h3>
      <div class="grid2">
        <label class="field"><span>رصيد البداية</span><input type="text" inputmode="decimal" class="num-in" id="sv-open" data-fin="proj" data-sid="${p.id}" data-k="opening" value="${p.opening || ''}" placeholder="ما معك قبل أول شهر" data-novoice></label>
        <label class="field"><span>يبدأ الحساب من شهر</span><input type="month" id="sv-from" data-fin="proj" data-sid="${p.id}" data-k="from" value="${p.from}"></label>
      </div>
      <label class="field"><span>هدف الادخار (اختياري)</span><input type="text" inputmode="decimal" class="num-in" id="sv-goal" data-fin="proj" data-sid="${p.id}" data-k="goal" value="${p.goal || ''}" placeholder="مثال: 50000" data-novoice></label>
      <textarea id="fj-note" data-fin="proj" data-sid="${p.id}" data-k="note" rows="2" placeholder="ملاحظات">${esc(p.note)}</textarea>
    </div>
    <div class="btn-row"><button type="button" class="danger" data-action="proj-del" data-v="${p.id}">حذف مشروع الادخار</button></div>
  </section>`;
}

function savingSheet(p) {
  const c = saveCalc(p);
  const R = [[{ v: p.name, s: 'title', span: 3 }], [{ v: `مشروع ادخار · صُدّر ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 3 }], []];
  R.push(['نقدك المدخر', 'رصيد البداية', 'الهدف'].map((v) => ({ v, s: 'head' })));
  R.push([{ v: c.cash, s: 'big' }, { v: p.opening, s: 'num' }, { v: p.goal || '', s: 'num' }], []);
  R.push([{ v: 'ادخار كل شهر', s: 'sec', span: 3 }], ['الشهر', 'المبلغ', 'مصدره'].map((v) => ({ v, s: 'head' })));
  for (const r of c.rows) R.push([{ v: monthName(r.m), s: 'txt' }, { v: r.amount, s: 'num' }, { v: r.pending ? 'هذا الشهر (لم يُضف بعد)' : r.manual ? 'معدّل يدوياً' : r.tracked ? 'فعلي' : 'على الورق', s: 'txt' }]);
  if (p.moves.length) {
    R.push([], [{ v: 'إيداع وسحب', s: 'sec', span: 3 }], ['التاريخ', 'المبلغ', 'ملاحظة'].map((v) => ({ v, s: 'head' })));
    for (const x of p.moves) R.push([{ v: fmtDate(x.d, { day: 'numeric', month: 'short', year: 'numeric' }), s: 'txt' }, { v: x.amount, s: 'num' }, { v: x.note, s: 'txt' }]);
  }
  return { name: p.name, design: true, widths: [24, 16, 26], rows: R };
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="save-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'save-kind') { finUi.svKind = v; for (const b of $('svKind').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); return; }
  const p = S.finProjects.find((x) => x.id === el.dataset.sid);
  if (!p) return;
  if (action === 'save-auto') { delete p.overrides[v]; save(); render(); }
  if (action === 'save-move-del') { p.moves = p.moves.filter((x) => x.id !== v); save(); render(); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!el.dataset || !el.dataset.saveOv) return;
  const p = S.finProjects.find((x) => x.id === el.dataset.saveOv);
  if (!p) return;
  const auto = saveCalc({ ...p, overrides: {} }).rows.find((r) => r.m === el.dataset.m);
  const val = num(el.value);
  if (el.value.trim() === '' || (auto && Math.abs(auto.amount - val) < 0.01)) delete p.overrides[el.dataset.m]; else p.overrides[el.dataset.m] = val;
  save(); render();
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'svMove') return;
  e.preventDefault();
  const p = S.finProjects.find((x) => x.id === e.target.dataset.sid);
  const amount = num($('svAmt').value);
  if (!p || !amount) { toast('اكتب المبلغ.'); return; }
  const out = (finUi.svKind || 'in') === 'out';
  p.moves.push({ id: uid(), d: today(), amount: out ? -Math.abs(amount) : Math.abs(amount), note: $('svNote').value.trim() });
  save(); render();
  toast(out ? `سُحب ${money(amount)}` : `أُودع ${money(amount)}`);
});
