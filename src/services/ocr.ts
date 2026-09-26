/**
 * OCR service abstraction.
 *
 * Implementations should use on-device OCR engines (iOS Vision, Android ML Kit).
 * For this build the functions are stubbed to demonstrate the flow; replace
 * the internals with native integrations later.
 */
import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export type OCRResult = {
  parameterType: 'bp' | 'glucose' | 'unknown';
  values: Record<string, any>;
  confidence: number; // 0-1
  rawText?: string;
  engine?: 'native' | 'stub';
  nativeError?: string;
};

import { parseTextForReading, validBP, validPulse } from './ocrParsing';
import { decodeSevenSegmentRows, DecodedRow } from './sevenSegmentDecoder';

async function processImageForReadingStub(uri: string): Promise<OCRResult> {
  // Fallback: attempt to parse readable text from filename or uri (when OCR not available)
  const filename = uri.split('/').pop() || uri;
  return parseTextForReading(filename);
}

/**
 * processImageForReading
 * Attempts to use a native on-device OCR implementation if one is provided via NativeModules.
 * Fallbacks to a JS heuristic stub that requires user verification.
 *
 * Native integration notes:
 * - iOS: implement a native module (e.g. `VisionOCR`) that exposes a `recognize(uri)` method using `VNRecognizeTextRequest`.
 * - Android: implement a native module (e.g. `MLKitOCR`) that exposes a `process(uri)` method using Google ML Kit on-device Text Recognition.
 * The native module should return an object shaped like `OCRResult` and must NOT transmit images off-device.
 */
// The native modules only need to be trusted for the recognized text; their
// own regex parsing only understands "120/80" and misses the stacked
// SYS / DIA / PULSE layout most BP monitors use, so all interpretation
// happens here in JS (one shared, unit-tested parser for both platforms).
function fromNative(res: any): OCRResult {
  if (typeof res?.rawText === 'string') return { ...parseTextForReading(res.rawText), engine: 'native' };
  return { ...(res as OCRResult), engine: 'native' };
}

// ML Kit/Vision reliably reads the *printed* labels next to the digits (SYS/DIA/PULSE,
// mg/dL, mmol) even though it misreads the seven-segment digits themselves — reuse that
// as a coarse "what kind of device is this" signal, same keywords the text parser matches.
function classifyFromRawText(rawText: string): 'bp' | 'glucose' | 'unknown' {
  const lowered = rawText.toLowerCase();
  if (/sys\w*|dia\w*/.test(lowered)) return 'bp';
  if (/mg\s*\/?\s*dl|mmol|glucose|sugar|\bbg\b/.test(lowered)) return 'glucose';
  return 'unknown';
}

// Builds a result straight from the pixel decoder's rows, validated with the same
// plausibility ranges the text parser uses. Returns null (never guesses) when the row
// count or values don't fit the classified device type.
function buildFromRows(kind: 'bp' | 'glucose', rows: DecodedRow[], rawText: string): OCRResult | null {
  if (kind === 'bp' && (rows.length === 2 || rows.length === 3)) {
    const s = parseInt(rows[0].text, 10);
    const d = parseInt(rows[1].text, 10);
    if (!Number.isFinite(s) || !Number.isFinite(d) || !validBP(s, d)) return null;
    const pRaw = rows[2] ? parseInt(rows[2].text, 10) : NaN;
    const pulse = Number.isFinite(pRaw) && validPulse(pRaw) ? pRaw : null;
    return { parameterType: 'bp', values: { systolic: s, diastolic: d, pulse }, confidence: 0.95, rawText };
  }
  if (kind === 'glucose' && rows.length >= 1) {
    const value = parseInt(rows[0].text, 10);
    if (!Number.isFinite(value) || value < 20 || value > 600) return null;
    const unit = /mmol/.test(rawText.toLowerCase()) ? 'mmol/L' : 'mg/dL';
    return { parameterType: 'glucose', values: { value, unit }, confidence: 0.9, rawText };
  }
  return null;
}

// Reads the photo's own bytes (separately from whatever the native module did) to run the
// seven-segment pixel decoder. Never throws: an unreadable file or unsupported image format
// (e.g. HEIC, which jpeg-js can't decode) just means no pixel-decoder result, not a crash.
async function decodePixelRows(uri: string): Promise<DecodedRow[] | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return decodeSevenSegmentRows(Buffer.from(base64, 'base64'));
  } catch {
    return null;
  }
}

// Combines the native module's rawText (for device-type classification) with the pixel
// decoder's digits (for the actual values). Falls back to null — meaning "use today's
// rawText-only parse" — whenever the decoder didn't find a usable, in-range row count.
async function fuseWithPixelDecoder(uri: string, rawText: string): Promise<OCRResult | null> {
  const kind = classifyFromRawText(rawText);
  if (kind === 'unknown') return null;
  const rows = await decodePixelRows(uri);
  if (!rows || rows.length === 0) return null;
  return buildFromRows(kind, rows, rawText);
}

export async function processImageForReading(uri: string): Promise<OCRResult> {
  let nativeError: string | undefined;
  try {
    let nativeRes: any;
    if (Platform.OS === 'ios' && (NativeModules as any).VisionOCR && typeof (NativeModules as any).VisionOCR.recognize === 'function') {
      nativeRes = await (NativeModules as any).VisionOCR.recognize(uri);
    } else if (Platform.OS === 'android' && (NativeModules as any).MLKitOCR && typeof (NativeModules as any).MLKitOCR.process === 'function') {
      nativeRes = await (NativeModules as any).MLKitOCR.process(uri);
    } else {
      nativeError = 'native OCR module not found';
    }
    if (nativeRes) {
      const rawText = typeof nativeRes?.rawText === 'string' ? nativeRes.rawText : '';
      const fused = rawText ? await fuseWithPixelDecoder(uri, rawText) : null;
      return fused ? { ...fused, engine: 'native' } : fromNative(nativeRes);
    }
  } catch (e: any) {
    nativeError = String(e?.message ?? e);
    console.warn('Native OCR failed:', nativeError);
  }
  // fallback stub
  return { ...(await processImageForReadingStub(uri)), engine: 'stub', nativeError };
}

