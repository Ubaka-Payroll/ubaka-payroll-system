import React, { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Fingerprint,
  UserPlus,
  FileBarChart,
  Timer,
  Menu,
  X,
} from 'lucide-react'
import Logo from './Logo'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/workers', label: 'Workers', icon: Users },
  { to: '/attendance', label: 'Attendance', icon: Fingerprint },
  { to: '/after-hours', label: 'After 6:00', icon: Timer },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/register', label: 'Register', icon: UserPlus },
]

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: "Today's Attendance", subtitle: 'Live site overview & payroll approval' },
  '/workers': { title: 'Workers', subtitle: 'Manage workforce roster' },
  '/attendance': { title: 'Record Attendance', subtitle: 'Scan or search to clock events' },
  '/after-hours': {
    title: 'After 6:00',
    subtitle: 'Decide overtime vs delayed leaving',
  },
  '/reports': { title: 'Reports', subtitle: 'Daily, monthly, and payroll tables' },
  '/register': { title: 'Register Worker', subtitle: 'Enroll a new team member' },
}

function resolvePageMeta(pathname: string) {
  if (pathname.startsWith('/workers/') && pathname.includes('/timecard')) {
    return { title: 'Worker Time Card', subtitle: 'Detailed attendance and pay history' }
  }
  if (pathname.startsWith('/workers/') && pathname !== '/workers') {
    return { title: 'Worker Profile', subtitle: 'Details & attendance history' }
  }
  return PAGE_TITLES[pathname] ?? { title: 'Ubaka', subtitle: 'Attendance & Payroll' }
}

const AppLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const meta = resolvePageMeta(location.pathname)
  const rawEngineer = localStorage.getItem('ubaka_engineer_data')
  const engineer = rawEngineer ? JSON.parse(rawEngineer) : null
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

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
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
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
          <p className="sidebar__footer-label">Site operations</p>
          <p className="sidebar__footer-date">{today}</p>
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

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            {engineer && (
              <div style={{ textAlign: 'right', fontSize: '0.8125rem', lineHeight: 1.3 }}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{engineer.siteName || engineer.companyName}</div>
                <div style={{ color: 'var(--text-muted)' }}>{engineer.fullName}</div>
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem' }}
              onClick={() => {
                localStorage.removeItem('ubaka_engineer_token')
                localStorage.removeItem('ubaka_engineer_data')
                window.location.reload()
              }}
              title="Switch Site / Log Out"
            >
              Switch Site
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
