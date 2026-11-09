package moe.ccna.cards;

import android.accounts.AccountManager;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.util.Log;
import android.view.DisplayCutout;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {

    private WebView webView;
    private long lastBackPressTime = 0;
    private int pendingJumpQid = -1;
    private String pendingJumpType = null;
    private BroadcastReceiver jumpReceiver;

    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 2001;
    private static final int NATIVE_IMPORT_REQUEST_CODE = 2002;
    private static final int GOOGLE_ACCOUNT_PICK_CREATE_CODE = 2003;
    private static final int GOOGLE_ACCOUNT_PICK_LINK_CODE = 2004;
    private static final int DRIVE_CREATE_FILE_CODE = 2005;
    private static final int DRIVE_OPEN_FILE_CODE = 2006;

    private static final String PREFS_GOOGLE_SYNC = "ccna_google_sync";
    private static final String KEY_GOOGLE_EMAIL = "google_email";
    private static final String KEY_DRIVE_URI = "drive_sync_uri";
    private static final String KEY_PROVIDER_TYPE = "drive_provider_type";
    private static final String KEY_LAST_SYNC_TIME = "last_sync_time";

    private final ExecutorService driveExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isDriveSyncing = new AtomicBoolean(false);
    private boolean hasLoadedInitialPage = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Customize Window Status and Navigation Bars (Dark #0F172A matching header)
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.setStatusBarColor(0xFF0F172A);
            window.setNavigationBarColor(0xFF0B0F19);
        }

        // Allow drawing into cutout area so the dark status bar background is seamless
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        webView = new WebView(this);
        setContentView(webView);

        // Dynamically report safe insets to CSS --safe-top
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
            window.getDecorView().setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    int top = insets.getSystemWindowInsetTop();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        DisplayCutout cutout = insets.getDisplayCutout();
                        if (cutout != null) {
                            top = Math.max(top, cutout.getSafeInsetTop());
                        }
                    }
                    if (top > 0) {
                        float density = getResources().getDisplayMetrics().density;
                        int cssTop = (int) (top / density);
                        String js = "if (document && document.documentElement && document.documentElement.style) { document.documentElement.style.setProperty('--safe-top', '" + (cssTop + 4) + "px'); }";
                        webView.evaluateJavascript(js, null);
                    }
                    return insets;
                }
            });
        }

        // Configure WebSettings
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d("CCNA_LOG", cm.message() + " -- Line " + cm.lineNumber() + " of " + cm.sourceId());
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                    MainActivity.this.filePathCallback = null;
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && fileChooserParams != null) {
                    try {
                        intent = fileChooserParams.createIntent();
                    } catch (Exception ignored) {}
                }
                if (intent == null) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }

                try {
                    startActivityForResult(Intent.createChooser(intent, "选择学习记录文件 (JSON)"), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "未能打开系统文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                hasLoadedInitialPage = true;
                if (pendingJumpQid > 0) {
                    final int qid = pendingJumpQid;
                    pendingJumpQid = -1;
                    view.postDelayed(() -> view.evaluateJavascript("if (window.jumpToQuestion) { window.jumpToQuestion(" + qid + "); }", null), 200);
                } else if (pendingJumpType != null) {
                    final String t = pendingJumpType;
                    pendingJumpType = null;
                    view.postDelayed(() -> view.evaluateJavascript("if (window.jumpToType) { window.jumpToType('" + t + "'); }", null), 200);
                }
            }
        });

        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");

        // Register dynamic BroadcastReceiver for adb broadcast jumping
        jumpReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                handleIntent(intent);
            }
        };
        IntentFilter filter = new IntentFilter("moe.ccna.cards.JUMP");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(jumpReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(jumpReceiver, filter);
        }

        handleIntent(getIntent());

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (hasLoadedInitialPage && webView != null) {
            webView.postDelayed(() -> webView.evaluateJavascript(
                "if (window.CloudSyncEngine && window.CloudSyncEngine.onAppResume) { window.CloudSyncEngine.onAppResume(); }",
                null
            ), 300);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        int targetQid = -1;
        String targetType = null;
        if (intent.hasExtra("question_id")) {
            targetQid = intent.getIntExtra("question_id", -1);
        } else if (intent.hasExtra("qid")) {
            String qidStr = intent.getStringExtra("qid");
            if (qidStr != null) {
                try {
                    targetQid = Integer.parseInt(qidStr.replaceAll("[^0-9]", ""));
                } catch (Exception ignored) {}
            }
        }
        if (intent.hasExtra("type")) {
            targetType = intent.getStringExtra("type");
        }

        if (targetQid > 0) {
            final int qid = targetQid;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript("if (window.jumpToQuestion) { window.jumpToQuestion(" + qid + "); }", null));
            } else {
                pendingJumpQid = qid;
            }
        } else if (targetType != null) {
            final String t = targetType;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript("if (window.jumpToType) { window.jumpToType('" + t + "'); }", null));
            } else {
                pendingJumpType = t;
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (jumpReceiver != null) {
            try {
                unregisterReceiver(jumpReceiver);
            } catch (Exception ignored) {}
        }
        driveExecutor.shutdownNow();
        super.onDestroy();
    }

    private void launchDriveFileBinder(boolean linkExisting) {
        try {
            Intent intent;
            if (linkExisting) {
                intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
            } else {
                intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "ccna_study_progress.json");
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Uri driveRoot = Uri.parse("content://com.google.android.apps.docs.storage/roots");
                intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, driveRoot);
            }

            Toast.makeText(
                this,
                linkExisting ? "请在左侧菜单选择【Google 云端硬盘】并选中同步文件" : "请在左侧菜单选择【Google 云端硬盘】保存同步文件",
                Toast.LENGTH_LONG
            ).show();

            startActivityForResult(intent, linkExisting ? DRIVE_OPEN_FILE_CODE : DRIVE_CREATE_FILE_CODE);
        } catch (Exception e) {
            Log.e("CCNA_LOG", "Failed to launch Drive file binder", e);
            Toast.makeText(this, "无法打开云端文件选择器: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void handleBoundDriveUri(Uri uri, boolean isNewlyCreated) {
        if (uri == null) return;
        try {
            final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            getContentResolver().takePersistableUriPermission(uri, takeFlags);
        } catch (Exception e) {
            Log.w("CCNA_LOG", "takePersistableUriPermission warning: " + e.getMessage());
        }

        String authority = uri.getAuthority() != null ? uri.getAuthority() : "";
        String providerType = authority.contains("com.google.android.apps.docs") ? "Google Drive" : "Cloud / SAF Document";

        SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
        String email = prefs.getString(KEY_GOOGLE_EMAIL, "");
        if (email == null || email.isEmpty()) {
            email = "Google Drive Account";
        }
        prefs.edit()
            .putString(KEY_GOOGLE_EMAIL, email)
            .putString(KEY_DRIVE_URI, uri.toString())
            .putString(KEY_PROVIDER_TYPE, providerType)
            .apply();

        final String finalEmail = email;
        final String finalProvider = providerType;
        final boolean shouldPushFirst = isNewlyCreated;
        runOnUiThread(() -> {
            if (webView != null) {
                try {
                    JSONObject obj = new JSONObject();
                    obj.put("signedIn", true);
                    obj.put("email", finalEmail);
                    obj.put("providerType", finalProvider);
                    obj.put("isNewlyCreated", shouldPushFirst);
                    String jsArg = JSONObject.quote(obj.toString());
                    webView.evaluateJavascript("if (window.onGoogleDriveBound) { window.onGoogleDriveBound(" + jsArg + "); }", null);
                } catch (Exception ignored) {}
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else if (requestCode == NATIVE_IMPORT_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                try {
                    Uri uri = data.getData();
                    InputStream is = getContentResolver().openInputStream(uri);
                    if (is != null) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line).append("\n");
                        }
                        reader.close();
                        is.close();
                        final String jsonStr = sb.toString();
                        if (webView != null) {
                            runOnUiThread(() -> {
                                String escaped = JSONObject.quote(jsonStr);
                                webView.evaluateJavascript("if (window.handleImportedJsonText) { window.handleImportedJsonText(" + escaped + "); }", null);
                            });
                        }
                    }
                } catch (Exception e) {
                    Log.e("CCNA_LOG", "Import read failed", e);
                    Toast.makeText(this, "读取导入文件失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        } else if (requestCode == GOOGLE_ACCOUNT_PICK_CREATE_CODE || requestCode == GOOGLE_ACCOUNT_PICK_LINK_CODE) {
            boolean linkExisting = (requestCode == GOOGLE_ACCOUNT_PICK_LINK_CODE);
            if (resultCode == Activity.RESULT_OK && data != null) {
                String accountName = data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
                if (accountName != null && !accountName.isEmpty()) {
                    SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
                    prefs.edit().putString(KEY_GOOGLE_EMAIL, accountName).apply();
                }
                launchDriveFileBinder(linkExisting);
            } else {
                Toast.makeText(this, "已取消选择 Google 账号", Toast.LENGTH_SHORT).show();
            }
        } else if (requestCode == DRIVE_CREATE_FILE_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                handleBoundDriveUri(data.getData(), true);
            }
        } else if (requestCode == DRIVE_OPEN_FILE_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                handleBoundDriveUri(data.getData(), false);
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false", result -> {
                boolean handled = "true".equals(result);
                if (!handled) {
                    long currentTime = System.currentTimeMillis();
                    if (currentTime - lastBackPressTime < 2000) {
                        finishAffinity();
                    } else {
                        lastBackPressTime = currentTime;
                        Toast.makeText(MainActivity.this, "再按一次返回退出 CCNA", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        } else {
            super.onBackPressed();
        }
    }

    public class WebAppInterface {
        private final Context context;

        public WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void vibrateSuccess() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    if (vm != null) {
                        vm.getDefaultVibrator().vibrate(VibrationEffect.createOneShot(25, VibrationEffect.DEFAULT_AMPLITUDE));
                    }
                } else {
                    Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                    if (v != null) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            v.vibrate(VibrationEffect.createOneShot(25, VibrationEffect.DEFAULT_AMPLITUDE));
                        } else {
                            v.vibrate(25);
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void vibrateError() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    if (vm != null) {
                        vm.getDefaultVibrator().vibrate(VibrationEffect.createWaveform(new long[]{0, 40, 60, 40}, -1));
                    }
                } else {
                    Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                    if (v != null) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            v.vibrate(VibrationEffect.createWaveform(new long[]{0, 40, 60, 40}, -1));
                        } else {
                            v.vibrate(new long[]{0, 40, 60, 40}, -1);
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void showToast(String message) {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public boolean exportToDownloads(String jsonContent, String fileName) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                                os.flush();
                            }
                        }
                        runOnUiThread(() -> Toast.makeText(context, "已保存至【下载 (Download)】文件夹:\n" + fileName, Toast.LENGTH_LONG).show());
                        return true;
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File outFile = new File(downloadsDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }
                    runOnUiThread(() -> Toast.makeText(context, "已保存至【下载】文件夹:\n" + outFile.getAbsolutePath(), Toast.LENGTH_LONG).show());
                    return true;
                }
            } catch (Exception e) {
                Log.e("CCNA_LOG", "Failed to export to downloads", e);
                runOnUiThread(() -> Toast.makeText(context, "导出失败: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
            return false;
        }

        @JavascriptInterface
        public void pickFileForImport() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择要导入的学习记录 (JSON)"), NATIVE_IMPORT_REQUEST_CODE);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "未能启动文件选择器", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String getGoogleSyncState() {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
                String email = prefs.getString(KEY_GOOGLE_EMAIL, "");
                String uriStr = prefs.getString(KEY_DRIVE_URI, "");
                String providerType = prefs.getString(KEY_PROVIDER_TYPE, "Google Drive");
                long lastSyncTime = prefs.getLong(KEY_LAST_SYNC_TIME, 0L);

                JSONObject obj = new JSONObject();
                obj.put("signedIn", !uriStr.isEmpty());
                obj.put("email", email);
                obj.put("providerType", providerType);
                obj.put("hasBoundFile", !uriStr.isEmpty());
                obj.put("lastSyncTime", lastSyncTime);
                return obj.toString();
            } catch (Exception e) {
                return "{\"signedIn\":false}";
            }
        }

        @JavascriptInterface
        public void signInWithGoogle(final boolean linkExisting) {
            runOnUiThread(() -> {
                try {
                    Intent accountIntent = AccountManager.newChooseAccountIntent(
                        null,
                        null,
                        new String[]{"com.google"},
                        null,
                        null,
                        null,
                        null
                    );
                    startActivityForResult(
                        accountIntent,
                        linkExisting ? GOOGLE_ACCOUNT_PICK_LINK_CODE : GOOGLE_ACCOUNT_PICK_CREATE_CODE
                    );
                } catch (Exception e) {
                    Log.w("CCNA_LOG", "AccountManager picker fallback directly to Drive binder: " + e.getMessage());
                    launchDriveFileBinder(linkExisting);
                }
            });
        }

        @JavascriptInterface
        public void rebindDriveSyncFile(final boolean linkExisting) {
            runOnUiThread(() -> launchDriveFileBinder(linkExisting));
        }

        @JavascriptInterface
        public void signOutGoogle() {
            try {
                SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
                String uriStr = prefs.getString(KEY_DRIVE_URI, "");
                if (!uriStr.isEmpty()) {
                    try {
                        Uri uri = Uri.parse(uriStr);
                        getContentResolver().releasePersistableUriPermission(
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        );
                    } catch (Exception ignored) {}
                }
                prefs.edit().clear().apply();
                runOnUiThread(() -> Toast.makeText(context, "已退出 Google 云同步（本地刷题记录已完整保留）", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                Log.e("CCNA_LOG", "signOutGoogle error", e);
            }
        }

        @JavascriptInterface
        public void cloudPullProgress() {
            driveExecutor.submit(() -> {
                SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
                String uriStr = prefs.getString(KEY_DRIVE_URI, "");
                if (uriStr == null || uriStr.isEmpty()) return;

                try {
                    Uri uri = Uri.parse(uriStr);
                    StringBuilder sb = new StringBuilder();
                    try (InputStream is = getContentResolver().openInputStream(uri)) {
                        if (is != null) {
                            try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                                String line;
                                while ((line = reader.readLine()) != null) {
                                    sb.append(line).append("\n");
                                }
                            }
                        }
                    }
                    final String content = sb.toString().trim();
                    long now = System.currentTimeMillis();
                    prefs.edit().putLong(KEY_LAST_SYNC_TIME, now).apply();

                    runOnUiThread(() -> {
                        if (webView != null) {
                            try {
                                JSONObject res = new JSONObject();
                                res.put("ok", true);
                                res.put("lastSyncTime", now);
                                res.put("data", content);
                                String arg = JSONObject.quote(res.toString());
                                webView.evaluateJavascript("if (window.onCloudPullCallback) { window.onCloudPullCallback(" + arg + "); }", null);
                            } catch (Exception ignored) {}
                        }
                    });
                } catch (Exception e) {
                    Log.e("CCNA_LOG", "cloudPullProgress error", e);
                    runOnUiThread(() -> {
                        if (webView != null) {
                            try {
                                JSONObject res = new JSONObject();
                                res.put("ok", false);
                                res.put("error", e.getMessage() != null ? e.getMessage() : "Pull error");
                                String arg = JSONObject.quote(res.toString());
                                webView.evaluateJavascript("if (window.onCloudPullCallback) { window.onCloudPullCallback(" + arg + "); }", null);
                            } catch (Exception ignored) {}
                        }
                    });
                }
            });
        }

        @JavascriptInterface
        public void cloudPushProgress(final String jsonContent) {
            if (jsonContent == null || jsonContent.isEmpty()) return;
            driveExecutor.submit(() -> {
                if (!isDriveSyncing.compareAndSet(false, true)) {
                    // Another push is already running; serialize cleanly via executor
                }
                try {
                    SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
                    String uriStr = prefs.getString(KEY_DRIVE_URI, "");
                    if (uriStr == null || uriStr.isEmpty()) return;

                    Uri uri = Uri.parse(uriStr);
                    byte[] bytes = jsonContent.getBytes(StandardCharsets.UTF_8);

                    boolean writtenViaPfd = false;
                    try (ParcelFileDescriptor pfd = getContentResolver().openFileDescriptor(uri, "rw")) {
                        if (pfd != null) {
                            try (FileOutputStream fos = new FileOutputStream(pfd.getFileDescriptor())) {
                                FileChannel channel = fos.getChannel();
                                channel.position(0);
                                fos.write(bytes);
                                channel.truncate(bytes.length);
                                fos.flush();
                                pfd.getFileDescriptor().sync();
                                writtenViaPfd = true;
                            }
                        }
                    } catch (Exception pfdEx) {
                        Log.w("CCNA_LOG", "ParcelFileDescriptor rw fallback to openOutputStream: " + pfdEx.getMessage());
                    }

                    if (!writtenViaPfd) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri, "wt")) {
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                            }
                        } catch (Exception wtEx) {
                            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                                if (os != null) {
                                    os.write(bytes);
                                    os.flush();
                                }
                            }
                        }
                    }

                    long now = System.currentTimeMillis();
                    prefs.edit().putLong(KEY_LAST_SYNC_TIME, now).apply();

                    runOnUiThread(() -> {
                        if (webView != null) {
                            try {
                                JSONObject res = new JSONObject();
                                res.put("ok", true);
                                res.put("lastSyncTime", now);
                                String arg = JSONObject.quote(res.toString());
                                webView.evaluateJavascript("if (window.onCloudPushCallback) { window.onCloudPushCallback(" + arg + "); }", null);
                            } catch (Exception ignored) {}
                        }
                    });
                } catch (Exception e) {
                    Log.e("CCNA_LOG", "cloudPushProgress error", e);
                    runOnUiThread(() -> {
                        if (webView != null) {
                            try {
                                JSONObject res = new JSONObject();
                                res.put("ok", false);
                                res.put("error", e.getMessage() != null ? e.getMessage() : "Push error");
                                String arg = JSONObject.quote(res.toString());
                                webView.evaluateJavascript("if (window.onCloudPushCallback) { window.onCloudPushCallback(" + arg + "); }", null);
                            } catch (Exception ignored) {}
                        }
                    });
                } finally {
                    isDriveSyncing.set(false);
                }
            });
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.3.0";
        }
    }
}
