// جلسة لوحة التحكم: كعكة موقّعة بـ HMAC. مفتاح التوقيع مشتقّ من كلمة السر ومفتاح GitHub،
// فتغيير أيٍّ منهما في Cloudflare يُخرج كل الأجهزة المسجّلة.

export const COOKIE = "blog_admin";
const SESSION_DAYS = 30;
const enc = new TextEncoder();

async function hmacKey(env) {
  return crypto.subtle.importKey("raw", enc.encode(`${env.ADMIN_PASSWORD}\u0000${env.GITHUB_TOKEN}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function configured(env) {
  return !!(env.ADMIN_PASSWORD && env.GITHUB_TOKEN);
}

export async function makeSession(env) {
  const exp = String(Date.now() + SESSION_DAYS * 864e5);
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(exp)));
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function validSession(request, env) {
  if (!configured(env)) return false;
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([\\w-]+)`));
  if (!m || Number(m[1]) < Date.now()) return false;
  const expected = b64url(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(m[1])));
  return timingSafeEqual(expected, m[2]);
}

export function timingSafeEqual(a, b) {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
