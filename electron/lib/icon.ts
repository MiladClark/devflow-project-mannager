import { app, nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/** Resolve absolute path to brand icon shipped with the app (ico preferred, png fallback). */
export function resolveBrandIconPath(): string | null {
  const candidates: string[] = []

  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'icon.ico'),
      path.join(process.resourcesPath, 'icon.png'),
      path.join(path.dirname(process.execPath), 'resources', 'icon.ico'),
      path.join(path.dirname(process.execPath), 'resources', 'icon.png'),
    )
  } else {
    candidates.push(
      path.join(app.getAppPath(), 'build', 'icon.ico'),
      path.join(app.getAppPath(), 'build', 'icon.png'),
      path.join(__dirname, '../../build/icon.ico'),
      path.join(__dirname, '../../build/icon.png'),
    )
  }

  for (const candidate of candidates) {
    try {
      const abs = path.resolve(candidate)
      if (fs.existsSync(abs)) return abs
    } catch {
      /* ignore invalid paths */
    }
  }
  return null
}

export function loadBrandIcon(): Electron.NativeImage | null {
  const iconPath = resolveBrandIconPath()
  if (!iconPath) return null
  const image = nativeImage.createFromPath(iconPath)
  return image.isEmpty() ? null : image
}
