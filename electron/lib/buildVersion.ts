import semver from 'semver'
import type { BuildConfig } from '../../src/shared/types'

/** Resolves the effective build version from the config's versionSource. */
export function resolveVersion(config: Pick<BuildConfig, 'version' | 'versionSource' | 'incrementType'>, packageJsonVersion: string): string {
  if (config.versionSource === 'manual') return config.version
  if (config.versionSource === 'package') return packageJsonVersion
  // increment
  const base = packageJsonVersion || '0.1.0'
  const type = config.incrementType ?? 'patch'
  const bumped = type === 'prerelease' ? semver.inc(base, 'prerelease', 'beta') : semver.inc(base, type)
  return bumped ?? base
}

export function isValidVersion(v: string): boolean {
  return !!semver.valid(v) || /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v.trim())
}

/** Substitutes {appName}/{version}/{platform}/{arch} in an export naming template. */
export function applyNamingTemplate(template: string, vars: { appName: string; version: string; platform: string; arch: string }): string {
  return template
    .replace(/\{appName\}/g, vars.appName)
    .replace(/\{version\}/g, vars.version)
    .replace(/\{platform\}/g, vars.platform)
    .replace(/\{arch\}/g, vars.arch)
}

export const DEFAULT_NAMING_TEMPLATE = '{appName}-{version}-{platform}-{arch}'
