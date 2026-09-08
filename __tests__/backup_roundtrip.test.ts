import { generateRecoveryKey, deriveKeyFromRecovery, encryptPayload, decryptPayload } from '../src/services/crypto';

test('backup encrypt/decrypt roundtrip with correct recovery key', () => {
  const recovery = 'abcdef-123456-7890ab-cdef12-345678-90abcd'; // sample hex-like
  const sample = { profiles: [{ id: 'p1', name: 'Alice' }], readings: [{ id: 'r1', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), source: 'manual', values: { systolic: 120, diastolic: 80 } }] };
  const payload = Buffer.from(JSON.stringify(sample), 'utf8');
  const { key, salt } = deriveKeyFromRecovery(recovery);
  const { nonce, box } = encryptPayload(key, payload);

  const decrypted = decryptPayload(key, nonce, box);
  expect(decrypted).not.toBeNull();
  const decoded = Buffer.from(decrypted as Uint8Array).toString('utf8');
  const parsed = JSON.parse(decoded);
  expect(parsed.profiles[0].name).toBe('Alice');
  expect(parsed.readings[0].values.systolic).toBe(120);
});

test('backup decrypt fails with wrong key', () => {
  const recovery = 'abcdef-123456-7890ab-cdef12-345678-90abcd';
  const sample = { foo: 'bar' };
  const payload = Buffer.from(JSON.stringify(sample), 'utf8');
  const { key, salt } = deriveKeyFromRecovery(recovery);
  const { nonce, box } = encryptPayload(key, payload);

  const { key: wrongKey } = deriveKeyFromRecovery('001122-334455-667788-99aabb-ccddeeff');
  const decrypted = decryptPayload(wrongKey, nonce, box);
  expect(decrypted).toBeNull();
});
