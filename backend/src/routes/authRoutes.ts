import { Router } from 'express'
import bcrypt from 'bcrypt'
import { requireAuth, signToken, isAllowedAdminEmail } from '../middleware/auth'
import { pool, mapUser, publicUser, mapRequest } from '../services/portalMappers'

const router = Router()

function withAllowlistFlag<T extends { role?: string; email?: string } | null>(user: T): T {
  if (!user || user.role !== 'SYSTEM_ADMIN') return user
  return { ...user, sysadminAllowlisted: isAllowedAdminEmail(user.email) }
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const result = await pool().query('SELECT * FROM app_user WHERE LOWER(email) = LOWER($1)', [email])
  const row = result.rows[0]
  const user = mapUser(row)
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  // Login itself is not gated by the sysadmin allowlist — a SYSTEM_ADMIN account
  // may exist purely for the portal's owner-request/subscription admin screens
  // (mounted at /api/admin), which the allowlist has no say over. The allowlist
  // is the source of truth only for the sysadmin *monitoring* dashboard: it's
  // enforced on /auth/admin-signup and on every /api/sysadmin/* route via
  // requireAdminAllowlist. `sysadminAllowlisted` just lets the sysadmin frontend
  // know, right after login, whether this account can actually use it.
  const authUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  }

  return res.json({
    token: signToken(authUser),
    user: withAllowlistFlag(publicUser(row)),
  })
})

router.post('/admin-signup', async (req, res) => {
  const { fullName, email, password } = req.body as {
    fullName?: string
    email?: string
    password?: string
  }

  if (!fullName?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' })
  }
  if (password.length < 10) {
    return res.status(400).json({ error: 'Password must be at least 10 characters' })
  }
  if (!isAllowedAdminEmail(email)) {
    return res.status(403).json({ error: 'This email is not authorized to create a System Admin account' })
  }

  const existing = await pool().query('SELECT id FROM app_user WHERE LOWER(email) = LOWER($1)', [email])
  if (existing.rowCount) {
    return res.status(409).json({ error: 'An account with this email already exists' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const inserted = await pool().query(
    `INSERT INTO app_user (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'SYSTEM_ADMIN')
     RETURNING *`,
    [email.trim(), passwordHash, fullName.trim()],
  )
  const row = inserted.rows[0]

  const authUser = {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
  }

  return res.status(201).json({
    token: signToken(authUser),
    user: withAllowlistFlag(publicUser(row)),
  })
})

router.post('/request-access', async (req, res) => {
  const { fullName, email, companyName, phone, message } = req.body as {
    fullName?: string
    email?: string
    companyName?: string
    phone?: string
    message?: string
  }

  if (!fullName || !email || !companyName || !phone) {
    return res.status(400).json({ error: 'Full name, email, company, and phone are required' })
  }

  const existingUser = await pool().query('SELECT id FROM app_user WHERE LOWER(email) = LOWER($1)', [email])
  if (existingUser.rowCount) {
    return res.status(409).json({ error: 'An account with this email already exists' })
  }

  const pending = await pool().query(
    `SELECT id FROM owner_request WHERE LOWER(email) = LOWER($1) AND status = 'PENDING'`,
    [email],
  )
  if (pending.rowCount) {
    return res.status(409).json({ error: 'A request with this email is already pending' })
  }

  const inserted = await pool().query(
    `INSERT INTO owner_request (full_name, email, company_name, phone, message, status)
     VALUES ($1, $2, $3, $4, $5, 'PENDING')
     RETURNING *`,
    [fullName, email, companyName, phone, message || null],
  )

  const request = mapRequest(inserted.rows[0])
  return res.status(201).json({
    message: 'Request submitted. A System Admin will review it shortly.',
    request: { id: request.id, status: request.status },
  })
})

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool().query('SELECT * FROM app_user WHERE id = $1', [req.user!.id])
  const user = publicUser(result.rows[0])
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json(withAllowlistFlag(user))
})

export default router
