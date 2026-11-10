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

  const ADM_HIDDEN_ROUTES = new Set([
    'support',
    'reception',
    'caixa',
    'faturacao',
    'financeiro'
  ]);

  const PROFILE_ROUTES = Object.freeze({
    // ADM retains its administrative routes; cash operations remain in Reception.
    adm: null,
    suporte_informatica: Object.freeze(['support']),
    // Until the dedicated HR workspace is implemented, retain only the real HR route.
    rh: Object.freeze(['rh']),
    // Billing, cash operations and procurement are embedded in the Reception workspace.
    recepcao: Object.freeze(['reception', 'overview', 'pedidos_site', 'agendamentos', 'pacientes', 'familias', 'triagens'])
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

    if (profileId === 'suporte_informatica') {
      return [unique.find(entry => entry.id === 'support') || { ...SUPPORT_ENTRY }];
    }

    if (profileId === 'adm') {
      return unique.filter(entry => !ADM_HIDDEN_ROUTES.has(entry.id));
    }

    return PROFILE_ROUTES[profileId]
      .map(id => unique.find(entry => entry.id === id) || (id === 'support' ? { ...SUPPORT_ENTRY } : null))
      .filter(Boolean);
  }

  return Object.freeze({ getVisibleEntries, getProfileLabel, isKnownProfile });
});
