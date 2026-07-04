import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { registerProjectHandlers } from './ipc/projects'
import { registerRunnerHandlers, stopAll } from './ipc/runner'
import { registerScaffoldHandlers } from './ipc/scaffold'
import { registerSystemHandlers, startStatsPolling, stopStatsPolling } from './ipc/system'
import { registerDockerHandlers } from './ipc/docker'
import { registerConnectionHandlers } from './ipc/connections'
import { registerToolsHandlers } from './ipc/tools'

let win: BrowserWindow | null = null

// dev-only: allow driving the app over CDP for integration checks
if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('remote-debugging-port', '9333')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b1120',
    autoHideMenuBar: true,
    title: 'DevFlow Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(() => {
  registerProjectHandlers()
  registerRunnerHandlers()
  registerScaffoldHandlers()
  registerSystemHandlers()
  registerDockerHandlers()
  registerConnectionHandlers()
  registerToolsHandlers()
  createWindow()
  startStatsPolling()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  stopStatsPolling()
  await stopAll()
  app.quit()
})

app.on('before-quit', () => {
  void stopAll()
})
