import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import semver from 'semver'
import type { HealthReport, HealthSummary, OutdatedDep, AuditCounts, HealthPhase } from '../../src/shared/types'
import { store } from './store'
import { broadcast } from './broadcast'
import { getEnforcedEntitlements } from './licensing'

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

  const report: HealthReport = {
    projectId,
    scannedAt: Date.now(),
    outdated: [],
    audit: null,
    engines: { installed: await getInstalledNode(), satisfied: null },
  }

  try {
    // npm outdated exits 1 when anything is outdated — parse stdout regardless
    phase(projectId, 'outdated')
    const out = await run('npm', ['outdated', '--json'], project.path, 120000)
    if (out.stdout.trim()) {
      try {
        const parsed = JSON.parse(out.stdout)
        report.outdated = Object.entries(parsed).map(([name, info]: [string, any]): OutdatedDep => ({
          name,
          current: info.current,
          wanted: info.wanted ?? '?',
          latest: info.latest ?? '?',
        }))
      } catch {
        /* unparseable output — leave empty */
      }
    }

    // audit is Pro-gated and needs a lockfile + network
    phase(projectId, 'audit')
    if (getEnforcedEntitlements().healthAudit) {
      const hasLock = fs.existsSync(path.join(project.path, 'package-lock.json'))
      if (!hasLock) {
        report.auditError = 'No package-lock.json — npm audit needs a lockfile.'
      } else {
        const audit = await run('npm', ['audit', '--json'], project.path, 120000)
        if (audit.stdout.trim()) {
          try {
            const parsed = JSON.parse(audit.stdout)
            const v = parsed.metadata?.vulnerabilities
            if (v) {
              const counts: AuditCounts = {
                critical: v.critical ?? 0,
                high: v.high ?? 0,
                moderate: v.moderate ?? 0,
                low: v.low ?? 0,
                info: v.info ?? 0,
                total: v.total ?? (v.critical ?? 0) + (v.high ?? 0) + (v.moderate ?? 0) + (v.low ?? 0) + (v.info ?? 0),
              }
              report.audit = counts
            } else {
              report.auditError = 'npm audit returned no vulnerability metadata.'
            }
          } catch {
            report.auditError = 'Could not parse npm audit output.'
          }
        } else {
          report.auditError = audit.stderr.trim().split(/\r?\n/)[0] || 'npm audit produced no output.'
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
