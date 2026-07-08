import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_GROUPS } from '../lib/nav'
import { useGuestLock } from '../lib/guest'
import { getSidebarPinned, setSidebarPinned } from '../lib/sidebar'
import { Switch } from './Switch'

export function Sidebar() {
  const { guardGuest } = useGuestLock()
  const [pinned, setPinned] = useState(getSidebarPinned)

  useEffect(() => {
    setSidebarPinned(pinned)
  }, [pinned])

  return (
    <aside className={`app-sidebar group/sidebar${pinned ? ' app-sidebar-pinned' : ''}`}>
      <nav className="app-sidebar-nav" aria-label="Main navigation">
        {NAV_GROUPS.map((group, gi) => (
          <section key={group.title} className="app-sidebar-section">
            {gi > 0 && <hr className="app-sidebar-divider" />}
            <p className="app-sidebar-group-title">{group.title}</p>
            <ul className="app-sidebar-links">
              {group.pages.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    title={label}
                    onClick={(e) => {
                      if (to !== '/' && guardGuest(e)) return
                    }}
                    className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                  >
                    <Icon size={18} className="shrink-0" strokeWidth={1.75} />
                    <span className="app-sidebar-label">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <span className="app-sidebar-label app-sidebar-pin-label">Pin sidebar</span>
        <Switch
          checked={pinned}
          onChange={setPinned}
          size="sm"
          className="app-sidebar-pin-switch shrink-0"
        />
      </div>
    </aside>
  )
}
