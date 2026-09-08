module.exports = {
  getItemAsync: jest.fn(async (key) => null),
  setItemAsync: jest.fn(async (k, v) => {}),
  deleteItemAsync: jest.fn(async (k) => {})
};
