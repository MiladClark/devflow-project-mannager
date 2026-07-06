import { useEffect, useState } from 'react'
import { APP_VERSION } from '../version'
import logoBlue from '../assets/logo-blue.svg'

const MIN_SHOW_MS = 1600

export function Splash({ ready }: { ready: boolean }) {
  const [progress, setProgress] = useState(0)
  const [minElapsed, setMinElapsed] = useState(false)
  const [fading, setFading] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SHOW_MS)
    return () => clearTimeout(t)
  }, [])

  // creep towards 90% while loading, jump to 100% when the app is ready
  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, (90 - p) / 8) : p))
    }, 80)
    return () => clearInterval(t)
  }, [])

  const done = ready && minElapsed

  useEffect(() => {
    if (!done) return
    setProgress(100)
    const fade = setTimeout(() => setFading(true), 250)
    const kill = setTimeout(() => setGone(true), 800)
    return () => {
      clearTimeout(fade)
      clearTimeout(kill)
    }
  }, [done])

  if (gone) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg transition-opacity duration-500 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <img src={logoBlue} alt="DevFlow" className="h-28 w-28 drop-shadow-[0_0_40px_rgba(0,127,255,0.35)]" />
      <div>
        <h1 className="text-center text-xl font-bold text-white">
          DevFlow <span className="font-normal text-slate-400">Manager</span>
        </h1>
      </div>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">Version {APP_VERSION}</p>
    </div>
  )
}
