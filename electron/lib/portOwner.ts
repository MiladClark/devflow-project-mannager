import { execFile } from 'node:child_process'
import type { PortOwner, OccupiedPortInfo } from '../../src/shared/types'
import { store } from './store'
import { findOwningRoots } from './stats'
import { isPortFree } from './ports'

// killing these would take down the OS or the user's session
const SYSTEM_PROCESSES = new Set([
  'system',
  'idle',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'lsass.exe',
  'smss.exe',
  'svchost.exe',
  'explorer.exe',
  // macOS
  'kernel_task',
  'launchd',
  'windowserver',
  'loginwindow',
  'systemuiserver',
])

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 10000, maxBuffer: 8 * 1024 * 1024 }, (_err, stdout) =>
      resolve(stdout ?? ''),
    )
  })
}

/** PIDs of processes LISTENING on the given TCP port (any interface). */
async function listeningPids(port: number): Promise<number[]> {
  const map = await listeningPortMap()
  const pid = map.get(port)
  return pid !== undefined ? [pid] : []
}

/** All TCP ports in LISTENING state → first PID bound to each port. */
async function listeningPortMapWin32(): Promise<Map<number, number>> {
  const out = await run('netstat', ['-ano', '-p', 'TCP'])
  const portToPid = new Map<number, number>()
  for (const line of out.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue
    const cols = line.trim().split(/\s+/)
    if (cols.length < 5) continue
    const local = cols[1]
    const m = local.match(/:(\d+)$/)
    if (!m) continue
    const port = Number(m[1])
    const pid = Number(cols[cols.length - 1])
    if (!Number.isInteger(port) || port < 1 || port > 65535) continue
    if (!Number.isInteger(pid) || pid <= 0) continue
    if (!portToPid.has(port)) portToPid.set(port, pid)
  }
  return portToPid
}

/** Same contract as the win32 version, via `lsof`'s parseable field output (-F). */
async function listeningPortMapDarwin(): Promise<Map<number, number>> {
  const out = await run('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn'])
  const portToPid = new Map<number, number>()
  let currentPid: number | null = null
  for (const line of out.split('\n')) {
    if (!line) continue
    const tag = line[0]
    const value = line.slice(1)
    if (tag === 'p') {
      currentPid = Number(value)
    } else if (tag === 'n' && currentPid !== null) {
      const m = value.match(/:(\d+)$/)
      if (!m) continue
      const port = Number(m[1])
      if (!Number.isInteger(port) || port < 1 || port > 65535) continue
      if (!portToPid.has(port)) portToPid.set(port, currentPid)
    }
  }
  return portToPid
}

function listeningPortMap(): Promise<Map<number, number>> {
  return process.platform === 'darwin' ? listeningPortMapDarwin() : listeningPortMapWin32()
}

async function processNameWin32(pid: number): Promise<string> {
  const out = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])
  // "node.exe","12345","Console","1","123,456 K"
  const m = out.match(/^"([^"]+)"/m)
  return m?.[1] ?? 'unknown'
}

async function processNameDarwin(pid: number): Promise<string> {
  const out = await run('/bin/ps', ['-p', String(pid), '-o', 'comm='])
  const trimmed = out.trim()
  if (!trimmed) return 'unknown'
  return trimmed.split('/').pop() || trimmed
}

function processName(pid: number): Promise<string> {
  return process.platform === 'darwin' ? processNameDarwin(pid) : processNameWin32(pid)
}

export async function getPortOwner(port: number): Promise<PortOwner | null> {
  const pids = await listeningPids(port)
  if (pids.length === 0) return null
  const pid = pids[0]
  const name = await processName(pid)

  // lazily imported to avoid a circular dependency at module load
  const { getRunningDevPids } = await import('../ipc/runner')
  const devPids = getRunningDevPids()
  const roots = await findOwningRoots([pid], [...devPids.values()])
  const rootPid = roots.get(pid)
  let managedProjectId: string | undefined
  if (rootPid !== undefined) {
    for (const [projectId, p] of devPids) {
      if (p === rootPid) managedProjectId = projectId
    }
  }
  const managedProject = managedProjectId ? store.getProject(managedProjectId) : undefined

  let killable = true
  let reason: string | undefined
  if (managedProjectId) {
    killable = false
    reason = 'This port is used by a project managed by DevFlow — stop that project instead.'
  } else if (pid === 0 || pid === 4 || pid === process.pid) {
    killable = false
    reason = 'This process belongs to Windows or DevFlow itself and cannot be terminated.'
  } else if (SYSTEM_PROCESSES.has(name.toLowerCase())) {
    killable = false
    reason = `${name} is a system process and cannot be terminated safely.`
  }

  return {
    port,
    pid,
    processName: name,
    managedProjectId,
    managedProjectName: managedProject?.name,
    killable,
    reason,
  }
}

export async function listOccupiedPorts(): Promise<OccupiedPortInfo[]> {
  const portToPid = await listeningPortMap()
  if (portToPid.size === 0) return []

  const uniquePids = [...new Set(portToPid.values())]
  const names = new Map<number, string>()
  await Promise.all(
    uniquePids.map(async (pid) => {
      names.set(pid, await processName(pid))
    }),
  )

  const { getRunningDevPids } = await import('../ipc/runner')
  const devPids = getRunningDevPids()
  const roots = await findOwningRoots(uniquePids, [...devPids.values()])

  const result: OccupiedPortInfo[] = []
  for (const [port, pid] of portToPid) {
    let managedProjectName: string | undefined
    const rootPid = roots.get(pid)
    if (rootPid !== undefined) {
      for (const [projectId, p] of devPids) {
        if (p === rootPid) {
          managedProjectName = store.getProject(projectId)?.name
          break
        }
      }
    }
    result.push({
      port,
      pid,
      processName: names.get(pid) ?? 'unknown',
      managedProjectName,
    })
  }
  return result.sort((a, b) => a.port - b.port)
}

export async function takeoverPort(
  port: number,
  opts?: { skipConfirm?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  // re-resolve at call time — never trust a PID that crossed the IPC boundary
  const owner = await getPortOwner(port)
  if (!owner) return { ok: true } // freed in the meantime
  if (!owner.killable) return { ok: false, error: owner.reason ?? 'Process cannot be terminated.' }

  if (!opts?.skipConfirm) {
    const { dialog, BrowserWindow } = await import('electron')
    const win = BrowserWindow.getAllWindows()[0]
    const res = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Terminate process?',
      message: `Terminate ${owner.processName} (PID ${owner.pid})?`,
      detail: `This will force-kill the process tree holding port ${port}. Unsaved work in that application will be lost.`,
      buttons: ['Terminate', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    if (res.response !== 0) return { ok: false, error: 'Cancelled.' }
  }

  if (process.platform === 'darwin') {
    try {
      process.kill(-owner.pid, 'SIGKILL')
    } catch {
      try {
        process.kill(owner.pid, 'SIGKILL')
      } catch {
        /* already gone */
      }
    }
  } else {
    await new Promise<void>((resolve) => {
      execFile('taskkill', ['/pid', String(owner.pid), '/t', '/f'], { windowsHide: true }, () => resolve())
    })
  }

  // wait for the port to actually free up (max ~3s)
  for (let i = 0; i < 10; i++) {
    if (await isPortFree(port)) return { ok: true }
    await new Promise((r) => setTimeout(r, 300))
  }
  return { ok: false, error: `Port ${port} is still in use after terminating the process.` }
}
