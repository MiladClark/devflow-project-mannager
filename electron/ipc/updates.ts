import { BrowserWindow, ipcMain } from 'electron'
import {
  cancelUpdate,
  fetchLatestUpdate,
  getPendingUpdate,
  resetUpdateState,
  setUpdateProgressHandler,
  startUpdate,
  type UpdateProgress,
} from '../lib/updater'
import { checkForUpdates } from '../lib/updates'
import { getLicenseState } from '../lib/licensing'

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerUpdateHandlers() {
  setUpdateProgressHandler((p: UpdateProgress) => {
    broadcast('updates:progress', p)
  })

  ipcMain.handle('updates:check', () => checkForUpdates(getLicenseState().serverUrl))

  ipcMain.handle('updates:fetch', async () => {
    const res = await fetchLatestUpdate()
    if (res.ok && res.pending) {
      broadcast('updates:available', {
        version: res.pending.version,
        required: !!res.result.required,
        releaseNotes: res.result.latest?.releaseNotes,
      })
    }
    return res
  })

  ipcMain.handle('updates:pending', () => getPendingUpdate())

  ipcMain.handle('updates:start', (_e, version?: string) => startUpdate(version))

  ipcMain.handle('updates:cancel', () => {
    const res = cancelUpdate()
    if (res.ok) resetUpdateState()
    return res
  })
}

export function notifyUpdateAvailable(payload: {
  version: string
  required: boolean
  releaseNotes?: string | null
}) {
  broadcast('updates:available', payload)
}
