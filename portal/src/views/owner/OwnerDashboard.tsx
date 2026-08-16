import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, KeyRound, FileText, Activity } from 'lucide-react'
import { Alert, LoadingState, StatusBadge } from '../../components/ui'
import { fetchOwnerOverview } from '../../services/api'
import type { DailyReport, DailyReportMeta, Subscription } from '../../types'

const OwnerDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [stats, setStats] = useState({
    engineerCount: 0,
    activeEngineers: 0,
    keysAvailable: 0,
    keysUsed: 0,
  })
  const [latest, setLatest] = useState<DailyReport | null>(null)
  const [recent, setRecent] = useState<DailyReportMeta[]>([])

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchOwnerOverview()
      setSubscription(data.subscription)
      setStats({
        engineerCount: data.engineerCount,
        activeEngineers: data.activeEngineers,
        keysAvailable: data.keysAvailable,
        keysUsed: data.keysUsed,
      })
      setLatest(data.latestReport)
      setRecent(data.recentReports)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load overview'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingState label="Loading owner portal…" />

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={load} />}

      {subscription && (
        <div className="meta-chip">
          {subscription.planName} · <StatusBadge status={subscription.status} /> · {subscription.seats}{' '}
          seats
        </div>
      )}

      <div className="stats-grid stats-grid--4">
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.engineerCount}</div>
          <div className="stat-label">Field engineers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.activeEngineers}</div>
          <div className="stat-label">Active on sites</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <KeyRound size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.keysAvailable}</div>
          <div className="stat-label">Keys available</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <FileText size={18} />
            </div>
          </div>
          <div className="stat-value">{recent.length}</div>
          <div className="stat-label">Reports received</div>
        </div>
      </div>

      {latest && (
        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Latest daily report — {latest.siteName}</h2>
            <Link to={`/owner/reports/${latest.id}`} className="btn btn-secondary">
              Open
            </Link>
          </div>
          <div className="panel__body">
            <div className="report-meta">
              <span>Date: {latest.reportDate}</span>
              <span>Workers: {latest.workersPresent}</span>
              <span>Completed: {latest.completedShifts}</span>
              <span>Active: {latest.activeOnSite}</span>
              <span>
                Wages:{' '}
                {latest.totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF
              </span>
            </div>
            <div className="stats-grid stats-grid--4" style={{ marginBottom: 0 }}>
              <div className="summary-stat">
                <span className="stat-label">Present</span>
                <div className="stat-value">{latest.workersPresent}</div>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Completed</span>
                <div className="stat-value">{latest.completedShifts}</div>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Still on site</span>
                <div className="stat-value">{latest.activeOnSite}</div>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Total wages</span>
                <div className="stat-value stat-value--sm">
                  {latest.totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Recent reports</h2>
          <Link to="/owner/reports" className="btn btn-secondary">
            All reports
          </Link>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Site</th>
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
                    <td>{r.workersPresent}</td>
                    <td>{r.totalWages.toLocaleString('en-US')}</td>
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

export default OwnerDashboard
