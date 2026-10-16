const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const fs = require('fs');

let mainWindow = null;
const PORT = 3001;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Configure data directory for portable usage
const isPortable = process.env.PORTABLE_EXECUTABLE_DIR != null;
const baseDataDir = isPortable 
  ? process.env.PORTABLE_EXECUTABLE_DIR 
  : path.join(app.getPath('userData'), 'data');

if (!fs.existsSync(baseDataDir)) {
  try {
    fs.mkdirSync(baseDataDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

// Auto-seed config.json if not present in baseDataDir
const targetConfigFile = path.join(baseDataDir, 'config.json');
if (!fs.existsSync(targetConfigFile)) {
  const seedCandidates = [
    path.join(__dirname, '..', 'config.json'),
    path.join(process.resourcesPath || '', 'config.json'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'config.json'),
    path.join(process.resourcesPath || '', 'app', 'config.json'),
    'c:\\VSCODE\\fframes\\config.json'
  ];
  for (const c of seedCandidates) {
    if (fs.existsSync(c)) {
      try {
        fs.copyFileSync(c, targetConfigFile);
        console.log('[Electron] config.json inicial migrado a:', targetConfigFile);
        break;
      } catch (e) {}
    }
  }
}

// Auto-seed presets.json if not present in baseDataDir
const targetPresetsFile = path.join(baseDataDir, 'presets.json');
if (!fs.existsSync(targetPresetsFile)) {
  const seedPresets = [
    path.join(__dirname, '..', 'presets.json'),
    path.join(process.resourcesPath || '', 'presets.json'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'presets.json'),
    path.join(process.resourcesPath || '', 'app', 'presets.json'),
    'c:\\VSCODE\\fframes\\presets.json'
  ];
  for (const p of seedPresets) {
    if (fs.existsSync(p)) {
      try {
        fs.copyFileSync(p, targetPresetsFile);
        break;
      } catch (e) {}
    }
  }
}

// Ensure temp_uploads folder exists in writable data directory
const tempUploads = path.join(baseDataDir, 'temp_uploads');
if (!fs.existsSync(tempUploads)) {
  try {
    fs.mkdirSync(tempUploads, { recursive: true });
  } catch (e) {}
}

process.env.APP_DATA_PATH = baseDataDir;

async function startBackend() {
  const possibleServerScripts = [
    path.join(__dirname, '..', 'server.js'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'server.js'),
    path.join(process.resourcesPath || '', 'app', 'server.js'),
  ];
  const serverScript = possibleServerScripts.find(s => fs.existsSync(s)) || path.join(__dirname, '..', 'server.js');
  console.log('[Electron] Iniciando motor de vídeo en proceso:', serverScript);
  
  try {
    const fileUrl = pathToFileURL(serverScript).href;
    await import(fileUrl);
    console.log('[Electron] Backend Express & WebSockets iniciado correctamente en proceso.');
  } catch (err) {
    console.error('[Electron] Error al iniciar backend en proceso:', err);
  }
}

function waitForServer(url, timeout = 12000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start > timeout) {
        return reject(new Error('Backend server startup timeout'));
      }
      setTimeout(check, 250);
    };

    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Batch Video Studio AI',
    backgroundColor: '#050811',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true
    }
  });

  // Forzar que el título de la ventana de la aplicación siempre sea Batch Video Studio AI
  mainWindow.setTitle('Batch Video Studio AI');
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
    mainWindow.setTitle('Batch Video Studio AI');
  });

  // Abrir enlaces externos en el navegador predeterminado del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.warn('[Electron] Falló carga de URL:', errorCode, errorDescription, validatedURL);
    if (errorCode === -102) { // ERR_CONNECTION_REFUSED
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://localhost:${PORT}`);
        }
      }, 800);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  try {
    await waitForServer(`http://localhost:${PORT}/api/status`, 12000);
    console.log('[Electron] Backend listo. Cargando interfaz...');
    
    if (isDev) {
      try {
        await waitForServer('http://localhost:5173', 1500);
        mainWindow.loadURL('http://localhost:5173');
        return;
      } catch (e) {
        // Fallback a puerto 3001 si vite dev server no está abierto
      }
    }
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } catch (err) {
    console.error('[Electron] Error esperando backend:', err);
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }
}

app.whenReady().then(async () => {
  await startBackend();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
