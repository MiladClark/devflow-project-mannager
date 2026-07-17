import { app, BrowserWindow } from 'electron'
import path from 'node:path'
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
import { registerBuildHandlers } from './ipc/build'
import { stopProxy } from './lib/proxy'
import { disposeAll as disposeAllTerminals } from './lib/terminal'
import { applyLoginItemSettings, autoStartProjects } from './lib/autostart'
import { createTray, refreshTrayMenu, destroyTray } from './lib/tray'
import { loadBrandIcon, resolveBrandIconPath } from './lib/icon'
import { startNotifications, stopNotifications } from './lib/notify'
import { checkForUpdates } from './lib/updates'
import { isQuittingForUpdate } from './lib/updater'
import { getLicenseState } from './lib/licensing'
import { store } from './lib/store'

let win: BrowserWindow | null = null
let quitting = false

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
}

// required for Windows toast notifications in packaged builds.
// NOTE: distinct from any older installed build's id so the Windows taskbar
// resolves THIS app's own window icon instead of a stale cached AUMID icon.
app.setAppUserModelId('com.devtune.devflowmanager')

// dev-only: allow driving the app over CDP for integration checks
if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('remote-debugging-port', '9333')
}

const startHidden = process.argv.includes('--hidden')

/** Frameless custom title bar on Windows/Linux; native chrome on macOS. */
const FRAMELESS = process.platform === 'win32' || process.platform === 'linux'

// DevFlow brand icon for window title bar + taskbar.
function createWindow() {
  const brandIcon = loadBrandIcon()
  // On Windows, passing the .ico PATH lets the OS pick the right multi-res frame
  // for the taskbar; the nativeImage is used as a fallback for setIcon().
  const brandIconPath = resolveBrandIconPath()
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
    ...(brandIconPath ? { icon: brandIconPath } : brandIcon ? { icon: brandIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  attachWindowStateEvents(win)
  attachLicenseFocusHandler(win)

  if (brandIcon) {
    win.setIcon(brandIcon)
    win.once('ready-to-show', () => {
      win?.setIcon(brandIcon)
    })
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('close', (e) => {
    if (isQuittingForUpdate()) return
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
  if (!gotSingleInstanceLock) return
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
  registerBuildHandlers()
  createWindow()
  startStatsPolling()
  applyLoginItemSettings()
  startNotifications(() => win)
  // update check on startup — notifies for any available update, required or not
  setTimeout(async () => {
    if (!store.getSettings().notifyUpdates) return
    const res = await checkForUpdates(getLicenseState().serverUrl)
    if (res.ok && res.updateAvailable && res.latest) {
      notifyUpdateAvailable({
        version: res.latest.version,
        required: !!res.required,
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
  if (isQuittingForUpdate()) return
  disposeAllTerminals()
  stopProxy()
  void stopAll()
})
