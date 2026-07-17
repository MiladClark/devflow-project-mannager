import { execFile } from 'node:child_process'
import os from 'node:os'
import type { DevProcess, DevProcessCategory, DevProcessSnapshot } from '../../src/shared/types'

interface RawProc {
  ProcessId: number
  ParentProcessId: number
  Name: string
  CommandLine?: string
  WorkingSetSize: number
  UserModeTime: number
  KernelModeTime: number
}

const SYSTEM_NAMES = new Set([
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
  'dwm.exe',
  'fontdrvhost.exe',
  'sihost.exe',
  'taskhostw.exe',
  'runtimebroker.exe',
  'searchhost.exe',
  'securityhealthservice.exe',
  // macOS
  'kernel_task',
  'launchd',
  'windowserver',
  'loginwindow',
  'mds',
  'mds_stores',
  'mdworker',
  'coreaudiod',
  'logd',
  'securityd',
  'opendirectoryd',
  'diskarbitrationd',
  'systemuiserver',
  'dock',
  'finder',
  'cfprefsd',
  'notifyd',
  'usernoted',
  'distnoted',
])

const RUNTIME_NAMES = new Set([
  'node.exe',
  'python.exe',
  'pythonw.exe',
  'python3.exe',
  'bun.exe',
  'deno.exe',
  'java.exe',
  'javaw.exe',
  'php.exe',
  'go.exe',
  'rustc.exe',
  'cargo.exe',
  'dotnet.exe',
  'electron.exe',
  // macOS (no .exe suffix)
  'node',
  'python',
  'python3',
  'bun',
  'deno',
  'java',
  'php',
  'go',
  'rustc',
  'cargo',
  'dotnet',
  'electron',
])

const EDITOR_NAMES = new Set([
  'code.exe',
  'cursor.exe',
  'devenv.exe',
  'idea64.exe',
  'webstorm64.exe',
  'pycharm64.exe',
  // macOS
  'code',
  'code helper',
  'cursor',
  'cursor helper',
])

const DATABASE_NAMES = new Set([
  'mysqld.exe',
  'mysql.exe',
  'postgres.exe',
  'pg_ctl.exe',
  'mongod.exe',
  'redis-server.exe',
  'memurai.exe',
  // macOS (Homebrew-installed binaries, no .exe suffix)
  'mysqld',
  'mysql',
  'postgres',
  'pg_ctl',
  'mongod',
  'redis-server',
  'mariadbd',
])

const CONTAINER_NAMES = new Set([
  'docker.exe',
  'docker-compose.exe',
  'com.docker.backend.exe',
  'com.docker.service.exe',
  'vpnkit.exe',
  // macOS
  'docker',
  'docker-compose',
  'com.docker.backend',
  'com.docker.virtualization',
  'com.docker.driver.amd64-linux',
])

const SHELL_NAMES = new Set([
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'bash.exe',
  'sh.exe',
  // macOS
  'zsh',
  'bash',
  'sh',
  'fish',
])

const DEV_CMD_RE =
  /node_modules|npm\s|pnpm\s|yarn\s|bun\s|vite|next|nuxt|webpack|rollup|esbuild|turbo|devflow|strapi|payload|react-scripts|electron-vite|create-vite|jest|vitest|playwright|cypress|tsc\b|tsx\b|nodemon|pm2/i

let prevCpuTimes = new Map<number, number>()
let prevSampleAt = 0

function queryProcessesWin32(): Promise<RawProc[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine,WorkingSetSize,UserModeTime,KernelModeTime | ConvertTo-Json -Compress',
      ],
      { maxBuffer: 48 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve([])
        try {
          const parsed = JSON.parse(stdout)
          resolve(Array.isArray(parsed) ? parsed : [parsed])
        } catch {
          resolve([])
        }
      },
    )
  })
}

// Same 100ns-unit scaling rationale as stats.ts's darwin queryProcesses (ps
// only reports whole-second cumulative CPU time on macOS).
function queryProcessesDarwin(): Promise<RawProc[]> {
  return new Promise((resolve) => {
    execFile(
      '/bin/ps',
      ['-axo', 'pid=,ppid=,rss=,time=,command='],
      { maxBuffer: 48 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve([])
        const out: RawProc[] = []
        for (const line of stdout.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const m = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(?:(\d+)-)?(\d+):(\d+):(\d+)\s+(.+)$/)
          if (!m) continue
          const [, pidStr, ppidStr, rssStr, daysStr, hh, mm, ss, command] = m
          const totalSeconds =
            (daysStr ? Number(daysStr) * 86400 : 0) + Number(hh) * 3600 + Number(mm) * 60 + Number(ss)
          const firstToken = command.split(/\s+/)[0] ?? command
          const name = firstToken.split('/').pop() || firstToken
          out.push({
            ProcessId: Number(pidStr),
            ParentProcessId: Number(ppidStr),
            Name: name,
            CommandLine: command,
            WorkingSetSize: Number(rssStr) * 1024,
            UserModeTime: totalSeconds * 1e7,
            KernelModeTime: 0,
          })
        }
        resolve(out)
      },
    )
  })
}

function queryProcesses(): Promise<RawProc[]> {
  return process.platform === 'darwin' ? queryProcessesDarwin() : queryProcessesWin32()
}

function categorize(name: string, cmd: string): DevProcessCategory | null {
  const lower = name.toLowerCase()
  if (lower.includes('devflow') || /devflow-manager/i.test(cmd)) return 'devflow'
  if (RUNTIME_NAMES.has(lower)) return 'runtime'
  if (EDITOR_NAMES.has(lower)) return 'editor'
  if (DATABASE_NAMES.has(lower)) return 'database'
  if (CONTAINER_NAMES.has(lower)) return 'container'
  if (SHELL_NAMES.has(lower) && DEV_CMD_RE.test(cmd)) return 'shell'
  if (/npm\.cmd|pnpm\.cmd|yarn\.cmd|npx\.cmd|corepack\.cmd/i.test(lower)) return 'package-manager'
  if (DEV_CMD_RE.test(cmd)) return 'other-dev'
  return null
}

function isKillable(pid: number, name: string, managedByDevFlow: boolean): { killable: boolean; reason?: string } {
  const lower = name.toLowerCase()
  if (pid === 0 || pid === 4 || pid === process.pid) {
    return { killable: false, reason: 'This process belongs to Windows or DevFlow itself.' }
  }
  if (process.platform === 'darwin' && pid < 100) {
    return { killable: false, reason: `${name} is a low-PID macOS system process and cannot be terminated safely.` }
  }
  if (SYSTEM_NAMES.has(lower)) {
    return { killable: false, reason: `${name} is a system process and cannot be terminated safely.` }
  }
  if (managedByDevFlow) {
    return { killable: true, reason: 'Managed by DevFlow — prefer stopping the project from the Projects page.' }
  }
  return { killable: true }
}

export async function getDevProcesses(): Promise<DevProcessSnapshot> {
  const procs = await queryProcesses()
  const now = Date.now()
  const elapsedMs = prevSampleAt ? now - prevSampleAt : 0
  const cores = os.cpus().length || 1
  const nextCpuTimes = new Map<number, number>()

  const { getRunningDevPids } = await import('../ipc/runner')
  const { store } = await import('./store')
  const { findOwningRoots } = await import('./stats')
  const devPids = getRunningDevPids()
  const rootToProject = new Map<number, { id: string; name: string }>()
  for (const [projectId, pid] of devPids) {
    const p = store.getProject(projectId)
    rootToProject.set(pid, { id: projectId, name: p?.name ?? projectId })
  }

  const allPids = procs.map((p) => Number(p.ProcessId)).filter((pid) => pid > 0)
  const owningRoots = await findOwningRoots(allPids, [...rootToProject.keys()])
  const pidToProject = new Map<number, { id: string; name: string }>()
  for (const [pid, rootPid] of owningRoots) {
    const managed = rootToProject.get(rootPid)
    if (managed) pidToProject.set(pid, managed)
  }
  for (const [rootPid, managed] of rootToProject) pidToProject.set(rootPid, managed)

  const out: DevProcess[] = []

  for (const p of procs) {
    const pid = Number(p.ProcessId)
    if (!Number.isInteger(pid) || pid <= 0) continue
    const name = p.Name ?? 'unknown'
    const cmd = p.CommandLine ?? ''
    const mem = Number(p.WorkingSetSize) || 0
    if (mem < 4 * 1024 * 1024 && !pidToProject.has(pid)) continue

    const category = categorize(name, cmd)
    const managed = pidToProject.get(pid)
    if (!category && !managed) continue

    const t = (Number(p.UserModeTime) || 0) + (Number(p.KernelModeTime) || 0)
    nextCpuTimes.set(pid, t)
    const prev = prevCpuTimes.get(pid)
    let cpu = 0
    if (prev !== undefined && t >= prev && elapsedMs > 0) {
      cpu = Math.min(100, ((t - prev) / 10000 / (elapsedMs * cores)) * 100)
    }

    const { killable, reason } = isKillable(pid, name, !!managed)

    out.push({
      pid,
      parentPid: Number(p.ParentProcessId) || 0,
      name,
      commandLine: cmd,
      category: managed ? 'devflow' : category!,
      cpu,
      mem,
      managedProjectId: managed?.id,
      managedProjectName: managed?.name,
      killable,
      reason,
    })
  }

  prevCpuTimes = nextCpuTimes
  prevSampleAt = now

  out.sort((a, b) => b.mem - a.mem || b.cpu - a.cpu)

  const totals = out.reduce(
    (acc, p) => ({
      cpu: acc.cpu + p.cpu,
      mem: acc.mem + p.mem,
      count: acc.count + 1,
    }),
    { cpu: 0, mem: 0, count: 0 },
  )

  return { processes: out, totals, sampledAt: now }
}

export async function killDevProcess(pid: number): Promise<{ ok: boolean; error?: string }> {
  const snap = await getDevProcesses()
  const target = snap.processes.find((p) => p.pid === pid)
  if (!target) return { ok: false, error: 'Process not found or no longer running.' }
  if (!target.killable) return { ok: false, error: target.reason ?? 'Process cannot be terminated.' }

  if (process.platform === 'darwin') {
    // Dev processes are spawned detached/grouped, so a negative pid targets
    // the whole process group; fall back to a plain kill if it isn't a
    // group leader (ESRCH).
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        /* already gone */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        /* already gone */
      }
    }
    return { ok: true }
  }

  await new Promise<void>((resolve) => {
    execFile('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, () => resolve())
  })

  return { ok: true }
}
