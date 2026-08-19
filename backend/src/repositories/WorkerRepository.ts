import { BaseRepository } from './BaseRepository'
import { Worker } from '../models/types'

export class WorkerRepository extends BaseRepository<Worker> {
  constructor() {
    super('worker')
  }

  async findByNID(nid: string): Promise<Worker | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE nid = $1`
    const result = await this.pool.query(query, [nid])
    return result.rows[0] || null
  }

  async findByWorkerNumber(workerNumber: string): Promise<Worker | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE worker_number = $1`
    const result = await this.pool.query(query, [workerNumber])
    return result.rows[0] || null
  }

  async findByClassification(classification: string): Promise<Worker[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE classification = $1 AND is_active = true`
    const result = await this.pool.query(query, [classification])
    return result.rows
  }

  async findActiveWorkers(): Promise<Worker[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE is_active = true ORDER BY full_name`
    const result = await this.pool.query(query)
    return result.rows
  }

  async searchWorkers(searchTerm: string): Promise<Worker[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE (
        full_name ILIKE $1
        OR worker_number ILIKE $1
        OR nid ILIKE $1
      )
      AND is_active = true
      ORDER BY full_name
    `
    const result = await this.pool.query(query, [`%${searchTerm}%`])
    return result.rows
  }

  async deactivateWorker(id: number): Promise<Worker> {
    return this.update(id, { is_active: false } as Partial<Worker>)
  }

  async getNextWorkerNumber(): Promise<string> {
    const query = `
      SELECT worker_number FROM ${this.tableName}
      WHERE worker_number ~ '^W[0-9]+$'
      ORDER BY CAST(SUBSTRING(worker_number FROM 2) AS INTEGER) DESC
      LIMIT 1
    `
    const result = await this.pool.query(query)
    if (result.rows.length === 0) {
      return 'W001'
    }
    const lastNumber = result.rows[0].worker_number
    const match = lastNumber.match(/^W([0-9]+)$/)
    if (!match) {
      return 'W001'
    }
    const nextNum = parseInt(match[1], 10) + 1
    return `W${nextNum.toString().padStart(3, '0')}`
  }

  async checkDuplicateFingerprint(fingerprintData: Buffer): Promise<boolean> {
    const query = `SELECT COUNT(*) FROM ${this.tableName} WHERE fingerprint_data = $1`
    const result = await this.pool.query(query, [fingerprintData])
    return parseInt(result.rows[0].count) > 0
  }

  async listClassifications(): Promise<string[]> {
    const query = `
      SELECT name FROM worker_classification
      UNION
      SELECT DISTINCT classification AS name
      FROM ${this.tableName}
      WHERE classification IS NOT NULL AND TRIM(classification) <> ''
    `
    const result = await this.pool.query(query)
    return result.rows.map(row => row.name as string)
  }

  async addClassification(name: string): Promise<string> {
    const query = `
      INSERT INTO worker_classification (name, is_builtin)
      VALUES ($1, FALSE)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING name
    `
    const result = await this.pool.query(query, [name])
    return result.rows[0].name as string
  }
}
