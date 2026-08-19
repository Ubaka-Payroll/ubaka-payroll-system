import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { pool, mapSubscription, mapEngineer, mapKey } from '../services/portalMappers'
import { listAttendanceReports, getAttendanceReport, getTodayReport, getSiteSnapshot, listSiteWorkers } from '../services/PortalReportService'

const router = Router()

router.use(requireAuth, requireRole('SITE_OWNER'))

router.get('/overview', async (req, res) => {
  const ownerId = req.user!.id
  const [sub, engineers, keys, reports, site, todayReport] = await Promise.all([
    pool().query(`SELECT * FROM subscription WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1`, [ownerId]),
    pool().query(`SELECT * FROM field_engineer WHERE owner_id = $1`, [ownerId]),
    pool().query(`SELECT * FROM activation_key WHERE owner_id = $1`, [ownerId]),
    listAttendanceReports(ownerId),
    getSiteSnapshot(ownerId),
    getTodayReport(ownerId),
  ])

  const latest = todayReport || (reports[0] ? await getAttendanceReport(ownerId, reports[0].reportDate) : null)

  return res.json({
    subscription: sub.rows[0] ? mapSubscription(sub.rows[0]) : null,
    site,
    engineerCount: engineers.rowCount || 0,
    activeEngineers: engineers.rows.filter((e) => e.status === 'ACTIVE').length,
    keysAvailable: keys.rows.filter((k) => k.status === 'AVAILABLE').length,
    keysUsed: keys.rows.filter((k) => k.status === 'USED' || k.status === 'ASSIGNED').length,
    workerCount: site.workerCount,
    todayReport,
    latestReport: latest,
    recentReports: reports.slice(0, 7),
  })
})

router.get('/site', async (req, res) => {
  return res.json(await getSiteSnapshot(req.user!.id))
})

router.get('/workers', async (_req, res) => {
  return res.json(await listSiteWorkers())
})

router.get('/engineers', async (req, res) => {
  const result = await pool().query(
    `SELECT e.*, k.key AS activation_key
     FROM field_engineer e
     LEFT JOIN activation_key k ON k.id = e.activation_key_id
     WHERE e.owner_id = $1
     ORDER BY e.created_at DESC`,
    [req.user!.id],
  )
  return res.json(result.rows.map(mapEngineer))
})

router.post('/engineers', async (req, res) => {
  const ownerId = req.user!.id
  const { fullName, email, phone, siteName } = req.body as {
    fullName?: string
    email?: string
    phone?: string
    siteName?: string
  }

  if (!fullName || !email || !siteName) {
    return res.status(400).json({ error: 'Full name, email, and site name are required' })
  }

  const sub = await pool().query(
    `SELECT * FROM subscription WHERE owner_id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [ownerId],
  )
  if (!sub.rows[0]) {
    return res.status(403).json({ error: 'Active subscription required to create engineers' })
  }

  const available = await pool().query(
    `SELECT * FROM activation_key WHERE owner_id = $1 AND status = 'AVAILABLE' LIMIT 1`,
    [ownerId],
  )
  if (!available.rows[0]) {
    return res.status(400).json({
      error: 'No available activation keys. Ask System Admin to issue more seats.',
    })
  }

  const duplicate = await pool().query(
    `SELECT id FROM field_engineer WHERE owner_id = $1 AND LOWER(email) = LOWER($2)`,
    [ownerId, email],
  )
  if (duplicate.rowCount) {
    return res.status(409).json({ error: 'An engineer with this email already exists' })
  }

  await pool().query('BEGIN')
  try {
    const engineer = await pool().query(
      `INSERT INTO field_engineer (owner_id, full_name, email, phone, site_name, status, activation_key_id)
       VALUES ($1, $2, $3, $4, $5, 'PENDING_ACTIVATION', $6)
       RETURNING *`,
      [ownerId, fullName, email, phone || null, siteName, available.rows[0].id],
    )

    await pool().query(
      `UPDATE activation_key
       SET status = 'ASSIGNED', engineer_id = $2, site_name = $3
       WHERE id = $1`,
      [available.rows[0].id, engineer.rows[0].id, siteName],
    )
    await pool().query('COMMIT')

    return res.status(201).json({
      ...mapEngineer({ ...engineer.rows[0], activation_key: available.rows[0].key }),
      message: 'Share the activation key with the Field Engineer to unlock the desktop app.',
    })
  } catch (err) {
    await pool().query('ROLLBACK')
    throw err
  }
})

router.get('/keys', async (req, res) => {
  const result = await pool().query(
    `SELECT k.*, e.full_name AS engineer_name, e.email AS engineer_email
     FROM activation_key k
     LEFT JOIN field_engineer e ON e.id = k.engineer_id
     WHERE k.owner_id = $1
     ORDER BY k.created_at DESC`,
    [req.user!.id],
  )
  return res.json(result.rows.map(mapKey))
})

router.get('/reports', async (req, res) => {
  const reports = await listAttendanceReports(req.user!.id)
  return res.json(reports)
})

router.get('/reports/:id', async (req, res) => {
  const report = await getAttendanceReport(req.user!.id, req.params.id)
  if (!report) return res.status(404).json({ error: 'Report not found' })
  return res.json(report)
})

export default router
