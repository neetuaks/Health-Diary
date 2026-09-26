import {
  rangeStart,
  filterByRange,
  mgdlToMmolL,
  mmolLToMgdl,
  classifyBP,
  classifyGlucose,
  classifyPulse,
  clinicalColorKey,
  daysSince,
  slugifyFieldKey,
  fieldClassification,
  startOfDay,
  endOfDay,
  startOfThisWeek,
  startOfThisMonth,
  startOfThisYear,
  matchesDateRange
} from '../src/services/utils';

test('rangeStart produces reasonable dates', () => {
  const r7 = rangeStart('7');
  const now = new Date();
  expect((now.getTime() - r7.getTime())/(1000*60*60*24)).toBeGreaterThanOrEqual(6);
});

test('unit conversions round-trip', () => {
  const mg = 180;
  const mmol = mgdlToMmolL(mg);
  const back = mmolLToMgdl(mmol);
  expect(Math.abs(back - mg)).toBeLessThanOrEqual(1);
});

test('bp classification (heart.org 5-category chart)', () => {
  expect(classifyBP(115,75)).toBe('normal');
  expect(classifyBP(125,78)).toBe('elevated');
  expect(classifyBP(135,85)).toBe('stage1');
  expect(classifyBP(145,95)).toBe('stage2');
  expect(classifyBP(185,125)).toBe('hypertensive-crisis');
});

test('bp classification is symmetric on the low side too (not part of the AHA chart)', () => {
  expect(classifyBP(85,65)).toBe('borderline-low');
  expect(classifyBP(75,45)).toBe('low');
});

test('daysSince handles null', () => {
  expect(daysSince(null)).toBeGreaterThan(1000000);
});

test('glucose classification — fasting (diabetes.org FPG criteria)', () => {
  expect(classifyGlucose(50)).toBe('low');
  expect(classifyGlucose(65)).toBe('borderline-low');
  expect(classifyGlucose(90)).toBe('normal');
  expect(classifyGlucose(110)).toBe('prediabetes-range');
  expect(classifyGlucose(150)).toBe('diabetes-range');
});

test('slugifyFieldKey derives a snake_case key from a label', () => {
  expect(slugifyFieldKey('Waist Circumference', [])).toBe('waist_circumference');
});

test('slugifyFieldKey falls back to "field" when the label has no valid characters', () => {
  expect(slugifyFieldKey('%%%', [])).toBe('field');
});

test('slugifyFieldKey disambiguates case-insensitively against existing keys', () => {
  expect(slugifyFieldKey('Weight', ['weight'])).toBe('weight_2');
  expect(slugifyFieldKey('Weight', ['weight', 'weight_2'])).toBe('weight_3');
});

test('fieldClassification returns null for a custom parameter type (no clinical range known)', () => {
  expect(fieldClassification('a-custom-uuid-1234', 'systolic', { systolic: 200 })).toBeNull();
  expect(fieldClassification('a-custom-uuid-1234', 'value', { value: 9999 })).toBeNull();
});

test('startOfDay/endOfDay produce the correct day boundaries', () => {
  const d = new Date('2024-03-15T14:30:00.000Z');
  const start = startOfDay(d);
  const end = endOfDay(d);
  expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  expect(start.getDate()).toBe(d.getDate());
  expect(end.getDate()).toBe(d.getDate());
});

test('startOfThisWeek returns the most recent Monday', () => {
  const wednesday = new Date(2024, 2, 13); // 2024-03-13 is a Wednesday
  expect(startOfThisWeek(wednesday).getDate()).toBe(11); // Monday 2024-03-11

  const monday = new Date(2024, 2, 11); // itself a Monday
  expect(startOfThisWeek(monday).getDate()).toBe(11);

  const sunday = new Date(2024, 2, 17); // 2024-03-17 is a Sunday, still in that same week
  expect(startOfThisWeek(sunday).getDate()).toBe(11);
});

test('startOfThisMonth/startOfThisYear return the correct calendar boundary', () => {
  const now = new Date(2024, 2, 15); // 2024-03-15
  const monthStart = startOfThisMonth(now);
  expect([monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate()]).toEqual([2024, 2, 1]);

  const yearStart = startOfThisYear(now);
  expect([yearStart.getFullYear(), yearStart.getMonth(), yearStart.getDate()]).toEqual([2024, 0, 1]);
});

test('matchesDateRange is inclusive at both boundaries and unbounded when null', () => {
  const from = new Date('2024-03-10T00:00:00.000Z');
  const to = new Date('2024-03-15T23:59:59.999Z');
  expect(matchesDateRange('2024-03-10T00:00:00.000Z', from, to)).toBe(true);
  expect(matchesDateRange('2024-03-15T23:59:59.999Z', from, to)).toBe(true);
  expect(matchesDateRange('2024-03-09T23:59:59.999Z', from, to)).toBe(false);
  expect(matchesDateRange('2024-03-16T00:00:00.000Z', from, to)).toBe(false);
  expect(matchesDateRange('1999-01-01T00:00:00.000Z', null, to)).toBe(true);
  expect(matchesDateRange('2999-01-01T00:00:00.000Z', from, null)).toBe(true);
});

test('glucose classification — OGTT (diabetes.org 2-hr criteria)', () => {
  expect(classifyGlucose(120, 'ogtt')).toBe('normal');
  expect(classifyGlucose(160, 'ogtt')).toBe('prediabetes-range');
  expect(classifyGlucose(210, 'ogtt')).toBe('diabetes-range');
});

test('pulse classification defaults to the Adult band when no age is given', () => {
  expect(classifyPulse(45)).toBe('pulse-low');
  expect(classifyPulse(75)).toBe('normal');
  expect(classifyPulse(110)).toBe('pulse-elevated');
  expect(classifyPulse(130)).toBe('pulse-high');
});

test('pulse classification uses the age-specific band when ageInMonths is given', () => {
  // Newborn (0-1 mo): Normal 70-190
  expect(classifyPulse(150, 0)).toBe('normal');
  expect(classifyPulse(60, 0)).toBe('pulse-low');
  // Child (3-10 yr = 36-131 mo): Normal 60-110, Elevated 111-130
  expect(classifyPulse(125, 60)).toBe('pulse-elevated');
  // Same 105 bpm reads Normal for a child but Elevated for an untagged (adult) profile
  expect(classifyPulse(105, 60)).toBe('normal');
  expect(classifyPulse(105)).toBe('pulse-elevated');
});

test('clinicalColorKey maps classifications to the expected color token', () => {
  expect(clinicalColorKey('normal')).toBe('success');
  expect(clinicalColorKey('elevated')).toBe('warning');
  expect(clinicalColorKey('borderline-low')).toBe('warning');
  expect(clinicalColorKey('prediabetes-range')).toBe('warning');
  expect(clinicalColorKey('stage1')).toBe('orange');
  expect(clinicalColorKey('stage2')).toBe('danger');
  expect(clinicalColorKey('diabetes-range')).toBe('danger');
  expect(clinicalColorKey('high')).toBe('danger');
  expect(clinicalColorKey('hypertensive-crisis')).toBe('danger');
  expect(clinicalColorKey('low')).toBe('danger');
  expect(clinicalColorKey('pulse-low')).toBe('info');
  expect(clinicalColorKey('pulse-elevated')).toBe('warning');
  expect(clinicalColorKey('pulse-high')).toBe('danger');
});
