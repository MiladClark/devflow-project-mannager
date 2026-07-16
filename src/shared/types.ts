export type Framework = 'next' | 'vite' | 'react' | 'vue' | 'tailwind' | 'node' | 'electron' | 'unknown'

export type ProjectStatus = 'stopped' | 'starting' | 'running' | 'building' | 'error'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type PreferredEditor = 'vscode' | 'cursor' | 'custom'

export type NodeManager = 'system' | 'fnm' | 'nvm' | 'volta'

export type PreferredNodeManager = 'auto' | 'fnm' | 'nvm' | 'volta' | 'system'

export interface Project {
  id: string
  name: string
  path: string
  framework: Framework
  frameworks: string[]
  runCommand: string
  buildCommand: string
  outputDir: string
  preferredPort?: number
  defaultPort: number
  env: Record<string, string>
  createdAt: number
  /** detected package manager (from lockfile / packageManager field) */
  packageManager?: PackageManager
  /** start the dev server automatically when DevFlow launches (Pro) */
  autoStart?: boolean
  /** npm scripts pinned in the Scripts tab */
  pinnedScripts?: string[]
  /** Node version from engines.node or manual override */
  nodeVersion?: string
  nodeManager?: NodeManager
  /** docker-compose.yml path relative to project root */
  composeFile?: string
  composeProfile?: string
  /** start compose stack before dev server */
  composeAutoStart?: boolean
  /** local HTTPS slug — defaults from project name */
  localSlug?: string
}

/** A blocker found before running a build/dev command, with a suggested fix. */
export interface BuildIssue {
  kind: 'no-build-script' | 'deps-missing' | 'pm-missing' | 'node-missing' | 'path-missing'
  message: string
  packageManager?: PackageManager
  /** the deps can be installed in-app by running `<pm> install` */
  canInstallDeps?: boolean
  /** App and Tools id the user should install (e.g. 'node', 'pnpm', 'bun') */
  toolId?: string
}

export interface RunActionResult {
  ok: boolean
  error?: string
  portConflict?: PortOwner
  issue?: BuildIssue
}

export interface RuntimeInfo {
  status: ProjectStatus
  kind?: 'dev' | 'build'
  pid?: number
  port?: number
  url?: string
  startedAt?: number
  exitCode?: number | null
}

export interface LogLine {
  ts: number
  stream: 'out' | 'err' | 'sys'
  text: string
}

export interface ActivityEvent {
  id: string
  ts: number
  level: 'ok' | 'info' | 'warn' | 'err'
  title: string
  message: string
}

export interface SystemStats {
  cpu: number
  memUsed: number
  memTotal: number
  uptime: number
}

export type DevProcessCategory =
  | 'runtime'
  | 'package-manager'
  | 'editor'
  | 'database'
  | 'container'
  | 'devflow'
  | 'shell'
  | 'other-dev'

export interface DevProcess {
  pid: number
  parentPid: number
  name: string
  commandLine: string
  category: DevProcessCategory
  cpu: number
  mem: number
  managedProjectId?: string
  managedProjectName?: string
  killable: boolean
  reason?: string
}

export interface DevProcessSnapshot {
  processes: DevProcess[]
  totals: { cpu: number; mem: number; count: number }
  sampledAt: number
}

export interface ProjectStats {
  cpu: number
  mem: number
}

export interface PortCheck {
  port: number
  free: boolean
  reserved: boolean
  usedByProject?: string
}

export interface OccupiedPortInfo {
  port: number
  pid: number
  processName: string
  managedProjectName?: string
}

export interface PortStatusOverview {
  reserved: number[]
  occupied: OccupiedPortInfo[]
}

export interface AppSettings {
  reservedPorts: number[]
  defaultProjectsDir: string
  closeToTray: boolean
  notifyCrash: boolean
  notifyBuild: boolean
  notifyUpdates: boolean
  launchAtLogin: boolean
  startMinimized: boolean
  trayProjectCount: number
  openOutputAfterBuild: boolean
  preferredEditor: PreferredEditor
  customEditorCmd?: string
  preferredNodeManager: PreferredNodeManager
  localDomainsEnabled: boolean
  localDomainSuffix: string
  proxyAutoStart: boolean
  /** First-run setup wizard finished or skipped */
  onboardingComplete: boolean
}

export interface ProjectScript {
  name: string
  command: string
  hidden?: boolean
}

export interface ScanCandidate {
  project: Project
  alreadyImported: boolean
}

export interface ScanProjectsResult {
  ok: boolean
  error?: string
  cancelled?: boolean
  candidates: ScanCandidate[]
  skipped: string[]
}

export interface BulkFailure {
  id: string
  error: string
  portConflict?: PortOwner
}

export interface BulkResult {
  ok: number
  failed: BulkFailure[]
}

export interface EditorStatus {
  vscode: boolean
  cursor: boolean
}

export interface ComposeService {
  name: string
  state: string
  ports: string
}

export interface ComposeStatus {
  ok: boolean
  running: boolean
  file?: string
  services: ComposeService[]
  error?: string
}

export interface ProxySetupStatus {
  mkcertInstalled: boolean
  mkcertTrusted: boolean
  caddyInstalled: boolean
  caddyRunning: boolean
  hostsConfigured: boolean
  ready: boolean
  httpsPort: number
  error?: string
}

export interface PortOwner {
  port: number
  pid: number
  processName: string
  /** set when the listener belongs to a DevFlow-managed project */
  managedProjectId?: string
  managedProjectName?: string
  killable: boolean
  reason?: string
}

export interface StartResult {
  ok: boolean
  error?: string
  portConflict?: PortOwner
  issue?: BuildIssue
}

export interface BackupImportResult {
  ok: boolean
  error?: string
  projectsAdded: number
  projectsSkipped: number
  connectionsAdded: number
  warnings: string[]
}

// ---- env files ----

export interface EnvFileInfo {
  name: string
  size: number
  mtime: number
}

export interface EnvLine {
  type: 'pair' | 'comment' | 'blank' | 'raw'
  key?: string
  value?: string
  raw: string
}

// ---- git ----

export interface GitFileEntry {
  path: string
  /** porcelain XY status letters */
  index: string
  worktree: string
}

export interface GitStatus {
  gitInstalled: boolean
  isRepo: boolean
  branch?: string
  ahead: number
  behind: number
  hasUpstream: boolean
  /** whether an `origin` remote is configured */
  hasRemote: boolean
  remoteUrl?: string
  dirtyCount: number
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
  untracked: string[]
  lastCommit?: { hash: string; subject: string; author: string; dateIso: string }
  fetchedAt: number
}

export interface GitActionResult {
  ok: boolean
  output?: string
  error?: string
}

// ---- health ----

export interface OutdatedDep {
  name: string
  current?: string
  wanted: string
  latest: string
}

export interface AuditCounts {
  critical: number
  high: number
  moderate: number
  low: number
  info: number
  total: number
}

export interface HealthReport {
  projectId: string
  scannedAt: number
  outdated: OutdatedDep[]
  audit: AuditCounts | null
  auditError?: string
  engines: { required?: string; installed: string; satisfied: boolean | null }
  error?: string
}

export interface HealthSummary {
  scannedAt: number
  outdatedCount: number
  vulnHighPlus: number
  vulnTotal: number
  enginesOk: boolean | null
}

export type HealthPhase = 'queued' | 'outdated' | 'audit' | 'engines' | 'done' | 'error'

// ---- terminal ----

export type TermShell = 'powershell' | 'pwsh' | 'gitbash' | 'cmd'

export interface TermSessionInfo {
  sessionId: string
  projectId?: string
  shell: TermShell
  title: string
  createdAt: number
}

export type CmsChoice = 'none' | 'payload' | 'strapi' | 'decap'

export type ScaffoldPluginId =
  | 'prettier'
  | 'eslint'
  | 'vitest'
  | 'react-router'
  | 'pinia'
  | 'lucide'
  | 'zustand'
  | 'tanstack-query'

export interface ScaffoldOptions {
  framework: 'next' | 'vite-react' | 'vite-vue' | 'vite-vanilla' | 'electron'
  cms: CmsChoice
  typescript: boolean
  tailwind: boolean
  plugins?: ScaffoldPluginId[]
  name: string
  parentDir: string
  preferredPort?: number
}

export interface ScaffoldResult {
  ok: boolean
  project?: Project
  error?: string
  cancelled?: boolean
}

export interface DockerStatus {
  installed: boolean
  running: boolean
  version?: string
}

export type DbKind = 'mysql' | 'postgres'

export type ContainerState = 'running' | 'exited' | 'paused' | 'restarting' | 'created' | 'dead'

export interface DbContainer {
  id: string
  name: string
  image: string
  kind: DbKind
  state: ContainerState
  status: string
  hostPort?: number
  containerPort: number
  user: string
  password?: string
}

export interface DbListResult {
  ok: boolean
  databases?: string[]
  error?: string
}

export interface CreateDbContainerOptions {
  kind: DbKind
  name: string
  hostPort: number
  password: string
}

export interface ToolStatus {
  id: string
  installed: boolean
  version?: string
}

export type InstallPhase = 'installing' | 'done' | 'error'

export interface InstallState {
  toolId: string
  phase: InstallPhase
  /** install (default) or uninstall — same state machine, different UI label */
  mode?: 'install' | 'uninstall'
  lines: LogLine[]
  error?: string
  startedAt: number
  finishedAt?: number
  /** re-detected status after a successful install/uninstall */
  status?: ToolStatus
}

export type ServiceState = 'running' | 'stopped' | 'pending' | 'unknown'

export interface DbService {
  /** Windows service name, e.g. MySQL80 or postgresql-x64-16 */
  name: string
  displayName: string
  kind: DbKind
  state: ServiceState
  rawState: string
  version?: string
  binPath?: string
}

// ---- DevTune website integration ----

export interface LicenseState {
  activated: boolean
  /** signature + expiry/grace verified */
  valid: boolean
  /** token expired but inside offline grace window */
  inGrace: boolean
  plan?: string
  tier?: string
  email?: string
  userName?: string
  avatarUrl?: string
  signedIn?: boolean
  /** Browse app UI without DevTune sign-in; all features locked until OAuth. */
  guestMode?: boolean
  seatsUsed?: number
  /** masked, e.g. DVF-****-****-****-A1B2 */
  licenseKey?: string
  /** marketing/display key e.g. freeappdevflow2026 */
  displayKey?: string
  expiresAt?: string | null
  tokenExpiresAt?: number
  graceUntil?: number
  lastValidatedAt?: number
  entitlements?: Record<string, string>
  seatLimit?: number
  serverUrl: string
  appVersion: string
  deviceLabel?: string
  /** days remaining for freeapp tier */
  daysRemaining?: number
}

export interface UpdateProgress {
  phase: 'idle' | 'downloading' | 'verifying' | 'applying' | 'restarting' | 'error' | 'cancelled'
  percent: number
  message: string
  version?: string
  error?: string
}

export interface UpdateAvailablePayload {
  version: string
  required: boolean
  releaseNotes?: string | null
}

export interface ActivateOptions {
  email?: string
  password?: string
  licenseKey?: string
}

export interface LicenseActionResult {
  ok: boolean
  error?: string
  state?: LicenseState
}

export interface UpdateCheckResult {
  ok: boolean
  error?: string
  currentVersion: string
  updateAvailable?: boolean
  required?: boolean
  severity?: string
  latest?: {
    version: string
    downloadUrl?: string | null
    checksum?: string | null
    sizeBytes?: number | null
    releaseNotes?: string | null
    releasedAt?: string
  }
}

export type SslMode = 'disable' | 'prefer' | 'require'

export interface DbConnection {
  id: string
  name: string
  projectId?: string
  kind: DbKind
  host: string
  port: number
  database: string
  user: string
  password: string
  sslMode: SslMode
  connectTimeout: number
  extraParams: string
  envVarName: string
  envFile: '.env' | '.env.local' | '.env.development'
  lastTest?: ConnectionTestResult
  createdAt: number
}

export interface ConnectionTestResult {
  ok: boolean
  method: 'tcp' | 'auth'
  latencyMs: number
  message: string
  testedAt: number
}

export interface ApplyEnvResult {
  ok: boolean
  file?: string
  previous?: string
  error?: string
}

// ---- Build & Setup ----

export type BuildTargetId = 'static-build' | 'zip-archive' | 'win-portable' | 'win-nsis' | 'win-zip'
export type BuildHealthStatus = 'ready' | 'warning' | 'needs-attention' | 'blocked'

export interface BuildHealthIssue {
  id: string
  status: BuildHealthStatus
  title: string
  detail: string
  fixHint?: string
}

export interface BuildExclusionCandidate {
  path: string
  reason: string
  approxBytes: number
  approxSize: boolean
  isDir: boolean
  recommended: boolean
}

export interface BuildDetection {
  projectPath: string
  appName: string
  packageName: string
  version: string
  framework: Framework
  frameworks: string[]
  packageManager: PackageManager
  nodeVersion?: string
  buildCommand: string
  devCommand: string
  outputDir: string
  isElectron: boolean
  electronVersion?: string
  hasIconAsset: boolean
  iconPath?: string
  existingBuilderConfig: 'yaml' | 'json' | 'package-json' | null
  health: BuildHealthIssue[]
  exclusions: BuildExclusionCandidate[]
  supportedTargets: BuildTargetId[]
  disabledTargets: { id: BuildTargetId; reason: string }[]
}

export interface BuildConfig {
  projectPath: string
  framework: Framework
  isElectron: boolean
  iconPath?: string
  electronVersion?: string
  appName: string
  packageName: string
  version: string
  versionSource: 'package' | 'manual' | 'increment'
  incrementType?: 'patch' | 'minor' | 'major' | 'prerelease'
  appId?: string
  publisher?: string
  buildCommand: string
  preBuildCommand?: string
  postBuildCommand?: string
  packageManager: PackageManager
  outputDir: string
  cleanOutputDir: boolean
  installDepsBeforeBuild: boolean
  runTypeCheck: boolean
  runLint: boolean
  runTests: boolean
  targets: BuildTargetId[]
  excludedPaths: string[]
  exportDir: string
  namingTemplate: string
}

export type BuildStageId =
  | 'validating'
  | 'cleaning'
  | 'installing'
  | 'checks'
  | 'building'
  | 'packaging'
  | 'installer'
  | 'compressing'
  | 'manifest'
  | 'finalizing'
export type BuildStageStatus = 'pending' | 'running' | 'complete' | 'warning' | 'failed' | 'skipped'

export interface BuildStageState {
  id: BuildStageId
  label: string
  status: BuildStageStatus
  startedAt?: number
  finishedAt?: number
  command?: string
  durationMs?: number
}

export interface BuildRunState {
  buildId: string
  projectPath: string
  stages: BuildStageState[]
  phase: 'running' | 'done' | 'error' | 'cancelled'
  error?: string
  outputDir?: string
  files?: BuildOutputFile[]
  manifestPath?: string
}

export interface BuildOutputFile {
  name: string
  path: string
  sizeBytes: number
  sha256: string
}

export interface BuildManifest {
  appName: string
  packageName: string
  version: string
  framework: string
  platform: string
  architecture: string
  buildDate: string
  buildCommand: string
  installerType: string[]
  outputFiles: string[]
  outputDirectory: string
  checksums: { sha256: Record<string, string> }
}

export interface BuildPreflightIssue {
  id: string
  message: string
  why?: string
  fix?: string
}

export interface BuildPreflightResult {
  ok: boolean
  errors: BuildPreflightIssue[]
  warnings: BuildPreflightIssue[]
}

export interface BuildStartResult {
  ok: boolean
  error?: string
  buildId?: string
}

export type BuildEligibilityStatus = 'ready' | 'needs-attention' | 'not-buildable' | 'config-missing'

export interface BuildEligibility {
  status: BuildEligibilityStatus
  statusLabel: string
  framework: Framework
  version?: string
  packageManager?: PackageManager
  supportedTargets: BuildTargetId[]
  reason?: string
  detail?: string
  fix?: string
  lastBuildAt?: number
}
