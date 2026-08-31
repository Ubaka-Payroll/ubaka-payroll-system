import { Pool, PoolConfig } from 'pg'
import * as dotenv from 'dotenv'
import { runMigrations } from './migrations'

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || undefined })

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ubaka_attendance',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

class DatabaseManager {
  private static instance: DatabaseManager
  private pool: Pool

  private constructor() {
    this.pool = new Pool(poolConfig)
    this.setupPoolEvents()
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  private setupPoolEvents(): void {
    this.pool.on('connect', () => {
      console.log('Database connection established')
    })

    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err)
    })
  }

  public getPool(): Pool {
    return this.pool
  }

  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()
      console.log('Database connection test successful')
      await runMigrations(this.pool)
      return true
    } catch (error) {
      console.error('Database connection test failed:', error)
      return false
    }
  }

  public async executeTransaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  public async close(): Promise<void> {
    await this.pool.end()
    console.log('Database connections closed')
  }
}

export default DatabaseManager
