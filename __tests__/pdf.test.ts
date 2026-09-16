import { generateReportPDF } from '../src/services/pdf';

const Print = require('expo-print');

describe('generateReportPDF', () => {
  beforeEach(() => { Print.printToFileAsync.mockClear(); });

  test('includes profile name, age, and per-reading vals in the generated HTML', async () => {
    const profile = { id: 'p1', name: 'Alice', date_of_birth: '1990-06-15' };
    const readings = [
      { id: 'r1', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', vals: { systolic: 120, diastolic: 80 } }
    ];
    await generateReportPDF(profile, readings, []);

    expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
    const { html } = Print.printToFileAsync.mock.calls[0][0];
    expect(html).toContain('Alice');
    expect(html).toMatch(/\(\d+ years old\)/);
    expect(html).toContain('systolic');
  });

  test('parameterFilter excludes non-matching readings', async () => {
    const profile = { id: 'p1', name: 'Bob', date_of_birth: null };
    const readings = [
      { id: 'r1', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', vals: { systolic: 120, diastolic: 80 } },
      { id: 'r2', parameter_type_id: 'glucose', recorded_at: '2024-01-02T00:00:00.000Z', vals: { value: 100 } }
    ];
    await generateReportPDF(profile, readings, ['glucose']);

    const { html } = Print.printToFileAsync.mock.calls[0][0];
    expect(html).toContain('glucose');
    expect(html).not.toContain('>bp<');
  });
});
