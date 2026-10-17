import { requireUser, json, normEmail } from "../_auth.js";
import { db, noDb } from "../_db.js";

// GET /api/subscribers[?format=csv]  — للمالك
export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  const { results } = await d.prepare("SELECT email, status, created_at FROM subscribers ORDER BY created_at DESC").all();
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const csv = "﻿email,status,created_at\n" + results.map((r) => `${r.email},${r.status},${r.created_at}`).join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="subscribers.csv"' } });
  }
  const sends = await d.prepare("SELECT article_id, sent_at, recipients FROM sends ORDER BY sent_at DESC").all();
  return json({ subscribers: results, sends: sends.results, sending: !!(env.RESEND_API_KEY && env.NEWSLETTER_FROM) });
}

// DELETE /api/subscribers?email=…  — للمالك
export async function onRequestDelete({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  await d.prepare("DELETE FROM subscribers WHERE email = ?").bind(normEmail(new URL(request.url).searchParams.get("email"))).run();
  return json({ ok: true });
}
