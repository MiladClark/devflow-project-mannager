export type Framework = 'next' | 'vite' | 'react' | 'vue' | 'tailwind' | 'node' | 'unknown'

export type ProjectStatus = 'stopped' | 'starting' | 'running' | 'building' | 'error'

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

export interface AppSettings {
  reservedPorts: number[]
  defaultProjectsDir: string
}

export type CmsChoice = 'none' | 'payload' | 'strapi' | 'decap'

export interface ScaffoldOptions {
  framework: 'next' | 'vite-react' | 'vite-vue' | 'vite-vanilla'
  cms: CmsChoice
  typescript: boolean
  tailwind: boolean
  name: string
  parentDir: string
  preferredPort?: number
}

export interface ScaffoldResult {
  ok: boolean
  project?: Project
  error?: string
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
