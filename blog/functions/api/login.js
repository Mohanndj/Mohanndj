import { configured, makeSession, timingSafeEqual, json, COOKIE } from "../_auth.js";

// POST /api/login  {password}
export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ detail: "not_configured" }, 503);
  let password = "";
  try { password = String((await request.json()).password || ""); } catch { /* ignore */ }
  // إبطاء متعمّد يصعّب تخمين كلمة السر
  await new Promise((r) => setTimeout(r, 800));
  if (!timingSafeEqual(password, env.ADMIN_PASSWORD)) return json({ detail: "invalid_credentials" }, 401);
  return json({ ok: true }, 200, { "Set-Cookie": await makeSession(env) });
}

// DELETE /api/login  (خروج)
export async function onRequestDelete() {
  return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
}
