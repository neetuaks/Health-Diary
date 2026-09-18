module.exports = {
  printToFileAsync: jest.fn(async ({ html }) => ({ uri: '/tmp/mock-report.pdf', base64: 'bW9jay1wZGY=' })),
  printAsync: jest.fn(async () => {})
};
