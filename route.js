'use strict';
// Two helpers on «اليوم»:
// 1) «أضف بسرعة بكلامك» for everything (an option in the settings; the other entry points stay):
//    «دفعت ١٥٠ بنزين» → a payment, added to its item in this month's plan when the name matches;
//    «اشتر حليب وخبز» → the house list (or «… لقائمة السفر»); «فكرة: …» → the ideas page;
//    anything else stays a task as before.
// 2) «إغلاق اليوم»: in the evening, a short card: today's unfinished tasks to move to tomorrow, whether
//    the day's spending was recorded, whether the journal was written, and «أغلقت يومي».

const enDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');
const smartAll = () => S.settings.smartMode === 'all';

function routeSmart(text) {
  const t = enDigits(text).trim();
  let m;
  // payments: «دفعت ١٥٠ بنزين» or «دفعت للبنزين ١٥٠»
  if ((m = /^(?:دفعت|صرفت|سددت|سدّدت)\s+([\d.,]+)\s*(?:ريال|ر\.?س\.?)?\s*(?:على|في|ثمن|حق|لـ?)?\s*(.*)$/.exec(t)) || (m = /^(?:دفعت|صرفت|سددت|سدّدت)\s+(?:على|في|ثمن|حق|لـ?)?\s*(.+?)\s+([\d.,]+)\s*(?:ريال|ر\.?س\.?)?$/.exec(t))) {
    const numFirst = /^[\d.,]+$/.test(m[1]);
    const amount = num(numFirst ? m[1] : m[2]);
    const what = String(numFirst ? m[2] : m[1]).replace(/^ال(?=ال)/, '').trim();
    if (!amount) return null;
    const p = monthPlan(curMonth());
    if (p) syncPlanLinks(p);
    const nm = normName(what);
    const r = p && nm.length >= 2 ? planRows(p).find((y) => y.x.name && (normName(y.x.name) === nm || normName(y.x.name).includes(nm) || nm.includes(normName(y.x.name)))) : null;
    return { type: 'spend', amount, what, row: r ? r.x : null };
  }
  // shopping: «اشتر حليب وخبز» (optionally «… لقائمة السفر»)
  if ((m = /^(?:اشتر|اشترِ|اشتري|أشتري|شراء|ناقص|نحتاج|ينقصنا)\s+(.+)$/.exec(t))) {
    let rest = m[1];
    let list = getList('home') || S.lists[0];
    const lm = /\s+(?:في|إلى|الى|ل)\s*(?:قائمة|القائمة)\s+(.+)$/.exec(rest) || /\s+لقائمة\s+(.+)$/.exec(rest);
    if (lm) { const want = normName(lm[1]); const hit = S.lists.find((l) => normName(l.name).includes(want) || want.includes(normName(l.name))); if (hit) list = hit; rest = rest.slice(0, lm.index); }
    const names = rest.split(/\s*[،,]\s*|\s+و(?=\S)/).map((x) => x.trim()).filter(Boolean);
    return names.length && list ? { type: 'shop', names, list } : null;
  }
  // ideas: «فكرة: …»
  if ((m = /^فكرة\s*[:：\-–]?\s*(.+)$/.exec(t))) return { type: 'idea', text: text.trim().replace(/^فكرة\s*[:：\-–]?\s*/, '') };
  return null;
}
function routePreviewHTML(q) {
  const tag = (s, cls = '') => `<span class="tag ${cls}">${s}</span>`;
  const tags = q.type === 'spend' ? [tag('💳 مصروف', 'title'), tag(money(q.amount)), tag(esc(q.what || 'بلا وصف')), q.row ? tag(`🔗 بند «${esc(q.row.name)}»${(() => { const rm = rowRemain(monthPlan(curMonth()), q.row.id, q.amount); return rm ? ` · ${remainAfter(rm)}` : ''; })()}`, (rowRemain(monthPlan(curMonth()), q.row.id, q.amount) || {}).left < -0.5 ? 'warn' : '') : tag(monthPlan(curMonth()) ? 'بلا بند: تضيفه من الخطة' : 'لا خطة لهذا الشهر', 'warn')]
    : q.type === 'shop' ? [tag(`${q.list.icon} ${esc(q.list.name)}`, 'title'), ...q.names.map((n) => tag(esc(n)))]
      : [tag('💡 فكرة', 'title'), tag(esc(excerpt(q.text, 50)))];
  return `<div class="parsed">${tags.join('')}</div>`;
}
function runRoute(q) {
  if (q.type === 'spend') {
    const t = normalizeTx({ amount: q.amount, kind: 'out', item: q.what, d: today() });
    S.finTx.push(t);
    if (q.row) assignTx(t, q.row.id, monthPlan(curMonth()));
    save();
    const rm = q.row && rowRemain(monthPlan(curMonth()), q.row.id);
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
      <small class="hint">«لكل شيء»: اكتب «دفعت ١٥٠ بنزين» فيُسجَّل مصروفاً في بنده، و«اشتر حليب وخبز» فيُضاف إلى مشتريات البيت، و«فكرة: …» فتُحفظ في الأفكار. وتبقى بقية خانات الإضافة كما هي.</small>
    </div>
    <label class="field"><span>بطاقة «إغلاق اليوم» تظهر من الساعة</span>
      <select id="setCloseAt">${[[0, 'لا تُظهرها'], [18, '٦ مساءً'], [19, '٧ مساءً'], [20, '٨ مساءً'], [21, '٩ مساءً'], [22, '١٠ مساءً'], [23, '١١ مساءً']].map(([h, l]) => `<option value="${h}"${at === h ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </label>
  </section>`;
}

// ---------- «إغلاق اليوم» ----------
const closedDays = () => (Array.isArray(S.settings.closed) ? S.settings.closed : []);
function closeTodayHTML() {
  const at = S.settings.closeAt ?? 20;
  const t0 = today();
  if (!at || new Date().getHours() < at || closedDays().includes(t0)) return '';
  const open = S.tasks.filter((t) => !isGoal(t) && !t.done && t.due === t0);
  const late = S.tasks.filter((t) => !isGoal(t) && !t.done && t.due && t.due < t0).length;
  const spent = S.finTx.filter((t) => t.d === t0 && t.kind === 'out');
  const noSpend = (S.settings.noSpend || '') === t0;
  const wrote = S.journal.some((j) => j.date === t0 && !jEmpty(j));
  const line = (ok, text, btns = '') => `<li class="${ok ? 'ok' : ''}"><span>${ok ? '✓' : '•'}</span><span>${text}</span>${btns}</li>`;
  return todayBlock('إغلاق اليوم', '', `<ul class="close-list">
    ${line(!open.length, open.length ? `${plural(open.length, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')} لم تُنجز اليوم` : 'أنجزت مهام اليوم', open.length ? '<button type="button" class="ghost sm" data-action="close-move">انقلها إلى الغد</button>' : '')}
    ${late ? line(false, `${plural(late, 'مهمة متأخرة', 'مهمتان متأخرتان', 'مهام متأخرة', 'مهمة متأخرة')} من أيام سابقة`, '<button type="button" class="ghost sm" data-tab="week">رتّبها</button>') : ''}
    ${line(spent.length || noSpend, spent.length ? `سجّلت مصروف اليوم: ${money(sum(spent))}` : noSpend ? 'لم تصرف شيئاً اليوم' : 'لم تسجّل مصروفاً اليوم', spent.length || noSpend ? '' : '<button type="button" class="ghost sm" data-action="close-spend">سجّل</button><button type="button" class="ghost sm" data-action="close-nospend">لم أصرف</button>')}
    ${S.journal.length ? line(wrote, wrote ? 'كتبت يومياتك' : 'لم تكتب يومياتك اليوم', wrote ? '' : '<button type="button" class="ghost sm" data-action="j-new" data-v="">اكتب الآن</button>') : ''}
  </ul>
  <button type="button" class="primary close-done" data-action="close-day">أغلقت يومي ✓</button>`);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action="set-smart"], [data-action^="close-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  if (action === 'set-smart') { S.settings.smartMode = v; save(); render(); toast(v === 'all' ? 'صارت خانة الإضافة السريعة لكل شيء' : 'صارت للمهام والأهداف فقط'); return; }
  const t0 = today();
  if (action === 'close-move') {
    const tm = addDays(t0, 1);
    const list = S.tasks.filter((t) => !isGoal(t) && !t.done && t.due === t0);
    for (const t of list) t.due = tm;
    save(); render(); toast(`نُقلت ${plural(list.length, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة')} إلى الغد`);
  }
  if (action === 'close-nospend') { S.settings.noSpend = t0; save(); render(); }
  if (action === 'close-spend') {
    const box = $('tdAmt');
    if (box) { box.scrollIntoView({ block: 'center' }); box.focus(); } else { finUi.tab = 'spend'; go('finance'); }
  }
  if (action === 'close-day') {
    S.settings.closed = [...closedDays().filter((d) => d >= addDays(t0, -400)), t0];
    save(); render(); toast('أغلقت يومك. تصبح على خير 🌙');
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'setCloseAt') return;
  S.settings.closeAt = Number(e.target.value);
  save(); render();
});
