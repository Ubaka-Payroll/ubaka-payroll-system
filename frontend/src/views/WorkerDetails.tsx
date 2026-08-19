import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Save, X, Clock3, Wallet } from 'lucide-react'
import { workerService, Worker } from '../services/workerService'
import { attendanceService } from '../services/attendanceService'
import { Alert, LoadingState, EmptyState } from '../components/ui'
import { useToast } from '../components/Toast'
import ClassificationField, {
  type ClassificationFieldHandle,
} from '../components/ClassificationField'

interface AttendanceRecord {
  date: string
  hoursWorked: number | null
  status: 'COMPLETE' | 'INCOMPLETE'
  entryTime?: string
  exitTime?: string
}

const WorkerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Partial<Worker>>({})
  const classificationRef = useRef<ClassificationFieldHandle>(null)

  useEffect(() => {
    if (id) loadWorkerDetails()
  }, [id])

  const loadWorkerDetails = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const workerData = await workerService.getWorkerById(parseInt(id!))
      setWorker(workerData)
      setEditData(workerData)
      const history = await attendanceService.getWorkerHistory(workerData.id, 30)
      setAttendanceHistory(history)
    } catch (err: any) {
      setLoadError(err.response?.data?.error || 'Failed to load worker details')
    } finally {
      setLoading(false)
    }
  }

  const handleEditToggle = () => {
    if (editMode && worker) setEditData(worker)
    setEditMode(!editMode)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setEditData(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveChanges = async () => {
    if (!worker) return
    let classification = editData.classification
    if (classification === 'OTHER') {
      const committed = await classificationRef.current?.commitPending()
      if (!committed) {
        toast.error('Enter a name for the new classification')
        return
      }
      classification = committed
    }
    try {
      setLoading(true)
      await workerService.updateWorker(worker.id, {
        fullName: editData.full_name,
        phoneNumber: editData.phone_number,
        classification,
        hourlyRate: editData.hourly_rate,
        address: editData.address,
        emergencyContact: editData.emergency_contact,
        emergencyPhone: editData.emergency_phone,
      })
      await loadWorkerDetails()
      setEditMode(false)
      toast.success('Worker updated successfully')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update worker')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!worker) return
    if (!confirm(`Deactivate ${worker.full_name}?`)) return
    try {
      await workerService.deactivateWorker(worker.id)
      toast.success(`${worker.full_name} deactivated`)
      navigate('/workers')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to deactivate worker')
    }
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '—'
    return new Date(timeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

  const calculateTotalHours = () =>
    attendanceHistory
      .filter(record => record.hoursWorked !== null)
      .reduce((sum, record) => sum + (record.hoursWorked || 0), 0)

  const calculateTotalEarnings = () =>
    calculateTotalHours() * (parseFloat(String(worker?.hourly_rate)) || 0)

  if (loading && !worker) return <LoadingState label="Loading worker…" />

  if (loadError && !worker) {
    return (
      <Alert
        variant="error"
        message={loadError}
        actionLabel="Back to workers"
        onAction={() => navigate('/workers')}
      />
    )
  }

  if (!worker) return null

  return (
    <div className="worker-details">
      <div className="details-header">
        <button className="btn btn-ghost" onClick={() => navigate('/workers')}>
          <ArrowLeft size={18} />
          Back to workers
        </button>
        <div className="header-actions">
          <button className="btn btn-info" onClick={() => navigate(`/workers/${id}/timecard`)}>
            <Clock3 size={16} />
            View Time Card
          </button>
          {!editMode ? (
            <>
              <button className="btn btn-secondary" onClick={handleEditToggle}>
                <Pencil size={16} />
                Edit
              </button>
              <button className="btn btn-danger" onClick={handleDeactivate}>
                <Trash2 size={16} />
                Deactivate
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={handleEditToggle}>
                <X size={16} />
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveChanges} disabled={loading}>
                <Save size={16} />
                {loading ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="details-content">
        <div className="panel">
          <div className="panel__head">
            <h3 className="panel__title">{worker.full_name}</h3>
            <span className={`status-badge ${worker.is_active ? 'active' : 'inactive'}`}>
              {worker.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="panel__body">
            <div className="info-grid">
              <div className="info-item">
                <label>Worker number</label>
                <span className="info-value">{worker.worker_number}</span>
              </div>
              <div className="info-item">
                <label>Full name</label>
                {editMode ? (
                  <input
                    type="text"
                    name="full_name"
                    value={editData.full_name || ''}
                    onChange={handleInputChange}
                  />
                ) : (
                  <span className="info-value">{worker.full_name}</span>
                )}
              </div>
              <div className="info-item">
                <label>National ID</label>
                <span className="info-value">{worker.nid}</span>
              </div>
              <div className="info-item">
                <label>Fingerprint</label>
                <span className="info-value" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                  {worker.fingerprint_id ? `${String(worker.fingerprint_id).slice(0, 24)}…` : '—'}
                </span>
              </div>
              <div className="info-item">
                <label htmlFor="worker-classification">Classification</label>
                {editMode ? (
                  <ClassificationField
                    ref={classificationRef}
                    id="worker-classification"
                    name="classification"
                    value={editData.classification || ''}
                    disabled={loading}
                    onChange={classification =>
                      setEditData(prev => ({ ...prev, classification }))
                    }
                  />
                ) : (
                  <span className="info-value">{worker.classification}</span>
                )}
              </div>
              <div className="info-item">
                <label>Hourly rate</label>
                {editMode ? (
                  <input
                    type="number"
                    name="hourly_rate"
                    value={editData.hourly_rate || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="100"
                  />
                ) : (
                  <span className="info-value">
                    {parseFloat(String(worker.hourly_rate)).toFixed(0)} RWF
                  </span>
                )}
              </div>
              <div className="info-item">
                <label>Phone</label>
                {editMode ? (
                  <input
                    type="tel"
                    name="phone_number"
                    value={editData.phone_number || ''}
                    onChange={handleInputChange}
                    maxLength={10}
                  />
                ) : (
                  <span className="info-value">{worker.phone_number || '—'}</span>
                )}
              </div>
              <div className="info-item">
                <label>Registered</label>
                <span className="info-value">
                  {new Date(worker.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="info-item info-item-full">
                <label>Address</label>
                {editMode ? (
                  <textarea
                    name="address"
                    value={editData.address || ''}
                    onChange={handleInputChange}
                    rows={2}
                  />
                ) : (
                  <span className="info-value">{worker.address || '—'}</span>
                )}
              </div>
              <div className="info-item">
                <label>Emergency contact</label>
                {editMode ? (
                  <input
                    type="text"
                    name="emergency_contact"
                    value={editData.emergency_contact || ''}
                    onChange={handleInputChange}
                  />
                ) : (
                  <span className="info-value">{worker.emergency_contact || '—'}</span>
                )}
              </div>
              <div className="info-item">
                <label>Emergency phone</label>
                {editMode ? (
                  <input
                    type="tel"
                    name="emergency_phone"
                    value={editData.emergency_phone || ''}
                    onChange={handleInputChange}
                    maxLength={10}
                  />
                ) : (
                  <span className="info-value">{worker.emergency_phone || '—'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Last 30 days</h3>
          </div>
          <div className="panel__body">
            <div className="summary-stats">
              <div className="summary-stat">
                <span className="stat-label">Total days</span>
                <span className="stat-value">{attendanceHistory.length}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Complete days</span>
                <span className="stat-value">
                  {attendanceHistory.filter(r => r.status === 'COMPLETE').length}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">
                  <Clock3 size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Hours
                </span>
                <span className="stat-value">{calculateTotalHours().toFixed(1)}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">
                  <Wallet size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Earnings
                </span>
                <span className="stat-value">{calculateTotalEarnings().toFixed(0)} RWF</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3 className="panel__title">Attendance history</h3>
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            {attendanceHistory.length === 0 ? (
              <EmptyState
                title="No records"
                description="No attendance in the last 30 days for this worker."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((record, index) => (
                      <tr key={index}>
                        <td>{formatDate(record.date)}</td>
                        <td>{formatTime(record.entryTime)}</td>
                        <td>{formatTime(record.exitTime)}</td>
                        <td>
                          {record.hoursWorked !== null
                            ? `${record.hoursWorked.toFixed(1)}h`
                            : '—'}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${record.status === 'COMPLETE' ? 'completed' : 'incomplete'
                              }`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkerDetails
