import { json } from "../../_auth.js";
import { db, publishedArticles, today } from "../../_db.js";

// POST /api/view/:id  — زيارة واحدة لكل قارئ في الجلسة (يضبطها المتصفح)، ولا يُحفظ عن القارئ شيء
// الروبوتات ومحركات البحث وحدها؛ أمّا متصفّحات التطبيقات (تيليجرام وغيره) فقرّاء حقيقيون
const BOT = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pagespeed/i;

export async function onRequestPost({ request, env, params }) {
  const d = await db(env);
  if (!d) return json({ ok: false }, 202);
  if (BOT.test(request.headers.get("User-Agent") || "")) return json({ ok: false }, 202);
  const id = String(params.id || "");
  if (!/^[0-9a-f]{8}$/.test(id) || !(await publishedArticles(env, request)).some((a) => a.id === id)) return json({ detail: "not_found" }, 404);
  await d.prepare("INSERT INTO views (article_id, day, n) VALUES (?, ?, 1) ON CONFLICT(article_id, day) DO UPDATE SET n = n + 1").bind(id, today()).run();
  return json({ ok: true });
}
