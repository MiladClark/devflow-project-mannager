/**
 * Remove build artifacts only — never touches source, node_modules, or config.
 */
import { rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

for (const dir of ['dist', 'dist-electron', 'release', 'devflow', '.verify-tmp']) {
  const target = path.join(root, dir)
  if (existsSync(target)) {
    try {
      rmSync(target, { recursive: true, force: true })
      console.log(`Removed ${dir}/`)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : ''
      if (code === 'EPERM' || code === 'EBUSY') {
        console.warn(`Skipped ${dir}/ (in use — close DevFlow Manager and retry)`)
      } else {
        throw err
      }
    }
  }
}

console.log('Build artifacts cleaned.')
