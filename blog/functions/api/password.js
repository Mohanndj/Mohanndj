import { requireUser, hasKv, json, checkPassword, hashPassword, putUser, clearSession } from "../_auth.js";

// POST /api/password  {current_password, new_password}  — يغيّر كلمة سر صاحب الجلسة
export async function onRequestPost({ request, env }) {
  const { user, error } = await requireUser(request, env);
  if (error) return error;
  if (!hasKv(env)) return json({ detail: "kv_not_configured" }, 503);
  const b = await request.json().catch(() => ({}));
  if (!(await checkPassword(user, String(b.current_password || "")))) return json({ detail: "wrong_current_password" }, 400);
  const pw = String(b.new_password || "");
  if (pw.length < 8) return json({ detail: "password_too_short" }, 400);
  await putUser(env, { ...user, ...(await hashPassword(pw)), ver: (user.ver || 0) + 1 });
  // رفع الإصدار يُسقط الجلسات القديمة على كل الأجهزة
  return json({ ok: true }, 200, { "Set-Cookie": clearSession() });
}
