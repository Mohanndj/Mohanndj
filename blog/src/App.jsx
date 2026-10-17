import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Search, Sun, Moon, Download, BookOpen, ChevronLeft, Bookmark, BookmarkCheck, Share2, FileDown, Mail, Clock, CheckCircle2, BarChart3, Twitter, Send, MessageCircle, UserPlus, X, Volume2, Youtube, ExternalLink, Link as LinkIcon, FileText, Play } from "lucide-react";
import html2pdf from "html2pdf.js";
import { quoteCard } from "./og";
import "@/App.css";

/* المحتوى ملفات ثابتة في public/data — لا خادم */
const DATA = "/data";

/* لوحة التحكم تُحمَّل عند فتح /admin فقط، فلا تُثقل الموقع العام */
const AdminApp = lazy(() => import("./admin/AdminApp"));

/* أرقام عربية-هندية */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const ar = (v) => String(v).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);

/* ============================================================
   قائمة القراءة (localStorage)
   ============================================================ */
const SAVED_KEY = "muhannad-saved";
function getSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
}
function setSavedList(list) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("savedchange"));
}
function useSaved() {
  const [ids, setIds] = useState(getSaved);
  useEffect(() => {
    const h = () => setIds(getSaved());
    window.addEventListener("savedchange", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("savedchange", h); window.removeEventListener("storage", h); };
  }, []);
  const toggle = (id) => {
    const cur = getSaved();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setSavedList(next);
  };
  return [ids, toggle];
}

/* ============================================================
   محرّر المقالة: تخصيص المقتطف وإظهاره
   ============================================================ */
const EXCERPT_LIMIT = 300;
const OVERRIDES_KEY = "muhannad-post-overrides";
const EDITOR_SETTINGS_KEY = "muhannad-editor-settings";

function getOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}") || {}; } catch { return {}; }
}
function saveOverrides(o) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
  window.dispatchEvent(new Event("overrideschange"));
}
function getEditorSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY) || "{}") || {};
    return { defaultShowExcerpt: s.defaultShowExcerpt !== false, ...s };
  } catch { return { defaultShowExcerpt: true }; }
}
function saveEditorSettings(s) {
  localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("overrideschange"));
}
function useOverrides() {
  const [state, setState] = useState(() => ({ overrides: getOverrides(), settings: getEditorSettings() }));
  useEffect(() => {
    const h = () => setState({ overrides: getOverrides(), settings: getEditorSettings() });
    window.addEventListener("overrideschange", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("overrideschange", h); window.removeEventListener("storage", h); };
  }, []);
  return state;
}

/* توليد مقتطف تلقائي من أوّل فقرة نصّية إذا لم يكن هناك مقتطف يدوي */
function autoExcerpt(post) {
  if (!post.body || !post.body.length) return "";
  const firstText = post.body.find((b) => {
    if (typeof b === "string") return !b.startsWith("#");
    return b && (b.type === "p" || !b.type);
  });
  if (!firstText) return "";
  const raw = typeof firstText === "string" ? firstText : (firstText.text || "");
  const clean = raw
    .replace(/⟨\d+⟩/g, "")
    .replace(/﴿[^﴾]*﴾/g, "")
    .replace(/\s*\[[^\]]+\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/~([^~\n]+)~/g, "$1")
    .replace(/\{(?:gold|lapis|green|red|muted):([^}]+)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 220 ? clean.slice(0, 220).trim() + "…" : clean;
}

/* يدمج المقالة مع أي override محلّي: excerpt نصّي، وshowExcerpt (يرث الإعداد العام إن لم يُحدَّد) */
function withOverrides(post, overrides, settings) {
  const o = overrides[post.id] || {};
  const rawExcerpt = (o.excerpt !== undefined) ? o.excerpt : post.excerpt;
  const excerpt = (rawExcerpt && rawExcerpt.trim()) ? rawExcerpt.trim() : autoExcerpt(post);
  // Priority: local override > post.show_excerpt from admin > siteSettings.show_excerpt_default > legacy settings.defaultShowExcerpt
  let showExcerpt;
  if (o.showExcerpt !== undefined) showExcerpt = !!o.showExcerpt;
  else if (post.show_excerpt !== undefined && post.show_excerpt !== null) showExcerpt = !!post.show_excerpt;
  else if (typeof siteSettings.show_excerpt_default === "boolean") showExcerpt = siteSettings.show_excerpt_default;
  else showExcerpt = !!settings.defaultShowExcerpt;
  return { ...post, excerpt, showExcerpt };
}

/* ============================================================
   إحصاءات القراءة (localStorage)
   ============================================================ */
const STATS_KEY = "muhannad-stats";
function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || "null");
    if (!raw || typeof raw !== "object") return { totalSeconds: 0, articles: {} };
    return { totalSeconds: raw.totalSeconds || 0, articles: raw.articles || {} };
  } catch { return { totalSeconds: 0, articles: {} }; }
}
function saveStats(s) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("statschange"));
}
function useStats() {
  const [stats, setStats] = useState(getStats);
  useEffect(() => {
    const h = () => setStats(getStats());
    window.addEventListener("statschange", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("statschange", h); window.removeEventListener("storage", h); };
  }, []);
  return stats;
}

/* يعدّ زمن القراءة داخل صفحة مقالة، ويعلّم المقالة مكتملة عند بلوغ نهايتها. */
function useReadTracker(articleId, endRef) {
  const activeRef = useRef(true);
  useEffect(() => {
    if (!articleId) return;
    let seconds = 0;
    const tick = () => {
      if (!document.hidden && document.hasFocus() && activeRef.current) {
        seconds += 1;
        if (seconds % 5 === 0) flush();
      }
    };
    const flush = () => {
      const s = getStats();
      const cur = s.articles[articleId] || { seconds: 0, completed: false };
      cur.seconds += seconds;
      cur.last_read = new Date().toISOString();
      s.articles[articleId] = cur;
      s.totalSeconds += seconds;
      seconds = 0;
      saveStats(s);
    };
    const onVisible = () => { activeRef.current = !document.hidden; };
    const onFocus = () => { activeRef.current = true; };
    const onBlur = () => { activeRef.current = false; flush(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", flush);
    const timer = setInterval(tick, 1000);
    // Mark completed when end mark scrolls into view
    let observer;
    if (endRef?.current) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const s = getStats();
            const cur = s.articles[articleId] || { seconds: 0, completed: false };
            if (!cur.completed) {
              cur.completed = true;
              cur.completed_at = new Date().toISOString();
              s.articles[articleId] = cur;
              saveStats(s);
            }
          }
        });
      }, { threshold: 0.6 });
      observer.observe(endRef.current);
    }
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", flush);
      if (observer) observer.disconnect();
      flush();
    };
  }, [articleId, endRef]);
}

/* تنسيق الزمن بالأرقام العربية-الهندية */
function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${ar(h)} ساعة و${ar(m)} دقيقة`;
  if (m > 0) return `${ar(m)} دقيقة و${ar(sec)} ثانية`;
  return `${ar(sec)} ثانية`;
}

/* ============================================================
   محتوى المدونة — مقالات تجريبية بحواشٍ انتقالية داخل النص
   ============================================================ */
// Live content: populated at runtime from /api/content/*
let posts = [];
let series = [];
let cats = ["الكلّ"];
let pagesData = [];
let siteSettings = { site_name: "مدونة مهند بن جازي", tagline: "", author: "مهند بن جازي", socials: [], show_excerpt_default: true, footer_line: "" };
let contentLoaded = false;
const contentListeners = new Set();
function bumpContent() { contentListeners.forEach((fn) => fn()); }
function useLiveContent() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    contentListeners.add(fn);
    return () => contentListeners.delete(fn);
  }, []);
}
function ContentBootstrap() {
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, s, c, p, st] = await Promise.all([
          fetch(`${DATA}/articles.json`).then((r) => r.json()),
          fetch(`${DATA}/series.json`).then((r) => r.json()),
          fetch(`${DATA}/categories.json`).then((r) => r.json()),
          fetch(`${DATA}/pages.json`).then((r) => r.json()).catch(() => ({ pages: [] })),
          fetch(`${DATA}/settings.json`).then((r) => r.json()).catch(() => null),
        ]);
        if (!alive) return;
        posts = (a.articles || []).filter((x) => (x.status || "published") === "published").map((x) => ({
          id: x.slug || x.id, slug: x.slug || "", real_id: x.id, title: x.title, cat: x.category, date: x.date,
          excerpt: x.excerpt, show_excerpt: x.show_excerpt, series: x.series, part: x.part,
          cover: x.cover || "",
          cover_outside: x.cover_outside || "",
          body: x.body || [], notes: x.notes || {}, pinned: x.pinned,
          audio_url: x.audio_url || "",
          show_audio: !!x.show_audio,
          youtube_url: x.youtube_url || "",
          show_youtube: !!x.show_youtube,
          references: x.references || [],
          short: x.short || String(x.id || "").slice(0, 6),
          hide_toc: !!x.hide_toc,
          og_image: x.og_image || "",
          show_references: !!x.show_references,
        }));
        series = (s.series || []).map((x) => ({ id: x.id, title: x.title, desc: x.desc || "" }));
        const cs = (c.categories || []).map((x) => x.name);
        cats = ["الكلّ", ...cs];
        pagesData = (p.pages || []);
        if (st) siteSettings = { ...siteSettings, ...st };
        contentLoaded = true;
        bumpContent();
        fetch("/api/subscribe").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.enabled) { newsletterOn = true; bumpContent(); } }).catch(() => {});
      } catch (e) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);
  return null;
}

/* ============================================================
   روابط التواصل (تُحفظ محلّيًا، يعدّلها الكاتب من المحرّر)
   ============================================================ */
const SOCIAL_KEY = "muhannad-social";
function getSocial() {
  try {
    const s = JSON.parse(localStorage.getItem(SOCIAL_KEY) || "{}") || {};
    return { twitter: "", telegram: "", email: "", whatsapp: "", ...s };
  } catch { return { twitter: "", telegram: "", email: "", whatsapp: "" }; }
}
function saveSocial(v) {
  localStorage.setItem(SOCIAL_KEY, JSON.stringify(v));
  window.dispatchEvent(new Event("social-change"));
}
function useSocial() {
  const [s, setS] = useState(getSocial);
  useEffect(() => {
    const h = () => setS(getSocial());
    window.addEventListener("social-change", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("social-change", h); window.removeEventListener("storage", h); };
  }, []);
  return s;
}
function normalizeSocial(kind, value) {
  const v = (value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v) || v.startsWith("mailto:")) return v;
  if (kind === "email") return `mailto:${v}`;
  if (kind === "twitter") return `https://twitter.com/${v.replace(/^@/, "")}`;
  if (kind === "telegram") return `https://t.me/${v.replace(/^@/, "")}`;
  if (kind === "whatsapp") return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
  return v;
}

/* شارة القائمة في الترويسة */
function SavedBadge() {
  const [saved] = useSaved();
  if (!saved.length) return null;
  return <span className="saved-badge" data-testid="saved-badge">{ar(saved.length)}</span>;
}

/* زرّ «تابعني» في أعلى الصفحة (يظهر فقط إذا وُجدت روابط تواصل) */
function FollowButton() {
  useLiveContent();
  const s = useSocial();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!e.target.closest || !e.target.closest("[data-follow-root]")) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);
  const iconFor = (k) => ({ twitter: Twitter, telegram: Send, whatsapp: MessageCircle, email: Mail, youtube: Send, instagram: Send, website: Send })[k] || Send;
  const labelFor = (k) => ({ twitter: "تويتر", telegram: "تيليجرام", whatsapp: "واتساب", email: "البريد", youtube: "يوتيوب", instagram: "إنستغرام", website: "موقع" })[k] || k;
  // Merge: siteSettings.socials override / augment legacy localStorage socials
  const merged = {};
  ["twitter","telegram","whatsapp","email","youtube","instagram","website"].forEach((k) => {
    const v = normalizeSocial(k, s[k]);
    if (v) merged[k] = v;
  });
  (siteSettings.socials || []).forEach((soc) => {
    if (soc && soc.url) merged[soc.kind] = normalizeSocial(soc.kind, soc.url);
  });
  const socials = Object.entries(merged)
    .filter(([, url]) => !!url)
    .map(([key, url]) => ({ key, label: labelFor(key), url, Icon: iconFor(key) }));
  if (socials.length === 0) return null;
  return (
    <div className="follow-root" data-follow-root data-testid="follow-root">
      <button
        type="button"
        className="tool follow-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="follow-btn"
      >
        <UserPlus size={15}/>
        <span>تابعني</span>
      </button>
      {open && (
        <div className="follow-pop" role="menu" data-testid="follow-pop">
          {socials.map(({ key, label, url, Icon }) => (
            <a
              key={key}
              href={url}
              target={key === "email" ? "_self" : "_blank"}
              rel="noopener noreferrer"
              className="follow-item"
              role="menuitem"
              data-testid={`follow-item-${key}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={16}/>
              <span>{label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* زر حفظ للقراءة لاحقًا */
function SaveButton({ id, title }) {
  const [saved, toggle] = useSaved();
  const on = saved.includes(id);
  return (
    <button
      className={`icon-btn ${on ? "on" : ""}`}
      onClick={() => toggle(id)}
      aria-pressed={on}
      aria-label={on ? "إزالة من القائمة" : "حفظ للقراءة لاحقًا"}
      data-testid={`save-${id}`}
      title={title}
    >
      {on ? <BookmarkCheck size={16}/> : <Bookmark size={16}/>}
      <span>{on ? "محفوظة" : "احفظ للقراءة لاحقًا"}</span>
    </button>
  );
}

/* ============================================================
   مكوّنات مساعدة
   ============================================================ */
function Ornament({ item, className = "f-card", cover: coverOverride }) {
  const colors = ["#2C5C8F", "#4A6B5A", "#7A4B4B", "#5B4E7A", "#8A6A2E"];
  const key = item?.id || item?.title || "x";
  const color = colors[key.length % colors.length];
  // Prefer the outside cover, then the inside cover, then an explicit override.
  const src = coverOverride || item?.cover || item?.cover_outside || ""; 
  const [failed, setFailed] = useState(false);
  const abs = (u) => (u && u.startsWith("http")) ? u : (u ? `${process.env.REACT_APP_BACKEND_URL || ""}${u}` : "");
  if (src && !failed) {
    return (
      <div className={`frame ${className}`} data-testid={`cover-${key}`}>
        <img src={abs(src)} alt={item?.title || ""} onError={() => setFailed(true)}
             loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}/>
      </div>
    );
  }
  return (
    <div className={`frame ${className}`} data-testid={`cover-${key}`}>
      <svg viewBox="0 0 300 200" role="img" aria-label="زخرفة هندسية" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`p-${key}`} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(16)">
            <path d="M20 4 L26 14 L36 20 L26 26 L20 36 L14 26 L4 20 L14 14 Z" fill="none" stroke={color} strokeWidth="1" opacity=".55"/>
            <circle cx="20" cy="20" r="2" fill={color} opacity=".35"/>
          </pattern>
        </defs>
        <rect width="300" height="200" fill={color} opacity=".08"/>
        <rect width="300" height="200" fill={`url(#p-${key})`}/>
      </svg>
    </div>
  );
}

function Meta({ post }) {
  return (
    <div className="meta" data-testid={`meta-${post.id}`}>
      <span>{post.date}</span>
      <span className="dot">·</span>
      <span>{post.cat}</span>
    </div>
  );
}

/* ---------- Inline markup parser ----------
   Supported syntax (matches examples requested by author):
     **text**         → bold
     *text*           → italic
     ~text~           → underline
     ~{gold:text}~    → coloured span (canonical form)
     {gold:text}      → coloured span (short form, legacy)
   Colors are read from CSS variables so they follow the theme.
   Nesting is fully supported (bold inside color, color inside bold, …). */
const INLINE_COLORS = {
  gold: "var(--gold, #a88e35)",
  lapis: "var(--lapis, #254a7a)",
  green: "var(--green, #3e6f4a)",
  red: "var(--red, #a44444)",
  muted: "var(--muted, #8b8577)",
};
const _COLOR_KEYS = new Set(Object.keys(INLINE_COLORS));

function _parseInline(text) {
  const out = [];
  let i = 0;
  const pushText = (ch) => {
    if (out.length && out[out.length - 1].t === "s") out[out.length - 1].v += ch;
    else out.push({ t: "s", v: ch });
  };
  while (i < text.length) {
    // **bold**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1 && end > i + 2) {
        out.push({ t: "b", c: _parseInline(text.slice(i + 2, end)) });
        i = end + 2; continue;
      }
    }
    // ~{color:text}~   (supports nesting: matches the balanced closing `}~`)
    if (text[i] === "~" && text[i + 1] === "{") {
      const colon = text.indexOf(":", i + 2);
      if (colon !== -1 && colon < text.length - 2) {
        const color = text.slice(i + 2, colon);
        if (_COLOR_KEYS.has(color)) {
          let depth = 1;
          let k = colon + 1;
          while (k < text.length - 1) {
            if (text[k] === "~" && text[k + 1] === "{") {
              const c2 = text.indexOf(":", k + 2);
              if (c2 !== -1 && c2 < text.length) {
                const c2color = text.slice(k + 2, c2);
                if (_COLOR_KEYS.has(c2color)) { depth++; k = c2 + 1; continue; }
              }
            }
            if (text[k] === "}" && text[k + 1] === "~") {
              depth--;
              if (depth === 0) {
                out.push({ t: "c", color, c: _parseInline(text.slice(colon + 1, k)) });
                i = k + 2;
                break;
              }
              k += 2; continue;
            }
            k++;
          }
          if (depth === 0) continue;
        }
      }
    }
    // ~underline~   (avoid ~{ which is color; require non-space and no newline inside)
    if (text[i] === "~" && text[i + 1] !== "{") {
      const rest = text.slice(i + 1);
      const nl = rest.indexOf("\n");
      const end = rest.indexOf("~");
      if (end !== -1 && (nl === -1 || end < nl) && end > 0) {
        out.push({ t: "u", c: _parseInline(rest.slice(0, end)) });
        i += 1 + end + 1; continue;
      }
    }
    // *italic*   (single star, not **)
    if (text[i] === "*" && text[i + 1] !== "*") {
      const rest = text.slice(i + 1);
      const end = rest.indexOf("*");
      const nl = rest.indexOf("\n");
      if (end !== -1 && (nl === -1 || end < nl) && end > 0 && rest[end - 1] !== "*") {
        out.push({ t: "i", c: _parseInline(rest.slice(0, end)) });
        i += 1 + end + 1; continue;
      }
    }
    // {color:text}   (short form)
    if (text[i] === "{") {
      const close = text.indexOf("}", i + 1);
      if (close !== -1) {
        const colon = text.indexOf(":", i + 1);
        if (colon !== -1 && colon < close) {
          const color = text.slice(i + 1, colon);
          if (_COLOR_KEYS.has(color)) {
            out.push({ t: "c", color, c: _parseInline(text.slice(colon + 1, close)) });
            i = close + 1; continue;
          }
        }
      }
    }
    pushText(text[i]);
    i++;
  }
  return out;
}

function _tokensToNodes(tokens) {
  return tokens.map((tk, i) => {
    if (tk.t === "b") return <strong key={i}>{_tokensToNodes(tk.c)}</strong>;
    if (tk.t === "i") return <em key={i}>{_tokensToNodes(tk.c)}</em>;
    if (tk.t === "u") return <u key={i}>{_tokensToNodes(tk.c)}</u>;
    if (tk.t === "c") return <span key={i} style={{ color: INLINE_COLORS[tk.color] }}>{_tokensToNodes(tk.c)}</span>;
    return tk.v;
  });
}

function renderInline(text) {
  if (!text || typeof text !== "string") return text;
  return _tokensToNodes(_parseInline(text));
}

function _tokensToPlain(tokens) {
  return tokens.map((tk) => tk.t === "s" ? tk.v : _tokensToPlain(tk.c)).join("");
}
function stripInline(text) {
  if (!text || typeof text !== "string") return text || "";
  return _tokensToPlain(_parseInline(text))
    .replace(/⟨\d+⟩/g, "")
    .replace(/[﴿﴾]/g, "");
}

/* Update document.head <meta> tags for social sharing (OG + Twitter cards). */
function useSocialMetaTags({ title, description, image, url, type = "article" }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const originals = {};
    const set = (selector, attr, key, value) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        if (attr === "property") el.setAttribute("property", key);
        else el.setAttribute("name", key);
        document.head.appendChild(el);
      }
      if (originals[key] === undefined) originals[key] = el.getAttribute("content") || "";
      if (value) el.setAttribute("content", value);
    };
    const origTitle = document.title;
    if (title) document.title = title;
    if (title) {
      set(`meta[property="og:title"]`, "property", "og:title", title);
      set(`meta[name="twitter:title"]`, "name", "twitter:title", title);
    }
    if (description) {
      set(`meta[name="description"]`, "name", "description", description);
      set(`meta[property="og:description"]`, "property", "og:description", description);
      set(`meta[name="twitter:description"]`, "name", "twitter:description", description);
    }
    if (image) {
      set(`meta[property="og:image"]`, "property", "og:image", image);
      set(`meta[name="twitter:image"]`, "name", "twitter:image", image);
      set(`meta[name="twitter:card"]`, "name", "twitter:card", "summary_large_image");
    } else {
      set(`meta[name="twitter:card"]`, "name", "twitter:card", "summary");
    }
    if (url) set(`meta[property="og:url"]`, "property", "og:url", url);
    set(`meta[property="og:type"]`, "property", "og:type", type);
    return () => {
      document.title = origTitle;
    };
  }, [title, description, image, url, type]);
}

/* Featured image on the article page. Handles absolute/relative URLs and gracefully
   hides itself if the image fails to load (so we don't leave a dark empty rectangle). */
function FeaturedImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  const abs = src.startsWith("http") ? src : `${process.env.REACT_APP_BACKEND_URL || ""}${src}`;
  return (
    <div className="featured-image" data-testid="featured-image">
      <img src={abs} alt={alt || ""} onError={() => setFailed(true)} loading="eager"/>
    </div>
  );
}

/* الحاشية الانتقالية: تُفتح داخل الفقرة عند الضغط */
function Paragraph({ text, notes, openNote, setOpenNote, pid }) {
  // split by note markers ⟨n⟩ and quranic verse ﴿...﴾ optionally followed by [reference]
  const parts = text.split(/(⟨\d+⟩|﴿[^﴾]*﴾(?:\s*\[[^\]]+\])?)/);
  const usedNotes = [];
  const rendered = parts.map((chunk, i) => {
    if (!chunk) return null;
    const noteMatch = chunk.match(/^⟨(\d+)⟩$/);
    if (noteMatch) {
      const n = parseInt(noteMatch[1], 10);
      usedNotes.push(n);
      const key = `${pid}-${n}`;
      const active = openNote === key;
      return (
        <button
          key={i}
          type="button"
          className={`fn-marker ${active ? "on" : ""}`}
          aria-expanded={active}
          onClick={() => setOpenNote(active ? null : key)}
          data-testid={`fn-marker-${pid}-${n}`}
        >
          {ar(n)}
        </button>
      );
    }
    if (chunk.startsWith("﴿")) {
      const m = chunk.match(/^(﴿[^﴾]*﴾)\s*(?:\[([^\]]+)\])?$/);
      if (m) {
        const verse = m[1];
        const ref = m[2];
        return (
          <span key={i} className="ayah-wrap">
            <span className="ayah" lang="ar">{verse}</span>
            {ref && (
              <span className="ayah-ref" aria-label={`تخريج: ${ref}`} data-testid="ayah-ref">
                [{ref}]
              </span>
            )}
          </span>
        );
      }
    }
    return <span key={i}>{renderInline(chunk)}</span>;
  });
  return (
    <div className={`p-block${text.includes("﴿") ? " has-ayah" : ""}`}>
      <p>{rendered}</p>
      {usedNotes.map((n) => {
        const note = notes?.[n];
        if (!note) return null;
        const key = `${pid}-${n}`;
        const active = openNote === key;
        return (
          <aside
            key={n}
            className={`fn-inline ${active ? "open" : ""}`}
            data-testid={`fn-panel-${pid}-${n}`}
            aria-hidden={!active}
          >
            <div className="fn-kind">
              <span className={`fn-dot k-${note.kind}`} aria-hidden="true"/>
              {note.kind}
            </div>
            <div className="fn-text">{note.text}</div>
          </aside>
        );
      })}
    </div>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("muhannad-theme") : null;
    if (saved) return saved === "dark";
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", dark ? "dark" : "light");
    root.dir = "rtl";
    root.lang = "ar";
    localStorage.setItem("muhannad-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}

/* ============================================================
   الترويسة
   ============================================================ */
function Header() {
  useLiveContent();
  const [dark, setDark] = useTheme();
  const [openSearch, setOpenSearch] = useState(false);
  const [query, setQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname !== "/") setQuery("");
  }, [location.pathname]);
  const params = new URLSearchParams(location.search);
  const activeCat = params.get("cat") || "الكلّ";
  return (
    <header className="site-header" data-testid="site-header">
      <div className="wrap">
        <div className="topbar">
          <button className="tool" onClick={() => setDark(!dark)} data-testid="theme-toggle" aria-label="تبديل الوضع">
            {dark ? <Sun size={15}/> : <Moon size={15}/>}
            <span>{dark ? "الوضع النهاري" : "الوضع الليلي"}</span>
          </button>
          <button className="tool" aria-expanded={openSearch} onClick={() => setOpenSearch(!openSearch)} data-testid="search-toggle">
            <Search size={15}/>
            <span>بحث</span>
          </button>
          <FollowButton/>
        </div>
        <div className="brand">
          <h1><Link to="/" data-testid="brand-link">{siteSettings.site_name || "مدونة مهند بن جازي"}</Link></h1>
        </div>
        {openSearch && (
          <div className="searchbar open">
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (location.pathname !== "/") navigate("/");
                if (typeof window !== "undefined") window.__q = e.target.value;
                window.dispatchEvent(new CustomEvent("blogsearch", { detail: e.target.value }));
              }}
              type="search"
              placeholder="ابحث في المقالات…"
              aria-label="بحث في المقالات"
              data-testid="search-input"
            />
          </div>
        )}
        <div className="rule" aria-hidden="true"/>
        <nav className="cats" aria-label="التصنيفات" data-testid="category-navigation">
          {cats.map((cat) => {
            const to = cat === "الكلّ" ? "/" : `/?cat=${encodeURIComponent(cat)}`;
            const on = activeCat === cat && location.pathname === "/";
            return (
              <Link className={on ? "on" : ""} to={to} key={cat} data-testid={`category-${cat}`}>{cat}</Link>
            );
          })}
          <span className="sep" aria-hidden="true">|</span>
          <Link to="/series" data-testid="nav-series" className={location.pathname.startsWith("/series") ? "on" : ""}>السلاسل</Link>
          <Link to="/books" data-testid="nav-books" className={location.pathname.startsWith("/books") ? "on" : ""}>الكتب</Link>
          <Link to="/saved" data-testid="nav-saved" className={location.pathname === "/saved" ? "on" : ""}>
            قائمتي<SavedBadge/>
          </Link>
          <Link to="/stats" data-testid="nav-stats" className={location.pathname === "/stats" ? "on" : ""}>إحصاءاتي</Link>
          {newsletterOn && <Link to="/newsletter" data-testid="nav-newsletter" className={location.pathname === "/newsletter" ? "on" : ""}>النشرة</Link>}
          <Link to="/about" data-testid="nav-about" className={location.pathname === "/about" ? "on" : ""}>عن المدونة</Link>
          {pagesData.filter((p) => p.in_nav).map((p) => (
            <Link key={p.id} to={`/p/${p.slug}`}
                  data-testid={`nav-page-${p.slug}`}
                  className={location.pathname === `/p/${p.slug}` ? "on" : ""}>{p.title}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

/* ============================================================
   الصفحة الرئيسة
   ============================================================ */
function Home() {
  useLiveContent();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const category = params.get("cat") || "الكلّ";
  const [query, setQuery] = useState("");
  const { overrides, settings } = useOverrides();
  useEffect(() => {
    const h = (e) => setQuery(e.detail || "");
    window.addEventListener("blogsearch", h);
    return () => window.removeEventListener("blogsearch", h);
  }, []);
  const items = posts.filter((p) => {
    const matchCat = category === "الكلّ" || p.cat === category;
    const q = query.trim();
    const matchQ = !q || `${p.title} ${p.excerpt} ${p.cat}`.includes(q);
    return matchCat && matchQ && !p.series; 
  }).map((p) => withOverrides(p, overrides, settings));
  const [first, ...rest] = items;
  return (
    <main className="wrap" data-testid="home-page">
      {first && <ContinueReading/>}
      {!first ? (
        posts.length === 0 ? (
        <p className="empty" data-testid="empty-home">حيّاك الله… نهيّئ لك المقالات</p> 
        ) : (
          <p className="empty" data-testid="empty-home">لا مقالة تطابق بحثك.</p>
        )
      ) : (
        <>
          <article className="lead" data-testid="featured-article">
            <Link to={`/articles/${first.id}`} data-testid="featured-cover" aria-label={first.title}>
              <Ornament item={first} className="f-wide"/>
            </Link>
            <h2><Link to={`/articles/${first.id}`} data-testid="featured-title">{first.title}</Link></h2>
            <Meta post={first}/>
            {first.showExcerpt && <p className="excerpt" data-testid="featured-excerpt">{first.excerpt}</p>}
            <Link className="more" to={`/articles/${first.id}`} data-testid="featured-read-link">
              أكمل القراءة
              <ChevronLeft size={14}/>
            </Link>
          </article>

          {rest.length > 0 && (
            <section className="section" data-testid="recent-articles">
              <p className="eyebrow">مقالات سابقة</p>
              <div className="grid">
                {rest.map((post) => (
                  <article className="card" key={post.id}>
                    <Link to={`/articles/${post.id}`} data-testid={`article-card-${post.id}`}>
                      <Ornament item={post}/>
                      <h3>{post.title}</h3>
                      <Meta post={post}/>
                      {post.showExcerpt && <p className="card-excerpt" data-testid={`card-excerpt-${post.id}`}>{post.excerpt}</p>}
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="section" data-testid="series-section">
            <p className="eyebrow">سلاسل حول موضوعٍ محدَّد</p> 
            <div className="bundles">
              {series.filter((s) => posts.some((p) => p.series === s.id)).map((item) => (
                <article className="bundle" key={item.id}>
                  <Link to={`/series/${item.id}`}><Ornament item={item} className="bundle-frame"/></Link>
                  <div>
                    <Link to={`/series/${item.id}`}><h3>{item.title}</h3></Link>
                    <div className="count">{ar(posts.filter((p) => p.series === item.id).length)} مقالات</div>
                    <p>{item.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/* ============================================================
   السلاسل
   ============================================================ */
function SeriesIndex() {
  useLiveContent();
  return (
    <main className="wrap inner-page" data-testid="series-index">
      <Link className="back" to="/" data-testid="back-home">
        <ChevronLeft size={14}/> عودة إلى الفهرس
      </Link>
      <p className="eyebrow">سلاسل المقالات</p>
      <div className="bundles">
        {series.filter((s) => posts.some((p) => p.series === s.id)).map((item) => ( 
          <article className="bundle" key={item.id}>
            <Link to={`/series/${item.id}`}><Ornament item={item} className="bundle-frame"/></Link>
            <div>
              <Link to={`/series/${item.id}`} data-testid={`series-link-${item.id}`}><h3>{item.title}</h3></Link>
              <div className="count">{ar(posts.filter((p) => p.series === item.id).length)} مقالات</div>
              <p>{item.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function SeriesPage() {
  useLiveContent();
  const { id } = useParams();
  const item = series.find((s) => s.id === id);
  const parts = posts.filter((p) => p.series === id).sort((a, b) => a.part - b.part);
  return (
    <main className="wrap inner-page" data-testid="series-page">
      <div className="serieshead">
        <Link className="back" to="/series"><ChevronLeft size={14}/> كلّ السلاسل</Link>
        
        <h2>{item?.title}</h2>
        <div className="meta"><span>{ar(parts.length)} مقالات</span><span className="dot">·</span><span>مرتّبة للقراءة على الترتيب</span></div>
        <p className="desc">{item?.desc}</p>
      </div>
      <ol className="parts">
        {parts.map((post, index) => (
          <li key={post.id}>
            <Ornament item={post} className="part-cover"/>
            <span className="part-number" data-testid="part-number">{ar(String(index + 1).padStart(2, "0"))}</span>
            <div>
              <Link to={`/articles/${post.id}`}><h3>{post.title}</h3></Link>
              <Meta post={post}/>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

/* ============================================================
   صفحة المقالة — بحواشٍ انتقالية داخل النصّ
   ============================================================ */
/* ---------- Article extras: audio, youtube, references ---------- */
function youtubeId(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0] || "";
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/").filter(Boolean);
    // /embed/<id>, /shorts/<id>, /live/<id>
    const idx = parts.findIndex((p) => ["embed", "shorts", "live"].includes(p));
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts[parts.length - 1] || "";
  } catch { return ""; }
}

function AudioPlayer({ src, title }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [rate, setRate] = useState(1);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onMeta = () => { setDur(a.duration || 0); setReady(true); };
    const onTime = () => setCur(a.currentTime || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);
  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play().then(() => setPlaying(true)).catch(() => {}); }
    else { a.pause(); setPlaying(false); }
  };
  const seek = (e) => {
    const a = audioRef.current; if (!a || !dur) return;
    const t = parseFloat(e.target.value);
    a.currentTime = t; setCur(t);
  };
  const changeRate = () => {
    const opts = [1, 1.25, 1.5, 1.75, 2, 0.75];
    const idx = opts.indexOf(rate);
    const next = opts[(idx + 1) % opts.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };
  const fmt = (t) => {
    if (!Number.isFinite(t)) return "٠٠:٠٠";
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    const pad = (n) => String(n).padStart(2, "0").replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
    return `${pad(m)}:${pad(s)}`;
  };
  return (
    <div className="ap-card" data-testid="article-audio">
      <audio ref={audioRef} src={src} preload="metadata" playsInline/>
      <button className="ap-play" onClick={toggle} aria-label={playing ? "إيقاف مؤقّت" : "استماع"} data-testid="ap-play">
        {playing ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <div className="ap-body">
        <div className="ap-title">
          <Volume2 size={14}/>
          <span>{title || "استمع للمقالة"}</span>
        </div>
        <input type="range" className="ap-seek" min={0} max={dur || 0} step={0.1} value={cur}
               onChange={seek} disabled={!ready} data-testid="ap-seek"
               style={{ "--pct": `${dur ? (cur / dur) * 100 : 0}%` }}/>
        <div className="ap-meta">
          <span className="ap-time">{fmt(cur)} / {fmt(dur)}</span>
          <button className="ap-rate" onClick={changeRate} title="سرعة القراءة" data-testid="ap-rate">
            ×{String(rate).replace(/[0-9]/g, (d) => AR_DIGITS[+d]).replace(".", "٫")}
          </button>
          <a className="ap-dl" href={src} download title="تنزيل" data-testid="ap-download">
            <Download size={14}/>
            <span>تنزيل</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function ArticleExtrasTop({ post }) {
  const [showYt, setShowYt] = useState(false);
  const hasAudio = !!(post?.show_audio && post?.audio_url);
  const ytId = post?.show_youtube ? youtubeId(post?.youtube_url) : "";
  if (!hasAudio && !ytId) return null;
  const audioSrc = hasAudio
    ? (post.audio_url.startsWith("http") ? post.audio_url : `${process.env.REACT_APP_BACKEND_URL || ""}${post.audio_url}`)
    : "";
  return (
    <div className="article-extras-top no-print" data-testid="article-extras-top">
      {hasAudio && <AudioPlayer src={audioSrc} title="استمع للمقالة"/>}
      {ytId && (
        <div className="extra-youtube" data-testid="article-youtube">
          {!showYt ? (
            <button className="yt-toggle" onClick={() => setShowYt(true)} data-testid="yt-open" aria-label="افتح فيديو يوتيوب">
              <Youtube size={16}/>
              <span>شاهد على يوتيوب</span>
            </button>
          ) : (
            <div className="yt-embed">
              <button className="yt-close" onClick={() => setShowYt(false)} data-testid="yt-close" aria-label="إغلاق">×</button>
              <iframe
                title="youtube"
                src={`https://www.youtube.com/embed/${ytId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function refIcon(kind) {
  const map = { web: LinkIcon, youtube: Youtube, book: BookOpen, pdf: FileText, other: ExternalLink };
  const Icon = map[kind] || LinkIcon;
  return <Icon size={14} aria-hidden="true"/>;
}
const REF_LABELS = { web: "صفحة", youtube: "يوتيوب", book: "كتاب", pdf: "PDF", other: "مرجع" };

function ArticleReferences({ post }) {
  const refs = (post?.show_references ? (post?.references || []) : []).filter((r) => r && r.url);
  if (refs.length === 0) return null;
  return (
    <section className="article-refs no-print" data-testid="article-refs">
      <h4 className="refs-title">
        <BookOpen size={16}/>
        <span>المراجع والمصادر</span>
      </h4>
      <ol className="refs-list">
        {refs.map((r, i) => {
          const kind = r.kind || (youtubeId(r.url) ? "youtube" : "web");
          return (
            <li key={i} data-testid={`ref-item-${i}`}>
              <a href={r.url} target="_blank" rel="noreferrer noopener" className={`ref-link kind-${kind}`}>
                <span className="ref-ico">{refIcon(kind)}</span>
                <span className="ref-title">{r.title || r.url}</span>
                <span className="ref-kind">{REF_LABELS[kind] || "مرجع"}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}


/* ============================================================
   الروابط المختصرة
   ============================================================ */
const shortUrl = (post) => `${window.location.origin}/a/${post.short}`;

/* ============================================================
   الاستحسان: نجمة ثُمانية تمتلئ ذهبًا، والعدد مشترك بين القرّاء (يُحفظ في الخادم).
   يختفي كله إن لم يكن الخادم مهيّأً.
   ============================================================ */
const LIKED_KEY = "muhannad-liked";
let likeCounts = null;          // null: لم يُحمَّل أو غير مفعّل
let likesRequested = false;
const likeListeners = new Set();
const bumpLikes = () => likeListeners.forEach((fn) => fn());
function getLiked() {
  try { return JSON.parse(localStorage.getItem(LIKED_KEY) || "[]"); } catch { return []; }
}
function setLiked(list) {
  try { localStorage.setItem(LIKED_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function loadLikes() {
  if (likesRequested) return;
  likesRequested = true;
  fetch("/api/likes").then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (d && d.counts) { likeCounts = d.counts; bumpLikes(); }
  }).catch(() => {});
}
function useLike(articleId) {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    likeListeners.add(fn);
    loadLikes();
    return () => likeListeners.delete(fn);
  }, []);
  const enabled = likeCounts !== null;
  const count = enabled ? (likeCounts[articleId] || 0) : 0;
  const liked = getLiked().includes(articleId);
  const toggle = async () => {
    const next = !liked;
    const list = getLiked().filter((x) => x !== articleId);
    setLiked(next ? [...list, articleId] : list);
    likeCounts = { ...likeCounts, [articleId]: Math.max(0, count + (next ? 1 : -1)) };
    bumpLikes();
    try {
      const r = await fetch(`/api/likes/${articleId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liked: next }),
      });
      if (r.ok) { likeCounts = { ...likeCounts, [articleId]: (await r.json()).count }; bumpLikes(); }
    } catch { /* يبقى التحديث المتفائل */ }
  };
  return { enabled, count, liked, toggle };
}
function likesPhrase(n) {
  if (n === 0) return "كن أوّل من يدعو للكاتب";
  if (n === 1) return "دعا بها قارئٌ واحد";
  if (n === 2) return "دعا بها قارئان";
  if (n <= 10) return `دعا بها ${ar(n)} قرّاء`;
  return `دعا بها ${ar(n)} قارئًا`;
}
function KhatamStar({ size = 18 }) {
  // نجمة ثُمانية (خاتم) من مربّعين متراكبين
  return (
    <svg className="khatam" width={size} height={size} viewBox="2 2 20 20" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14"/>
      <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)"/>
    </svg>
  );
}
function LikeButton({ articleId }) {
  const { enabled, count, liked, toggle } = useLike(articleId);
  if (!enabled) return null;
  return (
    <button className={`icon-btn like-btn ${liked ? "on" : ""}`} onClick={toggle} aria-pressed={liked}
            aria-label={liked ? "التراجع عن الدعاء" : "نفع الله بك"} data-testid="like-btn">
      <KhatamStar size={18}/> <span>نفع الله بك</span>
      {count > 0 && <span className="like-n">{ar(count)}</span>}
    </button>
  );
}
/* دائرة الدعاء: حلقتان رفيعتان وقرص يمتلئ ذهبًا */
function SealRing() {
  return (
    <svg className="seal-ring" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="seal-gold" cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor="#E3C277"/><stop offset=".6" stopColor="#B88A3B"/><stop offset="1" stopColor="#8A6526"/>
        </radialGradient>
      </defs>
      <circle className="sr-outer" cx="100" cy="100" r="97"/>
      <circle className="sr-inner" cx="100" cy="100" r="89"/>
      <circle className="sr-disc" cx="100" cy="100" r="80"/>
    </svg>
  );
}
function Appreciation({ articleId }) {
  const { enabled, count, liked, toggle } = useLike(articleId);
  const [stamp, setStamp] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);
  if (!enabled) return null;
  const click = () => {
    if (!liked) { setStamp(false); requestAnimationFrame(() => setStamp(true)); setTimeout(() => setStamp(false), 1400); }
    toggle();
  };
  return (
    <section ref={ref} className={`appreciate no-print ${liked ? "liked" : ""} ${seen ? "seen" : ""}`} data-testid="appreciate">
      <p className="appr-eyebrow">إن نفعتك المقالة</p>
      <button className={`appr-seal ${stamp ? "stamp" : ""}`} onClick={click} aria-pressed={liked}
              aria-label={liked ? "التراجع عن الدعاء" : "نفع الله بك"} data-testid="appreciate-btn">
        <span className="appr-ripple" aria-hidden="true"/>
        <SealRing/>
        <span className="appr-words"><b>نفع الله</b><b>بك</b></span>
      </button>
      <div className="appr-tally">
        {count > 0 && <span key={count} className="appr-count" data-testid="appreciate-count">{ar(count)}</span>}
        <span className="appr-text">{likesPhrase(count)}</span>
      </div>
      <p className={`appr-reply ${liked ? "show" : ""}`} aria-live="polite">{liked ? "وبك، شكر الله لك." : "اضغط الدائرة لتدعو للكاتب"}</p>
    </section>
  );
}

/* ============================================================
   المشاركة: منشور جاهز (عنوان ومقتطف ورابط مختصر) يُعدَّل قبل الإرسال
   ============================================================ */
function sharePost(post, maxExcerpt = 240) {
  // أسطر متتالية بلا فراغات، وكل سطر يبدأ بحرف عربي كي لا ينقلب اتجاهه في تطبيقات المراسلة
  const title = stripInline(post.title).trim();
  let ex = stripInline(post.excerpt || autoExcerpt(post)).replace(/\s+/g, " ").trim();
  if (ex.length > maxExcerpt) ex = ex.slice(0, maxExcerpt).replace(/\s+\S*$/, "") + "…";
  const site = siteSettings.site_name || "مدونة مهند بن جازي";
  const tag = post.cat ? ` #${post.cat.replace(/\s+/g, "_")}` : "";
  return [`«${title}»`, ex, `اقرأ المقالة كاملة في ${site}:`, shortUrl(post), tag.trim()].filter(Boolean).join("\n");
}
function quotePost(post, quote, max = 600) {
  let q = quote.replace(/\s+/g, " ").trim();
  if (q.length > max) q = q.slice(0, max).replace(/\s+\S*$/, "") + "…";
  const site = siteSettings.site_name || "مدونة مهند بن جازي";
  return [`«${q}»`, `من مقالة «${stripInline(post.title).trim()}» في ${site}:`, shortUrl(post)].join("\n");
}
function SharePanel({ post, quote, onClose }) {
  const original = quote ? quotePost(post, quote) : sharePost(post);
  const [text, setText] = useState(original);
  const [card, setCard] = useState(null); // صورة الاقتباس
  const [cardBusy, setCardBusy] = useState(false);
  const [done, setDone] = useState("");
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const enc = encodeURIComponent;
  const url = shortUrl(post);
  // تويتر يحدّ المنشور بـ٢٨٠ حرفًا، فيأخذ نسخة بمقتطف أقصر
  const xText = text !== original ? text : (quote ? quotePost(post, quote, 170) : sharePost(post, 90));
  const makeCard = async () => {
    setCardBusy(true);
    try {
      const blob = await quoteCard({ quote: quote.replace(/\s+/g, " ").trim(), title: stripInline(post.title).trim(),
        site: siteSettings.site_name || "مدونة مهند بن جازي", url: url.replace(/^https?:\/\//, "") });
      setCard({ blob, src: URL.createObjectURL(blob) });
    } finally { setCardBusy(false); }
  };
  const shareCard = async () => {
    const file = new File([card.blob], "اقتباس.jpg", { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); flash("تمّت المشاركة"); } catch { /* أُلغيت */ }
    } else {
      const a = document.createElement("a"); a.href = card.src; a.download = "اقتباس.jpg"; a.click(); flash("نُزّلت الصورة");
    }
  };
  const flash = (m) => { setDone(m); setTimeout(() => setDone(""), 2200); };
  const copy = async (v, m) => { try { await navigator.clipboard.writeText(v); flash(m); } catch { flash("تعذّر النسخ"); } };
  const native = async () => { try { await navigator.share({ text }); flash("تمّت المشاركة"); } catch { /* أُلغيت */ } };
  return (
    <div className="share-overlay no-print" onClick={onClose} data-testid="share-panel">
      <div className="share-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="مشاركة المقالة">
        <button className="share-close" onClick={onClose} aria-label="إغلاق"><X size={18}/></button>
        <p className="eyebrow">{quote ? "شارك الاقتباس" : "شارك المقالة"}</p>
        <h3>منشورٌ جاهز</h3>
        <p className="share-sub">عدّله إن شئت، ثم اختر أين تنشره.</p>
        <textarea className="share-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} dir="rtl" data-testid="share-text"/>
        <div className="share-link" dir="ltr">
          <LinkIcon size={14}/> <span data-testid="share-short">{url.replace(/^https?:\/\//, "")}</span>
          <button className="icon-btn small" onClick={() => copy(url, "نُسخ الرابط")} data-testid="share-copy-link">نسخ الرابط</button>
        </div>
        <div className="share-targets">
          <a className="share-t x" href={`https://twitter.com/intent/tweet?text=${enc(xText)}`} target="_blank" rel="noopener noreferrer"><Twitter size={16}/> <span>إكس</span></a>
          <a className="share-t tg" href={`https://t.me/share/url?url=${enc(text)}`} target="_blank" rel="noopener noreferrer"><Send size={16}/> <span>تيليجرام</span></a>
          <a className="share-t wa" href={`https://wa.me/?text=${enc(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/> <span>واتساب</span></a>
          <button className="share-t" onClick={() => copy(text, "نُسخ المنشور")} data-testid="share-copy-post"><FileText size={16}/> <span>نسخ المنشور</span></button>
          {typeof navigator !== "undefined" && navigator.share && (
            <button className="share-t" onClick={native} data-testid="share-native"><Share2 size={16}/> <span>تطبيقات أخرى</span></button>
          )}
        </div>
        {quote && (
          <div className="quote-card">
            {card ? (
              <>
                <img src={card.src} alt="صورة الاقتباس" data-testid="quote-card-img"/>
                <button className="share-t" onClick={shareCard} data-testid="quote-card-share"><Share2 size={16}/> <span>شارك الصورة أو نزّلها</span></button>
              </>
            ) : (
              <button className="share-t gold" onClick={makeCard} disabled={cardBusy} data-testid="quote-card-make">
                <FileText size={16}/> <span>{cardBusy ? "نصمّم الصورة…" : "اصنع صورة مزخرفة للاقتباس"}</span>
              </button>
            )}
          </div>
        )}
        <p className="share-done" aria-live="polite">{done}</p>
      </div>
    </div>
  );
}

/* ============================================================
   مدة القراءة وشريط التقدّم
   ============================================================ */
function readingMinutes(post) {
  const words = (post.body || []).reduce((n, b) => {
    const t = typeof b === "string" ? b : (b?.text || "");
    return n + stripInline(t).split(/\s+/).filter(Boolean).length;
  }, 0);
  return Math.max(1, Math.round(words / 180));
}
function minutesLabel(m) {
  if (m === 1) return "دقيقة واحدة";
  if (m === 2) return "دقيقتين";
  if (m <= 10) return `${ar(m)} دقائق`;
  return `${ar(m)} دقيقة`;
}
function ReadProgress({ targetRef }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setPct(total <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / total)));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, [targetRef]);
  return <div className="read-progress no-print" aria-hidden="true"><i style={{ transform: `scaleX(${pct})` }}/></div>;
}

/* ============================================================
   فهرس المقالة (يُخفى من الإعدادات أو لكل مقالة، ويطويه القارئ)
   ============================================================ */
const headingText = (raw) => stripInline(typeof raw === "string" ? raw.slice(1) : (raw?.text || "")).trim();
const isHeading = (raw) => (typeof raw === "string" ? raw.startsWith("#") : raw?.type === "h");
function ArticleToc({ post }) {
  const heads = (post.body || []).map((raw, i) => ({ raw, i })).filter(({ raw }) => isHeading(raw) && headingText(raw));
  const [open, setOpen] = useState(() => { try { return localStorage.getItem("muhannad-toc") !== "closed"; } catch { return true; } });
  if (heads.length < 3 || siteSettings.show_toc === false || post.hide_toc) return null;
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem("muhannad-toc", n ? "open" : "closed"); } catch { /* ignore */ } };
  const go = (e, i) => {
    e.preventDefault();
    const el = document.getElementById(`sec-${i}`);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: "smooth" });
  };
  return (
    <nav className={`toc no-print ${open ? "open" : ""}`} aria-label="فهرس المقالة" data-testid="toc">
      <button className="toc-head" onClick={toggle} aria-expanded={open} data-testid="toc-toggle">
        <span>فهرس المقالة</span><span className="toc-n">{ar(heads.length)} أقسام</span><ChevronLeft size={15} className="toc-chev"/>
      </button>
      {open && (
        <ol>
          {heads.map(({ raw, i }) => <li key={i}><a href={`#sec-${i}`} onClick={(e) => go(e, i)}>{headingText(raw)}</a></li>)}
        </ol>
      )}
    </nav>
  );
}

/* ============================================================
   «واصل القراءة»: يُحفظ موضع القارئ في كل مقالة على جهازه
   ============================================================ */
const RESUME_KEY = "muhannad-resume";
function getResume() { try { return JSON.parse(localStorage.getItem(RESUME_KEY) || "{}") || {}; } catch { return {}; } }
function setResume(m) { try { localStorage.setItem(RESUME_KEY, JSON.stringify(m)); } catch { /* ignore */ } }
function useResumeTracker(post, targetRef) {
  useEffect(() => {
    if (!post) return;
    let t = 0;
    const save = () => {
      t = 0;
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const pct = total <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / total));
      const m = getResume();
      if (pct >= 0.92) delete m[post.id];
      else if (pct > 0.04) m[post.id] = { title: post.title, pct, y: window.scrollY, at: Date.now() };
      setResume(m);
    };
    const on = () => { if (!t) t = setTimeout(save, 600); };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); if (t) clearTimeout(t); };
  }, [post?.id]);
}
function ContinueReading() {
  const [, force] = useState(0);
  const m = getResume();
  const MONTH = 30 * 864e5;
  const last = Object.entries(m)
    .filter(([id, v]) => posts.some((p) => p.id === id) && Date.now() - v.at < MONTH)
    .sort((a, b) => b[1].at - a[1].at)[0];
  if (!last) return null;
  const [id, v] = last;
  const dismiss = () => { const n = getResume(); delete n[id]; setResume(n); force((x) => x + 1); };
  return (
    <aside className="resume-card" data-testid="continue-reading">
      <button className="resume-x" onClick={dismiss} aria-label="إخفاء" data-testid="continue-dismiss"><X size={16}/></button>
      <p className="eyebrow">واصل القراءة</p>
      <Link to={`/articles/${encodeURIComponent(id)}?resume=1`} className="resume-link" data-testid="continue-link">
        <span className="resume-title">{v.title}</span>
        <span className="resume-meta">توقفتَ عند {ar(Math.round(v.pct * 100))}٪ ← تابع من حيث وقفت</span>
      </Link>
      <div className="resume-bar"><i style={{ width: `${Math.round(v.pct * 100)}%` }}/></div>
    </aside>
  );
}

function ArticlePage() {
  useLiveContent();
  const { id } = useParams();
  // توحيد ترتيب الحركات (الشدّة والفتحة مثلًا) كي يُعثر على المقالة مهما نُسخ رابطها
  const nid = String(id || "").normalize("NFC");
  const post = posts.find((p) => p.slug === id || p.id === id || p.real_id === id || String(p.slug).normalize("NFC") === nid);
  const [openNote, setOpenNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [quoteSel, setQuoteSel] = useState(null);   // {text, x, y}
  const [quoteOpen, setQuoteOpen] = useState(null); // نص الاقتباس المفتوح في نافذة المشاركة
  const endRef = useRef(null);
  const essayRef = useRef(null);
  const location = useLocation();
  useEffect(() => { setOpenNote(null); window.scrollTo(0, 0); }, [id]);
  useReadTracker(post?.id, endRef);
  useResumeTracker(post, essayRef);
  useEffect(() => {
    if (!post?.real_id) return;
    try {
      const seen = JSON.parse(sessionStorage.getItem("muhannad-viewed") || "[]");
      if (seen.includes(post.real_id)) return;
      sessionStorage.setItem("muhannad-viewed", JSON.stringify([...seen, post.real_id]));
    } catch { /* ignore */ }
    fetch(`/api/view/${post.real_id}`, { method: "POST", keepalive: true }).catch(() => {});
  }, [post?.real_id]);
  // تحديد نصٍّ من المقالة يُظهر زرّ «شارك الاقتباس» تحته
  useEffect(() => {
    let t = 0;
    const check = () => {
      t = 0;
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      const body = essayRef.current?.querySelector(".body");
      if (!text || text.length < 12 || !sel.rangeCount || !body || !body.contains(sel.anchorNode) || !body.contains(sel.focusNode)) { setQuoteSel(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setQuoteSel({ text, x: r.left + r.width / 2 + window.scrollX, y: r.bottom + window.scrollY + 12 });
    };
    const on = () => { if (t) clearTimeout(t); t = setTimeout(check, 250); };
    document.addEventListener("selectionchange", on);
    return () => { document.removeEventListener("selectionchange", on); if (t) clearTimeout(t); };
  }, [post?.id]);
  // العودة إلى موضع القارئ حين يأتي من «واصل القراءة»
  useEffect(() => {
    if (!post || !new URLSearchParams(location.search).has("resume")) return;
    const v = getResume()[post.id];
    if (v) setTimeout(() => window.scrollTo({ top: v.y, behavior: "smooth" }), 350);
  }, [post?.id, location.search]);
  const related = post ? posts.filter((p) => p.cat === post.cat && p.id !== post.id).slice(0, 3) : [];

  // Next-part card if this article is a series member
  const seriesInfo = post && post.series ? series.find((s) => s.id === post.series) : null;
  const seriesMembers = post && post.series ? posts.filter((p) => p.series === post.series).sort((a, b) => (a.part || 0) - (b.part || 0)) : [];
  const currentIdx = post && post.series ? seriesMembers.findIndex((p) => p.id === post.id) : -1;
  const nextPart = currentIdx >= 0 && currentIdx < seriesMembers.length - 1 ? seriesMembers[currentIdx + 1] : null;
  const prevPart = currentIdx > 0 ? seriesMembers[currentIdx - 1] : null;

  // Social preview (OG/Twitter): auto-populate from post metadata.
  // Prefer the outside (share) cover for social previews; fall back to inside cover.
  const abs = (u) => (u && u.startsWith("http")) ? u : (u ? `${process.env.REACT_APP_BACKEND_URL || ""}${u}` : "");
  const shareTitle = post ? stripInline(post.title) : (siteSettings.site_name || "");
  const shareDesc = post ? stripInline(post.excerpt || autoExcerpt(post)) : "";
  const shareImg = abs(post?.og_image || post?.cover_outside || post?.cover);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  useSocialMetaTags({ title: shareTitle, description: shareDesc, image: shareImg, url: shareUrl, type: "article" });

  if (!post) {
    return (
      <main className="wrap inner-page" data-testid="article-loading">
        <p style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
          {contentLoaded ? "المقالة غير موجودة." : "جاري التحميل…"}
        </p>
      </main>
    );
  }

  async function exportPdf() {
    setBusy(true);
    // expand every footnote so it appears in the PDF
    document.querySelectorAll(".fn-inline").forEach((el) => el.classList.add("open", "pdf-open"));
    const src = document.getElementById("essay-print");
    const filename = `${post.title}.pdf`;
    try {
      await html2pdf()
        .set({
          margin: [14, 14, 16, 14],
          filename,
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#F2F1EC" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(src)
        .save();
    } finally {
      document.querySelectorAll(".pdf-open").forEach((el) => el.classList.remove("open", "pdf-open"));
      setBusy(false);
    }
  }

  return (
    <main className="wrap inner-page" data-testid="article-page">
      <ReadProgress targetRef={essayRef}/>
      <article className="essay" id="essay-print" ref={essayRef}>
        <Link className="back no-print" to="/" data-testid="back-to-home"><ChevronLeft size={14}/> عودة إلى الفهرس</Link>
        {post.series && (
          <div className="serieschip" data-testid="series-chip">
              &nbsp;من <Link to={`/series/${post.series}`}>{series.find((s) => s.id === post.series)?.title}</Link>
            <span className="dot">·</span> الجزء {ar(post.part)}
          </div>
        )}
        <h2 data-testid="article-title">{post.title}</h2>
        <Meta post={post}/>
        <p className="readtime" data-testid="read-time"><Clock size={13}/> تُقرأ في {minutesLabel(readingMinutes(post))}</p>
        <div className="article-actions no-print">
          <SaveButton id={post.id} title={post.title}/>
          <button className="icon-btn" onClick={exportPdf} disabled={busy} data-testid="pdf-export">
            <FileDown size={16}/> <span>{busy ? "جاري التحضير…" : "تصدير PDF"}</span>
          </button>
          <button className="icon-btn" onClick={() => setShareOpen(true)} data-testid="share-btn">
            <Share2 size={16}/> <span>مشاركة</span>
          </button>
          <LikeButton articleId={post.real_id}/>
        </div>
        <Ornament item={post} className="f-wide"/>

        <ArticleExtrasTop post={post}/>
        <ArticleToc post={post}/>

        <div className="body">
          {post.body.map((raw, i) => {
            const isString = typeof raw === "string";
            if (isString && raw === "---") return <hr key={i} className="essay-divider"/>;
            const isObj = !isString;
            if (isObj && raw?.type === "hr") return <hr key={i} className="essay-divider"/>;
            const text = isString ? (raw.startsWith("#") ? raw.slice(1) : raw) : (raw?.text || "");
            const type = isString ? (raw.startsWith("#") ? "h" : "p") : (raw?.type || "p");
            const align = isString ? "" : (raw?.align || "");
            const color = isString ? "" : (raw?.color || "");
            const size = isString ? "" : (raw?.size || "");
            const style = {};
            if (align) { style.textAlign = align; if (align === "justify") style.textAlignLast = "right"; }
            if (color) { style.color = ({gold:"var(--gold, #a88e35)",lapis:"var(--lapis, #254a7a)",green:"var(--green, #3e6f4a)",red:"var(--red, #a44444)",muted:"var(--muted, #8b8577)"})[color]; }
            const sizeClass = size ? `text-size-${size}` : "";
            if (type === "h") return <h3 key={i} id={`sec-${i}`} style={style} className={sizeClass}>{renderInline(text)}</h3>;
            return (
              <div key={i} style={style} className={sizeClass}>
                <Paragraph
                  text={text}
                  notes={post.notes}
                  openNote={openNote}
                  setOpenNote={setOpenNote}
                  pid={post.id}
                />
              </div>
            );
          })}
        </div>
        <ArticleReferences post={post}/>
        <div className="endmark" data-testid="end-mark" ref={endRef} aria-hidden="true">
          <span>❖</span>
        </div>
        <div className="pdf-colophon" aria-hidden="true">
          <div>مدونة مهند بن جازي</div>
          <div>{post.date} · {post.cat}</div>
          <div dir="ltr">{window.location.host}/a/{post.short}</div>
        </div>
      </article>

      <Appreciation articleId={post.real_id}/>
      <div className="share-cta no-print">
        <button className="icon-btn" onClick={() => setShareOpen(true)} data-testid="share-btn-end">
          <Share2 size={16}/> <span>شارك المقالة بمنشورٍ جاهز</span>
        </button>
      </div>
      {shareOpen && <SharePanel post={post} onClose={() => setShareOpen(false)}/>}
      {quoteSel && !quoteOpen && (
        <button className="quote-fab no-print" style={{ left: quoteSel.x, top: quoteSel.y }} data-testid="quote-fab"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setQuoteOpen(quoteSel.text); setQuoteSel(null); }}>
          <Share2 size={14}/> شارك الاقتباس
        </button>
      )}
      {quoteOpen && <SharePanel post={post} quote={quoteOpen} onClose={() => setQuoteOpen(null)}/>}

      {(nextPart || prevPart) && seriesInfo && (
        <section className="series-nav no-print" data-testid="series-nav">
          <div className="series-nav-label">من سلسلة «<Link to={`/series/${seriesInfo.id}`}>{seriesInfo.title}</Link>»</div>
          <div className="series-nav-cards">
            {prevPart && (
              <Link to={`/articles/${prevPart.id}`} className="series-nav-card prev" data-testid="series-prev">
                <span className="sn-eyebrow">الجزء السابق · {ar(prevPart.part)}</span>
                <span className="sn-title">{prevPart.title}</span>
                <span className="sn-hint">→ تابع القراءة</span>
              </Link>
            )}
            {nextPart && (
              <Link to={`/articles/${nextPart.id}`} className="series-nav-card next" data-testid="series-next">
                <span className="sn-eyebrow">الجزء التالي · {ar(nextPart.part)}</span>
                <span className="sn-title">{nextPart.title}</span>
                <span className="sn-hint">← تابع القراءة</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="related no-print" data-testid="related-articles">
          <h4>من التصنيف نفسه</h4>
          <ul>
            {related.map((item) => (
              <li key={item.id}>
                <Link to={`/articles/${item.id}`} data-testid={`related-${item.id}`}>
                  <span>{item.title}</span>
                  <Meta post={item}/>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/* ============================================================
   النشرة البريدية (تظهر حين تُفعَّل قاعدة البيانات)
   ============================================================ */
let newsletterOn = false;
function NewsletterPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ status: "idle", message: "" });
  const [hp, setHp] = useState(""); // حقل مخفي للروبوتات
  async function submit(e) {
    e.preventDefault();
    if (!email) return;
    setState({ status: "loading", message: "" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: hp }),
      });
      if (!res.ok) throw new Error(res.status === 400 ? "تحقّق من صيغة البريد." : "تعذّر الاشتراك الآن، حاول لاحقًا.");
      const data = await res.json();
      const msg = data.already ? "بريدك مشترك من قبل، وستصلك المقالات الجديدة." : "تمّ الاشتراك. ستصلك المقالات الجديدة حين تُنشر.";
      setState({ status: "ok", message: msg });
      setEmail("");
    } catch (err) {
      setState({ status: "err", message: err.message || "حدث خطأ." });
    }
  }
  return (
    <main className="wrap inner-page" data-testid="newsletter-page">
      <Link className="back" to="/"><ChevronLeft size={14}/> عودة إلى الفهرس</Link>
      <div className="page-head">
        <p className="eyebrow">نشرة</p>
        <h2>اشترك في النشرة</h2>
        <p className="desc">يصلك المقال الجديد بمجرّد نشره، ولا يصلك من هذا العنوان شيءٌ سواه.</p>
      </div>
      <form className="news-form" onSubmit={submit} noValidate>
        <label className="visually-hidden" htmlFor="news-email">البريد الإلكتروني</label>
        <div className="news-row">
          <Mail size={16} aria-hidden="true"/>
          <input
            id="news-email"
            type="email"
            required
            placeholder="بريدك الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="newsletter-email"
            dir="ltr"
          />
          <button type="submit" disabled={state.status === "loading"} data-testid="newsletter-submit">
            {state.status === "loading" ? "…" : "اشتراك"}
          </button>
        </div>
        <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}/>
        {state.status === "ok" && <p className="news-msg ok" data-testid="newsletter-success">{state.message}</p>}
        {state.status === "err" && <p className="news-msg err" data-testid="newsletter-error">{state.message}</p>}
      </form>
    </main>
  );
}

/* ============================================================
   قائمة القراءة المحفوظة
   ============================================================ */
function SavedPage() {
  useLiveContent();
  const [saved, toggle] = useSaved();
  const { overrides, settings } = useOverrides();
  const items = posts.filter((p) => saved.includes(p.id)).map((p) => withOverrides(p, overrides, settings));
  return (
    <main className="wrap inner-page" data-testid="saved-page">
      <Link className="back" to="/"><ChevronLeft size={14}/> عودة إلى الفهرس</Link>
      <div className="page-head">
        <p className="eyebrow">قائمة القراءة</p>
        <h2>محفوظاتك</h2>
        <p className="desc">تحفظ محلّيًا على جهازك، بلا حساب ولا خادم. تعود إليها متى شئت من هذه الصفحة.</p>
      </div>
      {items.length === 0 ? (
        <p className="empty" data-testid="empty-saved">قائمتك فارغة. افتح أيّ مقالةٍ واضغط «احفظ للقراءة لاحقًا».</p>
      ) : (
        <ul className="saved-list">
          {items.map((post) => (
            <li key={post.id} data-testid={`saved-item-${post.id}`}>
              <Link to={`/articles/${post.id}`} className="saved-link">
                <h3>{post.title}</h3>
                {post.showExcerpt && <p>{post.excerpt}</p>}
                <Meta post={post}/>
              </Link>
              <button
                className="icon-btn small"
                onClick={() => toggle(post.id)}
                data-testid={`remove-${post.id}`}
                aria-label="إزالة"
              >
                <BookmarkCheck size={16}/> إزالة
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/* ============================================================
   إحصاءات القراءة
   ============================================================ */
function StatsPage() {
  useLiveContent();
  const stats = useStats();
  const items = Object.entries(stats.articles).map(([id, v]) => {
    const post = posts.find((p) => p.id === id);
    return { id, post, ...v };
  }).filter((x) => x.post).sort((a, b) => (b.seconds || 0) - (a.seconds || 0));
  const completed = items.filter((x) => x.completed).length;
  const started = items.length;
  const reset = () => {
    if (window.confirm("هل تريد مسح إحصاءاتك؟ لا يمكن التراجع.")) {
      saveStats({ totalSeconds: 0, articles: {} });
    }
  };
  return (
    <main className="wrap inner-page" data-testid="stats-page">
      <Link className="back" to="/"><ChevronLeft size={14}/> عودة إلى الفهرس</Link>
      <div className="page-head">
        <p className="eyebrow">قراءتك</p>
        <h2>إحصاءاتك</h2>
        <p className="desc">تُحسب محلّيًا على جهازك، ولا تُرسل إلى أيّ خادم. تتوقّف حين تغادر الصفحة، وتستأنف حين تعود.</p>
      </div>
      <div className="stats-cards">
        <div className="stat" data-testid="stat-total-time">
          <Clock size={18}/>
          <div className="stat-value">{formatDuration(stats.totalSeconds)}</div>
          <div className="stat-label">مجموع زمن القراءة</div>
        </div>
        <div className="stat" data-testid="stat-completed">
          <CheckCircle2 size={18}/>
          <div className="stat-value">{ar(completed)} من {ar(posts.length)}</div>
          <div className="stat-label">مقالات أتممتها</div>
        </div>
        <div className="stat" data-testid="stat-started">
          <BarChart3 size={18}/>
          <div className="stat-value">{ar(started)}</div>
          <div className="stat-label">مقالات بدأتَها</div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="empty" data-testid="empty-stats">لا شيء بعد. افتح أيّ مقالةٍ لتبدأ القراءة.</p>
      ) : (
        <ul className="stats-list">
          {items.map((it) => (
            <li key={it.id} data-testid={`stats-row-${it.id}`}>
              <div className="stats-row-title">
                <Link to={`/articles/${it.id}`}><h3>{it.post.title}</h3></Link>
                <Meta post={it.post}/>
              </div>
              <div className="stats-row-meta">
                <span className={`chip ${it.completed ? "chip-done" : "chip-in"}`}>
                  {it.completed ? "أتممتَها" : "في القراءة"}
                </span>
                <span className="stats-time">{formatDuration(it.seconds || 0)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="stats-actions">
          <button className="icon-btn" onClick={reset} data-testid="stats-reset">مسح الإحصاءات</button>
        </div>
      )}
    </main>
  );
}

/* ============================================================
   صفحة الكتب — بتنزيل مباشر
   ============================================================ */
function BooksPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(`${DATA}/books.json`).then((r) => r.json()).then((d) => {
      if (!alive) return;
      setBooks(d.books || []);
      setLoading(false);
    }).catch((e) => { if (alive) { setErr("تعذّر تحميل الكتب."); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  return (
    <main className="wrap inner-page" data-testid="books-page">
      <Link className="back" to="/"><ChevronLeft size={14}/> عودة إلى الفهرس</Link>
      <div className="page-head">
        <p className="eyebrow">مطبوعات</p>
        <h2>الكتب</h2>
      </div>
      {loading ? (
        <p className="empty" data-testid="books-loading">جاري التحميل…</p>
      ) : err ? (
        <p className="empty" data-testid="books-error">{err}</p>
      ) : books.length === 0 ? (
        <p className="empty" data-testid="books-empty">
          لم تُنشر كتبٌ بعد.
          
        </p>
      ) : (
        <div className="books" data-testid="books-list">
          {books.map((b) => (
            <article className="book" key={b.id} data-testid={`book-${b.id}`}>
              <div className="book-cover">
                {b.has_cover ? (
                  <img src={`/books/${b.id}.jpg`} alt={b.title} loading="lazy" data-testid={`book-cover-${b.id}`}/>
                ) : (
                  <>
                    <Ornament item={b} className="book-frame"/>
                    <BookOpen className="book-glyph" size={22} aria-hidden="true"/>
                  </>
                )}
              </div>
              <div className="book-body">
                <h3 data-testid={`book-title-${b.id}`}>{b.title}</h3>
                {b.description && <p>{b.description}</p>}
                <a
                  className="download"
                  href={`/books/${b.id}.pdf`}
                  download={`${b.title}.pdf`}
                  data-testid={`book-download-${b.id}`}
                  aria-label={`تحميل ${b.title}`}
                >
                  <Download size={14}/> تحميل
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

/* ============================================================
   عن المدونة
   ============================================================ */
function About() {
  return (
    <main className="wrap inner-page" data-testid="about-page">
      <div className="about">
        <Link className="back" to="/"><ChevronLeft size={14}/> عودة إلى الفهرس</Link>
        <h2>عن المدونة</h2>
        <p>
          هذه المدونة موضعٌ لِما يطول عن المنشور القصير ويقصر عن الكتاب: مقالاتٌ في العقل والوحي، وفي قضايا الإيمان كما تُطرح اليوم لا كما طُرحت أمس.
        </p>
        <p>
          وما كان منها متّصلًا بمسألةٍ واحدة جُمع في سلسلةٍ تُقرأ على ترتيبها، وما كان مبثوثًا يُقرأ منفردًا. وفي كلّ مقالةٍ حواشٍ انتقاليّةٌ لا تُقتحم على القارئ، وإنّما تُفتح عند الحاجة.
        </p>
        <p className="contact">
          للتواصل: <a href="mailto:mohanndjazi@gmail.com" data-testid="about-email">البريد</a>.
        </p>
      </div>
    </main>
  );
}

/* ============================================================
   التذييل
   ============================================================ */
/* تثبيت المدونة تطبيقًا: يلتقط المتصفح الحدث مبكرًا، فيظهر الزرّ حين يكون التثبيت ممكنًا */
let installPrompt = null;
const installListeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; installListeners.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { installPrompt = null; installListeners.forEach((f) => f()); });
}
function InstallLink() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); installListeners.add(f); return () => installListeners.delete(f); }, []);
  if (!installPrompt) return null;
  const install = async () => { const p = installPrompt; installPrompt = null; p.prompt(); await p.userChoice.catch(() => {}); force((n) => n + 1); };
  return <button className="install-link" onClick={install} data-testid="install-app">ثبّت المدونة على جهازك</button>;
}

function Footer() {
  useLiveContent();
  const s = useSocial();
  const iconFor = (k) => ({ twitter: Twitter, telegram: Send, whatsapp: MessageCircle, email: Mail, youtube: Send, instagram: Send, website: Send })[k] || Send;
  const labelFor = (k) => ({ twitter: "تويتر", telegram: "تيليجرام", whatsapp: "واتساب", email: "البريد", youtube: "يوتيوب", instagram: "إنستغرام", website: "موقع" })[k] || k;
  const merged = {};
  ["twitter","telegram","whatsapp","email","youtube","instagram","website"].forEach((k) => {
    const v = normalizeSocial(k, s[k]);
    if (v) merged[k] = v;
  });
  (siteSettings.socials || []).forEach((soc) => {
    if (soc && soc.url) merged[soc.kind] = normalizeSocial(soc.kind, soc.url);
  });
  const socials = Object.entries(merged).filter(([, url]) => !!url).map(([key, url]) => ({ key, label: labelFor(key), url, Icon: iconFor(key) }));
  return (
    <footer className="site-footer" data-testid="site-footer">
      <div className="inner">
        <Link to="/series" data-testid="footer-series">السلاسل</Link>
        <span className="dot">·</span>
        <Link to="/books" data-testid="footer-books">الكتب</Link>
        <span className="dot">·</span>
        <Link to="/saved" data-testid="footer-saved">قائمتي</Link>
        <span className="dot">·</span>
        {newsletterOn && <><Link to="/newsletter" data-testid="footer-newsletter">النشرة</Link><span className="dot">·</span></>}
        <Link to="/about" data-testid="footer-about">عن المدونة</Link>
        <InstallLink/>
        {socials.length > 0 && (
          <div className="footer-socials" data-testid="footer-socials">
            {socials.map(({ key, label, url, Icon }) => (
              <a
                key={key}
                href={url}
                target={key === "email" ? "_self" : "_blank"}
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                data-testid={`footer-social-${key}`}
              >
                <Icon size={18}/>
              </a>
            ))}
          </div>
        )}
        <div className="copy">{siteSettings.footer_line || `جميع الحقوق محفوظة © ٢٠٢٦ — ${siteSettings.author || "مهند بن جازي"}`}</div>
      </div>
    </footer>
  );
}

/* ============================================================
   الجذر
   ============================================================ */

function PagePublic() {
  useLiveContent();
  const { slug } = useParams();
  const page = pagesData.find((p) => p.slug === slug || p.id === slug);
  useSocialMetaTags({
    title: page ? `${stripInline(page.title)} — ${siteSettings.site_name || ""}` : "",
    description: page ? stripInline((page.body || [])
        .map((b) => (typeof b === "string" ? (b.startsWith("#") ? "" : b) : (b?.text || ""))).join(" ").slice(0, 200)) : "",
    image: "",
    url: typeof window !== "undefined" ? window.location.href : "",
    type: "website",
  });
  if (!page) {
    return (
      <main className="wrap inner-page">
        <p style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
          {contentLoaded ? "الصفحة غير موجودة." : "جاري التحميل…"}
        </p>
      </main>
    );
  }
  return (
    <main className="wrap inner-page" data-testid="public-page">
      <div className="page-head">
        <h2 data-testid="page-title">{page.title}</h2>
      </div>
      <div className="body essay-body">
        {(page.body || []).map((raw, i) => {
          const isString = typeof raw === "string";
          if (isString && raw === "---") return <hr key={i} className="essay-divider"/>;
          if (!isString && raw?.type === "hr") return <hr key={i} className="essay-divider"/>;
          const text = isString ? (raw.startsWith("#") ? raw.slice(1) : raw) : (raw?.text || "");
          const type = isString ? (raw.startsWith("#") ? "h" : "p") : (raw?.type || "p");
          const align = isString ? "" : (raw?.align || "");
          const color = isString ? "" : (raw?.color || "");
          const size = isString ? "" : (raw?.size || "");
          const style = {};
          if (align) { style.textAlign = align; if (align === "justify") style.textAlignLast = "right"; }
          if (color) { style.color = ({gold:"var(--gold, #a88e35)",lapis:"var(--lapis, #254a7a)",green:"var(--green, #3e6f4a)",red:"var(--red, #a44444)",muted:"var(--muted, #8b8577)"})[color]; }
          const sizeClass = size ? `text-size-${size}` : "";
          if (type === "h") return <h3 key={i} style={style} className={sizeClass}>{renderInline(text)}</h3>;
          return <p key={i} style={style} className={sizeClass}>{renderInline(text)}</p>;
        })}
      </div>
    </main>
  );
}

function ShortLinkResolver() {
  const { code } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${DATA}/shortlinks.json`);
        const map = await r.json();
        if (!alive) return;
        nav(map[code] ? `/articles/${encodeURIComponent(map[code])}` : "/", { replace: true });
      } catch {
        nav("/", { replace: true });
      }
    })();
    return () => { alive = false; };
  }, [code, nav]);
  return (
    <main className="wrap inner-page">
      <p style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>جاري التحويل…</p>
    </main>
  );
}

function PublicShell() {
  return (
    <>
      <Header/>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/articles/:id" element={<ArticlePage/>}/>
        <Route path="/series" element={<SeriesIndex/>}/>
        <Route path="/series/:id" element={<SeriesPage/>}/>
        <Route path="/books" element={<BooksPage/>}/>
        <Route path="/saved" element={<SavedPage/>}/>
        <Route path="/stats" element={<StatsPage/>}/>
        <Route path="/about" element={<About/>}/>
        <Route path="/newsletter" element={<NewsletterPage/>}/>
        <Route path="/p/:slug" element={<PagePublic/>}/>
        <Route path="/a/:code" element={<ShortLinkResolver/>}/>
        <Route path="*" element={<Home/>}/>
      </Routes>
      <Footer/>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ContentBootstrap/>
      <Routes>
        <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp/></Suspense>}/>
        <Route path="/*" element={<PublicShell/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
