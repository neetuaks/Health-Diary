import { generateRecoveryKey, deriveKeyFromRecovery, encryptPayload, decryptPayload, getRecoveryKeyConfirmed, setRecoveryKeyConfirmed } from '../src/services/crypto';

const SecureStore = require('expo-secure-store');

describe('crypto utilities', () => {
  it('generates a recovery key with expected format', async () => {
    const key = await generateRecoveryKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
    expect(key.split('-').length).toBeGreaterThanOrEqual(1);
  });

  it('derives key deterministically with same salt', () => {
    const recovery = 'abcdef123456';
    const { key, salt } = deriveKeyFromRecovery(recovery);
    const { key: k2 } = deriveKeyFromRecovery(recovery, salt);
    expect(Buffer.from(key).toString('hex')).toEqual(Buffer.from(k2).toString('hex'));
  });

  it('encrypts and decrypts payload correctly', () => {
    const recovery = 'abcdef123456';
    const { key } = deriveKeyFromRecovery(recovery);
    const payload = Buffer.from('hello world', 'utf8');
    const { nonce, box } = encryptPayload(key, payload);
    const out = decryptPayload(key, nonce, box);
    expect(out).not.toBeNull();
    expect(Buffer.from(out!).toString('utf8')).toBe('hello world');
  });
});

describe('recovery key confirmation flag', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('recovery_key_confirmed');
  });

  it('defaults to unconfirmed', async () => {
    expect(await getRecoveryKeyConfirmed()).toBe(false);
  });

  it('persists true and false explicitly', async () => {
    await setRecoveryKeyConfirmed(true);
    expect(await getRecoveryKeyConfirmed()).toBe(true);
    await setRecoveryKeyConfirmed(false);
    expect(await getRecoveryKeyConfirmed()).toBe(false);
  });
});
