'use strict';
// «اليوم» reminders gathered from the other pages: memorisation due, books to recall,
// decisions to review, people to reach, and occasions.

function remindersHTML() {
  const rows = [];
  // memorisation plans scheduled today, or a portion still being learnt
  for (const p of S.hplans) {
    const pending = planPending(p);
    if (pending) { rows.push(['🧠', `أكمل حفظ: ${p.title}`, planRange(p, p.pos - parsePoemLen(pending), p.pos), 'hz-plan-go', p.id]); continue; }
    if (!planToday(p) || p.log[today()]) continue;
    const { a, b, total } = planNext(p);
    if (a >= total) continue;
    rows.push(['🧠', `حفظ اليوم: ${p.title}`, `${unitWord(p.type, b - a)} (${planRange(p, a, b)})`, 'hz-plan-go', p.id]);
  }
  const hz = hzDue();
  if (hz.length) rows.push(['📖', `مراجعة الحفظ: ${hz.length === 1 ? 'نص واحد' : hz.length === 2 ? 'نصّان' : `${hz.length} نصوص`}`, 'قبل أن تنساه', 'hz-review', '']);
  for (const b of booksDue().slice(0, 2)) rows.push(['🔁', `استذكار كتاب «${b.title}»`, 'ماذا تتذكر منه؟', 'lib-book-review', b.id]);
  for (const x of decDue().slice(0, 2)) rows.push(['⚖️', `راجع قرارك: ${x.title}`, 'ماذا حدث فعلاً؟', 'dec-open', x.id]);
  for (const p of S.people) {
    const b = nextBirthday(p);
    if (b && b.days <= 3) rows.push(['🎂', b.days === 0 ? `اليوم مناسبة ${p.name}` : `مناسبة ${p.name} ${afterDays(b.days)}`, p.gifts ? `أفكار الهدايا: ${excerpt(p.gifts, 40)}` : 'لا تنسَ التهنئة', 'ppl-open', p.id]);
  }
  const due = S.people.filter((p) => (contactDue(p) ?? -1) >= 0).sort((a, b) => contactDue(b) - contactDue(a));
  for (const p of due.slice(0, 3)) {
    const last = lastContact(p);
    rows.push(['💞', `تواصل مع ${p.name}`, last ? `آخر تواصل ${relDate(last)}` : 'لم تسجّل تواصلاً بعد', 'ppl-log', p.id]);
  }
  if (due.length > 3) rows.push(['💞', `و${due.length - 3} آخرون حان التواصل معهم`, 'صفحة الأحبّة', 'go-people', '']);
  if (!rows.length) return '';
  return `<section class="reminders" aria-label="تذكيرات">
    <h2>تذكيرات</h2>
    <ul>${rows.map(([e, t, s, a, v]) => `<li><button type="button" data-action="${a}" data-v="${esc(v)}"><span class="rm-e">${e}</span><span><b>${esc(t)}</b><small>${esc(s)}</small></span></button></li>`).join('')}</ul>
  </section>`;
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="go-people"]')) go('people');
});
