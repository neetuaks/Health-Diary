import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// NOTE: You MUST replace these with your application's OAuth client IDs
// Use an OAuth client configured for an "Installed" app with redirect URI via Expo's proxy.
const GOOGLE_CLIENT_ID = '<REPLACE_WITH_GOOGLE_CLIENT_ID>'; // e.g. web client id
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

const TOKEN_STORE_KEY = 'healthdiary_google_drive_token_v2';

let _tokenInfo: { accessToken: string; refreshToken?: string; expiresAt?: number } | null = null;

function base64UrlEncode(buffer: Uint8Array) {
  const b64 = Buffer.from(buffer).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeVerifierAndChallenge() {
  const verifierBytes = Crypto.getRandomBytes ? Crypto.getRandomBytes(32) : (new Uint8Array(32));
  const verifier = base64UrlEncode(Buffer.from(verifierBytes));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.UTF8 });
  const challenge = base64UrlEncode(Buffer.from(digest, 'hex'));
  return { verifier, challenge };
}

export async function connectToGoogleDrivePKCE(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Set GOOGLE_CLIENT_ID in googleDriveBackup.ts');
  // dynamic import to avoid hard dependency in environments where expo-auth-session isn't installed
  const AuthSession = await import('expo-auth-session').catch(() => null);
  if (!AuthSession) throw new Error('expo-auth-session is required for OAuth flow');
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  const { verifier, challenge } = await generateCodeVerifierAndChallenge();
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&scope=${encodeURIComponent(SCOPES.join(' '))}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256&access_type=offline&prompt=consent`;
  const result = await AuthSession.startAsync({ authUrl });
  if (result.type === 'success' && (result as any).params && (result as any).params.code) {
    const code = (result as any).params.code as string;
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&code_verifier=${encodeURIComponent(verifier)}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_type=authorization_code`
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokJson = await tokenRes.json();
    const accessToken = tokJson.access_token as string;
    const refreshToken = tokJson.refresh_token as string | undefined;
    const expiresIn = tokJson.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;
    const payload = { accessToken, refreshToken, expiresAt };
    await SecureStore.setItemAsync(TOKEN_STORE_KEY, JSON.stringify(payload));
    _tokenInfo = payload;
    return;
  }
  throw new Error('Google auth failed or was cancelled');
}

// Backwards-compatible alias
export const connectToGoogleDrive = connectToGoogleDrivePKCE;

export async function refreshAccessTokenIfNeeded(): Promise<string | null> {
  try {
    if (_tokenInfo && _tokenInfo.expiresAt && _tokenInfo.expiresAt > Date.now() + 60000) return _tokenInfo.accessToken;
    const raw = await SecureStore.getItemAsync(TOKEN_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken: string; refreshToken?: string; expiresAt?: number };
    if (parsed.expiresAt && parsed.expiresAt > Date.now() + 60000) { _tokenInfo = parsed; return parsed.accessToken; }
    if (!parsed.refreshToken) return null;
    // Refresh
    const body = `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&grant_type=refresh_token&refresh_token=${encodeURIComponent(parsed.refreshToken)}`;
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) return null;
    const j = await res.json();
    const accessToken = j.access_token as string;
    const expiresIn = j.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;
    const newPayload = { accessToken, refreshToken: parsed.refreshToken, expiresAt };
    await SecureStore.setItemAsync(TOKEN_STORE_KEY, JSON.stringify(newPayload));
    _tokenInfo = newPayload;
    return accessToken;
  } catch (e) {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (_tokenInfo && _tokenInfo.expiresAt && _tokenInfo.expiresAt > Date.now()) return _tokenInfo.accessToken;
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken: string; refreshToken?: string; expiresAt?: number };
    if (parsed.expiresAt && parsed.expiresAt > Date.now()) { _tokenInfo = parsed; return parsed.accessToken; }
    return await refreshAccessTokenIfNeeded();
  } catch (e) { return null; }
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

export async function listBackupsFromDrive(): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Google Drive');
  const q = encodeURIComponent("'appDataFolder' in parents and mimeType!='application/vnd.google-apps.folder'");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder&fields=files(id,name,createdTime)` , { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('List failed');
  const j = await res.json();
  return j.files || [];
}

export async function deleteBackupFromDrive(fileId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Google Drive');
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Delete failed: ' + txt);
  }
}

export async function disconnectDrive() {
  const token = await getAccessToken();
  try {
    if (token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    }
  } catch (e) { }
  await SecureStore.deleteItemAsync(TOKEN_STORE_KEY);
  _tokenInfo = null;
}
