import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
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

function brew(args: string[], timeoutMs = 15000): Promise<{ code: number | string; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('brew', args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0
      resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
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

async function listDbServicesWin32(): Promise<DbService[]> {
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

interface BrewService {
  name: string
  running?: boolean
  status?: string
}

function mapStateDarwin(status: string | undefined, running: boolean | undefined): ServiceState {
  if (running) return 'running'
  const v = (status ?? '').toLowerCase()
  if (v === 'started') return 'running'
  if (v === 'stopped' || v === 'none') return 'stopped'
  if (v.includes('pending') || v.includes('scheduled')) return 'pending'
  return 'unknown'
}

// Homebrew is the de-facto standard for local dev databases on macOS. If it
// isn't installed, degrade to an empty list (no local services) rather than
// erroring — there's no equally standard fallback (launchctl plists vary too
// much per formula to parse generically).
async function listDbServicesDarwin(): Promise<DbService[]> {
  const res = await brew(['services', 'list', '--json'])
  if (res.code !== 0 || !res.stdout.trim()) return []
  let parsed: BrewService[]
  try {
    parsed = JSON.parse(res.stdout)
  } catch {
    return []
  }
  const list = parsed.filter((s) => /^(mysql|mariadb|postgresql)/i.test(s.name))

  return Promise.all(
    list.map(async (s): Promise<DbService> => {
      const kind: DbKind = /postgres/i.test(s.name) ? 'postgres' : 'mysql'
      const prefixRes = await brew(['--prefix', s.name], 8000)
      const prefix = prefixRes.code === 0 ? prefixRes.stdout.trim() : undefined
      const candidates = kind === 'postgres' ? ['postgres', 'pg_ctl'] : ['mysqld', 'mariadbd']
      let binPath: string | undefined
      if (prefix) {
        for (const bin of candidates) {
          const p = `${prefix}/bin/${bin}`
          if (existsSync(p)) {
            binPath = p
            break
          }
        }
      }
      const version = await versionFromBinary(binPath)
      return {
        name: s.name,
        displayName: s.name,
        kind,
        state: mapStateDarwin(s.status, s.running),
        rawState: s.status ?? (s.running ? 'started' : 'stopped'),
        version,
        binPath,
      }
    }),
  )
}

export function listDbServices(): Promise<DbService[]> {
  return process.platform === 'darwin' ? listDbServicesDarwin() : listDbServicesWin32()
}

async function serviceActionWin32(name: string, action: 'start' | 'stop'): Promise<{ ok: boolean; error?: string }> {
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

async function serviceActionDarwin(name: string, action: 'start' | 'stop'): Promise<{ ok: boolean; error?: string }> {
  // brew formula names can include '@' (e.g. postgresql@16)
  if (!/^[A-Za-z0-9_.@-]{1,80}$/.test(name)) return { ok: false, error: 'Invalid service name' }
  const res = await brew(['services', action, name], 30000)
  if (res.code === 0) return { ok: true }
  const msg = res.stderr.trim().split(/\r?\n/)[0] || `brew services ${action} failed`
  return {
    ok: false,
    error: /not found|no formula/i.test(msg) ? `Homebrew formula '${name}' not found.` : msg,
  }
}

export function serviceAction(name: string, action: 'start' | 'stop'): Promise<{ ok: boolean; error?: string }> {
  return process.platform === 'darwin' ? serviceActionDarwin(name, action) : serviceActionWin32(name, action)
}
