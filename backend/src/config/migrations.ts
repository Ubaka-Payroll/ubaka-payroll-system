import { Pool } from 'pg'
import { logger } from '../utils/Logger'

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect()
  try {
    logger.info('Running database column auto-migrations...')

    const migrationQueries = [
      // Multi-tenancy columns on core attendance tables
      `ALTER TABLE worker ADD COLUMN IF NOT EXISTS owner_id UUID;`,
      `ALTER TABLE worker ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);`,

      `ALTER TABLE attendance_event ADD COLUMN IF NOT EXISTS owner_id UUID;`,
      `ALTER TABLE attendance_event ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);`,

      `ALTER TABLE daily_wage ADD COLUMN IF NOT EXISTS owner_id UUID;`,
      `ALTER TABLE daily_wage ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);`,

      `ALTER TABLE attendance_anomaly ADD COLUMN IF NOT EXISTS owner_id UUID;`,
      `ALTER TABLE attendance_anomaly ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);`,

      // Owner request & user portal columns
      `ALTER TABLE owner_request ADD COLUMN IF NOT EXISTS password_hash TEXT;`,
      `ALTER TABLE owner_request ADD COLUMN IF NOT EXISTS reviewed_by UUID;`,
      `ALTER TABLE owner_request ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;`,
      `ALTER TABLE owner_request ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`,

      `ALTER TABLE app_user ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);`,
      `ALTER TABLE app_user ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`,

      `ALTER TABLE activation_key ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);`,
      `ALTER TABLE activation_key ADD COLUMN IF NOT EXISTS engineer_id UUID;`,

      `ALTER TABLE field_engineer ADD COLUMN IF NOT EXISTS user_id UUID;`,
      `ALTER TABLE field_engineer ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);`,
      `ALTER TABLE field_engineer ADD COLUMN IF NOT EXISTS activation_key_id UUID;`,
      `ALTER TABLE field_engineer ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;`
    ]

    for (const query of migrationQueries) {
      await client.query(query)
    }

    logger.info('Database column auto-migrations completed successfully.')
  } catch (error) {
    logger.error('Failed executing database auto-migrations', error as Error)
  } finally {
    client.release()
  }
}
