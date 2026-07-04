import { execFile } from 'node:child_process'
import type { DockerStatus, DbContainer, DbKind, ContainerState } from '../../src/shared/types'

interface ExecResult {
  code: number | string
  stdout: string
  stderr: string
}

export function dockerExec(args: string[], timeoutMs = 30000): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      'docker',
      args,
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code = err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
      },
    )
  })
}

export async function getDockerStatus(): Promise<DockerStatus> {
  const res = await dockerExec(['version', '--format', '{{.Server.Version}}'], 10000)
  if (res.code === 'ENOENT') return { installed: false, running: false }
  if (res.code === 0 && res.stdout.trim()) {
    return { installed: true, running: true, version: res.stdout.trim() }
  }
  // CLI exists but the daemon (Docker Desktop) is not reachable
  return { installed: true, running: false }
}

const DB_IMAGE_RE = /mysql|mariadb|postgres/i

function kindOf(image: string): DbKind {
  return /postgres/i.test(image) ? 'postgres' : 'mysql'
}

function envValue(env: string[], key: string): string | undefined {
  const hit = env.find((e) => e.startsWith(key + '='))
  return hit ? hit.slice(key.length + 1) : undefined
}

export async function listDbContainers(): Promise<DbContainer[]> {
  const ps = await dockerExec(['ps', '-a', '--no-trunc', '--format', '{{.ID}}\t{{.Image}}'])
  if (ps.code !== 0) return []
  const ids = ps.stdout
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split('\t'))
    .filter(([, image]) => DB_IMAGE_RE.test(image ?? ''))
    .map(([id]) => id)
  if (ids.length === 0) return []

  const inspect = await dockerExec(['inspect', ...ids])
  if (inspect.code !== 0) return []
  let details: any[]
  try {
    details = JSON.parse(inspect.stdout)
  } catch {
    return []
  }

  return details.map((d): DbContainer => {
    const image: string = d.Config?.Image ?? ''
    const kind = kindOf(image)
    const containerPort = kind === 'postgres' ? 5432 : 3306
    const env: string[] = d.Config?.Env ?? []
    const portKey = `${containerPort}/tcp`
    const bound =
      d.NetworkSettings?.Ports?.[portKey]?.[0]?.HostPort ?? d.HostConfig?.PortBindings?.[portKey]?.[0]?.HostPort
    const state: ContainerState = d.State?.Status ?? 'exited'
    return {
      id: d.Id,
      name: (d.Name ?? '').replace(/^\//, ''),
      image,
      kind,
      state,
      status: d.State?.Running ? `Running since ${d.State?.StartedAt?.slice(0, 19).replace('T', ' ')}` : state,
      hostPort: bound ? Number(bound) : undefined,
      containerPort,
      user: kind === 'postgres' ? (envValue(env, 'POSTGRES_USER') ?? 'postgres') : 'root',
      password:
        kind === 'postgres'
          ? envValue(env, 'POSTGRES_PASSWORD')
          : (envValue(env, 'MYSQL_ROOT_PASSWORD') ?? envValue(env, 'MARIADB_ROOT_PASSWORD')),
    }
  })
}

const SYSTEM_DBS = new Set(['information_schema', 'mysql', 'performance_schema', 'sys'])
const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/

async function mysqlQuery(c: DbContainer, sql: string): Promise<ExecResult> {
  const base = ['exec', '-e', `MYSQL_PWD=${c.password ?? ''}`, c.id]
  // mariadb images are deprecating the `mysql` client name; try both
  let res = await dockerExec([...base, 'mysql', `-u${c.user}`, '-N', '-e', sql])
  if (res.code !== 0 && /executable file not found|OCI runtime/i.test(res.stderr)) {
    res = await dockerExec([...base, 'mariadb', `-u${c.user}`, '-N', '-e', sql])
  }
  return res
}

async function pgQuery(c: DbContainer, sql: string): Promise<ExecResult> {
  return dockerExec(['exec', c.id, 'psql', '-U', c.user, '-t', '-A', '-c', sql])
}

export async function listDatabases(c: DbContainer): Promise<{ ok: boolean; databases?: string[]; error?: string }> {
  const res =
    c.kind === 'postgres'
      ? await pgQuery(c, 'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname')
      : await mysqlQuery(c, 'SHOW DATABASES')
  if (res.code !== 0) {
    return { ok: false, error: (res.stderr || res.stdout).trim().split(/\r?\n/)[0] || 'Query failed' }
  }
  const databases = res.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !SYSTEM_DBS.has(l))
  return { ok: true, databases }
}

export async function createDatabase(c: DbContainer, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!NAME_RE.test(name)) {
    return { ok: false, error: 'Invalid database name. Use letters, numbers, dashes and underscores.' }
  }
  const res =
    c.kind === 'postgres'
      ? await pgQuery(c, `CREATE DATABASE "${name}"`)
      : await mysqlQuery(c, `CREATE DATABASE \`${name}\``)
  if (res.code !== 0) {
    return { ok: false, error: (res.stderr || res.stdout).trim().split(/\r?\n/)[0] || 'Create failed' }
  }
  return { ok: true }
}

export async function containerAction(id: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; error?: string }> {
  const res = await dockerExec([action, id], 60000)
  return res.code === 0 ? { ok: true } : { ok: false, error: res.stderr.trim() || `docker ${action} failed` }
}
