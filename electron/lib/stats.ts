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

function queryProcesses(): Promise<ProcInfo[]> {
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
