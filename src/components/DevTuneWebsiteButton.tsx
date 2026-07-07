import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { api } from '../lib/ipc'

export function DevTuneWebsiteButton() {
  const [url, setUrl] = useState('https://devtune-website.vercel.app')

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
      onClick={() => api.openExternal(url)}
      title="Open DevTune website"
      className="app-toolbar-btn"
    >
      <Globe size={16} />
    </button>
  )
}
