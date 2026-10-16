'use strict';
// «التذكيرات»: small things to keep in mind that are not tasks, goals, lists or ideas (simple to do,
// easy to forget). They show on «اليوم», have their own page, and when the app is opened at least
// four hours after the last time they were shown, a sheet lists them again.

const REMIND_EVERY = 4 * 3600000;
const remUi = { armed: '' };

function normalizeReminder(x) {
  return { id: x.id || uid(), text: String(x.text || ''), done: !!x.done, doneAt: x.doneAt || '', created: x.created || Date.now(), updated: x.updated || Date.now() };
}
const remActive = () => S.reminders.filter((x) => !x.done).sort((a, b) => b.created - a.created);
const remDoneToday = () => S.reminders.filter((x) => x.done && x.doneAt === today());

function remRow(x, withDelete) {
  const armed = remUi.armed === x.id;
  return `<li class="${x.done ? 'got' : ''}"><button type="button" class="shop-item" data-action="rem-toggle" data-v="${x.id}" aria-pressed="${x.done}">
      <span class="shop-box" aria-hidden="true">${x.done ? '✓' : ''}</span><span class="shop-name">${esc(x.text)}</span>
    </button>${withDelete ? `<button type="button" class="fin-del${armed ? ' armed' : ''}" data-action="rem-del" data-v="${x.id}" aria-label="حذف">${armed ? 'متأكد؟' : '✕'}</button>` : ''}</li>`;
}
const remForm = () => `<form class="idea-quick shop-add" data-rem-form autocomplete="off">
    <input type="text" name="what" placeholder="تذكير جديد، مثل: أعد الكتاب لصاحبه" aria-label="تذكير جديد">
    <button type="submit" class="primary">${icon('plus')}</button>
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

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="rem-"]');
  if (!el) return;
  const { action, v } = el.dataset;
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
    save(); render(); toast('حُذف التذكير');
  }
});
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-rem-form]')) return;
  e.preventDefault();
  const texts = e.target.elements.what.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!texts.length) return;
  for (const text of texts) S.reminders.push(normalizeReminder({ text }));
  // just written, so just seen: the next reminder comes four hours from now
  S.settings.remShown = Date.now();
  save(); render();
  const again = document.querySelector('[data-rem-form] input[name=what]');
  if (again) again.focus();
});
// opening the app, or coming back to it
setTimeout(() => remindPopup(), 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => remindPopup(), 600); });

Object.assign(LibraryViews, { reminders: viewReminders });
