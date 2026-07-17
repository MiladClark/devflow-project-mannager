import { execFile } from 'node:child_process'
import os from 'node:os'
import type { SystemStats, ProjectStats } from '../../src/shared/types'

interface ProcInfo {
  ProcessId: number
  ParentProcessId: number
  WorkingSetSize: number
  UserModeTime: number
  KernelModeTime: number
}

// previous cpu-time snapshot per pid (100ns units) for delta computation
let prevCpuTimes = new Map<number, number>()
let prevSampleAt = 0

let prevIdle = 0
let prevTotal = 0

export function getSystemStats(): SystemStats {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const c of cpus) {
    idle += c.times.idle
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
  }
  const dIdle = idle - prevIdle
  const dTotal = total - prevTotal
  prevIdle = idle
  prevTotal = total
  const cpu = dTotal > 0 ? Math.max(0, Math.min(100, 100 * (1 - dIdle / dTotal))) : 0
  return {
    cpu,
    memUsed: os.totalmem() - os.freemem(),
    memTotal: os.totalmem(),
    uptime: os.uptime(),
  }
}

function queryProcessesWin32(): Promise<ProcInfo[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize,UserModeTime,KernelModeTime | ConvertTo-Json -Compress',
      ],
      { maxBuffer: 32 * 1024 * 1024, windowsHide: true },
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

// macOS `ps` only reports cumulative CPU time at whole-second resolution (no
// 100ns FILETIME equivalent), so we scale seconds by 1e7 to reuse the same
// "100ns units -> ms via /10000" math the Windows path and downstream
// consumers (getProcessTreeStats) already rely on — coarser granularity, same unit contract.
function queryProcessesDarwin(): Promise<ProcInfo[]> {
  return new Promise((resolve) => {
    execFile(
      '/bin/ps',
      ['-axo', 'pid=,ppid=,rss=,time='],
      { maxBuffer: 32 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve([])
        const out: ProcInfo[] = []
        for (const line of stdout.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const m = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(?:(\d+)-)?(\d+):(\d+):(\d+)$/)
          if (!m) continue
          const [, pidStr, ppidStr, rssStr, daysStr, hh, mm, ss] = m
          const totalSeconds =
            (daysStr ? Number(daysStr) * 86400 : 0) + Number(hh) * 3600 + Number(mm) * 60 + Number(ss)
          out.push({
            ProcessId: Number(pidStr),
            ParentProcessId: Number(ppidStr),
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

function queryProcesses(): Promise<ProcInfo[]> {
  return process.platform === 'darwin' ? queryProcessesDarwin() : queryProcessesWin32()
}

function collectTree(rootPid: number, byParent: Map<number, ProcInfo[]>, byPid: Map<number, ProcInfo>): ProcInfo[] {
  const result: ProcInfo[] = []
  const queue = [rootPid]
  const seen = new Set<number>()
  while (queue.length) {
    const pid = queue.shift()!
    if (seen.has(pid)) continue
    seen.add(pid)
    const info = byPid.get(pid)
    if (info) result.push(info)
    for (const child of byParent.get(pid) ?? []) queue.push(child.ProcessId)
  }
  return result
}

/**
 * Maps each PID in `pids` to the root PID (from `rootPids`) whose process tree
 * contains it, if any. Dev servers spawn via shell:true, so the listener PID is
 * a descendant of the tracked PID — never the tracked PID itself.
 */
export async function findOwningRoots(pids: number[], rootPids: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (pids.length === 0 || rootPids.length === 0) return out
  const procs = await queryProcesses()
  const byPid = new Map<number, ProcInfo>()
  const byParent = new Map<number, ProcInfo[]>()
  for (const p of procs) {
    byPid.set(p.ProcessId, p)
    const arr = byParent.get(p.ParentProcessId) ?? []
    arr.push(p)
    byParent.set(p.ParentProcessId, arr)
  }
  for (const rootPid of rootPids) {
    const tree = collectTree(rootPid, byParent, byPid)
    const members = new Set(tree.map((p) => p.ProcessId))
    members.add(rootPid)
    for (const pid of pids) {
      if (!out.has(pid) && members.has(pid)) out.set(pid, rootPid)
    }
  }
  return out
}

/** Returns per-root-pid stats: CPU % (of all cores) and memory bytes for the whole process tree. */
export async function getProcessTreeStats(rootPids: number[]): Promise<Map<number, ProjectStats>> {
  const out = new Map<number, ProjectStats>()
  if (rootPids.length === 0) {
    prevCpuTimes = new Map()
    prevSampleAt = 0
    return out
  }
  const procs = await queryProcesses()
  const now = Date.now()
  const byPid = new Map<number, ProcInfo>()
  const byParent = new Map<number, ProcInfo[]>()
  for (const p of procs) {
    byPid.set(p.ProcessId, p)
    const arr = byParent.get(p.ParentProcessId) ?? []
    arr.push(p)
    byParent.set(p.ParentProcessId, arr)
  }

  const elapsedMs = prevSampleAt ? now - prevSampleAt : 0
  const cores = os.cpus().length || 1
  const nextCpuTimes = new Map<number, number>()

  for (const rootPid of rootPids) {
    const tree = collectTree(rootPid, byParent, byPid)
    let mem = 0
    let cpuDelta100ns = 0
    for (const p of tree) {
      mem += Number(p.WorkingSetSize) || 0
      const t = (Number(p.UserModeTime) || 0) + (Number(p.KernelModeTime) || 0)
      nextCpuTimes.set(p.ProcessId, t)
      const prev = prevCpuTimes.get(p.ProcessId)
      if (prev !== undefined && t >= prev) cpuDelta100ns += t - prev
    }
    // 100ns units -> ms: /10000 ; % of total capacity across all cores
    const cpu = elapsedMs > 0 ? Math.min(100, (cpuDelta100ns / 10000 / (elapsedMs * cores)) * 100) : 0
    out.set(rootPid, { cpu, mem })
  }

  prevCpuTimes = nextCpuTimes
  prevSampleAt = now
  return out
}
