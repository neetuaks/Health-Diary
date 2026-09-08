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

export function classifyBP(systolic: number, diastolic: number) {
  if (systolic >= 180 || diastolic >= 120) return 'hypertensive-crisis';
  if (systolic >= 140 || diastolic >= 90) return 'high';
  if (systolic >= 120 || diastolic >= 80) return 'elevated';
  return 'normal';
}

export function daysSince(dateIso?: string | null) {
  if (!dateIso) return Infinity;
  const then = new Date(dateIso);
  const diff = Date.now() - then.getTime();
  return Math.floor(diff / (1000*60*60*24));
}
