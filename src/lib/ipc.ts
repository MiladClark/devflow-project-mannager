import type {
  Project,
  RuntimeInfo,
  LogLine,
  ActivityEvent,
  SystemStats,
  DevProcessSnapshot,
  DevProcessCategory,
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
  InstallState,
  DbService,
  LicenseState,
  ActivateOptions,
  LicenseActionResult,
  UpdateCheckResult,
  UpdateProgress,
  UpdateAvailablePayload,
  PortOwner,
  StartResult,
  RunActionResult,
  BackupImportResult,
  EnvFileInfo,
  EnvLine,
  GitStatus,
  GitActionResult,
  HealthReport,
  HealthSummary,
  HealthPhase,
  TermShell,
  TermSessionInfo,
  PreferredEditor,
  ProjectScript,
  ScanProjectsResult,
  BulkResult,
  EditorStatus,
  ComposeStatus,
  ProxySetupStatus,
} from '../shared/types'

export interface Api {
  listProjects(): Promise<Project[]>
  importProject(): Promise<{ ok: boolean; project?: Project; error?: string }>
  removeProject(id: string): Promise<boolean>
  updateProject(id: string, patch: Partial<Project>): Promise<Project | undefined>
  openFolder(id: string): Promise<void>
  openOutput(id: string): Promise<void>
  openInEditor(id: string, editor?: PreferredEditor): Promise<{ ok: boolean; error?: string }>
  detectEditors(): Promise<EditorStatus>
  scanProjects(): Promise<ScanProjectsResult>
  importManyProjects(paths: string[]): Promise<{ ok: boolean; added: number; errors: string[] }>
  startProject(id: string): Promise<StartResult>
  stopProject(id: string): Promise<{ ok: boolean; error?: string }>
  restartProject(id: string): Promise<StartResult>
  buildProject(id: string): Promise<RunActionResult>
  installDeps(id: string): Promise<{ ok: boolean; error?: string }>
  runScript(id: string, script: string): Promise<RunActionResult>
  listScripts(id: string): Promise<ProjectScript[]>
  startManyProjects(ids: string[]): Promise<BulkResult>
  stopManyProjects(ids: string[]): Promise<BulkResult>
  stopAllProjects(): Promise<BulkResult>
  getRuntime(): Promise<Record<string, RuntimeInfo>>
  getLogs(id: string): Promise<LogLine[]>
  clearLogs(id: string): Promise<boolean>
  createProject(opts: ScaffoldOptions): Promise<ScaffoldResult>
  checkPort(port: number, excludeProjectId?: string): Promise<PortCheck>
  getPortOwner(port: number): Promise<PortOwner | null>
  takeoverPort(port: number, opts?: { skipConfirm?: boolean }): Promise<{ ok: boolean; error?: string }>
  exportBackup(opts: { includePasswords: boolean }): Promise<{ ok: boolean; file?: string; error?: string }>
  importBackup(opts: { mode: 'merge' | 'replace' }): Promise<BackupImportResult>
  listEnvFiles(projectId: string): Promise<EnvFileInfo[]>
  readEnvFile(projectId: string, fileName: string): Promise<{ ok: boolean; lines?: EnvLine[]; error?: string }>
  writeEnvFile(projectId: string, fileName: string, lines: EnvLine[]): Promise<{ ok: boolean; backupPath?: string; error?: string }>
  gitStatus(projectId: string, opts?: { refresh?: boolean }): Promise<GitStatus | null>
  gitStatusAll(): Promise<Record<string, GitStatus>>
  gitInit(projectId: string): Promise<GitActionResult>
  gitStage(projectId: string, paths: string[] | 'all'): Promise<GitActionResult>
  gitUnstage(projectId: string, paths: string[] | 'all'): Promise<GitActionResult>
  gitCommit(projectId: string, message: string): Promise<GitActionResult>
  gitPull(projectId: string): Promise<GitActionResult>
  gitPush(projectId: string): Promise<GitActionResult>
  gitFetch(projectId: string): Promise<GitActionResult>
  gitAddRemote(projectId: string, url: string): Promise<GitActionResult>
  healthScan(projectId: string): Promise<{ queued: boolean; position: number }>
  healthGet(projectId: string): Promise<HealthReport | null>
  healthSummaries(): Promise<Record<string, HealthSummary>>
  onHealthStatus(cb: (projectId: string, phase: HealthPhase) => void): () => void
  onHealthResult(cb: (projectId: string, report: HealthReport) => void): () => void
  onHealthSummaries(cb: (summaries: Record<string, HealthSummary>) => void): () => void
  termCreate(opts: {
    projectId?: string
    cwd: string
    shell: TermShell
    cols: number
    rows: number
  }): Promise<{ ok: boolean; sessionId?: string; error?: string }>
  termWrite(sessionId: string, data: string): void
  termResize(sessionId: string, cols: number, rows: number): Promise<void>
  termDispose(sessionId: string): Promise<void>
  termList(projectId?: string): Promise<TermSessionInfo[]>
  termGetBuffer(sessionId: string): Promise<string>
  termShells(): Promise<TermShell[]>
  onTermData(cb: (sessionId: string, data: string) => void): () => void
  onTermExit(cb: (sessionId: string, exitCode: number) => void): () => void
  getActivity(): Promise<ActivityEvent[]>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  dockerStatus(): Promise<DockerStatus>
  dockerContainers(): Promise<DbContainer[]>
  dockerListDatabases(container: DbContainer): Promise<DbListResult>
  dockerCreateDatabase(container: DbContainer, name: string): Promise<{ ok: boolean; error?: string }>
  dockerContainerAction(id: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; error?: string }>
  dockerCreateContainer(opts: CreateDbContainerOptions): Promise<{ ok: boolean; error?: string }>
  dockerLaunch(): Promise<{ ok: boolean; error?: string }>
  onDockerLog(cb: (line: LogLine) => void): () => void
  composeDetect(projectId: string): Promise<string | null>
  composePs(projectId: string): Promise<ComposeStatus>
  composeUp(projectId: string): Promise<{ ok: boolean; error?: string }>
  composeDown(projectId: string): Promise<{ ok: boolean; error?: string }>
  composeLogs(projectId: string, service?: string): Promise<{ ok: boolean; error?: string }>
  onComposeLog(cb: (line: LogLine) => void): () => void
  proxyStatus(): Promise<ProxySetupStatus>
  proxySetup(): Promise<{ ok: boolean; error?: string }>
  proxyDomain(projectId: string): Promise<string | null>
  proxyValidateSlug(slug: string, excludeProjectId?: string): Promise<string | null>
  listConnections(): Promise<DbConnection[]>
  saveConnection(conn: DbConnection): Promise<DbConnection[]>
  removeConnection(id: string): Promise<DbConnection[]>
  testConnection(conn: DbConnection): Promise<ConnectionTestResult>
  applyConnection(conn: DbConnection): Promise<ApplyEnvResult>
  onConnectionsChanged(cb: (connections: DbConnection[]) => void): () => void
  detectTools(): Promise<ToolStatus[]>
  installTool(toolId: string): Promise<{ ok: boolean; error?: string }>
  uninstallTool(toolId: string): Promise<{ ok: boolean; error?: string }>
  cancelInstallTool(toolId: string): Promise<{ ok: boolean; error?: string }>
  getInstallStates(): Promise<InstallState[]>
  onToolInstallLog(cb: (toolId: string, line: LogLine) => void): () => void
  onToolInstallState(cb: (state: InstallState) => void): () => void
  listDbServices(): Promise<DbService[]>
  dbServiceAction(name: string, action: 'start' | 'stop'): Promise<{ ok: boolean; error?: string }>
  getLicenseState(): Promise<LicenseState>
  activateLicense(opts: ActivateOptions): Promise<LicenseActionResult>
  refreshLicense(): Promise<LicenseActionResult>
  clearLicense(): Promise<LicenseState>
  setLicenseServerUrl(url: string): Promise<LicenseState>
  startAuth(): Promise<LicenseActionResult>
  signOutAuth(): Promise<LicenseActionResult>
  getAuthStatus(): Promise<LicenseState>
  pollLicense(): Promise<void>
  checkUpdates(): Promise<UpdateCheckResult>
  fetchPendingUpdate(): Promise<{ ok: boolean; error?: string; pending?: unknown }>
  getPendingUpdate(): Promise<{ version: string; downloadUrl: string; checksum: string | null } | null>
  startUpdate(version?: string): Promise<{ ok: boolean; error?: string }>
  onUpdateAvailable(cb: (payload: UpdateAvailablePayload) => void): () => void
  onUpdateProgress(cb: (progress: UpdateProgress) => void): () => void
  onLicenseChanged(cb: (state: LicenseState) => void): () => void
  openExternal(url: string): Promise<void>
  pickFolder(title?: string): Promise<string | null>
  getDevProcesses(): Promise<DevProcessSnapshot>
  killDevProcess(pid: number): Promise<{ ok: boolean; error?: string }>
  /** Frameless title bar (Windows/Linux desktop). */
  frameless?: boolean
  windowMinimize?(): Promise<void>
  windowToggleMaximize?(): Promise<boolean>
  windowIsMaximized?(): Promise<boolean>
  windowClose?(): Promise<void>
  onWindowMaximized?(cb: (maximized: boolean) => void): () => void
  onProjectsChanged(cb: (projects: Project[]) => void): () => void
  onRunnerStatus(cb: (projectId: string, info: RuntimeInfo) => void): () => void
  onRunnerLog(cb: (projectId: string, line: LogLine) => void): () => void
  onSystemStats(cb: (sys: SystemStats, perProject: Record<string, ProjectStats>) => void): () => void
  onActivity(cb: (ev: ActivityEvent) => void): () => void
  onScaffoldLog(cb: (line: LogLine) => void): () => void
  onNavigate(cb: (route: string) => void): () => void
}

declare global {
  interface Window {
    api?: Api
  }
}

const MOCK_GIT: GitStatus = {
  gitInstalled: true,
  isRepo: true,
  branch: 'main',
  ahead: 1,
  behind: 0,
  hasUpstream: true,
  hasRemote: true,
  remoteUrl: 'https://github.com/example/my-next-app.git',
  dirtyCount: 3,
  staged: [{ path: 'src/App.tsx', index: 'M', worktree: '.' }],
  unstaged: [{ path: 'src/pages/Dashboard.tsx', index: '.', worktree: 'M' }],
  untracked: ['notes.md'],
  lastCommit: { hash: 'a1b2c3d', subject: 'Add sidebar service controls', author: 'dev', dateIso: new Date().toISOString() },
  fetchedAt: Date.now(),
}

const MOCK_SETTINGS: AppSettings = {
  reservedPorts: [3000, 3001],
  defaultProjectsDir: 'C:\\dev',
  closeToTray: false,
  notifyCrash: true,
  notifyBuild: true,
  notifyUpdates: true,
  launchAtLogin: false,
  startMinimized: false,
  trayProjectCount: 5,
  openOutputAfterBuild: false,
  preferredEditor: 'vscode',
  customEditorCmd: '',
  preferredNodeManager: 'auto',
  localDomainsEnabled: false,
  localDomainSuffix: 'test',
  proxyAutoStart: true,
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
    openInEditor: async () => ({ ok: false, error: 'Not available in browser preview' }),
    detectEditors: async () => ({ vscode: true, cursor: false }),
    scanProjects: async () => ({ ok: false, error: 'Not available in browser preview', candidates: [], skipped: [] }),
    importManyProjects: async () => ({ ok: false, added: 0, errors: ['Not available in browser preview'] }),
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
    installDeps: async () => ({ ok: false, error: 'Not available in browser preview' }),
    runScript: async () => ({ ok: false, error: 'Not available in browser preview' }),
    listScripts: async () => [
      { name: 'lint', command: 'npm run lint' },
      { name: 'test', command: 'npm run test' },
    ],
    startManyProjects: async (ids) => ({ ok: ids.length, failed: [] }),
    stopManyProjects: async (ids) => ({ ok: ids.length, failed: [] }),
    stopAllProjects: async () => ({ ok: 1, failed: [] }),
    getRuntime: async () => runtime,
    getLogs: async () => [
      { ts: Date.now() - 5000, stream: 'sys', text: '$ npm run dev' },
      { ts: Date.now() - 4000, stream: 'out', text: '> next dev' },
      { ts: Date.now() - 3000, stream: 'out', text: 'ready - started server on http://localhost:3007' },
    ],
    clearLogs: async () => true,
    createProject: async () => ({ ok: false, error: 'Not available in browser preview' }),
    checkPort: async (port) => ({ port, free: port !== 3000, reserved: port === 3000 || port === 3001 }),
    getPortOwner: async (port) =>
      port === 3000
        ? { port, pid: 4242, processName: 'node.exe', killable: true }
        : null,
    takeoverPort: async () => ({ ok: false, error: 'Not available in browser preview' }),
    exportBackup: async () => ({ ok: false, error: 'Not available in browser preview' }),
    importBackup: async () => ({
      ok: false,
      error: 'Not available in browser preview',
      projectsAdded: 0,
      projectsSkipped: 0,
      connectionsAdded: 0,
      warnings: [],
    }),
    listEnvFiles: async () => [
      { name: '.env', size: 120, mtime: Date.now() - 86400000 },
      { name: '.env.local', size: 64, mtime: Date.now() - 3600000 },
    ],
    readEnvFile: async () => ({
      ok: true,
      lines: [
        { type: 'comment', raw: '# Database' },
        { type: 'pair', key: 'DATABASE_URL', value: 'postgresql://postgres:secret@127.0.0.1:5432/app', raw: 'DATABASE_URL=postgresql://postgres:secret@127.0.0.1:5432/app' },
        { type: 'blank', raw: '' },
        { type: 'pair', key: 'NEXT_PUBLIC_API_URL', value: 'http://localhost:3007/api', raw: 'NEXT_PUBLIC_API_URL=http://localhost:3007/api' },
        { type: 'pair', key: 'SECRET_KEY', value: 'dev-secret-123', raw: 'SECRET_KEY=dev-secret-123' },
      ],
    }),
    writeEnvFile: async () => ({ ok: false, error: 'Not available in browser preview' }),
    gitStatus: async () => MOCK_GIT,
    gitStatusAll: async () => ({ 'mock-1': MOCK_GIT, 'mock-2': { ...MOCK_GIT, branch: 'develop', dirtyCount: 0, staged: [], unstaged: [], untracked: [] } }),
    gitInit: async () => ({ ok: false, error: 'Not available in browser preview' }),
    gitStage: async () => ({ ok: true }),
    gitUnstage: async () => ({ ok: true }),
    gitCommit: async () => ({ ok: false, error: 'Not available in browser preview' }),
    gitPull: async () => ({ ok: false, error: 'Not available in browser preview' }),
    gitPush: async () => ({ ok: false, error: 'Not available in browser preview' }),
    gitFetch: async () => ({ ok: true }),
    gitAddRemote: async () => ({ ok: false, error: 'Not available in browser preview' }),
    healthScan: async () => ({ queued: true, position: 1 }),
    healthGet: async (projectId) => ({
      projectId,
      scannedAt: Date.now() - 3600_000,
      outdated: [
        { name: 'react', current: '18.3.1', wanted: '18.3.1', latest: '19.0.0' },
        { name: 'vite', current: '6.0.3', wanted: '6.0.7', latest: '6.0.7' },
      ],
      audit: { critical: 0, high: 2, moderate: 1, low: 0, info: 0, total: 3 },
      engines: { required: '>=18', installed: '22.12.0', satisfied: true },
    }),
    healthSummaries: async () => ({
      'mock-1': { scannedAt: Date.now() - 3600_000, outdatedCount: 2, vulnHighPlus: 2, vulnTotal: 3, enginesOk: true },
    }),
    onHealthStatus: () => noopUnsub,
    onHealthResult: () => noopUnsub,
    onHealthSummaries: () => noopUnsub,
    termCreate: async () => ({ ok: false, error: 'Terminal is only available in the desktop app.' }),
    termWrite: () => {},
    termResize: async () => {},
    termDispose: async () => {},
    termList: async () => [],
    termGetBuffer: async () => '',
    termShells: async () => ['powershell', 'gitbash', 'cmd'],
    onTermData: () => noopUnsub,
    onTermExit: () => noopUnsub,
    getActivity: async () => [
      { id: 'a1', ts: Date.now() - 60000, level: 'ok', title: 'Server Started', message: 'my-next-app on port 3007' },
      { id: 'a2', ts: Date.now() - 400000, level: 'ok', title: 'Build Successful', message: 'vite-portfolio' },
      { id: 'a3', ts: Date.now() - 900000, level: 'info', title: 'Project Imported', message: 'vite-portfolio' },
    ],
    getSettings: async () => ({ ...MOCK_SETTINGS }),
    updateSettings: async (p) => ({ ...MOCK_SETTINGS, ...p }),
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
    dockerLaunch: async () => ({ ok: false, error: 'Not available in browser preview' }),
    onDockerLog: () => noopUnsub,
    composeDetect: async () => 'docker-compose.yml',
    composePs: async () => ({ ok: true, running: true, file: 'docker-compose.yml', services: [{ name: 'redis', state: 'running', ports: '6379:6379' }] }),
    composeUp: async () => ({ ok: false, error: 'Not available in browser preview' }),
    composeDown: async () => ({ ok: false, error: 'Not available in browser preview' }),
    composeLogs: async () => ({ ok: true }),
    onComposeLog: () => noopUnsub,
    proxyStatus: async () => ({
      mkcertInstalled: false,
      mkcertTrusted: false,
      caddyInstalled: false,
      caddyRunning: false,
      hostsConfigured: false,
      ready: false,
      httpsPort: 8443,
    }),
    proxySetup: async () => ({ ok: false, error: 'Not available in browser preview' }),
    proxyDomain: async () => 'my-next-app.test',
    proxyValidateSlug: async () => null,
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
    uninstallTool: async () => ({ ok: false, error: 'Not available in browser preview' }),
    cancelInstallTool: async () => ({ ok: false, error: 'Not available in browser preview' }),
    getInstallStates: async () => [],
    onToolInstallLog: () => noopUnsub,
    onToolInstallState: () => noopUnsub,
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
    // browser preview simulates the free (not activated) state
    getLicenseState: async () => ({
      activated: false,
      valid: false,
      inGrace: false,
      signedIn: false,
      serverUrl: 'https://devtune-website.vercel.app',
      appVersion: '0.1.0',
      deviceLabel: 'DESKTOP-MOCK',
    }),
    activateLicense: async () => ({ ok: false, error: 'Not available in browser preview' }),
    refreshLicense: async () => ({ ok: false, error: 'Not available in browser preview' }),
    clearLicense: async () => ({
      activated: false,
      valid: false,
      inGrace: false,
      signedIn: false,
      serverUrl: 'https://devtune-website.vercel.app',
      appVersion: '0.1.0',
    }),
    setLicenseServerUrl: async () => ({
      activated: false,
      valid: false,
      inGrace: false,
      signedIn: false,
      serverUrl: 'https://devtune-website.vercel.app',
      appVersion: '0.1.0',
    }),
    startAuth: async () => ({ ok: false, error: 'Not available in browser preview' }),
    signOutAuth: async () => ({ ok: false, error: 'Not available in browser preview' }),
    getAuthStatus: async () => ({
      activated: false,
      valid: false,
      inGrace: false,
      signedIn: false,
      serverUrl: 'https://devtune-website.vercel.app',
      appVersion: '0.1.0',
    }),
    pollLicense: async () => {},
    checkUpdates: async () => ({
      ok: true,
      currentVersion: '0.1.0',
      updateAvailable: true,
      required: false,
      severity: 'recommended',
      latest: {
        version: '0.2.0',
        downloadUrl: 'http://localhost:3009/downloads',
        sizeBytes: 88_400_000,
        releaseNotes: '- Apps & Tools page\n- Local database service controls\n- Theme system',
        releasedAt: new Date().toISOString(),
      },
    }),
    fetchPendingUpdate: async () => ({ ok: false }),
    getPendingUpdate: async () => null,
    startUpdate: async () => ({ ok: false, error: 'Not available in browser preview' }),
    onUpdateAvailable: () => () => {},
    onUpdateProgress: () => () => {},
    onLicenseChanged: () => () => {},
    openExternal: async (url) => {
      window.open(url, '_blank')
    },
    pickFolder: async () => null,
    getDevProcesses: async () => ({
      sampledAt: Date.now(),
      totals: { cpu: 12.4, mem: 890_000_000, count: 3 },
      processes: [
        {
          pid: 12345,
          parentPid: 9000,
          name: 'node.exe',
          commandLine: 'node "C:\\dev\\my-app\\node_modules\\vite\\bin\\vite.js"',
          category: 'runtime' as DevProcessCategory,
          cpu: 8.2,
          mem: 520_000_000,
          killable: true,
        },
        {
          pid: 12346,
          parentPid: 12345,
          name: 'node.exe',
          commandLine: 'esbuild --service',
          category: 'other-dev' as DevProcessCategory,
          cpu: 2.1,
          mem: 180_000_000,
          killable: true,
        },
        {
          pid: 4242,
          parentPid: 1,
          name: 'mysqld.exe',
          commandLine: 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe',
          category: 'database' as DevProcessCategory,
          cpu: 2.1,
          mem: 190_000_000,
          killable: false,
          reason: 'Stop the Windows service from the Database page instead.',
        },
      ],
    }),
    killDevProcess: async () => ({ ok: false, error: 'Not available in browser preview' }),
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
    onNavigate: () => noopUnsub,
  }
}

export const api: Api = window.api ?? createMockApi()
export const isElectron = !!window.api
