package app.mohanndj.alwaei;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The widget «فوائد الكتب» on the home screen (v176, the owner: «نافذة التطبيقات المصغرة للفوائد فقط»): the benefits of
 * one book he chooses, in page order, each by its page, title and text («العنوان والفائدة»), scrolled by the finger.
 * Its head names the book and its count, and «اختر كتاباً» opens a small window of the books that have benefits
 * (BenPickActivity). The page sends the books and their benefits whenever they change (native.js sendBens).
 */
public class BenWidget extends AppWidgetProvider {

    /** The page sent the benefits again, or a book was chosen: every widget «فوائد الكتب» drawn again. */
    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, BenWidget.class));
        for (int id : ids) m.updateAppWidget(id, views(c, id));
        if (ids.length > 0) m.notifyAppWidgetViewDataChanged(ids, R.id.b_list);
    }

    static void refresh(Context c, int id) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        m.updateAppWidget(id, views(c, id));
        m.notifyAppWidgetViewDataChanged(id, R.id.b_list);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c, id));
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        for (int id : ids) Store.setBenBook(c, id, null);
    }

    /** The book a widget shows, from what the page sent (null when none was chosen, or it has no benefits now). */
    static JSONObject bookOf(Context c, int wid) {
        JSONObject all = Store.bens(c);
        JSONArray books = all == null ? null : all.optJSONArray("books");
        String want = Store.benBook(c, wid);
        if (books == null || want.isEmpty()) return null;
        for (int i = 0; i < books.length(); i++) {
            JSONObject b = books.optJSONObject(i);
            if (b != null && want.equals(b.optString("id"))) return b;
        }
        return null;
    }

    private static RemoteViews views(Context c, int wid) {
        JSONObject all = Store.bens(c), b = bookOf(c, wid);
        boolean arab = all != null && all.optBoolean("arab");
        JSONArray books = all == null ? null : all.optJSONArray("books");
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_bens);
        int n = b == null ? 0 : b.optJSONArray("items") == null ? 0 : b.optJSONArray("items").length();
        v.setTextViewText(R.id.b_title, b == null ? c.getString(R.string.bens_name) : b.optString("name"));
        v.setTextViewText(R.id.b_count, b == null ? "" : digits(count(n), arab));
        v.setViewVisibility(R.id.b_count, b == null ? View.GONE : View.VISIBLE);
        // «اختر كتاباً»: the small window of the books (only when the page sent some)
        boolean any = books != null && books.length() > 0;
        v.setViewVisibility(R.id.b_pick, any ? View.VISIBLE : View.GONE);
        Intent pick = new Intent(c, BenPickActivity.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid)
                .setData(Uri.parse("wai-bens://pick/" + wid)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.b_pick, PendingIntent.getActivity(c, wid, pick, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        // its benefits, one row each, scrolled within the widget
        Intent svc = new Intent(c, BenWidgetService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid)
                .setData(Uri.parse("wai-bens://list/" + wid));
        v.setRemoteAdapter(R.id.b_list, svc);
        v.setEmptyView(R.id.b_list, R.id.b_empty);
        String empty = all == null ? c.getString(R.string.bens_first) : !any ? c.getString(R.string.bens_none)
                : b == null ? c.getString(R.string.bens_choose) : "";
        v.setTextViewText(R.id.b_empty, empty);
        if (b == null && any) v.setOnClickPendingIntent(R.id.b_empty, PendingIntent.getActivity(c, wid, pick, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    static String count(int n) {
        return n == 1 ? "فائدة واحدة" : n == 2 ? "فائدتان" : n <= 10 ? n + " فوائد" : n + " فائدة";
    }

    static String digits(String s, boolean arab) {
        if (!arab) return s;
        StringBuilder b = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch);
        return b.toString();
    }
}
