import React, { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import reportService, { MonthlyReportData, PayrollExportData } from '../services/reportService'
import { attendanceService } from '../services/attendanceService'
import { LoadingState, EmptyState } from '../components/ui'
import { ClassificationFilter } from '../components/ClassificationFilter'
import { useClassificationFilter } from '../hooks/useClassificationFilter'
import { downloadCsv } from '../lib/downloadCsv'
import { useToast } from '../components/Toast'

type ReportType = 'daily' | 'monthly' | 'payroll'

type DailyRow = {
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
  late_minutes?: number
  checkout_decision?: 'OVERTIME' | 'DELAYED_LEAVE' | null
  needs_after_hours_review?: boolean
}

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatCurrency(amount: number | string | null | undefined) {
  if (amount == null) return '0 RWF'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `${(isNaN(num) ? 0 : num).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`
}

function formatHours(hours: number | string | null | undefined) {
  if (hours == null) return '0.00'
  const num = typeof hours === 'string' ? parseFloat(hours) : hours
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return '—'
  return new Date(timeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatBreaks(count: number, minutes: number | null) {
  if (!count && !minutes) return '0'
  if (minutes == null || minutes === 0) return String(count)
  return `${count} (${minutes}m)`
}

function statusLabel(row: DailyRow) {
  if (row.needs_after_hours_review) return 'Needs review'
  if (row.checkout_decision === 'OVERTIME' && !row.exit_time) return 'Overtime'
  return row.exit_time ? 'Completed' : 'Active'
}

const EMPTY_DAILY: DailyRow[] = []
const EMPTY_MONTHLY: MonthlyReportData['workers'] = []
const EMPTY_PAYROLL: PayrollExportData['workers'] = []

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const Reports: React.FC = () => {
  const toast = useToast()
  const [reportType, setReportType] = useState<ReportType>('daily')
  const [loading, setLoading] = useState(false)

  const [dailyDate, setDailyDate] = useState(localDateString())
  const [dailyRows, setDailyRows] = useState<DailyRow[] | null>(null)

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportData | null>(null)

  const [payrollStartDate, setPayrollStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return localDateString(date)
  })
  const [payrollEndDate, setPayrollEndDate] = useState(localDateString())
  const [payrollData, setPayrollData] = useState<PayrollExportData | null>(null)

  const dailyClass = useClassificationFilter(dailyRows ?? EMPTY_DAILY, row => row.classification)
  const monthlyClass = useClassificationFilter(
    monthlyReport?.workers ?? EMPTY_MONTHLY,
    worker => worker.classification
  )
  const payrollClass = useClassificationFilter(
    payrollData?.workers ?? EMPTY_PAYROLL,
    worker => worker.classification
  )

  const loadDailyReport = async (date = dailyDate) => {
    setLoading(true)
    try {
      const data = await attendanceService.getDailySummary(date)
      setDailyRows(data)
    } catch {
      toast.error('Failed to load daily report')
      setDailyRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (reportType === 'daily') {
      void loadDailyReport(dailyDate)
    }
    // Load when opening Daily or changing the date
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dailyDate])

  const handleGenerateMonthlyReport = async () => {
    setLoading(true)
    try {
      setMonthlyReport(await reportService.getMonthlyReport(selectedYear, selectedMonth))
    } catch {
      toast.error('Failed to generate monthly report')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePayroll = async () => {
    setLoading(true)
    try {
      setPayrollData(await reportService.getPayrollExport(payrollStartDate, payrollEndDate))
    } catch {
      toast.error('Failed to generate payroll data')
    } finally {
      setLoading(false)
    }
  }

  const exportDailyCsv = () => {
    downloadCsv(
      `daily_report_${dailyDate}.csv`,
      ['Worker #', 'Name', 'Classification', 'Entry', 'Exit', 'Late (min)', 'Breaks', 'Hours', 'Daily wage', 'Status'],
      dailyClass.filtered.map(row => [
        row.worker_number,
        row.full_name,
        row.classification,
        formatTime(row.entry_time),
        formatTime(row.exit_time),
        row.late_minutes || 0,
        formatBreaks(row.break_count, row.break_minutes),
        formatHours(row.hours_worked),
        Number(row.daily_wage || 0).toFixed(0),
        statusLabel(row),
      ])
    )
  }

  const exportMonthlyCsv = () => {
    if (!monthlyReport) return
    downloadCsv(
      `monthly_report_${monthlyReport.year}_${String(selectedMonth).padStart(2, '0')}.csv`,
      ['Worker #', 'Name', 'Classification', 'Days present', 'Days late', 'Total hours', 'Regular pay', 'Pay'],
      monthlyClass.filtered.map(worker => [
        worker.worker_number,
        worker.full_name,
        worker.classification,
        worker.days_present,
        worker.days_late,
        formatHours(worker.total_hours),
        Number(worker.regular_pay || 0).toFixed(0),
        Number(worker.net_pay || 0).toFixed(0),
      ])
    )
  }

  const exportPayrollCsv = () => {
    downloadCsv(
      `payroll_${payrollStartDate}_to_${payrollEndDate}.csv`,
      ['Worker #', 'Name', 'Classification', 'Rate', 'Days', 'Hours', 'Regular pay', 'Pay'],
      payrollClass.filtered.map(worker => [
        worker.worker_number,
        worker.full_name,
        worker.classification,
        Number(worker.hourly_rate || 0).toFixed(0),
        worker.days_worked,
        formatHours(worker.total_hours),
        Number(worker.regular_pay || 0).toFixed(0),
        Number(worker.net_pay || 0).toFixed(0),
      ])
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '1.25rem',
        }}
      >
        <button
          className={reportType === 'daily' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setReportType('daily')}
          style={{ flex: 1 }}
        >
          Daily Reports
        </button>
        <button
          className={reportType === 'monthly' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setReportType('monthly')}
          style={{ flex: 1 }}
        >
          Monthly Reports
        </button>
        <button
          className={reportType === 'payroll' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setReportType('payroll')}
          style={{ flex: 1 }}
        >
          Payroll Export
        </button>
      </div>

      {reportType === 'daily' && (
        <div>
          <div
            className="toolbar toolbar--compact"
            style={{ justifyContent: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.8rem', alignItems: 'end' }}
          >
            <div className="form-group" style={{ marginLeft: '0.25rem' }}>
              <label>Date</label>
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
            </div>
            {dailyRows && dailyRows.length > 0 && (
              <button type="button" className="btn btn-secondary" onClick={exportDailyCsv} style={{ height: '42px' }}>
                <Download size={16} />
                Download CSV
              </button>
            )}
          </div>

          {loading && !dailyRows ? (
            <LoadingState label="Loading daily report…" />
          ) : dailyRows && dailyRows.length === 0 ? (
            <div className="panel">
              <EmptyState
                title="No attendance for this date"
                description="Pick another date to see who checked in."
              />
            </div>
          ) : dailyRows ? (
            <div className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Daily report</h2>
              </div>
              <div className="panel__body" style={{ padding: 0 }}>
                <ClassificationFilter
                  groups={dailyClass.groups}
                  selected={dailyClass.selected}
                  onSelect={dailyClass.setSelected}
                />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Worker #</th>
                        <th>Name</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>Late</th>
                        <th>Breaks</th>
                        <th>Hours</th>
                        <th>Daily wage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyClass.filtered.map(row => (
                        <tr key={row.worker_id}>
                          <td>
                            <strong>{row.worker_number}</strong>
                          </td>
                          <td>{row.full_name}</td>
                          <td>{formatTime(row.entry_time)}</td>
                          <td>{formatTime(row.exit_time)}</td>
                          <td>{row.late_minutes ? `${row.late_minutes} min` : 'On time'}</td>
                          <td>{formatBreaks(row.break_count, row.break_minutes)}</td>
                          <td>{formatHours(row.hours_worked)}h</td>
                          <td>{formatCurrency(row.daily_wage)}</td>
                          <td>
                            <span
                              className={`status-badge ${
                                row.needs_after_hours_review ||
                                (row.checkout_decision === 'OVERTIME' && !row.exit_time)
                                  ? 'review'
                                  : row.exit_time
                                    ? 'completed'
                                    : 'active'
                              }`}
                            >
                              {statusLabel(row)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {reportType === 'monthly' && (
        <div>
          <div
            className="toolbar toolbar--compact"
            style={{ justifyContent: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.8rem', alignItems: 'end' }}
          >
            <div className="form-group" style={{ marginLeft: '0.25rem' }}>
              <label>Year</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                style={{ width: '110px', minWidth: '110px' }}
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginLeft: '0.25rem' }}>
              <label>Month</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
                style={{ width: '110px', minWidth: '110px' }}
              >
                {months.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleGenerateMonthlyReport}
              className="btn btn-primary"
              disabled={loading}
              style={{ height: '42px', marginLeft: '0.625rem' }}
            >
              {loading ? 'Loading…' : 'View report'}
            </button>
            {monthlyReport && (
              <button type="button" className="btn btn-secondary" onClick={exportMonthlyCsv} style={{ height: '42px' }}>
                <Download size={16} />
                Download CSV
              </button>
            )}
          </div>

          {monthlyReport && (
            <div className="panel">
              <div className="panel__head">
                <h2 className="panel__title">
                  {monthlyReport.month} {monthlyReport.year}
                </h2>
              </div>
              <div className="panel__body" style={{ padding: 0 }}>
                <ClassificationFilter
                  groups={monthlyClass.groups}
                  selected={monthlyClass.selected}
                  onSelect={monthlyClass.setSelected}
                />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Worker #</th>
                        <th>Name</th>
                        <th>Days present</th>
                        <th>Days late</th>
                        <th>Total hours</th>
                        <th>Regular pay</th>
                        <th>Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyClass.filtered.map(worker => (
                        <tr key={worker.worker_id}>
                          <td>
                            <strong>{worker.worker_number}</strong>
                          </td>
                          <td>{worker.full_name}</td>
                          <td>{worker.days_present}</td>
                          <td>{worker.days_late}</td>
                          <td>{formatHours(worker.total_hours)}h</td>
                          <td>{formatCurrency(worker.regular_pay)}</td>
                          <td style={{ fontWeight: 700 }}>{formatCurrency(worker.net_pay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {reportType === 'payroll' && (
        <div>
          <div
            className="toolbar toolbar--compact"
            style={{ justifyContent: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.8rem', alignItems: 'end' }}
          >
            <div className="form-group" style={{ marginLeft: '0.25rem' }}>
              <label>Start date</label>
              <input type="date" value={payrollStartDate} onChange={e => setPayrollStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginLeft: '0.25rem' }}>
              <label>End date</label>
              <input type="date" value={payrollEndDate} onChange={e => setPayrollEndDate(e.target.value)} />
            </div>
            <button
              type="button"
              onClick={handleGeneratePayroll}
              className="btn btn-primary"
              disabled={loading}
              style={{ height: '42px', marginLeft: '0.625rem' }}
            >
              {loading ? 'Loading…' : 'View payroll'}
            </button>
            {payrollData && (
              <button type="button" className="btn btn-secondary" onClick={exportPayrollCsv} style={{ height: '42px' }}>
                <Download size={16} />
                Download CSV
              </button>
            )}
          </div>

          {payrollData && (
            <div className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Payroll</h2>
              </div>
              <div className="panel__body" style={{ padding: 0 }}>
                <ClassificationFilter
                  groups={payrollClass.groups}
                  selected={payrollClass.selected}
                  onSelect={payrollClass.setSelected}
                />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Worker #</th>
                        <th>Name</th>
                        <th>Rate</th>
                        <th>Days</th>
                        <th>Hours</th>
                        <th>Regular pay</th>
                        <th>Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollClass.filtered.map((worker, index) => (
                        <tr key={`${worker.worker_number}-${index}`}>
                          <td>
                            <strong>{worker.worker_number}</strong>
                          </td>
                          <td>{worker.full_name}</td>
                          <td>{formatCurrency(worker.hourly_rate)}</td>
                          <td>{worker.days_worked}</td>
                          <td>{formatHours(worker.total_hours)}h</td>
                          <td>{formatCurrency(worker.regular_pay)}</td>
                          <td style={{ fontWeight: 700 }}>{formatCurrency(worker.net_pay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Reports
