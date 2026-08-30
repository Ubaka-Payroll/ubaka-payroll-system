import { useState } from 'react'
import { KeyRound, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react'
import Logo from '../components/Logo'
import api from '../services/api'
import { useToast } from '../components/Toast'

interface EngineerLoginProps {
    onLoginSuccess: () => void
}

export default function EngineerLogin({ onLoginSuccess }: EngineerLoginProps) {
    const { success, error: toastError } = useToast()
    const [mode, setMode] = useState<'key' | 'credentials'>('key')
    const [loading, setLoading] = useState(false)

    // Key mode state
    const [activationKey, setActivationKey] = useState('')

    // Credentials mode state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleKeySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activationKey.trim()) return

        setLoading(true)
        try {
            const response = await api.post('/auth/engineer-login', {
                activationKey: activationKey.trim()
            })

            const { token, user } = response.data
            localStorage.setItem('ubaka_engineer_token', token)
            localStorage.setItem('ubaka_engineer_data', JSON.stringify(user))

            success(`Activated site: ${user.siteName || user.companyName}`)
            onLoginSuccess()
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Invalid activation key. Please check with your Site Owner.'
            toastError(msg)
        } finally {
            setLoading(false)
        }
    }

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || !password) return

        setLoading(true)
        try {
            const response = await api.post('/auth/engineer-login', {
                email: email.trim(),
                password
            })

            const { token, user } = response.data
            localStorage.setItem('ubaka_engineer_token', token)
            localStorage.setItem('ubaka_engineer_data', JSON.stringify(user))

            success(`Welcome back, ${user.fullName}`)
            onLoginSuccess()
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Invalid email or password'
            toastError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--canvas)',
            padding: '2rem'
        }}>
            <div style={{ maxWidth: '440px', width: '100%' }}>
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--ink)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        marginBottom: '1.25rem',
                        boxShadow: 'var(--shadow)'
                    }}>
                        <Logo style={{ width: 36, height: 35, color: '#ffffff' }} />
                    </div>
                    <h1 style={{
                        fontSize: '1.625rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-logo)',
                        color: 'var(--text)',
                        letterSpacing: '-0.02em',
                        margin: 0
                    }}>
                        UBAKA
                    </h1>
                    <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.375rem',
                        fontWeight: 500
                    }}>
                        Attendance & Site Operations App
                    </p>
                </div>

                {/* Main Auth Panel */}
                <div className="panel" style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow)',
                    overflow: 'hidden'
                }}>
                    {/* Tab Navigation */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        background: 'var(--surface-2)',
                        padding: '0.375rem',
                        borderBottom: '1px solid var(--border)'
                    }}>
                        <button
                            type="button"
                            onClick={() => setMode('key')}
                            style={{
                                padding: '0.75rem 0.5rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                background: mode === 'key' ? 'var(--surface)' : 'transparent',
                                color: mode === 'key' ? 'var(--text)' : 'var(--text-muted)',
                                fontWeight: mode === 'key' ? 700 : 500,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                boxShadow: mode === 'key' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.15s var(--ease)'
                            }}
                        >
                            <KeyRound size={16} />
                            Activation Key
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('credentials')}
                            style={{
                                padding: '0.75rem 0.5rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                background: mode === 'credentials' ? 'var(--surface)' : 'transparent',
                                color: mode === 'credentials' ? 'var(--text)' : 'var(--text-muted)',
                                fontWeight: mode === 'credentials' ? 700 : 500,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                boxShadow: mode === 'credentials' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.15s var(--ease)'
                            }}
                        >
                            <Mail size={16} />
                            Account Login
                        </button>
                    </div>

                    <div className="panel__body" style={{ padding: '1.75rem' }}>
                        {mode === 'key' ? (
                            <form onSubmit={handleKeySubmit}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div>
                                        <label style={{
                                            display: 'block',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            color: 'var(--text)',
                                            marginBottom: '0.5rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em'
                                        }}>
                                            Site Activation Key <span style={{ color: 'var(--rose)' }}>*</span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <KeyRound size={18} style={{
                                                position: 'absolute',
                                                left: '0.875rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: 'var(--text-faint)'
                                            }} />
                                            <input
                                                type="text"
                                                placeholder="e.g. UBK-XXXX-YYYY-ZZZZ"
                                                value={activationKey}
                                                onChange={e => setActivationKey(e.target.value.toUpperCase())}
                                                required
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 0.875rem 0.75rem 2.75rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border)',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.9375rem',
                                                    letterSpacing: '0.05em',
                                                    color: 'var(--text)',
                                                    background: 'var(--surface)'
                                                }}
                                            />
                                        </div>
                                        <p style={{
                                            fontSize: '0.8125rem',
                                            color: 'var(--text-muted)',
                                            marginTop: '0.5rem',
                                            lineHeight: 1.45
                                        }}>
                                            Enter the activation key generated by your Site Owner to authorize this device.
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading || !activationKey.trim()}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--ink)',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {loading ? 'Activating Device…' : (
                                            <>
                                                Activate & Connect
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleCredentialsSubmit}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div className="form-group">
                                        <label style={{
                                            display: 'block',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            color: 'var(--text)',
                                            marginBottom: '0.5rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em'
                                        }}>
                                            Engineer Email <span style={{ color: 'var(--rose)' }}>*</span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Mail size={18} style={{
                                                position: 'absolute',
                                                left: '0.875rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: 'var(--text-faint)'
                                            }} />
                                            <input
                                                type="email"
                                                placeholder="engineer@company.com"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                required
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 0.875rem 0.75rem 2.75rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border)',
                                                    fontSize: '0.9375rem',
                                                    color: 'var(--text)',
                                                    background: 'var(--surface)'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label style={{
                                            display: 'block',
                                            fontSize: '0.8125rem',
                                            fontWeight: 700,
                                            color: 'var(--text)',
                                            marginBottom: '0.5rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em'
                                        }}>
                                            Password <span style={{ color: 'var(--rose)' }}>*</span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Lock size={18} style={{
                                                position: 'absolute',
                                                left: '0.875rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: 'var(--text-faint)'
                                            }} />
                                            <input
                                                type="password"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                required
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 0.875rem 0.75rem 2.75rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border)',
                                                    fontSize: '0.9375rem',
                                                    color: 'var(--text)',
                                                    background: 'var(--surface)'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading || !email.trim() || !password}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--ink)',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {loading ? 'Authenticating…' : (
                                            <>
                                                Sign In as Field Engineer
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer Security Note */}
                <div style={{
                    marginTop: '1.5rem',
                    textAlign: 'center',
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                }}>
                    <ShieldCheck size={16} color="var(--text-faint)" />
                    <span>Encrypted & Scoped to Authorized Site Owner</span>
                </div>
            </div>
        </div>
    )
}
