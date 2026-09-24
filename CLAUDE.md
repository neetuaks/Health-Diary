# Health Diary — Project Context for Claude Code

Privacy-first, offline-first Expo/React Native app for logging Blood Pressure and glucose
readings into local SQLite, with encrypted local backup (an automatic on-device safety copy,
plus explicit share/export via the OS share sheet — no Google Drive integration; see
`docs/PRODUCT-SPEC.md`'s Backup & Restore section). No backend, no analytics,
no accounts — see the constraints below before writing any code that touches data flow.

- Full product/UX requirements: [`docs/PRODUCT-SPEC.md`](docs/PRODUCT-SPEC.md)
- Architecture, repo map, data model, flow diagrams, debugging playbook, testing strategy: [`docs/TECHNICAL-DESIGN.md`](docs/TECHNICAL-DESIGN.md)

## Non-negotiable constraints
- **Zero data collection**: no backend, no analytics/crash-reporting SDK, no ad SDK, no account/login system. Data leaves the device only via explicit user action (the OS share sheet). Never log health values, recovery keys, or access tokens.
- **Day-to-day testing runs on Expo Go; native features need the dev client.** Expo Go cannot execute custom native modules, so on-device OCR (ML Kit on Android / Vision on iOS) and any native crypto module will not run under it — treat failures there as an environment limitation, not an app bug. A dev-client build now exists (see "Dev client & EAS builds" below), but don't kick off an EAS build or native prebuild without asking the user first — builds take 20+ minutes and use their Expo account.
- **Parameter types are registry-driven.** BP, Diabetes, and any future parameter type are defined generically via `parameter_types` + `field_definitions` JSON. Never hardcode a parameter's fields (e.g. `systolic`/`diastolic`) as top-level SQL columns or special-case them in Diary/Chart/Report/New Record logic.

## Dev client & EAS builds
- EAS project: `@nitu_sn/health-diary` (ids in `app.json`). `eas.json` has a `development` profile (dev-client APK, internal distribution) and `production` (AAB). `eas-cli` and `expo-dev-client` are devDependencies. The user must be logged in (`npx eas-cli login` — interactive, you can't do it for them).
- **Local Android builds don't work on this machine**: `JAVA_HOME` is JDK 8 (RN 0.86 needs JDK 17) and there's no emulator/AVD. Build in the cloud: `npx eas-cli build --profile development --platform android --non-interactive`. There is no macOS, so iOS (Vision) code is written but has never been built or tested.
- `android/` is committed and is `expo prebuild` output. Re-running `npx expo prebuild -p android` regenerates it (it says "Clearing android" but is deterministic); don't hand-edit generated files — put changes in the config plugin instead.
- **Before every EAS build, run `npm ci --include=dev`** locally. A `package-lock.json` that passes `npm install` here can still fail `npm ci` on EAS's clean machine (this cost a build once). Regenerate the lock from scratch (`rm -rf node_modules package-lock.json && npm install`) if it does.
- Use the locally installed `eas-cli` (`npx eas-cli …`); `npx` fetching packages fresh fails on this machine with npm's `ECOMPROMISED / Lock compromised` because installs are slow.
- EAS build logs are Brotli-compressed JSON lines: `npx eas-cli build:view <id> --json` gives a signed `logFiles` URL (valid ~15 min); `curl` it, `brotli -d`, then grep `"msg"` for `Error`/`FAILED`.
- This machine is very slow (npm installs take 10–25 min, `find`/`grep` in Bash can time out). Use the Grep/Glob tools instead of shell `grep`/`find`, and run long commands in the background.

## OCR status
- **Camera/OCR entry is paused and hidden in the UI.** ML Kit reads printed text (SYS / DIA / PULSE labels) fine but misreads seven-segment LCD digits (tested on an Omron HEM-7111: read 150/89/75 as "50" and "5"), so most BP monitors and glucometers won't auto-fill. To re-enable, restore the `onScanPhoto` prop passed to `NewRecordModal` in `src/screens/DiaryScreen.tsx` (currently commented out); `PhotoEntryModal` is still mounted.
- All OCR text interpretation lives in one JS parser, `src/services/ocrParsing.ts` (labeled SYS/DIA/PULSE, slash `120/80`, unlabeled stacked numbers, with plausibility checks; unit-tested). The native modules (`native/android/MLKitOCR.kt`, `native/ios/VisionOCR.swift`) are trusted only for the recognized `rawText`. The reported confidence is a regex-match score, not ML Kit's read certainty, so the "double-check before saving" banner matters more than any percentage.
- The `plugins/vision-ocr-plugin` config plugin **must stay plain JS** (`index.js`): `eas-cli` can't load a `.ts` plugin. It copies the Kotlin sources, adds the ML Kit Gradle dependency and registers `MLKitOCRPackage` in `MainApplication.kt`. Do **not** add the `com.google.mlkit.vision.DEPENDENCIES` manifest meta-data — `expo-dev-launcher` already declares it (`barcode_ui`) and the manifest merge fails.
- Ideas if revisiting: a Kotlin seven-segment decoder anchored on the label positions (needs slant/ghost-segment handling and several sample photos), or a guided camera frame. A first prototype misread digits, so it's a real project, not a quick fix.

## Behaviours worth knowing
- **Delete All Data deliberately keeps the Recovery Key** (so previously shared backups stay restorable). Because of that, the first-run "I'm new" choice checks for a leftover key and asks whether to keep it or generate a new one.
- Restore actions show a "Restoring…" busy state; screens that show profile data (Diary/Chart/Report) must clear their local state when there's no active profile, not just skip the fetch.
- The `ghost` button variant intentionally has no shadow (the shared shadow made it look like a floating box).
- Picking a backup file uses `copyToCacheDirectory: false` with a `copyAsync` fallback to avoid the picker's racy internal copy (expo/expo#21792).
- `.expo/dev/logs/start.log` and `.expo/devices.json` are tracked but machine-local noise — don't commit them.

## Coding conventions
- The readings JSON blob column is named **`vals`**, not `values` — this avoids the SQL-adjacent `values` keyword and is the convention across `src/db/init.ts`, `readingService.ts`, `backup.ts`, and elsewhere. Keep it consistent; don't reintroduce `values` as a column/property name for this field. (Note: `OCRResult.values` in `src/services/ocr.ts` is a genuinely different, unrelated field — that one *is* named `values`.)
- IDs are UUID v4 strings (`uuid` package); timestamps are ISO 8601 strings. `recorded_at` is user-editable; `created_at` is immutable.
- Use the modern `expo-sqlite` async API (`runAsync`, `getAllAsync`, `getFirstAsync`, `execSync`) — never the removed callback API (`transaction`, `executeSql`, `openDatabase`).
- Never bind `undefined` as a SQLite parameter; use `null` for absent values.
- `src/services/*.ts` modules are thin, one file per concern, and each calls `getDB()` from `src/db/init.ts` rather than owning its own connection.
- No ESLint/Prettier config exists in this repo — match the surrounding file's style rather than introducing new formatting conventions.

## Working conventions
- Prefer incremental, verifiable changes over large multi-file rewrites. Confirm a workflow actually works end-to-end (not just "doesn't crash") before moving to the next one.
- Ask before making an architectural choice that isn't already settled in `docs/PRODUCT-SPEC.md` or `docs/TECHNICAL-DESIGN.md` (e.g. swapping a library, changing the DB layer) when it's a meaningful tradeoff.
- There are two Jest configs: `npm test` (services) and `npm run test:components` (screens/modals, `jest.component.config.js`). On this slow machine the component suites can hit the default 5s timeout when run together — re-run a failing file alone (`npx jest --config jest.component.config.js <file>`) before assuming a regression.
- Before merging a change, follow the checklist in `docs/TECHNICAL-DESIGN.md` §16 (typecheck, targeted + full test run, `expo export` sanity check, native rebuild if applicable).
- This app is a work in progress — don't assume a feature works correctly just because a screen exists for it or it doesn't visibly error. Verify actual behavior against `docs/PRODUCT-SPEC.md` before treating something as done; see `docs/TECHNICAL-DESIGN.md`'s "Known test gaps" for currently-known incomplete areas.
