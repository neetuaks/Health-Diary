// Separate from jest.config.js on purpose: rendering actual RN components
// needs a real Platform/NativeModules/Animated environment, which the
// service-level config's plain ts-jest/babel-jest setup doesn't provide
// (that's the source of the long-standing "Platform.OS is undefined in
// tests" quirk noted throughout this codebase's history). jest-expo brings
// in @react-native/jest-preset plus Expo's own module mocks, giving
// @testing-library/react-native something real to render against, without
// touching the existing, working service-test config at all.
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/components/**/*.test.tsx'],
  // jest-expo's own default transformIgnorePatterns already covers
  // react-native/expo/react-navigation; just add the couple of extra
  // packages (not RN/expo-prefixed, so not covered by that default) that
  // ship untranspiled source.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|victory|victory-native|uuid))'
  ],
  // Reuses the project's existing hand-written mocks (same ones the
  // service-level tests already rely on) instead of jest-expo's own
  // built-in Expo mocks, so both test layers exercise identical fake
  // behavior for these modules.
  moduleNameMapper: {
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.js',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-document-picker.js',
    '^expo-print$': '<rootDir>/__mocks__/expo-print.js',
    '^expo-local-authentication$': '<rootDir>/__mocks__/expo-local-authentication.js',
    '^expo-mail-composer$': '<rootDir>/__mocks__/expo-mail-composer.js'
  }
};
