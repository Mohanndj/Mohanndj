import { validSession, configured, json } from "../../_auth.js";

// وسيط بين لوحة التحكم وواجهة GitHub: يضيف مفتاح GitHub المحفوظ في Cloudflare
// فلا يصل المفتاح إلى المتصفح أبدًا، ولا يسمح إلا بمستودع المدونة.
const REPO = "Mohanndj/Mohanndj";

export async function onRequest({ request, env, params }) {
  if (!configured(env)) return json({ detail: "not_configured" }, 503);
  if (!(await validSession(request, env))) return json({ detail: "unauthorized" }, 401);

  const path = "/" + (params.path || []).join("/");
  const allowed = path === `/repos/${REPO}` || path.startsWith(`/repos/${REPO}/git/`) || path.startsWith(`/repos/${REPO}/contents/`);
  if (!allowed) return json({ detail: "forbidden_path" }, 403);

  const url = new URL(request.url);
  const upstream = await fetch(`${env.GITHUB_API || "https://api.github.com"}${path}${url.search}`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: request.headers.get("Accept") || "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mohanndjazi-blog-admin",
      ...(request.method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
  });
  // مفتاح GitHub منتهٍ أو مسحوب: لا نخلط ذلك بانتهاء الجلسة
  if (upstream.status === 401) return json({ detail: "github_token_invalid" }, 502);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" },
  });
}
