/**
 * electron-builder afterPack hook — stamp the packaged Windows executable with
 * the DevFlow brand icon AND version-info metadata, for EVERY target (dir, nsis)
 * and EVERY build path (local `npm run package` AND the CI
 * `electron-builder --win nsis` job).
 *
 * Why this exists: electron-builder.yml sets `win.signAndEditExecutable: false`
 * to avoid the winCodeSign 7z extraction (which needs symlink privilege on
 * Windows dev/CI machines). That flag ALSO disables electron-builder's built-in
 * rcedit step, so without this hook the shipped exe keeps Electron's defaults:
 *   - the default Electron icon on the desktop shortcut and taskbar, and
 *   - FileDescription/ProductName = "Electron", which is what Windows Task
 *     Manager shows as the process name (all child processes are the same exe),
 *     so DevFlow showed up as "Electron".
 * Running rcedit here — after the app is packed into <target>-unpacked but
 * before the target packager (nsis) wraps it — fixes both. The standalone
 * `rcedit` npm package is used directly, so no winCodeSign download is needed.
 *
 * Idempotent: safe even though package-portable.mjs / make-release.mjs also run
 * rcedit on the portable exe afterwards.
 */
const path = require('node:path')
const fs = require('node:fs')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const appInfo = context.packager.appInfo
  const productName = appInfo.productName // "DevFlow Manager"
  const productFilename = appInfo.productFilename // "DevFlow Manager" (fs-safe)
  const version = appInfo.version
  const companyName = appInfo.companyName || 'DevTune'
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`)
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico')

  if (!fs.existsSync(exePath)) {
    throw new Error(`[afterPack] executable not found: ${exePath}`)
  }
  if (!fs.existsSync(iconPath)) {
    throw new Error(`[afterPack] brand icon not found: ${iconPath}`)
  }

  // rcedit is ESM-only (package "type": "module"); load it from this CJS hook
  // via dynamic import so the hook works regardless of how electron-builder
  // resolves the module.
  const { rcedit } = await import('rcedit')
  await rcedit(exePath, {
    icon: iconPath,
    'file-version': version,
    'product-version': version,
    'version-string': {
      // FileDescription is what Task Manager displays as the process name.
      FileDescription: productName,
      ProductName: productName,
      CompanyName: companyName,
      LegalCopyright: `Copyright © ${new Date().getFullYear()} ${companyName}`,
      OriginalFilename: `${productFilename}.exe`,
      InternalName: productFilename,
    },
  })
  console.log(`[afterPack] stamped icon + version metadata (${productName} ${version}) into ${exePath}`)
}
