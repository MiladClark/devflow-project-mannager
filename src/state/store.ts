import { create } from 'zustand'
import { api } from '../lib/ipc'
import { notify } from './notifications'
import type {
  Project,
  RuntimeInfo,
  LogLine,
  ActivityEvent,
  SystemStats,
  ProjectStats,
  AppSettings,
  GitStatus,
  HealthSummary,
} from '../shared/types'

const MAX_UI_LOG = 1000
const MAX_HISTORY = 40

// synchronous guard: `loaded` is only set after an await, so under React
// StrictMode two init() calls both pass that check and double-subscribe to
// IPC events (causing duplicate notifications). This flag blocks the second.
let initStarted = false

export interface StatPoint {
  t: number
  cpu: number
  mem: number
}

interface AppState {
  projects: Project[]
  runtime: Record<string, RuntimeInfo>
  logs: Record<string, LogLine[]>
  activity: ActivityEvent[]
  systemStats: SystemStats | null
  systemHistory: { t: number; cpu: number }[]
  projectStats: Record<string, ProjectStats>
  projectHistory: Record<string, StatPoint[]>
  settings: AppSettings | null
  search: string
  loaded: boolean
  gitStatus: Record<string, GitStatus>
  health: Record<string, HealthSummary>
  setSearch: (s: string) => void
  init: () => Promise<void>
  refreshProjects: () => Promise<void>
  loadLogs: (id: string) => Promise<void>
  refreshGit: () => Promise<void>
}

export const useApp = create<AppState>((set, get) => ({
  projects: [],
  runtime: {},
  logs: {},
  activity: [],
  systemStats: null,
  systemHistory: [],
  projectStats: {},
  projectHistory: {},
  settings: null,
  search: '',
  loaded: false,
  gitStatus: {},
  health: {},
  setSearch: (s) => set({ search: s }),

  refreshGit: async () => {
    set({ gitStatus: await api.gitStatusAll() })
  },

  refreshProjects: async () => {
    set({ projects: await api.listProjects() })
  },

  loadLogs: async (id) => {
    const lines = await api.getLogs(id)
    set((st) => ({ logs: { ...st.logs, [id]: lines } }))
  },

  init: async () => {
    if (initStarted || get().loaded) return
    initStarted = true
    const [projects, runtime, activity, settings] = await Promise.all([
      api.listProjects(),
      api.getRuntime(),
      api.getActivity(),
      api.getSettings(),
    ])
    set({ projects, runtime, activity, settings, loaded: true })

    // git status: initial sweep + gentle background refresh
    get().refreshGit()
    setInterval(() => get().refreshGit(), 60000)

    api.healthSummaries().then((health) => set({ health }))
    api.onHealthSummaries((health) => set({ health }))

    api.onProjectsChanged((projects) => {
      set({ projects })
      get().refreshGit()
    })

    api.onRunnerStatus((projectId, info) =>
      set((st) => ({ runtime: { ...st.runtime, [projectId]: info } })),
    )

    api.onRunnerLog((projectId, line) =>
      set((st) => {
        const buf = [...(st.logs[projectId] ?? []), line]
        if (buf.length > MAX_UI_LOG) buf.splice(0, buf.length - MAX_UI_LOG)
        return { logs: { ...st.logs, [projectId]: buf } }
      }),
    )

    api.onActivity((ev) => {
      set((st) => ({ activity: [ev, ...st.activity].slice(0, 50) }))
      // surface important backend events as toasts/notifications
      if (ev.level === 'ok' || ev.level === 'warn' || ev.level === 'err') {
        const level = ev.level === 'ok' ? 'success' : ev.level === 'err' ? 'error' : 'warn'
        notify(level, ev.title, ev.message)
      }
    })

    api.onSystemStats((sys, perProject) =>
      set((st) => {
        const t = Date.now()
        const systemHistory = [...st.systemHistory, { t, cpu: sys.cpu }].slice(-MAX_HISTORY)
        const projectHistory = { ...st.projectHistory }
        for (const [id, s] of Object.entries(perProject)) {
          projectHistory[id] = [...(projectHistory[id] ?? []), { t, cpu: s.cpu, mem: s.mem }].slice(-MAX_HISTORY)
        }
        return { systemStats: sys, systemHistory, projectStats: perProject, projectHistory }
      }),
    )
  },
}))

export function useRuntimeFor(id: string): RuntimeInfo {
  return useApp((s) => s.runtime[id]) ?? { status: 'stopped' }
}
