import { Loader2 } from 'lucide-react'
import { useApp } from '../state/store'
import { FramelessChrome } from './FramelessChrome'
import { OnboardingWizard } from './OnboardingWizard'

/** Dev-only: open app with #/?onboarding=1 to force the wizard once. */
function forceOnboardingFromHash(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    return q.get('onboarding') === '1'
  } catch {
    return false
  }
}

/**
 * First-run setup runs BEFORE LoginGate so Skip/Finish never lands in the app
 * without an explicit Sign in / Continue without signing in choice.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const loaded = useApp((s) => s.loaded)
  const settings = useApp((s) => s.settings)
  const force = forceOnboardingFromHash()

  if (!loaded || !settings) {
    return (
      <FramelessChrome>
        <div className="flex h-full items-center justify-center bg-bg">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </FramelessChrome>
    )
  }

  if (force || !settings.onboardingComplete) {
    return (
      <OnboardingWizard
        settings={settings}
        onDone={(updated) => {
          useApp.setState({ settings: updated })
          if (force && import.meta.env.DEV) {
            const [path] = window.location.hash.split('?')
            window.location.hash = path || '#/'
          }
        }}
      />
    )
  }

  return <>{children}</>
}
