import { requireUser, json } from "../_auth.js";
import { db, noDb, publishedArticles } from "../_db.js";

// GET /api/stats  — لأعضاء اللوحة: زيارات كل مقالة ودعوات القرّاء لها، وزيارات آخر ٣٠ يومًا
export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env);
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  const since = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const [per, daily, subs] = await Promise.all([
    d.prepare(`SELECT article_id, SUM(n) AS total, SUM(CASE WHEN day >= ? THEN n ELSE 0 END) AS week,
               SUM(CASE WHEN day >= ? THEN n ELSE 0 END) AS month FROM views GROUP BY article_id`).bind(since(6), since(29)).all(),
    d.prepare("SELECT day, SUM(n) AS n FROM views WHERE day >= ? GROUP BY day ORDER BY day").bind(since(29)).all(),
    d.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE status = 'active'").first(),
  ]);
  const likes = {};
  if (env.STORE) {
    let cursor;
    do {
      const r = await env.STORE.list({ prefix: "likes:", cursor });
      for (const k of r.keys) likes[k.name.slice(6)] = k.metadata?.n || 0;
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);
  }
  const byId = Object.fromEntries(per.results.map((r) => [r.article_id, r]));
  const articles = (await publishedArticles(env, request)).map((a) => ({
    id: a.id, title: a.title, slug: a.slug,
    total: byId[a.id]?.total || 0, week: byId[a.id]?.week || 0, month: byId[a.id]?.month || 0, likes: likes[a.id] || 0,
  }));
  return json({ articles, daily: daily.results, subscribers: subs?.n || 0 });
}
