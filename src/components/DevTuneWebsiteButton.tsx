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
      className="press flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-slate-400 hover:border-accent/50 hover:text-slate-200"
    >
      <Globe size={16} />
    </button>
  )
}
