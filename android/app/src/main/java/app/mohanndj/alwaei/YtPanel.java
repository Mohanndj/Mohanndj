package app.mohanndj.alwaei;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
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
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Scanner;

/**
 * «يوتيوب» (v152, v153), now part of the app's own screen (v160, the owner: «في يوتيوب أريد كل مقطع دخلته يبقى محفوظا عند
 * اللحظة التي توقفت عندها، وأضع لي قائمة سفلية بالمقاطع التي أريد الاستماع إليها، وكذلك إذا قدرت أن أخرج من صفحة المقطع أو
 * التطبيق ويبقى في الخلفية مع نافذة صغيرة عليه», and his answers: leaving YouTube, not its video page; nothing started by
 * itself, a finished one struck in the list; the small window only; «هو تابع للوعي الشخصي»: one card in the recent apps,
 * the whole app behind the small window, and the video small over the app's pages when he goes back to them).
 * YouTube's site in a WebView of its own over the app's page, with no bridge to the app (no WaiNative here): its ads
 * blocked (yt_noads.js), what draws him in hidden (yt_calm.js), and each video's place and his list «للاستماع» kept in
 * YouTube's own storage on the phone (yt_keep.js). It is shown whole (FULL), small over the app's pages (MINI: a tap makes
 * it whole again, «×» stops it), or hidden; the small window over everything when he leaves the app is MainActivity's
 * picture in picture, with this panel filling it.
 */
final class YtPanel {
    static final String TAG = "WaiYT";
    private static final String HOME = "https://m.youtube.com/";
    static final int HIDDEN = 0, FULL = 1, MINI = 2;

    private final Activity act;
    private final FrameLayout root; // the app's screen: its page, then this panel over it
    private final Listener cb;
    private FrameLayout box; // the panel: YouTube's page, and in MINI a cover for the tap and the «×»
    private WebView web;
    private View cover;
    private TextView close;
    private View full; // a video on the whole screen
    private WebChromeClient.CustomViewCallback fullCb;
    private String script = "";
    private int blocked;
    int state = HIDDEN;
    boolean pip; // in the phone's small window over everything
    volatile boolean playing;

    interface Listener {
        void changed(); // shown, made small or whole, or closed: the app's page shown or hidden behind it
    }

    YtPanel(Activity act, FrameLayout root, Listener cb) {
        this.act = act;
        this.root = root;
        this.cb = cb;
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, act.getResources().getDisplayMetrics()));
    }

    private String raw(int id) {
        try (InputStream in = act.getResources().openRawResource(id); Scanner sc = new Scanner(in, "UTF-8").useDelimiter("\\A")) {
            return sc.hasNext() ? sc.next() : "";
        } catch (Exception e) {
            Log.w(TAG, "script " + e);
            return "";
        }
    }

    /** «يوتيوب» in «المزيد»: opened, or made whole again if it is small. */
    void open() {
        if (web == null) build();
        setState(FULL);
    }

    private void build() {
        // the ads out (v152), then what draws him in (v153), then each video's place and his list (v160)
        script = raw(R.raw.yt_noads) + "\n" + raw(R.raw.yt_calm) + "\n" + raw(R.raw.yt_keep);
        box = new FrameLayout(act);
        box.setBackgroundColor(Color.BLACK);
        web = new WebView(act);
        box.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // (small: a tap anywhere on it makes it whole again, so YouTube's own buttons are not pressed by mistake)
        cover = new View(act);
        cover.setOnClickListener(v -> setState(FULL));
        box.addView(cover, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        close = new TextView(act);
        close.setText("×");
        close.setTextColor(Color.WHITE);
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        close.setGravity(Gravity.CENTER);
        close.setContentDescription("أغلق يوتيوب");
        GradientDrawable dot = new GradientDrawable();
        dot.setShape(GradientDrawable.OVAL);
        dot.setColor(0xCC000000);
        close.setBackground(dot);
        close.setOnClickListener(v -> close());
        FrameLayout.LayoutParams cl = new FrameLayout.LayoutParams(dp(32), dp(32), Gravity.TOP | Gravity.END);
        cl.setMargins(dp(4), dp(4), dp(4), dp(4));
        box.addView(close, cl);
        box.setElevation(dp(8));
        root.addView(box);
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
        web.loadUrl(HOME);
        poll();
    }

    // is a video playing? (asked of the page each second while it is open: a video playing goes small, not stopped)
    private final Runnable poller = this::poll;

    private void poll() {
        if (web == null) return;
        web.evaluateJavascript("(function(){try{var v=document.querySelector('video');return !!(v&&!v.paused&&!v.ended&&v.currentTime>0)}catch(e){return false}})()",
                r -> {
                    boolean was = playing;
                    playing = "true".equals(r);
                    if (was != playing && act instanceof MainActivity) ((MainActivity) act).pipParams();
                });
        root.removeCallbacks(poller);
        root.postDelayed(poller, 1000);
    }

    void setState(int s) {
        if (web == null) return;
        if (s != FULL) hideFull();
        state = s;
        layout();
        cb.changed();
        Log.i(TAG, "state " + s); // (for the build's check: 1 whole, 2 small over the app's pages)
    }

    /** The panel's place and look for its state (and in the phone's small window, the whole of it). */
    void layout() {
        if (box == null) return;
        boolean small = state == MINI && !pip;
        FrameLayout.LayoutParams lp;
        if (state == HIDDEN) {
            box.setVisibility(View.GONE);
        } else {
            box.setVisibility(full != null ? View.GONE : View.VISIBLE); // (a video on the whole screen stays so, in the small window too)
            if (small) {
                // (at the bottom on the left, above the app's bar below, the video's own 16:9)
                int w = Math.max(dp(170), Math.round(root.getWidth() * 0.5f));
                if (root.getWidth() == 0) w = dp(190);
                lp = new FrameLayout.LayoutParams(w, Math.round(w * 9f / 16f), Gravity.BOTTOM | Gravity.LEFT);
                lp.setMargins(dp(10), 0, dp(10), dp(84));
            } else {
                lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            }
            box.setLayoutParams(lp);
            box.bringToFront();
            if (full != null) full.bringToFront();
        }
        cover.setVisibility(small ? View.VISIBLE : View.GONE);
        close.setVisibility(small ? View.VISIBLE : View.GONE);
        mini(small || pip);
    }

    // the page's video alone, filling the small window (yt_keep.js)
    private void mini(boolean on) {
        if (web != null) web.evaluateJavascript("window.__waiMini&&window.__waiMini(" + on + ")", null);
    }

    /** «×», or back with nothing playing and no YouTube page left: its place kept, then closed. */
    void close() {
        if (web == null) return;
        hideFull();
        WebView w = web;
        web = null;
        root.removeCallbacks(poller);
        playing = false;
        CookieManager.getInstance().flush();
        state = HIDDEN;
        w.evaluateJavascript("window.__waiKeepSave&&window.__waiKeepSave();(function(){var v=document.querySelector('video');if(v)v.pause()})()", null);
        if (box != null) box.setVisibility(View.GONE);
        cb.changed();
        View b = box;
        box = null;
        w.postDelayed(() -> { root.removeView(b); w.destroy(); }, 400);
    }

    /** Back while it is whole: out of the whole screen, then small if a video plays, then YouTube's steps, then closed. */
    boolean back() {
        if (web == null || state != FULL) return false;
        if (full != null) { hideFull(); return true; }
        if (playing) { setState(MINI); return true; }
        if (web.canGoBack()) web.goBack();
        else close();
        return true;
    }

    boolean isOpen() {
        return web != null && state != HIDDEN;
    }

    /** The app out of sight without the small window: the video stopped, its place kept. */
    void pause() {
        if (web == null) return;
        web.evaluateJavascript("window.__waiKeepSave&&window.__waiKeepSave();(function(){var v=document.querySelector('video');if(v)v.pause()})()", null);
        web.onPause();
        CookieManager.getInstance().flush(); // (signed in, he stays so though Android stops the app)
    }

    void resume() {
        if (web != null) web.onResume();
    }

    void destroy() {
        root.removeCallbacks(poller);
        if (box != null) root.removeView(box);
        if (web != null) web.destroy();
        web = null;
    }

    private void inject(WebView v) {
        if (!script.isEmpty()) v.evaluateJavascript(script, null);
        if (state == MINI || pip) mini(true);
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
                act.startActivity(new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE));
            } catch (Exception e) {
                Toast.makeText(act, "تعذّر فتح الرابط", Toast.LENGTH_SHORT).show();
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
                    "(function(){try{return JSON.stringify({u:location.host,bridge:typeof WaiNative,ad:window.__waiAd||null,calm:window.__waiCalm||null,keep:window.__waiKeep||null})}catch(e){return 'error '+e}})()",
                    r -> Log.i(TAG, "page " + r + " blocked " + blocked)), 8000);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
            inject(view); // (YouTube moves between its pages without loading a new one; the script runs once a page)
        }
    }

    void hideFull() {
        if (full == null) return;
        root.removeView(full);
        full = null;
        if (box != null) box.setVisibility(state == HIDDEN ? View.GONE : View.VISIBLE);
        act.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        act.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        if (fullCb != null) fullCb.onCustomViewHidden();
        fullCb = null;
    }

    private final class Chrome extends WebChromeClient {
        // a video on the whole screen
        @Override
        public void onShowCustomView(View view, CustomViewCallback c) {
            if (full != null || state != FULL) { c.onCustomViewHidden(); return; }
            full = view;
            fullCb = c;
            box.setVisibility(View.GONE);
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            act.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            act.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
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
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback c) {
            c.invoke(origin, false, false);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> c, FileChooserParams p) {
            c.onReceiveValue(null);
            return true;
        }
    }
}
