package moe.ccna.cards;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
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
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private WebView webView;
    private long lastBackPressTime = 0;
    private int pendingJumpQid = -1;
    private String pendingJumpType = null;
    private BroadcastReceiver jumpReceiver;

    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 2001;
    private static final int NATIVE_IMPORT_REQUEST_CODE = 2002;

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
        super.onDestroy();
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
                        finish();
                    } else {
                        lastBackPressTime = currentTime;
                        Toast.makeText(MainActivity.this, "Press back again to exit CCNA", Toast.LENGTH_SHORT).show();
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
        public String getAppVersion() {
            return "1.2.0";
        }
    }
}
