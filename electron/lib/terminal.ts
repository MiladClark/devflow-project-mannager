import { existsSync } from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import type { IPty } from 'node-pty'
import type { TermSessionInfo, TermShell } from '../../src/shared/types'
import { broadcast } from './broadcast'
import { getEnforcedEntitlements } from './licensing'

const MAX_BUFFER = 200 * 1024 // rolling scrollback kept in main for reattach

interface Session {
  info: TermSessionInfo
  pty: IPty
  buffer: string
}

const sessions = new Map<string, Session>()

const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'

function shellCommand(shell: TermShell): { file: string; args: string[] } | null {
  switch (shell) {
    case 'pwsh':
      return { file: 'pwsh.exe', args: ['-NoLogo'] }
    case 'powershell':
      return { file: 'powershell.exe', args: ['-NoLogo'] }
    case 'cmd':
      return { file: 'cmd.exe', args: [] }
    case 'gitbash':
      return existsSync(GIT_BASH) ? { file: GIT_BASH, args: ['--login', '-i'] } : null
  }
}

export function availableShells(): TermShell[] {
  const shells: TermShell[] = ['powershell']
  // pwsh presence is cheap to test via PATHEXT resolution at spawn; offer it and let create fail gracefully
  if (process.env.ProgramFiles && existsSync(`${process.env.ProgramFiles}\\PowerShell\\7\\pwsh.exe`)) shells.unshift('pwsh')
  if (existsSync(GIT_BASH)) shells.push('gitbash')
  shells.push('cmd')
  return shells
}

export async function createSession(opts: {
  projectId?: string
  cwd: string
  shell: TermShell
  cols: number
  rows: number
}): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  const limits = getEnforcedEntitlements()
  if (!limits.unlimitedTerminals && sessions.size >= limits.maxTerminalSessions) {
    return { ok: false, error: 'free_limit' }
  }

  const cmd = shellCommand(opts.shell)
  if (!cmd) return { ok: false, error: `${opts.shell} is not available on this system.` }

  let pty: typeof import('node-pty')
  try {
    pty = await import('node-pty')
  } catch (err) {
    return {
      ok: false,
      error: 'Terminal engine (node-pty) failed to load on this system.',
    }
  }

  try {
    const proc = pty.spawn(cmd.file, cmd.args, {
      name: 'xterm-256color',
      cols: Math.max(20, opts.cols || 80),
      rows: Math.max(5, opts.rows || 24),
      cwd: opts.cwd || os.homedir(),
      env: { ...process.env } as Record<string, string>,
    })

    const sessionId = crypto.randomUUID()
    const session: Session = {
      info: {
        sessionId,
        projectId: opts.projectId,
        shell: opts.shell,
        title: opts.shell === 'gitbash' ? 'Git Bash' : opts.shell,
        createdAt: Date.now(),
      },
      pty: proc,
      buffer: '',
    }
    sessions.set(sessionId, session)

    proc.onData((data) => {
      session.buffer += data
      if (session.buffer.length > MAX_BUFFER) {
        session.buffer = session.buffer.slice(session.buffer.length - MAX_BUFFER)
      }
      broadcast('term:data', sessionId, data)
    })
    proc.onExit(({ exitCode }) => {
      sessions.delete(sessionId)
      broadcast('term:exit', sessionId, exitCode)
    })

    return { ok: true, sessionId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to start terminal.' }
  }
}

export function writeSession(sessionId: string, data: string) {
  sessions.get(sessionId)?.pty.write(data)
}

export function resizeSession(sessionId: string, cols: number, rows: number) {
  if (cols > 0 && rows > 0) sessions.get(sessionId)?.pty.resize(cols, rows)
}

export function disposeSession(sessionId: string) {
  const s = sessions.get(sessionId)
  if (!s) return
  sessions.delete(sessionId)
  try {
    s.pty.kill()
  } catch {
    /* already dead */
  }
}

export function listSessions(projectId?: string): TermSessionInfo[] {
  const all = [...sessions.values()].map((s) => s.info)
  return projectId ? all.filter((s) => s.projectId === projectId) : all
}

export function getBuffer(sessionId: string): string {
  return sessions.get(sessionId)?.buffer ?? ''
}

export function disposeAll() {
  for (const id of [...sessions.keys()]) disposeSession(id)
}
