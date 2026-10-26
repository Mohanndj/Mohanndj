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

  return { version: () => N.version() };
})();
