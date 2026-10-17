// رابط Cloudflare المؤقت يُحوَّل إلى النطاق الأصلي، كي لا يتشتّت القرّاء ومحركات البحث بين عنوانين.
// (نسخ المعاينة <رمز>.mohanndjazi-blog.pages.dev تبقى كما هي للتجربة.)
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === "mohanndjazi-blog.pages.dev") {
    url.hostname = "mohanndjazi.com";
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
