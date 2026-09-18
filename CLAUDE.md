# Health Diary — Project Context for Claude Code

Privacy-first, offline-first Expo/React Native app for logging Blood Pressure and glucose
readings into local SQLite, with encrypted local backup (an automatic on-device safety copy,
plus explicit share/export via the OS share sheet — no Google Drive integration; see
`docs/PRODUCT-SPEC.md`'s Backup & Restore section). No backend, no analytics,
no accounts — see the constraints below before writing any code that touches data flow.

- Full product/UX requirements: [`docs/PRODUCT-SPEC.md`](docs/PRODUCT-SPEC.md)
- Architecture, repo map, data model, flow diagrams, debugging playbook, testing strategy: [`docs/TECHNICAL-DESIGN.md`](docs/TECHNICAL-DESIGN.md)

## Non-negotiable constraints
- **Zero data collection**: no backend, no analytics/crash-reporting SDK, no ad SDK, no account/login system. Data leaves the device only via explicit user action (OS share sheet or the user's own connected Google Drive). Never log health values, recovery keys, or access tokens.
- **Local testing runs on Expo Go, not a dev client.** Expo Go cannot execute custom native modules. On-device OCR (ML Kit on Android / Vision on iOS) and any native crypto module will not run under Expo Go — treat failures there as an environment limitation, not an app bug, and don't debug them as JS logic issues. Don't switch to `expo-dev-client` / run a native prebuild unilaterally — confirm with the user first, since it changes their local dev workflow.
- **Parameter types are registry-driven.** BP, Diabetes, and any future parameter type are defined generically via `parameter_types` + `field_definitions` JSON. Never hardcode a parameter's fields (e.g. `systolic`/`diastolic`) as top-level SQL columns or special-case them in Diary/Chart/Report/New Record logic.

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
- Before merging a change, follow the checklist in `docs/TECHNICAL-DESIGN.md` §16 (typecheck, targeted + full test run, `expo export` sanity check, native rebuild if applicable).
- This app is a work in progress — don't assume a feature works correctly just because a screen exists for it or it doesn't visibly error. Verify actual behavior against `docs/PRODUCT-SPEC.md` before treating something as done; see `docs/TECHNICAL-DESIGN.md`'s "Known test gaps" for currently-known incomplete areas.
