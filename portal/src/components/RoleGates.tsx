import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  CreditCard,
  Users,
  KeyRound,
  FileText,
} from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../hooks/useAuth'
import { LoadingState } from '../components/ui'

export const RequireAuth: React.FC<{ roles?: Array<'SYSTEM_ADMIN' | 'SITE_OWNER'> }> = ({
  roles,
}) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState label="Checking session…" />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role as 'SYSTEM_ADMIN' | 'SITE_OWNER')) {
    if (user.role === 'SYSTEM_ADMIN') return <Navigate to="/admin" replace />
    if (user.role === 'SITE_OWNER') return <Navigate to="/owner" replace />
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export const AdminShell: React.FC = () => (
  <AppLayout
    homePath="/admin"
    navItems={[
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/requests', label: 'Owner requests', icon: ClipboardList },
      { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
    ]}
    titles={{
      '/admin': { title: 'Admin overview', subtitle: 'Requests, subscriptions & seats' },
      '/admin/requests': {
        title: 'Owner requests',
        subtitle: 'Approve companies that want to use Ubaka',
      },
      '/admin/subscriptions': {
        title: 'Subscriptions',
        subtitle: 'Manage plans, seats and activation keys',
      },
    }}
  />
)

export const OwnerShell: React.FC = () => (
  <AppLayout
    homePath="/owner"
    navItems={[
      { to: '/owner', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/owner/engineers', label: 'Engineers', icon: Users },
      { to: '/owner/keys', label: 'Activation keys', icon: KeyRound },
      { to: '/owner/reports', label: 'Daily reports', icon: FileText },
    ]}
    titles={{
      '/owner': { title: 'Site overview', subtitle: 'Engineers, keys and latest attendance' },
      '/owner/engineers': {
        title: 'Field engineers',
        subtitle: 'Create engineers and share activation keys',
      },
      '/owner/keys': {
        title: 'Activation keys',
        subtitle: 'Keys that unlock the desktop app per site',
      },
      '/owner/reports': {
        title: 'Daily reports',
        subtitle: 'Attendance summaries from the desktop app',
      },
    }}
  />
)

export const HomeRedirect: React.FC = () => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'SYSTEM_ADMIN') return <Navigate to="/admin" replace />
  if (user.role === 'SITE_OWNER') return <Navigate to="/owner" replace />
  return <Navigate to="/login" replace />
}
