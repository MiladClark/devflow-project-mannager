import { ipcMain, BrowserWindow } from 'electron'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import type { DbConnection, ConnectionTestResult, ApplyEnvResult } from '../../src/shared/types'
import { store } from '../lib/store'
import { dockerExec, getDockerStatus, listDbContainers } from '../lib/docker'

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

function activity(level: 'ok' | 'info' | 'warn' | 'err', title: string, message: string) {
  const ev = store.addActivity({ level, title, message })
  broadcast('activity:event', ev)
}

function tcpProbe(host: string, port: number, timeoutMs: number): Promise<number | string> {
  return new Promise((resolve) => {
    const start = Date.now()
    const sock = net.connect({ host, port })
    const fail = (msg: string) => {
      sock.destroy()
      resolve(msg)
    }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => {
      const ms = Date.now() - start
      sock.destroy()
      resolve(ms)
    })
    sock.once('timeout', () => fail(`Connection timed out after ${timeoutMs}ms`))
    sock.once('error', (err) => fail(err.message))
  })
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/** Full credential check by running the DB client inside a matching Docker container over TCP. */
async function dockerAuthTest(conn: DbConnection): Promise<ConnectionTestResult | null> {
  if (!LOCAL_HOSTS.has(conn.host)) return null
  const status = await getDockerStatus()
  if (!status.running) return null
  const containers = await listDbContainers()
  const match = containers.find((c) => c.state === 'running' && c.hostPort === conn.port && c.kind === conn.kind)
  if (!match) return null

  // Connect back through the published host port (host.docker.internal) so the server
  // treats it as a remote client and actually verifies the password — the official
  // postgres image trusts connections originating inside the container.
  const start = Date.now()
  const res =
    conn.kind === 'postgres'
      ? await dockerExec([
          'exec',
          match.id,
          'psql',
          `postgresql://${conn.user}:${encodeURIComponent(conn.password)}@host.docker.internal:${conn.port}/${conn.database || 'postgres'}`,
          '-t',
          '-A',
          '-c',
          'SELECT 1',
        ])
      : await dockerExec([
          'exec',
          '-e',
          `MYSQL_PWD=${conn.password}`,
          match.id,
          'mysql',
          '-hhost.docker.internal',
          '-P',
          String(conn.port),
          `-u${conn.user}`,
          ...(conn.database ? [conn.database] : []),
          '-N',
          '-e',
          'SELECT 1',
        ])
  const latencyMs = Date.now() - start
  if (res.code === 0) {
    return { ok: true, method: 'auth', latencyMs, message: `Authenticated as ${conn.user} (via container ${match.name})`, testedAt: Date.now() }
  }
  return {
    ok: false,
    method: 'auth',
    latencyMs,
    message: (res.stderr || res.stdout).trim().split(/\r?\n/)[0] || 'Authentication failed',
    testedAt: Date.now(),
  }
}

async function testConnection(conn: DbConnection): Promise<ConnectionTestResult> {
  const timeout = Math.max(1000, (conn.connectTimeout || 5) * 1000)
  const tcp = await tcpProbe(conn.host, conn.port, timeout)
  if (typeof tcp === 'string') {
    return { ok: false, method: 'tcp', latencyMs: 0, message: `TCP ${conn.host}:${conn.port} — ${tcp}`, testedAt: Date.now() }
  }
  // port reachable; try a real credential check when a matching local container exists
  const auth = await dockerAuthTest(conn)
  if (auth) return auth
  return {
    ok: true,
    method: 'tcp',
    latencyMs: tcp,
    message: `Port reachable in ${tcp}ms (credentials not verified — no matching local Docker container)`,
    testedAt: Date.now(),
  }
}

export function buildConnectionString(conn: DbConnection, maskPassword = false): string {
  const pw = maskPassword ? '****' : encodeURIComponent(conn.password)
  const user = encodeURIComponent(conn.user)
  const db = conn.database || (conn.kind === 'postgres' ? 'postgres' : '')
  const params = new URLSearchParams()
  if (conn.kind === 'postgres') {
    if (conn.sslMode !== 'prefer') params.set('sslmode', conn.sslMode)
    if (conn.connectTimeout) params.set('connect_timeout', String(conn.connectTimeout))
  } else {
    if (conn.sslMode === 'require') params.set('ssl', 'true')
    if (conn.connectTimeout) params.set('connectTimeout', String(conn.connectTimeout * 1000))
  }
  for (const kv of conn.extraParams.split('&')) {
    const [k, v] = kv.split('=')
    if (k?.trim()) params.set(k.trim(), v ?? '')
  }
  const qs = params.toString()
  const scheme = conn.kind === 'postgres' ? 'postgresql' : 'mysql'
  return `${scheme}://${user}:${pw}@${conn.host}:${conn.port}/${db}${qs ? '?' + qs : ''}`
}

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

function applyToProject(conn: DbConnection): ApplyEnvResult {
  if (!conn.projectId) return { ok: false, error: 'Connection is not attached to a project.' }
  const project = store.getProject(conn.projectId)
  if (!project) return { ok: false, error: 'Attached project no longer exists.' }
  if (!ENV_KEY_RE.test(conn.envVarName)) return { ok: false, error: 'Invalid environment variable name.' }

  const file = path.join(project.path, conn.envFile)
  const line = `${conn.envVarName}=${buildConnectionString(conn)}`
  let content = ''
  let previous: string | undefined
  if (fs.existsSync(file)) {
    content = fs.readFileSync(file, 'utf-8')
    const re = new RegExp(`^${conn.envVarName}=(.*)$`, 'm')
    const m = content.match(re)
    if (m) {
      previous = m[1]
      content = content.replace(re, line)
    } else {
      content = content.replace(/\n?$/, '\n') + line + '\n'
    }
  } else {
    content = line + '\n'
  }
  fs.writeFileSync(file, content, 'utf-8')
  activity('ok', 'Connection Applied', `${conn.envVarName} written to ${project.name}/${conn.envFile}`)
  return { ok: true, file, previous }
}

export function registerConnectionHandlers() {
  ipcMain.handle('connections:list', () => store.getConnections())

  ipcMain.handle('connections:save', (_e, conn: DbConnection) => {
    store.saveConnection(conn)
    broadcast('connections:changed', store.getConnections())
    return store.getConnections()
  })

  ipcMain.handle('connections:remove', (_e, id: string) => {
    store.removeConnection(id)
    broadcast('connections:changed', store.getConnections())
    return store.getConnections()
  })

  ipcMain.handle('connections:test', async (_e, conn: DbConnection) => {
    const result = await testConnection(conn)
    const saved = store.getConnections().find((c) => c.id === conn.id)
    if (saved) {
      store.saveConnection({ ...saved, lastTest: result })
      broadcast('connections:changed', store.getConnections())
    }
    return result
  })

  ipcMain.handle('connections:apply', (_e, conn: DbConnection) => applyToProject(conn))
}
