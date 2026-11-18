package app.mohanndj.alwaei;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

/** The rows of the widget «فوائد الكتب» (v176): the chosen book's benefits, each its page, title and whole text. */
public class BenWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent in) {
        return new Rows(getApplicationContext(), in.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0));
    }

    static final class Rows implements RemoteViewsFactory {
        private final Context c;
        private final int wid;
        private JSONArray items = new JSONArray();

        Rows(Context c, int wid) {
            this.c = c;
            this.wid = wid;
        }

        @Override
        public void onCreate() {
        }

        @Override
        public void onDataSetChanged() {
            items = BenWidget.shown(c, wid); // (v177: three at a time, without what its ✓ took off)
        }

        @Override
        public void onDestroy() {
        }

        @Override
        public int getCount() {
            return items.length();
        }

        @Override
        public RemoteViews getViewAt(int i) {
            JSONObject x = items.optJSONObject(i);
            RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_ben_row);
            if (x == null) return r;
            String p = x.optString("p"), t = x.optString("t"), body = x.optString("x");
            r.setTextViewText(R.id.br_t, t);
            r.setTextViewText(R.id.br_p, p);
            r.setViewVisibility(R.id.br_p, p.isEmpty() ? View.GONE : View.VISIBLE);
            r.setTextViewText(R.id.br_x, body);
            r.setViewVisibility(R.id.br_x, body.isEmpty() ? View.GONE : View.VISIBLE);
            // its ✓: off the widget, and the next comes (v177)
            r.setContentDescription(R.id.br_ok, "أزل: " + t);
            r.setOnClickFillInIntent(R.id.br_ok, new Intent().putExtra("ben", x.optString("i")));
            // its title, page or text: the app opens on this benefit itself (v178, his answer «أ: نافذة الفائدة نفسها»)
            Intent open = new Intent().putExtra("ben", x.optString("i")).putExtra("open", true);
            r.setOnClickFillInIntent(R.id.br_t, open);
            r.setOnClickFillInIntent(R.id.br_p, open);
            r.setOnClickFillInIntent(R.id.br_x, open);
            return r;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int i) {
            return i;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
