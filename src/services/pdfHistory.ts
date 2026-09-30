import { v4 as uuidv4 } from 'uuid';
import * as FileSystem from 'expo-file-system/legacy';
import { getDB } from '../db/init';

// Local index of generated PDF reports (PAYWALL-SPEC §6, Pro/Premium only).
// The PDFs themselves live in the app document directory (not the cache
// directory generateReportPDF writes its working copy to — cache can be
// cleared by the OS at any time, which would silently break "Report History");
// this table tracks where and what they are so ReportHistoryScreen can list,
// re-open, re-download and delete them. Nothing here syncs anywhere.
export type PdfReportType = 'single' | 'consolidated';

export type PdfReportRecord = {
  id: string;
  generated_at: string;
  profile_ids: string[];
  date_range: string | null;
  file_path: string;
  type: PdfReportType;
};

const REPORTS_DIR = FileSystem.documentDirectory + 'reports/';

// Copies a just-generated PDF (generateReportPDF's cache-directory output) into
// the persistent reports directory and records it in one call — the two only
// ever happen together (a report is never persisted without being indexed, or
// vice versa), so there's no in-between state where a file exists un-indexed
// or a row points at a file that was never actually copied.
export async function persistAndRecordPdf(
  sourceUri: string,
  entry: { profileIds: string[]; dateRange: string | null; type: PdfReportType }
): Promise<PdfReportRecord> {
  const dirInfo = await FileSystem.getInfoAsync(REPORTS_DIR);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });

  const id = uuidv4();
  const filePath = REPORTS_DIR + id + '.pdf';
  await FileSystem.copyAsync({ from: sourceUri, to: filePath });

  const record: PdfReportRecord = {
    id,
    generated_at: new Date().toISOString(),
    profile_ids: entry.profileIds,
    date_range: entry.dateRange,
    file_path: filePath,
    type: entry.type,
  };
  const db = getDB();
  await db.runAsync(
    'INSERT INTO pdf_reports (id, generated_at, profile_ids, date_range, file_path, type) VALUES (?,?,?,?,?,?);',
    [record.id, record.generated_at, JSON.stringify(record.profile_ids), record.date_range, record.file_path, record.type]
  );
  return record;
}

export async function fetchPdfHistory(): Promise<PdfReportRecord[]> {
  const db = getDB();
  const rows = await db.getAllAsync<any>('SELECT * FROM pdf_reports ORDER BY generated_at DESC;');
  return rows.map((r: any) => ({ ...r, profile_ids: JSON.parse(r.profile_ids) })) as PdfReportRecord[];
}

// Removes both the index row and the underlying file. Best-effort on the file
// itself — a missing/already-gone file shouldn't block clearing the row, since
// the row is what the user actually sees and is asking to remove.
export async function deletePdfHistoryEntry(id: string): Promise<void> {
  const db = getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM pdf_reports WHERE id = ?;', [id]);
  await db.runAsync('DELETE FROM pdf_reports WHERE id = ?;', [id]);
  if (row?.file_path) {
    try {
      const info = await FileSystem.getInfoAsync(row.file_path);
      if (info.exists) await FileSystem.deleteAsync(row.file_path, { idempotent: true });
    } catch {
      // best-effort — see doc comment above
    }
  }
}

export async function clearPdfHistory(): Promise<void> {
  const entries = await fetchPdfHistory();
  for (const entry of entries) {
    await deletePdfHistoryEntry(entry.id);
  }
}
