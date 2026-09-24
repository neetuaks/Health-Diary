import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Reading a DocumentPicker-copied file with { encoding: UTF8 } rejects as
// "not readable" on Android — a long-standing, still-open expo bug
// (github.com/expo/expo/issues/21792). Its UTF8 text-reading code path hits
// a permission/visibility check the Base64 code path doesn't; reading as
// Base64 and decoding it ourselves is the community-confirmed workaround,
// reported working on both Android and iOS.
async function readAsUtf8WithRetries(uri: string, attempts = 5): Promise<string> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return Buffer.from(base64, 'base64').toString('utf8');
    } catch (err: any) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

// Returns null if the user cancelled the picker, the file content string
// otherwise. Throws on a genuine read failure.
export async function pickAndReadBackupFile(): Promise<string | null> {
  // copyToCacheDirectory: false deliberately — the picker's own internal copy
  // is exactly what's racy in expo/expo#21792 (it can return before the copy
  // has actually finished writing, so the "file" it hands back isn't readable
  // yet). Reading the picker's original URI directly, and doing our own copy
  // below only if that fails, sidesteps that race instead of retrying into it.
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  const pickedUri = res.assets[0].uri;

  try {
    return await readAsUtf8WithRetries(pickedUri);
  } catch (readErr: any) {
    // Fall back to an explicit copy into our own cache dir (awaited fully,
    // unlike the picker's internal one) and read that instead.
    try {
      const fallbackPath = `${FileSystem.cacheDirectory}restore_${Date.now()}.json`;
      await FileSystem.copyAsync({ from: pickedUri, to: fallbackPath });
      return await readAsUtf8WithRetries(fallbackPath);
    } catch {
      throw new Error(
        `${readErr?.message ?? 'Could not read the picked file.'} [uri: ${pickedUri}]. ` +
        "This can happen when picking a file straight out of a chat app's downloads. " +
        'Try saving it to your device\'s Downloads or Files app first, then pick it from there.'
      );
    }
  }
}
