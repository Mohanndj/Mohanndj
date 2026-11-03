// v160, the owner: «في يوتيوب أريد كل مقطع دخلته يبقى محفوظا عند اللحظة التي توقفت عندها، وأضع لي قائمة سفلية بالمقاطع التي أريد
// الاستماع إليها …», and his answers: a finished one in the list stays struck, nothing starts by itself. Run in YouTube's
// page inside the app (YtPanel) after yt_noads.js and yt_calm.js, once a page. Kept in YouTube's own storage on the phone
// (no bridge to the app): each video's place («wai-pos»), saved every few seconds and on leaving, never during an ad, and
// a video opened again starts there (one finished, in its last 20 seconds or 95%, starts from its beginning); and his list
// «للاستماع» («wai-list»): «＋ للاستماع» on a video's page, a bar below opening it, each one with where he stopped, a tap
// opening it at that place, «حذف» (two taps). And for the app's small windows: the video alone filling the page (__waiMini).
(function () {
  if (window.__waiKeep) return;
  var st = window.__waiKeep = { saved: 0, resumed: 0, list: 0, mini: false };
  if (!/(^|\.)youtube\.com$/.test(location.hostname)) return; // (Google's sign-in pages are left as they are)
  var POS = 'wai-pos', LIST = 'wai-list', MAX = 400;
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { st.err = 'store'; } }
  function vid() { if (location.pathname !== '/watch') return ''; var m = /[?&]v=([\w-]{6,})/.exec(location.search); return m ? m[1] : ''; }
  function video() { return document.querySelector('video'); }
  function ad() { return !!document.querySelector('.ad-showing, .ad-interrupting'); }
  var AR = '٠١٢٣٤٥٦٧٨٩';
  function ar(s) { return String(s).replace(/\d/g, function (d) { return AR[d]; }); }
  function clock(t) {
    t = Math.max(0, Math.floor(t || 0));
    var h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60, two = function (n) { return (n < 10 ? '0' : '') + n; };
    return ar(h ? h + ':' + two(m) + ':' + two(s) : m + ':' + two(s));
  }

  // ---- each video's place ----
  var cur = '', first = true, changedAt = 0, metaAt = 0, adAt = 0, restored = false, lastSave = 0, navTitle = '', had = { src: '', d: 0 }, old = had;
  document.addEventListener('loadedmetadata', function (e) { if (e.target && e.target.tagName === 'VIDEO') metaAt = Date.now(); }, true);
  // (for the build's check: what paused the video, and YouTube's own whole screen)
  document.addEventListener('pause', function (e) { if (e.target && e.target.tagName === 'VIDEO') { st.pauses = (st.pauses || 0) + 1; st.lastPause = { mini: st.mini, w: innerWidth, h: innerHeight, fs: !!document.fullscreenElement, hidden: document.hidden }; } }, true);
  document.addEventListener('fullscreenchange', function () { st.fs = (st.fs || 0) + 1; }, true);
  function title() {
    var t = (document.title || '').replace(/\s*[-–]\s*YouTube\s*$/i, '').trim();
    // (after moving to another video the page's title changes a moment later: the old one is not taken for the new)
    return t && t !== 'YouTube' && (first || document.title !== navTitle) ? t : '';
  }
  function save(force) {
    var id = cur, v = video();
    if (!id || !v || !restored || ad()) return;
    var d = v.duration, t = v.currentTime;
    if (!(d > 0) || !isFinite(d)) return;
    // (the player already holds the next video, or an ad, while the page still names this one: nothing saved for it)
    if (had.src && (v.currentSrc !== had.src || Math.abs(d - had.d) > 1)) return;
    var done = v.ended || t >= d - 20 || t >= d * 0.95;
    if (!done && t < 5) return; // (just started: what was kept stays)
    if (!force && !done && Date.now() - lastSave < 3000) return;
    lastSave = Date.now();
    var all = load(POS, {}), old = all[id] || {};
    all[id] = { t: done ? 0 : Math.floor(t), d: Math.floor(d), done: done, at: Date.now(), title: title() || old.title || '' };
    var ids = Object.keys(all);
    if (ids.length > MAX) ids.sort(function (a, b) { return (all[a].at || 0) - (all[b].at || 0); }).slice(0, ids.length - MAX).forEach(function (k) { delete all[k]; });
    store(POS, all);
    st.saved++;
    // (the list keeps the title it can)
    var list = load(LIST, []), it = list.filter(function (x) { return x.id === id; })[0];
    if (it && !it.title && all[id].title) { it.title = all[id].title; store(LIST, list); }
  }
  window.__waiKeepSave = function () { try { save(true); } catch (e) {} };
  window.addEventListener('pagehide', window.__waiKeepSave);
  document.addEventListener('visibilitychange', window.__waiKeepSave);
  function place() {
    var id = vid(), v = video();
    if (id !== cur) {
      if (cur) window.__waiKeepSave();
      cur = id; restored = false; old = had;
      if (!first) { changedAt = Date.now(); navTitle = document.title; }
    }
    first = false;
    if (!id || !v) return;
    if (ad()) { adAt = Date.now(); return; }
    var d = v.duration;
    if (!restored) {
      // (the video's own data loaded since moving to it, and a moment after any ad, so an ad's time is not taken for it)
      // (moved from another video: its media changed, or new data came since, or a while has passed)
      var since = Math.max(changedAt, adAt), fresh = !changedAt || metaAt > changedAt || v.currentSrc !== old.src || d !== old.d || Date.now() - changedAt > 6000;
      if (!(d > 0) || !isFinite(d) || v.readyState < 1 || Date.now() - since < 1500 || !fresh) return;
      restored = true;
      var p = load(POS, {})[id];
      if (p && !p.done && p.t > 5 && p.t < d - 20 && !/[?&#]t=/.test(location.search + location.hash) && Math.abs(v.currentTime - p.t) > 3) {
        v.currentTime = p.t;
        st.resumed++;
      }
      return;
    }
    had = { src: v.currentSrc, d: d };
    save(false);
  }

  // ---- «للاستماع» ----
  var CSS = '#wai-keep{position:fixed;bottom:64px;left:12px;z-index:2147483000;display:flex;gap:8px;direction:rtl;font:15px/1.4 Roboto,Arial,sans-serif}'
    + '#wai-keep button{border:0;border-radius:18px;padding:8px 14px;background:#0f0f0f;color:#fff;font:inherit;box-shadow:0 2px 8px rgba(0,0,0,.3)}'
    + '#wai-keep button.wai-in{background:#065f46}'
    + '#wai-sheet{position:fixed;left:0;right:0;bottom:0;max-height:65vh;overflow:auto;z-index:2147483001;background:#fff;color:#0f0f0f;'
    + 'border-radius:16px 16px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,.35);direction:rtl;font:16px/1.5 Roboto,Arial,sans-serif;padding:8px 16px 20px}'
    + '#wai-sheet .wai-h{display:flex;justify-content:space-between;align-items:center;padding:6px 0 10px;font-weight:bold}'
    + '#wai-sheet .wai-h button,#wai-sheet .wai-del{border:0;background:#f2f2f2;border-radius:14px;padding:6px 12px;font:inherit;font-size:14px;color:#0f0f0f}'
    + '#wai-sheet .wai-del.wai-arm{background:#b91c1c;color:#fff}'
    + '#wai-sheet .wai-row{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #e5e5e5}'
    + '#wai-sheet .wai-go{flex:1;min-width:0;text-align:right;border:0;background:none;padding:0;font:inherit;color:inherit}'
    + '#wai-sheet .wai-go b{display:block;font-weight:500;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}'
    + '#wai-sheet .wai-go small{display:block;color:#606060;font-size:13px}'
    + '#wai-sheet .wai-done b{text-decoration:line-through;color:#909090}'
    + '#wai-sheet .wai-empty{color:#606060;padding:10px 0}'
    + 'html.wai-mini #wai-keep,html.wai-mini #wai-sheet,html.wai-mini #wai-home,html.wai-busy #wai-keep{display:none!important}'
    // (the app's small windows: the page made as small as they are, the video alone filling it)
    + 'html.wai-mini,html.wai-mini body{overflow:hidden!important;background:#000!important}'
    + 'html.wai-mini #player-container-id,html.wai-mini .player-container,html.wai-mini #movie_player,html.wai-mini .html5-video-player{position:fixed!important;'
    + 'top:0!important;left:0!important;width:100vw!important;height:100vh!important;max-height:none!important;'
    + 'margin:0!important;padding:0!important;transform:none!important;z-index:2147483646!important;background:#000!important}'
    + 'html.wai-mini video{position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;object-fit:contain!important;'
    + 'transform:none!important;z-index:2147483647!important;background:#000!important}';
  function css() {
    if (document.getElementById('wai-keep-css') || !(document.head || document.documentElement)) return;
    var s = document.createElement('style');
    s.id = 'wai-keep-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var bar = null, addBtn = null, listBtn = null, sheet = null, barKey = '';
  function inList(id) { return load(LIST, []).some(function (x) { return x.id === id; }); }
  function drawBar() {
    if (!document.body) return;
    if (!bar) {
      bar = el('div'); bar.id = 'wai-keep';
      addBtn = el('button'); addBtn.type = 'button';
      addBtn.addEventListener('click', function () {
        var id = vid(); if (!id) return;
        var list = load(LIST, []);
        if (list.some(function (x) { return x.id === id; })) { openSheet(); return; }
        list.push({ id: id, title: title() || (load(POS, {})[id] || {}).title || '', at: Date.now() });
        store(LIST, list);
        barKey = '';
        drawBar();
      });
      listBtn = el('button'); listBtn.type = 'button';
      listBtn.addEventListener('click', function () { sheet ? closeSheet() : openSheet(); });
      bar.appendChild(addBtn); bar.appendChild(listBtn);
    }
    if (!bar.isConnected) document.body.appendChild(bar);
    var id = vid(), n = load(LIST, []).length, key = id + '|' + n + '|' + (id && inList(id));
    if (key === barKey) return;
    barKey = key;
    st.list = n;
    addBtn.style.display = id ? '' : 'none';
    var has = id && inList(id);
    addBtn.textContent = has ? '✓ في «للاستماع»' : '＋ للاستماع';
    addBtn.className = has ? 'wai-in' : '';
    listBtn.textContent = 'للاستماع' + (n ? ' (' + ar(n) + ')' : '');
  }
  function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } }
  function openSheet() {
    closeSheet();
    sheet = el('div'); sheet.id = 'wai-sheet';
    var h = el('div', 'wai-h'), x = el('button', '', 'إغلاق');
    x.type = 'button';
    x.addEventListener('click', closeSheet);
    h.appendChild(el('span', '', 'للاستماع'));
    h.appendChild(x);
    sheet.appendChild(h);
    var list = load(LIST, []), pos = load(POS, {});
    if (!list.length) sheet.appendChild(el('div', 'wai-empty', 'لا شيء بعد. اضغط «＋ للاستماع» في صفحة المقطع.'));
    list.forEach(function (it) {
      var p = pos[it.id] || {}, row = el('div', 'wai-row' + (p.done ? ' wai-done' : '')), go = el('button', 'wai-go');
      go.type = 'button';
      go.appendChild(el('b', '', it.title || p.title || 'مقطع'));
      go.appendChild(el('small', '', p.done ? 'أتممته' : p.t > 5 ? 'توقفت عند ' + clock(p.t) + (p.d ? ' من ' + clock(p.d) : '') : 'لم تبدأه'));
      go.addEventListener('click', function () { closeSheet(); location.href = '/watch?v=' + encodeURIComponent(it.id); });
      var del = el('button', 'wai-del', 'حذف');
      del.type = 'button';
      del.addEventListener('click', function () {
        if (del.dataset.arm !== '1') {
          del.dataset.arm = '1'; del.textContent = 'متأكد؟'; del.classList.add('wai-arm');
          setTimeout(function () { if (del.isConnected) { del.dataset.arm = ''; del.textContent = 'حذف'; del.classList.remove('wai-arm'); } }, 4000);
          return;
        }
        store(LIST, load(LIST, []).filter(function (x) { return x.id !== it.id; }));
        barKey = '';
        drawBar();
        openSheet();
      });
      row.appendChild(go); row.appendChild(del);
      sheet.appendChild(row);
    });
    document.body.appendChild(sheet);
  }

  // ---- the app's small windows ----
  window.__waiMini = function (on) {
    st.mini = !!on;
    if (document.documentElement) document.documentElement.classList.toggle('wai-mini', !!on);
    if (on) closeSheet();
  };

  function tick() {
    if (!document.documentElement) return; // (run at a page's very start, before it has any)
    css();
    if (st.mini) document.documentElement.classList.add('wai-mini');
    place();
    drawBar();
  }
  function safe() { try { tick(); } catch (e) { st.err = String(e && e.message || e).slice(0, 120); } } // (in the build's log)
  safe();
  setInterval(safe, 1000);
})();
