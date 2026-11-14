(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_AUTH_SERVICE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function createAuthService(supabaseClient) {
    return Object.freeze({
      getSession() {
        return supabaseClient.auth.getSession();
      },
      signInWithPassword(credentials) {
        return supabaseClient.auth.signInWithPassword(credentials);
      },
      signOut(...args) {
        return supabaseClient.auth.signOut(...args);
      },
      onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange(callback);
      }
    });
  }

  return Object.freeze({ createAuthService });
});
