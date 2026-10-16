'use strict';
// «اليوم» shows only what is due today, each item under the name of the page it comes from
// (الحفظ، الكتب، سجل القرارات، الأحبّة…), with a link to that page.

function todayBlock(title, tab, inner, extra = '') {
  if (!inner) return '';
  return `<section class="tblock" aria-label="${esc(title)}">
    <div class="tblock-h"><h2>${esc(title)}${extra}</h2>${tab ? `<button type="button" class="tblock-go" data-tab="${tab}">${esc(title)} ${icon('next')}</button>` : ''}</div>
    ${inner}
  </section>`;
}
const tRow = (e, t, s, action, v, done) => `<li><button type="button"${done ? ' class="done"' : ''} data-action="${action}" data-v="${esc(v)}"><span class="rm-e">${e}</span><span><b>${esc(t)}</b>${s ? `<small>${esc(s)}</small>` : ''}</span></button></li>`;
const tList = (rows) => (rows.length ? `<ul class="tlist">${rows.join('')}</ul>` : '');

// الحفظ: a plan's portion only on its days; reviews due today (or missed)
function hifzTodayHTML() {
  const rows = [];
  const t0 = today();
  for (const p of S.hplans) {
    if (!planToday(p)) continue;
    const pending = planPending(p);
    if (pending) { rows.push(tRow('🧠', `أكمل حفظ: ${p.title}`, planRange(p, p.pos - parsePoemLen(pending), p.pos), 'hz-plan-go', p.id)); continue; }
    const { a, b, total } = planNext(p);
    if (p.log[t0]) rows.push(tRow('✓', `${p.title}: أتممت مقدار اليوم`, '', 'hz-plan-edit', p.id, true));
    else if (a < total) rows.push(tRow('🧠', `مقدار اليوم: ${p.title}`, `${unitWord(p.type, b - a)} (${planRange(p, a, b)})`, 'hz-plan-go', p.id));
  }
  const due = hzDue();
  if (due.length) rows.push(tRow('📖', `مراجعة اليوم: ${due.length === 1 ? 'نص واحد' : due.length === 2 ? 'نصّان' : `${due.length} نصوص`}`, '', 'hz-review', ''));
  return todayBlock('الحفظ', 'hifz', tList(rows));
}

function booksTodayHTML() {
  return todayBlock('الكتب', 'books', tList(booksDue().map((b) => tRow('🔁', `استذكار «${b.title}»`, '', 'lib-book-review', b.id))));
}

function decisionsTodayHTML() {
  return todayBlock('سجل القرارات', 'decisions', tList(decDue().map((x) => tRow('⚖️', `راجع قرارك: ${x.title}`, '', 'dec-open', x.id))));
}

// الأحبّة: an occasion on its day, and whoever is due to be contacted
function peopleTodayHTML() {
  const rows = [];
  for (const p of S.people) {
    const b = nextBirthday(p);
    if (b && b.days === 0) rows.push(tRow('🎂', `اليوم مناسبة ${p.name}`, p.gifts ? `أفكار الهدايا: ${excerpt(p.gifts, 40)}` : 'لا تنسَ التهنئة', 'ppl-open', p.id));
  }
  const due = S.people.filter((p) => (contactDue(p) ?? -1) >= 0).sort((a, b) => contactDue(b) - contactDue(a));
  for (const p of due.slice(0, 4)) {
    const last = lastContact(p);
    rows.push(tRow('💞', `تواصل مع ${p.name}`, last ? `آخر تواصل ${relDate(last)}` : 'لم تسجّل تواصلاً بعد', 'ppl-log', p.id));
  }
  if (due.length > 4) rows.push(tRow('💞', `و${due.length - 4} آخرون حان التواصل معهم`, '', 'go-people', ''));
  return todayBlock('الأحبّة', 'people', tList(rows));
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="go-people"]')) go('people');
});
