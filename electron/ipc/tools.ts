import { ipcMain } from 'electron'
import { detectTools, installTool, uninstallTool, cancelInstall, getInstallStates } from '../lib/tools'
import { listDbServices, serviceAction } from '../lib/services'
import type { ToolInstallOptions } from '../../src/shared/types'

export function registerToolsHandlers() {
  ipcMain.handle('tools:detect', () => detectTools())
  ipcMain.handle('tools:install', (_e, toolId: string, options?: ToolInstallOptions) => installTool(toolId, options))
  ipcMain.handle('tools:uninstall', (_e, toolId: string) => uninstallTool(toolId))
  ipcMain.handle('tools:cancelInstall', (_e, toolId: string) => cancelInstall(toolId))
  ipcMain.handle('tools:installStates', () => getInstallStates())
  ipcMain.handle('services:list', () => listDbServices())
  ipcMain.handle('services:action', (_e, name: string, action: 'start' | 'stop') => serviceAction(name, action))
}
