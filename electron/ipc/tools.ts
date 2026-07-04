import { ipcMain, BrowserWindow } from 'electron'
import { detectTools, installTool } from '../lib/tools'
import { listDbServices, serviceAction } from '../lib/services'
import type { LogLine } from '../../src/shared/types'

export function registerToolsHandlers() {
  ipcMain.handle('tools:detect', () => detectTools())
  ipcMain.handle('tools:install', (_e, toolId: string) =>
    installTool(toolId, (line: LogLine) => {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.send('tools:installLog', toolId, line)
    }),
  )
  ipcMain.handle('services:list', () => listDbServices())
  ipcMain.handle('services:action', (_e, name: string, action: 'start' | 'stop') => serviceAction(name, action))
}
