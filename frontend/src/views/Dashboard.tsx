import React, { useEffect, useState } from 'react'
import { Users, CheckCircle2, Activity, CalendarDays, Wallet, Clock, AlertCircle, TrendingUp, Eye } from 'lucide-react'
import { attendanceService } from '../services/attendanceService'
import attendanceCalculationService, { DailyWorkSummary } from '../services/attendanceCalculationService'
import { LoadingState, EmptyState } from '../components/ui'
import { ClassificationFilter } from '../components/ClassificationFilter'
import { useClassificationFilter } from '../hooks/useClassificationFilter'
import { filterByClassification } from '../lib/groupByClassification'
import { useToast } from '../components/Toast'

interface DailySummary {
  worker_id: number
  worker_number: string
  full_name: string
  classification: string
  hourly_rate: number
  entry_time: string | null
  exit_time: string | null
  break_count: number
  break_minutes: number | null
  hours_worked: number | null
  daily_wage: number | null
  hours_status?: string
  late_minutes?: number
  checkout_decision?: 'OVERTIME' | 'DELAYED_LEAVE' | null
  needs_after_hours_review?: boolean
}

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DailySummary[]>([])
  const [pendingReview, setPendingReview] = useState<DailyWorkSummary[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const [selectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedSummary, setSelectedSummary] = useState<DailyWorkSummary | null>(null)

  useEffect(() => {
    loadDailySummary()
    loadPendingReview()
    const id = window.setInterval(() => {
      loadDailySummary({ silent: true })
      loadPendingReview()
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const loadDailySummary = async (opts: { silent?: boolean } = {}) => {
    try {
      if (!opts.silent) {
        setLoading(true)
      }
      const data = await attendanceService.getDailySummary()
      setSummary(data)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load daily summary')
    } finally {
      if (!opts.silent) {
        setLoading(false)
      }
    }
  }

  const loadPendingReview = async () => {
    try {
      const summaries = await attendanceCalculationService.getPendingReview()
      setPendingReview(summaries)
    } catch (error: any) {
      console.error('Error loading pending reviews:', error)
    }
  }

  const handleApproveSummary = async (summary: DailyWorkSummary) => {
    try {
      await attendanceCalculationService.approveSummary(summary.id!, 'Supervisor')
      toast.success(`Approved attendance for ${summary.full_name || summary.worker_number || `worker ${summary.worker_id}`}`)
      setShowReviewModal(false)
      setSelectedSummary(null)
      await loadPendingReview()
    } catch (error: any) {
      toast.error('Failed to approve summary')
    }
  }

  const handleOpenReview = (summary: DailyWorkSummary) => {
    setSelectedSummary(summary)
    setShowReviewModal(true)
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—'
    return new Date(timeStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatHours = (hours: number | string | null) => {
    if (hours == null) return '—'
    const numHours = typeof hours === 'string' ? parseFloat(hours) : hours
    return `${isNaN(numHours) ? 0 : numHours.toFixed(2)}h`
  }

  const formatMinutesToHours = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  }

  const formatWage = (wage: number | null) => {
    if (wage == null) return '—'
    return `${Number(wage).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`
  }

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const formatted = isNaN(numAmount) ? 0 : numAmount
    return `${formatted.toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`
  }

  const formatBreaks = (count: number, minutes: number | null) => {
    if (!count && !minutes) return '0'
    if (minutes == null || minutes === 0) return String(count)
    return `${count} (${minutes}m)`
  }

  const classFilter = useClassificationFilter(summary, worker => worker.classification)
  const visible = classFilter.filtered
  const pendingReviewView = filterByClassification(
    pendingReview,
    row => row.classification,
    classFilter.selected
  )

  if (loading) return <LoadingState label="Loading dashboard…" />

  const completed = visible.filter(w => w.exit_time).length
  const active = visible.filter(w => w.entry_time && !w.exit_time).length
  const totalWages = visible.reduce((sum, w) => sum + (Number(w.daily_wage) || 0), 0)

  return (
    <div className="dashboard">
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <CalendarDays size={18} color="var(--text-muted)" />
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <ClassificationFilter
        className="classification-filter--page"
        groups={classFilter.groups}
        selected={classFilter.selected}
        onSelect={classFilter.setSelected}
      />

      <div className="stats-grid stats-grid--4">
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{visible.length}</div>
          <div className="stat-label">Workers present</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Completed shifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value">{active}</div>
          <div className="stat-label">Active on site</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Wallet size={18} />
            </div>
          </div>
          <div className="stat-value stat-value--sm">
            {totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-label">Total wages (RWF)</div>
        </div>
      </div>

      {pendingReviewView.length > 0 && (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
          <div className="panel__head" style={{ background: '#fff1f2', borderColor: '#fecdd3' }}>
            <h2 className="panel__title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} />
                Pending approval ({pendingReviewView.length})
              </div>
            </h2>
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker #</th>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Late</th>
                    <th>Hours</th>
                    <th>Pay</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReviewView.map((summary) => (
                    <tr key={summary.id}>
                      <td><strong>{summary.worker_number || `#${summary.worker_id}`}</strong></td>
                      <td>{summary.full_name || '—'}</td>
                      <td>{summary.work_date}</td>
                      <td>{formatTime(summary.actual_entry_time)}</td>
                      <td>{formatTime(summary.actual_exit_time)}</td>
                      <td>
                        {summary.is_late ? (
                          <span className="status-badge incomplete">
                            {formatMinutesToHours(summary.late_minutes)}
                          </span>
                        ) : (
                          <span className="status-badge active">On time</span>
                        )}
                      </td>
                      <td>{formatHours(summary.regular_hours_net)}</td>
                      <td>{formatCurrency(summary.net_pay)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleOpenReview(summary)}
                            className="btn-icon"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Today's attendance</h2>
          <Clock size={18} color="var(--text-faint)" />
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {summary.length === 0 ? (
            <EmptyState
              icon={<Users size={24} />}
              title="No attendance yet"
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker #</th>
                    <th>Name</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Late</th>
                    <th>Breaks</th>
                    <th>Hours</th>
                    <th>Daily wage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(worker => (
                    <tr key={worker.worker_id}>
                      <td>
                        <strong>{worker.worker_number}</strong>
                      </td>
                      <td>{worker.full_name}</td>
                      <td>{formatTime(worker.entry_time)}</td>
                      <td>{formatTime(worker.exit_time)}</td>
                      <td>
                        {worker.late_minutes ? (
                          <span className="status-badge incomplete">
                            {formatMinutesToHours(worker.late_minutes)}
                          </span>
                        ) : (
                          <span className="status-badge active">On time</span>
                        )}
                      </td>
                      <td>{formatBreaks(worker.break_count, worker.break_minutes)}</td>
                      <td>{formatHours(worker.hours_worked)}</td>
                      <td>{formatWage(worker.daily_wage)}</td>
                      <td>
                        {worker.needs_after_hours_review ? (
                          <span className="status-badge review">Needs review</span>
                        ) : worker.checkout_decision === 'OVERTIME' && !worker.exit_time ? (
                          <span className="status-badge review">Overtime</span>
                        ) : (
                          <span
                            className={`status-badge ${worker.exit_time ? 'completed' : 'active'}`}
                          >
                            {worker.exit_time ? 'Completed' : 'Active'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedSummary && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(28, 29, 36, 0.65)',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: 'min(600px, calc(100vw - 2rem))',
            maxHeight: 'calc(100vh - 4rem)',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)'
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.15rem',
                fontWeight: 650,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={20} />
                Review attendance
              </h3>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* Worker Info */}
              <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="info-item">
                  <label>Worker</label>
                  <div className="info-value">{selectedSummary.full_name || '—'}</div>
                </div>
                <div className="info-item">
                  <label>Worker #</label>
                  <div className="info-value">{selectedSummary.worker_number || `#${selectedSummary.worker_id}`}</div>
                </div>
                <div className="info-item">
                  <label>Classification</label>
                  <div className="info-value">{selectedSummary.classification || '—'}</div>
                </div>
                <div className="info-item">
                  <label>Work date</label>
                  <div className="info-value">{selectedSummary.work_date}</div>
                </div>
              </div>

              {/* Attendance Status */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Attendance status
                </h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Entry time</label>
                    <div className="info-value">{formatTime(selectedSummary.actual_entry_time)}</div>
                  </div>
                  <div className="info-item">
                    <label>Exit time</label>
                    <div className="info-value">{formatTime(selectedSummary.actual_exit_time)}</div>
                  </div>
                  <div className="info-item">
                    <label>Status</label>
                    <div className="info-value">
                      <span className={`status-badge ${selectedSummary.attendance_status === 'present' ? 'active' :
                        selectedSummary.attendance_status === 'absent' ? 'inactive' :
                          'incomplete'
                        }`}>
                        {selectedSummary.attendance_status}
                      </span>
                    </div>
                  </div>
                  <div className="info-item">
                    <label>Break time</label>
                    <div className="info-value">
                      {selectedSummary.break_minutes_unpaid > 0
                        ? `${selectedSummary.break_minutes_unpaid} min (unpaid)`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Issues Requiring Review */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Issues requiring review
                </h4>
                <div style={{
                  padding: '1rem',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  {selectedSummary.is_late && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Clock size={18} style={{ color: 'var(--rose)', flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--rose)', marginBottom: '0.25rem' }}>
                          Late arrival
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                          Worker arrived <strong>{formatMinutesToHours(selectedSummary.late_minutes)} late</strong> (checked in at {formatTime(selectedSummary.actual_entry_time)}).
                          Work starts at 7:00 AM. Pay is for hours worked after arrival.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSummary.is_early_departure && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Clock size={18} style={{ color: 'var(--rose)', flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--rose)', marginBottom: '0.25rem' }}>
                          Early departure
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                          Worker left <strong>{formatMinutesToHours(selectedSummary.early_departure_minutes)} early</strong> (checked out at {formatTime(selectedSummary.actual_exit_time)}).
                          Pay is for hours actually worked.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSummary.overtime_minutes_actual > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <TrendingUp size={18} style={{ color: '#0284c7', flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: '0.25rem' }}>
                          Overtime worked
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                          Worker completed <strong>{(selectedSummary.overtime_minutes_actual / 60).toFixed(2)} hours overtime</strong>.
                          Additional pay: <strong>{formatCurrency(selectedSummary.overtime_pay)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSummary.has_anomaly && selectedSummary.anomaly_description && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#d97706', marginBottom: '0.25rem' }}>
                          Anomaly detected
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                          {selectedSummary.anomaly_description}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSummary.attendance_status === 'incomplete' && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#d97706', marginBottom: '0.25rem' }}>
                          Incomplete attendance
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                          Missing {!selectedSummary.actual_entry_time ? 'entry' : 'exit'} time.
                          Attendance record is incomplete and requires supervisor review.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Pay Calculation */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Pay calculation
                </h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Hourly rate</label>
                    <div className="info-value">{formatCurrency(selectedSummary.hourly_rate)}</div>
                  </div>
                  <div className="info-item">
                    <label>Hours worked (net)</label>
                    <div className="info-value">{formatHours(selectedSummary.regular_hours_net)}</div>
                  </div>
                  <div className="info-item">
                    <label>Regular pay</label>
                    <div className="info-value">{formatCurrency(selectedSummary.regular_pay)}</div>
                  </div>
                  <div className="info-item">
                    <label>Overtime pay</label>
                    <div className="info-value">
                      {selectedSummary.overtime_pay > 0 ? formatCurrency(selectedSummary.overtime_pay) : '—'}
                    </div>
                  </div>
                  <div className="info-item">
                    <label>Gross pay</label>
                    <div className="info-value" style={{ fontWeight: 700 }}>
                      {formatCurrency(selectedSummary.gross_pay)}
                    </div>
                  </div>
                  <div className="info-item-full">
                    <label>Pay (hours × rate)</label>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'var(--teal)',
                      fontFamily: 'var(--font-display)'
                    }}>
                      {formatCurrency(selectedSummary.net_pay)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface-2)'
            }}>
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setSelectedSummary(null)
                }}
                className="btn btn-secondary"
              >
                Close
              </button>
              <button
                onClick={() => handleApproveSummary(selectedSummary)}
                className="btn btn-primary"
              >
                <CheckCircle2 size={18} />
                Approve for payroll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
