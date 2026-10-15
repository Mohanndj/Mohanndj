'use strict';
// «التقدم الشامل» in the monthly report: for every area the app follows, a score from 0 to 100 for
// the month and the facts behind it, then one overall index — how present you were in each part of life.

function awareStats(m) {
  const [y, mo] = m.split('-').map(Number);
  const start = `${m}-01`;
  const end = iso(new Date(y, mo, 0));
  const t0 = today();
  const last = end < t0 ? end : t0;
  const inM = (d) => !!d && d >= start && d <= last;
  const dayOf = (ts) => (ts ? iso(new Date(ts)) : '');
  const days = [];
  for (let d = start; d <= last; d = addDays(d, 1)) days.push(d);
  const pctOf = (a, b) => (b ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : null);
  const A = [];
  const add = (key, icon, title, tab, score, facts) => { if (facts.filter(Boolean).length) A.push({ key, icon, title, tab, score, facts: facts.filter(Boolean) }); };

  // المهام والتخطيط
  const dueTasks = S.tasks.filter((t) => !isGoal(t) && inM(t.due));
  const doneTasks = dueTasks.filter((t) => t.done);
  const weeksSet = S.weeks.filter((w) => inM(w.id) && w.focus.some(Boolean)).length;
  add('tasks', '✅', 'المهام والتخطيط الأسبوعي', 'week', pctOf(doneTasks.length, dueTasks.length), [
    dueTasks.length && `أنجزت ${doneTasks.length} من ${dueTasks.length} مهمة كان موعدها هذا الشهر`,
    weeksSet && `حدّدت أولويات ${weeksSet} ${weeksSet === 1 ? 'أسبوع' : 'أسابيع'}`,
    closedDays().filter(inM).length && `أغلقت يومك ${plural(closedDays().filter(inM).length, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')}`,
  ]);

  // الحفظ
  let sched = 0, kept = 0;
  for (const p of S.hplans) for (const d of days) if (d >= iso(new Date(p.created)) && p.days.includes(parse(d).getDay())) { sched++; if (p.log[d]) kept++; }
  const reviews = S.hifz.reduce((n, h) => n + (h.hist || []).filter(inM).length, 0);
  const learned = S.hifz.filter((h) => inM(h.learnedAt));
  add('hifz', '📖', 'الحفظ', 'hifz', pctOf(kept, sched), [
    sched && `التزمت بـ ${kept} من ${sched} جلسة حفظ مقررة`,
    learned.length && `حفظت ${learned.length} ${learned.length === 1 ? 'مقطعاً' : 'مقاطع'}`,
    reviews && `راجعت ${reviews} ${reviews === 1 ? 'مرة' : 'مرات'}`,
  ]);

  // الكتب: استذكار
  const recalls = S.books.reduce((n, b) => n + b.rvLog.filter((e) => inM(e.d)).length, 0);
  const pendingRecall = S.books.filter((b) => b.rv && b.status === 'read' && b.rvDue && b.rvDue <= last).length;
  add('books', '🔁', 'استذكار الكتب', 'books', pctOf(recalls, recalls + pendingRecall), [
    recalls && `استذكرت ${recalls} ${recalls === 1 ? 'كتاباً' : 'كتب'}`,
    pendingRecall && `${pendingRecall} ينتظر الاستذكار`,
  ]);

  // يومياتي
  const jDays = new Set(S.journal.filter((j) => inM(j.date) && !jEmpty(j)).map((j) => j.date));
  const jFrom = S.journal.length ? S.journal.reduce((a, j) => (j.date < a ? j.date : a), last) : last;
  const jSpan = days.filter((d) => d >= jFrom).length;
  const moods = S.journal.filter((j) => inM(j.date) && j.mood).map((j) => j.mood);
  add('journal', '📔', 'يومياتي وتأملاتي', 'journal', S.journal.length ? pctOf(jDays.size, jSpan) : null, [
    jDays.size && `كتبت في ${plural(jDays.size, 'يوم واحد', 'يومين', 'أيام', 'يوماً')} من ${jSpan}`,
    moods.length && `متوسط مزاجك: ${MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) - 1].join(' ')}`,
  ]);

  // الأحبّة
  const contacts = S.people.reduce((n, p) => n + p.contacts.filter((c) => inM(c.d)).length, 0);
  const watched = S.people.filter((p) => p.every);
  const ontime = watched.filter((p) => { const lastC = p.contacts.filter((c) => c.d <= last).reduce((a, c) => (c.d > a ? c.d : a), '') || iso(new Date(p.created)); return addDays(lastC, p.every) >= last; }).length;
  add('people', '💞', 'الأحبّة', 'people', pctOf(ontime, watched.length), [
    contacts && `تواصلت ${contacts} ${contacts === 1 ? 'مرة' : 'مرات'}`,
    watched.length && `${ontime} من ${watched.length} في موعد صلتهم آخر الشهر`,
  ]);

  // سجل القرارات
  const made = S.decisions.filter((x) => inM(x.date)).length;
  const dueRev = S.decisions.filter((x) => x.reviewAt >= start && x.reviewAt <= last);
  const revd = dueRev.filter((x) => x.reviewedAt).length;
  const st = decStats();
  add('decisions', '⚖️', 'سجل القرارات', 'decisions', pctOf(revd, dueRev.length), [
    made && `سجّلت ${made} ${made === 1 ? 'قراراً' : 'قرارات'}`,
    dueRev.length && `راجعت ${revd} من ${dueRev.length} حان وقت مراجعته`,
    st.n >= 3 && `نسبة إصابتك ${st.acc}٪ وثقتك ${st.conf}٪`,
  ]);

  // عادات أتركها
  const qScores = [];
  const qFacts = [];
  for (const q of S.quits) {
    const from = dayOf(q.start) > start ? dayOf(q.start) : start;
    if (from > last) continue;
    const span = days.filter((d) => d >= from).length;
    const slips = q.slips.filter((s) => inM(dayOf(s.at))).length;
    const bad = new Set(q.slips.filter((s) => inM(dayOf(s.at))).map((s) => dayOf(s.at))).size;
    qScores.push(pctOf(span - bad, span));
    qFacts.push(`${q.title}: ${slips ? `${slips} ${slips === 1 ? 'زلّة' : 'زلّات'}` : 'بلا زلّات'} · ${daysWord(quitStats(q).days)} الآن`);
  }
  add('quits', '🚭', 'عادات أتركها', 'goals', qScores.length ? Math.round(qScores.reduce((a, b) => a + b, 0) / qScores.length) : null, qFacts);

  // الصحة: ما أُكل من الخطة
  let planned = 0, ate = 0, trackedDays = 0, kcal = 0;
  const gcount = {};
  // count from the day the meal plan began, not days before it existed
  const planFrom = S.meals.length ? dayOf(Math.min(...S.meals.map((x) => x.created))) : last;
  for (const d of days.filter((x) => x >= planFrom)) {
    const meals = mealsOf(parse(d).getDay());
    if (!meals.length) continue;
    const items = meals.flatMap((x) => x.items);
    const eaten = eatenOn(d);
    const got = items.filter((x) => eaten.includes(x.id));
    planned += items.length; ate += got.length;
    if (got.length) { trackedDays++; kcal += sumItems(got).kcal; for (const x of got) for (const g of x.groups) gcount[g] = (gcount[g] || 0) + 1; }
  }
  const weeks = Math.max(1, days.length / 7);
  const coverage = Object.entries(GROUPS).map(([g, [, , rec]]) => Math.min(100, ((gcount[g] || 0) / (rec * weeks)) * 100));
  add('health', '🥗', 'الصحة والتغذية', 'health', S.meals.length && planned ? pctOf(ate, planned) : null, [
    planned && `أكلت ${ate} من ${plural(planned, 'صنف واحد', 'صنفين', 'أصناف', 'صنفاً')} في خطتك (${pctOf(ate, planned)}٪)`,
    trackedDays && `متوسط ما أكلته ${Math.round(kcal / trackedDays)} سعرة في الأيام التي سجّلتها`,
    trackedDays && `التكامل الغذائي الفعلي ${Math.round(coverage.reduce((a, b) => a + b, 0) / coverage.length)}٪`,
  ]);

  // المالية
  const mp = monthPlan(m) || null;
  const spent = sum(S.finTx.filter((t) => t.kind === 'out' && inM(t.d)));
  const plannedExp = mp ? planCalc(mp).fixed + planCalc(mp).periodic : 0;
  const debtPaid = sum(S.finDebts.flatMap((d) => d.payments).filter((p) => inM(p.d)));
  const rightGot = sum(LEDGERS.right.list().flatMap((r) => r.payments).filter((p) => inM(p.d)));
  const owePaid = sum(LEDGERS.owe.list().flatMap((r) => r.payments).filter((p) => inM(p.d)));
  const subsPaid = S.subs.reduce((n, s) => n + s.paid.filter((p) => inM(p.d)).length, 0);
  const saved = sum(S.later.filter((x) => x.decision === 'dropped' && inM(x.decidedAt)), (x) => x.price);
  add('finance', '💰', 'المالية', 'finance', plannedExp && spent ? Math.min(100, Math.round((plannedExp / spent) * 100)) : null, [
    spent && `صرفت ${money(spent)}${plannedExp ? ` من ${money(plannedExp)} مخطط` : ''}`,
    debtPaid && `سدّدت من الديون ${money(debtPaid)}`,
    owePaid && `أدّيت من الحقوق التي عليك ${money(owePaid)}`,
    rightGot && `استلمت من حقوقك ${money(rightGot)}`,
    subsPaid && `دفعت ${subsPaid} ${subsPaid === 1 ? 'اشتراكاً أو فاتورة' : 'اشتراكات وفواتير'}`,
    saved && `وفّرت بالشراء المؤجّل ${money(saved)}`,
    savingProject() && `نقدك المدخر ${money(saveCalc(savingProject()).cash)}`,
  ]);

  // الأفكار وقائمة الشراء: حقائق بلا درجة
  const ideasNew = S.ideas.filter((x) => inM(dayOf(x.created)));
  add('ideas', '💡', 'الأفكار', 'ideas', null, [ideasNew.length && `سجّلت ${plural(ideasNew.length, 'فكرة واحدة', 'فكرتين', 'أفكار', 'فكرة')}، تحرّك منها ${ideasNew.filter((x) => x.status !== 'new').length}`]);
  const ticked = S.shop.filter((x) => inM(x.boughtAt)).length;
  add('shop', '📝', 'القوائم', 'shop', null, [ticked && `شطبت ${plural(ticked, 'بنداً واحداً', 'بندين', 'بنود', 'بنداً')} من قوائمك`]);

  const scored = A.filter((a) => a.score != null);
  const overall = scored.length ? Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length) : null;
  return { aspects: A, overall };
}

function awareReportHTML(m) {
  const { aspects, overall } = awareStats(m);
  if (!aspects.length) return '';
  const color = (s) => (s == null ? '' : s >= 75 ? 'var(--low)' : s >= 45 ? 'var(--mid)' : 'var(--high)');
  const best = aspects.filter((a) => a.score != null).sort((a, b) => b.score - a.score);
  return `<section class="panel aware">
    <h2>التقدم الشامل</h2>
    <p class="note-text">كل جانب أضفته لتكون واعياً فيه، بدرجة من ١٠٠ لهذا الشهر والحقائق وراءها.</p>
    ${overall != null ? `<div class="aware-top"><div class="ring" style="--p:${overall}"><span>${overall}%</span></div>
      <div><b>مؤشر الوعي الشامل</b><small>${best.length > 1 ? `أقوى جوانبك: ${esc(best[0].title)} · يحتاج عناية: ${esc(best[best.length - 1].title)}` : ''}</small></div></div>` : ''}
    <div class="aware-grid">${aspects.map((a) => `<button type="button" class="aware-card" data-tab="${a.tab}">
      <span class="row-between"><b>${a.icon} ${esc(a.title)}</b>${a.score != null ? `<b style="color:${color(a.score)}">${a.score}%</b>` : ''}</span>
      ${a.score != null ? `<span class="progress-line"><i style="width:${a.score}%;background:${color(a.score)}"></i></span>` : ''}
      <small>${a.facts.map(esc).join('<br>')}</small>
    </button>`).join('')}</div>
  </section>`;
}
// for the AI summary
const awareFacts = (m) => { const { aspects, overall } = awareStats(m); return [overall != null ? `Overall awareness index: ${overall}%` : '', ...aspects.map((a) => `${a.title}${a.score != null ? ` (${a.score}%)` : ''}: ${a.facts.join('; ')}`)].filter(Boolean).join('\n'); };
