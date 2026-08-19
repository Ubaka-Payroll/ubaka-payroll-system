import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { workerService } from '../services/workerService'
import { useToast } from './Toast'

const OTHER = 'OTHER'

const FALLBACK_CLASSIFICATIONS = [
  'MASON',
  'CARPENTER',
  'ELECTRICIAN',
  'PLUMBER',
  'LABORER',
  'SUPERVISOR',
  'OPERATOR',
  OTHER,
]

type ClassificationFieldProps = {
  id?: string
  name?: string
  value: string
  disabled?: boolean
  required?: boolean
  onChange: (classification: string) => void
}

export type ClassificationFieldHandle = {
  commitPending: () => Promise<string | null>
}

const ClassificationField = forwardRef<ClassificationFieldHandle, ClassificationFieldProps>(
  function ClassificationField(
    { id = 'classification', name = 'classification', value, disabled, required, onChange },
    ref
  ) {
    const toast = useToast()
    const customInputRef = useRef<HTMLInputElement>(null)
    const commitRef = useRef<Promise<string | null> | null>(null)
    const [options, setOptions] = useState<string[]>(FALLBACK_CLASSIFICATIONS)
    const [customName, setCustomName] = useState('')
    const [saving, setSaving] = useState(false)
    const showCustom = value === OTHER

    useEffect(() => {
      let cancelled = false
      workerService
        .getClassifications()
        .then(list => {
          if (!cancelled && Array.isArray(list) && list.length > 0) {
            setOptions(list)
          }
        })
        .catch(() => {
          // Keep the built-in list if the API is unavailable
        })
      return () => {
        cancelled = true
      }
    }, [])

    useEffect(() => {
      if (showCustom) {
        customInputRef.current?.focus()
      } else {
        setCustomName('')
      }
    }, [showCustom])

    const mergeOption = (classification: string) => {
      setOptions(prev => {
        const withoutOther = prev.filter(item => item !== OTHER)
        if (withoutOther.includes(classification)) {
          return [...withoutOther, OTHER]
        }
        return [...withoutOther, classification, OTHER]
      })
    }

    const commitCustomName = async (): Promise<string | null> => {
      if (commitRef.current) return commitRef.current

      const next = customName.trim().replace(/\s+/g, ' ').toUpperCase()
      if (!next) return null
      if (next === OTHER) {
        toast.error('Enter a specific classification name')
        return null
      }

      const task = (async () => {
        try {
          setSaving(true)
          const saved = await workerService.addClassification(next)
          mergeOption(saved)
          onChange(saved)
          setCustomName('')
          toast.success(`${saved} added to classifications`)
          return saved
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to add classification')
          return null
        } finally {
          setSaving(false)
          commitRef.current = null
        }
      })()

      commitRef.current = task
      return task
    }

    useImperativeHandle(ref, () => ({
      commitPending: async () => {
        if (value !== OTHER) return value || null
        return commitCustomName()
      },
    }))

    const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value
      setCustomName('')
      onChange(next)
    }

    const selectOptions = value && !options.includes(value) ? [value, ...options] : options

    return (
      <>
        <select
          id={id}
          name={name}
          value={value}
          onChange={handleSelectChange}
          required={required}
          disabled={disabled || saving}
        >
          {selectOptions.map(cls => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        {showCustom && (
          <div className="classification-other">
            <label htmlFor={`${id}-other`}>
              New classification <span className="required">*</span>
            </label>
            <input
              ref={customInputRef}
              type="text"
              id={`${id}-other`}
              name={`${name}Other`}
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onBlur={() => {
                void commitCustomName()
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void commitCustomName()
                }
              }}
              placeholder="e.g. Welder"
              maxLength={100}
              disabled={disabled || saving}
            />
          </div>
        )}
      </>
    )
  }
)

export default ClassificationField
