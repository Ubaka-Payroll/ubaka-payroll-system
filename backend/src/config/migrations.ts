import { Pool } from 'pg'
import { logger } from '../utils/Logger'

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect()
  try {
    logger.info('Running database column auto-migrations...')

    const migrationQueries = [
      // Tables required by reporting & portal services
      `CREATE TABLE IF NOT EXISTS owner_registration_request (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        number_of_sites INTEGER DEFAULT 1,
        site_names TEXT[],
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS site_configuration (
        id SERIAL PRIMARY KEY,
        opening_time VARCHAR(20) DEFAULT '07:00',
        closing_time VARCHAR(20) DEFAULT '17:00',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );`,

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
