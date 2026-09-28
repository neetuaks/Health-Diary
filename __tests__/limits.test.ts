import { LIMITS } from '../src/services/limits';

describe('limits', () => {
  test('free tier caps profiles, custom params, and in-app history/export windows', () => {
    expect(LIMITS.free).toEqual({
      maxProfiles: 1,
      maxCustomParams: 0,
      historyWindowDays: 7,
      exportWindowDays: 7,
      canGeneratePdf: false,
      consolidatedReport: false,
      familyDashboard: false,
      canUseOCR: false,
    });
  });

  test('pro tier unlocks full history/export and PDF generation, but not family features', () => {
    expect(LIMITS.pro).toEqual({
      maxProfiles: 2,
      maxCustomParams: 4,
      historyWindowDays: null,
      exportWindowDays: null,
      canGeneratePdf: true,
      consolidatedReport: false,
      familyDashboard: false,
      canUseOCR: true,
    });
  });

  test('premium tier unlocks family dashboard and consolidated report', () => {
    expect(LIMITS.premium).toEqual({
      maxProfiles: 10,
      maxCustomParams: 8,
      historyWindowDays: null,
      exportWindowDays: null,
      canGeneratePdf: true,
      consolidatedReport: true,
      familyDashboard: true,
      canUseOCR: true,
    });
  });
});
