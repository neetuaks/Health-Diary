import { parseTextForReading } from '../src/services/ocrParsing';

describe('ocr parsing', () => {
  it('parses BP 120/80 patterns', () => {
    const res = parseTextForReading('BP 120/80');
    expect(res.parameterType).toBe('bp');
    expect(res.values.systolic).toBe(120);
    expect(res.values.diastolic).toBe(80);
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('parses labeled stacked SYS / DIA / PULSE displays', () => {
    const res = parseTextForReading('SYS\nmmHg\n127\nDIA\nmmHg\n82\nPULSE\n/min\n71');
    expect(res.parameterType).toBe('bp');
    expect(res.values).toMatchObject({ systolic: 127, diastolic: 82, pulse: 71 });
  });

  it('parses unlabeled stacked numbers as systolic, diastolic, pulse', () => {
    const res = parseTextForReading('127\n82\n71');
    expect(res.parameterType).toBe('bp');
    expect(res.values).toMatchObject({ systolic: 127, diastolic: 82, pulse: 71 });
    expect(res.confidence).toBeGreaterThan(0.5);
  });

  it('ignores a date-like slash pair that is not a plausible BP', () => {
    const res = parseTextForReading('09/24 140 mg/dL');
    expect(res.parameterType).toBe('glucose');
  });

  it('returns unknown when nothing plausible is present', () => {
    expect(parseTextForReading('hello world').parameterType).toBe('unknown');
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
