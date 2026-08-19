import React, { useEffect, useState } from 'react'
import { HardHat } from 'lucide-react'
import { Alert, LoadingState, EmptyState } from '../../components/ui'
import { ClassificationFilter } from '../../components/ClassificationFilter'
import { useClassificationFilter } from '../../hooks/useClassificationFilter'
import { fetchOwnerWorkers } from '../../services/api'
import type { SiteWorker } from '../../types'

const Workers: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workers, setWorkers] = useState<SiteWorker[]>([])

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setWorkers(await fetchOwnerWorkers())
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load workers'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const classFilter = useClassificationFilter(workers, worker => worker.classification)

  if (loading) return <LoadingState label="Loading site workers…" />

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={load} />}

      <ClassificationFilter
        className="classification-filter--page"
        groups={classFilter.groups}
        selected={classFilter.selected}
        onSelect={classFilter.setSelected}
      />

      <div className="meta-chip">
        <HardHat size={14} />
        {classFilter.filtered.length} worker{classFilter.filtered.length === 1 ? '' : 's'} from the desktop roster
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Site workers</h2>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {workers.length === 0 ? (
            <EmptyState
              icon={<HardHat size={24} />}
              title="No workers on this site yet"
              description="Register workers in the Field Engineer desktop app. They appear here automatically."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker #</th>
                    <th>Name</th>
                    <th>NID</th>
                    <th>Phone</th>
                    <th>Hourly rate</th>
                  </tr>
                </thead>
                <tbody>
                  {classFilter.filtered.map(worker => (
                    <tr key={worker.id}>
                      <td>
                        <strong>{worker.workerNumber}</strong>
                      </td>
                      <td>{worker.fullName}</td>
                      <td>{worker.nid}</td>
                      <td>{worker.phoneNumber || '—'}</td>
                      <td>{worker.hourlyRate.toLocaleString('en-US')} RWF</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Workers
