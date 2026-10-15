'use strict';
// Full-screen notes editor with text formatting (bold, colours, highlight, headings, lists…).
// Notes are stored as cleaned HTML; plain text is derived for search, cards and Excel.

const NOTE_COLORS = [
  ['', 'تلقائي'], ['#c8372d', 'أحمر'], ['#d9480f', 'برتقالي'], ['#a16207', 'ذهبي'], ['#0f8a5f', 'أخضر'],
  ['#0e7490', 'فيروزي'], ['#2f6fdb', 'أزرق'], ['#7c3aed', 'بنفسجي'], ['#6b7280', 'رمادي'],
];
const NOTE_HIGHLIGHTS = [
  ['', 'بلا تظليل'], ['#fff3a3', 'أصفر'], ['#c9f2d4', 'أخضر'], ['#cfe6ff', 'أزرق'], ['#ffd6e7', 'وردي'], ['#ffe0c2', 'برتقالي'],
];

// ---------- HTML cleaning ----------
const NOTE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'FONT', 'BR', 'DIV', 'P', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR', 'MARK']);
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|transparent)$/i;

function cleanNoteHTML(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1 || !NOTE_TAGS.has(child.nodeName)) {
        // drop scripts and unknown elements but keep their text
        if (child.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG', 'SVG', 'VIDEO', 'AUDIO'].includes(child.nodeName)) {
          walk(child);
          child.replaceWith(...child.childNodes);
        } else child.remove();
        continue;
      }
      // keep only colours, highlight and alignment
      const style = [];
      const color = child.style && child.style.color;
      const bg = child.style && (child.style.backgroundColor || '');
      const align = child.style && child.style.textAlign;
      const fontColor = child.nodeName === 'FONT' ? child.getAttribute('color') : '';
      if (color && SAFE_COLOR.test(color.replace(/\s/g, ''))) style.push(`color:${color}`);
      else if (fontColor && SAFE_COLOR.test(fontColor)) style.push(`color:${fontColor}`);
      if (bg && SAFE_COLOR.test(bg.replace(/\s/g, ''))) style.push(`background-color:${bg}`);
      if (align && ['right', 'left', 'center', 'justify'].includes(align)) style.push(`text-align:${align}`);
      const fw = child.style && child.style.fontWeight;
      if (fw === 'bold' || Number(fw) >= 600) style.push('font-weight:bold');
      if (child.style && child.style.fontStyle === 'italic') style.push('font-style:italic');
      const deco = child.style && (child.style.textDecorationLine || child.style.textDecoration || '');
      if (/underline/.test(deco)) style.push(`text-decoration:${/line-through/.test(deco) ? 'underline line-through' : 'underline'}`);
      else if (/line-through/.test(deco)) style.push('text-decoration:line-through');
      for (const a of [...child.attributes]) child.removeAttribute(a.name);
      let el = child;
      if (child.nodeName === 'FONT') {
        el = document.createElement('span');
        el.append(...child.childNodes);
        child.replaceWith(el);
      }
      if (style.length) el.setAttribute('style', style.join(';'));
      walk(el);
    }
  };
  walk(tpl.content);
  return tpl.innerHTML.trim();
}

function noteText(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = (html || '').replace(/<(br|\/p|\/div|\/li|\/h2|\/h3|\/blockquote)\s*\/?>/gi, '$&\n').replace(/<(p|div|li|h2|h3|blockquote|ul|ol)(\s[^>]*)?>/gi, '\n$&');
  return tpl.content.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

const plainToNoteHTML = (s) => esc(s || '').replace(/\n/g, '<br>');

// ---------- editor ----------
const medit = () => $('memoEditor');
let mstate = null; // { id, isNew, dirty, timer }

function openMemo(id) {
  const m = id ? getMemo(id) : null;
  mstate = { id: m ? m.id : uid(), isNew: !m, dirty: false, timer: null };
  $('meTitle').value = m ? m.title : '';
  $('meBody').innerHTML = m ? m.html : '';
  $('mePin').setAttribute('aria-pressed', String(!!(m && m.pinned)));
  $('meDel').hidden = !m;
  $('meDel').classList.remove('armed');
  $('meDel').textContent = 'حذف';
  setMemoStatus(m ? memoStamp(m) : 'ملاحظة جديدة');
  $('meAI').hidden = !AI.on();
  closePalettes();
  $('meRecBar').hidden = true;
  renderMemoAudios();
  const d = medit();
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  try { document.execCommand('styleWithCSS', false, true); } catch {}
  // focus the title (new) or the text (existing), unless the user already tapped into the editor
  setTimeout(() => { const a = document.activeElement; if (mstate && !(a && a.closest && a.closest('#memoEditor .me-head input, #meBody'))) (m ? $('meBody') : $('meTitle')).focus(); }, 60);
}

function memoStamp(m) {
  const d = iso(new Date(m.updated));
  return `آخر تعديل: ${relDate(d)} ${fmtTime(hmOf(new Date(m.updated).getHours() * 60 + new Date(m.updated).getMinutes()))}`;
}
function setMemoStatus(t) { $('meStatus').textContent = t; }

function saveMemoNow() {
  if (!mstate) return;
  clearTimeout(mstate.timer);
  const title = $('meTitle').value.trim();
  const html = cleanNoteHTML($('meBody').innerHTML);
  const text = noteText(html);
  const old = getMemo(mstate.id);
  if (!old && !title && !text) return; // nothing written yet (recordings save the note themselves)
  const m = normalizeMemo({ ...(old || {}), id: mstate.id, title, html, body: text, pinned: $('mePin').getAttribute('aria-pressed') === 'true', updated: Date.now() });
  if (old) Object.assign(old, m); else S.memos.push(m);
  mstate.isNew = false;
  mstate.dirty = false;
  $('meDel').hidden = false;
  save();
  setMemoStatus('حُفظت تلقائياً');
}

function scheduleMemoSave() {
  if (!mstate) return;
  mstate.dirty = true;
  setMemoStatus('جارٍ الحفظ…');
  clearTimeout(mstate.timer);
  mstate.timer = setTimeout(saveMemoNow, 700);
}

function closeMemo() {
  if (!mstate) return;
  if (recState) stopRecording(); // keep what was recorded
  saveMemoNow();
  mstate = null;
  const d = medit();
  if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
  render();
}

function closePalettes() { for (const id of ['mePalColor', 'mePalHi', 'mePalAI']) $(id).hidden = true; }

function exec(cmd, val) {
  $('meBody').focus();
  try { document.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor'); } catch {}
  document.execCommand(cmd, false, val);
  scheduleMemoSave();
  updateToolbarState();
}

function updateToolbarState() {
  for (const b of document.querySelectorAll('#meTools [data-cmd]')) {
    const c = b.dataset.cmd;
    if (['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyRight', 'justifyCenter', 'justifyLeft', 'justifyFull'].includes(c)) {
      let on = false;
      try { on = document.queryCommandState(c); } catch {}
      b.setAttribute('aria-pressed', String(on));
    }
  }
}

function buildPalettes() {
  $('mePalColor').innerHTML = NOTE_COLORS.map(([c, n]) => `<button type="button" class="pal" data-mcolor="${c}" title="${n}" aria-label="لون ${n}" style="${c ? `background:${c}` : ''}">${c ? '' : 'أ'}</button>`).join('');
  $('mePalHi').innerHTML = NOTE_HIGHLIGHTS.map(([c, n]) => `<button type="button" class="pal" data-mhi="${c}" title="${n}" aria-label="تظليل ${n}" style="${c ? `background:${c}` : ''}">${c ? '' : '✕'}</button>`).join('');
}

// keep the selection inside the editor when tapping the toolbar
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#meTools button, .me-pal button')) e.preventDefault();
});

document.addEventListener('click', (e) => {
  if (!medit() || !medit().open) return;
  const t = e.target.closest('[data-cmd], [data-mcolor], [data-mhi], [data-maction]');
  if (!t) return;
  if (t.dataset.cmd) {
    const { cmd, val } = t.dataset;
    if (cmd === 'palColor' || cmd === 'palHi' || cmd === 'palAI') {
      const id = { palColor: 'mePalColor', palHi: 'mePalHi', palAI: 'mePalAI' }[cmd];
      const show = $(id).hidden;
      closePalettes();
      $(id).hidden = !show;
      return;
    }
    closePalettes();
    exec(cmd, val ? (cmd === 'formatBlock' ? `<${val}>` : val) : undefined);
    return;
  }
  if (t.dataset.mcolor !== undefined) {
    exec('foreColor', t.dataset.mcolor || getComputedStyle($('meBody')).color);
    closePalettes();
    return;
  }
  if (t.dataset.mhi !== undefined) {
    exec('hiliteColor', t.dataset.mhi || 'transparent');
    closePalettes();
    return;
  }
  const a = t.dataset.maction;
  if (a === 'close') closeMemo();
  if (a === 'pin') {
    const on = $('mePin').getAttribute('aria-pressed') !== 'true';
    $('mePin').setAttribute('aria-pressed', String(on));
    scheduleMemoSave();
    toast(on ? 'ثُبّتت في الأعلى' : 'أُلغي التثبيت');
  }
  if (a === 'delete') {
    const b = $('meDel');
    if (!b.classList.contains('armed')) {
      b.classList.add('armed'); b.textContent = 'تأكيد الحذف';
      setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.textContent = 'حذف'; } }, 3000);
      return;
    }
    const id = mstate.id;
    if (recState) stopRecording(true);
    for (const clip of (getMemo(id) || {}).audios || []) Media.del(clip.mediaId).catch(() => {});
    S.memos = S.memos.filter((m) => m.id !== id);
    save();
    mstate = null;
    const d = medit();
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
    render();
    toast('حُذفت الملاحظة');
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'meBody' || e.target.id === 'meTitle') scheduleMemoSave();
});
document.addEventListener('selectionchange', () => {
  if (mstate && document.activeElement && document.activeElement.id === 'meBody') updateToolbarState();
});
document.addEventListener('keydown', (e) => {
  if (!mstate) return;
  if (e.target.id === 'meTitle' && e.key === 'Enter') { e.preventDefault(); $('meBody').focus(); }
  if (e.key === 'Escape') { e.preventDefault(); closeMemo(); }
});
// pasted text keeps only the formatting the editor supports
document.addEventListener('paste', (e) => {
  if (e.target.closest && e.target.closest('#meBody')) {
    const html = e.clipboardData && e.clipboardData.getData('text/html');
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!html && !text) return;
    e.preventDefault();
    document.execCommand('insertHTML', false, html ? cleanNoteHTML(html) : plainToNoteHTML(text));
    scheduleMemoSave();
  }
});
window.addEventListener('pagehide', () => { if (mstate && mstate.dirty) saveMemoNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && mstate && mstate.dirty) saveMemoNow(); });
document.addEventListener('DOMContentLoaded', buildPalettes);
if (document.readyState !== 'loading') setTimeout(buildPalettes, 0);

// ---------- voice notes: record your voice and keep it with the note ----------
// Audio is stored on this device (IndexedDB, same store as photos); notes list its clips.
let recState = null; // { rec, chunks, started, timer, stream, cancelled }

function pickAudioType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// a note that only has recordings still needs to exist
function ensureMemoSaved() {
  if (getMemo(mstate.id)) return getMemo(mstate.id);
  const title = $('meTitle').value.trim() || `ملاحظة صوتية | ${fmtDate(today(), { day: 'numeric', month: 'long' })}`;
  $('meTitle').value = title;
  const html = cleanNoteHTML($('meBody').innerHTML);
  const m = normalizeMemo({ id: mstate.id, title, html, body: noteText(html) });
  S.memos.push(m);
  mstate.isNew = false;
  $('meDel').hidden = false;
  save();
  return m;
}

async function startRecording() {
  if (recState) return;
  const type = pickAudioType();
  if (type === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('جهازك لا يدعم التسجيل الصوتي من المتصفح.'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { toast(e && e.name === 'NotAllowedError' ? 'اسمح للتطبيق باستخدام الميكروفون من إعدادات الجوال.' : 'تعذّر الوصول إلى الميكروفون.'); return; }
  const rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
  recState = { rec, chunks: [], started: Date.now(), stream, cancelled: false, type: rec.mimeType || type || 'audio/webm' };
  rec.ondataavailable = (e) => { if (e.data && e.data.size) recState.chunks.push(e.data); };
  rec.onstop = finishRecording;
  rec.start(1000);
  $('meRecBar').hidden = false;
  $('meRec').classList.add('rec');
  const tick = () => {
    const s = (Date.now() - recState.started) / 1000;
    $('meRecTime').textContent = fmtClock(s);
    if (s >= 30 * 60) stopRecording(); // 30-minute cap per clip
  };
  tick();
  recState.timer = setInterval(tick, 500);
  try { if (navigator.vibrate) navigator.vibrate(30); } catch {}
}

function stopRecording(cancel) {
  if (!recState) return;
  recState.cancelled = !!cancel;
  clearInterval(recState.timer);
  try { recState.rec.stop(); } catch { finishRecording(); }
}

async function finishRecording() {
  const st = recState;
  recState = null;
  if (!st) return;
  st.stream.getTracks().forEach((t) => t.stop());
  $('meRecBar').hidden = true;
  $('meRec').classList.remove('rec');
  const dur = Math.round((Date.now() - st.started) / 1000);
  if (st.cancelled || !st.chunks.length || dur < 1) { if (!st.cancelled) toast('التسجيل قصير جداً.'); return; }
  const blob = new Blob(st.chunks, { type: st.type });
  const mediaId = 'aud-' + uid();
  try { await Media.put(mediaId, blob); } catch { toast('تعذّر حفظ التسجيل على الجهاز.'); return; }
  if (!mstate) return;
  const m = ensureMemoSaved();
  m.audios = [...(m.audios || []), { id: uid(), mediaId, dur, created: Date.now() }];
  m.updated = Date.now();
  save();
  renderMemoAudios();
  toast(`حُفظ تسجيل مدته ${fmtClock(dur)}`);
}

async function renderMemoAudios() {
  const box = $('meAudios');
  const m = mstate && getMemo(mstate.id);
  const list = m ? m.audios || [] : [];
  box.hidden = !list.length;
  box.innerHTML = list.map((a) => `<div class="me-audio" data-aid="${a.id}">
      <span class="me-audio-meta">${icon('micro')}<b>${fmtClock(a.dur)}</b><small>${esc(relDate(iso(new Date(a.created))))} ${esc(fmtTime(hmOf(new Date(a.created).getHours() * 60 + new Date(a.created).getMinutes())))}</small></span>
      <audio controls preload="metadata" data-media="${a.mediaId}"></audio>
      <button type="button" class="danger" data-maction="del-audio" data-v="${a.id}">حذف</button>
    </div>`).join('');
  for (const el of box.querySelectorAll('audio[data-media]')) {
    try {
      const u = await Media.url(el.dataset.media);
      if (u) el.src = u;
      else el.replaceWith(Object.assign(document.createElement('small'), { className: 'hint', textContent: 'هذا التسجيل محفوظ على جهاز آخر.' }));
    } catch {}
  }
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-maction="rec"], [data-maction="rec-stop"], [data-maction="rec-cancel"], [data-maction="del-audio"]');
  if (!t || !mstate) return;
  const a = t.dataset.maction;
  if (a === 'rec') { if (recState) stopRecording(); else startRecording(); }
  if (a === 'rec-stop') stopRecording();
  if (a === 'rec-cancel') { stopRecording(true); toast('أُلغي التسجيل'); }
  if (a === 'del-audio') {
    if (t.dataset.armed !== '1') {
      t.dataset.armed = '1'; t.textContent = 'تأكيد'; t.classList.add('armed');
      setTimeout(() => { if (t.isConnected) { t.dataset.armed = ''; t.textContent = 'حذف'; t.classList.remove('armed'); } }, 3000);
      return;
    }
    const m = getMemo(mstate.id);
    const clip = m && (m.audios || []).find((x) => x.id === t.dataset.v);
    if (clip) {
      Media.del(clip.mediaId).catch(() => {});
      m.audios = m.audios.filter((x) => x !== clip);
      save();
      renderMemoAudios();
    }
  }
});
