'use strict';
// Habit building: a habit is a recurring goal with a build plan (identity, cue, tiny version,
// reward, build period). At most three habits are built at once.
// Strength = exponentially weighted adherence (a missed day lowers it gently, it never resets);
// the journey counts completed days against the build period.

const HABIT_MAX = 3;
const HABIT_ALPHA = 0.05; // ~14-day half-life: 66 perfect days ≈ 97%
const HABIT_STAGES = [
  [0, 'البداية', 'أصعب مرحلة: ركّز على ألّا تفوّت يومين متتاليين.'],
  [25, 'التكوين', 'العادة تتشكّل. حافظ على المحفّز نفسه والوقت نفسه.'],
  [60, 'الترسيخ', 'أصبحت أسهل. لا تتوقف الآن، أنت قريب.'],
  [100, 'التثبيت', 'أكملت الرحلة. ارفع القوة إلى ٨٠٪ لتصبح عادة راسخة.'],
];

const isHabit = (t) => !!(t && t.habit && t.repeat);

function normalizeHabit(h) {
  if (!h) return null;
  const days = [21, 30, 66, 90].includes(Number(h.days)) ? Number(h.days) : 66;
  return {
    identity: String(h.identity || ''), cue: String(h.cue || ''), tiny: String(h.tiny || ''), reward: String(h.reward || ''),
    days, graduatedAt: h.graduatedAt || '',
  };
}

function habitStats(t, upto = today()) {
  const t0 = today();
  let s = 0, hit = 0, total = 0;
  const end = t.repeat.until && t.repeat.until < upto ? t.repeat.until : upto;
  for (let d = t.repeat.start; d <= end; d = addDays(d, 1)) {
    if (!occursOn(t, d)) continue;
    const done = !!t.completions[d];
    if (d === t0 && !done) continue; // today still open: don't count it as missed
    total++;
    if (done) hit++;
    s = s * (1 - HABIT_ALPHA) + (done ? HABIT_ALPHA : 0);
  }
  const strength = Math.round(s * 100);
  const journey = Math.min(100, pct(hit, t.habit.days));
  const graduated = !!t.habit.graduatedAt || (hit >= t.habit.days && strength >= 80);
  const stage = graduated ? ['أصبحت عادة راسخة', 'أحسنت! استمر عليها، ولك الآن مكان لعادة جديدة.'] : (() => { let st = HABIT_STAGES[0]; for (const x of HABIT_STAGES) if (journey >= x[0]) st = x; return [st[1], st[2]]; })();
  // current streak of scheduled days
  let streak = 0;
  for (let d = end; d >= t.repeat.start; d = addDays(d, -1)) {
    if (!occursOn(t, d)) continue;
    if (t.completions[d]) streak++;
    else if (d === t0) continue;
    else break;
  }
  return { strength, hit, total, journey, graduated, stage, streak, rate: pct(hit, total) };
}

const activeHabits = (exceptId) => S.tasks.filter((t) => isHabit(t) && t.id !== exceptId && !goalEnded(t) && !habitStats(t).graduated);

// celebrate once when a habit becomes established
// (and take it back if the tick that made it so is undone the same day)
function checkGraduation(t) {
  if (!isHabit(t)) return;
  const st = habitStats(t);
  if (t.habit.graduatedAt) {
    if (t.habit.graduatedAt === today() && !(st.hit >= t.habit.days && st.strength >= 80)) { t.habit.graduatedAt = ''; save(); }
    return;
  }
  if (st.hit >= t.habit.days && st.strength >= 80) {
    t.habit.graduatedAt = today();
    save();
    setTimeout(() => toast(`🎉 أصبحت «${t.title}» عادة راسخة! تحرّر مكان لعادة جديدة.`), 250);
  }
}

// ---------- goals tab section ----------
function habitMeter(st, size = 'big') {
  return `<div class="habit-ring ${size}" style="--p:${st.strength}" role="img" aria-label="قوة العادة ${st.strength}٪"><span><b>${st.strength}%</b><small>القوة</small></span></div>`;
}

function habitCardHTML(t) {
  const t0 = today();
  const st = habitStats(t);
  const occursToday = occursOn(t, t0);
  const done = occursToday && !!t.completions[t0];
  const h = t.habit;
  const dots = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t0, -i);
    const occ = occursOn(t, d);
    const cls = !occ ? 'off' : t.completions[d] ? 'hit' : d < t0 ? 'miss' : '';
    dots.push(`<i class="${cls}${d === t0 ? ' today' : ''}" title="${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))}"></i>`);
  }
  const dayN = Math.min(st.hit, h.days);
  return `<li class="habit-card${done ? ' done' : ''}${st.graduated ? ' graduated' : ''}">
    <div class="habit-top">
      ${habitMeter(st)}
      <div class="habit-main">
        <button type="button" class="t-main" data-action="open" data-id="${t.id}">
          <span class="t-title">${esc(t.title)}</span>
          ${h.identity ? `<span class="habit-identity">«${esc(h.identity)}»</span>` : ''}
        </button>
        <span class="habit-stage">${esc(st.stage[0])}</span>
      </div>
      ${occursToday ? checkButton(t, t0, done) : ''}
    </div>
    <div class="habit-journey">
      <div class="row-between"><small>رحلة البناء: يوم ${dayN} من ${h.days}</small><small>سلسلة ${daysWord(st.streak)}</small></div>
      <div class="progress-line"><i style="width:${st.journey}%"></i></div>
    </div>
    ${isCounted(t) && occursToday ? stepperHTML(t, t0) : ''}
    <div class="habit-dots" aria-label="آخر ١٤ يوماً">${dots.join('')}</div>
    ${h.cue || h.tiny || h.reward ? `<dl class="habit-plan">
      ${h.cue ? `<div><dt>المحفّز</dt><dd>${esc(h.cue)}</dd></div>` : ''}
      ${h.tiny ? `<div><dt>النسخة المصغرة</dt><dd>${esc(h.tiny)}</dd></div>` : ''}
      ${h.reward ? `<div><dt>المكافأة</dt><dd>${esc(h.reward)}</dd></div>` : ''}
    </dl>` : ''}
    <p class="note-text">${esc(st.stage[1])}</p>
  </li>`;
}

function habitsSectionHTML() {
  const habits = S.tasks.filter(isHabit);
  const active = habits.filter((t) => !goalEnded(t) && !habitStats(t).graduated);
  const done = habits.filter((t) => habitStats(t).graduated);
  const full = active.length >= HABIT_MAX;
  return `<section class="section">
    <div class="section-head"><h2>بناء العادات <small class="num">${active.length} من ${HABIT_MAX}</small></h2>
      ${full ? '<small class="hint">أكمل عادة لتضيف غيرها</small>' : addBtn('new-habit', 'عادة')}</div>
    ${active.length ? `<ul class="list">${active.map(habitCardHTML).join('')}</ul>`
      : emptyHTML('ابنِ عادة واحدة في كل مرة', `اختر حتى ${HABIT_MAX} عادات تبنيها الآن: حدّد من تريد أن تكون، ومتى تفعلها، ونسخة صغيرة لا تتجاوز دقيقتين. يقيس التطبيق قوة العادة ورحلة بنائها.`, addBtn('new-habit', 'أول عادة'))}
    ${done.length ? `<details class="habit-done"><summary>عادات ترسّخت (${done.length})</summary><ul class="list">${done.map(habitCardHTML).join('')}</ul></details>` : ''}
  </section>`;
}

// ---------- statistics ----------
function habitsPanelHTML() {
  const habits = S.tasks.filter(isHabit);
  if (!habits.length) return '';
  return `<section class="panel">
    <h2>العادات</h2>
    <ul class="hbars">${habits.map((t) => { const st = habitStats(t); return hbar(esc(t.title), `${st.strength}%`, st.strength); }).join('')}</ul>
    <p class="note-text">${habits.map((t) => { const st = habitStats(t); return `${esc(t.title)}: ${esc(st.stage[0])} | يوم ${Math.min(st.hit, t.habit.days)} من ${t.habit.days}`; }).join('<br>')}</p>
    <p class="note-text explain">النسبة هي قوة العادة: ترتفع مع كل يوم تلتزم فيه وتنخفض تدريجياً عند التفويت.</p>
  </section>`;
}

// ---------- monthly report ----------
function habitsMonthStats(m) {
  const [y, mo] = m.split('-').map(Number);
  const start = `${m}-01`;
  const end = iso(new Date(y, mo, 0));
  const last = end < today() ? end : today();
  return S.tasks.filter((t) => isHabit(t) && t.repeat.start <= last).map((t) => {
    let total = 0, hit = 0;
    for (let d = start > t.repeat.start ? start : t.repeat.start; d <= last; d = addDays(d, 1)) {
      if (!occursOn(t, d)) continue;
      if (d === today() && !t.completions[d]) continue;
      total++;
      if (t.completions[d]) hit++;
    }
    const st = habitStats(t, last);
    return { title: t.title, hit, total, rate: pct(hit, total), strength: st.strength, stage: st.stage[0] };
  });
}
function habitsReportHTML(m) {
  const hs = habitsMonthStats(m);
  if (!hs.length) return '';
  return `<section class="panel"><h2>العادات</h2>
    <ul class="hbars">${hs.map((h) => hbar(esc(h.title), `${h.strength}%`, h.strength)).join('')}</ul>
    <p class="note-text">${hs.map((h) => `${esc(h.title)}: التزمت ${h.hit} من ${h.total} يوماً هذا الشهر | ${esc(h.stage)}`).join('<br>')}</p>
  </section>`;
}

// ---------- «اليوم»: today's habits box ----------
function todayHabitsHTML() {
  const t0 = today();
  const habits = S.tasks.filter((t) => isHabit(t) && !goalEnded(t) && occursOn(t, t0))
    .sort((a, b) => habitStats(a).graduated - habitStats(b).graduated || (timeOn(a, t0) ?? 9999) - (timeOn(b, t0) ?? 9999));
  if (!habits.length) return ''; // nothing scheduled today
  const done = habits.filter((t) => t.completions[t0]).length;
  return `<section class="habits-today" aria-label="عاداتي اليوم">
    <div class="tblock-h"><h2>بناء العادات <small class="num">${done} من ${habits.length}</small></h2><button type="button" class="tblock-go" data-tab="goals">الأهداف ${icon('next')}</button></div>
    <ul>${habits.map((t) => {
      const st = habitStats(t);
      const isDone = !!t.completions[t0];
      return `<li class="ht-row${isDone ? ' done' : ''}">
        <div class="habit-ring small" style="--p:${st.strength}"><span><b>${st.strength}%</b></span></div>
        <button type="button" class="t-main" data-action="open" data-id="${t.id}">
          <span class="t-title">${esc(t.title)}</span>
          <span class="meta"><span>${esc(st.graduated ? 'راسخة' : st.stage[0])}</span><span class="num">يوم ${Math.min(st.hit, t.habit.days)} من ${t.habit.days}</span>${st.streak ? `<span class="num">سلسلة ${st.streak}</span>` : ''}${hasTime(t) ? `<span class="num">${esc(timeLabel(t, t0))}</span>` : ''}${!isDone && t.habit.tiny ? `<span>الأصغر: ${esc(t.habit.tiny)}</span>` : ''}</span>
        </button>
        ${checkButton(t, t0, isDone)}
      </li>`;
    }).join('')}</ul>
  </section>`;
}
