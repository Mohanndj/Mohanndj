'use strict';
// WhatsApp messages to the parents: a template with blanks ({الطالب}, {ملخص_السلوك}, {الدرجات}…)
// becomes one message per student, addressed to his own parent. WhatsApp lets no website send on
// its own, so the queue opens each chat with the message written; the teacher presses send and
// comes back, and the next one is ready.

const VARS = [
  ['الطالب', 'اسم الطالب كاملاً'], ['الاسم', 'اسمه الأول'], ['ولي_الأمر', 'اسم ولي الأمر (أو «ولي أمر الطالب …»)'], ['الفصل', 'فصله'],
  ['المادة', 'المادة'], ['المعلم', 'اسمك'], ['المدرسة', 'المدرسة'], ['التاريخ', 'تاريخ اليوم'], ['الفترة', '«هذا الأسبوع» أو «هذا الشهر»'],
  ['ملخص_السلوك', 'ملخص ملاحظاته الإيجابية والسلبية في الفترة'], ['الإيجابيات', 'ملاحظاته الإيجابية'], ['السلبيات', 'ملاحظاته السلبية'],
  ['الدرجات', 'كل درجاته، كل تقويم في سطر'], ['المجموع', 'مجموع درجاته ونسبتها'], ['نص', 'نص تكتبه عند الإرسال'],
];
const PERIODS = { week: ['هذا الأسبوع', weekStart], month: ['هذا الشهر', monthStart], all: ['الفصل الدراسي', () => '0000-00-00'] };

// "مشاركة متميزة (٣ مرات)" per reason
function reasonsList(list) {
  const m = new Map();
  for (const b of list) m.set(b.reason, (m.get(b.reason) || 0) + 1);
  return [...m].map(([r, n]) => `- ${r}${n > 1 ? ` (${plural(n, 'مرة', 'مرتان', 'مرات', 'مرة')})` : ''}`).join('\n');
}
function fill(text, s, opts = {}) {
  const per = PERIODS[opts.period] || PERIODS.week;
  const list = behIn(s.id, per[1]());
  const pos = list.filter((b) => b.kind === 'pos'), neg = list.filter((b) => b.kind === 'neg');
  const summary = !list.length ? `لم تُسجَّل عليه ملاحظات ${per[0]}، وهو منضبط ولله الحمد.`
    : [pos.length ? `ملاحظات إيجابية (${pos.length}):\n${reasonsList(pos)}` : '', neg.length ? `ملاحظات تحتاج متابعتكم (${neg.length}):\n${reasonsList(neg)}` : 'لا ملاحظات سلبية عليه ولله الحمد.'].filter(Boolean).join('\n');
  const g = gradesOf(s);
  const map = {
    'الطالب': s.name, 'الاسم': firstName(s), 'ولي_الأمر': s.parent || `ولي أمر الطالب ${s.name}`, 'الفصل': clsOf(s.cls) ? clsOf(s.cls).name : '',
    'المادة': T.settings.subject, 'المعلم': T.settings.teacher ? T.settings.teacher : 'معلم المادة', 'المدرسة': T.settings.school, 'التاريخ': dateLabel(today()), 'الفترة': per[0],
    'ملخص_السلوك': summary, 'الإيجابيات': pos.length ? reasonsList(pos) : 'مشاركته وانضباطه في الحصة', 'السلبيات': neg.length ? reasonsList(neg) : 'لا ملاحظات',
    'الدرجات': g.lines.length ? g.lines.join('\n') : 'لم تُرصد درجات بعد', 'المجموع': g.max ? `${round1(g.got)} من ${g.max} (${pct(g.got, g.max)}٪)` : 'لم تُرصد درجات بعد', 'نص': opts.text || '',
  };
  return ar(text.replace(/\{([^{}]+)\}/g, (all, k) => (k.trim() in map ? map[k.trim()] : all)).replace(/\n{3,}/g, '\n\n').trim());
}

let msgUi = { tpl: 'weekly', period: 'week', who: 'all', text: '', sel: new Set() };
// the smart groups: who a message goes to, worked out from what was recorded
function recipients(cid, who) {
  const list = studentsIn(cid);
  const from = (PERIODS[msgUi.period] || PERIODS.week)[1]();
  if (who === 'neg') return list.filter((s) => behIn(s.id, from).some((b) => b.kind === 'neg'));
  if (who === 'pos') return list.filter((s) => { const l = behIn(s.id, from); return l.some((b) => b.kind === 'pos') && !l.some((b) => b.kind === 'neg'); });
  if (who === 'weak') return list.filter((s) => { const g = gradesOf(s); return g.max && pct(g.got, g.max) < T.settings.pass; });
  if (who === 'pick') return list.filter((s) => msgUi.sel.has(s.id));
  return list;
}

Views.messages = () => {
  if (T.queue && T.queue.list.some((m) => !m.done && !m.skip)) return queueView();
  if (!T.classes.length) return `<h2>الرسائل</h2>${noClasses()}`;
  const c = curCls();
  const tpl = T.tpls.find((t) => t.id === msgUi.tpl) || T.tpls[0];
  const to = recipients(c, msgUi.who);
  const sample = to[0] || studentsIn(c)[0];
  const opt = (v, n, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${n}</option>`;
  return `<h2>الرسائل</h2>
    ${classChips()}
    <div class="card">
      <label>الرسالة<select data-change="msg-tpl">${T.tpls.map((t) => opt(t.id, esc(t.name), tpl && tpl.id)).join('')}</select></label>
      <div class="btns"><button type="button" class="ghost sm" data-act="tpl-edit" data-id="${tpl ? tpl.id : ''}">✎ عدّل نصها</button><button type="button" class="ghost sm" data-act="tpl-new">＋ رسالة جديدة</button></div>
      ${tpl && /\{نص\}/.test(tpl.text) ? `<label>النص الذي تريد إبلاغه<textarea data-input="msg-text" rows="3" placeholder="مثل: الاختبار القصير يوم الثلاثاء في درس …">${esc(msgUi.text)}</textarea></label>` : ''}
      <label>الملاحظات والفترة<select data-change="msg-period">${opt('week', 'هذا الأسبوع', msgUi.period)}${opt('month', 'هذا الشهر', msgUi.period)}${opt('all', 'الفصل الدراسي كله', msgUi.period)}</select></label>
      <label>إلى<select data-change="msg-who">${opt('all', 'كل أولياء أمور الفصل', msgUi.who)}${opt('neg', 'من عليهم ملاحظات سلبية', msgUi.who)}${opt('pos', 'المتميزين (إيجابية بلا سلبية)', msgUi.who)}${opt('weak', `المتعثرين في الدرجات (أقل من ${T.settings.pass}٪)`, msgUi.who)}${opt('pick', 'طلاب أختارهم', msgUi.who)}</select></label>
      ${msgUi.who === 'pick' ? `<div class="chips wrap">${studentsIn(c).map((s) => `<button type="button" class="chip${msgUi.sel.has(s.id) ? ' on' : ''}" data-act="msg-pick" data-id="${s.id}">${esc(shortName(s))}</button>`).join('')}</div>` : ''}
      <div class="facts"><span>الرسائل: ${to.length}</span>${to.filter((s) => !phoneOk(s.phone)).length ? `<span class="warn">بلا رقم (لن تُرسل): ${to.filter((s) => !phoneOk(s.phone)).length}</span>` : ''}</div>
      ${sample && tpl ? `<h4>مثال: رسالة ولي أمر ${esc(shortName(sample))}</h4><div class="bubble">${esc(fill(tpl.text, sample, { period: msgUi.period, text: msgUi.text }))}</div>` : ''}
      <button type="button" class="primary big" data-act="q-start" data-tpl="${tpl ? tpl.id : ''}" data-sids="${to.map((s) => s.id).join(',')}" data-period="${msgUi.period}"${to.some((s) => phoneOk(s.phone)) ? '' : ' disabled'}>💬 جهّز ${ar(to.filter((s) => phoneOk(s.phone)).length)} رسالة واتساب</button>
    </div>
    <div class="card"><h3>رسالة واحدة لمجموعة واتساب</h3><p class="explain">رسالة عامة بلا أسماء (إعلان أو تذكير) تُرسل إلى مجموعة أولياء الأمور: تختار المجموعة في واتساب بعد الضغط.</p>
      <textarea id="grpText" rows="3" placeholder="مثل: نذكّركم بالاختبار القصير يوم الثلاثاء…"></textarea>
      <button type="button" class="ghost" data-act="grp-send">💬 أرسلها إلى مجموعة</button></div>
    ${sentLog()}`;
};
Changes['msg-tpl'] = (el) => { msgUi.tpl = el.value; render(); };
Changes['msg-period'] = (el) => { msgUi.period = el.value; render(); };
Changes['msg-who'] = (el) => { msgUi.who = el.value; render(); };
let msgTextTimer;
Inputs['msg-text'] = (el) => {
  msgUi.text = el.value;
  clearTimeout(msgTextTimer);
  // the example below follows what is typed, without losing the cursor
  msgTextTimer = setTimeout(() => {
    const b = document.querySelector('.bubble'), c = curCls();
    const sample = recipients(c, msgUi.who)[0] || studentsIn(c)[0];
    const tpl = T.tpls.find((t) => t.id === msgUi.tpl);
    if (b && sample && tpl) b.textContent = fill(tpl.text, sample, { period: msgUi.period, text: msgUi.text });
  }, 250);
};
Acts['msg-pick'] = (el) => { const id = el.dataset.id; msgUi.sel.has(id) ? msgUi.sel.delete(id) : msgUi.sel.add(id); render(); };
Acts['grp-send'] = () => {
  const t = $('grpText').value.trim();
  if (!t) { toast('اكتب الرسالة أولاً'); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(ar(t))}`, '_blank');
};

function sentLog() {
  const recent = T.sent.slice().sort((a, b) => b.at - a.at).slice(0, 8);
  if (!recent.length) return '';
  return `<div class="card"><h3>آخر ما أرسلت</h3>${recent.map((x) => { const s = stuOf(x.sid); return `<div class="hrow msg"><span>${esc(x.name)}: ${esc(s ? shortName(s) : '')}</span><small>${dateLabel(iso(new Date(x.at)))}</small></div>`; }).join('')}</div>`;
}

// ---- templates ----
function tplForm(t) {
  return `<form data-submit="tpl-save" data-id="${t ? t.id : ''}"><h3>${t ? 'نص الرسالة' : 'رسالة جديدة'}</h3>
    <label>اسمها<input name="name" required value="${esc(t ? t.name : '')}"></label>
    <label>نصها<textarea name="text" id="tplText" rows="9" required>${esc(t ? t.text : 'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الطالب} حفظه الله\n\n{المعلم}')}</textarea></label>
    <p class="hint">اضغط خانة لتضاف إلى النص، وتُستبدل عند الإرسال ببيانات كل طالب:</p>
    <div class="chips wrap">${VARS.map(([k, d]) => `<button type="button" class="chip var" data-act="tpl-var" data-v="${k}" title="${esc(d)}">{${k}}</button>`).join('')}</div>
    <div class="sheet-actions"><button class="primary">احفظ</button>${t ? `<button type="button" class="danger" data-act="tpl-del" data-id="${t.id}">احذفها</button>` : '<button type="button" class="ghost" data-act="close-sheet">إلغاء</button>'}</div></form>`;
}
Acts['tpl-new'] = () => openSheet(tplForm(null));
Acts['tpl-edit'] = (el) => openSheet(tplForm(T.tpls.find((t) => t.id === el.dataset.id)));
Acts['tpl-var'] = (el) => {
  const ta = $('tplText');
  const v = `{${el.dataset.v}}`;
  const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
  ta.value = ta.value.slice(0, a) + v + ta.value.slice(b);
  ta.focus({ preventScroll: true });
  ta.selectionStart = ta.selectionEnd = a + v.length;
};
Acts['tpl-save'] = (f) => {
  const name = f.elements.name.value.trim(), text = f.elements.text.value.trim();
  if (!name || !text) return;
  if (f.dataset.id) Object.assign(T.tpls.find((t) => t.id === f.dataset.id), { name, text });
  else { const t = { id: uid(), name, text }; T.tpls.push(t); msgUi.tpl = t.id; }
  save(); closeSheet(); render();
};
Acts['tpl-del'] = (el) => {
  if (T.tpls.length <= 1) { toast('تبقى رسالة واحدة على الأقل'); return; }
  if (!armed(el)) return;
  T.tpls = T.tpls.filter((t) => t.id !== el.dataset.id);
  msgUi.tpl = T.tpls[0].id;
  save(); closeSheet(); render();
};

// ---- the queue: each message written for its own parent, sent one after another ----
Acts['q-start'] = (el) => {
  const ids = el.dataset.sids.split(',').filter(Boolean);
  let tplId = el.dataset.tpl;
  if (!tplId) { // a single student from the behaviour sheet: the behaviour report
    tplId = 'weekly';
    if (!T.tpls.some((t) => t.id === tplId)) tplId = T.tpls[0].id;
  }
  const tpl = T.tpls.find((t) => t.id === tplId);
  if (!tpl) { toast('الرسالة غير موجودة؛ أضفها من «الرسائل»'); return; }
  if (/\{نص\}/.test(tpl.text) && !msgUi.text.trim()) { toast('اكتب النص الذي تريد إبلاغه'); return; }
  const list = ids.map(stuOf).filter(Boolean).map((s) => ({ sid: s.id, text: fill(tpl.text, s, { period: el.dataset.period || 'week', text: msgUi.text }), done: false, skip: !phoneOk(s.phone) }));
  T.queue = { tpl: tpl.id, name: tpl.name, at: Date.now(), list, cur: -1 };
  save(); closeSheet();
  go('messages');
};
function queueView() {
  const q = T.queue;
  const ready = q.list.filter((m) => !m.skip);
  const done = ready.filter((m) => m.done).length;
  const next = q.list.findIndex((m) => !m.done && !m.skip);
  const ns = next >= 0 ? stuOf(q.list[next].sid) : null;
  const noPhone = q.list.filter((m) => m.skip && !phoneOk((stuOf(m.sid) || {}).phone));
  return `<h2>إرسال «${esc(q.name)}»</h2>
    <div class="card"><div class="facts"><span class="good">أُرسلت: ${done} من ${ready.length}</span>${noPhone.length ? `<span class="warn">بلا رقم: ${noPhone.length}</span>` : ''}</div>
      <div class="bar"><i style="width:${pct(done, ready.length)}%"></i></div>
      ${q.cur >= 0 && q.list[q.cur] && !q.list[q.cur].done ? `<button type="button" class="ghost big" data-act="q-ok">✓ أرسلتها إلى ولي أمر ${esc(shortName(stuOf(q.list[q.cur].sid) || { name: '' }))}</button>` : ''}
      ${ns ? `<button type="button" class="primary big wa" data-act="q-send" data-i="${next}">💬 أرسل إلى ولي أمر ${esc(shortName(ns))}</button>
      <p class="hint">يفتح واتساب والرسالة مكتوبة؛ اضغط إرسال ثم ارجع هنا، وتجد التالي جاهزاً.</p>` : ''}
      <div class="btns"><button type="button" class="ghost sm" data-act="q-end">${next >= 0 ? 'أوقف الإرسال' : 'انتهيت'}</button></div></div>
    <ul class="list q">${q.list.map((m, i) => { const s = stuOf(m.sid); if (!s) return ''; return `<li class="${m.done ? 'done' : m.skip ? 'skip' : i === next ? 'cur' : ''}">
      <details><summary><span class="grow">${m.done ? '✓ ' : ''}${esc(s.name)}</span>${m.skip ? `<span class="tag warn">${phoneOk(s.phone) ? 'تخطيتها' : 'بلا رقم'}</span>` : ''}</summary><div class="bubble">${esc(m.text)}</div>
      <div class="btns">${phoneOk(s.phone) ? `<button type="button" class="ghost sm" data-act="q-send" data-i="${i}">💬 ${m.done ? 'أرسلها مرة أخرى' : 'أرسلها'}</button>` : ''}${!m.done && !m.skip ? `<button type="button" class="ghost sm" data-act="q-skip" data-i="${i}">تخطَّها</button>` : ''}<button type="button" class="ghost sm" data-act="q-copy" data-i="${i}">انسخها</button></div></details></li>`; }).join('')}</ul>`;
}
Acts['q-send'] = (el) => {
  const q = T.queue, i = Number(el.dataset.i), m = q.list[i], s = stuOf(m.sid);
  if (!s || !phoneOk(s.phone)) return;
  window.open(`https://wa.me/${s.phone}?text=${encodeURIComponent(m.text)}`, '_blank');
  // there is no way to know that the message was really sent: back in the app, it counts as sent
  // (and «✓ أرسلتها» says so by hand if the app never left the screen)
  q.cur = i;
  qPending = true;
  save(); render();
};
Acts['q-ok'] = () => qMarkSent();
let qPending = false;
function qMarkSent() {
  qPending = false;
  const q = T.queue;
  if (!q || q.cur < 0 || !q.list[q.cur]) return;
  const m = q.list[q.cur];
  if (!m.done) { m.done = true; T.sent.push({ id: uid(), sid: m.sid, at: Date.now(), tpl: q.tpl, name: q.name }); }
  q.cur = -1;
  save();
  if (UI.tab === 'messages') render();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && qPending) setTimeout(qMarkSent, 400); });
Acts['q-skip'] = (el) => { T.queue.list[Number(el.dataset.i)].skip = true; save(); render(); };
Acts['q-copy'] = (el) => copyText(T.queue.list[Number(el.dataset.i)].text);
Acts['q-end'] = () => { T.queue = null; save(); render(); };
