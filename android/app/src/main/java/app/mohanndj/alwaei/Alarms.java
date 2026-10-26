package app.mohanndj.alwaei;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The alarms of the page's tasks, set in the phone's own alarm clock (v113): they ring on time with the screen off, the
 * app closed, and after the phone restarts. The page sends the whole list whenever its data changes (and when it opens),
 * and this replaces what was set before. Each alarm is known by the page's key (task|day|minutes before).
 */
final class Alarms {
    private Alarms() {
    }

    static final String FIRE = "app.mohanndj.alwaei.FIRE", QUIET = "app.mohanndj.alwaei.QUIET";

    private static AlarmManager am(Context c) {
        return (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    }

    private static PendingIntent pi(Context c, String what, String key) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(what)
                .setData(Uri.parse("wai://" + what + "/" + Uri.encode(key))).putExtra("key", key);
        return PendingIntent.getBroadcast(c, (what + key).hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void at(Context c, String key, long when) {
        AlarmManager m = am(c);
        PendingIntent op = pi(c, FIRE, key);
        // the phone's alarm clock: on time even in deep sleep (exact alarms are this app's own use, USE_EXACT_ALARM)
        if (Build.VERSION.SDK_INT < 31 || m.canScheduleExactAlarms()) m.setAlarmClock(new AlarmManager.AlarmClockInfo(when, Notifs.openApp(c)), op);
        else m.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, op);
    }

    /** The page's new list: what is no longer in it is cancelled, the rest set (again). */
    static synchronized void set(Context c, JSONObject cfg) {
        JSONArray old = Store.alarms(c).optJSONArray("list");
        JSONArray list = cfg.optJSONArray("list");
        if (list == null) list = new JSONArray();
        if (old != null) for (int i = 0; i < old.length(); i++) {
            String k = old.optJSONObject(i) == null ? null : old.optJSONObject(i).optString("key");
            if (k != null && find(list, k) == null) am(c).cancel(pi(c, FIRE, k));
        }
        Store.setAlarms(c, cfg);
        schedule(c);
    }

    /** Everything stored, set again (after a restart, or a new list). */
    static synchronized void schedule(Context c) {
        JSONArray list = Store.alarms(c).optJSONArray("list");
        if (list == null) return;
        long now = System.currentTimeMillis();
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a != null && a.optLong("at") > now - 60_000) at(c, a.optString("key"), Math.max(a.optLong("at"), now + 1000));
        }
    }

    static JSONObject find(JSONArray list, String key) {
        if (list == null || key == null) return null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a != null && key.equals(a.optString("key"))) return a;
        }
        return null;
    }

    /** The stored alarm of a key, taken out of the list (it rang). */
    static synchronized JSONObject take(Context c, String key) {
        JSONObject cfg = Store.alarms(c);
        JSONArray list = cfg.optJSONArray("list"), keep = new JSONArray();
        JSONObject found = null;
        if (list != null) for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a != null && key.equals(a.optString("key")) && found == null) found = a;
            else if (a != null) keep.put(a);
        }
        try {
            cfg.put("list", keep);
        } catch (JSONException ignored) {
        }
        Store.setAlarms(c, cfg);
        return found;
    }

    /** «غفوة»: the same alarm again after the page's snooze minutes. */
    static synchronized void snooze(Context c, JSONObject a) {
        JSONObject cfg = Store.alarms(c);
        long when = System.currentTimeMillis() + cfg.optInt("snooze", 10) * 60_000L;
        try {
            JSONObject again = new JSONObject(a.toString()).put("at", when);
            JSONArray list = cfg.optJSONArray("list");
            if (list == null) list = new JSONArray();
            JSONArray keep = new JSONArray();
            for (int i = 0; i < list.length(); i++) {
                JSONObject x = list.optJSONObject(i);
                if (x != null && !x.optString("key").equals(again.optString("key"))) keep.put(x);
            }
            keep.put(again);
            cfg.put("list", keep);
            Store.setAlarms(c, cfg);
            at(c, again.optString("key"), when);
        } catch (JSONException ignored) {
        }
    }

    /** «تمت» for a task's day: its other alarms of that day are let go (the page marks it done when it opens). */
    static synchronized void dropDay(Context c, String id, String key) {
        String[] p = key.split("\\|");
        if (p.length < 2) return;
        String prefix = id + "|" + p[1] + "|";
        JSONObject cfg = Store.alarms(c);
        JSONArray list = cfg.optJSONArray("list"), keep = new JSONArray();
        if (list == null) return;
        for (int i = 0; i < list.length(); i++) {
            JSONObject a = list.optJSONObject(i);
            if (a == null) continue;
            if (a.optString("key").startsWith(prefix)) am(c).cancel(pi(c, FIRE, a.optString("key")));
            else keep.put(a);
        }
        try {
            cfg.put("list", keep);
        } catch (JSONException ignored) {
        }
        Store.setAlarms(c, cfg);
    }

    /** Five minutes after an alarm rang unanswered: it goes quiet (and stays in the shade until answered). */
    static void quietLater(Context c, String key, int minutes) {
        am(c).set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + minutes * 60_000L, pi(c, QUIET, key));
    }

    static void cancelQuiet(Context c, String key) {
        am(c).cancel(pi(c, QUIET, key));
    }
}
