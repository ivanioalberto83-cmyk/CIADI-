const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1024, minHeight: 700,
    title: 'CIADI Dashboard', backgroundColor: '#fbfdff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      dialog.showMessageBox(mainWindow, {
        type: 'question', title: 'Abrir ligação externa',
        message: 'Pretende abrir esta ligação no navegador do sistema?',
        detail: url, buttons: ['Abrir', 'Cancelar'], defaultId: 1, cancelId: 1
      }).then(({ response }) => { if (response === 0) shell.openExternal(url); });
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) {
    autoUpdater.autoDownload = false;
    autoUpdater.on('checking-for-update', () => console.log('A verificar atualizações do CIADI…'));
    autoUpdater.on('update-available', async info => {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Atualização do CIADI disponível',
        message: `Está disponível a versão ${info.version}.`,
        detail: 'Pretende descarregar a atualização agora?',
        buttons: ['Descarregar', 'Mais tarde'], defaultId: 0, cancelId: 1
      });
      if (response === 0) autoUpdater.downloadUpdate();
    });
    autoUpdater.on('update-not-available', () => console.log('O CIADI está atualizado.'));
    autoUpdater.on('update-downloaded', async () => {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Atualização pronta',
        message: 'A atualização foi descarregada.',
        detail: 'A aplicação será reiniciada para instalar a atualização.',
        buttons: ['Instalar e reiniciar', 'Agora não'], defaultId: 0, cancelId: 1
      });
      if (response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', error => console.error('Erro no atualizador CIADI:', error.message));
    autoUpdater.checkForUpdates().catch(error => console.error('Falha ao verificar atualizações:', error.message));
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
