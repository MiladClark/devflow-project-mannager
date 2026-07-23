/**
 * electron-builder afterPack hook — embed the DevFlow brand icon into the
 * packaged Windows executable for EVERY target (dir, nsis) and EVERY build path
 * (local `npm run package` AND the CI `electron-builder --win nsis` job).
 *
 * Why this exists: electron-builder.yml sets `win.signAndEditExecutable: false`
 * to avoid the winCodeSign 7z extraction (which needs symlink privilege on
 * Windows dev/CI machines). That flag ALSO disables electron-builder's built-in
 * rcedit icon-embedding, so without this hook the NSIS-installed app ships with
 * the default Electron icon on the desktop shortcut and taskbar. Running rcedit
 * here — after the app is packed into <target>-unpacked but before the target
 * packager (nsis) wraps it — guarantees the shortcut/taskbar icon is correct.
 *
 * Idempotent: safe even though package-portable.mjs / make-release.mjs also run
 * rcedit on the portable exe afterwards.
 */
const path = require('node:path')
const fs = require('node:fs')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const productFilename = context.packager.appInfo.productFilename
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
  await rcedit(exePath, { icon: iconPath })
  console.log(`[afterPack] embedded brand icon into ${exePath}`)
}
