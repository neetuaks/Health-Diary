import { parseTextForReading } from '../src/services/ocrParsing';

describe('ocr parsing', () => {
  it('parses BP 120/80 patterns', () => {
    const res = parseTextForReading('BP 120/80');
    expect(res.parameterType).toBe('bp');
    expect(res.values.systolic).toBe(120);
    expect(res.values.diastolic).toBe(80);
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('parses glucose mg/dL values', () => {
    const res = parseTextForReading('Glucose 140 mg/dL');
    expect(res.parameterType).toBe('glucose');
    expect(res.values.unit).toBe('mg/dL');
  });

  it('parses glucose mmol/L values', () => {
    const res = parseTextForReading('5.6 mmol/L');
    expect(res.parameterType).toBe('glucose');
    expect(res.values.unit).toBe('mmol/L');
  });
});
