import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Alert, LoadingState, EmptyState } from '../../components/ui'
import { fetchReports } from '../../services/api'
import type { DailyReportMeta } from '../../types'

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<DailyReportMeta[]>([])

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setReports(await fetchReports())
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load reports'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingState label="Loading reports…" />

  return (
    <div className="stack-gap">
      {error && <Alert variant="error" message={error} actionLabel="Retry" onAction={load} />}


      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Daily reports</h2>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {reports.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title="No reports yet"
              description="Once engineers record attendance on site, daily reports will show up here."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Site</th>
                    <th>Workers</th>
                    <th>Completed</th>
                    <th>Active</th>
                    <th>Wages (RWF)</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/owner/reports/${r.id}`}>
                          <strong>{r.reportDate}</strong>
                        </Link>
                      </td>
                      <td>{r.siteName}</td>
                      <td>{r.workersPresent}</td>
                      <td>{r.completedShifts}</td>
                      <td>{r.activeOnSite}</td>
                      <td>{r.totalWages.toLocaleString('en-US')}</td>
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

export default Reports
