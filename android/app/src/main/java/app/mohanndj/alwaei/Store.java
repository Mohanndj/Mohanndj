package app.mohanndj.alwaei;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * What the app keeps apart from the page (v113): what happened while the page was closed (an alarm rang, «تمت» or
 * «غفوة» pressed, a button of the timer), for the page to apply when it opens; and the alarms the page asked for, with
 * their tone, so they ring on time though the app is closed, and again after the phone restarts.
 */
final class Store {
    private Store() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("wai", Context.MODE_PRIVATE);
    }

    static synchronized void addPending(Context c, JSONObject ev) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("pending", "[]"));
            a.put(ev);
            JSONArray keep = new JSONArray();
            for (int i = Math.max(0, a.length() - 200); i < a.length(); i++) keep.put(a.get(i));
            prefs(c).edit().putString("pending", keep.toString()).apply();
        } catch (JSONException ignored) {
        }
    }

    static synchronized String takePending(Context c) {
        String s = prefs(c).getString("pending", "[]");
        prefs(c).edit().putString("pending", "[]").apply();
        return s;
    }

    // the page's alarms: {tone, sound, snooze, ring, snoozeLabel, list: [{key, id, at, title, body}]}
    static synchronized JSONObject alarms(Context c) {
        try {
            return new JSONObject(prefs(c).getString("alarms", "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static synchronized void setAlarms(Context c, JSONObject cfg) {
        prefs(c).edit().putString("alarms", cfg.toString()).apply();
    }

    // the alarms that rang lately (for their quiet copy after five minutes)
    static synchronized void putRang(Context c, JSONObject a) {
        try {
            JSONObject m = new JSONObject(prefs(c).getString("rang", "{}"));
            m.put(a.optString("key"), a);
            JSONObject keep = new JSONObject();
            long old = System.currentTimeMillis() - 86_400_000L;
            for (java.util.Iterator<String> it = m.keys(); it.hasNext(); ) {
                String k = it.next();
                JSONObject x = m.optJSONObject(k);
                if (x != null && x.optLong("at") > old) keep.put(k, x);
            }
            prefs(c).edit().putString("rang", keep.toString()).apply();
        } catch (JSONException ignored) {
        }
    }

    static synchronized JSONObject rang(Context c, String key) {
        try {
            return new JSONObject(prefs(c).getString("rang", "{}")).optJSONObject(key);
        } catch (JSONException e) {
            return null;
        }
    }

    static synchronized boolean flag(Context c, String name) {
        return prefs(c).getBoolean(name, false);
    }

    static synchronized void setFlag(Context c, String name) {
        prefs(c).edit().putBoolean(name, true).apply();
    }
}
