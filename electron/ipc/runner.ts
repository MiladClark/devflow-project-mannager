import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess, execFile } from 'node:child_process'
import type { LogLine, Project, RuntimeInfo } from '../../src/shared/types'
import { store } from '../lib/store'

interface RunningProc {
  child: ChildProcess
  kind: 'dev' | 'build'
  expectingExit: boolean
  startupTimer?: NodeJS.Timeout
}

const procs = new Map<string, RunningProc>()
const runtime = new Map<string, RuntimeInfo>()
const logs = new Map<string, LogLine[]>()
const MAX_LOG_LINES = 2000

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g
const URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d+)/

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

function setRuntime(projectId: string, patch: Partial<RuntimeInfo>) {
  const cur = runtime.get(projectId) ?? { status: 'stopped' as const }
  const next = { ...cur, ...patch }
  runtime.set(projectId, next)
  broadcast('runner:status', projectId, next)
}

function pushLog(projectId: string, stream: LogLine['stream'], text: string) {
  const buf = logs.get(projectId) ?? []
  const lines = text
    .replace(ANSI_RE, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
  for (const line of lines) {
    const entry: LogLine = { ts: Date.now(), stream, text: line }
    buf.push(entry)
    broadcast('runner:log', projectId, entry)
  }
  if (buf.length > MAX_LOG_LINES) buf.splice(0, buf.length - MAX_LOG_LINES)
  logs.set(projectId, buf)
}

function activity(level: 'ok' | 'info' | 'warn' | 'err', title: string, message: string) {
  const ev = store.addActivity({ level, title, message })
  broadcast('activity:event', ev)
}

function buildRunCommand(p: Project): { cmd: string; extraEnv: Record<string, string> } {
  let cmd = p.runCommand || 'npm run dev'
  const extraEnv: Record<string, string> = {}
  if (p.preferredPort) {
    if (p.framework === 'next') {
      cmd += ` -- -p ${p.preferredPort}`
    } else if (p.framework === 'vite' || p.framework === 'vue') {
      cmd += ` -- --port ${p.preferredPort} --strictPort`
    } else {
      extraEnv.PORT = String(p.preferredPort)
    }
  }
  return { cmd, extraEnv }
}

function killTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    execFile('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, () => resolve())
  })
}

function startProject(projectId: string): { ok: boolean; error?: string } {
  const p = store.getProject(projectId)
  if (!p) return { ok: false, error: 'Project not found' }
  if (procs.has(projectId)) return { ok: false, error: 'Project is already running' }
  if (!p.runCommand) return { ok: false, error: 'No run command configured' }

  const { cmd, extraEnv } = buildRunCommand(p)
  pushLog(projectId, 'sys', `$ ${cmd}`)

  const child = spawn(cmd, {
    cwd: p.path,
    shell: true,
    windowsHide: true,
    env: { ...process.env, ...p.env, ...extraEnv, NO_COLOR: '1', FORCE_COLOR: '0' },
  })

  const rp: RunningProc = { child, kind: 'dev', expectingExit: false }
  procs.set(projectId, rp)
  setRuntime(projectId, {
    status: 'starting',
    kind: 'dev',
    pid: child.pid,
    port: undefined,
    url: undefined,
    startedAt: Date.now(),
    exitCode: undefined,
  })
  activity('info', 'Server Starting', p.name)

  const onOutput = (stream: 'out' | 'err') => (chunk: Buffer) => {
    const text = chunk.toString()
    pushLog(projectId, stream, text)
    const cur = runtime.get(projectId)
    if (cur?.status === 'starting') {
      const m = text.match(URL_RE)
      if (m) {
        const port = Number(m[1])
        clearTimeout(rp.startupTimer)
        setRuntime(projectId, { status: 'running', port, url: `http://localhost:${port}/` })
        activity('ok', 'Server Started', `${p.name} on port ${port}`)
      }
    }
  }
  child.stdout?.on('data', onOutput('out'))
  child.stderr?.on('data', onOutput('err'))

  // Fallback: if no URL was detected but the process is alive, assume it is up.
  rp.startupTimer = setTimeout(() => {
    const cur = runtime.get(projectId)
    if (cur?.status === 'starting' && procs.get(projectId)?.child === child) {
      const port = p.preferredPort ?? p.defaultPort
      setRuntime(projectId, { status: 'running', port, url: `http://localhost:${port}/` })
      activity('ok', 'Server Started', `${p.name} (assumed port ${port})`)
    }
  }, 25000)

  child.on('exit', (code) => {
    clearTimeout(rp.startupTimer)
    procs.delete(projectId)
    const expected = rp.expectingExit
    pushLog(projectId, 'sys', `Process exited with code ${code ?? 'null'}`)
    if (expected || code === 0) {
      setRuntime(projectId, { status: 'stopped', pid: undefined, port: undefined, url: undefined, exitCode: code })
      if (expected) activity('info', 'Server Stopped', p.name)
    } else {
      setRuntime(projectId, { status: 'error', pid: undefined, port: undefined, url: undefined, exitCode: code })
      activity('err', 'Server Crashed', `${p.name} exited with code ${code}`)
    }
  })
  child.on('error', (err) => {
    pushLog(projectId, 'sys', `Failed to start: ${err.message}`)
  })

  return { ok: true }
}

async function stopProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const rp = procs.get(projectId)
  if (!rp || !rp.child.pid) return { ok: false, error: 'Project is not running' }
  rp.expectingExit = true
  pushLog(projectId, 'sys', 'Stopping process tree...')
  await killTree(rp.child.pid)
  // wait for the exit event to clean up (max 5s)
  for (let i = 0; i < 50 && procs.has(projectId); i++) {
    await new Promise((r) => setTimeout(r, 100))
  }
  return { ok: true }
}

function buildProject(projectId: string): { ok: boolean; error?: string } {
  const p = store.getProject(projectId)
  if (!p) return { ok: false, error: 'Project not found' }
  if (procs.has(projectId)) return { ok: false, error: 'Stop the dev server before building' }
  if (!p.buildCommand) return { ok: false, error: 'No build command configured' }

  pushLog(projectId, 'sys', `$ ${p.buildCommand}`)
  const child = spawn(p.buildCommand, {
    cwd: p.path,
    shell: true,
    windowsHide: true,
    env: { ...process.env, ...p.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  const rp: RunningProc = { child, kind: 'build', expectingExit: false }
  procs.set(projectId, rp)
  setRuntime(projectId, { status: 'building', kind: 'build', pid: child.pid, startedAt: Date.now() })
  activity('info', 'Build Started', p.name)

  child.stdout?.on('data', (c: Buffer) => pushLog(projectId, 'out', c.toString()))
  child.stderr?.on('data', (c: Buffer) => pushLog(projectId, 'err', c.toString()))
  child.on('exit', (code) => {
    procs.delete(projectId)
    pushLog(projectId, 'sys', `Build finished with code ${code ?? 'null'}`)
    if (code === 0) {
      setRuntime(projectId, { status: 'stopped', pid: undefined, exitCode: code })
      activity('ok', 'Build Successful', p.name)
    } else {
      setRuntime(projectId, { status: 'error', pid: undefined, exitCode: code })
      activity('err', 'Build Failed', `${p.name} exited with code ${code}`)
    }
  })
  return { ok: true }
}

export function getRunningDevPids(): Map<string, number> {
  const out = new Map<string, number>()
  for (const [id, rp] of procs) {
    if (rp.child.pid) out.set(id, rp.child.pid)
  }
  return out
}

export async function stopAll() {
  for (const [id] of procs) {
    await stopProject(id)
  }
}

export function registerRunnerHandlers() {
  ipcMain.handle('runner:start', (_e, id: string) => startProject(id))
  ipcMain.handle('runner:stop', (_e, id: string) => stopProject(id))
  ipcMain.handle('runner:restart', async (_e, id: string) => {
    if (procs.has(id)) await stopProject(id)
    return startProject(id)
  })
  ipcMain.handle('runner:build', (_e, id: string) => buildProject(id))
  ipcMain.handle('runner:getRuntime', () => Object.fromEntries(runtime))
  ipcMain.handle('runner:getLogs', (_e, id: string) => logs.get(id) ?? [])
  ipcMain.handle('runner:clearLogs', (_e, id: string) => {
    logs.set(id, [])
    return true
  })
}
