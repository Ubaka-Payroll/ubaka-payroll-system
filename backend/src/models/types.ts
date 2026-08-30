// Worker Types
export interface Worker {
  id: number
  nid: string
  worker_number: string
  classification: string
  full_name: string
  phone_number?: string
  email_address?: string
  hourly_rate: number
  fingerprint_data: Buffer
  is_active: boolean
  owner_id?: string
  site_name?: string
  created_at: Date
  updated_at: Date
}

export interface WorkerRegistrationData {
  nid: string
  worker_number: string
  classification: string
  full_name: string
  phone_number?: string
  email_address?: string
  hourly_rate: number
  fingerprint_data: Buffer
  owner_id?: string
  site_name?: string
}

// Attendance Types
export type EventType = 'ENTRY' | 'EXIT' | 'LEAVE_SITE' | 'RETURN_TO_SITE'

export interface AttendanceEvent {
  id: number
  worker_id: number
  event_type: EventType
  timestamp: Date
  is_manual_entry: boolean
  created_by?: string
  owner_id?: string
  site_name?: string
  created_at: Date
}

export interface HoursWorkedResult {
  hoursWorked: number | null
  status: 'COMPLETE' | 'IN_PROGRESS' | 'INCOMPLETE'
  entryTime?: Date
  exitTime?: Date
  breakDuration?: number
  breakCount?: number
  lateMinutes?: number
}

export interface DailyWage {
  id: number
  worker_id: number
  work_date: Date
  hours_worked: number
  hourly_rate: number
  wage_amount: number
  entry_time?: Date
  exit_time?: Date
  break_duration_ms: number
  created_at: Date
  updated_at: Date
}

export interface DailyAttendanceSummaryRow {
  worker_id: number
  worker_number: string
  full_name: string
  classification: string
  hourly_rate: number
  entry_time: Date | null
  exit_time: Date | null
  break_count: number
  hours_worked: number | null
  daily_wage: number | null
}

// Anomaly Types
export type AnomalyType = 'MISSING_EXIT' | 'MISSING_RETURN' | 'EXCESSIVE_BREAK' | 'DUPLICATE_ENTRY'

export interface AttendanceAnomaly {
  id: number
  worker_id: number
  anomaly_type: AnomalyType
  detection_date: Date
  description?: string
  is_resolved: boolean
  resolved_at?: Date
  resolved_by?: string
  created_at: Date
}

// Configuration Types
export interface SiteConfiguration {
  id: number
  site_name: string
  site_location?: string
  opening_time: string
  closing_time: string
  created_at: Date
  updated_at: Date
}

// Email Types
export type EmailType = 'DAILY_SUMMARY' | 'ANALYTICS' | 'EXCEPTION_ALERT'
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED'

export interface EmailQueue {
  id: number
  recipient_email: string
  subject: string
  html_body: string
  email_type: EmailType
  scheduled_at: Date
  sent_at?: Date
  status: EmailStatus
  error_message?: string
  retry_count: number
  created_at: Date
}

// Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
