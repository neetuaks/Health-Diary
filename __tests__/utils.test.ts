import { rangeStart, filterByRange, mgdlToMmolL, mmolLToMgdl, classifyBP, classifyGlucose, clinicalColorKey, daysSince } from '../src/services/utils';

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

test('bp classification', () => {
  expect(classifyBP(115,75)).toBe('normal');
  expect(classifyBP(125,78)).toBe('elevated');
  expect(classifyBP(145,95)).toBe('high');
  expect(classifyBP(185,125)).toBe('hypertensive-crisis');
});

test('daysSince handles null', () => {
  expect(daysSince(null)).toBeGreaterThan(1000000);
});

test('glucose classification', () => {
  expect(classifyGlucose(65)).toBe('low');
  expect(classifyGlucose(100)).toBe('normal');
  expect(classifyGlucose(150)).toBe('elevated');
  expect(classifyGlucose(200)).toBe('high');
});

test('clinicalColorKey maps classifications to the expected color token', () => {
  expect(clinicalColorKey('normal')).toBe('success');
  expect(clinicalColorKey('elevated')).toBe('warning');
  expect(clinicalColorKey('high')).toBe('danger');
  expect(clinicalColorKey('hypertensive-crisis')).toBe('danger');
  expect(clinicalColorKey('low')).toBe('danger');
});
