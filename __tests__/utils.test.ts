import { rangeStart, filterByRange, mgdlToMmolL, mmolLToMgdl, classifyBP, daysSince } from '../src/services/utils';

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
