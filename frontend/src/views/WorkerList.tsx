import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, Eye, Pencil, Trash2, Users } from 'lucide-react'
import { workerService, Worker } from '../services/workerService'
import { Alert, LoadingState, EmptyState } from '../components/ui'
import { ClassificationFilter } from '../components/ClassificationFilter'
import { useClassificationFilter } from '../hooks/useClassificationFilter'

const WorkerList: React.FC = () => {
  const navigate = useNavigate()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadWorkers()
  }, [])

  const loadWorkers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await workerService.getAllWorkers(false)
      setWorkers(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load workers')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)
      const data = await workerService.searchWorkers(searchTerm)
      setWorkers(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async (id: number, name: string) => {
    if (!confirm(`Deactivate ${name}? They will no longer appear as active.`)) return
    try {
      await workerService.deactivateWorker(id)
      await loadWorkers()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to deactivate worker')
    }
  }

  const classFilter = useClassificationFilter(workers, worker => worker.classification)

  if (loading && workers.length === 0) return <LoadingState label="Loading workers…" />

  return (
    <div className="worker-list">
      <div className="toolbar">
        <form className="search-bar" onSubmit={handleSearch}>
          <Search className="search-bar__icon" size={18} />
          <input
            type="search"
            placeholder="Search name, worker #, or NID…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" style={{ padding: '0.5rem 0.9rem' }}>
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSearchTerm('')
                loadWorkers()
              }}
            >
              Clear
            </button>
          )}
        </form>
        <button className="btn btn-primary" onClick={() => navigate('/register')}>
          <UserPlus size={18} />
          Register worker
        </button>
      </div>

      {error && (
        <Alert variant="error" message={error} actionLabel="Retry" onAction={loadWorkers} />
      )}

      <ClassificationFilter
        className="classification-filter--page"
        groups={classFilter.groups}
        selected={classFilter.selected}
        onSelect={classFilter.setSelected}
      />

      <div className="meta-chip">
        <Users size={14} />
        {classFilter.filtered.length} worker{classFilter.filtered.length === 1 ? '' : 's'}
      </div>

      {workers.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Users size={24} />}
            title="No workers found"
            description="Register your first worker to start tracking attendance."
            action={
              <button className="btn btn-primary" onClick={() => navigate('/register')}>
                <UserPlus size={18} />
                Register first worker
              </button>
            }
          />
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker #</th>
                  <th>Name</th>
                  <th>NID</th>
                  <th>Phone</th>
                  <th>Hourly rate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classFilter.filtered.map(worker => (
                  <tr key={worker.id}>
                    <td>
                      <strong>{worker.worker_number}</strong>
                    </td>
                    <td>{worker.full_name}</td>
                    <td>{worker.nid}</td>
                    <td>{worker.phone_number || '—'}</td>
                    <td>{parseFloat(String(worker.hourly_rate)).toFixed(0)} RWF</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon"
                          title="View details"
                          onClick={() => navigate(`/workers/${worker.id}`)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit"
                          onClick={() => navigate(`/workers/${worker.id}`)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          title="Deactivate"
                          onClick={() => handleDeactivate(worker.id, worker.full_name)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkerList
