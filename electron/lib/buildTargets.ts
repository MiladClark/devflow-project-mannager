import type { BuildTargetId } from '../../src/shared/types'
import type { RawBuildDetection } from './buildDetect'

const ELECTRON_ONLY_REASON = 'Windows Installer is available after Electron packaging is configured.'

export function resolveTargets(detection: RawBuildDetection): {
  supported: BuildTargetId[]
  disabled: { id: BuildTargetId; reason: string }[]
} {
  if (detection.isElectron) {
    return {
      supported: ['win-portable', 'win-nsis', 'win-zip'],
      disabled: [
        { id: 'static-build', reason: 'This is a desktop app — use Windows Portable, Installer, or ZIP instead.' },
        { id: 'zip-archive', reason: 'This is a desktop app — use Windows ZIP instead.' },
      ],
    }
  }

  if (detection.framework === 'unknown') {
    return {
      supported: [],
      disabled: [
        { id: 'static-build', reason: 'No recognized build script was found for this project.' },
        { id: 'zip-archive', reason: 'No recognized build script was found for this project.' },
        { id: 'win-portable', reason: ELECTRON_ONLY_REASON },
        { id: 'win-nsis', reason: ELECTRON_ONLY_REASON },
        { id: 'win-zip', reason: ELECTRON_ONLY_REASON },
      ],
    }
  }

  return {
    supported: ['static-build', 'zip-archive'],
    disabled: [
      { id: 'win-portable', reason: ELECTRON_ONLY_REASON },
      { id: 'win-nsis', reason: ELECTRON_ONLY_REASON },
      { id: 'win-zip', reason: ELECTRON_ONLY_REASON },
    ],
  }
}
