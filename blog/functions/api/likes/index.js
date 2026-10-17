import { json } from "../../_auth.js";

// GET /api/likes  — عدد الاستحسانات لكل مقالة، من بيانات المفاتيح دون قراءة كلٍّ منها
export async function onRequestGet({ env }) {
  if (!env.STORE) return json({ detail: "kv_not_configured" }, 503);
  const counts = {};
  let cursor;
  do {
    const r = await env.STORE.list({ prefix: "likes:", cursor });
    for (const k of r.keys) counts[k.name.slice(6)] = k.metadata?.n || 0;
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return json({ counts }, 200, { "Cache-Control": "public, max-age=30" });
}
