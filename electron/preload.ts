import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

function on(channel: string, cb: (...args: unknown[]) => void) {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  // projects
  listProjects: () => ipcRenderer.invoke('projects:list'),
  importProject: () => ipcRenderer.invoke('projects:import'),
  removeProject: (id: string) => ipcRenderer.invoke('projects:remove', id),
  updateProject: (id: string, patch: unknown) => ipcRenderer.invoke('projects:update', id, patch),
  openFolder: (id: string) => ipcRenderer.invoke('projects:openFolder', id),
  openOutput: (id: string) => ipcRenderer.invoke('projects:openOutput', id),
  // runner
  startProject: (id: string) => ipcRenderer.invoke('runner:start', id),
  stopProject: (id: string) => ipcRenderer.invoke('runner:stop', id),
  restartProject: (id: string) => ipcRenderer.invoke('runner:restart', id),
  buildProject: (id: string) => ipcRenderer.invoke('runner:build', id),
  getRuntime: () => ipcRenderer.invoke('runner:getRuntime'),
  getLogs: (id: string) => ipcRenderer.invoke('runner:getLogs', id),
  clearLogs: (id: string) => ipcRenderer.invoke('runner:clearLogs', id),
  // scaffold
  createProject: (opts: unknown) => ipcRenderer.invoke('scaffold:create', opts),
  // ports / settings / activity
  checkPort: (port: number, excludeProjectId?: string) => ipcRenderer.invoke('ports:check', port, excludeProjectId),
  getActivity: () => ipcRenderer.invoke('activity:list'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: unknown) => ipcRenderer.invoke('settings:update', patch),
  // docker
  dockerStatus: () => ipcRenderer.invoke('docker:status'),
  dockerContainers: () => ipcRenderer.invoke('docker:containers'),
  dockerListDatabases: (container: unknown) => ipcRenderer.invoke('docker:listDatabases', container),
  dockerCreateDatabase: (container: unknown, name: string) => ipcRenderer.invoke('docker:createDatabase', container, name),
  dockerContainerAction: (id: string, action: string) => ipcRenderer.invoke('docker:containerAction', id, action),
  dockerCreateContainer: (opts: unknown) => ipcRenderer.invoke('docker:createContainer', opts),
  // connections
  listConnections: () => ipcRenderer.invoke('connections:list'),
  saveConnection: (conn: unknown) => ipcRenderer.invoke('connections:save', conn),
  removeConnection: (id: string) => ipcRenderer.invoke('connections:remove', id),
  testConnection: (conn: unknown) => ipcRenderer.invoke('connections:test', conn),
  applyConnection: (conn: unknown) => ipcRenderer.invoke('connections:apply', conn),
  // tools & local db services
  detectTools: () => ipcRenderer.invoke('tools:detect'),
  installTool: (toolId: string) => ipcRenderer.invoke('tools:install', toolId),
  onToolInstallLog: (cb: (...args: unknown[]) => void) => on('tools:installLog', cb),
  listDbServices: () => ipcRenderer.invoke('services:list'),
  dbServiceAction: (name: string, action: string) => ipcRenderer.invoke('services:action', name, action),
  // system
  openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),
  pickFolder: (title?: string) => ipcRenderer.invoke('system:pickFolder', title),
  // events
  onProjectsChanged: (cb: (...args: unknown[]) => void) => on('projects:changed', cb),
  onRunnerStatus: (cb: (...args: unknown[]) => void) => on('runner:status', cb),
  onRunnerLog: (cb: (...args: unknown[]) => void) => on('runner:log', cb),
  onSystemStats: (cb: (...args: unknown[]) => void) => on('system:stats', cb),
  onActivity: (cb: (...args: unknown[]) => void) => on('activity:event', cb),
  onScaffoldLog: (cb: (...args: unknown[]) => void) => on('scaffold:log', cb),
  onDockerLog: (cb: (...args: unknown[]) => void) => on('docker:log', cb),
  onConnectionsChanged: (cb: (...args: unknown[]) => void) => on('connections:changed', cb),
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
