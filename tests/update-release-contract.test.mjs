import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('runtime uses the supported NSIS electron-updater path', () => {
  const pkg = JSON.parse(read('package.json'))
  const updater = read('electron/lib/updater.ts')
  const updateRoot = read('src/components/UpdateRoot.tsx')

  assert.match(pkg.dependencies['electron-updater'], /^\^6\./)
  assert.match(updater, /import \{\s*autoUpdater,/)
  assert.doesNotMatch(updater, /import electronUpdater/)
  assert.match(updater, /autoUpdater\.downloadUpdate\(/)
  assert.match(updater, /autoUpdater\.quitAndInstall\(true, true\)/)
  assert.match(updater, /portable-build/)
  assert.doesNotMatch(updater, /robocopy|Expand-Archive|powershell\.exe/i)
  assert.match(updateRoot, /res\.error !== 'paused'/)
})

test('NSIS is configured as a per-user one-click auto-update target', () => {
  const config = read('electron-builder.yml')

  assert.match(config, /nsis:[\s\S]*oneClick:\s*true/)
  assert.match(config, /nsis:[\s\S]*perMachine:\s*false/)
  assert.match(config, /nsis:[\s\S]*differentialPackage:\s*true/)
  assert.match(config, /publish:[\s\S]*provider:\s*github/)
})

test('release workflow publishes and validates the entire updater bundle', () => {
  const workflow = read('.github/workflows/release.yml')

  assert.match(workflow, /verify-update-artifacts\.mjs/)
  assert.match(workflow, /release\/latest\*\.yml/)
  assert.match(workflow, /release\/\*\.blockmap/)
  assert.doesNotMatch(workflow, /release\/\*\.yml/)
  assert.match(workflow, /gh release edit[\s\S]*--draft=false/)
})
