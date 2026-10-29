import os, sys, subprocess, shutil, zipfile, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SDK_DIR = r"C:\Users\YangZJ\AppData\Local\Android\Sdk"
BUILD_TOOLS = os.path.join(SDK_DIR, "build-tools", "36.0.0")
PLATFORMS = os.path.join(SDK_DIR, "platforms", "android-35")
ANDROID_JAR = os.path.join(PLATFORMS, "android.jar")

AAPT2 = os.path.join(BUILD_TOOLS, "aapt2.exe")
D8 = os.path.join(BUILD_TOOLS, "d8.bat")
ZIPALIGN = os.path.join(BUILD_TOOLS, "zipalign.exe")
APKSIGNER = os.path.join(BUILD_TOOLS, "apksigner.bat")

JBR_BIN = r"C:\Program Files\Android\Android Studio\jbr\bin"
JAVAC = os.path.join(JBR_BIN, "javac.exe")
KEYTOOL = os.path.join(JBR_BIN, "keytool.exe")

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
SRC_DIR = os.path.join(APP_DIR, "src", "main")
RES_DIR = os.path.join(SRC_DIR, "res")
ASSETS_DIR = os.path.join(SRC_DIR, "assets")
MANIFEST = os.path.join(SRC_DIR, "AndroidManifest.xml")
JAVA_SRC = os.path.join(SRC_DIR, "java")

BUILD_DIR = os.path.join(BASE_DIR, "build")
GEN_DIR = os.path.join(BUILD_DIR, "gen")
CLASSES_DIR = os.path.join(BUILD_DIR, "classes")

OUTPUT_FINAL = os.path.join(os.path.dirname(BASE_DIR), "Examtopics", "output", "CCNA.apk")

def run_cmd(cmd, desc):
    print(f"\n--- {desc} ---")
    if isinstance(cmd, list):
        print("Running:", " ".join(cmd))
    else:
        print("Running:", cmd)
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=BASE_DIR, shell=True)
    if res.returncode != 0:
        print("FAILED!")
        print("STDOUT:", res.stdout)
        print("STDERR:", res.stderr)
        sys.exit(1)
    if res.stdout.strip():
        print("OUTPUT:", res.stdout.strip())
    return res

def main():
    print("==================================================")
    print("  CCNA (moe.ccna.cards) Android APK Builder")
    print("==================================================")

    # Clean & recreate build directories
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR, exist_ok=True)
    os.makedirs(GEN_DIR, exist_ok=True)
    os.makedirs(CLASSES_DIR, exist_ok=True)

    # Step 1: AAPT2 compile resources
    res_zip = os.path.join(BUILD_DIR, "compiled_res.zip")
    run_cmd(f'"{AAPT2}" compile --dir "{RES_DIR}" -o "{res_zip}"', "1. Compiling Android Resources with AAPT2")

    # Step 2: AAPT2 link resources + assets + AndroidManifest
    unaligned_apk = os.path.join(BUILD_DIR, "app-unaligned.apk")
    run_cmd(
        f'"{AAPT2}" link -I "{ANDROID_JAR}" --manifest "{MANIFEST}" '
        f'-A "{ASSETS_DIR}" "{res_zip}" -o "{unaligned_apk}" --java "{GEN_DIR}" --auto-add-overlay',
        "2. Linking Resources & Assets with AAPT2"
    )

    # Step 3: Compile Java source (MainActivity.java + generated R.java)
    r_java = os.path.join(GEN_DIR, "moe", "ccna", "cards", "R.java")
    main_java = os.path.join(JAVA_SRC, "moe", "ccna", "cards", "MainActivity.java")

    java_files = [main_java]
    if os.path.exists(r_java):
        java_files.append(r_java)

    java_files_str = " ".join(f'"{f}"' for f in java_files)
    run_cmd(
        f'"{JAVAC}" -source 17 -target 17 -cp "{ANDROID_JAR}" -d "{CLASSES_DIR}" {java_files_str}',
        "3. Compiling Java Source Files with javac"
    )

    # Step 4: Convert .class files to classes.dex using D8
    class_files = []
    for root, _, files in os.walk(CLASSES_DIR):
        for f in files:
            if f.endswith(".class"):
                class_files.append(os.path.join(root, f))

    class_files_str = " ".join(f'"{cf}"' for cf in class_files)
    run_cmd(
        f'"{D8}" --release --output "{BUILD_DIR}" --lib "{ANDROID_JAR}" --min-api 26 {class_files_str}',
        "4. Dexing bytecode with D8"
    )

    # Step 5: Add classes.dex into unaligned APK
    dex_path = os.path.join(BUILD_DIR, "classes.dex")
    print(f"\n--- 5. Adding classes.dex to APK ---")
    with zipfile.ZipFile(unaligned_apk, 'a', compression=zipfile.ZIP_DEFLATED) as apk_zip:
        apk_zip.write(dex_path, "classes.dex")
    print("classes.dex injected successfully.")

    # Step 6: Zipalign APK (4-byte alignment)
    aligned_apk = os.path.join(BUILD_DIR, "app-aligned.apk")
    run_cmd(f'"{ZIPALIGN}" -f -p 4 "{unaligned_apk}" "{aligned_apk}"', "6. Zipaligning APK with zipalign")

    # Step 7: Create persistent debug keystore if not exists
    keystore_dir = os.path.join(BASE_DIR, "keystore")
    os.makedirs(keystore_dir, exist_ok=True)
    keystore = os.path.join(keystore_dir, "debug.keystore")
    if not os.path.exists(keystore):
        run_cmd(
            f'"{KEYTOOL}" -genkeypair -v -keystore "{keystore}" -storepass android -alias androiddebugkey '
            f'-keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"',
            "7. Generating Debug Keystore with keytool"
        )

    # Step 8: Sign APK with apksigner
    final_signed_apk = os.path.join(BUILD_DIR, "CCNA.apk")
    run_cmd(
        f'"{APKSIGNER}" sign --ks "{keystore}" --ks-pass pass:android --ks-key-alias androiddebugkey '
        f'--key-pass pass:android --out "{final_signed_apk}" "{aligned_apk}"',
        "8. Signing APK with apksigner"
    )

    # Step 9: Verify signature
    run_cmd(f'"{APKSIGNER}" verify --verbose "{final_signed_apk}"', "9. Verifying APK Signature")

    # Step 10: Copy to final deliverable output
    os.makedirs(os.path.dirname(OUTPUT_FINAL), exist_ok=True)
    shutil.copy2(final_signed_apk, OUTPUT_FINAL)

    print("\n==================================================")
    print(f"🎉 SUCCESS! Android APK built successfully!")
    print(f"Target: {OUTPUT_FINAL}")
    print(f"File Size: {os.path.getsize(OUTPUT_FINAL):,} bytes ({os.path.getsize(OUTPUT_FINAL)/1024/1024:.2f} MB)")
    print("==================================================")

if __name__ == '__main__':
    main()
