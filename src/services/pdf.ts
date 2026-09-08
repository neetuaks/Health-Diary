import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

function makeSimpleSVG(points: { x: number; y: number }[], width = 600, height = 200) {
  if (!points || points.length === 0) return '';
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const scaleX = (x:number) => ((x - minX) / (maxX - minX || 1)) * (width - 40) + 20;
  const scaleY = (y:number) => height - 20 - ((y - minY) / (maxY - minY || 1)) * (height - 40);
  const d = points.map((p,i) => `${i===0?'M':'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="#0077CC" stroke-width="2"/></svg>`;
}

export async function generateReportPDF(profile: any, readings: any[], parameterFilter: string[] = []) {
  // Build a simple HTML report with inline SVG charts for each parameter
  const grouped: Record<string, any[]> = {};
  readings.forEach(r => {
    if (parameterFilter.length && !parameterFilter.includes(r.parameter_type_id)) return;
    grouped[r.parameter_type_id] = grouped[r.parameter_type_id] || [];
    grouped[r.parameter_type_id].push(r);
  });

  let body = `<h1>${profile.name} — Report</h1><p>Generated: ${new Date().toLocaleString()}</p>`;
  for (const [ptype, items] of Object.entries(grouped)) {
    const points = items.map((it:any) => ({ x: new Date(it.recorded_at).getTime(), y: Number(Object.values(it.values)[0]) }));
    const svg = makeSimpleSVG(points);
    body += `<h2>${ptype}</h2>${svg}<ul>`;
    items.forEach((it:any) => { body += `<li>${new Date(it.recorded_at).toLocaleString()}: ${JSON.stringify(it.values)}</li>`; });
    body += `</ul>`;
  }

  const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${body}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri);
}
