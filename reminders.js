'use strict';
// «التذكيرات»: small things to keep in mind that are not tasks, goals, lists or ideas (simple to do,
// easy to forget). They show on «اليوم», have their own page, and when the app is opened at least
// four hours after the last time they were shown, a sheet lists them again.

const REMIND_EVERY = 4 * 3600000;
const remUi = { armed: '' };

function normalizeReminder(x) {
  return { id: x.id || uid(), text: String(x.text || ''), done: !!x.done, doneAt: x.doneAt || '', created: x.created || Date.now(), updated: x.updated || Date.now(), due: x.due || '', time: x.time || '' };
}
// a reminder with a day and an hour (v119, the owner's request: «منبهات أكتب فيها ما أشاء فتظهر لي بالمكتوب خارج التطبيق إن
// حان وقتها»): an alarm that rings as a task's does (its tone, five minutes, with the app closed in the Android app),
// its whole text in the phone's notification, with «تمت» (done) and «غفوة»; known to the alarms as «rem:<id>|<day>|0»
const REM_PRE = 'rem:';
const remOf = (id) => (String(id || '').startsWith(REM_PRE) ? S.reminders.find((r) => r.id === String(id).slice(REM_PRE.length)) || null : null);
const remTimed = (r) => !!(r.due && r.time);
const remKey = (r) => `${REM_PRE}${r.id}|${r.due}|0`;
const remAt = (r) => parse(r.due).getTime() + minutesOf(r.time) * 60000;
const remWhen = (r) => `${dueLabel(r.due)} | ${fmtMin(minutesOf(r.time))}`;
// what the alarms of tasks read of it (its id, text and hour), and its notification: the hour above, its text in full
const remAsTask = (r) => ({ id: REM_PRE + r.id, title: r.text, time: r.time, prayer: null });
const remNoteTitle = (r) => `منبه | ${fmtMin(minutesOf(r.time))}`;
// the day and hour written with a reminder: none (a reminder as before), or a time to come (the day today if none)
function remPick(day, time) {
  if (!day && !time) return { due: '', time: '' };
  if (!time) { toast('اختر الساعة للمنبه.'); return null; }
  const r = { due: day || today(), time };
  if (remAt(r) <= Date.now()) { toast('هذا الوقت مضى، اختر وقتاً قادماً.'); return null; }
  return r;
}
const remTimeHTML = (dayId, timeId) => `<div class="rem-time"><span>منبه (اختياري)</span><input type="date" ${dayId ? `id="${dayId}"` : 'name="day"'} aria-label="يوم المنبه"><input type="time" ${timeId ? `id="${timeId}"` : 'name="at"'} aria-label="ساعة المنبه"></div>`;
const remActive = () => S.reminders.filter((x) => !x.done).sort((a, b) => b.created - a.created);
const remDoneToday = () => S.reminders.filter((x) => x.done && x.doneAt === today());

function remRow(x, withDelete) {
  const armed = remUi.armed === x.id;
  return `<li class="${x.done ? 'got' : ''}"><button type="button" class="shop-item" data-action="rem-toggle" data-v="${x.id}" aria-pressed="${x.done}">
      <span class="shop-box" aria-hidden="true">${x.done ? '✓' : ''}</span><span class="shop-name">${esc(x.text)}${remTimed(x) ? `<small class="rem-when">منبه: ${esc(remWhen(x))}</small>` : ''}</span>
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
  const act = remActive();
  if (!act.length || (typeof lsheet === 'function' && lsheet().open)) return;
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
    ${remTimeHTML('remQd', 'remQt')}
    <div class="sheet-actions"><button type="submit" class="primary">احفظ التذكير</button></div>`;
  showLib();
  setTimeout(() => { const x = $('remQ'); if (x) x.focus(); }, 50);
}
function saveRemQuick() {
  const texts = $('remQ').value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!texts.length) { toast('اكتب التذكير أولاً.'); return false; }
  const when = remPick($('remQd').value, $('remQt').value);
  if (!when) return false;
  for (const text of texts) S.reminders.push(normalizeReminder({ text, ...when }));
  // just written, so just seen: the next reminder comes four hours from now
  S.settings.remShown = Date.now();
  save();
  if (when.time) ensureNotifPermission();
  toast(when.time ? `حُفظ، ويرنّ منبهه ${remWhen(when)}` : `حُفظ في «${pageName('reminders')}»`);
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="rem-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'rem-quick') { openRemQuick(); return; }
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
    for (const o of [S.fired, S.snoozed]) for (const k of Object.keys(o)) if (k.startsWith(`${REM_PRE}${v}|`)) delete o[k];
    save(); render(); toast('حُذف التذكير');
  }
});
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-rem-form]')) return;
  e.preventDefault();
  const f = e.target.elements;
  const texts = f.what.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!texts.length) return;
  const when = remPick(f.day.value, f.at.value);
  if (!when) return;
  for (const text of texts) S.reminders.push(normalizeReminder({ text, ...when }));
  // just written, so just seen: the next reminder comes four hours from now
  S.settings.remShown = Date.now();
  save(); render();
  if (when.time) { ensureNotifPermission(); toast(`يرنّ منبهه ${remWhen(when)}`); }
  const again = document.querySelector('[data-rem-form] input[name=what]');
  if (again) again.focus();
});
// opening the app, or coming back to it
setTimeout(() => remindPopup(), 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => remindPopup(), 600); });

Object.assign(LibraryViews, { reminders: viewReminders });
