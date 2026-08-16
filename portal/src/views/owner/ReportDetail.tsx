import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, LoadingState } from '../../components/ui'
import { fetchReport } from '../../services/api'
import type { DailyReport } from '../../types'

const ReportDetail: React.FC = () => {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DailyReport | null>(null)

  useEffect(() => {
    if (!id) return
    void load(id)
  }, [id])

  const load = async (reportId: string) => {
    try {
      setLoading(true)
      setError(null)
      setReport(await fetchReport(reportId))
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load report'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—'
    return new Date(timeStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <LoadingState label="Loading report…" />
  if (error) return <Alert variant="error" message={error} />
  if (!report) return <Alert variant="error" message="Report not found" />

  return (
    <div className="stack-gap">
      <div className="toolbar">
        <div>
          <p className="muted">
            <Link to="/owner/reports">← All reports</Link>
          </p>
          <div className="report-meta" style={{ marginBottom: 0, marginTop: '0.5rem' }}>
            <span>{report.siteName}</span>
            <span>{report.reportDate}</span>
            <span>
              {report.totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF
            </span>
          </div>
        </div>
      </div>

      <div className="stats-grid stats-grid--4">
        <div className="stat-card">
          <div className="stat-value">{report.workersPresent}</div>
          <div className="stat-label">Workers present</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.completedShifts}</div>
          <div className="stat-label">Completed shifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.activeOnSite}</div>
          <div className="stat-label">Active on site</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-value--sm">
            {report.totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-label">Total wages (RWF)</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Worker attendance</h2>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker #</th>
                  <th>Name</th>
                  <th>Classification</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Breaks</th>
                  <th>Hours</th>
                  <th>Daily wage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((w) => (
                  <tr key={w.worker_id}>
                    <td>
                      <strong>{w.worker_number}</strong>
                    </td>
                    <td>{w.full_name}</td>
                    <td>{w.classification}</td>
                    <td>{formatTime(w.entry_time)}</td>
                    <td>{formatTime(w.exit_time)}</td>
                    <td>
                      {w.break_count}
                      {w.break_minutes ? ` (${w.break_minutes}m)` : ''}
                    </td>
                    <td>{w.hours_worked != null ? `${Number(w.hours_worked).toFixed(2)}h` : '—'}</td>
                    <td>
                      {w.daily_wage != null
                        ? `${Number(w.daily_wage).toLocaleString('en-US')} RWF`
                        : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${w.exit_time ? 'completed' : 'active'}`}>
                        {w.exit_time ? 'Completed' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportDetail
