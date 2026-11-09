(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_PROFILE_SERVICE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function createProfileService(supabaseClient) {
    return Object.freeze({
      getCurrentProfile(userId) {
        return supabaseClient
          .from('perfis')
          .select('id,email,nome_completo,nome_exibicao,tipo,ativo,telefone')
          .eq('id', userId)
          .maybeSingle();
      }
    });
  }

  return Object.freeze({ createProfileService });
});
