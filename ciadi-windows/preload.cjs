// Mantém o contexto isolado. Expõe apenas operações explícitas do processo principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ciadiDesktop', Object.freeze({
  appName: 'CIADI Dashboard',
  documents: Object.freeze({
    renderPdf: payload => ipcRenderer.invoke('ciadi:documents:render-pdf', payload),
    exportIssuedPdf: payload => ipcRenderer.invoke('ciadi:documents:export-issued-pdf', payload)
  })
}));
