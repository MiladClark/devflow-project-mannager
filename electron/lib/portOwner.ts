import { execFile } from 'node:child_process'
import type { PortOwner } from '../../src/shared/types'
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
  const out = await run('netstat', ['-ano', '-p', 'TCP'])
  const pids = new Set<number>()
  for (const line of out.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue
    // "  TCP    0.0.0.0:3007    0.0.0.0:0    LISTENING    12345"
    const cols = line.trim().split(/\s+/)
    if (cols.length < 5) continue
    const local = cols[1]
    if (!local.endsWith(`:${port}`)) continue
    const pid = Number(cols[cols.length - 1])
    if (Number.isInteger(pid) && pid > 0) pids.add(pid)
  }
  return [...pids]
}

async function processName(pid: number): Promise<string> {
  const out = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])
  // "node.exe","12345","Console","1","123,456 K"
  const m = out.match(/^"([^"]+)"/m)
  return m?.[1] ?? 'unknown'
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

  await new Promise<void>((resolve) => {
    execFile('taskkill', ['/pid', String(owner.pid), '/t', '/f'], { windowsHide: true }, () => resolve())
  })

  // wait for the port to actually free up (max ~3s)
  for (let i = 0; i < 10; i++) {
    if (await isPortFree(port)) return { ok: true }
    await new Promise((r) => setTimeout(r, 300))
  }
  return { ok: false, error: `Port ${port} is still in use after terminating the process.` }
}
