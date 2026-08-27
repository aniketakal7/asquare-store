# ASquare Store — Android Client Application

Official Native Android App for the **ASquare Store Ecosystem**.

---

## 🚀 Features

- **Cyber Dark Futuristic UI**: Matched with ASquare's neon-cyan & purple aesthetic.
- **Real-Time Synchronized**: Connects directly to the ASquare REST API (`/api/apps`, `/api/categories`, etc.).
- **Hardware Architecture Detection**: Auto-detects device CPU ABI (`arm64-v8a`, `armeabi-v7a`, `x86_64`), Android version, and screen density.
- **In-App APK Download & Installer**: Fast background downloading and 1-click installation trigger using Android `FileProvider` + `PackageInstaller`.
- **Search & Category Filtering**: Instant debounce-powered search across apps, tools, and games.
- **Server Switcher**: Test easily on local emulator (`http://10.0.2.2:3000`), local Wi-Fi LAN IP, or production domain.

---

## 🛠️ How to Build & Run

### Method 1: In Android Studio
1. Open **Android Studio**.
2. Click **Open** and select the `asquare-android` directory.
3. Allow Gradle to sync dependencies.
4. Click **Run (`Shift + F10`)** to launch on an emulator or connected Android device.

### Method 2: Command Line (Gradle)
```bash
# Build Debug APK
./gradlew assembleDebug

# Output APK location:
# app/build/outputs/apk/debug/app-debug.apk
```

---

## 📡 Connecting to your ASquare Backend

- **Android Emulator**: Uses `http://10.0.2.2:3000` (pre-configured default).
- **Physical Phone on same Wi-Fi**: Open Settings in the app and set your computer's local IP (e.g. `http://192.168.1.50:3000`).
- **Production Server**: Set your deployed domain (e.g. `https://asquare.example.com`).
