import React, { useEffect, useRef, useState } from 'react'
import { Trash2, Ban, CheckCircle, Info } from 'lucide-react'

type Variant = 'danger' | 'warning' | 'info' | 'success'

interface ConfirmModalProps {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: Variant
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

const variantStyles: Record<Variant, { icon: React.ReactNode; color: string; btnClass: string }> = {
    danger: {
        icon: <Trash2 size={22} />,
        color: 'var(--rose)',
        btnClass: 'btn btn-danger',
    },
    warning: {
        icon: <Ban size={22} />,
        color: 'var(--amber)',
        btnClass: 'btn btn-warning',
    },
    info: {
        icon: <Info size={22} />,
        color: 'var(--teal)',
        btnClass: 'btn btn-primary',
    },
    success: {
        icon: <CheckCircle size={22} />,
        color: 'var(--teal)',
        btnClass: 'btn btn-primary',
    },
}

export function ConfirmModal({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'info',
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const confirmRef = useRef<HTMLButtonElement>(null)
    const { icon, color, btnClass } = variantStyles[variant]

    useEffect(() => {
        if (open) confirmRef.current?.focus()
    }, [open])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!open) return
            if (e.key === 'Escape') onCancel()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onCancel])

    if (!open) return null

    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onClick={onCancel}
            style={{ zIndex: 1000 }}
        >
            <div
                className="modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-desc"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '440px' }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{
                        flexShrink: 0,
                        width: 44, height: 44,
                        borderRadius: '50%',
                        background: `color-mix(in srgb, ${color} 12%, transparent)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color,
                    }}>
                        {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3
                            id="confirm-title"
                            className="modal__title"
                            style={{ marginBottom: '0.35rem' }}
                        >
                            {title}
                        </h3>
                        <p
                            id="confirm-desc"
                            className="modal__desc"
                            style={{ marginBottom: 0 }}
                        >
                            {message}
                        </p>
                    </div>
                </div>
                <div className="modal__actions" style={{ marginTop: '1.75rem' }}>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        className={btnClass}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? 'Please wait…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

interface PromptModalProps {
    open: boolean
    title: string
    message: string
    placeholder?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: Variant
    busy?: boolean
    required?: boolean
    onConfirm: (value: string) => void
    onCancel: () => void
}

export function PromptModal({
    open,
    title,
    message,
    placeholder = '',
    confirmLabel = 'Submit',
    cancelLabel = 'Cancel',
    variant = 'warning',
    busy = false,
    required = true,
    onConfirm,
    onCancel,
}: PromptModalProps) {
    const [value, setValue] = useState('')
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const { icon, color, btnClass } = variantStyles[variant]

    useEffect(() => {
        if (open) {
            setValue('')
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [open])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!open) return
            if (e.key === 'Escape') onCancel()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onCancel])

    if (!open) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (required && !value.trim()) return
        onConfirm(value.trim())
    }

    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onClick={onCancel}
            style={{ zIndex: 1000 }}
        >
            <div
                className="modal modal--form"
                role="dialog"
                aria-modal="true"
                aria-labelledby="prompt-title"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '480px' }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                        flexShrink: 0,
                        width: 44, height: 44,
                        borderRadius: '50%',
                        background: `color-mix(in srgb, ${color} 12%, transparent)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color,
                    }}>
                        {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3
                            id="prompt-title"
                            className="modal__title"
                            style={{ marginBottom: '0.35rem' }}
                        >
                            {title}
                        </h3>
                        <p className="modal__desc" style={{ marginBottom: 0 }}>
                            {message}
                        </p>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <textarea
                            ref={inputRef}
                            rows={3}
                            className="form-control"
                            placeholder={placeholder}
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            disabled={busy}
                            required={required}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                    <div className="modal__actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={onCancel}
                            disabled={busy}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="submit"
                            className={btnClass}
                            disabled={busy || (required && !value.trim())}
                        >
                            {busy ? 'Please wait…' : confirmLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
