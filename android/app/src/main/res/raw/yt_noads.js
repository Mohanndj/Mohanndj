// v152, the owner: «أريد أن أضيف شيئا كاليوتيوب يحجب عني الإعلانات». Run in YouTube's page inside the app (YtPanel, v160),
// at each page start and finish (it runs once a page): the ads are taken out of the player's data before it reads them,
// what is left of them on the page is hidden, and a video ad that still starts is skipped (or run to its end, muted)
(function () {
  if (window.__waiAd) return;
  var st = window.__waiAd = { cut: 0, skip: 0 };
  var KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];
  function prune(o) {
    if (!o || typeof o !== 'object') return o;
    var hit = false;
    for (var i = 0; i < KEYS.length; i++) if (Object.prototype.hasOwnProperty.call(o, KEYS[i])) { delete o[KEYS[i]]; hit = true; }
    if (o.playerResponse) prune(o.playerResponse);
    if (Array.isArray(o)) for (var j = 0; j < o.length; j++) if (o[j] && o[j].playerResponse) prune(o[j].playerResponse);
    if (hit) st.cut++;
    return o;
  }
  // the player's data, however it comes: parsed text, a fetched answer, or the page's first one
  var parse = JSON.parse;
  JSON.parse = function () { var r = parse.apply(this, arguments); try { prune(r); } catch (e) {} return r; };
  if (window.Response && Response.prototype.json) {
    var rj = Response.prototype.json;
    Response.prototype.json = function () { return rj.apply(this, arguments).then(function (r) { try { prune(r); } catch (e) {} return r; }); };
  }
  try {
    var first = window.ytInitialPlayerResponse;
    if (first) prune(first);
    else Object.defineProperty(window, 'ytInitialPlayerResponse', { configurable: true, get: function () { return first; }, set: function (v) { first = prune(v); } });
  } catch (e) {}
  // the ads shown in the page (the list, the search, under the video)
  var CSS = 'ytm-promoted-sparkles-web-renderer,ytm-promoted-sparkles-text-search-renderer,ytm-companion-ad-renderer,ytm-companion-slot,'
    + 'ytm-ad-slot-renderer,ad-slot-renderer,ytm-promoted-video-renderer,ytm-display-ad-renderer,ytm-in-feed-ad-layout-renderer,'
    + 'ytm-banner-promo-renderer,ytm-statement-banner-renderer,.ytp-ad-overlay-container,.ytp-ad-module,.ytp-ad-image-overlay,'
    + '#player-ads,.ad-container,.masthead-ad{display:none!important}'
    // (in a rule of their own: a WebView that does not know «:has» drops only this one)
    + 'ytm-rich-item-renderer:has(ytm-ad-slot-renderer),ytm-item-section-renderer:has(ytm-ad-slot-renderer){display:none!important}';
  function css() {
    if (document.getElementById('wai-noads') || !(document.head || document.documentElement)) return;
    var s = document.createElement('style');
    s.id = 'wai-noads';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  css();
  // a video ad that still started: its «تخطٍّ» pressed, or run to its end muted; the video's sound back after it
  var muted = false;
  setInterval(function () {
    css();
    var ad = document.querySelector('.ad-showing, .ad-interrupting');
    var skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot button, .ytp-ad-skip-button-container button');
    if (skip) { skip.click(); st.skip++; }
    // (the ad and the video play in the same player: only while the ad's own marks are shown in it, so the video itself
    // is never run to its end)
    var v = ad && ad.querySelector('video');
    var mark = ad && ad.querySelector('.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-preview-container, .ytp-ad-text, .ytp-ad-badge, .ytp-ad-simple-ad-badge, .ad-simple-attributed-string');
    if (v && mark) {
      if (!v.muted) { v.muted = true; muted = true; }
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.1) { v.currentTime = v.duration; st.skip++; }
    } else if (muted && !ad) { var pv = document.querySelector('video'); if (pv) pv.muted = false; muted = false; }
  }, 400);
})();
