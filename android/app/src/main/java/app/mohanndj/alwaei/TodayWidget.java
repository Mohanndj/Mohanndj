package app.mohanndj.alwaei;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * The widget «اليوم» on the home screen (v116): what is left of the day, as the page's «اليوم» counts it, by its time.
 * The page sends today's list and tomorrow's whenever its data changes (native.js sendWidget), so at midnight the new
 * day's list is shown though the app is closed. A circle ticks a task done: it leaves the list at once, and the page
 * marks it done now if it is open, or when it opens (kept until the page takes it). Anything else opens the app.
 */
public class TodayWidget extends AppWidgetProvider {
    static final String TICK = "app.mohanndj.alwaei.WIDGET_TICK", NEW_DAY = "app.mohanndj.alwaei.WIDGET_DAY";
    private static final int ROW_DP = 46, TOP_DP = 58;

    /** The page sent new lists, a task was ticked, or a new day came: every widget on the home screen drawn again. */
    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TodayWidget.class));
        for (int id : ids) m.updateAppWidget(id, views(c, m, id));
        if (ids.length > 0) newDayAt(c);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c, m, id));
        newDayAt(c);
    }

    // made taller or shorter: as many tasks as it holds
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) {
        m.updateAppWidget(id, views(c, m, id));
    }

    @Override
    public void onReceive(Context c, Intent in) {
        super.onReceive(c, in);
        String a = in.getAction();
        if (TICK.equals(a)) {
            String id = in.getStringExtra("id"), day = in.getStringExtra("day");
            // (the widget's own circles only: another app cannot tick the owner's tasks)
            if (id == null || day == null || !Store.widgetToken(c).equals(in.getStringExtra("tok"))) return;
            Store.widgetTick(c, day, id);
            refresh(c);
            // kept first, then the page (if open) told to take it: a page paused by Android loses nothing, nor gets it twice
            try {
                Store.addPending(c, new JSONObject().put("type", "widget").put("id", id).put("day", day).put("ts", System.currentTimeMillis()));
            } catch (JSONException ignored) {
            }
            MainActivity.pull();
        } else if (NEW_DAY.equals(a)) refresh(c);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static RemoteViews views(Context c, AppWidgetManager m, int wid) {
        JSONObject w = Store.widget(c), days = w.optJSONObject("days");
        boolean arab = w.optBoolean("arab");
        String day = today();
        JSONObject d = days == null ? null : days.optJSONObject(day);
        JSONArray items = d == null ? null : d.optJSONArray("items");
        if (items == null) items = new JSONArray();
        PendingIntent open = openApp(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_today);
        v.setOnClickPendingIntent(R.id.w_top, open);
        v.setTextViewText(R.id.w_date, d == null ? "" : d.optString("date"));
        int n = items.length();
        v.setTextViewText(R.id.w_left, n == 0 ? "" : digits("باقٍ: " + n, arab));
        // nothing sent yet (the app not opened since the widget came), or nothing left
        String empty = d == null ? c.getString(R.string.widget_first) : n == 0 ? c.getString(R.string.widget_none) : null;
        v.setViewVisibility(R.id.w_empty, empty == null ? View.GONE : View.VISIBLE);
        if (empty != null) {
            v.setTextViewText(R.id.w_empty, empty);
            v.setOnClickPendingIntent(R.id.w_empty, open);
        }
        v.removeAllViews(R.id.w_rows);
        int rows = rows(m, wid), show = n > rows ? Math.max(rows - 1, 0) : n;
        for (int i = 0; i < show; i++) {
            JSONObject x = items.optJSONObject(i);
            if (x == null) continue;
            String title = x.optString("t"), late = x.optString("l"), sub = x.optString("s");
            int of = x.optInt("of");
            if (of > 0) sub = (sub.isEmpty() ? "" : sub + " | ") + x.optInt("n") + " من " + of;
            RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_row);
            r.setTextViewText(R.id.w_t, title);
            r.setTextViewText(R.id.w_late, late + (late.isEmpty() || sub.isEmpty() ? "" : " | "));
            r.setViewVisibility(R.id.w_late, late.isEmpty() ? View.GONE : View.VISIBLE);
            r.setTextViewText(R.id.w_s, digits(sub, arab));
            r.setViewVisibility(R.id.w_s, sub.isEmpty() ? View.GONE : View.VISIBLE);
            r.setOnClickPendingIntent(R.id.w_item, open);
            if (x.optBoolean("tick", true)) {
                r.setTextViewText(R.id.w_tick, "○");
                r.setContentDescription(R.id.w_tick, "أتممت: " + title);
                r.setOnClickPendingIntent(R.id.w_tick, tick(c, x.optString("id"), day));
            } else {
                // a book's session: its pages are asked in the app
                r.setTextViewText(R.id.w_tick, "📖");
                r.setContentDescription(R.id.w_tick, "افتح التطبيق: " + title);
                r.setOnClickPendingIntent(R.id.w_tick, open);
            }
            v.addView(R.id.w_rows, r);
        }
        if (n > show) {
            RemoteViews more = new RemoteViews(c.getPackageName(), R.layout.widget_more);
            more.setTextViewText(R.id.w_more, digits("و" + (n - show) + " غيرها | افتح التطبيق", arab));
            more.setOnClickPendingIntent(R.id.w_more, open);
            v.addView(R.id.w_rows, more);
        }
        return v;
    }

    // the rows its height holds (the height of the widget as the phone stands upright)
    private static int rows(AppWidgetManager m, int wid) {
        Bundle o = m.getAppWidgetOptions(wid);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (h <= 0) h = 180;
        return Math.max(1, (h - TOP_DP) / ROW_DP);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent tick(Context c, String id, String day) {
        Intent i = new Intent(c, TodayWidget.class).setAction(TICK)
                .setData(Uri.parse("wai-widget://tick/" + Uri.encode(id) + "/" + day))
                .putExtra("id", id).putExtra("day", day).putExtra("tok", Store.widgetToken(c));
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // a little after midnight: the new day's list (sent by the page the day before)
    private static void newDayAt(Context c) {
        Calendar k = Calendar.getInstance();
        k.add(Calendar.DAY_OF_MONTH, 1);
        k.set(Calendar.HOUR_OF_DAY, 0);
        k.set(Calendar.MINUTE, 0);
        k.set(Calendar.SECOND, 5);
        k.set(Calendar.MILLISECOND, 0);
        PendingIntent pi = PendingIntent.getBroadcast(c, 8, new Intent(c, TodayWidget.class).setAction(NEW_DAY), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.set(AlarmManager.RTC, k.getTimeInMillis(), pi);
    }

    private static String digits(String s, boolean arab) {
        if (!arab) return s;
        StringBuilder b = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch);
        return b.toString();
    }
}
