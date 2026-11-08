// Mantém o contexto isolado. Expõe apenas operações explícitas do processo principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ciadiDesktop', Object.freeze({
  appName: 'CIADI Dashboard',
  documents: Object.freeze({
    exportIssuedPdf: payload => ipcRenderer.invoke('ciadi:documents:export-issued-pdf', payload)
  })
}));
