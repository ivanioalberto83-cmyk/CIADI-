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

  const PROFILE_ROUTES = Object.freeze({
    adm: null,
    suporte_informatica: null,
    // Until the dedicated HR workspace is implemented, retain only real legacy routes.
    rh: Object.freeze(['rh']),
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

    if (profileId === 'adm' || profileId === 'suporte_informatica') {
      if (profileId === 'suporte_informatica') {
        return [{ id: 'support', label: 'Suporte Informático', route: 'support', moduleId: 'support' }, ...unique];
      }
      return unique;
    }

    const allowed = new Set(PROFILE_ROUTES[profileId]);
    return unique.filter(entry => allowed.has(entry.id));
  }

  return Object.freeze({ getVisibleEntries, getProfileLabel, isKnownProfile });
});
