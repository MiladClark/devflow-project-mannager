import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ComposeService, ComposeStatus, LogLine } from '../../src/shared/types'
import { store } from './store'
import { broadcast } from './broadcast'

const COMPOSE_NAMES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']

export function detectComposeFile(projectPath: string): string | undefined {
  for (const name of COMPOSE_NAMES) {
    if (fs.existsSync(path.join(projectPath, name))) return name
  }
  return undefined
}

function composeArgs(projectPath: string, file: string, profile?: string): string[] {
  const args = ['compose', '-f', file]
  if (profile) args.push('--profile', profile)
  return args
}

function log(text: string, stream: LogLine['stream'] = 'out') {
  broadcast('compose:log', { ts: Date.now(), stream, text })
}

function runDocker(args: string[], cwd: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('docker', args, { cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 120000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
  })
}

function getComposeConfig(projectId: string): { projectPath: string; file: string; profile?: string } | null {
  const p = store.getProject(projectId)
  if (!p) return null
  const file = p.composeFile ?? detectComposeFile(p.path)
  if (!file) return null
  return { projectPath: p.path, file, profile: p.composeProfile }
}

export async function composePs(projectId: string): Promise<ComposeStatus> {
  const cfg = getComposeConfig(projectId)
  if (!cfg) return { ok: false, running: false, services: [], error: 'No compose file found.' }

  const args = [...composeArgs(cfg.projectPath, cfg.file, cfg.profile), 'ps', '--format', 'json']
  const res = await runDocker(args, cfg.projectPath)
  if (!res.ok) return { ok: false, running: false, file: cfg.file, services: [], error: res.stderr.trim() || 'docker compose ps failed' }

  const services: ComposeService[] = []
  for (const line of res.stdout.split(/\r?\n/).filter(Boolean)) {
    try {
      const row = JSON.parse(line) as { Service?: string; State?: string; Publishers?: { URL?: string }[] }
      const ports = (row.Publishers ?? []).map((p) => p.URL).filter(Boolean).join(', ')
      services.push({ name: row.Service ?? '?', state: row.State ?? '?', ports })
    } catch {
      /* skip malformed line */
    }
  }

  const running = services.some((s) => s.state.toLowerCase().includes('running'))
  return { ok: true, running, file: cfg.file, services }
}

export async function composeUp(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getComposeConfig(projectId)
  if (!cfg) return { ok: false, error: 'No compose file found.' }

  log(`$ docker compose -f ${cfg.file} up -d`, 'sys')
  const args = [...composeArgs(cfg.projectPath, cfg.file, cfg.profile), 'up', '-d']
  const res = await runDocker(args, cfg.projectPath)
  if (!res.ok) {
    const err = res.stderr.trim() || 'docker compose up failed'
    log(err, 'err')
    return { ok: false, error: err }
  }
  if (res.stdout.trim()) log(res.stdout.trim())
  return { ok: true }
}

export async function composeDown(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getComposeConfig(projectId)
  if (!cfg) return { ok: false, error: 'No compose file found.' }

  log(`$ docker compose -f ${cfg.file} down`, 'sys')
  const args = [...composeArgs(cfg.projectPath, cfg.file, cfg.profile), 'down']
  const res = await runDocker(args, cfg.projectPath)
  if (!res.ok) return { ok: false, error: res.stderr.trim() || 'docker compose down failed' }
  return { ok: true }
}

export function composeLogs(projectId: string, service?: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getComposeConfig(projectId)
  if (!cfg) return Promise.resolve({ ok: false, error: 'No compose file found.' })

  const args = [...composeArgs(cfg.projectPath, cfg.file, cfg.profile), 'logs', '--tail', '100']
  if (service) args.push(service)

  return new Promise((resolve) => {
    const child = spawn('docker', args, { cwd: cfg!.projectPath, windowsHide: true, shell: false })
    child.stdout.on('data', (c: Buffer) => log(c.toString()))
    child.stderr.on('data', (c: Buffer) => log(c.toString(), 'err'))
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('exit', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: `exit ${code}` }))
  })
}
