import { json, requireUser } from "../../_auth.js";
import { db, noDb, publishedArticles } from "../../_db.js";
import { vapidKeys, sendPush } from "../../_push.js";

const plain = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/~\{[a-z]+:/g, "").replace(/\}~/g, "").replace(/⟨\d+⟩/g, "").trim();

// GET /api/push/send  — للمالك: عدد المشتركين وسجلّ الإرسال
export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  const n = await d.prepare("SELECT COUNT(*) AS n FROM push_subs").first();
  const sends = await d.prepare("SELECT article_id, sent_at, delivered FROM push_sends ORDER BY sent_at DESC LIMIT 50").all();
  return json({ subscribers: n?.n || 0, sends: sends.results, enabled: !!env.STORE });
}

// POST /api/push/send  {article_id, force}  — للمالك: تنبيه المشتركين بمقالة منشورة
export async function onRequestPost({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  if (!env.STORE) return json({ detail: "push_not_configured" }, 503);
  const { article_id, force } = await request.json().catch(() => ({}));
  // المقالة يجب أن تكون منشورة على الموقع فعلًا، كي لا يفتح القارئ رابطًا لم يكتمل نشره
  const a = (await publishedArticles(env, request)).find((x) => x.id === article_id);
  if (!a) return json({ detail: "not_live_yet" }, 409);
  const prev = await d.prepare("SELECT sent_at FROM push_sends WHERE article_id = ? ORDER BY sent_at DESC").bind(a.id).first();
  if (prev && !force) return json({ detail: "already_sent", sent_at: prev.sent_at }, 409);
  const { results } = await d.prepare("SELECT endpoint, p256dh, auth FROM push_subs").all();
  if (!results.length) return json({ detail: "no_push_subscribers" }, 400);
  const keys = await vapidKeys(env);
  const data = { title: plain(a.title), body: plain(a.excerpt).slice(0, 140) || "مقالة جديدة في مدونة مهند بن جازي", url: `/a/${a.short || a.id.slice(0, 6)}` };
  let delivered = 0, gone = 0;
  for (let i = 0; i < results.length; i += 20) {
    const batch = results.slice(i, i + 20);
    const res = await Promise.all(batch.map((r) => sendPush(env, { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, data, keys)));
    for (let k = 0; k < res.length; k++) {
      if (res[k] === "ok") delivered++;
      if (res[k] === "gone") { gone++; await d.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(batch[k].endpoint).run(); }
    }
  }
  await d.prepare("INSERT INTO push_sends (article_id, sent_at, delivered) VALUES (?, ?, ?)").bind(a.id, new Date().toISOString(), delivered).run();
  return json({ ok: true, delivered, removed: gone, total: results.length });
}
