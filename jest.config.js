module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|victory|victory-native|expo|@expo|@react-navigation)/)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/']
  ,
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.js',
    '^expo-auth-session$': '<rootDir>/__mocks__/expo-auth-session.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.js',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-document-picker.js'
  }
};
