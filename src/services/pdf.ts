import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ageFromDOB,
  ageInMonthsFromDOB,
  fieldClassification,
  clinicalColorKey,
  yAxisConfigFor,
  buildChartSeriesList,
  computeChartXDomain,
  RangeKey,
} from './utils';
import { fetchParameterTypes } from './parameterRegistry';
import { colors, chartSeriesColors } from '../theme/tokens';

const CHART_SERIES_COLORS: readonly string[] = chartSeriesColors;

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

// Evenly-spaced 5-tick Y domain padded ~15% around the data, used for any type
// without a fixed axis (see yAxisConfigFor) — mirrors what Victory's auto-domain
// does on screen, since expo-print's static HTML can't call into Victory itself.
function autoYDomain(values: number[]): { min: number; max: number; ticks: number[] } {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const pad = (dataMax - dataMin) * 0.15 || Math.max(1, Math.abs(dataMax) * 0.1);
  const min = dataMin - pad;
  const max = dataMax + pad;
  const step = (max - min) / 4;
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(min + i * step));
  return { min, max, ticks };
}

// SVG path for a monotone cubic spline through `points` (sorted by x) — the same
// curve family as Victory's interpolation="monotoneX" (both implement the
// Fritsch-Carlson method), so the PDF's line matches the smooth curve shown
// on-screen instead of drawing straight segments between dots.
function monotoneCubicPath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n < 3) return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dxi = points[i + 1].x - points[i].x;
    const dyi = points[i + 1].y - points[i].y;
    dx.push(dxi);
    slopes.push(dxi === 0 ? 0 : dyi / dxi);
  }

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const m0 = slopes[i - 1];
    const m1 = slopes[i];
    if (m0 * m1 <= 0) {
      tangents[i] = 0;
    } else {
      const w0 = 2 * dx[i] + dx[i - 1];
      const w1 = dx[i] + 2 * dx[i - 1];
      tangents[i] = (w0 + w1) / (w0 / m0 + w1 / m1);
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dxi = dx[i];
    const cp1x = p0.x + dxi / 3;
    const cp1y = p0.y + (tangents[i] * dxi) / 3;
    const cp2x = p1.x - dxi / 3;
    const cp2y = p1.y - (tangents[i + 1] * dxi) / 3;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p1.x} ${p1.y}`;
  }
  return d;
}

// Hand-rolled SVG mirror of ReadingsChart (ChartScreen/ReportScreen) — expo-print
// renders static HTML, not React Native views, so Victory can't be reused directly
// here. Draws from the same buildChartSeriesList/computeChartXDomain/
// yAxisConfigFor/fieldClassification helpers as the on-screen chart so the axes,
// series split, and per-point clinical coloring all match what's shown in-app,
// rather than drifting into a second, differently-behaving implementation.
function renderChartSVG(typeDef: any, items: any[], range: RangeKey, ageInMonths: number | undefined): string {
  if (!typeDef || items.length === 0) return '';
  const chartSeriesList = buildChartSeriesList(typeDef, items);
  if (chartSeriesList.length === 0) return '';

  const width = 680;
  const height = 280;
  const margin = { top: 12, right: 16, bottom: 30, left: 46 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const { x0, x1, tickCount: xTickCount } = computeChartXDomain(items, range);
  const x0t = x0.getTime();
  const x1t = x1.getTime();

  const fixedY = yAxisConfigFor(typeDef.id);
  let yMin: number, yMax: number, yTicks: number[];
  if (fixedY) {
    [yMin, yMax] = fixedY.domain;
    yTicks = fixedY.tickValues;
  } else {
    const allY = chartSeriesList.flatMap(s => s.readings.map((r: any) => Number(r.vals[s.fieldKey])).filter((v: number) => !isNaN(v)));
    const d = autoYDomain(allY);
    yMin = d.min; yMax = d.max; yTicks = d.ticks;
  }

  const xScale = (t: number) => margin.left + ((t - x0t) / ((x1t - x0t) || 1)) * plotW;
  const yScale = (v: number) => margin.top + plotH - ((v - yMin) / ((yMax - yMin) || 1)) * plotH;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  yTicks.forEach(tv => {
    const y = yScale(tv);
    svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="${colors.border}" stroke-width="1"/>`;
    svg += `<text x="${margin.left - 8}" y="${y + 3}" font-size="9" fill="${colors.textMuted}" text-anchor="end">${tv}</text>`;
  });

  const xTickTimes = Array.from({ length: xTickCount }, (_, i) => x0t + (i * (x1t - x0t)) / Math.max(1, xTickCount - 1));
  xTickTimes.forEach(t => {
    const x = xScale(t);
    const d = new Date(t);
    const label = range === 'today' || range === 'yesterday'
      ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    svg += `<text x="${x}" y="${height - margin.bottom + 14}" font-size="9" fill="${colors.textMuted}" text-anchor="middle">${escapeHtml(label)}</text>`;
  });

  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="${colors.border}" stroke-width="1"/>`;
  svg += `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="${colors.border}" stroke-width="1"/>`;

  chartSeriesList.forEach((s, idx) => {
    const seriesColor = CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length];
    const pts = s.readings
      .map((r: any) => ({ t: new Date(r.recorded_at).getTime(), y: Number(r.vals[s.fieldKey]), reading: r }))
      .filter((p: any) => !isNaN(p.y))
      .sort((a: any, b: any) => a.t - b.t);
    if (pts.length >= 2) {
      const svgPoints = pts.map((p: any) => ({ x: xScale(p.t), y: yScale(p.y) }));
      svg += `<path d="${monotoneCubicPath(svgPoints)}" fill="none" stroke="${seriesColor}" stroke-width="2"/>`;
    }
    pts.forEach((p: any) => {
      const cls = fieldClassification(typeDef.id, s.fieldKey, p.reading.vals, ageInMonths);
      const dotColor = cls ? colors[clinicalColorKey(cls)] : seriesColor;
      svg += `<circle cx="${xScale(p.t)}" cy="${yScale(p.y)}" r="3" fill="${dotColor}"/>`;
    });
  });

  svg += `</svg>`;

  if (chartSeriesList.length > 1) {
    const legendItems = chartSeriesList
      .map((s, idx) => `<span class="legend-item"><span class="legend-dot" style="background:${CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length]}"></span>${escapeHtml(s.label)}</span>`)
      .join('');
    svg += `<div class="legend">${legendItems}</div>`;
  }

  return svg;
}

// Mirrors the on-screen table preview in ReportScreen — same registry-driven field
// labels and clinical color-coding, rendered to HTML for expo-print instead of RN Views.
// Returns the generated file's URI rather than sharing it directly — generating and
// sharing are two separate user actions (see ReportScreen), so a share-step failure
// (the OS share sheet, a flaky file provider) doesn't also wipe out a PDF that was
// actually generated successfully.
export async function generateReportPDF(profile: any, readings: any[], parameterFilter: string[] = [], range: RangeKey = '30'): Promise<string> {
  const types = await fetchParameterTypes();

  const grouped: Record<string, any[]> = {};
  readings.forEach(r => {
    if (parameterFilter.length && !parameterFilter.includes(r.parameter_type_id)) return;
    grouped[r.parameter_type_id] = grouped[r.parameter_type_id] || [];
    grouped[r.parameter_type_id].push(r);
  });
  Object.values(grouped).forEach(list => list.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()));

  const age = ageFromDOB(profile.date_of_birth);
  const ageInMonths = ageInMonthsFromDOB(profile.date_of_birth) ?? undefined;
  const dates = readings.map(r => new Date(r.recorded_at).getTime());
  const rangeLabel = dates.length ? `${new Date(Math.min(...dates)).toLocaleDateString()} – ${new Date(Math.max(...dates)).toLocaleDateString()}` : 'No readings in range';

  let body = `
    <h1>${escapeHtml(profile.name)}${age !== null ? ` (${age} years old)` : ''}</h1>
    <p class="meta">${escapeHtml(rangeLabel)} &middot; Generated ${escapeHtml(new Date().toLocaleString())}</p>
  `;

  for (const [ptypeId, items] of Object.entries(grouped)) {
    const typeDef = types.find(t => t.id === ptypeId);
    const fields = typeDef ? typeDef.field_definitions : [];
    const svg = renderChartSVG(typeDef, items, range, ageInMonths);

    body += `<h2>${escapeHtml(typeDef?.display_name ?? ptypeId)}</h2>`;
    if (svg) body += svg;
    body += `<table><thead><tr><th>Date</th><th>Time</th>${fields.map((f: any) => `<th>${escapeHtml(f.label)}</th>`).join('')}</tr></thead><tbody>`;
    items.forEach((it: any) => {
      const d = new Date(it.recorded_at);
      body += `<tr><td>${escapeHtml(d.toLocaleDateString())}</td><td>${escapeHtml(d.toLocaleTimeString())}</td>`;
      fields.forEach((f: any) => {
        const val = it.vals[f.key];
        const hasValue = val !== undefined && val !== '';
        const display = hasValue
          ? (f.dataType !== 'numeric' ? (f.optionShortLabels?.[val] ?? f.optionLabels?.[val] ?? String(val)) : String(val))
          : '—';
        const cls = f.dataType === 'numeric' ? fieldClassification(ptypeId, f.key, it.vals, ageInMonths) : null;
        const cellColor = cls ? colors[clinicalColorKey(cls)] : null;
        const cellStyle = cellColor ? ` style="color:${cellColor};font-weight:700"` : '';
        body += `<td${cellStyle}>${escapeHtml(display)}</td>`;
      });
      body += `</tr>`;
    });
    body += `</tbody></table>`;
  }

  const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, Roboto, Helvetica, sans-serif; color: ${colors.text}; padding: 24px; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .meta { color: ${colors.textMuted}; font-size: 12px; margin: 0 0 20px; }
      h2 { font-size: 16px; margin: 28px 0 8px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid ${colors.border}; }
      th { color: ${colors.textMuted}; text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em; }
      .legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 4px 0 8px; font-size: 11px; color: ${colors.textMuted}; }
      .legend-item { display: inline-flex; align-items: center; gap: 4px; }
      .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    </style>
  </head><body>${body}</body></html>`;

  // expo-print writes into its own internal output directory, which Expo Go's
  // FileProvider doesn't expose to expo-sharing — sharing that uri directly fails
  // with "Not allowed to read file under given URL". Copying that uri via
  // FileSystem.copyAsync right after generation also failed ("pdf is not
  // readable") — Android's print spooler apparently hasn't released the file yet
  // when printToFileAsync resolves. Requesting base64 output instead sidesteps
  // that race entirely: the base64 string is part of the same completed
  // operation, not a second read of a file that may still be settling. Every
  // other shareFile() call site (export, backup) writes straight into
  // FileSystem.cacheDirectory, which is covered by the FileProvider, so write
  // the decoded PDF there.
  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  const destination = FileSystem.cacheDirectory + 'healthdiary_report.pdf';
  await FileSystem.writeAsStringAsync(destination, base64!, { encoding: FileSystem.EncodingType.Base64 });
  return destination;
}

// A plain .txt export of the recovery key ran into the same class of problem
// the old .hdb backup extension did — some share targets don't treat it as a
// proper attachment/document. PDF is universally recognized and previewable,
// and still keeps the key selectable/copyable text (not an image) in any PDF
// viewer, so it can be typed back in or copy-pasted during restore.
export async function generateRecoveryKeyPDF(recoveryKey: string): Promise<string> {
  const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, Roboto, Helvetica, sans-serif; color: ${colors.text}; padding: 32px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .meta { color: ${colors.textMuted}; font-size: 12px; margin: 0 0 24px; }
      .key { font-family: 'Courier New', monospace; font-size: 22px; letter-spacing: 0.04em; font-weight: 700;
             background: ${colors.background}; border: 1px solid ${colors.border}; border-radius: 8px;
             padding: 20px; word-break: break-all; }
      .warning { margin-top: 24px; font-size: 13px; color: ${colors.text}; }
    </style>
  </head><body>
    <h1>Health Diary — Recovery Key</h1>
    <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</p>
    <div class="key">${escapeHtml(recoveryKey)}</div>
    <p class="warning">Keep this somewhere safe and private. It's required to restore your encrypted backup on another device, and it can't be recovered if lost.</p>
  </body></html>`;

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  const destination = FileSystem.cacheDirectory + 'healthdiary_recovery_key.pdf';
  await FileSystem.writeAsStringAsync(destination, base64!, { encoding: FileSystem.EncodingType.Base64 });
  return destination;
}
