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
}

export type DailyReport = {
  id: string
  ownerId: string
  engineerId: string
  siteName: string
  reportDate: string
  workersPresent: number
  completedShifts: number
  activeOnSite: number
  totalWages: number
  rows: DailyReportRow[]
  receivedAt: string
}

async function siteNameForOwner(ownerId: string): Promise<string> {
  const site = await pool().query('SELECT site_name FROM site_configuration WHERE id = 1')
  if (site.rows[0]?.site_name) return site.rows[0].site_name

  const engineer = await pool().query(
    `SELECT site_name FROM field_engineer WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [ownerId],
  )
  return engineer.rows[0]?.site_name || 'Construction site'
}

async function firstEngineerId(ownerId: string): Promise<string> {
  const result = await pool().query(
    `SELECT id FROM field_engineer WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [ownerId],
  )
  return result.rows[0]?.id || ownerId
}

function toReport(
  ownerId: string,
  engineerId: string,
  siteName: string,
  reportDate: string,
  rows: DailyReportRow[],
): DailyReport {
  const completedShifts = rows.filter((r) => r.exit_time).length
  const activeOnSite = rows.filter((r) => r.entry_time && !r.exit_time).length
  const totalWages = rows.reduce((sum, r) => sum + (Number(r.daily_wage) || 0), 0)
  return {
    id: reportDate,
    ownerId,
    engineerId,
    siteName,
    reportDate,
    workersPresent: rows.length,
    completedShifts,
    activeOnSite,
    totalWages,
    rows,
    receivedAt: new Date().toISOString(),
  }
}

async function rowsForDate(date: string): Promise<DailyReportRow[]> {
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

  return result.rows.map((row) => ({
    worker_id: Number(row.worker_id),
    worker_number: row.worker_number,
    full_name: row.full_name,
    classification: row.classification,
    entry_time: iso(row.entry_time),
    exit_time: iso(row.exit_time),
    break_count: Number(row.break_count || 0),
    break_minutes: row.break_minutes != null ? Number(row.break_minutes) : null,
    hours_worked: row.hours_worked != null ? Number(row.hours_worked) : null,
    daily_wage: row.daily_wage != null ? Number(row.daily_wage) : null,
  }))
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

  const siteName = await siteNameForOwner(ownerId)
  const engineerId = await firstEngineerId(ownerId)
  const reports: Omit<DailyReport, 'rows'>[] = []

  for (const row of dates.rows) {
    const reportDate = dateOnly(row.report_date)!
    const workerRows = await rowsForDate(reportDate)
    if (workerRows.length === 0) continue
    const { rows: _rows, ...meta } = toReport(ownerId, engineerId, siteName, reportDate, workerRows)
    reports.push(meta)
  }

  return reports
}

export async function getAttendanceReport(ownerId: string, reportDate: string): Promise<DailyReport | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return null
  const workerRows = await rowsForDate(reportDate)
  if (workerRows.length === 0) return null
  const siteName = await siteNameForOwner(ownerId)
  const engineerId = await firstEngineerId(ownerId)
  return toReport(ownerId, engineerId, siteName, reportDate, workerRows)
}
