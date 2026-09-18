import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

// Wraps expo-sharing's shareAsync so a share failure (declined by the OS share
// sheet, file provider rejecting the URL, no share target installed, etc.) shows
// a friendly message instead of surfacing as an unhandled promise rejection.
export async function shareFile(uri: string, dialogTitle?: string, mimeType?: string): Promise<boolean> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing not available', 'This device cannot share files.');
      return false;
    }
    await Sharing.shareAsync(uri, { ...(dialogTitle ? { dialogTitle } : {}), ...(mimeType ? { mimeType } : {}) });
    return true;
  } catch (e: any) {
    Alert.alert('Could not share file', e?.message ?? 'Please try again.');
    return false;
  }
}
