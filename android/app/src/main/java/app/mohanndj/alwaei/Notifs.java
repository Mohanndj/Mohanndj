package app.mohanndj.alwaei;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.net.Uri;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The phone's notifications (v113), in place of the browser's: the ones the page shows (the timer with its buttons,
 * the note of what is left today, an alarm while the page is open) and the alarms the app rings by itself when the page
 * is out of sight or closed, with the tone chosen in the settings, again and again for five minutes until answered.
 */
final class Notifs {
    private Notifs() {
    }

    static final String CH_QUIET = "quiet_v1", CH_GENERAL = "general_v1", CH_ALARM_LATE = "alarm_late_v1", CH_ALARM_MUTE = "alarm_mute_v1";
    static final String[][] TONES = {{"chime", "جرس مزدوج"}, {"bell", "ناقوس"}, {"soft", "نغمة هادئة"}, {"rising", "متصاعد"}, {"fast", "رنين سريع"}};
    static final String ACT = "app.mohanndj.alwaei.NOTIF";
    static final String DEL = "app.mohanndj.alwaei.NOTIF_DELETE";
    private static final int TEAL = 0xFF0F766E;

    static int idOf(String tag) {
        return tag == null || tag.isEmpty() ? 1 : tag.hashCode();
    }

    static NotificationManager nm(Context c) {
        return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private static int toneRes(String tone) {
        switch (tone == null ? "" : tone) {
            case "bell": return R.raw.tone_bell;
            case "soft": return R.raw.tone_soft;
            case "rising": return R.raw.tone_rising;
            case "fast": return R.raw.tone_fast;
            default: return R.raw.tone_chime;
        }
    }

    static String alarmChannel(String tone, boolean sound) {
        if (!sound) return CH_ALARM_MUTE;
        for (String[] t : TONES) if (t[0].equals(tone)) return "alarm_" + t[0] + "_v1";
        return "alarm_chime_v1";
    }

    // the channels, once: their names are what the phone's settings show
    static void channels(Context c) {
        NotificationManager m = nm(c);
        NotificationChannel q = new NotificationChannel(CH_QUIET, "المؤقت وما بقي لليوم", NotificationManager.IMPORTANCE_LOW);
        q.setShowBadge(false);
        m.createNotificationChannel(q);
        m.createNotificationChannel(new NotificationChannel(CH_GENERAL, "تنبيهات التطبيق", NotificationManager.IMPORTANCE_HIGH));
        AudioAttributes alarm = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        long[] vib = {0, 300, 150, 300};
        for (String[] t : TONES) {
            NotificationChannel ch = new NotificationChannel("alarm_" + t[0] + "_v1", "المنبه: " + t[1], NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(Uri.parse("android.resource://" + c.getPackageName() + "/" + toneRes(t[0])), alarm);
            ch.enableVibration(true);
            ch.setVibrationPattern(vib);
            ch.setBypassDnd(false);
            m.createNotificationChannel(ch);
        }
        NotificationChannel mute = new NotificationChannel(CH_ALARM_MUTE, "المنبه بلا صوت", NotificationManager.IMPORTANCE_HIGH);
        mute.setSound(null, null);
        mute.enableVibration(true);
        mute.setVibrationPattern(vib);
        m.createNotificationChannel(mute);
        NotificationChannel late = new NotificationChannel(CH_ALARM_LATE, "منبه رنّ ولم يُجب", NotificationManager.IMPORTANCE_LOW);
        late.setSound(null, null);
        m.createNotificationChannel(late);
    }

    static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // a button of a notification (or the notification swiped away): to AlarmReceiver, with what it needs when the page is closed
    private static PendingIntent action(Context c, String what, String tag, String action, JSONObject extra) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(what)
                .setData(Uri.parse("wai://" + what + "/" + Uri.encode(tag) + "/" + Uri.encode(action)))
                .putExtra("tag", tag).putExtra("action", action).putExtra("extra", extra.toString());
        return PendingIntent.getBroadcast(c, (tag + "|" + action + "|" + what).hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static Notification.Builder base(Context c, String channel, String title, String body) {
        return new Notification.Builder(c, channel).setSmallIcon(R.drawable.ic_stat).setColor(TEAL)
                .setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(openApp(c)).setShowWhen(true);
    }

    /** A notification the page shows (showNotification / new Notification): {title, body, tag, actions, silent, data…}. */
    static void post(Context c, JSONObject n) {
        String tag = n.optString("tag", "");
        String title = n.optString("title", ""), body = n.optString("body", "");
        JSONObject data = n.optJSONObject("data");
        if (data == null) data = new JSONObject();
        boolean timer = tag.equals("timer"), quiet = timer || tag.equals("pin") || n.optBoolean("silent");
        boolean alarm = data.has("key") && data.has("id");
        Notification.Builder b = base(c, quiet ? CH_QUIET : CH_GENERAL, title, body)
                .setOnlyAlertOnce(!n.optBoolean("renotify")).setAutoCancel(!timer && !tag.equals("pin"));
        if (timer) b.setOngoing(true).setCategory(Notification.CATEGORY_PROGRESS);
        if (alarm) b.setCategory(Notification.CATEGORY_REMINDER);
        long ts = n.optLong("timestamp", 0);
        if (ts > 0) b.setWhen(ts);
        JSONObject extra = new JSONObject();
        try {
            extra.put("id", data.optString("id", "")).put("key", data.optString("key", "")).put("title", title).put("body", body);
        } catch (Exception ignored) {
        }
        JSONArray acts = n.optJSONArray("actions");
        if (acts != null) for (int i = 0; i < acts.length() && i < 3; i++) {
            JSONObject a = acts.optJSONObject(i);
            if (a == null) continue;
            b.addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat), a.optString("title"),
                    action(c, ACT, tag, a.optString("action"), extra)).build());
        }
        if (alarm) b.setDeleteIntent(action(c, DEL, tag, "dismiss", extra));
        nm(c).notify(idOf(tag), b.build());
    }

    /** An alarm the app rings by itself: its tone again and again (until answered, or five minutes and it goes quiet). */
    static void alarm(Context c, JSONObject a, JSONObject cfg, boolean late) {
        String key = a.optString("key"), title = a.optString("title"), body = a.optString("body");
        String channel = late ? CH_ALARM_LATE : alarmChannel(cfg.optString("tone"), cfg.optBoolean("sound", true));
        JSONObject extra = new JSONObject();
        try {
            extra.put("id", a.optString("id")).put("key", key).put("title", title).put("body", body);
        } catch (Exception ignored) {
        }
        Notification.Builder b = base(c, channel, title, body).setCategory(Notification.CATEGORY_ALARM)
                .setAutoCancel(true).setOnlyAlertOnce(late).setWhen(a.optLong("at", System.currentTimeMillis()))
                .setDeleteIntent(action(c, DEL, key, "dismiss", extra));
        Icon ic = Icon.createWithResource(c, R.drawable.ic_stat);
        b.addAction(new Notification.Action.Builder(ic, "تمت", action(c, ACT, key, "done", extra)).build());
        b.addAction(new Notification.Action.Builder(ic, cfg.optString("snoozeLabel", "غفوة"), action(c, ACT, key, "snooze", extra)).build());
        Notification n = b.build();
        if (!late) n.flags |= Notification.FLAG_INSISTENT;
        nm(c).notify(idOf(key), n);
    }

    static void cancel(Context c, String tag) {
        nm(c).cancel(idOf(tag));
    }

    static boolean showing(Context c, String tag) {
        int id = idOf(tag);
        for (StatusBarNotification s : nm(c).getActiveNotifications()) if (s.getId() == id) return true;
        return false;
    }
}
