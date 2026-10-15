'use strict';
// AI features powered by Claude, called from the browser with the user's own API key.
// Uses the official Anthropic SDK (bundled in vendor/) with structured JSON outputs.

const AI_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 (الأذكى، الافتراضي)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (أسرع وأرخص)'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 (الأسرع والأرخص)'],
];
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']); // support server-side refusal fallbacks

const AI = (() => {
  const KEY = 'mahami-ai';
  let cfg = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
  let sdk = null;
  let client = null;
  let clientKey = '';

  async function getClient() {
    if (!cfg.key) throw Object.assign(new Error('nokey'), { code: 'nokey' });
    if (!sdk) sdk = await import('./vendor/anthropic-sdk.mjs');
    if (!client || clientKey !== cfg.key) {
      client = new sdk.Anthropic({ apiKey: cfg.key, dangerouslyAllowBrowser: true, maxRetries: 2 });
      clientKey = cfg.key;
    }
    return client;
  }

  function friendly(e) {
    if (e && e.code === 'nokey') return 'أضف مفتاح Claude من الإعدادات أولاً.';
    if (e && e.code === 'refusal') return 'اعتذر الذكاء الاصطناعي عن هذا الطلب. جرّب صياغة أخرى.';
    if (e && e.code === 'truncated') return 'كان الرد أطول من المسموح. جرّب طلباً أقصر.';
    if (e && e.code === 'parse') return 'وصل رد غير مفهوم. حاول مرة أخرى.';
    const A = sdk && sdk.Anthropic;
    if (A) {
      if (A.AuthenticationError && e instanceof A.AuthenticationError) return 'مفتاح Claude غير صحيح. تحقق منه في الإعدادات.';
      if (A.PermissionDeniedError && e instanceof A.PermissionDeniedError) return 'المفتاح لا يملك صلاحية لهذا النموذج.';
      if (A.RateLimitError && e instanceof A.RateLimitError) return 'طلبات كثيرة في وقت قصير. انتظر دقيقة وحاول مجدداً.';
      if (A.BadRequestError && e instanceof A.BadRequestError) return 'رفض الخادم الطلب. تأكد من وجود رصيد في حسابك على Anthropic.';
      if (A.APIConnectionError && e instanceof A.APIConnectionError) return 'تعذّر الاتصال. تحقق من الإنترنت.';
      if (A.InternalServerError && e instanceof A.InternalServerError) return 'خدمة Claude مشغولة الآن. حاول بعد قليل.';
    }
    return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  }

  // one request; returns parsed JSON when a schema is given, else text
  async function ask({ system, prompt, schema, effort = 'medium', maxTokens = 16000 }) {
    const c = await getClient();
    const model = cfg.model || AI_MODELS[0][0];
    const params = {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
    };
    const res = FALLBACK_MODELS.has(model)
      ? await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await c.messages.create(params);
    if (res.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { code: 'refusal' });
    if (res.stop_reason === 'max_tokens') throw Object.assign(new Error('truncated'), { code: 'truncated' });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!schema) return text;
    try { return JSON.parse(text); } catch { throw Object.assign(new Error('parse'), { code: 'parse' }); }
  }

  return {
    on: () => !!cfg.key,
    cfg: () => cfg,
    setKey(k) { cfg.key = k.trim(); store(); client = null; },
    setModel(m) { cfg.model = m; store(); },
    clear() { cfg = {}; store(); client = null; },
    ask,
    friendly,
  };
})();

// ---------- shared context for prompts ----------
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function aiContext() {
  const t0 = today();
  return [
    `Today is ${t0} (${AR_DAYS[parse(t0).getDay()]}), Hijri ${fmtHijri(t0)}. Weekday numbers: 0=Sunday … 6=Saturday. The user's week starts on Sunday; work days are Sunday–Thursday.`,
    S.settings.prayer ? `The user's prayer times are known (city: ${S.settings.prayer.label || S.settings.prayer.city}), so times relative to a prayer are allowed.` : 'Prayer times are not set up; prefer clock times.',
    S.projects.length ? `Existing projects: ${S.projects.map((p) => p.name).join('، ')}.` : 'No projects yet.',
    categories().length ? `Existing categories: ${categories().join('، ')}.` : '',
  ].filter(Boolean).join('\n');
}

const SYSTEM_AR = 'You are the built-in assistant of «الوعي الشخصي», an Arabic personal productivity app. Always write user-facing text in clear Modern Standard Arabic (short, practical, no filler). Respect Islamic context naturally when relevant.';

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const PRAYER_NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

// ---------- busy indicator ----------
async function withAI(btn, label, fn) {
  if (!AI.on()) { toast('أضف مفتاح Claude من الإعدادات ← الذكاء الاصطناعي.'); return null; }
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${label}`; }
  try { return await fn(); }
  catch (e) { toast(AI.friendly(e)); return null; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}
const aiBtn = (action, label, extra = '') => (AI.on() ? `<button type="button" class="ai-btn" data-action="${action}"${extra}>${icon('spark')}${label}</button>` : '');

// ---------- 1) smart add: a sentence or a paragraph → tasks and goals ----------
const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'title', 'date', 'time', 'prayer', 'repeat_days', 'until', 'target', 'unit', 'priority', 'category', 'project', 'reminders_before_minutes', 'steps'],
  properties: {
    kind: { type: 'string', enum: ['task', 'goal'], description: 'goal = recurring habit or a one-time target; task = something to do once' },
    title: { type: 'string', description: 'short Arabic title without dates or times' },
    date: nullable({ type: 'string', description: 'YYYY-MM-DD: due date (task), deadline (one-time goal) or start date (recurring goal)' }),
    time: nullable({ type: 'string', description: 'HH:MM 24-hour clock time' }),
    prayer: nullable({ type: 'object', additionalProperties: false, required: ['name', 'offset_minutes'], properties: { name: { type: 'string', enum: PRAYER_NAMES }, offset_minutes: { type: 'integer', description: 'negative = before the prayer, positive = after' } } }),
    repeat_days: nullable({ type: 'array', items: { type: 'integer' }, description: 'weekday numbers for recurring goals, null if not recurring' }),
    until: nullable({ type: 'string', description: 'YYYY-MM-DD end date of a recurring goal' }),
    target: { type: 'integer', description: 'count per day/goal, 1 if not counted' },
    unit: { type: 'string', description: 'unit of the count, empty if none' },
    priority: { type: 'string', enum: ['high', 'mid', 'low'] },
    category: { type: 'string', description: 'short category or empty' },
    project: nullable({ type: 'string', description: 'existing or new project name, null for none' }),
    reminders_before_minutes: { type: 'array', items: { type: 'integer' }, description: 'extra reminders before the time, e.g. [15]' },
    steps: { type: 'array', items: { type: 'string' }, description: 'sub-steps for a task, empty for goals' },
  },
};

async function aiSmartPlan(text) {
  return AI.ask({
    system: SYSTEM_AR,
    effort: 'low',
    prompt: `${aiContext()}\n\nTurn what the user wrote into tasks and goals for the app. Split separate actions into separate items. Only add steps when the user lists them or the task clearly needs 2–6 steps. Do not invent dates or times the user did not imply.\n\nUser wrote:\n«${text}»`,
    schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: ITEM_SCHEMA } } },
  });
}

function itemToTask(it) {
  const t0 = today();
  let projectId = '';
  if (it.kind === 'task' && it.project) {
    const p = S.projects.find((x) => x.name === it.project);
    projectId = p ? p.id : `new:${it.project}`;
  }
  const t = normalize({
    id: uid(), kind: it.kind, title: it.title, priority: it.priority, category: it.category || '',
    projectId,
    time: it.prayer ? '' : (it.time || ''),
    prayer: it.prayer ? { name: it.prayer.name, offset: it.prayer.offset_minutes } : null,
    created: Date.now(),
    subtasks: (it.steps || []).map((s) => ({ id: uid(), text: s, done: false })),
  });
  t.alarms = hasTime(t) ? [...new Set([0, ...(it.reminders_before_minutes || []).filter((n) => n > 0)])].sort((a, b) => a - b) : [];
  if (it.kind === 'goal' && it.repeat_days && it.repeat_days.length) {
    t.repeat = { days: [...new Set(it.repeat_days.filter((d) => d >= 0 && d <= 6))].sort(), start: it.date || t0, until: it.until || null };
  } else {
    t.due = it.date || '';
  }
  t.target = Math.max(1, it.target || 1);
  t.unit = t.target > 1 ? it.unit || '' : '';
  if (t.kind === 'task') { t.target = 1; t.unit = ''; }
  return t;
}

// ---------- preview dialog for AI results ----------
let aiPending = null; // { items: [task], onAdd }
function openAIPreview(title, intro, tasks) {
  aiPending = { tasks };
  const d = $('aiSheet');
  $('aiTitle').textContent = title;
  $('aiIntro').textContent = intro;
  $('aiList').innerHTML = tasks.map((t, i) => {
    const pName = t.projectId.startsWith('new:') ? `${t.projectId.slice(4)} (مشروع جديد)` : (projectOf(t) || {}).name;
    const bits = [isGoal(t) ? (isRepeat(t) ? `هدف متكرر · ${repeatLabel(t)}` : 'هدف') : 'مهمة'];
    if (pName) bits.push(`المشروع: ${pName}`);
    if (!isRepeat(t) && t.due) bits.push(relDateH(t.due));
    if (hasTime(t)) bits.push(timeLabel(t, t.due || (t.repeat && t.repeat.start) || today()));
    if (t.target > 1) bits.push(`${t.target} ${t.unit}`);
    if (t.priority !== 'mid') bits.push(`أولوية ${PRI_LABEL[t.priority]}`);
    return `<li><label class="ai-item"><input type="checkbox" data-i="${i}" checked>
      <span><b>${esc(t.title)}</b><small>${esc(bits.join(' · '))}</small>
      ${t.subtasks.length ? `<ul class="ai-steps">${t.subtasks.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ul>` : ''}</span></label></li>`;
  }).join('');
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function closeAIPreview() {
  const d = $('aiSheet');
  if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
  aiPending = null;
}
function addAIPreview() {
  if (!aiPending) return;
  const chosen = [...$('aiList').querySelectorAll('input[type=checkbox]')].filter((c) => c.checked).map((c) => aiPending.tasks[Number(c.dataset.i)]);
  const made = new Map();
  for (const t of chosen) {
    if (t.projectId.startsWith('new:')) {
      const name = t.projectId.slice(4);
      if (!made.has(name)) {
        const used = new Set(S.projects.map((x) => x.color));
        const p = normalizeProject({ name, color: (PROJECT_COLORS.find(([c]) => !used.has(c)) || PROJECT_COLORS[0])[0] });
        S.projects.push(p);
        made.set(name, p.id);
      }
      t.projectId = made.get(name);
    }
    S.tasks.push(t);
  }
  save();
  closeAIPreview();
  render();
  if (chosen.some((t) => t.alarms.length)) ensureNotifPermission();
  toast(chosen.length ? `أُضيف ${chosen.length} ${chosen.length === 1 ? 'عنصر' : 'عناصر'}` : 'لم تختر شيئاً');
}

// ---------- 2) suggest steps for a task ----------
async function aiSuggestSteps(btn) {
  const title = $('fTitle').value.trim();
  if (!title) { toast('اكتب عنوان المهمة أولاً.'); return; }
  const res = await withAI(btn, 'جارٍ التفكير…', () => AI.ask({
    system: SYSTEM_AR,
    effort: 'low',
    prompt: `${aiContext()}\n\nSuggest 3 to 7 concrete, ordered steps to complete this task. Each step is a short Arabic action phrase.\nTask: «${title}»${$('fCategory').value ? `\nCategory: ${$('fCategory').value}` : ''}${draft.subtasks.length ? `\nSteps the user already has (do not repeat): ${draft.subtasks.map((s) => s.text).join('؛ ')}` : ''}`,
    schema: { type: 'object', additionalProperties: false, required: ['steps'], properties: { steps: { type: 'array', items: { type: 'string' } } } },
  }));
  if (!res || !draft) return;
  for (const s of res.steps) draft.subtasks.push({ id: uid(), text: s, done: false, doneAt: null });
  persistDraftList('subtasks');
  renderSubs();
  toast(`أُضيفت ${res.steps.length} خطوات. احذف ما لا يناسبك.`);
}

// ---------- 3) plan a whole project ----------
async function aiPlanProject(btn, pid) {
  const p = getProject(pid);
  if (!p) return;
  const existing = tasksOf(pid).map((t) => t.title);
  const res = await withAI(btn, 'جارٍ التخطيط…', () => AI.ask({
    system: SYSTEM_AR,
    effort: 'medium',
    prompt: `${aiContext()}\n\nPlan the project below as 4–10 tasks in a sensible order, each with 2–6 short steps. Spread due dates realistically between today and the project's end date when there is one (otherwise over the next weeks), skipping Fridays for work tasks. Do not repeat existing tasks.\nProject: «${p.name}»${p.desc ? `\nDescription: ${p.desc}` : ''}${p.due ? `\nEnds: ${p.due}` : ''}${existing.length ? `\nExisting tasks: ${existing.join('؛ ')}` : ''}`,
    schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: ITEM_SCHEMA } } },
  }));
  if (!res) return;
  const tasks = res.items.map((it) => itemToTask({ ...it, kind: 'task', project: p.name }));
  openAIPreview(`خطة «${p.name}»`, 'اختر المهام التي تريد إضافتها للمشروع. يمكنك تعديل أي مهمة بعد إضافتها.', tasks);
}

// ---------- 4) benefit → action ----------
function benefitToAction(fid, suggestion) {
  const f = getBenefit(fid);
  if (!f) return;
  const note = `من فائدة «${f.title}» — ${benefitBookTitle(f)}${f.page !== '' ? ` ص ${f.page}` : ''}${f.lesson ? `:\n${f.lesson}` : ''}`;
  const base = suggestion ? itemToTask(suggestion) : normalize({ id: uid(), kind: 'task', title: f.title, created: Date.now() });
  base.notes = [{ id: uid(), text: note, at: Date.now() }];
  if (base.projectId.startsWith('new:')) base.projectId = '';
  closeLib();
  openSheet(null, { prefill: base, fromBenefit: fid });
}
async function aiBenefitAction(btn, fid) {
  const f = getBenefit(fid);
  if (!f) return;
  const res = await withAI(btn, 'جارٍ التفكير…', () => AI.ask({
    system: SYSTEM_AR,
    effort: 'low',
    prompt: `${aiContext()}\n\nThe user recorded this lesson from a book. Turn it into ONE small, concrete action they can start this week: either a recurring goal (a habit, with weekdays) or a one-time task. Keep the title short and practical; no project.\nBook: ${benefitBookTitle(f)}\nLesson title: ${f.title}\nWhat to learn from it: ${f.lesson}`,
    schema: ITEM_SCHEMA,
  }));
  if (res) benefitToAction(fid, { ...res, project: null });
}

// ---------- 5) notes: summarise / improve / fix ----------
async function aiNoteTool(btn, mode) {
  const sel = getSelection();
  const body = $('meBody');
  const hasSel = sel && sel.rangeCount && !sel.isCollapsed && body.contains(sel.anchorNode);
  const text = hasSel ? sel.toString() : noteText(body.innerHTML);
  if (!text.trim()) { toast('اكتب شيئاً في الملاحظة أولاً.'); return; }
  const range = hasSel ? sel.getRangeAt(0).cloneRange() : null;
  const task = {
    summary: 'Summarise the text in 3–6 short bullet points in Arabic. Return only the bullets, one per line, each starting with "• ".',
    improve: 'Rewrite the text in clearer, well-structured Arabic, keeping the meaning, tone and length. Return only the rewritten text.',
    fix: 'Correct spelling, grammar and punctuation in the Arabic text without changing its wording otherwise. Return only the corrected text.',
  }[mode];
  const out = await withAI(btn, '', () => AI.ask({ system: SYSTEM_AR, effort: 'low', prompt: `${task}\n\nText:\n${text}` }));
  if (!out) return;
  body.focus();
  const html = plainToNoteHTML(out);
  if (mode === 'summary') {
    const r = document.createRange();
    r.selectNodeContents(body);
    r.collapse(false);
    sel.removeAllRanges(); sel.addRange(r);
    document.execCommand('insertHTML', false, `<blockquote><b>الخلاصة</b><br>${html}</blockquote><p><br></p>`);
  } else {
    if (range) { sel.removeAllRanges(); sel.addRange(range); }
    else { const r = document.createRange(); r.selectNodeContents(body); sel.removeAllRanges(); sel.addRange(r); }
    document.execCommand('insertHTML', false, html);
  }
  scheduleMemoSave();
  toast(mode === 'summary' ? 'أُضيفت الخلاصة في آخر الملاحظة' : 'تم. يمكنك التراجع بزر ↶ إن لم يعجبك');
}

// ---------- settings ----------
function aiSettingsHTML() {
  const c = AI.cfg();
  return `<section class="panel">
    <h2>الذكاء الاصطناعي</h2>
    <p class="note-text explain">يضيف مساعداً ذكياً (Claude) يفهم كلامك ويحوّله إلى مهام، ويقترح خطوات المهام، ويخطط المشاريع، ويحوّل الفوائد إلى أعمال، ويلخّص الملاحظات، ويكتب خلاصة تقريرك الشهري.</p>
    ${c.key ? `
      <p class="note-text status-ok">مفعّل</p>
      <label class="field"><span>النموذج</span><select id="aiModel">${AI_MODELS.map(([v, l]) => `<option value="${v}"${(c.model || AI_MODELS[0][0]) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="btn-row"><button type="button" class="ghost" data-action="ai-test">تجربة الاتصال</button><button type="button" class="danger" data-action="ai-remove">إزالة المفتاح</button></div>`
    : `
      <details class="howto"><summary>كيف أحصل على مفتاح؟</summary>
        <ol>
          <li>افتح <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">صفحة مفاتيح Claude</a> وأنشئ حساباً أو سجّل الدخول.</li>
          <li>من <b>Billing</b> أضف رصيداً (يكفي مبلغ صغير، فالاستخدام الشخصي قليل التكلفة).</li>
          <li>من <b>API Keys</b> اضغط <b>Create Key</b>، ثم انسخ المفتاح الذي يبدأ بـ <code>sk-ant-</code>.</li>
        </ol>
      </details>
      <label class="field"><span>مفتاح Claude</span><input type="password" id="aiKey" autocomplete="off" placeholder="sk-ant-…" dir="ltr"></label>
      <div class="btn-row"><button type="button" class="primary" data-action="ai-save">حفظ وتفعيل</button></div>`}
    <p class="note-text explain">المفتاح يُحفظ على هذا الجهاز فقط، ولا يدخل في المزامنة أو النسخة الاحتياطية. كل طلب يُحسب من رصيدك في Anthropic.</p>
  </section>`;
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action^="ai-"]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'ai-save') {
    const k = ($('aiKey') || {}).value || '';
    if (!/^sk-ant-/.test(k.trim())) { toast('الصق المفتاح الذي يبدأ بـ sk-ant-'); return; }
    AI.setKey(k);
    render();
    const ok = await withAI(null, '', () => AI.ask({ system: SYSTEM_AR, effort: 'low', maxTokens: 200, prompt: 'Reply with one short Arabic greeting sentence for the user of a productivity app.' }));
    if (ok) toast(`✨ ${ok}`);
  }
  if (a === 'ai-remove') { AI.clear(); render(); toast('أُزيل المفتاح'); }
  if (a === 'ai-test') {
    const r = await withAI(b, 'جارٍ الاتصال…', () => AI.ask({ system: SYSTEM_AR, effort: 'low', maxTokens: 200, prompt: 'Reply with: «الاتصال يعمل» and one short motivating sentence.' }));
    if (r) toast(r);
  }
  if (a === 'ai-smart') {
    const text = (ui.smart || '').trim();
    if (!text) { toast('اكتب ما تريد في المربع، جملة أو فقرة كاملة.'); $('smartIn')?.focus(); return; }
    const res = await withAI(b, 'جارٍ الفهم…', () => aiSmartPlan(text));
    if (!res) return;
    if (!res.items.length) { toast('لم أجد مهاماً في النص. جرّب صياغة أوضح.'); return; }
    ui.smart = '';
    openAIPreview('ما فهمته من كلامك', 'راجع العناصر واختر ما تريد إضافته.', res.items.map(itemToTask));
  }
  if (a === 'ai-steps') aiSuggestSteps(b);
  if (a === 'ai-plan') aiPlanProject(b, b.dataset.v);
  if (a === 'ai-benefit') aiBenefitAction(b, b.dataset.v);
  if (a === 'ai-note') aiNoteTool(b, b.dataset.v);
  if (a === 'ai-add') addAIPreview();
  if (a === 'ai-close') closeAIPreview();
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'aiModel') { AI.setModel(e.target.value); toast('تغيّر النموذج'); }
});
