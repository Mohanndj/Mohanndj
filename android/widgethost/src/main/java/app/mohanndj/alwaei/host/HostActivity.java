package app.mohanndj.alwaei.host;

import android.app.Activity;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.widget.FrameLayout;

/**
 * The app's widget «اليوم» placed as a home screen would place it (four cells by about three), so GitHub's emulator can
 * read it, press its circles and take its picture (android/ci-widget.sh). Allowed to place it by «appwidget grantbind».
 */
public class HostActivity extends Activity {
    private static final int W = 340, H = 300; // dp
    private AppWidgetHost host;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        host = new AppWidgetHost(this, 4711);
        AppWidgetManager m = AppWidgetManager.getInstance(this);
        ComponentName cn = new ComponentName("app.mohanndj.alwaei", "app.mohanndj.alwaei.TodayWidget");
        int id = host.allocateAppWidgetId();
        Bundle o = new Bundle();
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, W);
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, W);
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, H);
        o.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, H);
        boolean ok = m.bindAppWidgetIdIfAllowed(id, cn, o);
        Log.i("WaiHost", "bind " + ok + " id " + id);
        FrameLayout f = new FrameLayout(this);
        f.setBackgroundColor(0xFF3E6B8A);
        if (ok) {
            AppWidgetProviderInfo info = m.getAppWidgetInfo(id);
            AppWidgetHostView v = host.createView(getApplicationContext(), id, info);
            float dp = getResources().getDisplayMetrics().density;
            f.addView(v, new FrameLayout.LayoutParams((int) (W * dp), (int) (H * dp), Gravity.CENTER));
            sendBroadcast(new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(cn).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[]{id}));
        }
        setContentView(f);
    }

    @Override
    protected void onStart() {
        super.onStart();
        host.startListening();
    }

    @Override
    protected void onStop() {
        super.onStop();
        host.stopListening();
    }
}
