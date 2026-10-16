const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let serverProcess = null;

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

process.env.APP_DATA_PATH = baseDataDir;

function startBackend() {
  const serverScript = path.join(__dirname, '..', 'server.js');
  
  console.log('[Electron] Iniciando motor de vídeo en segundo plano:', serverScript);
  
  serverProcess = fork(serverScript, [], {
    env: {
      ...process.env,
      PORT: PORT.toString(),
      APP_DATA_PATH: baseDataDir,
      ELECTRON_RUN: 'true'
    },
    stdio: 'pipe'
  });

  serverProcess.stdout?.on('data', (d) => {
    process.stdout.write(`[Server] ${d}`);
  });

  serverProcess.stderr?.on('data', (d) => {
    process.stderr.write(`[Server ERR] ${d}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[Electron] El servidor de vídeo finalizó con código: ${code}`);
  });
}

function waitForServer(url, timeout = 15000) {
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
      setTimeout(check, 300);
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  try {
    await waitForServer(`http://localhost:${PORT}/api/status`, 12000);
    console.log('[Electron] Backend listo. Cargando interfaz...');
    
    if (isDev) {
      try {
        await waitForServer('http://localhost:5173', 2500);
        mainWindow.loadURL('http://localhost:5173');
        return;
      } catch (e) {
        // Fallback a puerto 3001
      }
    }
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } catch (err) {
    console.error('[Electron] Error conectando con el backend:', err);
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function cleanup() {
  if (serverProcess) {
    console.log('[Electron] Deteniendo backend...');
    try {
      serverProcess.kill();
    } catch (e) {
      // ignore
    }
    serverProcess = null;
  }
}

app.on('before-quit', cleanup);
app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
