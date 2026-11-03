package app.mohanndj.alwaei;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

/**
 * v161 (his answers: «المطلوب فقط التشغيل في الخلفية», and leaving the app with a video playing: «يستمر الصوت»): while
 * the app is out of sight and YouTube's video plays on, Android asks for a notification shown all along; it says so,
 * a tap opens the app, «إيقاف» stops the video (its place kept). Gone when he is back in the app, when the video stops,
 * or when the screen is turned off (MainActivity).
 */
public final class YtService extends Service {
    static final String STOP = "app.mohanndj.alwaei.YT_STOP";
    private static final int ID = 7341;
    // (wanted: asked for and not stopped since; running: in the foreground. Android ends the app if a service started
    // this way is stopped before it is put in the foreground, so a stop asked too early waits for it)
    private static volatile boolean wanted, running;

    static void start(Context c) {
        wanted = true;
        try {
            c.startForegroundService(new Intent(c, YtService.class));
        } catch (Exception e) { // (Android refused it: the video plays on as long as Android lets it)
            Log.w(YtPanel.TAG, "service " + e);
        }
    }

    static void stop(Context c) {
        wanted = false;
        if (!running) return; // (not in the foreground yet: it stops itself as soon as it is)
        try {
            c.stopService(new Intent(c, YtService.class));
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent in, int flags, int startId) {
        if (in != null && STOP.equals(in.getAction())) {
            MainActivity.ytStop();
            stopSelf();
            return START_NOT_STICKY;
        }
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, YtService.class).setAction(STOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(this, Notifs.CH_QUIET).setSmallIcon(R.drawable.ic_stat).setColor(0xFF0F766E)
                .setContentTitle("يوتيوب يعمل").setContentText("اضغط لتعود إلى التطبيق").setContentIntent(Notifs.openApp(this))
                .setOngoing(true).setShowWhen(false)
                .addAction(new Notification.Action.Builder(null, "إيقاف", stop).build()).build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(ID, n);
            running = true;
            Log.i(YtPanel.TAG, "service on");
        } catch (Exception e) {
            Log.w(YtPanel.TAG, "service " + e);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!wanted) stopSelf(); // (stopped while it was starting)
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent root) {
        stopSelf(); // (the app swiped away from the recent apps: nothing left playing)
    }

    @Override
    public IBinder onBind(Intent i) {
        return null;
    }
}
