import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { ToastProvider } from './components/Toast'
import Dashboard from './views/Dashboard'
import WorkerList from './views/WorkerList'
import WorkerRegistration from './views/WorkerRegistration'
import WorkerDetails from './views/WorkerDetails'
import AttendanceRecording from './views/AttendanceRecording'
import WorkerTimeCard from './views/WorkerTimeCard'
import Reports from './views/Reports'
import AfterHours from './views/AfterHours'
import EngineerLogin from './views/EngineerLogin'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('ubaka_engineer_token')
  })

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('ubaka_engineer_token'))
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        {!isAuthenticated ? (
          <EngineerLogin onLoginSuccess={() => setIsAuthenticated(true)} />
        ) : (
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workers" element={<WorkerList />} />
              <Route path="/workers/:id" element={<WorkerDetails />} />
              <Route path="/workers/:id/timecard" element={<WorkerTimeCard />} />
              <Route path="/register" element={<WorkerRegistration />} />
              <Route path="/attendance" element={<AttendanceRecording />} />
              <Route path="/after-hours" element={<AfterHours />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
          </Routes>
        )}
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
