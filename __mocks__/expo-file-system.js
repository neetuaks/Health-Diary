module.exports = {
  cacheDirectory: '/tmp/',
  documentDirectory: '/tmp/doc/',
  getInfoAsync: jest.fn(async (uri) => ({ exists: false })),
  readAsStringAsync: jest.fn(async (uri, opts) => ''),
  writeAsStringAsync: jest.fn(async (uri, content, opts) => {}),
  copyAsync: jest.fn(async ({ from, to }) => {}),
  makeDirectoryAsync: jest.fn(async (uri, opts) => {}),
  deleteAsync: jest.fn(async (uri, opts) => {}),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  File: jest.fn().mockImplementation((uri) => ({ uri, text: jest.fn(async () => '') })),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(async () => ({ granted: true, directoryUri: 'content://mock/tree/primary' })),
    createFileAsync: jest.fn(async (parentUri, name, mimeType) => `${parentUri}/${name}`),
    writeAsStringAsync: jest.fn(async (uri, content, opts) => {}),
  },
};
