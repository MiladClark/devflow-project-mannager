import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { registerProjectHandlers } from './ipc/projects'
import { registerRunnerHandlers, stopAll, onRuntimeChange } from './ipc/runner'
import { registerScaffoldHandlers } from './ipc/scaffold'
import { registerSystemHandlers, startStatsPolling, stopStatsPolling } from './ipc/system'
import { registerDockerHandlers } from './ipc/docker'
import { registerConnectionHandlers } from './ipc/connections'
import { registerToolsHandlers } from './ipc/tools'
import { registerLicensingHandlers, attachLicenseFocusHandler } from './ipc/licensing'
import { registerUpdateHandlers, notifyUpdateAvailable } from './ipc/updates'
import { registerBackupHandlers } from './ipc/backup'
import { registerEnvHandlers } from './ipc/envfiles'
import { registerGitHandlers } from './ipc/git'
import { registerHealthHandlers } from './ipc/health'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerWindowHandlers, attachWindowStateEvents } from './ipc/window'
import { registerComposeHandlers } from './ipc/compose'
import { registerProxyHandlers } from './ipc/proxy'
import { stopProxy } from './lib/proxy'
import { disposeAll as disposeAllTerminals } from './lib/terminal'
import { applyLoginItemSettings, autoStartProjects } from './lib/autostart'
import { createTray, refreshTrayMenu, destroyTray } from './lib/tray'
import { startNotifications, stopNotifications } from './lib/notify'
import { checkForUpdates } from './lib/updates'
import { getLicenseState } from './lib/licensing'
import { store } from './lib/store'

let win: BrowserWindow | null = null
let quitting = false

// required for Windows toast notifications in packaged builds
app.setAppUserModelId('com.devflow.manager')

// dev-only: allow driving the app over CDP for integration checks
if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('remote-debugging-port', '9333')
}

const startHidden = process.argv.includes('--hidden')

// DevFlow brand icon for the window title bar + taskbar (esp. in dev, where the
// packaged exe icon isn't used). Packaged builds embed the icon via electron-builder.
function brandIconPath(): string | null {
  const candidates = [
    path.join(app.getAppPath(), 'build', 'icon.png'), // dev
    path.join(process.resourcesPath ?? '', 'icon.png'), // packaged (extraResources)
  ]
  return candidates.find((p) => fs.existsSync(p)) ?? null
}

/** Frameless custom title bar on Windows/Linux; native chrome on macOS. */
const FRAMELESS = process.platform === 'win32' || process.platform === 'linux'

function createWindow() {
  const icon = brandIconPath()
  win = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b1120',
    autoHideMenuBar: true,
    title: 'DevFlow Manager',
    show: !startHidden,
    frame: !FRAMELESS,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  attachWindowStateEvents(win)
  attachLicenseFocusHandler(win)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('close', (e) => {
    // hide to tray instead of closing when enabled (real quit sets `quitting`)
    if (store.getSettings().closeToTray && !quitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(async () => {
  registerProjectHandlers()
  registerRunnerHandlers()
  registerScaffoldHandlers()
  registerSystemHandlers()
  registerDockerHandlers()
  registerConnectionHandlers()
  registerToolsHandlers()
  registerLicensingHandlers()
  registerUpdateHandlers()
  registerBackupHandlers()
  registerEnvHandlers()
  registerGitHandlers()
  registerHealthHandlers()
  registerTerminalHandlers()
  registerWindowHandlers()
  registerComposeHandlers()
  registerProxyHandlers()
  createWindow()
  startStatsPolling()
  applyLoginItemSettings()
  startNotifications(() => win)
  // required update gate on startup
  setTimeout(async () => {
    if (!store.getSettings().notifyUpdates) return
    const res = await checkForUpdates(getLicenseState().serverUrl)
    if (res.ok && res.updateAvailable && res.required && res.latest) {
      notifyUpdateAvailable({
        version: res.latest.version,
        required: true,
        releaseNotes: res.latest.releaseNotes,
      })
    }
  }, 5000)
  await createTray(() => win)
  onRuntimeChange(() => refreshTrayMenu())
  void autoStartProjects()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  stopStatsPolling()
  stopNotifications()
  destroyTray()
  await stopAll()
  app.quit()
})

app.on('before-quit', () => {
  quitting = true
  disposeAllTerminals()
  stopProxy()
  void stopAll()
})
