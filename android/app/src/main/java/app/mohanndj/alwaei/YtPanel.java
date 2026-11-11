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
 * YouTube's own storage on the phone (yt_keep.js). It is shown whole (FULL), or hidden.
 * v161 (his answers: «ما يحتاج أن نضيف صورة لمقطع اليوتيوب صغيرة… المطلوب فقط التشغيل في الخلفية», back to the app with a
 * video playing: the sound on and a floating icon; leaving the app: «يستمر الصوت»; stopping it: a long press on the icon;
 * the screen turned off: it stops): no small window any more (drawn small it was black on his phone, and made small YouTube
 * stops its video). With a video playing, the button back to the app (v173) hides YouTube whole as it is (out of the screen,
 * its page told it is still seen, yt_keep.js) and shows the floating icon (ICON); a tap on it shows YouTube again, a long
 * press stops it (back itself, from v175: a step back in YouTube, the video stopped, its place kept). Leaving the
 * app, the video plays on with a notification Android asks for (YtService, its «إيقاف» stops it).
 */
final class YtPanel {
    static final String TAG = "WaiYT";
    private static final String HOME = "https://m.youtube.com/";
    static final int HIDDEN = 0, FULL = 1, ICON = 3; // (ICON, v161: the video playing on, only a small floating icon shown)

    private final Activity act;
    private final FrameLayout root; // the app's screen: its page, then this panel over it
    private final Listener cb;
    private FrameLayout box; // the panel: YouTube's page
    private KeepWeb web;
    private boolean fitting;
    private TextView icon; // v161: the floating icon, moved by the finger; a tap shows YouTube again, a long press stops it
    private View full; // a video on the whole screen (YouTube's own button)
    private WebChromeClient.CustomViewCallback fullCb;
    private String script = "";
    private int blocked;
    int state = HIDDEN;
    volatile boolean playing;
    private boolean wipe; // (v175: YouTube's first page opened by back from a video with no page before it: that video is not a step back)

    interface Listener {
        void changed(); // shown, hidden behind the icon, or closed: the app's page shown or hidden behind it
        void playing(boolean on); // a video started or stopped (the notification when the app is left)
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

    /** «يوتيوب» in «المزيد»: opened, or shown again if it is behind the icon. */
    void open() {
        if (web == null) build();
        setState(FULL);
    }

    private void build() {
        // the ads out (v152), then what draws him in (v153), then each video's place and his list (v160)
        script = raw(R.raw.yt_noads) + "\n" + raw(R.raw.yt_calm) + "\n" + raw(R.raw.yt_keep);
        box = new FrameLayout(act);
        box.setBackgroundColor(Color.BLACK);
        web = new KeepWeb(act);
        box.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
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
        final WebView w = web;
        web.evaluateJavascript("(function(){try{var v=document.querySelector('video');return !!(v&&!v.paused&&!v.ended&&v.currentTime>0)}catch(e){return false}})()",
                r -> {
                    if (web != w) return; // (an answer from a YouTube closed since)
                    boolean was = playing;
                    playing = "true".equals(r);
                    web.keep = playing;
                    if (was != playing) { cb.playing(playing); Log.i(TAG, "playing " + playing); }
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
        Log.i(TAG, "state " + s); // (for the build's check: 1 whole, 3 the icon)
    }

    /** The panel's place for its state: whole on the screen, or (behind the icon) whole out of it. */
    void layout() {
        if (box == null) return;
        boolean away = state == ICON;
        if (state == HIDDEN) {
            box.setVisibility(View.GONE);
        } else {
            box.setVisibility(full != null ? View.GONE : View.VISIBLE); // (a video on the whole screen stays so)
            box.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            // (behind the icon: out of the screen at its whole size, still shown to its page, so YouTube plays on; made
            // small, YouTube stops its video)
            box.setTranslationY(away ? Math.max(root.getHeight(), dp(800)) * 2f : 0);
            box.bringToFront();
            if (full != null) full.bringToFront();
        }
        iconFor();
    }

    // v173 (the owner: «أريد زرا يخرجني لواجهة الوعي الشخصي بدل من الرجوع المتكرر إلى أن أصل», then «اجعل للرجوع والمقطع
    // شغال الزر نفسه الذي يرجعني للوعي الشخصي», his answer «زر واحد يتبدّل»): the same floating button over YouTube (the
    // app's own icon: a tap goes back to the app's page, the video playing on behind it, or YouTube closed
    // when nothing plays) and over the app's page (▶: a tap shows YouTube again); in the place he leaves it, a long press
    // stopping YouTube; none over a video on the whole screen
    private void iconFor() {
        icon(full == null && (state == ICON || state == FULL));
    }

    private void iconLook() {
        if (icon == null) return;
        if (state == FULL) {
            icon.setText("");
            icon.setBackground(act.getResources().getDrawable(R.mipmap.ic_launcher, null));
            icon.setContentDescription("ارجع إلى الوعي الشخصي");
        } else {
            icon.setText("▶");
            GradientDrawable dot = new GradientDrawable();
            dot.setShape(GradientDrawable.OVAL);
            dot.setColor(0xEE0F766E);
            dot.setStroke(dp(2), Color.WHITE);
            icon.setBackground(dot);
            icon.setContentDescription("يوتيوب يعمل: اضغط لتفتحه، واضغط مطوّلاً لتوقفه");
        }
    }

    // a tap: from YouTube to the app's page (playing on, or closed), from the app's page to YouTube
    private void iconTap() {
        if (state == ICON) { setState(FULL); return; }
        Log.i(TAG, "home button");
        if (web == null) return;
        final WebView w = web; // (asked now, not from the last second's answer: a video just started plays on)
        web.evaluateJavascript("(function(){try{var v=document.querySelector('video');return !!(v&&!v.paused&&!v.ended&&v.currentTime>0)}catch(e){return false}})()", r -> {
            if (web != w || state != FULL) return;
            if ("true".equals(r)) { playing = true; web.keep = true; setState(ICON); } else close();
        });
    }

    // the floating icon: a small round one, moved by the finger and kept where it is left; a tap shows YouTube again,
    // a long press stops it (his answer: «ضغطة مطوّلة على الأيقونة»)
    private void icon(boolean show) {
        if (!show) { if (icon != null) icon.setVisibility(View.GONE); return; }
        if (icon == null) {
            icon = new TextView(act);
            icon.setTextColor(Color.WHITE);
            icon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
            icon.setGravity(Gravity.CENTER);
            icon.setElevation(dp(10));
            icon.setOutlineProvider(new android.view.ViewOutlineProvider() { // (round, as he chose: «صغير مستدير»)
                @Override public void getOutline(View v, android.graphics.Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
            });
            icon.setClipToOutline(true);
            root.addView(icon, new FrameLayout.LayoutParams(dp(44), dp(44), Gravity.TOP | Gravity.LEFT));
            // (the screen turned or made smaller: kept on it; one listener, though the icon is made again after a stop)
            if (!fitting) { fitting = true; root.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> {
                if (icon == null || icon.getVisibility() != View.VISIBLE) return;
                icon.setX(Math.max(0, Math.min(r - l - icon.getWidth(), icon.getX())));
                icon.setY(Math.max(0, Math.min(b - t - icon.getHeight(), icon.getY())));
            }); }
            final float[] at = new float[4];
            final boolean[] moved = new boolean[2]; // (moved, held long)
            final int slop = android.view.ViewConfiguration.get(act).getScaledTouchSlop();
            final Runnable held = () -> {
                if (state != ICON) return; // (v173: the button over YouTube is a tap only; his long press is the ▶'s)
                moved[1] = true;
                if (icon != null) icon.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);
                close();
                Toast.makeText(act, "أوقفت يوتيوب", Toast.LENGTH_SHORT).show();
            };
            icon.setOnTouchListener((v, e) -> {
                switch (e.getActionMasked()) {
                    case android.view.MotionEvent.ACTION_DOWN:
                        at[0] = e.getRawX(); at[1] = e.getRawY(); at[2] = v.getX(); at[3] = v.getY(); moved[0] = false; moved[1] = false;
                        v.postDelayed(held, android.view.ViewConfiguration.getLongPressTimeout());
                        return true;
                    case android.view.MotionEvent.ACTION_MOVE:
                        if (moved[1]) return true;
                        float dx = e.getRawX() - at[0], dy = e.getRawY() - at[1];
                        if (!moved[0] && Math.hypot(dx, dy) < slop) return true;
                        if (!moved[0]) v.removeCallbacks(held);
                        moved[0] = true;
                        v.setX(Math.max(0, Math.min(root.getWidth() - v.getWidth(), at[2] + dx)));
                        v.setY(Math.max(0, Math.min(root.getHeight() - v.getHeight(), at[3] + dy)));
                        return true;
                    case android.view.MotionEvent.ACTION_UP:
                    case android.view.MotionEvent.ACTION_CANCEL:
                        v.removeCallbacks(held);
                        if (moved[1]) return true; // (stopped by the long press)
                        if (moved[0] || e.getActionMasked() == android.view.MotionEvent.ACTION_CANCEL) {
                            act.getSharedPreferences("yt", 0).edit().putFloat("ix", v.getX() / Math.max(1, root.getWidth()))
                                    .putFloat("iy", v.getY() / Math.max(1, root.getHeight())).apply();
                        } else iconTap();
                        return true;
                    default:
                        return true;
                }
            });
        }
        iconLook();
        icon.setVisibility(View.VISIBLE);
        icon.bringToFront();
        // (where it was left, else at the bottom on the left, where the small window was)
        icon.post(() -> {
            if (icon == null) return;
            float fx = act.getSharedPreferences("yt", 0).getFloat("ix", -1), fy = act.getSharedPreferences("yt", 0).getFloat("iy", -1);
            int w = root.getWidth(), h = root.getHeight();
            float x = fx >= 0 ? fx * w : dp(16), y = fy >= 0 ? fy * h : h - dp(84) - dp(60);
            icon.setX(Math.max(0, Math.min(w - icon.getWidth(), x)));
            icon.setY(Math.max(0, Math.min(h - icon.getHeight(), y)));
        });
    }

    /** A long press on the icon, or back with nothing playing and no YouTube page left: its place kept, then closed. */
    void close() {
        if (web == null) return;
        hideFull();
        KeepWeb w = web;
        web = null;
        root.removeCallbacks(poller);
        w.keep = false;
        if (playing) { playing = false; cb.playing(false); }
        CookieManager.getInstance().flush();
        state = HIDDEN;
        w.evaluateJavascript("window.__waiKeepSave&&window.__waiKeepSave();(function(){var v=document.querySelector('video');if(v)v.pause()})()", null);
        if (box != null) box.setVisibility(View.GONE);
        if (icon != null) { root.removeView(icon); icon = null; }
        cb.changed();
        Log.i(TAG, "closed");
        View b = box;
        box = null;
        w.postDelayed(() -> { root.removeView(b); w.destroy(); }, 400);
    }

    /** Back while it is whole: out of the whole screen, then YouTube's steps, then closed.
     *  (v175, his choice «ج: يرجع ويتوقف المقطع»: with a video playing, its place kept and a step back in YouTube, which
     *  stops it; with no page before it, YouTube's first page: «يبقى في يوتيوب». It was behind the icon from v164.) */
    boolean back() {
        if (web == null || state != FULL) return false;
        if (full != null) { hideFull(); return true; }
        if (playing) {
            web.evaluateJavascript("window.__waiKeepSave&&window.__waiKeepSave()", null);
            final boolean step = web.canGoBack();
            String u = web.getUrl();
            if (!step && (u == null || !u.contains("/watch"))) { setState(ICON); return true; } // (not a video's page: as before)
            Log.i(TAG, "back with a video playing: " + (step ? "a step back" : "the first page"));
            web.postDelayed(() -> {
                if (web == null) return;
                if (step) web.goBack(); else { wipe = true; web.loadUrl(HOME); }
            }, 150);
            return true;
        }
        if (web.canGoBack()) web.goBack();
        else close();
        return true;
    }

    boolean isOpen() {
        return web != null && state != HIDDEN;
    }

    /** The app out of sight with nothing playing, the screen turned off, or «إيقاف» in the notification: the video
     *  stopped, its place kept (and the page paused, unless asked to stay as it is: «إيقاف» with the app open). */
    void pause(boolean page) {
        if (web == null) return;
        web.keep = false;
        web.evaluateJavascript("window.__waiKeepSave&&window.__waiKeepSave();(function(){var v=document.querySelector('video');if(v)v.pause()})()", null);
        if (page) web.onPause();
        if (playing) { playing = false; cb.playing(false); }
        CookieManager.getInstance().flush(); // (signed in, he stays so though Android stops the app)
    }

    /** The app left with a video playing: it plays on, its place saved as it goes. */
    void keep() {
        if (web != null) web.evaluateJavascript("window.__waiKeepSave&&window.__waiKeepSave()", null);
        CookieManager.getInstance().flush();
    }

    void resume() {
        if (web != null) web.onResume();
    }

    void destroy() {
        root.removeCallbacks(poller);
        if (icon != null) { root.removeView(icon); icon = null; }
        if (box != null) root.removeView(box);
        if (web != null) web.destroy();
        web = null;
    }

    // v161: with a video playing, YouTube's page is not told that the app's window went out of sight (the app left):
    // the WebView would stop its video then (seen on the emulator). Nothing playing, or stopped: as any WebView.
    static final class KeepWeb extends WebView {
        volatile boolean keep;

        KeepWeb(Activity a) {
            super(a);
        }

        @Override
        protected void onWindowVisibilityChanged(int v) {
            super.onWindowVisibilityChanged(keep ? View.VISIBLE : v);
        }
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
            if (wipe && url != null && !url.contains("/watch")) { wipe = false; view.clearHistory(); }
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
        if (full.getParent() instanceof ViewGroup) ((ViewGroup) full.getParent()).removeView(full);
        full = null;
        if (box != null) box.setVisibility(state == HIDDEN ? View.GONE : View.VISIBLE);
        iconFor();
        act.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        act.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        if (fullCb != null) fullCb.onCustomViewHidden();
        fullCb = null;
    }

    private final class Chrome extends WebChromeClient {
        // a video on the whole screen
        @Override
        public void onShowCustomView(View view, CustomViewCallback c) {
            Log.i(TAG, "whole screen asked, state " + state);
            if (full != null || box == null || state != FULL) { c.onCustomViewHidden(); return; }
            full = view;
            fullCb = c;
            box.setVisibility(View.GONE);
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            iconFor();
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
