import React from 'react'
import { Users } from 'lucide-react'
import { EmptyState } from './ui'
import { ClassificationFilter } from './ClassificationFilter'
import { useClassificationFilter } from '../hooks/useClassificationFilter'
import { formatBreaks, formatHours, formatLateMinutes, formatTime, formatWage } from '../lib/format'
import type { DailyReportRow } from '../types'

const AttendanceTable: React.FC<{
  rows: DailyReportRow[]
  emptyTitle?: string
}> = ({
  rows,
  emptyTitle = 'No attendance yet',
}) => {
    const classFilter = useClassificationFilter(rows, w => w.classification)

    if (rows.length === 0) {
      return (
        <EmptyState icon={<Users size={24} />} title={emptyTitle} />
      )
    }

    return (
      <>
        <ClassificationFilter
          groups={classFilter.groups}
          selected={classFilter.selected}
          onSelect={classFilter.setSelected}
        />
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
              {classFilter.filtered.map(w => (
                <tr key={w.worker_id}>
                  <td>
                    <strong>{w.worker_number}</strong>
                  </td>
                  <td>{w.full_name}</td>
                  <td>{formatTime(w.entry_time)}</td>
                  <td>{formatTime(w.exit_time)}</td>
                  <td>
                    {w.late_minutes ? (
                      <span className={`status-badge incomplete`}>{formatLateMinutes(w.late_minutes)}</span>
                    ) : (
                      <span className="status-badge active">On time</span>
                    )}
                  </td>
                  <td>{formatBreaks(w.break_count, w.break_minutes)}</td>
                  <td>{formatHours(w.hours_worked)}</td>
                  <td>{formatWage(w.daily_wage)}</td>
                  <td>
                    <span className={`status-badge ${w.exit_time ? 'completed' : 'active'}`}>
                      {w.exit_time ? 'Completed' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

export default AttendanceTable
