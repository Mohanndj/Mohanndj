import { requireUser, json } from "../../_auth.js";
import { db, noDb, publishedArticles } from "../../_db.js";

// POST /api/newsletter/send  {article_id}  — للمالك: يرسل المقالة إلى المشتركين عبر Resend
// يحتاج في Cloudflare: RESEND_API_KEY، و NEWSLETTER_FROM (مثل: مدونة مهند بن جازي <news@mohanndjazi.com>)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plain = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/~\{[a-z]+:/g, "").replace(/\}~/g, "").replace(/⟨\d+⟩/g, "");

function emailHtml({ a, site, origin, unsub }) {
  const url = `${origin}/a/${a.short || a.id.slice(0, 6)}`;
  const img = a.og_image || a.cover ? `<img src="${origin}${esc(a.og_image || a.cover)}" alt="" width="560" style="width:100%;max-width:560px;border:0;display:block;margin:0 0 24px">` : "";
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F2F1EC;padding:24px 12px;font-family:Amiri,'Times New Roman',serif;color:#1A1D22">
<div style="max-width:560px;margin:0 auto;background:#FBFAF6;border:1px solid #D8D5CC;padding:28px 24px;text-align:right">
<p style="margin:0 0 18px;color:#B0873C;font-size:16px">${esc(site)}</p>${img}
<h1 style="margin:0 0 14px;font-size:28px;line-height:1.5">${esc(plain(a.title))}</h1>
<p style="margin:0 0 24px;font-size:18px;line-height:1.9;color:#3a3d42">${esc(plain(a.excerpt))}</p>
<p style="margin:0 0 8px"><a href="${url}" style="display:inline-block;background:#1A1D22;color:#F2F1EC;text-decoration:none;padding:12px 22px;font-size:17px">اقرأ المقالة</a></p>
</div>
<p style="max-width:560px;margin:16px auto 0;text-align:center;font-size:13px;color:#8b8577">وصلتك هذه الرسالة لاشتراكك في نشرة ${esc(site)}. <a href="${unsub}" style="color:#8b8577">إلغاء الاشتراك</a></p>
</body></html>`;
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireUser(request, env, { owner: true });
  if (error) return error;
  const d = await db(env);
  if (!d) return noDb();
  if (!env.RESEND_API_KEY || !env.NEWSLETTER_FROM) return json({ detail: "sending_not_configured" }, 503);
  const { article_id, force } = await request.json().catch(() => ({}));
  const a = (await publishedArticles(env, request)).find((x) => x.id === article_id);
  if (!a) return json({ detail: "not_found" }, 404);
  const prev = await d.prepare("SELECT sent_at FROM sends WHERE article_id = ? ORDER BY sent_at DESC").bind(a.id).first();
  if (prev && !force) return json({ detail: "already_sent", sent_at: prev.sent_at }, 409);
  const { results } = await d.prepare("SELECT email, token FROM subscribers WHERE status = 'active'").all();
  if (!results.length) return json({ detail: "no_subscribers" }, 400);
  const origin = new URL(request.url).origin;
  const settings = await (await env.ASSETS.fetch(new URL("/data/settings.json", request.url))).json().catch(() => ({}));
  const site = settings.site_name || "مدونة مهند بن جازي";
  let sent = 0;
  for (let i = 0; i < results.length; i += 100) {
    const batch = results.slice(i, i + 100).map((s) => {
      const unsub = `${origin}/api/unsubscribe?t=${s.token}`;
      return { from: env.NEWSLETTER_FROM, to: [s.email], subject: plain(a.title), html: emailHtml({ a, site, origin, unsub }),
               headers: { "List-Unsubscribe": `<${unsub}>` } };
    });
    const r = await fetch(`${env.RESEND_API || "https://api.resend.com"}/emails/batch`, {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(batch),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      if (sent) await d.prepare("INSERT INTO sends (article_id, sent_at, recipients) VALUES (?, ?, ?)").bind(a.id, new Date().toISOString(), sent).run();
      return json({ detail: "send_failed", sent, provider: detail.slice(0, 300) }, 502);
    }
    sent += batch.length;
  }
  await d.prepare("INSERT INTO sends (article_id, sent_at, recipients) VALUES (?, ?, ?)").bind(a.id, new Date().toISOString(), sent).run();
  return json({ ok: true, sent });
}
