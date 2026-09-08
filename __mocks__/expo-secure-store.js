const storeKey = '__EXPO_SECURE_STORE_STORE';
if (!global[storeKey]) global[storeKey] = {};

module.exports = {
  getItemAsync: jest.fn(async (key) => {
    return global[storeKey][key] ?? null;
  }),
  setItemAsync: jest.fn(async (k, v) => { global[storeKey][k] = v; }),
  deleteItemAsync: jest.fn(async (k) => { delete global[storeKey][k]; })
};
