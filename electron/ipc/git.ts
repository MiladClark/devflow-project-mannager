import { ipcMain } from 'electron'
import type { GitStatus } from '../../src/shared/types'
import { store } from '../lib/store'
import {
  getGitStatus,
  gitInit,
  gitStage,
  gitUnstage,
  gitCommit,
  gitPull,
  gitPush,
  gitFetch,
  gitAddRemote,
} from '../lib/git'

function projectPath(projectId: string): string | null {
  return store.getProject(projectId)?.path ?? null
}

async function statusAll(): Promise<Record<string, GitStatus>> {
  const projects = store.getProjects()
  const out: Record<string, GitStatus> = {}
  // limit concurrency — git spawns a process per repo
  const queue = [...projects]
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length > 0) {
      const p = queue.shift()!
      out[p.id] = await getGitStatus(p.path)
    }
  })
  await Promise.all(workers)
  return out
}

export function registerGitHandlers() {
  ipcMain.handle('git:status', (_e, projectId: string, opts?: { refresh?: boolean }) => {
    const cwd = projectPath(projectId)
    if (!cwd) return null
    return getGitStatus(cwd, opts?.refresh ?? false)
  })
  ipcMain.handle('git:statusAll', () => statusAll())

  const mutation =
    (fn: (cwd: string, ...rest: any[]) => Promise<unknown>) =>
    (_e: unknown, projectId: string, ...rest: any[]) => {
      const cwd = projectPath(projectId)
      if (!cwd) return { ok: false, error: 'Project not found' }
      return fn(cwd, ...rest)
    }

  ipcMain.handle('git:init', mutation(gitInit))
  ipcMain.handle('git:stage', mutation(gitStage))
  ipcMain.handle('git:unstage', mutation(gitUnstage))
  ipcMain.handle('git:commit', mutation(gitCommit))
  ipcMain.handle('git:pull', mutation(gitPull))
  ipcMain.handle('git:push', mutation(gitPush))
  ipcMain.handle('git:fetch', mutation(gitFetch))
  ipcMain.handle('git:addRemote', mutation(gitAddRemote))
}
