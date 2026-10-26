const { app, BrowserWindow, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let updaterStatus = 'não_verificado';
let lastUpdateCheckAt = null;
let lastUpdaterError = null;

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

async function exportDiagnostics() {
  const report = {
    product: 'CIADI Dashboard',
    generatedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    packaged: app.isPackaged,
    platform: process.platform,
    operatingSystem: os.type(),
    operatingSystemRelease: os.release(),
    architecture: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    updater: {
      status: updaterStatus,
      lastCheckAt: lastUpdateCheckAt,
      lastError: lastUpdaterError
    },
    privacy: 'Relatório técnico local. Não inclui tokens, credenciais, dados clínicos, nomes de pacientes ou conteúdo de formulários.'
  };

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar diagnóstico técnico CIADI',
    defaultPath: `CIADI-diagnostico-${new Date().toISOString().slice(0, 10)}.json`,
    buttonLabel: 'Guardar diagnóstico',
    filters: [{ name: 'Relatório JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return;

  try {
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), { encoding: 'utf8', flag: 'wx' });
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Diagnóstico exportado',
      message: 'O relatório técnico foi guardado localmente.',
      detail: 'Reveja o ficheiro antes de o partilhar com o suporte. O CIADI não o enviou automaticamente.'
    });
  } catch (error) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Não foi possível guardar o diagnóstico',
      message: 'Escolha outra localização ou outro nome de ficheiro.',
      detail: String(error?.message || error)
    });
  }
}

function installApplicationMenu() {
  const template = [
    {
      label: 'Ficheiro',
      submenu: [{ role: 'quit', label: 'Sair do CIADI' }]
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Exportar diagnóstico técnico…', click: () => { exportDiagnostics(); } },
        { type: 'separator' },
        { label: 'Sobre o CIADI Dashboard', click: () => dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Sobre o CIADI Dashboard',
          message: `CIADI Dashboard v${app.getVersion()}`,
          detail: 'Para suporte, exporte o diagnóstico e reveja o conteúdo antes de o partilhar.'
        }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  installApplicationMenu();

  if (app.isPackaged) {
    autoUpdater.autoDownload = false;
    autoUpdater.on('checking-for-update', () => {
      updaterStatus = 'a_verificar';
      lastUpdateCheckAt = new Date().toISOString();
      console.log('A verificar atualizações do CIADI…');
    });
    autoUpdater.on('update-available', async info => {
      updaterStatus = 'atualização_disponível';
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Atualização do CIADI disponível',
        message: `Está disponível a versão ${info.version}.`,
        detail: 'Pretende descarregar a atualização agora?',
        buttons: ['Descarregar', 'Mais tarde'], defaultId: 0, cancelId: 1
      });
      if (response === 0) autoUpdater.downloadUpdate();
    });
    autoUpdater.on('update-not-available', () => {
      updaterStatus = 'atualizado';
      lastUpdaterError = null;
      console.log('O CIADI está atualizado.');
    });
    autoUpdater.on('update-downloaded', async () => {
      updaterStatus = 'atualização_descarregada';
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Atualização pronta',
        message: 'A atualização foi descarregada.',
        detail: 'A aplicação será reiniciada para instalar a atualização.',
        buttons: ['Instalar e reiniciar', 'Agora não'], defaultId: 0, cancelId: 1
      });
      if (response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', error => {
      updaterStatus = 'erro';
      lastUpdaterError = String(error?.message || error).slice(0, 500);
      console.error('Erro no atualizador CIADI:', lastUpdaterError);
    });
    autoUpdater.checkForUpdates().catch(error => {
      updaterStatus = 'erro';
      lastUpdaterError = String(error?.message || error).slice(0, 500);
      console.error('Falha ao verificar atualizações:', lastUpdaterError);
    });
  } else {
    updaterStatus = 'indisponível_em_modo_de_desenvolvimento';
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
