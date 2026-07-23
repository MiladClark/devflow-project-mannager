import { useEffect, useState, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './state/store'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { RightRail } from './components/RightRail'
// Pages are code-split so the initial bundle stays small and the app paints
// fast — heavy deps (recharts charts, the xterm terminal) only load with the
// route that needs them. Named exports are adapted to the default export
// React.lazy expects.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then((m) => ({ default: m.ProjectDetail })))
const Logs = lazy(() => import('./pages/Logs').then((m) => ({ default: m.Logs })))
const Database = lazy(() => import('./pages/Database').then((m) => ({ default: m.Database })))
const Connections = lazy(() => import('./pages/Connections').then((m) => ({ default: m.Connections })))
const AppsTools = lazy(() => import('./pages/AppsTools').then((m) => ({ default: m.AppsTools })))
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const NewProject = lazy(() => import('./pages/NewProject').then((m) => ({ default: m.NewProject })))
const BuildSetup = lazy(() => import('./pages/BuildSetup').then((m) => ({ default: m.BuildSetup })))
const SystemHealth = lazy(() => import('./pages/SystemHealth').then((m) => ({ default: m.SystemHealth })))
import { LoginGate } from './components/LoginGate'
import { OnboardingGate } from './components/OnboardingGate'
import { Splash } from './components/Splash'
import { UpdateRoot } from './components/UpdateRoot'
import { CommandPalette } from './components/CommandPalette'
import { ShortcutHelp } from './components/ShortcutHelp'
import { Toaster } from './components/Toaster'
import { GuestBanner } from './components/GuestBanner'
import { ConfirmDialog } from './components/ConfirmDialog'
import { PAGES } from './lib/nav'
import { api } from './lib/ipc'
import { useGuestLock } from './lib/guest'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isGuest, returnToSignIn, guardGuest } = useGuestLock()
  const showRail = location.pathname === '/' || location.pathname === '/projects'
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (isGuest && location.pathname !== '/') {
      void returnToSignIn()
    }
  }, [isGuest, location.pathname, returnToSignIn])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const inEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          !!target.closest('.xterm'))

      if ((e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'k') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault()
        if (guardGuest()) return
        setHelpOpen(false)
        setPaletteOpen((o) => !o)
        return
      }
      if (inEditable) return
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        if (guardGuest()) return
        setPaletteOpen(false)
        setHelpOpen((o) => !o)
        return
      }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        if (guardGuest()) return
        const page = PAGES[Number(e.key) - 1]
        if (page) {
          e.preventDefault()
          navigate(page.to)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, guardGuest])

  // navigation pushed from the main process (tray menu, notification clicks)
  useEffect(() => {
    const off = api.onNavigate((route) => {
      if (isGuest && route !== '/') {
        void returnToSignIn()
        return
      }
      navigate(route)
    })
    return off
  }, [navigate, isGuest, returnToSignIn])

  return (
    <div className="flex h-full flex-col">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <GuestBanner />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div key={location.pathname} className="animate-page-in h-full">
            <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/system" element={<SystemHealth />} />
              <Route path="/database" element={<Database />} />
              <Route path="/connections" element={<Connections />} />
              <Route path="/tools" element={<AppsTools />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/new" element={<NewProject />} />
              <Route path="/build" element={<BuildSetup />} />
              <Route path="/projects/:projectId/build" element={<BuildSetup />} />
            </Routes>
            </Suspense>
          </div>
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
      <Toaster />
      <ConfirmDialog />
      <UpdateRoot />
      <OnboardingGate>
        <LoginGate>
          <Layout />
        </LoginGate>
      </OnboardingGate>
    </HashRouter>
  )
}
