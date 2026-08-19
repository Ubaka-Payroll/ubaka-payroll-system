import { BaseRepository } from './BaseRepository'

function toDateParam(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type CheckoutDecision = 'OVERTIME' | 'DELAYED_LEAVE'

export type CheckoutReview = {
  id: number
  worker_id: number
  work_date: string
  decision: CheckoutDecision
  overtime_end_time: Date | string | null
  notes: string | null
  reviewed_by: string | null
  reviewed_at: Date | string
}

export class CheckoutReviewRepository extends BaseRepository<CheckoutReview> {
  private ensured = false

  constructor() {
    super('checkout_review')
  }

  async ensureTable(): Promise<void> {
    if (this.ensured) return
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS checkout_review (
        id SERIAL PRIMARY KEY,
        worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        decision VARCHAR(20) NOT NULL CHECK (decision IN ('OVERTIME', 'DELAYED_LEAVE')),
        overtime_end_time TIMESTAMP,
        notes TEXT,
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (worker_id, work_date)
      )
    `)
    this.ensured = true
  }

  async findByWorkerAndDate(workerId: number, date: Date): Promise<CheckoutReview | null> {
    await this.ensureTable()
    const result = await this.pool.query(
      `SELECT * FROM checkout_review WHERE worker_id = $1 AND work_date = $2::date`,
      [workerId, toDateParam(date)],
    )
    return result.rows[0] || null
  }

  async upsert(input: {
    workerId: number
    workDate: Date
    decision: CheckoutDecision
    overtimeEndTime?: Date | null
    notes?: string | null
    reviewedBy?: string | null
  }): Promise<CheckoutReview> {
    await this.ensureTable()
    const result = await this.pool.query(
      `
      INSERT INTO checkout_review (
        worker_id, work_date, decision, overtime_end_time, notes, reviewed_by, reviewed_at
      )
      VALUES ($1, $2::date, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (worker_id, work_date)
      DO UPDATE SET
        decision = EXCLUDED.decision,
        overtime_end_time = EXCLUDED.overtime_end_time,
        notes = EXCLUDED.notes,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        input.workerId,
        toDateParam(input.workDate),
        input.decision,
        input.overtimeEndTime ?? null,
        input.notes ?? null,
        input.reviewedBy ?? 'Field Engineer',
      ],
    )
    return result.rows[0]
  }

  async listOpenCases(days = 30): Promise<Array<Record<string, unknown>>> {
    await this.ensureTable()
    const result = await this.pool.query(
      `
      WITH flags AS (
        SELECT
          DATE(ae.timestamp) AS work_date,
          ae.worker_id,
          MIN(CASE WHEN ae.event_type = 'ENTRY' THEN ae.timestamp END) AS entry_time,
          MAX(CASE WHEN ae.event_type = 'EXIT' THEN ae.timestamp END) AS exit_time
        FROM attendance_event ae
        WHERE ae.timestamp >= CURRENT_DATE - ($1::int || ' days')::interval
        GROUP BY DATE(ae.timestamp), ae.worker_id
      )
      SELECT
        f.work_date::text AS work_date,
        f.worker_id,
        f.entry_time,
        f.exit_time,
        w.worker_number,
        w.full_name,
        w.classification,
        w.hourly_rate,
        dw.hours_worked,
        dw.wage_amount,
        cr.decision,
        cr.overtime_end_time,
        cr.notes,
        cr.reviewed_at,
        cr.reviewed_by
      FROM flags f
      JOIN worker w ON w.id = f.worker_id
      LEFT JOIN daily_wage dw ON dw.worker_id = f.worker_id AND dw.work_date = f.work_date
      LEFT JOIN checkout_review cr ON cr.worker_id = f.worker_id AND cr.work_date = f.work_date
      WHERE f.entry_time IS NOT NULL
      ORDER BY f.work_date DESC, w.full_name
      `,
      [days],
    )
    return result.rows
  }
}
