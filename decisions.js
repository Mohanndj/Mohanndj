'use strict';
// «سجل القرارات»: write a decision down with its reasons, what you expect and how sure you are;
// the app brings it back after the period you choose to ask what really happened and what you learnt.
// Over time it shows how often you were right and whether your confidence matches your accuracy.

const DEC_STATE = { calm: 'هادئ', tired: 'متعب', stressed: 'متوتر', excited: 'متحمس', rushed: 'مستعجل' };
const DEC_AFTER = [[30, 'بعد شهر'], [90, 'بعد ٣ أشهر'], [180, 'بعد ٦ أشهر'], [365, 'بعد سنة']];
const DEC_RESULT = { right: ['أصبت', '✅'], mixed: ['بين بين', '➖'], wrong: ['أخطأت', '❌'] };
const decUi = { filter: 'open' };

function normalizeDecision(x) {
  return {
    id: x.id || uid(), title: String(x.title || ''), date: x.date || today(), context: String(x.context || ''),
    options: String(x.options || ''), reasons: String(x.reasons || ''), expect: String(x.expect || ''),
    confidence: [50, 60, 70, 80, 90].includes(Number(x.confidence)) ? Number(x.confidence) : 70,
    state: DEC_STATE[x.state] ? x.state : '', reviewAt: x.reviewAt || addDays(x.date || today(), 90),
    outcome: String(x.outcome || ''), result: DEC_RESULT[x.result] ? x.result : '', lesson: String(x.lesson || ''),
    reviewedAt: x.reviewedAt || '', created: x.created || Date.now(),
  };
}
const getDec = (id) => S.decisions.find((x) => x.id === id);
const decDue = () => S.decisions.filter((x) => !x.reviewedAt && x.reviewAt <= today());

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
  const list = S.decisions.filter((x) => (decUi.filter === 'open' ? !x.reviewedAt : decUi.filter === 'done' ? !!x.reviewedAt : true))
    .sort((a, b) => (decUi.filter === 'open' ? a.reviewAt.localeCompare(b.reviewAt) : b.date.localeCompare(a.date)));
  const st = decStats();
  const seg = [['open', `تنتظر النتيجة ${S.decisions.filter((x) => !x.reviewedAt).length}`], ['done', `روجعت ${st.n}`], ['all', 'الكل']]
    .map(([v, l]) => `<button type="button" data-action="dec-filter" data-v="${v}" aria-pressed="${decUi.filter === v}">${l}</button>`).join('');
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>سجل القرارات</h2><div class="btn-row">${S.decisions.length ? xlsBtn('decisions') : ''}${addBtn('dec-new', 'قرار')}</div></div>
    ${st.n ? `<div class="j-stats"><span><b>${st.acc}%</b> نسبة الإصابة</span><span><b>${st.conf}%</b> متوسط ثقتك</span><span><b>${st.n}</b> قرار روجع</span></div>
      <p class="note-text">${st.n < 3 ? 'تتضح الصورة بعد مراجعة ثلاثة قرارات أو أكثر.' : Math.abs(st.acc - st.conf) <= 10 ? 'ثقتك تطابق نتائجك تقريباً، تقديرك لنفسك دقيق.' : st.conf > st.acc ? 'ثقتك أعلى من نتائجك: تمهّل واستشر أكثر قبل القرارات الكبيرة.' : 'نتائجك أفضل من ثقتك: ثق بحكمك أكثر.'}${st.worst ? ` أكثر قراراتك الخاطئة اتخذتها وأنت ${st.worst}.` : ''}</p>` : ''}
    ${due.length ? `<div class="dec-due"><b>حان وقت مراجعة ${due.length === 1 ? 'قرار' : `${due.length} قرارات`}</b><small>ماذا حدث فعلاً؟ وماذا تعلّمت؟</small></div>` : ''}
    ${S.decisions.length ? `<div class="seg" role="group" aria-label="عرض">${seg}</div>` : ''}
    ${list.length ? `<div class="book-list">${list.map(decCard).join('')}</div>`
      : S.decisions.length ? emptyHTML('لا شيء هنا', 'غيّر التصفية.')
        : emptyHTML('سجّل قراراتك المهمة', 'حين تتخذ قراراً مهماً: اكتب لماذا اخترته وماذا تتوقع، وكم أنت واثق. بعد المدة التي تحددها يسألك التطبيق: هل أصبت؟ ومع الوقت تعرف متى تصيب قراراتك ومتى تخطئ.', addBtn('dec-new', 'أول قرار'))}
  </section>`;
}

// ---------- editor (and review) ----------
function openDecision(id, review) {
  const x = id ? getDec(id) : normalizeDecision({});
  const rv = review || (id && (x.reviewedAt || x.reviewAt <= today()));
  const after = id ? daysBetween(x.date, x.reviewAt) : 90;
  ldraft = { kind: 'decision', id: x.id, isNew: !id, conf: x.confidence, state: x.state, result: x.result, review: rv, after };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? (rv ? 'مراجعة القرار' : 'القرار') : 'قرار جديد'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${rv ? `<div class="dec-review">
      <h3>${esc(x.title)}</h3>
      <dl class="habit-plan">
        ${x.context ? `<div><dt>الموقف</dt><dd>${esc(x.context)}</dd></div>` : ''}
        ${x.reasons ? `<div><dt>لماذا اخترته</dt><dd>${esc(x.reasons)}</dd></div>` : ''}
        ${x.expect ? `<div><dt>ما توقعته</dt><dd>${esc(x.expect)}</dd></div>` : ''}
        <div><dt>ثقتي</dt><dd>${x.confidence}% | ${esc(dateBoth(x.date, true))}${x.state ? ` | كنت ${DEC_STATE[x.state]}` : ''}</dd></div>
      </dl>
      <label class="field"><span>ماذا حدث فعلاً؟</span><textarea id="dOutcome" rows="3">${esc(x.outcome)}</textarea></label>
      <div class="field"><span>هل أصبت؟</span><div class="seg" id="dResult" role="group">${Object.entries(DEC_RESULT).map(([k, v]) => `<button type="button" data-action="dec-result" data-v="${k}" aria-pressed="${x.result === k}">${v[1]} ${v[0]}</button>`).join('')}</div></div>
      <label class="field"><span>ماذا تعلّمت؟</span><textarea id="dLesson" rows="3" placeholder="ما الذي ستفعله بشكل مختلف في المرة القادمة؟">${esc(x.lesson)}</textarea></label>
      ${x.reviewedAt ? '' : '<button type="button" class="ghost" data-action="dec-later">ليس بعد، ذكّرني بعد شهر</button>'}
      <details class="howto"><summary>تعديل تفاصيل القرار</summary>` : ''}
    <label class="field"><span>ما القرار؟</span><input type="text" id="dTitle" value="${esc(x.title)}" autocomplete="off" placeholder="مثال: الانتقال إلى وظيفة جديدة"></label>
    <label class="field"><span>التاريخ</span><input type="date" id="dDate" value="${x.date}"></label>
    <label class="field"><span>الموقف</span><textarea id="dContext" rows="2" placeholder="ما الذي استدعى هذا القرار؟">${esc(x.context)}</textarea></label>
    <label class="field"><span>البدائل التي فكرت فيها</span><textarea id="dOptions" rows="2">${esc(x.options)}</textarea></label>
    <label class="field"><span>لماذا اخترت هذا؟</span><textarea id="dReasons" rows="3">${esc(x.reasons)}</textarea></label>
    <label class="field"><span>ماذا أتوقع أن يحدث؟</span><textarea id="dExpect" rows="2" placeholder="كن محدداً، لتعرف لاحقاً هل أصبت">${esc(x.expect)}</textarea></label>
    <div class="field"><span>كم أنا واثق؟</span><div class="seg" id="dConf" role="group">${[50, 60, 70, 80, 90].map((c) => `<button type="button" data-action="dec-conf" data-v="${c}" aria-pressed="${x.confidence === c}">${c}%</button>`).join('')}</div></div>
    <div class="field"><span>حالتي وأنا أقرر</span><div class="seg seg-wrap" id="dState" role="group">${Object.entries(DEC_STATE).map(([k, v]) => `<button type="button" data-action="dec-state" data-v="${k}" aria-pressed="${x.state === k}">${v}</button>`).join('')}</div></div>
    <label class="field"><span>راجعني</span><select id="dAfter">${DEC_AFTER.map(([d, l]) => `<option value="${d}"${Math.abs(after - d) < 5 ? ' selected' : ''}>${l}</option>`).join('')}${DEC_AFTER.some(([d]) => Math.abs(after - d) < 5) ? '' : `<option value="${after}" selected>${afterDays(after)}</option>`}</select></label>
    ${rv ? '</details></div>' : ''}
    <div class="sheet-actions">
      <button type="submit" class="primary">${rv && !x.reviewedAt ? 'احفظ المراجعة' : 'حفظ'}</button>
      ${id && !rv ? '<button type="button" class="ghost" data-action="dec-review-now">راجعه الآن</button>' : ''}
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function saveDecision() {
  const title = $('dTitle').value.trim();
  if (!title) { toast('اكتب القرار.'); return false; }
  const old = getDec(ldraft.id);
  const date = $('dDate').value || today();
  const x = normalizeDecision({
    ...(old || {}), id: ldraft.id, title, date, context: $('dContext').value.trim(), options: $('dOptions').value.trim(),
    reasons: $('dReasons').value.trim(), expect: $('dExpect').value.trim(), confidence: ldraft.conf, state: ldraft.state,
  });
  // the review date follows the chosen period, unless nothing changed (keeps a «later» postponement)
  const after = +$('dAfter').value;
  x.reviewAt = old && old.date === date && after === ldraft.after ? old.reviewAt : addDays(date, after);
  if (ldraft.review) {
    x.outcome = $('dOutcome').value.trim();
    x.lesson = $('dLesson').value.trim();
    x.result = ldraft.result;
    if (x.result && !x.reviewedAt) x.reviewedAt = today();
    if (!x.result && (x.outcome || x.lesson)) { toast('اختر: هل أصبت أم أخطأت؟'); return false; }
  }
  if (old) Object.assign(old, x); else S.decisions.push(x);
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
    case 'dec-later': {
      const x = getDec(ldraft.id);
      x.reviewAt = addDays(today(), 30);
      save(); closeLib(); render(); toast('سأذكّرك بعد شهر');
      break;
    }
  }
});

Object.assign(LibraryViews, { decisions: viewDecisions });
