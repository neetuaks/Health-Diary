# Health Diary

Privacy-first cross-platform health tracking (Expo + React Native + SQLite).

Quick start:

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run start
```

Native builds (iOS / Android)

1. To include the native OCR modules (Vision on iOS, ML Kit on Android) run:

```bash
expo prebuild
```

2. iOS: open `ios/*.xcworkspace` in Xcode, ensure `VisionOCR.swift` and `VisionOCRBridge.m` are added to the app target, then build in the simulator or device.

3. Android: after `expo prebuild` verify `android/app/src/main/java/com/healthdiary/ocr/MLKitOCR.kt` and `MLKitOCRPackage.kt` are present. Add Google ML Kit dependency if not automatically added and rebuild.

EAS build

1. A minimal `eas.json` profile is included. To build with EAS:

```bash
npm run eas:build --platform ios
# or
npm run eas:build --platform android
```

CI

- A GitHub Actions workflow (`.github/workflows/ci.yml`) runs unit tests on push/PR to `main`.

Testing

- Run unit tests locally:

```bash
npm ci
npm test
```

- Device tests: OCR and backup/restore require device/emulator verification. Use Xcode/Android Studio to run the native app after prebuild or use EAS builds.


Notes:
- This project is scaffolded with TypeScript and uses `expo-sqlite` for local-only storage.
- All user data stays on-device unless the user explicitly exports or uploads an encrypted backup to their own Google Drive.

Features implemented so far:

- Multi-profile local storage (SQLite)
- Diary list with grouping, add/edit/delete readings
- Manual entry flow for Blood Pressure and Glucose (parameter-driven)
- Charting (Victory) with selectable parameter and time ranges
- PDF report generation and share via OS share sheet
- Plain JSON/CSV export of all data
- Settings screen with Delete My Data and Report a Problem diagnostic export

Privacy notes:

- The app does not send any user data to servers by default. Exports and backups are user-initiated and shared via the OS.
- Backup & Restore encryption layer is implemented using a Recovery Key + `tweetnacl` secretbox; salt/nonce are stored with the ciphertext. The app never transmits your Recovery Key.

Backup & Restore (implemented):

- The app creates an encrypted backup file that you can save via the OS share sheet or optionally upload to your own Google Drive account (appDataFolder).
- A Recovery Key is generated on-device and shown once; you must save it to restore on another device. The app can store the Recovery Key in the device's secure storage to allow biometric unlock on the same device.
- Restoring requires the Recovery Key (or local biometric unlock if the key is stored on the same device) and merges profiles/readings into local SQLite.

Privacy & Compliance:

- No analytics, no crash-reporting SDKs, no account system, and no automatic uploads — data stays on-device unless you explicitly export or upload a backup to your own Drive.
- Implemented a `Delete My Data` action to permanently erase local profiles and readings.
- For legal compliance (HIPAA/GDPR) this app follows privacy-by-design principles, but formal compliance sign-off should be obtained from legal/compliance experts.

