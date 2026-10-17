# مدونة مهند بن جازي

نسخة مستقلة من المدونة التي كانت على Emergent، تعمل كملفات ثابتة على **Cloudflare Pages** بلا خادم ولا قاعدة بيانات، وبالشكل نفسه تماماً.

## ما الموجود هنا
- `public/data/` المحتوى كله: المقالات (`articles.json`)، والسلاسل، والتصنيفات، والإعدادات، والكتب، والروابط المختصرة.
- `public/media/` صور المقالات والملف الصوتي.
- `public/books/` كتاب «عقلنة التسليم» وغلافه.
- `src/` كود الواجهة الأصلي، مع تعديلات بسيطة ليقرأ من الملفات بدل الخادم.
- `scripts/prerender.mjs` يولّد عند البناء صفحة HTML لكل مقالة (العنوان والوصف والصورة والنص) لمحركات البحث ومعاينات الروابط، ومعها `sitemap.xml` و`feed.xml` وتحويلات الروابط المختصرة `/a/...`.

روابط المقالات بقيت كما هي: `https://mohanndjazi.com/articles/<الرابط>`.

## ما الذي تغيّر عن النسخة القديمة
- **لوحة الإدارة** (`/admin`) حُذفت. لإضافة مقالة أو تعديلها اطلبها من Claude، أو عدّل `public/data/articles.json`.
- **التعليقات** و**النشرة البريدية** حُذفتا لأنهما تحتاجان خادماً. لم يكن في المدونة أي تعليق منشور.
- الصور ضُغطت (من نحو ٢ ميغابايت إلى نحو ١٥٠ كيلوبايت للصورة) فصارت الصفحات أسرع.
- `sitemap.xml` و`robots.txt` صارا يشيران إلى `mohanndjazi.com`. في النسخة القديمة كانا يشيران إلى نطاق تجريبي من Emergent (`lubab-blog.preview.emergentagent.com`) وفيهما روابط مقالات غير موجودة.
- بريد صفحة «عن المدونة» كان عنواناً وهمياً (`hello@muhannad.example`)، وصار `mohanndjazi@gmail.com`.

## النشر على Cloudflare Pages
1. في Cloudflare: **Workers & Pages ← Create ← Pages ← Connect to Git**، واختر المستودع `mohanndj/mohanndj`.
2. الإعدادات:
   - **Production branch:** الفرع الذي فيه هذا المجلد.
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `blog`
3. اضغط **Save and Deploy**، وجرّب الرابط المؤقت `*.pages.dev`.
4. بعد التأكد: من المشروع **Custom domains ← Set up a custom domain** وأضف `mohanndjazi.com` ثم `www.mohanndjazi.com`. إذا رفض Cloudflare لوجود سجل DNS قديم يشير إلى Emergent، فاحذف ذلك السجل من **DNS ← Records** ثم أعد المحاولة.
5. في **Google Search Console** أرسل `https://mohanndjazi.com/sitemap.xml`.

## التشغيل محلياً
```
npm install
npm run dev      # للتطوير
npm run build    # ينتج المجلد dist
```
