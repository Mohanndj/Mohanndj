// بعد البناء: يولّد لكل صفحة ملف HTML فيه عنوانها ووصفها ونصّها، لتقرأها محركات البحث
// ومعاينات الروابط في تويتر وتيليجرام دون انتظار جافاسكربت. ثم يولّد sitemap و RSS والتحويلات.
import fs from "node:fs";
import path from "node:path";

const SITE = "https://mohanndjazi.com";
const DIST = path.resolve(import.meta.dirname, "../dist");
const DATA = path.resolve(import.meta.dirname, "../public/data");
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

// المسوّدات لا تُنشر
const articles = read("articles.json").articles.filter((a) => (a.status || "published") === "published");
const { series } = read("series.json");
const settings = read("settings.json");
const shortlinks = read("shortlinks.json");
const SITE_NAME = settings.site_name;
const SITE_DESC = "مدونة مهند بن جازي — مقالاتٌ في العقل والوحي وقضايا الإيمان المعاصرة";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plain = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/~\{[a-z]+:/g, "").replace(/\}~/g, "").replace(/⟨\d+⟩/g, "");
const articleUrl = (a) => `/articles/${encodeURIComponent(a.slug || a.id)}`;

function bodyHtml(body) {
  return (body || []).map((raw) => {
    if (raw === "---" || raw?.type === "hr") return "<hr/>";
    const isStr = typeof raw === "string";
    const text = isStr ? raw.replace(/^#/, "") : raw?.text || "";
    const isH = isStr ? raw.startsWith("#") : raw?.type === "h";
    return isH ? `<h3>${esc(plain(text))}</h3>` : `<p>${esc(plain(text)).replace(/\n/g, "<br/>")}</p>`;
  }).join("\n");
}

const template = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

function page(route, { title, description, image, type = "website", content }) {
  const url = SITE + route;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${esc(url)}`)
    .replace(/(<meta property="og:type" content=")[^"]*/, `$1${type}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${esc(url)}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${esc(description)}`);
  if (image) {
    html = html
      .replace(`<meta name="twitter:card" content="summary"/>`, `<meta name="twitter:card" content="summary_large_image"/>`)
      .replace("</head>", `<meta property="og:image" content="${esc(SITE + image)}"/>\n<meta name="twitter:image" content="${esc(SITE + image)}"/>\n</head>`);
  }
  // React يستبدل هذا المحتوى فور تحميله؛ وجوده لمحركات البحث فقط، فلا يُرى في الحالة العادية.
  // وإن لم يكتمل التحميل خلال ٣ ثوانٍ (اتصال بطيء أو جافاسكربت معطّلة) يظهر بدل صفحة فارغة.
  html = html
    .replace("</head>", `<style>.prerender{opacity:0;animation:prerender-show .3s 3s forwards;padding:24px 16px;font-family:Amiri,serif;line-height:1.9}@keyframes prerender-show{to{opacity:1}}</style>\n</head>`)
    .replace('<div id="root"></div>', `<div id="root"><div class="prerender">${content}</div></div>`);
  // /articles/x تُكتب articles/x.html لا articles/x/index.html، كي لا يحوّلها Cloudflare إلى /articles/x/
  const file = route === "/" ? path.join(DIST, "index.html") : path.join(DIST, decodeURIComponent(route) + ".html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const listHtml = (items) => `<ul>${items.map((a) => `<li><a href="${articleUrl(a)}">${esc(a.title)}</a></li>`).join("")}</ul>`;

page("/", { title: SITE_NAME, description: SITE_DESC, content: `<main><h1>${esc(SITE_NAME)}</h1>${listHtml(articles)}</main>` });
for (const a of articles) {
  const description = a.seo_description || a.excerpt || SITE_DESC;
  page(articleUrl(a), {
    title: `${a.seo_title || a.title} — ${SITE_NAME}`,
    description: plain(description).trim(),
    image: a.cover || a.cover_outside || "",
    type: "article",
    content: `<main><article><h1>${esc(a.title)}</h1>${bodyHtml(a.body)}</article></main>`,
  });
}
page("/series", { title: `السلاسل — ${SITE_NAME}`, description: SITE_DESC, content: `<main><h1>السلاسل</h1><ul>${series.map((s) => `<li><a href="/series/${encodeURIComponent(s.id)}">${esc(s.title)}</a></li>`).join("")}</ul></main>` });
for (const s of series) {
  const items = articles.filter((a) => a.series === s.id).sort((x, y) => (x.part || 0) - (y.part || 0));
  page(`/series/${encodeURIComponent(s.id)}`, { title: `${s.title} — ${SITE_NAME}`, description: s.desc || SITE_DESC, content: `<main><h1>${esc(s.title)}</h1><p>${esc(s.desc)}</p>${listHtml(items)}</main>` });
}
page("/books", { title: `الكتب — ${SITE_NAME}`, description: SITE_DESC, content: `<main><h1>الكتب</h1></main>` });
page("/about", { title: `عن المدونة — ${SITE_NAME}`, description: SITE_DESC, content: `<main><h1>عن المدونة</h1></main>` });

// sitemap.xml
const urls = ["/", "/series", "/books", "/about", ...series.map((s) => `/series/${encodeURIComponent(s.id)}`), ...articles.map(articleUrl)];
fs.writeFileSync(path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${SITE}/sitemap.xml\n`);

// feed.xml (RSS)
fs.writeFileSync(path.join(DIST, "feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE_NAME)}</title><link>${SITE}/</link><description>${esc(SITE_DESC)}</description><language>ar</language>
${articles.map((a) => `<item><title>${esc(a.title)}</title><link>${SITE}${articleUrl(a)}</link><guid>${SITE}${articleUrl(a)}</guid><description>${esc(plain(a.excerpt))}</description>${a.published_at ? `<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>` : ""}</item>`).join("\n")}
</channel></rss>
`);

// _redirects (Cloudflare Pages): الروابط المختصرة /a/xxxx، والروابط القديمة لمقالات تغيّر رابطها
const redirects = [
  ...Object.entries(shortlinks).filter(([, slug]) => articles.some((a) => a.slug === slug))
    .map(([code, slug]) => `/a/${code} /articles/${encodeURIComponent(slug)} 301`),
  // كل مقالة لها رابط مختصر، ولو أُضيفت بلا رمز (يُشتقّ من معرّفها كما في الواجهة)
  ...articles.filter((a) => !a.short || !shortlinks[a.short]).map((a) => `/a/${a.short || a.id.slice(0, 6)} ${articleUrl(a)} 301`),
  ...articles.flatMap((a) => (a.old_slugs || []).map((old) => `/articles/${encodeURIComponent(old)} ${articleUrl(a)} 301`)),
];
fs.writeFileSync(path.join(DIST, "_redirects"), redirects.join("\n") + "\n");

console.log(`prerendered ${articles.length} articles, ${series.length} series; sitemap has ${urls.length} urls`);
