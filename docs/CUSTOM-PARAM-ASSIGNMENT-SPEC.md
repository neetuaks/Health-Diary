# Health Diary — Custom Parameter → Profile Assignment Spec

Instruction document for Claude Code. Adds the ability to control **which profiles a custom parameter applies to** — chosen at creation, editable per profile later. Local-only, no cloud. **This does not exist yet** (verified: `parameter_types` is global, `NewRecordModal` shows all types for all profiles, `ProfileManager` has no parameter UI).

Not a paywall axis — assignment is a **free** UI capability. Only the *count* of custom parameter types is gated (see PAYWALL-SPEC.md). Do not gate assignment.

---

## Model

- **Built-in types (BP, Glucose) always apply to every profile** — implicit, always-on, never removable. They are the core product; do not put them in the assignment table.
- **Custom parameter types are assignable per profile** via a new junction table. A custom type appears for a profile only if a row links them.

### Schema change — new junction table
```sql
CREATE TABLE IF NOT EXISTS profile_parameters (
  profile_id TEXT NOT NULL,
  parameter_type_id TEXT NOT NULL,
  PRIMARY KEY (profile_id, parameter_type_id)
);
```
Row present = that custom parameter is enabled for that profile. (No row = not tracked for that profile.) Built-ins are NOT stored here.

### Migration (must preserve current behavior — nothing vanishes on upgrade)
On DB init/upgrade: create `profile_parameters`, then **backfill** — for every existing custom type (`is_builtin = 0`) and every existing profile, insert a link row. Today all custom params effectively show for all profiles, so backfilling "all custom × all profiles" keeps every parameter exactly where users currently see it. Assignment then governs everything created afterward.

---

## Flows

### 1. Creating a custom parameter (`ParameterTypesScreen.tsx`)
After the existing field-definition step, add an **"Apply to profiles"** step before save:
- Options: **All profiles** (default) or **Selected profiles** (checklist of the user's profiles).
- On save: insert the `parameter_types` row as today, AND insert `profile_parameters` rows for the chosen profiles (all profiles → a row per profile).

### 2. Per-profile management (`ProfileManager.tsx` / profile settings)
Add a **"Tracked parameters"** section for the active/edited profile:
- Built-ins (BP, Glucose) listed as always-on, non-removable (shown, disabled toggle).
- Each custom type listed with an on/off toggle for **this profile**. Toggling on → insert junction row; off → delete junction row.
- Let the user add or remove custom params for the profile here at any time.

### 3. New Record picker (`NewRecordModal.tsx`)
Replace the global `fetchParameterTypes()` with **"types available for the active profile"**: built-ins (always) + custom types linked to `activeProfile.id` via `profile_parameters`. Add a registry helper, e.g. `fetchParameterTypesForProfile(profileId)`, and use it here so a profile only offers the parameters it actually tracks.

### 4. New profile creation (`ProfileManager.tsx`)
A newly created profile gets built-ins automatically (implicit — nothing to insert). Custom params default **off** for a new profile; the user enables the ones they want via step 2 (or by choosing the profile when creating/editing a custom type). *(Product choice — flag it; the alternative "enable all existing customs for a new profile" is also reasonable. Default to off to keep new family-member profiles clean.)*

---

## Non-destructive rules (consistent with the app's data ethos)
- **Removing a custom parameter from a profile never deletes readings.** Turning a param off for a profile only stops *new* logging of it for that profile (it disappears from that profile's New Record picker). Existing readings for that (profile, parameter) remain in the DB and stay visible in that profile's history/Diary and in export/backup. Re-enabling restores it in the picker.
- **Deleting a custom parameter type** (existing flow, only allowed when it has no readings) must also delete its `profile_parameters` rows (cascade in code).
- Backup/restore and export must include `profile_parameters` so assignments survive a device change (add it to the backup/restore payload and the export, alongside profiles/parameter_types/readings).

---

## Interactions
- **Family dashboard / consolidated report** (FAMILY-FEATURES-SPEC.md): "the parameters a profile logs" = built-ins + that profile's enabled custom types (from `profile_parameters`). Use the same `fetchParameterTypesForProfile` helper.
- **Paywall**: unchanged. The custom-type *count* limit (Pro 4 / Premium 8) is about how many custom types exist; assignment is free and unlimited.

---

## Tests to add
- Migration backfill: after upgrade, every existing custom type is linked to every existing profile (no parameter disappears).
- Creation with "Selected profiles": only chosen profiles get junction rows; New Record for a non-selected profile does NOT offer that param; a selected profile does.
- Per-profile toggle: enabling/disabling a custom param for a profile inserts/deletes exactly one junction row and does not touch readings.
- New Record picker: returns built-ins + only the active profile's linked customs.
- Non-destructive removal: disabling a param for a profile leaves its existing readings intact and still visible in history/export.
- Delete parameter type cascades its `profile_parameters` rows.
- Backup round-trip preserves `profile_parameters` assignments.
