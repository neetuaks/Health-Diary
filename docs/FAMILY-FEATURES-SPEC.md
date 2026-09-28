# Health Diary — Family Features Spec (Premium)

Instruction document for Claude Code. Two **Premium-only** features: the **Family Dashboard** and the **Consolidated Multi-Profile Report**. Both are **cloud-free** — everything runs on the caregiver's own device across their local profiles. No server, no sync, no data leaves the device. Gated by `useEntitlement().limits` (see PAYWALL-SPEC.md: `familyDashboard`, `consolidatedReport`).

Context: profiles are shared local records on one device (the caregiver logs for themselves + family members on their own phone). These features make managing several people's health from one device fast and doctor-ready. They do **not** involve cross-device family sharing (that would need cloud and is out of scope).

---

## Feature 1 — Family Dashboard

**Job:** let a caregiver see everyone they track at a glance, on one screen, without switching profiles one by one.

**Entry & gating:**
- New tab or a prominent Home entry, visible only when `limits.familyDashboard` is true (Premium).
- On Free/Pro, the entry point is either hidden or shown as a locked Premium upsell that routes to the paywall (owner's choice — default: show locked with an upsell, since seeing it drives upgrades).

**Content (per profile the user tracks):**
- A card per profile showing: profile name/avatar, and for each parameter that profile logs, the **latest reading + its timestamp + range status color** (normal / elevated / high / low, using the same clinical thresholds as elsewhere; custom params show raw latest value + unit).
- Visual "attention" cues: a profile/parameter whose latest reading is out-of-range or stale (e.g., no reading in N days) is flagged, so a caregiver instantly sees who needs attention.
- Tapping a card → that profile's Diary (sets active profile).
- Respects the same clinical color logic and units already used in Diary/Chart. Reuse existing range-classification and unit code — do not duplicate thresholds.

**Data:** pure local queries across all profiles (latest reading per profile per parameter). No new storage. Fast — this is just a "latest per (profile, parameter)" aggregate over the local `readings` table.

**Empty/edge states:** a profile with no readings shows "No readings yet"; a brand-new user with only themselves sees just their own card (dashboard still works with one profile, but its value grows with more).

---

## Feature 2 — Consolidated Multi-Profile Report

**Job:** one doctor-ready PDF covering **several profiles the user chooses** — e.g., a caregiver taking both parents to the same physician, or reviewing the whole family in one visit.

**Entry & gating:**
- In the Report tab (or Family Dashboard), a **"Consolidated report"** action, visible only when `limits.consolidatedReport` is true (Premium). On Free/Pro → locked upsell → paywall.

**Flow:**
1. **Profile selection (required, owner-specified):** present a checklist of the user's profiles; the user **chooses which profiles** to include in this consolidated report (default: none pre-selected, or all — pick a sensible default and let them change it). Must support selecting any subset (2+ profiles; a single profile just uses the normal single report).
2. **Date range:** same range picker as the single report (with presets). Applies to all selected profiles.
3. **Parameter scope:** optionally let the user pick which parameters to include (default: all parameters each selected profile logs).
4. **Generate:** produce ONE PDF containing, per selected profile, a clearly separated section — profile name + age, that profile's chart(s) for the range, and its chronological readings table — followed by the next profile. A cover/header names the report ("Family health report"), the date range, and lists the included profiles. Keep each profile's section visually distinct (page break or clear divider).

**Output — download, not share (owner decision), + history:**
- Reuse the PDF output model in PAYWALL-SPEC.md §6: generate with `expo-print` → **Download/Save to device** (Android Downloads; iOS Files save flow). Use a **download icon**, not a share glyph. Optional secondary Print.
- Record it in **PDF history** with `type: 'consolidated'` and the list of `profileIds` included, so the user can re-open/re-save/delete it later. Local-only.

**Data:** all local. Reuse the existing single-report generation (charts, tables, range filtering, unit handling) per profile and compose the sections — do not build a second reporting engine; iterate the existing one over the selected profiles and concatenate into one document.

**Privacy note:** the consolidated PDF contains multiple people's health data in one file. That's fine (it's on the caregiver's device, they chose the profiles, and they save/share it themselves), but the profile-selection step must be explicit so a caregiver never accidentally includes someone unintended.

---

## Reuse & consistency (do not duplicate)

- **Range/threshold classification, unit conversion, chart components, single-report layout** all already exist — reuse them. The dashboard is an aggregate view; the consolidated report is the existing report iterated over chosen profiles.
- Both features are **read-only** over existing data — no schema changes, no new tables (aside from the PDF-history index already defined in the paywall spec).
- Everything is **on-device**; introduce no network calls.

---

## Tests to add

- **Family dashboard:** with several profiles, the latest reading per (profile, parameter) is shown; out-of-range and stale readings are flagged; tapping a card sets the active profile. Works with a single profile and with a profile that has zero readings.
- **Consolidated report — profile selection:** only the user-selected profiles appear in the PDF; unselected profiles are excluded; a single-profile selection still works.
- **Consolidated report — content:** each selected profile gets its own section (chart + readings) for the chosen range; range filtering matches the single report.
- **Output:** generates a PDF, saves via the device save flow (mock the platform save), and adds a `type: 'consolidated'` entry with correct `profileIds` to PDF history.
- **Gating:** on Free/Pro, both features route to the paywall and never generate a family PDF.
