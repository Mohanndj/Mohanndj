package app.mohanndj.alwaei;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The phone restarted, or the app was updated: the phone forgets set alarms then, so they are set again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent in) {
        String a = in.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            Notifs.channels(c);
            Alarms.schedule(c);
        }
    }
}
