import { restoreEncryptedBackupFromFile, peekEncryptedBackup } from '../src/services/backup';

jest.mock('../src/db/init', () => ({
  getDB: () => ({
    transaction: (fn: any, errCb?: any, okCb?: any) => {
      // provide a fake tx object that supports executeSql
      const tx = {
        executeSql: (_sql: string, _params: any[], cb?: any) => {
          // simulate no existing rows
          const res = { rows: { length: 0, item: (_i:number) => ({}) } };
          if (cb) cb(null, res);
        }
      };
      try {
        fn(tx);
        if (okCb) okCb();
      } catch (e) {
        if (errCb) errCb(e);
      }
    }
  }))
}));

test('restoreEncryptedBackupFromFile merge behavior (no conflicts)', async () => {
  // create a fake container using peekEncryptedBackup's inverse path
  const sample = { profiles: [{ id: 'p1', name: 'Alice' }], parameter_types: [], readings: [] };
  const payloadStr = JSON.stringify(sample);
  // We'll reuse crypto functions to encrypt; import dynamically to avoid top-level errors
  const { deriveKeyFromRecovery, encryptPayload } = require('../src/services/crypto');
  const recovery = 'abcdef-123456-7890ab-cdef12-345678-90abcd';
  const { key, salt } = deriveKeyFromRecovery(recovery);
  const payload = Buffer.from(payloadStr, 'utf8');
  const { nonce, box } = encryptPayload(key, payload);
  const container = { version: 1, salt: Buffer.from(salt).toString('hex'), nonce: Buffer.from(nonce).toString('hex'), ciphertext: Buffer.from(box).toString('hex') };
  const containerJson = JSON.stringify(container);

  const obj = await restoreEncryptedBackupFromFile(containerJson, recovery, { replace: false });
  expect(obj.profiles[0].name).toBe('Alice');
});
