module.exports = {
  makeRedirectUri: (opts) => 'https://auth.expo.io/@me/redirect',
  startAsync: async ({ authUrl }) => ({ type: 'cancel' })
};
