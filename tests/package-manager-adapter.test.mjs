import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addPackagesCommand,
  auditCommand,
  createPackageCommand,
  installDependenciesCommand,
  isPackageManager,
  nextScaffoldCommand,
  normalizeScaffoldVersion,
  renderCommand,
  runScriptCommand,
  viteScaffoldCommand,
} from '../electron/lib/packageManagerAdapter.ts'
import { normalizeToolInstallOptions } from '../src/shared/tools.ts'

test('validates package-manager ids at the IPC boundary', () => {
  for (const pm of ['npm', 'pnpm', 'yarn', 'bun']) assert.equal(isPackageManager(pm), true)
  for (const value of ['', 'npx', 'pnpm && whoami', null, 42]) assert.equal(isPackageManager(value), false)
})

test('generates install, add, and run commands for every manager', () => {
  assert.equal(renderCommand(installDependenciesCommand('npm')), 'npm install')
  assert.equal(renderCommand(installDependenciesCommand('pnpm')), 'pnpm install')
  assert.equal(renderCommand(addPackagesCommand('yarn', ['vitest', 'jsdom'], { dev: true })), 'yarn add --dev vitest jsdom')
  assert.equal(renderCommand(addPackagesCommand('bun', ['zustand'])), 'bun add zustand')
  assert.equal(renderCommand(runScriptCommand('yarn', 'dev')), 'yarn dev')
  assert.equal(renderCommand(runScriptCommand('pnpm', 'build')), 'pnpm run build')
})

test('uses the selected package manager to execute create packages', () => {
  assert.equal(
    renderCommand(createPackageCommand('npm', 'create-vite', 'latest', ['demo'])),
    'npx --yes create-vite@latest demo',
  )
  assert.equal(
    renderCommand(createPackageCommand('pnpm', 'create-vite', 'latest', ['demo'])),
    'pnpm dlx create-vite@latest demo',
  )
  assert.equal(
    renderCommand(createPackageCommand('yarn', 'create-vite', 'latest', ['demo'])),
    'yarn create vite@latest demo',
  )
  assert.equal(
    renderCommand(createPackageCommand('bun', 'create-vite', 'latest', ['demo'])),
    'bunx create-vite@latest demo',
  )
})

test('passes manager-specific flags to create-next-app', () => {
  const cmd = renderCommand(nextScaffoldCommand('pnpm', 'demo', ['--typescript', '--app'], '15'))
  assert.match(cmd, /^pnpm dlx create-next-app@15 demo/)
  assert.match(cmd, /--use-pnpm/)
  assert.match(cmd, /--yes$/)
})

test('accepts safe versions and dist-tags but rejects package or shell injection', () => {
  for (const value of [undefined, '', 'latest', '15', '6.2.0', 'canary', 'v4.1.0-rc.2']) {
    assert.ok(normalizeScaffoldVersion(value))
  }
  for (const value of ['@scope/pkg', '^15', 'latest && whoami', '../local', 'https://example.com/pkg.tgz']) {
    assert.equal(normalizeScaffoldVersion(value), null)
  }
})

test('creates non-interactive Vite projects with the selected manager', () => {
  assert.equal(
    renderCommand(viteScaffoldCommand('bun', 'demo', 'react-ts')),
    'bunx create-vite@latest demo --template react-ts --no-interactive',
  )
})

test('selects the correct audit command for modern Yarn and Bun', () => {
  assert.deepEqual(auditCommand('yarn', 4), { executable: 'yarn', args: ['npm', 'audit', '--json'] })
  assert.deepEqual(auditCommand('bun'), { executable: 'bun', args: ['audit', '--json'] })
})

test('validates advanced tool install controls before command construction', () => {
  assert.deepEqual(normalizeToolInstallOptions({ version: '22.12.0', scope: 'user', force: true }), {
    version: '22.12.0',
    scope: 'user',
    force: true,
  })
  assert.deepEqual(normalizeToolInstallOptions(undefined), {})
  assert.equal(normalizeToolInstallOptions({ version: 'latest && whoami' }), null)
  assert.equal(normalizeToolInstallOptions({ scope: 'admin' }), null)
  assert.equal(normalizeToolInstallOptions({ force: 'yes' }), null)
})
