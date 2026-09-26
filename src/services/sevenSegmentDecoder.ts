/**
 * Seven-segment LCD digit decoder — a pixel pipeline (deskew -> threshold ->
 * connected components -> structural digit grouping -> segment classification)
 * that reads the *digits* on a BP monitor or glucometer's LCD, complementing
 * the native ML Kit/Vision text recognizer which reads printed labels
 * (SYS/DIA/PULSE/mg/dL) fine but misreads seven-segment digit shapes.
 *
 * Status: prototype, proven against the 4 real photos committed under
 * docs/ocr-samples/ (4/4 fully correct) but only 3/12 on a broader
 * crowdsourced sample of other device brands/fonts — see docs/PHOTO-GUIDE.md.
 * Not yet wired into src/services/ocr.ts's result fusion.
 */
import { decode as jpegDecode } from 'jpeg-js';

type Point = { x: number; y: number };
type BBox = { x0: number; y0: number; x1: number; y1: number; w: number; h: number };
type Blob = { pts: Point[]; b: BBox; rb: BBox; edgePts: Point[]; t: number };
type LineGroup = { pts: Point[]; b: BBox; t: number };
type Axis = { vx: number; vy: number; n: number; elongated: boolean };
type ClassifyResult = { digit: string | null; pattern: string };
export type DecodedRow = { text: string; heightPx: number; yCenter: number };

// ---------- image helpers ----------
function luminance(img: { width: number; height: number; data: Uint8Array }): Float32Array {
  const { width, height, data } = img;
  const L = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) L[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return L;
}

function integral(src: Float32Array, w: number, h: number, square: boolean): Float64Array {
  const iw = w + 1;
  const I = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const v = src[y * w + x];
      s += square ? v * v : v;
      I[(y + 1) * iw + x + 1] = I[y * iw + x + 1] + s;
    }
  }
  return I;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const I = integral(src, w, h, false);
  const iw = w + 1;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      out[y * w + x] = (I[y1 * iw + x1] - I[y0 * iw + x1] - I[y1 * iw + x0] + I[y0 * iw + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

// Sauvola: T = m * (1 + k * (s/R - 1)). Adapts to both local brightness and local contrast,
// so digits in a shadowed corner of the LCD (low m, low contrast) still binarize.
// Only low-saturation (grey) pixels count: LCD panels and their segments are grey, while
// the surrounding bezel is often strongly coloured. Letting the bezel into a window that
// straddles the panel edge skews the local mean/std and wipes out low-contrast digits
// sitting in a shadowed corner next to it.
function sauvola(L: Float32Array, w: number, h: number, r: number, k: number, valid: Uint8Array): Uint8Array {
  const Lv = new Float32Array(w * h), V = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) if (valid[i]) { Lv[i] = L[i]; V[i] = 1; }
  const I = integral(Lv, w, h, false), I2 = integral(Lv, w, h, true), IV = integral(V, w, h, false);
  const iw = w + 1;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      if (!valid[y * w + x]) continue;
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const n = IV[y1 * iw + x1] - IV[y0 * iw + x1] - IV[y1 * iw + x0] + IV[y0 * iw + x0];
      if (n < 1) continue;
      const s1 = I[y1 * iw + x1] - I[y0 * iw + x1] - I[y1 * iw + x0] + I[y0 * iw + x0];
      const s2 = I2[y1 * iw + x1] - I2[y0 * iw + x1] - I2[y1 * iw + x0] + I2[y0 * iw + x0];
      const m = s1 / n;
      const sd = Math.sqrt(Math.max(0, s2 / n - m * m));
      if (L[y * w + x] < m * (1 + k * (sd / 128 - 1))) mask[y * w + x] = 1;
    }
  }
  return mask;
}

// Dominant edge orientation from a magnitude-weighted gradient-angle histogram. Horizontal
// bars (top/middle/bottom segments) give a strong peak ~90deg; its offset is the photo's
// rotation. Doesn't depend on segmenting anything first.
function estimateRotation(L: Float32Array, w: number, h: number): number {
  const hist = new Float64Array(180);
  const mags: number[] = [];
  const gxA = new Float32Array(w * h), gyA = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = (L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - 1] + L[i + w - 1]);
    const gy = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - w] + L[i - w + 1]);
    gxA[i] = gx; gyA[i] = gy;
    mags.push(Math.hypot(gx, gy));
  }
  const sorted = Float32Array.from(mags).sort();
  const cut = sorted[Math.floor(sorted.length * 0.9)];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const m = Math.hypot(gxA[i], gyA[i]);
    if (m < cut) continue;
    let a = (Math.atan2(gyA[i], gxA[i]) * 180) / Math.PI;
    a = ((a % 180) + 180) % 180;
    hist[Math.floor(a) % 180] += m;
  }
  const smooth = new Float64Array(180);
  for (let a = 0; a < 180; a++) for (let d = -3; d <= 3; d++) smooth[a] += hist[(a + d + 180) % 180];
  let best = 90, bestV = -1;
  for (let a = 50; a <= 130; a++) if (smooth[a] > bestV) { bestV = smooth[a]; best = a; }
  return best - 90; // degrees
}

// ---------- connected components ----------
function components(mask: Uint8Array, w: number, h: number, minArea: number): number[][] {
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  const comps: number[][] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    const id = comps.length;
    let sp = 0; stack[sp++] = start; label[start] = id;
    const pix: number[] = [];
    while (sp) {
      const i = stack[--sp];
      pix.push(i);
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (mask[j] && label[j] === -1) { label[j] = id; stack[sp++] = j; }
      }
    }
    comps.push(pix);
  }
  return comps.filter(p => p.length >= minArea);
}

// ---------- geometry ----------
function bbox(pts: Point[]): BBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function rectGap(a: BBox, b: BBox): number {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
  const dy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
  return Math.hypot(dx, dy);
}

// Stroke thickness of a blob ~ 2 * area / perimeter — holds for a single bar and for a
// whole-digit blob alike, unlike min(bbox w, h).
function thickness(pixIdx: number[], maskSet: Set<number>, w: number): number {
  let perim = 0;
  for (const i of pixIdx) {
    if (!maskSet.has(i - 1) || !maskSet.has(i + 1) || !maskSet.has(i - w) || !maskSet.has(i + w)) perim++;
  }
  return (2 * pixIdx.length) / Math.max(1, perim);
}

// ---------- classification ----------
const LOOKUP: Record<string, string> = {
  '1110111': '0', '0010010': '1', '1011101': '2', '1011011': '3', '0111010': '4',
  '1101011': '5', '1101111': '6', '1010010': '7', '1111111': '8', '1111011': '9',
  // Common 7-segment font variants: "7" with a top-left serif segment (this Omron font),
  // "9" without its bottom bar, "6" without its top bar.
  '1110010': '7', '1111010': '9', '0101111': '6',
};

// A bin counts as "hit" only if it holds a real stroke's worth of ink (~a third of stroke
// thickness per pixel of bin width) — a 1-2px scratch across the LCD, or JPEG speckle,
// otherwise reads as a solid segment.
function coverage(pts: Point[], x0: number, x1: number, y0: number, y1: number, horizontal: boolean, strokeT: number, bins = 12): number {
  const span = horizontal ? x1 - x0 : y1 - y0;
  if (span <= 0) return 0;
  const hits = new Uint32Array(bins);
  for (const p of pts) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    const v = horizontal ? p.x - x0 : p.y - y0;
    hits[Math.min(bins - 1, Math.floor((v / span) * bins))]++;
  }
  const need = Math.max(2, 0.3 * strokeT * (span / bins));
  let n = 0; for (const c of hits) if (c >= need) n++;
  return n / bins;
}

function classify(pts: Point[], b: BBox, strokeT: number): ClassifyResult {
  if (b.w < 0.35 * b.h) return { digit: '1', pattern: 'narrow' };
  const fx = (f: number) => b.x0 + f * b.w, fy = (f: number) => b.y0 + f * b.h;
  const regions: [string, number, number, number, number, boolean][] = [
    ['top', fx(0.2), fx(0.8), fy(0), fy(0.2), true],
    ['topLeft', fx(0), fx(0.3), fy(0.22), fy(0.42), false],
    ['topRight', fx(0.7), fx(1), fy(0.22), fy(0.42), false],
    ['middle', fx(0.2), fx(0.8), fy(0.4), fy(0.6), true],
    ['bottomLeft', fx(0), fx(0.3), fy(0.58), fy(0.78), false],
    ['bottomRight', fx(0.7), fx(1), fy(0.58), fy(0.78), false],
    ['bottom', fx(0.2), fx(0.8), fy(0.8), fy(1), true],
  ];
  const cov = regions.map(([, x0, x1, y0, y1, hz]) => coverage(pts, x0, x1, y0, y1, hz, strokeT));
  const pattern = cov.map(c => (c >= 0.5 ? '1' : '0')).join('');
  return { digit: LOOKUP[pattern] ?? null, pattern };
}

// ---------- structural digit grouping within one line ----------
// Every digit except "1" has at least one horizontal bar (top/middle/bottom) spanning its
// width, so bars define digit columns; each vertical stroke joins the column it overlaps in
// x. Strokes overlapping no bar column (a "1", or a whole-digit blob) cluster on their own.
function columnsForLine(allLineBlobs: Blob[], lineH: number): LineGroup[] {
  // Real segments in a line share a consistent stroke thickness; much thinner blobs are
  // scratches on the LCD glass, icon outlines (e.g. the heart/ECG trace), or edge debris.
  const byT = [...allLineBlobs].sort((a, b) => a.t - b.t);
  const totN = byT.reduce((s, bl) => s + bl.pts.length, 0);
  let acc = 0, medT = byT.length ? byT[0].t : 0;
  for (const bl of byT) { acc += bl.pts.length; if (acc >= totN / 2) { medT = bl.t; break; } }
  const lineBlobs = allLineBlobs.filter(bl => bl.t >= 0.5 * medT);
  const xOverlap = (a: { x0: number; x1: number }, b: BBox) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const isBar = (bl: Blob) => bl.b.w >= 0.9 * bl.b.h && bl.b.w >= 0.15 * lineH;
  type Col = { x0: number; x1: number; members: Blob[] };
  const cols: Col[] = [];
  for (const bl of lineBlobs.filter(isBar).sort((a, b) => a.b.x0 - b.b.x0)) {
    const col = cols.find(c => xOverlap(c, bl.b) >= 0.4 * Math.min(c.x1 - c.x0, bl.b.w));
    if (col) { col.members.push(bl); col.x0 = Math.min(col.x0, bl.b.x0); col.x1 = Math.max(col.x1, bl.b.x1); }
    else cols.push({ x0: bl.b.x0, x1: bl.b.x1, members: [bl] });
  }
  const orphans: Blob[] = [];
  for (const bl of lineBlobs.filter(bl => !isBar(bl))) {
    let best: Col | null = null, bestOv = 0;
    for (const c of cols) { const ov = xOverlap(c, bl.b); if (ov > bestOv) { bestOv = ov; best = c; } }
    if (best) best.members.push(bl); else orphans.push(bl);
  }
  const orphanCols: Col[] = [];
  for (const bl of orphans.sort((a, b) => a.b.x0 - b.b.x0)) {
    const col = orphanCols.find(c => xOverlap(c, bl.b) > 0);
    if (col) { col.members.push(bl); col.x0 = Math.min(col.x0, bl.b.x0); col.x1 = Math.max(col.x1, bl.b.x1); }
    else orphanCols.push({ x0: bl.b.x0, x1: bl.b.x1, members: [bl] });
  }
  return [...cols, ...orphanCols].map(c => {
    const pts = c.members.flatMap(m => m.pts);
    // Area-weighted median stroke thickness of the column's blobs.
    const ts = c.members.map(m => [m.t, m.pts.length] as [number, number]).sort((a, b) => a[0] - b[0]);
    let acc2 = 0, half = pts.length / 2, t = ts.length ? ts[0][0] : 0;
    for (const [tv, n] of ts) { acc2 += n; if (acc2 >= half) { t = tv; break; } }
    return { pts, b: bbox(pts), t };
  });
}

function weightedMedian(pairs: [number, number][]): number {
  if (pairs.length < 2) return 0;
  pairs.sort((a, b) => a[0] - b[0]);
  const tot = pairs.reduce((s, [, n]) => s + n, 0);
  let acc = 0; for (const [v, n] of pairs) { acc += n; if (acc >= tot / 2) return v; }
  return 0;
}

// Rows shorter than 0.4x the tallest row are dropped (small date-stamp rows next to a
// glucometer's big reading, stray icons, etc.) — pure geometry, no label-text dependence.
export function filterRowsByHeight(rows: DecodedRow[]): DecodedRow[] {
  const tallest = Math.max(0, ...rows.map(r => r.heightPx));
  return rows.filter(r => r.heightPx >= 0.4 * tallest).sort((a, b) => a.yCenter - b.yCenter);
}

// ---------- pipeline ----------
function decode(buf: Uint8Array): { rotDeg: number; rows: DecodedRow[] } {
  const img = jpegDecode(buf, { useTArray: true });
  const { width: w, height: h } = img;
  const minDim = Math.min(w, h);
  const L0 = luminance(img);
  const L = boxBlur(L0, w, h, Math.max(1, Math.round(minDim / 400)));
  const valid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    // Absolute chroma, not HSV saturation: (max-min)/max blows up for dark pixels, so the
    // near-black digit strokes themselves would read as "coloured" and get excluded.
    valid[i] = Math.max(r, g, b) - Math.min(r, g, b) < 55 ? 1 : 0;
  }
  // Washed-out photo (glare / overexposure): stretch contrast over the grey LCD pixels, but
  // only when the dynamic range is actually compressed, so normal photos are untouched.
  {
    const sample: number[] = [];
    for (let i = 0; i < w * h; i += 11) if (valid[i]) sample.push(L[i]);
    sample.sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.02)], hi = sample[Math.floor(sample.length * 0.98)];
    if (sample.length > 100 && hi - lo < 115 && hi - lo > 15) for (let i = 0; i < w * h; i++) L[i] = Math.min(255, Math.max(0, ((L[i] - lo) * 255) / (hi - lo)));
  }
  const mask = sauvola(L, w, h, Math.round(minDim * 0.08), 0.2, valid);

  const rotDeg = estimateRotation(L, w, h);
  const rot = (-rotDeg * Math.PI) / 180;
  const cx = w / 2, cy = h / 2, cos = Math.cos(rot), sin = Math.sin(rot);
  const tf = (i: number): Point => { const x = i % w - cx, y = ((i / w) | 0) - cy; return { x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }; };

  const minArea = Math.max(20, Math.round((minDim * 0.012) ** 2));
  const comps = components(mask, w, h, minArea);
  const maskSet = new Set<number>();
  for (const c of comps) for (const i of c) maskSet.add(i);

  // Drop the LCD bezel/frame and crop-edge debris: anything touching the crop border, or
  // a sparse outline (tiny area relative to its bounding box). Left in, the bezel's bbox
  // spans the whole panel and would "touch" — and swallow — every digit in the merge.
  const edge = Math.max(2, minDim * 0.005);
  const blobs: Blob[] = [];
  for (const c of comps) {
    const raw = bbox(c.map(i => ({ x: i % w, y: (i / w) | 0 })));
    if (raw.x0 <= edge || raw.y0 <= edge || raw.x1 >= w - 1 - edge || raw.y1 >= h - 1 - edge) continue;
    if (c.length / Math.max(1, (raw.w + 1) * (raw.h + 1)) < 0.15) continue;
    const pts = c.map(tf);
    const edgePts: Point[] = [];
    for (const i of c) {
      if (!maskSet.has(i - 1) || !maskSet.has(i + 1) || !maskSet.has(i - w) || !maskSet.has(i + w)) edgePts.push({ x: i % w, y: (i / w) | 0 });
    }
    blobs.push({ pts, b: bbox(pts), rb: raw, edgePts, t: thickness(c, maskSet, w) });
  }

  // Principal axis of each elongated blob (a single segment bar): unit direction + weight.
  const axes = (): Axis[] => blobs.map(bl => {
    const n = bl.pts.length;
    let mx = 0, my = 0; for (const p of bl.pts) { mx += p.x; my += p.y; } mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of bl.pts) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const tr = (sxx + syy) / 2, df = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
    const elongated = (tr + df) / Math.max(1e-9, tr - df) >= 2.5 * 2.5;
    return { vx: Math.cos(th), vy: Math.sin(th), n, elongated };
  });

  // Refine rotation from the horizontal bars themselves (the gradient histogram is ~1deg
  // coarse — enough to tilt a row 10-15px across the display and pull the small pulse
  // row's top half into the diastolic line). Italic shear doesn't affect horizontal bars.
  const residual = weightedMedian(axes().filter(a => a.elongated && Math.abs(a.vx) >= 0.85).map(a => [Math.atan(a.vy / a.vx), a.n]));
  if (residual) {
    const c2 = Math.cos(-residual), s2 = Math.sin(-residual);
    for (const bl of blobs) bl.pts = bl.pts.map(p => ({ x: cx + (p.x - cx) * c2 - (p.y - cy) * s2, y: cy + (p.x - cx) * s2 + (p.y - cy) * c2 }));
  }

  // Italic slant is a property of the font, so estimate it once from every elongated,
  // near-vertical stroke blob (principal-axis tilt, area-weighted median) and apply it
  // globally. A per-line search was unstable — it swung between -0.25 and +0.35 on the same
  // font, widening glyphs until a digit's right-hand strokes split off as a fake "1".
  const shear = weightedMedian(axes().filter(a => a.elongated && Math.abs(a.vy) >= 0.85).map(a => [a.vx / a.vy, a.n]));
  for (const bl of blobs) {
    bl.pts = bl.pts.map(p => ({ x: p.x - shear * (p.y - cy), y: p.y }));
    bl.b = bbox(bl.pts);
  }

  // Union-find merge of segment blobs into glyphs, by TRUE closest-pixel distance — not
  // bounding-box gap. This font's italic segments have bboxes full of empty corners, so two
  // neighbouring digits' bboxes can sit ~15px apart while their nearest actual pixels are
  // ~50px apart; intra-digit segment separators are genuinely small (<= ~0.3 stroke widths).
  const minPixelDist = (a: Point[], b: Point[], limit: number): number => {
    let best = Infinity;
    for (let i = 0; i < a.length; i += 2) {
      const p = a[i];
      for (let j = 0; j < b.length; j += 2) {
        const q = b[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d = dx * dx + dy * dy;
        if (d < best) { best = d; if (best <= limit * limit) return Math.sqrt(best); }
      }
    }
    return Math.sqrt(best);
  };
  const parent = blobs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < blobs.length; i++) for (let j = i + 1; j < blobs.length; j++) {
    const tau = 0.5 * Math.min(blobs[i].t, blobs[j].t);
    if (rectGap(blobs[i].rb, blobs[j].rb) > tau) continue;
    if (minPixelDist(blobs[i].edgePts, blobs[j].edgePts, tau) <= tau) parent[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  blobs.forEach((_bl, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(i); });
  const glyphs = [...groups.values()].map(idx => ({ idx, b: bbox(idx.flatMap(i => [
    { x: blobs[i].b.x0, y: blobs[i].b.y0 }, { x: blobs[i].b.x1, y: blobs[i].b.y1 },
  ])) }));

  // Lines: seeded by digit-shaped glyphs (tallest first), then any leftover fragment whose
  // vertical centre falls inside a line joins it. Fragments are kept at this stage on
  // purpose — the pixel-distance merge can split a digit (e.g. a "7", whose internal gap
  // where the middle bar would be is as wide as the gap to the next digit), and the
  // pieces are regrouped structurally per line below.
  const H = Math.max(w, h);
  type Glyph = { idx: number[]; b: BBox };
  const seeds = glyphs.filter(g => g.b.h > minDim * 0.04 && g.b.h < H * 0.6 && g.b.w / g.b.h < 1.4 && g.b.w / g.b.h > 0.06)
    .sort((a, b) => b.b.h - a.b.h);
  type Line = { idx: number[]; y0: number; y1: number; maxH: number };
  const lines: Line[] = [];
  const used = new Set<Glyph>();
  for (const g of seeds) {
    const line = lines.find(l => {
      const ov = Math.min(l.y1, g.b.y1) - Math.max(l.y0, g.b.y0);
      return ov > 0.5 * Math.min(l.y1 - l.y0, g.b.h);
    });
    if (line) { line.idx.push(...g.idx); line.y0 = Math.min(line.y0, g.b.y0); line.y1 = Math.max(line.y1, g.b.y1); line.maxH = Math.max(line.maxH, g.b.h); }
    else lines.push({ idx: [...g.idx], y0: g.b.y0, y1: g.b.y1, maxH: g.b.h });
    used.add(g);
  }
  for (const g of glyphs) {
    if (used.has(g) || g.b.h >= H * 0.6) continue;
    const yc = (g.b.y0 + g.b.y1) / 2;
    const line = lines.find(l => yc > l.y0 && yc < l.y1 && g.b.h < 1.1 * l.maxH);
    if (line) line.idx.push(...g.idx);
  }

  const out: DecodedRow[] = [];
  for (const line of lines) {
    const maxH = line.maxH;
    const gs = columnsForLine(line.idx.map(i => blobs[i]), maxH).filter(g => g.b.h >= 0.8 * maxH);
    const yMid = (line.y0 + line.y1) / 2;
    gs.sort((a, b) => a.b.x0 - b.b.x0);
    const res = gs.map(g => ({ g, c: classify(g.pts, g.b, g.t) }));
    const digits = res.filter(r => r.c.digit !== null);
    if (digits.length) out.push({ text: digits.map(r => r.c.digit).join(''), heightPx: maxH, yCenter: yMid });
  }
  return { rotDeg, rows: filterRowsByHeight(out) };
}

/**
 * Reads the digits off a photographed seven-segment LCD (BP monitor / glucometer),
 * top-to-bottom. Returns one entry per detected row of big-font digits — e.g. three
 * rows (SYS/DIA/PULSE) for a BP monitor, or one row for a glucometer once its smaller
 * date-stamp row has been filtered out by font size.
 */
export function decodeSevenSegmentRows(bytes: Uint8Array): DecodedRow[] {
  return decode(bytes).rows;
}
