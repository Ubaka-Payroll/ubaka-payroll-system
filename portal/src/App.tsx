import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './hooks/useAuth'
import { AdminShell, OwnerShell, RequireAuth, HomeRedirect } from './components/RoleGates'
import Login from './views/Login'
import RequestAccess from './views/RequestAccess'
import AdminDashboard from './views/admin/AdminDashboard'
import OwnerRequests from './views/admin/OwnerRequests'
import Subscriptions from './views/admin/Subscriptions'
import OwnerDashboard from './views/owner/OwnerDashboard'
import Engineers from './views/owner/Engineers'
import Keys from './views/owner/Keys'
import Reports from './views/owner/Reports'
import ReportDetail from './views/owner/ReportDetail'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/request-access" element={<RequestAccess />} />
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<RequireAuth roles={['SYSTEM_ADMIN']} />}>
              <Route element={<AdminShell />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/requests" element={<OwnerRequests />} />
                <Route path="/admin/subscriptions" element={<Subscriptions />} />
              </Route>
            </Route>

            <Route element={<RequireAuth roles={['SITE_OWNER']} />}>
              <Route element={<OwnerShell />}>
                <Route path="/owner" element={<OwnerDashboard />} />
                <Route path="/owner/engineers" element={<Engineers />} />
                <Route path="/owner/keys" element={<Keys />} />
                <Route path="/owner/reports" element={<Reports />} />
                <Route path="/owner/reports/:id" element={<ReportDetail />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
