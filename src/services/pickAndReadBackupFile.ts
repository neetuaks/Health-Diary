import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Returns null if the user cancelled the picker, the file content string
// otherwise. Throws on a genuine read failure.
export async function pickAndReadBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;

  // Reading a DocumentPicker-copied file with { encoding: UTF8 } rejects as
  // "not readable" on Android — a long-standing, still-open expo bug
  // (github.com/expo/expo/issues/21792). Its UTF8 text-reading code path hits
  // a permission/visibility check the Base64 code path doesn't; reading as
  // Base64 and decoding it ourselves is the community-confirmed workaround,
  // reported working on both Android and iOS.
  let content = '';
  let lastReadErr: any;
  const attempts = 5;
  for (let i = 0; i < attempts; i++) {
    try {
      const base64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      content = Buffer.from(base64, 'base64').toString('utf8');
      lastReadErr = null;
      break;
    } catch (readErr: any) {
      lastReadErr = readErr;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
    }
  }
  if (lastReadErr) {
    throw new Error(`${lastReadErr?.message ?? 'Could not read the picked file.'} [uri: ${res.assets[0].uri}]`);
  }
  return content;
}
