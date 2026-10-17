import { configured, hasKv, json, timingSafeEqual, normEmail, validEmail, getUser, putUser, listUsers,
  hashPassword, checkPassword, makeSession, clearSession } from "../_auth.js";

// POST /api/login  {email, password}
export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ detail: "not_configured" }, 503);
  let email = "", password = "";
  try { const b = await request.json(); email = normEmail(b.email); password = String(b.password || ""); } catch { /* ignore */ }
  await new Promise((r) => setTimeout(r, 800)); // إبطاء متعمّد يصعّب التخمين

  let user = null;
  if (!hasKv(env)) {
    // قبل ربط KV: كلمة سر واحدة من إعدادات Cloudflare
    if (timingSafeEqual(password, env.ADMIN_PASSWORD)) user = { email: "owner", ver: 0 };
  } else {
    const found = email && await getUser(env, email);
    if (found) {
      if (await checkPassword(found, password)) user = found;
    } else if (timingSafeEqual(password, env.ADMIN_PASSWORD) && validEmail(email)
               && !(await listUsers(env)).some((u) => u.role === "owner")) {
      // أوّل دخول: يصبح هذا البريد حساب المالك
      user = { email, name: "", role: "owner", ver: 1, created_at: new Date().toISOString(), ...(await hashPassword(password)) };
      await putUser(env, user);
    }
  }
  if (!user) return json({ detail: "invalid_credentials" }, 401);
  return json({ ok: true }, 200, { "Set-Cookie": await makeSession(env, user) });
}

// DELETE /api/login  (خروج)
export async function onRequestDelete() {
  return json({ ok: true }, 200, { "Set-Cookie": clearSession() });
}
