'use strict';
// «الاشتراكات والفواتير» and «الشراء المؤجل», both inside «المالية».
// Subscriptions/bills: amount, how often, next date, a reminder some days before; «دفعت» logs the
// payment (and the spending) and moves the date on. Deferred buying: write what you want with its
// price, wait (30 days by default), then decide; what you let go counts as saved.

const CYCLE = [[1, 'شهري'], [2, 'كل شهرين'], [3, 'كل ٣ أشهر'], [6, 'كل ٦ أشهر'], [12, 'سنوي']];
const BILL_KIND = { sub: 'اشتراك', bill: 'فاتورة' };

function normalizeSub(x) {
  return {
    id: x.id || uid(), name: String(x.name || ''), kind: BILL_KIND[x.kind] ? x.kind : 'sub', amount: num(x.amount), every: CYCLE.some(([m]) => m === Number(x.every)) ? Number(x.every) : 1,
    next: x.next || today(), remind: Math.max(0, Number(x.remind ?? 3)), auto: !!x.auto, active: x.active !== false, note: String(x.note || ''),
    paid: payments(x.paid), created: x.created || Date.now(),
  };
}
function normalizeLater(x) {
  return {
    id: x.id || uid(), name: String(x.name || ''), price: num(x.price), why: String(x.why || ''), url: String(x.url || ''),
    wait: Math.max(1, Number(x.wait) || 30), added: x.added || today(), decision: ['bought', 'dropped'].includes(x.decision) ? x.decision : '', decidedAt: x.decidedAt || '', created: x.created || Date.now(),
  };
}
const addMonths = (d, n) => { const x = parse(d); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return iso(x); };
const subMonthly = (s) => s.amount / s.every;
const subsDue = () => S.subs.filter((s) => s.active && daysBetween(today(), s.next) <= s.remind);
const laterReady = (x) => !x.decision && daysBetween(x.added, today()) >= x.wait;

// ---------- subscriptions and bills ----------
function finBillsHTML() {
  const list = S.subs.slice().sort((a, b) => b.active - a.active || a.next.localeCompare(b.next));
  const act = S.subs.filter((s) => s.active);
  return `<section class="section">
    <div class="section-head"><h2>الاشتراكات والفواتير</h2>${addBtn('sub-new', 'اشتراك أو فاتورة')}</div>
    ${act.length ? `<div class="fin-tiles"><span><b>${money(sum(act, subMonthly))}</b>شهرياً</span><span><b>${money(sum(act, subMonthly) * 12)}</b>سنوياً</span><span><b>${act.length}</b>اشتراكات نشطة</span></div>` : ''}
    ${list.length ? `<div class="book-list">${list.map((s) => { const n = daysBetween(today(), s.next); return `<article class="fin-card${s.active ? '' : ' cleared'}">
      <button type="button" class="hz-main" data-action="sub-open" data-v="${s.id}">
        <span class="row-between"><b>${esc(s.name)}</b><b>${money(s.amount)}</b></span>
        <small>${BILL_KIND[s.kind]} | ${CYCLE.find(([m]) => m === s.every)[1]}${s.auto ? ' | يُخصم تلقائياً' : ''}${s.active ? '' : ' | موقوف'}</small>
        ${s.active ? `<small class="${n <= s.remind ? 'late' : ''}">${n < 0 ? `متأخر ${daysWord(-n)}` : n === 0 ? 'موعده اليوم' : `الموعد ${afterDays(n)} | ${esc(fmtDate(s.next, { day: 'numeric', month: 'long' }))}`}</small>` : ''}
      </button>
      ${s.active ? `<div class="btn-row"><button type="button" class="ghost" data-action="sub-paid" data-v="${s.id}">${s.auto ? 'خُصم ✓' : 'دفعت ✓'}</button></div>` : ''}
    </article>`; }).join('')}</div>
    ${act.length ? '<p class="note-text explain">🔗 تظهر تلقائياً بنوداً في خطة هذا الشهر وما بعده، و«دفعت» يسجّلها في المصروف ويؤشّر عليها في الخطة.</p>' : ''}`
      : emptyHTML('لا اشتراكات ولا فواتير', 'سجّل اشتراكاتك وفواتيرك (الجوال، الإنترنت، التأمين، تجديد الاستمارة…) ومواعيدها، فيذكّرك التطبيق قبلها في صفحة «اليوم».', addBtn('sub-new', 'أضف أول واحد'))}
  </section>`;
}
function openSub(id) {
  const s = id ? S.subs.find((x) => x.id === id) : normalizeSub({});
  ldraft = { kind: 'sub', id: s.id, isNew: !id, sk: s.kind };
  $('libForm').innerHTML = `${sheetHead(id ? esc(s.name) : 'اشتراك أو فاتورة')}
    <div class="seg" id="sbKind" role="group">${Object.entries(BILL_KIND).map(([k, l]) => `<button type="button" data-action="sub-kind" data-v="${k}" aria-pressed="${s.kind === k}">${l}</button>`).join('')}</div>
    <label class="field"><span>الاسم</span><input type="text" id="sbName" value="${esc(s.name)}" autocomplete="off" placeholder="مثال: باقة الجوال، نتفليكس، تأمين السيارة"></label>
    <div class="grid2">
      <label class="field"><span>المبلغ</span><input type="text" inputmode="decimal" class="num-in" id="sbAmount" value="${s.amount || ''}" data-novoice></label>
      <label class="field"><span>يتكرر</span><select id="sbEvery">${CYCLE.map(([m, l]) => `<option value="${m}"${s.every === m ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="grid2">
      <label class="field"><span>الموعد القادم</span><input type="date" id="sbNext" value="${s.next}"></label>
      <label class="field"><span>ذكّرني قبله</span><select id="sbRemind">${[0, 1, 3, 7, 14].map((d) => `<option value="${d}"${s.remind === d ? ' selected' : ''}>${d ? `${d} ${d === 1 ? 'يوم' : d <= 10 ? 'أيام' : 'يوماً'}` : 'في يومه'}</option>`).join('')}</select></label>
    </div>
    <label class="switch"><input type="checkbox" id="sbAuto"${s.auto ? ' checked' : ''}><span>يُخصم تلقائياً من حسابي</span></label>
    ${id ? `<label class="switch"><input type="checkbox" id="sbActive"${s.active ? ' checked' : ''}><span>نشط (أطفئه إذا ألغيت الاشتراك)</span></label>` : ''}
    <label class="field"><span>ملاحظة</span><input type="text" id="sbNote" value="${esc(s.note)}" autocomplete="off"></label>
    ${id && s.paid.length ? `<div class="field"><span>المدفوعات</span><ul class="ppl-hist">${s.paid.slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 12).map((p) => `<li><span>${money(p.amount)} | ${esc(dateBoth(p.d, true))}</span></li>`).join('')}</ul></div>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}</div>`;
  libArmed = false;
  showLib();
}
function saveSub() {
  const name = $('sbName').value.trim();
  if (!name) { toast('اكتب الاسم.'); return false; }
  const old = S.subs.find((x) => x.id === ldraft.id);
  const s = normalizeSub({ ...(old || {}), id: ldraft.id, kind: ldraft.sk, name, amount: num($('sbAmount').value), every: +$('sbEvery').value, next: $('sbNext').value || today(), remind: +$('sbRemind').value, auto: $('sbAuto').checked, active: $('sbActive') ? $('sbActive').checked : true, note: $('sbNote').value.trim() });
  if (old) Object.assign(old, s); else S.subs.push(s);
  save();
  return true;
}
function paySub(id) {
  const s = S.subs.find((x) => x.id === id);
  // one payment: in the bill, in «المصروف», and ticked in this month's plan (links.js)
  const t = payLink(`sub:${s.id}`, s.amount, today());
  if (t) t.note = BILL_KIND[s.kind];
  save(); render();
  toast(`سُجّل في المصروف والخطة. الموعد القادم ${fmtDate(s.next, { day: 'numeric', month: 'long' })}`);
}
function subsToPlan() {
  const p = activePlan();
  let n = 0;
  for (const s of S.subs.filter((x) => x.active)) {
    if (s.every === 1) { if (!p.fixed.some((x) => x.name === s.name)) { p.fixed.push(row({ name: s.name, amount: s.amount })); n++; } }
    else if (!p.periodic.some((x) => x.name === s.name)) { p.periodic.push(row({ name: s.name, amount: s.amount, every: s.every })); n++; }
  }
  save(); render();
  toast(n ? `أُضيف ${n} إلى الخطة (الشهري في الثابتة، والباقي في الدورية)` : 'كلها موجودة في الخطة');
}

// ---------- deferred buying ----------
function finLaterHTML() {
  const open = S.later.filter((x) => !x.decision).sort((a, b) => a.added.localeCompare(b.added));
  const ready = open.filter(laterReady);
  const waiting = open.filter((x) => !laterReady(x));
  const done = S.later.filter((x) => x.decision).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
  const saved = sum(S.later.filter((x) => x.decision === 'dropped'), (x) => x.price);
  const card = (x) => {
    const left = x.wait - daysBetween(x.added, today());
    return `<article class="fin-card${x.decision ? ' cleared' : ''}">
      <button type="button" class="hz-main" data-action="later-open" data-v="${x.id}">
        <span class="row-between"><b>${esc(x.name)}</b><b>${money(x.price)}</b></span>
        ${x.why ? `<small>${esc(x.why)}</small>` : ''}
        <small>${x.decision ? (x.decision === 'bought' ? `اشتريته ${esc(relDate(x.decidedAt))}` : `تراجعت عنه ${esc(relDate(x.decidedAt))} | وفّرت ${money(x.price)}`) : left > 0 ? `انتظر ${daysWord(left)} أخرى` : 'انتهت مدة الانتظار'}</small>
      </button>
      ${!x.decision && left <= 0 ? `<p class="later-q">هل ما زلت تريده؟</p><div class="btn-row"><button type="button" class="primary" data-action="later-buy" data-v="${x.id}">نعم، اشتريته</button><button type="button" class="ghost" data-action="later-drop" data-v="${x.id}">لا، تراجعت</button><button type="button" class="ghost" data-action="later-wait" data-v="${x.id}">أجّل ${x.wait} يوماً</button></div>`
        : !x.decision ? `<div class="progress-line"><i style="width:${Math.round(((x.wait - left) / x.wait) * 100)}%"></i></div>` : ''}
    </article>`;
  };
  return `<section class="section">
    <div class="section-head"><h2>الشراء المؤجّل</h2>${addBtn('later-new', 'شيء أريده')}</div>
    <p class="note-text explain">قبل أن تشتري ما لا تحتاجه الآن: سجّله هنا وانتظر. بعد المدة يسألك التطبيق: هل ما زلت تريده؟</p>
    ${saved ? `<div class="fin-tiles"><span class="pos"><b>${money(saved)}</b>وفّرتها</span><span><b>${S.later.filter((x) => x.decision === 'dropped').length}</b>تراجعت عنها</span><span><b>${money(sum(open, (x) => x.price))}</b>تنتظر</span></div>` : ''}
    ${ready.length ? `<h3 class="j-month">حان القرار</h3><div class="book-list">${ready.map(card).join('')}</div>` : ''}
    ${waiting.length ? `<h3 class="j-month">ينتظر</h3><div class="book-list">${waiting.map(card).join('')}</div>` : ''}
    ${done.length ? `<details class="habit-done"><summary>قرّرت فيها (${done.length})</summary><div class="book-list">${done.map(card).join('')}</div></details>` : ''}
    ${!S.later.length ? emptyHTML('لا شيء مؤجّل', 'رأيت شيئاً تريد شراءه؟ سجّله هنا بسعره ولماذا تريده، وانتظر ٣٠ يوماً.', addBtn('later-new', 'أضف أول شيء')) : ''}
  </section>`;
}
function openLater(id) {
  const x = id ? S.later.find((i) => i.id === id) : normalizeLater({});
  ldraft = { kind: 'later', id: x.id, isNew: !id };
  $('libForm').innerHTML = `${sheetHead(id ? esc(x.name) : 'شيء أريد شراءه')}
    <label class="field"><span>ما هو؟</span><input type="text" id="ltName" value="${esc(x.name)}" autocomplete="off" placeholder="مثال: ساعة ذكية جديدة"></label>
    <div class="grid2">
      <label class="field"><span>السعر</span><input type="text" inputmode="decimal" class="num-in" id="ltPrice" value="${x.price || ''}" data-novoice></label>
      <label class="field"><span>أنتظر</span><select id="ltWait">${[7, 14, 30, 60, 90].map((d) => `<option value="${d}"${x.wait === d ? ' selected' : ''}>${d} يوماً</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>لماذا أريده؟</span><input type="text" id="ltWhy" value="${esc(x.why)}" autocomplete="off"></label>
    <label class="field"><span>الرابط (اختياري)</span><input type="url" id="ltUrl" value="${esc(x.url)}" dir="ltr" autocomplete="off" data-novoice></label>
    <div class="sheet-actions"><button type="submit" class="primary">${id ? 'حفظ' : 'أجّله'}</button>${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}</div>`;
  libArmed = false;
  showLib();
}
function saveLater() {
  const name = $('ltName').value.trim();
  if (!name) { toast('اكتب ما تريد شراءه.'); return false; }
  const old = S.later.find((i) => i.id === ldraft.id);
  const x = normalizeLater({ ...(old || {}), id: ldraft.id, name, price: num($('ltPrice').value), wait: +$('ltWait').value, why: $('ltWhy').value.trim(), url: $('ltUrl').value.trim() });
  if (old) Object.assign(old, x); else S.later.push(x);
  save();
  if (!old) toast(`سأسألك بعد ${daysWord(x.wait)}: هل ما زلت تريده؟`);
  return true;
}

// «اليوم»
function billsTodayHTML() {
  const rows = subsDue().sort((a, b) => a.next.localeCompare(b.next)).map((s) => {
    const n = daysBetween(today(), s.next);
    return tRow(s.kind === 'bill' ? '🧾' : '🔁', `${s.name}: ${money(s.amount)}`, n < 0 ? `متأخر ${daysWord(-n)}` : n === 0 ? 'موعده اليوم' : `موعده ${afterDays(n)}`, 'sub-open', s.id);
  });
  return todayBlock('الاشتراكات والفواتير', '', tList(rows));
}
function laterTodayHTML() {
  return todayBlock('الشراء المؤجّل', '', tList(S.later.filter(laterReady).map((x) => tRow('🛍️', `${x.name}: هل ما زلت تريده؟`, `${money(x.price)} | انتهت مدة الانتظار`, 'later-go', x.id))));
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="sub-"], [data-action^="later-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  const lat = S.later.find((i) => i.id === v);
  switch (action) {
    case 'sub-new': openSub(null); break;
    case 'sub-open': openSub(v); break;
    case 'sub-kind': ldraft.sk = v; for (const b of $('sbKind').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'sub-paid': paySub(v); break;
    case 'sub-to-plan': subsToPlan(); break;
    case 'later-new': openLater(null); break;
    case 'later-open': openLater(v); break;
    case 'later-go': finUi.tab = 'later'; go('finance'); break;
    case 'later-buy': lat.decision = 'bought'; lat.decidedAt = today(); if (lat.price) S.finTx.push(normalizeTx({ amount: lat.price, kind: 'out', item: lat.name, note: 'شراء مؤجّل' })); save(); render(); toast('سُجّل في المصروف. استمتع به!'); break;
    case 'later-drop': lat.decision = 'dropped'; lat.decidedAt = today(); save(); render(); toast(`أحسنت! وفّرت ${money(lat.price)}`); break;
    case 'later-wait': lat.added = today(); save(); render(); toast(`سأسألك بعد ${daysWord(lat.wait)}`); break;
  }
});

// ---------- Excel ----------
function subsSheet() {
  const act = S.subs;
  const R = [[{ v: 'الاشتراكات والفواتير', s: 'title', span: 7 }], [{ v: `صُدّرت ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 7 }], []];
  R.push(['الاسم', 'النوع', 'المبلغ', 'التكرار', 'شهرياً', 'الموعد القادم', 'الحالة'].map((v) => ({ v, s: 'head' })));
  const f = R.length + 1;
  for (const s of act) { const r = R.length + 1; R.push([{ v: s.name, s: 'txt' }, { v: BILL_KIND[s.kind], s: 'txt' }, { v: s.amount, s: 'num' }, { v: s.every, s: 'num' }, { f: `IFERROR(C${r}/D${r},0)`, v: subMonthly(s), s: 'num' }, { v: fmtDate(s.next, { day: 'numeric', month: 'short', year: 'numeric' }), s: 'txt' }, { v: s.active ? 'نشط' : 'موقوف', s: 'txt' }]); }
  const l = R.length;
  R.push([{ v: 'المجموع الشهري', s: 'tot', span: 4 }, { f: `SUMIF(G${f}:G${l},"نشط",E${f}:E${l})`, v: sum(act.filter((s) => s.active), subMonthly), s: 'totnum' }, { v: '', s: 'tot', span: 2 }]);
  R.push([{ v: 'المجموع السنوي', s: 'tot', span: 4 }, { f: `E${R.length}*12`, v: sum(act.filter((s) => s.active), subMonthly) * 12, s: 'totnum' }, { v: '', s: 'tot', span: 2 }]);
  return { name: 'الاشتراكات والفواتير', design: true, widths: [24, 10, 12, 10, 12, 16, 10], rows: R };
}
function laterSheet() {
  const R = [[{ v: 'الشراء المؤجّل', s: 'title', span: 6 }], [{ v: `صُدّر ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`, s: 'sub', span: 6 }], []];
  R.push(['الشيء', 'السعر', 'أُضيف', 'الانتظار (يوم)', 'القرار', 'لماذا'].map((v) => ({ v, s: 'head' })));
  for (const x of S.later) R.push([{ v: x.name, s: 'txt' }, { v: x.price, s: 'num' }, { v: fmtDate(x.added, { day: 'numeric', month: 'short', year: 'numeric' }), s: 'txt' }, { v: x.wait, s: 'num' }, { v: x.decision === 'bought' ? 'اشتريته' : x.decision === 'dropped' ? 'تراجعت' : 'ينتظر', s: 'txt' }, { v: x.why, s: 'txt' }]);
  R.push([{ v: 'وفّرت بالتراجع', s: 'tot' }, { v: sum(S.later.filter((x) => x.decision === 'dropped'), (x) => x.price), s: 'good' }, { v: '', s: 'tot', span: 4 }]);
  return { name: 'الشراء المؤجل', design: true, widths: [26, 12, 14, 12, 10, 28], rows: R };
}
