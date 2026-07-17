import { execFile, spawn, execSync, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TOOLS, installCommandFor, uninstallCommandFor, type ToolDef } from '../../src/shared/tools'
import type { ToolStatus, LogLine, InstallState } from '../../src/shared/types'
import { broadcast } from './broadcast'

interface ExecResult {
  code: number | string
  stdout: string
  stderr: string
}

const SPAWN_OPTS: SpawnOptions = {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
}

let cachedInstallPath: string | undefined

/** Electron on Windows often misses the user PATH from the registry — refresh it for installs. */
function installEnv(): NodeJS.ProcessEnv {
  if (process.platform === 'win32' && cachedInstallPath === undefined) {
    try {
      const user = execSync(
        'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\',\'User\')"',
        { encoding: 'utf8', windowsHide: true },
      ).trim()
      const machine = execSync(
        'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\',\'Machine\')"',
        { encoding: 'utf8', windowsHide: true },
      ).trim()
      cachedInstallPath = [user, machine, process.env.PATH].filter(Boolean).join(';')
    } catch {
      cachedInstallPath = process.env.PATH ?? ''
    }
  }

  // GUI-launched apps on macOS don't source shell rc files, so launchd's PATH
  // often misses Homebrew — prepend its well-known install locations.
  if (process.platform === 'darwin' && cachedInstallPath === undefined) {
    const extra = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin'].filter((p) =>
      existsSync(p),
    )
    cachedInstallPath = [...extra, process.env.PATH].filter(Boolean).join(':')
  }

  return {
    ...process.env,
    ...(cachedInstallPath ? { PATH: cachedInstallPath } : {}),
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    CI: 'true',
    npm_config_loglevel: 'info',
    npm_config_progress: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
  }
}

/** PATH + cwd safe for detecting CLI tools (avoids broken shims in the app project folder). */
export function detectEnv(): NodeJS.ProcessEnv {
  const env = installEnv()
  if (process.platform === 'win32') {
    const npmBin = path.join(env.APPDATA ?? process.env.APPDATA ?? '', 'npm')
    if (npmBin && existsSync(npmBin)) {
      env.PATH = [npmBin, env.PATH].filter(Boolean).join(';')
    }
  } else if (process.platform === 'darwin') {
    const npmGlobalBin = path.join(os.homedir(), '.npm-global', 'bin')
    if (existsSync(npmGlobalBin)) {
      env.PATH = [npmGlobalBin, env.PATH].filter(Boolean).join(':')
    }
  }
  return env
}

function streamInstallOutput(state: InstallState, onTail: (text: string) => void, bumpActivity: () => void) {
  return (stream: LogLine['stream']) => (data: Buffer) => {
    bumpActivity()
    const text = data.toString()
    const parts = text.split(/\r|\n/).map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0 && text.trim()) {
      pushInstallLine(state, stream, text.trim())
      onTail(text.trim())
      return
    }
    for (const part of parts) {
      pushInstallLine(state, stream, part)
      onTail(part)
    }
  }
}

interface InstallLaunch {
  label: string
  hint?: string
  spawn: () => ChildProcess
}

function buildInstallLaunch(tool: ToolDef, cmd: string): InstallLaunch {
  const env = installEnv()

  if (tool.winget) {
    const args = [
      'install',
      '--id',
      tool.winget,
      '-e',
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
      '--verbose-logs',
    ]
    return {
      label: `winget ${args.join(' ')}`,
      hint: 'If nothing happens, check for a Windows Administrator (UAC) prompt behind this window.',
      spawn: () => spawn('winget', args, { ...SPAWN_OPTS, env, shell: true }),
    }
  }

  if (tool.installCmd?.startsWith('npm ')) {
    const args = [...tool.installCmd.split(/\s+/).slice(1), '--loglevel', 'info']
    return {
      label: `npm ${args.join(' ')}`,
      spawn: () => spawn('npm', args, { ...SPAWN_OPTS, env, shell: true }),
    }
  }

  return {
    label: cmd,
    spawn: () => spawn(cmd, { ...SPAWN_OPTS, env, shell: true }),
  }
}

function buildUninstallLaunch(tool: ToolDef, cmd: string): InstallLaunch {
  const env = installEnv()

  if (tool.winget) {
    const args = [
      'uninstall',
      '--id',
      tool.winget,
      '-e',
      '--accept-source-agreements',
      '--disable-interactivity',
      '--verbose-logs',
    ]
    return {
      label: `winget ${args.join(' ')}`,
      hint: 'If nothing happens, check for a Windows Administrator (UAC) prompt behind this window.',
      spawn: () => spawn('winget', args, { ...SPAWN_OPTS, env, shell: true }),
    }
  }

  if (tool.installCmd?.startsWith('npm ')) {
    const args = [...cmd.split(/\s+/).slice(1), '--loglevel', 'info']
    return {
      label: cmd,
      spawn: () => spawn('npm', args, { ...SPAWN_OPTS, env, shell: true }),
    }
  }

  return {
    label: cmd,
    spawn: () => spawn(cmd, { ...SPAWN_OPTS, env, shell: true }),
  }
}

function run(
  cmd: string,
  args: string[],
  timeoutMs = 8000,
  env: NodeJS.ProcessEnv = detectEnv(),
  cwd = os.homedir(),
): Promise<ExecResult> {
  return new Promise((resolve) => {
    // shell:true so .cmd/.bat shims (npm, pnpm, code) resolve on Windows
    execFile(cmd, args, { windowsHide: true, timeout: timeoutMs, shell: true, env, cwd }, (err, stdout, stderr) => {
      const code = err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0
      resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
  })
}

function expandEnv(p: string, env: NodeJS.ProcessEnv = process.env): string {
  return p.replace(/%([^%]+)%/g, (_, name) => env[name] ?? process.env[name] ?? '')
}

const VERSION_RE = /\d+\.\d+(?:\.\d+)?/

async function detectTool(t: ToolDef): Promise<ToolStatus> {
  const env = detectEnv()
  const cwd = os.homedir()

  if (t.cmd) {
    const res = await run(t.cmd, t.versionArgs ?? ['--version'], 8000, env, cwd)
    if (res.code === 0) {
      const m = (res.stdout || res.stderr).match(VERSION_RE)
      return { id: t.id, installed: true, version: m?.[0] }
    }
  }
  if (t.paths) {
    for (const p of t.paths) {
      const expanded = expandEnv(p, env)
      if (!existsSync(expanded)) continue
      if (t.cmd) {
        const res = await run(expanded, t.versionArgs ?? ['--version'], 8000, env, cwd)
        if (res.code === 0) {
          const m = (res.stdout || res.stderr).match(VERSION_RE)
          return { id: t.id, installed: true, version: m?.[0] }
        }
      }
      return { id: t.id, installed: true }
    }
  }
  if (t.dirPrefix) {
    try {
      const entries = readdirSync(t.dirPrefix.dir)
      const hit = entries.find((e) => e.toLowerCase().startsWith(t.dirPrefix!.prefix.toLowerCase()))
      if (hit) {
        const m = hit.match(VERSION_RE)
        return { id: t.id, installed: true, version: m?.[0] }
      }
    } catch {
      /* dir does not exist */
    }
  }
  return { id: t.id, installed: false }
}

export async function detectTools(): Promise<ToolStatus[]> {
  // run in small batches to avoid spawning ~17 processes at once
  const results: ToolStatus[] = []
  const queue = [...TOOLS]
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length > 0) {
      const t = queue.shift()!
      results.push(await detectTool(t))
    }
  })
  await Promise.all(workers)
  return results
}

// Install state lives here (not in the renderer) so it survives tab/page
// navigation. The renderer reattaches by fetching getInstallStates().
const installs = new Map<string, InstallState>()
const activeProcesses = new Map<string, ChildProcess>()
const idleTimers = new Map<string, ReturnType<typeof setInterval>>()
const MAX_INSTALL_LINES = 500

function clearIdleTimer(toolId: string) {
  const timer = idleTimers.get(toolId)
  if (timer) {
    clearInterval(timer)
    idleTimers.delete(toolId)
  }
}

function startIdleWatchdog(toolId: string, state: InstallState, getLastActivity: () => number) {
  clearIdleTimer(toolId)
  const timer = setInterval(() => {
    if (state.phase !== 'installing') {
      clearIdleTimer(toolId)
      return
    }
    const silentSec = Math.round((Date.now() - getLastActivity()) / 1000)
    if (silentSec >= 20) {
      pushInstallLine(
        state,
        'sys',
        `Still working… (${silentSec}s with no new log lines — downloads can be slow or waiting for UAC approval)`,
      )
    }
  }, 20_000)
  idleTimers.set(toolId, timer)
}

function killInstallProcess(child: ChildProcess) {
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: true, windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
}

export function getInstallStates(): InstallState[] {
  return [...installs.values()]
}

function pushInstallLine(state: InstallState, stream: LogLine['stream'], text: string) {
  const line: LogLine = { ts: Date.now(), stream, text }
  state.lines.push(line)
  if (state.lines.length > MAX_INSTALL_LINES) state.lines.splice(0, state.lines.length - MAX_INSTALL_LINES)
  broadcast('tools:installLog', state.toolId, line)
}

function finishInstall(state: InstallState, phase: 'done' | 'error', error?: string) {
  state.phase = phase
  state.error = error
  state.finishedAt = Date.now()
  broadcast('tools:installState', { ...state })
}

/**
 * winget errors are cryptic exit codes — translate the common ones so the
 * user knows what to do instead of seeing "exited with code -1978335189".
 */
function explainWingetExit(code: number, tail: string): string {
  const map: Record<number, string> = {
    [-1978335189 >>> 0]: 'No applicable installer found for this package on your system.',
    [-1978335215 >>> 0]: 'Package not found in the winget catalog.',
    [-1978334967 >>> 0]: 'The installer requires Administrator rights. Run DevFlow as Administrator and try again.',
  }
  // winget returns unsigned; also match on message text as a fallback
  if (/requires? admin|elevat|access is denied|denied/i.test(tail)) {
    return 'The installer needs Administrator rights. Run DevFlow as Administrator and try again.'
  }
  if (/no applicable installer|no available upgrade|no installed package/i.test(tail)) {
    return 'No applicable installer was found for this package on your machine.'
  }
  return map[code >>> 0] ?? `Installer exited with code ${code}.${tail ? ` ${tail}` : ''}`
}

export function cancelInstall(toolId: string): { ok: boolean; error?: string } {
  const state = installs.get(toolId)
  if (!state || state.phase !== 'installing') return { ok: false, error: 'No install in progress' }

  clearIdleTimer(toolId)
  const child = activeProcesses.get(toolId)
  if (child) {
    killInstallProcess(child)
    activeProcesses.delete(toolId)
  }

  const label = state.mode === 'uninstall' ? 'Uninstall' : 'Install'
  pushInstallLine(state, 'sys', `${label} cancelled.`)
  finishInstall(state, 'error', `${label} cancelled`)
  return { ok: true }
}

async function preflightInstall(tool: ToolDef, state: InstallState): Promise<{ ok: boolean; error?: string }> {
  const env = detectEnv()
  if (tool.winget) {
    const res = await run('winget', ['--version'], 12000, env)
    if (res.code !== 0) {
      const msg =
        'winget was not found. Install "App Installer" from the Microsoft Store, then try again.'
      pushInstallLine(state, 'sys', msg)
      return { ok: false, error: msg }
    }
    pushInstallLine(state, 'sys', `Using winget ${(res.stdout || res.stderr).trim()}`)
    return { ok: true }
  }

  if (tool.installCmd?.startsWith('npm ')) {
    const res = await run('npm', ['--version'], 8000, env)
    if (res.code !== 0) {
      const msg = 'npm was not found in PATH. Install Node.js first, then try again.'
      pushInstallLine(state, 'sys', msg)
      return { ok: false, error: msg }
    }
    pushInstallLine(state, 'sys', `Using npm v${(res.stdout || res.stderr).trim()}`)
    return { ok: true }
  }

  return { ok: true }
}

async function runToolCommand(
  toolId: string,
  mode: 'install' | 'uninstall',
  getCmd: (tool: ToolDef) => string | undefined,
  buildLaunch: (tool: ToolDef, cmd: string) => InstallLaunch,
  verify: (tool: ToolDef, state: InstallState) => Promise<{ ok: boolean; error?: string }>,
): Promise<{ ok: boolean; error?: string }> {
  const tool = TOOLS.find((t) => t.id === toolId)
  if (!tool) return { ok: false, error: 'Unknown tool' }

  const existing = installs.get(toolId)
  if (existing?.phase === 'installing') {
    return { ok: false, error: `${existing.mode === 'uninstall' ? 'Uninstall' : 'Install'} already in progress` }
  }

  const cmd = getCmd(tool)
  if (!cmd) {
    return {
      ok: false,
      error:
        mode === 'uninstall'
          ? 'No uninstall command available — remove it manually.'
          : 'No install command available — use the download page.',
    }
  }

  const launch = buildLaunch(tool, cmd)
  const state: InstallState = { toolId, phase: 'installing', mode, lines: [], startedAt: Date.now() }
  installs.set(toolId, state)
  broadcast('tools:installState', { ...state })
  pushInstallLine(state, 'sys', `$ ${launch.label}`)
  if (launch.hint) pushInstallLine(state, 'sys', launch.hint)

  const preflight = await preflightInstall(tool, state)
  if (!preflight.ok) {
    finishInstall(state, 'error', preflight.error)
    return { ok: false, error: preflight.error }
  }

  let tail = ''
  let lastActivity = Date.now()
  const bumpActivity = () => {
    lastActivity = Date.now()
  }

  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = launch.spawn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to start ${mode}er`
      pushInstallLine(state, 'sys', msg)
      finishInstall(state, 'error', msg)
      resolve({ ok: false, error: msg })
      return
    }

    activeProcesses.set(toolId, child)
    startIdleWatchdog(toolId, state, () => lastActivity)

    if (child.pid) pushInstallLine(state, 'sys', `Process started (PID ${child.pid})`)

    const onOut = streamInstallOutput(
      state,
      (text) => {
        tail = text
      },
      bumpActivity,
    )
    child.stdout?.on('data', onOut('out'))
    child.stderr?.on('data', onOut('err'))

    child.on('error', (err) => {
      clearIdleTimer(toolId)
      activeProcesses.delete(toolId)
      const msg =
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? tool.winget
            ? 'winget was not found. It ships with Windows 11 (App Installer) — install it from the Microsoft Store.'
            : `Command not found: ${launch.label}`
          : err.message
      pushInstallLine(state, 'sys', msg)
      finishInstall(state, 'error', msg)
      resolve({ ok: false, error: msg })
    })
    child.on('close', async (code) => {
      clearIdleTimer(toolId)
      activeProcesses.delete(toolId)
      if (state.phase !== 'installing') {
        resolve({ ok: false, error: state.error })
        return
      }
      if (code === 0) {
        pushInstallLine(state, 'sys', `${mode === 'uninstall' ? 'Uninstall' : 'Install'} finished. Verifying...`)
        const result = await verify(tool, state)
        if (result.ok) {
          finishInstall(state, 'done')
          resolve({ ok: true })
        } else {
          pushInstallLine(state, 'sys', result.error ?? 'Verification failed.')
          finishInstall(state, 'error', result.error)
          resolve({ ok: false, error: result.error })
        }
      } else {
        const msg = explainWingetExit(code ?? 1, tail)
        finishInstall(state, 'error', msg)
        resolve({ ok: false, error: msg })
      }
    })
  })
}

export async function installTool(toolId: string): Promise<{ ok: boolean; error?: string }> {
  return runToolCommand(
    toolId,
    'install',
    installCommandFor,
    buildInstallLaunch,
    async (tool, state) => {
      const status = await detectTool(tool)
      state.status = status
      if (status.installed) {
        pushInstallLine(state, 'sys', status.version ? `Verified installed (v${status.version}).` : 'Verified installed.')
        return { ok: true }
      }
      return {
        ok: false,
        error: 'Installer finished but the tool was not detected. Try Re-scan, or restart DevFlow so PATH refreshes.',
      }
    },
  )
}

export async function uninstallTool(toolId: string): Promise<{ ok: boolean; error?: string }> {
  return runToolCommand(
    toolId,
    'uninstall',
    uninstallCommandFor,
    buildUninstallLaunch,
    async (tool, state) => {
      const status = await detectTool(tool)
      state.status = status
      if (!status.installed) {
        pushInstallLine(state, 'sys', 'Verified removed.')
        return { ok: true }
      }
      return {
        ok: false,
        error: 'Uninstaller finished but the tool is still detected. Try Re-scan, or remove it manually.',
      }
    },
  )
}

export { run, expandEnv, VERSION_RE }
export type { ExecResult }
