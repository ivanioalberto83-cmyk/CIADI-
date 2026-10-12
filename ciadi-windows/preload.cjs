// Mantém o contexto isolado. Não expõe Node.js ao dashboard.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('ciadiDesktop', Object.freeze({ appName: 'CIADI Dashboard' }));
