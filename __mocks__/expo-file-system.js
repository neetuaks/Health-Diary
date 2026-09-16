module.exports = {
  cacheDirectory: '/tmp/',
  getInfoAsync: async (uri) => ({ exists: false }),
  readAsStringAsync: async (uri, opts) => '',
  writeAsStringAsync: jest.fn(async (uri, content, opts) => {}),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' }
};
