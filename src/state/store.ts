import { create } from 'zustand'
import { api } from '../lib/ipc'
import type {
  Project,
  RuntimeInfo,
  LogLine,
  ActivityEvent,
  SystemStats,
  ProjectStats,
  AppSettings,
} from '../shared/types'

const MAX_UI_LOG = 1000
const MAX_HISTORY = 40

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
  setSearch: (s: string) => void
  init: () => Promise<void>
  refreshProjects: () => Promise<void>
  loadLogs: (id: string) => Promise<void>
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
  setSearch: (s) => set({ search: s }),

  refreshProjects: async () => {
    set({ projects: await api.listProjects() })
  },

  loadLogs: async (id) => {
    const lines = await api.getLogs(id)
    set((st) => ({ logs: { ...st.logs, [id]: lines } }))
  },

  init: async () => {
    if (get().loaded) return
    const [projects, runtime, activity, settings] = await Promise.all([
      api.listProjects(),
      api.getRuntime(),
      api.getActivity(),
      api.getSettings(),
    ])
    set({ projects, runtime, activity, settings, loaded: true })

    api.onProjectsChanged((projects) => set({ projects }))

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

    api.onActivity((ev) => set((st) => ({ activity: [ev, ...st.activity].slice(0, 50) })))

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
