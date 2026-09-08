export type OCRResult = {
  parameterType: 'bp' | 'glucose' | 'unknown';
  values: Record<string, any>;
  confidence: number;
  rawText?: string;
};

export function parseTextForReading(text: string): OCRResult {
  const lowered = text.toLowerCase();

  const bpRegex = /(\b|^)(?:bp|blood pressure|b\.p\.)?[:\s-]*?(\d{2,3})\s*[\/\s]\s*(\d{2,3})(?:\s*(?:\/|\s)\s*(\d{2,3}))?/i;
  const glucoseRegex = /(\d{2,3}(?:\.\d+)?)(?:\s*(?:mg\/dl|mg dl|mgdl))|\b(\d{1,2}\.?\d?)\s*(?:mmol\/l|mmol)/i;

  const bpMatch = lowered.match(bpRegex);
  if (bpMatch) {
    const systolic = parseInt(bpMatch[2], 10);
    const diastolic = parseInt(bpMatch[3], 10);
    const pulse = bpMatch[4] ? parseInt(bpMatch[4], 10) : null;
    return { parameterType: 'bp', values: { systolic, diastolic, pulse }, confidence: 0.9, rawText: text };
  }

  const gMatch = lowered.match(glucoseRegex);
  if (gMatch) {
    if (gMatch[1]) {
      return { parameterType: 'glucose', values: { value: parseFloat(gMatch[1]), unit: 'mg/dL' }, confidence: 0.85, rawText: text };
    }
    if (gMatch[2]) {
      return { parameterType: 'glucose', values: { value: parseFloat(gMatch[2]), unit: 'mmol/L' }, confidence: 0.78, rawText: text };
    }
  }

  return { parameterType: 'unknown', values: { rawText: text }, confidence: 0.12, rawText: text };
}

export default { parseTextForReading };
