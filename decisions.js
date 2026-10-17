'use strict';
// «سجل القرارات»: write a decision down with its reasons, what you expect and how sure you are;
// the app brings it back after the period you choose to ask what really happened and what you learnt.
// Over time it shows how often you were right and whether your confidence matches your accuracy.

const DEC_STATE = { calm: 'هادئ', tired: 'متعب', stressed: 'متوتر', excited: 'متحمس', rushed: 'مستعجل' };
const DEC_AFTER = [[30, 'بعد شهر'], [90, 'بعد ٣ أشهر'], [180, 'بعد ٦ أشهر'], [365, 'بعد سنة']];
const DEC_RESULT = { right: ['أصبت', '✅'], mixed: ['بين بين', '➖'], wrong: ['أخطأت', '❌'] };
const decUi = { filter: 'open' };

// weighing options before deciding (v83): the decision goes through states; options and criteria live in it
const DEC_STATUS = { thinking: 'قيد التفكير', decided: 'حُسم', postponed: 'مؤجّل', cancelled: 'أُلغي' };
const CRIT_TYPES = { score: 'درجة من ٥', yesno: 'نعم أو لا', money: 'مبلغ', time: 'مدة', text: 'وصف نوعي' };
const RISK_LVL = { 1: 'منخفض', 2: 'متوسط', 3: 'مرتفع' };
const SRC_TRUST = { high: 'موثوق', mid: 'متوسط', low: 'ضعيف' };
const DEFER_NAME = 'تأجيل القرار / عدم الاختيار حاليًّا';
const DEC_INFO = { yes: 'صحيحة', partly: 'بعضها صحيح', no: 'لم تكن صحيحة' };
const DEC_VERDICT = { keep: 'أستمر فيه', adjust: 'أعدّله', reverse: 'أتراجع عنه' };
// what the expectations and the decision were when it was adopted, kept as they were
const DEC_SNAP = [['chosenName', 'الخيار المختار'], ['expect', 'النتيجة المتوقعة'], ['exBenefits', 'المنافع المتوقعة'], ['exCosts', 'التكاليف أو الخسائر المتوقعة'], ['exWorst', 'أسوأ نتيجة معقولة'], ['exSignals', 'مؤشرات النجاح'],
  ['reasons', 'أسباب الاختيار'], ['basis', 'المعلومات التي بُني عليها'], ['accepted', 'المخاطر المقبولة'], ['whyNot', 'لماذا استُبعدت البدائل'], ['nextStep', 'الخطوة التالية']];
const cr = (name, o = {}) => ({ name, weight: 3, type: 'score', dir: 'high', ...o });
// suggested criteria for each kind of decision: all of them can be edited, removed or added to
const DEC_TEMPLATES = {
  family: { name: 'الزواج والقرارات الأسرية', person: true, criteria: [cr('الدين والخلق', { weight: 5 }), cr('التوافق في القيم والأهداف', { weight: 5 }), cr('التفاهم وأسلوب الحوار', { weight: 4 }), cr('الاستعداد للمسؤولية', { weight: 4 }), cr('قبول الأسرتين'), cr('الظروف المادية والسكن'), cr('المسافة والإقامة', { weight: 2 })] },
  career: { name: 'القرارات المهنية', criteria: [cr('الراتب والمزايا', { type: 'money', unit: 'ريال', weight: 4 }), cr('الاستقرار الوظيفي', { weight: 4 }), cr('فرص التعلم والنمو', { weight: 4 }), cr('بيئة العمل والإدارة'), cr('وقت التنقل', { type: 'time', unit: 'دقيقة', dir: 'low', weight: 2 }), cr('التوازن مع الحياة'), cr('التوافق مع أهدافي', { weight: 4 })] },
  money: { name: 'القرارات المالية', criteria: [cr('العائد المتوقع', { type: 'money', unit: 'ريال', weight: 4 }), cr('درجة المخاطرة', { dir: 'low', weight: 4 }), cr('سهولة استرجاع المال'), cr('التكاليف والرسوم', { type: 'money', unit: 'ريال', dir: 'low' }), cr('التوافق الشرعي', { type: 'yesno', must: true, weight: 5 })] },
  buy: { name: 'شراء الأجهزة والمنتجات', criteria: [cr('السعر', { type: 'money', unit: 'ريال', dir: 'low', weight: 4 }), cr('الجودة والمتانة', { weight: 4 }), cr('الحاجة الفعلية إليه', { weight: 4 }), cr('الضمان وخدمة ما بعد البيع'), cr('تقييمات المستخدمين'), cr('سهولة الاستخدام', { weight: 2 })] },
  project: { name: 'المشروعات والأفكار الاستثمارية', criteria: [cr('الطلب في السوق', { weight: 5 }), cr('رأس المال المطلوب', { type: 'money', unit: 'ريال', dir: 'low', weight: 4 }), cr('العائد المتوقع', { type: 'money', unit: 'ريال', weight: 4 }), cr('درجة المخاطرة', { dir: 'low', weight: 4 }), cr('الوقت المطلوب مني', { type: 'time', unit: 'ساعة في الأسبوع', dir: 'low' }), cr('خبرتي في المجال'), cr('التوافق الشرعي', { type: 'yesno', must: true, weight: 5 })] },
  personal: { name: 'القرارات الشخصية', criteria: [cr('أثره على صحتي'), cr('أثره على علاقاتي'), cr('أثره على وقتي'), cr('التوافق مع قيمي', { weight: 5 }), cr('التكلفة', { type: 'money', unit: 'ريال', dir: 'low', weight: 2 }), cr('ندمي المتوقع إن لم أفعل')] },
};
function normalizeCrit(c) {
  const type = CRIT_TYPES[c.type] ? c.type : 'score';
  return { id: c.id || uid(), name: String(c.name || ''), desc: String(c.desc || ''), weight: Math.max(1, Math.min(5, Math.round(Number(c.weight) || 3))),
    type, unit: String(c.unit || ''), dir: c.dir === 'low' ? 'low' : 'high', must: !!c.must, min: c.min === '' || c.min == null || !Number.isFinite(Number(c.min)) ? '' : Number(c.min) };
}
function normalizeOpt(o) {
  const scores = {};
  for (const [k, v] of Object.entries(o.scores && typeof o.scores === 'object' ? o.scores : {})) if (v !== '' && v != null) scores[k] = v;
  return {
    id: o.id || uid(), name: String(o.name || ''), defer: !!o.defer, desc: String(o.desc || ''), pros: String(o.pros || ''), cons: String(o.cons || ''),
    facts: String(o.facts || ''), feel: String(o.feel || ''), unknown: String(o.unknown || ''), questions: String(o.questions || ''),
    sources: (Array.isArray(o.sources) ? o.sources : []).filter((x) => x && String(x.text || '').trim()).map((x) => ({ id: x.id || uid(), text: String(x.text), trust: SRC_TRUST[x.trust] ? x.trust : 'mid' })),
    risks: (Array.isArray(o.risks) ? o.risks : []).filter((x) => x && String(x.text || '').trim()).map((x) => ({ id: x.id || uid(), text: String(x.text), prob: [1, 2, 3].includes(Number(x.prob)) ? Number(x.prob) : 2, impact: [1, 2, 3].includes(Number(x.impact)) ? Number(x.impact) : 2, reduce: String(x.reduce || ''), plan: String(x.plan || '') })),
    scores, created: o.created || Date.now(),
  };
}

function normalizeDecision(x) {
  return {
    id: x.id || uid(), title: String(x.title || ''), date: x.date || today(), context: String(x.context || ''),
    options: String(x.options || ''), reasons: String(x.reasons || ''), expect: String(x.expect || ''),
    confidence: [50, 60, 70, 80, 90].includes(Number(x.confidence)) ? Number(x.confidence) : 70,
    state: DEC_STATE[x.state] ? x.state : '', reviewAt: x.reviewAt || addDays(x.date || today(), 90),
    outcome: String(x.outcome || ''), result: DEC_RESULT[x.result] ? x.result : '', lesson: String(x.lesson || ''),
    reviewedAt: x.reviewedAt || '', created: x.created || Date.now(),
    // added in v83; a decision written before then was already made: «حُسم»
    status: DEC_STATUS[x.status] ? x.status : 'decided', kind: String(x.kind || ''), kindName: String(x.kindName || ''),
    question: String(x.question || ''), goal: String(x.goal || ''), deadline: /^\d{4}-\d{2}-\d{2}$/.test(x.deadline || '') ? x.deadline : '',
    deadRemind: x.deadRemind == null || !Number.isFinite(Number(x.deadRemind)) ? 3 : Math.max(0, Math.min(60, Math.round(Number(x.deadRemind)))), deadOff: !!x.deadOff,
    allowDefer: !!x.allowDefer, criteria: (Array.isArray(x.criteria) ? x.criteria : []).map(normalizeCrit), opts: (Array.isArray(x.opts) ? x.opts : []).map(normalizeOpt),
    // stage 3: what is expected (a draft until the decision is adopted), the decision itself, its frozen
    // original (`orig`, written once when adopted and never changed after), the review and the log of changes
    exBenefits: String(x.exBenefits || ''), exCosts: String(x.exCosts || ''), exWorst: String(x.exWorst || ''), exSignals: String(x.exSignals || ''),
    chosen: String(x.chosen || ''), basis: String(x.basis || ''), accepted: String(x.accepted || ''), whyNot: String(x.whyNot || ''), nextStep: String(x.nextStep || ''),
    orig: x.orig && typeof x.orig === 'object' && !Array.isArray(x.orig) ? x.orig : null,
    history: (Array.isArray(x.history) ? x.history : []).filter((h) => h && h.at).map((h) => ({ id: h.id || uid(), at: String(h.at), type: String(h.type || ''), text: String(h.text || ''), ...(h.snap && typeof h.snap === 'object' ? { snap: h.snap } : {}) })),
    rvGot: String(x.rvGot || ''), rvMissed: String(x.rvMissed || ''), rvWhy: String(x.rvWhy || ''), rvInfo: DEC_INFO[x.rvInfo] ? x.rvInfo : '', rvInfoNote: String(x.rvInfoNote || ''),
    verdict: DEC_VERDICT[x.verdict] ? x.verdict : '',
  };
}
const getDec = (id) => S.decisions.find((x) => x.id === id);
const decDue = () => S.decisions.filter((x) => x.status === 'decided' && !x.reviewedAt && x.reviewAt <= today());
// a decision still to be made whose last day is near (the user sets how near, or turns it off)
const decDeadSoon = () => S.decisions.filter((x) => ['thinking', 'postponed'].includes(x.status) && x.deadline && !x.deadOff && x.deadline <= addDays(today(), x.deadRemind))
  .sort((a, b) => a.deadline.localeCompare(b.deadline));
function decDeadText(x) {
  const n = daysBetween(today(), x.deadline);
  return n < 0 ? `فات الموعد منذ ${-n === 2 ? 'يومين' : daysWord(-n)}` : n === 0 ? 'آخر موعد للحسم: اليوم' : `آخر موعد للحسم: ${relDate(x.deadline)} (${afterDays(n)})`;
}
const decOpts = (x) => x.opts.filter((o) => !o.defer || x.allowDefer);
// the user's own templates (criteria saved from a decision), kept in the settings so they sync and are backed up
const decUserTpl = () => (Array.isArray(S.settings.decTpl) ? S.settings.decTpl : []);
const decTplOf = (kind) => (String(kind).startsWith('u:') ? decUserTpl().find((t) => `u:${t.id}` === kind) : DEC_TEMPLATES[kind]) || null;
const decKindName = (x) => (x.kind === 'custom' ? x.kindName : decTplOf(x.kind) ? decTplOf(x.kind).name : '');

function decStats() {
  const done = S.decisions.filter((x) => x.result);
  const score = (x) => (x.result === 'right' ? 1 : x.result === 'mixed' ? 0.5 : 0);
  const acc = done.length ? Math.round((done.reduce((n, x) => n + score(x), 0) / done.length) * 100) : 0;
  const conf = done.length ? Math.round(done.reduce((n, x) => n + x.confidence, 0) / done.length) : 0;
  // the state of mind behind most wrong decisions
  const wrongStates = {};
  for (const x of done) if (x.result === 'wrong' && x.state) wrongStates[x.state] = (wrongStates[x.state] || 0) + 1;
  const worst = Object.entries(wrongStates).sort((a, b) => b[1] - a[1])[0];
  return { n: done.length, acc, conf, worst: worst && worst[1] >= 2 ? DEC_STATE[worst[0]] : '' };
}

function decCard(x) {
  // a decision not made yet: its state, its last day and how far the weighing has gone
  if (x.status !== 'decided') {
    const os = decOpts(x);
    return `<button type="button" class="dec-card s-${x.status}" data-action="dec-open" data-v="${x.id}">
    <b>${esc(x.title)}</b>
    ${x.question ? `<p>${esc(excerpt(x.question, 160))}</p>` : ''}
    <span class="book-line">${[DEC_STATUS[x.status], decKindName(x), x.deadline ? decDeadText(x) : '', os.length ? `الخيارات: ${os.length}` : '', x.criteria.length ? `المعايير: ${x.criteria.length}` : ''].filter(Boolean).map(esc).join(' | ')}</span>
  </button>`;
  }
  const due = !x.reviewedAt && x.reviewAt <= today();
  const r = DEC_RESULT[x.result];
  return `<button type="button" class="dec-card${due ? ' due' : ''}${x.reviewedAt ? ` r-${x.result}` : ''}" data-action="dec-open" data-v="${x.id}">
    <b>${r ? `${r[1]} ` : ''}${esc(x.title)}</b>
    ${x.reasons ? `<p>${esc(excerpt(x.reasons, 160))}</p>` : ''}
    <span class="book-line">${esc(dateBoth(x.date, true))} | ثقتي ${x.confidence}%${x.state ? ` | كنت ${DEC_STATE[x.state]}` : ''} | ${x.reviewedAt ? `روجع: ${r ? r[0] : ''}` : due ? '<span class="late">حان وقت مراجعته</span>' : `المراجعة ${esc(relDate(x.reviewAt))}`}</span>
  </button>`;
}

function viewDecisions() {
  const due = decDue();
  const thinking = (x) => x.status === 'thinking' || x.status === 'postponed';
  const waiting = (x) => x.status === 'decided' && !x.reviewedAt;
  const list = S.decisions.filter((x) => (decUi.filter === 'thinking' ? thinking(x) : decUi.filter === 'open' ? waiting(x) : decUi.filter === 'done' ? !!x.reviewedAt : true))
    .sort((a, b) => (decUi.filter === 'thinking' ? (a.deadline || '9999').localeCompare(b.deadline || '9999') : decUi.filter === 'open' ? a.reviewAt.localeCompare(b.reviewAt) : b.date.localeCompare(a.date)));
  const st = decStats();
  const nThink = S.decisions.filter(thinking).length;
  const seg = [...(nThink ? [['thinking', `قيد التفكير ${nThink}`]] : []), ['open', `تنتظر النتيجة ${S.decisions.filter(waiting).length}`], ['done', `روجعت ${st.n}`], ['all', 'الكل']]
    .map(([v, l]) => `<button type="button" data-action="dec-filter" data-v="${v}" aria-pressed="${decUi.filter === v}">${l}</button>`).join('');
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>سجل القرارات</h2><div class="btn-row">${S.decisions.length ? xlsBtn('decisions') : ''}${addBtn('dec-new', 'قرار')}</div></div>
    ${st.n ? `<div class="j-stats"><span><b>${st.acc}%</b> نسبة الإصابة</span><span><b>${st.conf}%</b> متوسط ثقتك</span><span><b>${st.n}</b> قرار روجع</span></div>
      <p class="note-text">${st.n < 3 ? 'تتضح الصورة بعد مراجعة ثلاثة قرارات أو أكثر.' : Math.abs(st.acc - st.conf) <= 10 ? 'ثقتك تطابق نتائجك تقريباً، تقديرك لنفسك دقيق.' : st.conf > st.acc ? 'ثقتك أعلى من نتائجك: تمهّل واستشر أكثر قبل القرارات الكبيرة.' : 'نتائجك أفضل من ثقتك: ثق بحكمك أكثر.'}${st.worst ? ` أكثر قراراتك الخاطئة اتخذتها وأنت ${st.worst}.` : ''}</p>` : ''}
    ${due.length ? `<div class="dec-due"><b>حان وقت مراجعة ${due.length === 1 ? 'قرار' : `${due.length} قرارات`}</b></div>` : ''}
    ${S.decisions.length ? `<div class="seg" role="group" aria-label="عرض">${seg}</div>` : ''}
    ${list.length ? `<div class="book-list">${list.map(decCard).join('')}</div>`
      : S.decisions.length ? emptyHTML('لا شيء هنا', 'غيّر التصفية.')
        : emptyHTML('سجّل قراراتك المهمة', 'حين تتخذ قراراً مهماً: اكتب لماذا اخترته وماذا تتوقع، وكم أنت واثق. بعد المدة التي تحددها يسألك التطبيق: هل أصبت؟ ومع الوقت تعرف متى تصيب قراراتك ومتى تخطئ.', addBtn('dec-new', 'أول قرار'))}
  </section>`;
}

// ---------- editor (and review) ----------
// one sheet on tabs: the decision, its options, its criteria, the deciding (reasons, expectation,
// confidence, review period) and, once made and due, its review
const DEC_TABS = [['main', 'القرار'], ['opts', 'الخيارات'], ['crit', 'المعايير'], ['cmp', 'المقارنة'], ['decide', 'الحسم'], ['review', 'المراجعة']];
function decOptCard(x, o) {
  const scored = x.criteria.filter((c) => o.scores[c.id] !== undefined).length;
  const high = o.risks.filter((r) => r.prob === 3 || r.impact === 3).length;
  const qs = o.questions.split('\n').filter((q) => q.trim()).length;
  return `<button type="button" class="dec-card dec-opt${o.defer ? ' defer' : ''}" data-action="dec-opt-open" data-v="${o.id}">
    <b>${o.defer ? '⏸ ' : ''}${esc(o.name || 'خيار')}</b>
    ${o.desc ? `<p>${esc(excerpt(o.desc, 140))}</p>` : ''}
    <span class="book-line">${[x.criteria.length ? `قيّمته في ${scored} من ${x.criteria.length} معايير` : '', o.unknown.trim() ? 'فيه معلومات مجهولة' : '', o.risks.length ? `المخاطر: ${o.risks.length}${high ? ` (مرتفعة: ${high})` : ''}` : '', qs ? `أسئلة قبل الحسم: ${qs}` : ''].filter(Boolean).map(esc).join(' | ')}</span>
  </button>`;
}
function decCritRow(c, total) {
  const calc = c.type !== 'text';
  return `<button type="button" class="dec-card dec-crit" data-action="dec-crit-open" data-v="${c.id}">
    <b>${esc(c.name)}${c.must ? ' <small class="dec-must">شرط أساسي</small>' : ''}</b>
    ${c.desc ? `<p>${esc(excerpt(c.desc, 120))}</p>` : ''}
    <span class="book-line">${[calc ? `الوزن: ${c.weight} (${total ? Math.round((c.weight / total) * 100) : 0}%)` : 'لا يدخل في الحساب', CRIT_TYPES[c.type] + (c.unit ? ` (${c.unit})` : ''), calc && c.type !== 'yesno' ? (c.dir === 'low' ? 'الأقل أفضل' : 'الأعلى أفضل') : '', c.must && c.min !== '' ? `${c.dir === 'low' ? 'الحد الأعلى' : 'الحد الأدنى'}: ${c.min}` : ''].filter(Boolean).map(esc).join(' | ')}</span>
  </button>`;
}
const decWeightTotal = (x) => x.criteria.filter((c) => c.type !== 'text').reduce((n, c) => n + c.weight, 0);

function openDecision(id, review, tab) {
  const x = id ? getDec(id) : normalizeDecision({ status: 'thinking' });
  const rv = review || (id && x.status === 'decided' && (x.reviewedAt || x.reviewAt <= today()));
  const after = id ? daysBetween(x.date, x.reviewAt) : 90;
  ldraft = { kind: 'decision', id: x.id, isNew: !id, conf: x.confidence, state: x.state, result: x.result, review: rv, after, status: x.status, tab: tab || (rv ? 'review' : 'main'), tw: {}, showCalc: false, verdict: x.verdict, rvInfo: x.rvInfo };
  const tabs = DEC_TABS.filter(([k]) => k !== 'review' || rv);
  if (!tabs.some(([k]) => k === ldraft.tab)) ldraft.tab = 'main';
  const os = decOpts(x), total = decWeightTotal(x);
  const label = (k, l) => (k === 'opts' && os.length ? `${l} (${os.length})` : k === 'crit' && x.criteria.length ? `${l} (${x.criteria.length})` : l);
  const pane = (k) => `data-dtab="${k}"${ldraft.tab === k ? '' : ' hidden'}`;
  const kinds = [['', 'بلا نوع'], ...Object.entries(DEC_TEMPLATES).map(([k, t]) => [k, t.name]), ...decUserTpl().map((t) => [`u:${t.id}`, `${t.name} (قالبي)`]), ['custom', 'نوع آخر أكتبه']];
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? (rv ? 'مراجعة القرار' : 'القرار') : 'قرار جديد'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="seg seg-wrap dec-tabs" id="dTabs" role="group">${tabs.map(([k, l]) => `<button type="button" data-action="dec-tab" data-v="${k}" aria-pressed="${ldraft.tab === k}">${label(k, l)}</button>`).join('')}</div>
    <div ${pane('main')}>
      <div class="field"><span>حالة القرار</span><div class="seg seg-wrap" id="dStatus" role="group">${Object.entries(DEC_STATUS).map(([k, v]) => `<button type="button" data-action="dec-status" data-v="${k}" aria-pressed="${x.status === k}">${v}</button>`).join('')}</div></div>
      <label class="field"><span>ما القرار؟</span><input type="text" id="dTitle" value="${esc(x.title)}" autocomplete="off" placeholder="مثال: الانتقال إلى وظيفة جديدة"></label>
      <div class="grid2">
        <label class="field"><span>نوع القرار</span><select id="dKind">${kinds.map(([k, l]) => `<option value="${k}"${x.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>التاريخ</span><input type="date" id="dDate" value="${x.date}"></label>
      </div>
      <label class="field" id="dKindNameW"${x.kind === 'custom' ? '' : ' hidden'}><span>اسم النوع</span><input type="text" id="dKindName" value="${esc(x.kindName)}" autocomplete="off" placeholder="مثال: السفر والإقامة"></label>
      <label class="field"><span>الموقف</span><textarea id="dContext" rows="2" placeholder="ما الذي استدعى هذا القرار؟">${esc(x.context)}</textarea></label>
      <label class="field"><span>السؤال الذي أريد حسمه</span><input type="text" id="dQuestion" value="${esc(x.question)}" autocomplete="off" placeholder="مثال: أيّ العرضين أقبل؟"></label>
      <label class="field"><span>النتيجة التي أريد الوصول إليها</span><textarea id="dGoal" rows="2">${esc(x.goal)}</textarea></label>
      <label class="field"><span>آخر موعد للحسم (اختياري)</span><input type="date" id="dDeadline" value="${x.deadline}"></label>
      <div class="dec-remind" id="dDeadW"${x.deadline ? '' : ' hidden'}>
        <label class="switch"><input type="checkbox" id="dDeadOn"${x.deadOff ? '' : ' checked'}><span>ذكّرني في «اليوم» قبل الموعد</span></label>
        <label class="dec-days"${x.deadOff ? ' hidden' : ''} id="dDeadDaysW"><input type="number" id="dDeadDays" min="0" max="60" inputmode="numeric" value="${x.deadRemind}" data-novoice> أيام</label>
      </div>
      ${x.options ? `<label class="field"><span>البدائل التي فكرت فيها</span><textarea id="dOptions" rows="2">${esc(x.options)}</textarea></label>` : ''}
    </div>
    <div ${pane('opts')}>
      ${os.length ? `<div class="book-list">${os.map((o) => decOptCard(x, o)).join('')}</div>` : '<p class="note-text">لا خيارات بعد. أضف كل خيار متاح، ولكل خيار بطاقته.</p>'}
      <label class="switch"><input type="checkbox" id="dDefer"${x.allowDefer ? ' checked' : ''}><span>أضف خيار «${DEFER_NAME}»</span></label>
      <div class="btn-row"><button type="button" class="ghost" data-action="dec-opt-new">${icon('plus')} خيار</button></div>
    </div>
    <div ${pane('crit')}>
      ${x.criteria.length ? `<p class="note-text">مجموع الأوزان: ${plural(total, 'نقطة واحدة', 'نقطتان', 'نقاط', 'نقطة')}، ونصيب كل معيار بقدر وزنه منها.</p><div class="book-list">${x.criteria.map((c) => decCritRow(c, total)).join('')}</div>` : '<p class="note-text">لا معايير بعد. أضف ما تفاضل به بين الخيارات، أو المعايير المقترحة لنوع القرار.</p>'}
      <div class="btn-row"><button type="button" class="ghost" data-action="dec-crit-new">${icon('plus')} معيار</button><button type="button" class="ghost" data-action="dec-tpl">المعايير المقترحة لنوع القرار</button></div>
      ${x.criteria.length ? `<div class="dec-remind"><span>احفظ هذه المعايير قالباً لك تختاره في قرارات قادمة (اسم قالب موجود يُستبدل به)</span><div class="dec-num"><input type="text" id="dTplName" autocomplete="off" placeholder="اسم القالب" value="${esc(decTplOf(x.kind) && String(x.kind).startsWith('u:') ? decTplOf(x.kind).name : '')}"><button type="button" class="ghost sm" data-action="dec-tpl-save">احفظ القالب</button></div></div>` : ''}
      ${decUserTpl().length ? `<div class="field"><span>قوالبي</span><ul class="dec-tpls">${decUserTpl().map((t) => `<li><span>${esc(t.name)} <small>(${plural(t.criteria.length, 'معيار واحد', 'معياران', 'معايير', 'معياراً')})</small></span><button type="button" class="fin-del" data-action="dec-tpl-del" data-v="${t.id}" aria-label="حذف">✕</button></li>`).join('')}</ul></div>` : ''}
    </div>
    <div ${pane('cmp')}>${id ? decCompareHTML(x) : '<p class="note-text">احفظ القرار وأضف خياراته ومعاييره لتظهر المقارنة.</p>'}</div>
    <div ${pane('decide')}>${decDecideHTML(x, after)}</div>
    ${rv ? `<div ${pane('review')}><div class="dec-review">
      <h3>${esc(x.title)}</h3>
      <dl class="habit-plan">
        ${x.context ? `<div><dt>الموقف</dt><dd>${esc(x.context)}</dd></div>` : ''}
        ${(x.orig || x).chosenName ? `<div><dt>الخيار المختار</dt><dd>${esc(x.orig.chosenName)}</dd></div>` : ''}
        ${(x.orig || x).reasons ? `<div><dt>لماذا اخترته</dt><dd>${esc((x.orig || x).reasons)}</dd></div>` : ''}
        ${(x.orig || x).expect ? `<div><dt>ما توقعته</dt><dd>${esc((x.orig || x).expect)}</dd></div>` : ''}
        ${[['exBenefits', 'المنافع المتوقعة'], ['exCosts', 'التكاليف المتوقعة'], ['exWorst', 'أسوأ نتيجة توقعتها'], ['exSignals', 'مؤشرات النجاح']].filter(([k]) => (x.orig || x)[k]).map(([k, l]) => `<div><dt>${l}</dt><dd>${esc((x.orig || x)[k])}</dd></div>`).join('')}
        <div><dt>ثقتي</dt><dd>${x.confidence}% | ${esc(dateBoth(x.date, true))}${x.state ? ` | كنت ${DEC_STATE[x.state]}` : ''}</dd></div>
      </dl>
      <label class="field"><span>ماذا حدث فعلاً؟</span><textarea id="dOutcome" rows="3">${esc(x.outcome)}</textarea></label>
      <label class="field"><span>ما الذي تحقق مما توقعته؟</span><textarea id="dRvGot" rows="2">${esc(x.rvGot)}</textarea></label>
      <label class="field"><span>وما الذي لم يتحقق؟</span><textarea id="dRvMissed" rows="2">${esc(x.rvMissed)}</textarea></label>
      <label class="field"><span>لماذا اختلفت النتيجة عن المتوقع؟</span><textarea id="dRvWhy" rows="2">${esc(x.rvWhy)}</textarea></label>
      <div class="field"><span>هل كانت معلوماتي وتقديراتي وقتها صحيحة؟</span><div class="seg" id="dRvInfo" role="group">${Object.entries(DEC_INFO).map(([k, v]) => `<button type="button" data-action="dec-rvinfo" data-v="${k}" aria-pressed="${x.rvInfo === k}">${v}</button>`).join('')}</div>
        <input type="text" id="dRvInfoNote" value="${esc(x.rvInfoNote)}" autocomplete="off" placeholder="ما الذي كان صحيحاً أو خاطئاً منها؟"></div>
      <div class="field"><span>هل أصبت؟</span><div class="seg" id="dResult" role="group">${Object.entries(DEC_RESULT).map(([k, v]) => `<button type="button" data-action="dec-result" data-v="${k}" aria-pressed="${x.result === k}">${v[1]} ${v[0]}</button>`).join('')}</div></div>
      <label class="field"><span>ماذا تعلّمت؟</span><textarea id="dLesson" rows="3" placeholder="ما الذي ستفعله بشكل مختلف في المرة القادمة؟">${esc(x.lesson)}</textarea></label>
      <div class="field"><span>والقرار الآن؟</span><div class="seg" id="dVerdict" role="group">${Object.entries(DEC_VERDICT).map(([k, v]) => `<button type="button" data-action="dec-verdict" data-v="${k}" aria-pressed="${x.verdict === k}">${v}</button>`).join('')}</div></div>
      ${x.reviewedAt ? '' : '<button type="button" class="ghost" data-action="dec-later">ليس بعد، ذكّرني بعد شهر</button>'}
    </div></div>` : ''}
    <div class="sheet-actions">
      <button type="submit" class="primary">${rv && !x.reviewedAt ? 'احفظ المراجعة' : 'حفظ'}</button>
      ${id && !rv && x.status === 'decided' ? '<button type="button" class="ghost" data-action="dec-review-now">راجعه الآن</button>' : ''}
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  // what the select showed when opened (a postponed review, 88 days, shows as «90»): unchanged keeps the date
  ldraft.afterShown = +$('dAfter').value;
  boxLines($('libForm'));
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  $('libForm').scrollTop = 0;
}
// «الحسم»: before deciding, the expectations (a draft) and the decision; once adopted, what was written
// then, frozen; a decision recorded before stage 3 keeps its fields as they always were
function decSnapHTML(o) {
  return `<dl class="habit-plan">${DEC_SNAP.filter(([k]) => o[k]).map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(o[k])}</dd></div>`).join('')}
    <div><dt>ثقتي</dt><dd>${o.confidence}%${o.state ? ` | كنت ${DEC_STATE[o.state]}` : ''}${o.date ? ` | تاريخ القرار: ${esc(dateBoth(o.date, true))}` : ''}</dd></div></dl>
    ${o.cmp && o.cmp.length ? `<p class="note-text">نتائج المقارنة وقتها: ${o.cmp.map((c) => `${esc(c.name)}: ${c.fails ? 'لم يحقق شرطاً' : c.score == null ? '؟' : `${c.score} من ١٠٠`} (اكتمال ${c.complete}%)`).join(' | ')}</p>` : ''}`;
}
function decDecideHTML(x, after) {
  const afterSel = `<label class="field"><span>ذكّرني بمراجعته بعد</span><select id="dAfter">${DEC_AFTER.map(([d, l]) => `<option value="${d}"${Math.abs(after - d) < 5 ? ' selected' : ''}>${l}</option>`).join('')}${DEC_AFTER.some(([d]) => Math.abs(after - d) < 5) ? '' : `<option value="${after}" selected>${afterDays(after)}</option>`}</select></label>`;
  const confState = `<div class="field"><span>كم أنا واثق؟</span><div class="seg" id="dConf" role="group">${[50, 60, 70, 80, 90].map((c) => `<button type="button" data-action="dec-conf" data-v="${c}" aria-pressed="${x.confidence === c}">${c}%</button>`).join('')}</div></div>
      <div class="field"><span>حالتي وأنا أقرر</span><div class="seg seg-wrap" id="dState" role="group">${Object.entries(DEC_STATE).map(([k, v]) => `<button type="button" data-action="dec-state" data-v="${k}" aria-pressed="${x.state === k}">${v}</button>`).join('')}</div></div>`;
  const move = x.status === 'decided' && !x.reviewedAt ? `<div class="dec-remind"><span>موعد المراجعة: ${esc(dateBoth(x.reviewAt, true))}</span>
      <details><summary>طرأ حدث مهم؟ قدّم موعد المراجعة</summary><div class="dec-move"><input type="date" id="dRevAt" value="${today()}" max="${x.reviewAt}"><input type="text" id="dRevWhy" autocomplete="off" placeholder="ما الذي طرأ؟ (اختياري)"><button type="button" class="ghost sm" data-action="dec-rev-move">قدّمه</button></div></details></div>` : '';
  const hist = x.history.length ? `<details class="dec-hist"><summary>سجل التغييرات (${x.history.length})</summary><ul>${x.history.slice().reverse().map((h) => `<li><small>${esc(dateBoth(h.at, true))}</small> ${esc(h.text)}${h.snap ? `<details><summary>ما كان مسجلاً وقتها</summary>${decSnapHTML(h.snap)}</details>` : ''}</li>`).join('')}</ul></details>` : '';
  if (x.orig && x.status !== 'thinking' && x.status !== 'postponed') {
    return `<div class="dec-frozen"><b>🔒 ما سجّلته وقت الحسم (${esc(dateBoth(x.orig.at, true))})</b><small>محفوظ كما كان، ولا يتغير بعد الحسم.</small>${decSnapHTML(x.orig)}</div>
      ${x.status === 'cancelled' ? `<p class="dec-fail">أُلغي هذا القرار بعد حسمه، وبقي ما سجّلته وقتها.</p><div hidden>${afterSel}</div>` : afterSel}${move}
      <div class="btn-row"><button type="button" class="ghost" data-action="dec-reopen">${x.status === 'cancelled' ? 'أعد فتحه للتعديل' : 'عدّل القرار'}</button></div>
      <p class="note-text explain">التعديل يعيد القرار «قيد التفكير» لتعتمده من جديد، ويبقى ما سجّلته الآن في سجل التغييرات.</p>${hist}`;
  }
  if (x.status === 'decided') {
    return `<label class="field"><span>لماذا اخترت هذا؟</span><textarea id="dReasons" rows="3">${esc(x.reasons)}</textarea></label>
      <label class="field"><span>ماذا أتوقع أن يحدث؟</span><textarea id="dExpect" rows="2" placeholder="كن محدداً، لتعرف لاحقاً هل أصبت">${esc(x.expect)}</textarea></label>
      ${confState}${afterSel}${move}${hist}`;
  }
  const os = decOpts(x);
  return `<h3 class="dec-h">التوقعات قبل الحسم</h3>
      <p class="note-text">مسودة تعدّلها كما تشاء حتى تعتمد القرار، ثم تُحفظ كما هي لتقارنها بالنتيجة عند المراجعة.</p>
      <label class="field"><span>النتيجة التي أتوقعها من الخيار الذي سأختاره</span><textarea id="dExpect" rows="2" placeholder="كن محدداً، لتعرف لاحقاً هل أصبت">${esc(x.expect)}</textarea></label>
      <label class="field"><span>المنافع المتوقعة</span><textarea id="dExBen" rows="2">${esc(x.exBenefits)}</textarea></label>
      <label class="field"><span>التكاليف أو الخسائر المتوقعة</span><textarea id="dExCost" rows="2">${esc(x.exCosts)}</textarea></label>
      <label class="field"><span>أسوأ نتيجة معقولة</span><textarea id="dExWorst" rows="2">${esc(x.exWorst)}</textarea></label>
      <label class="field"><span>المؤشرات التي سأحكم بها على نجاح القرار</span><textarea id="dExSig" rows="2" placeholder="مثال: أتعلم مهارة جديدة خلال ستة أشهر">${esc(x.exSignals)}</textarea></label>
      <h3 class="dec-h">اعتماد القرار</h3>
      ${os.length ? `<label class="field"><span>الخيار المختار</span><select id="dChosen"><option value="">اختر</option>${os.map((o) => `<option value="${o.id}"${x.chosen === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>أسباب الاختيار النهائية</span><textarea id="dReasons" rows="3">${esc(x.reasons)}</textarea></label>
      <label class="field"><span>المعلومات التي بنيت عليها القرار</span><textarea id="dBasis" rows="2">${esc(x.basis)}</textarea></label>
      <label class="field"><span>المخاطر التي قبلت بها</span><textarea id="dAccepted" rows="2">${esc(x.accepted)}</textarea></label>
      ${os.length > 1 ? `<label class="field"><span>لماذا استبعدت البدائل الأخرى؟</span><textarea id="dWhyNot" rows="2">${esc(x.whyNot)}</textarea></label>` : ''}
      <label class="field"><span>الخطوة التالية التي ينبغي تنفيذها</span><input type="text" id="dNext" value="${esc(x.nextStep)}" autocomplete="off"></label>
      ${confState}
      <div class="grid2"><label class="field"><span>تاريخ القرار</span><input type="date" id="dDecDate" value="${today()}"></label>${afterSel}</div>
      <button type="button" class="primary" data-action="dec-adopt">اعتمد القرار</button>${hist}`;
}
function decSnap(x) {
  const ch = x.opts.find((o) => o.id === x.chosen);
  const cmp = decOpts(x).length >= 2 && x.criteria.length ? decScores(x).map((r) => ({ name: r.o.name, score: r.score, complete: r.complete, fails: r.fails.length > 0 })) : [];
  return { at: today(), date: x.date, chosen: x.chosen, chosenName: ch ? ch.name : '', expect: x.expect, exBenefits: x.exBenefits, exCosts: x.exCosts, exWorst: x.exWorst, exSignals: x.exSignals,
    reasons: x.reasons, basis: x.basis, accepted: x.accepted, whyNot: x.whyNot, nextStep: x.nextStep, confidence: x.confidence, state: x.state, cmp };
}
const decLog = (x, type, text, snap) => x.history.push({ id: uid(), at: today(), type, text, ...(snap ? { snap } : {}) });
function saveDecision() {
  const title = $('dTitle').value.trim();
  if (!title) { toast('اكتب القرار.'); return false; }
  const old = getDec(ldraft.id);
  const date = $('dDate').value || today();
  const kind = $('dKind').value;
  // a field not on screen (an adopted decision shows its frozen copy instead) keeps what it had
  const tv = (id, k) => ($(id) ? $(id).value.trim() : old ? old[k] : '');
  const x = normalizeDecision({
    ...(old || {}), id: ldraft.id, title, date, context: $('dContext').value.trim(), options: tv('dOptions', 'options'),
    reasons: tv('dReasons', 'reasons'), expect: tv('dExpect', 'expect'), confidence: ldraft.conf, state: ldraft.state,
    exBenefits: tv('dExBen', 'exBenefits'), exCosts: tv('dExCost', 'exCosts'), exWorst: tv('dExWorst', 'exWorst'), exSignals: tv('dExSig', 'exSignals'),
    chosen: tv('dChosen', 'chosen'), basis: tv('dBasis', 'basis'), accepted: tv('dAccepted', 'accepted'), whyNot: tv('dWhyNot', 'whyNot'), nextStep: tv('dNext', 'nextStep'),
    status: ldraft.status, kind, kindName: kind === 'custom' ? $('dKindName').value.trim() : '', question: $('dQuestion').value.trim(), goal: $('dGoal').value.trim(),
    deadline: $('dDeadline').value, deadOff: !$('dDeadOn').checked, deadRemind: $('dDeadDays').value === '' ? 3 : $('dDeadDays').value, allowDefer: $('dDefer').checked,
  });
  // «تأجيل القرار / عدم الاختيار حاليًّا» is an option like the others, with its own card; unticking hides it, keeping what was written
  if (x.allowDefer && !x.opts.some((o) => o.defer)) x.opts.push(normalizeOpt({ name: DEFER_NAME, defer: true }));
  // the review date follows the chosen period, unless nothing changed (keeps a «later» postponement)
  const after = +$('dAfter').value;
  x.reviewAt = old && old.date === date && (after === ldraft.afterShown || after === ldraft.after) ? old.reviewAt : addDays(date, after);
  if (ldraft.review) {
    x.outcome = $('dOutcome').value.trim();
    x.lesson = $('dLesson').value.trim();
    x.rvGot = $('dRvGot').value.trim(); x.rvMissed = $('dRvMissed').value.trim(); x.rvWhy = $('dRvWhy').value.trim();
    x.rvInfo = ldraft.rvInfo; x.rvInfoNote = $('dRvInfoNote').value.trim(); x.verdict = ldraft.verdict;
    x.result = ldraft.result;
    if (x.result && !x.reviewedAt) x.reviewedAt = today();
    if (!x.result && (x.outcome || x.lesson || x.rvGot || x.rvMissed || x.rvWhy)) { toast('اختر: هل أصبت أم أخطأت؟'); return false; }
    if (!x.result) x.reviewedAt = ''; // a review emptied is not a review
  }
  // adopting: the decision is made now; what was expected and decided is frozen once, as it was
  if (ldraft.adopt) {
    if (decOpts(x).length && !decOpts(x).some((o) => o.id === x.chosen)) { toast('اختر الخيار الذي حسمت به.'); return false; }
    x.status = 'decided';
    x.date = ($('dDecDate') && $('dDecDate').value) || today();
    x.reviewAt = addDays(x.date, after);
    x.orig = decSnap(x);
    decLog(x, 'decided', x.orig.chosenName ? `حُسم القرار: «${x.orig.chosenName}»` : 'حُسم القرار', x.orig);
  } else if (!old) decLog(x, 'created', `سُجّل القرار (${DEC_STATUS[x.status]})`);
  else if (old.status !== x.status) {
    // an adopted decision put back to thinking or postponed: its frozen copy goes to the log, as with «عدّل القرار»
    if (old.orig && (x.status === 'thinking' || x.status === 'postponed')) { decLog(x, x.status === 'postponed' ? 'postponed' : 'reopened', `صار «${DEC_STATUS[x.status]}» بعد حسمه`, old.orig); x.orig = null; }
    else decLog(x, x.status, `صار «${DEC_STATUS[x.status]}»`);
  }
  if (ldraft.review && old) {
    if (x.reviewedAt && !old.reviewedAt) decLog(x, 'reviewed', `روجع: ${DEC_RESULT[x.result][0]}${x.verdict ? ` | ${DEC_VERDICT[x.verdict]}` : ''}`);
    else if (old.reviewedAt && x.verdict && x.verdict !== old.verdict) decLog(x, 'verdict', `القرار الآن: ${DEC_VERDICT[x.verdict]}`);
  }
  if (old) Object.assign(old, x); else S.decisions.push(x);
  save();
  return true;
}

// ---------- comparing the options ----------
// the user's limits: results «متقاربة» under 5 points apart (of 100), information «ناقصة» under 70%
const DEC_CLOSE = 5, DEC_FULL = 70;
const decIsPerson = (x) => !!(decTplOf(x.kind) && decTplOf(x.kind).person);
const decFmt = (n) => (Math.round(Number(n) * 100) / 100).toLocaleString('en-US');
function decShow(c, v) {
  if (v === undefined) return '؟ مجهول';
  if (c.type === 'score') return `${v} من ٥`;
  if (c.type === 'yesno') return v === 'yes' ? 'نعم' : 'لا';
  if (c.type === 'text') return String(v);
  return `${decFmt(v)}${c.unit ? ` ${c.unit}` : ''}`;
}
// a rating as 0..100, the best being 100: a score on its scale, yes/no, money and durations
// against the other options' values; a description is shown and never computed; unknown is null
function decNorm(c, v, all) {
  if (v === undefined || c.type === 'text') return null;
  if (c.type === 'yesno') return v === 'yes' ? 100 : 0;
  if (c.type === 'score') { const p = ((Number(v) - 1) / 4) * 100; return c.dir === 'low' ? 100 - p : p; }
  const ns = all.filter((y) => y !== undefined).map(Number);
  const lo = Math.min(...ns), hi = Math.max(...ns);
  if (hi === lo) return 100;
  const p = ((Number(v) - lo) / (hi - lo)) * 100;
  return c.dir === 'low' ? 100 - p : p;
}
// a condition that must hold: pass | fail | unknown (not rated yet) | open (a must with no limit to check)
function decMust(c, v) {
  if (v === undefined) return 'unknown';
  if (c.type === 'yesno') return v === 'yes' ? 'pass' : 'fail';
  if (c.min === '') return 'open';
  return (c.dir === 'low' ? Number(v) <= c.min : Number(v) >= c.min) ? 'pass' : 'fail';
}
// every option's result; `weights` tries other weights without saving them
function decScores(x, weights) {
  const w = (c) => (weights && weights[c.id] != null ? weights[c.id] : c.weight);
  const opts = decOpts(x);
  return opts.map((o) => {
    const cells = x.criteria.map((c) => {
      const v = o.scores[c.id];
      return { c, v, norm: decNorm(c, v, opts.map((y) => y.scores[c.id])), must: c.must ? decMust(c, v) : '' };
    });
    // the score counts only what is known; how complete the information is counts every criterion by its weight
    // (a description counts as 1), so a heavy criterion left unknown weighs more than a light one
    let sum = 0, sw = 0, tw = 0, kw = 0;
    for (const k of cells) {
      const ww = k.c.type === 'text' ? 1 : w(k.c);
      tw += ww;
      if (k.v !== undefined) kw += ww;
      if (k.norm !== null) { sum += ww * k.norm; sw += ww; }
    }
    const questions = o.questions.split('\n').map((q) => q.trim()).filter(Boolean);
    const known = cells.filter((k) => k.norm !== null).sort((a, b) => b.norm - a.norm);
    const r = {
      o, cells, score: sw ? Math.round(sum / sw) : null, complete: tw ? Math.round((kw / tw) * 100) : 0,
      fails: cells.filter((k) => k.must === 'fail'), mustUnknown: cells.filter((k) => k.must === 'unknown'),
      questions, missing: cells.filter((k) => k.v === undefined).map((k) => k.c.name),
      // the same lines as the table's colours: a strength is green (67 and more), a weakness red (under 34)
      strong: known.length >= 3 ? known.slice(0, 2).filter((k) => k.norm >= 67) : [],
      weak: known.length >= 3 ? known.slice(-2).reverse().filter((k) => k.norm < 34) : [],
      risks: o.risks.filter((y) => y.prob === 3 || y.impact === 3),
    };
    r.short = r.complete < DEC_FULL || r.mustUnknown.length > 0 || r.questions.length > 0;
    return r;
  });
}
// only an option that failed none of the must-conditions and has a score can lead
const decRanked = (rows) => rows.filter((r) => !r.fails.length && r.score !== null).sort((a, b) => b.score - a.score);
function decCompare(x, weights) {
  const rows = decScores(x, weights);
  const ranked = decRanked(rows);
  const leader = ranked[0] || null, second = ranked[1] || null;
  // a small change (a fifth up or down) in one weight that would put another option first
  let flip = null;
  const w = (c) => (weights && weights[c.id] != null ? weights[c.id] : c.weight);
  if (leader && second) {
    for (const c of x.criteria.filter((y) => y.type !== 'text')) {
      for (const f of [1.2, 0.8]) {
        const ws = Object.fromEntries(x.criteria.map((y) => [y.id, w(y)]));
        ws[c.id] = w(c) * f;
        const top = decRanked(decScores(x, ws))[0];
        if (top && top.o.id !== leader.o.id) { flip = { c, up: f > 1, to: top.o }; break; }
      }
      if (flip) break;
    }
  }
  return { rows, ranked, leader, close: !!(leader && second && leader.score - second.score < DEC_CLOSE), gap: leader && second ? leader.score - second.score : null, flip };
}
function decCompareHTML(x) {
  const opts = decOpts(x), calc = x.criteria.filter((c) => c.type !== 'text');
  if (opts.length < 2 || !x.criteria.length) return '<p class="note-text">أضف خيارين على الأقل ومعياراً واحداً لتظهر المقارنة.</p>';
  const tw = ldraft.tw || {};
  const cmp = decCompare(x, tw);
  const person = decIsPerson(x), showCalc = !person || ldraft.showCalc;
  const total = calc.reduce((n, c) => n + (tw[c.id] != null ? tw[c.id] : c.weight), 0);
  const cls = (k) => (k.v === undefined ? 'unk' : k.norm === null ? '' : k.norm >= 67 ? 'good' : k.norm < 34 ? 'bad' : 'mid');
  const mustMark = { pass: ' ✓', fail: ' ✗', unknown: '', open: '' };
  const names = (ks) => ks.map((k) => k.c.name).join('، ');
  // the summary: who leads now, and every reason not to trust that too quickly
  let sum;
  if (!showCalc) {
    sum = `<div class="dec-sum"><b>قرار يتعلق بأشخاص</b><p>لا تُعرض هنا درجة إجمالية: الأرقام لا تختزل إنساناً. انظر إلى ما يتوافق وما يتعارض وما زال مجهولاً لكل خيار.</p><button type="button" class="ghost sm" data-action="dec-show-calc">أظهر الحساب</button></div>`;
  } else {
    const cautions = [];
    if (cmp.leader) {
      if (cmp.close) cautions.push(cmp.gap === 0 ? `النتيجتان الأوليان متساويتان: ${cmp.ranked[1].o.name} في نفس الدرجة` : `النتيجتان الأوليان متقاربتان: الفرق ${plural(cmp.gap, 'نقطة واحدة', 'نقطتان', 'نقاط', 'نقطة')} فقط`);
      if (cmp.leader.complete < DEC_FULL) cautions.push(`معلومات المتصدر ناقصة: اكتمالها ${cmp.leader.complete}%`);
      if (cmp.leader.mustUnknown.length) cautions.push(`لم يُعرف بعد هل يحقق المتصدر شرطه الأساسي: ${names(cmp.leader.mustUnknown)}`);
      if (cmp.leader.questions.length) cautions.push(`بقيت أسئلة قبل الحسم عن المتصدر: ${cmp.leader.questions.length}`);
      if (cmp.flip) cautions.push(`انتبه: لو ${cmp.flip.up ? 'زاد' : 'نقص'} وزن «${cmp.flip.c.name}» قليلاً لتصدّر «${cmp.flip.to.name}»`);
    }
    const failed = cmp.rows.filter((r) => r.fails.length);
    sum = `<div class="dec-sum">
      ${cmp.leader ? `<b>المتصدر حالياً: ${esc(cmp.leader.o.name)} (${cmp.leader.score} من ١٠٠)</b>` : '<b>لا يتصدّر أي خيار بعد</b><p>كل الخيارات أخفقت في شرط أساسي، أو لم تُقيَّم بعد.</p>'}
      ${cautions.length ? `<ul class="dec-cautions">${cautions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : cmp.leader ? '<p>لا تحفّظ ظاهر على هذه النتيجة، لكنها أداة لتنظيم تفكيرك لا قرار عنك.</p>' : ''}
      ${failed.length ? `<p class="dec-fail">لم يحقق شرطاً أساسياً: ${failed.map((r) => `${esc(r.o.name)} (${esc(names(r.fails))})`).join('، ')}</p>` : ''}
      ${person ? '<p class="note-text">هذا الحساب أداة لتنظيم التفكير وكشف التوافق والنقص، لا حكم على أحد.</p>' : ''}
    </div>`;
  }
  const head = `<tr><th>المعيار</th>${opts.map((o) => `<th>${esc(o.name)}</th>`).join('')}</tr>`;
  const body = x.criteria.map((c, i) => {
    const wv = tw[c.id] != null ? tw[c.id] : c.weight;
    return `<tr><th><span>${esc(c.name)}</span><small>${c.type === 'text' ? 'وصف لا يُحسب' : `الوزن ${wv} (${total ? Math.round((wv / total) * 100) : 0}%)`}${c.must ? ' | شرط أساسي' : ''}</small></th>
      ${cmp.rows.map((r) => { const k = r.cells[i]; return `<td class="${cls(k)}${k.must === 'fail' ? ' fail' : ''}">${esc(decShow(c, k.v))}${mustMark[k.must] || ''}</td>`; }).join('')}</tr>`;
  }).join('');
  const foot = `${showCalc ? `<tr class="dec-total"><th>النتيجة</th>${cmp.rows.map((r) => `<td>${r.fails.length ? 'لم يحقق شرطاً' : r.score === null ? '؟' : `${r.score} من ١٠٠`}</td>`).join('')}</tr>` : ''}
    <tr><th>اكتمال المعلومات</th>${cmp.rows.map((r) => `<td class="${r.complete < DEC_FULL ? 'unk' : ''}">${r.complete}%</td>`).join('')}</tr>
    <tr><th>الشروط الأساسية</th>${cmp.rows.map((r) => `<td>${r.fails.length ? 'لم تتحقق' : r.mustUnknown.length ? 'لم تُعرف بعد' : x.criteria.some((c) => c.must) ? 'تحققت' : 'لا شروط'}</td>`).join('')}</tr>
    <tr><th>أسئلة قبل الحسم</th>${cmp.rows.map((r) => `<td>${r.questions.length || 'لا'}</td>`).join('')}</tr>`;
  const cards = cmp.rows.map((r) => {
    const lines = [
      r.strong.length && `${person ? 'يتوافق في' : 'أبرز قوته'}: ${names(r.strong)}`,
      r.weak.length && `${person ? 'يتعارض في' : 'أبرز ضعفه'}: ${names(r.weak)}`,
      r.fails.length && `لم يحقق: ${names(r.fails)}`,
      r.missing.length && `لا يزال مجهولاً: ${r.missing.join('، ')}`,
      r.o.unknown.trim() && `ما سجّلته مجهولاً: ${excerpt(r.o.unknown.trim(), 120)}`,
      r.questions.length && `أسئلة قبل الحسم: ${r.questions.join('، ')}`,
    ].filter(Boolean);
    return `<div class="dec-ocmp"><b>${r.o.defer ? '⏸ ' : ''}${esc(r.o.name)}</b>
      ${lines.length ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${r.risks.length ? `<div class="dec-risks"><small>مخاطر جوهرية (منفصلة عن الحساب)</small><ul>${r.risks.map((y) => `<li>${esc(y.text)} <small>(الاحتمال: ${RISK_LVL[y.prob]} | الأثر: ${RISK_LVL[y.impact]})</small></li>`).join('')}</ul></div>` : ''}
    </div>`;
  }).join('');
  const changed = calc.some((c) => tw[c.id] != null && tw[c.id] !== c.weight);
  const trial = calc.length && showCalc ? `<details class="dec-trial"${changed || ldraft.trialOpen ? ' open' : ''}><summary>جرّب أوزاناً أخرى</summary>
    <p class="note-text">غيّر وزن أي معيار وانظر كيف يتغير الترتيب. لا يُحفظ شيء حتى تعتمد.</p>
    ${calc.map((c) => `<div class="dec-tw"><span>${esc(c.name)}</span><div class="seg" role="group">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-action="dec-tw" data-c="${c.id}" data-v="${n}" aria-pressed="${(tw[c.id] != null ? tw[c.id] : c.weight) === n}">${n}</button>`).join('')}</div></div>`).join('')}
    ${changed ? '<div class="btn-row"><button type="button" class="primary" data-action="dec-tw-save">اعتمد هذه الأوزان</button><button type="button" class="ghost" data-action="dec-tw-reset">أرجع</button></div>' : ''}
  </details>` : '';
  return `${sum}<div class="dec-tablewrap"><table class="dec-table"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>${cards}${trial}`;
}
function decCmpRedraw() {
  const pane = document.querySelector('#libForm [data-dtab="cmp"]');
  if (pane) pane.innerHTML = decCompareHTML(getDec(ldraft.id));
}

// ---------- an option's card ----------
function decScoreInput(c, v) {
  const unknown = v === undefined;
  if (c.type === 'score') return `<div class="seg dec-score" data-crit="${c.id}" role="group">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-action="dec-score" data-c="${c.id}" data-v="${n}" aria-pressed="${v === n}">${n}</button>`).join('')}<button type="button" data-action="dec-score" data-c="${c.id}" data-v="" aria-pressed="${unknown}">لا أعرف</button></div>`;
  if (c.type === 'yesno') return `<div class="seg dec-score" data-crit="${c.id}" role="group">${[['yes', 'نعم'], ['no', 'لا'], ['', 'لا أعرف']].map(([k, l]) => `<button type="button" data-action="dec-score" data-c="${c.id}" data-v="${k}" aria-pressed="${k ? v === k : unknown}">${l}</button>`).join('')}</div>`;
  if (c.type === 'text') return `<textarea rows="2" id="dsc-${c.id}" placeholder="اتركه فارغاً إن كنت لا تعرف">${esc(unknown ? '' : String(v))}</textarea>`;
  return `<div class="dec-num"><input type="text" inputmode="decimal" id="dsc-${c.id}" value="${unknown ? '' : esc(String(v))}" placeholder="لا أعرف" data-novoice><span>${esc(c.unit)}</span></div>`;
}
function decSrcRows() {
  return ldraft.sources.map((x, i) => `<div class="dec-row"><input type="text" id="dsrc-${i}" value="${esc(x.text)}" placeholder="من أين عرفت؟" autocomplete="off">
    <div class="seg" role="group">${Object.entries(SRC_TRUST).map(([k, l]) => `<button type="button" data-action="dec-src-trust" data-i="${i}" data-v="${k}" aria-pressed="${x.trust === k}">${l}</button>`).join('')}</div>
    <button type="button" class="fin-del" data-action="dec-src-del" data-i="${i}" aria-label="حذف">✕</button></div>`).join('');
}
function decRiskRows() {
  const lvl = (i, k, cur) => `<div class="seg" role="group">${[1, 2, 3].map((n) => `<button type="button" data-action="dec-risk-lvl" data-i="${i}" data-k="${k}" data-v="${n}" aria-pressed="${cur === n}">${RISK_LVL[n]}</button>`).join('')}</div>`;
  return ldraft.risks.map((r, i) => `<div class="dec-risk">
    <div class="row-between"><input type="text" id="drk-${i}-text" value="${esc(r.text)}" placeholder="ما الخطر؟" autocomplete="off"><button type="button" class="fin-del" data-action="dec-risk-del" data-i="${i}" aria-label="حذف">✕</button></div>
    <div class="field"><span>احتمال وقوعه</span>${lvl(i, 'prob', r.prob)}</div>
    <div class="field"><span>حجم أثره</span>${lvl(i, 'impact', r.impact)}</div>
    <label class="field"><span>كيف أقلّل أثره؟</span><input type="text" id="drk-${i}-reduce" value="${esc(r.reduce)}" autocomplete="off"></label>
    <label class="field"><span>الخطة البديلة إن وقع</span><input type="text" id="drk-${i}-plan" value="${esc(r.plan)}" autocomplete="off"></label>
  </div>`).join('');
}
// what is typed in the sources and risks is kept before their lists are redrawn
function decReadRows() {
  ldraft.sources.forEach((x, i) => { if ($(`dsrc-${i}`)) x.text = $(`dsrc-${i}`).value; });
  ldraft.risks.forEach((r, i) => { for (const k of ['text', 'reduce', 'plan']) if ($(`drk-${i}-${k}`)) r[k] = $(`drk-${i}-${k}`).value; });
}
function openDecOpt(decId, optId) {
  const x = getDec(decId);
  const o = optId ? x.opts.find((y) => y.id === optId) : normalizeOpt({});
  if (!o) return;
  ldraft = { kind: 'decopt', id: o.id, dec: decId, isNew: !optId, scores: { ...o.scores }, sources: o.sources.map((y) => ({ ...y })), risks: o.risks.map((y) => ({ ...y })), back: { kind: 'decision', id: decId, tab: 'opts' } };
  $('libForm').innerHTML = `${sheetHead(optId ? (o.defer ? `⏸ ${esc(o.name)}` : 'خيار') : 'خيار جديد')}
    <p class="note-text">${esc(x.title)}</p>
    <label class="field"><span>اسم الخيار</span><input type="text" id="oName" value="${esc(o.name)}" autocomplete="off" placeholder="مثال: عرض الشركة الأولى"></label>
    <label class="field"><span>وصفه</span><textarea id="oDesc" rows="2">${esc(o.desc)}</textarea></label>
    <label class="field"><span>مميزاته</span><textarea id="oPros" rows="2">${esc(o.pros)}</textarea></label>
    <label class="field"><span>عيوبه وتنازلاته</span><textarea id="oCons" rows="2">${esc(o.cons)}</textarea></label>
    <label class="field"><span>المعلومات المؤكدة عنه</span><textarea id="oFacts" rows="2">${esc(o.facts)}</textarea></label>
    <label class="field"><span>انطباعاتي وتقديراتي الشخصية</span><textarea id="oFeel" rows="2">${esc(o.feel)}</textarea></label>
    <label class="field"><span>ما لا يزال مجهولاً</span><textarea id="oUnknown" rows="2">${esc(o.unknown)}</textarea></label>
    <div class="field"><span>مصادر المعلومات ومدى الثقة فيها</span><div id="oSrc">${decSrcRows()}</div><button type="button" class="ghost sm" data-action="dec-src-add">${icon('plus')} مصدر</button></div>
    <div class="field"><span>تقييمه في المعايير</span>${x.criteria.length ? x.criteria.map((c) => `<div class="dec-crit-in"><b>${esc(c.name)}${c.must ? ' <small class="dec-must">شرط أساسي</small>' : ''}</b>${decScoreInput(c, o.scores[c.id])}</div>`).join('') : '<p class="note-text">أضف معايير القرار من تبويب «المعايير» لتقيّم الخيارات بها.</p>'}</div>
    <div class="field"><span>المخاطر المحتملة</span><div id="oRisks">${decRiskRows()}</div><button type="button" class="ghost sm" data-action="dec-risk-add">${icon('plus')} خطر</button></div>
    <label class="field"><span>أسئلة يجب الإجابة عنها قبل الحسم</span><textarea id="oQuestions" rows="3" placeholder="سؤال في كل سطر">${esc(o.questions)}</textarea></label>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${optId && !o.defer ? '<button type="button" class="danger" data-action="dec-opt-del">حذف</button>' : ''}</div>`;
  showLib();
  $('libForm').scrollTop = 0;
}
function saveDecOpt() {
  const x = getDec(ldraft.dec);
  if (!x) return false;
  const name = $('oName').value.trim();
  if (!name) { toast('اكتب اسم الخيار.'); return false; }
  decReadRows();
  const scores = { ...ldraft.scores };
  for (const c of x.criteria) {
    if (c.type === 'score' || c.type === 'yesno') continue;
    const el = $(`dsc-${c.id}`);
    if (!el) continue;
    const t = el.value.trim();
    if (!t) delete scores[c.id];
    else scores[c.id] = c.type === 'text' ? t : num(t);
  }
  for (const k of Object.keys(scores)) if (!x.criteria.some((c) => c.id === k)) delete scores[k];
  const old = x.opts.find((y) => y.id === ldraft.id);
  const o = normalizeOpt({ ...(old || {}), id: ldraft.id, name, desc: $('oDesc').value.trim(), pros: $('oPros').value.trim(), cons: $('oCons').value.trim(),
    facts: $('oFacts').value.trim(), feel: $('oFeel').value.trim(), unknown: $('oUnknown').value.trim(), questions: $('oQuestions').value.trim(),
    sources: ldraft.sources, risks: ldraft.risks, scores });
  if (old) Object.assign(old, o); else x.opts.push(o);
  save();
  return true;
}

// ---------- a criterion ----------
function openDecCrit(decId, critId) {
  const x = getDec(decId);
  const c = critId ? x.criteria.find((y) => y.id === critId) : normalizeCrit({});
  if (!c) return;
  ldraft = { kind: 'deccrit', id: c.id, dec: decId, isNew: !critId, weight: c.weight, type: c.type, dir: c.dir, back: { kind: 'decision', id: decId, tab: 'crit' } };
  $('libForm').innerHTML = `${sheetHead(critId ? 'معيار' : 'معيار جديد')}
    <label class="field"><span>اسم المعيار</span><input type="text" id="cName" value="${esc(c.name)}" autocomplete="off" placeholder="مثال: الراتب"></label>
    <label class="field"><span>وصفه (اختياري)</span><textarea id="cDesc" rows="2">${esc(c.desc)}</textarea></label>
    <div class="field"><span>طريقة تقييمه</span><div class="seg seg-wrap" id="cType" role="group">${Object.entries(CRIT_TYPES).map(([k, l]) => `<button type="button" data-action="dec-crit-type" data-v="${k}" aria-pressed="${c.type === k}">${l}</button>`).join('')}</div></div>
    <label class="field" id="cUnitW"><span>الوحدة</span><input type="text" id="cUnit" value="${esc(c.unit)}" autocomplete="off" placeholder="مثال: ريال، دقيقة، شهر"></label>
    <div class="field" id="cWeightW"><span>وزنه (أهميته)</span><div class="seg" id="cWeight" role="group">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-action="dec-crit-w" data-v="${n}" aria-pressed="${c.weight === n}">${n}</button>`).join('')}</div></div>
    <div class="field" id="cDirW"><span>اتجاهه</span><div class="seg" id="cDir" role="group"><button type="button" data-action="dec-crit-dir" data-v="high" aria-pressed="${c.dir === 'high'}">الأعلى أفضل</button><button type="button" data-action="dec-crit-dir" data-v="low" aria-pressed="${c.dir === 'low'}">الأقل أفضل</button></div></div>
    <label class="switch" id="cMustW"><input type="checkbox" id="cMust"${c.must ? ' checked' : ''}><span>شرط أساسي لا بد من تحققه</span></label>
    <label class="field" id="cMinW"><span id="cMinL"></span><input type="text" inputmode="decimal" id="cMin" value="${c.min === '' ? '' : c.min}" placeholder="اختياري" data-novoice></label>
    <div class="sheet-actions"><button type="submit" class="primary">حفظ</button>${critId ? '<button type="button" class="danger" data-action="dec-crit-del">حذف</button>' : ''}</div>`;
  decCritShow();
  showLib();
  $('libForm').scrollTop = 0;
}
// only the parts that belong to the way it is rated: no direction for yes/no, nothing to compute in a description
function decCritShow() {
  const t = ldraft.type, must = $('cMust').checked;
  $('cUnitW').hidden = !(t === 'money' || t === 'time');
  $('cWeightW').hidden = t === 'text';
  $('cDirW').hidden = t === 'text' || t === 'yesno';
  $('cMustW').hidden = t === 'text';
  $('cMinW').hidden = !must || t === 'text' || t === 'yesno';
  $('cMinL').textContent = ldraft.dir === 'low' ? 'الحد الأعلى المقبول' : 'الحد الأدنى المقبول';
}
function saveDecCrit() {
  const x = getDec(ldraft.dec);
  if (!x) return false;
  const name = $('cName').value.trim();
  if (!name) { toast('اكتب اسم المعيار.'); return false; }
  const t = ldraft.type, must = $('cMust').checked && t !== 'text';
  const min = must && t !== 'yesno' && $('cMin').value.trim() !== '' ? num($('cMin').value) : '';
  const old = x.criteria.find((y) => y.id === ldraft.id);
  const c = normalizeCrit({ ...(old || {}), id: ldraft.id, name, desc: $('cDesc').value.trim(), type: t, unit: $('cUnit').value.trim(), weight: ldraft.weight, dir: ldraft.dir, must, min });
  // a criterion rated another way now: ratings made the old way no longer mean anything
  if (old && old.type !== c.type) for (const o of x.opts) delete o.scores[c.id];
  if (old) Object.assign(old, c); else x.criteria.push(c);
  save();
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="dec-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  const pick = (box, key, val) => { ldraft[key] = ldraft[key] === val && key !== 'conf' ? '' : val; for (const b of $(box).children) b.setAttribute('aria-pressed', String(b.dataset.v === String(ldraft[key]))); };
  switch (action) {
    case 'dec-new': openDecision(null); break;
    case 'dec-open': openDecision(v); break;
    case 'dec-filter': decUi.filter = v; render(); break;
    case 'dec-conf': pick('dConf', 'conf', Number(v)); break;
    case 'dec-state': pick('dState', 'state', v); break;
    case 'dec-result': pick('dResult', 'result', v); break;
    case 'dec-review-now': { const id = ldraft.id; if (!saveDecision()) break; openDecision(id, true); break; }
    case 'dec-tab':
      ldraft.tab = v;
      for (const p of document.querySelectorAll('#libForm [data-dtab]')) p.hidden = p.dataset.dtab !== v;
      for (const b of $('dTabs').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      $('libForm').scrollTop = 0;
      break;
    case 'dec-tw': ldraft.tw[el.dataset.c] = Number(v); decCmpRedraw(); break;
    case 'dec-tw-reset': ldraft.tw = {}; decCmpRedraw(); break;
    case 'dec-tw-save': {
      const x = getDec(ldraft.id);
      for (const c of x.criteria) if (ldraft.tw[c.id] != null) c.weight = ldraft.tw[c.id];
      ldraft.tw = {}; save(); decCmpRedraw(); toast('اعتُمدت الأوزان الجديدة');
      break;
    }
    case 'dec-show-calc': ldraft.showCalc = true; decCmpRedraw(); break;
    case 'dec-verdict': pick('dVerdict', 'verdict', v); break;
    case 'dec-rvinfo': pick('dRvInfo', 'rvInfo', v); break;
    // a decision is made by adopting it, with its expectations written first
    case 'dec-adopt': {
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'متأكد؟ تُحفظ توقعاتك كما هي ولا تتغير بعد ذلك'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = 'اعتمد القرار'; } }, 5000); break; }
      const id = ldraft.id;
      ldraft.adopt = true;
      if (!saveDecision()) { ldraft.adopt = false; el.classList.remove('armed'); el.textContent = 'اعتمد القرار'; break; }
      render(); openDecision(id, false, 'decide'); toast('اعتُمد القرار، وحُفظت توقعاتك كما هي');
      break;
    }
    // changing an adopted decision: it is open again, and what was frozen goes to the log, not away
    case 'dec-reopen': {
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'متأكد؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = 'عدّل القرار'; } }, 4000); break; }
      const id = ldraft.id;
      if (!saveDecision()) break;
      const x = getDec(id);
      decLog(x, 'reopened', 'أُعيد فتح القرار لتعديله', x.orig);
      x.orig = null; x.status = 'thinking';
      save(); render(); openDecision(id, false, 'decide'); toast('القرار «قيد التفكير»، عدّله واعتمده من جديد');
      break;
    }
    case 'dec-rev-move': {
      const id = ldraft.id, at = $('dRevAt').value, why = $('dRevWhy').value.trim();
      const before = getDec(id).reviewAt;
      if (!at || at >= before) { toast('اختر موعداً أقرب من الموعد الحالي.'); break; }
      if (!saveDecision()) break;
      const x = getDec(id);
      decLog(x, 'review-moved', `قُدّم موعد المراجعة من ${dateBoth(before, true)} إلى ${dateBoth(at, true)}${why ? `: ${why}` : ''}`);
      x.reviewAt = at;
      save(); render(); openDecision(id); toast('قُدّم موعد المراجعة');
      break;
    }
    case 'dec-tpl-save': {
      const name = $('dTplName').value.trim();
      if (!name) { toast('اكتب اسماً للقالب.'); break; }
      const id = ldraft.id;
      if (!saveDecision()) break;
      const x = getDec(id);
      const list = decUserTpl().slice();
      const same = list.find((t) => t.name === name);
      const tpl = { id: same ? same.id : uid(), name, person: decIsPerson(x), criteria: x.criteria.map(({ id: _, ...c }) => c) };
      S.settings.decTpl = same ? list.map((t) => (t.id === same.id ? tpl : t)) : [...list, tpl];
      save(); render(); openDecision(id, false, 'crit');
      toast(same ? `عُدّل قالب «${name}»` : `حُفظ قالب «${name}»، تجده في «نوع القرار»`);
      break;
    }
    case 'dec-tpl-del': {
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'متأكد؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = '✕'; } }, 4000); break; }
      S.settings.decTpl = decUserTpl().filter((t) => t.id !== v);
      save();
      el.closest('li').remove();
      toast('حُذف القالب، والقرارات التي استعملته باقية بمعاييرها');
      break;
    }
    case 'dec-status':
      // «حُسم» is reached by adopting the decision, after writing what is expected of it
      if (v === 'decided' && ldraft.status !== 'decided') {
        for (const p of document.querySelectorAll('#libForm [data-dtab]')) p.hidden = p.dataset.dtab !== 'decide';
        for (const b of $('dTabs').children) b.setAttribute('aria-pressed', String(b.dataset.v === 'decide'));
        ldraft.tab = 'decide'; $('libForm').scrollTop = 0;
        toast('سجّل توقعاتك ثم اضغط «اعتمد القرار»');
        break;
      }
      ldraft.status = v;
      for (const b of $('dStatus').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      break;
    // an option or a criterion belongs to a saved decision: the decision is saved first, then its card opens
    case 'dec-opt-new': case 'dec-opt-open': case 'dec-crit-new': case 'dec-crit-open': {
      const id = ldraft.id, tab = ldraft.tab, scroll = $('libForm').scrollTop;
      if (!saveDecision()) break;
      render();
      if (action.startsWith('dec-opt')) openDecOpt(id, action === 'dec-opt-open' ? v : null);
      else openDecCrit(id, action === 'dec-crit-open' ? v : null);
      ldraft.back = { kind: 'decision', id, tab, scroll };
      break;
    }
    case 'dec-tpl': {
      const t = decTplOf($('dKind').value);
      if (!t) { toast('اختر نوع القرار في تبويب «القرار» أولاً.'); break; }
      const id = ldraft.id;
      if (!saveDecision()) break;
      const x = getDec(id);
      const add = t.criteria.filter((c) => !x.criteria.some((y) => y.name.trim() === c.name)).map(normalizeCrit);
      x.criteria.push(...add);
      save(); render();
      openDecision(id, false, 'crit');
      toast(add.length ? `أُضيف ${plural(add.length, 'معيار واحد', 'معياران', 'معايير', 'معياراً')}، عدّلها أو احذف ما لا يناسبك` : 'معايير هذا النوع موجودة كلها');
      break;
    }
    case 'dec-score': {
      const c = el.dataset.c;
      if (v === '') delete ldraft.scores[c]; else ldraft.scores[c] = /^\d$/.test(v) ? Number(v) : v;
      for (const b of el.parentElement.children) b.setAttribute('aria-pressed', String(b.dataset.v === (ldraft.scores[c] === undefined ? '' : String(ldraft.scores[c]))));
      break;
    }
    case 'dec-src-add': decReadRows(); ldraft.sources.push({ id: uid(), text: '', trust: 'mid' }); $('oSrc').innerHTML = decSrcRows(); $(`dsrc-${ldraft.sources.length - 1}`).focus(); break;
    case 'dec-src-del': decReadRows(); ldraft.sources.splice(+el.dataset.i, 1); $('oSrc').innerHTML = decSrcRows(); break;
    case 'dec-src-trust': ldraft.sources[+el.dataset.i].trust = v; for (const b of el.parentElement.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'dec-risk-add': decReadRows(); ldraft.risks.push({ id: uid(), text: '', prob: 2, impact: 2, reduce: '', plan: '' }); $('oRisks').innerHTML = decRiskRows(); $(`drk-${ldraft.risks.length - 1}-text`).focus(); break;
    case 'dec-risk-del': decReadRows(); ldraft.risks.splice(+el.dataset.i, 1); $('oRisks').innerHTML = decRiskRows(); break;
    case 'dec-risk-lvl': ldraft.risks[+el.dataset.i][el.dataset.k] = Number(v); for (const b of el.parentElement.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'dec-crit-type': ldraft.type = v; for (const b of $('cType').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); decCritShow(); break;
    case 'dec-crit-w': ldraft.weight = Number(v); for (const b of $('cWeight').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); break;
    case 'dec-crit-dir': ldraft.dir = v; for (const b of $('cDir').children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); decCritShow(); break;
    // deleting an option or a criterion asks «متأكد؟» first; a criterion takes its ratings with it
    case 'dec-opt-del': case 'dec-crit-del': {
      if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'متأكد؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = 'حذف'; } }, 4000); break; }
      const x = getDec(ldraft.dec), id = ldraft.id, back = ldraft.back;
      if (action === 'dec-opt-del') x.opts = x.opts.filter((o) => o.id !== id);
      else { x.criteria = x.criteria.filter((c) => c.id !== id); for (const o of x.opts) delete o.scores[id]; }
      save(); closeLib(); render(); libBack(back); toast('حُذف');
      break;
    }
    case 'dec-later': {
      const x = getDec(ldraft.id);
      x.reviewAt = addDays(today(), 30);
      save(); closeLib(); render(); toast('سأذكّرك بعد شهر');
      break;
    }
  }
});

document.addEventListener('input', (e) => {
  const id = e.target.id;
  if (id === 'dDeadline' && $('dDeadW')) $('dDeadW').hidden = !e.target.value;
});
// the weight trial stays open while it is being used, though the comparison redraws
document.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('dec-trial') && ldraft) ldraft.trialOpen = e.target.open; }, true);
document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (id === 'dKind') $('dKindNameW').hidden = e.target.value !== 'custom';
  if (id === 'dDeadOn') $('dDeadDaysW').hidden = !e.target.checked;
  if (id === 'cMust') decCritShow();
});

Object.assign(LibraryViews, { decisions: viewDecisions });
