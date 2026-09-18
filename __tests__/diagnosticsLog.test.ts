import { emailDiagnostics } from '../src/services/diagnosticsLog';

const MailComposer = require('expo-mail-composer');
const Sharing = require('expo-sharing');
const FileSystem = require('expo-file-system/legacy');

describe('emailDiagnostics', () => {
  beforeEach(() => {
    MailComposer.isAvailableAsync.mockClear();
    MailComposer.composeAsync.mockClear();
    Sharing.shareAsync.mockClear();
    MailComposer.isAvailableAsync.mockResolvedValue(true);
  });

  test('opens the mail composer with the log attached and a "logs only" notice', async () => {
    await emailDiagnostics();

    expect(MailComposer.composeAsync).toHaveBeenCalledTimes(1);
    const args = MailComposer.composeAsync.mock.calls[0][0];
    expect(args.subject).toContain('Problem Report');
    expect(args.body).toContain('does not contain any of your health data');
    expect(args.attachments).toEqual([FileSystem.documentDirectory + 'healthdiary_logs.txt']);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  test('falls back to the OS share sheet when no mail app is available', async () => {
    MailComposer.isAvailableAsync.mockResolvedValueOnce(false);

    await emailDiagnostics();

    expect(MailComposer.composeAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
  });
});
