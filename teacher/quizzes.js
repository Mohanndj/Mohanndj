'use strict';
// Tests: written in a fixed format (by hand, or by Claude from a lesson), checked in a preview that
// never guesses, then sent to the students as a link they solve on their phones. Each student's
// result comes back to the teacher on WhatsApp with a code; pasting the messages enters the marks.

const QZ_FORMAT = `العنوان: اختبار قصير: …
الفرع: التوحيد

س١: نص السؤال
أ) الاختيار الأول
ب) الاختيار الثاني
ج) الاختيار الثالث
د) الاختيار الرابع
الإجابة: ب
التوضيح: لماذا كانت هي الصحيحة (اختياري)

س٢: نص عبارة يُحكم عليها
النوع: صح وخطأ
الإجابة: خطأ`;
const QZ_AI = (lesson) => `أنت معلم دراسات إسلامية لطلاب الصف الأول المتوسط.
اكتب اختباراً قصيراً من ١٠ أسئلة (٧ اختيار من متعدد بأربعة اختيارات، و٣ صح وخطأ) في الدرس: ${lesson || '[اكتب هنا اسم الدرس أو الصق نصه]'}
بلغة سهلة تناسب أعمارهم، وإجابة واحدة صحيحة لكل سؤال، مع توضيح قصير.
اكتبه بهذا التنسيق حرفياً، دون أي كلام قبله أو بعده:

${QZ_FORMAT}`;

const qzNorm = (s) => latin(String(s || '')).replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const LETTERS = ['ا', 'ب', 'ج', 'د', 'ه', 'و'];
const LAT = ['a', 'b', 'c', 'd', 'e', 'f'];
const tfOf = (s) => { const t = qzNorm(s).replace(/[().:]/g, ''); return /^(صح|صحيح|صحيحه|true|✓)$/i.test(t) ? true : /^(خطا|خاطئ|خاطئه|false|✗)$/i.test(t) ? false : null; };

// the text → { title, skill, qs: [{type, q, opts, ans, explain, bad}], stray }
function qzRead(text) {
  const out = { title: '', skill: '', qs: [], stray: [] };
  let cur = null, last = '';
  const optRx = /^[(\[]?\s*([أاإبجدهوabcdef])\s*[)\]\-–.]\s*(.+)$/i;
  for (let line of String(text || '').replace(/\r/g, '').split('\n')) {
    line = line.replace(/\*\*|__/g, '').replace(/^#+\s*/, '').trim();
    if (!line) continue;
    let m;
    if (!cur && (m = line.match(/^العنوان\s*[:：]\s*(.+)$/))) { out.title = m[1].trim(); continue; }
    if (!cur && (m = line.match(/^(?:الفرع|الموضوع)\s*[:：]\s*(.+)$/))) { out.skill = m[1].trim(); continue; }
    if ((m = latin(line).match(/^(?:س\s*\d+|سؤال\s*\d+|السؤال\s*\d+|\d+)\s*[:：.)\-–]\s*(.+)$/))) {
      cur = { q: line.slice(line.length - m[1].length).trim(), opts: [], ansRaw: '', type: '', explain: '' };
      out.qs.push(cur); last = 'q'; continue;
    }
    if (!cur) { out.stray.push(line); continue; }
    if ((m = line.match(/^النوع\s*[:：]\s*(.+)$/))) { cur.type = m[1]; last = ''; continue; }
    if ((m = line.match(/^(?:الإجابة|الاجابة|الجواب)(?:\s*الصحيحة)?\s*[:：]\s*(.+)$/))) { cur.ansRaw = m[1].trim(); last = 'ans'; continue; }
    if ((m = line.match(/^(?:التوضيح|الشرح|التعليل)\s*[:：]\s*(.+)$/))) { cur.explain = m[1].trim(); last = 'exp'; continue; }
    if (!cur.ansRaw && (m = line.match(optRx))) { cur.opts.push({ L: qzNorm(m[1]).toLowerCase(), t: m[2].trim() }); last = 'opt'; continue; }
    if (last === 'q') cur.q += ` ${line}`;
    else if (last === 'exp') cur.explain += ` ${line}`;
    else if (last === 'opt') cur.opts[cur.opts.length - 1].t += ` ${line}`;
    else out.stray.push(line);
  }
  out.qs = out.qs.map((c) => {
    const q = { type: '', q: c.q, opts: c.opts.map((o) => o.t), ans: null, explain: c.explain, bad: '' };
    const isTf = /صح/.test(c.type) || (!c.opts.length && tfOf(c.ansRaw) !== null);
    if (isTf) {
      q.type = 'tf'; q.opts = [];
      q.ans = tfOf(c.ansRaw);
      if (!c.ansRaw) q.bad = 'لم أجد الإجابة'; else if (q.ans === null) q.bad = `الإجابة «${c.ansRaw}» ليست صح أو خطأ`;
      return q;
    }
    q.type = 'mc';
    if (c.opts.length < 2) { q.bad = 'فيه أقل من اختيارين (أو أن السؤال إجابته كتابة، وهذا لا يُصحَّح آلياً)'; return q; }
    if (!c.ansRaw) { q.bad = 'لم أجد الإجابة'; return q; }
    const r = qzNorm(c.ansRaw).toLowerCase();
    const lm = r.match(/^[(\[]?\s*([ابجدهوabcdef])\s*(?:[)\]\-–.:]|$)/);
    if (/[،,و]\s*[(\[]?[ابجد]\s*[)\]]?$/.test(r) && r.length < 9) q.bad = 'له أكثر من إجابة';
    else if (lm && (r.length <= 3 || /[)\]\-–.:]/.test(r.slice(0, 4)))) {
      const L = lm[1];
      const k = c.opts.findIndex((o) => o.L === L || LETTERS.indexOf(o.L) === LAT.indexOf(L) && LAT.indexOf(L) >= 0 || LAT.indexOf(o.L) === LETTERS.indexOf(L) && LETTERS.indexOf(L) >= 0);
      if (k >= 0) q.ans = k; else q.bad = `الإجابة «${c.ansRaw}» لا تطابق حرف أي اختيار`;
    } else {
      const k = c.opts.findIndex((o) => qzNorm(o.t) === qzNorm(c.ansRaw));
      if (k >= 0) q.ans = k; else q.bad = `الإجابة «${c.ansRaw}» لا تطابق أي اختيار`;
    }
    return q;
  });
  return out;
}
// a saved test back to the same text, to edit it
function qzToText(z) {
  return [`العنوان: ${z.title}`, z.skill ? `الفرع: ${z.skill}` : '', '', ...z.qs.map((q, i) => [
    `س${i + 1}: ${q.q}`,
    ...(q.type === 'tf' ? ['النوع: صح وخطأ', `الإجابة: ${q.ans ? 'صح' : 'خطأ'}`] : [...q.opts.map((o, k) => `${'أبجدهو'[k]}) ${o}`), `الإجابة: ${'أبجدهو'[q.ans]}`]),
    q.explain ? `التوضيح: ${q.explain}` : '', ''].filter((x, k, a) => x || k === a.length - 1).join('\n'))].join('\n').trim();
}

Views.quizzes = () => `<h2>الاختبارات</h2>
  <div class="btns"><button type="button" class="primary" data-act="qz-new">＋ اختبار جديد</button><button type="button" class="ghost" data-act="res-open">📥 أدخل نتائج الطلاب</button></div>
  ${T.quizzes.length ? `<ul class="list">${T.quizzes.slice().sort((a, b) => b.at - a.at).map((z) => {
    const n = T.items.filter((i) => i.quiz === z.id).reduce((k, i) => k + Object.keys(T.marks[i.id] || {}).length, 0);
    return `<li><button type="button" class="li-btn" data-act="qz-open" data-id="${z.id}"><span class="grow"><b>${esc(z.title)}</b><small>${esc(z.skill || 'عام')} | ${z.qs.length} أسئلة</small></span>${n ? `<span class="tag good">نتائج: ${n}</span>` : ''}</button></li>`;
  }).join('')}</ul>` : '<p class="empty">لا اختبارات بعد. اكتب اختباراً أو اطلبه من Claude بالطريقة الجاهزة، ثم أرسله لطلابك رابطاً يحلّونه من أجهزتهم ويُصحَّح وحده.</p>'}`;

function qzForm(z) {
  return `<h3>${z ? 'تعديل الاختبار' : 'اختبار جديد'}</h3>
    <details class="card soft"><summary>✨ اطلبه من Claude جاهزاً</summary>
      <label>اسم الدرس<input id="qzLesson" placeholder="مثل: أركان الإيمان"></label>
      <button type="button" class="ghost sm" data-act="qz-ai-copy">انسخ الطلب</button>
      <p class="explain">الصقه في تطبيق Claude، وانسخ ما يكتبه والصقه في الخانة التالية.</p></details>
    <label>الاختبار<textarea id="qzText" rows="12" placeholder="${esc(QZ_FORMAT)}">${esc(z ? qzToText(z) : '')}</textarea></label>
    <button type="button" class="ghost" data-act="qz-prev">👁 اعرض ما فهمته</button>
    <div id="qzPrev"></div>
    <input type="hidden" id="qzId" value="${z ? z.id : ''}">`;
}
Acts['qz-new'] = () => openSheet(qzForm(null));
Acts['qz-ai-copy'] = () => copyText(QZ_AI($('qzLesson').value.trim()));
Acts['qz-prev'] = () => {
  const p = qzRead($('qzText').value);
  const bad = p.qs.filter((q) => q.bad).length;
  const skill = p.skill && T.skills.find((k) => qzNorm(k) === qzNorm(p.skill));
  $('qzPrev').innerHTML = `<div class="card soft">
    <label>العنوان<input id="qzTitle" value="${esc(p.title)}" placeholder="اسم الاختبار"></label>
    <label>الفرع<select id="qzSkill"><option value="">عام</option>${T.skills.map((k) => `<option${k === skill ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
    <div class="facts"><span>الأسئلة: ${p.qs.length}</span>${bad ? `<span class="warn">تحتاج إكمالاً: ${bad}</span>` : p.qs.length ? '<span class="good">كلها مفهومة</span>' : ''}</div>
    ${p.stray.length ? `<p class="warn">أسطر لم أفهمها ولن تُحفظ: ${p.stray.map((s) => `«${esc(s.slice(0, 40))}»`).join('، ')}</p>` : ''}
    <ol class="qprev">${p.qs.map((q) => `<li class="${q.bad ? 'badq' : ''}"><b>${esc(q.q)}</b>${q.bad ? `<p class="warn">⚠ ${esc(q.bad)}</p>` : ''}
      ${q.type === 'tf' ? `<p>صح أو خطأ؟ الإجابة: <b class="good">${q.ans === true ? 'صح' : q.ans === false ? 'خطأ' : '؟'}</b></p>` : `<ul>${q.opts.map((o, k) => `<li class="${k === q.ans ? 'right' : ''}">${'أبجدهو'[k]}) ${esc(o)}${k === q.ans ? ' ✓' : ''}</li>`).join('')}</ul>`}</li>`).join('')}</ol>
    ${bad ? '<p class="warn">أكمل ما ينقص في النص أعلاه ثم اعرضه مرة أخرى؛ لا يُحفظ الاختبار وفيه سؤال لا تُعرف إجابته.</p>' : p.qs.length ? '<button type="button" class="primary" data-act="qz-save">احفظ الاختبار</button>' : '<p class="warn">لم أجد أسئلة. اكتب كل سؤال بعد «س١:» «س٢:».</p>'}</div>`;
  arDigits($('qzPrev'));
};
Acts['qz-save'] = () => {
  const p = qzRead($('qzText').value);
  if (!p.qs.length || p.qs.some((q) => q.bad)) return;
  const id = $('qzId').value;
  const data = { title: $('qzTitle').value.trim() || p.title || 'اختبار', skill: $('qzSkill').value, qs: p.qs.map(({ bad, ...q }) => q) };
  let z = id && T.quizzes.find((x) => x.id === id);
  if (z) Object.assign(z, data); else { z = { id: uid(), at: Date.now(), ...data }; T.quizzes.push(z); }
  for (const it of T.items.filter((i) => i.quiz === z.id)) it.max = z.qs.length;
  save(); render(); qzOpen(z);
  toast('حُفظ الاختبار');
};
Acts['qz-open'] = (el) => qzOpen(T.quizzes.find((z) => z.id === el.dataset.id));
function qzOpen(z) {
  openSheet(`<h3>${esc(z.title)}</h3><p class="muted">${esc(z.skill || 'عام')} | ${z.qs.length} أسئلة</p>
    ${T.settings.phone ? '' : '<p class="warn">اكتب جوالك في الإعدادات حتى تصلك نتائج الطلاب على واتساب مباشرة.</p>'}
    <div class="btns col">
      <button type="button" class="primary" data-act="qz-share" data-id="${z.id}">📤 أرسل الرابط للطلاب (واتساب)</button>
      <button type="button" class="ghost" data-act="qz-link" data-id="${z.id}">🔗 انسخ الرابط</button>
      <button type="button" class="ghost" data-act="qz-try" data-id="${z.id}">👁 جرّبه كما يراه الطالب</button>
      <button type="button" class="ghost" data-act="qz-print" data-id="${z.id}">🖨 اطبعه ورقة (مع نموذج الإجابة)</button>
      <button type="button" class="ghost" data-act="res-open">📥 أدخل نتائج الطلاب</button>
      <button type="button" class="ghost" data-act="qz-edit" data-id="${z.id}">✎ عدّله</button>
      <button type="button" class="danger" data-act="qz-del" data-id="${z.id}">احذفه</button></div>`);
}
Acts['qz-edit'] = (el) => openSheet(qzForm(T.quizzes.find((z) => z.id === el.dataset.id)));
Acts['qz-del'] = (el) => {
  if (!armed(el)) return;
  T.quizzes = T.quizzes.filter((z) => z.id !== el.dataset.id);
  for (const it of T.items) if (it.quiz === el.dataset.id) it.quiz = ''; // its marks stay in the grades
  save(); closeSheet(); render();
};
async function qzLink(z) {
  const code = await QCodec.pack({ i: z.id, t: z.title, p: T.settings.phone, s: T.settings.subject, a: T.settings.showAns ? 1 : 0,
    q: z.qs.map((q) => [q.type === 'tf' ? 't' : 'm', q.q, q.opts, q.type === 'tf' ? (q.ans ? 1 : 0) : q.ans, q.explain || '']) });
  return new URL(`q.html#${code}`, location.href).href;
}
Acts['qz-link'] = async (el) => copyText(await qzLink(T.quizzes.find((z) => z.id === el.dataset.id)));
Acts['qz-try'] = async (el) => window.open(await qzLink(T.quizzes.find((z) => z.id === el.dataset.id)), '_blank');
Acts['qz-share'] = async (el) => {
  const z = T.quizzes.find((x) => x.id === el.dataset.id);
  const text = ar(`اختبار «${z.title}» في مادة ${T.settings.subject}\nاكتب اسمك الثلاثي، وحلّ الأسئلة، ثم أرسل نتيجتك للمعلم من الزر في آخر الاختبار:\n`) + await qzLink(z);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};
Acts['qz-print'] = (el) => {
  const z = T.quizzes.find((x) => x.id === el.dataset.id);
  const qs = z.qs.map((q, i) => `<li><p>${esc(q.q)}</p>${q.type === 'tf' ? '<p class="tf">(&nbsp;&nbsp;&nbsp;&nbsp;) صح&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;&nbsp;&nbsp;) خطأ</p>' : `<ol class="o">${q.opts.map((o, k) => `<li>${'أبجدهو'[k]}) ${esc(o)}</li>`).join('')}</ol>`}</li>`).join('');
  const key = z.qs.map((q, i) => `<li>${q.type === 'tf' ? (q.ans ? 'صح' : 'خطأ') : `${'أبجدهو'[q.ans]}) ${esc(q.opts[q.ans])}`}</li>`).join('');
  const w = window.open('', '_blank');
  if (!w) { toast('اسمح للتطبيق بفتح نافذة جديدة'); return; }
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(z.title)}</title><style>
    body{font-family:Tahoma,Arial,sans-serif;margin:24px;line-height:1.8;color:#000}h1{font-size:20px;text-align:center;margin:0}.meta{display:flex;justify-content:space-between;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:12px}
    ol.q{list-style:none;padding:0;counter-reset:n}ol.q>li{counter-increment:n}ol.q>li::before{content:"س" counter(n,arabic-indic) ": ";font-weight:bold;float:right;margin-left:6px}ol.q>li>p:first-of-type{margin-top:0}ol.o{list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}li{margin-bottom:6px}.key{page-break-before:always}.tf{margin:0}</style></head><body>
    <h1>${esc(z.title)}</h1><p style="text-align:center">${esc(T.settings.subject)}${T.settings.school ? ` | ${esc(T.settings.school)}` : ''}</p>
    <div class="meta"><span>اسم الطالب: ..............................</span><span>الفصل: ........</span><span>الدرجة: ...... من ${z.qs.length}</span></div>
    <ol class="q">${qs}</ol><div class="key"><h1>نموذج الإجابة: ${esc(z.title)}</h1><ol class="q">${key}</ol></div></body></html>`);
  w.document.close();
  arDigits(w.document.body);
  setTimeout(() => w.print(), 400);
};

// ---- the students' results, pasted from WhatsApp: each message carries ⟦R:…⟧ with the answers ----
let resUi = null;
Acts['res-open'] = () => {
  resUi = null;
  if (!T.classes.length) { toast('أضف فصولك وطلابك أولاً'); return; }
  openSheet(`<h3>نتائج الطلاب</h3>
    <p class="explain">انسخ رسائل النتائج التي وصلتك من الطلاب على واتساب (يمكن نسخ عدة رسائل معاً بالضغط المطوّل ثم «نسخ») والصقها هنا. التطبيق يعيد تصحيح كل إجابة بنفسه، فلا يفيد الطالب تغيير درجته في الرسالة.</p>
    <label>الفصل<select id="resCls">${T.classes.map((c) => `<option value="${c.id}"${c.id === curCls() ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    <textarea id="resText" rows="7" placeholder="الصق رسائل النتائج هنا"></textarea>
    <button type="button" class="primary" data-act="res-read">اقرأ النتائج</button><div id="resPrev"></div>`);
};
function bestStudent(cid, name) {
  const n = qzNorm(name).replace(/\s+بن\s+/g, ' ');
  const words = n.split(' ').filter(Boolean);
  let best = null, bestScore = 0;
  for (const s of studentsIn(cid)) {
    const sw = qzNorm(s.name).replace(/\s+بن\s+/g, ' ').split(' ');
    if (sw.join(' ') === words.join(' ')) return s;
    // same first name, and the most of the other words in order
    if (sw[0] !== words[0]) continue;
    const hit = words.filter((w) => sw.includes(w)).length;
    const sc = hit / Math.max(words.length, 2);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  return bestScore >= 0.66 ? best : null;
}
Acts['res-read'] = async () => {
  const cid = $('resCls').value;
  const codes = [...$('resText').value.matchAll(/⟦R:([A-Za-z0-9_-]+)⟧/g)].map((m) => m[1]);
  const rows = [];
  for (const c of codes) {
    try {
      const r = await QCodec.unpack(c);
      const z = T.quizzes.find((x) => x.id === r.i);
      if (!z) { rows.push({ name: r.n, err: 'اختبار غير موجود في تطبيقك' }); continue; }
      const key = z.qs.map((q) => (q.type === 'tf' ? (q.ans ? 1 : 0) : q.ans));
      const s = bestStudent(cid, r.n);
      rows.push({ name: r.n, z, score: QCodec.score(key.map((k, i) => [0, 0, 0, k]), r.a || []), max: z.qs.length, sid: s ? s.id : '' });
    } catch { rows.push({ name: '؟', err: 'رمز تالف (لعله لم يُنسخ كاملاً)' }); }
  }
  // the same student twice: his first result counts
  const seen = new Set();
  for (const r of rows) { const k = `${r.z && r.z.id}|${qzNorm(r.name)}`; if (seen.has(k)) r.dup = true; seen.add(k); }
  resUi = { cid, rows };
  if (!rows.length) { $('resPrev').innerHTML = '<p class="warn">لم أجد رموز نتائج. انسخ الرسالة كاملة كما وصلتك.</p>'; return; }
  const opts = (sel) => `<option value="">— لم أجده، اختر —</option>${studentsIn(cid).map((s) => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}`;
  $('resPrev').innerHTML = `<div class="card soft"><div class="facts"><span>النتائج: ${rows.length}</span></div>
    ${rows.map((r, i) => `<div class="res-row${r.err || r.dup ? ' off' : ''}"><div><b>${esc(r.name)}</b> ${r.err ? `<span class="warn">${esc(r.err)}</span>` : r.dup ? '<span class="warn">مكرر: تُحسب محاولته الأولى</span>' : `<span class="tag">${esc(r.z.title)}: ${r.score} من ${r.max}</span>`}</div>
      ${r.err || r.dup ? '' : `<select data-ri="${i}" class="res-sel">${opts(r.sid)}</select>`}</div>`).join('')}
    <button type="button" class="primary" data-act="res-go">ارصد الدرجات</button></div>`;
  arDigits($('resPrev'));
};
Acts['res-go'] = () => {
  const { cid, rows } = resUi;
  for (const sel of document.querySelectorAll('.res-sel')) rows[Number(sel.dataset.ri)].sid = sel.value;
  let put = 0, kept = 0, none = 0;
  for (const r of rows) {
    if (r.err || r.dup) continue;
    if (!r.sid) { none++; continue; }
    let it = T.items.find((i) => i.quiz === r.z.id && i.cls === cid);
    if (!it) { it = { id: uid(), cls: cid, title: `اختبار: ${r.z.title}`, max: r.max, skill: r.z.skill, d: today(), quiz: r.z.id }; T.items.push(it); }
    T.marks[it.id] = T.marks[it.id] || {};
    if (typeof T.marks[it.id][r.sid] === 'number') { kept++; continue; }
    T.marks[it.id][r.sid] = r.score; put++;
  }
  save(); closeSheet();
  UI.cls = cid; grUi.view = 'items';
  go('grades');
  toast(`رُصدت ${put} درجة${kept ? `، و${kept} سبق رصدها فبقيت` : ''}${none ? `، و${none} بلا طالب` : ''}`);
};
