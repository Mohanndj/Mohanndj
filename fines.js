'use strict';
// «المخالفات المرورية» in «المالية»: each violation with its amount, date, place and what it was for.
// Until it is paid it appears by itself as an item in this month's plan (links.js, 'fine:<id>');
// paying it (here, from the plan, or from «اليوم») records it once everywhere.

// amount: the full value. disc: the reduced value while paying early is allowed, until discUntil.
function normalizeFine(x) {
  return {
    id: x.id || uid(), amount: num(x.amount), disc: num(x.disc), discUntil: /^\d{4}-\d{2}-\d{2}$/.test(x.discUntil || '') ? x.discUntil : '',
    date: x.date || today(), time: String(x.time || ''), place: String(x.place || ''), kind: String(x.kind || ''),
    number: String(x.number || ''), car: String(x.car || ''),
    note: String(x.note || ''), payments: payments(x.payments), created: x.created || Date.now(),
  };
}
const discOn = (f, d = today()) => !!(f.disc && f.discUntil && d <= f.discUntil);
// what is owed now: the reduced value while it lasts; settled if the reduced value was paid in time
function fineDue(f) {
  if (f.disc && f.discUntil && sum(f.payments.filter((p) => p.d <= f.discUntil)) >= f.disc - 0.5) return sum(f.payments);
  return discOn(f) ? f.disc : f.amount;
}
const fineLeft = (f) => Math.max(0, fineDue(f) - sum(f.payments));
// a short name cut at a whole word (never mid-word)
function fineShort(f) {
  const s = (f.kind || '').split(/\s+-\s+/)[0].trim();
  if (s.length <= 30) return s;
  const words = s.split(/\s+/); let out = '';
  for (const w of words) { if ((out ? `${out} ${w}` : w).length > 30) break; out = out ? `${out} ${w}` : w; }
  return `${out || words[0]}…`;
}
const fineName = (f) => `مخالفة${f.kind ? ` ${fineShort(f)}` : ''}${f.place ? ` · ${f.place}` : ''}`;
const discLine = (f) => (!fineLeft(f) || !f.disc || !f.discUntil ? '' : discOn(f)
  ? `مخفّضة حتى ${fmtDate(f.discUntil, { day: 'numeric', month: 'long' })} (${daysBetween(today(), f.discUntil) ? `بقي ${daysWord(daysBetween(today(), f.discUntil))}` : 'آخر يوم'}) · بعدها ${money(f.amount)}`
  : `انتهى التخفيض في ${fmtDate(f.discUntil, { day: 'numeric', month: 'long' })}`);

// read the violation text message (Absher / Efaa) and pull out what matters
function parseFineMsg(text) {
  const t = String(text || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\r/g, '');
  const after = (label) => { const m = new RegExp(`${label}\\s*[:：]\\s*\\n?\\s*([^\\n]+)`).exec(t); return m ? m[1].trim() : ''; };
  const out = {};
  const head = /قيد\s+مخالفة\s*[:：]?\s*\n?\s*([^\n]+)/.exec(t);
  if (head) out.kind = head[1].replace(/\s+/g, ' ').trim();
  const num_ = after('رقم المخالفة'); if (num_) out.number = num_.replace(/\D/g, '');
  const date = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(after('التاريخ')); if (date) out.date = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`;
  const time = /(\d{1,2}:\d{2})/.exec(after('الوقت')); if (time) out.time = time[1];
  const city = after('المدينة') || after('الموقع') || after('المكان'); if (city) out.place = city;
  const car = after('السيارة') || after('المركبة'); if (car) out.car = car;
  const val = /([\d.,]+)/.exec(after('القيمة') || after('المبلغ')); const shown = val ? num(val[1]) : 0;
  const rate = /تخفيض[^%٪\d]{0,30}(\d{1,2})\s*[%٪]/.exec(t);
  const days = /خلال\s+مدة\s+أقصاها\s*\(?\s*(\d+)\s*\)?\s*يوم/.exec(t);
  if (shown && rate) {
    // the value in the message is the reduced one; the full one is it before the reduction (rounded to 5)
    const r = Number(rate[1]) / 100;
    out.disc = shown;
    out.amount = Math.round(shown / (1 - r) / 5) * 5;
    out.discUntil = addDays(out.date || today(), days ? Number(days[1]) : 30);
  } else if (shown) out.amount = shown;
  return out;
}

function finFinesHTML() {
  const open = S.fines.filter(fineLeft).sort((a, b) => a.date.localeCompare(b.date));
  const paid = S.fines.filter((f) => !fineLeft(f)).sort((a, b) => b.date.localeCompare(a.date));
  const card = (f) => `<article class="fin-card ledger${fineLeft(f) ? '' : ' cleared'}">
    <button type="button" class="hz-main" data-action="fine-open" data-v="${f.id}">
      <span class="row-between"><b>🚦 ${esc(fineShort(f) || 'مخالفة مرورية')}</b><b class="${fineLeft(f) ? 'late' : 'ok'}">${fineLeft(f) ? money(fineLeft(f)) : '✓ سُدّدت'}</b></span>
      <small>${esc(dateBoth(f.date, true))}${f.time ? ` · ${esc(f.time)}` : ''}${f.place ? ` · ${esc(f.place)}` : ''}${f.car ? ` · ${esc(f.car)}` : ''}</small>
      ${discLine(f) ? `<small class="${discOn(f) ? 'ok' : 'late'}">${esc(discLine(f))}</small>` : ''}
      ${f.note ? `<small>${esc(f.note)}</small>` : ''}
    </button>
    ${fineLeft(f) ? `<div class="btn-row"><button type="button" class="ghost" data-action="fine-pay" data-v="${f.id}">سدّدتها ✓</button></div>` : ''}
  </article>`;
  return `<section class="section">
    <div class="section-head"><h2>المخالفات المرورية <small class="num">${money(sum(open, fineLeft))}</small></h2>${addBtn('fine-new', 'مخالفة')}</div>
    <p class="note-text explain">كل مخالفة لم تُسدَّد تظهر بنداً في خطة هذا الشهر حتى تسددها.</p>
    ${open.length ? `<div class="book-list">${open.map(card).join('')}</div>` : emptyHTML('لا مخالفات عليك', 'سجّل المخالفة بقيمتها وتاريخها ومكانها، فتدخل خطتك الشهرية حتى تسددها.')}
    ${paid.length ? `<details class="shop-done"><summary>المسدّدة (${paid.length}) · ${money(sum(paid, (f) => sum(f.payments)))}</summary><div class="book-list">${paid.map(card).join('')}</div></details>` : ''}
  </section>`;
}

function openFine(id) {
  const f = id ? S.fines.find((x) => x.id === id) : normalizeFine({});
  ldraft = { kind: 'fine', id: f.id, isNew: !id };
  $('libForm').innerHTML = `${sheetHead(id ? 'المخالفة' : 'مخالفة مرورية جديدة')}
    ${id ? '' : `<label class="field"><span>الصق رسالة المخالفة (اختياري)</span><textarea id="fnPaste" class="fine-paste" rows="3" placeholder="الصق نص رسالة المخالفة كما وصلتك، فتُملأ الخانات وحدها"></textarea></label>`}
    <label class="field"><span>نوعها</span><input type="text" id="fnKind" value="${esc(f.kind)}" list="fineKinds" autocomplete="off" placeholder="مثال: تجاوز السرعة"><datalist id="fineKinds">${['تجاوز السرعة', 'وقوف خاطئ', 'قطع إشارة', 'عدم ربط الحزام', 'استخدام الجوال', 'انتهاء التأمين', 'انتهاء الفحص'].map((k) => `<option value="${k}">`).join('')}</datalist></label>
    <div class="grid2">
      <label class="field"><span>القيمة الكاملة</span><input type="text" inputmode="decimal" class="num-in" id="fnAmount" value="${f.amount || ''}" data-novoice></label>
      <label class="field"><span>المخفّضة (إن وُجدت)</span><input type="text" inputmode="decimal" class="num-in" id="fnDisc" value="${f.disc || ''}" data-novoice></label>
    </div>
    <label class="field"><span>آخر يوم للسداد بالقيمة المخفّضة</span><input type="date" id="fnUntil" value="${f.discUntil}"></label>
    <div class="grid2">
      <label class="field"><span>التاريخ</span><input type="date" id="fnDate" value="${f.date}"></label>
      <label class="field"><span>الوقت</span><input type="time" id="fnTime" value="${esc(f.time)}"></label>
    </div>
    <div class="grid2">
      <label class="field"><span>المدينة أو المكان</span><input type="text" id="fnPlace" value="${esc(f.place)}" autocomplete="off"></label>
      <label class="field"><span>السيارة</span><input type="text" id="fnCar" value="${esc(f.car)}" autocomplete="off"></label>
    </div>
    <label class="field"><span>رقم المخالفة</span><input type="text" id="fnNumber" value="${esc(f.number)}" inputmode="numeric" autocomplete="off" data-novoice></label>
    <label class="field"><span>ملاحظة</span><input type="text" id="fnNote" value="${esc(f.note)}" autocomplete="off"></label>
    ${id && f.payments.length ? `<p class="note-text">سُدّد منها ${money(sum(f.payments))} · ${esc(f.payments.map((p) => dateBoth(p.d, true)).join('، '))}</p>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}</div>`;
  libArmed = false;
  showLib();
}
function saveFine() {
  const amount = num($('fnAmount').value), disc = num($('fnDisc').value);
  if (!amount && !disc) { toast('اكتب قيمة المخالفة.'); return false; }
  if (disc && amount && disc > amount) { toast('المخفّضة أكبر من الكاملة.'); return false; }
  const old = S.fines.find((x) => x.id === ldraft.id);
  const f = normalizeFine({ ...(old || {}), id: ldraft.id, amount: amount || disc, disc: disc && disc < (amount || disc) ? disc : 0, discUntil: $('fnUntil').value, date: $('fnDate').value || today(), time: $('fnTime').value, place: $('fnPlace').value.trim(), kind: $('fnKind').value.trim(), car: $('fnCar').value.trim(), number: $('fnNumber').value.trim(), note: $('fnNote').value.trim() });
  if (old) Object.assign(old, f); else S.fines.push(f);
  syncAllPlans();
  save();
  return true;
}
// pasting the message fills the fields
document.addEventListener('input', (e) => {
  if (e.target.id !== 'fnPaste') return;
  const r = parseFineMsg(e.target.value);
  const set = (id, v) => { if (v != null && v !== '' && $(id)) $(id).value = v; };
  set('fnKind', r.kind); set('fnAmount', r.amount); set('fnDisc', r.disc); set('fnUntil', r.discUntil); set('fnDate', r.date); set('fnTime', r.time); set('fnPlace', r.place); set('fnCar', r.car); set('fnNumber', r.number);
  const n = Object.keys(r).length;
  if (n) toast(`قُرئت الرسالة: ${n} معلومات${r.disc ? ` · المخفّضة ${money(r.disc)} حتى ${fmtDate(r.discUntil, { day: 'numeric', month: 'long' })}` : ''}`);
});
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
