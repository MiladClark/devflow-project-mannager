import type { PackageManager } from '../../src/shared/types'

export interface PackageManagerCommand {
  executable: string
  args: string[]
}

export interface PackageManagerMeta {
  id: PackageManager
  name: string
  description: string
  toolId?: string
}

export const PACKAGE_MANAGERS: PackageManagerMeta[] = [
  { id: 'npm', name: 'npm', description: 'Included with Node.js; widest compatibility.' },
  { id: 'pnpm', name: 'pnpm', description: 'Fast and disk-efficient.', toolId: 'pnpm' },
  { id: 'yarn', name: 'Yarn', description: 'Popular in existing workspaces.', toolId: 'yarn' },
  { id: 'bun', name: 'Bun', description: 'Fast runtime and package manager.', toolId: 'bun' },
]

export function isPackageManager(value: unknown): value is PackageManager {
  return value === 'npm' || value === 'pnpm' || value === 'yarn' || value === 'bun'
}

/**
 * Accept a single npm dist-tag or version token, never a package name, URL,
 * range expression, or shell fragment. The creator package name is controlled
 * by DevFlow and only this suffix may come from the renderer.
 */
export function normalizeScaffoldVersion(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return 'latest'
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed) ? trimmed : null
}

export function packageManagerMeta(pm: PackageManager): PackageManagerMeta {
  return PACKAGE_MANAGERS.find((item) => item.id === pm) ?? PACKAGE_MANAGERS[0]
}

export function packageManagerExecutable(pm: PackageManager): string {
  return pm
}

export function installDependenciesCommand(pm: PackageManager): PackageManagerCommand {
  return { executable: packageManagerExecutable(pm), args: ['install'] }
}

export function addPackagesCommand(
  pm: PackageManager,
  packages: string[],
  options: { dev?: boolean } = {},
): PackageManagerCommand {
  const dev = !!options.dev
  switch (pm) {
    case 'npm':
      return { executable: 'npm', args: ['install', ...(dev ? ['--save-dev'] : []), ...packages] }
    case 'pnpm':
      return { executable: 'pnpm', args: ['add', ...(dev ? ['--save-dev'] : []), ...packages] }
    case 'yarn':
      return { executable: 'yarn', args: ['add', ...(dev ? ['--dev'] : []), ...packages] }
    case 'bun':
      return { executable: 'bun', args: ['add', ...(dev ? ['--dev'] : []), ...packages] }
  }
}

export function runScriptCommand(pm: PackageManager, script: string): PackageManagerCommand {
  return pm === 'yarn'
    ? { executable: 'yarn', args: [script] }
    : { executable: packageManagerExecutable(pm), args: ['run', script] }
}

/**
 * Execute a create-* package once. Yarn intentionally uses `yarn create` so
 * both Yarn Classic and modern Yarn work; the other managers use their
 * one-shot package executors and pin the requested creator version.
 */
export function createPackageCommand(
  pm: PackageManager,
  creatorName: string,
  creatorVersion: string,
  args: string[],
): PackageManagerCommand {
  const versioned = `${creatorName}@${creatorVersion}`
  if (pm === 'npm') return { executable: 'npx', args: ['--yes', versioned, ...args] }
  if (pm === 'pnpm') return { executable: 'pnpm', args: ['dlx', versioned, ...args] }
  if (pm === 'bun') return { executable: 'bunx', args: [versioned, ...args] }

  const yarnName = creatorName.startsWith('create-') ? creatorName.slice('create-'.length) : creatorName
  return { executable: 'yarn', args: ['create', `${yarnName}@${creatorVersion}`, ...args] }
}

export function nextScaffoldCommand(
  pm: PackageManager,
  name: string,
  flags: string[],
  creatorVersion = 'latest',
): PackageManagerCommand {
  return createPackageCommand(pm, 'create-next-app', creatorVersion, [name, ...flags, `--use-${pm}`, '--yes'])
}

export function viteScaffoldCommand(
  pm: PackageManager,
  name: string,
  template: string,
  creatorVersion = 'latest',
): PackageManagerCommand {
  // create-vite accepts these arguments regardless of which one-shot runner
  // launched it. --no-interactive prevents a future default prompt from
  // leaving a background install waiting forever.
  return createPackageCommand(pm, 'create-vite', creatorVersion, [name, '--template', template, '--no-interactive'])
}

export function payloadScaffoldCommand(
  pm: PackageManager,
  name: string,
  creatorVersion = 'latest',
): PackageManagerCommand {
  return createPackageCommand(pm, 'create-payload-app', creatorVersion, [
    '-n',
    name,
    '-t',
    'blank',
    '--db',
    'sqlite',
    '--db-connection-string',
    `file:./${name}.db`,
    '--no-agent',
    `--use-${pm}`,
    '-y',
  ])
}

export function strapiScaffoldCommand(
  pm: PackageManager,
  name: string,
  typescript: boolean,
  creatorVersion = 'latest',
): PackageManagerCommand {
  return createPackageCommand(pm, 'create-strapi-app', creatorVersion, [
    name,
    '--quickstart',
    '--no-run',
    '--skip-cloud',
    `--use-${pm}`,
    typescript ? '--typescript' : '--javascript',
  ])
}

export function electronScaffoldCommand(
  pm: PackageManager,
  name: string,
  template: string,
  creatorVersion = 'latest',
): PackageManagerCommand {
  const creator = '@quick-start/electron'
  if (pm === 'npm') {
    return { executable: 'npm', args: ['create', `${creator}@${creatorVersion}`, name, '--', '--template', template, '--skip'] }
  }
  return {
    executable: packageManagerExecutable(pm),
    args: ['create', `${creator}@${creatorVersion}`, name, '--template', template, '--skip'],
  }
}

export function outdatedCommand(pm: PackageManager, yarnMajor?: number): PackageManagerCommand | null {
  if (pm === 'npm') return { executable: 'npm', args: ['outdated', '--json'] }
  if (pm === 'pnpm') return { executable: 'pnpm', args: ['outdated', '--format', 'json'] }
  if (pm === 'yarn') {
    return yarnMajor !== undefined && yarnMajor >= 2
      ? null
      : { executable: 'yarn', args: ['outdated', '--json'] }
  }
  return { executable: 'bun', args: ['outdated'] }
}

export function auditCommand(pm: PackageManager, yarnMajor?: number): PackageManagerCommand {
  if (pm === 'yarn' && yarnMajor !== undefined && yarnMajor >= 2) {
    return { executable: 'yarn', args: ['npm', 'audit', '--json'] }
  }
  return { executable: packageManagerExecutable(pm), args: ['audit', '--json'] }
}

function quoteArg(arg: string): string {
  if (/^[A-Za-z0-9_@%+=:,./\\*-]+$/.test(arg)) return arg
  return `"${arg.replace(/"/g, '\\"')}"`
}

export function renderCommand(spec: PackageManagerCommand): string {
  return [spec.executable, ...spec.args].map(quoteArg).join(' ')
}
