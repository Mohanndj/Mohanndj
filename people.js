'use strict';
// «الأحبّة»: family and friends — when you last reached them, how often you want to, their occasions,
// what they like and gift ideas. The app reminds you when it has been too long.

const REL = { parents: 'الوالدان', siblings: 'الإخوة والأخوات', family: 'الأقارب', friends: 'الأصدقاء', work: 'الزملاء', neighbors: 'الجيران', other: 'آخرون' };
const EVERY = [[7, 'كل أسبوع'], [14, 'كل أسبوعين'], [30, 'كل شهر'], [60, 'كل شهرين'], [90, 'كل ٣ أشهر'], [180, 'كل ٦ أشهر'], [0, 'بلا تذكير']];
const HOW = { call: ['اتصال', '📞'], visit: ['زيارة', '🏠'], msg: ['رسالة', '💬'], meet: ['لقاء', '🤝'] };
const pplUi = { q: '', rel: '' };

function normalizePerson(p) {
  return {
    id: p.id || uid(), name: String(p.name || ''), rel: REL[p.rel] ? p.rel : 'friends',
    every: EVERY.some(([d]) => d === Number(p.every)) ? Number(p.every) : 30,
    phone: String(p.phone || ''), birthday: p.birthday || '', likes: String(p.likes || ''), gifts: String(p.gifts || ''), notes: String(p.notes || ''),
    contacts: (Array.isArray(p.contacts) ? p.contacts : []).filter((c) => c && c.d).map((c) => ({ id: c.id || uid(), d: c.d, how: HOW[c.how] ? c.how : 'call', note: String(c.note || '') })),
    created: p.created || Date.now(),
  };
}
const getPerson = (id) => S.people.find((p) => p.id === id);
const lastContact = (p) => p.contacts.reduce((m, c) => (c.d > m ? c.d : m), '');
// days overdue (>0), due today (0) or not yet (<0); null when no reminder
function contactDue(p) {
  if (!p.every) return null;
  const last = lastContact(p) || iso(new Date(p.created));
  return daysBetween(addDays(last, p.every), today());
}
// next birthday from today, as { d, days, age }
function nextBirthday(p) {
  if (!p.birthday) return null;
  const t0 = today();
  const [y, m, d] = p.birthday.split('-').map(Number);
  let ny = Number(t0.slice(0, 4));
  let next = `${ny}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (next < t0) { ny++; next = `${ny}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  return { d: next, days: daysBetween(t0, next), age: y > 1900 ? ny - y : 0 };
}
const telHref = (s) => s.replace(/[^\d+]/g, '');
const waHref = (s) => { let n = s.replace(/\D/g, ''); if (n.startsWith('00')) n = n.slice(2); else if (n.startsWith('05') && n.length === 10) n = '966' + n.slice(1); return `https://wa.me/${n}`; };

function personCard(p) {
  const due = contactDue(p);
  const last = lastContact(p);
  const bd = nextBirthday(p);
  const lastTxt = last ? `آخر تواصل ${relDate(last)}${p.contacts.length ? ` (${HOW[p.contacts.find((c) => c.d === last).how][0]})` : ''}` : 'لم تسجّل تواصلاً بعد';
  const dueTxt = due == null ? '' : due > 0 ? `<span class="late">${lateDays(due)}</span>` : due === 0 ? '<span class="late">اليوم موعد التواصل</span>' : `التواصل القادم ${afterDays(-due)}`;
  return `<article class="ppl-card${due != null && due >= 0 ? ' due' : ''}">
    <button type="button" class="ppl-main" data-action="ppl-open" data-v="${p.id}">
      <span class="ppl-av">${esc(p.name.trim().slice(0, 1) || '؟')}</span>
      <span><b>${esc(p.name)}</b><small>${REL[p.rel]} | ${esc(lastTxt)}</small>
        <small>${dueTxt}${bd && bd.days <= 30 ? `${dueTxt ? ' | ' : ''}🎂 ${bd.days === 0 ? 'اليوم مناسبته!' : `مناسبته ${afterDays(bd.days)}`}` : ''}</small></span>
    </button>
    <div class="ppl-actions">
      ${p.phone ? `<a class="ghost" href="tel:${esc(telHref(p.phone))}">📞</a><a class="ghost" href="${esc(waHref(p.phone))}" target="_blank" rel="noopener">واتساب</a>` : ''}
      <button type="button" class="primary" data-action="ppl-log" data-v="${p.id}">تواصلت</button>
    </div>
  </article>`;
}

function viewPeople() {
  const q = pplUi.q.trim().toLowerCase();
  const list = S.people.filter((p) => (!pplUi.rel || p.rel === pplUi.rel) && (!q || [p.name, p.likes, p.gifts, p.notes].some((s) => s.toLowerCase().includes(q))));
  const due = list.filter((p) => (contactDue(p) ?? -1) >= 0).sort((a, b) => contactDue(b) - contactDue(a));
  const soon = S.people.map((p) => ({ p, b: nextBirthday(p) })).filter((x) => x.b && x.b.days <= 30).sort((a, b) => a.b.days - b.b.days);
  const rest = list.filter((p) => !due.includes(p)).sort((a, b) => Object.keys(REL).indexOf(a.rel) - Object.keys(REL).indexOf(b.rel) || a.name.localeCompare(b.name, 'ar'));
  const rels = Object.keys(REL).filter((r) => S.people.some((p) => p.rel === r));
  const month = S.people.reduce((n, p) => n + p.contacts.filter((c) => c.d.slice(0, 7) === today().slice(0, 7)).length, 0);
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الأحبّة</h2><div class="btn-row">${S.people.length ? xlsBtn('people') : ''}${addBtn('ppl-new', 'شخص')}</div></div>
    ${S.people.length ? `<div class="j-stats"><span><b>${S.people.length}</b> شخص</span><span><b>${S.people.filter((p) => (contactDue(p) ?? -1) >= 0).length}</b> حان التواصل</span><span><b>${month}</b> تواصل هذا الشهر</span></div>` : ''}
    ${soon.length ? `<div class="ppl-soon">${soon.map(({ p, b }) => `<button type="button" data-action="ppl-open" data-v="${p.id}">🎂 <b>${esc(p.name)}</b> ${b.days === 0 ? 'اليوم' : `${afterDays(b.days)}`}${b.age ? ` | يكمل ${b.age} سنة` : ''}${p.gifts ? ' | 🎁 عندك أفكار هدايا' : ''}</button>`).join('')}</div>` : ''}
    ${S.people.length > 5 ? `<input type="search" id="pplSearch" placeholder="ابحث بالاسم أو الاهتمامات" aria-label="بحث" value="${esc(pplUi.q)}">` : ''}
    ${rels.length > 1 ? `<div class="chips" role="group" aria-label="الصلة"><button type="button" class="chip" data-action="ppl-rel" data-v="" aria-pressed="${!pplUi.rel}">الكل</button>${rels.map((r) => `<button type="button" class="chip" data-action="ppl-rel" data-v="${r}" aria-pressed="${pplUi.rel === r}">${REL[r]}</button>`).join('')}</div>` : ''}
    ${due.length ? `<h3 class="j-month">حان التواصل معهم</h3><div class="book-list">${due.map(personCard).join('')}</div>` : ''}
    ${rest.length ? `${due.length ? '<h3 class="j-month">الباقون</h3>' : ''}<div class="book-list">${rest.map(personCard).join('')}</div>` : ''}
    ${!S.people.length ? emptyHTML('صِل من تحب', 'أضف والديك وإخوتك وأقاربك وأصدقاءك، واختر كم مرة تريد التواصل مع كل منهم. يذكّرك التطبيق إذا طال الانقطاع، ويحفظ مناسباتهم وما يحبون وأفكار الهدايا لهم.', addBtn('ppl-new', 'أضف أول شخص'))
      : !list.length ? emptyHTML('لا نتائج', 'جرّب كلمة أخرى.') : ''}
  </section>`;
}

// ---------- editor ----------
function openPerson(id) {
  const p = id ? getPerson(id) : normalizePerson({ rel: pplUi.rel || 'family' });
  ldraft = { kind: 'person', id: p.id, isNew: !id };
  const hist = p.contacts.slice().sort((a, b) => b.d.localeCompare(a.d));
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>${id ? esc(p.name) : 'شخص جديد'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>الاسم</span><input type="text" id="pnName" value="${esc(p.name)}" autocomplete="off" placeholder="مثال: أمي، خالي سعد"></label>
    <div class="grid2">
      <label class="field"><span>الصلة</span><select id="pnRel">${Object.entries(REL).map(([k, v]) => `<option value="${k}"${p.rel === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>أتواصل معه</span><select id="pnEvery">${EVERY.map(([d, l]) => `<option value="${d}"${p.every === d ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="grid2">
      <label class="field"><span>الجوال (اختياري)</span><input type="tel" id="pnPhone" value="${esc(p.phone)}" autocomplete="off" dir="ltr" placeholder="05xxxxxxxx"></label>
      <label class="field"><span>تاريخ الميلاد أو مناسبة</span><input type="date" id="pnBirth" value="${p.birthday}"><small class="hint" id="pnBirthH">${p.birthday ? esc(fmtHijri(p.birthday)) : ''}</small></label>
    </div>
    <label class="field"><span>ما يحبه واهتماماته</span><textarea id="pnLikes" rows="2" placeholder="القهوة العربية، كتب التاريخ، الرحلات…">${esc(p.likes)}</textarea></label>
    <label class="field"><span>أفكار هدايا 🎁</span><textarea id="pnGifts" rows="2" placeholder="سجّلها حين تخطر لك">${esc(p.gifts)}</textarea></label>
    <label class="field"><span>ملاحظات</span><textarea id="pnNotes" rows="2" placeholder="أسماء أبنائه، ما يمر به، ما وعدته به…">${esc(p.notes)}</textarea></label>
    ${id ? `<div class="field"><span>سجل التواصل</span>
      <div class="ppl-log-row">${Object.entries(HOW).map(([k, v]) => `<button type="button" class="chip" data-action="ppl-add-contact" data-v="${k}">${v[1]} ${v[0]} اليوم</button>`).join('')}</div>
      ${hist.length ? `<ul class="ppl-hist">${hist.slice(0, 12).map((c) => `<li><span>${HOW[c.how][1]} ${HOW[c.how][0]} | ${esc(dateBoth(c.d, true))}${c.note ? ` | ${esc(c.note)}` : ''}</span><button type="button" class="j-m-del" data-action="ppl-del-contact" data-v="${c.id}" aria-label="حذف">✕</button></li>`).join('')}</ul>` : '<p class="note-text">لم تسجّل تواصلاً بعد.</p>'}
    </div>` : ''}
    <div class="sheet-actions">
      <button type="submit" class="primary">حفظ</button>
      ${id ? '<button type="button" class="danger" data-action="lib-delete">حذف</button>' : ''}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function readPerson() {
  const old = getPerson(ldraft.id);
  return normalizePerson({
    ...(old || {}), id: ldraft.id, name: $('pnName').value.trim(), rel: $('pnRel').value, every: +$('pnEvery').value,
    phone: $('pnPhone').value.trim(), birthday: $('pnBirth').value, likes: $('pnLikes').value.trim(), gifts: $('pnGifts').value.trim(), notes: $('pnNotes').value.trim(),
  });
}
function savePerson() {
  const p = readPerson();
  if (!p.name) { toast('اكتب الاسم.'); return false; }
  const old = getPerson(p.id);
  if (old) Object.assign(old, p); else S.people.push(p);
  save();
  return true;
}

// quick log from the card: how did you reach them?
function openContactLog(id) {
  const p = getPerson(id);
  ldraft = { kind: 'contact', id, isNew: false, how: 'call' };
  $('libForm').innerHTML = `
    <div class="sheet-head"><h2>تواصلت مع ${esc(p.name)}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="seg seg-wrap" id="pcHow" role="group" aria-label="كيف">${Object.entries(HOW).map(([k, v]) => `<button type="button" data-action="ppl-how" data-v="${k}" aria-pressed="${k === 'call'}">${v[1]} ${v[0]}</button>`).join('')}</div>
    <label class="field"><span>متى؟</span><input type="date" id="pcDate" value="${today()}" max="${today()}"></label>
    <label class="field"><span>ملاحظة (اختياري)</span><input type="text" id="pcNote" autocomplete="off" placeholder="عمّ تحدثتما؟ هل وعدته بشيء؟"></label>
    <div class="sheet-actions"><button type="submit" class="primary">سجّل</button></div>`;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}
function saveContact() {
  const p = getPerson(ldraft.id);
  if (!p) return false;
  p.contacts.push({ id: uid(), d: $('pcDate').value || today(), how: ldraft.how, note: $('pcNote').value.trim() });
  save();
  toast(`بارك الله فيك. التواصل القادم مع ${p.name} ${p.every ? `${afterDays(p.every)}` : ''}`);
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="ppl-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'ppl-new': openPerson(null); break;
    case 'ppl-open': openPerson(v); break;
    case 'ppl-log': openContactLog(v); break;
    case 'ppl-rel': pplUi.rel = v; render(); break;
    case 'ppl-how':
      ldraft.how = v;
      for (const b of $('pcHow').children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      break;
    case 'ppl-add-contact': {
      const p = readPerson();
      if (!p.name) { toast('اكتب الاسم.'); break; }
      p.contacts.push({ id: uid(), d: today(), how: v, note: '' });
      const old = getPerson(p.id);
      if (old) Object.assign(old, p); else S.people.push(p);
      save(); openPerson(p.id); render();
      toast(`سُجّل: ${HOW[v][0]}`);
      break;
    }
    case 'ppl-del-contact': {
      const p = readPerson();
      p.contacts = p.contacts.filter((c) => c.id !== v);
      Object.assign(getPerson(p.id), p);
      save(); openPerson(p.id); render();
      break;
    }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'pplSearch') { pplUi.q = e.target.value; render(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'pnBirth' && $('pnBirthH')) $('pnBirthH').textContent = e.target.value ? fmtHijri(e.target.value) : '';
});

Object.assign(LibraryViews, { people: viewPeople });
