/* ============================================================
   خادم لوحة التحكم: بدل خادم Emergent، تقرأ اللوحة ملفات المحتوى
   من مستودع GitHub وتكتبها فيه (public/data/*.json والوسائط)، عبر الوسيط
   /api/gh في functions/ الذي يحمل مفتاح GitHub ويتحقق من جلسة الدخول.
   كل حفظ = commit واحد على فرع النشر، فيعيد Cloudflare بناء الموقع تلقائيًا.

   تحاكي الدالة api() مسارات الخادم القديم (/admin/articles …) حتى تبقى
   واجهة اللوحة القديمة كما هي.
   ============================================================ */

const REPO = "Mohanndj/Mohanndj";
const BRANCH = __CONTENT_BRANCH__; // يُحدَّد عند البناء (فرع النشر في Cloudflare)
const ROOT = "blog/public";
const GH = "/api/gh";

const FILES = {
  articles: "data/articles.json",
  categories: "data/categories.json",
  series: "data/series.json",
  pages: "data/pages.json",
  settings: "data/settings.json",
  books: "data/books.json",
  shortlinks: "data/shortlinks.json",
};

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const SERVER_ERRORS = {
  not_configured: "لم تُضبط كلمة السر ومفتاح GitHub في إعدادات Cloudflare بعد.",
  github_token_invalid: "مفتاح GitHub في إعدادات Cloudflare غير صالح أو انتهت مدته.",
  invalid_credentials: "كلمة السر خاطئة.",
  unauthorized: "انتهت الجلسة؛ سجّل الدخول من جديد.",
  kv_not_configured: "الحسابات تحتاج ربط مخزن KV في إعدادات Cloudflare أولًا.",
  viewer_read_only: "حسابك «قارئ»: التصفّح فقط دون تعديل.",
  db_not_configured: "تحتاج ربط قاعدة D1 باسم DB في إعدادات Cloudflare أولًا.",
  sending_not_configured: "الإرسال يحتاج إعداد خدمة Resend في Cloudflare.",
  no_subscribers: "لا مشتركين بعد.",
  send_failed: "تعذّر الإرسال من خدمة البريد.",
  not_live_yet: "المقالة لم يكتمل نشرها على الموقع بعد؛ انتظر دقيقة ثم أعد المحاولة.",
  no_push_subscribers: "لم يفعّل أحدٌ التنبيهات بعد.",
  push_not_configured: "التنبيهات تحتاج ربط مخزن KV وقاعدة D1 في إعدادات Cloudflare.",
};

async function errorFrom(r) {
  let detail = "", j = {};
  try { j = await r.json(); detail = j.detail || j.message || ""; } catch { /* ignore */ }
  const e = new ApiError(SERVER_ERRORS[detail] || detail || `خطأ ${r.status}`, r.status);
  e.code = detail; e.data = j;
  return e;
}

export async function login(email, password) {
  const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw await errorFrom(r);
}

// مسارات الحسابات في functions/api
async function server(path, method = "GET", body) {
  const r = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw await errorFrom(r);
  return r.json();
}

export async function logout() {
  cache = null;
  await fetch("/api/login", { method: "DELETE" }).catch(() => {});
}

async function gh(path, { method = "GET", body, accept } = {}) {
  const r = await fetch(`${GH}${path}`, {
    method,
    headers: {
      Accept: accept || "application/vnd.github+json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw await errorFrom(r);
  if (r.status === 204) return null;
  return accept && accept.includes("raw") ? r.text() : r.json();
}

/* ---------- قراءة المحتوى ---------- */

async function headCommit() {
  const ref = await gh(`/repos/${REPO}/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  return ref.object.sha;
}

async function loadAll(sha) {
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    const text = await gh(`/repos/${REPO}/contents/${ROOT}/${f}?ref=${sha}`, { accept: "application/vnd.github.raw+json" });
    return [k, JSON.parse(text)];
  }));
  return Object.fromEntries(entries);
}

let cache = null; // { sha, data }

async function getData({ fresh = false } = {}) {
  if (!cache || fresh) {
    const sha = await headCommit();
    if (!cache || cache.sha !== sha) cache = { sha, data: await loadAll(sha) };
  }
  return cache.data;
}

/* ---------- الكتابة: commit واحد لعدّة ملفات ---------- */

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

async function commit(baseSha, files, message) {
  const base = await gh(`/repos/${REPO}/git/commits/${baseSha}`);
  const tree = await Promise.all(files.map(async (f) => {
    const path = `${ROOT}/${f.path}`;
    if (f.delete) return { path, mode: "100644", type: "blob", sha: null };
    const blob = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: f.base64 != null
      ? { content: f.base64, encoding: "base64" }
      : { content: f.text, encoding: "utf-8" } });
    return { path, mode: "100644", type: "blob", sha: blob.sha };
  }));
  const t = await gh(`/repos/${REPO}/git/trees`, { method: "POST", body: { base_tree: base.tree.sha, tree } });
  const c = await gh(`/repos/${REPO}/git/commits`, { method: "POST", body: { message, tree: t.sha, parents: [baseSha] } });
  await gh(`/repos/${REPO}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: "PATCH", body: { sha: c.sha, force: false } });
  return c.sha;
}

const serialize = (v) => JSON.stringify(v, null, 1) + "\n";

/* يطبّق fn على أحدث نسخة من المحتوى ثم يحفظ ما تغيّر.
   إن سبقه تعديل آخر (من Claude مثلًا) يعيد المحاولة على النسخة الأحدث فلا يضيع شيء. */
async function mutate(message, fn, extraFiles = []) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const sha = await headCommit();
    const data = await loadAll(sha);
    const before = Object.fromEntries(Object.keys(FILES).map((k) => [k, serialize(data[k])]));
    const result = await fn(data);
    const files = [...extraFiles];
    for (const k of Object.keys(FILES)) {
      const after = serialize(data[k]);
      if (after !== before[k]) files.push({ path: FILES[k], text: after });
    }
    if (!files.length) { cache = { sha, data }; return result; }
    try {
      const newSha = await commit(sha, files, message);
      cache = { sha: newSha, data };
      return result;
    } catch (e) {
      if (e.status === 422 && attempt < 2) continue; // الفرع تقدّم أثناء الحفظ
      throw e;
    }
  }
  throw new ApiError("تعذّر الحفظ، حاول مرة أخرى.");
}

/* ---------- أدوات ---------- */

const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const statusOf = (a) => a.status || "published";
const slugify = (s) => String(s || "").trim()
  .replace(/[ً-ْـ]/g, "")      // التشكيل والتطويل
  .replace(/[«»"'()[\]{}﴿﴾:؛،,.!؟?…/\\#%&*+=<>|~^`]/g, "")
  .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

function uniqueSlug(articles, wanted, selfId) {
  const base = slugify(wanted) || hex(4);
  let s = base, n = 2;
  while (articles.some((a) => a.id !== selfId && (a.slug === s || (a.old_slugs || []).includes(s)))) s = `${base}-${n++}`;
  return s;
}

function newShortCode(shortlinks) {
  let c = hex(3);
  while (shortlinks[c]) c = hex(3);
  return c;
}

const ARTICLE_FIELDS = ["slug", "title", "category", "series", "part", "date", "excerpt", "show_excerpt", "cover", "cover_outside",
  "body", "notes", "pinned", "seo_title", "seo_description", "audio_url", "show_audio", "youtube_url", "show_youtube",
  "references", "show_references", "status", "hide_toc", "og_image", "og_key", "toc"];

function cleanArticle(src) {
  const a = {};
  for (const k of ARTICLE_FIELDS) if (k in src) a[k] = src[k];
  if (a.series === "") a.series = null;
  if (a.status !== "draft") a.status = "published"; // لا جدولة في الموقع الثابت
  return a;
}

const withStatus = (a) => ({ ...a, status: statusOf(a) });

/* ---------- الوسائط: معاينة فورية قبل أن ينتهي النشر ---------- */

const localPreviews = new Map();
export const mediaSrc = (u) => (u && localPreviews.get(u)) || u || "";

async function imageToJpeg(file, maxW = 1600) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#F2F1EC"; // للصور الشفافة
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.84));
}

const MAX_FILE = 25 * 1024 * 1024; // حدّ Cloudflare Pages للملف الواحد

export async function uploadMedia(file, kind) {
  let blob = file, ext;
  if (kind === "image") { blob = await imageToJpeg(file); ext = "jpg"; }
  else {
    if (!file.type.startsWith("audio/")) throw new ApiError("الملفّ ليس صوتًا.");
    ext = (file.name.split(".").pop() || "m4a").toLowerCase();
  }
  if (blob.size > MAX_FILE) throw new ApiError("الملفّ كبير — الحدّ ٢٥ ميغا.");
  const name = `${hex(4)}-${hex(2).slice(0, 3)}.${ext}`;
  const sha = await headCommit();
  await commit(sha, [{ path: `media/${name}`, base64: toB64(await blob.arrayBuffer()) }], `Upload ${kind} ${name}`);
  cache = null;
  const url = `/media/${name}`;
  localPreviews.set(url, URL.createObjectURL(blob));
  return { url };
}

/* ---------- الكتب ---------- */

export async function listBooks() {
  return (await getData({ fresh: true })).books.books || [];
}

export async function addBook({ title, description, pdf, cover }) {
  if (pdf.size > MAX_FILE) throw new ApiError("ملف PDF كبير — الحدّ ٢٥ ميغا.");
  const id = crypto.randomUUID();
  const extra = [{ path: `books/${id}.pdf`, base64: toB64(await pdf.arrayBuffer()) }];
  if (cover) {
    const jpg = await imageToJpeg(cover, 900);
    extra.push({ path: `books/${id}.jpg`, base64: toB64(await jpg.arrayBuffer()) });
    localPreviews.set(`/books/${id}.jpg`, URL.createObjectURL(jpg));
  }
  await mutate(`Add book: ${title}`, (d) => {
    d.books.books.unshift({ id, title, description, size: pdf.size, created_at: new Date().toISOString(), has_cover: !!cover });
  }, extra);
}

export async function deleteBook(id) {
  const books = await listBooks();
  const b = books.find((x) => x.id === id);
  if (!b) return;
  const extra = [{ path: `books/${id}.pdf`, delete: true }];
  if (b.has_cover) extra.push({ path: `books/${id}.jpg`, delete: true });
  await mutate(`Delete book: ${b.title}`, (d) => { d.books.books = d.books.books.filter((x) => x.id !== id); }, extra);
}

export async function siteName() {
  try { return (await getData()).settings.site_name || "مدونة مهند بن جازي"; } catch { return "مدونة مهند بن جازي"; }
}

export async function backupJson() {
  const d = await getData({ fresh: true });
  return new Blob([JSON.stringify(d, null, 1)], { type: "application/json" });
}

/* ---------- محاكاة مسارات الخادم القديم ---------- */

export async function api(path, opts = {}) {
  const method = (opts.method || "GET").toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : {};
  const [p, qs] = path.split("?");
  const q = new URLSearchParams(qs || "");
  const seg = p.split("/").filter(Boolean).map(decodeURIComponent); // ["admin","articles",id,...]
  const route = `${method} /${seg.slice(0, 2).join("/")}`;
  const id = seg[2];
  const action = seg[3];

  if (route === "GET /auth/me") {
    const me = await server("/me");
    const repo = await gh(`/repos/${REPO}`);
    if (repo.permissions && !repo.permissions.push) throw new ApiError("مفتاح GitHub لا يملك صلاحية الكتابة في المستودع.", 403);
    return { ...me, email: me.accounts ? me.email : "صاحب المدونة" };
  }
  if (route === "POST /auth/change-password") return server("/password", "POST", body);
  if (route === "GET /admin/stats") return server("/stats");
  if (route === "GET /admin/feedback") return server("/feedback");
  if (route === "DELETE /admin/feedback") return server(`/feedback?id=${encodeURIComponent(id)}`, "DELETE");
  if (route === "GET /admin/subscribers") return server("/subscribers");
  if (route === "DELETE /admin/subscribers") return server(`/subscribers?email=${encodeURIComponent(id)}`, "DELETE");
  if (route === "POST /admin/newsletter") return server("/newsletter/send", "POST", body);
  if (route === "GET /admin/push") return server("/push/send");
  if (route === "POST /admin/push") return server("/push/send", "POST", body);
  if (seg[0] === "admin" && seg[1] === "users") {
    return server(`/users${id ? `/${encodeURIComponent(id)}` : ""}`, method, method === "GET" || method === "DELETE" ? undefined : body);
  }

  /* المقالات */
  if (route === "GET /admin/articles" && !id) {
    const d = await getData({ fresh: true });
    const st = q.get("status");
    return { articles: d.articles.articles.map(withStatus).filter((a) => !st || a.status === st) };
  }
  if (route === "GET /admin/articles") {
    const a = (await getData()).articles.articles.find((x) => x.id === id);
    if (!a) throw new ApiError("المقالة غير موجودة.", 404);
    return withStatus(a);
  }
  if (route === "POST /admin/articles" && !id) {
    return mutate(`New article: ${body.title}`, (d) => {
      const list = d.articles.articles;
      const a = cleanArticle(body);
      a.id = hex(4);
      while (list.some((x) => x.id === a.id)) a.id = hex(4);
      a.slug = uniqueSlug(list, a.slug || a.title, a.id);
      a.short = newShortCode(d.shortlinks);
      d.shortlinks[a.short] = a.slug;
      a.published_at = a.status === "published" ? new Date().toISOString() : null;
      const at = list.findIndex((x) => !x.pinned); // بعد المثبّتة، قبل البقية
      list.splice(at === -1 ? list.length : at, 0, a);
      return withStatus(a);
    });
  }
  if (route === "PUT /admin/articles") {
    return mutate(`Update article: ${body.title}`, (d) => {
      const list = d.articles.articles;
      const i = list.findIndex((x) => x.id === id);
      if (i === -1) throw new ApiError("المقالة غير موجودة.", 404);
      const old = list[i];
      const a = { ...old, ...cleanArticle(body) };
      a.slug = uniqueSlug(list, a.slug || a.title, id);
      if (a.slug !== old.slug && old.slug && statusOf(old) === "published") {
        a.old_slugs = [...new Set([...(old.old_slugs || []), old.slug])]; // الرابط القديم يُحوَّل للجديد
      }
      if (a.short) d.shortlinks[a.short] = a.slug;
      if (a.status === "published" && !a.published_at) a.published_at = new Date().toISOString();
      list[i] = a;
      return withStatus(a);
    });
  }
  if (route === "DELETE /admin/articles") {
    return mutate(`Delete article ${id}`, (d) => {
      const a = d.articles.articles.find((x) => x.id === id);
      d.articles.articles = d.articles.articles.filter((x) => x.id !== id);
      if (a?.short) delete d.shortlinks[a.short];
      return { ok: true };
    });
  }
  if (route === "POST /admin/articles" && action === "duplicate") {
    return mutate(`Duplicate article ${id}`, (d) => {
      const list = d.articles.articles;
      const src = list.find((x) => x.id === id);
      const a = { ...structuredClone(src), id: hex(4), title: `${src.title} (نسخة)`, status: "draft", pinned: false, published_at: null };
      delete a.old_slugs;
      a.slug = uniqueSlug(list, a.title, a.id);
      a.short = newShortCode(d.shortlinks);
      d.shortlinks[a.short] = a.slug;
      list.splice(list.indexOf(src) + 1, 0, a);
      return withStatus(a);
    });
  }
  if (route === "POST /admin/articles" && (action === "pin" || action === "unpin")) {
    return mutate(`${action} article ${id}`, (d) => {
      const a = d.articles.articles.find((x) => x.id === id);
      a.pinned = action === "pin";
      return { ok: true };
    });
  }

  /* التصنيفات (المقالات تحمل اسم التصنيف) */
  if (route === "GET /admin/categories") {
    const d = await getData({ fresh: true });
    const cats = [...d.categories.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    return { categories: cats.map((c) => ({ ...c, article_count: d.articles.articles.filter((a) => a.category === c.name).length })) };
  }
  if (route === "POST /admin/categories" && id === "reorder") {
    return mutate("Reorder categories", (d) => {
      body.order.forEach((cid, i) => { const c = d.categories.categories.find((x) => x.id === cid); if (c) c.order = i + 1; });
      return { ok: true };
    });
  }
  if (route === "POST /admin/categories") {
    return mutate(`New category: ${body.name}`, (d) => {
      const cats = d.categories.categories;
      if (cats.some((c) => c.name === body.name)) throw new ApiError("التصنيف موجود.");
      const c = { id: body.name, name: body.name, order: Math.max(0, ...cats.map((x) => x.order || 0)) + 1 };
      cats.push(c);
      return c;
    });
  }
  if (route === "PUT /admin/categories") {
    return mutate(`Rename category: ${body.name}`, (d) => {
      const c = d.categories.categories.find((x) => x.id === id);
      for (const a of d.articles.articles) if (a.category === c.name) a.category = body.name;
      c.name = body.name;
      return c;
    });
  }
  if (route === "DELETE /admin/categories") {
    return mutate(`Delete category ${id}`, (d) => {
      const c = d.categories.categories.find((x) => x.id === id);
      const to = q.get("reassign_to");
      const target = to ? d.categories.categories.find((x) => x.id === to)?.name : "";
      for (const a of d.articles.articles) if (a.category === c.name) a.category = target || "";
      d.categories.categories = d.categories.categories.filter((x) => x.id !== id);
      return { ok: true };
    });
  }

  /* السلاسل */
  if (route === "GET /admin/series") {
    const d = await getData({ fresh: true });
    return { series: d.series.series.map((s) => ({ ...s, article_count: d.articles.articles.filter((a) => a.series === s.id).length })) };
  }
  if (route === "POST /admin/series") {
    return mutate(`New series: ${body.title}`, (d) => {
      if (d.series.series.some((s) => s.id === body.title)) throw new ApiError("السلسلة موجودة.");
      const s = { id: body.title, title: body.title, desc: body.desc || "", cover: "" };
      d.series.series.push(s);
      return s;
    });
  }
  if (route === "PUT /admin/series") {
    return mutate(`Update series ${id}`, (d) => {
      const s = d.series.series.find((x) => x.id === id);
      Object.assign(s, body, { id: s.id });
      return s;
    });
  }
  if (route === "DELETE /admin/series") {
    return mutate(`Delete series ${id}`, (d) => {
      d.series.series = d.series.series.filter((x) => x.id !== id);
      for (const a of d.articles.articles) if (a.series === id) { a.series = null; a.part = null; }
      return { ok: true };
    });
  }

  /* الصفحات المستقلة */
  if (route === "GET /admin/pages" && !id) return { pages: (await getData({ fresh: true })).pages.pages };
  if (route === "GET /admin/pages") {
    const pg = (await getData()).pages.pages.find((x) => x.id === id);
    if (!pg) throw new ApiError("الصفحة غير موجودة.", 404);
    return pg;
  }
  if (route === "POST /admin/pages") {
    return mutate(`New page: ${body.title}`, (d) => {
      const pg = { id: hex(4), slug: slugify(body.title) || hex(4), title: body.title, body: body.body || [""], in_nav: !!body.in_nav };
      d.pages.pages.push(pg);
      return pg;
    });
  }
  if (route === "PUT /admin/pages") {
    return mutate(`Update page: ${body.title}`, (d) => {
      const i = d.pages.pages.findIndex((x) => x.id === id);
      d.pages.pages[i] = { ...d.pages.pages[i], ...body, id };
      return d.pages.pages[i];
    });
  }
  if (route === "DELETE /admin/pages") {
    return mutate(`Delete page ${id}`, (d) => { d.pages.pages = d.pages.pages.filter((x) => x.id !== id); return { ok: true }; });
  }

  /* الإعدادات */
  if (route === "GET /admin/settings") return (await getData({ fresh: true })).settings;
  if (route === "PUT /admin/settings") {
    return mutate("Update site settings", (d) => { d.settings = { ...d.settings, ...body }; return d.settings; });
  }

  throw new ApiError(`مسار غير معروف: ${method} ${path}`, 404);
}
