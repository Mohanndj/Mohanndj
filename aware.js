'use strict';
// «التقدم الشامل»: for a period (a week, a month or a year), every area the app follows gets a score
// from 0 to 100 and the facts behind it, then one overall activity index.
// The score is PROGRESS: what was done out of everything required in the WHOLE period
// (3 sessions a week → each is a third; 7 readings → each is a seventh), so day one of a week starts low and grows.
// Accuracy rules, the same everywhere:
// - nothing is called missed while its day has not ended (today, or the rest of the period);
// - nothing counts before it existed (a plan, a goal, a person, a journal) or after it ended;
// - an area with nothing to measure gets no score, only its facts (never a made-up 100% or 0%);
// - a fact is said only when it happened (no «تواصلت» without a recorded contact).

// ---------- periods ----------
function periodOf(type, key) {
  const t0 = today();
  let start, end, title, sub, prev, next;
  if (type === 'week') {
    start = weekStartOf(key || t0); end = addDays(start, 6);
    title = `أسبوع ${fmtDate(start, { day: 'numeric', month: 'long' })} – ${fmtDate(end, { day: 'numeric', month: 'long' })}`;
    sub = `${fmtHijri(start, { day: 'numeric', month: 'long' })} – ${fmtHijri(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    prev = addDays(start, -7); next = addDays(start, 7);
    key = start;
  } else if (type === 'year') {
    const y = Number(key || t0.slice(0, 4));
    start = `${y}-01-01`; end = `${y}-12-31`;
    title = `عام ${y}`; sub = `${fmtHijri(start, { month: 'long', year: 'numeric' })} – ${fmtHijri(end, { month: 'long', year: 'numeric' })}`;
    prev = String(y - 1); next = String(y + 1); key = String(y);
  } else {
    type = 'month';
    const m = key || t0.slice(0, 7);
    const [y, mo] = m.split('-').map(Number);
    start = `${m}-01`; end = iso(new Date(y, mo, 0));
    title = parse(start).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
    const a = fmtHijri(start, { month: 'long', year: 'numeric' }), b = fmtHijri(end, { month: 'long', year: 'numeric' });
    sub = a === b ? a : `${fmtHijri(start, { month: 'long' })} – ${b}`;
    prev = iso(new Date(y, mo - 2, 1)).slice(0, 7); next = iso(new Date(y, mo, 1)).slice(0, 7);
    key = m;
  }
  const last = end < t0 ? end : t0;
  const days = [], all = [];
  for (let d = start; d <= last; d = addDays(d, 1)) days.push(d);
  for (let d = start; d <= end; d = addDays(d, 1)) all.push(d);
  const word = { week: 'الأسبوع', month: 'الشهر', year: 'العام' }[type];
  return { type, key, id: `${type[0]}:${key}`, start, end, last, days, all, title, sub, prev, next, word, current: start <= t0 && t0 <= end, future: start > t0 };
}

const pctOf = (a, b) => (b ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : null);
const dayOfTs = (ts) => (ts ? iso(new Date(ts)) : '');
// pages read from a book's log: the first page recorded is where tracking began, not pages read
function pagesIn(b, from, to) {
  const log = (b.log || []).slice().sort((a, c) => a.d.localeCompare(c.d));
  let n = 0;
  for (let i = 1; i < log.length; i++) if (log[i].d >= from && log[i].d <= to) n += Math.max(0, log[i].p - log[i - 1].p);
  return n;
}
// progress of a recurring goal over the whole period: every time it is due counts as an equal share;
// a counted goal (8 cups) gives part of its share for part of the count
const oneDec = (x) => Math.round(x * 10) / 10;
function goalRun(t, P) {
  let total = 0, hit = 0, left = 0;
  for (const d of P.all) {
    if (!occursOn(t, d)) continue;
    total++;
    if (t.completions[d]) hit++;
    else if (t.target > 1 && t.counts && t.counts[d]) hit += Math.min(1, t.counts[d] / t.target);
    if (d >= today() && !t.completions[d]) left++;
  }
  return { total, hit: oneDec(hit), left };
}

function awareStats(P) {
  if (typeof P === 'string') P = periodOf('month', P);
  const { start, last, days, all, end } = P;
  const inAll = (d) => !!d && d >= start && d <= end;
  const leftTxt = (n) => (P.current && n ? ` · بقي ${n}` : '');
  const t0 = today();
  const inP = (d) => !!d && d >= start && d <= last;
  const A = [];
  const add = (key, icon, title, tab, score, facts, detail = []) => { facts = facts.filter(Boolean); detail = detail.filter(Boolean); if (facts.length || detail.length) A.push({ key, icon, title, tab, score, facts, detail }); };
  const list = (xs, n = 12) => (xs.length > n ? `${xs.slice(0, n).join('، ')}، و${xs.length - n} غيرها` : xs.join('، '));

  // ✅ المهام: those due in the period (a task due today counts once done), plus what was done anyway
  const due = S.tasks.filter((t) => !isGoal(t) && inAll(t.due));
  const doneDue = due.filter((t) => t.done);
  const doneAll = S.tasks.filter((t) => !isGoal(t) && t.done && inP(dayOfTs(t.doneAt)));
  const extra = doneAll.filter((t) => !due.includes(t)).length;
  const missed = due.filter((t) => !t.done && t.due < t0);
  const steps = S.tasks.reduce((n, t) => n + t.subtasks.filter((s) => s.done && inP(dayOfTs(s.doneAt))).length, 0);
  const lateNow = P.current ? S.tasks.filter((t) => !isGoal(t) && !t.done && t.due && t.due < t0).length : 0;
  const closed = closedDays().filter(inP).length;
  add('tasks', '✅', 'المهام', 'tasks', pctOf(doneDue.length, due.length), [
    due.length && `أنجزت ${doneDue.length} من ${due.length} مهمة موعدها في هذا ${P.word}${leftTxt(due.filter((t) => !t.done && t.due >= t0).length)}`,
    extra && `وأنجزت ${plural(extra, 'مهمة أخرى', 'مهمتين أخريين', 'مهام أخرى', 'مهمة أخرى')} بلا موعد أو من قبله`,
    steps && `أتممت ${plural(steps, 'خطوة واحدة', 'خطوتين', 'خطوات', 'خطوة')} من خطوات المهام`,
    lateNow && `${plural(lateNow, 'مهمة متأخرة', 'مهمتان متأخرتان', 'مهام متأخرة', 'مهمة متأخرة')} الآن`,
    closed && `أغلقت يومك ${plural(closed, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')} من ${days.length}`,
  ], [doneAll.length && `المنجزة: ${list(doneAll.map((t) => t.title))}`, missed.length && `فاتت: ${list(missed.map((t) => `${t.title} (${fmtDate(t.due, { day: 'numeric', month: 'short' })})`))}`]);

  // 🎯 الأهداف المتكررة (غير العادات وأهداف القراءة) والأهداف لمرة واحدة
  const goals = S.tasks.filter((t) => isRepeat(t) && !isHabit(t) && !t.bookId).map((t) => ({ t, ...goalRun(t, P) })).filter((g) => g.total);
  const gT = sum(goals, (g) => g.total), gH = sum(goals, (g) => g.hit);
  const once = S.tasks.filter((t) => isGoal(t) && !isRepeat(t) && t.done && inP(dayOfTs(t.doneAt)));
  add('goals', '🎯', 'الأهداف', 'goals', pctOf(gH, gT), [
    gT && `أنجزت ${oneDec(gH)} من ${gT} موعداً لأهدافك المتكررة${leftTxt(sum(goals, (g) => g.left))}`,
    ...goals.slice().sort((a, b) => a.hit / a.total - b.hit / b.total).slice(0, 3).map((g) => `«${g.t.title}»: ${g.hit} من ${g.total}`),
    once.length && `حققت: ${list(once.map((t) => t.title), 4)}`,
  ], goals.map((g) => `«${g.t.title}»: ${g.hit} من ${g.total} (${pctOf(g.hit, g.total)}٪)`));

  // 🌱 بناء العادات
  const habits = S.tasks.filter((t) => isHabit(t)).map((t) => ({ t, ...goalRun(t, P) })).filter((h) => h.total);
  add('habits', '🌱', 'بناء العادات', 'goals', pctOf(sum(habits, (h) => h.hit), sum(habits, (h) => h.total)),
    habits.map((h) => `«${h.t.title}»: ${h.hit} من ${h.total} · قوتها ${habitStats(h.t, last).strength}٪`));

  // 🚭 عادات أتركها: clean days over the days it was being left in the period
  const qScores = [], qFacts = [], qDetail = [];
  for (const q of S.quits) {
    const from = dayOfTs(q.start) > start ? dayOfTs(q.start) : start;
    const to = q.doneAt && q.doneAt < end ? q.doneAt : end;
    const span = all.filter((d) => d >= from && d <= to).length;
    const past = days.filter((d) => d >= from && d <= to).length;
    if (!span || !past) continue;
    const sl = q.slips.filter((s) => inP(dayOfTs(s.at)));
    const bad = new Set(sl.map((s) => dayOfTs(s.at))).size;
    qScores.push(pctOf(past - bad, span));
    qFacts.push(`${q.title}: ${sl.length ? `${plural(sl.length, 'زلّة واحدة', 'زلّتان', 'زلّات', 'زلّة')} في ${past} يوماً` : `${past} يوماً بلا زلّة`} من ${span}`);
    if (sl.length) qDetail.push(`${q.title}، دوافع الزلّات: ${list(sl.map((s) => s.trigger || 'غير محدد'))}`);
  }
  add('quits', '🚭', 'عادات أتركها', 'goals', qScores.length ? Math.round(sum(qScores, (x) => x) / qScores.length) : null, qFacts, qDetail);

  // 📖 الحفظ: scheduled sessions from the plan's start until it ended
  let sched = 0, kept = 0, hLeft = 0;
  for (const p of S.hplans) for (const d of all) {
    if (d < dayOfTs(p.created) || (p.doneAt && d > p.doneAt) || !p.days.includes(parse(d).getDay())) continue;
    sched++; if (p.log[d]) kept++; else if (d >= t0) hLeft++;
  }
  const reviews = S.hifz.reduce((n, h) => n + (h.hist || []).filter(inP).length, 0);
  const learned = S.hifz.filter((h) => inP(h.learnedAt));
  add('hifz', '📖', 'الحفظ', 'hifz', pctOf(kept, sched), [
    sched && `أتممت ${kept} من ${sched} جلسة حفظ مقررة في هذا ${P.word}${leftTxt(hLeft)}`,
    learned.length && `حفظت ${plural(learned.length, 'مقطعاً واحداً', 'مقطعين', 'مقاطع', 'مقطعاً')}`,
    reviews && `راجعت ${plural(reviews, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')}`,
  ], [learned.length && `ما حفظته: ${list(learned.map((h) => h.title))}`]);

  // 📚 القراءة: reading sessions on their days, pages, finished books, benefits, recall
  let rS = 0, rH = 0, rLeft = 0;
  for (const g of S.tasks.filter((t) => t.bookId && isRepeat(t))) { const r = goalRun(g, P); rS += r.total; rH += r.hit; rLeft += r.left; }
  for (const t of S.tasks.filter((x) => x.bookId && !isRepeat(x) && x.projectId)) {
    const b = getBook(t.bookId); if (!b || !b.rdays.length) continue;
    for (const d of all) { if (d < dayOfTs(t.created) || !b.rdays.includes(parse(d).getDay())) continue; rS++; if (t.completions[d]) rH++; else if (d >= t0) rLeft++; }
  }
  const pages = S.books.reduce((n, b) => n + pagesIn(b, start, last), 0);
  const finished = S.books.filter((b) => b.status === 'read' && inP(b.end));
  const bens = S.benefits.filter((f) => inP(dayOfTs(f.created)));
  const recalls = S.books.reduce((n, b) => n + b.rvLog.filter((e) => inP(e.d)).length, 0);
  const pendingRecall = S.books.filter((b) => b.rv && b.status === 'read' && b.rvDue && b.rvDue <= end).length;
  add('books', '📚', 'القراءة', 'books', rS + recalls + pendingRecall ? pctOf(rH + recalls, rS + recalls + pendingRecall) : null, [
    rS && `قرأت في ${rH} من ${rS} موعد قراءة في هذا ${P.word}${leftTxt(rLeft)}`,
    pages && `قرأت ${plural(pages, 'صفحة واحدة', 'صفحتين', 'صفحات', 'صفحة')}`,
    finished.length && `أنهيت: ${list(finished.map((b) => `«${b.title}»`), 4)}`,
    bens.length && `سجّلت ${plural(bens.length, 'فائدة واحدة', 'فائدتين', 'فوائد', 'فائدة')}`,
    recalls && `استذكرت ${plural(recalls, 'كتاباً واحداً', 'كتابين', 'كتب', 'كتاباً')}`,
    pendingRecall && `${pendingRecall} ينتظر الاستذكار`,
  ], [bens.length && `الفوائد: ${list(bens.map((f) => f.title || excerpt(f.lesson, 50)))}`]);

  // 📔 يومياتي: days written since the first entry (today only once written)
  const written = new Set(S.journal.filter((j) => !jEmpty(j)).map((j) => j.date));
  const first = [...written].sort()[0];
  const jDays = first ? all.filter((d) => d >= first) : [];
  const jHit = jDays.filter((d) => written.has(d)).length;
  const moods = S.journal.filter((j) => inP(j.date) && j.mood).map((j) => j.mood);
  add('journal', '📔', 'يومياتي وتأملاتي', 'journal', jDays.length ? pctOf(jHit, jDays.length) : null, [
    jDays.length && `كتبت في ${plural(jHit, 'يوم واحد', 'يومين', 'أيام', 'يوماً')} من ${jDays.length}${leftTxt(jDays.filter((d) => d >= t0 && !written.has(d)).length)}`,
    moods.length && `متوسط مزاجك: ${MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) - 1].join(' ')}`,
  ]);

  // 💞 الأحبّة: contacts actually recorded; expected ones by each person's rhythm since they were added
  let exp = 0, got = 0, nContacts = 0;
  const never = [], overdue = [];
  for (const p of S.people) {
    const cs = p.contacts.filter((c) => inP(c.d));
    nContacts += cs.length;
    if (!p.every) continue;
    const from = dayOfTs(p.created) > start ? dayOfTs(p.created) : start;
    const span = all.filter((d) => d >= from).length;
    const e = Math.floor(span / p.every);
    if (e) { exp += e; got += Math.min(cs.length, e); }
    if (!p.contacts.length && dayOfTs(p.created) <= last && daysBetween(dayOfTs(p.created), last) >= p.every) never.push(p.name);
    else if (p.contacts.length) { const lc = p.contacts.filter((c) => c.d <= last).reduce((a, c) => (c.d > a ? c.d : a), ''); if (lc && daysBetween(lc, last) > p.every) overdue.push(p.name); }
  }
  const whom = new Set(S.people.filter((p) => p.contacts.some((c) => inP(c.d))).map((p) => p.name));
  add('people', '💞', 'الأحبّة', 'people', exp ? pctOf(got, exp) : null, [
    nContacts ? `تواصلت ${plural(nContacts, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')} مع ${plural(whom.size, 'شخص واحد', 'شخصين', 'أشخاص', 'شخصاً')}` : (S.people.length ? `لم تسجّل أي تواصل في هذا ${P.word}` : ''),
    overdue.length && `فات موعد صلة: ${list(overdue, 5)}`,
    never.length && `لم تتواصل بعد مع: ${list(never, 5)}`,
  ], [whom.size && `تواصلت مع: ${list([...whom])}`]);

  // ⚖️ سجل القرارات
  const made = S.decisions.filter((x) => inP(x.date));
  const dueRev = S.decisions.filter((x) => x.reviewAt && x.reviewAt >= start && x.reviewAt <= end);
  const revd = dueRev.filter((x) => x.reviewedAt).length;
  add('decisions', '⚖️', 'سجل القرارات', 'decisions', pctOf(revd, dueRev.length), [
    made.length && `سجّلت ${plural(made.length, 'قراراً واحداً', 'قرارين', 'قرارات', 'قراراً')}`,
    dueRev.length && `راجعت ${revd} من ${dueRev.length} حان وقت مراجعته`,
  ], [made.length && `القرارات: ${list(made.map((x) => x.title))}`]);

  // 🥗 الصحة: only days on which you recorded what you ate
  let planned = 0, ate = 0, tracked = 0, kcal = 0;
  const gcount = {};
  const planFrom = S.meals.length ? dayOfTs(Math.min(...S.meals.map((x) => x.created))) : '9999';
  const planDays = all.filter((d) => d >= planFrom && mealsOf(parse(d).getDay()).length);
  for (const d of planDays) {
    const items = mealsOf(parse(d).getDay()).flatMap((x) => x.items);
    planned += items.length;
    const eaten = eatenOn(d);
    if (!eaten.length) continue;
    const g = items.filter((x) => eaten.includes(x.id));
    tracked++; ate += g.length; kcal += sumItems(g).kcal;
    for (const x of g) for (const k of x.groups) gcount[k] = (gcount[k] || 0) + 1;
  }
  const weeks = Math.max(1, tracked / 7);
  const coverage = Object.entries(GROUPS).map(([k, [, , rec]]) => Math.min(100, ((gcount[k] || 0) / (rec * weeks)) * 100));
  add('health', '🥗', 'الصحة والتغذية', 'health', planned ? pctOf(ate, planned) : null, [
    planDays.length && `سجّلت أكلك في ${tracked} من ${planDays.length} يوماً في خطتك`,
    planned && `أكلت ${ate} من ${plural(planned, 'صنف واحد', 'صنفين', 'أصناف', 'صنفاً')} في خطتك لهذا ${P.word}`,
    tracked && `متوسط ما أكلته ${Math.round(kcal / tracked)} سعرة، والتكامل الغذائي ${Math.round(sum(coverage, (x) => x) / coverage.length)}٪`,
  ]);

  // 💰 المالية: spending against the plans' expenses, prorated to the days that passed
  let plannedExp = 0;
  for (const d of days) { const mp = planForDate(d); if (mp) { const c = planCalc(mp); plannedExp += (c.fixed + c.periodic) / planLen(mp); } }
  const outs = S.finTx.filter((t) => t.kind === 'out' && inP(t.d));
  const spent = sum(outs), outside = sum(outs.filter((t) => t.ref === 'out'));
  const income = sum(S.finTx.filter((t) => t.kind === 'in' && inP(t.d)));
  const paidIn = (xs) => sum(xs.flatMap((x) => x.payments).filter((p) => inP(p.d)));
  const debtPaid = paidIn(S.finDebts), owePaid = paidIn(LEDGERS.owe.list()), rightGot = paidIn(LEDGERS.right.list()), finesPaid = paidIn(S.fines);
  const savedLater = sum(S.later.filter((x) => x.decision === 'dropped' && inP(x.decidedAt)), (x) => x.price);
  const byItem = {};
  for (const t of outs) { const k = t.item || 'بلا وصف'; byItem[k] = (byItem[k] || 0) + t.amount; }
  // facts only: spending is not a count of things to finish, so it gets no progress score
  add('finance', '💰', 'المالية', 'finance', null, [
    spent && `صرفت ${money(spent)}${plannedExp ? ` والمخطط لهذه الأيام ${money(Math.round(plannedExp))}${spent > plannedExp + 0.5 ? ` · ⚠️ تجاوزته بـ ${money(Math.round(spent - plannedExp))}` : ' · ضمن المخطط ✓'}` : ''}`,
    outside && `منها خارج المخطط ${money(outside)}`,
    income && `دخل إضافي ${money(income)}`,
    debtPaid && `سدّدت من الديون ${money(debtPaid)}`,
    owePaid && `أدّيت من الحقوق التي عليك ${money(owePaid)}`,
    rightGot && `استلمت من حقوقك ${money(rightGot)}`,
    finesPaid && `سدّدت مخالفات مرورية بـ ${money(finesPaid)}`,
    savedLater && `وفّرت بالشراء المؤجّل ${money(savedLater)}`,
    savingProject() && `نقدك المدخر الآن ${money(saveCalc(savingProject()).cash)}`,
  ], [outs.length && `الصرف حسب البند: ${list(Object.entries(byItem).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${money(v)}`), 15)}`]);

  // ⏱️ التركيز (facts only)
  const sess = S.sessions.filter((x) => inP(sessionDay(x)));
  const fMs = sum(sess, (x) => x.ms);
  add('focus', '⏱️', 'وقت التركيز', 'stats', null, [fMs && `ركّزت ${fmtDur(fMs)} في ${plural(sess.length, 'جلسة واحدة', 'جلستين', 'جلسات', 'جلسة')}`]);

  // 💡 الأفكار و📝 القوائم (facts only)
  const ideasNew = S.ideas.filter((x) => inP(dayOfTs(x.created)));
  add('ideas', '💡', 'الأفكار', 'ideas', null, [ideasNew.length && `سجّلت ${plural(ideasNew.length, 'فكرة واحدة', 'فكرتين', 'أفكار', 'فكرة')}، تحرّك منها ${ideasNew.filter((x) => x.status !== 'new').length}`]);
  const ticked = S.shop.filter((x) => inP(x.boughtAt)).length;
  add('shop', '📝', 'القوائم', 'shop', null, [ticked && `شطبت ${plural(ticked, 'بنداً واحداً', 'بندين', 'بنود', 'بنداً')} من قوائمك`]);

  const scored = A.filter((a) => a.score != null);
  const overall = scored.length ? Math.round(sum(scored, (a) => a.score) / scored.length) : null;
  return { aspects: A, overall, P };
}

function awareReportHTML(P, prevStats) {
  const { aspects, overall } = awareStats(P);
  const all = P.all;
  if (!aspects.length) return `<section class="panel aware"><h2>التقدم الشامل</h2><p class="note-text">لا توجد بيانات في هذا ${P.word} بعد.</p></section>`;
  // the colour compares progress with how much of the period has passed (on pace = green)
  const pace = P.current ? Math.max(1, pctOf(P.days.length, P.all.length)) : 100;
  const color = (s) => (s == null ? '' : s >= pace * 0.75 ? 'var(--low)' : s >= pace * 0.45 ? 'var(--mid)' : 'var(--high)');
  const prevOf = (k) => (prevStats ? (prevStats.aspects.find((a) => a.key === k) || {}).score : null);
  const trend = (now, before) => (P.current || now == null || before == null ? '' : now > before ? ` <small class="ok">▲${now - before}</small>` : now < before ? ` <small class="late">▼${before - now}</small>` : '');
  const best = aspects.filter((a) => a.score != null).sort((a, b) => b.score - a.score);
  return `<section class="panel aware">
    <h2>التقدم الشامل</h2>
    <p class="note-text explain">النسبة تقدّمك: ما أنجزته من كل المطلوب في هذا ${P.word} كله، فكل مرة مطلوبة لها حصة متساوية (٣ جلسات في الأسبوع: كل جلسة ثلث). لذلك تبدأ صغيرة أول ${P.word} وتكبر مع كل إنجاز. الجانب الذي لا يُعدّ (كالمالية) يظهر بحقائقه دون نسبة.</p>
    ${overall != null ? `<div class="aware-top"><div class="ring" style="--p:${overall}"><span>${overall}%</span></div>
      <div><b>مؤشر التقدم الشامل${trend(overall, prevStats && prevStats.overall)}</b><small>${P.current ? `مضى ${plural(P.days.length, 'يوم واحد', 'يومان', 'أيام', 'يوماً')} من ${all.length} (${pctOf(P.days.length, all.length)}٪ من ${P.word})` : ''}${best.length > 1 && best[0].score > best[best.length - 1].score ? `${P.current ? '<br>' : ''}الأكثر تقدماً: ${esc(best[0].title)} · الأقل: ${esc(best[best.length - 1].title)}` : ''}</small></div></div>` : ''}
    <div class="aware-grid">${aspects.map((a) => `<button type="button" class="aware-card" data-tab="${a.tab}">
      <span class="row-between"><b>${a.icon} ${esc(a.title)}</b>${a.score != null ? `<b style="color:${color(a.score)}">${a.score}%${trend(a.score, prevOf(a.key))}</b>` : ''}</span>
      ${a.score != null ? `<span class="progress-line"><i style="width:${a.score}%;background:${color(a.score)}"></i></span>` : ''}
      <small>${a.facts.map(esc).join('<br>')}</small>
    </button>`).join('')}</div>
  </section>`;
}
