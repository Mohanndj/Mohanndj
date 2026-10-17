import { requireUser, hasKv, json, publicUser } from "../_auth.js";

// GET /api/me
export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env);
  if (error) return error;
  return json({ ...publicUser(user), accounts: hasKv(env) });
}
