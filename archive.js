'use strict';
// «الأرشيف»: things found elsewhere (links, videos, messages, ideas) kept to come back to.
// Items arrive by sharing from any app to «الوعي الشخصي» (Web Share Target) or are added by hand.

const archUi = { q: '', filter: 'open', tag: '' };

function normalizeArchive(a) {
  return {
    id: a.id || uid(), title: String(a.title || ''), url: String(a.url || ''), text: String(a.text || ''),
    tag: String(a.tag || ''), note: String(a.note || ''), created: a.created || Date.now(),
    revisitedAt: a.revisitedAt || null, convertedTo: a.convertedTo || '',
  };
}
const getArch = (id) => S.archive.find((a) => a.id === id);
const URL_RE = /https?:\/\/[^\s<>"«»]+/i;

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function youtubeId(u) {
  try {
    const x = new URL(u);
    if (/youtu\.be$/.test(x.hostname)) return x.pathname.slice(1).split('/')[0];
    if (/youtube\.com$/.test(x.hostname.replace(/^www\.|^m\./, ''))) return x.searchParams.get('v') || (x.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/) || [])[2] || '';
  } catch {}
  return '';
}
const archTags = () => [...new Set(S.archive.map((a) => a.tag).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));

// shared title/text/url → a tidy item (WhatsApp and others often put the link inside the text)
function fromShare({ title = '', text = '', url = '' }) {
  if (!url) { const m = text.match(URL_RE); if (m) { url = m[0]; text = text.replace(m[0], '').trim(); } }
  const first = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
  const t = title || (first.length <= 90 ? first : '') || hostOf(url) || 'عنصر محفوظ';
  // don't repeat the first line when it became the title
  const rest = t === first ? text.split('\n').map((l) => l.trim()).filter(Boolean).slice(1).join('\n') : text;
  return normalizeArchive({ title: t, text: rest, url });
}

function archCard(a) {
  const yt = a.url && youtubeId(a.url);
  const host = a.url ? hostOf(a.url) : '';
  return `<article class="arch-card${a.revisitedAt ? ' revisited' : ''}">
    ${yt ? `<a class="arch-thumb" href="${esc(a.url)}" target="_blank" rel="noopener" aria-label="فتح الفيديو"><img src="https://i.ytimg.com/vi/${esc(yt)}/mqdefault.jpg" alt="" loading="lazy"></a>` : ''}
    <button type="button" class="arch-main" data-action="arch-open" data-v="${a.id}">
      <strong>${esc(a.title)}</strong>
      ${a.text ? `<p>${esc(excerpt(a.text, 200))}</p>` : ''}
      <span class="book-line">${host ? `${icon('link')}<span dir="ltr">${esc(host)}</span> · ` : ''}${esc(relDate(iso(new Date(a.created))))}${a.tag ? ` · <span class="cat">${esc(a.tag)}</span>` : ''}${a.convertedTo ? ` · ${icon('check')}${esc(a.convertedTo)}` : ''}</span>
    </button>
    <div class="arch-actions">
      ${a.url ? `<a class="ghost" href="${esc(a.url)}" target="_blank" rel="noopener" data-action="arch-visit" data-v="${a.id}">فتح</a>` : ''}
      <button type="button" class="${a.revisitedAt ? 'ghost' : 'primary'}" data-action="arch-revisit" data-v="${a.id}">${a.revisitedAt ? 'أعده للمتابعة' : 'رجعت إليه'}</button>
    </div>
  </article>`;
}

function viewArchive() {
  const q = archUi.q.trim().toLowerCase();
  const list = S.archive.filter((a) =>
    (archUi.filter === 'all' || (archUi.filter === 'open') === !a.revisitedAt) &&
    (!archUi.tag || a.tag === archUi.tag) &&
    (!q || [a.title, a.text, a.url, a.tag, a.note].some((x) => x.toLowerCase().includes(q))))
    .sort((a, b) => b.created - a.created);
  const open = S.archive.filter((a) => !a.revisitedAt).length;
  const tags = archTags();
  const seg = [['open', `لم أرجع إليه ${open}`], ['done', 'رجعت إليه'], ['all', 'الكل']]
    .map(([v, l]) => `<button type="button" data-action="arch-filter" data-v="${v}" aria-pressed="${archUi.filter === v}">${l}</button>`).join('');
  return `${moreCrumb()}
  <section class="section">
    <div class="section-head"><h2>الأرشيف</h2><div class="btn-row">${S.archive.length ? xlsBtn('archive') : ''}${addBtn('arch-new', 'عنصر')}</div></div>
    <form class="idea-quick" id="archQuick" autocomplete="off">
      <textarea id="archQuickText" rows="2" placeholder="معلومة سريعة أو رابط… (‎#وسم للتصنيف)" aria-label="معلومة سريعة"></textarea>
      <button type="submit" class="primary">${icon('plus')}احفظ</button>
    </form>
    <p class="note-text explain">اكتب معلومة أو الصق رابطاً هنا، أو من أي تطبيق اضغط «مشاركة» ثم اختر «الوعي الشخصي».</p>
    ${S.archive.length ? `<input type="search" id="archSearch" placeholder="ابحث في الأرشيف" aria-label="بحث" value="${esc(archUi.q)}">
      <div class="seg" role="group" aria-label="عرض">${seg}</div>
      ${tags.length ? `<div class="chips" role="group" aria-label="التصنيف"><button type="button" class="chip" data-action="arch-tag" data-v="" aria-pressed="${!archUi.tag}">الكل</button>${tags.map((t) => `<button type="button" class="chip" data-action="arch-tag" data-v="${esc(t)}" aria-pressed="${archUi.tag === t}">${esc(t)}</button>`).join('')}</div>` : ''}` : ''}
    ${list.length ? `<div class="book-list">${list.map(archCard).join('')}</div>`
      : S.archive.length ? emptyHTML(archUi.filter === 'open' && !q ? 'رجعت إلى كل شيء' : 'لا نتائج', archUi.filter === 'open' && !q ? 'لا شيء ينتظرك في الأرشيف.' : 'جرّب كلمة أخرى.')
        : emptyHTML('الأرشيف فارغ', 'رأيت مقالاً أو مقطعاً أو رسالة تريد الرجوع إليها؟ اضغط «مشاركة» في ذلك التطبيق واختر «الوعي الشخصي»، أو أضفه هنا بنفسك.', addBtn('arch-new', 'أضف أول عنصر'))}
    <details class="howto"><summary>«الوعي الشخصي» لا يظهر في قائمة المشاركة؟</summary>
      <ol>
        <li>يظهر فقط بعد تثبيت التطبيق على الشاشة الرئيسية من Chrome على أندرويد.</li>
        <li>إذا كان مثبتاً من قبل: احذف أيقونته من الشاشة الرئيسية، ثم افتح الرابط في Chrome وثبّته من جديد. بياناتك لا تُحذف.</li>
        <li>في قائمة المشاركة قد تجده تحت «المزيد» أو بالتمرير جانباً.</li>
      </ol>
    </details>
  </section>`;
}

// ---------- editor ----------
function openArch(id, preset) {
  const a = id ? getArch(id) : preset || normalizeArchive({ tag: archUi.tag });
  ldraft = { kind: 'arch', id: a.id, isNew: !getArch(a.id) };
  const f = $('libForm');
  f.innerHTML = `
    <div class="sheet-head"><h2>${ldraft.isNew ? (preset ? 'حفظ ما شاركته' : 'عنصر جديد') : 'عنصر في الأرشيف'}</h2>
      <button type="button" class="icon-btn" data-action="lib-close" aria-label="إغلاق"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <label class="field"><span>العنوان</span><input type="text" id="aTitle" value="${esc(a.title)}" autocomplete="off" placeholder="عمّ يتحدث؟"></label>
    <label class="field"><span>الرابط (اختياري)</span><input type="url" id="aUrl" value="${esc(a.url)}" autocomplete="off" dir="ltr" placeholder="https://"></label>
    <label class="field"><span>النص</span><textarea id="aText" rows="4" placeholder="الرسالة أو المقتطف">${esc(a.text)}</textarea></label>
    <div class="grid2">
      <label class="field"><span>التصنيف</span><input type="text" id="aTag" value="${esc(a.tag)}" list="archTags" autocomplete="off" placeholder="مقال، فيديو، دورة…"></label>
      <label class="field"><span>لماذا أحتفظ به؟</span><input type="text" id="aNote" value="${esc(a.note)}" autocomplete="off" placeholder="ملاحظة قصيرة"></label>
    </div>
    <datalist id="archTags">${archTags().map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="field"><span>أو حوّله إلى</span>
      <div class="btn-row">
        <button type="button" class="ghost" data-action="arch-to" data-v="task">مهمة</button>
        <button type="button" class="ghost" data-action="arch-to" data-v="memo">ملاحظة</button>
        <button type="button" class="ghost" data-action="arch-to" data-v="benefit">فائدة</button>
      </div>
    </div>
    <div class="sheet-actions">
      <button type="submit" class="primary">${ldraft.isNew ? 'احفظ في الأرشيف' : 'حفظ'}</button>
      ${ldraft.isNew ? '' : '<button type="button" class="danger" data-action="lib-delete">حذف</button>'}
    </div>`;
  libArmed = false;
  const d = lsheet();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
}

function readArch() {
  const old = getArch(ldraft.id);
  return normalizeArchive({
    ...(old || {}), id: ldraft.id, title: $('aTitle').value.trim() || hostOf($('aUrl').value) || 'عنصر محفوظ',
    url: $('aUrl').value.trim(), text: $('aText').value.trim(), tag: $('aTag').value.trim(), note: $('aNote').value.trim(),
  });
}
function saveArch() {
  const a = readArch();
  if (!a.url && !a.text && a.title === 'عنصر محفوظ') { toast('اكتب عنواناً أو الصق رابطاً.'); return false; }
  const old = getArch(a.id);
  if (old) Object.assign(old, a); else S.archive.push(a);
  save();
  return true;
}

// turn an archived item into a task, a note or a benefit (the item stays, marked)
function archConvert(kind) {
  const a = readArch();
  const body = [a.url, a.text, a.note].filter(Boolean).join('\n');
  const label = { task: 'مهمة', memo: 'ملاحظة', benefit: 'فائدة' }[kind];
  a.convertedTo = label;
  const old = getArch(a.id);
  if (old) Object.assign(old, a); else S.archive.push(a);
  save();
  closeLib();
  if (kind === 'task') {
    openSheet(null, { prefill: normalize({ id: uid(), kind: 'task', title: a.title, notes: body ? [{ id: uid(), text: body, at: Date.now() }] : [], created: Date.now() }) });
  } else if (kind === 'memo') {
    const m = normalizeMemo({ title: a.title, html: plainToNoteHTML(body), body });
    S.memos.push(m);
    save();
    openMemo(m.id);
  } else {
    const f = normalizeBenefit({ title: a.title, lesson: [a.text, a.note, a.url].filter(Boolean).join('\n'), book: a.tag || hostOf(a.url) });
    S.benefits.push(f);
    save();
    openLib('benefit', f.id);
  }
  render();
}

// ---------- incoming shares (manifest share_target → ./?title=…&text=…&url=…) ----------
function handleShareLaunch(params) {
  // Android replaces the action's query with the shared fields, so detect a share by them
  if (!['title', 'text', 'url'].some((k) => params.get(k))) return false;
  const item = fromShare({ title: params.get('title') || '', text: params.get('text') || '', url: params.get('url') || '' });
  ui.tab = 'archive';
  render();
  openArch(null, item);
  return true;
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="arch-"]');
  if (!el) return;
  const { action, v } = el.dataset;
  switch (action) {
    case 'arch-new': openArch(null); break;
    case 'arch-open': openArch(v); break;
    case 'arch-filter': archUi.filter = v; render(); break;
    case 'arch-tag': archUi.tag = v; render(); break;
    case 'arch-visit': break; // the link opens normally
    case 'arch-revisit': {
      const a = getArch(v);
      if (!a) break;
      a.revisitedAt = a.revisitedAt ? null : Date.now();
      save(); render();
      toast(a.revisitedAt ? 'نُقل إلى «رجعت إليه»' : 'أُعيد إلى قائمة المتابعة');
      break;
    }
    case 'arch-to': archConvert(v); break;
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'archSearch') { archUi.q = e.target.value; render(); }
});
// quick capture: a fact or a link in one line; the first line becomes the title
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'archQuick') return;
  e.preventDefault();
  const ta = $('archQuickText');
  const { text, tag } = splitTag(ta.value.trim());
  if (!text) { ta.focus(); return; }
  const item = fromShare({ text });
  item.tag = tag || archUi.tag || (item.url ? '' : 'معلومة');
  S.archive.push(item);
  save();
  if (archUi.filter === 'done') archUi.filter = 'open';
  render();
  $('archQuickText').focus();
  toast(item.tag ? `حُفظت في الأرشيف · ${item.tag}` : 'حُفظت في الأرشيف');
});
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'archQuickText' || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  $('archQuick').requestSubmit();
});
// pasting a link into the URL field fills an empty title with the site name
document.addEventListener('change', (e) => {
  if (e.target.id === 'aUrl' && !$('aTitle').value.trim()) $('aTitle').value = hostOf(e.target.value);
});

Object.assign(LibraryViews, { archive: viewArchive });
