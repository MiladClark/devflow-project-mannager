import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import semver from 'semver'
import type { HealthReport, HealthSummary, OutdatedDep, AuditCounts, HealthPhase } from '../../src/shared/types'
import { store } from './store'
import { broadcast } from './broadcast'
import { getEnforcedEntitlements } from './licensing'
import { resolvePackageManager } from './pkgmanager'
import { auditCommand, outdatedCommand, type PackageManagerCommand } from './packageManagerAdapter'

const reports = new Map<string, HealthReport>()
const queue: string[] = []
let scanning = false
let installedNode: string | null = null

function run(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<{ code: number | string; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd, windowsHide: true, timeout: timeoutMs, shell: true, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code = err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
      },
    )
  })
}

function runSpec(spec: PackageManagerCommand, cwd: string, timeoutMs: number) {
  return run(spec.executable, spec.args, cwd, timeoutMs)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeOutdatedObject(parsed: unknown): OutdatedDep[] {
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item): OutdatedDep[] => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const name = String(row.name ?? row.package ?? '')
      if (!name) return []
      return [{
        name,
        current: row.current == null ? undefined : String(row.current),
        wanted: String(row.wanted ?? row.current ?? '?'),
        latest: String(row.latest ?? row.wanted ?? '?'),
      }]
    })
  }
  if (!parsed || typeof parsed !== 'object') return []
  return Object.entries(parsed as Record<string, unknown>).flatMap(([name, value]): OutdatedDep[] => {
    if (!value || typeof value !== 'object') return []
    const row = value as Record<string, unknown>
    return [{
      name,
      current: row.current == null ? undefined : String(row.current),
      wanted: String(row.wanted ?? row.current ?? '?'),
      latest: String(row.latest ?? row.wanted ?? '?'),
    }]
  })
}

/** Parse npm/pnpm JSON, Yarn Classic JSON-lines, and Bun's text table. */
export function parseOutdatedOutput(text: string): OutdatedDep[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const whole = parseJson(trimmed)
  const normalized = normalizeOutdatedObject(whole)
  if (normalized.length > 0) return normalized

  for (const line of trimmed.split(/\r?\n/)) {
    const event = parseJson(line) as { type?: string; data?: { body?: unknown[][] } } | null
    if (event?.type !== 'table' || !Array.isArray(event.data?.body)) continue
    return event.data.body.flatMap((row): OutdatedDep[] => {
      if (!Array.isArray(row) || row.length < 4) return []
      return [{ name: String(row[0]), current: String(row[1]), wanted: String(row[2]), latest: String(row[3]) }]
    })
  }

  const clean = trimmed.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
  return clean.split(/\r?\n/).flatMap((line): OutdatedDep[] => {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 4 || /^(package|current|latest|outdated|─|┌|└)/i.test(parts[0])) return []
    if (!/\d/.test(parts[1]) || !/\d/.test(parts[parts.length - 1])) return []
    return [{
      name: parts[0],
      current: parts[1],
      wanted: parts.length >= 4 ? parts[2] : '?',
      latest: parts[3],
    }]
  })
}

function emptyAuditCounts(): AuditCounts {
  return { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 }
}

function countsFromValue(value: unknown): AuditCounts | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (!['critical', 'high', 'moderate', 'low', 'info'].some((key) => typeof row[key] === 'number')) return null
  const counts = emptyAuditCounts()
  counts.critical = Number(row.critical ?? 0)
  counts.high = Number(row.high ?? 0)
  counts.moderate = Number(row.moderate ?? 0)
  counts.low = Number(row.low ?? 0)
  counts.info = Number(row.info ?? 0)
  counts.total = Number(row.total ?? counts.critical + counts.high + counts.moderate + counts.low + counts.info)
  return counts
}

function countsFromAdvisories(value: unknown): AuditCounts | null {
  if (!value || typeof value !== 'object') return null
  const counts = emptyAuditCounts()
  let found = false
  for (const item of Object.values(value as Record<string, unknown>)) {
    if (!item || typeof item !== 'object') continue
    const severity = String((item as Record<string, unknown>).severity ?? '').toLowerCase()
    if (severity in counts && severity !== 'total') {
      counts[severity as keyof Omit<AuditCounts, 'total'>] += 1
      counts.total += 1
      found = true
    }
  }
  return found ? counts : null
}

export function parseAuditOutput(text: string): AuditCounts | null {
  const candidates: unknown[] = []
  const whole = parseJson(text.trim())
  if (whole) candidates.push(whole)
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseJson(line)
    if (parsed) candidates.push(parsed)
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const row = candidate as Record<string, any>
    const direct = countsFromValue(row.metadata?.vulnerabilities ?? row.data?.vulnerabilities)
    if (direct) return direct
    const advisories = countsFromAdvisories(row.advisories)
    if (advisories) return advisories
    if (row.vulnerabilities && typeof row.vulnerabilities === 'object') {
      const bySeverity = countsFromAdvisories(row.vulnerabilities)
      if (bySeverity) return bySeverity
    }
  }
  return null
}

async function yarnMajor(projectPath: string): Promise<number | undefined> {
  const result = await run('yarn', ['--version'], projectPath, 10_000)
  const major = Number.parseInt(result.stdout.trim().split('.')[0], 10)
  return Number.isFinite(major) ? major : undefined
}

function hasManagerLockfile(projectPath: string, pm: HealthReport['packageManager']): boolean {
  const files: Record<HealthReport['packageManager'], string[]> = {
    npm: ['package-lock.json', 'npm-shrinkwrap.json'],
    pnpm: ['pnpm-lock.yaml'],
    yarn: ['yarn.lock'],
    bun: ['bun.lock', 'bun.lockb'],
  }
  return files[pm].some((name) => fs.existsSync(path.join(projectPath, name)))
}

function phase(projectId: string, p: HealthPhase) {
  broadcast('health:status', projectId, p)
}

function summarize(r: HealthReport): HealthSummary {
  return {
    scannedAt: r.scannedAt,
    outdatedCount: r.outdated.length,
    vulnHighPlus: r.audit ? r.audit.high + r.audit.critical : 0,
    vulnTotal: r.audit?.total ?? 0,
    enginesOk: r.engines.satisfied,
  }
}

async function getInstalledNode(): Promise<string> {
  if (installedNode) return installedNode
  const res = await run('node', ['--version'], process.cwd(), 10000)
  installedNode = res.stdout.trim().replace(/^v/, '') || process.versions.node
  return installedNode
}

async function scan(projectId: string): Promise<void> {
  const project = store.getProject(projectId)
  if (!project) return

  const packageManager = resolvePackageManager(project.path)
  const detectedYarnMajor = packageManager === 'yarn' ? await yarnMajor(project.path) : undefined

  const report: HealthReport = {
    projectId,
    scannedAt: Date.now(),
    packageManager,
    outdated: [],
    audit: null,
    engines: { installed: await getInstalledNode(), satisfied: null },
  }

  try {
    // Package managers commonly exit non-zero when updates exist, so parse
    // stdout regardless of the exit code.
    phase(projectId, 'outdated')
    const outdatedSpec = outdatedCommand(packageManager, detectedYarnMajor)
    if (!outdatedSpec) {
      report.outdatedError = 'Modern Yarn does not expose a stable outdated command. Use "yarn up -i" for an interactive upgrade review.'
    } else {
      const out = await runSpec(outdatedSpec, project.path, 120000)
      report.outdated = parseOutdatedOutput(out.stdout)
      if (out.code !== 0 && report.outdated.length === 0 && out.stderr.trim()) {
        report.outdatedError = out.stderr.trim().split(/\r?\n/)[0]
      }
    }

    // audit is Pro-gated and needs a lockfile + network
    phase(projectId, 'audit')
    if (getEnforcedEntitlements().healthAudit) {
      if (!hasManagerLockfile(project.path, packageManager)) {
        report.auditError = `No ${packageManager} lockfile found — dependency audit needs a lockfile.`
      } else {
        const audit = await runSpec(auditCommand(packageManager, detectedYarnMajor), project.path, 120000)
        if (audit.stdout.trim()) {
          report.audit = parseAuditOutput(audit.stdout)
          if (!report.audit) report.auditError = `Could not parse ${packageManager} audit output.`
        } else {
          report.auditError = audit.stderr.trim().split(/\r?\n/)[0] || `${packageManager} audit produced no output.`
        }
      }
    } else {
      report.auditError = 'pro_required'
    }

    // engines check
    phase(projectId, 'engines')
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(project.path, 'package.json'), 'utf-8'))
      const required = pkg.engines?.node
      if (required) {
        report.engines.required = required
        const coerced = semver.coerce(report.engines.installed)
        report.engines.satisfied = coerced ? semver.satisfies(coerced, required) : null
      }
    } catch {
      /* no package.json readable */
    }

    phase(projectId, 'done')
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err)
    phase(projectId, 'error')
  }

  report.scannedAt = Date.now()
  reports.set(projectId, report)
  store.setHealthSummary(projectId, summarize(report))
  broadcast('health:result', projectId, report)
  broadcast('health:summaries', store.getHealthSummaries())
}

async function drainQueue() {
  if (scanning) return
  scanning = true
  while (queue.length > 0) {
    const id = queue.shift()!
    await scan(id)
  }
  scanning = false
}

export function queueScan(projectId: string): { queued: boolean; position: number } {
  if (queue.includes(projectId)) return { queued: true, position: queue.indexOf(projectId) + 1 }
  queue.push(projectId)
  phase(projectId, 'queued')
  void drainQueue()
  return { queued: true, position: queue.length }
}

export function getReport(projectId: string): HealthReport | null {
  return reports.get(projectId) ?? null
}
