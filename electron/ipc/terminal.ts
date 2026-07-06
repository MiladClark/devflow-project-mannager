import { ipcMain } from 'electron'
import type { TermShell } from '../../src/shared/types'
import {
  createSession,
  writeSession,
  resizeSession,
  disposeSession,
  listSessions,
  getBuffer,
  availableShells,
} from '../lib/terminal'

export function registerTerminalHandlers() {
  ipcMain.handle(
    'term:create',
    (_e, opts: { projectId?: string; cwd: string; shell: TermShell; cols: number; rows: number }) =>
      createSession(opts),
  )
  // high-frequency fire-and-forget — deliberate exception to the invoke pattern
  ipcMain.on('term:write', (_e, sessionId: string, data: string) => writeSession(sessionId, data))
  ipcMain.handle('term:resize', (_e, sessionId: string, cols: number, rows: number) =>
    resizeSession(sessionId, cols, rows),
  )
  ipcMain.handle('term:dispose', (_e, sessionId: string) => disposeSession(sessionId))
  ipcMain.handle('term:list', (_e, projectId?: string) => listSessions(projectId))
  ipcMain.handle('term:getBuffer', (_e, sessionId: string) => getBuffer(sessionId))
  ipcMain.handle('term:shells', () => availableShells())
}
