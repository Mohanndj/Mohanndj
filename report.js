'use strict';
// Monthly report: what you achieved in a month, shareable as an image or saved as PDF,
// with an optional AI-written summary.

const repUi = { month: '', ai: {} }; // month is set on first open (app.js loads after this file)

function monthStats(m) {
  const [y, mo] = m.split('-').map(Number);
  const start = `${m}-01`;
  const end = iso(new Date(y, mo, 0));
  const t0 = today();
  const last = end < t0 ? end : t0;
  const inM = (d) => d && d >= start && d <= end;
  const dayOf = (ts) => (ts ? iso(new Date(ts)) : '');

  const byDay = {};
  const bump = (d) => { byDay[d] = (byDay[d] || 0) + 1; };
  const tasksDone = S.tasks.filter((t) => !isGoal(t) && t.done && inM(dayOf(t.doneAt)));
  tasksDone.forEach((t) => bump(dayOf(t.doneAt)));
  let steps = 0;
  for (const t of S.tasks) for (const s of t.subtasks) if (s.done && inM(dayOf(s.doneAt))) steps++;

  const goals = [];
  let goalDays = 0;
  for (const t of S.tasks.filter((x) => isRepeat(x))) {
    let total = 0, hit = 0;
    for (let d = start; d <= last; d = addDays(d, 1)) {
      if (!occursOn(t, d)) continue;
      total++;
      if (t.completions[d]) { hit++; bump(d); }
    }
    goalDays += hit;
    if (total && !isHabit(t)) goals.push({ title: t.title, total, hit, rate: pct(hit, total) }); // habits have their own section
  }
  const goalsAchieved = S.tasks.filter((t) => isGoal(t) && !isRepeat(t) && t.done && inM(dayOf(t.doneAt)));
  goalsAchieved.forEach((t) => bump(dayOf(t.doneAt)));

  const projects = S.projects.map((p) => {
    const st = projectStats(p.id);
    const doneIn = tasksOf(p.id).filter((t) => t.done && inM(dayOf(t.doneAt))).length;
    return { name: p.name, color: p.color, progress: st.progress, doneIn, total: st.total };
  }).filter((p) => p.total);

  const sessions = S.sessions.filter((x) => inM(sessionDay(x)));
  const focusMs = sessions.reduce((n, x) => n + x.ms, 0);
  const focusBy = {};
  for (const x of sessions) focusBy[x.taskId] = (focusBy[x.taskId] || 0) + x.ms;
  const focusTop = Object.entries(focusBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, ms]) => ({ title: (getTask(id) || {}).title || 'مهمة محذوفة', ms }));

  const booksRead = S.books.filter((b) => b.status === 'read' && inM(b.end));
  const booksStarted = S.books.filter((b) => inM(b.start));
  let pages = 0;
  for (const b of S.books) {
    const log = (b.log || []).slice().sort((a, c) => a.d.localeCompare(c.d));
    let prev = 0;
    for (const e of log) { if (inM(e.d)) pages += Math.max(0, e.p - prev); prev = e.p; }
  }
  const benefits = S.benefits.filter((f) => inM(dayOf(f.created)));
  const notes = S.memos.filter((n) => inM(dayOf(n.created))).length;

  const days = Object.entries(byDay);
  const best = days.sort((a, b) => b[1] - a[1])[0] || null;
  const cats = {};
  for (const t of tasksDone) { const c = t.category || 'بلا تصنيف'; cats[c] = (cats[c] || 0) + 1; }

  return {
    m, start, end, tasksDone: tasksDone.length, steps, goals, goalDays, goalsAchieved: goalsAchieved.map((t) => t.title),
    projects, focusMs, focusTop, booksRead: booksRead.map((b) => b.title), booksStarted: booksStarted.length, pages,
    benefits: benefits.length, topBenefit: benefits[0] ? benefits[0].title : '', notes,
    activeDays: Object.keys(byDay).length, best, cats: Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4),
    done: tasksDone.length + goalDays + goalsAchieved.length,
  };
}

const monthTitle = (m) => parse(`${m}-01`).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
function monthHijri(m) {
  const [y, mo] = m.split('-').map(Number);
  const a = fmtHijri(`${m}-01`, { month: 'long', year: 'numeric' });
  const b = fmtHijri(iso(new Date(y, mo, 0)), { month: 'long', year: 'numeric' });
  return a === b ? a : `${fmtHijri(`${m}-01`, { month: 'long' })} – ${b}`;
}

function viewReport() {
  if (!repUi.month) repUi.month = today().slice(0, 7);
  const st = monthStats(repUi.month);
  const isNow = repUi.month === today().slice(0, 7);
  const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
  const focusH = st.focusMs ? fmtDur(st.focusMs) : '0 د';
  const ai = repUi.ai[repUi.month];
  return `${moreCrumb()}
  <div class="cal-head">
    <div class="nav"><button type="button" data-action="rep-move" data-v="-1" aria-label="الشهر السابق">${icon('prev')}</button></div>
    <div class="titles"><h2>تقرير ${esc(monthTitle(repUi.month))}</h2><small>${esc(monthHijri(repUi.month))}</small></div>
    <div class="nav"><button type="button" data-action="rep-move" data-v="1" aria-label="الشهر التالي"${isNow ? ' disabled' : ''}>${icon('next')}</button></div>
  </div>
  <div class="report" id="report">
    <div class="tiles">
      ${tile(st.tasksDone, 'مهمة منجزة')}${tile(st.steps, 'خطوة')}${tile(st.goalDays, 'يوم التزام بالأهداف')}${tile(focusH, 'وقت التركيز')}
      ${tile(st.booksRead.length, 'كتاب أنهيته')}${tile(st.pages, 'صفحة قرأتها')}${tile(st.benefits, 'فائدة')}${tile(st.activeDays, 'يوم نشط')}
    </div>
    ${awareReportHTML(repUi.month)}
    ${st.best ? `<p class="note-text">أفضل أيامك: <b>${esc(fmtDate(st.best[0], { weekday: 'long', day: 'numeric', month: 'long' }))}</b> بـ ${st.best[1]} إنجازات.</p>` : ''}
    ${st.projects.length ? `<section class="panel"><h2>المشاريع</h2><ul class="hbars">${st.projects.map((p) => hbar(`<span class="proj" style="--pc:${p.color}"><i></i>${esc(p.name)}</span>`, `${p.progress}%`, p.progress, p.color)).join('')}</ul>
      <p class="note-text">${st.projects.filter((p) => p.doneIn).map((p) => `${esc(p.name)}: ${p.doneIn} مهام هذا الشهر`).join(' · ') || 'لم تُنجز مهام مشاريع هذا الشهر.'}</p></section>` : ''}
    ${st.goals.length || st.goalsAchieved.length ? `<section class="panel"><h2>الأهداف</h2>
      ${st.goals.length ? `<ul class="hbars">${st.goals.map((g) => hbar(esc(g.title), `${g.rate}%`, g.rate)).join('')}</ul>` : ''}
      ${st.goalsAchieved.length ? `<p class="note-text">حققت: ${st.goalsAchieved.map(esc).join('، ')}</p>` : ''}</section>` : ''}
    ${habitsReportHTML(repUi.month)}
    ${st.booksRead.length || st.pages || st.benefits ? `<section class="panel"><h2>القراءة</h2>
      <p class="note-text">${st.booksRead.length ? `أنهيت: ${st.booksRead.map((t) => `«${esc(t)}»`).join('، ')}.` : 'لم تُنهِ كتاباً هذا الشهر.'} ${st.pages ? `قرأت ${st.pages} صفحة.` : ''} ${st.benefits ? `سجّلت ${st.benefits} فائدة${st.topBenefit ? `، منها «${esc(st.topBenefit)}»` : ''}.` : ''}</p></section>` : ''}
    ${st.focusTop.length ? `<section class="panel"><h2>أكثر ما ركّزت عليه</h2><ul class="hbars">${st.focusTop.map((x) => hbar(esc(x.title), fmtDur(x.ms), (x.ms / st.focusTop[0].ms) * 100)).join('')}</ul></section>` : ''}
    <section class="panel ai-summary">
      <div class="section-head"><h2>${icon('spark')} الخلاصة</h2>${AI.on() ? `<button type="button" class="ai-btn" data-action="rep-ai">${icon('spark')}${ai ? 'أعد الكتابة' : 'اكتب لي خلاصة الشهر'}</button>` : ''}</div>
      ${ai ? `<div class="ai-text">${esc(ai).replace(/\n/g, '<br>')}</div>` : `<p class="note-text">${AI.on() ? 'يكتب لك الذكاء الاصطناعي ملخصاً لشهرك مع ثلاث نصائح للشهر القادم.' : 'فعّل الذكاء الاصطناعي من الإعدادات ليكتب لك خلاصة الشهر ونصائح للشهر القادم.'}</p>`}
    </section>
  </div>
  <div class="btn-row report-actions">
    <button type="button" class="primary" data-action="rep-image">${icon('sheet')} مشاركة كصورة</button>
    <button type="button" class="ghost" data-action="rep-pdf">حفظ PDF</button>
  </div>
  ${st.done === 0 && !st.pages && !st.benefits ? '<p class="note-text">لا توجد إنجازات مسجلة في هذا الشهر بعد.</p>' : ''}`;
}

// ---------- AI summary ----------
async function reportAI(btn) {
  const st = monthStats(repUi.month);
  const facts = [
    `Month: ${monthTitle(repUi.month)} (${monthHijri(repUi.month)})`,
    `Tasks completed: ${st.tasksDone}; steps completed: ${st.steps}; active days: ${st.activeDays}`,
    st.goals.length ? `Recurring goals adherence: ${st.goals.map((g) => `${g.title} ${g.rate}% (${g.hit}/${g.total})`).join('; ')}` : 'No recurring goals.',
    st.goalsAchieved.length ? `One-time goals achieved: ${st.goalsAchieved.join('; ')}` : '',
    habitsMonthStats(repUi.month).length ? `Habits being built (max 3): ${habitsMonthStats(repUi.month).map((h) => `${h.title}: done ${h.hit}/${h.total} days this month, strength ${h.strength}%, stage ${h.stage}`).join('; ')}` : '',
    st.projects.length ? `Projects progress: ${st.projects.map((p) => `${p.name} ${p.progress}% (+${p.doneIn} tasks this month)`).join('; ')}` : '',
    `Focus time: ${Math.round(st.focusMs / 60000)} minutes${st.focusTop.length ? ` (top: ${st.focusTop.map((x) => x.title).join(', ')})` : ''}`,
    `Books finished: ${st.booksRead.join('; ') || 'none'}; pages read: ${st.pages}; benefits recorded: ${st.benefits}`,
    st.cats.length ? `Top categories: ${st.cats.map(([c, n]) => `${c} ${n}`).join(', ')}` : '',
    awareFacts(repUi.month),
  ].filter(Boolean).join('\n');
  const text = await withAI(btn, 'جارٍ الكتابة…', () => AI.ask({
    system: SYSTEM_AR,
    effort: 'medium',
    prompt: `Write the user's monthly review in Arabic from these facts, covering all areas of life the app tracks (tasks, memorisation, books, journal, family and friends, decisions, habits to quit, nutrition, money). Structure: one short paragraph celebrating what went well (specific numbers), one short paragraph on what slipped, then exactly three concrete suggestions for next month as lines starting with "• ". Warm, honest, no exaggeration, under 220 words. Plain text only.\n\n${facts}`,
  }));
  if (text) { repUi.ai[repUi.month] = text; render(); }
}

// ---------- shareable image ----------
async function reportImage() {
  const st = monthStats(repUi.month);
  try { await Promise.all([document.fonts.load('700 60px "Aref Ruqaa"'), document.fonts.load('400 36px "Amiri"'), document.fonts.load('700 36px "Amiri"')]); } catch {}
  const W = 1080, H = 1350, P = 72;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#0f766e';
  const D = (s) => digitsOut(String(s));
  x.direction = 'rtl';
  x.fillStyle = '#f6f8f7'; x.fillRect(0, 0, W, H);
  x.fillStyle = accent; x.fillRect(0, 0, W, 300);
  x.textAlign = 'right';
  x.fillStyle = '#ffffff';
  x.font = '700 76px "Aref Ruqaa", "Amiri", serif';
  x.fillText(D(`تقرير ${monthTitle(repUi.month)}`), W - P, 150);
  x.font = '400 38px "Amiri", serif';
  x.fillText(D(monthHijri(repUi.month)), W - P, 215);
  x.font = '400 30px "Amiri", serif';
  x.globalAlpha = 0.85; x.fillText(S.settings.name ? `${S.settings.name} · مهامي` : 'مهامي', W - P, 265); x.globalAlpha = 1;

  const tiles = [
    [st.tasksDone, 'مهمة منجزة'], [st.steps, 'خطوة'], [st.goalDays, 'يوم التزام'],
    [st.focusMs ? fmtDur(st.focusMs) : '0 د', 'تركيز'], [st.booksRead.length, 'كتاب'], [st.benefits, 'فائدة'],
  ];
  const cols = 3, gw = (W - P * 2 - 40) / cols, gh = 170;
  tiles.forEach(([v, l], i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const bx = W - P - (col + 1) * gw - col * 20, by = 350 + row * (gh + 24);
    x.fillStyle = '#ffffff';
    x.beginPath(); x.roundRect ? x.roundRect(bx, by, gw, gh, 24) : x.rect(bx, by, gw, gh); x.fill();
    x.fillStyle = '#16211e'; x.textAlign = 'center';
    x.font = '700 64px "Amiri", serif'; x.fillText(D(v), bx + gw / 2, by + 92);
    x.fillStyle = '#5b6a66'; x.font = '400 32px "Amiri", serif'; x.fillText(D(l), bx + gw / 2, by + 140);
  });
  x.textAlign = 'right';
  let y = 790;
  const line = (label, value, color) => {
    if (y > H - 120) return;
    x.fillStyle = '#16211e'; x.font = '700 34px "Amiri", serif';
    x.fillText(D(label), W - P, y);
    if (value != null) {
      const bw = 360, bx = P + 90, bh = 18;
      x.fillStyle = '#dde5e2'; x.fillRect(bx, y - 22, bw, bh);
      x.fillStyle = color || accent; x.fillRect(bx + bw - (bw * value) / 100, y - 22, (bw * value) / 100, bh);
      x.fillStyle = '#5b6a66'; x.font = '400 30px "Amiri", serif'; x.textAlign = 'left';
      x.fillText(D(`${value}%`), P, y); x.textAlign = 'right';
    }
    y += 62;
  };
  if (st.projects.length) { x.fillStyle = accent; x.font = '700 40px "Aref Ruqaa", serif'; x.fillText('المشاريع', W - P, y); y += 60; st.projects.slice(0, 3).forEach((p) => line(p.name, p.progress, p.color)); }
  const hs = habitsMonthStats(repUi.month);
  if (hs.length) { x.fillStyle = accent; x.font = '700 40px "Aref Ruqaa", serif'; x.fillText('العادات (القوة)', W - P, y); y += 60; hs.forEach((h) => line(h.title, h.strength)); }
  if (st.goals.length) { x.fillStyle = accent; x.font = '700 40px "Aref Ruqaa", serif'; x.fillText('الأهداف', W - P, y); y += 60; st.goals.slice(0, 3).forEach((g) => line(g.title, g.rate)); }
  if (st.booksRead.length && y < H - 160) { x.fillStyle = accent; x.font = '700 40px "Aref Ruqaa", serif'; x.fillText('أنهيت قراءة', W - P, y); y += 56; x.fillStyle = '#16211e'; x.font = '400 34px "Amiri", serif'; x.fillText(D(st.booksRead.slice(0, 3).map((t) => `«${t}»`).join('، ')), W - P, y); }
  x.fillStyle = '#5b6a66'; x.font = '400 26px "Amiri", serif'; x.textAlign = 'center';
  x.fillText(D(`أُنشئ في ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`), W / 2, H - 50);

  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], `mahami-report-${repUi.month}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `تقرير ${monthTitle(repUi.month)}` });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('حُفظت صورة التقرير في التنزيلات');
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action^="rep-"]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'rep-move') {
    const [y, m] = repUi.month.split('-').map(Number);
    const next = iso(new Date(y, m - 1 + Number(b.dataset.v), 1)).slice(0, 7);
    if (next <= today().slice(0, 7)) { repUi.month = next; render(); }
  }
  if (a === 'rep-ai') reportAI(b);
  if (a === 'rep-image') reportImage();
  if (a === 'rep-pdf') { document.body.classList.add('printing-report'); setTimeout(() => { window.print(); document.body.classList.remove('printing-report'); }, 50); }
});

Object.assign(LibraryViews, { report: viewReport });
