import { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import "./AdminApp.css";
import { api, login, logout, uploadMedia, mediaSrc, listBooks, addBook, deleteBook, backupJson, siteName } from "./backend";
import { articleCard } from "../og";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const ar = (v) => String(v).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);

/* ---------- Auth context ---------- */
const AuthCtx = createContext({ me: null, ready: false });

function AuthProvider({ children }) {
  const [state, setState] = useState({ me: null, ready: false });
  useEffect(() => {
    (async () => {
      try {
        const me = await api("/auth/me");
        setState({ me, ready: true });
      } catch (e) {
        setState({ me: null, ready: true, error: e.status === 401 ? "" : e.message });
      }
    })();
  }, []);
  return <AuthCtx.Provider value={{ ...state, refresh: () => setState((s) => ({ ...s })) }}>{children}</AuthCtx.Provider>;
}

function useAuth() { return useContext(AuthCtx); }

function Protected({ children }) {
  const { me, ready } = useAuth();
  if (!ready) return <div className="admin-shell"><div style={{ padding: 40 }}>…</div></div>;
  if (!me) return <Navigate to="/admin/login" replace/>;
  return children;
}

/* ============================================================
   Login
   ============================================================ */
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { error } = useAuth();
  const [err, setErr] = useState(error || "");
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await login(email, password);
      window.location.href = "/admin";
    } catch (e) { setErr(e.message || "تعذّر الدخول."); }
    finally { setBusy(false); }
  }
  return (
    <div className="admin-shell">
      <div className="admin-login">
        <form className="admin-login-card" onSubmit={submit} data-testid="admin-login">
          <h1>لوحة التحكم</h1>
          <p className="hint">الدخول لصاحب المدونة فقط.</p>
          <label htmlFor="e">البريد الإلكتروني</label>
          <input id="e" className="admin-input" type="email" required autoFocus dir="ltr" autoComplete="username"
                 value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email"/>
          <label htmlFor="p">كلمة السرّ</label>
          <input id="p" className="admin-input" type="password" required autoComplete="current-password"
                 value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password"/>
          <div style={{ marginTop: 22 }}>
            <button className="admin-btn" type="submit" disabled={busy} data-testid="login-submit">
              {busy ? "…" : "دخول"}
            </button>
          </div>
          {err && <div className="admin-error" data-testid="login-error">{err}</div>}
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Sidebar layout
   ============================================================ */
function Sidebar() {
  const loc = useLocation();
  const nav = useNavigate();
  const { me } = useAuth();
  const role = me?.role || "viewer";
  const allItems = [
    { to: "/admin", label: "لوحة القيادة", exact: true },
    { to: "/admin/articles", label: "المقالات" },
    { to: "/admin/pages", label: "الصفحات" },
    { to: "/admin/categories", label: "التصنيفات" },
    { to: "/admin/series", label: "السلاسل" },
    { to: "/admin/books", label: "الكتب" },
    { to: "/admin/stats", label: "الإحصاءات" },
    { to: "/admin/feedback", label: "الملاحظات" },
    { to: "/admin/newsletter", label: "النشرة", ownerOnly: true },
    { to: "/admin/users", label: "الأعضاء", ownerOnly: true, accounts: true },
    { to: "/admin/settings", label: "الإعدادات", ownerOnly: true },
    { to: "/admin/password", label: "كلمة السرّ", accounts: true },
  ];
  const items = allItems.filter((it) => (!it.ownerOnly || role === "owner") && (!it.accounts || me?.accounts));
  const roleLabel = role === "owner" ? "المالك" : role === "editor" ? "محرّر" : "قارئ";
  const on = (it) => it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
  const signOut = async () => {
    await logout();
    nav("/admin/login", { replace: true });
  };
  return (
    <aside className="admin-sidebar">
      <h2 className="brand">لوحة التحكم</h2>
      <nav>
        {items.map((it) => (
          <Link key={it.to} to={it.to} className={on(it) ? "on" : ""} data-testid={`side-${it.to.replace("/admin","home") || "home"}`}>{it.label}</Link>
        ))}
      </nav>
      <div className="foot">
        <div>{me?.email}</div>
        <div className="admin-badge" data-testid="side-role">{roleLabel}</div>
        <button className="admin-btn ghost small" style={{ marginTop: 10 }} onClick={signOut} data-testid="side-logout">خروج</button>
        <div style={{ marginTop: 10 }}><Link to="/" style={{ color: "inherit" }}>← الموقع العام</Link></div>
      </div>
    </aside>
  );
}

function Shell({ children }) {
  return (
    <div className="admin-shell">
      <div className="admin-layout">
        <Sidebar/>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

/* ============================================================
   Dashboard home
   ============================================================ */
function Dashboard() {
  const [stats, setStats] = useState({ articles: 0, published: 0, drafts: 0 });
  useEffect(() => {
    (async () => {
      try {
        const all = (await api("/admin/articles")).articles;
        setStats({
          articles: all.length,
          drafts: all.filter((a) => a.status === "draft").length,
          published: all.filter((a) => a.status === "published").length,
        });
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <>
      <h1 className="admin-title">مرحبًا</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
        {[
          { label: "المقالات", v: stats.articles, to: "/admin/articles" },
          { label: "منشورة", v: stats.published, to: "/admin/articles?status=published" },
          { label: "مسوّدات", v: stats.drafts, to: "/admin/articles?status=draft" },
        ].map((s, i) => (
          <Link to={s.to} key={i} style={{ display: "block", padding: 20, border: "1px solid var(--line)", background: "var(--shade)", color: "inherit" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.label}</div>
            <div style={{ fontSize: 28, fontFamily: '"Majalla", Amiri, serif', fontWeight: 700, marginTop: 8 }}>{ar(s.v)}</div>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Link to="/admin/articles/new" className="admin-btn" data-testid="dash-new-article">مقالة جديدة</Link>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>كل حفظ يظهر على الموقع خلال دقيقة تقريبًا.</span>
      </div>
    </>
  );
}

/* ============================================================
   Articles list
   ============================================================ */
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const dt = new Intl.DateTimeFormat("ar-SA", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh" }).format(d);
    return dt;
  } catch { return iso; }
}

function ArticlesList() {
  const { me } = useAuth();
  const isOwner = me?.role === "owner";
  const canWrite = isOwner || me?.role === "editor";
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get("status") || "");
  const [q, setQ] = useState("");
  const load = async () => setItems((await api("/admin/articles" + (status ? `?status=${status}` : ""))).articles);
  useEffect(() => { load(); }, [status]);
  const filtered = useMemo(() => {
    if (!items) return null;
    const qq = q.trim();
    return qq ? items.filter((a) => (a.title || "").includes(qq) || (a.slug || "").includes(qq)) : items;
  }, [items, q]);
  const del = async (a) => {
    if (!window.confirm(`حذف «${a.title}» نهائيًا؟`)) return;
    try { await api(`/admin/articles/${a.id}`, { method: "DELETE" }); await load(); } catch (e) { alert(e.message); }
  };
  const dup = async (a) => { try { await api(`/admin/articles/${a.id}/duplicate`, { method: "POST" }); await load(); } catch (e) { alert(e.message); } };
  const togglePin = async (a) => {
    try {
      await api(`/admin/articles/${a.id}/${a.pinned ? "unpin" : "pin"}`, { method: "POST" });
      await load();
    } catch (e) { alert(e.message); }
  };
  return (
    <>
      <div className="admin-toolbar">
        <h1 className="admin-title" style={{ margin: 0 }}>المقالات</h1>
        <div className="grow"/>
        <input className="admin-input" placeholder="بحث" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} data-testid="articles-search"/>
        <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 160 }} data-testid="articles-filter-status">
          <option value="">كلّ الحالات</option>
          <option value="published">منشورة</option>
          <option value="draft">مسودة</option>
        </select>
        <Link to="/admin/articles/new" className="admin-btn" data-testid="articles-new" style={{ display: canWrite ? undefined : "none" }}>جديدة</Link>
      </div>
      {filtered == null ? (
        <div className="admin-empty">جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty" data-testid="articles-empty">لا مقالات.</div>
      ) : (
        <table className="admin-table" data-testid="articles-table">
          <thead>
            <tr><th>العنوان</th><th>التصنيف</th><th>الحالة</th><th>التاريخ</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} data-testid={`article-row-${a.id}`}>
                <td>
                  <Link to={`/admin/articles/${a.id}`} style={{ color: "inherit" }}>{a.title}</Link>
                  {a.pinned && <span className="pin-star" title="مثبّتة">★</span>}
                </td>
                <td>{a.category || "—"}</td>
                <td>
                  <span className={`status-pill ${a.status}`}>
                    {a.status === "published" ? "منشورة" : a.status === "scheduled" ? "مجدولة" : "مسوّدة"}
                  </span>
                  {a.status === "scheduled" && a.scheduled_at && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{fmtDate(a.scheduled_at)}</div>
                  )}
                </td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{a.date || fmtDate(a.published_at)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {isOwner && (
                    <>
                      <button className="admin-btn ghost small" onClick={() => togglePin(a)} data-testid={`pin-${a.id}`}>{a.pinned ? "إلغاء التثبيت" : "تثبيت"}</button>
                      {" "}
                    </>
                  )}
                  {canWrite && (
                    <>
                      <button className="admin-btn ghost small" onClick={() => dup(a)}>تكرار</button>
                      {" "}
                    </>
                  )}
                  {isOwner && (
                    <button className="admin-btn danger small" onClick={() => del(a)}>حذف</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ============================================================
   Article editor
   ============================================================ */
const BLOCK_TYPES = [
  { v: "p", label: "فقرة" },
  { v: "h", label: "عنوان" },
  { v: "hr", label: "فاصل" },
];

const ALIGN_OPTIONS = [
  { v: "", label: "افتراضي" },
  { v: "right", label: "يمين" },
  { v: "left", label: "يسار" },
  { v: "center", label: "وسط" },
  { v: "justify", label: "ضبط" },
];

const COLOR_OPTIONS = [
  { v: "", label: "افتراضي", swatch: "var(--ink)" },
  { v: "gold", label: "ذهبي", swatch: "#a88e35" },
  { v: "lapis", label: "لازوردي", swatch: "#254a7a" },
  { v: "green", label: "أخضر", swatch: "#3e6f4a" },
  { v: "red", label: "قرمزي", swatch: "#a44444" },
  { v: "muted", label: "خفيف", swatch: "#8b8577" },
];

const SIZE_OPTIONS = [
  { v: "", label: "افتراضي" },
  { v: "sm", label: "أصغر" },
  { v: "lg", label: "أكبر" },
  { v: "xl", label: "كبير جدًا" },
  { v: "xxl", label: "ضخم" },
];

/* Normalize a body block (string legacy or object) to {text,type,align,color,size}. */
function readBlock(b) {
  if (typeof b === "string") {
    if (b === "---") return { text: "", type: "hr", align: "", color: "", size: "" };
    const isH = b.startsWith("#");
    return { text: isH ? b.slice(1) : b, type: isH ? "h" : "p", align: "", color: "", size: "" };
  }
  return {
    text: b?.text || "",
    type: b?.type || "p",
    align: b?.align || "",
    color: b?.color || "",
    size: b?.size || "",
  };
}
/* Serialise back — keep legacy string form when there is no formatting. */
function writeBlock(o) {
  if (o.type === "hr") return { type: "hr", text: "" };
  if (!o.align && !o.color && !o.size) {
    return o.type === "h" ? "#" + (o.text || "") : (o.text || "");
  }
  return { text: o.text || "", type: o.type || "p", align: o.align || "", color: o.color || "", size: o.size || "" };
}

function emptyArticle() {
  return {
    id: null, slug: "", title: "", category: "", series: "", part: null,
    date: "", excerpt: "", show_excerpt: null, cover: "",
    body: [""], notes: {},
    status: "draft", scheduled_at: "",
    seo_title: "", seo_description: "", pinned: false,
    audio_url: "", show_audio: false,
    youtube_url: "", show_youtube: false,
    references: [], show_references: false,
  };
}

/* فهرس المقالة: كل عنوان يشير إلى فقرة من الجسد */
function TocEditor({ doc, patch }) {
  const toc = Array.isArray(doc.toc) ? doc.toc : [];
  const blocks = (doc.body || []).map((b, i) => {
    const o = readBlock(b);
    return { i, hr: o.type === "hr", label: `${ar(i + 1)} — ${(o.text || "").replace(/\*\*|~\{[a-z]+:|\}~|⟨\d+⟩/g, "").trim().slice(0, 70) || "(فارغة)"}` };
  }).filter((x) => !x.hr);
  const set = (next) => patch({ toc: [...next].sort((a, b) => a.at - b.at) });
  const upd = (k, part) => set(toc.map((x, idx) => (idx === k ? { ...x, ...part } : x)));
  const add = () => {
    const used = new Set(toc.map((x) => x.at));
    const free = blocks.find((b) => !used.has(b.i));
    if (free) set([...toc, { at: free.i, title: "" }]);
  };
  return (
    <div className="field" data-testid="toc-editor">
      <label>فهرس المقالة</label>
      <div className="hint" style={{ marginBottom: 8 }}>عناوين تصوغها لأقسام المقالة، يشير كلٌّ منها إلى الفقرة التي يبدأ عندها القسم. يظهر الفهرس إذا كان فيه عنوانان فأكثر.</div>
      {toc.map((x, k) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr) auto", gap: 6, marginBottom: 6 }}>
          <select className="admin-input" value={x.at} onChange={(e) => upd(k, { at: Number(e.target.value) })} data-testid={`toc-at-${k}`}>
            {blocks.map((b) => <option key={b.i} value={b.i}>{b.label}</option>)}
          </select>
          <input className="admin-input" value={x.title} placeholder="عنوان القسم" onChange={(e) => upd(k, { title: e.target.value })} data-testid={`toc-title-${k}`}/>
          <button type="button" className="admin-btn danger small" onClick={() => set(toc.filter((_, idx) => idx !== k))}>حذف</button>
        </div>
      ))}
      <button type="button" className="admin-btn ghost small" onClick={add} data-testid="toc-add">+ عنوان</button>
    </div>
  );
}

function ArticleEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const isOwner = me?.role === "owner";
  const isNew = id === "new";
  const [doc, setDoc] = useState(isNew ? emptyArticle() : null);
  const [cats, setCats] = useState([]);
  const [ser, setSer] = useState([]);
  const [saving, setSaving] = useState("idle"); // idle | saving | saved | err
  const [showConfirmDel, setShowConfirmDel] = useState(false);
  const timerRef = useRef(null);
  const dirtyRef = useRef(false);
  const blockRefs = useRef({}); // idx -> textarea DOM
  const lastFocusedRef = useRef(0);

  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([api("/admin/categories"), api("/admin/series")]);
      setCats(cRes.categories); setSer(sRes.series);
      if (!isNew) {
        try { setDoc(await api(`/admin/articles/${id}`)); }
        catch (e) { alert("تعذّر التحميل: " + e.message); nav("/admin/articles"); }
      } else {
        // For new articles, inherit show_excerpt default from site settings
        try {
          const settings = await api("/admin/settings");
          if (typeof settings.show_excerpt_default === "boolean") {
            setDoc((d) => d ? { ...d, show_excerpt: settings.show_excerpt_default } : d);
          }
        } catch { /* ignore */ }
      }
    })();
  }, [id, isNew, nav]);

  useEffect(() => {
    if (!doc || isNew) return;
    // autosave every 20s if dirty
    const t = setInterval(() => { if (dirtyRef.current) save(false); }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, isNew]);

  const patch = (p) => { setDoc((d) => ({ ...d, ...p })); dirtyRef.current = true; };
  const setBlock = (i, v) => patch({ body: doc.body.map((b, idx) => idx === i ? v : b) });
  const setBlockObj = (i, part) => {
    const cur = readBlock(doc.body[i]);
    const next = { ...cur, ...part };
    setBlock(i, writeBlock(next));
  };
  const insertBlock = (i, type = "p") => patch({
    body: [...doc.body.slice(0, i + 1), writeBlock({ text: "", type, align: "", color: "" }), ...doc.body.slice(i + 1)]
  });
  const removeBlock = (i) => patch({ body: doc.body.filter((_, idx) => idx !== i) });
  const moveBlock = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= doc.body.length) return;
    const nb = [...doc.body];
    [nb[i], nb[j]] = [nb[j], nb[i]];
    patch({ body: nb });
  };

  // Insert `snippet` at the cursor position of block `i` (or append).
  const insertAtCursor = (i, snippet) => {
    const ta = blockRefs.current[i];
    const cur = readBlock(doc.body[i]);
    const currentText = cur.text || "";
    let start = currentText.length, end = currentText.length;
    if (ta && document.activeElement === ta) {
      start = ta.selectionStart ?? currentText.length;
      end = ta.selectionEnd ?? start;
    }
    const next = currentText.slice(0, start) + snippet + currentText.slice(end);
    setBlockObj(i, { text: next });
    setTimeout(() => {
      const t = blockRefs.current[i];
      if (t) {
        const pos = start + snippet.length;
        t.focus();
        t.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  // Featured image upload (two independent slots: inside & outside)
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCoverOut, setUploadingCoverOut] = useState(false);
  const uploadImage = async (file, target) => {
    if (!file) return;
    const setBusy = target === "cover_outside" ? setUploadingCoverOut : setUploadingCover;
    setBusy(true);
    try {
      const data = await uploadMedia(file, "image");
      patch({ [target]: data.url });
    } catch (e) { alert(e.message || "تعذّر رفع الصورة."); }
    finally { setBusy(false); }
  };
  const uploadCover = (f) => uploadImage(f, "cover");
  const uploadCoverOutside = (f) => uploadImage(f, "cover_outside");

  // Audio narration upload
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const uploadAudio = async (file) => {
    if (!file) return;
    setUploadingAudio(true);
    try {
      const data = await uploadMedia(file, "audio");
      patch({ audio_url: data.url, show_audio: true });
    } catch (e) { alert(e.message || "خطأ."); }
    finally { setUploadingAudio(false); }
  };

  // References helpers
  const addRef = () => patch({ references: [...(doc.references || []), { title: "", url: "", kind: "web" }] });
  const updateRef = (i, field, v) => {
    const arr = [...(doc.references || [])];
    arr[i] = { ...arr[i], [field]: v };
    patch({ references: arr });
  };
  const removeRef = (i) => patch({ references: (doc.references || []).filter((_, idx) => idx !== i) });
  const moveRef = (i, dir) => {
    const arr = [...(doc.references || [])];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    patch({ references: arr });
  };

  // Footnote helpers
  const nextNoteKey = () => {
    const keys = Object.keys(doc.notes || {}).map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
    return keys.length ? Math.max(...keys) + 1 : 1;
  };
  const addNote = () => {
    const k = nextNoteKey();
    patch({ notes: { ...(doc.notes || {}), [k]: { kind: "تعليق", text: "" } } });
  };
  const updateNote = (k, field, v) => {
    const nn = { ...(doc.notes || {}) };
    nn[k] = { ...(nn[k] || { kind: "تعليق", text: "" }), [field]: v };
    patch({ notes: nn });
  };
  const removeNote = (k) => {
    const nn = { ...(doc.notes || {}) };
    delete nn[k];
    patch({ notes: nn });
  };
  const insertNoteMarker = (k) => {
    const target = lastFocusedRef.current ?? 0;
    insertAtCursor(target, `⟨${k}⟩`);
  };
  const insertVerseTemplate = (i) => {
    insertAtCursor(i, "﴿ نص الآية ﴾ [السورة: الآية]");
  };

  // Wrap the currently selected text (or 'نص' placeholder) with `prefix`/`suffix`.
  const wrapSelection = (i, prefix, suffix) => {
    const ta = blockRefs.current[i];
    if (!ta) return;
    const cur = readBlock(doc.body[i]);
    const text = cur.text || "";
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const hasSel = end > start;
    const selected = hasSel ? text.slice(start, end) : "نص";
    const next = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    setBlockObj(i, { text: next });
    setTimeout(() => {
      const t = blockRefs.current[i];
      if (t) {
        t.focus();
        const newStart = start + prefix.length;
        const newEnd = newStart + selected.length;
        t.setSelectionRange(newStart, newEnd);
      }
    }, 0);
  };

  async function save(nav_after) {
    if (!doc) return;
    if (!doc.title.trim()) { alert("العنوان مطلوب."); return; }
    setSaving("saving");
    try {
      const body = { ...doc };
      // صورة المشاركة: تُرسم من جديد إذا تغيّر العنوان أو الغلاف أو التصنيف
      if (body.status === "published") {
        const cover = body.cover_outside || body.cover || "";
        const key = [body.title, cover, body.category].join("|");
        if (body.og_key !== key) {
          try {
            const plain = String(body.title).replace(/\*\*/g, "").replace(/~\{[a-z]+:/g, "").replace(/\}~/g, "");
            const blob = await articleCard({ title: plain, category: body.category, cover: mediaSrc(cover), site: await siteName(), host: "www.mohanndjazi.com" });
            const { url } = await uploadMedia(new File([blob], "og.jpg", { type: "image/jpeg" }), "image");
            body.og_image = url; body.og_key = key;
          } catch { /* تبقى صورة الغلاف بديلًا */ }
        }
      }
      let saved;
      if (isNew || !doc.id) {
        saved = await api("/admin/articles", { method: "POST", body: JSON.stringify(body) });
        dirtyRef.current = false;
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 1500);
        if (nav_after) nav("/admin/articles"); else nav(`/admin/articles/${saved.id}`, { replace: true });
        setDoc(saved);
      } else {
        saved = await api(`/admin/articles/${doc.id}`, { method: "PUT", body: JSON.stringify(body) });
        setDoc(saved);
        dirtyRef.current = false;
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 1500);
        if (nav_after) nav("/admin/articles");
      }
    } catch (e) {
      setSaving("err");
      alert("تعذّر الحفظ: " + e.message);
    }
  }

  const del = async () => {
    try { await api(`/admin/articles/${doc.id}`, { method: "DELETE" }); nav("/admin/articles"); }
    catch (e) { alert(e.message); }
  };

  if (!doc) return <div className="admin-empty">جاري التحميل…</div>;

  const excLen = (doc.excerpt || "").length;
  const excOver = excLen > 300;
  const previewHref = doc.slug && doc.status === "published" ? `/articles/${encodeURIComponent(doc.slug)}` : null;

  return (
    <>
      <div className="admin-toolbar">
        <h1 className="admin-title" style={{ margin: 0 }}>{isNew ? "مقالة جديدة" : "تحرير المقالة"}</h1>
        <span className={`autosave-status ${saving}`} data-testid="autosave-status">
          {saving === "saving" ? "جاري الحفظ…" : saving === "saved" ? "حُفظت — تظهر على الموقع خلال دقيقة" : saving === "err" ? "خطأ في الحفظ" : ""}
        </span>
        <div className="grow"/>
        {!isNew && previewHref && (
          <a className="admin-btn ghost" href={previewHref} target="_blank" rel="noopener noreferrer" data-testid="editor-preview">معاينة</a>
        )}
        <button className="admin-btn ghost" onClick={() => nav("/admin/articles")}>إلغاء</button>
        <button className="admin-btn" onClick={() => save(false)} data-testid="editor-save">حفظ</button>
      </div>

      <div className="article-form">
        <div>
          <div className="field">
            <label>الصورة البارزة</label>
            {doc.cover ? (
              <div className="cover-preview">
                <img src={mediaSrc(doc.cover)} alt="غلاف" data-testid="cover-preview"/>
                <div className="cover-actions">
                  <button type="button" className="admin-btn ghost small" onClick={() => patch({ cover: "" })}>إزالة</button>
                  <label className="admin-btn ghost small" style={{ cursor: "pointer" }}>
                    استبدال
                    <input type="file" accept="image/*" style={{ display: "none" }}
                           onChange={(e) => uploadCover(e.target.files?.[0])} data-testid="cover-replace"/>
                  </label>
                </div>
              </div>
            ) : (
              <label className="cover-uploader" data-testid="cover-uploader">
                <input type="file" accept="image/*" style={{ display: "none" }}
                       onChange={(e) => uploadCover(e.target.files?.[0])} data-testid="cover-file"/>
                <span>{uploadingCover ? "جاري الرفع…" : "اضغط لاختيار صورة (تُضغط تلقائيًا)"}</span>
              </label>
            )}
          </div>

          <div className="field">
            <label>العنوان</label>
            <input className="admin-input" value={doc.title} onChange={(e) => patch({ title: e.target.value })} data-testid="editor-title"/>
          </div>
          <div className="field">
            <label>الاختصار (slug)</label>
            <input className="admin-input" dir="ltr" value={doc.slug || ""} onChange={(e) => patch({ slug: e.target.value })} placeholder="سيُولّد تلقائيًا من العنوان" data-testid="editor-slug"/>
          </div>

          <div className="field">
            <label>المقتطف (٣٠٠ حرف)</label>
            <textarea className="admin-input" rows={3} maxLength={400}
                      value={doc.excerpt || ""} onChange={(e) => patch({ excerpt: e.target.value })}
                      data-testid="editor-excerpt"/>
            <div className={`excerpt-counter ${excOver ? "over" : ""}`}>{ar(excLen)} / ٣٠٠</div>
          </div>
          <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox"
                   checked={doc.show_excerpt !== false}
                   onChange={(e) => patch({ show_excerpt: e.target.checked })}
                   data-testid="editor-show-excerpt"/>
            <span>إظهار المقتطف في القوائم</span>
          </label>

          <div className="field">
            <label>الجسد (فقرات وعناوين)</label>
            <div className="body-blocks">
              {doc.body.map((raw, i) => {
                const b = readBlock(raw);
                return (
                  <div className="block-row" key={i}>
                    <div className="block-head">
                      <select value={b.type} onChange={(e) => setBlockObj(i, { type: e.target.value })}>
                        {BLOCK_TYPES.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                      </select>
                      <select value={b.align} onChange={(e) => setBlockObj(i, { align: e.target.value })} title="محاذاة" data-testid={`block-align-${i}`}>
                        {ALIGN_OPTIONS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                      </select>
                      <select value={b.color} onChange={(e) => setBlockObj(i, { color: e.target.value })} title="لون الخط" data-testid={`block-color-${i}`}>
                        {COLOR_OPTIONS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                      </select>
                      <select value={b.size} onChange={(e) => setBlockObj(i, { size: e.target.value })} title="حجم الخط" data-testid={`block-size-${i}`}>
                        {SIZE_OPTIONS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                      </select>
                      <div className="insert-bar">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "**", "**")} title="غامق" data-testid={`fmt-bold-${i}`}><b>غ</b></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "*", "*")} title="مائل" data-testid={`fmt-italic-${i}`}><i>م</i></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~", "~")} title="تسطير" data-testid={`fmt-underline-${i}`}><u>ت</u></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{gold:", "}~")} title="ذهبي" style={{ color: "#a88e35" }} data-testid={`fmt-color-gold-${i}`}>●</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{lapis:", "}~")} title="لازوردي" style={{ color: "#254a7a" }} data-testid={`fmt-color-lapis-${i}`}>●</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{green:", "}~")} title="أخضر" style={{ color: "#3e6f4a" }} data-testid={`fmt-color-green-${i}`}>●</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{red:", "}~")} title="قرمزي" style={{ color: "#a44444" }} data-testid={`fmt-color-red-${i}`}>●</button>
                        <button type="button" onClick={() => insertVerseTemplate(i)} title="إدراج قالب آية">﴿آية﴾</button>
                        <button type="button" onClick={() => { lastFocusedRef.current = i; addNote(); }} title="أضف حاشية جديدة">+ حاشية</button>
                      </div>
                    </div>
                    {b.type === "hr" ? (
                      <div className="block-hr-preview" data-testid={`editor-block-${i}`}>
                        <hr style={{ border: 0, borderTop: "2px solid var(--ink)", margin: "18px 0", maxWidth: 200 }}/>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>فاصلٌ سيظهر للقارئ كخطٍّ أفقيٍّ داكن.</span>
                      </div>
                    ) : (
                      <textarea className={`admin-input block-textarea color-${b.color || "default"} size-${b.size || "default"}`}
                                style={{ textAlign: b.align || undefined, textAlignLast: b.align === "justify" ? "right" : undefined }}
                                rows={b.type === "h" ? 1 : 5}
                                ref={(el) => { blockRefs.current[i] = el; }}
                                value={b.text}
                                onFocus={() => { lastFocusedRef.current = i; }}
                                onChange={(e) => setBlockObj(i, { text: e.target.value })}
                                data-testid={`editor-block-${i}`}/>
                    )}
                    <div className="block-actions">
                      <button type="button" className="icon-only" onClick={() => moveBlock(i, -1)} title="لأعلى">↑</button>
                      <button type="button" className="icon-only" onClick={() => moveBlock(i, 1)} title="لأسفل">↓</button>
                      <button type="button" className="icon-only" onClick={() => insertBlock(i, "p")} title="+ فقرة">+ف</button>
                      <button type="button" className="icon-only" onClick={() => insertBlock(i, "h")} title="+ عنوان">+ع</button>
                      <button type="button" className="icon-only" onClick={() => removeBlock(i)} title="حذف">×</button>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="admin-btn ghost small" onClick={() => insertBlock(doc.body.length - 1, "p")}>+ فقرة جديدة</button>
            </div>

            <TocEditor doc={doc} patch={patch}/>

            {/* Footnotes editor */}
            <div className="footnotes-editor" data-testid="footnotes-editor">
              <h4>الحواشي</h4>
              <p className="fn-hint">
                كل حاشية تُدرج في المتن بعلامة <code>⟨رقم⟩</code>. مثال: <code>الآيةُ ⟨1⟩ لها تفسير</code>.
                اختَر نوع الحاشية (تعليق / تخريج / إحالة) واكتب نصّها، ثم اضغط «أدرج» ليُوضع الرقم عند مؤشر الكتابة في آخر كتلة استخدمتَها.
              </p>
              {Object.keys(doc.notes || {}).length === 0 && (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>لا حواشي بعد — اضغط «+ حاشية» من أي كتلة أعلاه لإضافتها.</p>
              )}
              {Object.entries(doc.notes || {})
                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
                .map(([k, n]) => (
                  <div className="fn-row" key={k} data-testid={`fn-row-${k}`}>
                    <div className="fn-num">⟨{ar(k)}⟩</div>
                    <select value={n.kind || "تعليق"} onChange={(e) => updateNote(k, "kind", e.target.value)}>
                      <option value="تعليق">تعليق</option>
                      <option value="تخريج">تخريج</option>
                      <option value="إحالة">إحالة</option>
                    </select>
                    <textarea value={n.text || ""} onChange={(e) => updateNote(k, "text", e.target.value)}
                              placeholder="نصّ الحاشية…" data-testid={`fn-text-${k}`}/>
                    <div className="fn-actions">
                      <button type="button" onClick={() => insertNoteMarker(k)} title="أدرج ⟨رقم⟩ في آخر كتلة نشطة">أدرج ⟨{ar(k)}⟩</button>
                      <button type="button" className="danger" onClick={() => removeNote(k)}>حذف</button>
                    </div>
                  </div>
                ))}
              <button type="button" className="admin-btn ghost small" onClick={addNote} data-testid="fn-add">+ حاشية جديدة</button>
            </div>

            {/* Audio / YouTube / References extras */}
            <div className="extras-editor" data-testid="extras-editor">
              <h4>الصوتيات ومقاطع الفيديو والمراجع</h4>

              {/* Audio */}
              <div className="extra-panel" data-testid="panel-audio">
                <div className="extra-head">
                  <label className="switch">
                    <input type="checkbox" checked={!!doc.show_audio}
                           onChange={(e) => patch({ show_audio: e.target.checked })}
                           data-testid="toggle-audio"/>
                    <span>إظهار مشغّل الصوت أعلى المقالة</span>
                  </label>
                </div>
                <div className="extra-body">
                  <input type="file" accept="audio/*" onChange={(e) => uploadAudio(e.target.files?.[0])}
                         disabled={uploadingAudio} data-testid="audio-file"/>
                  {uploadingAudio && <span className="hint" style={{ marginRight: 8 }}>جاري الرفع…</span>}
                  {doc.audio_url && (
                    <div style={{ marginTop: 8 }}>
                      <audio controls src={mediaSrc(doc.audio_url)} style={{ width: "100%" }}/>
                      <div className="hint" style={{ marginTop: 4 }}>
                        <button type="button" className="admin-btn ghost small" onClick={() => patch({ audio_url: "", show_audio: false })} data-testid="audio-clear">إزالة الملفّ</button>
                      </div>
                    </div>
                  )}
                  {!doc.audio_url && <div className="hint" style={{ marginTop: 6 }}>ارفع ملفًّا صوتيًّا (MP3/M4A) حتى ٢٥ ميغا لقراءة المقالة صوتيًّا.</div>}
                </div>
              </div>

              {/* YouTube */}
              <div className="extra-panel" data-testid="panel-youtube">
                <div className="extra-head">
                  <label className="switch">
                    <input type="checkbox" checked={!!doc.show_youtube}
                           onChange={(e) => patch({ show_youtube: e.target.checked })}
                           data-testid="toggle-youtube"/>
                    <span>إظهار زر يوتيوب أعلى المقالة</span>
                  </label>
                </div>
                <div className="extra-body">
                  <input className="admin-input" type="url" placeholder="https://youtu.be/... أو https://youtube.com/watch?v=..."
                         value={doc.youtube_url || ""} onChange={(e) => patch({ youtube_url: e.target.value })}
                         dir="ltr" data-testid="youtube-url"/>
                  <div className="hint" style={{ marginTop: 6 }}>سيظهر زرٌ صغيرٌ أعلى المقالة، وضغطه يفتح المشغّل مضمَّنًا.</div>
                </div>
              </div>

              {/* References */}
              <div className="extra-panel" data-testid="panel-refs">
                <div className="extra-head">
                  <label className="switch">
                    <input type="checkbox" checked={!!doc.show_references}
                           onChange={(e) => patch({ show_references: e.target.checked })}
                           data-testid="toggle-refs"/>
                    <span>إظهار قائمة المراجع أسفل المقالة</span>
                  </label>
                </div>
                <div className="extra-body">
                  {(doc.references || []).length === 0 && (
                    <div className="hint">لا مراجع بعد — أضف رابطًا واحدًا فأكثر.</div>
                  )}
                  {(doc.references || []).map((r, i) => (
                    <div key={i} className="ref-row" data-testid={`ref-row-${i}`}>
                      <select className="admin-input" value={r.kind || "web"}
                              onChange={(e) => updateRef(i, "kind", e.target.value)} data-testid={`ref-kind-${i}`}>
                        <option value="web">صفحة</option>
                        <option value="youtube">يوتيوب</option>
                        <option value="book">كتاب</option>
                        <option value="pdf">PDF</option>
                        <option value="other">آخر</option>
                      </select>
                      <input className="admin-input" placeholder="العنوان" value={r.title || ""}
                             onChange={(e) => updateRef(i, "title", e.target.value)} data-testid={`ref-title-${i}`}/>
                      <input className="admin-input" placeholder="الرابط" value={r.url || ""} dir="ltr"
                             onChange={(e) => updateRef(i, "url", e.target.value)} data-testid={`ref-url-${i}`}/>
                      <div className="ref-actions">
                        <button type="button" className="icon-only" onClick={() => moveRef(i, -1)} title="لأعلى">↑</button>
                        <button type="button" className="icon-only" onClick={() => moveRef(i, 1)} title="لأسفل">↓</button>
                        <button type="button" className="icon-only" onClick={() => removeRef(i)} title="حذف">×</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="admin-btn ghost small" onClick={addRef} data-testid="ref-add">+ مرجع جديد</button>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
              الآية: <code dir="ltr">﴿…﴾ [الحشر: ٢]</code>. العناوين: اختر «عنوان» من قائمة نوع الكتلة.
              <br/>
              تنسيق داخل الفقرة: <code dir="ltr">**غامق**</code>، <code dir="ltr">*مائل*</code>، <code dir="ltr">~تسطير~</code>، <code dir="ltr">~{"{gold:نص}"}~</code>. حدّد النصّ ثم اضغط زرًّا من (غ / م / ت / الدوائر الملوّنة).
            </p>
          </div>

          <div className="field">
            <label>SEO — عنوان الميتا</label>
            <input className="admin-input" value={doc.seo_title || ""} onChange={(e) => patch({ seo_title: e.target.value })} data-testid="editor-seo-title"/>
          </div>
          <div className="field">
            <label>SEO — وصف الميتا</label>
            <textarea className="admin-input" rows={2} value={doc.seo_description || ""} onChange={(e) => patch({ seo_description: e.target.value })}/>
          </div>
        </div>

        <aside className="side">
          <h4>الحالة والنشر</h4>
          {!isOwner && (
            <div className="hint" style={{ marginBottom: 8 }}>
              دورك «محرّر»: تحفظ التعديلات كمسودّة. النشر والتثبيت والحذف للمالك.
            </div>
          )}
          <div className="field">
            <label>الحالة</label>
            <select className="admin-input" value={doc.status} onChange={(e) => patch({ status: e.target.value })} data-testid="editor-status" disabled={!isOwner}>
              <option value="draft">مسودة</option>
              <option value="published">منشورة</option>
            </select>
          </div>
          <div className="field">
            <label>تاريخ العرض للقارئ (نصّ حرّ)</label>
            <input className="admin-input" value={doc.date || ""} onChange={(e) => patch({ date: e.target.value })} placeholder="مثال: ١١ أغسطس ٢٠٢٦"/>
          </div>
          <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={!!doc.pinned} onChange={(e) => patch({ pinned: e.target.checked })} data-testid="editor-pin" disabled={!isOwner}/>
            <span>تثبيت على الرئيسية</span>
          </label>
          <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={!!doc.hide_toc} onChange={(e) => patch({ hide_toc: e.target.checked })} data-testid="editor-hide-toc"/>
            <span>إخفاء فهرس هذه المقالة</span>
          </label>

          <h4>التصنيف والسلسلة</h4>
          <div className="field">
            <label>التصنيف</label>
            <select className="admin-input" value={doc.category || ""} onChange={(e) => patch({ category: e.target.value })} data-testid="editor-category">
              <option value="">—</option>
              {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>السلسلة</label>
            <select className="admin-input" value={doc.series || ""} onChange={(e) => patch({ series: e.target.value || null })}>
              <option value="">—</option>
              {ser.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label>ترتيب الجزء</label>
            <input className="admin-input" type="number" value={doc.part || ""} onChange={(e) => patch({ part: e.target.value ? parseInt(e.target.value, 10) : null })}/>
          </div>

          {!isNew && isOwner && (
            <>
              <h4 style={{ marginTop: 20 }}>خطر</h4>
              {showConfirmDel ? (
                <div className="confirm-inline">
                  <p>سيُحذف «{doc.title}» نهائيًا.</p>
                  <button className="admin-btn danger small" onClick={del}>أكّد الحذف</button>{" "}
                  <button className="admin-btn ghost small" onClick={() => setShowConfirmDel(false)}>إلغاء</button>
                </div>
              ) : (
                <button className="admin-btn danger small" onClick={() => setShowConfirmDel(true)}>حذف المقالة</button>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}

/* ============================================================
   Categories page (drag & drop reorder)
   ============================================================ */
function CategoriesPage() {
  const [items, setItems] = useState(null);
  const [name, setName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // { id, name, count }
  const [reassignTo, setReassignTo] = useState("");
  const dragFrom = useRef(null);

  const load = async () => setItems((await api("/admin/categories")).categories);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try { await api("/admin/categories", { method: "POST", body: JSON.stringify({ name: name.trim() }) }); setName(""); await load(); }
    catch (e) { alert(e.message); }
  };
  const rename = async (id, newName) => {
    try { await api(`/admin/categories/${id}`, { method: "PUT", body: JSON.stringify({ name: newName }) }); await load(); }
    catch (e) { alert(e.message); }
  };
  const delReq = async (cat) => {
    // Check count first
    if (cat.article_count > 0) {
      setConfirmDel(cat); setReassignTo("");
    } else if (window.confirm(`حذف التصنيف «${cat.name}»؟`)) {
      try { await api(`/admin/categories/${cat.id}`, { method: "DELETE" }); await load(); }
      catch (e) { alert(e.message); }
    }
  };
  const delConfirm = async () => {
    if (!reassignTo) { alert("اختر التصنيف البديل."); return; }
    try {
      await api(`/admin/categories/${confirmDel.id}?reassign_to=${encodeURIComponent(reassignTo)}`, { method: "DELETE" });
      setConfirmDel(null); setReassignTo(""); await load();
    } catch (e) { alert(e.message); }
  };

  const onDragStart = (i) => (e) => { dragFrom.current = i; e.currentTarget.classList.add("dragging"); };
  const onDragEnd = (e) => e.currentTarget.classList.remove("dragging");
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (i) => async (e) => {
    e.preventDefault();
    const from = dragFrom.current;
    if (from === null || from === i) return;
    const arr = [...items];
    const [moved] = arr.splice(from, 1);
    arr.splice(i, 0, moved);
    setItems(arr);
    try { await api("/admin/categories/reorder", { method: "POST", body: JSON.stringify({ order: arr.map((x) => x.id) }) }); }
    catch (er) { alert(er.message); await load(); }
    dragFrom.current = null;
  };

  return (
    <>
      <h1 className="admin-title">التصنيفات</h1>
      <div className="admin-toolbar">
        <input className="admin-input" placeholder="اسم تصنيف جديد" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 260 }} data-testid="cat-new-name"/>
        <button className="admin-btn" onClick={create} data-testid="cat-add">أضف</button>
      </div>
      {items === null ? <div className="admin-empty">…</div> :
        items.length === 0 ? <div className="admin-empty">لا تصنيفات.</div> :
        <ul className="cs-list" data-testid="cats-list">
          {items.map((c, i) => (
            <li key={c.id} draggable
                onDragStart={onDragStart(i)} onDragEnd={onDragEnd}
                onDragOver={onDragOver} onDrop={onDrop(i)}
                data-testid={`cat-row-${c.id}`}>
              <span className="drag" aria-hidden="true">≡</span>
              <input className="admin-input name" value={c.name}
                     onChange={(e) => setItems(items.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))}
                     onBlur={(e) => rename(c.id, e.target.value)}
                     data-testid={`cat-name-${c.id}`}/>
              <span className="count">{ar(c.article_count)} مقالات</span>
              <button className="admin-btn danger small" onClick={() => delReq(c)} data-testid={`cat-del-${c.id}`}>حذف</button>
            </li>
          ))}
        </ul>
      }
      {confirmDel && (
        <div className="confirm-inline" data-testid="cat-del-confirm">
          <p>«{confirmDel.name}» يحوي {ar(confirmDel.article_count)} مقالات. اختر تصنيفًا لنقلها إليه قبل الحذف:</p>
          <select className="admin-input" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} style={{ maxWidth: 260 }} data-testid="cat-del-reassign">
            <option value="">— اختر —</option>
            {items.filter((x) => x.id !== confirmDel.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>{" "}
          <button className="admin-btn danger small" onClick={delConfirm} data-testid="cat-del-apply">أكّد الحذف والنقل</button>{" "}
          <button className="admin-btn ghost small" onClick={() => setConfirmDel(null)}>إلغاء</button>
        </div>
      )}
    </>
  );
}

/* ============================================================
   Series page
   ============================================================ */
function SeriesPage() {
  const [items, setItems] = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const load = async () => setItems((await api("/admin/series")).series);
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!title.trim()) return;
    try { await api("/admin/series", { method: "POST", body: JSON.stringify({ title: title.trim(), desc: desc.trim() }) }); setTitle(""); setDesc(""); await load(); }
    catch (e) { alert(e.message); }
  };
  const del = async (s) => {
    if (!window.confirm(`حذف سلسلة «${s.title}»؟ ستُفَكّ الروابط عن ${s.article_count} مقالات دون حذفها.`)) return;
    try { await api(`/admin/series/${s.id}`, { method: "DELETE" }); await load(); }
    catch (e) { alert(e.message); }
  };
  const rename = async (s, patch) => {
    try { await api(`/admin/series/${s.id}`, { method: "PUT", body: JSON.stringify(patch) }); await load(); }
    catch (e) { alert(e.message); }
  };
  return (
    <>
      <h1 className="admin-title">السلاسل</h1>
      <div className="admin-toolbar">
        <input className="admin-input" placeholder="عنوان السلسلة" value={title} onChange={(e) => setTitle(e.target.value)} style={{ maxWidth: 260 }} data-testid="ser-new-title"/>
        <input className="admin-input" placeholder="وصف قصير" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ maxWidth: 380 }}/>
        <button className="admin-btn" onClick={create} data-testid="ser-add">أضف</button>
      </div>
      {items === null ? <div className="admin-empty">…</div> :
        items.length === 0 ? <div className="admin-empty">لا سلاسل.</div> :
        <ul className="cs-list" data-testid="series-list">
          {items.map((s) => (
            <li key={s.id} data-testid={`ser-row-${s.id}`}>
              <input className="admin-input name" value={s.title}
                     onChange={(e) => setItems(items.map((x) => x.id === s.id ? { ...x, title: e.target.value } : x))}
                     onBlur={(e) => rename(s, { title: e.target.value, desc: s.desc, cover: s.cover })}/>
              <span className="count">{ar(s.article_count)} مقالات</span>
              <button className="admin-btn danger small" onClick={() => del(s)} data-testid={`ser-del-${s.id}`}>حذف</button>
            </li>
          ))}
        </ul>
      }
    </>
  );
}

/* ============================================================
   Books manager (uploads PDFs; uses JWT bearer)
   ============================================================ */
function BooksPage() {
  const [books, setBooks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  const refresh = async () => {
    try { setBooks(await listBooks()); } catch { /* ignore */ }
  };
  useEffect(() => { refresh(); }, []);

  const upload = async (e) => {
    e.preventDefault();
    setMsg({ kind: "", text: "" });
    if (!title.trim()) { setMsg({ kind: "err", text: "العنوان مطلوب." }); return; }
    if (!pdfFile) { setMsg({ kind: "err", text: "ملف PDF مطلوب." }); return; }
    setBusy(true);
    try {
      await addBook({ title: title.trim(), description: description.trim(), pdf: pdfFile, cover: coverFile });
      setMsg({ kind: "ok", text: "تمّ رفع الكتاب، ويظهر على الموقع خلال دقيقة." });
      setTitle(""); setDescription(""); setPdfFile(null); setCoverFile(null);
      const pi = document.getElementById("bk-pdf"); if (pi) pi.value = "";
      const ci = document.getElementById("bk-cover"); if (ci) ci.value = "";
      await refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err.message || "خطأ." });
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("حذف هذا الكتاب؟")) return;
    try { await deleteBook(id); await refresh(); }
    catch (err) { setMsg({ kind: "err", text: err.message }); }
  };

  return (
    <>
      <h1 className="admin-title">الكتب</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 20px" }}>
        ارفع ملفات PDF (حتى ٢٥ ميغابايت) وصور غلاف اختيارية. تُعرض للزوّار على صفحة «الكتب» في الموقع العام.
      </p>

      <form onSubmit={upload} className="article-form" style={{ gridTemplateColumns: "1fr" }} data-testid="books-upload-form">
        <div className="field">
          <label>عنوان الكتاب</label>
          <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="book-title"/>
        </div>
        <div className="field">
          <label>الوصف</label>
          <textarea className="admin-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="book-desc"/>
        </div>
        <div className="field">
          <label>ملف PDF</label>
          <input id="bk-pdf" type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} data-testid="book-pdf"/>
        </div>
        <div className="field">
          <label>الغلاف (اختياري)</label>
          <input id="bk-cover" type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} data-testid="book-cover"/>
        </div>
        <div>
          <button className="admin-btn" type="submit" disabled={busy} data-testid="book-upload-submit">
            {busy ? "جاري الرفع…" : "رفع الكتاب"}
          </button>
          {msg.text && (
            <span style={{ marginInlineStart: 12, fontSize: 13, color: msg.kind === "err" ? "#a44" : "var(--gold)" }}>{msg.text}</span>
          )}
        </div>
      </form>

      <h2 style={{ fontFamily: '"Majalla", Amiri, serif', fontSize: "1.4rem", marginTop: 40, marginBottom: 14 }}>
        الكتب المرفوعة ({ar(books.length)})
      </h2>
      {books.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>لا كتب بعد.</p>
      ) : (
        <ul className="cs-list" data-testid="books-list">
          {books.map((b) => (
            <li key={b.id} data-testid={`book-row-${b.id}`}>
              <div className="name">
                <strong>{b.title}</strong>
                {b.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{b.description}</div>}
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                  {b.size ? `${Math.round(b.size / 1024)} KB` : ""}
                  {b.download_count ? ` · ${ar(b.download_count)} تنزيل` : ""}
                </div>
              </div>
              <a className="admin-btn ghost small" href={`/books/${b.id}.pdf`} target="_blank" rel="noopener noreferrer">فتح</a>
              <button className="admin-btn danger small" onClick={() => remove(b.id)} data-testid={`book-del-${b.id}`}>حذف</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ============================================================
   Pages CRUD (standalone static pages: About, Contact, etc.)
   ============================================================ */
function PagesPage() {
  const [items, setItems] = useState(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const load = async () => {
    const r = await api("/admin/pages");
    setItems(r.pages);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!title.trim()) return;
    const r = await api("/admin/pages", { method: "POST", body: JSON.stringify({ title: title.trim(), body: [""], in_nav: false }) });
    setTitle(""); setCreating(false);
    window.location.href = `/admin/pages/${r.id}`;
  };
  const del = async (id) => {
    if (!window.confirm("حذف هذه الصفحة؟")) return;
    await api(`/admin/pages/${id}`, { method: "DELETE" });
    load();
  };
  const toggleNav = async (p) => {
    await api(`/admin/pages/${p.id}`, { method: "PUT", body: JSON.stringify({ ...p, in_nav: !p.in_nav }) });
    load();
  };
  if (!items) return <div className="admin-empty">…</div>;
  return (
    <>
      <div className="admin-toolbar">
        <h1 className="admin-title" style={{ margin: 0 }}>الصفحات</h1>
        <div className="grow"/>
        {creating ? (
          <>
            <input className="admin-input" style={{ maxWidth: 260 }} placeholder="اسم الصفحة" autoFocus
                   value={title} onChange={(e) => setTitle(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && create()}
                   data-testid="page-new-title"/>
            <button className="admin-btn" onClick={create} data-testid="page-new-submit">إضافة</button>
            <button className="admin-btn ghost" onClick={() => { setCreating(false); setTitle(""); }}>إلغاء</button>
          </>
        ) : (
          <button className="admin-btn" onClick={() => setCreating(true)} data-testid="page-new-open">+ صفحة جديدة</button>
        )}
      </div>
      {items.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>لا صفحات بعد. مثلًا: «عن الكاتب»، «تواصل».</p>
      ) : (
        <ul className="cs-list" data-testid="pages-list">
          {items.map((p) => (
            <li key={p.id} data-testid={`page-row-${p.id}`}>
              <div className="name">
                <strong>{p.title}</strong>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>/p/{p.slug}</div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={!!p.in_nav} onChange={() => toggleNav(p)}/> في القائمة
              </label>
              <Link className="admin-btn ghost small" to={`/admin/pages/${p.id}`} data-testid={`page-edit-${p.id}`}>تحرير</Link>
              <button className="admin-btn danger small" onClick={() => del(p.id)} data-testid={`page-del-${p.id}`}>حذف</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PageEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState(null);
  const [saving, setSaving] = useState("idle");
  const blockRefs = useRef({});
  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/admin/pages/${id}`);
        setDoc({ ...r, body: r.body?.length ? r.body : [""] });
      } catch (e) { alert("تعذّر التحميل"); nav("/admin/pages"); }
    })();
  }, [id, nav]);
  if (!doc) return <div className="admin-empty">…</div>;
  const patch = (p) => setDoc((d) => ({ ...d, ...p }));
  const setBlockObj = (i, part) => {
    const cur = readBlock(doc.body[i]);
    patch({ body: doc.body.map((b, idx) => idx === i ? writeBlock({ ...cur, ...part }) : b) });
  };
  const insertBlock = (i, type = "p") => patch({
    body: [...doc.body.slice(0, i + 1), writeBlock({ text: "", type, align: "", color: "" }), ...doc.body.slice(i + 1)]
  });
  const removeBlock = (i) => patch({ body: doc.body.filter((_, idx) => idx !== i) });
  const wrapSelection = (i, prefix, suffix) => {
    const ta = blockRefs.current[i];
    if (!ta) return;
    const cur = readBlock(doc.body[i]);
    const text = cur.text || "";
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = end > start ? text.slice(start, end) : "نص";
    const next = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    setBlockObj(i, { text: next });
    setTimeout(() => {
      const t = blockRefs.current[i];
      if (t) {
        t.focus();
        const s2 = start + prefix.length;
        t.setSelectionRange(s2, s2 + selected.length);
      }
    }, 0);
  };
  const save = async () => {
    setSaving("saving");
    try {
      const r = await api(`/admin/pages/${id}`, { method: "PUT", body: JSON.stringify(doc) });
      setDoc({ ...r, body: r.body?.length ? r.body : [""] });
      setSaving("saved"); setTimeout(() => setSaving("idle"), 1500);
    } catch (e) { setSaving("err"); alert("تعذّر الحفظ."); }
  };
  return (
    <>
      <div className="admin-toolbar">
        <h1 className="admin-title" style={{ margin: 0 }}>تحرير صفحة</h1>
        <span className={`autosave-status ${saving}`}>{saving === "saving" ? "جاري الحفظ…" : saving === "saved" ? "حُفظت" : ""}</span>
        <div className="grow"/>
        <a className="admin-btn ghost" href={`/p/${doc.slug}?preview=1`} target="_blank" rel="noopener noreferrer">معاينة</a>
        <button className="admin-btn ghost" onClick={() => nav("/admin/pages")}>رجوع</button>
        <button className="admin-btn" onClick={save} data-testid="page-save">حفظ</button>
      </div>
      <div className="article-form" style={{ gridTemplateColumns: "1fr" }}>
        <div className="field">
          <label>العنوان</label>
          <input className="admin-input" value={doc.title} onChange={(e) => patch({ title: e.target.value })} data-testid="page-title"/>
        </div>
        <div className="field">
          <label>الاختصار (slug)</label>
          <input className="admin-input" dir="ltr" value={doc.slug || ""} onChange={(e) => patch({ slug: e.target.value })}/>
        </div>
        <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={!!doc.in_nav} onChange={(e) => patch({ in_nav: e.target.checked })} data-testid="page-in-nav"/>
          <span>إظهارها في القائمة العلوية</span>
        </label>
        <div className="field">
          <label>المحتوى</label>
          <div className="body-blocks">
            {doc.body.map((raw, i) => {
              const b = readBlock(raw);
              return (
                <div className="block-row" key={i}>
                  <div className="block-head">
                    <select value={b.type} onChange={(e) => setBlockObj(i, { type: e.target.value })}>
                      {BLOCK_TYPES.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                    </select>
                    <select value={b.align} onChange={(e) => setBlockObj(i, { align: e.target.value })} data-testid={`block-align-${i}`}>
                      {ALIGN_OPTIONS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                    </select>
                    <select value={b.color} onChange={(e) => setBlockObj(i, { color: e.target.value })} data-testid={`block-color-${i}`}>
                      {COLOR_OPTIONS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                    </select>
                    <div className="insert-bar">
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "**", "**")} title="غامق" data-testid={`fmt-bold-${i}`}><b>غ</b></button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "*", "*")} title="مائل" data-testid={`fmt-italic-${i}`}><i>م</i></button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~", "~")} title="تسطير" data-testid={`fmt-underline-${i}`}><u>ت</u></button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{gold:", "}~")} style={{ color: "#a88e35" }} title="ذهبي" data-testid={`fmt-color-gold-${i}`}>●</button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{lapis:", "}~")} style={{ color: "#254a7a" }} title="لازوردي" data-testid={`fmt-color-lapis-${i}`}>●</button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{green:", "}~")} style={{ color: "#3e6f4a" }} title="أخضر" data-testid={`fmt-color-green-${i}`}>●</button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSelection(i, "~{red:", "}~")} style={{ color: "#a44444" }} title="قرمزي" data-testid={`fmt-color-red-${i}`}>●</button>
                    </div>
                  </div>
                  <textarea className={`admin-input block-textarea color-${b.color || "default"}`}
                            style={{ textAlign: b.align || undefined, textAlignLast: b.align === "justify" ? "right" : undefined }}
                            rows={b.type === "h" ? 1 : 5}
                            ref={(el) => { blockRefs.current[i] = el; }}
                            value={b.text}
                            data-testid={`page-block-${i}`}
                            onChange={(e) => setBlockObj(i, { text: e.target.value })}/>
                  <div className="block-actions">
                    <button type="button" className="icon-only" onClick={() => insertBlock(i, "p")}>+ف</button>
                    <button type="button" className="icon-only" onClick={() => insertBlock(i, "h")}>+ع</button>
                    <button type="button" className="icon-only" onClick={() => removeBlock(i)}>×</button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="admin-btn ghost small" onClick={() => insertBlock(doc.body.length - 1, "p")}>+ فقرة جديدة</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   Site Settings + Backup/Restore
   ============================================================ */
const SOCIAL_KINDS = [
  { v: "twitter", label: "تويتر / X" },
  { v: "telegram", label: "تلغرام" },
  { v: "youtube", label: "يوتيوب" },
  { v: "instagram", label: "إنستغرام" },
  { v: "email", label: "بريد" },
  { v: "website", label: "موقع" },
];

function SettingsPage() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState("idle");
  useEffect(() => {
    (async () => {
      try { setS(await api("/admin/settings")); }
      catch { setS({ site_name: "", tagline: "", author: "", socials: [], show_excerpt_default: true, footer_line: "" }); }
    })();
  }, []);
  if (!s) return <div className="admin-empty">…</div>;
  const patch = (p) => setS((cur) => ({ ...cur, ...p }));
  const patchSocial = (i, part) => patch({ socials: (s.socials || []).map((x, idx) => idx === i ? { ...x, ...part } : x) });
  const addSocial = () => patch({ socials: [...(s.socials || []), { kind: "twitter", url: "" }] });
  const rmSocial = (i) => patch({ socials: (s.socials || []).filter((_, idx) => idx !== i) });
  const save = async () => {
    setSaving("saving");
    try {
      const r = await api("/admin/settings", { method: "PUT", body: JSON.stringify(s) });
      setS(r); setSaving("saved"); setTimeout(() => setSaving("idle"), 1500);
    } catch { setSaving("err"); alert("تعذّر الحفظ."); }
  };
  const doBackup = async () => {
    const blob = await backupJson();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `blog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="admin-toolbar">
        <h1 className="admin-title" style={{ margin: 0 }}>إعدادات الموقع</h1>
        <span className={`autosave-status ${saving}`}>{saving === "saving" ? "جاري الحفظ…" : saving === "saved" ? "حُفظت" : ""}</span>
        <div className="grow"/>
        <button className="admin-btn" onClick={save} data-testid="settings-save">حفظ</button>
      </div>
      <div className="article-form" style={{ gridTemplateColumns: "1fr" }}>
        <div className="field">
          <label>اسم الموقع</label>
          <input className="admin-input" value={s.site_name || ""} onChange={(e) => patch({ site_name: e.target.value })} data-testid="s-site-name"/>
        </div>
        <div className="field">
          <label>الشعار الفرعي</label>
          <input className="admin-input" value={s.tagline || ""} onChange={(e) => patch({ tagline: e.target.value })} data-testid="s-tagline"/>
        </div>
        <div className="field">
          <label>اسم الكاتب</label>
          <input className="admin-input" value={s.author || ""} onChange={(e) => patch({ author: e.target.value })} data-testid="s-author"/>
        </div>
        <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={s.show_excerpt_default !== false}
                 onChange={(e) => patch({ show_excerpt_default: e.target.checked })}
                 data-testid="s-excerpt-default"/>
          <span>إظهار المقتطف افتراضيًا في القوائم للمقالات الجديدة</span>
        </label>
        <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={s.show_toc !== false}
                 onChange={(e) => patch({ show_toc: e.target.checked })}
                 data-testid="s-show-toc"/>
          <span>إظهار «فهرس المقالة» في أعلى المقالات</span>
        </label>

        <div className="field">
          <label>روابط التواصل</label>
          {(s.socials || []).map((soc, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8, marginBottom: 8 }} data-testid={`social-row-${i}`}>
              <select value={soc.kind} onChange={(e) => patchSocial(i, { kind: e.target.value })}
                      style={{ padding: "10px 12px", border: "1px solid var(--line)", fontFamily: "inherit", fontSize: 15, background: "var(--paper)" }}>
                {SOCIAL_KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
              </select>
              <input className="admin-input" dir="ltr" value={soc.url || ""} onChange={(e) => patchSocial(i, { url: e.target.value })}
                     placeholder="https://…" data-testid={`social-url-${i}`}/>
              <button type="button" className="admin-btn danger small" onClick={() => rmSocial(i)}>حذف</button>
            </div>
          ))}
          <button type="button" className="admin-btn ghost small" onClick={addSocial} data-testid="social-add">+ رابط</button>
        </div>

        <div className="field">
          <label>سطر الحقوق أسفل الموقع (اختياري)</label>
          <input className="admin-input" value={s.footer_line || ""} onChange={(e) => patch({ footer_line: e.target.value })}
                 placeholder="مثال: جميع الحقوق محفوظة لمهند بن جازي"/>
        </div>

        <hr style={{ margin: "40px 0 20px", border: 0, borderTop: "1px solid var(--line)" }}/>
        <h3 style={{ fontFamily: '"Majalla", Amiri, serif', fontSize: "1.3rem", marginBottom: 12 }}>سلامة البيانات</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
          صدّر نسخة كاملة من مقالاتك وتصنيفاتك وسلاسلك وصفحاتك وإعداداتك بصيغة JSON. وكل تعديل محفوظ أيضًا في سجلّ مستودعك على GitHub.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="admin-btn" onClick={doBackup} data-testid="backup-download">تصدير كل شيء (JSON)</button>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   Root
   ============================================================ */
/* ============================================================
   Change password
   ============================================================ */
function ChangePasswordPage() {
  const [cur, setCur] = useState("");
  const [npw, setNpw] = useState("");
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setOk(""); setErr("");
    try {
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: cur, new_password: npw }) });
      setOk("تمّ التغيير. أعد الدخول.");
      setTimeout(() => { window.location.href = "/admin/login"; }, 1500);
    } catch (e) {
      setErr(e.message === "wrong_current_password" ? "كلمة السرّ الحالية خاطئة." :
             e.message === "password_too_short" ? "الكلمة الجديدة قصيرة (٨ أحرف على الأقل)." :
             e.message || "خطأ.");
    }
  };
  return (
    <>
      <h1 className="admin-title">تغيير كلمة السرّ</h1>
      <form onSubmit={submit} style={{ maxWidth: 480 }} data-testid="pw-form">
        <div className="field">
          <label>كلمة السرّ الحالية</label>
          <input className="admin-input" type="password" required value={cur} onChange={(e) => setCur(e.target.value)} data-testid="pw-current"/>
        </div>
        <div className="field">
          <label>كلمة السرّ الجديدة (٨ أحرف على الأقلّ)</label>
          <input className="admin-input" type="password" required minLength={8} value={npw} onChange={(e) => setNpw(e.target.value)} data-testid="pw-new"/>
        </div>
        <button className="admin-btn" type="submit" data-testid="pw-submit">تغيير</button>
        {ok && <div className="admin-ok">{ok}</div>}
        {err && <div className="admin-error">{err}</div>}
      </form>
    </>
  );
}

/* ============================================================
   Users management (owner only)
   ============================================================ */
const ROLE_LABELS = { owner: "مالك", editor: "محرّر", viewer: "قارئ", writer: "كاتب" };
const ROLE_HINTS = {
  owner: "كل الصلاحيات (نشر، حذف، إدارة المستخدمين).",
  editor: "يكتب ويعدّل، لا ينشر ولا يحذف ولا يديري المستخدمين.",
  viewer: "قراءة فقط داخل اللوحة.",
};

function UsersPage() {
  const { me } = useAuth();
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addPw, setAddPw] = useState("");
  const [addRole, setAddRole] = useState("editor");

  const load = async () => {
    try { setUsers((await api("/admin/users")).users); }
    catch (e) { setErr(e.message === "owner_only" ? "هذه الصفحة للمالك فقط." : e.message); setUsers([]); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("/admin/users", { method: "POST", body: JSON.stringify({
        email: addEmail.trim().toLowerCase(), name: addName.trim(),
        password: addPw, role: addRole,
      })});
      setAddEmail(""); setAddName(""); setAddPw(""); setAddRole("editor");
      setShowAdd(false);
      await load();
    } catch (e) {
      setErr(e.message === "email_exists" ? "البريد مستخدم." :
             e.message === "invalid_email" ? "البريد غير صالح." :
             e.message === "invalid_role" ? "دور غير صالح." :
             e.message.includes("password") ? "الكلمة قصيرة (٨ أحرف على الأقل)." : e.message);
    } finally { setBusy(false); }
  };

  const changeRole = async (u, role) => {
    if (u.role === role) return;
    if (!window.confirm(`تغيير دور ${u.email} إلى «${ROLE_LABELS[role]}»؟`)) return;
    try { await api(`/admin/users/${encodeURIComponent(u.id)}`, { method: "PUT", body: JSON.stringify({ role }) }); await load(); }
    catch (e) { alert(e.message === "cannot_demote_last_owner" ? "لا يمكن تنزيل آخر مالك." : e.message); }
  };

  const resetPw = async (u) => {
    const pw = window.prompt(`كلمة سرّ جديدة لـ ${u.email} (٨ أحرف فأكثر):`);
    if (!pw) return;
    try { await api(`/admin/users/${encodeURIComponent(u.id)}`, { method: "PUT", body: JSON.stringify({ password: pw }) }); alert("تمّ."); }
    catch (e) { alert(e.message); }
  };

  const del = async (u) => {
    if (!window.confirm(`حذف الحساب ${u.email} نهائيًّا؟`)) return;
    try { await api(`/admin/users/${encodeURIComponent(u.id)}`, { method: "DELETE" }); await load(); }
    catch (e) { alert(e.message === "cannot_delete_last_owner" ? "لا يمكن حذف آخر مالك." :
                     e.message === "cannot_delete_self" ? "لا يمكنك حذف حسابك." : e.message); }
  };

  if (me?.role !== "owner") {
    return <><h1 className="admin-title">الأعضاء</h1><div className="admin-error">هذه الصفحة للمالك فقط.</div></>;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 className="admin-title" style={{ margin: 0 }}>الأعضاء</h1>
        <button className="admin-btn" onClick={() => setShowAdd((v) => !v)} data-testid="users-toggle-add">
          {showAdd ? "إغلاق" : "إضافة عضو"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={create} className="admin-card" style={{ padding: 16, marginBottom: 20 }} data-testid="users-add-form">
          <div className="field">
            <label>البريد</label>
            <input className="admin-input" type="email" required dir="ltr"
                   value={addEmail} onChange={(e) => setAddEmail(e.target.value)} data-testid="add-email"/>
          </div>
          <div className="field">
            <label>الاسم (اختياري)</label>
            <input className="admin-input" value={addName} onChange={(e) => setAddName(e.target.value)} data-testid="add-name"/>
          </div>
          <div className="field">
            <label>كلمة السرّ الأوليّة (٨ فأكثر)</label>
            <input className="admin-input" type="password" required minLength={8}
                   value={addPw} onChange={(e) => setAddPw(e.target.value)} data-testid="add-password"/>
          </div>
          <div className="field">
            <label>الدور</label>
            <select className="admin-input" value={addRole} onChange={(e) => setAddRole(e.target.value)} data-testid="add-role">
              <option value="editor">محرّر — يكتب ويعدّل، بلا نشر</option>
              <option value="viewer">قارئ — قراءة فقط</option>
              <option value="owner">مالك — كل الصلاحيّات</option>
            </select>
            <div className="hint" style={{ marginTop: 6 }}>{ROLE_HINTS[addRole]}</div>
          </div>
          <button className="admin-btn" type="submit" disabled={busy} data-testid="add-submit">
            {busy ? "…" : "إنشاء"}
          </button>
          {err && <div className="admin-error" style={{ marginTop: 10 }}>{err}</div>}
        </form>
      )}

      {users === null ? <div className="hint">جاري التحميل…</div> :
       users.length === 0 ? <div className="hint">{err || "لا أعضاء."}</div> : (
        <ul className="admin-list" data-testid="users-list">
          {users.map((u) => (
            <li key={u.id} className="admin-card" style={{ padding: 14, marginBottom: 10 }} data-testid={`user-${u.email}`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{u.name || u.email}</div>
                  <div className="hint" dir="ltr" style={{ direction: "ltr" }}>{u.email}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select className="admin-input" style={{ padding: "4px 8px" }} value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          disabled={u.email === me.email}
                          data-testid={`role-${u.email}`}>
                    <option value="owner">مالك</option>
                    <option value="editor">محرّر</option>
                    <option value="viewer">قارئ</option>
                  </select>
                  <button className="admin-btn ghost small" onClick={() => resetPw(u)} data-testid={`resetpw-${u.email}`}>تعيين كلمة سرّ</button>
                  {u.email !== me.email && (
                    <button className="admin-btn danger small" onClick={() => del(u)} data-testid={`del-${u.email}`}>حذف</button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ============================================================
   الإحصاءات
   ============================================================ */
function StatsPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [sort, setSort] = useState("total");
  useEffect(() => { api("/admin/stats").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <><h1 className="admin-title">الإحصاءات</h1><div className="admin-error">{err}</div></>;
  if (!d) return <div className="admin-empty">جاري التحميل…</div>;
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10));
  const byDay = Object.fromEntries(d.daily.map((x) => [x.day, x.n]));
  const series = days.map((day) => ({ day, n: byDay[day] || 0 }));
  const max = Math.max(1, ...series.map((x) => x.n));
  const sum = (k) => d.articles.reduce((n, a) => n + (a[k] || 0), 0);
  const rows = [...d.articles].sort((a, b) => b[sort] - a[sort] || b.total - a.total);
  const cards = [
    { label: "زيارات آخر ٣٠ يومًا", v: sum("month") },
    { label: "زيارات آخر ٧ أيام", v: sum("week") },
    { label: "كل الزيارات", v: sum("total") },
    { label: "دعوات «نفع الله بك»", v: sum("likes") },
    { label: "مشتركو النشرة", v: d.subscribers },
  ];
  const Th = ({ k, children }) => <th onClick={() => setSort(k)} style={{ cursor: "pointer", color: sort === k ? "var(--gold)" : undefined }}>{children}{sort === k ? " ↓" : ""}</th>;
  return (
    <>
      <h1 className="admin-title">الإحصاءات</h1>
      <div className="stat-cards">
        {cards.map((c) => <div key={c.label} className="stat-card"><div className="k">{c.label}</div><div className="v">{ar(c.v)}</div></div>)}
      </div>
      <h2 className="admin-sub">الزيارات اليومية</h2>
      <div className="day-chart" data-testid="stats-chart">
        {series.map((x) => <div key={x.day} className="bar" style={{ height: `${Math.max(2, (x.n / max) * 100)}%` }} title={`${x.day}: ${x.n}`}/>)}
      </div>
      <div className="day-axis"><span>قبل ٣٠ يومًا</span><span>اليوم</span></div>
      <h2 className="admin-sub">المقالات</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table" data-testid="stats-table">
          <thead><tr><th>المقالة</th><Th k="week">٧ أيام</Th><Th k="month">٣٠ يومًا</Th><Th k="total">الكل</Th><Th k="likes">نفع الله بك</Th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><a href={`/articles/${encodeURIComponent(a.slug)}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{a.title}</a></td>
                <td>{ar(a.week)}</td><td>{ar(a.month)}</td><td><b>{ar(a.total)}</b></td><td>{ar(a.likes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>تُعدّ الزيارة مرةً لكل قارئ في الجلسة، ولا تُعدّ زيارات محركات البحث ومعاينات الروابط. ولا يُحفظ عن القارئ شيء.</p>
    </>
  );
}

/* ============================================================
   النشرة البريدية
   ============================================================ */
/* تنبيهات الجوال: إرسال إشعار بالمقالة إلى من فعّلوا «نبّهني بالمقالات الجديدة» */
function PushAdminSection({ arts }) {
  const [d, setD] = useState(null);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api("/admin/push").then(setD).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!pick && arts[0]) setPick(arts[0].id); }, [arts]);
  const send = async (force = false) => {
    const a = arts.find((x) => x.id === pick);
    if (!a || (!force && !window.confirm(`تنبيه ${d.subscribers} جهاز بمقالة «${a.title}»؟`))) return;
    setBusy(true); setMsg("");
    try {
      const r = await api("/admin/push", { method: "POST", body: JSON.stringify({ article_id: pick, force }) });
      setMsg(`وصل التنبيه إلى ${ar(r.delivered)} جهاز${r.removed ? `، وحُذف ${ar(r.removed)} اشتراكٍ منتهٍ` : ""}.`); load();
    } catch (e) {
      if (e.code === "already_sent") {
        if (window.confirm(`نُبّه المشتركون بهذه المقالة من قبل (${fmtDate(e.data.sent_at)}). تنبيههم مرة أخرى؟`)) { setBusy(false); return send(true); }
      } else setMsg(e.message);
    } finally { setBusy(false); }
  };
  const title = (id) => arts.find((a) => a.id === id)?.title || id;
  return (
    <section data-testid="push-admin">
      <h2 className="admin-sub">تنبيهات الجوال</h2>
      <p className="hint" style={{ marginTop: -6 }}>
        يصل التنبيه إلى شريط إشعارات من ضغط «نبّهني بالمقالات الجديدة» في الموقع.
        {d && <> المشتركون الآن: <b data-testid="push-count">{ar(d.subscribers)}</b> جهاز.</>}
      </p>
      <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
        <select className="admin-input" value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 420 }} data-testid="push-pick">
          {arts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <button className="admin-btn" onClick={() => send(false)} disabled={busy || !d || !d.subscribers} data-testid="push-send">{busy ? "جاري التنبيه…" : "نبّه المشتركين"}</button>
        {msg && <span className="hint" data-testid="push-admin-msg">{msg}</span>}
      </div>
      {d?.sends?.length > 0 && (
        <ul className="cs-list" style={{ marginTop: 12 }}>
          {d.sends.map((x, i) => <li key={i}><div className="name">{title(x.article_id)}</div><span className="hint">{fmtDate(x.sent_at)} · وصل إلى {ar(x.delivered)} جهاز</span></li>)}
        </ul>
      )}
    </section>
  );
}

function NewsletterAdminPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [arts, setArts] = useState([]);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api("/admin/subscribers").then(setD).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api("/admin/articles?status=published").then((r) => { setArts(r.articles); setPick(r.articles[0]?.id || ""); }).catch(() => {});
  }, []);
  if (err) return <><h1 className="admin-title">النشرة البريدية</h1><div className="admin-error">{err}</div></>;
  if (!d) return <div className="admin-empty">جاري التحميل…</div>;
  const active = d.subscribers.filter((x) => x.status === "active");
  const send = async (force = false) => {
    const a = arts.find((x) => x.id === pick);
    if (!a || (!force && !window.confirm(`إرسال «${a.title}» إلى ${active.length} مشترك؟`))) return;
    setBusy(true); setMsg("");
    try {
      const r = await api("/admin/newsletter", { method: "POST", body: JSON.stringify({ article_id: pick, force }) });
      setMsg(`أُرسلت إلى ${ar(r.sent)} مشترك.`); load();
    } catch (e) {
      if (e.code === "already_sent") {
        if (window.confirm(`أُرسلت هذه المقالة من قبل (${fmtDate(e.data.sent_at)}). إرسالها مرة أخرى؟`)) { setBusy(false); return send(true); }
      } else setMsg(e.message);
    } finally { setBusy(false); }
  };
  const del = async (email) => {
    if (!window.confirm(`حذف ${email} من القائمة؟`)) return;
    await api(`/admin/subscribers/${encodeURIComponent(email)}`, { method: "DELETE" }); load();
  };
  const title = (id) => arts.find((a) => a.id === id)?.title || id;
  return (
    <>
      <div className="admin-toolbar">
        <h1 className="admin-title" style={{ margin: 0 }}>النشرة البريدية</h1>
        <div className="grow"/>
        <a className="admin-btn ghost" href="/api/subscribers?format=csv" data-testid="subs-export">تصدير القائمة (CSV)</a>
      </div>
      <div className="stat-cards">
        <div className="stat-card"><div className="k">المشتركون</div><div className="v">{ar(active.length)}</div></div>
        <div className="stat-card"><div className="k">ألغوا الاشتراك</div><div className="v">{ar(d.subscribers.length - active.length)}</div></div>
        <div className="stat-card"><div className="k">رسائل أُرسلت</div><div className="v">{ar(d.sends.length)}</div></div>
      </div>
      <PushAdminSection arts={arts}/>
      <h2 className="admin-sub">إرسال مقالة إلى المشتركين بالبريد</h2>
      {d.sending ? (
        <div className="admin-toolbar" style={{ flexWrap: "wrap" }}>
          <select className="admin-input" value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 420 }} data-testid="news-pick">
            {arts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
          <button className="admin-btn" onClick={() => send(false)} disabled={busy || !active.length} data-testid="news-send">{busy ? "جاري الإرسال…" : "أرسل"}</button>
          {msg && <span className="hint">{msg}</span>}
        </div>
      ) : (
        <p className="hint" data-testid="news-setup">الإرسال غير مفعّل بعد. يُجمع المشتركون الآن، وحين تُعدّ خدمة البريد (Resend) يظهر هنا زرّ الإرسال.</p>
      )}
      {d.sends.length > 0 && (
        <ul className="cs-list" style={{ marginTop: 12 }}>
          {d.sends.map((x, i) => <li key={i}><div className="name">{title(x.article_id)}</div><span className="hint">{fmtDate(x.sent_at)} · {ar(x.recipients)} مستلم</span></li>)}
        </ul>
      )}
      <h2 className="admin-sub">المشتركون</h2>
      {d.subscribers.length === 0 ? <p className="hint">لا مشتركين بعد. رابط الاشتراك في الموقع: /newsletter</p> : (
        <table className="admin-table" data-testid="subs-table">
          <thead><tr><th>البريد</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
          <tbody>
            {d.subscribers.map((x) => (
              <tr key={x.email}>
                <td dir="ltr" style={{ textAlign: "right" }}>{x.email}</td>
                <td>{x.status === "active" ? "مشترك" : "ألغى"}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(x.created_at)}</td>
                <td><button className="admin-btn danger small" onClick={() => del(x.email)}>حذف</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ============================================================
   ملاحظات القرّاء
   ============================================================ */
function FeedbackPage() {
  const { me } = useAuth();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("/admin/feedback").then((r) => setItems(r.feedback)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const del = async (id) => {
    if (!window.confirm("حذف هذه الملاحظة؟")) return;
    try { await api(`/admin/feedback/${id}`, { method: "DELETE" }); load(); } catch (e) { alert(e.message); }
  };
  if (err) return <><h1 className="admin-title">ملاحظات القرّاء</h1><div className="admin-error">{err}</div></>;
  if (!items) return <div className="admin-empty">جاري التحميل…</div>;
  return (
    <>
      <h1 className="admin-title">ملاحظات القرّاء</h1>
      <p className="hint" style={{ marginTop: -8 }}>تصل من صندوق «ملاحظة أو اقتراح» في آخر الصفحة الرئيسية، بلا بريد ولا اسم.</p>
      {items.length === 0 ? <div className="admin-empty" data-testid="feedback-empty">لا ملاحظات بعد.</div> : (
        <ul className="feedback-list" data-testid="feedback-list">
          {items.map((f) => (
            <li key={f.id}>
              <p>{f.body}</p>
              <div className="meta">
                <span>{fmtDate(f.created_at)}</span>
                {me?.role === "owner" && <button className="admin-btn danger small" onClick={() => del(f.id)}>حذف</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/" element={<Protected><Shell><Dashboard/></Shell></Protected>}/>
        <Route path="/articles" element={<Protected><Shell><ArticlesList/></Shell></Protected>}/>
        <Route path="/articles/:id" element={<Protected><Shell><ArticleEditor/></Shell></Protected>}/>
        <Route path="/pages" element={<Protected><Shell><PagesPage/></Shell></Protected>}/>
        <Route path="/pages/:id" element={<Protected><Shell><PageEditor/></Shell></Protected>}/>
        <Route path="/categories" element={<Protected><Shell><CategoriesPage/></Shell></Protected>}/>
        <Route path="/series" element={<Protected><Shell><SeriesPage/></Shell></Protected>}/>
        <Route path="/books" element={<Protected><Shell><BooksPage/></Shell></Protected>}/>
        <Route path="/settings" element={<Protected><Shell><SettingsPage/></Shell></Protected>}/>
        <Route path="/users" element={<Protected><Shell><UsersPage/></Shell></Protected>}/>
        <Route path="/stats" element={<Protected><Shell><StatsPage/></Shell></Protected>}/>
        <Route path="/feedback" element={<Protected><Shell><FeedbackPage/></Shell></Protected>}/>
        <Route path="/newsletter" element={<Protected><Shell><NewsletterAdminPage/></Shell></Protected>}/>
        <Route path="/password" element={<Protected><Shell><ChangePasswordPage/></Shell></Protected>}/>
      </Routes>
    </AuthProvider>
  );
}
