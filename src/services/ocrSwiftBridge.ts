import { NativeModules, Platform } from 'react-native';
import type { OCRResult } from './ocr';

const VisionOCR = (NativeModules as any).VisionOCR;

export async function recognizeWithSwift(uri: string): Promise<OCRResult> {
  if (Platform.OS !== 'ios' || !VisionOCR || typeof VisionOCR.recognize !== 'function') {
    throw new Error('Swift VisionOCR native module not available');
  }
  const res = await VisionOCR.recognize(uri);
  return res as OCRResult;
}

export default { recognizeWithSwift };
