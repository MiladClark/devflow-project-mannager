import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { getSystemStats, getProcessTreeStats } from '../lib/stats'
import { getDevProcesses, killDevProcess } from '../lib/devProcesses'
import { getRunningDevPids } from './runner'
import type { ProjectStats } from '../../src/shared/types'

let timer: NodeJS.Timeout | null = null
let polling = false

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

async function poll() {
  if (polling) return
  polling = true
  try {
    const sys = getSystemStats()
    const pids = getRunningDevPids()
    let perProject: Record<string, ProjectStats> = {}
    if (pids.size > 0) {
      const stats = await getProcessTreeStats([...pids.values()])
      for (const [projectId, pid] of pids) {
        const s = stats.get(pid)
        if (s) perProject[projectId] = s
      }
    }
    broadcast('system:stats', sys, perProject)
  } finally {
    polling = false
  }
}

export function startStatsPolling() {
  if (timer) return
  timer = setInterval(poll, 2500)
  poll()
}

export function stopStatsPolling() {
  if (timer) clearInterval(timer)
  timer = null
}

export function registerSystemHandlers() {
  ipcMain.handle('system:openExternal', (_e, url: string) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })
  ipcMain.handle('system:pickFolder', async (e, title?: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const res = await dialog.showOpenDialog(win!, {
      title: title ?? 'Select a folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })
  ipcMain.handle('system:devProcesses', () => getDevProcesses())
  ipcMain.handle('system:killProcess', (_e, pid: number) => killDevProcess(pid))
}
