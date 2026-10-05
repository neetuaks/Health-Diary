import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { shareFile } from './share';
import { APP_NAME } from '../config/legal';

// PAYWALL-SPEC §6: "no in-app Share button" for the PDF report — the app saves
// the file the user owns, rather than opening the OS share sheet, reinforcing
// the local-only story. Android has a real no-share-sheet way to do that
// (Storage Access Framework, below); iOS does not — see the platform branch.
const SAF_DIR_KEY = 'pdf_download_saf_directory_uri';

// Requests the destination directory once (the user picks Downloads, or
// wherever they prefer) and remembers it via expo-secure-store — the same
// lightweight-settings use of SecureStore as appSettings.ts's backup reminder
// — so later downloads don't re-prompt every time.
async function getOrRequestDownloadDirectory(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(SAF_DIR_KEY);
  if (stored) return stored;
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  await SecureStore.setItemAsync(SAF_DIR_KEY, perm.directoryUri);
  return perm.directoryUri;
}

export type DownloadResult = { success: boolean; destinationUri?: string; message?: string };

// Saves a PDF already sitting at `sourceUri` (e.g. from generateReportPDF) to a
// location the user owns and can find outside the app.
//
// iOS has no first-class "let the user pick a Files destination" API in Expo/
// React Native without a custom native module — UIDocumentPickerViewController's
// export mode isn't exposed, only the share sheet (UIActivityViewController) is,
// via expo-sharing. Building that native module is out of scope here (no Mac to
// build or test one — see CLAUDE.md). So iOS falls back to the share sheet,
// whose own "Save to Files" destination gets the user to the same place; this
// is a known, deliberate gap from the spec's "no share sheet" ideal for iOS
// specifically, not an oversight.
export async function downloadPdfToDevice(sourceUri: string, filename: string): Promise<DownloadResult> {
  if (Platform.OS !== 'android') {
    const shared = await shareFile(sourceUri, `Save ${APP_NAME} Report`, 'application/pdf');
    return { success: shared, message: shared ? undefined : 'Save was cancelled.' };
  }

  const dirUri = await getOrRequestDownloadDirectory();
  if (!dirUri) {
    return { success: false, message: 'Storage permission was not granted, so the PDF could not be saved.' };
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
    const nameWithoutExt = filename.replace(/\.pdf$/i, '');
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(dirUri, nameWithoutExt, 'application/pdf');
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { success: true, destinationUri: destUri };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Could not save the PDF.' };
  }
}
