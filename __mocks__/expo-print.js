module.exports = {
  printToFileAsync: jest.fn(async ({ html }) => ({ uri: '/tmp/mock-report.pdf' })),
  printAsync: jest.fn(async () => {})
};
