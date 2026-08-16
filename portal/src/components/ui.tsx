import React from 'react'
import { AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react'

type AlertProps = {
  variant: 'error' | 'success'
  message: string
  onDismiss?: () => void
  actionLabel?: string
  onAction?: () => void
}

export const Alert: React.FC<AlertProps> = ({
  variant,
  message,
  onDismiss,
  actionLabel,
  onAction,
}) => (
  <div className={`alert alert--${variant}`} role="alert">
    <span className="alert__icon">
      {variant === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
    </span>
    <span className="alert__text">{message}</span>
    <div className="alert__actions">
      {actionLabel && onAction && (
        <button type="button" className="alert__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button type="button" className="alert__dismiss" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  </div>
)

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="loading-state">
    <Loader2 className="spin" size={28} />
    <span>{label}</span>
  </div>
)

export const EmptyState: React.FC<{
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}> = ({ icon, title, description, action }) => (
  <div className="empty-state">
    {icon && <div className="empty-state__icon">{icon}</div>}
    <h3 className="empty-state__title">{title}</h3>
    {description && <p className="empty-state__desc">{description}</p>}
    {action}
  </div>
)

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`status-badge ${status}`}>{status.replace(/_/g, ' ')}</span>
)
