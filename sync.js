'use strict';
// Cloud sync through a secret GitHub Gist in the user's own account.
// Three-way merge (last synced copy vs. this device vs. the cloud) keeps changes made on
// different devices; when the same item changed in both places, this device wins.

const Sync = (() => {
  const KEY = 'mahami-sync';
  const FILE = 'mahami.json';
  const DESC = 'Mahami app data — بيانات تطبيق مهامي (لا تعدّل هذا الملف يدوياً)';
  const API = 'https://api.github.com';
  const COLLECTIONS = ['tasks', 'projects', 'memos', 'books', 'benefits', 'sessions', 'inspire'];
  const SETTINGS_KEYS = ['name', 'accent', 'theme', 'size', 'font', 'digits', 'hijri', 'sound', 'prayer', 'readingGoal'];

  let cfg = load();
  let busy = false;
  let timer = null;
  let applying = false;
  let lastError = '';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
  }

  async function gh(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${cfg.token}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (res.status === 401) throw new Error('auth');
    if (res.status === 403 || res.status === 429) throw new Error(res.headers.get('x-ratelimit-remaining') === '0' ? 'ratelimit' : 'forbidden');
    if (res.status === 404) throw new Error('notfound');
    if (!res.ok) throw new Error('http' + res.status);
    return res.status === 204 ? null : res.json();
  }

  // ---------- snapshot and merge ----------
  function snapshot() {
    const out = { v: 1, at: Date.now() };
    for (const c of COLLECTIONS) out[c] = (S[c] || []).filter((x) => !(c === 'inspire' && x.type === 'image'));
    out.settings = {};
    for (const k of SETTINGS_KEYS) if (k in S.settings) out.settings[k] = S.settings[k];
    return JSON.parse(JSON.stringify(out));
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function mergeList(base = [], local = [], remote = []) {
    const B = new Map(base.map((x) => [x.id, x]));
    const L = new Map(local.map((x) => [x.id, x]));
    const R = new Map(remote.map((x) => [x.id, x]));
    const ids = new Set([...L.keys(), ...R.keys(), ...B.keys()]);
    const out = [];
    for (const id of ids) {
      const b = B.get(id), l = L.get(id), r = R.get(id);
      if (l && r) out.push(same(l, b) ? r : l); // edited here wins; otherwise take the cloud's version
      else if (l && !r) { if (!b || !same(l, b)) out.push(l); } // new here, or deleted in cloud but edited here
      else if (!l && r) { if (!b || !same(r, b)) out.push(r); } // new in cloud, or deleted here but edited in cloud
    }
    // keep this device's order, then anything new from the cloud
    const order = new Map(local.map((x, i) => [x.id, i]));
    return out.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  }

  function mergeSettings(base = {}, local = {}, remote = {}) {
    const out = {};
    for (const k of SETTINGS_KEYS) {
      const l = local[k], r = remote[k], b = base[k];
      const v = same(l, b) ? (k in remote ? r : l) : l;
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  function merge(base, local, remote) {
    const out = { v: 1, at: Date.now() };
    for (const c of COLLECTIONS) out[c] = mergeList(base && base[c], local[c], remote[c]);
    out.settings = mergeSettings(base && base.settings, local.settings, remote.settings || {});
    return out;
  }

  function apply(data) {
    applying = true;
    try {
      const norm = { tasks: normalize, projects: normalizeProject, memos: normalizeMemo, books: normalizeBook, benefits: normalizeBenefit, inspire: normalizeInspire };
      for (const c of COLLECTIONS) {
        const list = (data[c] || []).map((x) => (norm[c] ? norm[c](x) : x));
        if (c === 'inspire') S.inspire = [...S.inspire.filter((x) => x.type === 'image'), ...list];
        else S[c] = list;
      }
      Object.assign(S.settings, data.settings || {});
      save();
      applyTheme();
    } finally { applying = false; }
  }

  // ---------- gist ----------
  async function readGist() {
    const g = await gh(`/gists/${cfg.gistId}`);
    const f = g.files && g.files[FILE];
    if (!f) return null;
    let text = f.content;
    if (f.truncated) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
    return text ? JSON.parse(text) : null;
  }
  const writeGist = (data) => gh(`/gists/${cfg.gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(data) } } }) });

  async function findOrCreateGist() {
    for (let page = 1; page <= 5; page++) {
      const list = await gh(`/gists?per_page=100&page=${page}`);
      const hit = list.find((g) => g.files && g.files[FILE] && g.description === DESC);
      if (hit) return { id: hit.id, created: false };
      if (list.length < 100) break;
    }
    const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(snapshot()) } } }) });
    return { id: g.id, created: true };
  }

  // ---------- public ----------
  async function connect(token) {
    cfg = { token: token.trim(), auto: true };
    const user = await gh('/user');
    const { id, created } = await findOrCreateGist();
    cfg.gistId = id;
    cfg.login = user.login;
    store();
    if (created) {
      cfg.base = snapshot();
      cfg.lastSync = Date.now();
      store();
      return 'created';
    }
    await syncNow();
    return 'joined';
  }

  function disconnect() {
    cfg = {};
    try { localStorage.removeItem(KEY); } catch {}
  }

  async function syncNow() {
    if (!cfg.token || !cfg.gistId || busy) return false;
    if (!navigator.onLine) { lastError = 'offline'; refreshStatus(); return false; }
    busy = true;
    refreshStatus();
    try {
      const remote = await readGist();
      const local = snapshot();
      const merged = remote ? merge(cfg.base, local, remote) : local;
      const localChanged = !same(stripTime(merged), stripTime(local));
      if (localChanged) { apply(merged); render(); }
      if (!remote || !same(stripTime(merged), stripTime(remote))) await writeGist(merged);
      cfg.base = merged;
      cfg.lastSync = Date.now();
      lastError = '';
      store();
      return true;
    } catch (e) {
      lastError = e.message || 'error';
      if (lastError === 'auth') toast('رمز GitHub لم يعد صالحاً. أعد الربط من الإعدادات.');
      return false;
    } finally {
      busy = false;
      refreshStatus();
    }
  }
  const stripTime = (d) => { const { at, ...rest } = d || {}; return rest; };

  // called after every local save
  function schedule() {
    if (applying || !cfg.token || !cfg.gistId || cfg.auto === false) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, 4000);
  }

  function statusText() {
    if (!cfg.token) return 'غير مربوطة';
    if (busy) return 'جارٍ المزامنة…';
    const msgs = { offline: 'لا يوجد اتصال بالإنترنت', auth: 'الرمز غير صالح، أعد الربط', ratelimit: 'تجاوزت حد GitHub مؤقتاً، حاول بعد قليل', forbidden: 'الرمز لا يملك صلاحية gist', notfound: 'لم يُعثر على ملف المزامنة، أعد الربط' };
    if (lastError) return msgs[lastError] || 'تعذّرت المزامنة، سنحاول لاحقاً';
    if (cfg.lastSync) return `آخر مزامنة: ${relDate(iso(new Date(cfg.lastSync)))} ${fmtTime(hmOf(new Date(cfg.lastSync).getHours() * 60 + new Date(cfg.lastSync).getMinutes()))}`;
    return 'مربوطة';
  }
  function refreshStatus() {
    const el = document.getElementById('syncStatus');
    if (el) el.textContent = statusText();
  }

  function settingsHTML() {
    if (!cfg.token) {
      return `<section class="panel" id="syncPanel">
        <h2>المزامنة السحابية</h2>
        <p class="note-text">احفظ بياناتك في حسابك على GitHub لتظهر على كل أجهزتك ولا تضيع إذا فقدت الجوال. تُحفظ في ملف سرّي (Secret Gist) داخل حسابك، لا يظهر في صفحتك العامة.</p>
        <details class="howto"><summary>كيف أحصل على الرمز؟</summary>
          <ol>
            <li>افتح <a href="https://github.com/settings/tokens/new?scopes=gist&description=%D9%85%D9%87%D8%A7%D9%85%D9%8A" target="_blank" rel="noopener">صفحة إنشاء رمز في GitHub</a> وسجّل الدخول.</li>
            <li>في <b>Expiration</b> اختر <b>No expiration</b> (أو مدة طويلة).</li>
            <li>تأكد أن خانة <b>gist</b> مختارة، ثم انزل واضغط <b>Generate token</b>.</li>
            <li>انسخ الرمز الذي يبدأ بـ <code>ghp_</code> والصقه هنا.</li>
          </ol>
        </details>
        <label class="field"><span>رمز GitHub</span><input type="password" id="syncToken" autocomplete="off" placeholder="ghp_…" dir="ltr"></label>
        <div class="btn-row"><button type="button" class="primary" data-action="sync-connect">ربط ومزامنة</button></div>
        <p class="note-text">الصور في «الإلهام» لا تُزامَن، تبقى على الجهاز الذي أضفتها منه.</p>
      </section>`;
    }
    return `<section class="panel" id="syncPanel">
      <h2>المزامنة السحابية</h2>
      <p class="note-text">مربوطة بحساب GitHub: <b dir="ltr">${esc(cfg.login || '')}</b></p>
      <p class="note-text" id="syncStatus">${esc(statusText())}</p>
      <label class="switch"><input type="checkbox" id="syncAuto"${cfg.auto !== false ? ' checked' : ''}><span>مزامنة تلقائية بعد كل تعديل</span></label>
      <div class="btn-row">
        <button type="button" class="primary" data-action="sync-now">زامن الآن</button>
        <button type="button" class="danger" data-action="sync-off">إلغاء الربط</button>
      </div>
      <p class="note-text">على جهاز آخر: افتح التطبيق، ثم الإعدادات، والصق نفس الرمز. ستنتقل بياناتك إليه وتُدمج مع ما فيه.</p>
    </section>`;
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action^="sync-"]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'sync-connect') {
      const t = (document.getElementById('syncToken') || {}).value || '';
      if (!/^(ghp_|github_pat_|gho_)\w+/.test(t.trim())) { toast('الصق رمز GitHub الذي يبدأ بـ ghp_'); return; }
      b.disabled = true; b.textContent = 'جارٍ الربط…';
      try {
        const r = await connect(t);
        toast(r === 'created' ? 'رُبطت المزامنة وحُفظت بياناتك في حسابك' : 'رُبطت المزامنة ودُمجت بياناتك');
      } catch (err) {
        disconnect();
        toast(err.message === 'auth' ? 'الرمز غير صحيح. انسخه مرة أخرى.' : err.message === 'forbidden' ? 'الرمز لا يملك صلاحية gist. أنشئ رمزاً جديداً واختر gist.' : 'تعذّر الاتصال بـ GitHub. تحقق من الإنترنت وحاول مجدداً.');
      }
      render();
    }
    if (a === 'sync-now') { const ok = await syncNow(); if (ok) toast('تمت المزامنة'); else if (lastError) toast(statusText()); }
    if (a === 'sync-off') {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'تأكيد: تبقى بياناتك على هذا الجهاز'; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ''; b.textContent = 'إلغاء الربط'; } }, 3500); return; }
      disconnect(); render(); toast('أُلغي الربط. بياناتك ما زالت على هذا الجهاز وفي حسابك.');
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'syncAuto') { cfg.auto = e.target.checked; store(); if (cfg.auto) schedule(); }
  });
  window.addEventListener('online', () => { lastError = ''; schedule(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cfg.token) setTimeout(syncNow, 500); });

  return {
    schedule, syncNow, settingsHTML, connected: () => !!cfg.token,
    start: () => { if (cfg.token) setTimeout(syncNow, 1200); },
    _merge: merge, // exposed for tests
  };
})();
