'use strict';
// Voice notes on a benefit («الفوائد»): record what you want to say about it, send the recording to an
// app that writes speech out (Gemini, the phone's recorder…), then paste the text back under it.
// Every written-out note stays under its benefit's title, and they all gather on the book's page and in
// its recall. The recordings stay on this phone; their text goes with backups and sync.

const bvRec = { st: null };
// recordings added to an open benefit and not saved yet (its recording → the benefit's id)
const bvUnsaved = new Map();

const bvTexts = (f) => (f.voices || []).map((v) => v.text.trim()).filter(Boolean);

function bvRender() {
  const box = $('bvBox');
  if (!box || !ldraft || !['benefit', 'benimp'].includes(ldraft.kind)) return;
  const vs = ldraft.voices || [];
  box.innerHTML = `<div class="field bv"><span>تسجيلات صوتية</span>
    ${vs.map((v, i) => `<div class="bv-item">
      <div class="row-between"><small>التسجيل ${i + 1} | ${fmtClock(v.dur)}</small><button type="button" class="ghost sm" data-action="bv-del" data-v="${v.id}">حذف</button></div>
      <audio controls preload="metadata" data-media="${esc(v.mediaId)}"></audio>
      <button type="button" class="ghost sm" data-action="bv-share" data-v="${v.id}">أرسله إلى تطبيق للتفريغ</button>
    </div>`).join('')}
    <div class="btn-row"><button type="button" class="ghost" data-action="bv-rec" id="bvRecBtn">${bvRec.st ? '■ أوقف التسجيل' : '🎙 سجّل'}</button><small class="hint num" id="bvTime">${bvRec.st ? 'يسجّل…' : ''}</small></div>
  </div>`;
  for (const el of box.querySelectorAll('audio[data-media]')) {
    Media.url(el.dataset.media).then((u) => {
      if (u) el.src = u;
      else el.replaceWith(Object.assign(document.createElement('small'), { className: 'hint', textContent: 'هذا التسجيل محفوظ على جهاز آخر.' }));
    }).catch(() => {});
  }
}

async function bvStart() {
  const type = pickAudioType();
  if (type === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('جهازك لا يدعم التسجيل الصوتي من المتصفح.'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { toast(e && e.name === 'NotAllowedError' ? 'اسمح للتطبيق باستخدام الميكروفون من إعدادات الجوال.' : 'تعذّر الوصول إلى الميكروفون.'); return; }
  // 32 kbit/s is plenty for speech (clear to listen to and to transcribe): about 170 KB a minute instead of about 850
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
  const st = { rec, stream, chunks: [], started: Date.now(), type: rec.mimeType || type || 'audio/webm', draft: ldraft };
  bvRec.st = st;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) st.chunks.push(e.data); };
  rec.onstop = () => bvFinish(st);
  rec.start(1000);
  st.timer = setInterval(() => { const t = $('bvTime'); if (t) t.textContent = `يسجّل ${fmtClock((Date.now() - st.started) / 1000)}`; if (Date.now() - st.started > 30 * 60000) bvStop(); }, 500);
  bvRender();
}
function bvStop() { const st = bvRec.st; if (st) { clearInterval(st.timer); try { st.rec.stop(); } catch { bvFinish(st); } } }
async function bvFinish(st) {
  bvRec.st = null;
  st.stream.getTracks().forEach((t) => t.stop());
  const dur = Math.round((Date.now() - st.started) / 1000);
  if (!st.chunks.length || dur < 1) { toast('التسجيل قصير جداً.'); bvRender(); return; }
  const mediaId = 'aud-' + uid(), blob = new Blob(st.chunks, { type: st.type });
  const imp = st.draft && st.draft.kind === 'benimp', open = ldraft === st.draft;
  // «عدة فوائد مرة واحدة» closed meanwhile: its recording was only for writing out, nothing keeps it
  if (imp && !open) return;
  // the phone's share list opens right away (the tap that stopped the recording still counts), unless turned off
  if (open && S.settings.benRecShare !== false) bvShareBlob(blob, (ldraft.voices || []).length + 1, true).catch(() => {});
  try { await Media.put(mediaId, blob); } catch { toast('تعذّر حفظ التسجيل على الجهاز.'); return; }
  // the sheet may have been closed meanwhile: the recording still goes to its benefit
  const v = { id: uid(), mediaId, dur, text: '', created: Date.now() };
  if (ldraft === st.draft) { ldraft.voices = [...(ldraft.voices || []), v]; bvRender(); if (!imp) bvUnsaved.set(mediaId, st.draft.id); }
  else if (imp) { Media.del(mediaId).catch(() => {}); return; }
  else {
    const f = getBenefit(st.draft.id);
    // a new benefit closed before it was saved: nothing keeps its recording
    if (!f) { Media.del(mediaId).catch(() => {}); toast('أُغلقت الفائدة قبل حفظها، فلم يُحفظ التسجيل.'); return; }
    f.voices = [...(f.voices || []), v]; save();
  }
  toast(`سُجّل ${fmtClock(dur)}. أرسله إلى تطبيق للتفريغ، ثم الصق نصه في «${imp ? 'النص' : 'نص الفائدة'}».`);
}

// share the recording with another app (the phone's share sheet), or save it if sharing files is not possible
async function bvShareBlob(blob, n, auto) {
  const ext = /mp4|m4a/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
  const file = new File([blob], `mahami-faida-${n}.${ext}`, { type: blob.type || 'audio/webm' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'تفريغ صوتي' }); return; }
  // opened by itself after recording: nothing is downloaded unasked
  if (auto) return;
  downloadBlob(blob, file.name);
  toast('حُفظ التسجيل في التنزيلات. افتحه في تطبيق التفريغ.');
}
async function bvShare(v, n) {
  try {
    const u = await Media.url(v.mediaId);
    if (!u) { toast('هذا التسجيل محفوظ على جهاز آخر.'); return; }
    await bvShareBlob(await (await fetch(u)).blob(), n);
  } catch (e) { if (!(e && e.name === 'AbortError')) toast('تعذّر إرسال التسجيل.'); }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="bv-"]');
  if (!el || !ldraft || !['benefit', 'benimp'].includes(ldraft.kind)) return;
  const { action, v } = el.dataset;
  if (action === 'bv-rec') { if (bvRec.st) bvStop(); else bvStart(); return; }
  const vs = ldraft.voices || [];
  const i = vs.findIndex((x) => x.id === v);
  if (i < 0) return;
  if (action === 'bv-share') bvShare(vs[i], i + 1);
  if (action === 'bv-del') {
    if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'متأكد؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = 'حذف'; } }, 4000); return; }
    // a recording in «عدة فوائد مرة واحدة» belongs to nothing: it leaves the phone at once
    if (ldraft.kind === 'benimp') Media.del(vs[i].mediaId).catch(() => {});
    ldraft.voices = vs.filter((x) => x.id !== v);
    bvRender();
  }
});
document.addEventListener('input', (e) => {
  const id = e.target.dataset && e.target.dataset.bvText;
  if (!id || !ldraft || !ldraft.voices) return;
  const x = ldraft.voices.find((y) => y.id === id);
  if (x) x.text = e.target.value;
});
// the sheet closed while recording: the recording is kept for its benefit
document.addEventListener('close', (e) => { if (e.target && e.target.id === 'libSheet' && bvRec.st) bvStop(); }, true);
// the benefit's window closed: a recording it did not keep (closed without saving, or deleted before saving) leaves the phone
document.addEventListener('close', (e) => {
  if (!e.target || e.target.id !== 'libSheet') return;
  for (const [mediaId, id] of [...bvUnsaved]) {
    if (ldraft && (ldraft.voices || []).some((x) => x.mediaId === mediaId)) continue; // still in a window being edited
    const f = getBenefit(id);
    if (!f || !(f.voices || []).some((x) => x.mediaId === mediaId)) Media.del(mediaId).catch(() => {});
    bvUnsaved.delete(mediaId);
  }
}, true);
