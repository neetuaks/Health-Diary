/**
 * OCR service abstraction.
 *
 * Implementations should use on-device OCR engines (iOS Vision, Android ML Kit).
 * For this build the functions are stubbed to demonstrate the flow; replace
 * the internals with native integrations later.
 */
import { NativeModules, Platform } from 'react-native';

export type OCRResult = {
  parameterType: 'bp' | 'glucose' | 'unknown';
  values: Record<string, any>;
  confidence: number; // 0-1
  rawText?: string;
  engine?: 'native' | 'stub';
  nativeError?: string;
};

import { parseTextForReading } from './ocrParsing';

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

export async function processImageForReading(uri: string): Promise<OCRResult> {
  let nativeError: string | undefined;
  try {
    if (Platform.OS === 'ios' && (NativeModules as any).VisionOCR && typeof (NativeModules as any).VisionOCR.recognize === 'function') {
      return fromNative(await (NativeModules as any).VisionOCR.recognize(uri));
    }
    if (Platform.OS === 'android' && (NativeModules as any).MLKitOCR && typeof (NativeModules as any).MLKitOCR.process === 'function') {
      return fromNative(await (NativeModules as any).MLKitOCR.process(uri));
    }
    nativeError = 'native OCR module not found';
  } catch (e: any) {
    nativeError = String(e?.message ?? e);
    console.warn('Native OCR failed:', nativeError);
  }
  // fallback stub
  return { ...(await processImageForReadingStub(uri)), engine: 'stub', nativeError };
}

