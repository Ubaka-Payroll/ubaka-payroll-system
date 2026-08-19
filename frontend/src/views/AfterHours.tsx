import React, { useEffect, useState } from 'react'
import { Timer, CheckCircle2, Hourglass } from 'lucide-react'
import { attendanceService, AfterHoursCase } from '../services/attendanceService'
import { LoadingState, EmptyState } from '../components/ui'
import { ClassificationFilter } from '../components/ClassificationFilter'
import { useClassificationFilter } from '../hooks/useClassificationFilter'
import { filterByClassification } from '../lib/groupByClassification'
import { useToast } from '../components/Toast'

function formatTime(timeStr: string | null) {
  if (!timeStr) return '—'
  return new Date(timeStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatWage(wage: number | null) {
  if (wage == null) return '—'
  return `${Number(wage).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const AfterHours: React.FC = () => {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [afterHoursToday, setAfterHoursToday] = useState(false)
  const [pending, setPending] = useState<AfterHoursCase[]>([])
  const [overtimeOpen, setOvertimeOpen] = useState<AfterHoursCase[]>([])
  const [resolved, setResolved] = useState<AfterHoursCase[]>([])
  const [overtimeCase, setOvertimeCase] = useState<AfterHoursCase | null>(null)
  const [delayedCase, setDelayedCase] = useState<AfterHoursCase | null>(null)
  const [overtimeEnd, setOvertimeEnd] = useState('')
  const [notes, setNotes] = useState('')

  const loadQueue = async (opts: { silent?: boolean } = {}) => {
    try {
      if (!opts.silent) setLoading(true)
      const data = await attendanceService.getAfterHoursQueue()
      setAfterHoursToday(data.afterHoursToday)
      setPending(data.pending)
      setOvertimeOpen(data.overtimeOpen)
      setResolved(data.resolved)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load after-hours queue')
    } finally {
      if (!opts.silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
    const id = window.setInterval(() => loadQueue({ silent: true }), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const resolve = async (
    item: AfterHoursCase,
    decision: 'OVERTIME' | 'DELAYED_LEAVE',
    overtimeEndTime?: string | null
  ) => {
    try {
      setSavingId(item.workerId)
      await attendanceService.resolveAfterHours({
        workerId: item.workerId,
        date: item.workDate,
        decision,
        overtimeEndTime: overtimeEndTime || null,
        notes: notes.trim() || undefined,
        reviewedBy: 'Field Engineer',
      })
      toast.success(
        decision === 'OVERTIME'
          ? `${item.fullName} marked as overtime`
          : `${item.fullName} marked as delayed leaving`
      )
      setOvertimeCase(null)
      setDelayedCase(null)
      setNotes('')
      await loadQueue({ silent: true })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save decision')
    } finally {
      setSavingId(null)
    }
  }

  const handleDelayed = (item: AfterHoursCase) => {
    setOvertimeCase(null)
    setDelayedCase(item)
  }

  const openOvertime = (item: AfterHoursCase) => {
    const now = new Date()
    setDelayedCase(null)
    setOvertimeEnd(toLocalInputValue(now))
    setNotes('')
    setOvertimeCase(item)
  }

  const queueItems = [...pending, ...overtimeOpen, ...resolved]
  const classFilter = useClassificationFilter(queueItems, item => item.classification)
  const pendingView = filterByClassification(pending, item => item.classification, classFilter.selected)
  const overtimeView = filterByClassification(
    overtimeOpen,
    item => item.classification,
    classFilter.selected
  )
  const resolvedView = filterByClassification(resolved, item => item.classification, classFilter.selected)

  if (loading) return <LoadingState label="Loading after-hours queue…" />

  return (
    <div className="after-hours">
      <ClassificationFilter
        className="classification-filter--page"
        groups={classFilter.groups}
        selected={classFilter.selected}
        onSelect={classFilter.setSelected}
      />
      <div className="panel" style={{ marginBottom: '1.25rem' }}>
        <div className="panel__head">
          <h2 className="panel__title">Needs a decision ({pendingView.length})</h2>
          <Timer size={18} color="var(--text-faint)" />
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {pending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={24} />}
              title="No pending checkouts"
              description={
                afterHoursToday
                  ? 'Everyone who needed a decision has been reviewed, or all workers have already checked out.'
                  : 'This list fills after 6:00 PM.'
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Worker #</th>
                    <th>Name</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Pay so far</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingView.map(item => (
                    <tr key={`${item.workerId}-${item.workDate}`}>
                      <td>{formatDate(item.workDate)}</td>
                      <td>
                        <strong>{item.workerNumber}</strong>
                      </td>
                      <td>{item.fullName}</td>
                      <td>{formatTime(item.entryTime)}</td>
                      <td>{item.exitTime ? formatTime(item.exitTime) : 'Still on site'}</td>
                      <td>{formatWage(item.wageAmount)}</td>
                      <td>
                        <div className="after-hours__actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={savingId === item.workerId}
                            onClick={() => handleDelayed(item)}
                          >
                            Delayed leaving
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={savingId === item.workerId}
                            onClick={() => openOvertime(item)}
                          >
                            Worked overtime
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

      {overtimeView.length > 0 && (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel__head">
            <h2 className="panel__title">Overtime in progress ({overtimeView.length})</h2>
            <Hourglass size={18} color="var(--text-faint)" />
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Worker #</th>
                    <th>Name</th>
                    <th>Entry</th>
                    <th>Hours so far</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overtimeView.map(item => (
                    <tr key={`ot-${item.workerId}-${item.workDate}`}>
                      <td>{formatDate(item.workDate)}</td>
                      <td>
                        <strong>{item.workerNumber}</strong>
                      </td>
                      <td>{item.fullName}</td>
                      <td>{formatTime(item.entryTime)}</td>
                      <td>
                        {item.hoursWorked != null ? `${Number(item.hoursWorked).toFixed(2)}h` : '—'}
                      </td>
                      <td>
                        <span className="status-badge review">Waiting for checkout</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {resolvedView.length > 0 && (
        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Reviewed today ({resolvedView.length})</h2>
            <CheckCircle2 size={18} color="var(--text-faint)" />
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker #</th>
                    <th>Name</th>
                    <th>Decision</th>
                    <th>Exit</th>
                    <th>Pay</th>
                    <th>Reviewed by</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedView.map(item => (
                    <tr key={`done-${item.workerId}-${item.workDate}`}>
                      <td>
                        <strong>{item.workerNumber}</strong>
                      </td>
                      <td>{item.fullName}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            item.decision === 'OVERTIME' ? 'active' : 'incomplete'
                          }`}
                        >
                          {item.decision === 'OVERTIME' ? 'Overtime' : 'Delayed leaving'}
                        </span>
                      </td>
                      <td>{formatTime(item.exitTime)}</td>
                      <td>{formatWage(item.wageAmount)}</td>
                      <td>{item.reviewedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {delayedCase && (
        <div
          className="after-hours__modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delayed-title"
        >
          <div className="after-hours__modal">
            <h3 id="delayed-title">Mark {delayedCase.fullName} as delayed leaving?</h3>
            <p>
              Pay will stop at 5:00 PM. They stayed past the 5–6 checkout window but were not
              working overtime.
            </p>
            <div className="after-hours__actions" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDelayedCase(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingId === delayedCase.workerId}
                onClick={() => resolve(delayedCase, 'DELAYED_LEAVE')}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {overtimeCase && (
        <div className="after-hours__modal-backdrop" role="dialog" aria-modal="true">
          <div className="after-hours__modal">
            <h3>Overtime for {overtimeCase.fullName}</h3>
            <div className="form-group">
              <label htmlFor="overtime-end">Overtime end time</label>
              <input
                id="overtime-end"
                type="datetime-local"
                value={overtimeEnd}
                onChange={e => setOvertimeEnd(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="overtime-notes">Notes (optional)</label>
              <textarea
                id="overtime-notes"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What they were working on…"
              />
            </div>
            <div className="after-hours__actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOvertimeCase(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingId === overtimeCase.workerId}
                onClick={() => resolve(overtimeCase, 'OVERTIME')}
              >
                Wait for checkout
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingId === overtimeCase.workerId || !overtimeEnd}
                onClick={() =>
                  resolve(overtimeCase, 'OVERTIME', new Date(overtimeEnd).toISOString())
                }
              >
                Save end time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AfterHours
