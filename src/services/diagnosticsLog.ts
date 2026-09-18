import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import { shareFile } from './share';

const LOG_PATH = FileSystem.documentDirectory + 'healthdiary_logs.txt';

// Fill this in once a support inbox exists. Left blank for now — composeAsync
// still opens fine with no recipient pre-filled, the user just has to type one
// in themselves.
const SUPPORT_EMAIL = '';

export async function appendLog(line: string) {
  const ts = new Date().toISOString();
  await FileSystem.writeAsStringAsync(LOG_PATH, `${ts} ${line}\n`, { append: true });
}

// Opens the user's own email app with the log pre-attached, rather than a
// generic share sheet — "Report a Problem" via a share sheet left the user
// guessing which of a dozen apps was the right destination. Email is the one
// channel that actually matches "report this to someone." Falls back to the
// OS share sheet only if no mail app is configured on the device at all.
export async function emailDiagnostics() {
  try {
    const exists = await FileSystem.getInfoAsync(LOG_PATH);
    if (!exists.exists) {
      await FileSystem.writeAsStringAsync(LOG_PATH, 'No diagnostics available.');
    }

    const available = await MailComposer.isAvailableAsync();
    if (!available) {
      await shareFile(LOG_PATH, 'Health Diary Diagnostics', 'text/plain');
      return;
    }

    await MailComposer.composeAsync({
      recipients: SUPPORT_EMAIL ? [SUPPORT_EMAIL] : [],
      subject: 'Health Diary — Problem Report',
      body:
        'Describe what happened below.\n\n' +
        '---\n' +
        'The attached file is a technical log only (timestamps, screen names, and error text) — it does not contain any of your health data.',
      attachments: [LOG_PATH],
    });
  } catch (e) {
    console.error('Email diagnostics failed', e);
  }
}
