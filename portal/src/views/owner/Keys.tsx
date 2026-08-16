import React, { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Alert, LoadingState, EmptyState, StatusBadge } from '../../components/ui'
import { fetchOwnerKeys } from '../../services/api'
import type { ActivationKey } from '../../types'

const Keys: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keys, setKeys] = useState<ActivationKey[]>([])

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setKeys(await fetchOwnerKeys())
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load keys'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingState label="Loading activation keys…" />

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={load} />}

      <p className="muted">
        Activation keys unlock the desktop app for a Field Engineer on a specific site. Ask System
        Admin if you need more seats.
      </p>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Your activation keys</h2>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {keys.length === 0 ? (
            <EmptyState
              icon={<KeyRound size={24} />}
              title="No keys yet"
              description="Keys appear here after System Admin approves your subscription."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Site</th>
                    <th>Engineer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <td>
                        <span className="key-mono">{k.key}</span>
                      </td>
                      <td>{k.siteName || '—'}</td>
                      <td>
                        {k.engineerName || '—'}
                        {k.engineerEmail && <div className="muted">{k.engineerEmail}</div>}
                      </td>
                      <td>
                        <StatusBadge status={k.status} />
                      </td>
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

export default Keys
