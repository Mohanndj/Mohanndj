package app.mohanndj.alwaei;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * An alarm's time came, an unanswered alarm's five minutes passed, or a notification's button was pressed (on the phone
 * or on the watch) or the notification swiped away. What the page must know is handed to it now if it is open,
 * or kept for when it opens; what cannot wait (the next ring of a snooze) is done here.
 */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent in) {
        String what = in.getAction();
        if (what == null) return;
        Notifs.channels(c);
        long now = System.currentTimeMillis();
        try {
            switch (what) {
                case Alarms.FIRE: {
                    String key = in.getStringExtra("key");
                    if (key == null) return;
                    // the page in sight rings it itself, as in the browser (with its own sheet and «تمت»)
                    if (MainActivity.visible) return;
                    JSONObject a = Alarms.take(c, key);
                    if (a == null) return;
                    JSONObject cfg = Store.alarms(c);
                    Notifs.alarm(c, a, cfg, false);
                    Store.putRang(c, a);
                    Alarms.quietLater(c, key, cfg.optInt("ring", 5));
                    MainActivity.deliver(c, new JSONObject().put("type", "fired").put("id", a.optString("id")).put("key", key).put("ts", now));
                    return;
                }
                case Alarms.QUIET: {
                    String key = in.getStringExtra("key");
                    if (key == null || !Notifs.showing(c, key)) return;
                    // the same notification, without its sound
                    JSONObject a = Store.rang(c, key);
                    if (a != null) Notifs.alarm(c, a, Store.alarms(c), true);
                    return;
                }
                case Notifs.ACT:
                case Notifs.DEL: {
                    String tag = in.getStringExtra("tag"), action = in.getStringExtra("action");
                    JSONObject x = new JSONObject(in.getStringExtra("extra") == null ? "{}" : in.getStringExtra("extra"));
                    if (tag == null || action == null) return;
                    if (tag.equals("timer")) {
                        if (action.equals("timer-stop")) Notifs.cancel(c, tag);
                        MainActivity.deliver(c, new JSONObject().put("type", "timer").put("action", action).put("ts", now));
                        return;
                    }
                    String id = x.optString("id"), key = x.optString("key");
                    if (id.isEmpty() || key.isEmpty()) return;
                    if (!action.equals("dismiss")) Notifs.cancel(c, tag);
                    Alarms.cancelQuiet(c, key);
                    if (action.equals("snooze")) {
                        JSONObject a = new JSONObject().put("key", key).put("id", id).put("title", x.optString("title")).put("body", x.optString("body"));
                        Alarms.snooze(c, a);
                    } else if (action.equals("done")) {
                        Alarms.dropDay(c, id, key);
                    }
                    MainActivity.deliver(c, new JSONObject().put("type", "alarm-action").put("action", action).put("id", id).put("key", key).put("ts", now));
                    return;
                }
                default:
            }
        } catch (JSONException ignored) {
        }
    }
}
