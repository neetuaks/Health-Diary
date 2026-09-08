// Jest setup: define globals and minimal mocks
global.__DEV__ = true;

// Provide a minimal NativeModules mock if not present
if (typeof require !== 'undefined') {
  try {
    const RN = require('react-native');
    if (!RN.NativeModules) RN.NativeModules = {};
  } catch (e) {
    // ignore
  }
}
