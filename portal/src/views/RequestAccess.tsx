import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { Alert } from '../components/ui'
import { requestAccess } from '../services/api'

const RequestAccess: React.FC = () => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    companyName: '',
    phone: '',
    message: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const data = await requestAccess(form)
      setSuccess(data.message)
      setForm({ fullName: '', email: '', companyName: '', phone: '', message: '' })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Could not submit request'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--wide">
        <div className="auth-brand">
          <Logo className="auth-brand__logo" />
          <div className="auth-brand__wordmark">UBAKA</div>
          <p className="auth-brand__tag">Site Owner access request</p>
        </div>

        <h1 className="auth-title">Request access</h1>
        <p className="auth-subtitle">
          Tell us about your company. A System Admin will review and issue your subscription seats.
        </p>

        {error && <Alert variant="error" message={error} onDismiss={() => setError(null)} />}
        {success && <Alert variant="success" message={success} />}

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" name="fullName" value={form.fullName} onChange={onChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={onChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="companyName">Company</label>
              <input
                id="companyName"
                name="companyName"
                value={form.companyName}
                onChange={onChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" value={form.phone} onChange={onChange} required />
            </div>
            <div className="form-group form-group-full">
              <label htmlFor="message">Message (optional)</label>
              <textarea
                id="message"
                name="message"
                rows={3}
                value={form.message}
                onChange={onChange}
                placeholder="How many sites? What do you need Ubaka for?"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <p className="auth-footer">
          Already approved? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default RequestAccess
