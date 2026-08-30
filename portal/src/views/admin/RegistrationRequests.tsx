import React, { useEffect, useState } from 'react'
import { LoadingState, EmptyState } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { ConfirmModal, PromptModal } from '../../components/ConfirmModal'
import api from '../../services/api'
import { Inbox, Check, X, Copy } from 'lucide-react'

interface RegistrationRequest {
    id: string
    full_name: string
    email: string
    phone?: string
    company_name: string
    number_of_sites: number
    site_names: string[]
    status: 'pending' | 'approved' | 'rejected'
    subscription_key?: string
    rejection_reason?: string
    notes?: string
    created_at: string
    reviewed_at?: string
    reviewed_by?: string
}

const RegistrationRequests: React.FC = () => {
    const { push } = useToast()
    const [loading, setLoading] = useState(true)
    const [requests, setRequests] = useState<RegistrationRequest[]>([])
    const [busyId, setBusyId] = useState<string | null>(null)
    const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null)
    const [showKeyModal, setShowKeyModal] = useState<string | null>(null)

    // Modal state for approve / reject
    const [approveTarget, setApproveTarget] = useState<string | null>(null)
    const [rejectTarget, setRejectTarget] = useState<string | null>(null)

    useEffect(() => {
        void load()
    }, [])

    const load = async () => {
        try {
            setLoading(true)
            const response = await api.get('/owner-registration/admin')
            setRequests(response.data.data)
        } catch (err: any) {
            push(err.response?.data?.error || 'Failed to load registration requests', 'error')
        } finally {
            setLoading(false)
        }
    }

    const onApproveConfirmed = async () => {
        if (!approveTarget) return
        const id = approveTarget
        setApproveTarget(null)
        setBusyId(id)
        try {
            const response = await api.post(`/owner-registration/admin/${id}/approve`)
            push('Registration approved successfully')
            setShowKeyModal(response.data.data.subscription_key)
            await load()
        } catch (err: any) {
            push(err.response?.data?.error || 'Failed to approve request', 'error')
        } finally {
            setBusyId(null)
        }
    }

    const onRejectConfirmed = async (reason: string) => {
        if (!rejectTarget) return
        const id = rejectTarget
        setRejectTarget(null)
        setBusyId(id)
        try {
            await api.post(`/owner-registration/admin/${id}/reject`, { reason })
            push('Registration rejected')
            await load()
        } catch (err: any) {
            push(err.response?.data?.error || 'Failed to reject request', 'error')
        } finally {
            setBusyId(null)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        push('Copied to clipboard')
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, React.CSSProperties> = {
            pending: { background: 'var(--amber-light)', color: 'var(--amber-dark)' },
            approved: { background: 'var(--teal-light)', color: 'var(--teal-dark)' },
            rejected: { background: 'var(--rose-light)', color: 'var(--rose-dark)' }
        }

        return (
            <span className="status-badge" style={styles[status] || {}}>
                {status.toUpperCase()}
            </span>
        )
    }

    if (loading) return <LoadingState label="Loading registration requests…" />

    return (
        <div className="stack-gap">
            <div className="panel">
                <div className="panel__head">
                    <h2 className="panel__title">Owner Registration Requests</h2>
                </div>
                <div className="panel__body" style={{ padding: 0 }}>
                    {requests.length === 0 ? (
                        <EmptyState
                            icon={<Inbox size={24} />}
                            title="No registration requests"
                        />
                    ) : (
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Owner Details</th>
                                        <th>Company</th>
                                        <th>Sites</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map((r) => (
                                        <tr key={r.id}>
                                            <td>
                                                <strong>{r.full_name}</strong>
                                                <div className="muted">{r.email}</div>
                                                {r.phone && <div className="muted">{r.phone}</div>}
                                            </td>
                                            <td>{r.company_name}</td>
                                            <td>
                                                <div style={{ cursor: 'pointer' }} onClick={() => setSelectedRequest(r)}>
                                                    <strong>{r.number_of_sites} site{r.number_of_sites > 1 ? 's' : ''}</strong>
                                                    <div className="muted">Click to view</div>
                                                </div>
                                            </td>
                                            <td>{getStatusBadge(r.status)}</td>
                                            <td>
                                                <div style={{ fontSize: '0.875rem' }}>
                                                    {new Date(r.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    {r.status === 'pending' && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn-icon"
                                                                disabled={busyId === r.id}
                                                                title="Approve"
                                                                onClick={() => setApproveTarget(r.id)}
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn-icon btn-danger"
                                                                disabled={busyId === r.id}
                                                                title="Reject"
                                                                onClick={() => setRejectTarget(r.id)}
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {r.status === 'approved' && r.subscription_key && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm"
                                                            onClick={() => setShowKeyModal(r.subscription_key!)}
                                                        >
                                                            View Key
                                                        </button>
                                                    )}
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

            {/* ── Approve confirm modal ── */}
            <ConfirmModal
                open={!!approveTarget}
                variant="success"
                title="Approve registration"
                message="A unique subscription key will be generated and assigned to this owner. This action cannot be undone."
                confirmLabel="Approve & generate key"
                busy={!!busyId}
                onConfirm={onApproveConfirmed}
                onCancel={() => setApproveTarget(null)}
            />

            {/* ── Reject prompt modal ── */}
            <PromptModal
                open={!!rejectTarget}
                variant="warning"
                title="Reject registration"
                message="Provide a reason for rejecting this registration request."
                placeholder="e.g. Incomplete information, duplicate application…"
                confirmLabel="Reject request"
                required={true}
                busy={!!busyId}
                onConfirm={onRejectConfirmed}
                onCancel={() => setRejectTarget(null)}
            />

            {/* ── Site names modal ── */}
            {selectedRequest && (
                <div className="modal-backdrop" role="presentation" onClick={() => setSelectedRequest(null)}>
                    <div
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="modal__title">Site Names</h3>
                        <p className="modal__desc">
                            {selectedRequest.company_name} — {selectedRequest.number_of_sites} site{selectedRequest.number_of_sites > 1 ? 's' : ''}
                        </p>
                        <div style={{ marginTop: '1.5rem' }}>
                            {selectedRequest.site_names.map((site, index) => (
                                <div key={index} style={{
                                    padding: '0.75rem',
                                    background: 'var(--surface-2)',
                                    borderRadius: '6px',
                                    marginBottom: '0.5rem',
                                    fontWeight: 500
                                }}>
                                    {index + 1}. {site}
                                </div>
                            ))}
                        </div>
                        {selectedRequest.rejection_reason && (
                            <div style={{ marginTop: '1.5rem' }}>
                                <strong>Rejection Reason:</strong>
                                <div style={{
                                    padding: '0.75rem',
                                    background: 'var(--rose-light)',
                                    borderRadius: '6px',
                                    marginTop: '0.5rem',
                                    color: 'var(--rose-dark)'
                                }}>
                                    {selectedRequest.rejection_reason}
                                </div>
                            </div>
                        )}
                        <div className="modal__actions">
                            <button type="button" className="btn btn-primary" onClick={() => setSelectedRequest(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Subscription key modal ── */}
            {showKeyModal && (
                <div className="modal-backdrop" role="presentation" onClick={() => setShowKeyModal(null)}>
                    <div
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="modal__title">Subscription Key</h3>
                        <p className="modal__desc">
                            Share this key with the site owner for account activation
                        </p>
                        <div style={{
                            marginTop: '1.5rem',
                            padding: '1rem',
                            background: 'var(--surface-2)',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '1rem',
                            wordBreak: 'break-all',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem'
                        }}>
                            <span>{showKeyModal}</span>
                            <button
                                type="button"
                                className="btn-icon"
                                onClick={() => copyToClipboard(showKeyModal)}
                                title="Copy to clipboard"
                            >
                                <Copy size={18} />
                            </button>
                        </div>
                        <div className="modal__actions">
                            <button type="button" className="btn btn-primary" onClick={() => setShowKeyModal(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default RegistrationRequests
