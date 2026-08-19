import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import * as path from 'path'
import { ServiceSupervisor, type ServiceStatus } from './services'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let supervisor: ServiceSupervisor | null = null
let lastStatus: ServiceStatus = { phase: 'starting', ready: false }

const isDev =
  process.env.NODE_ENV === 'development' ||
  process.env.UBAKA_ELECTRON_DEV === '1'

function createSplash(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 220,
    frame: false,
    resizable: false,
    movable: true,
    show: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{margin:0;font-family:Segoe UI,system-ui,sans-serif;background:#0b1c18;color:#e8f0ec;
    display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:12px}
  h1{font-size:18px;font-weight:600;margin:0;letter-spacing:.02em}
  p{margin:0;font-size:13px;color:#9bb0a8;text-align:center;max-width:340px;padding:0 16px}
  .spin{width:28px;height:28px;border:3px solid #3a3c4a;border-top-color:#e8e9ed;border-radius:50%;
    animation:s .8s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
</style></head>
<body>
  <div class="spin"></div>
  <h1>Ubaka Attendance</h1>
  <p id="status">Starting services…</p>
  <script>
    const el = document.getElementById('status');
    window.ubaka?.onServiceStatus?.((s) => {
      el.textContent = s.error || s.detail || s.phase || 'Starting…';
    });
  </script>
</body></html>`

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  return win
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Ubaka Attendance Tracking System',
  })

  if (isDev) {
    win.loadURL(process.env.UBAKA_DEV_URL || 'http://localhost:3000')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  }

  win.once('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

function broadcastStatus(status: ServiceStatus): void {
  lastStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('services:status', status)
  }
}

async function boot(): Promise<void> {
  ipcMain.handle('services:getStatus', () => lastStatus)

  splashWindow = createSplash()

  supervisor = new ServiceSupervisor()
  supervisor.onStatus(broadcastStatus)

  // Dev UI: skip bundled Postgres/API (use npm run dev:api), but always
  // start the fingerprint sidecar so the scanner is ready in Electron.
  if (isDev && process.env.UBAKA_SKIP_SERVICES === '1') {
    try {
      const fp = await supervisor.startFingerprint()
      broadcastStatus({
        phase: 'ready',
        detail: fp.fingerprintMock
          ? 'Dev UI ready (fingerprint mock).'
          : 'Dev UI ready. Fingerprint service started.',
        ready: true,
        fingerprintMock: fp.fingerprintMock,
      })
    } catch (err) {
      const message = (err as Error).message || String(err)
      broadcastStatus({
        phase: 'ready',
        detail: `Dev UI ready. Fingerprint service failed to start: ${message}`,
        ready: true,
        error: message,
      })
    }
    mainWindow = createMainWindow()
    splashWindow.close()
    splashWindow = null
    return
  }

  try {
    const status = await supervisor.startAll()
    broadcastStatus(status)
    mainWindow = createMainWindow()
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    if (status.fingerprintMock && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Fingerprint hardware unavailable',
        message:
          'Windows ZKFinger DLLs were not found under resources/sdk/windows. ' +
          'The app is running with mock fingerprint mode. ' +
          'Copy libzkfp.dll (and related SDK files) there and restart for Live20R support.',
      })
    }
  } catch (err) {
    const message = (err as Error).message || String(err)
    broadcastStatus({ phase: 'error', ready: false, error: message })
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    await dialog.showMessageBox({
      type: 'error',
      title: 'Ubaka failed to start',
      message: 'Could not start bundled services.',
      detail: message,
    })
    app.quit()
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    void boot()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let isCleaningUp = false

app.on('before-quit', event => {
  if (isCleaningUp || !supervisor) return
  event.preventDefault()
  isCleaningUp = true
  const s = supervisor
  supervisor = null
  void s.stopAll().finally(() => {
    app.exit(0)
  })
})
