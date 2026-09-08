import * as AuthSession from 'expo-auth-session';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

// NOTE: You MUST replace these with your application's OAuth client IDs
// For testing in Expo, you can use an OAuth client configured for "Web" type with your redirect URI.
const GOOGLE_CLIENT_ID = '<REPLACE_WITH_GOOGLE_CLIENT_ID>'; // e.g. web client id
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

const TOKEN_STORE_KEY = 'healthdiary_google_drive_token_v1';

let _tokenInfo: { accessToken: string; expiresAt: number } | null = null;

export async function connectToGoogleDrive(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Set GOOGLE_CLIENT_ID in googleDriveBackup.ts');
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&scope=${encodeURIComponent(SCOPES.join(' '))}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  const result = await AuthSession.startAsync({ authUrl });
  if (result.type === 'success' && (result as any).params && (result as any).params.access_token) {
    const accessToken = (result as any).params.access_token as string;
    const expiresIn = parseInt((result as any).params.expires_in || '3600', 10);
    const expiresAt = Date.now() + (expiresIn * 1000);
    const payload = { accessToken, expiresAt };
    await SecureStore.setItemAsync(TOKEN_STORE_KEY, JSON.stringify(payload));
    _tokenInfo = payload;
    return accessToken;
  }
  throw new Error('Google auth failed or was cancelled');
}

export async function getAccessToken(): Promise<string | null> {
  if (_tokenInfo && _tokenInfo.expiresAt > Date.now()) return _tokenInfo.accessToken;
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken: string; expiresAt: number };
    if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
      _tokenInfo = parsed;
      return parsed.accessToken;
    }
    // expired
    await SecureStore.deleteItemAsync(TOKEN_STORE_KEY);
    _tokenInfo = null;
    return null;
  } catch (e) {
    return null;
  }
}

export async function uploadBackupToDrive(fileUri: string, filename = 'healthdiary_backup.hdb') {
  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Google Drive');
  // Read file
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) throw new Error('Backup file not found');

  // Build multipart form-data: metadata + file
  const metadata = { name: filename, parents: ['appDataFolder'] };
  const boundary = '----expoFormBoundary' + Date.now();
  const fileString = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  const bodyParts: string[] = [];
  bodyParts.push(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
  bodyParts.push(`--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Transfer-Encoding: base64\r\n\r\n${fileString}\r\n`);
  bodyParts.push(`--${boundary}--`);
  const body = bodyParts.join('');

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Upload failed: ' + txt);
  }
  const json = await res.json();
  return json; // contains file id
}

export async function disconnectDrive() {
  const token = await getAccessToken();
  if (token) {
    try {
      // Revoke token; Google accepts either POST form or GET param
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    } catch (e) {
      // ignore
    }
  }
  await SecureStore.deleteItemAsync(TOKEN_STORE_KEY);
  _tokenInfo = null;
}
