// This file must be imported FIRST in index.js, before any other import
// (including 'expo' and './App'). Import statements always run before other
// top-level code in a module, regardless of source order -- so the shim
// itself has to live in its own module to guarantee it runs before anything
// else does.
//
// Hermes/React Native has no Node-style `process` global. Several transitive
// deps pulled in by src/services/crypto.ts (pbkdf2 -> create-hash -> hash-base
// -> readable-stream) read `process.browser` and `process.version` at *module
// load time*, not lazily -- without this shim they throw
// "Cannot read property 'slice' of undefined" before the app ever renders.
if (typeof global.process === 'undefined') {
  global.process = require('process/browser');
}
if (typeof global.process.browser === 'undefined') {
  global.process.browser = true;
}
