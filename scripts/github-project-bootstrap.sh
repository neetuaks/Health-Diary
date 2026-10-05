#!/usr/bin/env bash
# =============================================================================
# Health Diary — GitHub Projects bootstrap
# =============================================================================
# Creates labels, milestones, and issues (epics + per-module test checklists)
# from the PRD / Project Plan / Test Cases, ready to drop onto a GitHub Project.
#
# PREREQUISITES
#   1. GitHub CLI installed:            https://cli.github.com/
#   2. Authenticated:                   gh auth login
#   3. Run from anywhere; REPO is set below.
#
# USAGE
#   chmod +x github-project-bootstrap.sh
#   ./github-project-bootstrap.sh
#
# Safe to re-run: label/milestone creation is guarded with "|| true". Issues,
# however, are NOT deduped — running twice creates duplicate issues. Run once.
#
# The GitHub *Project board* itself is easiest to create in the UI afterward
# (see the note printed at the end) — this script populates the backlog it pulls from.
# =============================================================================
set -uo pipefail

REPO="neetuaks/Health-Diary"   # <-- change if your repo path differs

echo "==> Target repo: $REPO"
command -v gh >/dev/null || { echo "gh not found. Install GitHub CLI first."; exit 1; }
gh auth status >/dev/null || { echo "Not authenticated. Run: gh auth login"; exit 1; }

# ---------------------------------------------------------------------------
# 1. LABELS
# ---------------------------------------------------------------------------
echo "==> Creating labels..."
create_label () { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" 2>/dev/null || true; }

# type
create_label "epic"        "6f42c1" "Large body of work spanning multiple tasks"
create_label "feature"     "0e8a16" "New functionality"
create_label "test"        "1d76db" "Test coverage / QA checklist"
create_label "chore"       "c2e0c6" "Setup, config, tooling, non-feature work"
create_label "bug"         "d73a4a" "Defect"
# priority
create_label "P0"          "b60205" "Must pass to ship"
create_label "P1"          "fbca04" "Important"
create_label "P2"          "0e8a16" "Nice to have"
# area
create_label "area:profiles"    "5319e7" "Multi-profile"
create_label "area:parameters"  "5319e7" "Built-in + custom parameters"
create_label "area:assignment"  "5319e7" "Custom-param -> profile assignment"
create_label "area:diary"       "5319e7" "Diary tab"
create_label "area:charts"      "5319e7" "Charts"
create_label "area:report"      "5319e7" "Report + PDF"
create_label "area:family"      "5319e7" "Family dashboard + consolidated report"
create_label "area:backup"      "5319e7" "Backup/restore + export"
create_label "area:paywall"     "5319e7" "Paywall + entitlement"
create_label "area:ocr"         "5319e7" "OCR entry"
create_label "area:privacy"     "5319e7" "Privacy / compliance / non-functional"
create_label "area:launch"      "5319e7" "Store, legal, brand, launch"

# ---------------------------------------------------------------------------
# 2. MILESTONES  (phases from the Project Plan)
# ---------------------------------------------------------------------------
echo "==> Creating milestones..."
create_milestone () { gh api "repos/$REPO/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 || true; }

create_milestone "Phase A0 — Assignment"     "Verify & merge custom-param -> profile assignment"
create_milestone "Phase A1 — Paywall"        "Entitlement system, gates, paywall, RevenueCat, PDF download+history"
create_milestone "Phase A2 — Family"         "Family dashboard + consolidated multi-profile report (Premium)"
create_milestone "Phase A3 — OCR decision"   "Dev-client accuracy test; merge only if it clears the bar"
create_milestone "Pre-launch"                "RevenueCat/store products, legal docs, brand/trademark rename"
create_milestone "Launch"                    "Dev accounts, ASO, closed testing, India+US production"

# ---------------------------------------------------------------------------
# 3. ISSUES
# ---------------------------------------------------------------------------
echo "==> Creating issues..."
mk () { # mk "title" "milestone" "labels" "body"
  gh issue create --repo "$REPO" --title "$1" --milestone "$2" --label "$3" --body "$4" >/dev/null \
    && echo "   + $1" || echo "   ! failed: $1"
}

# ---- EPICS -----------------------------------------------------------------
mk "[Epic] Custom-param → profile assignment (verify & merge)" "Phase A0 — Assignment" "epic,area:assignment,P0" \
"Verify the (locally built) assignment feature against CUSTOM-PARAM-ASSIGNMENT-SPEC.md and merge to main.

- [ ] Migration backfill: existing custom types linked to all existing profiles (nothing disappears)
- [ ] \`profile_parameters\` junction table + FKs
- [ ] Create-time 'apply to all / selected profiles'
- [ ] Per-profile add/remove in profile settings
- [ ] New Record picker scoped to active profile (not global fetchParameterTypes)
- [ ] Non-destructive removal (readings kept, only new logging stops)
- [ ] Delete custom type cascades junction rows
- [ ] Backup/export payload includes assignments
- [ ] Tests (see Tests: Custom-param assignment)"

mk "[Epic] Paywall & entitlement system" "Phase A1 — Paywall" "epic,area:paywall,P0" \
"Implement per PAYWALL-SPEC.md.

- [ ] limits.ts (Free/Pro/Premium) — single source of truth
- [ ] EntitlementProvider + useEntitlement() (fails closed to Free, never blocks app open)
- [ ] Gate: Add Profile (1/2/10)
- [ ] Gate: Add custom parameter (0/4/8)
- [ ] Gate: in-app visibility window (Free 7 days)
- [ ] Gate: CSV/JSON export window (Free 7 days; backup always full)
- [ ] Gate: PDF report (Free preview only, no file)
- [ ] PDF download (Android Downloads / iOS Files) + PDF history
- [ ] Paywall screen (annual hero, per-day framing, restore purchases)
- [ ] RevenueCat wiring (anonymous ID, offline cache)
- [ ] Non-destructive downgrade (lock, never delete)
- [ ] Tests (see Tests: Paywall & entitlement)"

mk "[Epic] Family features (Premium)" "Phase A2 — Family" "epic,area:family,P0" \
"Implement per FAMILY-FEATURES-SPEC.md. Cloud-free, Premium-gated.

- [ ] Family dashboard (latest per profile/parameter, out-of-range/stale flags, tap→profile)
- [ ] Consolidated multi-profile report with profile selection
- [ ] Reuse single-report engine + PDF download/history (type=consolidated)
- [ ] Gating: Free/Pro route to paywall
- [ ] Tests (see Tests: Family features)"

mk "[Epic] OCR production decision" "Phase A3 — OCR decision" "epic,area:ocr,P1" \
"Decide whether OCR ships to production.

- [ ] Dev-client build; run docs/ocr-samples through native Vision/ML Kit
- [ ] Judge vs acceptance bar: never silently wrong; ≥70–80% on good photos; graceful on bad
- [ ] If pass: merge behind canUseOCR (Pro+). If fail: keep shelved, ship v1 without it
- [ ] Tests (see Tests: OCR)"

mk "[Epic] Monetization setup (RevenueCat + store products)" "Pre-launch" "epic,chore,area:paywall,P0" \
"Parallel track — external lead time; start early.

- [ ] Play Console + App Store Connect subscription products: pro_monthly ₹149, pro_annual ₹1,490, premium_monthly ₹249, premium_annual ₹2,490
- [ ] RevenueCat entitlements pro/premium + one Offering (all 4 packages)
- [ ] Apple paid-apps / banking + tax agreement
- [ ] Sandbox / license-tester purchases verified"

mk "[Epic] Legal & compliance" "Pre-launch" "epic,area:privacy,P0" \
"Before store submission.

- [ ] Privacy Policy (hosted URL) — drafted then lawyer-reviewed (local-only, no collection)
- [ ] Terms of Service
- [ ] Medical disclaimer (not diagnostic / not medical advice)
- [ ] App Store 'App Privacy' + Play 'Data Safety' (mostly Data Not Collected; RevenueCat as purchases processor)"

mk "[Epic] Brand & IP (rename + trademark)" "Pre-launch" "epic,area:launch,P0" \
"'Health Diary' is taken/descriptive — blocking for store listing & marketing.

- [ ] Shortlist distinctive names; knockout search (IP India + USPTO TESS + app stores)
- [ ] Pick name; secure domain + Play/App Store handles
- [ ] Trademark filing (India Class 42/9; US Class 9/42)"

mk "[Epic] Store readiness & launch" "Launch" "epic,area:launch,P0" \
"- [ ] Apple Developer + Google Play Console accounts (Google identity verification + 12–20 tester / 14-day closed testing — start early)
- [ ] ASO: title + 'BP & Diabetes Diary' descriptor, keywords, screenshots (lead with multi-profile + privacy), age rating
- [ ] TestFlight + Play closed testing
- [ ] India + US production launch (organic/ASO only)"

# ---- TEST CHECKLIST ISSUES (one per TEST-CASES.md module) -------------------
mk "Tests: Profiles & multi-profile" "Phase A0 — Assignment" "test,area:profiles,P0" \
"Track docs/TEST-CASES.md §1.
- [ ] PRF-01 create profile
- [ ] PRF-02 switch scopes all tabs
- [ ] PRF-03 edit profile
- [ ] PRF-04 delete profile (confirm; others intact)
- [ ] PRF-05 built-ins on every new profile
- [ ] PRF-06 profile-limit gate → paywall"

mk "Tests: Parameters (built-in + custom)" "Phase A0 — Assignment" "test,area:parameters,P0" \
"Track docs/TEST-CASES.md §2.
- [ ] PAR-01 log BP (arm default Left; time editable)
- [ ] PAR-02 log glucose (unit per pref)
- [ ] PAR-03 create numeric custom (min<max)
- [ ] PAR-04 create enum (≥2 options)
- [ ] PAR-05 built-ins not editable/deletable
- [ ] PAR-06 delete blocked when readings exist
- [ ] PAR-07 edit preserves field keys
- [ ] PAR-08 duplicate name rejected
- [ ] PAR-09 custom-count gate → paywall"

mk "Tests: Custom-param → profile assignment" "Phase A0 — Assignment" "test,area:assignment,P0" \
"Track docs/TEST-CASES.md §3.
- [ ] ASG-01 migration backfill (nothing disappears)
- [ ] ASG-02 'selected profiles' scoping
- [ ] ASG-03 New Record picker profile-scoped
- [ ] ASG-04 per-profile toggle = one junction row
- [ ] ASG-05 non-destructive removal
- [ ] ASG-06 delete type cascades junction
- [ ] ASG-07 backup/export preserves assignments"

mk "Tests: Diary" "Phase A1 — Paywall" "test,area:diary,P0" \
"Track docs/TEST-CASES.md §4.
- [ ] DIA-01 grouping (Today/Yesterday/date)
- [ ] DIA-02 edit from list (incl. date/time)
- [ ] DIA-03 swipe delete (confirm)
- [ ] DIA-04 Free 7-day view cap + upgrade banner
- [ ] DIA-05 empty state"

mk "Tests: Charts" "Phase A1 — Paywall" "test,area:charts,P1" \
"Track docs/TEST-CASES.md §5.
- [ ] CHT-01 BP chart + bands
- [ ] CHT-02 glucose chart + band
- [ ] CHT-03 range selector (Free capped 7d)
- [ ] CHT-04 summary stats
- [ ] CHT-05 empty state"

mk "Tests: Report + PDF" "Phase A1 — Paywall" "test,area:report,P0" \
"Track docs/TEST-CASES.md §6.
- [ ] RPT-01 preview all tiers
- [ ] RPT-02 Free PDF gate — no file written
- [ ] RPT-03 (DC) generate + download (no share sheet)
- [ ] RPT-04 (DC) print
- [ ] RPT-05 PDF history
- [ ] RPT-06 content correctness"

mk "Tests: Family features" "Phase A2 — Family" "test,area:family,P0" \
"Track docs/TEST-CASES.md §7.
- [ ] FAM-01 dashboard latest per profile/param
- [ ] FAM-02 out-of-range/stale flags
- [ ] FAM-03 tap card → profile
- [ ] FAM-04 consolidated profile selection
- [ ] FAM-05 (DC) consolidated PDF content
- [ ] FAM-06 consolidated in PDF history
- [ ] FAM-07 family gate → paywall"

mk "Tests: Backup / Restore" "Phase A1 — Paywall" "test,area:backup,P0" \
"Track docs/TEST-CASES.md §8.
- [ ] BK-01 encrypted backup opaque without key
- [ ] BK-02 backup always full data (even Free)
- [ ] BK-03 Recovery Key once + confirm-saved
- [ ] BK-04 (DC) biometric/device-auth unlock
- [ ] BK-05 restore on new device (Free still 7-day view, rest retained)
- [ ] BK-06 wrong/corrupt key handled cleanly
- [ ] BK-07 restore merge idempotent
- [ ] BK-08 Google Drive backup (opt-in)"

mk "Tests: Export & data rights" "Phase A1 — Paywall" "test,area:backup,P0" \
"Track docs/TEST-CASES.md §9.
- [ ] EXP-01 CSV (Free 7d / paid full)
- [ ] EXP-02 JSON (same window rules)
- [ ] EXP-03 Delete My Data (profile)
- [ ] EXP-04 Delete My Data (all) type-to-confirm"

mk "Tests: Paywall & entitlement" "Phase A1 — Paywall" "test,area:paywall,P0" \
"Track docs/TEST-CASES.md §10.
- [ ] PAY-01 tier→limits mapping
- [ ] PAY-02 offline/no-cache → Free, app still opens
- [ ] PAY-03 (DC) purchase unlocks immediately
- [ ] PAY-04 (DC) restore purchases
- [ ] PAY-05 non-destructive downgrade (lock, not delete)
- [ ] PAY-06 grace period
- [ ] PAY-07 annual hero pricing
- [ ] PAY-08 every gate → paywall (no dead-ends)"

mk "Tests: OCR" "Phase A3 — OCR decision" "test,area:ocr,P1" \
"Track docs/TEST-CASES.md §11.
- [ ] OCR-01 (DC) never silently wrong
- [ ] OCR-02 (DC) mandatory verification
- [ ] OCR-03 (DC) good-photo hit rate ≥70–80%
- [ ] OCR-04 (DC) bad-photo graceful
- [ ] OCR-05 photo discarded
- [ ] OCR-06 not mistaken for real OCR in Expo Go"

mk "Tests: Privacy & non-functional" "Pre-launch" "test,area:privacy,P0" \
"Track docs/TEST-CASES.md §12.
- [ ] PRV-01 no network for health data
- [ ] PRV-02 no analytics/ad SDK
- [ ] PRV-03 privacy notice visible
- [ ] PRV-04 store data-safety accurate
- [ ] NFR-01 accessibility
- [ ] NFR-02 data integrity (vals round-trip, units)
- [ ] NFR-03 diagnostics: no PII"

# ---------------------------------------------------------------------------
echo ""
echo "==> Done. Labels, milestones, and issues created on $REPO."
echo ""
echo "NEXT — create the Project board (UI, ~1 min):"
echo "  1. Repo → Projects → New project → Board (or Table)."
echo "  2. Add a Workflow: 'Auto-add to project' filtered to this repo's issues,"
echo "     so new issues land automatically."
echo "  3. Group by: Milestone  → gives you a column per phase (A0→Launch)."
echo "  4. Add fields if wanted: Status (Todo/In progress/Done), Priority (from P0/P1/P2 labels)."
echo ""
echo "TIP: Commit the four spec docs + PRD/Plan/Test-Cases into the repo (e.g. docs/)"
echo "     so the issue references (docs/TEST-CASES.md etc.) resolve."
