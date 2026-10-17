import { requireUser, hasKv, json, ROLES, normEmail, validEmail, getUser, putUser, listUsers, hashPassword, publicUser } from "../../_auth.js";

// GET /api/users  — للمالك فقط
export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  if (!hasKv(env)) return json({ detail: "kv_not_configured" }, 503);
  const users = await Promise.all((await listUsers(env)).map((u) => getUser(env, u.email)));
  return json({ users: users.filter(Boolean).map(publicUser) });
}

// POST /api/users  {email, name, password, role}
export async function onRequestPost({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  if (!hasKv(env)) return json({ detail: "kv_not_configured" }, 503);
  const b = await request.json().catch(() => ({}));
  const email = normEmail(b.email);
  if (!validEmail(email)) return json({ detail: "invalid_email" }, 400);
  if (!ROLES.includes(b.role)) return json({ detail: "invalid_role" }, 400);
  if (String(b.password || "").length < 8) return json({ detail: "password_too_short" }, 400);
  if (await getUser(env, email)) return json({ detail: "email_exists" }, 409);
  const user = { email, name: String(b.name || "").trim(), role: b.role, ver: 1, created_at: new Date().toISOString(), ...(await hashPassword(b.password)) };
  await putUser(env, user);
  return json(publicUser(user), 201);
}
