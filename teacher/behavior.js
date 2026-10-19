'use strict';
// Behaviour: one press on a student's name records a positive or negative note with a ready
// reason. The page itself says who needs a message home this week, and sends it in one go.

let behUi = { multi: false, sel: new Set() };
const behIn = (sid, from, to = today()) => T.beh.filter((b) => b.sid === sid && b.d >= from && b.d <= to);
const behCount = (sid, kind, from) => behIn(sid, from).filter((b) => b.kind === kind).length;
// a message of this kind sent to this student's parent after this time?
const sentAfter = (sid, tpl, at) => T.sent.some((x) => x.sid === sid && x.tpl === tpl && x.at >= at);

// who needs a word home this week: too many negatives (not yet told), and the outstanding ones (not yet thanked)
function behAlerts(cid) {
  const from = weekStart();
  const warn = [], praise = [];
  for (const s of studentsIn(cid)) {
    const list = behIn(s.id, from);
    const neg = list.filter((b) => b.kind === 'neg');
    const pos = list.filter((b) => b.kind === 'pos');
    if (neg.length >= T.settings.negAlert && !sentAfter(s.id, 'warn', Math.max(...neg.map((b) => b.at)))) warn.push(s);
    if (pos.length >= 3 && !neg.length && !sentAfter(s.id, 'praise', new Date(`${from}T00:00`).getTime())) praise.push(s);
  }
  return { warn, praise };
}

Views.behavior = () => {
  if (!T.classes.length) return `<h2>السلوك</h2>${noClasses()}`;
  const c = curCls();
  const list = studentsIn(c);
  const from = weekStart();
  const { warn, praise } = behAlerts(c);
  const weekPos = list.reduce((n, s) => n + behCount(s.id, 'pos', from), 0);
  const weekNeg = list.reduce((n, s) => n + behCount(s.id, 'neg', from), 0);
  const names = (arr) => arr.map((s) => esc(shortName(s))).join('، ');
  return `<h2>السلوك</h2>
    ${classChips()}
    ${warn.length ? `<div class="card alert"><b>⚠ يحتاجون تنبيه أوليائهم (${warn.length})</b><p>${names(warn)}</p><p class="explain">بلغت ملاحظاتهم السلبية هذا الأسبوع ${ar(T.settings.negAlert)} أو أكثر، ولم تُرسل لأوليائهم رسالة بعدها.</p>
      <button type="button" class="primary" data-act="q-start" data-tpl="warn" data-sids="${warn.map((s) => s.id).join(',')}" data-period="week">💬 جهّز رسائل التنبيه</button></div>` : ''}
    ${praise.length ? `<div class="card praise"><b>🌟 متميزون هذا الأسبوع (${praise.length})</b><p>${names(praise)}</p><p class="explain">لهم ٣ ملاحظات إيجابية أو أكثر هذا الأسبوع بلا سلبية.</p>
      <button type="button" class="primary" data-act="q-start" data-tpl="praise" data-sids="${praise.map((s) => s.id).join(',')}" data-period="week">💬 جهّز رسائل الثناء</button></div>` : ''}
    <div class="row-between"><p class="muted">اليوم: ${dateLabel(today())}</p>
      <button type="button" class="ghost sm${behUi.multi ? ' on' : ''}" data-act="beh-multi">${behUi.multi ? 'إلغاء التحديد' : '☑ عدة طلاب معاً'}</button></div>
    ${behUi.multi ? `<p class="hint">اضغط على الطلاب ثم «سجّل لهم».</p>` : ''}
    ${list.length ? `<div class="grid">${list.map((s) => {
      const p = behCount(s.id, 'pos', from), n = behCount(s.id, 'neg', from);
      const on = behUi.multi && behUi.sel.has(s.id);
      return `<button type="button" class="stu${on ? ' sel' : ''}" data-act="beh-stu" data-id="${s.id}">
        <b>${esc(shortName(s))}</b><span class="cnt">${p ? `<i class="p">＋${p}</i>` : ''}${n ? `<i class="n">−${n}</i>` : ''}</span></button>`;
    }).join('')}</div>` : '<p class="empty">لا طلاب في هذا الفصل. أضفهم من «الطلاب».</p>'}
    ${behUi.multi ? `<div class="selbar"><span>المحدد: ${behUi.sel.size}</span><button type="button" class="ghost sm" data-act="beh-all">${behUi.sel.size === list.length ? 'ألغِ الكل' : 'حدّد الكل'}</button><button type="button" class="primary" data-act="beh-multi-go"${behUi.sel.size ? '' : ' disabled'}>سجّل لهم</button></div>` : ''}
    <div class="card"><h3>هذا الأسبوع</h3><div class="facts"><span class="good">ملاحظات إيجابية: ${weekPos}</span><span class="warn">ملاحظات سلبية: ${weekNeg}</span></div>
      <div class="btns"><button type="button" class="ghost" data-act="q-start" data-tpl="weekly" data-sids="${list.map((s) => s.id).join(',')}" data-period="week">💬 تقرير الأسبوع لكل أولياء الفصل</button>
      <button type="button" class="ghost" data-act="beh-xlsx">📄 تقرير السلوك (إكسل)</button></div></div>`;
};

Acts['beh-multi'] = () => { behUi.multi = !behUi.multi; behUi.sel.clear(); render(); };
Acts['beh-all'] = () => {
  const ids = studentsIn(curCls()).map((s) => s.id);
  behUi.sel = behUi.sel.size === ids.length ? new Set() : new Set(ids);
  render();
};
Acts['beh-stu'] = (el) => {
  const id = el.dataset.id;
  if (behUi.multi) { behUi.sel.has(id) ? behUi.sel.delete(id) : behUi.sel.add(id); render(); return; }
  behSheet([id]);
};
Acts['beh-multi-go'] = () => behSheet([...behUi.sel]);

function behSheet(ids) {
  const one = ids.length === 1 ? stuOf(ids[0]) : null;
  const from = weekStart();
  openSheet(`<h3>${one ? esc(one.name) : `${ar(ids.length)} طلاب`}</h3>
    ${one ? `<div class="facts"><span class="good">إيجابية هذا الأسبوع: ${behCount(one.id, 'pos', from)}</span><span class="warn">سلبية: ${behCount(one.id, 'neg', from)}</span></div>` : ''}
    <input id="behNote" placeholder="ملاحظة إضافية (اختياري)">
    <h4 class="pos-h">إيجابية</h4><div class="chips wrap">${T.reasons.pos.map((r) => `<button type="button" class="chip pos" data-act="beh-add" data-kind="pos" data-ids="${ids.join(',')}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    <h4 class="neg-h">سلبية</h4><div class="chips wrap">${T.reasons.neg.map((r) => `<button type="button" class="chip neg" data-act="beh-add" data-kind="neg" data-ids="${ids.join(',')}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    ${one ? `<div class="btns"><button type="button" class="ghost sm" data-act="q-start" data-tpl="" data-sids="${one.id}" data-period="week">💬 رسالة لولي أمره</button><button type="button" class="ghost sm" data-act="stu-edit" data-id="${one.id}">بياناته وسجلّه</button></div>` : ''}`);
}
Acts['beh-add'] = (el) => {
  const ids = el.dataset.ids.split(',');
  const note = ($('behNote') && $('behNote').value.trim()) || '';
  const now = Date.now();
  const added = ids.map((sid) => ({ id: uid(), sid, d: today(), at: now, kind: el.dataset.kind, reason: el.dataset.r, note }));
  T.beh.push(...added);
  save(); closeSheet();
  if (behUi.multi) { behUi.multi = false; behUi.sel.clear(); }
  render();
  const who = ids.length === 1 ? shortName(stuOf(ids[0])) : `${ids.length} طلاب`;
  toast(`${el.dataset.kind === 'pos' ? '＋' : '−'} ${el.dataset.r}: ${who}`, () => {
    const gone = new Set(added.map((b) => b.id));
    T.beh = T.beh.filter((b) => !gone.has(b.id));
    save(); render();
  });
};
Acts['beh-del'] = (el) => {
  if (!armed(el)) return;
  const b = T.beh.find((x) => x.id === el.dataset.id);
  T.beh = T.beh.filter((x) => x.id !== el.dataset.id);
  save(); render();
  if (b) openSheet(stuForm(stuOf(b.sid)));
};

// the behaviour report for the school: a sheet per class with each student's counts, and every note
Acts['beh-xlsx'] = () => {
  const sheets = [];
  const month = monthStart();
  for (const c of T.classes) {
    const list = studentsIn(c.id);
    sheets.push({
      name: `ملخص ${c.name}`,
      columns: [{ title: 'م', width: 5 }, { title: 'الطالب', width: 30 }, { title: 'إيجابية هذا الأسبوع', width: 12 }, { title: 'سلبية هذا الأسبوع', width: 12 }, { title: 'إيجابية هذا الشهر', width: 12 }, { title: 'سلبية هذا الشهر', width: 12 }, { title: 'إيجابية الكل', width: 11 }, { title: 'سلبية الكل', width: 11 }, { title: 'أكثر ملاحظة سلبية', width: 22 }],
      rows: list.map((s, i) => {
        const all = T.beh.filter((b) => b.sid === s.id);
        const negs = {};
        for (const b of all) if (b.kind === 'neg') negs[b.reason] = (negs[b.reason] || 0) + 1;
        const top = Object.entries(negs).sort((a, b) => b[1] - a[1])[0];
        return [i + 1, s.name, behCount(s.id, 'pos', weekStart()), behCount(s.id, 'neg', weekStart()), behCount(s.id, 'pos', month), behCount(s.id, 'neg', month),
          all.filter((b) => b.kind === 'pos').length, all.filter((b) => b.kind === 'neg').length, top ? `${top[0]} (${top[1]})` : ''];
      }),
    });
  }
  const log = T.beh.slice().sort((a, b) => a.at - b.at).map((b) => { const s = stuOf(b.sid); return [b.d, s ? s.name : '', s && clsOf(s.cls) ? clsOf(s.cls).name : '', b.kind === 'pos' ? 'إيجابية' : 'سلبية', b.reason, b.note]; });
  sheets.push({ name: 'كل الملاحظات', columns: [{ title: 'التاريخ', width: 12 }, { title: 'الطالب', width: 30 }, { title: 'الفصل', width: 14 }, { title: 'النوع', width: 10 }, { title: 'الملاحظة', width: 22 }, { title: 'إضافة', width: 30, wrap: true }], rows: log });
  download(Xlsx.build(sheets), `muallim-behavior-${today()}.xlsx`);
};
