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

router.post('/engineer-login', async (req, res) => {
  const { activationKey, email, password } = req.body as {
    activationKey?: string
    email?: string
    password?: string
  }

  // Option 1: Login via Activation Key (issued by site owner)
  if (activationKey?.trim()) {
    const trimmedKey = activationKey.trim()
    const keyRes = await pool().query(
      `SELECT k.*, u.company_name as owner_company, u.full_name as owner_name, e.id as field_engineer_id, e.full_name as engineer_name
       FROM activation_key k
       JOIN app_user u ON u.id = k.owner_id
       LEFT JOIN field_engineer e ON e.id = k.engineer_id
       WHERE UPPER(k.key) = UPPER($1)`,
      [trimmedKey],
    )

    if (!keyRes.rows[0]) {
      return res.status(404).json({ error: 'Invalid activation key. Please check with your Site Owner.' })
    }

    const keyRow = keyRes.rows[0]
    if (keyRow.status === 'EXPIRED') {
      return res.status(400).json({ error: 'This activation key has expired.' })
    }

    // Mark key as USED if it was AVAILABLE
    if (keyRow.status === 'AVAILABLE') {
      await pool().query(
        `UPDATE activation_key SET status = 'USED', used_at = NOW() WHERE id = $1`,
        [keyRow.id],
      )
    }

    // Update field_engineer status to ACTIVE
    await pool().query(
      `UPDATE field_engineer SET status = 'ACTIVE', activated_at = NOW()
       WHERE id = $1 OR activation_key_id = $2`,
      [keyRow.field_engineer_id || null, keyRow.id],
    )

    const siteName = keyRow.site_name || `${keyRow.owner_company || 'Site'} Main`
    const engineerName = keyRow.engineer_name || `Engineer (${keyRow.owner_company || 'Site'})`

    const authUser = {
      id: keyRow.field_engineer_id || keyRow.id,
      email: `engineer-${keyRow.id.slice(0, 8)}@ubaka.local`,
      role: 'FIELD_ENGINEER' as const,
      fullName: engineerName,
      ownerId: keyRow.owner_id,
      engineerId: keyRow.field_engineer_id || keyRow.id,
      siteName,
    }

    const token = signToken(authUser)
    return res.json({
      success: true,
      token,
      user: {
        id: authUser.id,
        fullName: authUser.fullName,
        role: authUser.role,
        ownerId: authUser.ownerId,
        siteName: authUser.siteName,
        companyName: keyRow.owner_company,
        ownerName: keyRow.owner_name,
        activationKey: keyRow.key,
      },
    })
  }

  // Option 2: Login via Email and Password
  if (email?.trim() && password) {
    const userRes = await pool().query('SELECT * FROM app_user WHERE LOWER(email) = LOWER($1)', [email.trim()])
    const row = userRes.rows[0]
    const user = mapUser(row)
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const engRes = await pool().query(
      `SELECT e.*, u.company_name as owner_company
       FROM field_engineer e
       JOIN app_user u ON u.id = e.owner_id
       WHERE e.user_id = $1 OR LOWER(e.email) = LOWER($2)
       LIMIT 1`,
      [user.id, email.trim()],
    )
    const eng = engRes.rows[0]
    const ownerId = eng?.owner_id || user.id
    const siteName = eng?.site_name || 'Construction Site'

    const authUser = {
      id: user.id,
      email: user.email,
      role: 'FIELD_ENGINEER' as const,
      fullName: user.fullName,
      ownerId,
      engineerId: eng?.id || user.id,
      siteName,
    }

    const token = signToken(authUser)
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: 'FIELD_ENGINEER',
        ownerId,
        siteName,
        companyName: eng?.owner_company || user.companyName,
      },
    })
  }

  return res.status(400).json({ error: 'Activation key or Email & Password required' })
})

router.get('/engineer-me', requireAuth, async (req, res) => {
  const user = req.user!
  const ownerRes = await pool().query('SELECT company_name, full_name FROM app_user WHERE id = $1', [user.ownerId || user.id])
  const owner = ownerRes.rows[0]

  return res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    ownerId: user.ownerId || user.id,
    siteName: user.siteName || 'Construction Site',
    companyName: owner?.company_name || 'Ubaka MIS',
    ownerName: owner?.full_name || '',
  })
})

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool().query('SELECT * FROM app_user WHERE id = $1', [req.user!.id])
  const user = publicUser(result.rows[0])
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.json(withAllowlistFlag(user))
})

export default router
