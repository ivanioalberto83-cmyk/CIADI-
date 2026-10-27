const { app, BrowserWindow, dialog, shell, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let biometricWindow;
const STATION_POLOS = [
  { id: 'talatona', label: 'CIADI Polo Talatona' },
  { id: 'jardim-de-rosas', label: 'CIADI Polo Jardim de Rosas' }
];
function stationConfigPath() { return path.join(app.getPath('userData'), 'station-config.json'); }
function readStationConfig() {
  try {
    const value = JSON.parse(fs.readFileSync(stationConfigPath(), 'utf8'));
    return STATION_POLOS.some(p => p.id === value.poloId) ? { poloId: value.poloId, poloLabel: STATION_POLOS.find(p => p.id === value.poloId).label } : null;
  } catch { return null; }
}
async function configureStationPolo() {
  const current = readStationConfig();
  const { response } = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'question', title: 'CIADI — Polo deste computador',
    message: 'Selecione o polo predefinido para este computador.',
    detail: 'Esta opção identifica a estação de trabalho. NÃO concede permissões de acesso: cada utilizador continua sujeito à sua conta, às permissões do servidor e às regras da base de dados.',
    buttons: ['CIADI Polo Talatona', 'CIADI Polo Jardim de Rosas', 'Cancelar'],
    defaultId: current?.poloId === 'jardim-de-rosas' ? 1 : 0, cancelId: 2, noLink: true
  });
  if (response === 2 || response < 0) return readStationConfig();
  const polo = STATION_POLOS[response];
  fs.mkdirSync(path.dirname(stationConfigPath()), { recursive: true });
  fs.writeFileSync(stationConfigPath(), JSON.stringify({ poloId: polo.id, updatedAt: new Date().toISOString() }, null, 2), { encoding: 'utf8', mode: 0o600 });
  return { poloId: polo.id, poloLabel: polo.label };
}
async function ensureStationPolo() {
  if (!readStationConfig()) await configureStationPolo();
}
ipcMain.handle('ciadi:station:get', () => readStationConfig());
ipcMain.handle('ciadi:station:configure', () => configureStationPolo());

function openBiometricWindow() {
  if (biometricWindow && !biometricWindow.isDestroyed()) { biometricWindow.focus(); return; }
  biometricWindow = new BrowserWindow({ width: 1120, height: 820, minWidth: 760, minHeight: 600, title: 'CIADI — Assiduidade Biométrica (K20 Pro)', backgroundColor: '#fbfdff', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  biometricWindow.loadFile(path.join(__dirname, 'biometric-k20pro.html'));
  biometricWindow.on('closed', () => { biometricWindow = null; });
}
ipcMain.on('ciadi:open-biometric', () => openBiometricWindow());

function installApplicationMenu() {
  const menu = Menu.buildFromTemplate([{ label: 'CIADI', submenu: [{ label: 'Configurar polo deste computador…', click: () => configureStationPolo() }, { type: 'separator' }, { label: 'Assiduidade Biométrica (ZKTeco K20 Pro) — Homologação', click: openBiometricWindow }, { type: 'separator' }, { role: 'quit', label: 'Sair' }] }]);
  Menu.setApplicationMenu(menu);
}

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

app.whenReady().then(async () => {
  installApplicationMenu();
  createWindow();
  await ensureStationPolo();
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
