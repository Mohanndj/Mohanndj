package app.mohanndj.alwaei;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Scanner;

/**
 * v152, the owner: «أريد أن أضيف شيئا كاليوتيوب يحجب عني الإعلانات وفي نفس الوقت لو أردت أتابع تابعت». YouTube's own
 * site inside the app, in a window of its own (opened by «يوتيوب» in «المزيد», WaiNative.openYoutube): searched, watched
 * and followed as on the site, with its ads blocked: the requests for ads are refused here, and a script in the page
 * (res/raw/yt_noads.js) takes the ads out of the player's data, hides those shown in the page, and skips a video ad that
 * still starts. This window has no bridge to the app (no WaiNative): YouTube's page never reaches the owner's data.
 */
public class YoutubeActivity extends Activity {
    static final String TAG = "WaiYT";
    private static final String HOME = "https://m.youtube.com/";
    private WebView web;
    private FrameLayout root;
    private View full; // a video on the whole screen
    private WebChromeClient.CustomViewCallback fullCb;
    private String script = "";
    private int blocked;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        try (InputStream in = getResources().openRawResource(R.raw.yt_noads); Scanner sc = new Scanner(in, "UTF-8").useDelimiter("\\A")) {
            script = sc.hasNext() ? sc.next() : "";
        } catch (Exception e) {
            Log.w(TAG, "script " + e);
        }
        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true); // (signing in to his account goes through Google)
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

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

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    // back: out of the whole screen, then YouTube's own steps, then back to the app
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (full != null) { hideFull(); return; }
        if (web.canGoBack()) web.goBack();
        else finish();
    }

    private void inject(WebView v) {
        if (!script.isEmpty()) v.evaluateJavascript(script, null);
    }

    // YouTube, its videos and Google's sign-in stay here; anything else opens in its own app
    private static boolean inside(Uri u) {
        if (u == null || !"https".equals(u.getScheme()) || u.getHost() == null) return false;
        String h = u.getHost();
        return h.equals("youtube.com") || h.endsWith(".youtube.com") || h.equals("youtu.be") || h.equals("google.com") || h.endsWith(".google.com")
                || h.endsWith(".googleusercontent.com") || h.endsWith(".gstatic.com") || h.endsWith(".ytimg.com") || h.endsWith(".googlevideo.com");
    }

    // the requests for ads: refused (an empty answer)
    private static boolean ad(Uri u) {
        String h = u.getHost() == null ? "" : u.getHost(), p = u.getPath() == null ? "" : u.getPath();
        if (h.endsWith("doubleclick.net") || h.endsWith("googleadservices.com") || h.endsWith("googlesyndication.com")
                || h.equals("imasdk.googleapis.com") || h.endsWith("adservice.google.com")) return true;
        if (!(h.equals("youtube.com") || h.endsWith(".youtube.com"))) return false;
        return p.startsWith("/pagead/") || p.startsWith("/api/stats/ads") || p.startsWith("/ptracking") || p.startsWith("/get_midroll_")
                || p.startsWith("/youtubei/v1/player/ad_break") || p.startsWith("/api/stats/atr");
    }

    private final class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (inside(u)) return false;
            String scheme = u.getScheme() == null ? "" : u.getScheme();
            // YouTube's «open in the app» (intent:, vnd.youtube:): it stays here, without its ads
            if (scheme.equals("intent") || scheme.startsWith("vnd.youtube") || scheme.equals("youtube") || !scheme.startsWith("http")) return true;
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE);
                startActivity(i);
            } catch (Exception e) {
                Toast.makeText(YoutubeActivity.this, "تعذّر فتح الرابط", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            if (ad(req.getUrl())) {
                blocked++;
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
            }
            return null;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            inject(view);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            inject(view);
            // a line in the phone's log for checking the build (android/ci-youtube.sh)
            view.postDelayed(() -> view.evaluateJavascript(
                    "(function(){try{return JSON.stringify({u:location.host,bridge:typeof WaiNative,ad:window.__waiAd||null})}catch(e){return 'error '+e}})()",
                    r -> Log.i(TAG, "page " + r + " blocked " + blocked)), 8000);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
            inject(view); // (YouTube moves between its pages without loading a new one; the script runs once a page)
        }
    }

    private void hideFull() {
        if (full == null) return;
        root.removeView(full);
        full = null;
        web.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        if (fullCb != null) fullCb.onCustomViewHidden();
        fullCb = null;
    }

    private final class Chrome extends WebChromeClient {
        // a video on the whole screen
        @Override
        public void onShowCustomView(View view, CustomViewCallback cb) {
            if (full != null) { cb.onCustomViewHidden(); return; }
            full = view;
            fullCb = cb;
            web.setVisibility(View.GONE);
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
        }

        @Override
        public void onHideCustomView() {
            hideFull();
        }

        // no microphone, camera or place for YouTube's page; no files from the phone
        @Override
        public void onPermissionRequest(PermissionRequest req) {
            req.deny();
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
            cb.invoke(origin, false, false);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams p) {
            cb.onReceiveValue(null);
            return true;
        }
    }
}
