import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const LOG_PATH = FileSystem.documentDirectory + 'healthdiary_logs.txt';

export async function appendLog(line: string) {
  const ts = new Date().toISOString();
  await FileSystem.writeAsStringAsync(LOG_PATH, `${ts} ${line}\n`, { append: true });
}

export async function exportDiagnostics() {
  try {
    const exists = await FileSystem.getInfoAsync(LOG_PATH);
    if (!exists.exists) {
      await FileSystem.writeAsStringAsync(LOG_PATH, 'No diagnostics available.');
    }
    await Sharing.shareAsync(LOG_PATH);
  } catch (e) {
    console.error('Export diagnostics failed', e);
  }
}
