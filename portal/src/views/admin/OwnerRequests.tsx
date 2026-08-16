import React, { useEffect, useState } from 'react'
import { Alert, LoadingState, EmptyState, StatusBadge } from '../../components/ui'
import { useToast } from '../../components/Toast'
import {
  fetchOwnerRequests,
  approveRequest,
  rejectRequest,
  updateOwnerRequest,
  deleteOwnerRequest,
  deactivateOwnerRequest,
} from '../../services/api'
import type { OwnerRequest } from '../../types'
import { Inbox, Check, X, Pencil, Ban, Trash2 } from 'lucide-react'

const emptyEdit = {
  fullName: '',
  email: '',
  companyName: '',
  phone: '',
  message: '',
}

const OwnerRequests: React.FC = () => {
  const { push } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<OwnerRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<OwnerRequest | null>(null)
  const [editForm, setEditForm] = useState(emptyEdit)
  const [editBusy, setEditBusy] = useState(false)
  const [resultModal, setResultModal] = useState<{
    password: string
    keys: string[]
  } | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setRequests(await fetchOwnerRequests())
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load requests'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const onApprove = async (id: string) => {
    setBusyId(id)
    try {
      const data = await approveRequest(id, 3)
      push(data.message)
      setResultModal({ password: data.temporaryPassword, keys: data.activationKeys })
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Approve failed'
      push(message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const onReject = async (id: string) => {
    const reason = window.prompt('Rejection reason (optional):') ?? undefined
    setBusyId(id)
    try {
      await rejectRequest(id, reason)
      push('Request rejected')
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Reject failed'
      push(message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const openEdit = (request: OwnerRequest) => {
    setEditing(request)
    setEditForm({
      fullName: request.fullName,
      email: request.email,
      companyName: request.companyName,
      phone: request.phone,
      message: request.message || '',
    })
  }

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setEditBusy(true)
    try {
      await updateOwnerRequest(editing.id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        companyName: editForm.companyName.trim(),
        phone: editForm.phone.trim(),
        message: editForm.message.trim() || undefined,
      })
      push('Request updated')
      setEditing(null)
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Update failed'
      push(message, 'error')
    } finally {
      setEditBusy(false)
    }
  }

  const onDelete = async (request: OwnerRequest) => {
    if (!window.confirm(`Delete request for ${request.fullName}? This cannot be undone.`)) return
    setBusyId(request.id)
    try {
      await deleteOwnerRequest(request.id)
      push('Request deleted')
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Delete failed'
      push(message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const onDeactivate = async (request: OwnerRequest) => {
    if (
      !window.confirm(
        `Deactivate request for ${request.fullName}? Approved owners will have their subscription suspended.`,
      )
    ) {
      return
    }
    setBusyId(request.id)
    try {
      await deactivateOwnerRequest(request.id)
      push('Request deactivated')
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Deactivate failed'
      push(message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingState label="Loading requests…" />

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={load} />}

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Site owner requests</h2>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {requests.length === 0 ? (
            <EmptyState
              icon={<Inbox size={24} />}
              title="No requests yet"
              description="When companies request access, they will appear here for approval."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.fullName}</strong>
                        <div className="muted">{new Date(r.createdAt).toLocaleString()}</div>
                      </td>
                      <td>{r.companyName}</td>
                      <td>
                        {r.email}
                        <div className="muted">{r.phone}</div>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div className="action-buttons">
                          {r.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                className="btn-icon"
                                disabled={busyId === r.id}
                                title="Approve"
                                aria-label="Approve"
                                onClick={() => void onApprove(r.id)}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon btn-danger"
                                disabled={busyId === r.id}
                                title="Reject"
                                aria-label="Reject"
                                onClick={() => void onReject(r.id)}
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn-icon btn-icon--blue"
                            disabled={busyId === r.id}
                            title="Edit"
                            aria-label="Edit"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil size={16} />
                          </button>
                          {r.status !== 'DEACTIVATED' && r.status !== 'REJECTED' && (
                            <button
                              type="button"
                              className="btn-icon btn-icon--green"
                              disabled={busyId === r.id}
                              title="Deactivate"
                              aria-label="Deactivate"
                              onClick={() => void onDeactivate(r)}
                            >
                              <Ban size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-icon btn-icon--red"
                            disabled={busyId === r.id}
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => void onDelete(r)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditing(null)}>
          <div
            className="modal modal--form"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal__title">Edit request</h3>
            <p className="modal__desc">Update applicant details for this site owner request.</p>
            <form className="modal__form" onSubmit={onSaveEdit}>
              <div className="form-group">
                <label htmlFor="edit-fullName">Full name</label>
                <input
                  id="edit-fullName"
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-company">Company</label>
                <input
                  id="edit-company"
                  type="text"
                  required
                  value={editForm.companyName}
                  onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-phone">Phone</label>
                <input
                  id="edit-phone"
                  type="tel"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-message">Message</label>
                <textarea
                  id="edit-message"
                  rows={3}
                  value={editForm.message}
                  onChange={(e) => setEditForm((p) => ({ ...p, message: e.target.value }))}
                />
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                  {editBusy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resultModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setResultModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal__title">Owner approved</h3>
            <p className="modal__desc">
              Share these credentials with the site owner. They can sign in and assign keys to Field
              Engineers.
            </p>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Temporary password</label>
              <div className="copy-row key-mono">{resultModal.password}</div>
            </div>
            <div className="form-group">
              <label>Activation keys issued</label>
              {resultModal.keys.map((k) => (
                <div key={k} className="copy-row key-mono" style={{ marginBottom: '0.4rem' }}>
                  {k}
                </div>
              ))}
            </div>
            <div className="modal__actions">
              <button type="button" className="btn btn-primary" onClick={() => setResultModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OwnerRequests
