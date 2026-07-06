import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  icon,
  accent = 'text-white',
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  accent?: string
}) {
  return (
    <div className="lift flex-1 rounded-xl border border-edge bg-panel p-4 hover:border-slate-600">
      <div className="flex items-center justify-between text-sm text-slate-400">
        {label}
        {icon}
      </div>
      <div className={`mt-2 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  )
}
