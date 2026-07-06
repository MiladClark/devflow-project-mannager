import type { Framework } from '../shared/types'

const config: Record<Framework, { label: string; bg: string; fg: string }> = {
  next: { label: 'N', bg: 'bg-white', fg: 'text-black' },
  vite: { label: 'V', bg: 'bg-gradient-to-br from-violet-500 to-amber-400', fg: 'text-white' },
  react: { label: 'R', bg: 'bg-cyan-900', fg: 'text-cyan-300' },
  vue: { label: 'V', bg: 'bg-emerald-900', fg: 'text-emerald-300' },
  tailwind: { label: 'T', bg: 'bg-sky-900', fg: 'text-sky-300' },
  node: { label: 'N', bg: 'bg-lime-900', fg: 'text-lime-300' },
  electron: { label: 'e', bg: 'bg-[#47848f]/30', fg: 'text-[#9feaf9]' },
  unknown: { label: '?', bg: 'bg-slate-700', fg: 'text-slate-300' },
}

export function FrameworkIcon({ framework, size = 9 }: { framework: Framework; size?: number }) {
  const c = config[framework]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${c.bg} ${c.fg}`}
      style={{ width: size * 4, height: size * 4, fontSize: size * 1.8 }}
    >
      {c.label}
    </span>
  )
}
