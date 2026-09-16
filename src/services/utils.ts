export type RangeKey = 'today' | 'yesterday' | '7' | '30';

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

export type ClinicalClassification = 'normal' | 'elevated' | 'high' | 'hypertensive-crisis' | 'low';

export function classifyBP(systolic: number, diastolic: number): ClinicalClassification {
  if (systolic >= 180 || diastolic >= 120) return 'hypertensive-crisis';
  if (systolic >= 140 || diastolic >= 90) return 'high';
  if (systolic >= 120 || diastolic >= 80) return 'elevated';
  return 'normal';
}

export function classifyGlucose(mgdl: number): ClinicalClassification {
  if (mgdl < 70) return 'low';
  if (mgdl > 180) return 'high';
  if (mgdl >= 140) return 'elevated';
  return 'normal';
}

// Maps a clinical classification to a theme color token name (see src/theme/tokens.ts).
// Kept as a string key rather than importing tokens directly so this stays a plain
// data-classification helper, independent of the UI layer.
export function clinicalColorKey(classification: ClinicalClassification): 'success' | 'warning' | 'danger' {
  if (classification === 'normal') return 'success';
  if (classification === 'elevated') return 'warning';
  return 'danger'; // 'high', 'hypertensive-crisis', 'low'
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
