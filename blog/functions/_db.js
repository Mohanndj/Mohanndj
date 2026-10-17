// قاعدة D1 (الربط DB) للإحصاءات والنشرة البريدية.
// منفصلة عن مخزن KV كي لا تستهلك الزياراتُ حصّته اليومية فيتعطّل الدعاء أو الدخول.
import { json } from "./_auth.js";

let ready = null;
export function db(env) {
  if (!env.DB) return null;
  if (!ready) {
    ready = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS views (article_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (article_id, day))"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY, token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS sends (article_id TEXT NOT NULL, sent_at TEXT NOT NULL, recipients INTEGER NOT NULL)"),
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready.then(() => env.DB);
}

export const noDb = () => json({ detail: "db_not_configured" }, 503);

// قائمة المقالات المنشورة من ملفات الموقع نفسه (تُحفظ دقيقة في ذاكرة العامل)
let articlesCache = { at: 0, list: [] };
export async function publishedArticles(env, request) {
  if (Date.now() - articlesCache.at < 60000) return articlesCache.list;
  const r = await env.ASSETS.fetch(new URL("/data/articles.json", request.url));
  const { articles } = r.ok ? await r.json() : { articles: [] };
  articlesCache = { at: Date.now(), list: articles.filter((a) => (a.status || "published") === "published") };
  return articlesCache.list;
}

export const today = () => new Date().toISOString().slice(0, 10);
