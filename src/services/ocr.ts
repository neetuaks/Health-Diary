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
export async function processImageForReading(uri: string): Promise<OCRResult> {
  try {
    if (Platform.OS === 'ios' && (NativeModules as any).VisionOCR && typeof (NativeModules as any).VisionOCR.recognize === 'function') {
      const res = await (NativeModules as any).VisionOCR.recognize(uri);
      return res as OCRResult;
    }
    if (Platform.OS === 'android' && (NativeModules as any).MLKitOCR && typeof (NativeModules as any).MLKitOCR.process === 'function') {
      const res = await (NativeModules as any).MLKitOCR.process(uri);
      return res as OCRResult;
    }
  } catch (e) {
    console.warn('Native OCR failed:', e);
  }
  // fallback stub
  return processImageForReadingStub(uri);
}

