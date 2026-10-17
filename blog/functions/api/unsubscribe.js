import { db } from "../_db.js";

// GET /api/unsubscribe?t=<رمز>  — رابط الإلغاء في كل رسالة
const page = (msg) => new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>النشرة البريدية</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri&family=Aref+Ruqaa:wght@700&display=swap"></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F2F1EC;color:#1A1D22;font-family:Amiri,serif;text-align:center;padding:24px">
<div><h1 style="font-family:'Aref Ruqaa',serif;color:#B0873C">مدونة مهند بن جازي</h1><p style="font-size:20px">${msg}</p>
<p><a href="/" style="color:#B0873C">العودة إلى المدونة</a></p></div></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const d = await db(env);
  const t = new URL(request.url).searchParams.get("t") || "";
  if (!d || !/^[0-9a-f]{32}$/.test(t)) return page("الرابط غير صالح.");
  const r = await d.prepare("UPDATE subscribers SET status = 'unsubscribed' WHERE token = ?").bind(t).run();
  return page(r.meta.changes ? "أُلغي اشتراكك، ولن تصلك رسائل النشرة بعد اليوم." : "الاشتراك ملغًى من قبل.");
}
