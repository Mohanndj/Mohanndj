'use strict';
// «الاختبارات» in a science of «الدراسة»: tests imported from text or files (written by an AI model in a
// unified format the app reads), taken inside the app, graded against the answer key that came with them,
// and every attempt kept with its date and score. Tests live inside their science (S.study[].quizzes), so
// backup, sync and wiping already carry them. What the reader cannot understand is reported, never guessed.

const QZ_LET = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
const QZ_TYPES = { mc: 'اختيار من متعدد', tf: 'صح وخطأ', text: 'إجابة نصية' };
const QZ_SORTS = { new: 'الأحدث', name: 'الاسم', todo: 'لم تحلّه أولاً', low: 'الأدنى نتيجة', best: 'الأعلى نتيجة' };
// the format to give an AI model (also shown in the import sheet)
const QZ_PROMPT = `اكتب لي اختباراً في: [اكتب هنا العلم والموضوع وعدد الأسئلة]
اكتبه بهذا التنسيق حرفياً، دون أي كلام قبله أو بعده:

العنوان: اسم الاختبار
الموضوع: موضوعه

س١: نص سؤال اختيار من متعدد
أ) الاختيار الأول
ب) الاختيار الثاني
ج) الاختيار الثالث
د) الاختيار الرابع
الإجابة: ب
التوضيح: لماذا كانت هذه الإجابة هي الصحيحة

س٢: نص سؤال صح أو خطأ
النوع: صح وخطأ
الإجابة: خطأ
التوضيح: ...

س٣: نص سؤال إجابته كتابة
النوع: نصي
الإجابة: الإجابة النموذجية
الكلمات: ما يجب أن تتضمنه الإجابة لتُعدّ صحيحة، مفصولاً بفواصل

القواعد: لكل سؤال اختيار من متعدد إجابة واحدة بحرفها. اترك سطراً فارغاً بين الأسئلة.`;

// ---------- text helpers ----------
const qzDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
// for comparing answers: no diacritics or tatweel, one form of alef, ya and ta marbuta, no punctuation
const qzNorm = (s) => qzDigits(s).replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
// words without «ال» and its joined prefixes, so «النظافة» is found in «نظافة البدن»
const qzWords = (s, joined) => ` ${qzNorm(s).split(' ').map((w) => { const x = w.replace(/^(وال|بال|كال|فال|لل|ال)(?=\S\S)/, ''); return joined && x === w ? x.replace(/^[وفبلك](?=\S\S\S)/, '') : x; }).join(' ')} `;
// a required word is found as written, or with a joined «و ف ب ل ك» before it («ونزاهة» has «نزاهة»)
const qzHas = (a, k) => qzWords(a).includes(qzWords(k)) || qzWords(a, true).includes(qzWords(k));
const QZ_T = ['صح', 'صحيح', 'صحيحه', 'صواب', 'نعم', 'true', 't'];
const QZ_F = ['خطا', 'خاطي', 'خاطئ', 'خاطيه', 'خاطئه', 'غلط', 'لا', 'false', 'f'];
const qzBool = (s) => { const w = qzNorm(s).split(' ')[0] || ''; return QZ_T.includes(w) ? true : QZ_F.includes(w) ? false : null; };
const QZ_LETTER = '(?:هـ|[أابتثجحخدذرزسشصضطظعغفقكلمنهوي]|[a-h])';

// ---------- reading a test (the unified text format, or JSON) ----------
const QZ_RX = {
  title: /^(?:عنوان الاختبار|اسم الاختبار|العنوان)\s*[:：]\s*(.+)$/,
  topic: /^(?:الموضوع|الباب|الدرس)\s*[:：]\s*(.+)$/,
  keyHead: /^(?:مفتاح الإجابات|مفتاح الاجابات|الإجابات الصحيحة|الاجابات الصحيحة|الإجابات|الاجابات|النموذج المعياري|نموذج الإجابة|نموذج الاجابة|الحلول)\s*[:：]?\s*$/,
  q: /^(?:(?:س|سؤال|السؤال)\s*([0-9٠-٩]+)\s*[:：\-–.)]?\s*|(?:س|سؤال|السؤال)\s*[:：\-–]\s*|([0-9٠-٩]+)\s*[-–.)]\s*|q\s*([0-9]*)\s*[:.)-]\s*)(.*)$/i,
  type: /^(?:النوع|نوع السؤال)\s*[:：]\s*(.+)$/,
  ans: /^(?:الإجابة الصحيحة|الاجابة الصحيحة|الإجابة النموذجية|الاجابة النموذجية|الإجابة|الاجابة|الجواب|ج|answer)\s*[:：]\s*(.*)$/i,
  exp: /^(?:التوضيح|الشرح|التعليل|السبب|التفسير|explanation)\s*[:：]\s*(.*)$/i,
  keys: /^(?:الكلمات المفتاحية|الكلمات المطلوبة|الكلمات|معيار التصحيح|المعيار|عناصر الإجابة)\s*[:：]\s*(.*)$/,
  opt: new RegExp(`^[(\\[]?\\s*(${QZ_LETTER})\\s*[)\\]\\-–.]\\s*(.+)$`, 'i'),
  bullet: /^[-•*▪◦]\s*(.+)$/,
};
// an option marked as the right one inside the list: «✓» or «(صحيح)» after it
const QZ_MARK = /\s*(?:✓|✔|\((?:صحيح|الصحيح|الإجابة الصحيحة|الاجابة الصحيحة|correct)\)|\*)\s*$/i;

function qzParse(text) {
  const raw = String(text || '').replace(/^﻿/, '').replace(/```(?:json)?/gi, '').trim();
  if (/^[[{]/.test(raw)) { try { return qzFromJSON(JSON.parse(raw)); } catch { /* not JSON after all: read it as text */ } }
  const out = { title: '', topic: '', items: [], stray: [] };
  const keyMap = {};
  let cur = null, last = '', keyMode = false;
  const clean = (l) => l.replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/\*\*|__/g, '').replace(/^#+\s*/, '').trim();
  for (const line0 of raw.replace(/\r/g, '').split('\n')) {
    const line = clean(line0);
    if (!line) { if (last !== 'q') last = ''; continue; }
    let m;
    if (keyMode) {
      const pairs = [...qzDigits(line).matchAll(/(?:س\s*)?([0-9]+)\s*[-–.):：=]\s*([^0-9،,؛|]+)/g)];
      if (pairs.length) { for (const p of pairs) keyMap[+p[1]] = p[2].trim(); continue; }
      keyMode = false;
    }
    if (QZ_RX.keyHead.test(line)) { keyMode = true; cur = null; last = ''; continue; }
    if (!cur && (m = line.match(QZ_RX.title))) { out.title = m[1].trim(); continue; }
    if (!cur && (m = line.match(QZ_RX.topic))) { out.topic = m[1].trim(); continue; }
    if ((m = line.match(QZ_RX.q)) && (m[4] || '').trim()) {
      const no = m[1] || m[2] || m[3];
      cur = { no: no ? +qzDigits(no) : 0, q: m[4].trim(), opts: [], type: '', ansRaw: '', hasAns: false, exp: '', keys: [], marked: -1 };
      out.items.push(cur); last = 'q';
      continue;
    }
    if (!cur) { out.stray.push(line); continue; }
    if ((m = line.match(QZ_RX.type))) { cur.type = m[1]; last = ''; continue; }
    if ((m = line.match(QZ_RX.ans))) { cur.ansRaw = m[1].trim(); cur.hasAns = true; last = 'ans'; continue; }
    if ((m = line.match(QZ_RX.exp))) { cur.exp = m[1].trim(); last = 'exp'; continue; }
    if ((m = line.match(QZ_RX.keys))) { cur.keys = m[1].split(/[،,؛;]+/).map((x) => x.trim()).filter(Boolean); last = ''; continue; }
    const choosing = !cur.hasAns && !cur.exp;
    if (choosing && QZ_RX.opt.test(line)) {
      // several options on one line: «أ) طهور ب) طاهر ج) نجس»
      for (const part of line.split(new RegExp(`\\s+(?=[(\\[]?${QZ_LETTER}\\s*\\)\\s)`, 'i'))) {
        const o = part.match(QZ_RX.opt);
        if (!o) { cur.opts.length ? (cur.opts[cur.opts.length - 1].text += ` ${part}`) : out.stray.push(part); continue; }
        let t = o[2].trim();
        if (QZ_MARK.test(t)) { t = t.replace(QZ_MARK, ''); cur.marked = cur.marked === -1 ? cur.opts.length : -2; }
        cur.opts.push({ label: o[1], text: t });
      }
      last = 'opt';
      continue;
    }
    if (choosing && (m = line.match(QZ_RX.bullet))) {
      let t = m[1].trim();
      if (QZ_MARK.test(t)) { t = t.replace(QZ_MARK, ''); cur.marked = cur.marked === -1 ? cur.opts.length : -2; }
      cur.opts.push({ label: '', text: t }); last = 'opt';
      continue;
    }
    if (last === 'exp') cur.exp += ` ${line}`;
    else if (last === 'ans') cur.ansRaw += ` ${line}`;
    else if (last === 'q') cur.q += ` ${line}`;
    else if (last === 'opt' && cur.opts.length) cur.opts[cur.opts.length - 1].text += ` ${line}`;
    else out.stray.push(line);
  }
  // an answer key at the end fills the questions that have none, by their number
  out.items.forEach((c, i) => { const n = c.no || i + 1; if (!c.hasAns && keyMap[n] !== undefined) { c.ansRaw = keyMap[n]; c.hasAns = true; } });
  return { title: out.title, topic: out.topic, qs: out.items.map(qzResolve), stray: out.stray };
}

function qzFromJSON(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data.questions) ? data.questions : [];
  const items = list.filter((x) => x && typeof x === 'object').map((x, i) => {
    const opts = (Array.isArray(x.options) ? x.options : Array.isArray(x.choices) ? x.choices : []).map((o) => {
      const t = String(o && typeof o === 'object' ? o.text || o.label || '' : o).trim();
      const m = t.match(QZ_RX.opt);
      return m ? { label: m[1], text: m[2].trim() } : { label: '', text: t };
    });
    const c = { no: i + 1, q: String(x.question || x.q || x.text || '').trim(), opts, type: String(x.type || ''), ansRaw: '', hasAns: false, exp: String(x.explanation || x.explain || x.reason || '').trim(), keys: (Array.isArray(x.keywords) ? x.keywords : typeof x.keywords === 'string' ? x.keywords.split(/[،,]+/) : []).map((k) => String(k).trim()).filter(Boolean), marked: -1 };
    const idx = x.answer_index ?? x.answerIndex ?? x.correct_index ?? x.correctIndex;
    const a = x.answer ?? x.correct ?? x.correct_answer ?? x.model_answer;
    if (Number.isInteger(idx)) { c.marked = idx >= 0 && idx < opts.length ? idx : -3; c.hasAns = true; }
    else if (typeof a === 'boolean') { c.ansRaw = a ? 'صح' : 'خطأ'; c.hasAns = true; c.type = c.type || 'tf'; }
    // a bare number: counted from zero or from one? not guessed
    else if (typeof a === 'number') { c.hasAns = true; c.marked = -4; }
    else if (a !== undefined && a !== null) { c.ansRaw = String(a).trim(); c.hasAns = !!c.ansRaw; }
    return c;
  });
  return { title: String((!Array.isArray(data) && (data.title || data.name)) || '').trim(), topic: String((!Array.isArray(data) && data.topic) || '').trim(), qs: items.map(qzResolve), stray: [] };
}

// one read question → { type, q, opts, ans, keys, explain, bad }: bad says what could not be understood
function qzResolve(c) {
  const q = { id: uid(), type: '', q: c.q.trim(), opts: c.opts.map((o) => o.text.trim()), ans: null, keys: c.keys, explain: c.exp.trim(), bad: '' };
  const t = qzNorm(c.type);
  const tfOpts = q.opts.length === 2 && q.opts.every((o) => qzBool(o) !== null) && qzBool(q.opts[0]) !== qzBool(q.opts[1]);
  q.type = /صح|خطا/.test(t) ? 'tf' : /نص|مقال|قصير|كتاب|اكمل|اذكر|عرف/.test(t) ? 'text' : /اختيار|متعدد/.test(t) ? 'mc'
    : tfOpts ? 'tf' : q.opts.length ? 'mc' : /صح\s*(ام|او)\s*خط/.test(qzNorm(q.q)) || (c.hasAns && qzBool(c.ansRaw) !== null && qzNorm(c.ansRaw).split(' ').length === 1) ? 'tf' : 'text';
  const r = c.ansRaw.trim();
  if (!q.q) q.bad = 'السؤال بلا نص';
  else if (q.type === 'tf') {
    if (tfOpts && c.marked >= 0) q.ans = qzBool(q.opts[c.marked]);
    else if (!c.hasAns || !r) q.bad = 'لم أجد إجابة هذا السؤال';
    else if (qzBool(r) === null) q.bad = `لم أفهم الإجابة «${r}»: المتوقع صح أو خطأ`;
    else q.ans = qzBool(r);
    q.opts = [];
  } else if (q.type === 'mc') {
    let ix = null;
    if (q.opts.length < 2) q.bad = 'فيه أقل من اختيارين';
    else if (c.marked === -2) q.bad = 'عُلّم فيه أكثر من اختيار صحيح';
    else if (c.marked === -3) q.bad = 'رقم الإجابة خارج الاختيارات';
    else if (c.marked === -4) q.bad = 'الإجابة رقم بلا بيان: هل العدّ من صفر أم من واحد؟';
    else if (c.marked >= 0) ix = c.marked;
    else if (!c.hasAns || !r) q.bad = 'لم أجد إجابة هذا السؤال';
    else {
      const two = new RegExp(`^[(\\[]?\\s*${QZ_LETTER}\\s*[)\\]]?\\s*(?:،|,|و|and|&|\\+)\\s*[(\\[]?\\s*${QZ_LETTER}\\s*[)\\]]?\\s*$`, 'i');
      const lm = r.match(new RegExp(`^[(\\[]?\\s*(${QZ_LETTER})\\s*(?:[)\\]\\-–.:]|$)`, 'i'));
      const num = qzDigits(r).match(/^\(?\s*([0-9]+)\s*\)?$/);
      if (two.test(r)) q.bad = 'له أكثر من إجابة واحدة';
      else if (lm && (r.length <= 3 || /[)\]\-–.:]/.test(r.slice(0, 4)))) {
        const L = qzNorm(lm[1]);
        if (c.opts.some((o) => o.label)) { const k = c.opts.findIndex((o) => o.label && qzNorm(o.label) === L); if (k >= 0) ix = k; else q.bad = `الإجابة «${r}» لا تطابق حرف أي اختيار`; }
        else q.bad = `الإجابة «${r}» حرف، والاختيارات بلا حروف`;
      } else if (num) { const k = +num[1] - 1; if (k >= 0 && k < q.opts.length) ix = k; else q.bad = `الإجابة «${r}» خارج الاختيارات`; }
      else { const k = q.opts.map(qzNorm).indexOf(qzNorm(r)); if (k >= 0) ix = k; else q.bad = `الإجابة «${r}» لا تطابق أي اختيار`; }
    }
    if (ix !== null) q.ans = ix;
  } else {
    q.opts = [];
    if (!c.hasAns || !r) q.bad = 'لم أجد الإجابة النموذجية';
    else q.ans = r;
  }
  return q;
}

// a test as the unified text, to edit it the same way it was imported
function qzText(z) {
  const L = [];
  if (z.title) L.push(`العنوان: ${z.title}`);
  if (z.topic) L.push(`الموضوع: ${z.topic}`);
  z.qs.forEach((q, i) => {
    L.push('', `س${i + 1}: ${q.q}`);
    if (q.type === 'mc') q.opts.forEach((o, j) => L.push(`${QZ_LET[j] || j + 1}) ${o}`));
    if (q.type === 'tf') L.push('النوع: صح وخطأ');
    if (q.type === 'text') L.push('النوع: نصي');
    if (q.ans !== null && q.ans !== '') L.push(`الإجابة: ${q.type === 'mc' ? QZ_LET[q.ans] || q.ans + 1 : q.type === 'tf' ? (q.ans ? 'صح' : 'خطأ') : q.ans}`);
    if (q.keys.length) L.push(`الكلمات: ${q.keys.join('، ')}`);
    if (q.explain) L.push(`التوضيح: ${q.explain}`);
  });
  return L.join('\n').trim();
}

// ---------- data ----------
function normalizeQQ(q) {
  const type = QZ_TYPES[q.type] ? q.type : 'text';
  const opts = type === 'mc' ? (Array.isArray(q.opts) ? q.opts.map((o) => String(o)) : []) : [];
  let ans = q.ans ?? null;
  if (type === 'mc') ans = Number.isInteger(ans) && ans >= 0 && ans < opts.length ? ans : null;
  else if (type === 'tf') ans = typeof ans === 'boolean' ? ans : null;
  else ans = typeof ans === 'string' && ans.trim() ? ans : null;
  return {
    id: q.id || uid(), type, q: String(q.q || ''), opts, ans, keys: (Array.isArray(q.keys) ? q.keys : []).map(String).filter((k) => k.trim()), explain: String(q.explain || ''),
    bad: String(q.bad || '') || (ans === null ? 'لم أجد إجابة هذا السؤال' : ''),
  };
}
function normalizeAttempt(a) {
  const res = {};
  for (const [k, v] of Object.entries(a.res && typeof a.res === 'object' ? a.res : {})) res[k] = v === null ? null : Math.max(0, Math.min(1, Number(v) || 0));
  return { id: a.id || uid(), at: Number(a.at) || Date.now(), d: stDate(a.d) || today(), ans: a.ans && typeof a.ans === 'object' ? a.ans : {}, res, total: Math.max(0, Number(a.total) || 0), score: qzSum(res) };
}
const qzSum = (res) => Math.round(Object.values(res).reduce((s, v) => s + (v || 0), 0) * 100) / 100;
function normalizeQuiz(z) {
  return {
    id: z.id || uid(), title: String(z.title || ''), topic: String(z.topic || ''), qs: stList(z.qs, normalizeQQ), attempts: stList(z.attempts, normalizeAttempt),
    created: z.created || Date.now(), updated: z.updated || Date.now(),
  };
}
const qzGood = (z) => z.qs.filter((q) => !q.bad);
const qzPct = (a) => (a.total ? Math.round((a.score / a.total) * 100) : 0);
const qzLast = (z) => z.attempts[z.attempts.length - 1] || null;
const qzBest = (z) => (z.attempts.length ? Math.max(...z.attempts.map(qzPct)) : null);
const qzTone = (p) => (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'bad');
// a lone «٠» reads like a dot: zero is written «صفر»
const qzZ = (n) => (n ? String(n) : 'صفر');
const qzScoreTxt = (a) => `${qzZ(a.score)} من ${a.total} (${qzPct(a)}٪)`;
const qzPend = (a) => Object.values(a.res).filter((v) => v === null).length;
const getQuiz = (s, id) => (s ? s.quizzes.find((z) => z.id === id) : null);

// grading one answer against the key: 1 right, 0 wrong, a part for a written answer with required words,
// or null when a written answer has no required words and differs from the model: you judge it
function qzGrade(q, a) {
  if (a === undefined || a === null || a === '') return 0;
  if (q.type !== 'text') return a === q.ans ? 1 : 0;
  if (q.keys.length) return Math.round((q.keys.filter((k) => qzHas(a, k)).length / q.keys.length) * 100) / 100;
  return qzNorm(a) === qzNorm(q.ans) ? 1 : null;
}

// ---------- the section in the science page ----------
function quizSectionHTML(s) {
  const all = s.quizzes;
  const topics = [...new Set(all.map((z) => z.topic.trim()).filter(Boolean))];
  if (studyUi.qtopic && !topics.includes(studyUi.qtopic)) studyUi.qtopic = '';
  const q = qzNorm(studyUi.qq || '');
  let list = all.filter((z) => (!studyUi.qtopic || z.topic.trim() === studyUi.qtopic) && (!q || qzNorm([z.title, z.topic, ...z.qs.map((x) => x.q)].join(' ')).includes(q)));
  const sort = QZ_SORTS[studyUi.qsort] ? studyUi.qsort : 'new';
  const lastPct = (z) => (qzLast(z) ? qzPct(qzLast(z)) : -1);
  list = list.slice().sort(sort === 'name' ? (a, b) => a.title.localeCompare(b.title, 'ar') : sort === 'todo' ? (a, b) => a.attempts.length - b.attempts.length || b.created - a.created
    : sort === 'low' ? (a, b) => (lastPct(a) < 0) - (lastPct(b) < 0) || lastPct(a) - lastPct(b) : sort === 'best' ? (a, b) => lastPct(b) - lastPct(a) : (a, b) => b.created - a.created);
  const card = (z) => {
    const a = qzLast(z), nBad = z.qs.length - qzGood(z).length;
    return `<button type="button" class="st-quiz" data-action="qz-open" data-v="${z.id}">
      <span class="st-quiz-top"><strong>${esc(z.title || 'اختبار بلا اسم')}</strong>${a ? `<span class="qz-badge ${qzTone(qzPct(a))}">${qzPct(a)}٪</span>` : '<span class="qz-badge none">لم تحلّه</span>'}</span>
      <span class="book-line">${[z.topic ? `الموضوع: ${z.topic}` : '', `الأسئلة: ${qzGood(z).length}`, z.attempts.length ? `المحاولات: ${z.attempts.length}` : ''].filter(Boolean).map(esc).join(' | ')}</span>
      ${a ? `<span class="book-line">${esc([`آخر نتيجة: ${qzScoreTxt(a)}`, `في ${relDate(a.d)}`].join(' | '))}</span>` : ''}
      ${nBad ? `<small class="late">${esc(`أسئلة تحتاج إكمالاً: ${nBad}`)}</small>` : ''}
    </button>`;
  };
  return `<section class="section st-sec">
    <div class="section-head"><h2>الاختبارات${all.length ? ` <small>(${all.length})</small>` : ''}</h2>${addBtn('qz-new', 'استورد اختباراً')}</div>
    ${all.length > 1 ? `<div class="qz-tools"><input type="search" id="qzSearch" value="${esc(studyUi.qq || '')}" placeholder="ابحث في الاختبارات" autocomplete="off" data-novoice>
      <select id="qzSort" aria-label="الترتيب">${Object.entries(QZ_SORTS).map(([k, v]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      ${topics.length > 1 ? `<div class="chips" role="group" aria-label="الموضوعات"><button type="button" class="chip" data-action="qz-topic" data-v="" aria-pressed="${!studyUi.qtopic}">الكل</button>${topics.map((t) => `<button type="button" class="chip" data-action="qz-topic" data-v="${esc(t)}" aria-pressed="${studyUi.qtopic === t}">${esc(t)}</button>`).join('')}</div>` : ''}` : ''}
    ${all.length ? (list.length ? `<div class="qz-list">${list.map(card).join('')}</div>` : '<p class="note-text">لا اختبار يطابق البحث.</p>')
      : `<p class="note-text">استورد اختباراً كتبه لك الذكاء الاصطناعي، من نص تلصقه أو ملف، ثم حلّه هنا ويُصحَّح لك.</p>`}
  </section>`;
}

// ---------- importing or editing ----------
function openQuizEdit(sciId, quizId) {
  const s = getSci(sciId), z = quizId ? getQuiz(s, quizId) : null;
  if (!s) return;
  ldraft = { kind: 'qzedit', id: z ? z.id : uid(), sci: sciId, isNew: !z, previewed: null };
  const topics = [...new Set([...s.quizzes.map((x) => x.topic), ...s.books.flatMap((b) => b.lessons.map((l) => l.title))].map((t) => t.trim()).filter(Boolean))];
  $('libForm').innerHTML = `${sheetHead(z ? 'تعديل الاختبار' : 'استيراد اختبار')}
    <p class="note-text">${esc(s.name)}</p>
    <label class="field"><span>اسم الاختبار</span><input type="text" id="qzTitle" value="${esc(z ? z.title : '')}" autocomplete="off" placeholder="يُؤخذ من «العنوان:» إن تركته فارغاً"></label>
    <label class="field"><span>الموضوع (اختياري)</span><input type="text" id="qzTopic" value="${esc(z ? z.topic : '')}" list="qzTopics" autocomplete="off" placeholder="مثل: باب المياه"></label>
    <datalist id="qzTopics">${topics.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="field"><span>الأسئلة</span>
      <label class="ghost sm qz-file">📄 اختر ملفاً (نص، وورد، JSON)<input type="file" id="qzFile" accept=".txt,.md,.json,.docx,text/plain,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label>
      <textarea id="qzText" rows="12" dir="auto" placeholder="الصق هنا الاختبار كما كتبه الذكاء الاصطناعي">${esc(z ? qzText(z) : '')}</textarea></div>
    <details class="qz-fmt"><summary>طريقة كتابة الاختبار (أعطها للذكاء الاصطناعي)</summary>
      <pre dir="rtl">${esc(QZ_PROMPT)}</pre>
      <button type="button" class="ghost sm" data-action="qz-copy">نسخ الطريقة</button></details>
    <button type="button" class="ghost" data-action="qz-preview">👁 اعرض المعاينة</button>
    <div id="qzPrev"></div>
    <div class="sheet-actions"><button type="submit" class="primary">احفظ الاختبار</button></div>`;
  showLib();
  $('libForm').scrollTop = 0;
  if (z) qzShowPreview();
}
// what the sheet holds now, read as a test (with the name and topic typed above it)
function qzRead() {
  const p = qzParse($('qzText').value);
  return { ...p, title: $('qzTitle').value.trim() || p.title, topic: $('qzTopic').value.trim() || p.topic };
}
function qzShowPreview() {
  const p = qzRead();
  ldraft.previewed = `${$('qzText').value}\u0001${$('qzTitle').value}\u0001${$('qzTopic').value}`;
  const good = p.qs.filter((q) => !q.bad), bad = p.qs.filter((q) => q.bad);
  const byType = Object.keys(QZ_TYPES).map((t) => [t, good.filter((q) => q.type === t).length]).filter(([, n]) => n);
  const ansTxt = (q) => (q.type === 'mc' ? `${QZ_LET[q.ans] || q.ans + 1}) ${q.opts[q.ans]}` : q.type === 'tf' ? (q.ans ? 'صح' : 'خطأ') : q.ans);
  $('qzPrev').innerHTML = !p.qs.length
    ? `<div class="qz-warn"><b>لم أجد أي سؤال.</b><p>اكتب كل سؤال في سطر يبدأ بـ«س١:» أو برقمه، واختياراته بـ«أ)» «ب)»، ثم «الإجابة:». انظر «طريقة كتابة الاختبار».</p></div>`
    : `<div class="qz-sum"><b>${esc(`فهمت ${plural(good.length, 'سؤالاً واحداً', 'سؤالين', 'أسئلة', 'سؤالاً')}`)}</b>${byType.length ? `<span class="book-line">${esc(byType.map(([t, n]) => `${QZ_TYPES[t]}: ${n}`).join(' | '))}</span>` : ''}
      ${p.title ? `<span class="book-line">${esc(`الاسم: ${p.title}`)}</span>` : '<span class="book-line late">لا اسم للاختبار بعد</span>'}</div>
    ${bad.length ? `<div class="qz-warn"><b>${esc(`لم أفهم ${plural(bad.length, 'سؤالاً واحداً', 'سؤالين', 'أسئلة', 'سؤالاً')}، ولن أخمّن:`)}</b>
      <ul>${bad.map((q) => `<li>${esc(`السؤال ${p.qs.indexOf(q) + 1}: ${q.bad}`)}${q.q ? `<small>${esc(excerpt(q.q, 80))}</small>` : ''}</li>`).join('')}</ul>
      <p>يُحفظ معها ولا يدخل في الحل حتى تكمله هنا.</p></div>` : ''}
    ${p.stray.length ? `<div class="qz-warn"><b>${esc(`أسطر لم أفهمها (${p.stray.length})، ولن تُحفظ:`)}</b><ul>${p.stray.slice(0, 12).map((l) => `<li>${esc(excerpt(l, 90))}</li>`).join('')}</ul></div>` : ''}
    <ol class="qz-prev">${p.qs.map((q, i) => `<li class="${q.bad ? 'bad' : ''}"><div class="qz-qh"><span class="qz-n">${i + 1}</span><b>${esc(q.q || '…')}</b></div>
      <span class="qz-chip">${esc(QZ_TYPES[q.type])}</span>
      ${q.type === 'mc' ? `<span class="qz-popts">${q.opts.map((o, j) => `<span class="${j === q.ans ? 'on' : ''}">${esc(`${QZ_LET[j] || j + 1}) ${o}`)}</span>`).join('')}</span>` : ''}
      ${q.bad ? `<small class="late">${esc(q.bad)}</small>` : `<small>${esc(`الإجابة: ${ansTxt(q)}`)}</small>`}
      ${q.keys.length ? `<small>${esc(`الكلمات المطلوبة: ${q.keys.join('، ')}`)}</small>` : ''}
      ${q.explain ? `<small>${esc(`التوضيح: ${q.explain}`)}</small>` : ''}</li>`).join('')}</ol>`;
}
function saveQuizEdit() {
  const s = getSci(ldraft.sci);
  if (!s) return false;
  const now = `${$('qzText').value}\u0001${$('qzTitle').value}\u0001${$('qzTopic').value}`;
  // the preview first: nothing is saved before it was seen as it is now
  if (ldraft.previewed !== now) { qzShowPreview(); $('qzPrev').scrollIntoView({ block: 'start' }); toast('راجع المعاينة، ثم اضغط «احفظ الاختبار» مرة أخرى'); return false; }
  const p = qzRead();
  if (!p.qs.some((q) => !q.bad)) { toast('لا سؤال مفهوماً لأحفظه.'); return false; }
  const old = getQuiz(s, ldraft.id);
  // a question kept with the same text keeps its id, so earlier attempts still point to it
  const pool = old ? old.qs.slice() : [];
  for (const q of p.qs) { const k = pool.findIndex((x) => qzNorm(x.q) === qzNorm(q.q)); if (k >= 0) { q.id = pool[k].id; pool.splice(k, 1); } }
  const z = normalizeQuiz({ ...(old || {}), id: ldraft.id, title: p.title || `اختبار ${fmtDate(today())}`, topic: p.topic, qs: p.qs, updated: Date.now() });
  if (old) Object.assign(old, z); else s.quizzes.push(z);
  s.updated = Date.now();
  save();
  return true;
}
async function qzReadFile(file) {
  const box = $('qzPrev');
  try {
    let text;
    if (/\.docx$/i.test(file.name)) {
      if (typeof DecompressionStream === 'undefined') throw new Error('docx');
      const files = await XlsxRead.unzip(await file.arrayBuffer(), /^word\/document\.xml$/);
      if (!files['word/document.xml']) throw new Error('docx');
      const doc = new DOMParser().parseFromString(new TextDecoder().decode(files['word/document.xml']), 'application/xml');
      text = [...doc.getElementsByTagName('w:p')].map((p) => [...p.getElementsByTagName('*')].map((n) => (n.nodeName === 'w:t' ? n.textContent : n.nodeName === 'w:tab' ? ' ' : n.nodeName === 'w:br' ? '\n' : '')).join('')).join('\n');
    } else text = await file.text();
    if (!$('qzText')) return;
    $('qzText').value = text.trim();
    if (!$('qzTitle').value.trim()) { const p = qzParse(text); if (!p.title) $('qzTitle').value = file.name.replace(/\.[^.]+$/, ''); }
    qzShowPreview();
  } catch {
    if (box) box.innerHTML = `<div class="qz-warn"><b>لم أستطع قراءة الملف «${esc(file.name)}».</b><p>جرّب ملفاً نصياً أو وورد، أو انسخ ما فيه والصقه في الخانة.</p></div>`;
  }
}

// ---------- the test: its page, solving it, and the results ----------
function openQuiz(sciId, quizId) {
  const s = getSci(sciId), z = getQuiz(s, quizId);
  if (!z) return;
  ldraft = { kind: 'qzview', id: z.id, sci: sciId, isNew: false };
  const good = qzGood(z), bad = z.qs.filter((q) => q.bad), A = z.attempts;
  const first = A[0], last = qzLast(z), best = qzBest(z);
  const diff = A.length > 1 ? qzPct(last) - qzPct(first) : 0;
  $('libForm').innerHTML = `${sheetHead(esc(z.title || 'اختبار'))}
    <p class="note-text">${esc([s.name, z.topic].filter(Boolean).join(' | '))}</p>
    <div class="st-facts">
      <div class="st-fact"><small>الأسئلة</small><b>${good.length}</b></div>
      <div class="st-fact"><small>المحاولات</small><b>${A.length || 'صفر'}</b></div>
      ${best !== null ? `<div class="st-fact"><small>أفضل نتيجة</small><b>${best}٪</b></div>` : ''}
    </div>
    ${bad.length ? `<div class="qz-warn"><b>${esc(`أسئلة تحتاج إكمالاً (${bad.length})، ولا تدخل في الحل:`)}</b><ul>${bad.map((q) => `<li>${esc(`${excerpt(q.q || '…', 60)}: ${q.bad}`)}</li>`).join('')}</ul></div>` : ''}
    <div class="btn-row qz-acts"><button type="button" class="primary" data-action="qz-take"${good.length ? '' : ' disabled'}>${A.length ? 'أعد الحل' : 'ابدأ الاختبار'}</button><button type="button" class="ghost" data-action="qz-edit">${icon('edit')} عدّل</button></div>
    ${A.length ? `<h3 class="dec-h">نتائجك</h3>
      ${A.length > 1 ? `<p class="qz-trend ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${esc(`من ${qzPct(first)}٪ في أول محاولة إلى ${qzPct(last)}٪ في آخرها`)}${diff ? ` | ${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'نقطة' : 'نقاط'}` : ' | بلا تغيّر'}</p>` : ''}
      <ol class="qz-atts">${A.map((a, i) => `<li><button type="button" data-action="qz-att" data-v="${a.id}">
        <span class="qz-att-h"><b>${esc(`المحاولة ${i + 1}`)}</b><small>${esc(`${relDate(a.d)} | ${fmtDate(a.d)}`)}</small></span>
        <span class="pbar"><i style="width:${qzPct(a)}%;--pc:var(--${qzTone(qzPct(a)) === 'good' ? 'low' : qzTone(qzPct(a)) === 'mid' ? 'mid' : 'high'})"></i></span>
        <span class="qz-att-s">${esc(qzScoreTxt(a))}${qzPend(a) ? ` <small class="late">${esc(`ينتظر حكمك: ${qzPend(a)}`)}</small>` : ''}</span></button></li>`).reverse().join('')}</ol>` : ''}
    <div class="sheet-actions"><button type="button" class="danger" data-action="qz-del">حذف الاختبار</button></div>`;
  showLib();
  $('libForm').scrollTop = 0;
}
function openQuizTake(sciId, quizId) {
  const z = getQuiz(getSci(sciId), quizId);
  if (!z) return;
  const qs = qzGood(z);
  ldraft = { kind: 'qztake', id: z.id, sci: sciId, isNew: false, ans: {}, armed: false };
  $('libForm').innerHTML = `${sheetHead(esc(z.title || 'اختبار'))}
    <p class="note-text">${esc(`${plural(qs.length, 'سؤال واحد', 'سؤالان', 'أسئلة', 'سؤالاً')}${z.topic ? ` | ${z.topic}` : ''}`)}</p>
    ${qs.map((q, i) => `<div class="qz-q" id="qzq-${q.id}"><div class="qz-qh"><span class="qz-n">${i + 1}</span><b>${esc(q.q)}</b></div>
      ${q.type === 'mc' ? `<div class="qz-opts">${q.opts.map((o, j) => `<button type="button" class="qz-opt" data-action="qz-pick" data-q="${q.id}" data-v="${j}" aria-pressed="false"><span class="qz-let">${QZ_LET[j] || j + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`
      : q.type === 'tf' ? `<div class="qz-opts qz-tf"><button type="button" class="qz-opt" data-action="qz-pick" data-q="${q.id}" data-v="1" aria-pressed="false">✓ صح</button><button type="button" class="qz-opt" data-action="qz-pick" data-q="${q.id}" data-v="0" aria-pressed="false">✗ خطأ</button></div>`
      : `<textarea id="qzA-${q.id}" rows="3" dir="auto" placeholder="اكتب إجابتك"></textarea>`}
    </div>`).join('')}
    <p class="note-text" id="qzCount"></p>
    <div class="sheet-actions"><button type="submit" class="primary" id="qzGo">صحّح إجاباتي</button></div>`;
  showLib();
  $('libForm').scrollTop = 0;
  qzCount();
}
function qzAnswers() {
  const z = getQuiz(getSci(ldraft.sci), ldraft.id);
  const ans = { ...ldraft.ans };
  for (const q of qzGood(z)) if (q.type === 'text') { const t = $(`qzA-${q.id}`); if (t && t.value.trim()) ans[q.id] = t.value.trim(); else delete ans[q.id]; }
  return { z, ans };
}
function qzCount() {
  if (!$('qzCount')) return;
  const { z, ans } = qzAnswers();
  $('qzCount').textContent = `أجبت عن ${Object.keys(ans).length} من ${qzGood(z).length}`;
}
// «صحّح إجاباتي»: the attempt is graded and kept; questions left unanswered ask once before
function qzSubmit() {
  const { z, ans } = qzAnswers();
  if (!z) return false;
  const qs = qzGood(z), left = qs.filter((q) => ans[q.id] === undefined).length;
  if (left && !ldraft.armed) {
    ldraft.armed = true;
    $('qzGo').textContent = `لم تجب عن ${plural(left, 'سؤال واحد', 'سؤالين', 'أسئلة', 'سؤالاً')}. صحّح على أي حال؟`;
    $('qzGo').classList.add('armed');
    return false;
  }
  const res = {};
  for (const q of qs) res[q.id] = qzGrade(q, ans[q.id]);
  const a = normalizeAttempt({ ans, res, total: qs.length, d: today(), at: Date.now() });
  z.attempts.push(a);
  save();
  openQuizResult(ldraft.sci, z.id, a.id);
  return false;
}
function openQuizResult(sciId, quizId, attId) {
  const z = getQuiz(getSci(sciId), quizId), a = z && z.attempts.find((x) => x.id === attId);
  if (!a) return;
  ldraft = { kind: 'qzres', id: z.id, sci: sciId, att: a.id, isNew: false };
  const no = z.attempts.indexOf(a) + 1, p = qzPct(a), pend = qzPend(a);
  const qs = z.qs.filter((q) => q.id in a.res);
  const right = qs.filter((q) => a.res[q.id] === 1).length, wrong = qs.filter((q) => a.res[q.id] === 0).length;
  const part = qs.filter((q) => a.res[q.id] !== null && a.res[q.id] > 0 && a.res[q.id] < 1).length;
  const tf = (v) => (v ? 'صح' : 'خطأ');
  const row = (q, i) => {
    const r = a.res[q.id], my = a.ans[q.id], st = r === null ? 'pend' : r === 1 ? 'ok' : r === 0 ? 'no' : 'part';
    let body = '';
    if (q.type === 'mc') body = `<div class="qz-ropts">${q.opts.map((o, j) => `<span class="${j === q.ans ? 'right' : j === my ? 'wrong' : ''}">${j === q.ans ? '✓' : j === my ? '✗' : ''} ${esc(`${QZ_LET[j] || j + 1}) ${o}`)}${j === my ? ' <small>(إجابتك)</small>' : ''}</span>`).join('')}</div>${my === undefined ? '<small class="late">لم تجب عنه</small>' : ''}`;
    else if (q.type === 'tf') body = `<div class="qz-rl"><small>إجابتك:</small> ${my === undefined ? '<span class="late">لم تجب عنه</span>' : esc(tf(my))}</div><div class="qz-rl"><small>الصحيح:</small> ${esc(tf(q.ans))}</div>`;
    else {
      body = `<div class="qz-rl"><small>إجابتك:</small> ${my ? esc(my) : '<span class="late">لم تجب عنه</span>'}</div><div class="qz-rl"><small>الإجابة النموذجية:</small> ${esc(q.ans)}</div>
        ${q.keys.length && my ? `<div class="qz-rl"><small>الكلمات المطلوبة:</small> ${q.keys.map((k) => `<span class="qz-key ${qzHas(my, k) ? 'on' : ''}">${qzHas(my, k) ? '✓' : '✗'} ${esc(k)}</span>`).join(' ')}</div>` : ''}
        ${r === null ? `<div class="qz-judge"><span>قارن إجابتك بالنموذجية واحكم:</span><button type="button" class="ghost sm" data-action="qz-judge" data-q="${q.id}" data-v="1">✓ أصبت</button><button type="button" class="ghost sm" data-action="qz-judge" data-q="${q.id}" data-v="0.5">نصف</button><button type="button" class="ghost sm" data-action="qz-judge" data-q="${q.id}" data-v="0">✗ أخطأت</button></div>` : ''}`;
    }
    return `<div class="qz-r ${st}"><div class="qz-qh"><span class="qz-n">${i + 1}</span><b>${esc(q.q)}</b><span class="qz-mark">${st === 'ok' ? '✓' : st === 'no' ? '✗' : st === 'part' ? `${r * 100}٪` : '؟'}</span></div>${body}${q.explain ? `<div class="qz-exp"><small>التوضيح</small>${esc(q.explain)}</div>` : ''}</div>`;
  };
  $('libForm').innerHTML = `${sheetHead(esc(`نتيجة المحاولة ${no}`))}
    <p class="note-text">${esc(`${z.title} | ${relDate(a.d)}`)}</p>
    <div class="qz-score ${qzTone(p)}"><b>${esc(`${qzZ(a.score)} من ${a.total}`)}</b><span>${p ? `${p}٪` : 'صفر٪'}</span></div>
    <p class="book-line">${esc([`صحيحة: ${qzZ(right)}`, `خاطئة: ${qzZ(wrong)}`, part ? `صحيحة جزئياً: ${part}` : '', pend ? `تنتظر حكمك: ${pend}` : ''].filter(Boolean).join(' | '))}</p>
    ${qs.map(row).join('')}
    ${z.qs.length && !qs.length ? '<p class="note-text">تغيّرت أسئلة هذا الاختبار بعد هذه المحاولة، فبقيت درجتها وحدها.</p>' : ''}
    <div class="sheet-actions"><button type="button" class="primary" data-action="qz-take">أعد الحل</button><button type="button" class="ghost" data-action="qz-back">الاختبار ونتائجه</button></div>`;
  showLib();
  $('libForm').scrollTop = 0;
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action^="qz-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  const s = getSci(ldraft && ldraft.sci ? ldraft.sci : studyUi.sci);
  switch (action) {
    case 'qz-new': openQuizEdit(studyUi.sci, null); break;
    case 'qz-open': openQuiz(studyUi.sci, v); break;
    case 'qz-topic': studyUi.qtopic = v; render(); break;
    case 'qz-edit': openQuizEdit(ldraft.sci, ldraft.id); break;
    case 'qz-take': openQuizTake(ldraft.sci, ldraft.id); break;
    case 'qz-back': openQuiz(ldraft.sci, ldraft.id); break;
    case 'qz-att': openQuizResult(ldraft.sci, ldraft.id, v); break;
    case 'qz-preview': qzShowPreview(); break;
    case 'qz-copy':
      try { await navigator.clipboard.writeText(QZ_PROMPT); toast('نُسخت الطريقة. الصقها في برنامج الذكاء الاصطناعي'); }
      catch { const pre = el.parentElement.querySelector('pre'); const r = document.createRange(); r.selectNodeContents(pre); getSelection().removeAllRanges(); getSelection().addRange(r); toast('لم يسمح الجوال بالنسخ؛ حدّدتها لك، فانسخها'); }
      break;
    case 'qz-pick': {
      const q = el.dataset.q, z = getQuiz(s, ldraft.id), qq = z && z.qs.find((x) => x.id === q);
      if (!qq) break;
      const val = qq.type === 'tf' ? v === '1' : Number(v);
      if (ldraft.ans[q] === val) delete ldraft.ans[q]; else ldraft.ans[q] = val;
      for (const b of el.parentElement.children) b.setAttribute('aria-pressed', String(ldraft.ans[q] !== undefined && b === el));
      ldraft.armed = false; $('qzGo').textContent = 'صحّح إجاباتي'; $('qzGo').classList.remove('armed');
      qzCount();
      break;
    }
    case 'qz-judge': {
      const z = getQuiz(s, ldraft.id), a = z && z.attempts.find((x) => x.id === ldraft.att);
      if (!a) break;
      a.res[el.dataset.q] = Number(v);
      a.score = qzSum(a.res);
      save();
      const top = $('libForm').scrollTop;
      openQuizResult(ldraft.sci, z.id, a.id);
      $('libForm').scrollTop = top;
      break;
    }
    case 'qz-del': {
      if (!selArmed(el)) break;
      s.quizzes = s.quizzes.filter((z) => z.id !== ldraft.id);
      s.updated = Date.now();
      save(); closeLib(); render(); toast('حُذف الاختبار');
      break;
    }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'qzSearch') { studyUi.qq = e.target.value; render(); }
  if (e.target.id && e.target.id.startsWith('qzA-')) { if (ldraft) { ldraft.armed = false; $('qzGo').textContent = 'صحّح إجاباتي'; $('qzGo').classList.remove('armed'); } qzCount(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'qzSort') { studyUi.qsort = e.target.value; render(); }
  if (e.target.id === 'qzFile' && e.target.files[0]) qzReadFile(e.target.files[0]);
});
