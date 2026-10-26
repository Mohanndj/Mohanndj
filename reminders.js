'use strict';
// «التذكيرات»: small things to keep in mind that are not tasks, goals, lists or ideas (simple to do,
// easy to forget). They show on «اليوم», have their own page, and when the app is opened at least
// four hours after the last time they were shown, a sheet lists them again.

const REMIND_EVERY = 4 * 3600000;
const remUi = { armed: '' };

function normalizeReminder(x) {
  const times = [...new Set((Array.isArray(x.times) && x.times.length ? x.times : x.time ? [x.time] : []).filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort();
  return { id: x.id || uid(), text: String(x.text || ''), done: !!x.done, doneAt: x.doneAt || '', created: x.created || Date.now(), updated: x.updated || Date.now(), due: x.due || '', time: times[0] || '', times, rep: normalizeRemRep(x.rep) };
}
// a reminder with a day and an hour (v119, the owner's request: «منبهات أكتب فيها ما أشاء فتظهر لي بالمكتوب خارج التطبيق إن
// حان وقتها»): an alarm that rings as a task's does (its tone, five minutes, with the app closed in the Android app),
// its whole text in the phone's notification, with «تمت» and «غفوة». Repeated (v120, «ضع فيه إمكانية التكرار بأقصى مرونة
// ممكنة»): every so many days; weeks on chosen days; months on a day, on the first..last weekday, or on the last day;
// years; months and years in the Gregorian or the Hijri calendar; several hours a day; until a day or a number of times.
// Known to the alarms as «rem:<id>|<day>|0», or «rem:<id>@<hhmm>|<day>|0» when it repeats or has several hours
const REM_PRE = 'rem:';
const REM_UNITS = { d: 'يومياً', w: 'أسبوعياً', m: 'شهرياً', y: 'سنوياً' };
const REM_NTH = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', '-1': 'الأخير' };
function normalizeRemRep(x) {
  if (!x || !REM_UNITS[x.u]) return null;
  const n = (v, lo, hi, d) => { v = Math.round(Number(v)); return v >= lo && v <= hi ? v : d; };
  return { u: x.u, n: n(x.n, 1, 99, 1), days: Array.isArray(x.days) ? [...new Set(x.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : [],
    mm: ['date', 'nth', 'last'].includes(x.mm) ? x.mm : 'date', mds: [...new Set((Array.isArray(x.mds) ? x.mds : [x.md]).map((d) => n(d, 1, 31, 0)).filter(Boolean))].sort((a, b) => a - b), nth: [1, 2, 3, 4, 5, -1].includes(Number(x.nth)) ? Number(x.nth) : 1, wd: n(x.wd, 0, 6, 0),
    cal: x.cal === 'h' ? 'h' : 'g', until: x.until || '', untilT: x.untilT || '', count: n(x.count, 0, 9999, 0) };
}
const remTimed = (r) => !!(r.due && r.times.length);
const remSlotId = (r, tm) => (!r.rep && r.times.length <= 1 ? `${REM_PRE}${r.id}` : `${REM_PRE}${r.id}@${tm.replace(':', '')}`);
const remKey = (r, d, tm) => `${remSlotId(r, tm)}|${d}|0`;
const remOf = (id) => { const m = /^rem:([^@|]+)/.exec(String(id || '')); return m ? S.reminders.find((r) => r.id === m[1]) || null : null; };
// what the alarms of tasks read of it (its id, text and the hour of this alarm), and its notification: the hour above,
// its text in full
function remTask(id) {
  const r = remOf(id); if (!r) return null;
  const m = /@(\d{2})(\d{2})/.exec(id);
  return { id: String(id).split('|')[0], title: r.text, time: m ? `${m[1]}:${m[2]}` : r.time, prayer: null };
}
const remNoteTitle = (r, tm) => `منبه | ${fmtMin(minutesOf(tm || r.time))}`;
// the parts of a day in either calendar: year, month (1-12), day, the month's length
const REM_HF = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
const REM_PARTS = new Map();
function remParts(d, cal) {
  const k = cal + d;
  if (!REM_PARTS.has(k)) {
    if (cal === 'h') { const p = {}; for (const x of REM_HF.formatToParts(parse(d))) p[x.type] = Number(x.value); const a = hMonthStart(d); REM_PARTS.set(k, { y: p.year, m: p.month, day: p.day, len: Math.round((parse(hMonthNext(a)) - parse(a)) / 864e5) }); }
    else { const D = parse(d), y = D.getFullYear(), m = D.getMonth() + 1; REM_PARTS.set(k, { y, m, day: D.getDate(), len: new Date(y, m, 0).getDate() }); }
  }
  return REM_PARTS.get(k);
}
// is it on this day (by its repetition, from its first day, until its last)?
function remDayOk(r, d) {
  const p = r.rep, s = r.due;
  if (!p) return d === s;
  if (d < s || (p.until && d > p.until)) return false;
  const D = parse(d);
  if (p.u === 'd') return Math.round((D - parse(s)) / 864e5) % p.n === 0;
  if (p.u === 'w') { const days = p.days.length ? p.days : [parse(s).getDay()]; return days.includes(D.getDay()) && Math.round((parse(weekStartOf(d)) - parse(weekStartOf(s))) / 6048e5) % p.n === 0; }
  const c = remParts(d, p.cal), c0 = remParts(s, p.cal);
  if (p.u === 'y') return c.m === c0.m && (c.y - c0.y) % p.n === 0 && c.day === Math.min(c0.day, c.len);
  if (((c.y - c0.y) * 12 + c.m - c0.m) % p.n) return false;
  if (p.mm === 'last') return c.day === c.len;
  if (p.mm === 'nth') return D.getDay() === p.wd && (p.nth === -1 ? c.day + 7 > c.len : Math.ceil(c.day / 7) === p.nth);
  return (p.mds.length ? p.mds : [remParts(s, p.cal).day]).some((md) => c.day === Math.min(md, c.len));
}
// its hours on a day (its last day may end at an hour, when it ends after a number of times)
const remTimesOn = (r, d) => (r.rep && r.rep.untilT && d === r.rep.until ? r.times.filter((t) => t <= r.rep.untilT) : r.times);
// its alarms from a moment on: { d, tm, at, key }, at most «max», within «days» days (one far away too when none)
function remSlots(r, from, days = 14, max = 20) {
  const out = [];
  if (r.done || !remTimed(r)) return out;
  const first = r.due > iso(new Date(from)) ? r.due : iso(new Date(from));
  for (let i = 0; out.length < max && (i < days || (!out.length && i < 800)); i++) {
    const d = addDays(first, i);
    if (r.rep && r.rep.until && d > r.rep.until) break;
    if (!r.rep && d > r.due) break;
    if (!remDayOk(r, d)) continue;
    for (const tm of remTimesOn(r, d)) { const at = parse(d).getTime() + minutesOf(tm) * 60000; if (at >= from && out.length < max) out.push({ d, tm, at, key: remKey(r, d, tm) }); }
  }
  return out;
}
const remNext = (r) => remSlots(r, Date.now(), 0, 1)[0] || null;
const remWhenOf = (x) => `${dueLabel(x.d)} | ${fmtMin(minutesOf(x.tm))}`;
// its repetition in words: «كل أسبوعين: الأحد، الخميس | الأوقات: … | حتى …»
function remRepText(r) {
  const p = r.rep;
  if (!p) return r.times.length > 1 ? `الأوقات: ${r.times.map((t) => fmtMin(minutesOf(t))).join('، ')}` : '';
  const every = { d: ['كل يوم', 'كل يومين', 'أيام', 'يوماً'], w: ['كل أسبوع', 'كل أسبوعين', 'أسابيع', 'أسبوعاً'], m: ['كل شهر', 'كل شهرين', 'أشهر', 'شهراً'], y: ['كل سنة', 'كل سنتين', 'سنوات', 'سنة'] }[p.u];
  let t = p.n === 1 ? every[0] : p.n === 2 ? every[1] : `كل ${plural(p.n, '', '', every[2], every[3])}`;
  if (p.cal === 'h' && (p.u === 'm' || p.u === 'y')) t += ' هجري';
  if (p.u === 'w') t += `: ${(p.days.length ? p.days : [parse(r.due).getDay()]).map((d) => AR_DAYS[d]).join('، ')}`;
  if (p.u === 'm') t += p.mm === 'last' ? ': آخر يوم فيه' : p.mm === 'nth' ? `: ${AR_DAYS[p.wd]} ${REM_NTH[p.nth]}` : `: ${p.mds.length > 1 ? 'الأيام' : 'يوم'} ${p.mds.join('، ')}`;
  if (p.u === 'y') t += `: ${p.cal === 'h' ? fmtHijri(r.due, { day: 'numeric', month: 'long' }) : fmtDate(r.due, { day: 'numeric', month: 'long' })}`;
  const parts = [`يتكرر ${t}`];
  if (r.times.length > 1) parts.push(`الأوقات: ${r.times.map((x) => fmtMin(minutesOf(x))).join('، ')}`);
  if (p.count) parts.push(`${plural(p.count, 'مرة واحدة', 'مرتان', 'مرات', 'مرة')} ثم ينتهي`);
  else if (p.until) parts.push(`حتى ${dueLabel(p.until)}`);
  return parts.join(' | ');
}
// its time and repetition under its text
function remWhenLine(x) {
  if (!remTimed(x)) return '';
  const nx = remNext(x), rt = remRepText(x);
  const when = nx ? (x.rep || x.times.length > 1 ? `القادم: ${remWhenOf(nx)}` : remWhenOf(nx)) : x.rep ? 'انتهى تكراره' : `${dueLabel(x.due)} | ${fmtMin(minutesOf(x.time))}`;
  return `<small class="rem-when">منبه: ${esc(when)}${rt ? ` | ${esc(rt)}` : ''}</small>`;
}
// the fields of its alarm: a day, an hour (and more hours), and its repetition (folded)
const remTimeHTML = () => `<div class="rem-time"><span>منبه (اختياري)</span><input type="date" name="day" aria-label="يوم المنبه"><input type="time" name="at" aria-label="ساعة المنبه">
    <div class="rem-more"></div><button type="button" class="ghost sm" data-action="rem-addtime">＋ ساعة أخرى في اليوم نفسه</button></div>
  <details class="rem-rep"><summary>التكرار</summary><div class="rem-rep-body">
    <label class="rem-f"><span>يتكرر</span><select name="ru"><option value="">لا يتكرر</option>${Object.entries(REM_UNITS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label class="rem-f" data-show="d w m y"><span>كل</span><input type="number" name="rn" min="1" max="99" value="1" inputmode="numeric"><span data-rn-unit></span></label>
    <div class="rem-f rem-days" data-show="w"><span>في</span>${AR_DAYS.map((n, i) => `<label class="chip"><input type="checkbox" name="rd" value="${i}"><span>${n}</span></label>`).join('')}</div>
    <label class="rem-f" data-show="m y"><span>التقويم</span><select name="rcal"><option value="g">ميلادي</option><option value="h">هجري</option></select></label>
    <label class="rem-f" data-show="m"><span>في</span><select name="rmm"><option value="date">يوم من الشهر</option><option value="nth">يوم من أيام الأسبوع</option><option value="last">آخر يوم من الشهر</option></select></label>
    <label class="rem-f" data-show="m:date"><span>اليوم</span><input type="text" name="rmd" inputmode="numeric" placeholder="مثل: ١٥ أو ١٣، ١٤، ١٥"></label>
    <div class="rem-f" data-show="m:nth"><select name="rnth" aria-label="أيّها">${Object.entries(REM_NTH).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><select name="rwd" aria-label="يوم الأسبوع">${AR_DAYS.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select><span>من الشهر</span></div>
    <label class="rem-f" data-show="d w m y"><span>ينتهي</span><select name="re"><option value="">لا ينتهي</option><option value="date">في يوم</option><option value="count">بعد عدد من المرات</option></select></label>
    <label class="rem-f" data-show="e:date"><span>آخر يوم</span><input type="date" name="runtil"></label>
    <label class="rem-f" data-show="e:count"><span>عدد المرات</span><input type="number" name="rcount" min="1" max="9999" inputmode="numeric"></label>
  </div></details>`;
// its repetition's fields shown as chosen
function remRepShow(root) {
  const v = (n) => (root.querySelector(`[name="${n}"]`) || {}).value || '';
  const u = v('ru'), mm = v('rmm'), e = v('re');
  for (const el of root.querySelectorAll('[data-show]')) {
    el.hidden = !el.dataset.show.split(' ').some((x) => x === u || (x === `m:${mm}` && u === 'm') || (x.startsWith('e:') && u && x === `e:${e}`));
  }
  const unit = root.querySelector('[data-rn-unit]');
  if (unit) unit.textContent = { d: 'يوم', w: 'أسبوع', m: 'شهر', y: 'سنة' }[u] || '';
  const sum = root.querySelector('.rem-rep summary');
  if (sum) sum.textContent = u ? `التكرار: ${REM_UNITS[u]}` : 'التكرار';
  // the day it starts gives the defaults: its weekday, its day of the month, and which of its weekday it is
  const day = v('day') || today(), D = parse(day);
  const set = (n, val) => { const el = root.querySelector(`[name="${n}"]`); if (el && !el.dataset.touched) el.value = val; };
  set('rmd', String(remParts(day, v('rcal') === 'h' ? 'h' : 'g').day)); set('rwd', String(D.getDay())); set('rnth', String(Math.min(5, Math.ceil(D.getDate() / 7))));
  if (u === 'w' && ![...root.querySelectorAll('[name="rd"]')].some((c) => c.checked || c.dataset.touched)) { const c = root.querySelector(`[name="rd"][value="${D.getDay()}"]`); if (c) c.checked = true; }
}
// what was written for its alarm: { due, times, rep }, or null (said why)
function remRead(root) {
  const v = (n) => ((root.querySelector(`[name="${n}"]`) || {}).value || '').trim();
  const times = [...new Set([v('at'), ...[...root.querySelectorAll('[name="atx"]')].map((x) => x.value)].filter(Boolean))].sort();
  const day = v('day'), u = v('ru');
  if (!day && !times.length && !u) return { due: '', times: [], rep: null };
  if (!times.length) { toast('اختر الساعة للمنبه.'); return null; }
  const due = day || today();
  let rep = null;
  if (u) {
    const D = parse(due), e = v('re');
    rep = normalizeRemRep({ u, n: enDigits(v('rn')) || 1, days: [...root.querySelectorAll('[name="rd"]:checked')].map((c) => Number(c.value)), mm: v('rmm'), mds: (enDigits(v('rmd')).match(/\d+/g) || [remParts(due, v('rcal') === 'h' ? 'h' : 'g').day]).map(Number), nth: v('rnth'), wd: v('rwd'), cal: v('rcal') });
    if (u === 'w' && !rep.days.length) rep.days = [D.getDay()];
    if (e === 'date') { if (!v('runtil')) { toast('اختر آخر يوم للتكرار.'); return null; } if (v('runtil') < due) { toast('آخر يوم قبل أوله.'); return null; } rep.until = v('runtil'); }
    if (e === 'count') {
      const n = Math.round(Number(enDigits(v('rcount'))));
      if (!(n >= 1)) { toast('اكتب عدد المرات.'); return null; }
      // after so many times: its last day and hour, counted from its first
      const all = remSlots({ id: 'x', done: false, due, times, rep }, parse(due).getTime(), 3660, n);
      const last = all[all.length - 1];
      if (last) { rep.until = last.d; rep.untilT = last.tm; rep.count = n; }
    }
  }
  const r = { id: 'x', done: false, due, times, rep };
  if (!remSlots(r, Date.now(), 0, 1).length) { toast(rep ? 'لا موعد قادماً لهذا التكرار.' : 'هذا الوقت مضى، اختر وقتاً قادماً.'); return null; }
  return { due, times, rep };
}
const remActive = () => S.reminders.filter((x) => !x.done).sort((a, b) => b.created - a.created);
const remDoneToday = () => S.reminders.filter((x) => x.done && x.doneAt === today());

function remRow(x, withDelete) {
  const armed = remUi.armed === x.id;
  return `<li class="${x.done ? 'got' : ''}"><button type="button" class="shop-item" data-action="rem-toggle" data-v="${x.id}" aria-pressed="${x.done}">
      <span class="shop-box" aria-hidden="true">${x.done ? '✓' : ''}</span><span class="shop-name">${esc(x.text)}${remWhenLine(x)}</span>
    </button>${withDelete ? `<button type="button" class="fin-del${armed ? ' armed' : ''}" data-action="rem-del" data-v="${x.id}" aria-label="حذف">${armed ? 'متأكد؟' : '✕'}</button>` : ''}</li>`;
}
const remForm = () => `<form class="idea-quick shop-add rem-add" data-rem-form autocomplete="off">
    <input type="text" name="what" placeholder="تذكير جديد، مثل: أعد الكتاب لصاحبه" aria-label="تذكير جديد">
    <button type="submit" class="primary">${icon('plus')}</button>
    ${remTimeHTML()}
  </form>`;

// «اليوم»: what is still to remember, and what was done today (struck through until the day ends)
function remindersTodayHTML() {
  const items = [...remActive(), ...remDoneToday()];
  if (!items.length) return '';
  return todayBlock('التذكيرات', 'reminders', `<ul class="shop-list">${items.map((x) => remRow(x, false)).join('')}</ul>`);
}

function viewReminders() {
  const act = remActive();
  const done = S.reminders.filter((x) => x.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>التذكيرات</h2>${act.length ? `<small class="num">باقٍ ${act.length}</small>` : ''}</div>
    <p class="note-text explain">ما تحتاج أن تتذكره ولا يدخل في المهام أو الأهداف أو القوائم أو الأفكار. يظهر في «اليوم»، ويذكّرك به التطبيق حين تفتحه بعد أربع ساعات من آخر تذكير.</p>
    ${remForm()}
    ${act.length ? `<ul class="shop-list">${act.map((x) => remRow(x, true)).join('')}</ul>` : emptyHTML('لا تذكيرات', 'أضف ما تريد ألا تنساه.')}
  </section>
  ${done.length ? `<details class="panel shop-done"><summary>تم (${done.length})</summary><ul class="shop-list">${done.map((x) => remRow(x, true)).join('')}</ul></details>` : ''}`;
}

// on opening the app: the reminders again, at most once every four hours
function remindPopup(force) {
  // the app's data not loaded yet (app.js comes after this file, and slowly on a first opening): in a moment
  if (typeof S === 'undefined') { setTimeout(() => remindPopup(force), 1000); return; }
  const act = remActive();
  // not over something being written: any open sheet (a task, a project…), a note or a journal entry
  const busy = !!document.querySelector('dialog[open]') || (typeof mstate !== 'undefined' && !!mstate) || (typeof jstate !== 'undefined' && !!jstate);
  if (!act.length || busy) return;
  const last = Number(S.settings.remShown) || 0;
  if (!force && Date.now() - last < REMIND_EVERY) return;
  S.settings.remShown = Date.now();
  save();
  ldraft = { kind: 'remshow', id: 'x', isNew: false };
  $('libForm').innerHTML = `${sheetHead('تذكيراتك')}
    <ul class="shop-list">${act.map((x) => remRow(x, false)).join('')}</ul>
    <div class="sheet-actions"><button type="button" class="primary" data-action="lib-close">حسناً</button></div>`;
  showLib();
}

// the header's «تذكير» button: write a reminder from any page, like «فكرة»
function openRemQuick() {
  ldraft = { kind: 'remquick', id: 'x', isNew: true };
  $('libForm').innerHTML = `${sheetHead('🔔 تذكير جديد')}
    <label class="field"><span>التذكير</span><textarea id="remQ" rows="2" placeholder="مثل: أعد الكتاب لصاحبه"></textarea></label>
    ${remTimeHTML()}
    <div class="sheet-actions"><button type="submit" class="primary">احفظ التذكير</button></div>`;
  showLib();
  setTimeout(() => { const x = $('remQ'); if (x) x.focus(); }, 50);
}
function saveRemQuick() {
  const texts = $('remQ').value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!texts.length) { toast('اكتب التذكير أولاً.'); return false; }
  const when = remRead($('libForm'));
  if (!when) return false;
  for (const text of texts) S.reminders.push(normalizeReminder({ text, ...when }));
  // just written, so just seen: the next reminder comes four hours from now
  S.settings.remShown = Date.now();
  save();
  const nx = when.times.length ? remNext(normalizeReminder(when)) : null;
  if (nx) ensureNotifPermission();
  toast(nx ? `حُفظ، ويرنّ منبهه ${remWhenOf(nx)}` : `حُفظ في «${pageName('reminders')}»`);
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="rem-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'rem-quick') { openRemQuick(); return; }
  if (action === 'rem-addtime') { const box = el.parentElement.querySelector('.rem-more'); box.insertAdjacentHTML('beforeend', '<input type="time" name="atx" aria-label="ساعة أخرى">'); box.lastElementChild.focus(); return; }
  const x = S.reminders.find((r) => r.id === v);
  if (!x) return;
  if (action === 'rem-toggle') {
    x.done = !x.done; x.doneAt = x.done ? today() : ''; x.updated = Date.now();
    save(); render();
    // the sheet lists them too: its row follows
    if (el.closest('#libForm')) { el.setAttribute('aria-pressed', String(x.done)); el.parentElement.classList.toggle('got', x.done); el.querySelector('.shop-box').textContent = x.done ? '✓' : ''; }
  }
  if (action === 'rem-del') {
    // first tap asks «متأكد؟», the second deletes
    if (remUi.armed !== v) { remUi.armed = v; render(); setTimeout(() => { if (remUi.armed === v) { remUi.armed = ''; render(); } }, 4000); return; }
    remUi.armed = '';
    S.reminders = S.reminders.filter((r) => r.id !== v);
    // its alarm goes with it
    for (const o of [S.fired, S.snoozed]) for (const k of Object.keys(o)) if (k.startsWith(`${REM_PRE}${v}|`) || k.startsWith(`${REM_PRE}${v}@`)) delete o[k];
    save(); render(); toast('حُذف التذكير');
  }
});
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-rem-form]')) return;
  e.preventDefault();
  const f = e.target.elements;
  const texts = f.what.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!texts.length) return;
  const when = remRead(e.target);
  if (!when) return;
  for (const text of texts) S.reminders.push(normalizeReminder({ text, ...when }));
  // just written, so just seen: the next reminder comes four hours from now
  S.settings.remShown = Date.now();
  save(); render();
  const nx = when.times.length ? remNext(normalizeReminder(when)) : null;
  if (nx) { ensureNotifPermission(); toast(`يرنّ منبهه ${remWhenOf(nx)}`); }
  const again = document.querySelector('[data-rem-form] input[name=what]');
  if (again) again.focus();
});
// opening the app, or coming back to it
setTimeout(() => remindPopup(), 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => remindPopup(), 600); });

Object.assign(LibraryViews, { reminders: viewReminders });
// the repetition's fields follow what is chosen (and a field the owner set keeps his value)
document.addEventListener('change', (e) => {
  const root = e.target.closest('[data-rem-form], #libForm');
  if (!root || !root.querySelector('.rem-rep')) return;
  if (['rmd', 'rwd', 'rnth', 'rd'].includes(e.target.name)) e.target.dataset.touched = '1';
  remRepShow(root);
});
document.addEventListener('toggle', (e) => { if (e.target.matches && e.target.matches('.rem-rep') && e.target.open) remRepShow(e.target.closest('[data-rem-form], #libForm') || e.target); }, true);
