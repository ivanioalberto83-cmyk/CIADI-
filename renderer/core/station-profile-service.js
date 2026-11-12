(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_STATION_PROFILE_SERVICE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const PROFILE_LABELS = Object.freeze({
    adm: 'Administração',
    suporte_informatica: 'Suporte Informático',
    rh: 'Recursos Humanos',
    recepcao: 'Receção'
  });

  const SUPPORT_ENTRY = Object.freeze({
    id: 'support',
    label: 'Suporte Informático',
    route: 'support',
    moduleId: 'support'
  });

  // Cada estação abre apenas o seu módulo de trabalho.
  // Receção concentra atendimento, faturação, caixa e aprovisionamento; não expõe rotas clínicas autónomas.
  // ADM consulta fechos e trabalha a respetiva integração contabilística.
  const PROFILE_ROUTES = Object.freeze({
    adm: Object.freeze(['cash_reports', 'contabilidade', 'auditoria']),
    suporte_informatica: Object.freeze(['support']),
    recepcao: Object.freeze(['reception']),
    // A estação RH mantém o seu espaço próprio, independente das três estações em validação.
    rh: Object.freeze(['rh'])
  });

  function isKnownProfile(profileId) {
    return Object.prototype.hasOwnProperty.call(PROFILE_LABELS, profileId);
  }

  function getProfileLabel(profileId) {
    return isKnownProfile(profileId) ? PROFILE_LABELS[profileId] : 'Estação não identificada';
  }

  function getVisibleEntries(profileId, entries, _options = {}) {
    if (!isKnownProfile(profileId) || !Array.isArray(entries)) return [];

    const unique = [];
    const seen = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || seen.has(entry.id)) continue;
      seen.add(entry.id);
      unique.push({ ...entry });
    }

    const routeIds = profileId === 'adm' ? unique.map(entry => entry.id) : PROFILE_ROUTES[profileId];
    return routeIds
      .map(id => unique.find(entry => entry.id === id) || (id === 'support' ? { ...SUPPORT_ENTRY } : null))
      .filter(Boolean);
  }

  return Object.freeze({ getVisibleEntries, getProfileLabel, isKnownProfile });
});
