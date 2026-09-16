# Health Diary — Product Specification

This is the original product/UX requirements document for Health Diary. It describes intended
behavior, not necessarily current implementation status — cross-reference
[`docs/TECHNICAL-DESIGN.md`](TECHNICAL-DESIGN.md) (architecture, data model, flow diagrams, and
especially its "Known test gaps" and per-flow debugging sections) for what is actually built and
working today. Where the two disagree, treat this file as intent and `TECHNICAL-DESIGN.md` as
current reality.

## Product overview
"Health Diary" — a mobile app for logging **Blood Pressure** and **Diabetes/glucose** readings, architected so more health parameters (Vitamin D, Thyroid, Cholesterol, Weight, etc.) can be added later without a schema/UI rewrite. Medical-app-appropriate UI: large readable numbers, high contrast, calm blue/green palette, red reserved for out-of-range alerts.

## Non-negotiable constraint: zero data collection
- No backend, no analytics SDK, no crash-reporting SDK that phones home, no ad SDK, no account/login system.
- All data (readings, profiles, temporarily-captured OCR photos) stays in local SQLite / local file storage only.
- OCR runs **fully on-device** — never send images to a cloud OCR API.
- Any file the user shares (PDF report, encrypted backup, plain data export) leaves the device **only** via the OS share sheet or the user's own connected Google Drive account (see Backup section) — the app itself never uploads anything to a developer-owned server.
- State "Your data never leaves your device" somewhere visible in Settings/About.

## Compliance posture (HIPAA / GDPR alignment — implementation guidance, not a legal guarantee)
- No collection by design is the strongest position for both frameworks.
- Implement **Delete My Data** (GDPR right to erasure) and **plain JSON/CSV export** (GDPR right to portability) — both described below.
- Provide a plain-language Privacy notice screen describing exactly what's stored and where.
- Encrypt backups at rest; use OS secure storage for keys; never transmit anything in plaintext.
- Actual HIPAA/GDPR compliance sign-off requires legal review of the finished app — don't let anything in this file be read as a certification. A standalone consumer app with no server and no relationship to a "covered entity" is generally not itself HIPAA-regulated, but that's a legal classification, not something code alone determines.

## Multi-profile support
- Multiple profiles per device (e.g. tracking your own readings and a parent's). A profile switcher controls which profile all 3 tabs operate on.
- Each profile: Name, DOB/Age, unit preferences, independent readings, independent `last_backup_at`.
- Add/Edit/Delete Profile screens; deleting a profile deletes its local readings (confirm first).

## Extensible parameter-type architecture
- A **Parameter Type registry** (table/config) defines each trackable type: id, display name, icon, color, and ordered **field definitions** (key, label, dataType, unit, min/max, required, options).
- BP and Diabetes ship as two **pre-seeded, built-in** parameter types using this same registry — not hardcoded/special-cased elsewhere in the app.
- Readings are stored generically: profile + parameter type + a `vals` JSON blob matching that type's field definitions — **do not** hardcode `systolic`/`diastolic` as top-level SQL columns.
- New Record flow, Diary rendering, Chart rendering, and Report generation should all be driven off the field definitions generically.
- v1 UI only exposes BP and Diabetes — no "create custom parameter" UI yet, but the architecture must support adding one as a config entry later. A "create custom parameter" screen is an explicit fast-follow, not required now.

## App structure — 3 bottom tabs (all scoped to the active profile)

### Tab 1: Diary
- Reverse-chronological list of all readings, grouped by day with sticky headers ("Today", "Yesterday", dates).
- Each item: date, time, parameter icon/color, key values (BP: systolic/diastolic mmHg, pulse bpm, arm L/R; Diabetes: value + unit).
- Tap to edit; swipe to delete (confirm first); floating "+" opens New Record flow; friendly empty state.
- **Backup reminder banner**: if there are readings but no backup in the last N days (default 30, configurable), show a dismissible banner: *"You haven't backed up your data in [X] days. Your data lives only on this phone and won't survive an app reinstall or a new device unless you back it up."* Links to Backup in Settings. Tracks `last_backup_at` per profile — a PDF report export does **not** count as a backup and must not update this.

### Tab 2: Chart
- Switch between enabled parameter types; range selector: Today / Yesterday / Last 7 Days / Last 30 Days.
- BP: line chart (Systolic, Diastolic) + Pulse line/bar, with normal/elevated/high reference bands.
- Diabetes: single glucose line with normal-range band.
- Summary stats below: Average, Min, Max, reading count. Use `react-native-gifted-charts` or `victory-native`.

### Tab 3: Report
- Controls: date range (with presets), parameter filter (BP/Diabetes/Both), Print/Save PDF/Share buttons.
- Content: Profile Name + Age, chosen date range, chart(s) for range+filter (reuse Tab 2 components), full chronological reading list.
- PDF via `expo-print` (`Print.printToFileAsync`), share via `expo-sharing`, print via `Print.printAsync` directly.

## New Record creation (2 methods for v1 — Bluetooth deferred, see below)
1. **Manual Entry** — pick parameter type (from registry) → BP fields (Systolic, Diastolic, Pulse numeric; Arm segmented Left/Right, default Left) or Diabetes field (single glucose numeric, unit per profile pref) → date/time defaults to now, always editable.
2. **Photo OCR** — capture/pick photo of a BP monitor or glucometer → run **on-device OCR only**: **Apple Vision (`VNRecognizeTextRequest`) on iOS**, **Google ML Kit Text Recognition (on-device) on Android**, abstracted behind one `ocr.ts` service interface. Auto-detect BP (3 numbers) vs glucose (1 number) and pre-fill the same manual-entry form. **Mandatory verification**: never auto-save; user must review/edit and explicitly tap Save. Low-confidence/unread fields stay blank and flagged, never guessed. Discard the photo after processing unless the user opts to keep it. **Note: this requires custom native modules and cannot be tested in Expo Go — see `docs/TECHNICAL-DESIGN.md` §8 (OCR Flow).**

Both methods land on the same shared confirmation/edit form (validation, arm selection, date/time editing all live in one component).

### Deferred (architect for, don't build now)
- **Bluetooth device capture** (BLE GATT: BP Profile `0x1810`, Glucose Profile `0x1808`, via `react-native-ble-plx`) for supported brands only. Leave room in the New Record action sheet for a third method; keep `source: 'bluetooth'` as a valid enum value; stub `bluetooth.ts`.
- **Custom user-defined parameter types** — architecture supports it; UI is a fast-follow.

## Units — region-specific, per profile
- Glucose: default `mg/dL` on US-locale devices, `mmol/L` elsewhere (most of the world uses mmol/L); store each reading with the unit it was entered in and convert for display only, never silently reinterpret stored values. Editable per profile regardless of locale default.
- BP: `mmHg` universally, no variant needed.
- Weight (future): `kg` vs `lb` by locale, same pattern.

## Backup & Restore — the real safety net for reinstalls/new devices
No cloud storage means an uninstall or device change **permanently loses all data** unless the user has backed up. Don't rely on or claim OS-level auto-backup (iCloud/Google) — it's inconsistent and outside app control.

- **Recovery Key, not a memorized passphrase** (infrequent use → passphrases get forgotten): generate a strong random key on-device (24-word BIP39-style mnemonic or formatted alphanumeric) on first backup. Display it **once** with explicit "save this now, it can't be recovered later" copy, a Copy button, and a QR code. Offer an immediate **share action** (OS share sheet) so the user can send it to their own email/notes/password manager — app never sees the destination. Require explicit confirmation ("I've saved my Recovery Key") before the first backup completes. Add a "View Recovery Key" option in Settings (behind device auth) for later re-access.
- **On-device convenience unlock**: store the Recovery Key in secure hardware storage (`expo-secure-store`, Keychain/Keystore). Unlock Back Up/Restore on the *same device* via `expo-local-authentication`, which defers entirely to whatever the OS/user already has configured — Face ID, fingerprint, iris, PIN, pattern, or password, with the OS's own fallback chain. The app never implements or chooses the method itself. This is convenience only; the Recovery Key remains the sole recovery path on a new/reset device.
- **Encryption**: derive a key from the Recovery Key via a slow KDF (PBKDF2 or Argon2, e.g. `react-native-quick-crypto` or `expo-crypto` + JS AES), encrypt with **AES-256-GCM**. Store salt/nonce alongside ciphertext (not secret); never store/transmit the derived key. Verify the backup file is genuinely unreadable without the key — don't just assume encryption "happened."
- **Back Up Data**: serialize active profile or all profiles (readings, parameter types, settings) into one encrypted file; hand to OS share sheet. On success, update `last_backup_at` and clear the reminder banner.
- **Restore from Backup**: pick a file; same-device auto-unlock via device auth, or manual Recovery Key entry (typed or QR-scanned) on a new device; decrypt, validate structure/version, then import. Clean, non-alarming errors on wrong key/corrupt file. Offer merge-vs-replace if local data already exists.
- **Optional Google Drive backup**: user's own Google account via standard OAuth (`expo-auth-session` + Drive REST API directly from device) — no developer server relay. Prefer Drive's `appDataFolder` scope by default; allow a visible folder as an option. Uploads the *same* encrypted file as local backup — Drive is just an additional destination, never a way to weaken encryption. Off by default, explicit opt-in. Disconnecting stops future uploads; offer (don't force) deleting already-uploaded files. App never stores the user's Google credentials, only a scoped access token per Google's standard client flow.

Current schema for what gets backed up: see `docs/TECHNICAL-DESIGN.md` §6 (Database Design) and §9 (Backup, Restore, and Encryption) for the actual container format and flow.

## Data rights features (Settings)
- **View/Export My Data (plain JSON/CSV)**: separate from encrypted backup — full structured JSON and/or flattened CSV, **unencrypted by design** for transparency/portability (GDPR Art. 20). Warn the user it's unencrypted before export. Shared via OS share sheet.
- **Delete My Data**: destructive action, single profile or all app data, strong confirmation (type "DELETE" or double-confirm) since irreversible. If Google Drive is connected, ask separately whether to also delete remote backup files — never delete them silently as a side effect. Returns app to empty/first-launch state for the deleted scope.

## Maintenance & Diagnostics (crash visibility without breaking the privacy model)
- **No third-party crash/analytics SDK** (Sentry, Crashlytics, Bugsnag, etc.) in this build — always-on ones typically collect device identifiers/behavioral data by default, which conflicts with the zero-collection constraint. If one is ever added later, it must be strictly opt-in, stripped of identifiers/session capture, and disclosed.
- **Store-level crash analytics** (App Store Connect Crashes, Play Console Android Vitals) is the free baseline — no code needed, not the app "phoning home."
- **On-device error log + manual "Report a Problem" export**: top-level error boundary + wrapped logger capturing stack trace, screen/action name, app/OS version, timestamp only — **never** health values or personal data — rolling local log (cap size/age). "Report a Problem" in Settings → Help lets the user review then explicitly share the log via the OS share sheet. Can optionally prompt this after a detected crash on next launch, always as explicit yes/no, never sent automatically.

## Validation & polish
- Sensible numeric range validation per field definition (e.g. Systolic 50–260, Diastolic 30–160, Pulse 30–220, Glucose 20–600 mg/dL or mmol/L equivalent) — warn, don't block, on out-of-range entries.
- Color-code by clinical range (normal/elevated/high/low), converting thresholds correctly per active unit.
- Graceful empty states everywhere (Chart/Report tabs, zero-reading profiles).
- Request only camera/photo-library permissions for now; no Bluetooth permission request until that feature is built.

## Tests to include
Date-range filtering; BP/glucose range classification; unit conversion (mg/dL ↔ mmol/L); backup-reminder threshold logic; backup round-trip (encrypt/export → decrypt/re-import with Recovery Key produces identical data; wrong/malformed key fails cleanly).

## Monetization (context only — not app logic to build unless asked)
- **Primary: one-time Pro unlock (freemium IAP)**. Free: manual entry, Diary, Chart (Today/Yesterday/7-day), single profile, 7-day PDF report, and **full Backup & Restore** (never paywall this — it's the only thing preventing permanent data loss). Pro: OCR entry, unlimited Chart history, full Report/export, multiple profiles, and later Bluetooth + custom parameters. Scaffold a single `useEntitlement()` gate now so a store SDK (RevenueCat/StoreKit/Play Billing) is a drop-in later — don't implement real payment processing unless asked.
- **Secondary: contextual, non-personalized sponsorship** (BP/glucometer brand banners, etc.) — prefer static house creatives over ad-network SDKs, which usually collect identifiers even in "non-personalized" mode. If ever used, must be verified non-personalized and disclosed. Label "Sponsored," keep non-intrusive, never inside entry forms.
