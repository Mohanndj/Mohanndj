'use strict';
// «المخالفات المرورية» in «المالية»: each violation with its amount, date, place and what it was for.
// Until it is paid it appears by itself as an item in this month's plan (links.js, 'fine:<id>');
// paying it (here, from the plan, or from «اليوم») records it once everywhere.

function normalizeFine(x) {
  return {
    id: x.id || uid(), amount: num(x.amount), date: x.date || today(), place: String(x.place || ''), kind: String(x.kind || ''),
    note: String(x.note || ''), payments: payments(x.payments), created: x.created || Date.now(),
  };
}
const fineLeft = (f) => Math.max(0, f.amount - sum(f.payments));
const fineName = (f) => `مخالفة${f.kind ? ` ${f.kind}` : ''}${f.place ? ` · ${f.place}` : ''}`;

function finFinesHTML() {
  const open = S.fines.filter(fineLeft).sort((a, b) => a.date.localeCompare(b.date));
  const paid = S.fines.filter((f) => !fineLeft(f)).sort((a, b) => b.date.localeCompare(a.date));
  const card = (f) => `<article class="fin-card ledger${fineLeft(f) ? '' : ' cleared'}">
    <button type="button" class="hz-main" data-action="fine-open" data-v="${f.id}">
      <span class="row-between"><b>🚦 ${esc(f.kind || 'مخالفة مرورية')}</b><b class="${fineLeft(f) ? 'late' : 'ok'}">${fineLeft(f) ? money(fineLeft(f)) : '✓ سُدّدت'}</b></span>
      <small>${esc(dateBoth(f.date, true))}${f.place ? ` · ${esc(f.place)}` : ''}${fineLeft(f) && fineLeft(f) < f.amount ? ` · من ${money(f.amount)}` : ''}</small>
      ${f.note ? `<small>${esc(f.note)}</small>` : ''}
    </button>
    ${fineLeft(f) ? `<div class="btn-row"><button type="button" class="ghost" data-action="fine-pay" data-v="${f.id}">سدّدتها ✓</button></div>` : ''}
  </article>`;
  return `<section class="section">
    <div class="section-head"><h2>المخالفات المرورية <small class="num">${money(sum(open, fineLeft))}</small></h2>${addBtn('fine-new', 'مخالفة')}</div>
    <p class="note-text">كل مخالفة لم تُسدَّد تظهر بنداً في خطة هذا الشهر حتى تسددها.</p>
    ${open.length ? `<div class="book-list">${open.map(card).join('')}</div>` : emptyHTML('لا مخالفات عليك', 'سجّل المخالفة بقيمتها وتاريخها ومكانها، فتدخل خطتك الشهرية حتى تسددها.')}
    ${paid.length ? `<details class="shop-done"><summary>المسدّدة (${paid.length}) · ${money(sum(paid, (f) => f.amount))}</summary><div class="book-list">${paid.map(card).join('')}</div></details>` : ''}
  </section>`;
}

function openFine(id) {
  const f = id ? S.fines.find((x) => x.id === id) : normalizeFine({});
  ldraft = { kind: 'fine', id: f.id, isNew: !id };
  $('libForm').innerHTML = `${sheetHead(id ? 'المخالفة' : 'مخالفة مرورية جديدة')}
    <div class="grid2">
      <label class="field"><span>القيمة</span><input type="text" inputmode="decimal" class="num-in" id="fnAmount" value="${f.amount || ''}" data-novoice></label>
      <label class="field"><span>التاريخ</span><input type="date" id="fnDate" value="${f.date}"></label>
    </div>
    <label class="field"><span>المكان</span><input type="text" id="fnPlace" value="${esc(f.place)}" autocomplete="off" placeholder="مثال: طريق الملك فهد"></label>
    <label class="field"><span>نوعها (اختياري)</span><input type="text" id="fnKind" value="${esc(f.kind)}" list="fineKinds" autocomplete="off" placeholder="مثال: سرعة"><datalist id="fineKinds">${['سرعة', 'وقوف', 'إشارة', 'حزام', 'جوال', 'تأمين', 'فحص'].map((k) => `<option value="${k}">`).join('')}</datalist></label>
    <label class="field"><span>ملاحظة</span><input type="text" id="fnNote" value="${esc(f.note)}" autocomplete="off"></label>
    ${id && f.payments.length ? `<p class="note-text">سُدّد منها ${money(sum(f.payments))} · ${esc(f.payments.map((p) => dateBoth(p.d, true)).join('، '))}</p>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}</div>`;
  libArmed = false;
  showLib();
}
function saveFine() {
  const amount = num($('fnAmount').value);
  if (!amount) { toast('اكتب قيمة المخالفة.'); return false; }
  const old = S.fines.find((x) => x.id === ldraft.id);
  const f = normalizeFine({ ...(old || {}), id: ldraft.id, amount, date: $('fnDate').value || today(), place: $('fnPlace').value.trim(), kind: $('fnKind').value.trim(), note: $('fnNote').value.trim() });
  if (old) Object.assign(old, f); else S.fines.push(f);
  syncAllPlans();
  save();
  return true;
}
function deleteFine(id) {
  S.finTx = S.finTx.filter((t) => !(t.src && t.src.startsWith(`fine:${id}:`)));
  S.fines = S.fines.filter((x) => x.id !== id);
  syncAllPlans();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="fine-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'fine-new') openFine(null);
  if (action === 'fine-open') openFine(v);
  if (action === 'fine-pay') {
    const f = S.fines.find((x) => x.id === v);
    if (!f) return;
    payLink(`fine:${f.id}`, fineLeft(f), today());
    save(); render();
    toast('سُدّدت، وسُجّلت في المصروف والخطة');
  }
});
