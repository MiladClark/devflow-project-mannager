import { app } from 'electron'
import { execFile, spawn, execSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ProxySetupStatus } from '../../src/shared/types'
import { detectEnv } from './tools'
import { store } from './store'

const HOSTS_MARKER_BEGIN = '# DevFlow begin'
const HOSTS_MARKER_END = '# DevFlow end'
const HOSTS_PATH = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts'

const TOOL_PATHS: Record<'mkcert' | 'caddy', string[]> = {
  mkcert: [
    '%LOCALAPPDATA%\\Microsoft\\WinGet\\Links\\mkcert.exe',
    '%ProgramFiles%\\mkcert\\mkcert.exe',
    '%ChocolateyInstall%\\bin\\mkcert.exe',
  ],
  caddy: [
    '%LOCALAPPDATA%\\Microsoft\\WinGet\\Links\\caddy.exe',
    '%ProgramFiles%\\Caddy\\caddy.exe',
    '%ChocolateyInstall%\\bin\\caddy.exe',
  ],
}

const registry = new Map<string, { projectId: string; port: number; domain: string }>()
let caddyProc: ChildProcess | null = null

function userData(...parts: string[]) {
  return path.join(app.getPath('userData'), ...parts)
}

function certsDir() {
  const dir = userData('certs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function caddyConfigPath() {
  return userData('Caddyfile')
}

function expandEnv(p: string, env: NodeJS.ProcessEnv): string {
  return p.replace(/%([^%]+)%/g, (_, name) => env[name] ?? process.env[name] ?? '')
}

export function httpsPort(): number {
  return process.platform === 'win32' ? 8443 : 443
}

function publicUrl(domain: string): string {
  const port = httpsPort()
  return port === 443 ? `https://${domain}/` : `https://${domain}:${port}/`
}

function caddySiteAddress(domain: string): string {
  const port = httpsPort()
  return port === 443 ? domain : `${domain}:${port}`
}

function resolveTool(cmd: 'mkcert' | 'caddy'): string | null {
  const env = detectEnv()
  try {
    const out = execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, {
      env,
      encoding: 'utf8',
      windowsHide: true,
    })
    const hit = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean)
    if (hit) return hit
  } catch {
    /* not on PATH */
  }
  for (const p of TOOL_PATHS[cmd]) {
    const expanded = expandEnv(p, env)
    if (expanded && fs.existsSync(expanded)) return expanded
  }
  return null
}

function run(cmd: string, args: string[], opts?: { timeout?: number }): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const env = detectEnv()
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: opts?.timeout ?? 30000, shell: true, env }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: (stdout ?? '').trim(), stderr: (stderr ?? '').trim() })
    })
  })
}

export function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'app'
}

export function projectDomain(projectId: string): string | null {
  const p = store.getProject(projectId)
  if (!p) return null
  const settings = store.getSettings()
  if (!settings.localDomainsEnabled) return null
  const slug = p.localSlug?.trim() || sanitizeSlug(p.name)
  const suffix = settings.localDomainSuffix?.trim() || 'test'
  return `${slug}.${suffix}`
}

function readHosts(): string {
  try {
    return fs.readFileSync(HOSTS_PATH, 'utf-8')
  } catch {
    return ''
  }
}

function writeHostsBlock(domains: string[]) {
  const lines = domains.map((d) => `127.0.0.1 ${d}`)
  const block = [HOSTS_MARKER_BEGIN, ...lines, HOSTS_MARKER_END].join('\r\n')
  const existing = readHosts()
  const re = new RegExp(`${HOSTS_MARKER_BEGIN}[\\s\\S]*?${HOSTS_MARKER_END}\\r?\\n?`, 'm')
  const cleaned = existing.replace(re, '').trimEnd()
  const next = cleaned ? `${cleaned}\r\n\r\n${block}\r\n` : `${block}\r\n`
  fs.writeFileSync(HOSTS_PATH, next, 'utf-8')
}

async function ensureCert(domain: string, mkcert: string): Promise<{ cert: string; key: string } | null> {
  const certPath = path.join(certsDir(), `${domain}.pem`)
  const keyPath = path.join(certsDir(), `${domain}-key.pem`)
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) return { cert: certPath, key: keyPath }
  const r = await run(mkcert, ['-cert-file', certPath, '-key-file', keyPath, domain])
  return r.ok ? { cert: certPath, key: keyPath } : null
}

async function writeCaddyfile(mkcert: string): Promise<string | null> {
  const blocks: string[] = []
  for (const entry of registry.values()) {
    const tls = await ensureCert(entry.domain, mkcert)
    if (!tls) return `Could not create certificate for ${entry.domain}. Run Local HTTPS setup in Settings.`
    blocks.push(`${caddySiteAddress(entry.domain)} {
  reverse_proxy 127.0.0.1:${entry.port}
  tls ${tls.cert.replace(/\\/g, '/')} ${tls.key.replace(/\\/g, '/')}
}`)
  }
  fs.writeFileSync(caddyConfigPath(), blocks.join('\n\n') || '# DevFlow — no active projects\n', 'utf-8')
  return null
}

async function reloadCaddy(mkcert: string, caddy: string): Promise<{ ok: boolean; error?: string }> {
  const writeErr = await writeCaddyfile(mkcert)
  if (writeErr) return { ok: false, error: writeErr }

  const cfg = caddyConfigPath()
  if (!fs.existsSync(cfg)) return { ok: false, error: 'Caddy config was not created.' }

  if (caddyProc && !caddyProc.killed) {
    const reload = await run(caddy, ['reload', '--config', cfg])
    if (reload.ok) return { ok: true }
    return { ok: false, error: reload.stderr || 'Caddy reload failed.' }
  }

  if (!store.getSettings().proxyAutoStart && registry.size === 0) return { ok: true }

  return new Promise((resolve) => {
    let stderr = ''
    caddyProc = spawn(caddy, ['run', '--config', cfg], {
      windowsHide: true,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: detectEnv(),
    })
    caddyProc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    caddyProc.on('error', (err) => resolve({ ok: false, error: err.message }))
    caddyProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        caddyProc = null
        resolve({ ok: false, error: stderr.trim() || `Caddy exited with code ${code}` })
      }
    })
    setTimeout(() => {
      if (caddyProc && !caddyProc.killed) resolve({ ok: true })
      else resolve({ ok: false, error: stderr.trim() || 'Caddy failed to start.' })
    }, 800)
  })
}

export async function getProxySetupStatus(): Promise<ProxySetupStatus> {
  const mkcert = resolveTool('mkcert')
  const caddy = resolveTool('caddy')
  let mkcertTrusted = false
  if (mkcert) {
    const r = await run(mkcert, ['-CAROOT'])
    mkcertTrusted = r.ok && fs.existsSync(path.join(r.stdout, 'rootCA.pem'))
  }
  const hosts = readHosts()
  const hostsConfigured = hosts.includes(HOSTS_MARKER_BEGIN)
  const caddyRunning = !!caddyProc && !caddyProc.killed
  const ready = !!mkcert && !!caddy && hostsConfigured && mkcertTrusted
  return {
    mkcertInstalled: !!mkcert,
    mkcertTrusted,
    caddyInstalled: !!caddy,
    caddyRunning,
    hostsConfigured,
    ready,
    httpsPort: httpsPort(),
  }
}

export async function setupProxy(): Promise<{ ok: boolean; error?: string }> {
  const mkcert = resolveTool('mkcert')
  const caddy = resolveTool('caddy')
  if (!mkcert) return { ok: false, error: 'mkcert is not installed. Install it from Apps & Tools.' }
  if (!caddy) return { ok: false, error: 'Caddy is not installed. Install it from Apps & Tools.' }

  const install = await run(mkcert, ['-install'])
  if (!install.ok) {
    return {
      ok: false,
      error: install.stderr || 'mkcert -install failed. Run DevFlow as Administrator once, then retry setup.',
    }
  }

  try {
    const domains = [...registry.values()].map((e) => e.domain)
    writeHostsBlock(domains)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not write hosts file. Run DevFlow as Administrator once.',
    }
  }

  const reload = await reloadCaddy(mkcert, caddy)
  if (!reload.ok) return { ok: false, error: reload.error ?? 'Caddy failed to start.' }
  return { ok: true }
}

export async function registerProxy(
  projectId: string,
  port: number,
): Promise<{ url: string | null; error?: string }> {
  const settings = store.getSettings()
  if (!settings.localDomainsEnabled) {
    return { url: null, error: 'Enable “Local HTTPS domains” in Settings, then restart the dev server.' }
  }

  const domain = projectDomain(projectId)
  if (!domain) return { url: null, error: 'Could not resolve local domain for this project.' }

  const mkcert = resolveTool('mkcert')
  const caddy = resolveTool('caddy')
  if (!mkcert || !caddy) {
    return { url: null, error: 'Install mkcert and Caddy from Apps & Tools, then run Local HTTPS setup in Settings.' }
  }

  const status = await getProxySetupStatus()
  if (!status.ready) {
    const setup = await setupProxy()
    if (!setup.ok) return { url: null, error: setup.error ?? 'Local HTTPS setup failed. Run setup in Settings as Administrator.' }
  }

  registry.set(projectId, { projectId, port, domain })

  try {
    const domains = [...registry.values()].map((e) => e.domain)
    writeHostsBlock(domains)
  } catch {
    return { url: null, error: 'Could not update hosts file. Run DevFlow as Administrator once.' }
  }

  const reload = await reloadCaddy(mkcert, caddy)
  if (!reload.ok) {
    registry.delete(projectId)
    return { url: null, error: reload.error ?? 'Caddy failed to start reverse proxy.' }
  }

  return { url: publicUrl(domain) }
}

export async function unregisterProxy(projectId: string): Promise<void> {
  if (!registry.has(projectId)) return
  registry.delete(projectId)

  const mkcert = resolveTool('mkcert')
  const caddy = resolveTool('caddy')
  if (!mkcert || !caddy) return

  try {
    const domains = [...registry.values()].map((e) => e.domain)
    writeHostsBlock(domains)
  } catch {
    /* ignore */
  }

  await reloadCaddy(mkcert, caddy)
}

export function stopProxy(): void {
  if (caddyProc && !caddyProc.killed) {
    caddyProc.kill()
    caddyProc = null
  }
}

export function validateLocalSlug(slug: string, excludeProjectId?: string): string | null {
  const s = slug.trim().toLowerCase()
  if (!/^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$/.test(s)) {
    return 'Slug must be 2–48 characters: lowercase letters, numbers and hyphens.'
  }
  const suffix = store.getSettings().localDomainSuffix || 'test'
  const domain = `${s}.${suffix}`
  for (const p of store.getProjects()) {
    if (p.id === excludeProjectId) continue
    const other = p.localSlug?.trim() || sanitizeSlug(p.name)
    if (`${other}.${suffix}` === domain) return `Domain ${domain} is already used by "${p.name}".`
  }
  return null
}
