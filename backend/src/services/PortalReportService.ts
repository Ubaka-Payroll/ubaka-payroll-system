import { AttendanceService } from './AttendanceService'
import { lateMinutesFromWorkStart } from '../constants/workDay'
import { pool, iso, dateOnly } from './portalMappers'

export type DailyReportRow = {
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
  late_minutes: number
}

export type DailyReport = {
  id: string
  ownerId: string
  engineerId: string
  engineerName: string
  siteName: string
  siteLocation: string
  reportDate: string
  workersPresent: number
  completedShifts: number
  activeOnSite: number
  totalWages: number
  rows: DailyReportRow[]
  receivedAt: string
}

export type SiteWorker = {
  id: number
  workerNumber: string
  nid: string
  fullName: string
  classification: string
  phoneNumber: string | null
  hourlyRate: number
  isActive: boolean
}

export type SiteSnapshot = {
  siteName: string
  siteLocation: string
  openingTime: string
  closingTime: string
  engineerId: string
  engineerName: string
  workerCount: number
}

const attendanceService = new AttendanceService()

function clock(value: unknown): string {
  if (value == null) return '07:00'
  const raw = String(value)
  return raw.slice(0, 5)
}

function localToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export async function getSiteSnapshot(ownerId: string): Promise<SiteSnapshot> {
  const [site, engineer, workers] = await Promise.all([
    pool().query(
      `SELECT site_name, site_location, opening_time, closing_time
       FROM site_configuration WHERE id = 1`,
    ),
    pool().query(
      `SELECT id, full_name, site_name
       FROM field_engineer
       WHERE owner_id = $1
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [ownerId],
    ),
    pool().query(`SELECT COUNT(*)::int AS count FROM worker WHERE is_active = true`),
  ])

  return {
    siteName: site.rows[0]?.site_name || engineer.rows[0]?.site_name || 'Construction site',
    siteLocation: site.rows[0]?.site_location || '',
    openingTime: clock(site.rows[0]?.opening_time),
    closingTime: clock(site.rows[0]?.closing_time),
    engineerId: engineer.rows[0]?.id || ownerId,
    engineerName: engineer.rows[0]?.full_name || 'Field Engineer',
    workerCount: workers.rows[0]?.count || 0,
  }
}

export async function listSiteWorkers(): Promise<SiteWorker[]> {
  const result = await pool().query(
    `SELECT id, worker_number, nid, full_name, classification, phone_number, hourly_rate, is_active
     FROM worker
     WHERE is_active = true
     ORDER BY worker_number`,
  )
  return result.rows.map((row) => ({
    id: Number(row.id),
    workerNumber: row.worker_number,
    nid: row.nid,
    fullName: row.full_name,
    classification: row.classification,
    phoneNumber: row.phone_number || null,
    hourlyRate: Number(row.hourly_rate),
    isActive: Boolean(row.is_active),
  }))
}

function toReport(
  ownerId: string,
  snapshot: SiteSnapshot,
  reportDate: string,
  rows: DailyReportRow[],
): DailyReport {
  const completedShifts = rows.filter((r) => r.exit_time).length
  const activeOnSite = rows.filter((r) => r.entry_time && !r.exit_time).length
  const totalWages = rows.reduce((sum, r) => sum + (Number(r.daily_wage) || 0), 0)
  return {
    id: reportDate,
    ownerId,
    engineerId: snapshot.engineerId,
    engineerName: snapshot.engineerName,
    siteName: snapshot.siteName,
    siteLocation: snapshot.siteLocation,
    reportDate,
    workersPresent: rows.length,
    completedShifts,
    activeOnSite,
    totalWages,
    rows,
    receivedAt: new Date().toISOString(),
  }
}

function mapRow(row: Record<string, unknown>): DailyReportRow {
  return {
    worker_id: Number(row.worker_id),
    worker_number: String(row.worker_number),
    full_name: String(row.full_name),
    classification: String(row.classification),
    entry_time: iso(row.entry_time as Date | string | null),
    exit_time: iso(row.exit_time as Date | string | null),
    break_count: Number(row.break_count || 0),
    break_minutes: row.break_minutes != null ? Number(row.break_minutes) : null,
    hours_worked: row.hours_worked != null ? Number(row.hours_worked) : null,
    daily_wage: row.daily_wage != null ? Number(row.daily_wage) : null,
    late_minutes:
      row.late_minutes != null
        ? Number(row.late_minutes)
        : row.entry_time
          ? lateMinutesFromWorkStart(new Date(row.entry_time as Date | string))
          : 0,
  }
}

async function storedRowsForDate(date: string): Promise<DailyReportRow[]> {
  const result = await pool().query(
    `
    SELECT
      w.id as worker_id,
      w.worker_number,
      w.full_name,
      w.classification,
      MIN(CASE WHEN ae.event_type = 'ENTRY' THEN ae.timestamp END) as entry_time,
      MAX(CASE WHEN ae.event_type = 'EXIT' THEN ae.timestamp END) as exit_time,
      COUNT(CASE WHEN ae.event_type = 'LEAVE_SITE' THEN 1 END)::int as break_count,
      CASE
        WHEN dw.break_duration_ms IS NULL THEN NULL
        ELSE ROUND(dw.break_duration_ms / 60000.0)::int
      END as break_minutes,
      dw.hours_worked,
      dw.wage_amount as daily_wage
    FROM worker w
    INNER JOIN attendance_event ae ON ae.worker_id = w.id AND DATE(ae.timestamp) = $1::date
    LEFT JOIN daily_wage dw ON dw.worker_id = w.id AND dw.work_date = $1::date
    GROUP BY
      w.id, w.worker_number, w.full_name, w.classification,
      dw.break_duration_ms, dw.hours_worked, dw.wage_amount
    ORDER BY w.full_name
    `,
    [date],
  )
  return result.rows.map(mapRow)
}

async function liveRowsForDate(date: string): Promise<DailyReportRow[]> {
  const rows = await attendanceService.getDailySummary(new Date(`${date}T12:00:00`))
  return rows.map(mapRow)
}

async function rowsForDate(date: string): Promise<DailyReportRow[]> {
  if (date === localToday()) {
    return liveRowsForDate(date)
  }
  return storedRowsForDate(date)
}

export async function listAttendanceReports(ownerId: string): Promise<Omit<DailyReport, 'rows'>[]> {
  const dates = await pool().query(
    `
    SELECT d::date AS report_date
    FROM (
      SELECT DISTINCT work_date AS d FROM daily_wage
      UNION
      SELECT DISTINCT DATE(timestamp) AS d FROM attendance_event
    ) dates
    ORDER BY report_date DESC
    LIMIT 90
    `,
  )

  const snapshot = await getSiteSnapshot(ownerId)
  const reports: Omit<DailyReport, 'rows'>[] = []

  for (const row of dates.rows) {
    const reportDate = dateOnly(row.report_date)!
    const workerRows = await rowsForDate(reportDate)
    if (workerRows.length === 0) continue
    const { rows: _rows, ...meta } = toReport(ownerId, snapshot, reportDate, workerRows)
    reports.push(meta)
  }

  return reports
}

export async function getAttendanceReport(
  ownerId: string,
  reportDate: string,
): Promise<DailyReport | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return null
  const workerRows = await rowsForDate(reportDate)
  if (workerRows.length === 0) return null
  const snapshot = await getSiteSnapshot(ownerId)
  return toReport(ownerId, snapshot, reportDate, workerRows)
}

export async function getTodayReport(ownerId: string): Promise<DailyReport | null> {
  return getAttendanceReport(ownerId, localToday())
}
