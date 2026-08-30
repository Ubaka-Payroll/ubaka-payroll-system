import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Mail, Phone, User, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../components/Toast'

export default function OwnerRegister() {
    const { push } = useToast()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        confirm_password: '',
        phone: '',
        company_name: '',
        number_of_sites: 1,
        site_names: ['']
    })

    const handleSiteCountChange = (count: number) => {
        const newSiteNames = Array(count).fill('').map((_, i) => formData.site_names[i] || '')
        setFormData({ ...formData, number_of_sites: count, site_names: newSiteNames })
    }

    const handleSiteNameChange = (index: number, value: string) => {
        const newSiteNames = [...formData.site_names]
        newSiteNames[index] = value
        setFormData({ ...formData, site_names: newSiteNames })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (formData.password.length < 6) {
            push('Password must be at least 6 characters long', 'error')
            return
        }

        if (formData.password !== formData.confirm_password) {
            push('Passwords do not match', 'error')
            return
        }

        setLoading(true)

        try {
            const payload = {
                full_name: formData.full_name,
                email: formData.email,
                password: formData.password,
                phone: formData.phone,
                company_name: formData.company_name,
                number_of_sites: formData.number_of_sites,
                site_names: formData.site_names
            }
            await api.post('/owner-registration/register', payload)
            setSuccess(true)
        } catch (error: any) {
            const message = error.response?.data?.error || 'Registration failed. Please try again.'
            push(message, 'error')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
                <div style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
                    <div className="panel" style={{ textAlign: 'center' }}>
                        <div className="panel__body" style={{ padding: '3rem 2rem' }}>
                            <CheckCircle size={64} color="var(--teal)" style={{ margin: '0 auto 1.5rem' }} />
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text)' }}>
                                Registration Submitted
                            </h1>
                            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
                                Your request has been submitted and is pending admin approval. Once approved, your account will be activated and you can log in directly using your email and password.
                            </p>
                            <Link to="/login" className="btn btn-primary">
                                Back to Login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', padding: '2rem' }}>
            <div style={{ maxWidth: '600px', width: '100%' }}>
                <div className="panel">
                    <div className="panel__head" style={{ textAlign: 'center', padding: '2rem 1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h1 className="panel__title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', margin: 0, textAlign: 'center' }}>
                            Owner Registration
                        </h1>
                        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0, textAlign: 'center', lineHeight: 1.5 }}>
                            Register your construction sites for attendance tracking
                        </p>
                    </div>
                    <div className="panel__body">
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Personal Information */}
                                <div className="form-group">
                                    <label>Full Name <span style={{ color: 'var(--rose)' }}>*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <User size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            required
                                            style={{ paddingLeft: '2.5rem' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Email <span style={{ color: 'var(--rose)' }}>*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <Mail size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            style={{ paddingLeft: '2.5rem' }}
                                        />
                                    </div>
                                </div>

                                {/* Password Fields */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>Password <span style={{ color: 'var(--rose)' }}>*</span></label>
                                        <div style={{ position: 'relative' }}>
                                            <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                required
                                                minLength={6}
                                                placeholder="At least 6 characters"
                                                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '0.75rem',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    color: 'var(--text-muted)'
                                                }}
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Confirm Password <span style={{ color: 'var(--rose)' }}>*</span></label>
                                        <div style={{ position: 'relative' }}>
                                            <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                value={formData.confirm_password}
                                                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                                                required
                                                placeholder="Repeat password"
                                                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '0.75rem',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    color: 'var(--text-muted)'
                                                }}
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Phone</label>
                                    <div style={{ position: 'relative' }}>
                                        <Phone size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            style={{ paddingLeft: '2.5rem' }}
                                        />
                                    </div>
                                </div>

                                {/* Company Information */}
                                <div className="form-group">
                                    <label>Company Name <span style={{ color: 'var(--rose)' }}>*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <Building2 size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            value={formData.company_name}
                                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                            required
                                            style={{ paddingLeft: '2.5rem' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Number of Sites <span style={{ color: 'var(--rose)' }}>*</span></label>
                                    <select
                                        value={formData.number_of_sites}
                                        onChange={(e) => handleSiteCountChange(parseInt(e.target.value))}
                                        required
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                            <option key={num} value={num}>{num}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Site Names */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>
                                        Site Names <span style={{ color: 'var(--rose)' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {formData.site_names.map((name, index) => (
                                            <input
                                                key={index}
                                                type="text"
                                                placeholder={`Site ${index + 1} Name`}
                                                value={name}
                                                onChange={(e) => handleSiteNameChange(index, e.target.value)}
                                                required
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
                                    {loading ? 'Submitting...' : 'Submit Registration'}
                                </button>

                                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Already have an account? <Link to="/login" style={{ color: 'var(--teal)', fontWeight: 600 }}>Login</Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
