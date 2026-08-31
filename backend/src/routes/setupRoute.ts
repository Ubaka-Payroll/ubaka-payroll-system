/**
 * ONE-TIME SETUP ROUTE — Delete after first use in production
 * POST /api/setup/seed-admin
 * Body: { secret: "ubaka-setup-2024", email, password, fullName }
 */
import { Router } from 'express'
import bcrypt from 'bcrypt'
import { pool, publicUser } from '../services/portalMappers'
import { signToken } from '../middleware/auth'

const router = Router()

const SETUP_SECRET = process.env.SETUP_SECRET || 'ubaka-setup-2024'

router.post('/seed-admin', async (req, res) => {
  const { secret, email, password, fullName } = req.body as {
    secret?: string
    email?: string
    password?: string
    fullName?: string
  }

  if (secret !== SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret' })
  }

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password, and fullName required' })
  }

  const existing = await pool().query('SELECT id, email, role FROM app_user WHERE LOWER(email) = LOWER($1)', [email])
  if (existing.rowCount) {
    // If already exists, just reset the password
    const hash = await bcrypt.hash(password, 10)
    await pool().query('UPDATE app_user SET password_hash = $1, full_name = $2 WHERE LOWER(email) = LOWER($3)', [hash, fullName, email])
    const updated = await pool().query('SELECT * FROM app_user WHERE LOWER(email) = LOWER($1)', [email])
    const row = updated.rows[0]
    const authUser = { id: row.id, email: row.email, role: row.role, fullName: row.full_name }
    return res.json({ message: 'Admin password updated', token: signToken(authUser as any), user: publicUser(row) })
  }

  const hash = await bcrypt.hash(password, 10)
  const inserted = await pool().query(
    `INSERT INTO app_user (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'SYSTEM_ADMIN') RETURNING *`,
    [email, hash, fullName],
  )
  const row = inserted.rows[0]
  const authUser = { id: row.id, email: row.email, role: row.role, fullName: row.full_name }
  return res.status(201).json({ message: 'Admin created', token: signToken(authUser as any), user: publicUser(row) })
})

export default router
