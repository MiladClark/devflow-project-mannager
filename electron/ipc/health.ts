import { ipcMain } from 'electron'
import { queueScan, getReport } from '../lib/health'
import { store } from '../lib/store'

export function registerHealthHandlers() {
  ipcMain.handle('health:scan', (_e, projectId: string) => queueScan(projectId))
  ipcMain.handle('health:get', (_e, projectId: string) => getReport(projectId))
  ipcMain.handle('health:summaries', () => store.getHealthSummaries())
}
