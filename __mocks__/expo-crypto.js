module.exports = {
  getRandomBytes: (n) => new Uint8Array(n),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  CryptoEncoding: { UTF8: 'utf8' },
  digestStringAsync: async (_alg, str, _opts) => {
    // return hex of utf8 bytes as placeholder
    return Buffer.from(str, 'utf8').toString('hex');
  }
};
