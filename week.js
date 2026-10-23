'use strict';
// The week (Sunday to Saturday) and its record in S.weeks. The page «التخطيط الأسبوعي» was removed in v97 at the
// user's request: the week is planned in «خطِّط» (plan.js), whose review is kept here. A week's old three
// priorities (focus) stay, and the reports still show them.

const weekStartOf = (d) => addDays(d, -parse(d).getDay()); // Sunday
// weeks used to start on Saturday (until v43): an old id moves to its Sunday so the week keeps its notes
const sundayId = (id) => (/^\d{4}-\d{2}-\d{2}$/.test(id) && parse(id).getDay() === 6 ? addDays(id, 1) : id);
// review («خطِّط»): when, the week's share before anything was cancelled (null: nothing was in its plan), how many moved, what was cancelled, the three answers
function normalizeReview(r) {
  if (!r || typeof r !== 'object') return null;
  return { at: r.at || today(), pct: r.pct === null ? null : Number(r.pct) || 0, moved: Number(r.moved) || 0, dropped: Array.isArray(r.dropped) ? r.dropped.map(String) : [],
    worked: String(r.worked || ''), missed: String(r.missed || ''), change: String(r.change || '') };
}
function normalizeWeek(w) { return { id: w.id ? sundayId(w.id) : weekStartOf(today()), focus: [0, 1, 2].map((i) => String((w.focus || [])[i] || '')), note: String(w.note || ''), review: normalizeReview(w.review) }; }
