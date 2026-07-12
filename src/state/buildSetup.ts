import { create } from 'zustand'
import { api } from '../lib/ipc'
import { notify } from './notifications'
import type {
  BuildConfig,
  BuildDetection,
  BuildPreflightResult,
  BuildRunState,
  LogLine,
} from '../shared/types'

export const WIZARD_STEPS = ['Project Detection', 'Build Configuration', 'Export & Review', 'Build Progress', 'Build Complete'] as const
const DEFAULT_NAMING_TEMPLATE = '{appName}-{version}-{platform}-{arch}'

function defaultConfig(detection: BuildDetection): BuildConfig {
  const recommendedExclusions = detection.exclusions.filter((e) => e.recommended).map((e) => e.path)
  // "deps-missing" in the health report already tells us node_modules is absent —
  // used to default "install before build" on for a fresh checkout
  const depsMissing = detection.health.some((h) => h.id === 'deps-missing')
  return {
    projectPath: detection.projectPath,
    framework: detection.framework,
    isElectron: detection.isElectron,
    iconPath: detection.iconPath,
    electronVersion: detection.electronVersion,
    appName: detection.appName,
    packageName: detection.packageName,
    version: detection.version,
    versionSource: 'package',
    incrementType: 'patch',
    appId: detection.isElectron ? `com.devflow.${detection.packageName.replace(/[^a-z0-9]/gi, '')}` : undefined,
    publisher: '',
    buildCommand: detection.buildCommand,
    preBuildCommand: '',
    postBuildCommand: '',
    packageManager: detection.packageManager,
    outputDir: detection.outputDir,
    cleanOutputDir: false,
    installDepsBeforeBuild: depsMissing,
    runTypeCheck: false,
    runLint: false,
    runTests: false,
    targets: detection.supportedTargets.slice(0, detection.isElectron ? 3 : 1),
    excludedPaths: recommendedExclusions,
    exportDir: `${detection.projectPath}\\release\\${detection.appName}\\${detection.version}`,
    namingTemplate: DEFAULT_NAMING_TEMPLATE,
  }
}

interface BuildSetupState {
  step: number
  detecting: boolean
  detection: BuildDetection | null
  detectError: string | null
  config: BuildConfig | null
  preflight: BuildPreflightResult | null
  preflighting: boolean
  buildId: string | null
  runState: BuildRunState | null
  logs: LogLine[]
  recentPaths: string[]
  starting: boolean

  loadRecentPaths: () => Promise<void>
  pickProject: () => Promise<void>
  selectProject: (dir: string) => Promise<void>
  setConfig: (patch: Partial<BuildConfig>) => void
  toggleExclusion: (path: string) => void
  goToStep: (n: number) => void
  next: () => void
  back: () => void
  runPreflightCheck: () => Promise<void>
  startBuild: () => Promise<void>
  cancelBuild: () => void
  retryBuild: () => Promise<void>
  reset: () => void
}

export const useBuildSetup = create<BuildSetupState>((set, get) => ({
  step: 0,
  detecting: false,
  detection: null,
  detectError: null,
  config: null,
  preflight: null,
  preflighting: false,
  buildId: null,
  runState: null,
  logs: [],
  recentPaths: [],
  starting: false,

  loadRecentPaths: async () => {
    set({ recentPaths: await api.buildRecentPaths() })
  },

  pickProject: async () => {
    const dir = await api.pickFolder('Choose a project folder to build')
    if (dir) await get().selectProject(dir)
  },

  selectProject: async (dir: string) => {
    set({ detecting: true, detectError: null, detection: null, config: null })
    const res = await api.buildDetect(dir)
    if (res && 'error' in res) {
      set({ detecting: false, detectError: res.error })
      return
    }
    const detection = res as BuildDetection
    const saved = await api.buildGetConfig(dir)
    const config = (saved as BuildConfig | null) ?? defaultConfig(detection)
    set({ detecting: false, detection, config, step: 0 })
  },

  setConfig: (patch) => set((s) => (s.config ? { config: { ...s.config, ...patch } } : s)),

  toggleExclusion: (path) =>
    set((s) => {
      if (!s.config) return s
      const has = s.config.excludedPaths.includes(path)
      const excludedPaths = has ? s.config.excludedPaths.filter((p) => p !== path) : [...s.config.excludedPaths, path]
      return { config: { ...s.config, excludedPaths } }
    }),

  goToStep: (n) => set({ step: n }),
  next: () => set((s) => ({ step: Math.min(4, s.step + 1) })),
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),

  runPreflightCheck: async () => {
    const { config } = get()
    if (!config) return
    set({ preflighting: true })
    const result = await api.buildPreflight(config)
    set({ preflight: result, preflighting: false })
  },

  startBuild: async () => {
    const { config } = get()
    if (!config) return
    set({ starting: true })
    await api.buildSaveConfig(config)
    const res = await api.buildStart(config)
    set({ starting: false })
    if (!res.ok) {
      notify('error', 'Build failed to start', res.error)
      return
    }
    set({ buildId: res.buildId, runState: null, logs: [], step: 3 })
  },

  cancelBuild: () => {
    const { buildId } = get()
    if (buildId) void api.buildCancel(buildId)
  },

  retryBuild: async () => {
    const { buildId } = get()
    if (!buildId) return
    const res = await api.buildRetryStage(buildId)
    if (res.ok) set({ buildId: res.buildId, runState: null, logs: [] })
  },

  reset: () =>
    set({ step: 0, detection: null, detectError: null, config: null, preflight: null, buildId: null, runState: null, logs: [] }),
}))

let subscribed = false
export function subscribeBuildEvents() {
  if (subscribed) return
  subscribed = true
  api.onBuildLog((buildId: string, line: LogLine) => {
    if (useBuildSetup.getState().buildId !== buildId) return
    useBuildSetup.setState((s) => ({ logs: [...s.logs, line].slice(-2000) }))
  })
  // build:state already carries the full stage list on every stage transition,
  // so a separate build:stage handler isn't needed on the renderer side
  api.onBuildState((state: BuildRunState) => {
    if (useBuildSetup.getState().buildId !== state.buildId) return
    useBuildSetup.setState({ runState: state })
    if (state.phase === 'done') notify('success', 'Build complete', 'Your build is ready.')
    if (state.phase === 'error') notify('error', 'Build failed', state.error)
  })
}
