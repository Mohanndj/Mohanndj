package app.mohanndj.alwaei;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * «اختر كتاباً» of the widget «فوائد الكتب» (v176): a small window in the middle of the screen with every book that has
 * benefits and its count; a book pressed is the widget's book, and the window closes.
 */
public class BenPickActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        int wid = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (wid == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }
        JSONObject all = Store.bens(this);
        JSONArray books = all == null ? null : all.optJSONArray("books");
        boolean arab = all != null && all.optBoolean("arab");
        String cur = Store.benBook(this, wid);
        int bg = getColor(R.color.w_bg), text = getColor(R.color.w_text), muted = getColor(R.color.w_muted), brand = getColor(R.color.w_brand), line = getColor(R.color.w_line);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        box.setPadding(dp(18), dp(16), dp(18), dp(10));
        GradientDrawable card = new GradientDrawable();
        card.setColor(bg);
        card.setCornerRadius(dp(20));
        box.setBackground(card);

        TextView head = new TextView(this);
        head.setText(R.string.bens_pick);
        head.setTextColor(brand);
        head.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        head.setTypeface(Typeface.DEFAULT_BOLD);
        head.setPadding(0, 0, 0, dp(8));
        box.addView(head);

        LinearLayout rows = new LinearLayout(this);
        rows.setOrientation(LinearLayout.VERTICAL);
        int n = books == null ? 0 : books.length();
        for (int i = 0; i < n; i++) {
            JSONObject bk = books.optJSONObject(i);
            if (bk == null) continue;
            String id = bk.optString("id");
            JSONArray items = bk.optJSONArray("items");
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setMinimumHeight(dp(48));
            row.setPadding(dp(4), dp(6), dp(4), dp(6));
            TextView name = new TextView(this);
            name.setText((id.equals(cur) ? "✓ " : "") + bk.optString("name"));
            name.setTextColor(id.equals(cur) ? brand : text);
            name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
            if (id.equals(cur)) name.setTypeface(Typeface.DEFAULT_BOLD);
            row.addView(name, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            TextView cnt = new TextView(this);
            cnt.setText(BenWidget.digits(BenWidget.count(items == null ? 0 : items.length()), arab));
            cnt.setTextColor(muted);
            cnt.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            row.addView(cnt);
            row.setOnClickListener(v -> {
                Store.setBenBook(this, wid, id);
                BenWidget.refresh(this, wid);
                finish();
            });
            if (rows.getChildCount() > 0) {
                View sep = new View(this);
                sep.setBackgroundColor(line);
                rows.addView(sep, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1));
            }
            rows.addView(row);
        }
        if (n == 0) {
            TextView none = new TextView(this);
            none.setText(all == null ? R.string.bens_first : R.string.bens_none);
            none.setTextColor(muted);
            none.setPadding(0, dp(8), 0, dp(8));
            rows.addView(none);
        }
        ScrollView sc = new ScrollView(this);
        sc.addView(rows);
        int maxH = (int) (getResources().getDisplayMetrics().heightPixels * 0.6);
        box.addView(sc, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Math.min(maxH, dp(56) * Math.max(n, 1) + dp(8))));

        TextView close = new TextView(this);
        close.setText(R.string.bens_close);
        close.setTextColor(brand);
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        close.setGravity(Gravity.CENTER);
        close.setPadding(0, dp(12), 0, dp(6));
        close.setOnClickListener(v -> finish());
        box.addView(close);

        setContentView(box);
        getWindow().setLayout(Math.min(getResources().getDisplayMetrics().widthPixels - dp(32), dp(440)), android.view.ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }
}
