'use strict';
// Voice notes on a benefit («الفوائد»): record what you want to say about it, send the recording to an
// app that writes speech out (Gemini, the phone's recorder…), then paste the text back under it.
// Every written-out note stays under its benefit's title, and they all gather on the book's page and in
// its recall. The recordings stay on this phone; their text goes with backups and sync.

const bvRec = { st: null };

const bvTexts = (f) => (f.voices || []).map((v) => v.text.trim()).filter(Boolean);

function bvRender() {
  const box = $('bvBox');
  if (!box || !ldraft || ldraft.kind !== 'benefit') return;
  const vs = ldraft.voices || [];
  box.innerHTML = `<div class="field bv"><span>تسجيلات صوتية</span>
    ${vs.map((v, i) => `<div class="bv-item">
      <div class="row-between"><small>التسجيل ${i + 1} | ${fmtClock(v.dur)}</small><button type="button" class="ghost sm" data-action="bv-del" data-v="${v.id}">حذف</button></div>
      <audio controls preload="metadata" data-media="${esc(v.mediaId)}"></audio>
      <button type="button" class="ghost sm" data-action="bv-share" data-v="${v.id}">أرسله إلى تطبيق للتفريغ</button>
      <textarea rows="3" data-bv-text="${v.id}" placeholder="الصق هنا نص التسجيل بعد تفريغه">${esc(v.text)}</textarea>
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
  const rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
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
  const mediaId = 'aud-' + uid();
  try { await Media.put(mediaId, new Blob(st.chunks, { type: st.type })); } catch { toast('تعذّر حفظ التسجيل على الجهاز.'); return; }
  // the sheet may have been closed meanwhile: the recording still goes to its benefit
  const v = { id: uid(), mediaId, dur, text: '', created: Date.now() };
  if (ldraft === st.draft) { ldraft.voices = [...(ldraft.voices || []), v]; bvRender(); }
  else { const f = getBenefit(st.draft.id); if (f) { f.voices = [...(f.voices || []), v]; save(); } }
  toast(`سُجّل ${fmtClock(dur)}. أرسله إلى تطبيق للتفريغ، ثم الصق النص تحته.`);
}

// share the recording with another app (the phone's share sheet), or save it if sharing files is not possible
async function bvShare(v, n) {
  try {
    const u = await Media.url(v.mediaId);
    if (!u) { toast('هذا التسجيل محفوظ على جهاز آخر.'); return; }
    const blob = await (await fetch(u)).blob();
    const ext = /mp4|m4a/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
    const file = new File([blob], `mahami-faida-${n}.${ext}`, { type: blob.type || 'audio/webm' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'تفريغ صوتي' }); return; }
    downloadBlob(blob, file.name);
    toast('حُفظ التسجيل في التنزيلات. افتحه في تطبيق التفريغ.');
  } catch (e) { if (!(e && e.name === 'AbortError')) toast('تعذّر إرسال التسجيل.'); }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action^="bv-"]');
  if (!el || !ldraft || ldraft.kind !== 'benefit') return;
  const { action, v } = el.dataset;
  if (action === 'bv-rec') { if (bvRec.st) bvStop(); else bvStart(); return; }
  const vs = ldraft.voices || [];
  const i = vs.findIndex((x) => x.id === v);
  if (i < 0) return;
  if (action === 'bv-share') bvShare(vs[i], i + 1);
  if (action === 'bv-del') {
    if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'متأكد؟'; setTimeout(() => { if (el.isConnected) { el.classList.remove('armed'); el.textContent = 'حذف'; } }, 4000); return; }
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
