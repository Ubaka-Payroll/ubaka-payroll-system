import { Router } from 'express'
import bcrypt from 'bcrypt'
import { requireAuth, requireRole } from '../middleware/auth'
import { pool, mapRequest, mapSubscription, makeKey } from '../services/portalMappers'

const router = Router()

router.use(requireAuth, requireRole('SYSTEM_ADMIN'))

router.get('/overview', async (_req, res) => {
  const [pending, owners, activeSubs, engineers, activeEngineers, sites, keysAvailable, keysUsed, recent, subscriptions] =
    await Promise.all([
      pool().query(`SELECT COUNT(*)::int AS n FROM owner_request WHERE status = 'PENDING'`),
      pool().query(`SELECT COUNT(*)::int AS n FROM app_user WHERE role = 'SITE_OWNER'`),
      pool().query(`SELECT COUNT(*)::int AS n FROM subscription WHERE status = 'ACTIVE'`),
      pool().query(`SELECT COUNT(*)::int AS n FROM field_engineer`),
      pool().query(`SELECT COUNT(*)::int AS n FROM field_engineer WHERE status = 'ACTIVE'`),
      pool().query(`SELECT COUNT(DISTINCT site_name)::int AS n FROM field_engineer`),
      pool().query(`SELECT COUNT(*)::int AS n FROM activation_key WHERE status = 'AVAILABLE'`),
      pool().query(`SELECT COUNT(*)::int AS n FROM activation_key WHERE status IN ('ASSIGNED', 'USED')`),
      pool().query(`SELECT * FROM owner_request ORDER BY created_at DESC LIMIT 5`),
      pool().query(
        `SELECT s.*, u.full_name AS owner_name, u.email AS owner_email, u.company_name
         FROM subscription s
         JOIN app_user u ON u.id = s.owner_id
         ORDER BY s.created_at DESC`,
      ),
    ])

  return res.json({
    pendingRequests: pending.rows[0].n,
    owners: owners.rows[0].n,
    activeSubs: activeSubs.rows[0].n,
    engineers: engineers.rows[0].n,
    activeEngineers: activeEngineers.rows[0].n,
    sites: sites.rows[0].n,
    keysAvailable: keysAvailable.rows[0].n,
    keysUsed: keysUsed.rows[0].n,
    recentRequests: recent.rows.map(mapRequest),
    subscriptions: subscriptions.rows.map(mapSubscription),
  })
})

router.get('/requests', async (_req, res) => {
  const result = await pool().query(`SELECT * FROM owner_request ORDER BY created_at DESC`)
  return res.json(result.rows.map(mapRequest))
})

router.post('/requests/:id/approve', async (req, res) => {
  const { id } = req.params
  const seats = Number(req.body?.seats ?? 3)
  const planName = (req.body?.planName as string) || 'Site Standard'

  const found = await pool().query('SELECT * FROM owner_request WHERE id = $1', [id])
  const request = found.rows[0]
  if (!request) return res.status(404).json({ error: 'Request not found' })
  if (request.status !== 'PENDING') {
    return res.status(400).json({ error: 'Request is not pending' })
  }

  const tempPassword = 'welcome123'
  const passwordHash = await bcrypt.hash(tempPassword, 10)
  const keys: string[] = []

  await pool().query('BEGIN')
  try {
    await pool().query(
      `UPDATE owner_request
       SET status = 'APPROVED', reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $1`,
      [id, req.user!.id],
    )

    const owner = await pool().query(
      `INSERT INTO app_user (email, password_hash, full_name, role, company_name, phone)
       VALUES ($1, $2, $3, 'SITE_OWNER', $4, $5)
       RETURNING id`,
      [request.email, passwordHash, request.full_name, request.company_name, request.phone],
    )
    const ownerId = owner.rows[0].id

    await pool().query(
      `INSERT INTO subscription (owner_id, status, plan_name, seats, starts_at, ends_at)
       VALUES ($1, 'ACTIVE', $2, $3, NOW(), NOW() + INTERVAL '1 year')`,
      [ownerId, planName, seats],
    )

    for (let i = 0; i < seats; i += 1) {
      const key = makeKey()
      keys.push(key)
      await pool().query(
        `INSERT INTO activation_key (key, owner_id, status) VALUES ($1, $2, 'AVAILABLE')`,
        [key, ownerId],
      )
    }

    await pool().query('COMMIT')
  } catch (err) {
    await pool().query('ROLLBACK')
    throw err
  }

  return res.json({
    message: 'Site owner approved and account created',
    temporaryPassword: tempPassword,
    activationKeys: keys,
  })
})

router.post('/requests/:id/reject', async (req, res) => {
  const { id } = req.params
  const reason = (req.body?.reason as string) || 'Not approved at this time'
  const found = await pool().query('SELECT * FROM owner_request WHERE id = $1', [id])
  if (!found.rows[0]) return res.status(404).json({ error: 'Request not found' })
  if (found.rows[0].status !== 'PENDING') {
    return res.status(400).json({ error: 'Request is not pending' })
  }

  await pool().query(
    `UPDATE owner_request
     SET status = 'REJECTED', reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
     WHERE id = $1`,
    [id, req.user!.id, reason],
  )
  return res.json({ message: 'Request rejected' })
})

router.patch('/requests/:id', async (req, res) => {
  const { id } = req.params
  const { fullName, email, companyName, phone, message } = req.body as {
    fullName?: string
    email?: string
    companyName?: string
    phone?: string
    message?: string
  }

  const found = await pool().query('SELECT * FROM owner_request WHERE id = $1', [id])
  const request = found.rows[0]
  if (!request) return res.status(404).json({ error: 'Request not found' })

  if (!fullName?.trim() || !email?.trim() || !companyName?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Full name, email, company, and phone are required' })
  }

  const taken = await pool().query(
    `SELECT id FROM owner_request WHERE id <> $1 AND LOWER(email) = LOWER($2)`,
    [id, email.trim()],
  )
  if (taken.rowCount) {
    return res.status(409).json({ error: 'Another request already uses this email' })
  }

  const previousEmail = request.email

  await pool().query('BEGIN')
  try {
    await pool().query(
      `UPDATE owner_request
       SET full_name = $2, email = $3, company_name = $4, phone = $5, message = $6
       WHERE id = $1`,
      [id, fullName.trim(), email.trim(), companyName.trim(), phone.trim(), message?.trim() || null],
    )

    if (request.status === 'APPROVED') {
      await pool().query(
        `UPDATE app_user
         SET full_name = $2, email = $3, company_name = $4, phone = $5
         WHERE role = 'SITE_OWNER' AND LOWER(email) = LOWER($1)`,
        [previousEmail, fullName.trim(), email.trim(), companyName.trim(), phone.trim()],
      )
    }
    await pool().query('COMMIT')
  } catch (err) {
    await pool().query('ROLLBACK')
    throw err
  }

  return res.json({ message: 'Request updated' })
})

router.delete('/requests/:id', async (req, res) => {
  const found = await pool().query('SELECT id FROM owner_request WHERE id = $1', [req.params.id])
  if (!found.rows[0]) return res.status(404).json({ error: 'Request not found' })
  await pool().query('DELETE FROM owner_request WHERE id = $1', [req.params.id])
  return res.json({ message: 'Request deleted' })
})

router.post('/requests/:id/deactivate', async (req, res) => {
  const found = await pool().query('SELECT * FROM owner_request WHERE id = $1', [req.params.id])
  const request = found.rows[0]
  if (!request) return res.status(404).json({ error: 'Request not found' })
  if (request.status === 'DEACTIVATED') {
    return res.status(400).json({ error: 'Request is already deactivated' })
  }
  if (request.status === 'REJECTED') {
    return res.status(400).json({ error: 'Rejected requests cannot be deactivated' })
  }

  await pool().query('BEGIN')
  try {
    await pool().query(
      `UPDATE owner_request
       SET status = 'DEACTIVATED', reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $1`,
      [req.params.id, req.user!.id],
    )

    if (request.status === 'APPROVED') {
      await pool().query(
        `UPDATE subscription SET status = 'SUSPENDED'
         WHERE owner_id IN (
           SELECT id FROM app_user WHERE role = 'SITE_OWNER' AND LOWER(email) = LOWER($1)
         )`,
        [request.email],
      )
    }
    await pool().query('COMMIT')
  } catch (err) {
    await pool().query('ROLLBACK')
    throw err
  }

  return res.json({ message: 'Request deactivated' })
})

router.get('/subscriptions', async (_req, res) => {
  const result = await pool().query(
    `SELECT
       s.*,
       u.full_name AS owner_name,
       u.email AS owner_email,
       u.company_name,
       (SELECT COUNT(*) FROM activation_key k WHERE k.owner_id = s.owner_id)::int AS keys_issued,
       (SELECT COUNT(*) FROM activation_key k WHERE k.owner_id = s.owner_id AND k.status = 'USED')::int AS keys_used
     FROM subscription s
     JOIN app_user u ON u.id = s.owner_id
     ORDER BY s.created_at DESC`,
  )
  return res.json(result.rows.map(mapSubscription))
})

router.post('/subscriptions/:ownerId/keys', async (req, res) => {
  const { ownerId } = req.params
  const count = Math.min(Number(req.body?.count ?? 1), 20)
  const owner = await pool().query(
    `SELECT id FROM app_user WHERE id = $1 AND role = 'SITE_OWNER'`,
    [ownerId],
  )
  if (!owner.rows[0]) return res.status(404).json({ error: 'Site owner not found' })

  const keys: string[] = []
  await pool().query('BEGIN')
  try {
    for (let i = 0; i < count; i += 1) {
      const key = makeKey()
      keys.push(key)
      await pool().query(
        `INSERT INTO activation_key (key, owner_id, status) VALUES ($1, $2, 'AVAILABLE')`,
        [key, ownerId],
      )
    }
    await pool().query(
      `UPDATE subscription
       SET seats = (SELECT COUNT(*)::int FROM activation_key WHERE owner_id = $1)
       WHERE owner_id = $1`,
      [ownerId],
    )
    await pool().query(
      `UPDATE owner_registration_request
       SET number_of_sites = (SELECT COUNT(*)::int FROM activation_key WHERE owner_id = $1)
       WHERE LOWER(email) = (SELECT LOWER(email) FROM app_user WHERE id = $1)`,
      [ownerId],
    )
    await pool().query('COMMIT')
  } catch (err) {
    await pool().query('ROLLBACK')
    throw err
  }

  return res.status(201).json({ keys })
})

router.patch('/subscriptions/:id/seats', async (req, res) => {
  const { id } = req.params
  const seats = Math.max(1, Number(req.body?.seats ?? 1))

  const sub = await pool().query('SELECT * FROM subscription WHERE id = $1', [id])
  if (!sub.rows[0]) return res.status(404).json({ error: 'Subscription not found' })

  const ownerId = sub.rows[0].owner_id
  const currentKeysRes = await pool().query('SELECT COUNT(*)::int AS count FROM activation_key WHERE owner_id = $1', [ownerId])
  const currentKeys = currentKeysRes.rows[0].count

  await pool().query('BEGIN')
  try {
    if (seats > currentKeys) {
      const keysToGenerate = seats - currentKeys
      for (let i = 0; i < keysToGenerate; i++) {
        const key = makeKey()
        await pool().query(
          `INSERT INTO activation_key (key, owner_id, status) VALUES ($1, $2, 'AVAILABLE')`,
          [key, ownerId],
        )
      }
    }

    await pool().query('UPDATE subscription SET seats = $2 WHERE id = $1', [id, seats])
    await pool().query(
      `UPDATE owner_registration_request
       SET number_of_sites = $2
       WHERE LOWER(email) = (SELECT LOWER(email) FROM app_user WHERE id = $1)`,
      [ownerId, seats],
    )
    await pool().query('COMMIT')
  } catch (err) {
    await pool().query('ROLLBACK')
    throw err
  }

  return res.json({ message: 'Subscription seats updated and activation keys synchronized', seats })
})

router.patch('/subscriptions/:id/status', async (req, res) => {
  const status = req.body?.status as string
  if (!['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const found = await pool().query('SELECT id FROM subscription WHERE id = $1', [req.params.id])
  if (!found.rows[0]) return res.status(404).json({ error: 'Subscription not found' })
  await pool().query('UPDATE subscription SET status = $2 WHERE id = $1', [req.params.id, status])
  return res.json({ message: 'Subscription updated' })
})

export default router
