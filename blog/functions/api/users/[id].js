import { requireUser, hasKv, json, ROLES, getUser, putUser, deleteUser, listUsers, hashPassword, publicUser } from "../../_auth.js";

const otherOwners = async (env, email) => (await listUsers(env)).filter((u) => u.role === "owner" && u.email !== email).length;

// PUT /api/users/:email  {role} | {password} | {name}
export async function onRequestPut({ request, env, params }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  if (!hasKv(env)) return json({ detail: "kv_not_configured" }, 503);
  const user = await getUser(env, decodeURIComponent(params.id));
  if (!user) return json({ detail: "not_found" }, 404);
  const b = await request.json().catch(() => ({}));
  const next = { ...user };
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return json({ detail: "invalid_role" }, 400);
    if (user.role === "owner" && b.role !== "owner" && !(await otherOwners(env, user.email))) return json({ detail: "cannot_demote_last_owner" }, 400);
    next.role = b.role;
  }
  if (b.password !== undefined) {
    if (String(b.password).length < 8) return json({ detail: "password_too_short" }, 400);
    Object.assign(next, await hashPassword(String(b.password)));
    next.ver = (user.ver || 0) + 1; // يُخرجه من أجهزته
  }
  if (b.name !== undefined) next.name = String(b.name).trim();
  await putUser(env, next);
  return json(publicUser(next));
}

// DELETE /api/users/:email
export async function onRequestDelete({ request, env, params }) {
  const { user: me, error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  if (!hasKv(env)) return json({ detail: "kv_not_configured" }, 503);
  const email = decodeURIComponent(params.id);
  if (email === me.email) return json({ detail: "cannot_delete_self" }, 400);
  const user = await getUser(env, email);
  if (!user) return json({ detail: "not_found" }, 404);
  if (user.role === "owner" && !(await otherOwners(env, email))) return json({ detail: "cannot_delete_last_owner" }, 400);
  await deleteUser(env, email);
  return json({ ok: true });
}
