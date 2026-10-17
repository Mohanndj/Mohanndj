import { json, requireUser } from "../_auth.js";
import { db, noDb } from "../_db.js";

// ملاحظات القرّاء واقتراحاتهم — بلا بريد ولا اسم.
// القارئ يُعرَف بتجزئةٍ لعنوانه ومتصفّحه (لا يُحفظ أيٌّ منهما) لمنع الإغراق فقط: خمس رسائل في الساعة.
async function readerHash(request, env) {
  const raw = `${request.headers.get("CF-Connecting-IP") || ""}|${request.headers.get("User-Agent") || ""}|${env.GITHUB_TOKEN || ""}`;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(d)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /api/feedback  {body, page, website}
export async function onRequestPost({ request, env }) {
  const d = await db(env);
  if (!d) return noDb();
  const b = await request.json().catch(() => ({}));
  if (b.website) return json({ ok: true }); // حقل مخفي يملؤه الروبوتات وحدها
  const body = String(b.body || "").trim();
  if (body.length < 3) return json({ detail: "too_short" }, 400);
  if (body.length > 2000) return json({ detail: "too_long" }, 400);
  const reader = await readerHash(request, env);
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const recent = await d.prepare("SELECT COUNT(*) AS n FROM feedback WHERE reader = ? AND created_at > ?").bind(reader, hourAgo).first();
  if ((recent?.n || 0) >= 5) return json({ detail: "rate_limited" }, 429);
  await d.prepare("INSERT INTO feedback (body, page, reader, created_at) VALUES (?, ?, ?, ?)")
    .bind(body, String(b.page || "").slice(0, 200), reader, new Date().toISOString()).run();
  return json({ ok: true });
}

// GET /api/feedback  — لأعضاء اللوحة
export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env);
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  const { results } = await d.prepare("SELECT id, body, page, created_at FROM feedback ORDER BY id DESC LIMIT 500").all();
  return json({ feedback: results });
}

// DELETE /api/feedback?id=…  — للمالك
export async function onRequestDelete({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  await d.prepare("DELETE FROM feedback WHERE id = ?").bind(Number(new URL(request.url).searchParams.get("id"))).run();
  return json({ ok: true });
}
