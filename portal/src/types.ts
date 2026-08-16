export type Role = 'SYSTEM_ADMIN' | 'SITE_OWNER' | 'FIELD_ENGINEER'

export interface AuthUser {
  id: string
  email: string
  role: Role
  fullName: string
  companyName?: string
  phone?: string
}

export interface OwnerRequest {
  id: string
  fullName: string
  email: string
  companyName: string
  phone: string
  message?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEACTIVATED'
  rejectionReason?: string
  createdAt: string
  reviewedAt?: string
}

export interface Subscription {
  id: string
  ownerId: string
  status: 'NONE' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
  planName: string
  seats: number
  startsAt: string | null
  endsAt: string | null
  ownerName?: string
  ownerEmail?: string
  companyName?: string
  keysIssued?: number
  keysUsed?: number
}

export interface FieldEngineer {
  id: string
  ownerId: string
  fullName: string
  email: string
  phone?: string
  siteName: string
  status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'DISABLED'
  activationKey?: string | null
  createdAt: string
  activatedAt?: string
}

export interface ActivationKey {
  id: string
  key: string
  ownerId: string
  engineerId?: string
  siteName?: string
  status: 'AVAILABLE' | 'ASSIGNED' | 'USED' | 'REVOKED'
  createdAt: string
  usedAt?: string
  engineerName?: string | null
  engineerEmail?: string | null
}

export interface DailyReportMeta {
  id: string
  ownerId: string
  engineerId: string
  siteName: string
  reportDate: string
  workersPresent: number
  completedShifts: number
  activeOnSite: number
  totalWages: number
  receivedAt: string
}

export interface DailyReportRow {
  worker_id: number
  worker_number: string
  full_name: string
  classification: string
  entry_time: string | null
  exit_time: string | null
  break_count: number
  break_minutes: number | null
  hours_worked: number | null
  daily_wage: number | null
}

export interface DailyReport extends DailyReportMeta {
  rows: DailyReportRow[]
}
