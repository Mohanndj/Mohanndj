// v166, the owner: «هل أقدر أضيف تويتر للوعي الشخصي فأغرد فقط بدون قراءة إلا لمن أختارهم فقط؟», and his answers: it opens
// on the box to tweet, with «قائمتي» (a private List of his on Twitter, chosen once and kept in Twitter's own storage on
// the phone); hidden: the home timeline, Explore's trends and the suggestions; kept: notifications, messages, replies,
// search and others' pages, and retweets in his List. Run in Twitter's page inside the app (XPanel), once a page. No
// bridge to the app; no HTML written as text (the page may refuse it: Trusted Types).
(function () {
  // (once a page, and only on Twitter's own: run again later if the page's address is not known yet, as at its start)
  if (window.__waiX && window.__waiX.on) return;
  // (nor before the page has its root: what it adds goes into the page, so it waits for the next run)
  if (!/(^|\.)(x|twitter)\.com$/.test(location.hostname) || !document.documentElement) { window.__waiX = { on: false, host: location.hostname }; return; }
  var st = window.__waiX = { on: true, home: false, explore: false, list: false, hid: 0 };
  // (anything failing on the way: not done, so the next run tries again, and the error is kept for the log)
  try {
  var KEY = 'wai-xlist', KEYH = 'wai-xhandle';
  function mine() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function keep(v) { try { localStorage.setItem(KEY, v); } catch (e) { st.err = 'store'; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function go(path) { location.assign(path); }

  // ---- what is hidden ----
  var css = el('style');
  css.id = 'wai-x-css';
  css.textContent =
    // the home timeline («لك» and «المتابَعون»): our own page in its place
    'html.wai-xhome [data-testid="primaryColumn"]{visibility:hidden!important}'
    // Explore: its tabs and what is trending (the search box above stays)
    + 'html.wai-xexplore [data-testid="primaryColumn"] [role="tablist"],html.wai-xexplore [data-testid="primaryColumn"] section,html.wai-xexplore [data-testid="trend"]{display:none!important}'
    // the suggestions beside or above a page
    + '[data-testid="sidebarColumn"] section,[data-testid="sidebarColumn"] aside,aside[role="complementary"]{display:none!important}'
    + '.wai-x-gone{display:none!important}'
    + '#wai-xhome{position:fixed;inset:0 0 64px 0;z-index:2147483000;background:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;font-family:sans-serif;direction:rtl;text-align:center}'
    + 'html.wai-xhome #wai-xhome{display:flex}'
    + '#wai-xhome b{font-size:20px;color:#0f1419}#wai-xhome p{margin:0;color:#536471;font-size:15px;line-height:1.7;max-width:340px}'
    + '.wai-xbtn{border:0;border-radius:999px;padding:12px 26px;font-size:17px;font-weight:700;background:#0f766e;color:#fff;font-family:inherit}'
    + '.wai-xbtn.ghost{background:#fff;color:#0f766e;border:1.5px solid #0f766e}'
    // (v173) his handle written once, when Twitter shows it nowhere
    + '#wai-xme{display:none;flex-direction:column;align-items:center;gap:8px}#wai-xme.on{display:flex}'
    + '#wai-xme input{direction:ltr;text-align:center;font-size:16px;padding:10px 12px;border:1.5px solid #0f766e;border-radius:12px;width:220px;max-width:80vw;font-family:inherit}'
    + '#wai-xme input::placeholder{direction:rtl}'
    + '#wai-xbar{position:fixed;left:10px;bottom:72px;z-index:2147483001;display:flex;flex-wrap:wrap;gap:8px;max-width:calc(100vw - 84px);direction:rtl;font-family:sans-serif}'
    + '#wai-xbar button{border:0;border-radius:999px;padding:8px 14px;font-size:14px;font-weight:700;background:#0f766e;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);font-family:inherit}'
    + 'html.wai-xhome #wai-xbar,html.wai-xcompose #wai-xbar{display:none}'
    // (his answer: «المطلوب أن أدخل بحساباتي فقط لا من قوقل»: a line above the sign-in pages, and no Google or Apple)
    // (the line on top of the page, and the page itself moved down under it: Twitter's sign-in page covers the screen)
    + '#wai-xsign{display:none;position:fixed;top:0;left:0;right:0;z-index:2147483002;box-sizing:border-box;height:40px;margin:0;padding:0 12px;background:#e6f2f0;color:#0f4f4a;font:600 14px/40px sans-serif;direction:rtl;text-align:center;white-space:nowrap;overflow:hidden}'
    + 'html.wai-xsign #wai-xsign{display:block}'
    + 'html.wai-xsign body>*:not(#wai-xsign):not(script):not(style){transform:translateY(40px)}'
    + 'html.wai-xsign iframe[src*="accounts.google.com"],html.wai-xsign [data-testid="apple_sign_in_button"],html.wai-xsign .jf-gsi-shell{display:none!important}';
  (document.head || document.documentElement).appendChild(css);

  // «من تتابع» and the like inside a timeline: the cell with its «show more» link, and the cells of people above it
  // up to its heading
  function hideSuggestions() {
    var links = document.querySelectorAll('a[href*="/i/connect_people"],a[href*="/i/topics/picker"]');
    for (var i = 0; i < links.length; i++) {
      var cell = links[i].closest('[data-testid="cellInnerDiv"]');
      if (!cell) continue;
      var row = cell, n = 0;
      while (row && n < 12) {
        if (row !== cell && row.querySelector('article,[data-testid="tweet"]')) break; // (a tweet is never hidden)
        if (!row.classList.contains('wai-x-gone')) { row.classList.add('wai-x-gone'); st.hid++; }
        if (row !== cell && row.querySelector('h2,[role="heading"]')) break;
        row = row.previousElementSibling; n++;
      }
    }
  }

  // ---- our home in place of the timeline: «غرّد» and «قائمتي» ----
  var home = el('div'); home.id = 'wai-xhome';
  var homeMsg = el('p');
  function listBtn(cls) {
    var b = el('button', cls, 'قائمتي');
    b.type = 'button';
    b.addEventListener('click', openList);
    return b;
  }
  var tw = el('button', 'wai-xbtn', 'غرّد'); tw.type = 'button';
  tw.addEventListener('click', function () { go('/compose/post'); });
  home.appendChild(el('b', '', 'تويتر'));
  home.appendChild(tw);
  home.appendChild(listBtn('wai-xbtn ghost'));
  home.appendChild(meBtn('wai-xbtn ghost'));
  home.appendChild(homeMsg);
  // (v173) «صفحتي» with no handle known: written here once, kept in Twitter's own storage on the phone
  var meBox = el('div'); meBox.id = 'wai-xme';
  var meIn = el('input'); meIn.type = 'text'; meIn.placeholder = 'اسم حسابك في تويتر'; meIn.autocomplete = 'off'; meIn.setAttribute('autocapitalize', 'off');
  var meOk = el('button', 'wai-xbtn', 'احفظ وافتح صفحتي'); meOk.type = 'button';
  meOk.addEventListener('click', function () {
    var v = (meIn.value || '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{1,15}$/.test(v)) { homeMsg.textContent = 'اكتب اسم حسابك كما في تويتر: حروف إنجليزية وأرقام وشرطة سفلية، بلا @.'; return; }
    keepH(v); meBox.classList.remove('on'); homeMsg.textContent = ''; go('/' + v);
  });
  meBox.appendChild(meIn); meBox.appendChild(meOk);
  home.appendChild(meBox);

  var sign = el('p', '', 'ادخل باسم حسابك في تويتر وكلمة سره.'); sign.id = 'wai-xsign';
  // the buttons to sign in with Google or Apple (Google's own is a frame of its own inside a box): hidden
  function hideOthers() {
    var all = document.querySelectorAll('button,[role="button"],a');
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      if (b.classList.contains('wai-x-gone') || b.closest('#wai-xbar,#wai-xhome')) continue;
      if (/(Google|Apple|جوجل|غوغل|قوقل|آبل|أبل(?!غ))/.test(b.textContent || '') && (b.textContent || '').length < 60) { b.classList.add('wai-x-gone'); st.hid++; }
    }
    // (Twitter draws the Google button itself, in a box of its own around Google's frame: the box, and its row when it
    // holds nothing else)
    var sh = document.querySelectorAll('.jf-gsi-shell');
    for (var k = 0; k < sh.length; k++) {
      var row = sh[k].parentElement;
      var gone = row && row !== document.body && row.children.length === 1 ? row : sh[k];
      if (!gone.classList.contains('wai-x-gone')) { gone.classList.add('wai-x-gone'); st.hid++; }
    }
    var fr = document.querySelectorAll('iframe[src*="accounts.google.com"]');
    for (var j = 0; j < fr.length; j++) {
      var box = fr[j].parentElement; // (its box, never the page itself: the frame alone is hidden by the style)
      if (box && box !== document.body && box !== document.documentElement && !box.classList.contains('wai-x-gone')) { box.classList.add('wai-x-gone'); st.hid++; }
    }
  }

  // the floating bar on the other pages: «غرّد» and «قائمتي» (and on a List's page: «اجعلها قائمتي»)
  var bar = el('div'); bar.id = 'wai-xbar';
  var bTw = el('button', '', 'غرّد'); bTw.type = 'button';
  bTw.addEventListener('click', function () { go('/compose/post'); });
  var bMine = el('button', '', 'اجعلها قائمتي'); bMine.type = 'button';
  bMine.addEventListener('click', function () { keep(location.pathname); st.list = true; draw(); });
  bar.appendChild(bTw); bar.appendChild(listBtn('')); bar.appendChild(meBtn('')); bar.appendChild(bMine);

  // his own handle (for his Lists' page, and «صفحتي»), from the links of his profile Twitter shows; (v173) else from his
  // picture beside the box to tweet (only his own is there), else as he wrote it once; kept once known
  function storedH() { try { return localStorage.getItem(KEYH) || ''; } catch (e) { return ''; } }
  function keepH(v) { try { localStorage.setItem(KEYH, v); } catch (e) { st.err = 'store'; } }
  function handle() {
    var a = document.querySelector('a[data-testid="AppTabBar_Profile_Link"],a[aria-label="Profile"],a[aria-label="الملف الشخصي"]');
    var m = a && /^\/([A-Za-z0-9_]{1,15})$/.exec(a.getAttribute('href') || '');
    // (only on a plain box to tweet: a reply or a quote shows the other person's picture too; and never «unknown»)
    if (!m && /^\/compose\//.test(location.pathname) && !document.querySelector('article,[data-testid="tweet"]')) {
      var av = document.querySelectorAll('[data-testid^="UserAvatar-Container-"]');
      if (av.length === 1) m = /^UserAvatar-Container-([A-Za-z0-9_]{1,15})$/.exec(av[0].getAttribute('data-testid') || '');
      if (m && m[1].toLowerCase() === 'unknown') m = null;
    }
    if (m) { if (storedH() !== m[1]) keepH(m[1]); return m[1]; }
    return storedH();
  }
  function meBtn(cls) {
    var b = el('button', cls, 'صفحتي');
    b.type = 'button';
    b.addEventListener('click', openMe);
    return b;
  }
  function openMe() {
    var h = handle();
    if (h) { go('/' + h); return; }
    try { sessionStorage.setItem('wai-xask', '1'); } catch (e) { st.err = 'store'; } // (kept across the page opened next)
    if (location.pathname === '/home' || location.pathname === '/') draw(); else go('/home');
  }
  function openList() {
    var l = mine();
    if (l) { go(l); return; }
    var h = handle();
    if (h) { go('/' + h + '/lists'); return; }
    homeMsg.textContent = 'لم تختر قائمتك بعد: افتح صفحتك، ثم «القوائم»، ثم قائمتك الخاصة، واضغط «اجعلها قائمتي».';
    go('/home');
  }

  function draw() {
    var p = location.pathname;
    var isHome = p === '/home' || p === '/';
    var isList = /^\/i\/lists\/\d+\/?$/.test(p);
    st.home = isHome; st.explore = /^\/explore/.test(p); st.list = !!mine();
    var h = document.documentElement;
    h.classList.toggle('wai-xhome', isHome);
    h.classList.toggle('wai-xexplore', st.explore);
    var signing = /^\/(i\/flow\/|i\/jf\/|login|signup)/.test(p);
    h.classList.toggle('wai-xcompose', signing || /^\/(compose\/|logout|account\/)/.test(p)); // (no bar over tweeting or signing in)
    h.classList.toggle('wai-xsign', signing);
    if (signing) { if (document.body && document.body.firstChild !== sign) document.body.insertBefore(sign, document.body.firstChild); hideOthers(); }
    bMine.style.display = isList && mine() !== p.replace(/\/$/, '') ? '' : 'none';
    if (isList && mine() === p.replace(/\/$/, '')) homeMsg.textContent = '';
    if (!mine() && !homeMsg.textContent) homeMsg.textContent = 'ضع من تختارهم في قائمة خاصة في حسابك، ثم افتحها واضغط «اجعلها قائمتي».';
    if (mine() && !meBox.classList.contains('on')) homeMsg.textContent = ''; // (not while his name is being asked)
    if (isHome) handle(); // (learnt as it shows)
    else if (/^\/compose\//.test(p)) handle();
    var ask = ''; try { ask = sessionStorage.getItem('wai-xask') || ''; } catch (e) { ask = ''; }
    if (isHome && ask && !storedH() && !meBox.classList.contains('on')) { meBox.classList.add('on'); st.ask = true; homeMsg.textContent = 'لم يظهر لي اسم حسابك: اكتبه مرة واحدة ويُحفظ في جوالك.'; }
    if (!isHome && st.ask) { st.ask = false; try { sessionStorage.removeItem('wai-xask'); } catch (e) { st.err = 'store'; } }
    if (!isHome || storedH()) meBox.classList.remove('on');
    if (document.body && !home.isConnected) document.body.appendChild(home);
    if (document.body && !bar.isConnected) document.body.appendChild(bar);
    if (!css.isConnected) (document.head || document.documentElement).appendChild(css);
    hideSuggestions();
  }
  try { draw(); } catch (e) { st.err = String(e && e.message || e); }
  setInterval(function () { try { draw(); } catch (e) { st.err = String(e && e.message || e); } }, 700);
  } catch (e) { window.__waiX = { on: false, err: String(e && e.message || e) }; }
})();
