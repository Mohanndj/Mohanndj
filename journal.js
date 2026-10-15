'use strict';
// «يومياتي»: one entry per writing session, built from a template the user can customise.
// Smart parts: the template suggested for the time of day, live placeholders in the questions
// ({اليوم} {التاريخ} {الهجري} {الاسم}), a snapshot of the day from the app (what was done, habits,
// focus time, the day's plan) and, with AI on, a reflection question drawn from that day.
// Entries export to Word: each entry as one text, with a separator between entries.

const MOODS = [['😞', 'صعب'], ['😕', 'متعب'], ['😐', 'عادي'], ['🙂', 'جيد'], ['😄', 'رائع']];
const JBLOCKS = { mood: 'المزاج', plan: 'خطة اليوم من مهامي', done: 'ما أنجزته اليوم', habits: 'عاداتي اليوم', focus: 'وقت التركيز' };
const JWHEN = { any: 'أي وقت', morning: 'الصباح', evening: 'المساء', week: 'نهاية الأسبوع' };
const jUi = { q: '', month: '', manage: false };

const DEFAULT_TEMPLATES = [
  { id: 'tpl-evening', emoji: '🌙', name: 'مراجعة المساء', when: 'evening', blocks: { mood: true, done: true, habits: true, focus: true },
    questions: ['ما أبرز ما حدث اليوم؟', 'ما الذي أنجزته وأنا راضٍ عنه؟', 'ماذا تعلّمت اليوم؟', 'ما الذي أحسّنه غداً؟'] },
  { id: 'tpl-morning', emoji: '☀️', name: 'نيّة الصباح', when: 'morning', blocks: { mood: true, plan: true },
    questions: ['نيّتي ليوم {اليوم}', 'أهم ثلاثة أمور أريد إنجازها اليوم', 'كيف أريد أن أكون اليوم؟'] },
  { id: 'tpl-grat', emoji: '🤲', name: 'الامتنان', when: 'any', blocks: { mood: true },
    questions: ['ثلاث نِعَم أنا ممتنّ لها اليوم', 'شخص أثّر فيّ إيجاباً', 'لحظة جميلة لا أريد أن أنساها'] },
  { id: 'tpl-week', emoji: '📅', name: 'مراجعة الأسبوع', when: 'week', blocks: { mood: true, done: true, focus: true },
    questions: ['ما أهم إنجازات هذا الأسبوع؟', 'ما الذي لم يسر كما أردت، ولماذا؟', 'ما الدرس الأكبر؟', 'أهم ثلاثة أهداف للأسبوع القادم'] },
  { id: 'tpl-free', emoji: '✍️', name: 'كتابة حرّة', when: 'any', blocks: { mood: true }, questions: [] },
];

function normalizeJTemplate(t) {
  return {
    id: t.id || uid(), emoji: String(t.emoji || '📝').slice(0, 4), name: String(t.name || 'قالب'),
    when: JWHEN[t.when] ? t.when : 'any',
    questions: (Array.isArray(t.questions) ? t.questions : []).map((q) => String(q).trim()).filter(Boolean),
    blocks: Object.fromEntries(Object.keys(JBLOCKS).map((k) => [k, !!(t.blocks && t.blocks[k])])),
    created: t.created || Date.now(), updated: t.updated || Date.now(),
  };
}
function normalizeJournal(j) {
  return {
    id: j.id || uid(), date: j.date || today(), tplId: String(j.tplId || ''), tplName: String(j.tplName || ''),
    mood: Math.max(0, Math.min(5, Number(j.mood) || 0)),
    answers: (Array.isArray(j.answers) ? j.answers : []).map((a) => ({ q: String(a.q || ''), a: String(a.a || ''), custom: !!a.custom })),
    body: String(j.body || ''), blocks: { ...(j.blocks || {}) }, facts: j.facts || null,
    created: j.created || Date.now(), updated: j.updated || j.created || Date.now(),
  };
}
const getJ = (id) => S.journal.find((j) => j.id === id);
const getTpl = (id) => S.jtemplates.find((t) => t.id === id);
const jText = (j) => [...j.answers.map((a) => a.a.trim()), j.body.trim()].filter(Boolean).join('\n\n');
const jEmpty = (j) => !jText(j) && !j.mood;

// ---------- smart parts ----------
function fillPlaceholders(q, d) {
  return q.replace(/\{اليوم\}/g, AR_DAYS[parse(d).getDay()])
    .replace(/\{التاريخ\}/g, fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' }))
    .replace(/\{الهجري\}/g, fmtHijri(d))
    .replace(/\{الاسم\}/g, S.settings.name.trim() || '');
}

function suggestedTpl(d = today()) {
  const h = new Date().getHours();
  const dow = parse(d).getDay();
  const want = dow === 5 && h >= 12 ? 'week' : h < 12 ? 'morning' : h >= 17 ? 'evening' : 'any';
  return S.jtemplates.find((t) => t.when === want) || S.jtemplates.find((t) => t.when === 'any') || S.jtemplates[0] || null;
}

// what the app knows about a day
function dayFacts(d) {
  const dayOf = (ts) => (ts ? iso(new Date(ts)) : '');
  const done = [];
  for (const t of S.tasks) {
    if (isHabit(t)) continue;
    if (isRepeat(t)) { if (t.completions[d]) done.push(t.title); } else if (t.done && dayOf(t.doneAt) === d) done.push(t.title);
  }
  let steps = 0;
  for (const t of S.tasks) for (const s of t.subtasks) if (s.done && dayOf(s.doneAt) === d) steps++;
  const habits = S.tasks.filter((t) => isHabit(t) && occursOn(t, d)).map((t) => ({ t: t.title, ok: !!t.completions[d] }));
  const focusMs = S.sessions.filter((x) => sessionDay(x) === d).reduce((n, x) => n + x.ms, 0);
  const plan = S.tasks.filter((t) => !isHabit(t) && (isRepeat(t) ? occursOn(t, d) : t.due === d || (!t.done && t.due && t.due < d && d === today())))
    .map((t) => t.title);
  return { done, steps, habits, focusMs, plan };
}

function factsLines(f, blocks, skipEmpty) {
  if (!f) return [];
  const out = [];
  if (blocks.plan && f.plan.length) out.push(['خطة اليوم', f.plan.join('، ')]);
  if (blocks.done && !(skipEmpty && !f.done.length && !f.steps)) out.push(['أنجزت', f.done.length ? f.done.join('، ') + (f.steps ? ` (و${f.steps} خطوة)` : '') : f.steps ? `${f.steps} خطوة` : 'لا شيء مسجّل']);
  if (blocks.habits && f.habits.length) out.push(['العادات', f.habits.map((h) => `${h.ok ? '✓' : '✗'} ${h.t}`).join('، ')]);
  if (blocks.focus && f.focusMs) out.push(['التركيز', fmtDur(f.focusMs)]);
  return out;
}

function jStreak() {
  const days = new Set(S.journal.filter((j) => !jEmpty(j)).map((j) => j.date));
  let n = 0;
  let d = days.has(today()) ? today() : addDays(today(), -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- page ----------
function jCard(j) {
  const text = jText(j);
  return `<button type="button" class="j-card" data-action="j-open" data-v="${j.id}">
    <span class="j-date"><b>${esc(fmtDate(j.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</b>${S.settings.hijri ? `<small>${esc(fmtHijri(j.date, { day: 'numeric', month: 'long' }))}</small>` : ''}</span>
    ${j.mood ? `<span class="j-mood" title="${MOODS[j.mood - 1][1]}">${MOODS[j.mood - 1][0]}</span>` : ''}
    ${text ? `<p>${esc(excerpt(text, 240))}</p>` : '<p class="muted">لم تكتب شيئاً بعد</p>'}
    <small class="book-line">${esc(j.tplName || 'كتابة حرّة')} · ${plural(wordCount(text), 'كلمة واحدة', 'كلمتان', 'كلمات', 'كلمة')}</small>
  </button>`;
}
const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (m) => parse(`${m}-01`).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });

function tplChips(d, compact) {
  const sug = suggestedTpl(d);
  if (!S.jtemplates.length) return `<button type="button" class="j-tpl" data-action="j-new" data-v=""><span>✍️</span><b>كتابة حرّة</b></button>`;
  return S.jtemplates.map((t) => `<button type="button" class="j-tpl${sug && t.id === sug.id ? ' suggested' : ''}" data-action="j-new" data-v="${t.id}"><span>${esc(t.emoji)}</span><b>${esc(t.name)}</b>${!compact && sug && t.id === sug.id ? '<small>مقترح الآن</small>' : ''}</button>`).join('');
}

const qCount = (t) => (t.questions.length ? plural(t.questions.length, 'سؤال واحد', 'سؤالان', 'أسئلة', 'سؤالاً') : 'بلا أسئلة');
// template management: edit, reorder, delete (two taps), add, restore the originals
function tplManageHTML() {
  const missing = DEFAULT_TEMPLATES.filter((d) => !getTpl(d.id));
  const n = S.jtemplates.length;
  return `<ul class="j-manage">${S.jtemplates.map((t, i) => `<li>
      <button type="button" class="j-m-main" data-action="j-tpl-edit" data-v="${t.id}"><span class="j-m-emoji">${esc(t.emoji)}</span><span><b>${esc(t.name)}</b><small>${qCount(t)} · ${JWHEN[t.when]}</small></span></button>
      <div class="j-m-btns">
        <button type="button" data-action="j-tpl-move" data-v="${t.id}" data-d="-1" aria-label="تقديم"${i ? '' : ' disabled'}>${icon('prev')}</button>
        <button type="button" data-action="j-tpl-move" data-v="${t.id}" data-d="1" aria-label="تأخير"${i < n - 1 ? '' : ' disabled'}>${icon('next')}</button>
        <button type="button" data-action="j-tpl-edit" data-v="${t.id}" aria-label="تعديل">${icon('edit')}</button>
        <button type="button" class="j-m-del" data-action="j-tpl-del" data-v="${t.id}" aria-label="حذف">✕</button>
      </div>
    </li>`).join('')}</ul>
    ${n ? '' : '<p class="note-text">حذفت كل القوالب. أضف قالباً جديداً أو استعد الأصلية، ويمكنك الكتابة الحرّة دائماً.</p>'}
    <div class="btn-row">
      ${addBtn('j-tpl-new', 'قالب جديد')}
      ${missing.length ? `<button type="button" class="ghost" data-action="j-tpl-restore">استعادة القوالب الأصلية (${missing.length})</button>` : ''}
    </div>
    <p class="note-text">اضغط على القالب لتعديل اسمه ورمزه وأسئلته وما يُضاف من يومك. حذف القالب لا يحذف اليوميات التي كتبتها به.</p>`;
}

function viewJournal() {
  const t0 = today();
  const todays = S.journal.filter((j) => j.date === t0);
  const q = jUi.q.trim().toLowerCase();
  const list = S.journal.filter((j) => (!q || [jText(j), j.tplName, ...j.answers.map((a) => a.q)].some((s) => s.toLowerCase().includes(q))) && (!jUi.month || monthKey(j.date) === jUi.month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  const months = [...new Set(S.journal.map((j) => monthKey(j.date)))].sort().reverse();
  const groups = [];
  for (const j of list) { const m = monthKey(j.date); const g = groups.find((x) => x.m === m); if (g) g.items.push(j); else groups.push({ m, items: [j] }); }
  const streak = jStreak();
  const thisMonth = S.journal.filter((j) => monthKey(j.date) === monthKey(t0)).length;
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>يومياتي</h2><div class="btn-row">${S.journal.length ? `<button type="button" class="xls-btn word-btn" data-action="j-export">${icon('note')}وورد</button>${xlsBtn('journal')}` : ''}</div></div>
    ${S.journal.length ? `<div class="j-stats"><span><b>${S.journal.length}</b> ${S.journal.length >= 3 && S.journal.length <= 10 ? 'يوميات' : 'يومية'}</span><span><b>${thisMonth}</b> هذا الشهر</span><span><b>${streak}</b> ${streak >= 3 && streak <= 10 ? 'أيام متتالية' : 'يوم متتالٍ'}</span></div>` : ''}
    <div class="j-start">
      <div class="row-between"><h3>${jUi.manage ? 'قوالبي' : todays.length ? 'يومية أخرى لليوم؟' : 'اكتب يومية اليوم'}</h3>
        <button type="button" class="j-manage-btn" data-action="j-manage" aria-pressed="${jUi.manage}">${jUi.manage ? `${icon('check')} تم` : `${icon('edit')} تخصيص القوالب`}</button></div>
      ${jUi.manage ? tplManageHTML() : `<div class="j-tpls">${tplChips(t0)}</div>`}
    </div>
    ${S.journal.length ? `<input type="search" id="jSearch" placeholder="ابحث في يومياتك" aria-label="بحث" value="${esc(jUi.q)}">
      ${months.length > 1 ? `<div class="chips" role="group" aria-label="الشهر"><button type="button" class="chip" data-action="j-month" data-v="" aria-pressed="${!jUi.month}">كل الأشهر</button>${months.map((m) => `<button type="button" class="chip" data-action="j-month" data-v="${m}" aria-pressed="${jUi.month === m}">${esc(monthLabel(m))}</button>`).join('')}</div>` : ''}` : ''}
    ${groups.length ? groups.map((g) => `<h3 class="j-month">${esc(monthLabel(g.m))}</h3><div class="book-list">${g.items.map(jCard).join('')}</div>`).join('')
      : S.journal.length ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى.') : emptyHTML('دفتر يومياتك', 'اختر قالباً أعلاه وابدأ. كل قالب يسألك أسئلة تساعدك على الكتابة، ويضيف تلقائياً ما أنجزته وعاداتك ووقت تركيزك في ذلك اليوم.')}
  </section>
`;
}

// «اليوم»: a small invitation to write, or a link to today's entry
function journalTodayHTML() {
  const t0 = today();
  const j = S.journal.filter((x) => x.date === t0 && !jEmpty(x)).sort((a, b) => b.updated - a.updated)[0];
  if (j) return `<button type="button" class="j-today done" data-action="j-open" data-v="${j.id}"><span>${j.mood ? MOODS[j.mood - 1][0] : '📖'}</span><span><b>كتبت يومية اليوم</b><small>${esc(excerpt(jText(j) || j.tplName, 60))}</small></span></button>`;
  const t = suggestedTpl(t0);
  if (!t || !S.journal.length) return ''; // an invitation only for someone who keeps a journal
  return `<button type="button" class="j-today" data-action="j-new" data-v="${t.id}"><span>${esc(t.emoji)}</span><span><b>يومياتي: ${esc(t.name)}</b><small>${esc(t.questions[0] ? fillPlaceholders(t.questions[0], t0) : 'دقيقتان من الكتابة تكفي')}</small></span></button>`;
}

// ---------- editor (full screen) ----------
let jstate = null; // { id, isNew, timer }
const jed = () => $('jEditor');

function newEntry(tplId, d = today()) {
  const t = getTpl(tplId) || suggestedTpl(d) || normalizeJTemplate({ name: 'كتابة حرّة', blocks: { mood: true } });
  return normalizeJournal({
    date: d, tplId: t.id, tplName: t.name, blocks: { ...t.blocks },
    answers: t.questions.map((q) => ({ q: fillPlaceholders(q, d), a: '' })),
  });
}

function openJournal(id, tplId) {
  const j = id ? getJ(id) : newEntry(tplId);
  jstate = { id: j.id, isNew: !id, timer: null, draft: id ? null : j };
  renderJEditor(j);
  const d = jed();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  setTimeout(() => {
    const a = document.activeElement;
    if (jstate && !(a && a.closest && a.closest('#jBody textarea, #jBody input'))) { const first = $('jBody').querySelector('textarea'); if (first && !id) first.focus(); }
  }, 80);
}
const curJ = () => (jstate ? getJ(jstate.id) || jstate.draft : null);

function renderJEditor(j) {
  $('jDel').hidden = jstate.isNew;
  $('jDel').classList.remove('armed');
  $('jDel').textContent = 'حذف';
  $('jHead').innerHTML = `<b>${esc(fmtDate(j.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</b>${S.settings.hijri ? `<small>${esc(fmtHijri(j.date))}</small>` : ''}`;
  const facts = factsLines(dayFacts(j.date), j.blocks);
  $('jBody').innerHTML = `
    <div class="j-meta-row">
      <label class="j-date-in"><span>التاريخ</span><input type="date" id="jDate" value="${j.date}" max="${addDays(today(), 1)}"></label>
      <span class="j-tplname">${esc(j.tplName || 'كتابة حرّة')}</span>
    </div>
    ${j.blocks.mood ? `<div class="j-moods" role="group" aria-label="المزاج"><span>كيف كان يومك؟</span>${MOODS.map(([e, l], i) => `<button type="button" data-jaction="mood" data-v="${i + 1}" aria-pressed="${j.mood === i + 1}" aria-label="${l}"><span>${e}</span><small>${l}</small></button>`).join('')}</div>` : ''}
    ${facts.length ? `<div class="j-facts" aria-label="من بيانات يومك">${facts.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>` : ''}
    ${j.answers.map((a, i) => `<div class="j-q">
      ${a.custom ? `<input type="text" class="j-qin" data-i="${i}" value="${esc(a.q)}" placeholder="اكتب سؤالك" aria-label="السؤال">` : `<label for="jA${i}">${esc(a.q)}</label>`}
      <textarea id="jA${i}" data-i="${i}" rows="3" placeholder="اكتب هنا…">${esc(a.a)}</textarea>
    </div>`).join('')}
    <div class="j-q">
      <label for="jFree">${j.answers.length ? 'مساحة حرّة' : 'اكتب ما في خاطرك'}</label>
      <textarea id="jFree" rows="${j.answers.length ? 4 : 12}" placeholder="أي شيء آخر تريد أن تكتبه…">${esc(j.body)}</textarea>
    </div>
    <div class="btn-row j-more">
      <button type="button" class="ghost" data-jaction="add-q">${icon('plus')} سؤال من عندي</button>
      ${AI.on() ? `<button type="button" class="ghost ai-btn" data-jaction="ai-q">${icon('spark')} سؤال للتأمّل</button>` : ''}
    </div>`;
  for (const ta of $('jBody').querySelectorAll('textarea')) grow(ta);
  setJStatus(jstate.isNew ? 'يومية جديدة' : `آخر تعديل: ${fmtStamp(j.updated)}`);
}
function grow(ta) { ta.style.height = 'auto'; ta.style.height = `${Math.max(ta.scrollHeight + 2, 72)}px`; }
function setJStatus(s) { $('jStatus').textContent = s; }

function readJ() {
  const j = curJ();
  if (!j) return null;
  for (const ta of $('jBody').querySelectorAll('textarea[data-i]')) j.answers[+ta.dataset.i].a = ta.value;
  for (const inp of $('jBody').querySelectorAll('.j-qin')) j.answers[+inp.dataset.i].q = inp.value;
  j.body = $('jFree').value;
  j.date = $('jDate').value || j.date;
  return j;
}

function saveJNow() {
  if (!jstate) return;
  clearTimeout(jstate.timer);
  const j = readJ();
  if (!j) return;
  if (jstate.isNew) {
    if (jEmpty(j)) return; // nothing written yet: nothing to keep
    S.journal.push(j);
    jstate.isNew = false;
    jstate.draft = null;
    $('jDel').hidden = false;
  }
  j.updated = Date.now();
  j.facts = dayFacts(j.date);
  save();
  setJStatus('حُفظت ✓');
}
function scheduleJSave() {
  if (!jstate) return;
  clearTimeout(jstate.timer);
  setJStatus('…');
  jstate.timer = setTimeout(saveJNow, 600);
}

function closeJournal() {
  if (!jstate) return;
  saveJNow();
  jstate = null;
  const d = jed();
  if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
  render();
}

async function jAIQuestion(btn) {
  const j = readJ();
  const f = dayFacts(j.date);
  btn.disabled = true;
  try {
    const q = await AI.ask({
      system: 'You write ONE short reflective journaling question in Arabic for the user, based on their day. Warm, specific, not generic, at most 20 words. Return only the question.',
      prompt: [`التاريخ: ${j.date} (${AR_DAYS[parse(j.date).getDay()]})`, j.mood ? `المزاج: ${MOODS[j.mood - 1][1]}` : '',
        f.done.length ? `أنجز: ${f.done.join('، ')}` : '', f.habits.length ? `العادات: ${f.habits.map((h) => `${h.t} ${h.ok ? 'تمت' : 'لم تتم'}`).join('، ')}` : '',
        f.focusMs ? `وقت التركيز: ${Math.round(f.focusMs / 60000)} دقيقة` : '', jText(j) ? `ما كتبه حتى الآن: ${excerpt(jText(j), 1500)}` : ''].filter(Boolean).join('\n'),
      effort: 'low',
      maxTokens: 1000,
    });
    if (q && jstate) { j.answers.push({ q: q.trim(), a: '' }); renderJEditor(j); scheduleJSave(); const last = $(`jA${j.answers.length - 1}`); if (last) last.focus(); }
  } catch (e) { toast(AI.friendly(e)); }
  if (btn.isConnected) btn.disabled = false;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-jaction]');
  if (!el || !jstate) return;
  const j = curJ();
  switch (el.dataset.jaction) {
    case 'close': closeJournal(); break;
    case 'mood': {
      readJ();
      const v = +el.dataset.v;
      j.mood = j.mood === v ? 0 : v;
      for (const b of el.parentNode.querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.v === j.mood));
      scheduleJSave();
      break;
    }
    case 'add-q': readJ(); j.answers.push({ q: '', a: '', custom: true }); renderJEditor(j); $('jBody').querySelector(`.j-qin[data-i="${j.answers.length - 1}"]`).focus(); break;
    case 'ai-q': jAIQuestion(el); break;
    case 'word': saveJNow(); if (jEmpty(readJ())) { toast('اكتب شيئاً أولاً.'); break; } exportWord([readJ()]); break;
    case 'delete': {
      if (!el.classList.contains('armed')) {
        el.classList.add('armed'); el.textContent = 'تأكيد الحذف';
        setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = 'حذف'; } }, 3000);
        break;
      }
      S.journal = S.journal.filter((x) => x.id !== jstate.id);
      save();
      jstate = null;
      jed().close();
      render();
      toast('حُذفت اليومية');
      break;
    }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'jSearch') { jUi.q = e.target.value; render(); return; }
  if (!jstate || !e.target.closest('#jBody')) return;
  if (e.target.tagName === 'TEXTAREA') grow(e.target);
  scheduleJSave();
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'jDate' || !jstate) return;
  const j = readJ();
  renderJEditor(j);
  scheduleJSave();
});

// ---------- template editor (shared library sheet) ----------
function openJTpl(id) {
  const t = id ? getTpl(id) : normalizeJTemplate({ emoji: '📝', name: '', blocks: { mood: true } });
  ldraft = { kind: 'jtpl', id: t.id, isNew: !id };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? 'تعديل القالب' : 'قالب جديد'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="grid-emoji">
      <label class="field"><span>رمز</span><input type="text" id="tEmoji" value="${esc(t.emoji)}" maxlength="4" autocomplete="off" data-novoice></label>
      <label class="field"><span>اسم القالب</span><input type="text" id="tName" value="${esc(t.name)}" autocomplete="off" placeholder="مثال: يومية السفر"></label>
    </div>
    <div class="field"><span>الأسئلة</span>
      <ol class="tq-list" id="tQs">${t.questions.map(tqRow).join('')}</ol>
      <button type="button" class="ghost tq-add" data-taction="add">${icon('plus')} أضف سؤالاً</button>
    </div>
    <p class="note-text">اكتب {اليوم} أو {التاريخ} أو {الهجري} أو {الاسم} داخل السؤال لتُستبدل تلقائياً. بلا أسئلة يصبح القالب كتابة حرّة.</p>
    <div class="field"><span>يُضاف تلقائياً من يومك</span>
      <div class="j-blocks">${Object.entries(JBLOCKS).map(([k, l]) => `<label class="switch"><input type="checkbox" data-block="${k}"${t.blocks[k] ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
    </div>
    <label class="field"><span>يُقترح تلقائياً في</span><select id="tWhen">${Object.entries(JWHEN).map(([v, l]) => `<option value="${v}"${t.when === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="sheet-actions">
      <button type="submit" class="primary">${id ? 'حفظ' : 'أضف القالب'}</button>
      ${id ? '<button type="button" class="ghost" data-action="j-tpl-copy">نسخة منه</button><button type="button" class="danger" data-action="lib-delete">حذف القالب</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
const tqRow = (q = '') => `<li><input type="text" class="tq-in" value="${esc(q)}" placeholder="اكتب السؤال" aria-label="سؤال" autocomplete="off">
  <button type="button" data-taction="up" aria-label="تقديم">${icon('prev')}</button><button type="button" data-taction="down" aria-label="تأخير">${icon('next')}</button><button type="button" class="j-m-del" data-taction="del" aria-label="حذف السؤال">✕</button></li>`;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-taction]');
  if (!b) return;
  const list = $('tQs');
  const li = b.closest('li');
  switch (b.dataset.taction) {
    case 'add': list.insertAdjacentHTML('beforeend', tqRow()); list.lastElementChild.querySelector('input').focus(); break;
    case 'del': li.remove(); break;
    case 'up': if (li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling); break;
    case 'down': if (li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li); break;
  }
});
function saveJTpl() {
  const name = $('tName').value.trim();
  if (!name) { toast('سمِّ القالب.'); return false; }
  const old = getTpl(ldraft.id);
  const t = normalizeJTemplate({
    ...(old || {}), id: ldraft.id, name, emoji: $('tEmoji').value.trim() || '📝', when: $('tWhen').value,
    questions: [...$('tQs').querySelectorAll('.tq-in')].map((x) => x.value), updated: Date.now(),
    blocks: Object.fromEntries([...$('libForm').querySelectorAll('[data-block]')].map((c) => [c.dataset.block, c.checked])),
  });
  if (old) Object.assign(old, t); else S.jtemplates.push(t);
  save();
  return true;
}

// ---------- Word export ----------
function openJExport() {
  const o = { range: 'month', questions: false, facts: false, pages: false, ...(S.settings.jexport || {}) };
  ldraft = { kind: 'jexport', id: 'x', isNew: false };
  const months = [...new Set(S.journal.map((j) => monthKey(j.date)))].sort().reverse();
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>تصدير اليوميات إلى وورد</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>ماذا تصدّر؟</span><select id="xRange">
      <option value="all"${o.range === 'all' ? ' selected' : ''}>كل اليوميات (${S.journal.length})</option>
      ${months.map((m) => `<option value="${m}"${o.range === m ? ' selected' : ''}>${esc(monthLabel(m))}</option>`).join('')}
      <option value="custom"${o.range === 'custom' ? ' selected' : ''}>من تاريخ إلى تاريخ</option>
    </select></label>
    <div class="grid2" id="xCustom"${o.range === 'custom' ? '' : ' hidden'}>
      <label class="field"><span>من</span><input type="date" id="xFrom" value="${o.from || (months[0] || today().slice(0, 7)) + '-01'}"></label>
      <label class="field"><span>إلى</span><input type="date" id="xTo" value="${o.to || today()}"></label>
    </div>
    <label class="switch"><input type="checkbox" id="xQs"${o.questions ? ' checked' : ''}><span>إظهار أسئلة القالب فوق الإجابات</span></label>
    <label class="switch"><input type="checkbox" id="xFacts"${o.facts ? ' checked' : ''}><span>إضافة بيانات اليوم (المنجزات والعادات والتركيز)</span></label>
    <label class="switch"><input type="checkbox" id="xPages"${o.pages ? ' checked' : ''}><span>كل يومية في صفحة مستقلة (بدلاً من الفاصل)</span></label>
    <p class="note-text">كل يومية تُكتب نصاً واحداً متصلاً تحت تاريخها (الميلادي والهجري)، وبين كل يومية والتي تليها فاصل ✦ ✦ ✦. يفتح الملف في Word وGoogle Docs.</p>
    <div class="sheet-actions"><button type="submit" class="primary">${icon('note')} تصدير</button></div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function runJExport() {
  const range = $('xRange').value;
  const o = { range, questions: $('xQs').checked, facts: $('xFacts').checked, pages: $('xPages').checked, from: $('xFrom').value, to: $('xTo').value };
  S.settings.jexport = o;
  save();
  const list = S.journal.filter((j) => !jEmpty(j) && (range === 'all' || (range === 'custom' ? j.date >= o.from && j.date <= o.to : monthKey(j.date) === range)));
  if (!list.length) { toast('لا يوميات في هذه الفترة.'); return false; }
  exportWord(list, o, range === 'all' ? 'يومياتي' : range === 'custom' ? `يومياتي من ${fmtDate(o.from, { day: 'numeric', month: 'long', year: 'numeric' })} إلى ${fmtDate(o.to, { day: 'numeric', month: 'long', year: 'numeric' })}` : `يومياتي · ${monthLabel(range)}`);
  return true;
}

function exportWord(list, opts = null, title = '') {
  const o = { questions: false, facts: false, pages: false, ...(opts || S.settings.jexport || {}) };
  const ar = (s) => (S.settings.digits === 'arab' ? toArabicDigits(String(s)) : String(s));
  const entries = list.slice().sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
  const P = [];
  if (title) P.push({ style: 'Title', text: ar(title) });
  entries.forEach((j, i) => {
    if (i) P.push(o.pages ? null : { style: 'Sep', text: '✦   ✦   ✦' });
    // «·» reads like an Arabic zero in Word fonts, so dashes and commas separate here
    const head = fmtDate(j.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (S.settings.hijri ? ` — ${fmtHijri(j.date)}` : '');
    P.push({ style: 'Heading1', text: ar(head), pageBreak: o.pages && i > 0 });
    const meta = [j.tplName, j.mood ? `المزاج: ${MOODS[j.mood - 1][1]} ${MOODS[j.mood - 1][0]}` : ''].filter(Boolean).join('، ');
    if (meta) P.push({ style: 'Meta', text: ar(meta) });
    if (o.facts) for (const [k, v] of factsLines(j.facts || dayFacts(j.date), { ...j.blocks, done: true, habits: true, focus: true }, true)) P.push({ style: 'Meta', runs: [{ text: `${k}: `, bold: true }, { text: ar(v) }] });
    const parts = [...j.answers.filter((a) => a.a.trim()).map((a) => ({ q: a.q, a: a.a.trim() })), ...(j.body.trim() ? [{ q: j.answers.length ? 'مساحة حرّة' : '', a: j.body.trim() }] : [])];
    // lines are separate paragraphs (a line break inside a justified paragraph stretches the line)
    const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
    const text = (arr) => arr.forEach((t, k) => P.push({ style: k === arr.length - 1 ? 'Normal' : 'Tight', text: ar(t) }));
    if (o.questions) {
      for (const p of parts) { if (p.q) P.push({ style: 'Question', text: ar(p.q) }); text(lines(p.a)); }
    } else {
      // the whole entry as one text: answers follow one another with no gaps or headings
      text(parts.flatMap((p) => lines(p.a)));
    }
  });
  const blob = Docx.build(P.filter(Boolean), { title: title || 'يومياتي' });
  const name = entries.length === 1 ? `yawmiyat-${entries[0].date}` : `yawmiyat-${entries[0].date}_${entries[entries.length - 1].date}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.docx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('جُهّز ملف الوورد. تجده في التنزيلات.');
}

// ---------- page events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="j-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'j-new': openJournal(null, v); break;
    case 'j-open': openJournal(v); break;
    case 'j-month': jUi.month = v; render(); break;
    case 'j-tpl-new': openJTpl(null); break;
    case 'j-tpl-edit': openJTpl(v); break;
    case 'j-manage': jUi.manage = !jUi.manage; render(); break;
    case 'j-tpl-move': {
      const i = S.jtemplates.findIndex((t) => t.id === v), k = i + Number(el.dataset.d);
      if (i < 0 || k < 0 || k >= S.jtemplates.length) break;
      [S.jtemplates[i], S.jtemplates[k]] = [S.jtemplates[k], S.jtemplates[i]];
      save(); render();
      break;
    }
    case 'j-tpl-del': {
      if (!el.classList.contains('armed')) {
        el.classList.add('armed'); el.textContent = 'احذف؟';
        setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = '✕'; } }, 3000);
        break;
      }
      const t = getTpl(v);
      S.jtemplates = S.jtemplates.filter((x) => x.id !== v);
      save(); render();
      toast(`حُذف قالب «${t ? t.name : ''}»`);
      break;
    }
    case 'j-tpl-restore':
      for (const d of DEFAULT_TEMPLATES) if (!getTpl(d.id)) S.jtemplates.push(normalizeJTemplate(d));
      save(); render(); toast('أُعيدت القوالب الأصلية');
      break;
    case 'j-tpl-copy': {
      if (!saveJTpl()) break;
      const src = getTpl(ldraft.id);
      const c = normalizeJTemplate({ ...src, id: uid(), name: `${src.name} (نسخة)`, created: Date.now() });
      S.jtemplates.splice(S.jtemplates.indexOf(src) + 1, 0, c);
      save(); closeLib(); render(); openJTpl(c.id);
      toast('أُنشئت نسخة، عدّلها كما تحب');
      break;
    }
    case 'j-export': openJExport(); break;
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'xRange') $('xCustom').hidden = e.target.value !== 'custom';
});

Object.assign(LibraryViews, { journal: viewJournal });
