'use strict';
// «التقارير»: weekly, monthly and yearly. Each measures activity in every area (aware.js), keeps the
// user's own notes for the period (a summary, and obstacles with their solutions — often written by
// an outside AI from the full copy this page exports), and reminds them of the last period's solutions.

const repUi = { type: 'week', key: '', journal: false };

function normalizeReport(r) {
  const id = String(r.id || '');
  return { id: id.startsWith('w:') ? `w:${sundayId(id.slice(2))}` : id, summary: String(r.summary || ''), solutions: String(r.solutions || ''), updated: r.updated || Date.now() };
}
const reportNote = (id) => S.reports.find((r) => r.id === id);

// the headline numbers of a period
function periodStats(P) {
  const inP = (d) => !!d && d >= P.start && d <= P.last;
  const ev = completionEvents().filter((e) => inP(e.d));
  const byDay = {};
  for (const e of ev) if (e.type !== 'step') byDay[e.d] = (byDay[e.d] || 0) + 1;
  const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] || null;
  const sess = S.sessions.filter((x) => inP(sessionDay(x)));
  const projects = S.projects.map((p) => {
    const st = projectStats(p.id);
    return { name: p.name, color: p.color, progress: st.progress, total: st.total, doneIn: tasksOf(p.id).filter((t) => t.done && inP(dayOfTs(t.doneAt))).length };
  }).filter((p) => p.total && (p.doneIn || P.current));
  return {
    // the same things the areas below count: tasks (not books), goals (not habits or reading), habits, reading sessions
    tasks: ev.filter((e) => e.kind === 'task').length,
    goalDays: ev.filter((e) => e.kind === 'goal').length,
    habitDays: ev.filter((e) => e.kind === 'habit').length,
    readings: ev.filter((e) => e.kind === 'read').length,
    steps: ev.filter((e) => e.type === 'step').length,
    focusMs: sum(sess, (x) => x.ms),
    pages: S.books.reduce((n, b) => n + pagesIn(b, P.start, P.last), 0),
    books: S.books.filter((b) => b.status === 'read' && inP(b.end)).length,
    benefits: S.benefits.filter((f) => inP(dayOfTs(f.created))).length,
    activeDays: Object.keys(byDay).length,
    best, projects,
  };
}

function viewReport() {
  const P = periodOf(repUi.type, repUi.key);
  repUi.key = P.key;
  const st = periodStats(P);
  const prevP = periodOf(P.type, P.prev);
  const prevStats = awareStats(prevP);
  const note = reportNote(P.id) || normalizeReport({ id: P.id });
  const prevNote = reportNote(prevP.id);
  // a lone «٠» in a big font looks like a dot, so zero is written as a word
  const tile = (v, l) => `<div class="tile"><b>${v === 0 || v === '0' || v === '٠' ? 'صفر' : v}</b><span>${l}</span></div>`;
  return `${moreCrumb()}
  <div class="seg rep-types" role="group" aria-label="نوع التقرير">${[['week', 'أسبوعي'], ['month', 'شهري'], ['year', 'سنوي']].map(([v, l]) => `<button type="button" data-action="rep-type" data-v="${v}" aria-pressed="${P.type === v}">${l}</button>`).join('')}</div>
  <div class="cal-head">
    <div class="nav"><button type="button" data-action="rep-move" data-v="${P.prev}" aria-label="السابق">${icon('prev')}</button></div>
    <div class="titles"><h2>${esc(P.title)}</h2><small>${esc(P.sub)}${P.current ? ` | حتى اليوم` : ''}</small></div>
    <div class="nav"><button type="button" data-action="rep-move" data-v="${P.next}" aria-label="التالي"${P.current ? ' disabled' : ''}>${icon('next')}</button></div>
  </div>
  <div class="report" id="report">
    <div class="tiles">
      ${tile(st.tasks, 'مهمة منجزة')}${tile(st.goalDays, 'مرة التزام بهدف')}${tile(st.habitDays, 'مرة أدّيت عادة')}${tile(st.readings, 'جلسة قراءة')}
      ${tile(st.pages, 'صفحة قرأتها')}${tile(st.books, 'كتاب أنهيته')}${tile(st.focusMs ? fmtDur(st.focusMs) : '٠', 'وقت التركيز')}${tile(st.activeDays, `يوم نشط من ${P.days.length}`)}
    </div>
    ${awareReportHTML(P, prevStats)}
    ${st.best && st.best[1] > 1 ? `<p class="note-text">أنشط أيامك: <b>${esc(fmtDate(st.best[0], { weekday: 'long', day: 'numeric', month: 'long' }))}</b> بـ ${st.best[1]} إنجازات.</p>` : ''}
    ${st.projects.length ? `<section class="panel"><h2>المشاريع</h2><ul class="hbars">${st.projects.map((p) => hbar(`<span class="proj" style="--pc:${p.color}"><i></i>${esc(p.name)}</span>`, `${p.progress}%${p.doneIn ? ` | +${p.doneIn}` : ''}`, p.progress, p.color)).join('')}</ul></section>` : ''}
    ${prevNote && prevNote.solutions.trim() ? `<section class="panel rep-prev"><h2>حلول اتفقت عليها في ${esc(prevP.title)}</h2><div class="ai-text">${esc(prevNote.solutions).replace(/\n/g, '<br>')}</div><p class="note-text">قارنها بدرجات هذا ${P.word}: هل نفعت؟</p></section>` : ''}
    <section class="panel rep-notes">
      <h2>${icon('spark')} خلاصاتي لهذا ${P.word}</h2>
      <label class="field"><span>الخلاصة</span><textarea id="repSummary" data-rep="summary" rows="5" placeholder="ما الذي جرى في هذا ${P.word}؟ ما أبرز إنجازاتك؟">${esc(note.summary)}</textarea></label>
      <label class="field"><span>العوائق وحلولها</span><textarea id="repSolutions" data-rep="solutions" rows="5" placeholder="ما الذي عاقك؟ وما الحل الذي ستجربه في ${P.type === 'week' ? 'الأسبوع' : P.type === 'month' ? 'الشهر' : 'العام'} القادم؟">${esc(note.solutions)}</textarea></label>
      <p class="note-text explain">تُحفظ وحدها. وتظهر حلولك في تقرير ${P.type === 'week' ? 'الأسبوع' : P.type === 'month' ? 'الشهر' : 'العام'} القادم لتقارن بها.</p>
      ${AI.on() ? `<button type="button" class="ai-btn" data-action="rep-ai">${icon('spark')} اكتبها لي بالذكاء الاصطناعي</button>` : ''}
    </section>
  </div>
  <section class="panel rep-export">
    <h2>نسخة كاملة لتحليلها</h2>
    <p class="note-text explain">نسخة نصية كاملة لهذا ${P.word}: كل الجوانب وتفاصيلها، ومقارنة بما قبله، وخلاصاتك السابقة، ومعها طلب جاهز. الصقها في أي برنامج ذكاء اصطناعي، ثم ضع ما يعطيك في الخانتين أعلاه.</p>
    <label class="switch"><input type="checkbox" id="repJournal"${repUi.journal ? ' checked' : ''}><span>أضف نصوص يومياتي (خاصة، اخترها إن أردت تحليلاً أعمق)</span></label>
    <div class="btn-row"><button type="button" class="primary" data-action="rep-copy">${icon('sheet')} انسخ النسخة الكاملة</button><button type="button" class="ghost" data-action="rep-file">نزّلها ملفاً</button></div>
  </section>
  <div class="btn-row report-actions">
    <button type="button" class="ghost" data-action="rep-image">${icon('sheet')} مشاركة كصورة</button>
  </div>`;
}

// ---------- the full copy for an outside AI ----------
function reportExport(P) {
  const S1 = awareStats(P), prevP = periodOf(P.type, P.prev), S0 = awareStats(prevP);
  const st = periodStats(P);
  const note = reportNote(P.id), prevNote = reportNote(prevP.id);
  const next = { week: 'الأسبوع القادم', month: 'الشهر القادم', year: 'العام القادم' }[P.type];
  const L = [];
  L.push(`# تقرير ${{ week: 'أسبوعي', month: 'شهري', year: 'سنوي' }[P.type]} من تطبيق «الوعي الشخصي»`);
  L.push(`الفترة: ${P.title} (${P.sub})${P.current ? '، وهي لم تنتهِ بعد: البيانات حتى اليوم' : ''}`);
  L.push(`من ${P.start} إلى ${P.last} (${plural(P.days.length, 'يوم واحد', 'يومان', 'أيام', 'يوماً')})`);
  L.push('');
  L.push('## المطلوب منك');
  L.push(`أنت مستشار شخصي حكيم. هذه بيانات نشاطي الفعلي في كل جوانب حياتي التي أتابعها. اقرأها بدقة ثم اكتب بالعربية، بإيجاز ودون مبالغة، تحت عنوانين بالضبط:`);
  L.push(`«الخلاصة»: خمسة أسطر على الأكثر عن ${P.word}: ما تحسّن وما تراجع مقارنة بالفترة السابقة، بأرقام محددة.`);
  L.push(`«العوائق وحلولها»: أبرز ثلاثة عوائق تظهر من البيانات، وسبباً محتملاً لكل منها، وحلاً عملياً صغيراً أبدأ به في ${next}${prevNote && prevNote.solutions.trim() ? '، مع تقييم: هل نفعت حلول الفترة السابقة المذكورة أدناه؟' : ''}.`);
  L.push('لا تخترع شيئاً غير موجود في البيانات. النسبة هي التقدّم: ما أُنجز من كل المطلوب في الفترة كاملة (كل مرة مطلوبة حصة متساوية)، فإن لم تنتهِ الفترة فالباقي لم يفُت بعد. الجانب بلا نسبة معناه أنه لا يوجد فيه ما يُعدّ، لا أنه صفر.');
  if (P.current) L.push(`مضى ${P.days.length} من ${P.all.length} يوماً من هذه الفترة.`);
  L.push('');
  L.push(`## مؤشر التقدم الشامل: ${S1.overall != null ? `${S1.overall}٪` : 'غير متاح'}${S0.overall != null ? ` (الفترة السابقة ${S0.overall}٪)` : ''}`);
  L.push(`أرقام عامة: ${st.tasks} مهمة منجزة، ${st.goalDays} مرة التزام بهدف، ${st.habitDays} مرة أداء عادة، ${st.readings} جلسة قراءة، ${st.steps} خطوة، تركيز ${Math.round(st.focusMs / 60000)} دقيقة، ${st.activeDays} يوماً نشطاً من ${P.days.length}، ${st.pages} صفحة، ${st.books} كتاب أُنهي، ${st.benefits} فائدة.`);
  L.push('');
  L.push('## الجوانب');
  for (const a of S1.aspects) {
    const before = (S0.aspects.find((x) => x.key === a.key) || {}).score;
    L.push(`### ${a.title}: ${a.score != null ? `${a.score}٪` : 'بلا درجة'}${before != null ? ` (السابقة ${before}٪)` : ''}`);
    for (const f of a.facts) L.push(`- ${f}`);
    for (const d of a.detail) if (!a.facts.some((f) => d.startsWith(f))) L.push(`- ${d}`);
  }
  if (st.projects.length) { L.push(''); L.push('## المشاريع'); for (const p of st.projects) L.push(`- ${p.name}: ${p.progress}٪ مكتمل، أُنجز منه ${p.doneIn} في هذه الفترة`); }
  const prioWeeks = S.weeks.filter((w) => w.id >= addDays(P.start, -6) && w.id <= P.last && w.focus.some(Boolean));
  if (prioWeeks.length) { L.push(''); L.push('## أولوياتي التي حددتها'); for (const w of prioWeeks) L.push(`- أسبوع ${w.id}: ${w.focus.filter(Boolean).join('، ')}`); }
  if (prevNote && (prevNote.summary.trim() || prevNote.solutions.trim())) {
    L.push(''); L.push(`## ما كتبته عن الفترة السابقة (${prevP.title})`);
    if (prevNote.summary.trim()) L.push(`الخلاصة: ${prevNote.summary.trim()}`);
    if (prevNote.solutions.trim()) L.push(`العوائق والحلول التي اتفقت عليها: ${prevNote.solutions.trim()}`);
  }
  if (note && (note.summary.trim() || note.solutions.trim())) {
    L.push(''); L.push('## ملاحظاتي على هذه الفترة حتى الآن');
    if (note.summary.trim()) L.push(note.summary.trim());
    if (note.solutions.trim()) L.push(note.solutions.trim());
  }
  if (repUi.journal) {
    const js = S.journal.filter((j) => j.date >= P.start && j.date <= P.last && !jEmpty(j)).sort((a, b) => a.date.localeCompare(b.date));
    if (js.length) { L.push(''); L.push('## يومياتي'); for (const j of js) L.push(`- ${j.date}${j.mood ? ` (${MOODS[j.mood - 1][1] || ''})` : ''}: ${jText(j).replace(/\s+/g, ' ').trim()}`); }
  }
  return L.join('\n');
}

async function reportAI(btn) {
  const P = periodOf(repUi.type, repUi.key);
  const out = await withAI(btn, 'جارٍ الكتابة…', () => AI.ask({
    system: SYSTEM_AR, effort: 'medium', maxTokens: 4000,
    prompt: `${reportExport(P)}\n\nReturn the two sections as JSON fields in Arabic, plain text with line breaks; solutions as lines starting with "• ".`,
    schema: { type: 'object', additionalProperties: false, required: ['summary', 'solutions'], properties: { summary: { type: 'string' }, solutions: { type: 'string' } } },
  }));
  if (!out) return;
  const r = reportNote(P.id) || (S.reports.push(normalizeReport({ id: P.id })), reportNote(P.id));
  Object.assign(r, { summary: out.summary, solutions: out.solutions, updated: Date.now() });
  save(); render();
}

// ---------- shareable image ----------
async function reportImage() {
  const P = periodOf(repUi.type, repUi.key);
  const st = periodStats(P);
  const { aspects, overall } = awareStats(P);
  try { await Promise.all([document.fonts.load('700 60px "Aref Ruqaa"'), document.fonts.load('400 36px "Amiri"'), document.fonts.load('700 36px "Amiri"')]); } catch {}
  const W = 1080, H = 1350, Pd = 72;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0f766e';
  const D = (s) => digitsOut(String(s));
  x.direction = 'rtl';
  x.fillStyle = '#f6f8f7'; x.fillRect(0, 0, W, H);
  x.fillStyle = accent; x.fillRect(0, 0, W, 300);
  x.textAlign = 'right'; x.fillStyle = '#ffffff';
  x.font = '700 64px "Aref Ruqaa", "Amiri", serif'; x.fillText(D(`تقرير ${P.title}`), W - Pd, 140);
  x.font = '400 36px "Amiri", serif'; x.fillText(D(P.sub), W - Pd, 205);
  x.font = '400 30px "Amiri", serif'; x.globalAlpha = 0.85; x.fillText(S.settings.name ? `${S.settings.name} | الوعي الشخصي` : 'الوعي الشخصي', W - Pd, 260); x.globalAlpha = 1;
  // a lone «٠» in a big font looks like a dot, so zero is written as a word
  const tiles = [[st.tasks, 'مهمة منجزة'], [st.goalDays, 'التزام بهدف'], [overall != null ? `${overall}%` : '—', 'التقدم الشامل'], [st.habitDays, 'أداء عادة'], [st.pages, 'صفحة'], [st.focusMs ? fmtDur(st.focusMs) : 0, 'تركيز']].map(([v, l]) => [v === 0 ? 'صفر' : v, l]);
  const cols = 3, gw = (W - Pd * 2 - 40) / cols, gh = 170;
  tiles.forEach(([v, l], i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const bx = W - Pd - (col + 1) * gw - col * 20, by = 350 + row * (gh + 24);
    x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect ? x.roundRect(bx, by, gw, gh, 24) : x.rect(bx, by, gw, gh); x.fill();
    x.fillStyle = '#16211e'; x.textAlign = 'center'; x.font = '700 60px "Amiri", serif'; x.fillText(D(v), bx + gw / 2, by + 92);
    x.fillStyle = '#5b6a66'; x.font = '400 30px "Amiri", serif'; x.fillText(D(l), bx + gw / 2, by + 140);
  });
  x.textAlign = 'right';
  let y = 790;
  for (const a of aspects.filter((z) => z.score != null).slice(0, 8)) {
    x.fillStyle = '#16211e'; x.font = '700 34px "Amiri", serif'; x.fillText(D(a.title), W - Pd, y);
    const bw = 360, bx = Pd + 90;
    x.fillStyle = '#dde5e2'; x.fillRect(bx, y - 22, bw, 18);
    x.fillStyle = accent; x.fillRect(bx + bw - (bw * a.score) / 100, y - 22, (bw * a.score) / 100, 18);
    x.fillStyle = '#5b6a66'; x.font = '400 30px "Amiri", serif'; x.textAlign = 'left'; x.fillText(D(`${a.score}%`), Pd, y); x.textAlign = 'right';
    y += 62;
  }
  x.fillStyle = '#5b6a66'; x.font = '400 26px "Amiri", serif'; x.textAlign = 'center';
  x.fillText(D(`أُنشئ في ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`), W / 2, H - 50);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], `mahami-report-${P.type}-${P.key}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `تقرير ${P.title}` }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  downloadBlob(blob, file.name);
  toast('حُفظت صورة التقرير في التنزيلات');
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action^="rep-"]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'rep-type') { repUi.type = b.dataset.v; repUi.key = ''; render(); }
  if (a === 'rep-move') { const P = periodOf(repUi.type, b.dataset.v); if (!P.future) { repUi.key = P.key; render(); } }
  if (a === 'rep-ai') reportAI(b);
  if (a === 'rep-image') reportImage();
  if (a === 'rep-copy') {
    const text = reportExport(periodOf(repUi.type, repUi.key));
    try { await navigator.clipboard.writeText(text); toast('نُسخت. الصقها في برنامج الذكاء الاصطناعي'); }
    catch { downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `mahami-report-${repUi.type}-${repUi.key}.txt`); toast('لم يسمح الجوال بالنسخ، فنُزّلت ملفاً'); }
  }
  if (a === 'rep-file') {
    const text = reportExport(periodOf(repUi.type, repUi.key));
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `mahami-report-${repUi.type}-${repUi.key}.txt`);
    toast('نُزّلت في التنزيلات');
  }
});
// notes save as you type; the journal choice is remembered
document.addEventListener('input', (e) => {
  const k = e.target.dataset && e.target.dataset.rep;
  if (!k) return;
  const P = periodOf(repUi.type, repUi.key);
  let r = reportNote(P.id);
  if (!r) { r = normalizeReport({ id: P.id }); S.reports.push(r); }
  r[k] = e.target.value; r.updated = Date.now();
  clearTimeout(repUi.t); repUi.t = setTimeout(save, 500);
});
document.addEventListener('change', (e) => { if (e.target.id === 'repJournal') repUi.journal = e.target.checked; });

Object.assign(LibraryViews, { report: viewReport });
