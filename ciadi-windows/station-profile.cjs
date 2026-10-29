const STATION_PROFILES = Object.freeze({
  adm: Object.freeze({ key: 'adm', label: 'Administrador (ADM)' }),
  suporte: Object.freeze({ key: 'suporte', label: 'Suporte Informático' }),
  rh: Object.freeze({ key: 'rh', label: 'Recursos Humanos (RH)' }),
  rececao: Object.freeze({ key: 'rececao', label: 'Receção' })
});

function getStationProfile(iniContent) {
  const match = /^\s*profile\s*=\s*([a-z_]+)\s*$/im.exec(String(iniContent ?? ''));
  if (!match) return null;
  return STATION_PROFILES[match[1].toLowerCase()] || null;
}

module.exports = { STATION_PROFILES, getStationProfile };
