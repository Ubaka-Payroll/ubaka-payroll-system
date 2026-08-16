import React, { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { Alert, LoadingState, EmptyState, StatusBadge } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { fetchEngineers, createEngineer } from '../../services/api'
import type { FieldEngineer } from '../../types'

const Engineers: React.FC = () => {
  const { push } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [engineers, setEngineers] = useState<FieldEngineer[]>([])
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    siteName: '',
  })

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setEngineers(await fetchEngineers())
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load engineers'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await createEngineer(form)
      push(data.message || 'Engineer created')
      setCreatedKey(data.activationKey)
      setForm({ fullName: '', email: '', phone: '', siteName: '' })
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not create engineer'
      push(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading engineers…" />

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={load} />}

      <div className="toolbar">
        <p className="muted">
          Create Field Engineers and share their activation key for the Ubaka desktop app.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add engineer
        </button>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Field engineers</h2>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {engineers.length === 0 ? (
            <EmptyState
              icon={<Users size={24} />}
              title="No engineers yet"
              description="Add a Field Engineer and assign an activation key for their site."
              action={
                <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                  Add engineer
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Site</th>
                    <th>Contact</th>
                    <th>Activation key</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {engineers.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.fullName}</strong>
                      </td>
                      <td>{e.siteName}</td>
                      <td>
                        {e.email}
                        {e.phone && <div className="muted">{e.phone}</div>}
                      </td>
                      <td>
                        {e.activationKey ? (
                          <span className="key-mono">{e.activationKey}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowForm(false)}>
          <div
            className="modal modal--form"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal__title">Add Field Engineer</h3>
            <p className="modal__desc">An available activation key will be assigned automatically.</p>
            <form className="modal__form" onSubmit={onSubmit}>
              <div className="form-group">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Lydia Numwali"
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="07XX XXX XXX"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="siteName">Site name</label>
                <input
                  id="siteName"
                  type="text"
                  required
                  placeholder="e.g. Kigali Heights Site A"
                  value={form.siteName}
                  onChange={(e) => setForm((p) => ({ ...p, siteName: e.target.value }))}
                />
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Creating…' : 'Create & assign key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdKey && (
        <div className="modal-backdrop" role="presentation" onClick={() => setCreatedKey(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Activation key ready</h3>
            <p className="modal__desc">
              Give this key to the Field Engineer so they can activate the Ubaka desktop app for their
              site.
            </p>
            <div className="copy-row key-mono">{createdKey}</div>
            <div className="modal__actions">
              <button type="button" className="btn btn-primary" onClick={() => setCreatedKey(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Engineers
