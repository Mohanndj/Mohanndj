package app.mohanndj.alwaei;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.InputStream;
import java.util.Scanner;

/**
 * «تويتر» (v166, the owner: «هل أقدر أضيف تويتر للوعي الشخصي فأغرد فقط بدون قراءة إلا لمن أختارهم فقط؟», and his
 * answers: inside the app like YouTube; reading the people he chooses through a private List of his on Twitter; it
 * opens on the box to tweet, with «قائمتي»; notifications, messages, replies, search and others' pages stay; retweets
 * in his List stay; nothing of YouTube's ad blocking or background playing). Twitter's own site in a WebView of its own
 * over the app's page, with no bridge to the app (no WaiNative here); what it would have him read hidden (x_calm.js):
 * the home timeline, Explore's trends and the suggestions. Whole, or closed: back goes through Twitter's steps, then
 * closes it.
 */
final class XPanel {
    static final String TAG = "WaiX";
    private static final String START = "https://x.com/compose/post";

    private final Activity act;
    private final FrameLayout root;
    private final Runnable changed;
    private FrameLayout box;
    private WebView web;
    private View full;
    private View home; // v173: the floating button back to the app
    private boolean fitting;
    private WebChromeClient.CustomViewCallback fullCb;
    private String script = "";

    XPanel(Activity act, FrameLayout root, Runnable changed) {
        this.act = act;
        this.root = root;
        this.changed = changed;
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

    boolean isOpen() {
        return web != null;
    }

    /** «تويتر» in «المزيد»: opened on the box to tweet (or shown again as it was). */
    void open() {
        if (web == null) build();
        box.setVisibility(full != null ? View.GONE : View.VISIBLE);
        box.bringToFront();
        homeBtn(full == null);
        changed.run();
        Log.i(TAG, "open");
    }

    private void build() {
        script = raw(R.raw.x_calm);
        box = new FrameLayout(act);
        box.setBackgroundColor(Color.WHITE);
        web = new WebView(act);
        box.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        box.setElevation(dp(11)); // (over YouTube's floating icon too, while Twitter is open)
        root.addView(box, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true); // (signing in may go through Google or Apple)
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.loadUrl(START);
    }

    /** Back: out of a video on the whole screen, then Twitter's steps, then closed. */
    boolean back() {
        if (web == null) return false;
        if (full != null) { hideFull(); return true; }
        if (web.canGoBack()) web.goBack();
        else close();
        return true;
    }

    void close() {
        if (web == null) return;
        hideFull();
        if (home != null) { root.removeView(home); home = null; }
        WebView w = web;
        web = null;
        CookieManager.getInstance().flush();
        FrameLayout b = box;
        box = null;
        b.setVisibility(View.GONE);
        changed.run();
        Log.i(TAG, "closed");
        w.postDelayed(() -> { root.removeView(b); w.destroy(); }, 400);
    }

    void pause() {
        if (web == null) return;
        web.onPause();
        CookieManager.getInstance().flush(); // (signed in, he stays so though Android stops the app)
    }

    void resume() {
        if (web != null) web.onResume();
    }

    void destroy() {
        if (home != null) { root.removeView(home); home = null; }
        if (box != null) root.removeView(box);
        if (web != null) web.destroy();
        web = null;
    }

    // v173 (the owner: «أريد زرا يخرجني لواجهة الوعي الشخصي بدل من الرجوع المتكرر إلى أن أصل», and his answer: a small
    // round one his finger moves): the app's icon floating over Twitter; a tap closes Twitter back to the app's page (as
    // back does at its end), kept where he leaves it; none over a video on the whole screen
    private void homeBtn(boolean show) {
        if (!show) { if (home != null) home.setVisibility(View.GONE); return; }
        if (home == null) {
            View b = new View(act);
            b.setBackground(act.getResources().getDrawable(R.mipmap.ic_launcher, null));
            b.setContentDescription("ارجع إلى الوعي الشخصي");
            b.setElevation(dp(12)); // (over Twitter's page)
            b.setOutlineProvider(new android.view.ViewOutlineProvider() { // (round, as he chose: «صغير مستدير»)
                @Override public void getOutline(View v, android.graphics.Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
            });
            b.setClipToOutline(true);
            root.addView(b, new FrameLayout.LayoutParams(dp(44), dp(44), Gravity.TOP | Gravity.LEFT));
            final float[] at = new float[4];
            final boolean[] moved = new boolean[1];
            final int slop = ViewConfiguration.get(act).getScaledTouchSlop();
            b.setOnTouchListener((v, e) -> {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        at[0] = e.getRawX(); at[1] = e.getRawY(); at[2] = v.getX(); at[3] = v.getY(); moved[0] = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - at[0], dy = e.getRawY() - at[1];
                        if (!moved[0] && Math.hypot(dx, dy) < slop) return true;
                        moved[0] = true;
                        v.setX(Math.max(0, Math.min(root.getWidth() - v.getWidth(), at[2] + dx)));
                        v.setY(Math.max(0, Math.min(root.getHeight() - v.getHeight(), at[3] + dy)));
                        return true;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (moved[0] || e.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                            act.getSharedPreferences("x", 0).edit().putFloat("hx", v.getX() / Math.max(1, root.getWidth()))
                                    .putFloat("hy", v.getY() / Math.max(1, root.getHeight())).apply();
                        } else {
                            v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                            Log.i(TAG, "home button");
                            close();
                        }
                        return true;
                    default:
                        return true;
                }
            });
            home = b;
            // (the screen turned: kept on it; one listener, though the button is made again after a close)
            if (!fitting) { fitting = true; root.addOnLayoutChangeListener((v, l, t, rr, bb, ol, ot, or, ob) -> {
                if (home == null || home.getVisibility() != View.VISIBLE) return;
                home.setX(Math.max(0, Math.min(rr - l - home.getWidth(), home.getX())));
                home.setY(Math.max(0, Math.min(bb - t - home.getHeight(), home.getY())));
            }); }
        }
        home.setVisibility(View.VISIBLE);
        home.bringToFront();
        // (where it was left, else at the bottom on the right: Twitter's own buttons are on the left in Arabic)
        final View b = home;
        b.post(() -> {
            if (home != b) return;
            float fx = act.getSharedPreferences("x", 0).getFloat("hx", -1), fy = act.getSharedPreferences("x", 0).getFloat("hy", -1);
            int w = root.getWidth(), h = root.getHeight();
            float x = fx >= 0 ? fx * w : w - b.getWidth() - dp(16), y = fy >= 0 ? fy * h : h - dp(84) - dp(60);
            b.setX(Math.max(0, Math.min(w - b.getWidth(), x)));
            b.setY(Math.max(0, Math.min(h - b.getHeight(), y)));
        });
    }

    private void inject(WebView v) {
        if (!script.isEmpty()) v.evaluateJavascript(script, null);
    }

    // Twitter, its pictures and videos, and the sign-in pages stay here; anything else opens in its own app
    private static boolean inside(Uri u) {
        if (u == null || !"https".equals(u.getScheme()) || u.getHost() == null) return false;
        String h = u.getHost();
        return h.equals("x.com") || h.endsWith(".x.com") || h.equals("twitter.com") || h.endsWith(".twitter.com") || h.endsWith(".twimg.com")
                || h.equals("accounts.google.com") || h.equals("appleid.apple.com") || h.endsWith(".gstatic.com") || h.endsWith(".googleusercontent.com");
    }

    private final class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (inside(u)) return false;
            String scheme = u.getScheme() == null ? "" : u.getScheme();
            if (!scheme.startsWith("http")) return true; // («open in the app» and the like: it stays here)
            try {
                act.startActivity(new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE));
            } catch (Exception e) {
                Toast.makeText(act, "تعذّر فتح الرابط", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            inject(view);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            inject(view);
            // a line in the phone's log for checking the build (android/ci-x.sh)
            view.postDelayed(() -> view.evaluateJavascript(
                    "(function(){try{return JSON.stringify({u:location.host+location.pathname,bridge:typeof WaiNative,calm:window.__waiX||null})}catch(e){return 'error '+e}})()",
                    r -> Log.i(TAG, "page " + r)), 8000);
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
            inject(view); // (Twitter moves between its pages without loading a new one; the script runs once a page)
        }
    }

    void hideFull() {
        if (full == null) return;
        if (full.getParent() instanceof ViewGroup) ((ViewGroup) full.getParent()).removeView(full);
        full = null;
        if (box != null) box.setVisibility(View.VISIBLE);
        homeBtn(box != null);
        act.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        act.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        if (fullCb != null) fullCb.onCustomViewHidden();
        fullCb = null;
    }

    private final class Chrome extends WebChromeClient {
        // a video on the whole screen
        @Override
        public void onShowCustomView(View view, CustomViewCallback c) {
            if (full != null || box == null) { c.onCustomViewHidden(); return; }
            full = view;
            fullCb = c;
            box.setVisibility(View.GONE);
            homeBtn(false);
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            act.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            act.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
        }

        @Override
        public void onHideCustomView() {
            hideFull();
        }

        // no microphone, camera or place for Twitter's page
        @Override
        public void onPermissionRequest(PermissionRequest req) {
            req.deny();
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback c) {
            c.invoke(origin, false, false);
        }

        // a picture or a video to tweet: the phone's own chooser, as the app's page has it
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> c, FileChooserParams p) {
            if (act instanceof MainActivity) return ((MainActivity) act).chooseFiles(c, p);
            c.onReceiveValue(null);
            return true;
        }
    }
}
