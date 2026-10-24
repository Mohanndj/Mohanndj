'use strict';
// «عادات أتركها»: the opposite of habit building. A counter of clean days since the last slip,
// the best run, milestones, and a slip log (what triggered it, when) that shows the patterns.

const QUIT_TRIGGERS = ['ملل', 'تعب', 'توتر', 'فراغ', 'وحدة', 'رفقة', 'مكان معيّن', 'الجوال', 'قبل النوم'];
const QUIT_MILES = [1, 3, 7, 14, 21, 30, 40, 60, 90, 180, 365];
const DAY_MS = 86400000;

function normalizeQuit(q) {
  return {
    id: q.id || uid(), title: String(q.title || ''), why: String(q.why || ''), instead: String(q.instead || ''),
    start: Number(q.start) || Date.now(),
    slips: (Array.isArray(q.slips) ? q.slips : []).filter((s) => s && s.at).map((s) => ({ id: s.id || uid(), at: Number(s.at), trigger: String(s.trigger || ''), note: String(s.note || '') })),
    doneAt: q.doneAt || '', created: q.created || Date.now(),
  };
}
const getQuit = (id) => S.quits.find((q) => q.id === id);

function quitStats(q, now = Date.now()) {
  // slips before an edited start date belong to an earlier attempt
  const marks = [q.start, ...q.slips.map((s) => s.at).filter((at) => at >= q.start).sort((a, b) => a - b)];
  const lastAt = marks[marks.length - 1];
  const curMs = Math.max(0, now - lastAt);
  let bestMs = curMs;
  for (let i = 1; i < marks.length; i++) bestMs = Math.max(bestMs, marks[i] - marks[i - 1]);
  const days = Math.floor(curMs / DAY_MS);
  const next = QUIT_MILES.find((m) => m > days) || Math.ceil((days + 1) / 365) * 365;
  const prev = days >= 365 ? Math.floor(days / 365) * 365 : [...QUIT_MILES].reverse().find((m) => m <= days) || 0;
  // patterns: triggers, part of day, weekday
  const count = (f) => { const o = {}; for (const s of q.slips) { const k = f(s); if (k) o[k] = (o[k] || 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const part = (s) => { const h = new Date(s.at).getHours(); return h < 5 ? 'آخر الليل' : h < 12 ? 'الصباح' : h < 17 ? 'الظهيرة' : h < 21 ? 'المساء' : 'الليل'; };
  return {
    days, hours: Math.floor((curMs % DAY_MS) / 3600000), bestDays: Math.floor(bestMs / DAY_MS), next, prev,
    pct: Math.round(((days - prev) / Math.max(1, next - prev)) * 100), slips: q.slips.length,
    triggers: count((s) => s.trigger), parts: count(part), weekdays: count((s) => AR_DAYS[new Date(s.at).getDay()]),
  };
}

function quitCard(q) {
  const st = quitStats(q);
  const pat = [];
  if (st.triggers.length && st.triggers[0][1] >= 2) pat.push(`أكثر ما يدفعك: ${st.triggers[0][0]}`);
  if (st.parts.length && st.parts[0][1] >= 2) pat.push(`غالباً في ${st.parts[0][0]}`);
  if (st.weekdays.length && st.weekdays[0][1] >= 2) pat.push(`وأكثر يوم: ${st.weekdays[0][0]}`);
  return `<li class="quit-card">
    <div class="quit-top">
      <div class="quit-count"><b>${st.days || 'صفر'}</b><small>${st.days === 1 ? 'يوم' : st.days === 2 ? 'يومان' : st.days >= 3 && st.days <= 10 ? 'أيام' : 'يوم'}</small></div>
      <button type="button" class="t-main" data-action="quit-open" data-v="${q.id}">
        <span class="t-title">${esc(q.title)}</span>
        <span class="meta"><span>${st.days ? `${st.days < 3 && st.hours ? `و${st.hours} ساعة ` : ''}دون أن تعود إليها` : st.hours ? `منذ ${st.hours} ساعة` : 'بدأت الآن'}</span>${st.bestDays ? `<span>أطول مدة: ${daysWord(st.bestDays)}</span>` : ''}${st.slips ? `<span>${plural(st.slips, 'زلّة واحدة', 'زلّتان', 'زلّات', 'زلّة')}</span>` : ''}</span>
      </button>
      <button type="button" class="ghost quit-slip" data-action="quit-slip" data-v="${q.id}">زللت</button>
    </div>
    <div class="habit-journey">
      <div class="row-between"><small>الهدف التالي: ${daysWord(st.next)}</small><small>قطعت ${st.pct}%</small></div>
      <div class="progress-line"><i style="width:${st.pct}%"></i></div>
    </div>
    ${q.why ? `<p class="note-text">«${esc(q.why)}»</p>` : ''}
    ${q.instead ? `<p class="note-text">بدلاً منها: ${esc(q.instead)}</p>` : ''}
    ${pat.length ? `<p class="note-text quit-pat">🔎 ${esc(pat.join('، '))}</p>` : ''}
  </li>`;
}

function quitsSectionHTML() {
  const list = S.quits.filter((q) => !q.doneAt);
  const done = S.quits.filter((q) => q.doneAt);
  return `<section class="section">
    <div class="section-head"><h2>عادات أتركها</h2>${addBtn('quit-new', 'عادة أتركها')}</div>
    ${list.length ? `<ul class="list">${list.map(quitCard).join('')}</ul>`
      : emptyHTML('تخلّص من عادة لا تريدها', 'سجّل العادة التي تريد تركها، ويعدّ التطبيق الأيام منذ آخر مرة. إن زلّت قدمك سجّل ما الذي دفعك، فيكشف لك ما يتكرر. الزلّة لا تمحو تقدّمك: أطول مدة تبقى محفوظة.')}
    ${done.length ? `<details class="habit-done"><summary>عادات تركتها (${done.length})</summary><ul class="list">${done.map(quitCard).join('')}</ul></details>` : ''}
  </section>`;
}

// ---------- editor ----------
function openQuit(id) {
  const q = id ? getQuit(id) : normalizeQuit({});
  ldraft = { kind: 'quit', id: q.id, isNew: !id };
  const st = id ? quitStats(q) : null;
  const toLocal = (ts) => { const d = new Date(ts); return `${iso(d)}T${hmOf(d.getHours() * 60 + d.getMinutes())}`; };
  const row = (arr, label) => (arr.length ? `<div><dt>${label}</dt><dd>${arr.slice(0, 3).map(([k, n]) => `${esc(k)} (${n})`).join('، ')}</dd></div>` : '');
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? esc(q.title) : 'عادة أريد تركها'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>العادة</span><input type="text" id="qTitle" value="${esc(q.title)}" autocomplete="off" placeholder="مثال: التصفح قبل النوم"></label>
    <label class="field"><span>لماذا أتركها؟</span><textarea id="qWhy" rows="2" placeholder="تذكيرك بالسبب يقوّيك وقت الضعف">${esc(q.why)}</textarea></label>
    <label class="field"><span>ماذا أفعل بدلاً منها؟</span><input type="text" id="qInstead" value="${esc(q.instead)}" autocomplete="off" placeholder="مثال: أقرأ صفحتين من كتاب"></label>
    <label class="field"><span>بدأت الترك منذ</span><input type="datetime-local" id="qStart" value="${toLocal(q.start)}"></label>
    ${st && st.slips ? `<div class="field"><span>ما يتكرر في زلّاتك</span><dl class="habit-plan">${row(st.triggers, 'الدافع')}${row(st.parts, 'الوقت')}${row(st.weekdays, 'اليوم')}</dl></div>
      <ul class="ppl-hist">${q.slips.slice().sort((a, b) => b.at - a.at).slice(0, 10).map((s) => `<li><span>${esc(fmtStamp(s.at))}${s.trigger ? ` | ${esc(s.trigger)}` : ''}${s.note ? ` | ${esc(s.note)}` : ''}</span><button type="button" class="j-m-del" data-action="quit-del-slip" data-v="${s.id}" aria-label="حذف">✕</button></li>`).join('')}</ul>` : ''}
    ${id ? `<label class="switch"><input type="checkbox" id="qDone"${q.doneAt ? ' checked' : ''}><span>تركتها نهائياً، انقلها إلى «عادات تركتها»</span></label>` : ''}
    <div class="sheet-actions">
      <button type="submit" class="primary">${id ? 'حفظ' : 'ابدأ العدّ'}</button>
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function saveQuit() {
  const title = $('qTitle').value.trim();
  if (!title) { toast('اكتب العادة.'); return false; }
  const old = getQuit(ldraft.id);
  const start = $('qStart').value ? new Date($('qStart').value).getTime() : Date.now();
  const q = normalizeQuit({ ...(old || {}), id: ldraft.id, title, why: $('qWhy').value.trim(), instead: $('qInstead').value.trim(), start: Math.min(start, Date.now()) });
  if ($('qDone')) q.doneAt = $('qDone').checked ? (q.doneAt || today()) : '';
  if (old) Object.assign(old, q); else S.quits.push(q);
  save();
  return true;
}

function openSlip(id) {
  const q = getQuit(id);
  const st = quitStats(q);
  ldraft = { kind: 'slip', id, isNew: true, trigger: '' };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>زلّة في «${esc(q.title)}»</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="note-text">لا بأس، المهم أن تعرف السبب. ${heldDays(st.days)}${st.bestDays > st.days ? `، وأطول مدة لك ${daysWord(st.bestDays)}` : ''}، وهذا لن يضيع.</p>
    <div class="field"><span>ما الذي دفعك؟</span><div class="chips wrap" id="slTrig">${QUIT_TRIGGERS.map((t) => `<button type="button" class="chip" data-action="quit-trig" data-v="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
      <input type="text" id="slOther" autocomplete="off" placeholder="سبب آخر"></div>
    <label class="field"><span>ملاحظة (اختياري)</span><input type="text" id="slNote" autocomplete="off" placeholder="ماذا ستفعل في المرة القادمة؟"></label>
    ${q.why ? `<p class="note-text">تذكّر: «${esc(q.why)}»</p>` : ''}
    <div class="sheet-actions"><button type="submit" class="primary">سجّل وابدأ من جديد</button></div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function saveSlip() {
  const q = getQuit(ldraft.id);
  q.slips.push({ id: uid(), at: Date.now(), trigger: $('slOther').value.trim() || ldraft.trigger, note: $('slNote').value.trim() });
  save();
  toast('بداية جديدة. أنت أقوى مما تظن');
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="quit-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'quit-new': openQuit(null); break;
    case 'quit-open': openQuit(v); break;
    case 'quit-slip': openSlip(v); break;
    case 'quit-trig':
      ldraft.trigger = ldraft.trigger === v ? '' : v;
      for (const b of $('slTrig').children) b.setAttribute('aria-pressed', String(b.dataset.v === ldraft.trigger));
      break;
    case 'quit-del-slip': {
      // two presses («متأكد؟» first); what is typed in the form stays as it was after the sheet is drawn again
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'متأكد؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = '✕'; } }, 4000); break; }
      const q = getQuit(ldraft.id);
      const typed = ['qTitle', 'qWhy', 'qInstead', 'qStart'].map((k) => [k, $(k) ? $(k).value : null]), done = $('qDone') ? $('qDone').checked : null;
      q.slips = q.slips.filter((s) => s.id !== v);
      save(); openQuit(q.id);
      for (const [k, val] of typed) if ($(k) && val !== null) $(k).value = val;
      if ($('qDone') && done !== null) $('qDone').checked = done;
      render();
      break;
    }
  }
});
