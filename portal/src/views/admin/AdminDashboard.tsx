import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Users, KeyRound, Building2, CreditCard } from 'lucide-react'
import { Alert, LoadingState, StatusBadge } from '../../components/ui'
import { fetchAdminOverview } from '../../services/api'
import type { OwnerRequest, Subscription } from '../../types'

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    pendingRequests: 0,
    owners: 0,
    activeSubs: 0,
    engineers: 0,
    keysAvailable: 0,
  })
  const [recentRequests, setRecentRequests] = useState<OwnerRequest[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAdminOverview()
      setStats({
        pendingRequests: data.pendingRequests,
        owners: data.owners,
        activeSubs: data.activeSubs,
        engineers: data.engineers,
        keysAvailable: data.keysAvailable,
      })
      setRecentRequests(data.recentRequests)
      setSubscriptions(data.subscriptions.slice(0, 5))
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load overview'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingState label="Loading admin overview…" />

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={load} />}

      <div className="stats-grid stats-grid--4">
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <ClipboardList size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.pendingRequests}</div>
          <div className="stat-label">Pending requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Building2 size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.owners}</div>
          <div className="stat-label">Site owners</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.activeSubs}</div>
          <div className="stat-label">Active subscriptions</div>
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
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Recent owner requests</h2>
          <Link to="/admin/requests" className="btn btn-secondary">
            View all
          </Link>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.fullName}</strong>
                    </td>
                    <td>{r.companyName}</td>
                    <td>{r.email}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Subscriptions</h2>
          <Users size={18} color="var(--text-faint)" />
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Company</th>
                  <th>Plan</th>
                  <th>Seats</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.ownerName}</strong>
                    </td>
                    <td>{s.companyName}</td>
                    <td>{s.planName}</td>
                    <td>{s.seats}</td>
                    <td>
                      <StatusBadge status={s.status} />
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

export default AdminDashboard
