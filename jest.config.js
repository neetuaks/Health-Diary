module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|victory|victory-native|expo|@expo|@react-navigation|uuid)/)'
  ],
  // Component-level tests live under __tests__/components/ and run through
  // jest.component.config.js (jest-expo preset) instead — this config's
  // ts-jest/babel-jest setup has no Platform/NativeModules support and
  // can't render RN components (see jest.component.config.js's header
  // comment for why that's a separate config rather than merged in here).
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '<rootDir>/__tests__/components/']
  ,
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.js',
    '^expo-auth-session$': '<rootDir>/__mocks__/expo-auth-session.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.js',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-document-picker.js',
    '^expo-print$': '<rootDir>/__mocks__/expo-print.js',
    '^expo-local-authentication$': '<rootDir>/__mocks__/expo-local-authentication.js',
    '^expo-mail-composer$': '<rootDir>/__mocks__/expo-mail-composer.js'
  }
};
