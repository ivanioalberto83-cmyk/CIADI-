const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let biometricWindow;

const STATION_PROFILES = Object.freeze({
  adm: 'ADM — Administração',
  suporte_informatica: 'Suporte Informático',
  rh: 'Recursos Humanos (RH)',
  recepcao: 'Receção'
});

function getStationProfileId() {
  if (!app.isPackaged || process.platform !== 'win32') return null;
  try {
    const profilePath = path.join(path.dirname(process.execPath), 'ciadi-install-profile.txt');
    const profileId = fs.readFileSync(profilePath, 'utf8').trim();
    return Object.prototype.hasOwnProperty.call(STATION_PROFILES, profileId) ? profileId : null;
  } catch (error) {
    console.warn('Não foi possível ler o perfil da estação CIADI:', error.message);
    return null;
  }
}

function getStationLabel() {
  if (!app.isPackaged || process.platform !== 'win32') return null;
  try {
    const profilePath = path.join(path.dirname(process.execPath), 'ciadi-install-profile.txt');
    const profileId = fs.readFileSync(profilePath, 'utf8').trim();
    return STATION_PROFILES[profileId] || null;
  } catch (error) {
    console.warn('Não foi possível ler a identificação da estação CIADI:', error.message);
    return null;
  }
}

function openBiometricWindow() {
  if (biometricWindow && !biometricWindow.isDestroyed()) { biometricWindow.focus(); return; }
  biometricWindow = new BrowserWindow({ width: 1120, height: 820, minWidth: 760, minHeight: 600, title: 'CIADI — Assiduidade Biométrica (K20 Pro)', backgroundColor: '#fbfdff', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  biometricWindow.loadFile(path.join(__dirname, 'biometric-k20pro.html'));
  biometricWindow.on('closed', () => { biometricWindow = null; });
}

function installApplicationMenu() {
  const menu = Menu.buildFromTemplate([{ label: 'CIADI', submenu: [{ label: 'Assiduidade Biométrica (ZKTeco K20 Pro) — Homologação', click: openBiometricWindow }, { type: 'separator' }, { role: 'quit', label: 'Sair' }] }]);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const stationLabel = getStationLabel();
  const windowTitle = stationLabel ? `CIADI Dashboard — Estação: ${stationLabel}` : 'CIADI Dashboard';
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1024, minHeight: 700,
    title: windowTitle, backgroundColor: '#fbfdff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  const stationProfile = getStationProfileId();
  mainWindow.loadFile(path.join(__dirname, 'index.html'), {
    query: { ciadi_profile: stationProfile || 'unconfigured' }
  });
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
  installApplicationMenu();
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
