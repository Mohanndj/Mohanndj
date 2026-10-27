'use strict';
// «الوعي الشخصي» as an Android app (android/, v111): the app opens this site in its own window, which lacks some of the
// browser's abilities. The app gives them to the page as `WaiNative`, and here the web's own calls are turned into it, so
// the rest of the app is unchanged: a file made (<a download>) is saved in «التنزيلات», sharing opens the phone's share
// sheet, printing its print window, a link to another app opens that app, and so on. In a browser this does nothing.
const WaiBridge = (() => {
  const N = window.WaiNative;
  if (!N) return null;
  const b64 = (blob) => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => no(r.error);
    r.readAsDataURL(blob);
  });
  const def = (obj, key, value) => { try { Object.defineProperty(obj, key, { value, configurable: true, writable: true }); } catch {} };

  // every file the app makes is an <a download> clicked on a blob (backup, Excel, Word, a report's image)
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a || !/^(blob|data):/.test(a.href)) return;
    e.preventDefault();
    const name = a.getAttribute('download') || 'mahami-file';
    fetch(a.href).then((r) => r.blob()).then(async (blob) => N.saveFile(name, blob.type || '', await b64(blob)))
      .catch(() => N.toast('تعذّر حفظ الملف'));
  }, true);

  // sharing: a file (a recording to transcribe, a report's image) or a text
  def(navigator, 'canShare', (data) => !!data);
  def(navigator, 'share', async (data = {}) => {
    const f = data.files && data.files[0];
    if (f) N.shareFile(f.name || 'mahami-file', f.type || '', await b64(f), data.title || '');
    else N.shareText([data.text, data.url].filter(Boolean).join('\n'), data.title || '');
  });

  def(navigator, 'clipboard', { writeText: async (t) => { N.copy(String(t == null ? '' : t)); }, readText: async () => '' });
  def(navigator, 'vibrate', (p) => { N.vibrate(JSON.stringify(Array.isArray(p) ? p : [Number(p) || 0])); return true; });

  // keeping the screen on while the timer runs
  def(navigator, 'wakeLock', {
    request: async () => {
      N.keepAwake(true);
      const lock = new EventTarget();
      lock.released = false;
      lock.type = 'screen';
      lock.release = async () => { if (lock.released) return; lock.released = true; N.keepAwake(false); lock.dispatchEvent(new Event('release')); };
      return lock;
    },
  });

  window.print = () => N.print(document.title || 'الوعي الشخصي');
  // a link opened apart (an app of «تطبيقاتي», a site): in its own app, never inside this window
  window.open = (url) => { if (url) N.openExternal(new URL(String(url), location.href).href); return null; };
  // «خروج»: the app goes to the background, as Android's back does
  window.close = () => N.exit();

  // ---------- stage two (v113): only with an app that has it (an app of the first stage stays as it was) ----------
  const has = (k) => typeof N[k] === 'function';
  let permWait = [], speechCur = null, alarmsTimer = null, alarmsSent = '', widgetSent = '';

  // the phone's notifications in place of the browser's: the timer with its buttons, what is left today, an alarm
  const notice = (title, o = {}) => JSON.stringify({ title: String(title), body: o.body || '', tag: o.tag || '', silent: !!o.silent,
    renotify: !!o.renotify, timestamp: o.timestamp || 0, data: o.data || null, actions: (o.actions || []).map((a) => ({ action: a.action, title: a.title })) });
  if (has('notify')) {
    const WaiNotification = function (title, o = {}) { N.notify(notice(title, o)); this.title = title; this.tag = o.tag || ''; this.close = () => { if (this.tag) N.closeNotify(this.tag); }; };
    Object.defineProperty(WaiNotification, 'permission', { get: () => N.notifPermission() });
    WaiNotification.requestPermission = () => new Promise((ok) => { permWait.push(ok); N.requestNotif(); });
    window.Notification = WaiNotification;
    const P = window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype;
    if (P) {
      P.showNotification = function (title, o) { N.notify(notice(title, o)); return Promise.resolve(); };
      P.getNotifications = function (f) { const tag = f && f.tag; return Promise.resolve(tag ? [{ tag, data: {}, close: () => N.closeNotify(String(tag)) }] : []); };
    }
  }

  // the alarms of the coming week, set in the phone's alarm clock: they ring on time with the app closed, with the
  // tone chosen; sent whenever the data changes (app.js save()) and when the app opens. Each is known by the page's
  // own key (task|day|minutes before), so what the app did while the page was closed comes back to it by that key
  const alarmItem = (t, key, d, at) => {
    const m = timeOn(t, d), ev = m == null ? at : parse(d).getTime() + m * 60000, left = Math.round((ev - at) / 60000), when = timeLabel(t, d);
    const r = remOf(t.id);
    if (r) return { key, id: t.id, at, title: digitsOut(remNoteTitle(r, t.time)), body: digitsOut(r.text) };
    return { key, id: t.id, at, title: digitsOut(t.title), body: digitsOut(left > 0 ? `بعد ${minsWord(left)} | ${when}` : `الآن | ${when}`) };
  };
  function alarmList() {
    const now = Date.now(), d0 = today(), out = [];
    for (const [key, sn] of Object.entries(S.snoozed || {})) {
      const [id, d] = key.split('|'), r = remOf(id), t = r ? remTask(id) : getTask(id);
      if (t && d && sn > now && !(r ? r.done : doneOn(t, d))) out.push(alarmItem(t, key, d, sn));
    }
    // the reminders with a day and an hour (v119): rung by the phone's alarm clock too, their whole text in the
    // notification; those that repeat, their times of the coming two weeks (or the next one, when further)
    for (const r of S.reminders) {
      for (const x of remSlots(r, now + 1)) if (!S.snoozed[x.key] && !S.fired[x.key]) out.push(alarmItem(remTask(remSlotId(r, x.tm)), x.key, x.d, x.at));
    }
    for (const t of S.tasks) {
      if (!t.alarms || !t.alarms.length || !hasTime(t)) continue;
      for (let i = 0; i < 8; i++) {
        const d = addDays(d0, i);
        if (!(isRepeat(t) ? occursOn(t, d) : t.due === d) || doneOn(t, d)) continue;
        const m = timeOn(t, d);
        if (m == null) continue;
        for (const off of t.alarms) {
          const key = `${t.id}|${d}|${off}`, at = parse(d).getTime() + (m - off) * 60000;
          if (at > now && !S.snoozed[key] && !S.fired[key]) out.push(alarmItem(t, key, d, at));
        }
      }
    }
    return out.sort((a, b) => a.at - b.at).slice(0, 60);
  }
  function sendAlarms() {
    alarmsTimer = null;
    let json;
    try {
      json = JSON.stringify({ tone: S.settings.tone || 'chime', sound: !!S.settings.sound, snooze: SNOOZE_MIN, ring: RING_MIN,
        snoozeLabel: digitsOut(`غفوة ${SNOOZE_MIN} دقائق`), list: alarmList() });
    } catch { return; }
    if (json !== alarmsSent) { alarmsSent = json; N.setAlarms(json); }
  }

  // v116: the widget «اليوم» on the home screen: what is left of the day, as «اليوم» counts it (route.js leftToday):
  // the tasks due, the goals of the day not done, by their time; today's and tomorrow's, so the app shows the new day's
  // at midnight though the page is closed. A goal counted (٣ من ٨) shows its count; a book's session opens the app (its
  // pages are asked), the rest are ticked from the widget
  function widgetDay(d) {
    const skip = d === today() ? closeSkips() : [], out = [];
    for (const t of S.tasks) {
      const on = isRepeat(t) ? !goalEnded(t) && occursOn(t, d) && !t.completions[d] && !skip.includes(t.id)
        : dueNow(t, d) && !(isGoal(t) && skip.includes(t.id));
      if (!on) continue;
      const m = hasTime(t) ? timeOn(t, d) : null, late = false, cnt = isCounted(t); // (v146: no «متأخرة» in red: the owner: «المتعثرات مكانها الإحصائيات والتقرير فقط»)
      // its time and a count (written by the app: a tick there adds one)
      out.push({ id: t.id, t: digitsOut(t.title), s: hasTime(t) ? digitsOut(timeLabel(t, d)) : '', l: '', m, late, tick: !t.bookId && !t.sciId, n: cnt ? countOn(t, d) : 0, of: cnt ? t.target : 0 });
    }
    out.sort((a, b) => (a.m ?? 9999) - (b.m ?? 9999) || (b.late - a.late));
    const date = `${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${S.settings.hijri ? ` | ${fmtHijri(d)}` : ''}`;
    return { date: digitsOut(date), items: out.slice(0, 40).map(({ m, late: _, ...x }) => x) };
  }
  function sendWidget() {
    let json;
    try {
      const d0 = today(), d1 = addDays(d0, 1);
      json = JSON.stringify({ arab: S.settings.digits === 'arab', days: { [d0]: widgetDay(d0), [d1]: widgetDay(d1) } });
    } catch { return; }
    if (json !== widgetSent) { widgetSent = json; N.setWidget(json); }
  }
  // a task ticked on the widget: done as by its circle in «اليوم», without «كم استغرقت؟» (asked of nobody there)
  function widgetDone(id, d) {
    const t = getTask(id);
    if (!t || t.bookId || t.sciId || doneOn(t, d)) return;
    toggle(id, d, true);
  }

  // what happened outside the page (an alarm the app rang, «تمت» or «غفوة» on its notification or the watch, a button
  // of the timer): now if the page is open, or in order when it opens (as the browser's service worker did)
  function apply(m, live) {
    if (m.type === 'fired') { S.fired[m.key] = m.ts || Date.now(); delete S.snoozed[m.key]; if (live) save(); }
    else if (m.type === 'alarm-action') {
      if (live || m.action === 'done') alarmAction(m.action, m.id, m.key);
      else if (m.action === 'snooze') S.snoozed[m.key] = (m.ts || Date.now()) + SNOOZE_MIN * 60000;
    } else if (m.type === 'timer') applyTimerAction(m.action, m.ts || Date.now());
    else if (m.type === 'widget') widgetDone(m.id, m.day);
  }

  // dictation with the phone's own speech recognition, in the browser's shape (voice.js is unchanged)
  if (has('speechStart') && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
    window.webkitSpeechRecognition = class {
      constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this.onstart = this.onspeechstart = this.onresult = this.onerror = this.onend = null; this.on = false; }
      start() { if (this.on) throw new DOMException('started', 'InvalidStateError'); this.on = true; speechCur = this; N.speechStart(this.lang || 'ar-SA', !!this.interimResults); }
      stop() { if (this.on) N.speechStop(); }
      abort() { if (this.on) N.speechAbort(); }
    };
  }
  function speechEv(m) {
    const r = speechCur;
    if (!r) return;
    const call = (fn, e) => { try { if (typeof fn === 'function') fn.call(r, e); } catch {} };
    if (m.ev === 'start') call(r.onstart, {});
    else if (m.ev === 'speechstart') call(r.onspeechstart, {});
    else if (m.ev === 'result') { const alt = [{ transcript: m.text || '', confidence: 1 }]; alt.isFinal = !!m.final; call(r.onresult, { resultIndex: 0, results: [alt] }); }
    else if (m.ev === 'error') call(r.onerror, { error: m.error || 'aborted' });
    else if (m.ev === 'end') { r.on = false; if (speechCur === r) speechCur = null; call(r.onend, {}); }
  }

  return {
    version: () => N.version(),
    alarms: has('setAlarms'), // the app rings the alarms out of sight (app.js ring())
    // the app speaks to the page
    _ev(m) {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'perm') { const w = permWait; permWait = []; w.forEach((f) => f(m.state)); return; }
      if (m.type === 'speech') { speechEv(m); return; }
      try { apply(m, true); } catch {}
    },
    // app.js boot(), before its first check of the alarms: what happened while the page was closed, then the alarms
    boot() {
      if (!has('takePending')) return;
      let list = [];
      try { list = JSON.parse(N.takePending() || '[]'); } catch {}
      list.sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach((m) => { try { apply(m, false); } catch {} });
      if (list.length) save();
      if (has('setAlarms')) sendAlarms();
      if (has('setWidget')) sendWidget();
    },
    // the app kept something for the open page (a tick on the widget): taken now, in order
    pull() {
      if (!has('takePending')) return;
      let list = [];
      try { list = JSON.parse(N.takePending() || '[]'); } catch {}
      list.sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach((m) => { try { apply(m, true); } catch {} });
    },
    // app.js save(): the alarms and the widget again, a moment after the last change
    alarmsSoon() { if ((has('setAlarms') || has('setWidget')) && !alarmsTimer) alarmsTimer = setTimeout(() => { alarmsTimer = null; if (has('setAlarms')) sendAlarms(); if (has('setWidget')) sendWidget(); }, 1000); },
  };
})();
