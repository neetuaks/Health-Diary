import * as SecureStore from 'expo-secure-store';
import pbkdf2 from 'pbkdf2';
import nacl from 'tweetnacl';

export async function generateRecoveryKey(): Promise<string> {
  // Generate 32 bytes and encode as hex groups for copyability
  const buf = Buffer.from(nacl.randomBytes(32));
  const hex = buf.toString('hex');
  // group into 6-char chunks
  return hex.match(/.{1,6}/g)?.join('-') ?? hex;
}

export function deriveKeyFromRecovery(recovery: string, salt?: Uint8Array) {
  const normalized = recovery.replace(/[^a-f0-9]/gi, '');
  const seed = Buffer.from(normalized, 'hex');
  const usedSalt = salt ?? nacl.randomBytes(16);
  const derived = pbkdf2.pbkdf2Sync(seed, Buffer.from(usedSalt), 100000, 32, 'sha256');
  return { key: derived, salt: usedSalt };
}

export function encryptPayload(key: Uint8Array, payload: Uint8Array) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(payload, nonce, key);
  return { nonce, box };
}

export function decryptPayload(key: Uint8Array, nonce: Uint8Array, box: Uint8Array) {
  const res = nacl.secretbox.open(box, nonce, key);
  return res; // null if failure
}

export async function storeRecoveryKeyOnDevice(recovery: string) {
  await SecureStore.setItemAsync('recovery_key', recovery, { keychainAccessible: SecureStore.WHEN_UNLOCKED });
}

export async function getStoredRecoveryKey() {
  return await SecureStore.getItemAsync('recovery_key');
}
