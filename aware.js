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
// pages read in a period, day by day, from the book's log only: what was really read. A day's entry
// knows the page it started from («from», since v46), else the entry before it; the very first page
// recorded is where tracking began, not pages read. (Planned pages never count: since v64 a session
// moves the book only by the pages written after it.)
function pagesIn(b, from, to) {
  const log = (b.log || []).slice().sort((a, c) => a.d.localeCompare(c.d));
  let n = 0;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.d < from || e.d > to) continue;
    if (Number.isFinite(e.from)) n += Math.max(0, e.p - e.from);
    else if (i > 0) n += Math.max(0, e.p - log[i - 1].p);
  }
  return n;
}
// progress of a recurring goal over the whole period: every time it is due counts as an equal share;
// a counted goal (8 cups) gives part of its share for part of the count
const oneDec = (x) => Math.round(x * 10) / 10;
function goalRun(t, P) {
  let total = 0, hit = 0, left = 0;
  for (const d of P.all) {
    // a day done though not (or no longer) scheduled, after its days were edited, still counts as done
    if (!occursOn(t, d)) { if (t.completions[d]) { total++; hit++; } continue; }
    total++;
    if (t.completions[d]) hit++;
    else if (t.target > 1 && t.counts && t.counts[d]) hit += Math.min(1, t.counts[d] / t.target);
    if (d >= today() && !t.completions[d]) left++;
  }
  return { total, hit: oneDec(hit), left };
}
// a page's name as the user set it in «رتّب الصفحات ولوّنها», so the report says what the page says
const pageLook = (tab, name, icon) => { const lk = typeof lookOf === 'function' ? lookOf(tab) : {}; return { title: lk.name || name, icon: lk.emoji || icon }; };

// Each area: its DETAILS (every item, one line each) and then its TOTALS (facts), and a score.
function awareStats(P) {
  if (typeof P === 'string') P = periodOf('month', P);
  const { start, last, days, all, end } = P;
  const inAll = (d) => !!d && d >= start && d <= end;
  const leftTxt = (n) => (P.current && n ? ` | بقي ${n}` : '');
  const t0 = today();
  const inP = (d) => !!d && d >= start && d <= last;
  const dS = (d) => fmtDate(d, { day: 'numeric', month: 'short' });
  const pc = (a, b) => (b ? ` (${pctOf(a, b)}٪)` : '');
  const A = [];
  const add = (key, look, tab, score, facts, detail = []) => { facts = facts.filter(Boolean); detail = detail.filter(Boolean); if (facts.length || detail.length) A.push({ key, icon: look.icon, title: look.title, tab, score, facts, detail }); };
  const list = (xs, n = 12) => (xs.length > n ? `${xs.slice(0, n).join('، ')}، و${xs.length - n} غيرها` : xs.join('، '));

  // ✅ المهام: those due in the period (a task due today counts once done), plus what was done anyway
  // a reading project's book task is counted under the books, not here
  const due = S.tasks.filter((t) => !isGoal(t) && !t.bookId && inAll(t.due)).sort((a, b) => a.due.localeCompare(b.due));
  const doneDue = due.filter((t) => t.done);
  const doneAll = S.tasks.filter((t) => !isGoal(t) && !t.bookId && t.done && inP(dayOfTs(t.doneAt)));
  const extraT = doneAll.filter((t) => !due.includes(t)).sort((a, b) => a.doneAt - b.doneAt);
  const missed = due.filter((t) => !t.done && t.due < t0);
  const stepsBy = S.tasks.map((t) => ({ t, n: t.subtasks.filter((s) => s.done && inP(dayOfTs(s.doneAt))).length })).filter((x) => x.n);
  const steps = sum(stepsBy, (x) => x.n);
  const lateNow = P.current ? S.tasks.filter((t) => !isGoal(t) && !t.bookId && !t.done && t.due && t.due < t0).length : 0;
  const closed = closedDays().filter(inP).length;
  const tState = (t) => (t.done ? `✓ أنجزتها${t.doneAt ? ` ${dS(dayOfTs(t.doneAt))}` : ''}` : t.due < t0 ? '✗ لم تُنجز' : t.due === t0 ? 'موعدها اليوم' : 'لم يحن موعدها');
  add('tasks', { title: 'المهام', icon: '✅' }, 'tasks', pctOf(doneDue.length, due.length), [
    due.length && `أنجزت ${doneDue.length} من ${plural(due.length, 'مهمة واحدة', 'مهمتين', 'مهام', 'مهمة')} موعدها في هذا ${P.word}${pc(doneDue.length, due.length)}${leftTxt(due.filter((t) => !t.done && t.due >= t0).length)}`,
    missed.length && `لم تُنجز ${plural(missed.length, 'مهمة واحدة', 'مهمتين', 'مهام', 'مهمة')} فات موعدها`,
    extraT.length && `وأنجزت ${plural(extraT.length, 'مهمة أخرى', 'مهمتين أخريين', 'مهام أخرى', 'مهمة أخرى')} بلا موعد أو موعدها قبل ${P.word}`,
    doneAll.length && `مجموع ما أنجزته من المهام في هذا ${P.word}: ${doneAll.length}`,
    steps && `أتممت ${plural(steps, 'خطوة واحدة', 'خطوتين', 'خطوات', 'خطوة')} من خطوات المهام`,
    lateNow && `${plural(lateNow, 'مهمة متأخرة', 'مهمتان متأخرتان', 'مهام متأخرة', 'مهمة متأخرة')} الآن`,
    closed && `أغلقت يومك ${plural(closed, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')} من ${days.filter((d) => d < t0 || closedDays().includes(d)).length}`,
  ], [
    ...due.map((t) => `${t.title} (موعدها ${dS(t.due)}): ${tState(t)}`),
    ...extraT.map((t) => `${t.title} (${t.due ? `موعدها كان ${dS(t.due)}` : 'بلا موعد'}): ✓ أنجزتها ${dS(dayOfTs(t.doneAt))}`),
    ...stepsBy.map((x) => `خطوات «${x.t.title}»: أتممت ${x.n}`),
  ]);

  // 🎯 الأهداف المتكررة (غير العادات وأهداف القراءة) والأهداف لمرة واحدة
  const goals = S.tasks.filter((t) => isRepeat(t) && !isHabit(t) && !t.bookId).map((t) => ({ t, ...goalRun(t, P) })).filter((g) => g.total);
  const gT = sum(goals, (g) => g.total), gH = oneDec(sum(goals, (g) => g.hit));
  const onceAll = S.tasks.filter((t) => isGoal(t) && !isRepeat(t) && ((t.done && inP(dayOfTs(t.doneAt))) || inAll(t.due)));
  const onceDone = onceAll.filter((t) => t.done);
  const onceState = (t) => (t.done ? `✓ تحقق${t.doneAt ? ` ${dS(dayOfTs(t.doneAt))}` : ''}` : t.target > 1 ? `${countOn(t, t0)} من ${t.target}${t.unit ? ` ${t.unit}` : ''}` : t.due && t.due < t0 ? '✗ لم يتحقق' : 'لم يتحقق بعد');
  add('goals', { title: 'الأهداف', icon: '🎯' }, 'goals', pctOf(gH, gT), [
    gT && `أنجزت ${gH} من ${plural(gT, 'موعد واحد', 'موعدين', 'مواعيد', 'موعداً')} لأهدافك المتكررة${pc(gH, gT)}${leftTxt(sum(goals, (g) => g.left))}`,
    onceAll.length && `الأهداف لمرة واحدة: تحقق ${onceDone.length} من ${onceAll.length}`,
  ], [
    ...goals.map((g) => `«${g.t.title}»: ${g.hit} من ${g.total}${pc(g.hit, g.total)}${leftTxt(g.left)}`),
    ...onceAll.map((t) => `«${t.title}»${t.due ? ` (موعده ${dS(t.due)})` : ''}: ${onceState(t)}`),
  ]);

  // 🌱 بناء العادات
  const habits = S.tasks.filter((t) => isHabit(t)).map((t) => ({ t, ...goalRun(t, P) })).filter((h) => h.total);
  const hT = sum(habits, (h) => h.total), hH = oneDec(sum(habits, (h) => h.hit));
  add('habits', { title: 'بناء العادات', icon: '🌱' }, 'goals', pctOf(hH, hT), [
    hT && `أدّيت ${hH} من ${plural(hT, 'موعد واحد', 'موعدين', 'مواعيد', 'موعداً')} لعاداتك${pc(hH, hT)}${leftTxt(sum(habits, (h) => h.left))}`,
  ], habits.map((h) => `«${h.t.title}»: ${h.hit} من ${h.total}${pc(h.hit, h.total)} | قوتها ${habitStats(h.t, last).strength}٪`));

  // 🚭 عادات أتركها: clean days over the days it was being left in the period
  const qScores = [], qDetail = [];
  let qClean = 0, qPast = 0, qSlips = 0;
  for (const q of S.quits) {
    const from = dayOfTs(q.start) > start ? dayOfTs(q.start) : start;
    const to = q.doneAt && q.doneAt < end ? q.doneAt : end;
    const span = all.filter((d) => d >= from && d <= to).length;
    const past = days.filter((d) => d >= from && d <= to).length;
    if (!span || !past) continue;
    const sl = q.slips.filter((s) => inP(dayOfTs(s.at)));
    const bad = new Set(sl.map((s) => dayOfTs(s.at))).size;
    qScores.push(pctOf(past - bad, span));
    qClean += past - bad; qPast += past; qSlips += sl.length;
    qDetail.push(`«${q.title}»: ${past - bad} يوماً بلا زلّة من ${past}${sl.length ? ` | ${plural(sl.length, 'زلّة واحدة', 'زلّتان', 'زلّات', 'زلّة')} (دوافعها: ${list(sl.map((s) => s.trigger || 'غير محدد'))})` : ''}`);
  }
  add('quits', { title: 'عادات أتركها', icon: '🚭' }, 'goals', qScores.length ? Math.round(sum(qScores, (x) => x) / qScores.length) : null, [
    qPast && `أيام بلا زلّة: ${qClean} من ${qPast}${qSlips ? ` | ${plural(qSlips, 'زلّة واحدة', 'زلّتان', 'زلّات', 'زلّة')}` : ''}`,
  ], qDetail);

  // 📖 الحفظ: scheduled sessions from the plan's start until it ended
  let sched = 0, kept = 0, hLeft = 0;
  const hPlans = [];
  for (const p of S.hplans) {
    let s0 = 0, k0 = 0, l0 = 0;
    for (const d of all) {
      if (p.log[d] && !p.days.includes(parse(d).getDay())) { s0++; k0++; continue; }
      if (d < dayOfTs(p.created) || (p.doneAt && d > p.doneAt) || !p.days.includes(parse(d).getDay())) continue;
      s0++; if (p.log[d]) k0++; else if (d >= t0) l0++;
    }
    sched += s0; kept += k0; hLeft += l0;
    if (s0) hPlans.push(`«${p.title}»: ${k0} من ${plural(s0, 'جلسة واحدة', 'جلستين', 'جلسات', 'جلسة')}${pc(k0, s0)}${leftTxt(l0)}`);
  }
  const reviewsBy = S.hifz.map((h) => ({ h, n: (h.hist || []).filter(inP).length })).filter((x) => x.n);
  const reviews = sum(reviewsBy, (x) => x.n);
  const learned = S.hifz.filter((h) => inP(h.learnedAt));
  add('hifz', pageLook('hifz', 'الحفظ', '📖'), 'hifz', pctOf(kept, sched), [
    sched && `أتممت ${kept} من ${plural(sched, 'جلسة حفظ واحدة', 'جلستي حفظ', 'جلسات حفظ', 'جلسة حفظ')} مقررة في هذا ${P.word}${pc(kept, sched)}${leftTxt(hLeft)}`,
    learned.length && `حفظت ${plural(learned.length, 'مقطعاً واحداً', 'مقطعين', 'مقاطع', 'مقطعاً')}`,
    reviews && `راجعت ${plural(reviews, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')}`,
  ], [...hPlans, ...learned.map((h) => `حفظت «${hzTitle(h)}» (${dS(h.learnedAt)})`), ...reviewsBy.map((x) => `راجعت «${hzTitle(x.h)}»: ${plural(x.n, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')}`)]);

  // 📚 الكتب: reading sessions on their days, pages really read, finished books, benefits, recall
  const per = new Map();
  const acc = (id) => { if (!per.has(id)) per.set(id, { s: 0, h: 0, left: 0 }); return per.get(id); };
  for (const g of S.tasks.filter((t) => t.bookId && isRepeat(t))) { const r = goalRun(g, P); const x = acc(g.bookId); x.s += r.total; x.h += r.hit; x.left += r.left; }
  for (const t of S.tasks.filter((x) => x.bookId && !isRepeat(x) && x.projectId)) {
    const b = getBook(t.bookId); if (!b) continue;
    const x = acc(b.id);
    // only while the book is being read: from when its task (or its reading) began until it was finished;
    // a book still waiting to be read has no reading days yet (a session it holds still counts)
    const from = b.start && b.start > dayOfTs(t.created) ? b.start : dayOfTs(t.created);
    const until = b.status === 'read' ? (b.end || dayOfTs(t.doneAt) || '') : b.status === 'reading' ? '9999' : '';
    for (const d of all) {
      if (t.completions[d]) { x.s++; x.h++; continue; }
      if (!b.rdays.length || !b.rpages || d < from || !until || d > until || !b.rdays.includes(parse(d).getDay())) continue;
      x.s++; if (d >= t0) x.left++;
    }
  }
  let rS = 0, rH = 0, rLeft = 0, pages = 0;
  const bookLines = [];
  for (const b of S.books) {
    const x = per.get(b.id) || { s: 0, h: 0, left: 0 };
    const pg = pagesIn(b, start, last);
    const fin = b.status === 'read' && inP(b.end);
    rS += x.s; rH += x.h; rLeft += x.left; pages += pg;
    if (!x.s && !pg && !fin) continue;
    bookLines.push(`«${b.title}»: ${[
      x.s && `قرأت في ${x.h} من ${plural(x.s, 'جلسة واحدة', 'جلستين', 'جلسات', 'جلسة')}${leftTxt(x.left)}`,
      `${pg ? `قرأت ${plural(pg, 'صفحة واحدة', 'صفحتين', 'صفحات', 'صفحة')}` : 'لم تسجّل صفحات'}`,
      b.page && !fin ? `وصلت صفحة ${b.page}${b.pages ? ` من ${b.pages}` : ''}` : '',
      fin && `✓ أنهيته ${dS(b.end)}`,
    ].filter(Boolean).join(' | ')}`);
  }
  const finished = S.books.filter((b) => b.status === 'read' && inP(b.end));
  const bens = S.benefits.filter((f) => inP(dayOfTs(f.created)));
  const recallsBy = S.books.map((b) => ({ b, es: b.rvLog.filter((e) => inP(e.d)) })).filter((x) => x.es.length);
  const recalls = sum(recallsBy, (x) => x.es.length);
  const pendingRecall = S.books.filter((b) => b.rv && b.status === 'read' && b.rvDue && b.rvDue <= end).length;
  add('books', pageLook('books', 'الكتب', '📚'), 'books', rS + recalls + pendingRecall ? pctOf(rH + recalls, rS + recalls + pendingRecall) : null, [
    rS && `قرأت في ${rH} من ${plural(rS, 'جلسة قراءة واحدة', 'جلستي قراءة', 'جلسات قراءة', 'جلسة قراءة')} في هذا ${P.word}${pc(rH, rS)}${leftTxt(rLeft)}`,
    `${pages ? `قرأت ${plural(pages, 'صفحة واحدة', 'صفحتين', 'صفحات', 'صفحة')} (ما سجّلته فعلاً)` : rS ? 'لم تسجّل صفحات مقروءة' : ''}`,
    finished.length && `أنهيت ${plural(finished.length, 'كتاباً واحداً', 'كتابين', 'كتب', 'كتاباً')}`,
    bens.length && `سجّلت ${plural(bens.length, 'فائدة واحدة', 'فائدتين', 'فوائد', 'فائدة')}`,
    recalls && `استذكرت ${plural(recalls, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')}`,
    pendingRecall && `${pendingRecall} ينتظر الاستذكار`,
  ], [...bookLines, ...bens.map((f) => `فائدة: ${f.title || excerpt(f.lesson, 50)}${f.book ? ` («${f.book}»)` : ''}`), ...recallsBy.map((x) => `استذكرت «${x.b.title}» (${x.es.map((e) => dS(e.d)).join('، ')})`)]);

  // 📔 يومياتي: days written since the first entry (today only once written)
  const written = new Set(S.journal.filter((j) => !jEmpty(j)).map((j) => j.date));
  const first = [...written].sort()[0];
  const jDays = first ? all.filter((d) => d >= first) : [];
  const jHit = jDays.filter((d) => written.has(d)).length;
  const jPast = jDays.filter((d) => d < t0 || written.has(d));
  const moods = S.journal.filter((j) => inP(j.date) && j.mood).map((j) => j.mood);
  let jDetail = [];
  if (P.type === 'year') {
    const byM = {};
    for (const d of jPast) { const m = d.slice(0, 7); byM[m] = byM[m] || [0, 0]; byM[m][1]++; if (written.has(d)) byM[m][0]++; }
    jDetail = Object.entries(byM).map(([m, [w, n]]) => `${monthName(m)}: كتبت في ${w} من ${n}`);
  } else {
    const w = jPast.filter((d) => written.has(d)), miss = jPast.filter((d) => !written.has(d));
    jDetail = [w.length && `كتبت: ${w.map(dS).join('، ')}`, miss.length && `لم تكتب: ${miss.map(dS).join('، ')}`];
  }
  add('journal', pageLook('journal', 'يومياتي وتأملاتي', '📔'), 'journal', jDays.length ? pctOf(jHit, jDays.length) : null, [
    jDays.length && `كتبت في ${plural(jHit, 'يوم واحد', 'يومين', 'أيام', 'يوماً')} من ${jDays.length}${pc(jHit, jDays.length)}${leftTxt(jDays.filter((d) => d >= t0 && !written.has(d)).length)}`,
    moods.length && `متوسط مزاجك: ${MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) - 1].join(' ')}`,
  ], jDetail);

  // 💞 الأحبّة: contacts actually recorded; expected ones by each person's rhythm since they were added
  let exp = 0, got = 0, nContacts = 0;
  const never = [], overdue = [], pLines = [];
  for (const p of S.people) {
    const cs = p.contacts.filter((c) => inP(c.d));
    nContacts += cs.length;
    let e = 0;
    if (p.every) {
      const from = dayOfTs(p.created) > start ? dayOfTs(p.created) : start;
      e = Math.floor(all.filter((d) => d >= from).length / p.every);
      if (e) { exp += e; got += Math.min(cs.length, e); }
      if (!p.contacts.length && dayOfTs(p.created) <= last && daysBetween(dayOfTs(p.created), last) >= p.every) never.push(p.name);
      else if (p.contacts.length) { const lc = p.contacts.filter((c) => c.d <= last).reduce((a, c) => (c.d > a ? c.d : a), ''); if (lc && daysBetween(lc, last) > p.every) overdue.push(p.name); }
    }
    if (cs.length || e) pLines.push(`${p.name}: ${cs.length ? `تواصلت ${plural(cs.length, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')} (${cs.map((c) => dS(c.d)).join('، ')})` : 'لم تتواصل'}${e ? ` | المطلوب ${e}` : ''}`);
  }
  const whom = new Set(S.people.filter((p) => p.contacts.some((c) => inP(c.d))).map((p) => p.name));
  add('people', pageLook('people', 'الأحبّة', '💞'), 'people', exp ? pctOf(got, exp) : null, [
    nContacts ? `تواصلت ${plural(nContacts, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')} مع ${plural(whom.size, 'شخص واحد', 'شخصين', 'أشخاص', 'شخصاً')}` : (S.people.length ? `لم تسجّل أي تواصل في هذا ${P.word}` : ''),
    exp && `صلات في وقتها: ${got} من ${exp}${pc(got, exp)}`,
    overdue.length && `فات موعد صلة: ${list(overdue, 5)}`,
    never.length && `لم تتواصل بعد مع: ${list(never, 5)}`,
  ], pLines);

  // ⚖️ سجل القرارات
  const made = S.decisions.filter((x) => inP(x.date));
  const dueRev = S.decisions.filter((x) => x.reviewAt && x.reviewAt >= start && x.reviewAt <= end);
  const revd = dueRev.filter((x) => x.reviewedAt).length;
  add('decisions', pageLook('decisions', 'سجل القرارات', '⚖️'), 'decisions', pctOf(revd, dueRev.length), [
    made.length && `سجّلت ${plural(made.length, 'قراراً واحداً', 'قرارين', 'قرارات', 'قراراً')}`,
    dueRev.length && `راجعت ${revd} من ${dueRev.length} حان وقت مراجعته`,
  ], [...made.map((x) => `قرار: «${x.title}» (${dS(x.date)})`), ...dueRev.map((x) => `مراجعة «${x.title}» (${dS(x.reviewAt)}): ${x.reviewedAt ? '✓ راجعته' : x.reviewAt < t0 ? '✗ لم تراجعه' : 'لم يحن بعد'}`)]);

  // 🥗 الصحة: only days on which you recorded what you ate
  let planned = 0, ate = 0, tracked = 0, kcal = 0;
  const gcount = {}, hLines = [];
  const planFrom = S.meals.length ? dayOfTs(Math.min(...S.meals.map((x) => x.created))) : '9999';
  const planDays = all.filter((d) => d >= planFrom && mealsOf(parse(d).getDay()).length);
  for (const d of planDays) {
    const items = mealsOf(parse(d).getDay()).flatMap((x) => x.items);
    planned += items.length;
    const eaten = eatenOn(d);
    if (!eaten.length) continue;
    const g = items.filter((x) => eaten.includes(x.id));
    const k = sumItems(g).kcal;
    tracked++; ate += g.length; kcal += k;
    hLines.push(`${dS(d)}: أكلت ${g.length} من ${items.length} | ${Math.round(k)} سعرة`);
    for (const x of g) for (const k2 of x.groups) gcount[k2] = (gcount[k2] || 0) + 1;
  }
  const weeks = Math.max(1, tracked / 7);
  const coverage = Object.entries(GROUPS).map(([k, [, , rec]]) => Math.min(100, ((gcount[k] || 0) / (rec * weeks)) * 100));
  add('health', pageLook('health', 'الصحة', '🥗'), 'health', planned ? pctOf(ate, planned) : null, [
    planDays.length && `سجّلت أكلك في ${tracked} من ${planDays.length} يوماً في خطتك`,
    planned && `أكلت ${ate} من ${plural(planned, 'صنف واحد', 'صنفين', 'أصناف', 'صنفاً')} في خطتك لهذا ${P.word}${pc(ate, planned)}`,
    tracked && `متوسط ما أكلته ${Math.round(kcal / tracked)} سعرة، والتكامل الغذائي ${Math.round(sum(coverage, (x) => x) / coverage.length)}٪`,
  ], hLines);

  // 💰 المالية: «مصروف …» items: what was spent from each and what is left of it this month;
  // spending with no item: outside the spending budgets; other items are obligations, just said paid
  const outs = S.finTx.filter((t) => t.kind === 'out' && inP(t.d));
  const spent = sum(outs);
  const ins = S.finTx.filter((t) => t.kind === 'in' && inP(t.d));
  const income = sum(ins);
  const paidIn = (xs) => sum(xs.flatMap((x) => x.payments).filter((p) => inP(p.d)));
  const debtPaid = paidIn(S.finDebts), owePaid = paidIn(LEDGERS.owe.list()), rightGot = paidIn(LEDGERS.right.list()), finesPaid = paidIn(S.fines);
  const savedLater = sum(S.later.filter((x) => x.decision === 'dropped' && inP(x.decidedAt)), (x) => x.price);
  const bySpend = new Map(), byDuty = new Map(), outside = {};
  for (const t of outs) {
    const p = planForDate(t.d);
    const r = p && t.ref && t.ref !== 'out' ? planRows(p).find((y) => y.x.id === t.ref) : null;
    if (!r && t.src) { const k = `src:${t.item}`; const e = byDuty.get(k) || { p, r: { x: { name: t.item || 'دفعة' } }, amount: 0 }; e.amount += t.amount; byDuty.set(k, e); continue; }
    if (!r) { const k = t.item || 'بلا وصف'; outside[k] = (outside[k] || 0) + t.amount; continue; }
    const m = isSpendRow(r) ? bySpend : byDuty;
    const k = `${p.id}:${r.x.id}`;
    const e = m.get(k) || { p, r, amount: 0 };
    e.amount += t.amount; m.set(k, e);
  }
  const spendSum = sum([...bySpend.values()], (e) => e.amount), dutySum = sum([...byDuty.values()], (e) => e.amount);
  const outsideSum = sum(Object.values(outside), (x) => x);
  const spendLines = [...bySpend.values()].sort((a, b) => b.amount - a.amount).map((e) => {
    const rm = rowRemain(e.p, e.r.x.id);
    return `${e.r.x.name}: صرفت ${money(e.amount)}${rm ? ` | ${rm.left > 0.5 ? `الباقي ${money(rm.left)} من ${money(rm.budget)}` : rm.left > -0.5 ? `استنفدته كاملاً (${money(rm.budget)})` : `⚠️ تجاوزته بـ ${money(-rm.left)} (المخطط ${money(rm.budget)})`}` : ''}`;
  });
  // facts only: spending is not a count of things to finish, so it gets no progress score
  add('finance', pageLook('finance', 'المالية', '💰'), 'finance', null, [
    spendSum && `صرفت من بنود المصروف: ${money(spendSum)}`,
    outsideSum && `مصروف خارج البنود: ${money(outsideSum)}`,
    dutySum && `مدفوعات لمرة واحدة دُفعت: ${money(dutySum)}`,
    spent && `مجموع ما دفعت: ${money(spent)}`,
    income && `دخل إضافي: ${money(income)}`,
    debtPaid && `سدّدت من الديون: ${money(debtPaid)}`,
    owePaid && `أدّيت من الحقوق التي عليك: ${money(owePaid)}`,
    rightGot && `استلمت من حقوقك: ${money(rightGot)}`,
    finesPaid && `سدّدت مخالفات مرورية: ${money(finesPaid)}`,
    savedLater && `وفّرت بالشراء المؤجّل: ${money(savedLater)}`,
    savingProject() && `نقدك المدخر الآن: ${money(saveCalc(savingProject()).cash)}`,
  ], [
    ...spendLines,
    ...[...byDuty.values()].map((e) => `${e.r.x.name}: دفعت ${money(e.amount)}`),
    ...Object.entries(outside).sort((a, b) => b[1] - a[1]).map(([k, v]) => `خارج البنود، ${k}: ${money(v)}`),
    ...ins.map((t) => `دخل: ${t.item || 'بلا وصف'} ${money(t.amount)} (${dS(t.d)})`),
  ]);

  // ⏱️ التركيز (facts only): the timer's sessions and the times written after a task
  const sess = S.sessions.filter((x) => inP(sessionDay(x)));
  const fMs = sum(sess, (x) => x.ms);
  const byTask = {};
  for (const x of sess) { const e = byTask[x.taskId] || (byTask[x.taskId] = { ms: 0, n: 0 }); e.ms += x.ms; e.n++; }
  add('focus', { title: 'وقت التركيز', icon: '⏱️' }, 'stats', null, [fMs && `ركّزت ${fmtDur(fMs)} في ${plural(sess.length, 'جلسة واحدة', 'جلستين', 'جلسات', 'جلسة')}`],
    Object.entries(byTask).sort((a, b) => b[1].ms - a[1].ms).map(([id, e]) => `${(getTask(id) || {}).title || 'مهمة محذوفة'}: ${fmtDur(e.ms)} (${plural(e.n, 'جلسة واحدة', 'جلستين', 'جلسات', 'جلسة')})`));

  // 💡 الأفكار و📝 القوائم (facts only)
  const ideasNew = S.ideas.filter((x) => inP(dayOfTs(x.created)));
  add('ideas', pageLook('ideas', 'الأفكار', '💡'), 'ideas', null, [ideasNew.length && `سجّلت ${plural(ideasNew.length, 'فكرة واحدة', 'فكرتين', 'أفكار', 'فكرة')}، تحرّك منها ${ideasNew.filter((x) => x.status !== 'new').length}`],
    ideasNew.map((x) => `${excerpt(x.text, 60)} (${IDEA_STATUS[x.status]})`));
  const tickedL = S.shop.filter((x) => inP(x.boughtAt));
  add('shop', pageLook('shop', 'القوائم', '📝'), 'shop', null, [tickedL.length && `شطبت ${plural(tickedL.length, 'بنداً واحداً', 'بندين', 'بنود', 'بنداً')} من قوائمك`],
    tickedL.length ? [`شطبت: ${tickedL.map((x) => x.name).join('، ')}`] : []);

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
    <p class="note-text explain">النسبة تقدّمك: ما أنجزته من كل المطلوب في هذا ${P.word} كله، فكل مرة مطلوبة لها حصة متساوية (٣ جلسات في الأسبوع: كل جلسة ثلث). لذلك تبدأ صغيرة أول ${P.word} وتكبر مع كل إنجاز. الجانب الذي لا يُعدّ (كالمالية) يظهر بحقائقه دون نسبة. في كل جانب: التفاصيل أولاً ثم الإجمالي.</p>
    ${overall != null ? `<div class="aware-top"><div class="ring" style="--p:${overall}"><span>${overall}%</span></div>
      <div><b>مؤشر التقدم الشامل${trend(overall, prevStats && prevStats.overall)}</b><small>${P.current ? `مضى ${plural(P.days.length, 'يوم واحد', 'يومان', 'أيام', 'يوماً')} من ${all.length} (${pctOf(P.days.length, all.length)}٪ من ${P.word})` : ''}${best.length > 1 && best[0].score > best[best.length - 1].score ? `${P.current ? '<br>' : ''}الأكثر تقدماً: ${esc(best[0].title)} | الأقل: ${esc(best[best.length - 1].title)}` : ''}</small></div></div>` : ''}
    <div class="aware-grid">${aspects.map((a) => `<div class="aware-card">
      <button type="button" class="aw-head" data-tab="${a.tab}"><b>${esc(a.icon)} ${esc(a.title)}</b>${a.score != null ? `<b style="color:${color(a.score)}">${a.score}%${trend(a.score, prevOf(a.key))}</b>` : ''}</button>
      ${a.score != null ? `<span class="progress-line"><i style="width:${a.score}%;background:${color(a.score)}"></i></span>` : ''}
      ${a.detail.length ? `<details class="aw-det" open><summary>التفاصيل <span class="num">${a.detail.length}</span></summary><ul>${a.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></details>` : ''}
      ${a.facts.length ? `<div class="aw-total"><b>الإجمالي</b><ul>${a.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
    </div>`).join('')}</div>
  </section>`;
}
