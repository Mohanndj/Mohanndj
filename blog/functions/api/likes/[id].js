import { json } from "../../_auth.js";

// POST /api/likes/:id  {liked: true|false}
// القارئ بلا حساب؛ يُعرَف بتجزئة عنوانه ومتصفّحه (لا يُحفظ أيٌّ منهما) فلا يستحسن المقالة الواحدة مرتين،
// ولا يتشارك قارئان على شبكة واحدة (جوال أو بيت) استحسانًا واحدًا ما اختلف جهازاهما.
const YEAR = 365 * 86400;

async function readerKey(request, env, id) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("User-Agent") || "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${ua}|${id}|${env.GITHUB_TOKEN || ""}`));
  return `liker:${id}:${[...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function articleExists(env, request, id) {
  const r = await env.ASSETS.fetch(new URL("/data/articles.json", request.url));
  if (!r.ok) return false;
  const { articles } = await r.json();
  return articles.some((a) => a.id === id && (a.status || "published") === "published");
}

export async function onRequestPost({ request, env, params }) {
  if (!env.STORE) return json({ detail: "kv_not_configured" }, 503);
  const id = String(params.id || "");
  if (!/^[0-9a-f]{8}$/.test(id) || !(await articleExists(env, request, id))) return json({ detail: "not_found" }, 404);
  const { liked } = await request.json().catch(() => ({}));
  const rk = await readerKey(request, env, id);
  const had = (await env.STORE.get(rk)) !== null;
  const cur = (await env.STORE.getWithMetadata(`likes:${id}`)).metadata?.n || 0;
  let n = cur;
  if (liked && !had) { n = cur + 1; await env.STORE.put(rk, "1", { expirationTtl: YEAR }); }
  if (!liked && had) { n = Math.max(0, cur - 1); await env.STORE.delete(rk); }
  if (n !== cur) await env.STORE.put(`likes:${id}`, String(n), { metadata: { n } });
  return json({ count: n, liked: !!liked });
}
