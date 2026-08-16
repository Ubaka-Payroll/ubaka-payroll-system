import bcrypt from 'bcrypt'
import DatabaseManager from './config/database'
import { makeKey } from './services/portalMappers'

async function main() {
  const pool = DatabaseManager.getInstance().getPool()
  const passwordHash = await bcrypt.hash('password123', 10)

  await pool.query(
    `INSERT INTO site_configuration (id, site_name, site_location, opening_time, closing_time)
     VALUES (1, 'Kigali Heights Site A', 'Kigali', '07:00', '17:00')
     ON CONFLICT (id) DO UPDATE SET site_name = EXCLUDED.site_name`,
  )

  const admin = await pool.query(
    `INSERT INTO app_user (email, password_hash, full_name, role)
     VALUES ('admin@ubaka.site', $1, 'System Admin', 'SYSTEM_ADMIN')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [passwordHash],
  )

  const owner = await pool.query(
    `INSERT INTO app_user (email, password_hash, full_name, role, company_name, phone)
     VALUES ('owner@demo.site', $1, 'Patrice Habimana', 'SITE_OWNER', 'Habimana Construction Ltd', '+250788000111')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name
     RETURNING id`,
    [passwordHash],
  )
  const ownerId = owner.rows[0].id

  const engineerUser = await pool.query(
    `INSERT INTO app_user (email, password_hash, full_name, role, phone)
     VALUES ('engineer@demo.site', $1, 'Claudine Uwase', 'FIELD_ENGINEER', '+250788000222')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [passwordHash],
  )

  await pool.query(
    `INSERT INTO owner_request (full_name, email, company_name, phone, message, status)
     SELECT 'Diane Uwera', 'diane@buildco.rw', 'BuildCo Rwanda', '+250788000333',
            'We manage 3 construction sites in Kigali and need Ubaka for attendance.', 'PENDING'
     WHERE NOT EXISTS (
       SELECT 1 FROM owner_request WHERE LOWER(email) = 'diane@buildco.rw'
     )`,
  )

  const sub = await pool.query(
    `INSERT INTO subscription (owner_id, status, plan_name, seats, starts_at, ends_at)
     SELECT $1, 'ACTIVE', 'Site Standard', 5, NOW(), NOW() + INTERVAL '1 year'
     WHERE NOT EXISTS (SELECT 1 FROM subscription WHERE owner_id = $1)
     RETURNING id`,
    [ownerId],
  )
  if (!sub.rowCount) {
    await pool.query(
      `UPDATE subscription SET status = 'ACTIVE', seats = GREATEST(seats, 5) WHERE owner_id = $1`,
      [ownerId],
    )
  }

  const existingEngineer = await pool.query(
    `SELECT id FROM field_engineer WHERE owner_id = $1 AND LOWER(email) = 'engineer@demo.site'`,
    [ownerId],
  )

  let engineerId = existingEngineer.rows[0]?.id
  if (!engineerId) {
    const inserted = await pool.query(
      `INSERT INTO field_engineer (owner_id, full_name, email, phone, site_name, status, user_id, activated_at)
       VALUES ($1, 'Claudine Uwase', 'engineer@demo.site', '+250788000222', 'Kigali Heights Site A', 'ACTIVE', $2, NOW())
       RETURNING id`,
      [ownerId, engineerUser.rows[0].id],
    )
    engineerId = inserted.rows[0].id
  }

  const usedKey = await pool.query(
    `SELECT id FROM activation_key WHERE owner_id = $1 AND status = 'USED' LIMIT 1`,
    [ownerId],
  )
  if (!usedKey.rowCount) {
    const key = makeKey()
    const created = await pool.query(
      `INSERT INTO activation_key (key, owner_id, engineer_id, site_name, status, used_at)
       VALUES ($1, $2, $3, 'Kigali Heights Site A', 'USED', NOW())
       RETURNING id`,
      [key, ownerId, engineerId],
    )
    await pool.query(`UPDATE field_engineer SET activation_key_id = $1 WHERE id = $2`, [
      created.rows[0].id,
      engineerId,
    ])
  }

  const available = await pool.query(
    `SELECT id FROM activation_key WHERE owner_id = $1 AND status = 'AVAILABLE' LIMIT 1`,
    [ownerId],
  )
  if (!available.rowCount) {
    await pool.query(
      `INSERT INTO activation_key (key, owner_id, status) VALUES ($1, $2, 'AVAILABLE')`,
      [makeKey(), ownerId],
    )
  }

  console.log('Portal data seeded into ubaka_attendance')
  console.log('Logins (password: password123):')
  console.log('  Admin:    admin@ubaka.site')
  console.log('  Owner:    owner@demo.site')
  console.log('  Engineer: engineer@demo.site')
  console.log(`  Admin user id: ${admin.rows[0].id}`)

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
