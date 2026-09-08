import * as SecureStore from 'expo-secure-store';

const BACKUP_REMINDER_KEY = 'backup_reminder_days';

export async function getBackupReminderDays(): Promise<number> {
  try {
    const v = await SecureStore.getItemAsync(BACKUP_REMINDER_KEY);
    if (!v) return 30;
    const n = parseInt(v, 10);
    return isNaN(n) ? 30 : n;
  } catch { return 30; }
}

export async function setBackupReminderDays(days: number) {
  await SecureStore.setItemAsync(BACKUP_REMINDER_KEY, String(days));
}
