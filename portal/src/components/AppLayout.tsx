import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../hooks/useAuth'

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  end?: boolean
}

type AppLayoutProps = {
  navItems: NavItem[]
  titles: Record<string, { title: string; subtitle: string }>
  homePath: string
}

function resolveMeta(
  pathname: string,
  titles: Record<string, { title: string; subtitle: string }>,
  fallback: { title: string; subtitle: string },
) {
  if (titles[pathname]) return titles[pathname]
  const match = Object.keys(titles)
    .filter((k) => k !== '/' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  return match ? titles[match] : fallback
}

const AppLayout: React.FC<AppLayoutProps> = ({ navItems, titles, homePath }) => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const meta = resolveMeta(location.pathname, titles, {
    title: 'Ubaka',
    subtitle: 'Management Portal',
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark">
            <Logo className="sidebar__logo" />
            <span className="sidebar__wordmark">UBAKA</span>
          </div>
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <p className="sidebar__user-name">{user?.fullName}</p>
            <p className="sidebar__user-role">{user?.role.replace(/_/g, ' ')}</p>
            <button type="button" className="btn sidebar__logout" onClick={handleLogout}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-content">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="topbar__titles">
            <h1 className="topbar__title">{meta.title}</h1>
            <p className="topbar__subtitle">{meta.subtitle}</p>
          </div>
          <div className="topbar__actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(homePath)}>
              Home
            </button>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
