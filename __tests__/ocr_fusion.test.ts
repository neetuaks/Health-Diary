// Verifies src/services/ocr.ts's fusion of native rawText (device-type classification)
// with the pixel decoder's digits (actual values), and that it falls back to exactly
// today's rawText-only parse whenever the decoder is inconclusive.
const mockProcess = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { MLKitOCR: { process: (...args: any[]) => mockProcess(...args) } },
}));

const mockDecodeSevenSegmentRows = jest.fn();
jest.mock('../src/services/sevenSegmentDecoder', () => ({
  decodeSevenSegmentRows: (...args: any[]) => mockDecodeSevenSegmentRows(...args),
}));

import { processImageForReading } from '../src/services/ocr';

describe('OCR pixel-decoder fusion', () => {
  beforeEach(() => {
    mockProcess.mockReset();
    mockDecodeSevenSegmentRows.mockReset();
  });

  it('builds a BP result from the decoder rows when they are in range', async () => {
    mockProcess.mockResolvedValue({ rawText: 'SYS mmHg\nDIA\nPULSE 150 89 75' });
    mockDecodeSevenSegmentRows.mockReturnValue([
      { text: '150', heightPx: 100, yCenter: 10 },
      { text: '89', heightPx: 100, yCenter: 40 },
      { text: '75', heightPx: 60, yCenter: 70 },
    ]);
    const res = await processImageForReading('file:///photo.jpg');
    expect(res).toMatchObject({
      parameterType: 'bp',
      values: { systolic: 150, diastolic: 89, pulse: 75 },
      confidence: 0.95,
      engine: 'native',
    });
  });

  it('builds a glucose result from a single decoder row', async () => {
    mockProcess.mockResolvedValue({ rawText: 'GLUCOSE mg/dL' });
    mockDecodeSevenSegmentRows.mockReturnValue([{ text: '160', heightPx: 100, yCenter: 10 }]);
    const res = await processImageForReading('file:///photo.jpg');
    expect(res).toMatchObject({
      parameterType: 'glucose',
      values: { value: 160, unit: 'mg/dL' },
      confidence: 0.9,
      engine: 'native',
    });
  });

  it('falls back to the rawText-only parse when the decoder finds an unusable row count', async () => {
    mockProcess.mockResolvedValue({ rawText: 'SYS 150 DIA 89 PULSE 75' });
    // 5 rows for a BP reading isn't a shape buildFromRows accepts (2 or 3).
    mockDecodeSevenSegmentRows.mockReturnValue([
      { text: '1', heightPx: 100, yCenter: 0 },
      { text: '5', heightPx: 100, yCenter: 10 },
      { text: '0', heightPx: 100, yCenter: 20 },
      { text: '89', heightPx: 100, yCenter: 30 },
      { text: '75', heightPx: 100, yCenter: 40 },
    ]);
    const res = await processImageForReading('file:///photo.jpg');
    // Same values today's parseTextForReading already gets from the labeled rawText,
    // at its own (lower) confidence — proving the fallback path is unchanged.
    expect(res).toMatchObject({
      parameterType: 'bp',
      values: { systolic: 150, diastolic: 89 },
      confidence: 0.9,
      engine: 'native',
    });
  });

  it('falls back when the pixel decoder finds no rows at all', async () => {
    mockProcess.mockResolvedValue({ rawText: 'SYS 150 DIA 89 PULSE 75' });
    mockDecodeSevenSegmentRows.mockReturnValue([]);
    const res = await processImageForReading('file:///photo.jpg');
    expect(res).toMatchObject({
      parameterType: 'bp',
      values: { systolic: 150, diastolic: 89 },
      confidence: 0.9,
      engine: 'native',
    });
  });
});
