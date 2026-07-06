import { execFile } from 'node:child_process'
import type { GitStatus, GitFileEntry, GitActionResult } from '../../src/shared/types'

interface ExecResult {
  code: number | string
  stdout: string
  stderr: string
}

function git(cwd: string, args: string[], timeoutMs = 20000): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd,
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        // GIT_TERMINAL_PROMPT=0 makes auth-required network ops fail fast with a
        // clear error instead of hanging on an invisible username/password prompt.
        // Git Credential Manager (which uses the credential protocol, not the tty)
        // still works for its browser-based GitHub sign-in.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
      (err, stdout, stderr) => {
        const code = err ? ((err as NodeJS.ErrnoException).code ?? 1) : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
      },
    )
  })
}

const NOT_INSTALLED: GitStatus = {
  gitInstalled: false,
  isRepo: false,
  ahead: 0,
  behind: 0,
  hasUpstream: false,
  hasRemote: false,
  dirtyCount: 0,
  staged: [],
  unstaged: [],
  untracked: [],
  fetchedAt: 0,
}

const statusCache = new Map<string, GitStatus>()
const CACHE_TTL = 30_000

// serialize mutations per repo so concurrent git ops never overlap
const chains = new Map<string, Promise<unknown>>()
function serialize<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(cwd) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  chains.set(cwd, next)
  return next
}

export async function getGitStatus(cwd: string, refresh = false): Promise<GitStatus> {
  const cached = statusCache.get(cwd)
  if (!refresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached

  const res = await git(cwd, ['status', '--porcelain=v2', '--branch', '-z'])
  if (res.code === 'ENOENT') return NOT_INSTALLED
  if (res.code !== 0) {
    const status: GitStatus = { ...NOT_INSTALLED, gitInstalled: true, fetchedAt: Date.now() }
    statusCache.set(cwd, status)
    return status
  }

  const status: GitStatus = {
    gitInstalled: true,
    isRepo: true,
    ahead: 0,
    behind: 0,
    hasUpstream: false,
    hasRemote: false,
    dirtyCount: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    fetchedAt: Date.now(),
  }

  for (const entry of res.stdout.split('\0')) {
    if (!entry) continue
    if (entry.startsWith('# branch.head ')) {
      status.branch = entry.slice('# branch.head '.length)
    } else if (entry.startsWith('# branch.upstream ')) {
      status.hasUpstream = true
    } else if (entry.startsWith('# branch.ab ')) {
      const m = entry.match(/\+(\d+) -(\d+)/)
      if (m) {
        status.ahead = Number(m[1])
        status.behind = Number(m[2])
      }
    } else if (entry.startsWith('1 ') || entry.startsWith('2 ')) {
      // ordinary/renamed change: "1 XY sub mH mI mW hH hI path"
      const parts = entry.split(' ')
      const xy = parts[1] ?? '..'
      const filePath = parts.slice(8).join(' ')
      const e: GitFileEntry = { path: filePath, index: xy[0], worktree: xy[1] }
      if (xy[0] !== '.') status.staged.push(e)
      if (xy[1] !== '.') status.unstaged.push(e)
    } else if (entry.startsWith('u ')) {
      const parts = entry.split(' ')
      const filePath = parts.slice(10).join(' ')
      status.unstaged.push({ path: filePath, index: 'U', worktree: 'U' })
    } else if (entry.startsWith('? ')) {
      status.untracked.push(entry.slice(2))
    }
  }
  status.dirtyCount = status.staged.length + status.unstaged.length + status.untracked.length

  const log = await git(cwd, ['log', '-1', '--format=%H\x1f%s\x1f%an\x1f%cI'])
  if (log.code === 0 && log.stdout.trim()) {
    const [hash, subject, author, dateIso] = log.stdout.trim().split('\x1f')
    if (hash) status.lastCommit = { hash: hash.slice(0, 7), subject: subject ?? '', author: author ?? '', dateIso: dateIso ?? '' }
  }

  const remote = await git(cwd, ['remote', 'get-url', 'origin'])
  if (remote.code === 0 && remote.stdout.trim()) {
    status.hasRemote = true
    status.remoteUrl = remote.stdout.trim()
  }

  statusCache.set(cwd, status)
  return status
}

function toResult(res: ExecResult, failMsg: string): GitActionResult {
  if (res.code === 'ENOENT') return { ok: false, error: 'Git is not installed.' }
  if (res.code !== 0) return { ok: false, error: (res.stderr || res.stdout).trim() || failMsg }
  return { ok: true, output: (res.stdout || res.stderr).trim() }
}

export function gitInit(cwd: string): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    const res = await git(cwd, ['init'])
    statusCache.delete(cwd)
    return toResult(res, 'git init failed')
  })
}

export function gitStage(cwd: string, paths: string[] | 'all'): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    const args = paths === 'all' ? ['add', '-A'] : ['add', '--', ...paths]
    const res = await git(cwd, args)
    statusCache.delete(cwd)
    return toResult(res, 'git add failed')
  })
}

export function gitUnstage(cwd: string, paths: string[] | 'all'): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    const args = paths === 'all' ? ['reset', 'HEAD'] : ['reset', 'HEAD', '--', ...paths]
    const res = await git(cwd, args)
    statusCache.delete(cwd)
    return toResult(res, 'git reset failed')
  })
}

export function gitCommit(cwd: string, message: string): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    if (!message.trim()) return { ok: false, error: 'Commit message is required.' }
    const res = await git(cwd, ['commit', '-m', message])
    statusCache.delete(cwd)
    return toResult(res, 'git commit failed')
  })
}

export function gitPull(cwd: string): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    const res = await git(cwd, ['pull'], 60000)
    statusCache.delete(cwd)
    return toResult(res, 'git pull failed')
  })
}

export function gitPush(cwd: string): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    // on the first push a branch has no upstream — set it so future pushes are plain
    const upstream = await git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    const args = upstream.code === 0 ? ['push'] : ['push', '-u', 'origin', 'HEAD']
    const res = await git(cwd, args, 60000)
    statusCache.delete(cwd)
    return toResult(res, 'git push failed')
  })
}

export function gitFetch(cwd: string): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    const res = await git(cwd, ['fetch'], 60000)
    statusCache.delete(cwd)
    return toResult(res, 'git fetch failed')
  })
}

const REMOTE_URL_RE = /^(https?:\/\/|git@|ssh:\/\/)/i

export function gitAddRemote(cwd: string, url: string): Promise<GitActionResult> {
  return serialize(cwd, async () => {
    const trimmed = url.trim()
    if (!REMOTE_URL_RE.test(trimmed)) {
      return { ok: false, error: 'Enter a valid git URL (https://…, git@…, or ssh://…).' }
    }
    // add origin, or repoint it if one already exists
    let res = await git(cwd, ['remote', 'add', 'origin', trimmed])
    if (res.code !== 0 && /already exists/i.test(res.stderr)) {
      res = await git(cwd, ['remote', 'set-url', 'origin', trimmed])
    }
    statusCache.delete(cwd)
    return toResult(res, 'Could not add remote')
  })
}
