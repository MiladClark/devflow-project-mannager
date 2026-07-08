import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { api } from '../lib/ipc'
import { useGuestLock } from '../lib/guest'

export function DevTuneWebsiteButton() {
  const { guardGuest } = useGuestLock()
  const [url, setUrl] = useState('https://devtune.app')

  useEffect(() => {
    let cancelled = false
    api.getLicenseState().then((s) => {
      if (!cancelled && s.serverUrl) setUrl(s.serverUrl)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => {
        if (guardGuest()) return
        void api.openExternal(url)
      }}
      title="Open DevTune website"
      className="app-toolbar-btn"
    >
      <Globe size={16} />
    </button>
  )
}
