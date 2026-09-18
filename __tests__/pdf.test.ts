jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import { generateReportPDF, generateRecoveryKeyPDF } from '../src/services/pdf';

const Print = require('expo-print');
const { __fakeDb } = require('../__mocks__/fakeDb');

const BP_TYPE = {
  id: 'bp', display_name: 'Blood Pressure', icon: '', color: '', is_builtin: 1,
  field_definitions: JSON.stringify([
    { key: 'systolic', label: 'Systolic', unit: 'mmHg', dataType: 'numeric' },
    { key: 'diastolic', label: 'Diastolic', unit: 'mmHg', dataType: 'numeric' }
  ])
};
const GLUCOSE_TYPE = {
  id: 'glucose', display_name: 'Glucose', icon: '', color: '', is_builtin: 1,
  field_definitions: JSON.stringify([{ key: 'value', label: 'Value', unit: 'mg/dL', dataType: 'numeric' }])
};

describe('generateReportPDF', () => {
  beforeEach(() => {
    Print.printToFileAsync.mockClear();
    __fakeDb._reset();
    __fakeDb._seedParameterTypes([BP_TYPE, GLUCOSE_TYPE]);
  });

  test('includes profile name, age, and per-reading field labels/values in the generated HTML', async () => {
    const profile = { id: 'p1', name: 'Alice', date_of_birth: '1990-06-15' };
    const readings = [
      { id: 'r1', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', vals: { systolic: 120, diastolic: 80 } }
    ];
    await generateReportPDF(profile, readings, []);

    expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
    const { html } = Print.printToFileAsync.mock.calls[0][0];
    expect(html).toContain('Alice');
    expect(html).toMatch(/\(\d+ years old\)/);
    expect(html).toContain('Systolic');
    expect(html).toContain('>120<');
  });

  test('parameterFilter excludes non-matching readings', async () => {
    const profile = { id: 'p1', name: 'Bob', date_of_birth: null };
    const readings = [
      { id: 'r1', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', vals: { systolic: 120, diastolic: 80 } },
      { id: 'r2', parameter_type_id: 'glucose', recorded_at: '2024-01-02T00:00:00.000Z', vals: { value: 100 } }
    ];
    await generateReportPDF(profile, readings, ['glucose']);

    const { html } = Print.printToFileAsync.mock.calls[0][0];
    expect(html).toContain('Glucose');
    expect(html).not.toContain('Blood Pressure');
    expect(html).not.toContain('Systolic');
  });
});

describe('generateRecoveryKeyPDF', () => {
  beforeEach(() => {
    Print.printToFileAsync.mockClear();
  });

  test('embeds the recovery key as text in the generated HTML', async () => {
    const path = await generateRecoveryKeyPDF('ABCD-1234-EFGH-5678');

    expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
    const { html } = Print.printToFileAsync.mock.calls[0][0];
    expect(html).toContain('ABCD-1234-EFGH-5678');
    expect(path).toMatch(/\.pdf$/);
  });
});
