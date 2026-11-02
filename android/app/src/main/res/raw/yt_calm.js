// v153, the owner: «أريد اليوتيوب أن يفتح بصورة لا تجذبني إليه وفي الوقت ذاته لا تعرقل الاستفادة», and his choices
// «أ: اقتراحات الصفحة الأولى»، «ب: المقاطع القصيرة Shorts»، «ج: المقترح تحت الفيديو وبعده». Run in YouTube's page inside
// the app (YoutubeActivity) after yt_noads.js, once a page: the first page is a search box alone (YouTube's own bar
// below, his subscriptions among it, as it was), no Shorts anywhere (a link to one plays it as a plain video), and under a video and after it no
// videos suggested, nor another one started by itself. Searching, watching, channels and subscriptions are untouched.
(function () {
  if (window.__waiCalm) return;
  var st = window.__waiCalm = { home: false, box: false, shorts: 0, next: 0 };
  var CSS =
    // (أ) the first page: its feed and its topics, with a search box of ours in their place
    'html.wai-home ytm-rich-grid-renderer,html.wai-home ytm-section-list-renderer,html.wai-home ytm-feed-filter-chip-bar-renderer,'
    + 'html.wai-home ytm-chip-cloud-renderer,html.wai-home ytm-rich-item-renderer,html.wai-home ytm-rich-section-renderer{display:none!important}'
    + '#wai-home{display:none}html.wai-home:not(.wai-busy) #wai-home{display:block}'
    + '#wai-home{position:fixed;left:16px;right:16px;top:28%;z-index:2147483000;direction:rtl;font:16px/1.6 Roboto,Arial,sans-serif;color:#0f0f0f}'
    + '#wai-home form{display:flex;gap:8px}#wai-home input{flex:1;min-width:0;font-size:17px;padding:12px 16px;border:1px solid #ccc;border-radius:24px;background:#f2f2f2;color:#0f0f0f}'
    + '#wai-home button{font-size:16px;padding:0 18px;border:0;border-radius:24px;background:#0f0f0f;color:#fff}'
        // (ب) Shorts: their button below, and their rows in every page
    + 'ytm-reel-shelf-renderer,ytm-shorts-lockup-view-model,ytm-shorts-lockup-view-model-v2,ytm-reel-item-renderer,'
    + 'ytm-pivot-bar-item-renderer .pivot-shorts,a[href^="/shorts"]{display:none!important}'
    // (ج) under a video and at its end: the videos suggested, and the next one's countdown
    + 'html.wai-watch ytm-video-with-context-renderer,html.wai-watch ytm-compact-video-renderer,html.wai-watch ytm-compact-playlist-renderer,'
    + 'html.wai-watch ytm-compact-radio-renderer,html.wai-watch ytm-lockup-view-model,html.wai-watch ytm-shelf-renderer,'
    + 'html.wai-watch ytm-horizontal-card-list-renderer,html.wai-watch ytm-item-section-renderer[section-identifier="related-items"],'
    + 'html.wai-watch ytm-item-section-renderer[data-content-type="related"],'
    + '.ytp-endscreen-content,.videowall-endscreen,.ytp-ce-element,.ytp-autonav-endscreen,.ytp-autonav-endscreen-countdown-overlay,'
    + '.ytp-upnext,ytm-autonav-bar{display:none!important}';
  // (in rules of their own: a WebView that does not know «:has» drops only these)
  var HAS = ['ytm-pivot-bar-item-renderer:has(.pivot-shorts)', 'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
    'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)', 'ytm-item-section-renderer:has(ytm-reel-shelf-renderer)',
    'html.wai-watch ytm-item-section-renderer:has(ytm-video-with-context-renderer)'];
  function css() {
    if (document.getElementById('wai-calm') || !(document.head || document.documentElement)) return;
    var s = document.createElement('style');
    s.id = 'wai-calm';
    s.textContent = CSS + HAS.map(function (r) { return r + '{display:none!important}'; }).join('');
    (document.head || document.documentElement).appendChild(s);
  }
  function homeBox() {
    if (document.getElementById('wai-home') || !document.body) return;
    var d = document.createElement('div');
    d.id = 'wai-home';
    d.innerHTML = '<form><input type="search" name="q" placeholder="ابحث في يوتيوب" aria-label="ابحث في يوتيوب" autocomplete="off">'
      + '<button type="submit">ابحث</button></form>';
    d.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = d.querySelector('input').value.trim();
      if (q) location.href = '/results?search_query=' + encodeURIComponent(q);
    });
    document.body.appendChild(d);
  }
  // (ج) the next video that starts by itself: YouTube's own switch turned off (once a page), and if it still moves on,
  // back to the video; not in a playlist he opened (it goes on to its next video), and not when he moved himself (a tap,
  // a key, or the phone's back, which reaches the page as «popstate»)
  var ended = 0, endedAt = '', touched = false, autoAt = '';
  document.addEventListener('pointerdown', function () { touched = true; }, true);
  window.addEventListener('popstate', function () { touched = true; });
  document.addEventListener('keydown', function () { touched = true; }, true);
  document.addEventListener('ended', function (e) {
    if (e.target && e.target.tagName === 'VIDEO' && !document.querySelector('.ad-showing')) { ended = Date.now(); endedAt = location.href; touched = false; }
  }, true);
  var searchAt = '';
  function seen(e) { // (shown on the screen, not only kept in the page closed)
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0';
  }
  function tick() {
    if (!document.documentElement) return; // (run at a page's very start, before it has any)
    if (!/(^|\.)youtube\.com$/.test(location.hostname)) return; // (Google's sign-in pages are left as they are)
    css();
    var p = location.pathname;
    // (ب) a Short opened from a link: the same video as a plain one
    var m = /^\/shorts\/([\w-]+)/.exec(p);
    if (m) { st.shorts++; location.replace('/watch?v=' + m[1]); return; }
    var home = p === '/' || p === '';
    st.home = home;
    document.documentElement.classList.toggle('wai-home', home);
    document.documentElement.classList.toggle('wai-watch', p === '/watch');
    if (home) homeBox();
    // (above YouTube's page, so out of the way while a menu or a dialog of its own is seen, and once its own search was
    // opened, until the page changes: its suggestions stay open after its field loses the cursor)
    var box = document.getElementById('wai-home'), ae = document.activeElement;
    if (!home) searchAt = '';
    if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && !(box && box.contains(ae))) searchAt = location.href;
    var busy = searchAt === location.href
      || [].some.call(document.querySelectorAll('[role="dialog"], ytm-bottom-sheet-renderer, bottom-sheet-container'), seen);
    document.documentElement.classList.toggle('wai-busy', busy);
    // (for the build's check: the box is the thing seen in its middle)
    if (box && home && !busy) { var r = box.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); st.box = !!at && box.contains(at); }
    var auto = document.querySelector('.ytm-autonav-toggle-button-container[aria-pressed="true"], button.ytp-autonav-toggle-button[aria-checked="true"], .ytp-autonav-toggle-button[aria-checked="true"]');
    if (auto && autoAt !== location.href) { autoAt = location.href; auto.click(); st.next++; }
    if (ended && location.href !== endedAt) {
      var moved = !touched && Date.now() - ended < 30000 && p === '/watch' && !/[?&]list=/.test(endedAt + location.search);
      ended = 0;
      if (moved) { st.next++; history.back(); }
    }
  }
  function safe() { try { tick(); } catch (e) {} }
  safe();
  setInterval(safe, 400);
})();
