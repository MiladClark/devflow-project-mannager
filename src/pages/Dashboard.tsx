import { FolderKanban, Activity, Cpu, PlayCircle } from 'lucide-react'
import { useApp } from '../state/store'
import { StatCard } from '../components/StatCard'
import { ProjectTable } from '../components/ProjectTable'
import { formatBytes } from '../lib/format'

export function Dashboard() {
  const { projects, runtime, systemStats, search } = useApp()
  const running = projects.filter((p) => runtime[p.id]?.status === 'running').length
  const errored = projects.filter((p) => runtime[p.id]?.status === 'error').length
  const filtered = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects

  return (
    <div className="flex flex-col gap-5 p-6">
      <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>

      <div className="flex gap-4">
        <StatCard label="Active Projects" value={projects.length} icon={<FolderKanban size={16} />} />
        <StatCard
          label="Running Services"
          value={running}
          accent={running > 0 ? 'text-emerald-400' : 'text-white'}
          icon={<PlayCircle size={16} />}
        />
        <StatCard
          label="Health"
          value={errored === 0 ? 'OK' : `${errored} Error${errored > 1 ? 's' : ''}`}
          accent={errored === 0 ? 'text-emerald-400' : 'text-rose-400'}
          icon={<Activity size={16} />}
        />
        <StatCard
          label="Resources"
          value={
            systemStats ? (
              <span className="text-lg">
                CPU {systemStats.cpu.toFixed(0)}% <span className="mx-1 text-slate-600">·</span> MEM{' '}
                {formatBytes(systemStats.memUsed)}
              </span>
            ) : (
              '--'
            )
          }
          icon={<Cpu size={16} />}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Projects</p>
        <ProjectTable projects={filtered} />
      </div>
    </div>
  )
}
