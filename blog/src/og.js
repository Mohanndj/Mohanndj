/* ============================================================
   بطاقات الصور: بطاقة المقالة (تظهر حين يُشارك رابطها) وبطاقة الاقتباس.
   تُرسم في المتصفح لأنه يصل الحروف العربية صحيحًا، وتُستعمل في لوحة التحكم
   عند نشر المقالة، وفي صفحة المقالة عند مشاركة اقتباس.
   ============================================================ */

const PAPER = "#F2F1EC", INK = "#1A1D22", GOLD = "#B0873C", GOLD_LIGHT = "#E3C277";

async function fontsReady() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('700 64px "Aref Ruqaa"', "مدونة"),
    document.fonts.load('400 32px "Amiri"', "مدونة"),
    document.fonts.load('700 32px "Amiri"', "مدونة"),
  ]).catch(() => {});
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// يقسم النص أسطرًا لا يتجاوز كلٌّ منها العرض المحدّد
function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width <= maxWidth || !line) line = t;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S+$/, "") + "…";
    return { lines: cut, truncated: true };
  }
  return { lines, truncated: false };
}

function coverFit(ctx, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, (w - iw) / 2 - 10, (h - ih) / 2 - 10, iw, ih);
}

function frame(ctx, w, h, color, inset = 26) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
  ctx.strokeRect(inset + 8, inset + 8, w - (inset + 8) * 2, h - (inset + 8) * 2);
  ctx.globalAlpha = 1;
}

function diamond(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
}

const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));

/* بطاقة المقالة ١٢٠٠×٦٣٠: الغلاف خلفيةً، والعنوان بالرقعة على اليمين */
export async function articleCard({ title, category, cover, site, host }) {
  await fontsReady();
  const W = 1200, H = 630;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.direction = "rtl";
  const img = await loadImage(cover);
  if (img) {
    // تمويه خفيف كي لا تنافس كتابةٌ في الغلاف العنوانَ
    ctx.filter = "blur(5px)";
    coverFit(ctx, img, W + 20, H + 20);
    ctx.filter = "none";
    const g = ctx.createLinearGradient(W, 0, 0, 0);
    g.addColorStop(0, "rgba(16,18,22,.95)"); g.addColorStop(.6, "rgba(16,18,22,.86)"); g.addColorStop(1, "rgba(16,18,22,.55)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "#14171C"; ctx.fillRect(0, 0, W, H);
  }
  frame(ctx, W, H, "rgba(227,194,119,.7)");
  const right = W - 92, maxW = 820;
  ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
  if (category) {
    ctx.font = '400 30px "Amiri", serif'; ctx.fillStyle = GOLD_LIGHT;
    ctx.fillText(category, right, 150);
    diamond(ctx, right - ctx.measureText(category).width - 22, 140, 6, GOLD_LIGHT);
  }
  let size = 72, wrapped;
  do { ctx.font = `700 ${size}px "Aref Ruqaa", "Amiri", serif`; wrapped = wrap(ctx, title, maxW, 3); size -= 4; } while (wrapped.truncated && size > 48);
  const lh = (size + 4) * 1.35;
  ctx.fillStyle = "#FBF6EA";
  wrapped.lines.forEach((l, i) => ctx.fillText(l, right, 250 + i * lh));
  ctx.fillStyle = GOLD_LIGHT; ctx.fillRect(right - 120, H - 150, 120, 2);
  ctx.font = '700 36px "Aref Ruqaa", "Amiri", serif'; ctx.fillStyle = GOLD_LIGHT;
  ctx.fillText(site, right, H - 92);
  ctx.font = '400 24px "Amiri", serif'; ctx.fillStyle = "rgba(251,246,234,.75)";
  ctx.direction = "ltr"; ctx.textAlign = "right";
  ctx.fillText(host, right, H - 58);
  return toBlob(c);
}

/* بطاقة الاقتباس ١٠٨٠×١٠٨٠: ورق، وعلامتا تنصيص ذهبيتان، والنص في الوسط */
export async function quoteCard({ quote, title, site, url }) {
  await fontsReady();
  const W = 1080, H = 1080;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  frame(ctx, W, H, GOLD, 40);
  ctx.direction = "rtl"; ctx.textAlign = "center";
  ctx.font = '700 150px "Amiri", serif'; ctx.fillStyle = GOLD; ctx.globalAlpha = .9;
  ctx.direction = "ltr"; ctx.fillText("«", W / 2, 230); ctx.direction = "rtl"; ctx.globalAlpha = 1;
  let size = 52, wrapped;
  do { ctx.font = `400 ${size}px "Amiri", serif`; wrapped = wrap(ctx, quote, W - 220, 8); size -= 3; } while (wrapped.truncated && size > 30);
  const lh = (size + 3) * 1.7;
  const blockH = wrapped.lines.length * lh;
  const top = Math.max(300, (H - blockH) / 2 + 20);
  ctx.fillStyle = INK;
  wrapped.lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));
  const after = top + blockH + 30;
  diamond(ctx, W / 2, after, 7, GOLD);
  ctx.font = '400 30px "Amiri", serif'; ctx.fillStyle = "#5E6167";
  const t = wrap(ctx, `من مقالة «${title}»`, W - 260, 2);
  t.lines.forEach((l, i) => ctx.fillText(l, W / 2, after + 62 + i * 44));
  ctx.font = '700 40px "Aref Ruqaa", "Amiri", serif'; ctx.fillStyle = GOLD;
  ctx.fillText(site, W / 2, H - 120);
  ctx.font = '400 26px "Amiri", serif'; ctx.fillStyle = "#5E6167"; ctx.direction = "ltr";
  ctx.fillText(url, W / 2, H - 78);
  return toBlob(c);
}
