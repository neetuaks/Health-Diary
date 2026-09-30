import { Profile, ParameterType, Reading } from '../types';
import { fetchReadingsForProfile } from './readingService';
import { fetchParameterTypesForProfile } from './profileParameterTypes';
import { fieldClassification, clinicalColorKey, diaryColumnFields, formatFieldValue, ageInMonthsFromDOB, daysSince, ClinicalClassification } from './utils';

// A reading with no newer reading of the same (profile, parameter_type) is
// "stale" past this many days with no new entry — flags it for attention on
// the dashboard even when the value itself was in range. Separate from
// PAYWALL-SPEC's historyWindowDays: that's a tier-gated *visibility* cap, this
// is a fixed clinical/care-quality signal that applies on every tier.
export const STALE_READING_DAYS = 14;

// Ranks clinicalColorKey's existing severity scale (success < info < warning <
// orange < danger) so the "worst" field on a reading can be picked without
// inventing a second classification system — reuses the same color mapping
// every other screen already uses (Diary/Chart/Report/PDF).
const COLOR_SEVERITY: Record<ReturnType<typeof clinicalColorKey>, number> = {
  success: 0,
  info: 1,
  warning: 2,
  orange: 3,
  danger: 4,
};

export type DashboardFieldValue = {
  label: string;
  display: string;
  unit: string | null;
  classification: ClinicalClassification | null;
};

export type DashboardParameterCard = {
  parameterType: ParameterType;
  latestReading: Reading | null;
  values: DashboardFieldValue[];
  // Worst clinicalColorKey across this reading's classified fields — null when
  // there's no reading yet, or none of its fields carry a clinical threshold
  // (e.g. every custom parameter).
  colorKey: ReturnType<typeof clinicalColorKey> | null;
  isStale: boolean;
  needsAttention: boolean;
};

export type DashboardProfileCard = {
  profile: Profile;
  parameters: DashboardParameterCard[];
  hasAnyReadings: boolean;
  needsAttention: boolean;
};

function buildParameterCard(parameterType: ParameterType, readings: Reading[], ageInMonths?: number): DashboardParameterCard {
  // Picks the max by recorded_at explicitly rather than trusting callers to
  // have pre-sorted `readings` — fetchReadingsForProfile's own ORDER BY is an
  // implementation detail of the real DB query, not a contract every caller
  // (including tests against the in-memory fakeDb) can rely on.
  const latestReading = readings
    .filter(r => r.parameter_type_id === parameterType.id)
    .reduce((latest: Reading | null, r) => (!latest || new Date(r.recorded_at) > new Date(latest.recorded_at) ? r : latest), null);

  if (!latestReading) {
    return { parameterType, latestReading: null, values: [], colorKey: null, isStale: false, needsAttention: false };
  }

  const fields = diaryColumnFields(parameterType);
  let worstSeverity = -1;
  let colorKey: ReturnType<typeof clinicalColorKey> | null = null;
  const values: DashboardFieldValue[] = fields.map(f => {
    const cls = f.dataType === 'numeric' ? fieldClassification(parameterType.id, f.key, latestReading.vals, ageInMonths) : null;
    if (cls) {
      const key = clinicalColorKey(cls);
      if (COLOR_SEVERITY[key] > worstSeverity) { worstSeverity = COLOR_SEVERITY[key]; colorKey = key; }
    }
    return { label: f.label, display: formatFieldValue(f, latestReading.vals[f.key]), unit: f.unit ?? null, classification: cls };
  });

  const isStale = daysSince(latestReading.recorded_at) > STALE_READING_DAYS;
  // Out-of-range means "not normal" — success is the only classification that
  // doesn't count, everything else (including the low-urgency 'info' tier) is
  // still a deviation from normal worth surfacing.
  const outOfRange = colorKey !== null && colorKey !== 'success';

  return { parameterType, latestReading, values, colorKey, isStale, needsAttention: isStale || outOfRange };
}

// One card per profile — the caregiver's entire tracked household at a
// glance (FAMILY-FEATURES-SPEC §1). Pure local aggregation: for each profile,
// its own logged parameter types (built-ins + whatever custom types are
// assigned to it — see profileParameterTypes.ts) each get their latest
// reading, classified with the exact same thresholds Diary/Chart/Report use.
export async function fetchFamilyDashboardData(profiles: Profile[]): Promise<DashboardProfileCard[]> {
  const cards: DashboardProfileCard[] = [];
  for (const profile of profiles) {
    const [readings, parameterTypes] = await Promise.all([
      fetchReadingsForProfile(profile.id),
      fetchParameterTypesForProfile(profile.id),
    ]);
    const ageInMonths = ageInMonthsFromDOB(profile.date_of_birth) ?? undefined;
    const parameters = parameterTypes.map(pt => buildParameterCard(pt, readings, ageInMonths));
    cards.push({
      profile,
      parameters,
      hasAnyReadings: readings.length > 0,
      needsAttention: parameters.some(p => p.needsAttention),
    });
  }
  return cards;
}
