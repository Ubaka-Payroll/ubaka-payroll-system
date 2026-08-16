import { Router } from 'express'
import bcrypt from 'bcrypt'
import { requireAuth, signToken } from '../middleware/auth'
import { pool, mapUser, publicUser, mapRequest } from '../services/portalMappers'

const router = Router()

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

  const authUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  }

  return res.json({
    token: signToken(authUser),
    user: publicUser(row),
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
  return res.json(user)
})

export default router
