const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let biometricWindow;

function createRecoveryPoint() {
  const installPath = path.dirname(process.execPath);
  const recoveryRoot = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'CIADI', 'Recovery');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const pointPath = path.join(recoveryRoot, \`\${stamp}-\${app.getVersion()}\`);
  const appBackupPath = path.join(pointPath, 'app');

  fs.mkdirSync(recoveryRoot, { recursive: true });
  fs.mkdirSync(pointPath, { recursive: false });
  try {
    fs.cpSync(installPath, appBackupPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false
    });
    const manifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      appName: 'CIADI Dashboard',
      appVersion: app.getVersion(),
      installPath,
      backupPath: appBackupPath,
      scope: 'application-files-only',
      restoresSupabaseData: false
    };
    fs.writeFileSync(path.join(pointPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const points = fs.readdirSync(recoveryRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const fullPath = path.join(recoveryRoot, entry.name);
        return { fullPath, modified: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.modified - a.modified);

    for (const oldPoint of points.slice(5)) {
      fs.rmSync(oldPoint.fullPath, { recursive: true, force: true });
    }
    return { pointPath, appVersion: app.getVersion() };
  } catch (error) {
    fs.rmSync(pointPath, { recursive: true, force: true });
    throw error;
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
  installApplicationMenu();
  createWindow();
  if (app.isPackaged) {
    autoUpdater.autoDownload = false;
    autoUpdater.on('checking-for-update', () => console.log('A verificar atualizações do CIADI…'));
    autoUpdater.on('update-available', async info => {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Atualização do CIADI disponível',
        message: \`Está disponível a versão \${info.version}.\`,
        detail: 'Antes do download será criado um ponto de recuperação dos ficheiros instalados. Pretende continuar?',
        buttons: ['Criar cópia e descarregar', 'Mais tarde'], defaultId: 0, cancelId: 1
      });
      if (response !== 0) return;
      try {
        const point = createRecoveryPoint();
        console.log(\`Ponto de recuperação CIADI criado: \${point.pointPath}\`);
        await autoUpdater.downloadUpdate();
      } catch (error) {
        console.error('Atualização cancelada: não foi possível criar um ponto de recuperação.', error);
        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Atualização cancelada por segurança',
          message: 'Não foi possível criar uma cópia de segurança dos ficheiros instalados.',
          detail: \`\${error.message}\n\nA atualização não será descarregada. Verifique o espaço livre e as permissões do Windows.\`,
          buttons: ['OK']
        });
      }
    });
    autoUpdater.on('update-not-available', () => console.log('O CIADI está atualizado.'));
    autoUpdater.on('update-downloaded', async () => {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Atualização pronta',
        message: 'A atualização foi descarregada e existe um ponto de recuperação local.',
        detail: 'A aplicação será reiniciada para instalar a atualização. Se a nova versão falhar, use o procedimento de recuperação documentado.',
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
