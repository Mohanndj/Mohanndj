'use strict';
// «مساعد المعلم»: the state, saving, shared helpers, the page frame and the sheet (bottom panel).
// Everything stays in this browser (localStorage), nothing is sent anywhere except the WhatsApp
// messages the teacher sends himself.

const APP_VERSION = 1;
const KEY = 'muallim-v1';
const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
// the school week starts on Sunday
const weekStart = (s = today()) => addDays(s, -parseD(s).getDay());
const monthStart = (s = today()) => `${s.slice(0, 8)}01`;
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const dateLabel = (s) => { const d = parseD(s); return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]}`; };

// Arabic digits on screen and in messages; the decimal point becomes «٫» (a dot looks like the Arabic zero)
const ar = (s) => String(s ?? '').replace(/(\d)\.(\d)/g, '$1٫$2').replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const latin = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0);
const num = (s) => { const t = latin(s).replace(/[٫,]/g, '.').replace(/[^\d.\-]/g, ''); return t === '' || t === '.' ? null : Number(t); };
const round1 = (n) => Math.round(n * 10) / 10;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${ar(n)} ${few}` : `${ar(n)} ${many}`);

const DEFAULT_REASONS = {
  pos: ['مشاركة متميزة', 'إجابة صحيحة', 'حل الواجب', 'حفظ متقن', 'تعاون مع زملائه', 'انضباط وهدوء', 'إحضار الكتاب'],
  neg: ['حديث جانبي', 'لم يحل الواجب', 'لم يحضر الكتاب', 'تأخر عن الحصة', 'عدم الانتباه', 'نوم في الحصة', 'إزعاج زملائه'],
};
const DEFAULT_SKILLS = ['التوحيد', 'الحديث والسيرة', 'الفقه والسلوك', 'التفسير'];
const DEFAULT_TPLS = [
  { id: 'weekly', name: 'تقرير السلوك', text: 'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الطالب} حفظه الله\nهذا ملخص {الفترة} لابنكم {الاسم} في مادة {المادة}:\n{ملخص_السلوك}\nشاكرين تعاونكم.\n{المعلم}' },
  { id: 'praise', name: 'ثناء وشكر', text: 'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الطالب} حفظه الله\nيسرّني إبلاغكم بتميّز ابنكم {الاسم} في مادة {المادة}:\n{الإيجابيات}\nبارك الله فيه وجزاكم خيراً على حسن تربيته.\n{المعلم}' },
  { id: 'warn', name: 'تنبيه سلوكي', text: 'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الطالب} حفظه الله\nنودّ إطلاعكم على ملاحظات {الفترة} على ابنكم {الاسم} في مادة {المادة}:\n{السلبيات}\nنأمل متابعته وتوجيهه، وثقتنا بكم كبيرة.\n{المعلم}' },
  { id: 'grades', name: 'الدرجات', text: 'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الطالب} حفظه الله\nدرجات ابنكم {الاسم} في مادة {المادة}:\n{الدرجات}\nالمجموع: {المجموع}\n{المعلم}' },
  { id: 'notice', name: 'إعلان', text: 'السلام عليكم ورحمة الله وبركاته\nولي أمر الطالب {الطالب} حفظه الله\n{نص}\n{المعلم}' },
];

let T;
function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  const arr = (x) => (Array.isArray(x) ? x : []);
  const st = d.settings || {};
  return {
    settings: {
      teacher: String(st.teacher || ''), school: String(st.school || ''), subject: String(st.subject || 'الدراسات الإسلامية'),
      phone: String(st.phone || ''), negAlert: Number(st.negAlert) > 0 ? Number(st.negAlert) : 3, pass: Number(st.pass) > 0 ? Number(st.pass) : 60,
      showAns: st.showAns !== false,
    },
    classes: arr(d.classes).filter((c) => c && c.id).map((c) => ({ id: c.id, name: String(c.name || '') })),
    students: arr(d.students).filter((s) => s && s.id).map((s) => ({ id: s.id, cls: s.cls || '', name: String(s.name || ''), parent: String(s.parent || ''), phone: String(s.phone || '') })),
    beh: arr(d.beh).filter((b) => b && b.id && b.sid).map((b) => ({ id: b.id, sid: b.sid, d: b.d || today(), at: b.at || Date.now(), kind: b.kind === 'neg' ? 'neg' : 'pos', reason: String(b.reason || ''), note: String(b.note || '') })),
    reasons: { pos: arr(d.reasons && d.reasons.pos).length ? d.reasons.pos.map(String) : [...DEFAULT_REASONS.pos], neg: arr(d.reasons && d.reasons.neg).length ? d.reasons.neg.map(String) : [...DEFAULT_REASONS.neg] },
    skills: arr(d.skills).length ? d.skills.map(String) : [...DEFAULT_SKILLS],
    tpls: arr(d.tpls).length ? d.tpls.filter((t) => t && t.id).map((t) => ({ id: t.id, name: String(t.name || ''), text: String(t.text || '') })) : DEFAULT_TPLS.map((t) => ({ ...t })),
    sent: arr(d.sent).filter((x) => x && x.sid).map((x) => ({ id: x.id || uid(), sid: x.sid, at: x.at || Date.now(), tpl: String(x.tpl || ''), name: String(x.name || '') })),
    queue: d.queue && Array.isArray(d.queue.list) ? d.queue : null,
    items: arr(d.items).filter((i) => i && i.id).map((i) => ({ id: i.id, cls: i.cls || '', title: String(i.title || ''), max: Number(i.max) > 0 ? Number(i.max) : 10, skill: String(i.skill || ''), d: i.d || today(), quiz: i.quiz || '' })),
    marks: d.marks && typeof d.marks === 'object' ? d.marks : {},
    quizzes: arr(d.quizzes).filter((q) => q && q.id).map((q) => ({ id: q.id, title: String(q.title || ''), skill: String(q.skill || ''), qs: arr(q.qs), at: q.at || Date.now() })),
  };
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { d = null; }
  T = normalize(d);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(T)); } catch { toast('تعذّر الحفظ: مساحة المتصفح ممتلئة'); }
}

// ---- lookups ----
const clsOf = (id) => T.classes.find((c) => c.id === id);
const stuOf = (id) => T.students.find((s) => s.id === id);
const studentsIn = (cid) => T.students.filter((s) => s.cls === cid);
const firstName = (s) => (s.name.trim().split(/\s+/)[0] || s.name);
const shortName = (s) => s.name.trim().split(/\s+/).slice(0, 2).join(' ');
// the class picked on each page is remembered for the next visit
let UI = { cls: '', tab: 'students' };
function curCls() {
  if (!clsOf(UI.cls)) UI.cls = T.classes[0] ? T.classes[0].id : '';
  return UI.cls;
}
function classChips(act = 'pick-cls') {
  if (!T.classes.length) return '';
  const c = curCls();
  return `<div class="chips">${T.classes.map((k) => `<button type="button" class="chip${k.id === c ? ' on' : ''}" data-act="${act}" data-id="${k.id}">${esc(k.name)} <small>${ar(studentsIn(k.id).length)}</small></button>`).join('')}</div>`;
}
const noClasses = () => `<div class="empty"><p>لا توجد فصول بعد.</p><button type="button" class="primary" data-act="go" data-tab="students">ابدأ بإضافة فصولك وطلابك</button></div>`;

// ---- phone numbers: Saudi numbers written 05… become 9665… for WhatsApp ----
function normPhone(s) {
  let p = latin(s).replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
  if (/^05\d{8}$/.test(p)) p = `966${p.slice(1)}`;
  else if (/^5\d{8}$/.test(p)) p = `966${p}`;
  return p;
}
const phoneOk = (p) => /^\d{9,15}$/.test(p || '');

// ---- frame ----
const TABS = [
  ['students', 'الطلاب', '👥'],
  ['behavior', 'السلوك', '⭐'],
  ['messages', 'الرسائل', '💬'],
  ['grades', 'الدرجات', '📊'],
  ['quizzes', 'الاختبارات', '📝'],
];
const Views = {};
function render() {
  const y = window.scrollY;
  const tab = Views[UI.tab] ? UI.tab : 'students';
  $('nav').innerHTML = TABS.map(([k, n, i]) => `<button type="button" class="${k === tab ? 'on' : ''}" data-act="go" data-tab="${k}"><span>${i}</span>${n}</button>`).join('');
  $('main').innerHTML = Views[tab]();
  arDigits($('main'));
  window.scrollTo(0, y);
}
// digits in text become Arabic; inputs, links and anything marked .latin keep theirs
function arDigits(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('textarea,script,style,.latin') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = w.nextNode(); n; n = w.nextNode()) if (/\d/.test(n.nodeValue)) n.nodeValue = ar(n.nodeValue);
}
function go(tab) {
  UI.tab = tab;
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  window.scrollTo(0, 0);
  render();
}

// ---- the sheet (a panel that slides up) ----
function openSheet(html) {
  $('sheetBody').innerHTML = html;
  arDigits($('sheetBody'));
  $('sheet').hidden = false;
  document.body.classList.add('locked');
  $('sheetBody').scrollTop = 0;
}
function closeSheet() {
  $('sheet').hidden = true;
  document.body.classList.remove('locked');
  $('sheetBody').innerHTML = '';
}

let toastTimer;
function toast(msg, undo) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(ar(msg))}</span>${undo ? '<button type="button" data-act="undo">تراجع</button>' : ''}`;
  t.hidden = false;
  toast.undo = undo || null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; toast.undo = null; }, undo ? 6000 : 3000);
}

// two presses to delete: the first turns the button into «متأكد؟» for a few seconds
function armed(btn) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1';
  const old = btn.textContent;
  btn.textContent = 'متأكد؟';
  btn.classList.add('danger-on');
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; btn.classList.remove('danger-on'); } }, 4000);
  return false;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('نُسخ'); } catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('نُسخ'); } catch { toast('تعذّر النسخ'); }
    ta.remove();
  }
}

// ---- actions: every button carries data-act; each page adds its own handlers here ----
const Acts = {
  go: (el) => go(el.dataset.tab),
  'pick-cls': (el) => { UI.cls = el.dataset.id; render(); },
  'close-sheet': () => closeSheet(),
  undo: () => { const u = toast.undo; $('toast').hidden = true; toast.undo = null; if (u) u(); },
};
const Changes = {}; // data-change handlers for inputs (fired on change)
const Inputs = {}; // data-input handlers (fired while typing)

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = Acts[el.dataset.act];
  if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && Inputs[el.dataset.input]) Inputs[el.dataset.input](el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-submit]');
  if (!f) return;
  e.preventDefault();
  Acts[f.dataset.submit](f, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
});

function start() {
  load();
  const h = location.hash.slice(1);
  if (Views[h] || h === 'settings') UI.tab = h;
  render();
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
