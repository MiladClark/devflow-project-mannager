import { useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useApp } from './state/store'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { RightRail } from './components/RightRail'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Logs } from './pages/Logs'
import { Database } from './pages/Database'
import { Connections } from './pages/Connections'
import { AppsTools } from './pages/AppsTools'
import { Settings } from './pages/Settings'
import { NewProject } from './pages/NewProject'
import { Splash } from './components/Splash'

function Layout() {
  const location = useLocation()
  const showRail = location.pathname === '/' || location.pathname === '/projects'

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/database" element={<Database />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/tools" element={<AppsTools />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/new" element={<NewProject />} />
          </Routes>
        </main>
        {showRail && <RightRail />}
      </div>
    </div>
  )
}

export default function App() {
  const init = useApp((s) => s.init)
  const loaded = useApp((s) => s.loaded)
  useEffect(() => {
    init()
  }, [init])

  return (
    <HashRouter>
      <Splash ready={loaded} />
      <Layout />
    </HashRouter>
  )
}
