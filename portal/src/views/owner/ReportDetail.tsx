import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Users, CheckCircle2, Activity, Wallet } from 'lucide-react'
import { Alert, LoadingState } from '../../components/ui'
import AttendanceTable from '../../components/AttendanceTable'
import { fetchReport } from '../../services/api'
import { formatReportDate, formatWage, localDateString } from '../../lib/format'
import type { DailyReport } from '../../types'

const ReportDetail: React.FC = () => {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DailyReport | null>(null)

  useEffect(() => {
    if (!id) return
    void load(id)
    const today = localDateString()
    if (id !== today) return undefined
    const timer = window.setInterval(() => {
      void load(id, true)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [id])

  const load = async (reportId: string, silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      setReport(await fetchReport(reportId))
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load report'
      if (!silent) setError(message)
    } finally {
      if (!silent) setLoading(false)
    }
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
            {report.siteLocation && <span>{report.siteLocation}</span>}
            <span>{formatReportDate(report.reportDate)}</span>
            <span>Recorded by {report.engineerName}</span>
            <span>{formatWage(report.totalWages)}</span>
          </div>
        </div>
      </div>

      <div className="stats-grid stats-grid--4">
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{report.workersPresent}</div>
          <div className="stat-label">Workers present</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value">{report.completedShifts}</div>
          <div className="stat-label">Completed shifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value">{report.activeOnSite}</div>
          <div className="stat-label">Active on site</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Wallet size={18} />
            </div>
          </div>
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
          <AttendanceTable rows={report.rows} />
        </div>
      </div>
    </div>
  )
}

export default ReportDetail
