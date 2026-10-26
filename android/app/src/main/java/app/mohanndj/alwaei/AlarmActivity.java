package app.mohanndj.alwaei;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * A reminder's alarm on the screen (v121, the owner's request: «اجعل الكتابة التي تظهر ثابتة على الشاشة حتى أقوم
 * وألغيها»; v124, his: «أقصد أن يظهر على الشاشة كتنبيهات الجوال نفسها… وليس في القائمة المنسدلة»): a window in the
 * middle of the screen, over whatever is open and over the lock screen, with its hour and its whole text, until
 * «قرأت النص» or «غفوة» is pressed here (each goes as its button on the notification does), or the alarm is answered
 * elsewhere (the notification gone). Opened by the app itself when the alarm rings, if it may show itself over other
 * apps (Notifs.popUp, the permission «الظهور فوق التطبيقات الأخرى»); by the notification's full-screen intent (the
 * phone shows it by itself when the screen is off or locked); and by a tap on the notification.
 */
public class AlarmActivity extends Activity {
    private static final int TEAL = 0xFF0F766E;
    private final Handler h = new Handler(Looper.getMainLooper());
    private String tag = "";
    private JSONObject extra = new JSONObject();

    // answered elsewhere (on the notification, the watch, or in the page): this screen goes too
    private final Runnable watch = new Runnable() {
        @Override
        public void run() {
            if (!Notifs.showing(AlarmActivity.this, tag)) {
                finish();
                return;
            }
            h.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // a touch beside it does not close it
        setFinishOnTouchOutside(false);
        show(getIntent());
    }

    @Override
    protected void onNewIntent(Intent in) {
        super.onNewIntent(in);
        setIntent(in);
        show(in);
    }

    @Override
    protected void onResume() {
        super.onResume();
        h.removeCallbacks(watch);
        h.postDelayed(watch, 1500);
    }

    @Override
    protected void onPause() {
        super.onPause();
        h.removeCallbacks(watch);
    }

    // it stays until answered: «رجوع» does not close it
    @Override
    public void onBackPressed() {
    }

    private float dp(float v) {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private void show(Intent in) {
        tag = in.getStringExtra("tag") == null ? "" : in.getStringExtra("tag");
        try {
            extra = new JSONObject(in.getStringExtra("extra") == null ? "{}" : in.getStringExtra("extra"));
        } catch (JSONException e) {
            extra = new JSONObject();
        }
        String snooze = in.getStringExtra("snooze");
        if (snooze == null || snooze.isEmpty()) snooze = "غفوة";
        int pad = (int) dp(22);
        // as wide as the screen allows, with a margin (at most that of a phone's own alert)
        int cardW = Math.min(getResources().getDisplayMetrics().widthPixels - (int) dp(32), (int) dp(440));

        // a card in the middle of the screen (the screen behind it dimmed: AlarmTheme)
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        GradientDrawable card = new GradientDrawable();
        card.setColor(Color.WHITE);
        card.setCornerRadius(dp(24));
        root.setBackground(card);
        root.setPadding(pad, pad, pad, pad);

        TextView kicker = new TextView(this);
        kicker.setText(extra.optString("title", "منبه"));
        kicker.setTextColor(TEAL);
        kicker.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        kicker.setTypeface(Typeface.DEFAULT_BOLD);
        kicker.setGravity(Gravity.START);
        root.addView(kicker, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // its whole text, however long (beyond half the screen it scrolls)
        ScrollView sv = new ScrollView(this);
        TextView text = new TextView(this);
        text.setText(extra.optString("body", ""));
        text.setTextColor(0xFF1F2937);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        text.setTypeface(Typeface.DEFAULT_BOLD);
        text.setLineSpacing(0, 1.25f);
        text.setGravity(Gravity.START);
        text.setPadding(0, (int) dp(12), 0, (int) dp(8));
        sv.addView(text, new ScrollView.LayoutParams(ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        int most = getResources().getDisplayMetrics().heightPixels / 2;
        text.measure(View.MeasureSpec.makeMeasureSpec(cardW - 2 * pad, View.MeasureSpec.EXACTLY), View.MeasureSpec.UNSPECIFIED);
        root.addView(sv, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Math.min(most, text.getMeasuredHeight())));

        // v123, the owner's request: «قرأت النص» and «غفوة» only
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        row.addView(button("قرأت النص", true, v -> answer("done")), buttonParams(true));
        row.addView(button(snooze, false, v -> answer("snooze")), buttonParams(false));
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rp.topMargin = (int) dp(16);
        root.addView(row, rp);
        setContentView(root);
        getWindow().setLayout(cardW, WindowManager.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams buttonParams(boolean first) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, (int) dp(52), 1f);
        if (!first) p.setMarginStart((int) dp(10));
        return p;
    }

    private Button button(String label, boolean main, View.OnClickListener on) {
        Button bt = new Button(this);
        bt.setText(label);
        bt.setAllCaps(false);
        bt.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        bt.setTypeface(Typeface.DEFAULT_BOLD);
        bt.setTextColor(main ? Color.WHITE : TEAL);
        bt.setStateListAnimator(null);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(14));
        if (main) bg.setColor(TEAL);
        else {
            bg.setColor(0x00000000);
            bg.setStroke((int) dp(2), TEAL);
        }
        bt.setBackground(bg);
        bt.setContentDescription(label);
        bt.setOnClickListener(on);
        return bt;
    }

    // as its button on the notification: to AlarmReceiver (the page now if it is open, else when it opens)
    private void answer(String action) {
        h.removeCallbacks(watch);
        if (!tag.isEmpty()) sendBroadcast(Notifs.actionIntent(this, Notifs.ACT, tag, action, extra));
        finish();
    }
}
