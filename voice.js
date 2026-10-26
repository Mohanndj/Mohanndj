'use strict';
// Voice dictation for every text field: a microphone appears beside the focused field.
// Uses the device's speech recognition (Web Speech API); when AI is on, the dictated text can be
// cleaned up by Claude (punctuation and recognition slips) before it is inserted.

const VOICE_LANGS = [
  ['ar-SA', 'العربية (السعودية)'], ['ar-AE', 'العربية (الإمارات)'], ['ar-KW', 'العربية (الكويت)'], ['ar-QA', 'العربية (قطر)'],
  ['ar-EG', 'العربية (مصر)'], ['ar-JO', 'العربية (الأردن)'], ['ar-MA', 'العربية (المغرب)'], ['en-US', 'English (US)'],
];

const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;
  let btn = null, bubble = null;
  let target = null, rec = null;
  let active = false, finishing = false, useAI = false, buffer = '', interim = '', restarts = 0;
  let sessionEl = null; // the field being dictated into, kept even if focus moves
  let hideTimer = null;
  let said = []; // what this dictation wrote, to offer to refine it afterwards
  let refineBtn = null, refineTimer = null, offer = null;
  let lastHeard = 0, silenceTimer = null; // stops by itself after 5 seconds of silence
  const SILENCE_MS = 5000;

  const cfg = () => ({ lang: 'ar-SA', ai: true, on: true, ...(S.settings.voice || {}) });

  function eligible(el) {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
    if (el.tagName === 'INPUT') return ['text', 'search'].includes(el.type) && !el.readOnly && !el.disabled && el.dataset.novoice === undefined;
    return false;
  }

  function ensureUI() {
    if (btn) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mic-btn';
    btn.setAttribute('aria-label', 'إملاء صوتي');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3M8 21h8"/></svg>';
    bubble = document.createElement('div');
    bubble.className = 'mic-bubble';
    bubble.hidden = true;
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    // keep the field focused (and the keyboard open) when tapping the mic
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => (active ? stop() : start()));
  }

  // the mic sits inside the field's open dialog, if any, so it is drawn above it
  function place() {
    if (!target || !btn) return;
    const host = target.closest('dialog[open]') || document.body;
    if (btn.parentNode !== host) { host.append(btn); host.append(bubble); }
    const r = target.getBoundingClientRect();
    const vv = window.visualViewport;
    const vh = vv ? vv.height + vv.offsetTop : innerHeight;
    const size = 38;
    const multi = target.tagName === 'TEXTAREA' || target.isContentEditable;
    let top = multi ? Math.min(r.bottom, vh - 8) - size - 6 : r.top + (r.height - size) / 2;
    top = Math.max(6, Math.min(top, vh - size - 6));
    const left = Math.max(6, r.left + 6);
    btn.style.top = `${top}px`;
    btn.style.left = `${left}px`;
    // the bubble sits just above the mic (or the field) and never covers it
    bubble.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 288))}px`;
    bubble.style.top = `${Math.max(8, Math.min(top, r.top) - 8)}px`;
  }

  function show(el) {
    if (!supported || !cfg().on || !eligible(el)) return;
    ensureUI();
    clearTimeout(hideTimer);
    if (target && target !== el) target.classList.remove('has-mic');
    target = el;
    if (!el.isContentEditable) el.classList.add('has-mic');
    btn.hidden = false;
    btn.classList.toggle('rec', active);
    place();
  }
  function hide() {
    if (active || finishing || !btn) return;
    btn.hidden = true;
    bubble.hidden = true;
    if (target) target.classList.remove('has-mic');
    target = null;
  }

  function setBubble(text) {
    if (!bubble) return;
    bubble.hidden = !text;
    bubble.textContent = text;
    place();
  }

  function insert(text) {
    const el = sessionEl || target;
    if (!el || !text) return;
    if (sessionEl) said.push(text);
    if (el.isContentEditable) {
      el.focus();
      const sel = getSelection();
      const before = sel && sel.anchorNode && sel.anchorNode.nodeType === 3 ? sel.anchorNode.nodeValue.slice(0, sel.anchorOffset) : '';
      document.execCommand('insertText', false, (before && !/\s$/.test(before) ? ' ' : '') + text);
      return;
    }
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    const pre = el.value.slice(0, s);
    const chunk = (pre && !/\s$/.test(pre) ? ' ' : '') + text;
    el.setRangeText(chunk, s, e, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // after dictation the cursor goes back to the field dictated into, right after its text
  function returnCaret(el) {
    if (!el || !el.isConnected) return;
    try {
      el.focus({ preventScroll: true });
      if (!el.isContentEditable) { const n = el.selectionEnd ?? el.value.length; el.setSelectionRange(n, n); }
    } catch {}
  }

  function start() {
    if (!target) return;
    sessionEl = target;
    said = [];
    hideRefine();
    unlockAudio();
    const c = cfg();
    // (offline: the dictation is written as heard at once, not after the AI's tries time out)
    useAI = !!(c.ai && typeof AI !== 'undefined' && AI.on() && navigator.onLine);
    buffer = ''; interim = ''; restarts = 0;
    rec = new SR();
    rec.lang = c.lang;
    // one phrase per listening (Android repeats earlier words when listening continuously); it restarts by itself
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    lastHeard = Date.now();
    clearInterval(silenceTimer);
    silenceTimer = setInterval(() => { if (active && Date.now() - lastHeard > SILENCE_MS) stop(); }, 500);
    rec.onspeechstart = () => { lastHeard = Date.now(); };
    rec.onresult = (ev) => {
      lastHeard = Date.now();
      interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0].transcript.trim();
        if (r.isFinal) {
          if (useAI) buffer += (buffer ? ' ' : '') + text;
          else insert(text);
        } else interim += (interim ? ' ' : '') + text;
      }
      setBubble((useAI ? buffer + (interim ? ' ' + interim : '') : interim) || 'أستمع…');
    };
    rec.onerror = (ev) => {
      const msg = {
        'not-allowed': 'اسمح للتطبيق باستخدام الميكروفون من إعدادات الجوال أو المتصفح.',
        'service-not-allowed': 'خدمة التعرّف على الصوت غير متاحة على هذا الجهاز.',
        'audio-capture': 'لم يُعثر على ميكروفون.',
        network: 'التعرّف على الصوت يحتاج اتصالاً بالإنترنت.',
        'language-not-supported': 'هذه اللغة غير مدعومة على جهازك. غيّرها من الإعدادات.',
      }[ev.error];
      if (msg) { toast(msg); active = false; }
    };
    // phones stop listening after a pause; keep going until the user taps again
    rec.onend = () => {
      // a phrase heard but not yet final is written before listening again, so nothing heard is lost
      if (interim && !useAI) { insert(interim); interim = ''; }
      if (active && restarts < 200) { restarts++; try { rec.start(); return; } catch {} }
      finish();
    };
    try { rec.start(); } catch { toast('تعذّر بدء الإملاء. حاول مرة أخرى.'); return; }
    active = true;
    btn.classList.add('rec');
    btn.setAttribute('aria-label', 'إيقاف الإملاء');
    setBubble('أستمع… تكلّم الآن');
    try { if (navigator.vibrate) navigator.vibrate(30); } catch {}
  }

  function stop() {
    active = false;
    clearInterval(silenceTimer);
    try { rec && rec.stop(); } catch { finish(); }
  }

  async function finish() {
    if (!btn) return;
    active = false;
    btn.classList.remove('rec');
    btn.setAttribute('aria-label', 'إملاء صوتي');
    const text = (buffer + (interim ? ' ' + interim : '')).trim();
    clearInterval(silenceTimer);
    if (!useAI) {
      if (interim) insert(interim);
      interim = '';
      setBubble('');
      const el = sessionEl;
      sessionEl = null;
      returnCaret(el);
      offerRefine(el);
      return;
    }
    buffer = ''; interim = '';
    if (!text) { setBubble(''); const el0 = sessionEl; sessionEl = null; returnCaret(el0); return; }
    finishing = true;
    setBubble('جارٍ تنقيح النص…');
    let clean = text;
    if (navigator.onLine) try {
      clean = (await AI.ask({
        // only punctuation: the words stay exactly as they were heard
        system: 'Add punctuation marks to this Arabic voice dictation. Do NOT change, add, remove, reorder or correct any word, and do not translate. Keep every word exactly as given. Return only the text.',
        effort: 'low',
        maxTokens: 2000,
        prompt: text,
      })) || text;
    } catch { /* keep the raw dictation */ }
    // a cleanup that changed the words is not used: only what was heard is written
    const words = (s) => s.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).join(' ');
    if (words(clean) !== words(text)) clean = text;
    insert(clean);
    finishing = false;
    const el = sessionEl;
    sessionEl = null;
    setBubble('');
    returnCaret(el);
    offerRefine(el);
  }

  // ---------- «✨ نقّح ما أمليته»: after each dictation, one tap asks the AI to punctuate it and fix its
  // spelling; what it gives replaces only the dictated words, and «أرجع» puts them back as they were
  // replace the last place `from` is written in the field with `to` (plain fields and the notes editor)
  function swapText(el, from, to) {
    if (!el.isContentEditable) {
      const i = el.value.lastIndexOf(from);
      if (i < 0) return false;
      el.setRangeText(to, i, i + from.length, 'end');
    } else {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = null, n;
      while ((n = walk.nextNode())) if (n.nodeValue.includes(from)) node = n;
      if (!node) return false;
      const i = node.nodeValue.lastIndexOf(from);
      node.nodeValue = node.nodeValue.slice(0, i) + to + node.nodeValue.slice(i + from.length);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  function hideRefine() { clearTimeout(refineTimer); if (refineBtn) refineBtn.hidden = true; offer = null; }
  function placeRefine(el) {
    const host = el.closest('dialog[open]') || document.body;
    if (refineBtn.parentNode !== host) host.append(refineBtn);
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const vh = vv ? vv.height + vv.offsetTop : innerHeight;
    const below = r.bottom + 40 < vh;
    refineBtn.style.top = `${below ? r.bottom + 4 : Math.max(6, r.top - 40)}px`;
    refineBtn.style.right = `${Math.max(6, innerWidth - r.right)}px`;
  }
  function showRefine(label, onTap, ms = 30000) {
    if (!refineBtn) {
      refineBtn = document.createElement('button');
      refineBtn.type = 'button';
      refineBtn.className = 'refine-btn';
      refineBtn.addEventListener('pointerdown', (e) => e.preventDefault()); // the field keeps the cursor
      refineBtn.addEventListener('click', () => { if (refineBtn.onTap) refineBtn.onTap(); });
    }
    refineBtn.textContent = label;
    refineBtn.onTap = onTap;
    refineBtn.disabled = false;
    refineBtn.hidden = false;
    placeRefine(offer.el);
    clearTimeout(refineTimer);
    refineTimer = setTimeout(hideRefine, ms);
  }
  function offerRefine(el) {
    const text = said.join(' ').trim();
    said = [];
    if (!el || !el.isConnected || !text || typeof AI === 'undefined' || !AI.on() || !navigator.onLine) return;
    offer = { el, text };
    showRefine('✨ نقّح ما أمليته', refine);
  }
  async function refine() {
    const o = offer;
    if (!o || !o.el.isConnected) return hideRefine();
    const el = o.el;
    const has = (t) => (el.isContentEditable ? el.textContent : el.value).includes(t);
    if (!has(o.text)) { toast('تغيّر النص بعد الإملاء، فلم يُنقَّح.'); return hideRefine(); }
    refineBtn.textContent = 'جارٍ التنقيح…';
    refineBtn.disabled = true;
    let clean = '';
    try {
      clean = ((await AI.ask({
        system: 'You correct Arabic text that was typed by voice dictation. Add punctuation marks, fix spelling mistakes (hamza, taa marbuta, alif maqsura and the like) and obvious speech-recognition slips. Keep the speaker\'s meaning, words, order and dialect; do not add or remove ideas, do not rephrase, do not translate. Return only the corrected text.',
        effort: 'low',
        maxTokens: 4000,
        prompt: o.text,
      })) || '').trim();
    } catch { clean = ''; }
    if (!clean || !el.isConnected || !swapText(el, o.text, clean)) { toast(clean ? 'تغيّر النص أثناء التنقيح، فلم يُستبدل.' : 'تعذّر التنقيح الآن. حاول لاحقاً.'); return hideRefine(); }
    returnCaret(el);
    // one tap puts back the words as they were dictated
    offer = { el, text: clean, original: o.text };
    showRefine('↩ أرجع النص كما أمليته', () => {
      if (swapText(el, clean, o.text)) returnCaret(el);
      hideRefine();
    }, 15000);
  }

  document.addEventListener('focusin', (e) => {
    if (offer && e.target !== offer.el && e.target !== refineBtn) hideRefine();
    if (active && sessionEl && e.target !== sessionEl && e.target !== btn) { stop(); return; }
    show(e.target);
  });
  document.addEventListener('focusout', () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!eligible(document.activeElement)) hide(); }, 200);
  });
  window.addEventListener('scroll', place, true);
  window.addEventListener('scroll', () => { if (offer && refineBtn && !refineBtn.hidden) placeRefine(offer.el); }, true);
  window.addEventListener('resize', place);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', place);
  document.addEventListener('close', () => { if (active) stop(); hide(); hideRefine(); }, true);

  function settingsHTML() {
    const c = cfg();
    if (!supported) {
      return `<section class="panel"><h2>الإملاء الصوتي</h2>
        <p class="note-text">هذا المتصفح لا يدعم التعرّف على الصوت. افتح التطبيق من Chrome أو Safari لتستخدم الإملاء.</p></section>`;
    }
    return `<section class="panel"><h2>الإملاء الصوتي</h2>
      <p class="note-text explain">اضغط على أي خانة كتابة ثم على زر الميكروفون 🎤 بجانبها، وتكلّم. اضغطه مرة أخرى لتتوقف.</p>
      <label class="switch"><input type="checkbox" id="voiceOn"${c.on ? ' checked' : ''}><span>إظهار زر الميكروفون في خانات الكتابة</span></label>
      <label class="field"><span>لغة الإملاء ولهجته</span><select id="voiceLang">${VOICE_LANGS.map(([v, l]) => `<option value="${v}"${c.lang === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="switch"><input type="checkbox" id="voiceAI"${c.ai ? ' checked' : ''}${typeof AI !== 'undefined' && AI.on() ? '' : ' disabled'}><span>علامات الترقيم بالذكاء الاصطناعي بعد الإملاء (لا يغيّر كلمة)${typeof AI !== 'undefined' && AI.on() ? '' : ' | فعّل الذكاء الاصطناعي أولاً'}</span></label>
      <p class="note-text explain">التعرّف على الصوت تقدّمه خدمة جهازك (Google أو Apple) ويحتاج إنترنت.</p>
    </section>`;
  }

  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (!['voiceOn', 'voiceLang', 'voiceAI'].includes(id)) return;
    S.settings.voice = { ...cfg(), on: $('voiceOn').checked, lang: $('voiceLang').value, ai: $('voiceAI').checked };
    save();
  });

  return { supported, settingsHTML };
})();
