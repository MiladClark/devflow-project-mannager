import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Project, ActivityEvent, AppSettings, DbConnection } from '../../src/shared/types'

interface StoreData {
  projects: Project[]
  activity: ActivityEvent[]
  connections: DbConnection[]
  settings: AppSettings
}

const defaults = (): StoreData => ({
  projects: [],
  activity: [],
  connections: [],
  settings: {
    reservedPorts: [3000, 3001],
    defaultProjectsDir: path.join(app.getPath('home'), 'dev'),
  },
})

let data: StoreData | null = null

function filePath() {
  return path.join(app.getPath('userData'), 'devflow-store.json')
}

function load(): StoreData {
  if (data) return data
  try {
    const raw = fs.readFileSync(filePath(), 'utf-8')
    data = { ...defaults(), ...JSON.parse(raw) }
  } catch {
    data = defaults()
  }
  return data!
}

function save() {
  if (!data) return
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export const store = {
  getProjects(): Project[] {
    return load().projects
  },
  getProject(id: string): Project | undefined {
    return load().projects.find((p) => p.id === id)
  },
  addProject(p: Project) {
    load().projects.push(p)
    save()
  },
  updateProject(id: string, patch: Partial<Project>): Project | undefined {
    const p = load().projects.find((x) => x.id === id)
    if (!p) return undefined
    Object.assign(p, patch)
    save()
    return p
  },
  removeProject(id: string) {
    const d = load()
    d.projects = d.projects.filter((p) => p.id !== id)
    save()
  },
  getActivity(): ActivityEvent[] {
    return load().activity
  },
  addActivity(ev: Omit<ActivityEvent, 'id' | 'ts'>): ActivityEvent {
    const full: ActivityEvent = { id: crypto.randomUUID(), ts: Date.now(), ...ev }
    const d = load()
    d.activity.unshift(full)
    d.activity = d.activity.slice(0, 50)
    save()
    return full
  },
  getConnections(): DbConnection[] {
    return load().connections
  },
  saveConnection(conn: DbConnection) {
    const d = load()
    const i = d.connections.findIndex((c) => c.id === conn.id)
    if (i >= 0) d.connections[i] = conn
    else d.connections.push(conn)
    save()
  },
  removeConnection(id: string) {
    const d = load()
    d.connections = d.connections.filter((c) => c.id !== id)
    save()
  },
  getSettings(): AppSettings {
    return load().settings
  },
  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const d = load()
    d.settings = { ...d.settings, ...patch }
    save()
    return d.settings
  },
}

export function newId() {
  return crypto.randomUUID()
}
