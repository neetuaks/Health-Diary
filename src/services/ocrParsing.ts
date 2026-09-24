export type OCRResult = {
  parameterType: 'bp' | 'glucose' | 'unknown';
  values: Record<string, any>;
  confidence: number;
  rawText?: string;
};

const validBP = (s: number, d: number) => s >= 60 && s <= 260 && d >= 30 && d <= 160 && s > d;
const validPulse = (p: number) => p >= 30 && p <= 220;

// Number following a label ("SYS mmHg 127"), or — if that yields nothing
// usable — one preceding it ("127 SYS").
function labeledNumber(text: string, label: string): number | null {
  const after = text.match(new RegExp(`${label}[^\\d]{0,20}(\\d{2,3})\\b`, 'i'));
  if (after) return parseInt(after[1], 10);
  const before = text.match(new RegExp(`\\b(\\d{2,3})[^\\d]{0,12}${label}`, 'i'));
  return before ? parseInt(before[1], 10) : null;
}

function parseBP(text: string): OCRResult | null {
  // 1. Labeled: SYS/DIA/PULSE printed next to their numbers (stacked layout).
  const sys = labeledNumber(text, '(?:sys\\w*)');
  const dia = labeledNumber(text, '(?:dia\\w*)');
  if (sys !== null && dia !== null && validBP(sys, dia)) {
    const pul = labeledNumber(text, '(?:pul\\w*|bpm|hr\\b)');
    return {
      parameterType: 'bp',
      values: { systolic: sys, diastolic: dia, pulse: pul !== null && validPulse(pul) ? pul : null },
      confidence: 0.9,
      rawText: text,
    };
  }

  // 2. Slash form: "120/80" or "120/80/72".
  for (const m of text.matchAll(/\b(\d{2,3})\s*[\/\\]\s*(\d{2,3})(?:\s*[\/\\]\s*(\d{2,3}))?\b/g)) {
    const s = parseInt(m[1], 10);
    const d = parseInt(m[2], 10);
    if (validBP(s, d)) {
      const p = m[3] ? parseInt(m[3], 10) : null;
      return { parameterType: 'bp', values: { systolic: s, diastolic: d, pulse: p !== null && validPulse(p) ? p : null }, confidence: 0.9, rawText: text };
    }
  }
  return null;
}

// Last resort for unlabeled stacked displays: the first two consecutive
// integers that look like systolic-then-diastolic, plus a third as pulse.
function parseUnlabeledBP(text: string): OCRResult | null {
  const nums = [...text.matchAll(/\b\d{2,3}\b/g)].map(m => parseInt(m[0], 10));
  for (let i = 0; i + 1 < nums.length; i++) {
    if (validBP(nums[i], nums[i + 1])) {
      const p = nums[i + 2];
      return {
        parameterType: 'bp',
        values: { systolic: nums[i], diastolic: nums[i + 1], pulse: p !== undefined && validPulse(p) ? p : null },
        confidence: 0.7,
        rawText: text,
      };
    }
  }
  return null;
}

export function parseTextForReading(text: string): OCRResult {
  const lowered = text.toLowerCase();

  const bp = parseBP(lowered);
  if (bp) return { ...bp, rawText: text };

  const glucoseRegex = /(\d{2,3}(?:\.\d+)?)(?:\s*(?:mg\/dl|mg dl|mgdl))|\b(\d{1,2}\.?\d?)\s*(?:mmol\/l|mmol)/i;
  const gMatch = lowered.match(glucoseRegex);
  if (gMatch) {
    if (gMatch[1]) {
      return { parameterType: 'glucose', values: { value: parseFloat(gMatch[1]), unit: 'mg/dL' }, confidence: 0.85, rawText: text };
    }
    if (gMatch[2]) {
      return { parameterType: 'glucose', values: { value: parseFloat(gMatch[2]), unit: 'mmol/L' }, confidence: 0.78, rawText: text };
    }
  }

  const loose = parseUnlabeledBP(lowered);
  if (loose) return { ...loose, rawText: text };

  return { parameterType: 'unknown', values: { rawText: text }, confidence: 0.12, rawText: text };
}

export default { parseTextForReading };
