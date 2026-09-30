jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import { persistAndRecordPdf, fetchPdfHistory, deletePdfHistoryEntry, clearPdfHistory } from '../src/services/pdfHistory';

const { __fakeDb } = require('../__mocks__/fakeDb');
const FileSystem = require('expo-file-system');

describe('pdfHistory (PAYWALL-SPEC §6 — Pro/Premium report history)', () => {
  beforeEach(() => {
    __fakeDb._reset();
    FileSystem.copyAsync.mockClear();
    FileSystem.deleteAsync.mockClear();
    FileSystem.getInfoAsync.mockImplementation(async () => ({ exists: true }));
  });

  test('persistAndRecordPdf copies the source file and indexes it', async () => {
    const record = await persistAndRecordPdf('/tmp/generated.pdf', {
      profileIds: ['p1'],
      dateRange: 'Jan 1 – Jan 31',
      type: 'single',
    });

    expect(FileSystem.copyAsync).toHaveBeenCalledWith(expect.objectContaining({ from: '/tmp/generated.pdf' }));
    expect(record.profile_ids).toEqual(['p1']);
    expect(record.type).toBe('single');

    const history = await fetchPdfHistory();
    expect(history.map(h => h.id)).toEqual([record.id]);
  });

  test('fetchPdfHistory returns newest first', async () => {
    const first = await persistAndRecordPdf('/tmp/a.pdf', { profileIds: ['p1'], dateRange: null, type: 'single' });
    const second = await persistAndRecordPdf('/tmp/b.pdf', { profileIds: ['p1'], dateRange: null, type: 'single' });

    const history = await fetchPdfHistory();
    expect(history[0].id).toBe(second.id);
    expect(history[1].id).toBe(first.id);
  });

  test('deletePdfHistoryEntry removes the row and the underlying file', async () => {
    const record = await persistAndRecordPdf('/tmp/a.pdf', { profileIds: ['p1'], dateRange: null, type: 'single' });

    await deletePdfHistoryEntry(record.id);

    expect(await fetchPdfHistory()).toEqual([]);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(record.file_path, expect.anything());
  });

  test('clearPdfHistory removes every entry', async () => {
    await persistAndRecordPdf('/tmp/a.pdf', { profileIds: ['p1'], dateRange: null, type: 'single' });
    await persistAndRecordPdf('/tmp/b.pdf', { profileIds: ['p1'], dateRange: null, type: 'single' });

    await clearPdfHistory();

    expect(await fetchPdfHistory()).toEqual([]);
  });
});
