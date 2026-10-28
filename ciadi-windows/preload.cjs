// Mantém o contexto isolado. Expõe apenas metadados não sensíveis da instalação.
const { contextBridge } = require('electron');

const allowedProfiles = new Set(['polo001', 'polo002', 'adm', 'suporte_informatica']);
const profileArgument = process.argv.find((arg) => arg.startsWith('--ciadi-install-profile='));
const requestedProfile = profileArgument ? profileArgument.split('=').slice(1).join('=') : 'web';
const installProfile = allowedProfiles.has(requestedProfile) ? requestedProfile : 'web';

contextBridge.exposeInMainWorld('ciadiDesktop', Object.freeze({
  appName: 'CIADI Dashboard',
  installProfile
}));
