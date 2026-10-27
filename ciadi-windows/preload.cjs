// Mantém o contexto isolado. Não expõe Node.js ao dashboard.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ciadiDesktop', Object.freeze({
  appName: 'CIADI Dashboard',
  openBiometric: () => ipcRenderer.invoke('ciadi:open-biometric')
}));
