import * as FileSystem from 'expo-file-system/legacy';

// Every backup gets a redundant copy written silently into the app's own
// private storage — a zero-config safety net, not a user-facing setting:
// there's no folder to pick, nothing to see in a file manager, nothing to
// configure, and nothing to show the user directly. This runs identically on
// iOS and Android (plain expo-file-system, nothing platform-specific), which
// is deliberate: the only other way a backup ever leaves this automatic copy
// is the explicit "Share / Save Backup" action, also identical on both
// platforms (the OS share sheet). It doubles as the source for automatic
// restore (see backup.ts's readLocalBackupCopy) on a device that already has
// one — the user never needs to know where it lives to use it.
const DEFAULT_LOCAL_DIR = FileSystem.documentDirectory + 'backups/';

export function localBackupPath(filename: string): string {
  return DEFAULT_LOCAL_DIR + filename;
}

async function writeLocalSafetyCopy(filename: string, content: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(DEFAULT_LOCAL_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DEFAULT_LOCAL_DIR, { intermediates: true });
  const path = localBackupPath(filename);
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

export interface WriteResult {
  local: { ok: boolean; error?: string };
}

// Not meant to be shown to the user (it's an invisible safety net) but the
// outcome is still returned so a failure there isn't silently swallowed
// forever.
export async function writeBackupToConfiguredDestinations(content: string, filename: string): Promise<WriteResult> {
  try {
    await writeLocalSafetyCopy(filename, content);
    return { local: { ok: true } };
  } catch (e: any) {
    return { local: { ok: false, error: e?.message ?? 'Unknown error' } };
  }
}
