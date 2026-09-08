# Health Diary — Local Test Environment

Quick steps to run and exercise the app locally and run unit tests.

Requirements
- Node.js (16+ recommended)
- npm
- Expo CLI: `npm install -g expo-cli` (optional if using `npx`)
- Android emulator or physical device for mobile testing (optional)

Run app in development (Metro)

```powershell
npm run start:dev
# then open Expo Go on device or press a to open Android emulator
```

Run app in the browser (React Native Web)

```powershell
npm run start:web
# open http://localhost:19006 (or the URL shown in the terminal)
```

Run unit tests

```powershell
npm test
# or watch mode
npm run test:watch
```

Run e2e / integration (placeholder)

This repository includes an e2e placeholder. If you want a runnable setup, I can add Playwright or Detox configuration and scripts.

Tips for Android emulator on Windows
- Install Android Studio and an AVD.
- Start the emulator, then run `npm run android`.

If you want, I can:
- Add Playwright tests that exercise the app in the browser.
- Add Detox or EAS device cloud configs for native device runs.
