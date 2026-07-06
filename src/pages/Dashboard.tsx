import { FolderKanban, Activity, Cpu, PlayCircle } from 'lucide-react'
import { useApp } from '../state/store'
import { StatCard } from '../components/StatCard'
import { ProjectTable } from '../components/ProjectTable'
import { ProjectBulkToolbar } from '../components/ProjectBulkToolbar'
import { ContentReveal, Skeleton, SkeletonProjectTable, SkeletonStatCards } from '../components/Skeleton'
import { formatBytes } from '../lib/format'

export function Dashboard() {
  const { projects, runtime, systemStats, search, loaded } = useApp()
  const running = projects.filter((p) => runtime[p.id]?.status === 'running').length
  const errored = projects.filter((p) => runtime[p.id]?.status === 'error').length
  const filtered = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects

  return (
    <div className="flex flex-col gap-5 p-6">
      <ContentReveal
        loading={!loaded}
        skeleton={
          <div className="flex flex-col gap-5">
            <Skeleton className="h-8 w-64" />
            <SkeletonStatCards />
            <div>
              <Skeleton className="mb-2 h-3 w-20" />
              <SkeletonProjectTable />
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
        <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>

        <div className="stagger flex gap-4">
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
              <div className="mt-0.5 flex flex-col gap-0.5 text-base leading-tight font-bold">
                <span className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                  <span className="text-xs font-medium text-slate-500">CPU</span>
                  {systemStats.cpu.toFixed(0)}%
                </span>
                <span className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                  <span className="text-xs font-medium text-slate-500">MEM</span>
                  {formatBytes(systemStats.memUsed)}
                </span>
              </div>
            ) : (
              '--'
            )
          }
          icon={<Cpu size={16} />}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Projects</p>
          <ProjectBulkToolbar projects={filtered} />
        </div>
        <ProjectTable projects={filtered} />
      </div>
      </div>
      </ContentReveal>
    </div>
  )
}
