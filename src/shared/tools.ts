export type ToolCategory = 'runtime' | 'vcs' | 'database' | 'container' | 'editor' | 'terminal' | 'utility'

export interface ToolDef {
  id: string
  name: string
  description: string
  category: ToolCategory
  /** winget package id, used to build the default install command */
  winget?: string
  /** overrides the winget-based install command (e.g. npm global installs) */
  installCmd?: string
  url: string
  /** CLI executable checked with `--version` (or versionArgs) */
  cmd?: string
  versionArgs?: string[]
  /** absolute paths (env vars in %VAR% form allowed) checked for existence */
  paths?: string[]
  /** directory scanned for entries starting with the given prefix (e.g. "MySQL Server") */
  dirPrefix?: { dir: string; prefix: string }
}

export const TOOL_CATEGORIES: { key: ToolCategory; label: string; blurb: string }[] = [
  { key: 'runtime', label: 'Runtimes & Package Managers', blurb: 'The base layer every JavaScript project needs.' },
  { key: 'vcs', label: 'Version Control', blurb: 'Track changes and collaborate on code.' },
  { key: 'database', label: 'Databases', blurb: 'Local database servers and GUI clients.' },
  { key: 'container', label: 'Containers', blurb: 'Run isolated services like MySQL and PostgreSQL.' },
  { key: 'editor', label: 'Editors', blurb: 'Where the actual work happens.' },
  { key: 'terminal', label: 'Terminals & Shells', blurb: 'A better command-line experience on Windows.' },
  { key: 'utility', label: 'Utilities', blurb: 'API testing and other helpers.' },
]

export const TOOLS: ToolDef[] = [
  // runtimes
  {
    id: 'node',
    name: 'Node.js (LTS)',
    description: 'JavaScript runtime — required to run and build every project in this app.',
    category: 'runtime',
    winget: 'OpenJS.NodeJS.LTS',
    url: 'https://nodejs.org/',
    cmd: 'node',
  },
  {
    id: 'bun',
    name: 'Bun',
    description: 'Fast all-in-one JavaScript runtime, bundler and package manager.',
    category: 'runtime',
    winget: 'Oven-sh.Bun',
    url: 'https://bun.sh/',
    cmd: 'bun',
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    description: 'Fast, disk-efficient package manager (drop-in npm replacement).',
    category: 'runtime',
    installCmd: 'npm install -g pnpm',
    url: 'https://pnpm.io/',
    cmd: 'pnpm',
    paths: ['%APPDATA%\\npm\\pnpm.cmd'],
  },
  {
    id: 'yarn',
    name: 'Yarn',
    description: 'Alternative package manager used by many existing projects.',
    category: 'runtime',
    installCmd: 'npm install -g yarn',
    url: 'https://yarnpkg.com/',
    cmd: 'yarn',
    paths: ['%APPDATA%\\npm\\yarn.cmd'],
  },
  {
    id: 'python',
    name: 'Python 3',
    description: 'Needed by some native npm modules (node-gyp) and general scripting.',
    category: 'runtime',
    winget: 'Python.Python.3.12',
    url: 'https://www.python.org/downloads/',
    cmd: 'python',
  },
  // vcs
  {
    id: 'git',
    name: 'Git',
    description: 'Version control — also provides Git Bash as a Unix-style terminal.',
    category: 'vcs',
    winget: 'Git.Git',
    url: 'https://git-scm.com/download/win',
    cmd: 'git',
  },
  {
    id: 'gh',
    name: 'GitHub CLI',
    description: 'Manage pull requests, issues and releases from the terminal.',
    category: 'vcs',
    winget: 'GitHub.cli',
    url: 'https://cli.github.com/',
    cmd: 'gh',
  },
  // databases
  {
    id: 'mysql-server',
    name: 'MySQL Server',
    description: 'The MySQL database server installed as a Windows service.',
    category: 'database',
    winget: 'Oracle.MySQL',
    url: 'https://dev.mysql.com/downloads/mysql/',
    cmd: 'mysql',
    dirPrefix: { dir: 'C:\\Program Files\\MySQL', prefix: 'MySQL Server' },
  },
  {
    id: 'mysql-workbench',
    name: 'MySQL Workbench',
    description: 'Official GUI for designing, querying and administering MySQL.',
    category: 'database',
    winget: 'Oracle.MySQLWorkbench',
    url: 'https://dev.mysql.com/downloads/workbench/',
    dirPrefix: { dir: 'C:\\Program Files\\MySQL', prefix: 'MySQL Workbench' },
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Advanced open-source relational database with a Windows installer.',
    category: 'database',
    winget: 'PostgreSQL.PostgreSQL.17',
    url: 'https://www.postgresql.org/download/windows/',
    cmd: 'psql',
    dirPrefix: { dir: 'C:\\Program Files\\PostgreSQL', prefix: '' },
  },
  {
    id: 'dbeaver',
    name: 'DBeaver Community',
    description: 'Free universal database GUI — works with MySQL, PostgreSQL, SQLite and more.',
    category: 'database',
    winget: 'dbeaver.dbeaver',
    url: 'https://dbeaver.io/download/',
    paths: ['C:\\Program Files\\DBeaver\\dbeaver.exe', '%LOCALAPPDATA%\\DBeaver\\dbeaver.exe'],
  },
  // containers
  {
    id: 'docker',
    name: 'Docker Desktop',
    description: 'Run MySQL, PostgreSQL, Redis and more in containers — used by the Database page.',
    category: 'container',
    winget: 'Docker.DockerDesktop',
    url: 'https://www.docker.com/products/docker-desktop/',
    cmd: 'docker',
  },
  // editors
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    description: 'The most popular code editor for web development.',
    category: 'editor',
    winget: 'Microsoft.VisualStudioCode',
    url: 'https://code.visualstudio.com/',
    cmd: 'code',
    paths: [
      '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\bin\\code.cmd',
      '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\bin\\code',
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    description: 'AI-powered code editor — VS Code fork with built-in AI assistance.',
    category: 'editor',
    winget: 'Anysphere.Cursor',
    url: 'https://cursor.com/',
    cmd: 'cursor',
    paths: [
      '%LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd',
      '%LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor',
    ],
  },
  {
    id: 'fnm',
    name: 'fnm',
    description: 'Fast Node version manager — switch Node versions per project.',
    category: 'runtime',
    winget: 'Schniz.fnm',
    url: 'https://github.com/Schniz/fnm',
    cmd: 'fnm',
  },
  {
    id: 'mkcert',
    name: 'mkcert',
    description: 'Create locally-trusted HTTPS certificates for development.',
    category: 'utility',
    winget: 'FiloSottile.mkcert',
    url: 'https://github.com/FiloSottile/mkcert',
    cmd: 'mkcert',
    paths: ['%LOCALAPPDATA%\\Microsoft\\WinGet\\Links\\mkcert.exe', '%ChocolateyInstall%\\bin\\mkcert.exe'],
  },
  {
    id: 'caddy',
    name: 'Caddy',
    description: 'Reverse proxy for local HTTPS domains (used by DevFlow Local HTTPS).',
    category: 'utility',
    winget: 'Caddy.Caddy',
    url: 'https://caddyserver.com/',
    cmd: 'caddy',
    paths: ['%LOCALAPPDATA%\\Microsoft\\WinGet\\Links\\caddy.exe', '%ChocolateyInstall%\\bin\\caddy.exe'],
  },
  // terminals
  {
    id: 'windows-terminal',
    name: 'Windows Terminal',
    description: 'Modern tabbed terminal for PowerShell, CMD and Git Bash.',
    category: 'terminal',
    winget: 'Microsoft.WindowsTerminal',
    url: 'https://aka.ms/terminal',
    paths: ['%LOCALAPPDATA%\\Microsoft\\WindowsApps\\wt.exe'],
  },
  {
    id: 'pwsh',
    name: 'PowerShell 7',
    description: 'Cross-platform PowerShell — faster and more capable than Windows PowerShell 5.1.',
    category: 'terminal',
    winget: 'Microsoft.PowerShell',
    url: 'https://github.com/PowerShell/PowerShell/releases',
    cmd: 'pwsh',
  },
  {
    id: 'oh-my-posh',
    name: 'Oh My Posh',
    description: 'Prompt theme engine that makes any shell nicer to work in.',
    category: 'terminal',
    winget: 'JanDeDobbeleer.OhMyPosh',
    url: 'https://ohmyposh.dev/',
    cmd: 'oh-my-posh',
  },
  // utilities
  {
    id: 'postman',
    name: 'Postman',
    description: 'Build, test and document HTTP APIs.',
    category: 'utility',
    winget: 'Postman.Postman',
    url: 'https://www.postman.com/downloads/',
    paths: ['%LOCALAPPDATA%\\Postman\\Postman.exe'],
  },
]

export function installCommandFor(t: ToolDef): string | undefined {
  if (t.installCmd) return t.installCmd
  if (t.winget) return `winget install --id ${t.winget} -e`
  return undefined
}

export function uninstallCommandFor(t: ToolDef): string | undefined {
  if (t.installCmd?.startsWith('npm install -g ')) {
    const pkg = t.installCmd.replace('npm install -g ', '').trim()
    return `npm uninstall -g ${pkg}`
  }
  if (t.winget) return `winget uninstall --id ${t.winget} -e`
  return undefined
}
