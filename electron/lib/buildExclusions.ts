import fs from 'node:fs'
import path from 'node:path'
import type { BuildExclusionCandidate } from '../../src/shared/types'

const KNOWN_DIRS: { name: string; reason: string; recommended: boolean }[] = [
  { name: 'node_modules', reason: 'Installed dependencies — rebuilt from package.json, never shipped in an installer.', recommended: true },
  { name: '.git', reason: 'Git history and metadata, not needed at runtime.', recommended: true },
  { name: '.github', reason: 'CI workflow configuration, not needed at runtime.', recommended: true },
  { name: '.vscode', reason: 'Editor configuration.', recommended: true },
  { name: '.idea', reason: 'Editor configuration.', recommended: true },
  { name: 'coverage', reason: 'Test coverage reports.', recommended: true },
  { name: 'logs', reason: 'Local log files.', recommended: true },
  { name: 'tests', reason: 'Test source files, not needed in a production build.', recommended: true },
  { name: '__tests__', reason: 'Test source files, not needed in a production build.', recommended: true },
  { name: 'docs', reason: 'Documentation, not needed at runtime.', recommended: false },
]

const KNOWN_FILES: { name: string; reason: string; recommended: boolean }[] = [
  { name: '.env', reason: 'Local secrets/environment values should not ship in a build.', recommended: true },
  { name: '.env.local', reason: 'Local secrets/environment values should not ship in a build.', recommended: true },
  { name: '.env.development', reason: 'Local secrets/environment values should not ship in a build.', recommended: true },
  { name: 'README.md', reason: 'Documentation, not needed at runtime.', recommended: false },
]

const STAT_CAP = 20000
const TIME_CAP_MS = 3000

function dirSize(dir: string, budget: { calls: number; start: number }): { bytes: number; capped: boolean } {
  let bytes = 0
  let capped = false
  const stack = [dir]
  while (stack.length > 0) {
    if (budget.calls > STAT_CAP || Date.now() - budget.start > TIME_CAP_MS) {
      capped = true
      break
    }
    const current = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      budget.calls++
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else {
        try {
          bytes += fs.statSync(full).size
        } catch {
          /* file removed mid-scan or inaccessible */
        }
      }
    }
  }
  return { bytes, capped }
}

function findTestFiles(dir: string, budget: { calls: number; start: number }, out: string[]) {
  const stack = [dir]
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'release', '.next'])
  while (stack.length > 0) {
    if (budget.calls > STAT_CAP || Date.now() - budget.start > TIME_CAP_MS) return
    const current = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      budget.calls++
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) stack.push(path.join(current, entry.name))
        continue
      }
      if (/\.(test|spec)\.[a-z0-9]+$/i.test(entry.name)) {
        out.push(path.join(current, entry.name))
      }
    }
  }
}

/** Scans a project root for the spec's known "usually not shipped" files/folders. */
export function scanExclusions(dir: string): BuildExclusionCandidate[] {
  const out: BuildExclusionCandidate[] = []
  let rootEntries: fs.Dirent[]
  try {
    rootEntries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  const rootNames = new Set(rootEntries.map((e) => e.name))

  for (const known of KNOWN_DIRS) {
    if (!rootNames.has(known.name)) continue
    const full = path.join(dir, known.name)
    if (!fs.statSync(full).isDirectory()) continue
    const budget = { calls: 0, start: Date.now() }
    const { bytes, capped } = dirSize(full, budget)
    out.push({ path: known.name, reason: known.reason, approxBytes: bytes, approxSize: capped, isDir: true, recommended: known.recommended })
  }

  for (const known of KNOWN_FILES) {
    if (!rootNames.has(known.name)) continue
    const full = path.join(dir, known.name)
    try {
      const stat = fs.statSync(full)
      if (!stat.isFile()) continue
      out.push({ path: known.name, reason: known.reason, approxBytes: stat.size, approxSize: false, isDir: false, recommended: known.recommended })
    } catch {
      /* removed mid-scan */
    }
  }

  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.log')) {
      const full = path.join(dir, entry.name)
      try {
        const stat = fs.statSync(full)
        out.push({ path: entry.name, reason: 'Local log file.', approxBytes: stat.size, approxSize: false, isDir: false, recommended: true })
      } catch {
        /* removed mid-scan */
      }
    }
  }

  const budget = { calls: 0, start: Date.now() }
  const testFiles: string[] = []
  findTestFiles(dir, budget, testFiles)
  for (const full of testFiles) {
    const rel = path.relative(dir, full)
    try {
      const stat = fs.statSync(full)
      out.push({ path: rel, reason: 'Test source file, not needed in a production build.', approxBytes: stat.size, approxSize: false, isDir: false, recommended: true })
    } catch {
      /* removed mid-scan */
    }
  }

  return out
}
