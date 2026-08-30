import bcrypt from 'bcrypt'
import DatabaseManager from './config/database'

async function main() {
  const pool = DatabaseManager.getInstance().getPool()
  const passwordHash = await bcrypt.hash('password123', 10)

  await pool.query(
    `INSERT INTO site_configuration (id, site_name, site_location, opening_time, closing_time)
     VALUES (1, 'Ubaka Main Site', 'Kigali', '07:00', '17:00')
     ON CONFLICT (id) DO UPDATE SET site_name = EXCLUDED.site_name`,
  )

  const admin = await pool.query(
    `INSERT INTO app_user (email, password_hash, full_name, role)
     VALUES ('admin@ubaka.site', $1, 'System Admin', 'SYSTEM_ADMIN')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [passwordHash],
  )

  console.log('System Admin account initialized in ubaka_attendance')
  console.log('Admin login: admin@ubaka.site (password: password123)')
  console.log(`Admin user ID: ${admin.rows[0].id}`)

  await DatabaseManager.getInstance().close()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await DatabaseManager.getInstance().close()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
