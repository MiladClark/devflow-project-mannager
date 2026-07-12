import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FolderOpen, History, LayoutGrid, Loader2, Package, RotateCcw } from 'lucide-react'
import { useApp } from '../state/store'
import { useEntitlements } from '../lib/entitlements'
import { UpgradePrompt } from '../components/UpgradePrompt'
import { useBuildSetup, WIZARD_STEPS, subscribeBuildEvents } from '../state/buildSetup'
import type { BuildHealthStatus } from '../shared/types'
import { DetectionStep } from '../components/build/DetectionStep'
import { ConfigStep } from '../components/build/ConfigStep'
import { ReviewStep } from '../components/build/ReviewStep'
import { ProgressStep } from '../components/build/ProgressStep'
import { CompleteStep } from '../components/build/CompleteStep'
import { ProjectPicker } from '../components/build/ProjectPicker'

subscribeBuildEvents()

const HEALTH_STATUS_LABEL: Record<BuildHealthStatus, string> = {
  ready: 'Ready to Build',
  warning: 'Ready to Build (with warnings)',
  'needs-attention': 'Needs Attention',
  blocked: 'Blocked',
}

/** Worst status across a health report, for the project-scoped header line. */
function worstHealthStatus(health: { status: BuildHealthStatus }[]): BuildHealthStatus {
  const order: BuildHealthStatus[] = ['blocked', 'needs-attention', 'warning', 'ready']
  for (const s of order) {
    if (health.some((h) => h.status === s)) return s
  }
  return 'ready'
}

function EmptyState() {
  const { pickProject, selectProject, recentPaths, loadRecentPaths, detecting, detectError } = useBuildSetup()
  const [mode, setMode] = useState<'folder' | 'existing' | null>(null)

  useEffect(() => {
    void loadRecentPaths()
  }, [loadRecentPaths])

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-edge bg-panel">
        <Package size={28} className="text-accent" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">Select a project to start building</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Choose a project folder or select one of your existing DevFlow projects. DevFlow will inspect the project
          automatically to determine whether it can be built, exported, packaged as a desktop application, or
          prepared as an installer.
        </p>
      </div>
      {detectError && (
        <div className="w-full rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {detectError}
        </div>
      )}

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          role="button"
          onClick={() => void pickProject()}
          className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
            detecting ? 'cursor-wait border-edge bg-panel opacity-60' : 'cursor-pointer border-edge bg-panel hover:border-accent/50'
          }`}
        >
          <span className="flex items-center gap-2 font-semibold text-white">
            {detecting ? <Loader2 size={16} className="animate-spin text-accent" /> : <FolderOpen size={16} className="text-accent" />}
            Select a Project Folder
          </span>
          <span className="text-xs text-slate-500">Choose a project folder from anywhere on the computer.</span>
        </div>
        <div
          role="button"
          onClick={() => setMode(mode === 'existing' ? null : 'existing')}
          className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            mode === 'existing' ? 'border-accent bg-accent/5' : 'border-edge bg-panel hover:border-accent/50'
          }`}
        >
          <span className="flex items-center gap-2 font-semibold text-white">
            <LayoutGrid size={16} className="text-accent" />
            Choose from Existing DevFlow Projects
          </span>
          <span className="text-xs text-slate-500">Select a project that has already been added to DevFlow.</span>
        </div>
      </div>

      {mode === 'existing' && (
        <div className="w-full text-left">
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Projects marked "Ready to Build" have a detected build configuration and can continue to the Build &amp;
            Setup workflow. Projects that need attention will show the exact missing requirement and a recommended
            fix before you start.
          </p>
          <ProjectPicker onSelect={(p) => void selectProject(p)} />
        </div>
      )}

      {recentPaths.length > 0 && (
        <div className="w-full text-left">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            <History size={12} /> Open Recent Project
          </p>
          <div className="flex flex-col gap-1.5">
            {recentPaths.map((p) => (
              <button
                key={p}
                onClick={() => void selectProject(p)}
                disabled={detecting}
                className="truncate rounded-lg border border-edge bg-panel px-3 py-2 text-left text-xs text-slate-300 hover:border-accent/50 disabled:opacity-50"
                title={p}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              i < step ? 'bg-emerald-500/20 text-emerald-400' : i === step ? 'bg-accent text-accent-fg' : 'bg-slate-800 text-slate-500'
            }`}
          >
            {i < step ? <Check size={13} /> : i + 1}
          </span>
          <span className={i === step ? 'font-semibold text-white' : 'text-slate-500'}>{s}</span>
          {i < WIZARD_STEPS.length - 1 && <span className="mx-1 text-slate-700">›</span>}
        </div>
      ))}
    </div>
  )
}

function Wizard() {
  const { step, config, preflight, runState, starting, next, back, reset, startBuild } = useBuildSetup()
  if (!config) return null

  const canNext = step === 0 || (step === 1 && config.targets.length > 0)
  const isBuilding = step === 3 && runState?.phase === 'running'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <StepIndicator step={step} />
        <button
          onClick={() => reset()}
          disabled={isBuilding}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-400 hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-30"
        >
          <RotateCcw size={12} /> Start Over
        </button>
      </div>

      {step === 0 && <DetectionStep />}
      {step === 1 && <ConfigStep />}
      {step === 2 && <ReviewStep />}
      {step === 3 && <ProgressStep />}
      {step === 4 && <CompleteStep />}

      {step < 3 && (
        <div className="flex justify-between border-t border-edge pt-4">
          <button
            onClick={back}
            disabled={step === 0}
            className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-30"
          >
            ‹ Back
          </button>
          {step < 2 ? (
            <button
              onClick={next}
              disabled={!canNext}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
            >
              Next: {WIZARD_STEPS[step + 1]} <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={() => void startBuild()}
              disabled={!preflight?.ok || starting}
              title={!preflight?.ok ? 'Resolve preflight errors first' : undefined}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
            >
              {starting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Start Build
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function BuildSetup() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId?: string }>()
  const entitlements = useEntitlements()
  const projects = useApp((s) => s.projects)
  const { detection, detecting, detectError, selectProject } = useBuildSetup()

  const project = projectId ? projects.find((p) => p.id === projectId) : undefined

  useEffect(() => {
    if (!project) return
    if (detecting) return
    if (detection?.projectPath === project.path) return
    // detectError is cleared by both selectProject (on a fresh attempt) and reset() (Start
    // Over), so gating on it here stops the effect from retrying a failed detection forever
    // while still re-running after Start Over or a route change to a different project.
    if (detectError) return
    void selectProject(project.path)
  }, [project?.path, detection?.projectPath, detecting, detectError, selectProject])

  const scoped = !!projectId
  const scopedStatus = detection && detection.projectPath === project?.path ? worstHealthStatus(detection.health) : null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <button
          onClick={() => (scoped && projectId ? navigate(`/projects/${projectId}`) : navigate(-1))}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft size={14} /> {scoped ? 'Return to Project' : 'Back'}
        </button>
        {scoped && project ? (
          <>
            <h2 className="mt-2 text-2xl font-bold text-white">Build Project: {project.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span>Framework: {detection?.frameworks.join(', ') ?? project.frameworks.join(', ')}</span>
              <span>Version: {detection?.version ?? '—'}</span>
              <span>Status: {scopedStatus ? HEALTH_STATUS_LABEL[scopedStatus] : detecting ? 'Detecting…' : '—'}</span>
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-2xl font-bold text-white">Build & Setup</h2>
            <p className="mt-1 text-sm text-slate-500">
              Prepare a production build, installer, or export package for a local project.
            </p>
          </>
        )}
      </div>

      {entitlements.loaded && !entitlements.buildAndSetup ? (
        <UpgradePrompt message="Build & Setup requires a Pro license. Upgrade on the DevTune website to build and package your projects." />
      ) : scoped && !project ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Project not found. It may have been removed from DevFlow.
        </div>
      ) : scoped ? (
        detection && detection.projectPath === project!.path ? (
          <Wizard />
        ) : (
          <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
            {detectError ? (
              <span className="text-rose-300">{detectError}</span>
            ) : (
              <>
                <Loader2 size={16} className="animate-spin" /> Inspecting project…
              </>
            )}
          </div>
        )
      ) : !detection ? (
        <EmptyState />
      ) : (
        <Wizard />
      )}
    </div>
  )
}
