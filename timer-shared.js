'use strict';
// Timer logic shared by the page and the service worker, so notification buttons
// (also shown on a paired smartwatch) keep working while the app is in the background.

const TimerShared = (() => {
  const elapsed = (tm, now = Date.now()) => tm.acc + (tm.running ? now - tm.start : 0);

  // apply a notification/button action at time ts; returns the new timer or null when stopped
  function apply(tm, action, ts) {
    if (!tm) return null;
    const next = { ...tm };
    if (action === 'timer-pause' && next.running) { next.acc += ts - next.start; next.running = false; }
    else if (action === 'timer-resume' && !next.running) { next.start = ts; next.running = true; }
    else if (action === 'timer-stop') return null;
    return next;
  }

  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0');
  }

  const at = (ms) => new Date(ms).toLocaleTimeString('ar-u-nu-latn', { hour: 'numeric', minute: '2-digit' });

  // [title, options] for showNotification
  function notification(tm, taskTitle, now = Date.now()) {
    const e = elapsed(tm, now);
    const kind = tm.phase === 'break' ? 'استراحة' : tm.mode === 'down' ? 'تركيز' : 'مؤقت';
    let body;
    if (!tm.running) body = `متوقف عند ${clock(tm.mode === 'down' ? tm.planned - e : e)}`;
    else if (tm.mode === 'down') body = `متبقٍ ${clock(tm.planned - e)} · ينتهي ${at(now + tm.planned - e)}`;
    else body = `يعمل منذ ${at(now - e)}`;
    return [`${kind}: ${taskTitle}`, {
      body, tag: 'timer', renotify: false, silent: true, requireInteraction: true, lang: 'ar', dir: 'rtl',
      timestamp: now - e, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      data: { timer: tm, title: taskTitle },
      actions: [
        tm.running ? { action: 'timer-pause', title: 'إيقاف مؤقت' } : { action: 'timer-resume', title: 'استئناف' },
        { action: 'timer-stop', title: tm.phase === 'break' ? 'إنهاء الاستراحة' : 'إنهاء وحفظ' },
      ],
    }];
  }

  return { elapsed, apply, clock, notification };
})();

if (typeof self !== 'undefined' && typeof window === 'undefined') self.TimerShared = TimerShared;
