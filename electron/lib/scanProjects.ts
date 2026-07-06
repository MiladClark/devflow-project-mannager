import fs from 'node:fs'
import path from 'node:path'
import type { ScanCandidate } from '../../src/shared/types'
import { detectProject } from './detect'
import { store } from './store'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'out',
  'coverage',
  '.turbo',
  'build',
  '.cache',
])

export function scanForProjects(
  root: string,
  opts?: { maxDepth?: number; maxResults?: number },
): { candidates: ScanCandidate[]; skipped: string[] } {
  const maxDepth = opts?.maxDepth ?? 4
  const maxResults = opts?.maxResults ?? 100
  const imported = new Set(store.getProjects().map((p) => p.path.toLowerCase()))
  const candidates: ScanCandidate[] = []
  const skipped: string[] = []
  const seen = new Set<string>()

  function walk(dir: string, depth: number) {
    if (candidates.length >= maxResults) return
    if (depth > maxDepth) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      skipped.push(dir)
      return
    }

    if (fs.existsSync(path.join(dir, 'package.json'))) {
      const norm = path.normalize(dir).toLowerCase()
      if (!seen.has(norm)) {
        seen.add(norm)
        const result = detectProject(dir)
        if (!('error' in result)) {
          candidates.push({
            project: result,
            alreadyImported: imported.has(norm),
          })
        }
      }
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      walk(path.join(dir, entry.name), depth + 1)
    }
  }

  if (fs.existsSync(root)) walk(root, 0)
  else skipped.push(root)

  return { candidates, skipped }
}
