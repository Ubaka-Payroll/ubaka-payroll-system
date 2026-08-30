import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  CheckCircle2,
  Activity,
  Wallet,
  HardHat,
  KeyRound,
  CalendarDays,
  FileText,
} from 'lucide-react'
import { Alert, LoadingState, EmptyState, StatusBadge } from '../../components/ui'
import AttendanceTable from '../../components/AttendanceTable'
import { fetchOwnerOverview } from '../../services/api'
import { formatReportDate, formatWage, localDateString } from '../../lib/format'
import type { DailyReport, DailyReportMeta, SiteSnapshot, Subscription } from '../../types'

const OwnerDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [site, setSite] = useState<SiteSnapshot | null>(null)
  const [stats, setStats] = useState({
    engineerCount: 0,
    activeEngineers: 0,
    keysAvailable: 0,
    workerCount: 0,
  })
  const [today, setToday] = useState<DailyReport | null>(null)
  const [recent, setRecent] = useState<DailyReportMeta[]>([])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      void load(true)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const load = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      const data = await fetchOwnerOverview()
      setSubscription(data.subscription)
      setSite(data.site)
      setStats({
        engineerCount: data.engineerCount,
        activeEngineers: data.activeEngineers,
        keysAvailable: data.keysAvailable,
        workerCount: data.workerCount,
      })
      setToday(data.todayReport)
      setRecent(data.recentReports)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load overview'
      if (!silent) setError(message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  if (loading) return <LoadingState label="Loading owner portal…" />

  const present = today?.workersPresent ?? 0
  const completed = today?.completedShifts ?? 0
  const active = today?.activeOnSite ?? 0
  const wages = today?.totalWages ?? 0

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={() => load()} />}

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <CalendarDays size={18} color="var(--text-muted)" />
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            {formatReportDate(localDateString())}
          </span>
        </div>
      </div>

      {site && (
        <div className="meta-chip">
          {site.siteName}
          {site.siteLocation ? ` · ${site.siteLocation}` : ''}
          {site.engineerName ? ` · ${site.engineerName}` : ''}
          {` · ${site.openingTime}–${site.closingTime}`}
          {subscription && (
            <>
              {' · '}
              {subscription.planName} <StatusBadge status={subscription.status} />
            </>
          )}
        </div>
      )}

      <div className="stats-grid stats-grid--4">
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{present}</div>
          <div className="stat-label">Workers present</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Completed shifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value">{active}</div>
          <div className="stat-label">Active on site</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Wallet size={18} />
            </div>
          </div>
          <div className="stat-value stat-value--sm">
            {wages.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-label">Total wages (RWF)</div>
        </div>
      </div>

      <div className="report-meta">
        <Link to="/owner/workers">
          <HardHat size={14} /> {stats.workerCount} workers on roster
        </Link>
        <Link to="/owner/engineers">
          <Users size={14} /> {stats.activeEngineers}/{stats.engineerCount} engineers active
        </Link>
        <Link to="/owner/keys">
          <KeyRound size={14} /> {stats.keysAvailable} keys available
        </Link>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Today&apos;s attendance</h2>
          {today && (
            <Link to={`/owner/reports/${today.id}`} className="btn btn-secondary">
              Open report
            </Link>
          )}
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <AttendanceTable
            rows={today?.rows || []}
            emptyTitle="No attendance yet today"
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Recent reports</h2>
          <Link to="/owner/reports" className="btn btn-secondary">
            All reports
          </Link>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {recent.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title="No daily reports yet"
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Site</th>
                    <th>Engineer</th>
                    <th>Workers</th>
                    <th>Wages (RWF)</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/owner/reports/${r.id}`}>
                          <strong>{r.reportDate}</strong>
                        </Link>
                      </td>
                      <td>{r.siteName}</td>
                      <td>{r.engineerName}</td>
                      <td>{r.workersPresent}</td>
                      <td>{formatWage(r.totalWages)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OwnerDashboard
