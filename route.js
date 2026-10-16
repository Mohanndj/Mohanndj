'use strict';
// Two helpers on «اليوم»:
// 1) «أضف بسرعة بكلامك» for everything (an option in the settings; the other entry points stay):
//    «دفعت ١٥٠ بنزين» → a payment, added to its item in this month's plan when the name matches;
//    «اشتر حليب وخبز» → the house list (or «… لقائمة السفر»); «فكرة: …» → the ideas page;
//    anything else stays a task as before.
// 2) «إغلاق اليوم»: in the evening, one short card to review the day (see below).

const enDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');
const smartAll = () => S.settings.smartMode === 'all';

function routeSmart(text) {
  const t = enDigits(text).trim();
  let m;
  // payments: «دفعت ١٥٠ بنزين» or «دفعت للبنزين ١٥٠»
  if ((m = /^(?:دفعت|صرفت|سددت|سدّدت)\s+([\d.,]+)\s*(?:ريال|ر\.?س\.?)?\s*(?:(?:على|في|ثمن|حق|لـ)\s+)?(.*)$/.exec(t)) || (m = /^(?:دفعت|صرفت|سددت|سدّدت)\s+(?:(?:على|في|ثمن|حق|لـ)\s+)?(.+?)\s+([\d.,]+)\s*(?:ريال|ر\.?س\.?)?$/.exec(t))) {
    const numFirst = /^[\d.,]+$/.test(m[1]);
    const amount = num(numFirst ? m[1] : m[2]);
    const what = String(numFirst ? m[2] : m[1]).replace(/^ال(?=ال)/, '').replace(/^لل(?=\S)/, 'ال').trim(); // «للبنزين» → «البنزين»; a word starting with ل stays whole
    if (!amount) return null;
    const p = currentPlan();
    if (p) syncPlanLinks(p);
    const nm = normName(what);
    const hit = (y) => y.x.name && (normName(y.x.name) === nm || normName(y.x.name).includes(nm) || nm.includes(normName(y.x.name)));
    const r = p && nm.length >= 2 ? spendRowsOf(p).find(hit) || planRows(p).find(hit) : null;
    return { type: 'spend', amount, what, row: r ? r.x : null };
  }
  // shopping: «اشتر حليب وخبز» (optionally «… لقائمة السفر»)
  if ((m = /^(?:اشتر|اشترِ|اشتري|أشتري|شراء|ناقص|نحتاج|ينقصنا)\s+(.+)$/.exec(t))) {
    let rest = m[1];
    let list = getList('home') || S.lists[0];
    const lm = /\s+(?:في|إلى|الى|ل)\s*(?:قائمة|القائمة)\s+(.+)$/.exec(rest) || /\s+لقائمة\s+(.+)$/.exec(rest);
    if (lm) { const want = normName(lm[1]); const hit = S.lists.find((l) => normName(l.name).includes(want) || want.includes(normName(l.name))); if (hit) list = hit; rest = rest.slice(0, lm.index); }
    const names = rest.split(/\s*[،,]\s*|\s+و(?=\S)(?!(?:رق|سادة|سائد|جبة|جبات|رد|ورد|قود|شاح|عاء|لاعة|افل|ايت|صلة)(?:\s|$))/).map((x) => x.trim()).filter(Boolean);
    return names.length && list ? { type: 'shop', names, list } : null;
  }
  // ideas: «فكرة: …»
  if ((m = /^فكرة\s*[:：\-–]?\s*(.+)$/.exec(t))) return { type: 'idea', text: text.trim().replace(/^فكرة\s*[:：\-–]?\s*/, '') };
  return null;
}
function routePreviewHTML(q) {
  const tag = (s, cls = '') => `<span class="tag ${cls}">${s}</span>`;
  const tags = q.type === 'spend' ? [tag('💳 مصروف', 'title'), tag(money(q.amount)), tag(esc(q.what || 'بلا وصف')), q.row ? tag(`🔗 بند «${esc(q.row.name)}»${(() => { const rm = rowRemain(currentPlan(), q.row.id, q.amount); return rm ? ` | ${remainAfter(rm)}` : ''; })()}`, (rowRemain(currentPlan(), q.row.id, q.amount) || {}).left < -0.5 ? 'warn' : '') : tag(currentPlan() ? 'لم يُربط ببند في الخطة' : 'لا خطة لهذا الشهر', 'warn')]
    : q.type === 'shop' ? [tag(`${q.list.icon} ${esc(q.list.name)}`, 'title'), ...q.names.map((n) => tag(esc(n)))]
      : [tag('💡 فكرة', 'title'), tag(esc(excerpt(q.text, 50)))];
  return `<div class="parsed">${tags.join('')}</div>`;
}
function runRoute(q) {
  if (q.type === 'spend') {
    const t = normalizeTx({ amount: q.amount, kind: 'out', item: q.what, d: today() });
    S.finTx.push(t);
    if (q.row) assignTx(t, q.row.id, currentPlan());
    save();
    const rm = q.row && rowRemain(currentPlan(), q.row.id);
    return `سُجّل ${money(q.amount)}${q.row ? ` في بند «${q.row.name}»` : ''}${rm ? `: ${rm.text}` : ''}`;
  }
  if (q.type === 'shop') { const n = addToShop(q.names, q.list.id); return n ? `أُضيف إلى «${q.list.name}»: ${q.names.join('، ')}` : 'موجود في القائمة'; }
  S.ideas.push(normalizeIdea({ text: q.text, created: Date.now() }));
  save();
  return 'حُفظت الفكرة في «الأفكار»';
}

function smartSettingsHTML() {
  const mode = S.settings.smartMode === 'all' ? 'all' : 'tasks';
  const at = S.settings.closeAt ?? 20;
  return `<section class="panel">
    <h2>الإضافة السريعة وإغلاق اليوم</h2>
    <div class="field"><span>خانة «أضف بسرعة بكلامك»</span>
      <div class="seg seg-wrap">${[['tasks', 'للمهام والأهداف فقط'], ['all', 'لكل شيء']].map(([v, l]) => `<button type="button" data-action="set-smart" data-v="${v}" aria-pressed="${mode === v}">${l}</button>`).join('')}</div>
      <small class="hint explain">«لكل شيء»: اكتب «دفعت ١٥٠ بنزين» فيُسجَّل مصروفاً في بنده، و«اشتر حليب وخبز» فيُضاف إلى مشتريات البيت، و«فكرة: …» فتُحفظ في الأفكار. وتبقى بقية خانات الإضافة كما هي.</small>
    </div>
    <label class="switch"><input type="checkbox" id="setPin"${S.settings.pin ? ' checked' : ''}><span>إشعار دائم بما بقي لليوم</span></label>
    <small class="hint explain">إن سحبته ليختفي يعود في المرة القادمة التي تفتح فيها التطبيق.</small>
    <label class="field"><span>بطاقة «إغلاق اليوم» تظهر من الساعة</span>
      <select id="setCloseAt">${[[0, 'لا تُظهرها'], [18, '٦ مساءً'], [19, '٧ مساءً'], [20, '٨ مساءً'], [21, '٩ مساءً'], [22, '١٠ مساءً'], [23, '١١ مساءً']].map(([h, l]) => `<option value="${h}"${at === h ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </label>
  </section>`;
}

// ---------- «إغلاق اليوم» ----------
// One card in the evening, in sections that stay short: what is still open in tasks and goals (each
// with its own choice: done, tomorrow, or set aside; nothing moves by itself), habits being built,
// habits being left, memorisation if today has any, and the journal. A finished section is one line.
const closedDays = () => (Array.isArray(S.settings.closed) ? S.settings.closed : []);
const closeSkips = () => (S.settings.closeSkip && S.settings.closeSkip.d === today() ? S.settings.closeSkip.ids : []);
function closeTodayHTML() {
  const at = S.settings.closeAt ?? 20;
  const t0 = today();
  if (!at || new Date().getHours() < at || closedDays().includes(t0)) return '';
  const skip = closeSkips();
  const btn = (action, id, label, cls = 'ghost sm') => `<button type="button" class="${cls}" data-action="${action}" data-v="${id}">${label}</button>`;
  const row = (title, sub, btns) => `<li class="close-item"><span class="ci-t">${esc(title)}${sub ? ` <small>${esc(sub)}</small>` : ''}</span><span class="ci-b">${btns}</span></li>`;
  // a section with nothing left to answer is one line: ✓ only when everything in it was really done
  const section = (title, doneLine, pending, total, allDone = true) => {
    if (!total) return '';
    if (!pending.length) return `<div class="close-sec${allDone ? ' ok' : ''}"><b>${allDone ? '✓ ' : ''}${title}</b><small>${doneLine}</small></div>`;
    return `<div class="close-sec"><b>${title} <small class="num">باقٍ ${pending.length}</small></b><ul>${pending.join('')}</ul></div>`;
  };
  // tasks and goals (habits have their own section)
  const tasks = S.tasks.filter((t) => !isGoal(t) && !t.done && t.due && t.due <= t0 && !skip.includes(t.id));
  const onceGoals = S.tasks.filter((t) => isGoal(t) && !isRepeat(t) && !t.done && t.due && t.due <= t0 && !skip.includes(t.id));
  const repGoals = S.tasks.filter((t) => isRepeat(t) && !isHabit(t) && !goalEnded(t) && occursOn(t, t0));
  const repOpen = repGoals.filter((t) => !t.completions[t0] && !skip.includes(t.id));
  const tg = [
    ...tasks.map((t) => row(t.title, t.due < t0 ? lateDays(daysBetween(t.due, t0)) : '', btn('close-done', t.id, 'أتممت') + btn('close-tomorrow', t.id, 'للغد') + btn('close-skip', t.id, 'استبعد'))),
    ...onceGoals.map((t) => row(t.title, 'هدف', btn('close-done', t.id, 'أتممت') + btn('close-tomorrow', t.id, 'للغد') + btn('close-skip', t.id, 'استبعد'))),
    ...repOpen.map((t) => row(t.title, isCounted(t) ? `${countOn(t, t0)} من ${t.target}` : 'هدف متكرر', btn('close-done', t.id, 'أتممت') + btn('close-skip', t.id, 'لم أفعله'))),
  ];
  const doneToday = S.tasks.filter((t) => (!isGoal(t) || !isRepeat(t)) && ((t.done && t.doneAt && iso(new Date(t.doneAt)) === t0 && !(t.bookId && Object.keys(t.completions || {}).length)) || (t.bookId && !isRepeat(t) && t.completions && t.completions[t0]))).length + repGoals.filter((t) => t.completions[t0]).length;
  // habits being built
  const habits = S.tasks.filter((t) => isHabit(t) && !goalEnded(t) && occursOn(t, t0));
  const habOpen = habits.filter((t) => !t.completions[t0] && !skip.includes(t.id));
  // «لم أفعلها» only hides the question for today; it is never counted as done
  const habDone = habits.filter((t) => t.completions[t0]);
  const habNot = habits.filter((t) => !t.completions[t0] && skip.includes(t.id));
  const repNot = repGoals.filter((t) => !t.completions[t0] && skip.includes(t.id));
  const setAside = S.tasks.filter((t) => !isRepeat(t) && !t.done && skip.includes(t.id));
  // habits being left: one line each; only a slip asks for anything
  const quits = S.quits.filter((q) => !q.doneAt);
  const slippedToday = (q) => q.slips.some((x) => iso(new Date(x.at)) === t0);
  // memorisation, only on its days
  const plans = S.hplans.filter((p) => planToday(p));
  const hzOpen = plans.filter((p) => !p.log[t0] && (planNext(p).a < planNext(p).total || planPending(p)));
  const reviews = hzDue().length;
  const wrote = S.journal.some((j) => j.date === t0 && !jEmpty(j));
  return todayBlock('إغلاق اليوم', '', `<div class="close-card">
    ${section('المهام والأهداف', [doneToday ? `أنجزت اليوم ${plural(doneToday, 'شيئاً واحداً', 'شيئين', 'أشياء', 'شيئاً')}` : 'لا شيء باقٍ', repNot.length ? `لم تفعل: ${repNot.map((t) => esc(t.title)).join('، ')}` : '', setAside.length ? `استبعدت: ${setAside.map((t) => esc(t.title)).join('، ')}` : ''].filter(Boolean).join(' | '), tg, tg.length + doneToday || 1, !repNot.length && !setAside.length)}
    ${section('بناء العادات', `فعلت ${habDone.length} من ${habits.length}${habNot.length ? ` | لم تفعل: ${habNot.map((t) => esc(t.title)).join('، ')}` : ''}`, habOpen.map((t) => row(t.title, '', btn('close-done', t.id, 'فعلتها') + btn('close-skip', t.id, 'لم أفعلها'))), habits.length, !habNot.length)}
    ${quits.length ? `<div class="close-sec${quits.some(slippedToday) ? '' : ' ok'}"><b>${quits.some(slippedToday) ? '' : '✓ '}عادات أتركها</b><ul class="close-quits">${quits.map((q) => `<li><span>${esc(q.title)}: ${slippedToday(q) ? 'زللت اليوم' : `${daysWord(quitStats(q).days)} بلا زلّة`}</span>${slippedToday(q) ? '' : btn('quit-slip', q.id, 'زللت')}</li>`).join('')}</ul></div>` : ''}
    ${section('الحفظ', 'أتممت مقدار اليوم', [...hzOpen.map((p) => row(p.title, 'مقدار اليوم', btn('hz-plan-go', p.id, 'احفظ الآن', 'ghost sm'))), ...(reviews ? [row(`مراجعة ${plural(reviews, 'نص واحد', 'نصين', 'نصوص', 'نصاً')}`, '', btn('hz-review', '', 'راجع', 'ghost sm'))] : [])], plans.length + reviews)}
    ${section('يومياتي وتأملاتي', 'كتبت يوميتك', wrote ? [] : [row('لم تكتب اليوم', '', btn('j-new', '', 'اكتب الآن', 'ghost sm'))], 1)}
    <button type="button" class="primary close-done-all" data-action="close-day">أغلقت يومي ✓</button>
    <small class="note-text explain">ما لم تختر له شيئاً يبقى كما هو.</small>
  </div>`);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action="set-smart"], [data-action^="close-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'set-smart') { S.settings.smartMode = v; save(); render(); toast(v === 'all' ? 'صارت خانة الإضافة السريعة لكل شيء' : 'صارت للمهام والأهداف فقط'); return; }
  const t0 = today();
  const t = v && getTask(v);
  if (action === 'close-done' && t) {
    if (isCounted(t)) { setCount(t, t0, t.target); save(); render(); } else toggle(t.id, t0);
    return;
  }
  if (action === 'close-tomorrow' && t) { t.due = addDays(t0, 1); save(); render(); toast(`«${t.title}» للغد`); return; }
  if (action === 'close-skip' && t) {
    // a task set aside loses its date (it waits in «بلا موعد»); a goal is just left for today
    if (!isRepeat(t) && !isGoal(t)) { t.due = ''; toast(`«${t.title}» صارت بلا موعد`); }
    S.settings.closeSkip = { d: t0, ids: [...closeSkips(), t.id] };
    save(); render();
    return;
  }
  if (action === 'close-day') {
    S.settings.closed = [...closedDays().filter((d) => d >= addDays(t0, -400)), t0];
    save(); render(); toast('أغلقت يومك. تصبح على خير 🌙');
  }
});
// ---------- the pinned notification ----------
// A quiet notification that stays in the shade (and its icon by the clock) with what is left today.
// A web app cannot forbid swiping it away; it comes back whenever the app is opened or something changes.
function pinText() {
  const t0 = today();
  const tasks = S.tasks.filter((t) => !isGoal(t) && !t.done && t.due && t.due <= t0).length;
  // recurring goals due today, and one-time goals due by today
  const goals = S.tasks.filter((t) => (isRepeat(t) ? !goalEnded(t) && occursOn(t, t0) && !t.completions[t0] : isGoal(t) && !t.done && t.due && t.due <= t0) && !closeSkips().includes(t.id)).length;
  const lists = S.shop.filter((x) => x.need).length;
  const parts = [tasks && plural(tasks, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة'), goals && plural(goals, 'هدف واحد', 'هدفان', 'أهداف', 'هدفاً'), lists && `القوائم ${lists}`].filter(Boolean);
  return parts.length ? `باقٍ اليوم: ${parts.join(' | ')}` : 'لا شيء باقٍ لليوم ✓';
}
let pinTimer = null, pinLast = '';
async function pinNotify(force) {
  if (!S.settings.pin || !('Notification' in window) || Notification.permission !== 'granted') return;
  const body = digitsOut(pinText());
  if (!force && body === pinLast) return;
  pinLast = body;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification('الوعي الشخصي', { body, tag: 'pin', silent: true, renotify: false, requireInteraction: true, lang: 'ar', dir: 'rtl', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { pin: true } });
  } catch {}
}
const pinSoon = () => { clearTimeout(pinTimer); pinTimer = setTimeout(() => pinNotify(false), 1500); };
async function pinOff() {
  try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) for (const n of await reg.getNotifications({ tag: 'pin' })) n.close(); } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pinNotify(true); });
setTimeout(() => pinNotify(true), 2000);

document.addEventListener('change', async (e) => {
  if (e.target.id === 'setPin') {
    S.settings.pin = e.target.checked; save();
    if (S.settings.pin) { await ensureNotifPermission(); pinNotify(true); toast('سيظهر رمز التطبيق بجانب الساعة'); } else { pinOff(); toast('أُزيل الإشعار الدائم'); }
    return;
  }
  if (e.target.id !== 'setCloseAt') return;
  S.settings.closeAt = Number(e.target.value);
  save(); render();
});
