import { execFile } from 'node:child_process'
import type { DbService, DbKind, ServiceState } from '../../src/shared/types'
import { VERSION_RE } from './tools'

interface PsService {
  Name: string
  DisplayName: string
  State: string
  PathName: string
}

function powershell(command: string, timeoutMs = 15000): Promise<{ code: number | string; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code = err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
      },
    )
  })
}

function mapState(s: string): ServiceState {
  const v = s.toLowerCase()
  if (v === 'running') return 'running'
  if (v === 'stopped') return 'stopped'
  if (v.includes('pending')) return 'pending'
  return 'unknown'
}

function exePathOf(pathName: string): string | undefined {
  if (!pathName) return undefined
  const m = pathName.match(/^"([^"]+)"/) ?? pathName.match(/^(\S+)/)
  return m?.[1]
}

function versionFromPath(name: string, pathName: string): string | undefined {
  // "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" ... → 8.0
  const dirHit = pathName.match(/MySQL Server (\d+\.\d+)/i) ?? pathName.match(/PostgreSQL\\(\d+(?:\.\d+)?)/i)
  if (dirHit) return dirHit[1]
  // postgresql-x64-16 → 16, MySQL80 → 8.0
  const pg = name.match(/postgresql(?:-x64)?-(\d+)/i)
  if (pg) return pg[1]
  const my = name.match(/^MySQL(\d)(\d)$/i)
  if (my) return `${my[1]}.${my[2]}`
  return undefined
}

async function versionFromBinary(exe: string | undefined): Promise<string | undefined> {
  if (!exe || !/mysqld|postgres|pg_ctl/i.test(exe)) return undefined
  const target = exe.replace(/pg_ctl\.exe$/i, 'postgres.exe')
  const res = await new Promise<{ code: number | string; out: string }>((resolve) => {
    execFile(target, ['--version'], { windowsHide: true, timeout: 5000 }, (err, stdout, stderr) => {
      resolve({ code: err ? 1 : 0, out: `${stdout}${stderr}` })
    })
  })
  if (res.code !== 0) return undefined
  return res.out.match(VERSION_RE)?.[0]
}

export async function listDbServices(): Promise<DbService[]> {
  const res = await powershell(
    `Get-CimInstance Win32_Service | Where-Object { ($_.Name -like 'MySQL*' -or $_.Name -like 'MariaDB*' -or $_.Name -like 'postgresql*') -and $_.Name -notlike '*router*' } | Select-Object Name,DisplayName,State,PathName | ConvertTo-Json -Compress`,
  )
  if (res.code !== 0 || !res.stdout.trim()) return []
  let parsed: PsService | PsService[]
  try {
    parsed = JSON.parse(res.stdout)
  } catch {
    return []
  }
  const list = Array.isArray(parsed) ? parsed : [parsed]

  return Promise.all(
    list.map(async (s): Promise<DbService> => {
      const kind: DbKind = /postgres/i.test(s.Name) || /postgres/i.test(s.PathName ?? '') ? 'postgres' : 'mysql'
      const binPath = exePathOf(s.PathName ?? '')
      const version = (await versionFromBinary(binPath)) ?? versionFromPath(s.Name, s.PathName ?? '')
      return {
        name: s.Name,
        displayName: s.DisplayName || s.Name,
        kind,
        state: mapState(s.State ?? ''),
        rawState: s.State ?? 'Unknown',
        version,
        binPath,
      }
    }),
  )
}

export async function serviceAction(name: string, action: 'start' | 'stop'): Promise<{ ok: boolean; error?: string }> {
  // service names come from listDbServices, but validate anyway since this crosses IPC
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(name)) return { ok: false, error: 'Invalid service name' }
  const verb = action === 'start' ? 'Start-Service' : 'Stop-Service'
  const res = await powershell(`${verb} -Name '${name}' -ErrorAction Stop`, 30000)
  if (res.code === 0) return { ok: true }
  const msg = res.stderr.trim().split(/\r?\n/)[0] || `${verb} failed`
  const denied = /denied|access|elevat|privilege|permission/i.test(msg)
  return {
    ok: false,
    error: denied ? 'Access denied — run DevFlow Manager as Administrator to control Windows services.' : msg,
  }
}
