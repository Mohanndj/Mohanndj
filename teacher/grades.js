'use strict';
// Grades: each assessment (a short test, homework, a task…) with its full mark and branch of the
// subject; marks typed quickly one student after another; then, worked out by themselves, each
// student's total, the struggling students and the branches they are weak in, a remedial plan,
// and the grade sheet for the school in Excel.

let grUi = { view: 'items' };
const itemsOf = (cid) => T.items.filter((i) => i.cls === cid).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
const markOf = (itemId, sid) => { const v = (T.marks[itemId] || {})[sid]; return typeof v === 'number' ? v : null; };

// a student's marks: only the assessments with a mark count (no mark = not entered yet, or absent)
function gradesOf(s) {
  let got = 0, max = 0;
  const lines = [], bySkill = {};
  for (const it of itemsOf(s.cls)) {
    const m = markOf(it.id, s.id);
    if (m === null) continue;
    got += m; max += it.max;
    lines.push(`- ${it.title}: ${round1(m)} من ${it.max}`);
    const k = it.skill || 'عام';
    bySkill[k] = bySkill[k] || { got: 0, max: 0 };
    bySkill[k].got += m; bySkill[k].max += it.max;
  }
  return { got, max, lines, bySkill };
}
// the class's average in each branch, and the students under the line with their weak branches
function classAnalysis(cid) {
  const pass = T.settings.pass;
  const list = studentsIn(cid).map((s) => ({ s, g: gradesOf(s) }));
  const skills = {};
  for (const { g } of list) for (const [k, v] of Object.entries(g.bySkill)) { skills[k] = skills[k] || { got: 0, max: 0 }; skills[k].got += v.got; skills[k].max += v.max; }
  const weak = list.filter((x) => x.g.max && pct(x.g.got, x.g.max) < pass)
    .map((x) => ({ ...x, skills: Object.entries(x.g.bySkill).filter(([, v]) => pct(v.got, v.max) < pass).map(([k, v]) => [k, pct(v.got, v.max)]) }))
    .sort((a, b) => pct(a.g.got, a.g.max) - pct(b.g.got, b.g.max));
  return { list, skills, weak };
}

Views.grades = () => {
  if (!T.classes.length) return `<h2>الدرجات</h2>${noClasses()}`;
  const c = curCls();
  const tabs = `<div class="seg"><button type="button" class="${grUi.view === 'items' ? 'on' : ''}" data-act="gr-view" data-v="items">التقويمات</button><button type="button" class="${grUi.view === 'res' ? 'on' : ''}" data-act="gr-view" data-v="res">النتائج والمتعثرون</button></div>`;
  return `<h2>الدرجات</h2>${classChips()}${tabs}${grUi.view === 'res' ? grResults(c) : grItems(c)}`;
};
Acts['gr-view'] = (el) => { grUi.view = el.dataset.v; render(); };

function grItems(c) {
  const items = itemsOf(c);
  const n = studentsIn(c).length;
  return `<div class="btns"><button type="button" class="primary" data-act="it-new">＋ تقويم جديد</button></div>
    ${items.length ? `<ul class="list">${items.map((it) => {
      const ms = studentsIn(c).map((s) => markOf(it.id, s.id)).filter((m) => m !== null);
      const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null;
      return `<li><button type="button" class="li-btn" data-act="it-open" data-id="${it.id}"><span class="grow"><b>${esc(it.title)}</b><small>${esc(it.skill || 'عام')} | ${dateLabel(it.d)} | من ${it.max}</small></span>
        <span class="tag${ms.length < n ? ' warn' : ' good'}">رُصد ${ms.length} من ${n}</span>${avg !== null ? `<span class="tag">المتوسط ${round1(avg)}</span>` : ''}</button></li>`;
    }).join('')}</ul>` : '<p class="empty">لا تقويمات بعد. أضف اختباراً قصيراً أو واجباً أو مشاركة، ثم ارصد درجاته.</p>'}`;
}

function itemForm(it) {
  return `<form data-submit="it-save" data-id="${it ? it.id : ''}"><h3>${it ? 'التقويم' : 'تقويم جديد'}</h3>
    <label>اسمه<input name="title" required value="${esc(it ? it.title : '')}" placeholder="مثل: اختبار قصير: التوحيد ١"></label>
    <label>الدرجة الكاملة<input name="max" inputmode="decimal" required value="${ar(it ? it.max : 10)}"></label>
    <label>الفرع<select name="skill"><option value="">عام</option>${T.skills.map((k) => `<option${it && it.skill === k ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
    <label>التاريخ<input name="d" type="date" value="${it ? it.d : today()}"></label>
    <div class="sheet-actions"><button class="primary">${it ? 'احفظ' : 'احفظ وارصد الدرجات'}</button>${it ? `<button type="button" class="danger" data-act="it-del" data-id="${it.id}">احذفه ودرجاته</button>` : '<button type="button" class="ghost" data-act="close-sheet">إلغاء</button>'}</div></form>`;
}
Acts['it-new'] = () => openSheet(itemForm(null));
Acts['it-edit'] = (el) => openSheet(itemForm(T.items.find((i) => i.id === el.dataset.id)));
Acts['it-save'] = (f) => {
  const max = num(f.elements.max.value);
  const title = f.elements.title.value.trim();
  if (!title || !(max > 0)) { toast('اكتب الاسم والدرجة الكاملة'); return; }
  const data = { title, max, skill: f.elements.skill.value, d: f.elements.d.value || today() };
  if (f.dataset.id) { Object.assign(T.items.find((i) => i.id === f.dataset.id), data); save(); closeSheet(); render(); return; }
  const it = { id: uid(), cls: curCls(), quiz: '', ...data };
  T.items.push(it);
  save(); render();
  itEntry(it);
};
Acts['it-del'] = (el) => {
  if (!armed(el)) return;
  T.items = T.items.filter((i) => i.id !== el.dataset.id);
  delete T.marks[el.dataset.id];
  save(); closeSheet(); render();
};
Acts['it-open'] = (el) => itEntry(T.items.find((i) => i.id === el.dataset.id));

// marks typed one after another: «التالي» on the keyboard moves to the next student
function itEntry(it) {
  const list = studentsIn(it.cls);
  openSheet(`<h3>${esc(it.title)}</h3><p class="muted">من ${it.max} | ${esc(it.skill || 'عام')} | ${dateLabel(it.d)}</p>
    <div class="btns"><button type="button" class="ghost sm" data-act="it-full" data-id="${it.id}">ضع الدرجة الكاملة لمن لم تُرصد له</button><button type="button" class="ghost sm" data-act="it-edit" data-id="${it.id}">✎ التقويم</button></div>
    <div class="marks">${list.map((s, i) => { const m = markOf(it.id, s.id); return `<label class="mrow"><span class="no">${i + 1}</span><span class="grow">${esc(s.name)}</span>
      <input inputmode="decimal" enterkeyhint="next" class="latin mark" data-input="mark" data-it="${it.id}" data-sid="${s.id}" value="${m === null ? '' : m}" placeholder="—"></label>`; }).join('')}</div>
    <p class="hint">اترك الخانة فارغة للغائب؛ لا يُحسب عليه.</p>
    <div class="sheet-actions"><button type="button" class="primary" data-act="close-sheet">تم</button></div>`);
}
Inputs.mark = (el) => {
  const it = T.items.find((i) => i.id === el.dataset.it);
  const v = num(el.value);
  T.marks[it.id] = T.marks[it.id] || {};
  if (v === null) delete T.marks[it.id][el.dataset.sid];
  else if (v < 0 || v > it.max) { el.classList.add('bad'); return; }
  else T.marks[it.id][el.dataset.sid] = v;
  el.classList.remove('bad');
  save();
  if (!$('sheet').hidden) render();
};
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.classList.contains('mark')) return;
  e.preventDefault();
  const all = [...document.querySelectorAll('input.mark')];
  const next = all[all.indexOf(e.target) + 1];
  if (next) next.focus(); else e.target.blur();
});
Acts['it-full'] = (el) => {
  const it = T.items.find((i) => i.id === el.dataset.id);
  T.marks[it.id] = T.marks[it.id] || {};
  for (const s of studentsIn(it.cls)) if (markOf(it.id, s.id) === null) T.marks[it.id][s.id] = it.max;
  save(); render(); itEntry(it);
};

function grResults(c) {
  const { list, skills, weak } = classAnalysis(c);
  if (!itemsOf(c).length) return '<p class="empty">لا درجات بعد. أضف تقويماً وارصد درجاته من «التقويمات».</p>';
  const pass = T.settings.pass;
  const cls = (p) => (p >= 90 ? 'good' : p < pass ? 'bad' : '');
  const sk = Object.entries(skills).sort((a, b) => pct(a[1].got, a[1].max) - pct(b[1].got, b[1].max));
  return `<div class="card"><h3>مستوى الفصل في كل فرع</h3>${sk.map(([k, v]) => { const p = pct(v.got, v.max); return `<div class="meter"><span>${esc(k)}</span><div class="bar"><i class="${cls(p)}" style="width:${p}%"></i></div><b class="${cls(p)}">${p}٪</b></div>`; }).join('')}
      ${sk.length && pct(sk[0][1].got, sk[0][1].max) < 75 ? `<p class="hint">أضعف فرع: ${esc(sk[0][0])}؛ يستحق مراجعة للفصل كله.</p>` : ''}</div>
    <div class="card ${weak.length ? 'alert' : ''}"><h3>المتعثرون (أقل من ${pass}٪): ${weak.length}</h3>
      ${weak.length ? `${weak.map((x) => `<div class="hrow"><span><b>${esc(shortName(x.s))}</b> ${pct(x.g.got, x.g.max)}٪</span><small>${x.skills.map(([k, p]) => `${esc(k)} ${p}٪`).join('، ') || ''}</small></div>`).join('')}
      <div class="btns"><button type="button" class="primary" data-act="plan-open">📋 الخطة العلاجية</button><button type="button" class="ghost" data-act="q-start" data-tpl="grades" data-sids="${weak.map((x) => x.s.id).join(',')}" data-period="month">💬 أرسل درجاتهم لأوليائهم</button></div>` : '<p class="good">لا متعثرين في هذا الفصل. ما شاء الله.</p>'}</div>
    <div class="card"><h3>كل الطلاب</h3>
      <table class="tbl"><thead><tr><th>الطالب</th><th>المجموع</th><th>النسبة</th></tr></thead><tbody>
      ${list.map(({ s, g }) => `<tr><td>${esc(shortName(s))}</td><td>${g.max ? `${round1(g.got)} من ${g.max}` : '—'}</td><td class="${g.max ? cls(pct(g.got, g.max)) : ''}">${g.max ? `${pct(g.got, g.max)}٪` : '—'}</td></tr>`).join('')}</tbody></table>
      <div class="btns"><button type="button" class="ghost" data-act="q-start" data-tpl="grades" data-sids="${list.filter((x) => x.g.max).map((x) => x.s.id).join(',')}" data-period="month">💬 أرسل الدرجات لكل الأولياء</button><button type="button" class="ghost" data-act="gr-xlsx">📄 كشف الدرجات والخطة (إكسل)</button></div></div>`;
}

// what a struggling student needs in each weak branch: the same ready steps a remedial plan asks for
const PLAN_STEPS = ['إعادة شرح المهارة بأسلوب مختلف وأمثلة من واقعه', 'ورقة عمل علاجية قصيرة في الفرع', 'تكليف زميل متميز بمساعدته (التعلم بالأقران)', 'اختبار قصير بعد أسبوعين لقياس التحسن', 'التواصل مع ولي أمره للمتابعة في البيت'];
function planRows(c) {
  return classAnalysis(c).weak.map((x) => ({ name: x.s.name, total: pct(x.g.got, x.g.max), skills: x.skills.length ? x.skills.map(([k, p]) => `${k} (${p}٪)`).join('، ') : 'عام' }));
}
Acts['plan-open'] = () => {
  const c = curCls();
  const rows = planRows(c);
  const text = `الخطة العلاجية لمادة ${T.settings.subject}، فصل ${clsOf(c).name}\nالتاريخ: ${dateLabel(today())}\n\n${rows.map((r, i) => `${i + 1}) ${r.name}: النسبة ${r.total}٪\nمواطن الضعف: ${r.skills}`).join('\n\n')}\n\nالإجراءات العلاجية:\n${PLAN_STEPS.map((p) => `- ${p}`).join('\n')}${T.settings.teacher ? `\n\n${T.settings.teacher}` : ''}`;
  openSheet(`<h3>الخطة العلاجية</h3><pre class="plan">${esc(ar(text))}</pre>
    <div class="sheet-actions"><button type="button" class="primary" data-act="plan-copy">نسخ</button><button type="button" class="ghost" data-act="gr-xlsx">📄 إكسل</button></div>`);
};
Acts['plan-copy'] = () => copyText(document.querySelector('pre.plan').textContent);

// the grade sheet for the school: per class the marks of every assessment, the total and the state;
// then the remedial plan
Acts['gr-xlsx'] = () => {
  const sheets = [];
  const plan = [];
  for (const c of T.classes) {
    const items = itemsOf(c.id);
    if (!items.length) continue;
    const list = studentsIn(c.id);
    sheets.push({
      name: `درجات ${c.name}`,
      columns: [{ title: 'م', width: 5 }, { title: 'الطالب', width: 30 }, ...items.map((it) => ({ title: `${it.title} (${it.max})`, width: 13 })), { title: 'المجموع', width: 10 }, { title: 'من', width: 8 }, { title: 'النسبة', width: 9 }, { title: 'الحالة', width: 10 }],
      rows: list.map((s, i) => {
        const g = gradesOf(s);
        const p = g.max ? pct(g.got, g.max) : null;
        return [i + 1, s.name, ...items.map((it) => markOf(it.id, s.id) ?? ''), g.max ? round1(g.got) : '', g.max || '', p === null ? '' : `${p}%`, p === null ? '' : p < T.settings.pass ? 'متعثر' : p >= 90 ? 'متميز' : 'جيد'];
      }),
    });
    for (const r of planRows(c.id)) plan.push([c.name, r.name, `${r.total}%`, r.skills, PLAN_STEPS.join('، ')]);
  }
  if (!sheets.length) { toast('لا درجات بعد'); return; }
  if (plan.length) sheets.push({ name: 'الخطة العلاجية', columns: [{ title: 'الفصل', width: 14 }, { title: 'الطالب', width: 30 }, { title: 'النسبة', width: 9 }, { title: 'مواطن الضعف', width: 30, wrap: true }, { title: 'الإجراءات', width: 60, wrap: true }], rows: plan });
  download(Xlsx.build(sheets), `muallim-grades-${today()}.xlsx`);
};
