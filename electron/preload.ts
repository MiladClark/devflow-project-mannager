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
  openInEditor: (id: string, editor?: string) => ipcRenderer.invoke('projects:openInEditor', id, editor),
  detectEditors: () => ipcRenderer.invoke('projects:detectEditors'),
  scanProjects: () => ipcRenderer.invoke('projects:scan'),
  importManyProjects: (paths: string[]) => ipcRenderer.invoke('projects:importMany', paths),
  // runner
  startProject: (id: string) => ipcRenderer.invoke('runner:start', id),
  stopProject: (id: string) => ipcRenderer.invoke('runner:stop', id),
  restartProject: (id: string) => ipcRenderer.invoke('runner:restart', id),
  buildProject: (id: string) => ipcRenderer.invoke('runner:build', id),
  installDeps: (id: string) => ipcRenderer.invoke('runner:installDeps', id),
  runScript: (id: string, script: string) => ipcRenderer.invoke('runner:runScript', id, script),
  listScripts: (id: string) => ipcRenderer.invoke('runner:listScripts', id),
  startManyProjects: (ids: string[]) => ipcRenderer.invoke('runner:startMany', ids),
  stopManyProjects: (ids: string[]) => ipcRenderer.invoke('runner:stopMany', ids),
  stopAllProjects: () => ipcRenderer.invoke('runner:stopAll'),
  getRuntime: () => ipcRenderer.invoke('runner:getRuntime'),
  getLogs: (id: string) => ipcRenderer.invoke('runner:getLogs', id),
  clearLogs: (id: string) => ipcRenderer.invoke('runner:clearLogs', id),
  // scaffold
  createProject: (opts: unknown) => ipcRenderer.invoke('scaffold:create', opts),
  // ports / settings / activity
  checkPort: (port: number, excludeProjectId?: string) => ipcRenderer.invoke('ports:check', port, excludeProjectId),
  getPortOwner: (port: number) => ipcRenderer.invoke('ports:owner', port),
  takeoverPort: (port: number, opts?: { skipConfirm?: boolean }) => ipcRenderer.invoke('ports:takeover', port, opts),
  exportBackup: (opts: unknown) => ipcRenderer.invoke('backup:export', opts),
  importBackup: (opts: unknown) => ipcRenderer.invoke('backup:import', opts),
  // env files
  listEnvFiles: (projectId: string) => ipcRenderer.invoke('env:listFiles', projectId),
  readEnvFile: (projectId: string, fileName: string) => ipcRenderer.invoke('env:read', projectId, fileName),
  writeEnvFile: (projectId: string, fileName: string, lines: unknown) =>
    ipcRenderer.invoke('env:write', projectId, fileName, lines),
  // git
  gitStatus: (projectId: string, opts?: unknown) => ipcRenderer.invoke('git:status', projectId, opts),
  gitStatusAll: () => ipcRenderer.invoke('git:statusAll'),
  gitInit: (projectId: string) => ipcRenderer.invoke('git:init', projectId),
  gitStage: (projectId: string, paths: unknown) => ipcRenderer.invoke('git:stage', projectId, paths),
  gitUnstage: (projectId: string, paths: unknown) => ipcRenderer.invoke('git:unstage', projectId, paths),
  gitCommit: (projectId: string, message: string) => ipcRenderer.invoke('git:commit', projectId, message),
  gitPull: (projectId: string) => ipcRenderer.invoke('git:pull', projectId),
  gitPush: (projectId: string) => ipcRenderer.invoke('git:push', projectId),
  gitFetch: (projectId: string) => ipcRenderer.invoke('git:fetch', projectId),
  gitAddRemote: (projectId: string, url: string) => ipcRenderer.invoke('git:addRemote', projectId, url),
  // health
  healthScan: (projectId: string) => ipcRenderer.invoke('health:scan', projectId),
  healthGet: (projectId: string) => ipcRenderer.invoke('health:get', projectId),
  healthSummaries: () => ipcRenderer.invoke('health:summaries'),
  onHealthStatus: (cb: (...args: unknown[]) => void) => on('health:status', cb),
  onHealthResult: (cb: (...args: unknown[]) => void) => on('health:result', cb),
  onHealthSummaries: (cb: (...args: unknown[]) => void) => on('health:summaries', cb),
  // terminal
  termCreate: (opts: unknown) => ipcRenderer.invoke('term:create', opts),
  termWrite: (sessionId: string, data: string) => ipcRenderer.send('term:write', sessionId, data),
  termResize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('term:resize', sessionId, cols, rows),
  termDispose: (sessionId: string) => ipcRenderer.invoke('term:dispose', sessionId),
  termList: (projectId?: string) => ipcRenderer.invoke('term:list', projectId),
  termGetBuffer: (sessionId: string) => ipcRenderer.invoke('term:getBuffer', sessionId),
  termShells: () => ipcRenderer.invoke('term:shells'),
  onTermData: (cb: (...args: unknown[]) => void) => on('term:data', cb),
  onTermExit: (cb: (...args: unknown[]) => void) => on('term:exit', cb),
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
  dockerLaunch: () => ipcRenderer.invoke('docker:launch'),
  // compose
  composeDetect: (projectId: string) => ipcRenderer.invoke('compose:detect', projectId),
  composePs: (projectId: string) => ipcRenderer.invoke('compose:ps', projectId),
  composeUp: (projectId: string) => ipcRenderer.invoke('compose:up', projectId),
  composeDown: (projectId: string) => ipcRenderer.invoke('compose:down', projectId),
  composeLogs: (projectId: string, service?: string) => ipcRenderer.invoke('compose:logs', projectId, service),
  onComposeLog: (cb: (...args: unknown[]) => void) => on('compose:log', cb),
  // proxy
  proxyStatus: () => ipcRenderer.invoke('proxy:status'),
  proxySetup: () => ipcRenderer.invoke('proxy:setup'),
  proxyDomain: (projectId: string) => ipcRenderer.invoke('proxy:domain', projectId),
  proxyValidateSlug: (slug: string, excludeProjectId?: string) => ipcRenderer.invoke('proxy:validateSlug', slug, excludeProjectId),
  // connections
  listConnections: () => ipcRenderer.invoke('connections:list'),
  saveConnection: (conn: unknown) => ipcRenderer.invoke('connections:save', conn),
  removeConnection: (id: string) => ipcRenderer.invoke('connections:remove', id),
  testConnection: (conn: unknown) => ipcRenderer.invoke('connections:test', conn),
  applyConnection: (conn: unknown) => ipcRenderer.invoke('connections:apply', conn),
  // tools & local db services
  detectTools: () => ipcRenderer.invoke('tools:detect'),
  installTool: (toolId: string) => ipcRenderer.invoke('tools:install', toolId),
  uninstallTool: (toolId: string) => ipcRenderer.invoke('tools:uninstall', toolId),
  cancelInstallTool: (toolId: string) => ipcRenderer.invoke('tools:cancelInstall', toolId),
  getInstallStates: () => ipcRenderer.invoke('tools:installStates'),
  onToolInstallLog: (cb: (...args: unknown[]) => void) => on('tools:installLog', cb),
  onToolInstallState: (cb: (...args: unknown[]) => void) => on('tools:installState', cb),
  listDbServices: () => ipcRenderer.invoke('services:list'),
  dbServiceAction: (name: string, action: string) => ipcRenderer.invoke('services:action', name, action),
  // licensing & updates (DevTune website)
  getLicenseState: () => ipcRenderer.invoke('license:state'),
  activateLicense: (opts: unknown) => ipcRenderer.invoke('license:activate', opts),
  refreshLicense: () => ipcRenderer.invoke('license:refresh'),
  clearLicense: () => ipcRenderer.invoke('license:clear'),
  setLicenseServerUrl: (url: string) => ipcRenderer.invoke('license:setServerUrl', url),
  startAuth: () => ipcRenderer.invoke('auth:start'),
  signOutAuth: () => ipcRenderer.invoke('auth:signOut'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  pollLicense: () => ipcRenderer.invoke('license:poll'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  fetchPendingUpdate: () => ipcRenderer.invoke('updates:fetch'),
  getPendingUpdate: () => ipcRenderer.invoke('updates:pending'),
  startUpdate: (version?: string) => ipcRenderer.invoke('updates:start', version),
  onUpdateAvailable: (cb: (...args: unknown[]) => void) => on('updates:available', cb),
  onUpdateProgress: (cb: (...args: unknown[]) => void) => on('updates:progress', cb),
  onLicenseChanged: (cb: (...args: unknown[]) => void) => on('license:changed', cb),
  // system
  openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),
  pickFolder: (title?: string) => ipcRenderer.invoke('system:pickFolder', title),
  getDevProcesses: () => ipcRenderer.invoke('system:devProcesses'),
  killDevProcess: (pid: number) => ipcRenderer.invoke('system:killProcess', pid),
  // window chrome (frameless title bar)
  frameless: process.platform === 'win32' || process.platform === 'linux',
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  onWindowMaximized: (cb: (...args: unknown[]) => void) => on('window:maximized', cb),
  // events
  onProjectsChanged: (cb: (...args: unknown[]) => void) => on('projects:changed', cb),
  onRunnerStatus: (cb: (...args: unknown[]) => void) => on('runner:status', cb),
  onRunnerLog: (cb: (...args: unknown[]) => void) => on('runner:log', cb),
  onSystemStats: (cb: (...args: unknown[]) => void) => on('system:stats', cb),
  onActivity: (cb: (...args: unknown[]) => void) => on('activity:event', cb),
  onScaffoldLog: (cb: (...args: unknown[]) => void) => on('scaffold:log', cb),
  onDockerLog: (cb: (...args: unknown[]) => void) => on('docker:log', cb),
  onNavigate: (cb: (...args: unknown[]) => void) => on('app:navigate', cb),
  onConnectionsChanged: (cb: (...args: unknown[]) => void) => on('connections:changed', cb),
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
