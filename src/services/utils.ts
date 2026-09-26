import { ParameterType, FieldDefinition } from '../types';

export type RangeKey = 'today' | 'yesterday' | '7' | '30';

// Which of a parameter type's fields get their own column in the compact Diary
// table — every numeric field, plus any other field explicitly opted in via
// `showInList` (e.g. Glucose's "Test Type"). Shared by DiaryScreen (column headers)
// and ReadingItem (row cells) so the two can never drift out of column alignment.
export function diaryColumnFields(parameterType: ParameterType | null | undefined): FieldDefinition[] {
  return parameterType ? parameterType.field_definitions.filter(f => f.dataType === 'numeric' || f.showInList) : [];
}

export function rangeStart(range: RangeKey) {
  const now = new Date();
  const start = new Date();
  if (range === 'today') start.setHours(0,0,0,0);
  else if (range === 'yesterday') { start.setDate(now.getDate() -1); start.setHours(0,0,0,0); }
  else if (range === '7') { start.setDate(now.getDate() -7); }
  else { start.setDate(now.getDate() -30); }
  return start;
}

export function filterByRange(readings: any[], range: RangeKey) {
  const start = rangeStart(range);
  return readings.filter(r => new Date(r.recorded_at) >= start);
}

export function mgdlToMmolL(value: number) {
  return +(value / 18.0182).toFixed(2);
}

export function mmolLToMgdl(value: number) {
  return Math.round(value * 18.0182);
}

// BP tiers are the American Heart Association's official 5-category chart
// (heart.org: Normal / Elevated / Hypertension Stage 1 / Stage 2 / Hypertensive
// Crisis), plus 'low'/'borderline-low' — AHA's chart has no low-BP category, but we
// keep flagging hypotension for a health diary's sake; it's called out separately
// wherever the label is shown, not presented as an AHA-sourced category. Glucose
// tiers are the ADA's (diabetes.org) diagnostic ranges — 'prediabetes-range' and
// 'diabetes-range' are its Fasting Plasma Glucose / OGTT criteria — plus 'low'/
// 'borderline-low' sourced from the ADA's own Level 2/Level 1 hypoglycemia
// thresholds (a separate ADA scale from the diagnostic one, not invented here).
// Pulse gets its own 'pulse-*' tiers (rather than reusing the shared 'low'/'elevated'/
// 'high') because its reference chart colors Low as blue, not red — bradycardia isn't
// flagged with the same urgency as low BP/glucose — so it needs its own color mapping
// below, distinct from the shared low/high used everywhere else.
export type ClinicalClassification =
  | 'low' | 'borderline-low' | 'normal' | 'elevated' | 'high'
  | 'stage1' | 'stage2' | 'hypertensive-crisis'
  | 'prediabetes-range' | 'diabetes-range'
  | 'pulse-low' | 'pulse-elevated' | 'pulse-high';

// heart.org — Understanding Blood Pressure Readings:
//   Normal: sys <120 and dia <80
//   Elevated: sys 120-129 and dia <80
//   High BP (Hypertension) Stage 1: sys 130-139 or dia 80-89
//   High BP (Hypertension) Stage 2: sys >=140 or dia >=90
//   Hypertensive Crisis: sys >180 or dia >120 (consult a doctor immediately)
// Checked most-severe-first so the OR conditions above correctly imply the AND
// condition in "Elevated" (any reading that reaches a diastolic of 80+ has already
// matched Stage 1 and returned before the Elevated check runs).
export function classifyBP(systolic: number, diastolic: number): ClinicalClassification {
  if (systolic > 180 || diastolic > 120) return 'hypertensive-crisis';
  if (systolic >= 140 || diastolic >= 90) return 'stage2';
  if (systolic >= 130 || diastolic >= 80) return 'stage1';
  if (systolic >= 120 && diastolic < 80) return 'elevated';
  if (systolic < 80 || diastolic < 50) return 'low';
  if (systolic < 90 || diastolic < 60) return 'borderline-low';
  return 'normal';
}

export type GlucoseTestType = 'fasting' | 'ogtt';

// diabetes.org diagnostic criteria, which differ by test:
//   Fasting Plasma Glucose (FPG): Normal <100, Prediabetes 100-125, Diabetes >=126
//   Oral Glucose Tolerance Test (OGTT, 2-hr): Normal <140, Prediabetes 140-199, Diabetes >=200
// Low/borderline-low use the ADA's Level 2 (<54) / Level 1 (54-69) hypoglycemia
// thresholds, which apply regardless of fasting/OGTT context.
export function classifyGlucose(mgdl: number, testType: GlucoseTestType = 'fasting'): ClinicalClassification {
  if (mgdl < 54) return 'low';
  if (mgdl < 70) return 'borderline-low';
  if (testType === 'ogtt') {
    if (mgdl >= 200) return 'diabetes-range';
    if (mgdl >= 140) return 'prediabetes-range';
    return 'normal';
  }
  if (mgdl >= 126) return 'diabetes-range';
  if (mgdl >= 100) return 'prediabetes-range';
  return 'normal';
}

// Age-banded resting heart rate reference (Low/Normal/Elevated/High by age group).
// `ageInMonths` omitted defaults to the Adult band.
type PulseAgeGroup = 'newborn' | 'infant' | 'toddler' | 'child' | 'older-child' | 'adult' | 'older-adult';

const PULSE_RANGES: Record<PulseAgeGroup, { low: number; normalMax: number; elevatedMax: number }> = {
  'newborn':      { low: 70, normalMax: 190, elevatedMax: 205 }, // 0-1 mo
  'infant':       { low: 80, normalMax: 160, elevatedMax: 175 }, // 1-11 mo
  'toddler':      { low: 70, normalMax: 150, elevatedMax: 165 }, // 1-2 yr
  'child':        { low: 60, normalMax: 110, elevatedMax: 130 }, // 3-10 yr
  'older-child':  { low: 50, normalMax: 100, elevatedMax: 120 }, // 11-17 yr
  'adult':        { low: 60, normalMax: 100, elevatedMax: 120 }, // 18-64 yr
  'older-adult':  { low: 60, normalMax: 100, elevatedMax: 115 }, // 65+ yr
};

function pulseAgeGroup(ageInMonths: number): PulseAgeGroup {
  if (ageInMonths < 1) return 'newborn';
  if (ageInMonths < 12) return 'infant';
  const ageYears = ageInMonths / 12;
  if (ageYears < 3) return 'toddler';
  if (ageYears < 11) return 'child';
  if (ageYears < 18) return 'older-child';
  if (ageYears < 65) return 'adult';
  return 'older-adult';
}

export function classifyPulse(bpm: number, ageInMonths?: number): ClinicalClassification {
  const range = PULSE_RANGES[ageInMonths !== undefined && ageInMonths >= 0 ? pulseAgeGroup(ageInMonths) : 'adult'];
  if (bpm < range.low) return 'pulse-low';
  if (bpm > range.elevatedMax) return 'pulse-high';
  if (bpm > range.normalMax) return 'pulse-elevated';
  return 'normal';
}

// Maps a clinical classification to a theme color token name (see src/theme/tokens.ts).
// Kept as a string key rather than importing tokens directly so this stays a plain
// data-classification helper, independent of the UI layer. 'stage1' gets its own
// orange tier (distinct from Stage 2/Crisis's red) to match heart.org's chart, which
// visually escalates through more than 3 colors; Stage 2 and Crisis share red and are
// told apart only by their label text. Pulse's "Elevated" is the same yellow/warning
// as BP's "Elevated" (not its own orange) so "Elevated" reads as one consistent color
// across parameters, matching the live classification badge on the New Record screen.
export function clinicalColorKey(classification: ClinicalClassification): 'success' | 'warning' | 'orange' | 'danger' | 'info' {
  if (classification === 'normal') return 'success';
  if (classification === 'pulse-low') return 'info';
  if (classification === 'pulse-high') return 'danger';
  if (classification === 'elevated' || classification === 'pulse-elevated' || classification === 'borderline-low' || classification === 'prediabetes-range') return 'warning';
  if (classification === 'stage1') return 'orange';
  return 'danger'; // 'low', 'high', 'stage2', 'hypertensive-crisis', 'diabetes-range'
}

// Human-readable label for a classification badge (e.g. NewRecordModal's live BP
// preview) — centralized so a hyphenated tier name like 'borderline-low' or
// 'diabetes-range' doesn't get mangled by a naive string-capitalize call site.
export function clinicalLabel(classification: ClinicalClassification): string {
  switch (classification) {
    case 'hypertensive-crisis': return 'Hypertensive Crisis';
    case 'stage2': return 'High Blood Pressure (Stage 2)';
    case 'stage1': return 'High Blood Pressure (Stage 1)';
    case 'diabetes-range': return 'Diabetes Range';
    case 'prediabetes-range': return 'Prediabetes Range';
    case 'borderline-low': return 'Borderline Low';
    case 'low': return 'Low';
    case 'elevated': return 'Elevated';
    case 'high': return 'High';
    case 'pulse-low': return 'Low (Bradycardia)';
    case 'pulse-elevated': return 'Elevated';
    case 'pulse-high': return 'High (Tachycardia)';
    case 'normal': return 'Normal';
  }
}

// Which value(s) of a reading get clinical coloring, and by what classification.
// Shared by ReadingItem (Diary), ChartScreen (dot color), and ReportScreen (table
// cells) so the "what counts as normal/elevated/high" rule lives in one place.
// A glucose reading with no `vals.test_type` (anything saved before this field
// existed) is treated as fasting — the same default a fresh reading gets — rather
// than left unclassified. `ageInMonths` (the profile's age at read time, from
// `ageInMonthsFromDOB`) drives Pulse's age-banded thresholds; omitted, Pulse falls
// back to the Adult band.
export function fieldClassification(parameterTypeId: string, key: string, vals: Record<string, any>, ageInMonths?: number): ClinicalClassification | null {
  if (parameterTypeId === 'bp' && (key === 'systolic' || key === 'diastolic')) {
    const s = Number(vals.systolic);
    const d = Number(vals.diastolic);
    if (isNaN(s) || isNaN(d)) return null;
    return classifyBP(s, d);
  }
  if (parameterTypeId === 'bp' && key === 'pulse') {
    const p = Number(vals.pulse);
    if (isNaN(p)) return null;
    return classifyPulse(p, ageInMonths);
  }
  if (parameterTypeId === 'glucose' && key === 'value') {
    const v = Number(vals[key]);
    if (isNaN(v)) return null;
    const testType: GlucoseTestType = vals.test_type === 'ogtt' ? 'ogtt' : 'fasting';
    return classifyGlucose(v, testType);
  }
  return null;
}

// Fixed Y-axis config for chart rendering, keyed by parameter type id — BP's three
// numeric fields (Systolic/Diastolic/Pulse) share one axis, so a tight auto-domain
// can crowd them together with no headroom. 40-200 in steps of 20 gives each line
// room to move and guarantees ticks land exactly on the clinically meaningful 80
// (Diastolic normal ceiling) and 120 (Systolic normal ceiling) values. Other types
// auto-domain from their actual data instead.
export function yAxisConfigFor(typeId: string | null | undefined): { domain: [number, number]; tickValues: number[] } | null {
  if (typeId === 'bp') {
    return { domain: [40, 200], tickValues: [40, 60, 80, 100, 120, 140, 160, 180, 200] };
  }
  return null;
}

export interface ChartSeries {
  id: string;
  label: string;
  fieldKey: string;
  readings: any[];
}

// One series per numeric field (BP: Systolic, Diastolic, Pulse) normally. A
// parameter type with exactly one numeric field plus a `groupChartBy` enum field
// (Glucose's Test Type) instead gets one series per enum option — Fasting and OGTT
// are on different clinical scales, so mixing them into a single line would be
// misleading. Shared by ChartScreen, ReportScreen, and the PDF chart so all three
// always split/color the same readings into the same series.
export function buildChartSeriesList(typeDef: ParameterType | null | undefined, readings: any[]): ChartSeries[] {
  if (!typeDef) return [];
  const numericFields = typeDef.field_definitions.filter(f => f.dataType === 'numeric');
  const groupField = typeDef.field_definitions.find(f => f.dataType === 'enum' && f.groupChartBy);
  if (groupField && numericFields.length === 1) {
    const options: string[] = groupField.options?.length
      ? groupField.options
      : Array.from(new Set(readings.map((r: any) => r.vals[groupField.key]).filter(Boolean)));
    return options.map((opt: string) => ({
      id: opt,
      label: groupField.optionShortLabels?.[opt] ?? groupField.optionLabels?.[opt] ?? opt,
      fieldKey: numericFields[0].key,
      readings: readings.filter((r: any) => (r.vals[groupField.key] ?? groupField.default) === opt),
    }));
  }
  return numericFields.map(f => ({ id: f.key, label: f.label, fieldKey: f.key, readings }));
}

// The x-axis spans the actual readings' own date range, not the full selected range
// window (rangeStart(range) .. now) — a "30 days" filter with readings only in the
// last 2 days would otherwise stretch the axis across all 30 days, cramming every
// point into the right edge and leaving the rest of the chart empty. A single
// reading gets a small padding window so the domain isn't zero-width. Tick count
// backs off as the span widens so date labels don't overlap each other.
export function computeChartXDomain(readings: any[], range: RangeKey): { x0: Date; x1: Date; tickCount: number } {
  const dataTimes = readings.map(r => new Date(r.recorded_at).getTime());
  const x0 = dataTimes.length
    ? new Date(Math.min(...dataTimes) - (dataTimes.length === 1 ? 12 * 60 * 60 * 1000 : 0))
    : rangeStart(range);
  const x1 = dataTimes.length
    ? new Date(Math.max(...dataTimes) + (dataTimes.length === 1 ? 12 * 60 * 60 * 1000 : 0))
    : new Date();
  const spanDays = (x1.getTime() - x0.getTime()) / (1000 * 60 * 60 * 24);
  const tickCount = spanDays > 14 ? 4 : spanDays > 2 ? 5 : Math.min(Math.max(dataTimes.length, 2), 6);
  return { x0, x1, tickCount };
}

export function daysSince(dateIso?: string | null) {
  if (!dateIso) return Infinity;
  const then = new Date(dateIso);
  const diff = Date.now() - then.getTime();
  return Math.floor(diff / (1000*60*60*24));
}

export function ageFromDOB(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// Finer-grained than ageFromDOB (whole years) — needed because the pulse age-band
// reference distinguishes newborn/infant/toddler within a single year of life.
export function ageInMonthsFromDOB(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  return Math.max(0, months);
}

// Derives a FieldDefinition.key from a custom parameter type's user-typed field label
// (e.g. "Waist Circumference" -> "waist_circumference"). Only used for a brand-new field —
// an existing field being edited keeps its original key regardless of label changes, since
// the key is what already-saved readings' `vals` JSON is keyed by. Disambiguates against
// the type's other field keys (case-insensitively) by appending _2, _3, ... so two fields
// with the same or similar label don't collide.
export function slugifyFieldKey(label: string, existingKeys: string[]): string {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
  const taken = new Set(existingKeys.map(k => k.toLowerCase()));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// Date-range helpers for the bulk-delete filter (BulkDeleteScreen). Deliberately separate
// from rangeStart/RangeKey/filterByRange above — those are open-ended at the top (always
// "from X through right now"), which is wrong for a delete filter's "To" date: picking a
// past month must not silently include everything since then. These give an explicit,
// inclusive upper bound too.
export function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

// Monday-start calendar week containing `now`.
export function startOfThisWeek(now: Date = new Date()): Date {
  const d = startOfDay(now);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7; // Monday -> 0, Sunday -> 6
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

export function startOfThisMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfThisYear(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), 0, 1);
}

// Inclusive on both ends; a null from/to leaves that side unbounded.
export function matchesDateRange(recordedAtIso: string, from: Date | null, to: Date | null): boolean {
  const t = new Date(recordedAtIso).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}
