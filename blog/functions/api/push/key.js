import { json } from "../../_auth.js";
import { vapidKeys } from "../../_push.js";

// GET /api/push/key  — المفتاح العام الذي يشترك به المتصفح (يتطلب المخزن وقاعدة البيانات)
export async function onRequestGet({ env }) {
  if (!env.STORE || !env.DB) return json({ detail: "push_not_configured" }, 503);
  return json({ publicKey: (await vapidKeys(env)).publicKey }, 200, { "Cache-Control": "public, max-age=3600" });
}
