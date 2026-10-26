package app.mohanndj.alwaei;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * «الوعي الشخصي» as an Android app: the web app itself (https://mohanndj.github.io/Mohanndj/), opened in the app's own
 * window, so it updates as it does today and works without internet from its saved copy (its service worker). What the
 * window lacks (saving a file, sharing, printing, opening another app, the clipboard, keeping the screen on, vibration)
 * the app gives the page as `WaiNative`, and the page's native.js turns the web's own calls into it.
 */
public class MainActivity extends Activity {
    static final String TAG = "WaiApp";
    static final String BASE = "https://mohanndj.github.io/Mohanndj/";
    private static final int REQ_FILE = 1, REQ_MIC = 2, REQ_LOC = 3, REQ_STORE = 4;
    private static final String NAME = "الوعي الشخصي";

    private WebView web;
    private volatile String pageUrl = BASE; // the page shown: the bridge answers it only
    private ValueCallback<Uri[]> fileCb;
    private PermissionRequest micReq;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    private Object[] pendingSave; // a file waiting for the storage permission (Android 9 and before)

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // the alarm's sound
        s.setTextZoom(100); // the page as in the browser, whatever the phone's font size
        s.setGeolocationEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " WaiApp/" + versionName());
        web.addJavascriptInterface(new Bridge(), "WaiNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        if (state == null || web.restoreState(state) == null) web.loadUrl(BASE);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // the page knows when it is hidden and shown (its «on return» checks); its timers go on (the alarm, the timer)
    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    // back: the page's own steps (it closes what is open, then goes to «اليوم»); with none left, the app goes to
    // the background as Android does, and is still there when opened again
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "1";
        }
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
    }

    private static boolean ours(String url) {
        return url != null && url.startsWith(BASE);
    }

    // a permission asked by a page: the app's own site only (the window never shows another)
    private static boolean ourHost(Uri u) {
        return u != null && "https".equals(u.getScheme()) && "mohanndj.github.io".equals(u.getHost());
    }

    // a link to anywhere else opens in its own app (the browser, WhatsApp, NotebookLM…), never inside this window
    private boolean leave(Uri u) {
        String url = u.toString();
        if (ours(url)) return false;
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        if (scheme.equals("blob") || scheme.equals("data") || scheme.equals("about") || scheme.equals("javascript")) return true;
        try {
            Intent i = scheme.equals("intent") ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            i.setComponent(null);
            i.setSelector(null);
            startActivity(i);
        } catch (Exception e) {
            toast("تعذّر فتح الرابط");
        }
        return true;
    }

    private final class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            return leave(req.getUrl());
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            pageUrl = url;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pageUrl = url;
            // a line in the phone's log for checking the build: the version and the page the app opened on
            view.postDelayed(() -> view.evaluateJavascript(
                    "(function(){try{return JSON.stringify({v:typeof APP_VERSION==='undefined'?null:APP_VERSION,"
                            + "tab:typeof ui==='undefined'?null:ui.tab,bridge:typeof WaiBridge==='undefined'?null:!!WaiBridge})}"
                            + "catch(e){return 'error '+e}})()",
                    r -> Log.i(TAG, "page " + r)), 6000);
        }

        // the first opening needs the internet (after it, the saved copy opens without it)
        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (!req.isForMainFrame()) return;
            Log.w(TAG, "load error " + err.getErrorCode() + " " + err.getDescription());
            view.loadDataWithBaseURL(BASE, "<!doctype html><html dir=rtl lang=ar><meta name=viewport content='width=device-width'>"
                    + "<body style='font-family:sans-serif;background:#0f766e;color:#fff;display:grid;place-items:center;min-height:90vh;text-align:center;margin:0;padding:24px'>"
                    + "<div><h2>" + NAME + "</h2><p>تحتاج إلى الإنترنت في أول فتح للتطبيق، وبعدها يعمل دونه.</p>"
                    + "<button onclick=\"location.replace('" + BASE + "')\" style='font-size:18px;padding:10px 24px;border-radius:12px;border:0'>أعد المحاولة</button></div></body></html>",
                    "text/html", "utf-8", null);
        }
    }

    private final class Chrome extends WebChromeClient {
        // «اختر ملفاً»: a backup to restore, an Excel file, a photo
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (fileCb != null) fileCb.onReceiveValue(null);
            fileCb = cb;
            boolean images = true;
            String[] acc = p.getAcceptTypes();
            if (acc == null || acc.length == 0) images = false;
            else for (String a : acc) if (a == null || !a.startsWith("image/")) images = false;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType(images ? "image/*" : "*/*");
            if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(i, REQ_FILE);
            } catch (Exception e) {
                fileCb = null;
                cb.onReceiveValue(null);
                toast("لا يوجد في جوالك تطبيق لاختيار الملفات");
            }
            return true;
        }

        // the microphone, for this page only
        @Override
        public void onPermissionRequest(PermissionRequest req) {
            runOnUiThread(() -> {
                boolean mic = false;
                for (String r : req.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) mic = true;
                if (!mic || !ourHost(req.getOrigin())) {
                    req.deny();
                    return;
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    if (micReq != null) micReq.deny();
                    micReq = req;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                }
            });
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
            if (origin == null || !ourHost(Uri.parse(origin))) {
                cb.invoke(origin, false, false);
                return;
            }
            if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                cb.invoke(origin, true, false);
            } else {
                geoCb = cb;
                geoOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
            }
        }

        // the page's messages and errors, in the phone's log
        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.i(TAG, "console " + m.messageLevel() + ": " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
            return true;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE && fileCb != null) {
            Uri[] picked = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    picked = new Uri[n];
                    for (int k = 0; k < n; k++) picked[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    picked = new Uri[]{data.getData()};
                }
            }
            fileCb.onReceiveValue(picked);
            fileCb = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (req == REQ_MIC && micReq != null) {
            if (ok) micReq.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else micReq.deny();
            micReq = null;
        } else if (req == REQ_LOC && geoCb != null) {
            geoCb.invoke(geoOrigin, ok, false);
            geoCb = null;
        } else if (req == REQ_STORE && pendingSave != null) {
            Object[] p = pendingSave;
            pendingSave = null;
            if (ok) save((String) p[0], (String) p[1], (byte[]) p[2]);
            else toast("لم يُحفظ الملف: يلزم إذن التخزين");
        }
    }

    private static String clean(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\n\\r\\t]", "-").trim();
        return n.isEmpty() || n.startsWith(".") ? "mahami-file" + n : n;
    }

    private static String mimeOf(String name, String mime) {
        if (mime != null && !mime.isEmpty()) return mime;
        int dot = name.lastIndexOf('.');
        String m = dot < 0 ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase());
        return m == null ? "application/octet-stream" : m;
    }

    // a file the page makes (a backup, Excel, Word, a report's image): saved in «التنزيلات»
    private void save(String name, String mime, byte[] data) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (u == null) throw new IllegalStateException("no uri");
                try (OutputStream o = getContentResolver().openOutputStream(u)) {
                    if (o == null) throw new IllegalStateException("no stream");
                    o.write(data);
                }
            } else {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    pendingSave = new Object[]{name, mime, data};
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORE);
                    return;
                }
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("no folder");
                File f = new File(dir, name);
                int dot = name.lastIndexOf('.');
                for (int k = 1; f.exists(); k++) f = new File(dir, dot < 0 ? name + " (" + k + ")" : name.substring(0, dot) + " (" + k + ")" + name.substring(dot));
                try (FileOutputStream o = new FileOutputStream(f)) {
                    o.write(data);
                }
                MediaScannerConnection.scanFile(this, new String[]{f.getPath()}, new String[]{mime}, null);
            }
            toast("حُفظ في التنزيلات: " + name);
        } catch (Exception e) {
            Log.w(TAG, "save", e);
            toast("تعذّر حفظ الملف");
        }
    }

    // a file handed to another app through the share sheet (a recording to transcribe, a report's image)
    private void shareFile(String name, String mime, byte[] data, String title) {
        try {
            File dir = new File(getCacheDir(), ShareProvider.DIR);
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("no folder");
            File[] old = dir.listFiles();
            long hour = System.currentTimeMillis() - 3600_000L;
            if (old != null) for (File f : old) if (f.lastModified() < hour) f.delete();
            File f = new File(dir, name);
            try (FileOutputStream o = new FileOutputStream(f)) {
                o.write(data);
            }
            Uri u = ShareProvider.uriOf(name);
            Intent i = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, u);
            i.setClipData(ClipData.newRawUri(name, u));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (title != null && !title.isEmpty()) i.putExtra(Intent.EXTRA_SUBJECT, title);
            startActivity(Intent.createChooser(i, title == null || title.isEmpty() ? null : title));
        } catch (Exception e) {
            Log.w(TAG, "share", e);
            toast("تعذّرت المشاركة");
        }
    }

    private void shareText(String text, String title) {
        Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
        if (title != null && !title.isEmpty()) i.putExtra(Intent.EXTRA_SUBJECT, title);
        try {
            startActivity(Intent.createChooser(i, title == null || title.isEmpty() ? null : title));
        } catch (Exception e) {
            toast("تعذّرت المشاركة");
        }
    }

    // the page as the printer sees it (its print styles: the plan of «خطِّط», the CV): print, or save as PDF
    private void printPage(String title) {
        String job = title == null || title.isEmpty() ? NAME : title;
        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
        pm.print(job, web.createPrintDocumentAdapter(job), new PrintAttributes.Builder().build());
    }

    @SuppressWarnings("deprecation")
    private void vibrate(long[] p) {
        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        long sum = 0;
        for (long x : p) sum += x;
        if (p.length == 0 || sum <= 0) {
            v.cancel();
            return;
        }
        if (p.length == 1) {
            v.vibrate(VibrationEffect.createOneShot(p[0], VibrationEffect.DEFAULT_AMPLITUDE));
            return;
        }
        long[] w = new long[p.length + 1]; // the web's pattern starts with a vibration, Android's with a pause
        System.arraycopy(p, 0, w, 1, p.length);
        v.vibrate(VibrationEffect.createWaveform(w, -1));
    }

    /** What the page may ask of the app (native.js). It answers the app's own page only. */
    final class Bridge {
        private boolean allowed() {
            return ours(pageUrl);
        }

        @JavascriptInterface
        public String version() {
            return versionName();
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String b64) {
            if (!allowed()) return;
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            String n = clean(name);
            runOnUiThread(() -> save(n, mimeOf(n, mime), data));
        }

        @JavascriptInterface
        public void shareFile(String name, String mime, String b64, String title) {
            if (!allowed()) return;
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            String n = clean(name);
            runOnUiThread(() -> MainActivity.this.shareFile(n, mimeOf(n, mime), data, title));
        }

        @JavascriptInterface
        public void shareText(String text, String title) {
            if (!allowed()) return;
            runOnUiThread(() -> MainActivity.this.shareText(text, title));
        }

        @JavascriptInterface
        public void print(String title) {
            if (!allowed()) return;
            runOnUiThread(() -> printPage(title));
        }

        @JavascriptInterface
        public void openExternal(String url) {
            if (!allowed() || url == null) return;
            runOnUiThread(() -> leave(Uri.parse(url)));
        }

        @JavascriptInterface
        public void copy(String text) {
            if (!allowed()) return;
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText(NAME, text == null ? "" : text));
            });
        }

        @JavascriptInterface
        public void keepAwake(boolean on) {
            if (!allowed()) return;
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void vibrate(String pattern) {
            if (!allowed() || pattern == null) return;
            String[] parts = pattern.replaceAll("[\\[\\]\\s]", "").split(",");
            long[] p = new long[parts.length];
            int n = 0;
            for (String x : parts) {
                try {
                    p[n++] = Math.max(0, Math.min(10000, Long.parseLong(x)));
                } catch (NumberFormatException e) {
                    n--;
                }
            }
            long[] q = new long[Math.max(0, n)];
            System.arraycopy(p, 0, q, 0, q.length);
            runOnUiThread(() -> MainActivity.this.vibrate(q));
        }

        @JavascriptInterface
        public void exit() {
            if (!allowed()) return;
            runOnUiThread(() -> moveTaskToBack(true));
        }

        @JavascriptInterface
        public void toast(String text) {
            if (!allowed()) return;
            runOnUiThread(() -> MainActivity.this.toast(text == null ? "" : text));
        }
    }
}
