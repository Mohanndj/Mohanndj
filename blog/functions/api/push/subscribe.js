import { json } from "../../_auth.js";
import { db, noDb } from "../../_db.js";

const valid = (s) => s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000
  && s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string" && s.keys.p256dh.length < 200 && s.keys.auth.length < 100;

// POST /api/push/subscribe  {subscription}  — اشتراك القارئ في تنبيهات المقالات الجديدة
export async function onRequestPost({ request, env }) {
  const d = await db(env);
  if (!d) return noDb();
  const { subscription: s } = await request.json().catch(() => ({}));
  if (!valid(s)) return json({ detail: "invalid_subscription" }, 400);
  await d.prepare("INSERT INTO push_subs (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth")
    .bind(s.endpoint, s.keys.p256dh, s.keys.auth, new Date().toISOString()).run();
  return json({ ok: true });
}

// DELETE /api/push/subscribe  {endpoint}  — إيقاف التنبيهات
export async function onRequestDelete({ request, env }) {
  const d = await db(env);
  if (!d) return noDb();
  const { endpoint } = await request.json().catch(() => ({}));
  await d.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(String(endpoint || "")).run();
  return json({ ok: true });
}
