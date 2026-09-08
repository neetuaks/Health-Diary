Vision OCR Expo Config Plugin

What it does
- Copies the native iOS and Android OCR source templates from `native/ios` and `native/android` into the prebuild/native project during `expo prebuild`.

How to use
1. Add the plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      "./plugins/vision-ocr-plugin"
    ]
  }
}
```

2. Run `expo prebuild` to have the plugin copy files into `ios/` and `android/`.
3. Open the iOS project in Xcode (`ios/*.xcworkspace`) and ensure `VisionOCR.swift` and `VisionOCRBridge.m` are added to your app target (Xcode may need you to drag them into the project). For Android, the Kotlin file will be placed under `android/app/src/main/java/com/healthdiary/ocr/`.

Notes
- This plugin performs file copies; you should review the added files in version control after running `expo prebuild`.
- You still need to add any required Android dependencies (ML Kit) to `android/build.gradle` and iOS entitlements if needed. The plugin does not modify Gradle or Podfile automatically.
