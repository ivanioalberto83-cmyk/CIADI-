// Mantém o contexto isolado. Não expõe Node.js ao dashboard.
const { contextBridge } = require('electron');

const profileArg = process.argv.find(arg => arg.startsWith('--ciadi-station-profile='));
const candidate = profileArg ? profileArg.slice('--ciadi-station-profile='.length) : 'admin';
const allowedProfiles = Object.freeze({
  admin: 'ADM',
  suporte_informatica: 'Suporte Informático',
  rh: 'RH',
  rececao: 'Receção'
});
const stationProfile = Object.prototype.hasOwnProperty.call(allowedProfiles, candidate) ? candidate : 'admin';

contextBridge.exposeInMainWorld('ciadiDesktop', Object.freeze({
  appName: 'CIADI Dashboard',
  isDesktop: true,
  stationProfile,
  stationProfileLabel: allowedProfiles[stationProfile]
}));
