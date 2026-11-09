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
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.MediaStore;
import android.util.Base64;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
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
    private static final int DRIVE_CREATE_FILE_CODE = 2005;
    private static final int DRIVE_OPEN_FILE_CODE = 2006;

    private static final String PREFS_GOOGLE_SYNC = "ccna_google_sync";
    private static final String KEY_SYNC_MODE = "sync_mode"; // "drive_rest" or "saf_uri"
    private static final String KEY_GOOGLE_EMAIL = "google_email";
    private static final String KEY_DRIVE_URI = "drive_sync_uri";
    private static final String KEY_PROVIDER_TYPE = "drive_provider_type";
    private static final String KEY_LAST_SYNC_TIME = "last_sync_time";

    // Direct Google Drive REST API v3 & OAuth 2.0 Loopback keys
    private static final String KEY_ACCESS_TOKEN = "oauth_access_token";
    private static final String KEY_REFRESH_TOKEN = "oauth_refresh_token";
    private static final String KEY_TOKEN_EXPIRES_AT = "oauth_token_expires_at";
    private static final String KEY_DRIVE_FILE_ID = "drive_file_id";
    private static final String KEY_CUSTOM_CLIENT_ID = "custom_oauth_client_id";
    private static final String KEY_CUSTOM_CLIENT_SECRET = "custom_oauth_client_secret";

    // Production-verified Installed-App OAuth 2.0 credentials supporting RFC 8252 http://127.0.0.1:<port>/ loopback
    private static final String DEFAULT_OAUTH_CLIENT_ID = "202264815644.apps.googleusercontent.com";
    private static final String DEFAULT_OAUTH_CLIENT_SECRET = "X4Z3ca8xfWDb1Voo-F9a7ZxJ";
    private static final String DRIVE_SYNC_FILENAME = "ccna_study_progress.json";

    private final ExecutorService driveExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isDriveSyncing = new AtomicBoolean(false);
    private boolean hasLoadedInitialPage = false;

    // Active OAuth2 Loopback Server state
    private volatile ServerSocket oauthServerSocket;
    private volatile String pendingCodeVerifier;
    private volatile String pendingRedirectUri;
    private volatile String lastProcessedOAuthCode = "";

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

        // Check if this is an OAuth 2.0 deep-link callback (ccna://oauth-done?code=...)
        Uri dataUri = intent.getData();
        if (dataUri != null && "ccna".equals(dataUri.getScheme())) {
            String code = dataUri.getQueryParameter("code");
            if (code != null && !code.isEmpty() && !code.equals(lastProcessedOAuthCode)) {
                lastProcessedOAuthCode = code;
                closeOAuthServerSocket();
                final String verifier = pendingCodeVerifier;
                final String redir = pendingRedirectUri;
                driveExecutor.submit(() -> completeOAuthWithCode(code, verifier, redir));
            }
            return;
        }

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
        closeOAuthServerSocket();
        if (jumpReceiver != null) {
            try {
                unregisterReceiver(jumpReceiver);
            } catch (Exception ignored) {}
        }
        driveExecutor.shutdownNow();
        super.onDestroy();
    }

    // =========================================================================
    // FBReader-Style Direct Google Drive REST API v3 & Loopback OAuth 2.0 Engine
    // =========================================================================

    private String getEffectiveClientId() {
        SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
        String custom = prefs.getString(KEY_CUSTOM_CLIENT_ID, "");
        return (custom != null && !custom.trim().isEmpty()) ? custom.trim() : DEFAULT_OAUTH_CLIENT_ID;
    }

    private String getEffectiveClientSecret() {
        SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
        String customId = prefs.getString(KEY_CUSTOM_CLIENT_ID, "");
        String customSecret = prefs.getString(KEY_CUSTOM_CLIENT_SECRET, "");
        if (customId != null && !customId.trim().isEmpty()) {
            return customSecret != null ? customSecret.trim() : "";
        }
        return DEFAULT_OAUTH_CLIENT_SECRET;
    }

    private void closeOAuthServerSocket() {
        if (oauthServerSocket != null) {
            try {
                oauthServerSocket.close();
            } catch (Exception ignored) {}
            oauthServerSocket = null;
        }
    }

    private static String generatePkceVerifier() {
        byte[] randomBytes = new byte[32];
        new SecureRandom().nextBytes(randomBytes);
        return Base64.encodeToString(randomBytes, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private static String computePkceChallenge(String verifier) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.encodeToString(digest, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        } catch (Exception e) {
            return verifier;
        }
    }

    private void startGoogleOAuthLoopbackFlow() {
        closeOAuthServerSocket();
        try {
            final ServerSocket server = new ServerSocket(0, 5, InetAddress.getByName("127.0.0.1"));
            server.setSoTimeout(180_000); // 3-minute timeout for user login
            this.oauthServerSocket = server;

            int port = server.getLocalPort();
            final String redirectUri = "http://127.0.0.1:" + port + "/";
            final String codeVerifier = generatePkceVerifier();
            final String codeChallenge = computePkceChallenge(codeVerifier);

            this.pendingCodeVerifier = codeVerifier;
            this.pendingRedirectUri = redirectUri;

            Thread listenerThread = new Thread(() -> {
                try {
                    while (!server.isClosed()) {
                        try (Socket client = server.accept()) {
                            client.setSoTimeout(5000);
                            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
                            String requestLine = reader.readLine();
                            if (requestLine == null || requestLine.isEmpty()) continue;

                            // Example: GET /?code=4/0A...&scope=... HTTP/1.1
                            String[] parts = requestLine.split(" ");
                            String pathAndQuery = parts.length > 1 ? parts[1] : "/";

                            if (pathAndQuery.startsWith("/favicon.ico")) {
                                OutputStream os = client.getOutputStream();
                                os.write("HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.UTF_8));
                                os.flush();
                                continue;
                            }

                            Uri callbackUri = Uri.parse("http://127.0.0.1" + pathAndQuery);
                            String code = callbackUri.getQueryParameter("code");
                            String error = callbackUri.getQueryParameter("error");

                            if (code != null && !code.isEmpty()) {
                                String encodedCode = URLEncoder.encode(code, "UTF-8");
                                String deepLink = "intent://oauth-done?code=" + encodedCode + "#Intent;scheme=ccna;package=moe.ccna.cards;end";
                                String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
                                    + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                                    + "<title>CCNA Google Drive Sync</title>"
                                    + "<style>body{background:#0F172A;color:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0;padding:20px;text-align:center}"
                                    + ".card{background:#1E293B;border:1px solid #334155;border-radius:16px;padding:28px 24px;max-width:380px;box-shadow:0 10px 25px rgba(0,0,0,0.4)}"
                                    + ".icon{font-size:48px;margin-bottom:12px}.title{font-size:20px;font-weight:700;margin-bottom:8px;color:#10B981}"
                                    + ".desc{font-size:14px;color:#94A3B8;line-height:1.5;margin-bottom:20px}"
                                    + ".btn{display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:15px}</style>"
                                    + "</head><body><div class='card'>"
                                    + "<div class='icon'>☁️✓</div>"
                                    + "<div class='title'>Google Drive 授权成功</div>"
                                    + "<div class='desc'>正在自动返回 CCNA 刷题应用并同步云端进度...</div>"
                                    + "<a class='btn' href='" + deepLink + "'>立即返回 CCNA 应用</a>"
                                    + "</div><script>"
                                    + "setTimeout(function(){ window.location.replace('" + deepLink + "'); }, 150);"
                                    + "</script></body></html>";

                                byte[] bodyBytes = html.getBytes(StandardCharsets.UTF_8);
                                String header = "HTTP/1.1 200 OK\r\n"
                                    + "Content-Type: text/html; charset=utf-8\r\n"
                                    + "Content-Length: " + bodyBytes.length + "\r\n"
                                    + "Cache-Control: no-store\r\n"
                                    + "Connection: close\r\n\r\n";
                                OutputStream os = client.getOutputStream();
                                os.write(header.getBytes(StandardCharsets.UTF_8));
                                os.write(bodyBytes);
                                os.flush();

                                if (!code.equals(lastProcessedOAuthCode)) {
                                    lastProcessedOAuthCode = code;
                                    driveExecutor.submit(() -> completeOAuthWithCode(code, codeVerifier, redirectUri));
                                }
                                runOnUiThread(() -> {
                                    try {
                                        Intent frontIntent = new Intent(MainActivity.this, MainActivity.class);
                                        frontIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                        startActivity(frontIntent);
                                    } catch (Exception ignored) {}
                                });
                                break;
                            } else if (error != null) {
                                String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                                    + "<body style='background:#0F172A;color:#F8FAFC;font-family:sans-serif;text-align:center;padding:40px;'>"
                                    + "<h3>⚠️ 授权未完成: " + error + "</h3><p>您可以关闭此页面返回 CCNA 应用重试。</p></body></html>";
                                byte[] bodyBytes = html.getBytes(StandardCharsets.UTF_8);
                                OutputStream os = client.getOutputStream();
                                os.write(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + bodyBytes.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                                os.write(bodyBytes);
                                os.flush();
                                break;
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.d("CCNA_LOG", "OAuth loopback server ended: " + e.getMessage());
                } finally {
                    closeOAuthServerSocket();
                }
            }, "CCNA-OAuth-Loopback");
            listenerThread.setDaemon(true);
            listenerThread.start();

            String authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
                + "?client_id=" + URLEncoder.encode(getEffectiveClientId(), "UTF-8")
                + "&redirect_uri=" + URLEncoder.encode(redirectUri, "UTF-8")
                + "&response_type=code"
                + "&scope=" + URLEncoder.encode("https://www.googleapis.com/auth/drive.file openid email", "UTF-8")
                + "&access_type=offline"
                + "&prompt=" + URLEncoder.encode("select_account consent", "UTF-8")
                + "&code_challenge=" + URLEncoder.encode(codeChallenge, "UTF-8")
                + "&code_challenge_method=S256";

            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(authUrl));
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(browserIntent);
            Toast.makeText(this, "请在浏览器中登录 Google 账号并点击允许", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Log.e("CCNA_LOG", "Failed to start OAuth loopback flow", e);
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("ECONNREFUSED")) {
                Toast.makeText(this, "⚠️ 系统防火墙禁用了 CCNA 的联网权限，请在【应用信息 -> 移动数据与 Wi-Fi】中开启网络访问", Toast.LENGTH_LONG).show();
                try {
                    Intent settingsIntent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                    startActivity(settingsIntent);
                } catch (Exception ignored) {}
            } else {
                Toast.makeText(this, "启动 Google 授权失败: " + msg, Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void completeOAuthWithCode(String code, String codeVerifier, String redirectUri) {
        try {
            String effectiveRedirect = (redirectUri != null && !redirectUri.isEmpty()) ? redirectUri : "http://127.0.0.1/";
            StringBuilder form = new StringBuilder();
            form.append("client_id=").append(URLEncoder.encode(getEffectiveClientId(), "UTF-8"));
            String secret = getEffectiveClientSecret();
            if (!secret.isEmpty()) {
                form.append("&client_secret=").append(URLEncoder.encode(secret, "UTF-8"));
            }
            form.append("&code=").append(URLEncoder.encode(code, "UTF-8"));
            form.append("&grant_type=authorization_code");
            form.append("&redirect_uri=").append(URLEncoder.encode(effectiveRedirect, "UTF-8"));
            if (codeVerifier != null && !codeVerifier.isEmpty()) {
                form.append("&code_verifier=").append(URLEncoder.encode(codeVerifier, "UTF-8"));
            }

            byte[] postBytes = form.toString().getBytes(StandardCharsets.UTF_8);
            int status = -1;
            String respText = "";
            Exception lastNetEx = null;

            // Retry up to 3 times across 600ms intervals in case the app is transitioning from background to foreground
            for (int attempt = 1; attempt <= 3; attempt++) {
                try {
                    HttpURLConnection conn = (HttpURLConnection) new URL("https://oauth2.googleapis.com/token").openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(20000);
                    conn.setRequestMethod("POST");
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(postBytes);
                        os.flush();
                    }
                    status = conn.getResponseCode();
                    respText = readStreamText(status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream());
                    lastNetEx = null;
                    break;
                } catch (Exception netEx) {
                    lastNetEx = netEx;
                    if (attempt < 3) {
                        try { Thread.sleep(650); } catch (InterruptedException ignored) {}
                    }
                }
            }
            if (lastNetEx != null) {
                throw lastNetEx;
            }
            if (status < 200 || status >= 300) {
                throw new IOException("Token exchange HTTP " + status + ": " + respText);
            }

            JSONObject tokenJson = new JSONObject(respText);
            String accessToken = tokenJson.optString("access_token", "");
            String refreshToken = tokenJson.optString("refresh_token", "");
            long expiresIn = tokenJson.optLong("expires_in", 3500L);
            String idToken = tokenJson.optString("id_token", "");

            if (accessToken.isEmpty()) {
                throw new IOException("Empty access_token in response");
            }

            String email = extractEmailFromIdToken(idToken);
            if (email.isEmpty()) {
                email = fetchGoogleUserEmail(accessToken);
            }
            if (email.isEmpty()) {
                email = "Google Drive Account";
            }

            SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit()
                .putString(KEY_SYNC_MODE, "drive_rest")
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putLong(KEY_TOKEN_EXPIRES_AT, System.currentTimeMillis() + (expiresIn * 1000L))
                .putString(KEY_GOOGLE_EMAIL, email)
                .putString(KEY_PROVIDER_TYPE, "Google Drive");
            if (!refreshToken.isEmpty()) {
                editor.putString(KEY_REFRESH_TOKEN, refreshToken);
            }
            editor.apply();

            final String finalEmail = email;
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, "☁️ 已连接 Google Drive (" + finalEmail + ")", Toast.LENGTH_SHORT).show();
                if (webView != null) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("signedIn", true);
                        obj.put("syncMode", "drive_rest");
                        obj.put("email", finalEmail);
                        obj.put("providerType", "Google Drive");
                        obj.put("isNewlyCreated", false);
                        String jsArg = JSONObject.quote(obj.toString());
                        webView.evaluateJavascript("if (window.onGoogleDriveBound) { window.onGoogleDriveBound(" + jsArg + "); }", null);
                    } catch (Exception ignored) {}
                }
            });
        } catch (Exception e) {
            Log.e("CCNA_LOG", "completeOAuthWithCode failed", e);
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Google 授权验证失败: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    private String extractEmailFromIdToken(String idToken) {
        if (idToken == null || idToken.isEmpty()) return "";
        try {
            String[] parts = idToken.split("\\.");
            if (parts.length >= 2) {
                byte[] decoded = Base64.decode(parts[1], Base64.URL_SAFE);
                JSONObject payload = new JSONObject(new String(decoded, StandardCharsets.UTF_8));
                return payload.optString("email", "");
            }
        } catch (Exception ignored) {}
        return "";
    }

    private String fetchGoogleUserEmail(String accessToken) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL("https://www.googleapis.com/oauth2/v3/userinfo").openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            if (conn.getResponseCode() == 200) {
                JSONObject obj = new JSONObject(readStreamText(conn.getInputStream()));
                return obj.optString("email", "");
            }
        } catch (Exception ignored) {}
        return "";
    }

    private String ensureValidAccessToken() throws Exception {
        SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
        String accessToken = prefs.getString(KEY_ACCESS_TOKEN, "");
        String refreshToken = prefs.getString(KEY_REFRESH_TOKEN, "");
        long expiresAt = prefs.getLong(KEY_TOKEN_EXPIRES_AT, 0L);

        if (!accessToken.isEmpty() && System.currentTimeMillis() < (expiresAt - 60_000L)) {
            return accessToken;
        }
        if (refreshToken.isEmpty()) {
            if (!accessToken.isEmpty()) return accessToken;
            throw new IOException("Missing refresh_token, please sign in again");
        }

        StringBuilder form = new StringBuilder();
        form.append("client_id=").append(URLEncoder.encode(getEffectiveClientId(), "UTF-8"));
        String secret = getEffectiveClientSecret();
        if (!secret.isEmpty()) {
            form.append("&client_secret=").append(URLEncoder.encode(secret, "UTF-8"));
        }
        form.append("&refresh_token=").append(URLEncoder.encode(refreshToken, "UTF-8"));
        form.append("&grant_type=refresh_token");

        HttpURLConnection conn = (HttpURLConnection) new URL("https://oauth2.googleapis.com/token").openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        byte[] postBytes = form.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream os = conn.getOutputStream()) {
            os.write(postBytes);
            os.flush();
        }

        int status = conn.getResponseCode();
        String respText = readStreamText(status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream());
        if (status < 200 || status >= 300) {
            throw new IOException("Token refresh HTTP " + status + ": " + respText);
        }

        JSONObject json = new JSONObject(respText);
        String newAccess = json.optString("access_token", "");
        long expiresIn = json.optLong("expires_in", 3500L);
        if (newAccess.isEmpty()) {
            throw new IOException("Empty access_token on refresh");
        }

        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, newAccess)
            .putLong(KEY_TOKEN_EXPIRES_AT, System.currentTimeMillis() + (expiresIn * 1000L))
            .apply();
        return newAccess;
    }

    private JSONArray listDriveSyncFiles(String accessToken) throws Exception {
        String q = "name='" + DRIVE_SYNC_FILENAME + "' and trashed=false";
        String urlStr = "https://www.googleapis.com/drive/v3/files"
            + "?q=" + URLEncoder.encode(q, "UTF-8")
            + "&spaces=drive"
            + "&fields=" + URLEncoder.encode("files(id,name,modifiedTime)", "UTF-8")
            + "&orderBy=" + URLEncoder.encode("modifiedTime desc", "UTF-8")
            + "&pageSize=10";

        int status = -1;
        String respText = "";
        for (int attempt = 1; attempt <= 3; attempt++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);

            status = conn.getResponseCode();
            respText = readStreamText(status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream());
            if (status >= 200 && status < 300) {
                JSONObject obj = new JSONObject(respText);
                JSONArray files = obj.optJSONArray("files");
                return files != null ? files : new JSONArray();
            }
            if ((status == 403 || status == 429 || status >= 500) && attempt < 3) {
                try { Thread.sleep(1100L * attempt); } catch (InterruptedException ignored) {}
                continue;
            }
            break;
        }
        throw new IOException("Drive files.list HTTP " + status + ": " + respText);
    }

    private String downloadDriveFile(String accessToken, String fileId) throws Exception {
        String urlStr = "https://www.googleapis.com/drive/v3/files/" + URLEncoder.encode(fileId, "UTF-8") + "?alt=media";
        int status = -1;
        String respText = "";
        for (int attempt = 1; attempt <= 3; attempt++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(25000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);

            status = conn.getResponseCode();
            respText = readStreamText(status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream());
            if (status >= 200 && status < 300) {
                return respText != null ? respText.trim() : "";
            }
            if (status == 404) {
                throw new IOException("FILE_NOT_FOUND_404");
            }
            if ((status == 403 || status == 429 || status >= 500) && attempt < 3) {
                try { Thread.sleep(1100L * attempt); } catch (InterruptedException ignored) {}
                continue;
            }
            break;
        }
        throw new IOException("Drive files.get HTTP " + status + ": " + respText);
    }

    private void deleteDuplicateDriveFile(String accessToken, String fileId) {
        try {
            String urlStr = "https://www.googleapis.com/drive/v3/files/" + URLEncoder.encode(fileId, "UTF-8");
            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestMethod("DELETE");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.getResponseCode();
        } catch (Exception ignored) {}
    }

    private String uploadDriveFileContent(String accessToken, String existingFileId, byte[] jsonBytes) throws Exception {
        // 1. If we already have a fileId, update via POST + X-HTTP-Method-Override: PATCH
        if (existingFileId != null && !existingFileId.isEmpty()) {
            String updateUrl = "https://www.googleapis.com/upload/drive/v3/files/"
                + URLEncoder.encode(existingFileId, "UTF-8")
                + "?uploadType=media";
            HttpURLConnection conn = (HttpURLConnection) new URL(updateUrl).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(25000);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(jsonBytes);
                os.flush();
            }
            int status = conn.getResponseCode();
            if (status >= 200 && status < 300) {
                return existingFileId;
            }
            if (status != 404) {
                String err = readStreamText(conn.getErrorStream());
                throw new IOException("Drive files.update HTTP " + status + ": " + err);
            }
            // If 404 (deleted remotely), fall through and recreate the file cleanly
        }

        // 2. Create new ccna_study_progress.json via multipart upload
        String boundary = "ccna_drive_sync_boundary_" + System.currentTimeMillis();
        String createUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
        HttpURLConnection conn = (HttpURLConnection) new URL(createUrl).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(25000);
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + accessToken);
        conn.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);
        conn.setDoOutput(true);

        JSONObject meta = new JSONObject();
        meta.put("name", DRIVE_SYNC_FILENAME);
        meta.put("mimeType", "application/json");
        meta.put("description", "CCNA Practice Cards Study Progress Sync");

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        String part1 = "--" + boundary + "\r\n"
            + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            + meta.toString() + "\r\n"
            + "--" + boundary + "\r\n"
            + "Content-Type: application/json; charset=UTF-8\r\n\r\n";
        String tail = "\r\n--" + boundary + "--\r\n";
        bos.write(part1.getBytes(StandardCharsets.UTF_8));
        bos.write(jsonBytes);
        bos.write(tail.getBytes(StandardCharsets.UTF_8));

        try (OutputStream os = conn.getOutputStream()) {
            os.write(bos.toByteArray());
            os.flush();
        }

        int status = conn.getResponseCode();
        String respText = readStreamText(status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream());
        if (status < 200 || status >= 300) {
            throw new IOException("Drive files.create HTTP " + status + ": " + respText);
        }
        JSONObject created = new JSONObject(respText);
        return created.optString("id", "");
    }

    private static String readStreamText(InputStream is) {
        if (is == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
        } catch (Exception ignored) {}
        return sb.toString().trim();
    }

    // =========================================================================
    // Secondary Local / SAF File Binding Fallback
    // =========================================================================

    private void launchSafFileBinder(boolean linkExisting) {
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
                intent.putExtra(Intent.EXTRA_TITLE, DRIVE_SYNC_FILENAME);
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

            startActivityForResult(intent, linkExisting ? DRIVE_OPEN_FILE_CODE : DRIVE_CREATE_FILE_CODE);
        } catch (Exception e) {
            Log.e("CCNA_LOG", "Failed to launch SAF file binder", e);
            Toast.makeText(this, "无法打开文件选择器: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void handleBoundSafUri(Uri uri, boolean isNewlyCreated) {
        if (uri == null) return;
        try {
            final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            getContentResolver().takePersistableUriPermission(uri, takeFlags);
        } catch (Exception e) {
            Log.w("CCNA_LOG", "takePersistableUriPermission warning: " + e.getMessage());
        }

        String authority = uri.getAuthority() != null ? uri.getAuthority() : "";
        String providerType = authority.contains("com.google.android.apps.docs") ? "Google Drive (SAF)" : "Local / SAF File";

        SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_SYNC_MODE, "saf_uri")
            .putString(KEY_GOOGLE_EMAIL, uri.getLastPathSegment() != null ? uri.getLastPathSegment() : DRIVE_SYNC_FILENAME)
            .putString(KEY_DRIVE_URI, uri.toString())
            .putString(KEY_PROVIDER_TYPE, providerType)
            .apply();

        final String finalProvider = providerType;
        final boolean shouldPushFirst = isNewlyCreated;
        runOnUiThread(() -> {
            if (webView != null) {
                try {
                    JSONObject obj = new JSONObject();
                    obj.put("signedIn", true);
                    obj.put("syncMode", "saf_uri");
                    obj.put("email", DRIVE_SYNC_FILENAME);
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
                        final String jsonStr = readStreamText(is);
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
        } else if (requestCode == DRIVE_CREATE_FILE_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                handleBoundSafUri(data.getData(), true);
            }
        } else if (requestCode == DRIVE_OPEN_FILE_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                handleBoundSafUri(data.getData(), false);
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
                String syncMode = prefs.getString(KEY_SYNC_MODE, "");
                String email = prefs.getString(KEY_GOOGLE_EMAIL, "");
                String uriStr = prefs.getString(KEY_DRIVE_URI, "");
                String refreshToken = prefs.getString(KEY_REFRESH_TOKEN, "");
                String accessToken = prefs.getString(KEY_ACCESS_TOKEN, "");
                String providerType = prefs.getString(KEY_PROVIDER_TYPE, "Google Drive");
                long lastSyncTime = prefs.getLong(KEY_LAST_SYNC_TIME, 0L);

                boolean signedIn;
                if ("drive_rest".equals(syncMode)) {
                    signedIn = !refreshToken.isEmpty() || !accessToken.isEmpty();
                } else {
                    signedIn = !uriStr.isEmpty();
                }

                JSONObject obj = new JSONObject();
                obj.put("signedIn", signedIn);
                obj.put("syncMode", syncMode.isEmpty() ? "drive_rest" : syncMode);
                obj.put("email", email);
                obj.put("providerType", providerType);
                obj.put("hasBoundFile", signedIn);
                obj.put("lastSyncTime", lastSyncTime);
                return obj.toString();
            } catch (Exception e) {
                return "{\"signedIn\":false}";
            }
        }

        // Primary FBReader-style one-tap Google Account OAuth 2.0 login (zero Google Drive app needed)
        @JavascriptInterface
        public void signInWithGoogle(final boolean unused) {
            runOnUiThread(MainActivity.this::startGoogleOAuthLoopbackFlow);
        }

        // Manual code/URL fallback in case an isolated browser didn't trigger loopback automatically
        @JavascriptInterface
        public void submitManualOAuthCode(final String rawInput) {
            if (rawInput == null || rawInput.trim().isEmpty()) return;
            String input = rawInput.trim();
            String extractedCode = input;
            try {
                if (input.contains("code=")) {
                    Uri u = Uri.parse(input.startsWith("http") ? input : "http://127.0.0.1/?" + input);
                    String qCode = u.getQueryParameter("code");
                    if (qCode != null && !qCode.isEmpty()) {
                        extractedCode = qCode;
                    }
                } else {
                    extractedCode = URLDecoder.decode(input, "UTF-8");
                }
            } catch (Exception ignored) {}

            final String finalCode = extractedCode;
            final String verifier = pendingCodeVerifier;
            final String redir = pendingRedirectUri;
            closeOAuthServerSocket();
            driveExecutor.submit(() -> completeOAuthWithCode(finalCode, verifier, redir));
        }

        // Optional custom OAuth Client ID configuration for advanced users
        @JavascriptInterface
        public void setCustomOAuthCredentials(String clientId, String clientSecret) {
            SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
            prefs.edit()
                .putString(KEY_CUSTOM_CLIENT_ID, clientId != null ? clientId.trim() : "")
                .putString(KEY_CUSTOM_CLIENT_SECRET, clientSecret != null ? clientSecret.trim() : "")
                .apply();
        }

        // Secondary fallback: bind a local or SAF file
        @JavascriptInterface
        public void rebindDriveSyncFile(final boolean linkExisting) {
            runOnUiThread(() -> launchSafFileBinder(linkExisting));
        }

        @JavascriptInterface
        public void signOutGoogle() {
            try {
                closeOAuthServerSocket();
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
                runOnUiThread(() -> Toast.makeText(context, "已退出 Google Drive 云同步（本地进度已完整保留）", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                Log.e("CCNA_LOG", "signOutGoogle error", e);
            }
        }

        @JavascriptInterface
        public void cloudPullProgress() {
            driveExecutor.submit(() -> {
                SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
                String syncMode = prefs.getString(KEY_SYNC_MODE, "");

                try {
                    String primaryContent = "";
                    JSONArray extraContents = new JSONArray();

                    if ("drive_rest".equals(syncMode)) {
                        String accessToken = ensureValidAccessToken();
                        String cachedFileId = prefs.getString(KEY_DRIVE_FILE_ID, "");
                        boolean downloadedViaCache = false;
                        if (cachedFileId != null && !cachedFileId.isEmpty()) {
                            try {
                                primaryContent = downloadDriveFile(accessToken, cachedFileId);
                                downloadedViaCache = true;
                            } catch (Exception cacheEx) {
                                if (cacheEx.getMessage() != null && cacheEx.getMessage().contains("FILE_NOT_FOUND_404")) {
                                    prefs.edit().remove(KEY_DRIVE_FILE_ID).apply();
                                } else {
                                    throw cacheEx;
                                }
                            }
                        }

                        if (!downloadedViaCache) {
                            JSONArray files = listDriveSyncFiles(accessToken);
                            if (files.length() > 0) {
                                String primaryId = files.getJSONObject(0).getString("id");
                                prefs.edit().putString(KEY_DRIVE_FILE_ID, primaryId).apply();
                                primaryContent = downloadDriveFile(accessToken, primaryId);

                                // If split-brain created duplicate files across devices, merge all and clean up duplicates
                                for (int i = 1; i < files.length(); i++) {
                                    String dupId = files.getJSONObject(i).optString("id", "");
                                    if (!dupId.isEmpty() && !dupId.equals(primaryId)) {
                                        try {
                                            String dupText = downloadDriveFile(accessToken, dupId);
                                            if (dupText != null && dupText.startsWith("{")) {
                                                extraContents.put(dupText);
                                            }
                                            deleteDuplicateDriveFile(accessToken, dupId);
                                        } catch (Exception ignored) {}
                                    }
                                }
                            }
                        }
                    } else {
                        String uriStr = prefs.getString(KEY_DRIVE_URI, "");
                        if (uriStr == null || uriStr.isEmpty()) return;
                        Uri uri = Uri.parse(uriStr);
                        try (InputStream is = getContentResolver().openInputStream(uri)) {
                            primaryContent = readStreamText(is);
                        }
                    }

                    final String finalContent = primaryContent;
                    final JSONArray finalExtras = extraContents;
                    long now = System.currentTimeMillis();
                    prefs.edit().putLong(KEY_LAST_SYNC_TIME, now).apply();

                    runOnUiThread(() -> {
                        if (webView != null) {
                            try {
                                JSONObject res = new JSONObject();
                                res.put("ok", true);
                                res.put("lastSyncTime", now);
                                res.put("data", finalContent);
                                if (finalExtras.length() > 0) {
                                    res.put("extraDataList", finalExtras);
                                }
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
                isDriveSyncing.set(true);
                try {
                    SharedPreferences prefs = getSharedPreferences(PREFS_GOOGLE_SYNC, MODE_PRIVATE);
                    String syncMode = prefs.getString(KEY_SYNC_MODE, "");
                    byte[] bytes = jsonContent.getBytes(StandardCharsets.UTF_8);

                    if ("drive_rest".equals(syncMode)) {
                        String accessToken = ensureValidAccessToken();
                        String fileId = prefs.getString(KEY_DRIVE_FILE_ID, "");
                        if (fileId == null || fileId.isEmpty()) {
                            JSONArray existing = listDriveSyncFiles(accessToken);
                            if (existing.length() > 0) {
                                fileId = existing.getJSONObject(0).optString("id", "");
                            }
                        }
                        String savedFileId = uploadDriveFileContent(accessToken, fileId, bytes);
                        if (savedFileId != null && !savedFileId.isEmpty()) {
                            prefs.edit().putString(KEY_DRIVE_FILE_ID, savedFileId).apply();
                        }
                    } else {
                        String uriStr = prefs.getString(KEY_DRIVE_URI, "");
                        if (uriStr == null || uriStr.isEmpty()) return;
                        Uri uri = Uri.parse(uriStr);

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
