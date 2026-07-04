import { execFile, spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { TOOLS, installCommandFor, type ToolDef } from '../../src/shared/tools'
import type { ToolStatus, LogLine } from '../../src/shared/types'

interface ExecResult {
  code: number | string
  stdout: string
  stderr: string
}

function run(cmd: string, args: string[], timeoutMs = 8000): Promise<ExecResult> {
  return new Promise((resolve) => {
    // shell:true so .cmd/.bat shims (npm, pnpm, code) resolve on Windows
    execFile(cmd, args, { windowsHide: true, timeout: timeoutMs, shell: true }, (err, stdout, stderr) => {
      const code = err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0
      resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
  })
}

function expandEnv(p: string): string {
  return p.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? '')
}

const VERSION_RE = /\d+\.\d+(?:\.\d+)?/

async function detectTool(t: ToolDef): Promise<ToolStatus> {
  if (t.cmd) {
    const res = await run(t.cmd, t.versionArgs ?? ['--version'])
    if (res.code === 0) {
      const m = (res.stdout || res.stderr).match(VERSION_RE)
      return { id: t.id, installed: true, version: m?.[0] }
    }
  }
  if (t.paths) {
    for (const p of t.paths) {
      if (existsSync(expandEnv(p))) return { id: t.id, installed: true }
    }
  }
  if (t.dirPrefix) {
    try {
      const entries = readdirSync(t.dirPrefix.dir)
      const hit = entries.find((e) => e.toLowerCase().startsWith(t.dirPrefix!.prefix.toLowerCase()))
      if (hit) {
        const m = hit.match(VERSION_RE)
        return { id: t.id, installed: true, version: m?.[0] }
      }
    } catch {
      /* dir does not exist */
    }
  }
  return { id: t.id, installed: false }
}

export async function detectTools(): Promise<ToolStatus[]> {
  // run in small batches to avoid spawning ~17 processes at once
  const results: ToolStatus[] = []
  const queue = [...TOOLS]
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length > 0) {
      const t = queue.shift()!
      results.push(await detectTool(t))
    }
  })
  await Promise.all(workers)
  return results
}

const activeInstalls = new Set<string>()

export function installTool(
  toolId: string,
  onLog: (line: LogLine) => void,
): Promise<{ ok: boolean; error?: string }> {
  const tool = TOOLS.find((t) => t.id === toolId)
  if (!tool) return Promise.resolve({ ok: false, error: 'Unknown tool' })
  if (activeInstalls.has(toolId)) return Promise.resolve({ ok: false, error: 'Install already in progress' })

  let cmd = installCommandFor(tool)
  if (!cmd) return Promise.resolve({ ok: false, error: 'No install command available — use the download page.' })
  if (tool.winget) {
    // non-interactive winget: auto-accept agreements so the install never blocks on a prompt
    cmd += ' --accept-package-agreements --accept-source-agreements'
  }

  activeInstalls.add(toolId)
  onLog({ ts: Date.now(), stream: 'sys', text: `$ ${cmd}` })

  return new Promise((resolve) => {
    const child = spawn(cmd, { shell: true, windowsHide: true })
    const emit = (stream: 'out' | 'err') => (data: Buffer) => {
      for (const text of data.toString().split(/\r?\n/)) {
        const trimmed = text.trim()
        if (trimmed) onLog({ ts: Date.now(), stream, text: trimmed })
      }
    }
    child.stdout.on('data', emit('out'))
    child.stderr.on('data', emit('err'))
    child.on('error', (err) => {
      activeInstalls.delete(toolId)
      resolve({ ok: false, error: err.message })
    })
    child.on('close', (code) => {
      activeInstalls.delete(toolId)
      if (code === 0) resolve({ ok: true })
      else resolve({ ok: false, error: `Installer exited with code ${code}` })
    })
  })
}

export { run, expandEnv, VERSION_RE }
export type { ExecResult }
