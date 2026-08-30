import { BaseRepository } from './BaseRepository'
import { AttendanceEvent, EventType } from '../models/types'

export class AttendanceEventRepository extends BaseRepository<AttendanceEvent> {
  constructor() {
    super('attendance_event')
  }

  async findByWorkerAndDate(workerId: number, date: Date): Promise<AttendanceEvent[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE worker_id = $1
      AND DATE(timestamp) = DATE($2)
      ORDER BY timestamp ASC
    `
    const result = await this.pool.query(query, [workerId, date])
    return result.rows
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AttendanceEvent[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE timestamp >= $1 AND timestamp <= $2
      ORDER BY timestamp ASC
    `
    const result = await this.pool.query(query, [startDate, endDate])
    return result.rows
  }

  async getLastEventForWorker(workerId: number, date: Date): Promise<AttendanceEvent | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE worker_id = $1
      AND DATE(timestamp) = DATE($2)
      ORDER BY timestamp DESC
      LIMIT 1
    `
    const result = await this.pool.query(query, [workerId, date])
    return result.rows[0] || null
  }

  async getWorkerAttendanceHistory(
    workerId: number,
    days: number = 30
  ): Promise<AttendanceEvent[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE worker_id = $1
      AND timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp DESC
    `
    const result = await this.pool.query(query, [workerId])
    return result.rows
  }

  async recordEvent(
    workerId: number,
    eventType: EventType,
    timestamp: Date,
    isManualEntry: boolean = false,
    createdBy?: string,
    ownerId?: string
  ): Promise<AttendanceEvent> {
    const query = `
      INSERT INTO ${this.tableName} (worker_id, event_type, timestamp, is_manual_entry, created_by, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `
    const result = await this.pool.query(query, [
      workerId,
      eventType,
      timestamp,
      isManualEntry,
      createdBy || null,
      ownerId || null,
    ])
    return result.rows[0]
  }

  async getDailyAttendanceSummary(date: Date, ownerId?: string): Promise<any[]> {
    if (!ownerId) {
      return []
    }
    const query = `
      SELECT
        w.id as worker_id,
        w.worker_number,
        w.full_name,
        w.classification,
        w.hourly_rate,
        MIN(CASE WHEN ae.event_type = 'ENTRY' THEN ae.timestamp END) as entry_time,
        MAX(CASE WHEN ae.event_type = 'EXIT' THEN ae.timestamp END) as exit_time,
        COUNT(CASE WHEN ae.event_type = 'LEAVE_SITE' THEN 1 END)::int as break_count,
        dw.hours_worked,
        dw.wage_amount as daily_wage
      FROM worker w
      INNER JOIN ${this.tableName} ae ON w.id = ae.worker_id
      LEFT JOIN daily_wage dw ON dw.worker_id = w.id AND dw.work_date = DATE($1)
      WHERE DATE(ae.timestamp) = DATE($1) AND (w.owner_id = $2 OR ae.owner_id = $2)
      GROUP BY
        w.id, w.worker_number, w.full_name, w.classification, w.hourly_rate,
        dw.hours_worked, dw.wage_amount
      ORDER BY w.full_name
    `
    const result = await this.pool.query(query, [date, ownerId])
    return result.rows
  }
}
