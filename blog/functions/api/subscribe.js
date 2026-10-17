import { json, normEmail, validEmail } from "../_auth.js";
import { db, noDb } from "../_db.js";

// GET /api/subscribe  — هل النشرة مفعّلة؟ (يُظهر الموقع رابطها عندئذٍ فقط)
export async function onRequestGet({ env }) {
  return json({ enabled: !!env.DB }, 200, { "Cache-Control": "public, max-age=300" });
}

// POST /api/subscribe  {email, website}
export async function onRequestPost({ request, env }) {
  const d = await db(env);
  if (!d) return noDb();
  const b = await request.json().catch(() => ({}));
  if (b.website) return json({ ok: true }); // حقل مخفي يملؤه الروبوتات وحدها
  const email = normEmail(b.email);
  if (!validEmail(email) || email.length > 200) return json({ detail: "invalid_email" }, 400);
  const token = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const existing = await d.prepare("SELECT status FROM subscribers WHERE email = ?").bind(email).first();
  if (existing?.status === "active") return json({ ok: true, already: true });
  if (existing) await d.prepare("UPDATE subscribers SET status = 'active', token = ? WHERE email = ?").bind(token, email).run();
  else await d.prepare("INSERT INTO subscribers (email, token, status, created_at) VALUES (?, ?, 'active', ?)").bind(email, token, new Date().toISOString()).run();
  return json({ ok: true });
}
