import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type ToastVariant = 'success' | 'error'

type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
}

type ToastContextValue = {
  push: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = crypto.randomUUID()
    setItems((prev) => [...prev, { id, message, variant }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.variant}`} role={item.variant === 'error' ? 'alert' : 'status'}>
            <span className="toast__icon">
              {item.variant === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </span>
            <span className="toast__text">{item.message}</span>
            <button
              type="button"
              className="toast__dismiss"
              aria-label="Dismiss"
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
