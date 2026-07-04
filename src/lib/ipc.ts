import type {
  Project,
  RuntimeInfo,
  LogLine,
  ActivityEvent,
  SystemStats,
  ProjectStats,
  PortCheck,
  AppSettings,
  ScaffoldOptions,
  ScaffoldResult,
  DockerStatus,
  DbContainer,
  DbListResult,
  CreateDbContainerOptions,
  DbConnection,
  ConnectionTestResult,
  ApplyEnvResult,
  ToolStatus,
  DbService,
} from '../shared/types'

export interface Api {
  listProjects(): Promise<Project[]>
  importProject(): Promise<{ ok: boolean; project?: Project; error?: string }>
  removeProject(id: string): Promise<boolean>
  updateProject(id: string, patch: Partial<Project>): Promise<Project | undefined>
  openFolder(id: string): Promise<void>
  openOutput(id: string): Promise<void>
  startProject(id: string): Promise<{ ok: boolean; error?: string }>
  stopProject(id: string): Promise<{ ok: boolean; error?: string }>
  restartProject(id: string): Promise<{ ok: boolean; error?: string }>
  buildProject(id: string): Promise<{ ok: boolean; error?: string }>
  getRuntime(): Promise<Record<string, RuntimeInfo>>
  getLogs(id: string): Promise<LogLine[]>
  clearLogs(id: string): Promise<boolean>
  createProject(opts: ScaffoldOptions): Promise<ScaffoldResult>
  checkPort(port: number, excludeProjectId?: string): Promise<PortCheck>
  getActivity(): Promise<ActivityEvent[]>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  dockerStatus(): Promise<DockerStatus>
  dockerContainers(): Promise<DbContainer[]>
  dockerListDatabases(container: DbContainer): Promise<DbListResult>
  dockerCreateDatabase(container: DbContainer, name: string): Promise<{ ok: boolean; error?: string }>
  dockerContainerAction(id: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; error?: string }>
  dockerCreateContainer(opts: CreateDbContainerOptions): Promise<{ ok: boolean; error?: string }>
  onDockerLog(cb: (line: LogLine) => void): () => void
  listConnections(): Promise<DbConnection[]>
  saveConnection(conn: DbConnection): Promise<DbConnection[]>
  removeConnection(id: string): Promise<DbConnection[]>
  testConnection(conn: DbConnection): Promise<ConnectionTestResult>
  applyConnection(conn: DbConnection): Promise<ApplyEnvResult>
  onConnectionsChanged(cb: (connections: DbConnection[]) => void): () => void
  detectTools(): Promise<ToolStatus[]>
  installTool(toolId: string): Promise<{ ok: boolean; error?: string }>
  onToolInstallLog(cb: (toolId: string, line: LogLine) => void): () => void
  listDbServices(): Promise<DbService[]>
  dbServiceAction(name: string, action: 'start' | 'stop'): Promise<{ ok: boolean; error?: string }>
  openExternal(url: string): Promise<void>
  pickFolder(title?: string): Promise<string | null>
  onProjectsChanged(cb: (projects: Project[]) => void): () => void
  onRunnerStatus(cb: (projectId: string, info: RuntimeInfo) => void): () => void
  onRunnerLog(cb: (projectId: string, line: LogLine) => void): () => void
  onSystemStats(cb: (sys: SystemStats, perProject: Record<string, ProjectStats>) => void): () => void
  onActivity(cb: (ev: ActivityEvent) => void): () => void
  onScaffoldLog(cb: (line: LogLine) => void): () => void
}

declare global {
  interface Window {
    api?: Api
  }
}

/** Browser-only mock so the renderer can be previewed outside Electron. */
function createMockApi(): Api {
  const projects: Project[] = [
    {
      id: 'mock-1',
      name: 'my-next-app',
      path: 'C:\\dev\\my-next-app',
      framework: 'next',
      frameworks: ['Next.js', 'Tailwind'],
      runCommand: 'npm run dev',
      buildCommand: 'npm run build',
      outputDir: '.next',
      defaultPort: 3000,
      preferredPort: 3007,
      env: {},
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'mock-2',
      name: 'vite-portfolio',
      path: 'C:\\dev\\vite-portfolio',
      framework: 'vite',
      frameworks: ['Vite', 'React'],
      runCommand: 'npm run dev',
      buildCommand: 'npm run build',
      outputDir: 'dist',
      defaultPort: 5173,
      env: {},
      createdAt: Date.now() - 3600000,
    },
  ]
  const runtime: Record<string, RuntimeInfo> = {
    'mock-1': { status: 'running', pid: 1234, port: 3007, url: 'http://localhost:3007/', startedAt: Date.now() - 60000 },
    'mock-2': { status: 'stopped' },
  }
  const noopUnsub = () => {}
  return {
    listProjects: async () => projects,
    importProject: async () => ({ ok: false, error: 'Not available in browser preview' }),
    removeProject: async () => true,
    updateProject: async (id, patch) => {
      const p = projects.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
      return p
    },
    openFolder: async () => {},
    openOutput: async () => {},
    startProject: async (id) => {
      runtime[id] = { status: 'running', pid: 999, port: 5173, url: 'http://localhost:5173/', startedAt: Date.now() }
      return { ok: true }
    },
    stopProject: async (id) => {
      runtime[id] = { status: 'stopped' }
      return { ok: true }
    },
    restartProject: async () => ({ ok: true }),
    buildProject: async () => ({ ok: true }),
    getRuntime: async () => runtime,
    getLogs: async () => [
      { ts: Date.now() - 5000, stream: 'sys', text: '$ npm run dev' },
      { ts: Date.now() - 4000, stream: 'out', text: '> next dev' },
      { ts: Date.now() - 3000, stream: 'out', text: 'ready - started server on http://localhost:3007' },
    ],
    clearLogs: async () => true,
    createProject: async () => ({ ok: false, error: 'Not available in browser preview' }),
    checkPort: async (port) => ({ port, free: port !== 3000, reserved: port === 3000 || port === 3001 }),
    getActivity: async () => [
      { id: 'a1', ts: Date.now() - 60000, level: 'ok', title: 'Server Started', message: 'my-next-app on port 3007' },
      { id: 'a2', ts: Date.now() - 400000, level: 'ok', title: 'Build Successful', message: 'vite-portfolio' },
      { id: 'a3', ts: Date.now() - 900000, level: 'info', title: 'Project Imported', message: 'vite-portfolio' },
    ],
    getSettings: async () => ({ reservedPorts: [3000, 3001], defaultProjectsDir: 'C:\\dev' }),
    updateSettings: async (p) => ({ reservedPorts: [3000, 3001], defaultProjectsDir: 'C:\\dev', ...p }),
    dockerStatus: async () => ({ installed: true, running: true, version: '27.0.1 (mock)' }),
    dockerContainers: async () => [
      {
        id: 'c1',
        name: 'mysql-dev',
        image: 'mysql:8.4',
        kind: 'mysql',
        state: 'running',
        status: 'Running since 2026-07-03 10:00:00',
        hostPort: 3306,
        containerPort: 3306,
        user: 'root',
        password: 'secret',
      },
      {
        id: 'c2',
        name: 'postgres-main',
        image: 'postgres:16',
        kind: 'postgres',
        state: 'exited',
        status: 'exited',
        hostPort: 5432,
        containerPort: 5432,
        user: 'postgres',
        password: 'secret',
      },
    ],
    dockerListDatabases: async () => ({ ok: true, databases: ['ecom_prod', 'user_auth'] }),
    dockerCreateDatabase: async () => ({ ok: true }),
    dockerContainerAction: async () => ({ ok: true }),
    dockerCreateContainer: async () => ({ ok: false, error: 'Not available in browser preview' }),
    onDockerLog: () => noopUnsub,
    listConnections: async () => [
      {
        id: 'conn-1',
        name: 'ecom production',
        projectId: 'mock-1',
        kind: 'postgres',
        host: '127.0.0.1',
        port: 5432,
        database: 'ecom_prod',
        user: 'postgres',
        password: 'secret',
        sslMode: 'prefer',
        connectTimeout: 5,
        extraParams: '',
        envVarName: 'DATABASE_URL',
        envFile: '.env',
        lastTest: { ok: true, method: 'auth', latencyMs: 12, message: 'Authenticated as postgres', testedAt: Date.now() - 60000 },
        createdAt: Date.now() - 86400000,
      },
    ],
    saveConnection: async () => [],
    removeConnection: async () => [],
    testConnection: async () => ({ ok: true, method: 'tcp', latencyMs: 8, message: 'Port reachable in 8ms', testedAt: Date.now() }),
    applyConnection: async () => ({ ok: false, error: 'Not available in browser preview' }),
    onConnectionsChanged: () => noopUnsub,
    detectTools: async () => [
      { id: 'node', installed: true, version: '22.12.0' },
      { id: 'git', installed: true, version: '2.47.1' },
      { id: 'docker', installed: true, version: '27.0.1' },
      { id: 'vscode', installed: true, version: '1.96.0' },
      { id: 'pnpm', installed: true, version: '9.15.0' },
      { id: 'mysql-server', installed: true, version: '9.7' },
      { id: 'postgres', installed: false },
      { id: 'mysql-workbench', installed: true, version: '8.0' },
      { id: 'bun', installed: false },
      { id: 'yarn', installed: false },
      { id: 'python', installed: true, version: '3.12.4' },
      { id: 'gh', installed: false },
      { id: 'dbeaver', installed: false },
      { id: 'windows-terminal', installed: true },
      { id: 'pwsh', installed: false },
      { id: 'oh-my-posh', installed: false },
      { id: 'postman', installed: false },
    ],
    installTool: async () => ({ ok: false, error: 'Not available in browser preview' }),
    onToolInstallLog: () => noopUnsub,
    listDbServices: async () => [
      {
        name: 'MySQL80',
        displayName: 'MySQL80',
        kind: 'mysql',
        state: 'running',
        rawState: 'Running',
        version: '8.0.36',
        binPath: 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe',
      },
      {
        name: 'MySQL57',
        displayName: 'MySQL57',
        kind: 'mysql',
        state: 'stopped',
        rawState: 'Stopped',
        version: '5.7.44',
        binPath: 'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqld.exe',
      },
    ],
    dbServiceAction: async () => ({ ok: false, error: 'Not available in browser preview' }),
    openExternal: async (url) => {
      window.open(url, '_blank')
    },
    pickFolder: async () => null,
    onProjectsChanged: () => noopUnsub,
    onRunnerStatus: () => noopUnsub,
    onRunnerLog: () => noopUnsub,
    onSystemStats: (cb) => {
      const t = setInterval(
        () =>
          cb(
            { cpu: 10 + Math.random() * 30, memUsed: 9e9 + Math.random() * 1e9, memTotal: 16e9, uptime: 10000 },
            { 'mock-1': { cpu: 3 + Math.random() * 8, mem: 4e8 } },
          ),
        2500,
      )
      return () => clearInterval(t)
    },
    onActivity: () => noopUnsub,
    onScaffoldLog: () => noopUnsub,
  }
}

export const api: Api = window.api ?? createMockApi()
export const isElectron = !!window.api
