import axios from 'axios'
import type {
  AuthUser,
  OwnerRequest,
  Subscription,
  FieldEngineer,
  ActivationKey,
  DailyReport,
  DailyReportMeta,
} from '../types'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ubaka_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
    email,
    password,
  })
  return data
}

export async function requestAccess(payload: {
  fullName: string
  email: string
  companyName: string
  phone: string
  message?: string
}) {
  const { data } = await api.post('/auth/request-access', payload)
  return data
}

export async function fetchMe() {
  const { data } = await api.get<AuthUser>('/auth/me')
  return data
}

export async function fetchAdminOverview() {
  const { data } = await api.get('/admin/overview')
  return data as {
    pendingRequests: number
    owners: number
    activeSubs: number
    engineers: number
    keysAvailable: number
    recentRequests: OwnerRequest[]
    subscriptions: Subscription[]
  }
}

export async function fetchOwnerRequests() {
  const { data } = await api.get<OwnerRequest[]>('/admin/requests')
  return data
}

export async function approveRequest(id: string, seats = 3) {
  const { data } = await api.post(`/admin/requests/${id}/approve`, { seats })
  return data as { message: string; temporaryPassword: string; activationKeys: string[] }
}

export async function rejectRequest(id: string, reason?: string) {
  const { data } = await api.post(`/admin/requests/${id}/reject`, { reason })
  return data
}

export async function updateOwnerRequest(
  id: string,
  payload: {
    fullName: string
    email: string
    companyName: string
    phone: string
    message?: string
  },
) {
  const { data } = await api.patch(`/admin/requests/${id}`, payload)
  return data
}

export async function deleteOwnerRequest(id: string) {
  const { data } = await api.delete(`/admin/requests/${id}`)
  return data
}

export async function deactivateOwnerRequest(id: string) {
  const { data } = await api.post(`/admin/requests/${id}/deactivate`)
  return data
}

export async function fetchSubscriptions() {
  const { data } = await api.get<Subscription[]>('/admin/subscriptions')
  return data
}

export async function issueKeys(ownerId: string, count = 1) {
  const { data } = await api.post<{ keys: string[] }>(`/admin/subscriptions/${ownerId}/keys`, {
    count,
  })
  return data
}

export async function updateSubscriptionStatus(id: string, status: string) {
  const { data } = await api.patch(`/admin/subscriptions/${id}/status`, { status })
  return data
}

export async function fetchOwnerOverview() {
  const { data } = await api.get('/owner/overview')
  return data as {
    subscription: Subscription | null
    engineerCount: number
    activeEngineers: number
    keysAvailable: number
    keysUsed: number
    latestReport: DailyReport | null
    recentReports: DailyReportMeta[]
  }
}

export async function fetchEngineers() {
  const { data } = await api.get<FieldEngineer[]>('/owner/engineers')
  return data
}

export async function createEngineer(payload: {
  fullName: string
  email: string
  phone?: string
  siteName: string
}) {
  const { data } = await api.post<FieldEngineer & { activationKey: string; message: string }>(
    '/owner/engineers',
    payload,
  )
  return data
}

export async function fetchOwnerKeys() {
  const { data } = await api.get<ActivationKey[]>('/owner/keys')
  return data
}

export async function fetchReports() {
  const { data } = await api.get<DailyReportMeta[]>('/owner/reports')
  return data
}

export async function fetchReport(id: string) {
  const { data } = await api.get<DailyReport>(`/owner/reports/${id}`)
  return data
}

export default api
