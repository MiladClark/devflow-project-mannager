import fs from 'node:fs'
import path from 'node:path'
import type { BuildManifest, BuildOutputFile, LogLine } from '../../src/shared/types'

export interface ManifestInput {
  exportDir: string
  appName: string
  packageName: string
  version: string
  framework: string
  buildCommand: string
  installerType: string[]
  outputFiles: BuildOutputFile[]
  logs: LogLine[]
}

/** Writes build-manifest.json, build-log.txt, checksums.txt into the export directory. */
export function writeManifestFiles(input: ManifestInput): { manifestPath: string; logPath: string; checksumsPath: string } {
  fs.mkdirSync(input.exportDir, { recursive: true })

  const checksums: Record<string, string> = {}
  for (const f of input.outputFiles) checksums[f.name] = f.sha256

  const manifest: BuildManifest = {
    appName: input.appName,
    packageName: input.packageName,
    version: input.version,
    framework: input.framework,
    platform: process.platform,
    architecture: process.arch,
    buildDate: new Date().toISOString(),
    buildCommand: input.buildCommand,
    installerType: input.installerType,
    outputFiles: input.outputFiles.map((f) => f.name),
    outputDirectory: input.exportDir,
    checksums: { sha256: checksums },
  }

  const manifestPath = path.join(input.exportDir, 'build-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  const logPath = path.join(input.exportDir, 'build-log.txt')
  const logText = input.logs
    .map((l) => `[${new Date(l.ts).toISOString()}] [${l.stream}] ${l.text}`)
    .join('\n')
  fs.writeFileSync(logPath, logText, 'utf-8')

  const checksumsPath = path.join(input.exportDir, 'checksums.txt')
  const checksumsText = input.outputFiles.map((f) => `${f.sha256}  ${f.name}`).join('\n')
  fs.writeFileSync(checksumsPath, checksumsText, 'utf-8')

  return { manifestPath, logPath, checksumsPath }
}
