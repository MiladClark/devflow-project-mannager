import { useCallback, useEffect, useState } from 'react'
import {
  GitBranch,
  GitCommitHorizontal,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Plus,
  Minus,
  Loader2,
  AlertTriangle,
  Download,
  Upload,
  Cloud,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, isElectron } from '../lib/ipc'
import { notify } from '../state/notifications'
import { SkeletonGitPanel } from './Skeleton'
import type { GitStatus, GitActionResult } from '../shared/types'

function FileRow({
  path,
  code,
  action,
  actionIcon,
  onAction,
}: {
  path: string
  code: string
  action: string
  actionIcon: React.ReactNode
  onAction: () => void
}) {
  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800/40">
      <span className="w-5 shrink-0 text-center font-mono text-amber-400">{code}</span>
      <span className="select-text min-w-0 flex-1 truncate font-mono text-slate-300">{path}</span>
      <button
        onClick={onAction}
        title={action}
        className="rounded p-0.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-accent"
      >
        {actionIcon}
      </button>
    </div>
  )
}

export function GitPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [output, setOutput] = useState<{ ok: boolean; text: string } | null>(null)
  const [remoteUrl, setRemoteUrl] = useState('')

  const refresh = useCallback(
    async (force = false) => {
      const st = await api.gitStatus(projectId, { refresh: force })
      setStatus(st)
    },
    [projectId],
  )

  useEffect(() => {
    setStatus(null)
    setOutput(null)
    refresh(true)
  }, [refresh])

  async function run(label: string, fn: () => Promise<GitActionResult>, successText?: string) {
    setBusy(label)
    setOutput(null)
    const res = await fn()
    setBusy('')
    if (res.ok) {
      if (successText || res.output) setOutput({ ok: true, text: successText ?? res.output ?? '' })
    } else {
      setOutput({ ok: false, text: res.error ?? `${label} failed` })
    }
    await refresh(true)
  }

  async function addRemote() {
    const url = remoteUrl.trim()
    if (!url) return
    setBusy('addRemote')
    setOutput(null)
    const res = await api.gitAddRemote(projectId, url)
    setBusy('')
    if (res.ok) {
      setRemoteUrl('')
      notify('success', 'Remote added', url)
    } else {
      setOutput({ ok: false, text: res.error ?? 'Could not add remote' })
      notify('error', 'Could not add remote', res.error)
    }
    await refresh(true)
  }

  if (!status) return <SkeletonGitPanel />

  if (!status.gitInstalled) {
    return (
      <div className="rounded-xl border border-dashed border-edge p-8 text-sm text-slate-500">
        Git is not installed.{' '}
        <Link to="/tools" className="font-semibold text-accent hover:underline">
          Install it from App and Tools
        </Link>
        .
      </div>
    )
  }

  if (!status.isRepo) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-edge p-8">
        <p className="text-sm text-slate-500">This project is not a git repository yet.</p>
        <button
          onClick={() => run('init', () => api.gitInit(projectId), 'Repository initialized.')}
          disabled={busy !== '' || !isElectron}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
        >
          {busy === 'init' ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />} Initialize repository
        </button>
        {output && !output.ok && <p className="text-sm text-rose-400">{output.text}</p>}
      </div>
    )
  }

  const netBtn = (label: string, icon: React.ReactNode, fn: () => Promise<GitActionResult>, disabled = false) => (
    <button
      onClick={() => run(label, fn)}
      disabled={busy !== '' || disabled || !isElectron}
      className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent/50 disabled:opacity-40"
    >
      {busy === label ? <Loader2 size={13} className="animate-spin" /> : icon} {label}
    </button>
  )

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-panel px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-white">
          <GitBranch size={15} className="text-accent" /> {status.branch ?? 'detached'}
        </span>
        {status.hasUpstream && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <ArrowUp size={12} className={status.ahead > 0 ? 'text-emerald-400' : ''} /> {status.ahead}
            <ArrowDown size={12} className={status.behind > 0 ? 'text-amber-400' : ''} /> {status.behind}
          </span>
        )}
        {status.remoteUrl && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500" title={status.remoteUrl}>
            <Cloud size={12} /> <span className="truncate">{status.remoteUrl}</span>
          </span>
        )}
        {status.lastCommit && (
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
            <span className="font-mono text-slate-400">{status.lastCommit.hash}</span> {status.lastCommit.subject}
          </span>
        )}
        <div className="flex gap-1.5">
          {netBtn('Fetch', <RefreshCw size={13} />, () => api.gitFetch(projectId), !status.hasRemote)}
          {netBtn('Pull', <Download size={13} />, () => api.gitPull(projectId), !status.hasUpstream)}
          {netBtn(
            'Push',
            <Upload size={13} />,
            () => api.gitPush(projectId),
            !status.hasRemote || (status.hasUpstream && status.ahead === 0),
          )}
        </div>
      </div>

      {!status.hasRemote && (
        <div className="flex flex-col gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <Cloud size={15} className="text-sky-400" /> No remote is configured — add one to push or pull.
          </p>
          <div className="flex gap-2">
            <input
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && remoteUrl.trim() && addRemote()}
              placeholder="https://github.com/you/repo.git  ·  git@github.com:you/repo.git"
              className="min-w-0 flex-1 rounded-lg border border-edge bg-bg px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-accent/60"
            />
            <button
              onClick={addRemote}
              disabled={busy !== '' || !remoteUrl.trim() || !isElectron}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
            >
              {busy === 'addRemote' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add remote
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Create an empty repository on GitHub (or GitLab/Gitea) first, then paste its URL here. Authentication uses
            your system's Git Credential Manager — the first push opens a browser to sign in.
          </p>
        </div>
      )}

      {output && (
        <pre
          className={`rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap ${
            output.ok ? 'border-edge bg-panel text-slate-400' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          {output.ok ? output.text : <><AlertTriangle size={12} className="mr-1 inline" />{output.text}</>}
        </pre>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Staged ({status.staged.length})
            </h4>
            {status.staged.length > 0 && (
              <button
                onClick={() => run('unstage-all', () => api.gitUnstage(projectId, 'all'))}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Unstage all
              </button>
            )}
          </div>
          {status.staged.map((f) => (
            <FileRow
              key={f.path}
              path={f.path}
              code={f.index}
              action="Unstage"
              actionIcon={<Minus size={13} />}
              onAction={() => run('unstage', () => api.gitUnstage(projectId, [f.path]))}
            />
          ))}
          {status.staged.length === 0 && <p className="px-2 py-1 text-xs text-slate-600">Nothing staged.</p>}
        </div>

        <div className="rounded-xl border border-edge bg-panel p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Changes ({status.unstaged.length + status.untracked.length})
            </h4>
            {status.unstaged.length + status.untracked.length > 0 && (
              <button
                onClick={() => run('stage-all', () => api.gitStage(projectId, 'all'))}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Stage all
              </button>
            )}
          </div>
          {status.unstaged.map((f) => (
            <FileRow
              key={f.path}
              path={f.path}
              code={f.worktree}
              action="Stage"
              actionIcon={<Plus size={13} />}
              onAction={() => run('stage', () => api.gitStage(projectId, [f.path]))}
            />
          ))}
          {status.untracked.map((p) => (
            <FileRow
              key={p}
              path={p}
              code="?"
              action="Stage"
              actionIcon={<Plus size={13} />}
              onAction={() => run('stage', () => api.gitStage(projectId, [p]))}
            />
          ))}
          {status.unstaged.length + status.untracked.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-600">Working tree clean.</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitMsg.trim() && status.staged.length > 0 && run('commit', () => api.gitCommit(projectId, commitMsg).then((r) => { if (r.ok) setCommitMsg(''); return r }), 'Committed.')}
          placeholder="Commit message"
          className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
        <button
          onClick={() => run('commit', () => api.gitCommit(projectId, commitMsg).then((r) => { if (r.ok) setCommitMsg(''); return r }), 'Committed.')}
          disabled={busy !== '' || !commitMsg.trim() || status.staged.length === 0 || !isElectron}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
        >
          {busy === 'commit' ? <Loader2 size={14} className="animate-spin" /> : <GitCommitHorizontal size={14} />} Commit
        </button>
      </div>
    </div>
  )
}
