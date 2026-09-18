import { rangeStart, filterByRange, mgdlToMmolL, mmolLToMgdl, classifyBP, classifyGlucose, classifyPulse, clinicalColorKey, daysSince } from '../src/services/utils';

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
