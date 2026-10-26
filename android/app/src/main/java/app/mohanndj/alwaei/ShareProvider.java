package app.mohanndj.alwaei;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * A file the page shares (a recording to transcribe, a report's image) lies in the app's cache; the app it is shared
 * with reads it from here, read only, and only what the share gave it (grantUriPermissions).
 */
public class ShareProvider extends ContentProvider {
    static final String DIR = "share";
    private static final String AUTHORITY = "app.mohanndj.alwaei.share";

    static Uri uriOf(String name) {
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath(name).build();
    }

    private File fileOf(Uri u) throws FileNotFoundException {
        String name = u.getLastPathSegment();
        if (getContext() == null || name == null || name.contains("/") || name.startsWith(".")) throw new FileNotFoundException();
        File f = new File(new File(getContext().getCacheDir(), DIR), name);
        if (!f.isFile()) throw new FileNotFoundException();
        return f;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileOf(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        String name = uri.getLastPathSegment();
        int dot = name == null ? -1 : name.lastIndexOf('.');
        String m = dot < 0 ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase());
        return m == null ? "application/octet-stream" : m;
    }

    // its name and size, as the receiving apps ask
    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        try {
            File f = fileOf(uri);
            MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            c.addRow(new Object[]{f.getName(), f.length()});
            return c;
        } catch (FileNotFoundException e) {
            return null;
        }
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] args) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) {
        return 0;
    }
}
