// Mantém o contexto isolado. Expõe apenas a ação autorizada de abrir a janela biométrica.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ciadiDesktop', Object.freeze({
  appName: 'CIADI Dashboard',
  openBiometric: () => ipcRenderer.send('ciadi:open-biometric')
}));
