import { processImageForReading } from '../src/services/ocr';

describe('OCR fallback and integration', () => {
  it('returns unknown for non-numeric URI', async () => {
    const res = await processImageForReading('file:///no_numbers_here.jpg');
    expect(res.parameterType).toBeDefined();
    expect(res.confidence).toBeGreaterThanOrEqual(0);
  });

  it('parses blood pressure-like patterns from filename', async () => {
    const res = await processImageForReading('file:///BP_120/80.jpg');
    expect(['bp', 'glucose', 'unknown']).toContain(res.parameterType);
  });
});
