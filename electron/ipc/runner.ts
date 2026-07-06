import { ipcMain, shell } from 'electron'
import { spawn, ChildProcess, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { BulkResult, LogLine, Project, RuntimeInfo, StartResult, RunActionResult } from '../../src/shared/types'
import { store } from '../lib/store'
import { broadcast, activity } from '../lib/broadcast'
import { isPortFree } from '../lib/ports'
import { getPortOwner } from '../lib/portOwner'
import { preflight, resolvePackageManager, pmInstall } from '../lib/pkgmanager'
import { resolveNodeEnv, wrapCommand } from '../lib/nodeVersion'
import { registerProxy, unregisterProxy } from '../lib/proxy'
import { composeUp } from '../lib/compose'
import { scriptCommand, listProjectScripts } from '../lib/scripts'

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

type RuntimeListener = (projectId: string, info: RuntimeInfo, project?: Project) => void
const runtimeListeners: RuntimeListener[] = []

/** Used by tray menu / notifications to react to runtime changes. */
export function onRuntimeChange(cb: RuntimeListener) {
  runtimeListeners.push(cb)
}

export function getRuntimeSnapshot(): Record<string, RuntimeInfo> {
  return Object.fromEntries(runtime)
}

function setRuntime(projectId: string, patch: Partial<RuntimeInfo>) {
  const cur = runtime.get(projectId) ?? { status: 'stopped' as const }
  const next = { ...cur, ...patch }
  runtime.set(projectId, next)
  broadcast('runner:status', projectId, next)
  const p = store.getProject(projectId)
  for (const cb of runtimeListeners) cb(projectId, next, p)
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

async function spawnEnv(p: Project, extra: Record<string, string> = {}): Promise<{ env: NodeJS.ProcessEnv; cmdPrefix: string; warning?: string }> {
  const node = await resolveNodeEnv(p)
  if (node.warning) pushLog(p.id, 'sys', node.warning)
  return {
    env: { ...process.env, ...node.env, ...p.env, ...extra, NO_COLOR: '1', FORCE_COLOR: '0' },
    cmdPrefix: node.prefix,
    warning: node.warning,
  }
}

async function applyRunningUrl(projectId: string, port: number, p: Project) {
  const proxy = await registerProxy(projectId, port)
  const url = proxy.url ?? `http://localhost:${port}/`
  setRuntime(projectId, { status: 'running', port, url })
  if (proxy.url) {
    activity('ok', 'Server Started', `${p.name} → ${proxy.url}`)
  } else if (store.getSettings().localDomainsEnabled && proxy.error) {
    pushLog(projectId, 'sys', `Local HTTPS: ${proxy.error}`)
    activity('warn', 'Local HTTPS unavailable', proxy.error)
    activity('ok', 'Server Started', `${p.name} on http://localhost:${port}/`)
  } else {
    activity('ok', 'Server Started', `${p.name} on port ${port}`)
  }
}

function killTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    execFile('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, () => resolve())
  })
}

export async function startProject(projectId: string): Promise<StartResult> {
  const p = store.getProject(projectId)
  if (!p) return { ok: false, error: 'Project not found' }
  if (procs.has(projectId)) return { ok: false, error: 'Project is already running' }
  if (!p.runCommand) return { ok: false, error: 'No run command configured' }

  // pre-flight: Node / package manager / dependencies must be ready
  const issue = await preflight(p, false)
  if (issue) return { ok: false, error: issue.message, issue }

  // pre-flight: surface an occupied port with its owning process
  const wantedPort = p.preferredPort ?? p.defaultPort
  if (wantedPort && !(await isPortFree(wantedPort))) {
    const owner = await getPortOwner(wantedPort)
    if (owner) {
      return {
        ok: false,
        error: `Port ${wantedPort} is in use by ${owner.processName} (PID ${owner.pid}).`,
        portConflict: owner,
      }
    }
    return { ok: false, error: `Port ${wantedPort} is already in use.` }
  }

  const { cmd, extraEnv } = buildRunCommand(p)

  if (p.composeAutoStart) {
    const up = await composeUp(projectId)
    if (!up.ok) pushLog(projectId, 'sys', `Compose stack: ${up.error ?? 'failed to start'}`)
  }

  const { env, cmdPrefix } = await spawnEnv(p, extraEnv)
  const fullCmd = wrapCommand(cmdPrefix, cmd)
  pushLog(projectId, 'sys', `$ ${fullCmd}`)

  const child = spawn(fullCmd, {
    cwd: p.path,
    shell: true,
    windowsHide: true,
    env,
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
        void applyRunningUrl(projectId, port, p)
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
      void applyRunningUrl(projectId, port, p)
    }
  }, 25000)

  child.on('exit', (code) => {
    clearTimeout(rp.startupTimer)
    void unregisterProxy(projectId)
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

export async function stopProjectById(projectId: string): Promise<{ ok: boolean; error?: string }> {
  return stopProject(projectId)
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

async function buildProject(projectId: string): Promise<RunActionResult> {
  const p = store.getProject(projectId)
  if (!p) return { ok: false, error: 'Project not found' }
  if (procs.has(projectId)) return { ok: false, error: 'Stop the dev server before building' }

  // pre-flight: Node / package manager / dependencies / build script
  const issue = await preflight(p, true)
  if (issue) {
    pushLog(projectId, 'sys', `Build blocked: ${issue.message}`)
    return { ok: false, error: issue.message, issue }
  }

  pushLog(projectId, 'sys', `$ ${p.buildCommand}`)
  const { env, cmdPrefix } = await spawnEnv(p)
  const fullCmd = wrapCommand(cmdPrefix, p.buildCommand)
  const child = spawn(fullCmd, {
    cwd: p.path,
    shell: true,
    windowsHide: true,
    env,
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
      // tell the user where the compiled output landed
      const outPath = path.join(p.path, p.outputDir)
      const outExists = fs.existsSync(outPath)
      pushLog(projectId, 'sys', outExists ? `Build output: ${outPath}` : `Build finished (output folder "${p.outputDir}" not found).`)
      activity('ok', 'Build Successful', outExists ? `${p.name} → ${p.outputDir}` : p.name)
      if (outExists && store.getSettings().openOutputAfterBuild) {
        void shell.openPath(outPath)
      }
    } else {
      setRuntime(projectId, { status: 'error', pid: undefined, exitCode: code })
      activity('err', 'Build Failed', `${p.name} exited with code ${code}`)
    }
  })
  return { ok: true }
}

/** Run `<pm> install` for a project, streaming output to its log. */
async function installDeps(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const p = store.getProject(projectId)
  if (!p) return { ok: false, error: 'Project not found' }
  if (procs.has(projectId)) return { ok: false, error: 'Stop the running process first' }

  const pm = resolvePackageManager(p.path)
  const cmd = pmInstall(pm)
  pushLog(projectId, 'sys', `$ ${cmd}`)
  setRuntime(projectId, { status: 'building', kind: 'build', startedAt: Date.now() })
  activity('info', 'Installing dependencies', `${p.name} (${pm})`)

  const { env, cmdPrefix } = await spawnEnv(p)
  const fullCmd = wrapCommand(cmdPrefix, cmd)

  return new Promise((resolve) => {
    const child = spawn(fullCmd, {
      cwd: p.path,
      shell: true,
      windowsHide: true,
      env,
    })
    const rp: RunningProc = { child, kind: 'build', expectingExit: false }
    procs.set(projectId, rp)
    child.stdout?.on('data', (c: Buffer) => pushLog(projectId, 'out', c.toString()))
    child.stderr?.on('data', (c: Buffer) => pushLog(projectId, 'err', c.toString()))
    child.on('exit', (code) => {
      procs.delete(projectId)
      setRuntime(projectId, { status: 'stopped', pid: undefined, exitCode: code })
      if (code === 0) {
        pushLog(projectId, 'sys', 'Dependencies installed.')
        activity('ok', 'Dependencies installed', p.name)
        resolve({ ok: true })
      } else {
        activity('err', 'Install failed', `${p.name} (exit ${code})`)
        resolve({ ok: false, error: `${cmd} exited with code ${code}` })
      }
    })
    child.on('error', (err) => {
      procs.delete(projectId)
      setRuntime(projectId, { status: 'error', pid: undefined })
      resolve({ ok: false, error: err.message })
    })
  })
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

async function runScript(projectId: string, scriptName: string): Promise<RunActionResult> {
  const p = store.getProject(projectId)
  if (!p) return { ok: false, error: 'Project not found' }
  const cmd = scriptCommand(p.path, scriptName)
  if (!cmd) return { ok: false, error: `Script "${scriptName}" not found.` }

  const devRunning = procs.has(projectId) && procs.get(projectId)?.kind === 'dev'
  if (devRunning) {
    return { ok: false, error: 'Stop the dev server before running another long script, or use the terminal tab.' }
  }

  const issue = await preflight(p, false)
  if (issue) return { ok: false, error: issue.message, issue }

  const { env, cmdPrefix } = await spawnEnv(p)
  const fullCmd = wrapCommand(cmdPrefix, cmd)
  pushLog(projectId, 'sys', `$ ${fullCmd}`)
  const child = spawn(fullCmd, { cwd: p.path, shell: true, windowsHide: true, env })
  const rp: RunningProc = { child, kind: 'build', expectingExit: false }
  procs.set(projectId, rp)
  setRuntime(projectId, { status: 'building', kind: 'build', pid: child.pid, startedAt: Date.now() })
  activity('info', `Script: ${scriptName}`, p.name)

  child.stdout?.on('data', (c: Buffer) => pushLog(projectId, 'out', c.toString()))
  child.stderr?.on('data', (c: Buffer) => pushLog(projectId, 'err', c.toString()))
  child.on('exit', (code) => {
    procs.delete(projectId)
    pushLog(projectId, 'sys', `Script "${scriptName}" finished with code ${code ?? 'null'}`)
    setRuntime(projectId, { status: code === 0 ? 'stopped' : 'error', pid: undefined, exitCode: code })
    if (code === 0) activity('ok', `Script: ${scriptName}`, p.name)
    else activity('err', `Script failed: ${scriptName}`, `${p.name} (exit ${code})`)
  })
  return { ok: true }
}

const STAGGER_MS = 800

export async function startMany(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: [] }
  for (const id of ids) {
    const res = await startProject(id)
    if (res.ok) result.ok++
    else result.failed.push({ id, error: res.error ?? 'Start failed', portConflict: res.portConflict })
    await new Promise((r) => setTimeout(r, STAGGER_MS))
  }
  if (result.ok > 0) activity('ok', 'Bulk Start', `${result.ok} project(s) started`)
  return result
}

export async function stopMany(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: [] }
  for (const id of ids) {
    const res = await stopProject(id)
    if (res.ok) result.ok++
    else result.failed.push({ id, error: res.error ?? 'Stop failed' })
  }
  if (result.ok > 0) activity('info', 'Bulk Stop', `${result.ok} project(s) stopped`)
  return result
}

export async function stopAllRunning(): Promise<BulkResult> {
  const ids = [...procs.keys()]
  return stopMany(ids)
}

export function registerRunnerHandlers() {
  ipcMain.handle('runner:start', (_e, id: string) => startProject(id))
  ipcMain.handle('runner:stop', (_e, id: string) => stopProject(id))
  ipcMain.handle('runner:restart', async (_e, id: string) => {
    if (procs.has(id)) await stopProject(id)
    return startProject(id)
  })
  ipcMain.handle('runner:build', (_e, id: string) => buildProject(id))
  ipcMain.handle('runner:installDeps', (_e, id: string) => installDeps(id))
  ipcMain.handle('runner:runScript', (_e, id: string, script: string) => runScript(id, script))
  ipcMain.handle('runner:startMany', (_e, ids: string[]) => startMany(ids))
  ipcMain.handle('runner:stopMany', (_e, ids: string[]) => stopMany(ids))
  ipcMain.handle('runner:stopAll', () => stopAllRunning())
  ipcMain.handle('runner:listScripts', (_e, id: string) => {
    const p = store.getProject(id)
    if (!p) return []
    return listProjectScripts(p.path)
  })
  ipcMain.handle('runner:getRuntime', () => Object.fromEntries(runtime))
  ipcMain.handle('runner:getLogs', (_e, id: string) => logs.get(id) ?? [])
  ipcMain.handle('runner:clearLogs', (_e, id: string) => {
    logs.set(id, [])
    return true
  })
}
