import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ConsolidatedReportScreen from '../../src/screens/ConsolidatedReportScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }) }));

jest.mock('../../src/services/profileContext', () => ({ useProfile: jest.fn() }));
jest.mock('../../src/services/entitlement', () => ({ useEntitlement: jest.fn() }));
jest.mock('../../src/services/readingService', () => ({ fetchReadingsForProfile: jest.fn(async () => []) }));
jest.mock('../../src/services/profileParameterTypes', () => ({ fetchParameterTypesForProfile: jest.fn(async () => []) }));
jest.mock('../../src/services/pdf', () => ({
  generateReportPDF: jest.fn(async () => 'file:///single.pdf'),
  generateConsolidatedReportPDF: jest.fn(async () => 'file:///consolidated.pdf'),
}));
jest.mock('../../src/services/pdfHistory', () => ({
  persistAndRecordPdf: jest.fn(async (uri: string, entry: any) => ({ id: 'rec1', file_path: uri, ...entry })),
}));
jest.mock('../../src/services/pdfDownload', () => ({ downloadPdfToDevice: jest.fn(async () => ({ success: true })) }));

const { useProfile } = require('../../src/services/profileContext');
const { useEntitlement } = require('../../src/services/entitlement');
const { generateReportPDF, generateConsolidatedReportPDF } = require('../../src/services/pdf');
const { persistAndRecordPdf } = require('../../src/services/pdfHistory');
const { downloadPdfToDevice } = require('../../src/services/pdfDownload');

const ALICE = { id: 'p1', name: 'Alice' };
const BOB = { id: 'p2', name: 'Bob' };

describe('ConsolidatedReportScreen gating and generation (FAMILY-FEATURES-SPEC §2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useProfile.mockReturnValue({ profiles: [ALICE, BOB] });
  });

  test('Free/Pro (consolidatedReport: false) shows a locked upsell and never generates a PDF', async () => {
    useEntitlement.mockReturnValue({ limits: { consolidatedReport: false, historyWindowDays: null } });

    await render(<ConsolidatedReportScreen />);

    expect(await screen.findByText('Consolidated Report')).toBeTruthy();
    expect(screen.getByText('See Plans')).toBeTruthy();

    await fireEvent.press(screen.getByText('See Plans'));
    expect(mockNavigate).toHaveBeenCalledWith('Paywall');
    expect(generateConsolidatedReportPDF).not.toHaveBeenCalled();
    expect(generateReportPDF).not.toHaveBeenCalled();
  });

  test('Premium: both profiles pre-selected by default; generating calls the consolidated PDF and records type "consolidated" with both profileIds', async () => {
    useEntitlement.mockReturnValue({ limits: { consolidatedReport: true, historyWindowDays: null } });

    await render(<ConsolidatedReportScreen />);
    await screen.findByText('Alice');

    await fireEvent.press(screen.getByText('Generate & Download'));

    await waitFor(() => expect(generateConsolidatedReportPDF).toHaveBeenCalled());
    expect(generateReportPDF).not.toHaveBeenCalled();
    const [entries] = generateConsolidatedReportPDF.mock.calls[0];
    expect(entries.map((e: any) => e.profile.id).sort()).toEqual(['p1', 'p2']);

    expect(persistAndRecordPdf).toHaveBeenCalledWith('file:///consolidated.pdf', expect.objectContaining({
      type: 'consolidated',
      profileIds: expect.arrayContaining(['p1', 'p2']),
    }));
    expect(downloadPdfToDevice).toHaveBeenCalled();
  });

  test('deselecting down to a single profile uses the normal single-report PDF, recorded as type "single"', async () => {
    useEntitlement.mockReturnValue({ limits: { consolidatedReport: true, historyWindowDays: null } });

    await render(<ConsolidatedReportScreen />);
    await screen.findByText('Bob');
    await fireEvent.press(screen.getByText('Bob')); // deselect Bob, leaving only Alice

    await fireEvent.press(screen.getByText('Generate & Download'));

    await waitFor(() => expect(generateReportPDF).toHaveBeenCalled());
    expect(generateConsolidatedReportPDF).not.toHaveBeenCalled();
    expect(persistAndRecordPdf).toHaveBeenCalledWith('file:///single.pdf', expect.objectContaining({
      type: 'single',
      profileIds: ['p1'],
    }));
  });

  test('deselecting every profile disables Generate & Download, so no PDF can be produced', async () => {
    useEntitlement.mockReturnValue({ limits: { consolidatedReport: true, historyWindowDays: null } });

    await render(<ConsolidatedReportScreen />);
    await screen.findByText('Alice');
    await fireEvent.press(screen.getByText('Alice'));
    await fireEvent.press(screen.getByText('Bob'));

    await fireEvent.press(screen.getByText('Generate & Download'));

    expect(generateConsolidatedReportPDF).not.toHaveBeenCalled();
    expect(generateReportPDF).not.toHaveBeenCalled();
  });
});
