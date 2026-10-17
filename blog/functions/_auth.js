// حسابات لوحة التحكم وجلساتها.
//
// الحسابات في Cloudflare KV (الربط STORE)، المفتاح user:<البريد>، وكلمات السر مجزّأة بـ PBKDF2.
// أوّل دخول بكلمة السر ADMIN_PASSWORD (من إعدادات Cloudflare) يُنشئ حساب المالك بالبريد المُدخَل،
// وبعدها لا تُقبل ADMIN_PASSWORD ما دام للموقع مالك. للاسترجاع: احذف مفتاح المالك من KV.
// إن لم يُربط KV بعد، تعمل اللوحة بكلمة السر ADMIN_PASSWORD وحدها كما كانت.
//
// الجلسة كعكة موقّعة بـ HMAC تحمل البريد ورقم إصدار الحساب؛ تغيير كلمة السر يرفع الإصدار
// فتسقط جلسات ذلك الحساب على كل الأجهزة.

export const COOKIE = "blog_admin";
export const ROLES = ["owner", "editor", "viewer"];
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000; // أقصى ما تسمح به Workers
const enc = new TextEncoder();

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

export const configured = (env) => !!(env.ADMIN_PASSWORD && env.GITHUB_TOKEN);
export const hasKv = (env) => !!env.STORE;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hexOf = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function timingSafeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------- كلمات السر ---------- */

async function pbkdf2(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = Uint8Array.from(saltHex.match(/../g), (h) => parseInt(h, 16));
  return hexOf(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256));
}

export async function hashPassword(password) {
  const salt = hexOf(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await pbkdf2(password, salt) };
}

export async function checkPassword(user, password) {
  return timingSafeEqual(await pbkdf2(password, user.salt), user.hash);
}

/* ---------- الحسابات في KV ---------- */

export async function getUser(env, email) {
  return env.STORE.get(`user:${normEmail(email)}`, "json");
}

export async function putUser(env, user) {
  await env.STORE.put(`user:${user.email}`, JSON.stringify(user), { metadata: { role: user.role } });
}

export async function deleteUser(env, email) {
  await env.STORE.delete(`user:${normEmail(email)}`);
}

export async function listUsers(env) {
  const out = [];
  let cursor;
  do {
    const r = await env.STORE.list({ prefix: "user:", cursor });
    out.push(...r.keys);
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return out.map((k) => ({ email: k.name.slice(5), role: k.metadata?.role }));
}

export const publicUser = (u) => ({ id: u.email, email: u.email, name: u.name || "", role: u.role, created_at: u.created_at });

/* ---------- الجلسات ---------- */

async function hmacKey(env) {
  return crypto.subtle.importKey("raw", enc.encode(`${env.ADMIN_PASSWORD}\u0000${env.GITHUB_TOKEN}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
const sign = async (env, payload) => b64url(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload)));

export async function makeSession(env, user) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = `${b64url(enc.encode(user.email))}.${user.ver || 0}.${exp}`;
  return `${COOKIE}=${payload}.${await sign(env, payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearSession = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

// يعيد الحساب صاحب الجلسة، أو null
export async function sessionUser(request, env) {
  if (!configured(env)) return null;
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([\\w-]+)\\.(\\d+)\\.(\\d+)\\.([\\w-]+)`));
  if (!m || Number(m[3]) < Date.now()) return null;
  if (!timingSafeEqual(await sign(env, `${m[1]}.${m[2]}.${m[3]}`), m[4])) return null;
  const email = new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  if (!hasKv(env)) return email === "owner" ? { email: "owner", name: "", role: "owner", ver: 0 } : null;
  const user = await getUser(env, email);
  if (!user || String(user.ver || 0) !== m[2]) return null;
  return user;
}

// حارس مشترك لمسارات الإدارة
export async function requireUser(request, env, { owner = false } = {}) {
  if (!configured(env)) return { error: json({ detail: "not_configured" }, 503) };
  const user = await sessionUser(request, env);
  if (!user) return { error: json({ detail: "unauthorized" }, 401) };
  if (owner && user.role !== "owner") return { error: json({ detail: "owner_only" }, 403) };
  return { user };
}
