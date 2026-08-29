import { Router, Request, Response } from 'express'
import { requireAuth, requireRole, requireAdminAllowlist } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { pool } from '../services/portalMappers'
import { logger, LogLevel } from '../utils/Logger'
import * as SystemMetricsService from '../services/SystemMetricsService'
import * as RequestMetricsService from '../services/RequestMetricsService'
import * as DockerMetricsService from '../services/DockerMetricsService'
import * as DatabaseMetricsService from '../services/DatabaseMetricsService'
import { getRedisSnapshot } from '../services/RedisMetricsService'

const router = Router()

router.use(requireAuth, requireRole('SYSTEM_ADMIN'), requireAdminAllowlist)

router.get('/overview', asyncHandler(async (_req: Request, res: Response) => {
  const [host, docker, db, redis] = await Promise.all([
    SystemMetricsService.getHostSnapshot(),
    DockerMetricsService.listContainers(),
    DatabaseMetricsService.getDatabaseSnapshot().catch((err) => ({ error: (err as Error).message })),
    getRedisSnapshot(),
  ])
  const requests = RequestMetricsService.getSnapshot(60)

  res.json({
    host: {
      cpuPercent: host.cpuPercent,
      memPercent: host.memPercent,
      diskPercent: host.diskPercent,
      uptimeSec: host.uptimeSec,
    },
    requests: {
      ratePerMin: requests.ratePerMin,
      activeRequests: requests.activeRequests,
      p50Ms: requests.p50Ms,
      p95Ms: requests.p95Ms,
      p99Ms: requests.p99Ms,
      errorRate:
        requests.statusBuckets['4xx'] + requests.statusBuckets['5xx'] > 0
          ? Number(
              (
                ((requests.statusBuckets['4xx'] + requests.statusBuckets['5xx']) /
                  Math.max(1, requests.ratePerMin === 0 ? 1 : requests.ratePerMin)) *
                100
              ).toFixed(2),
            )
          : 0,
    },
    db: 'error' in db ? { status: 'error' } : { status: 'ok', ...db },
    docker: {
      status: docker.available ? 'ok' : 'unavailable',
      containerCount: docker.containers.length,
      unhealthyCount: docker.containers.filter((c) => c.state !== 'running').length,
    },
    redis: { status: redis.status },
    timestamp: new Date().toISOString(),
  })
}))

router.get('/host', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await SystemMetricsService.getHostSnapshot())
}))

router.get('/requests', asyncHandler(async (_req: Request, res: Response) => {
  res.json(RequestMetricsService.getSnapshot(60))
}))

router.get('/containers', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await DockerMetricsService.listContainers())
}))

router.get('/database', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await DatabaseMetricsService.getDatabaseSnapshot())
}))

router.get('/redis', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getRedisSnapshot())
}))

router.get('/events', asyncHandler(async (req: Request, res: Response) => {
  const level = req.query.level as string | undefined
  const limit = req.query.limit ? Number(req.query.limit) : undefined
  const validLevel = level && Object.values(LogLevel).includes(level as LogLevel) ? (level as LogLevel) : undefined
  res.json({ events: logger.getRecent({ level: validLevel, limit }) })
}))

const RANGE_TO_INTERVAL: Record<string, string> = {
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '7 days',
}

router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const range = (req.query.range as string) || '1h'
  const interval = RANGE_TO_INTERVAL[range]
  if (!interval) {
    return res.status(400).json({ error: 'range must be one of: 1h, 24h, 7d' })
  }

  const result = await pool().query(
    `SELECT created_at, cpu_percent, mem_percent, disk_percent, net_rx_bytes, net_tx_bytes,
            request_count, error_count, avg_latency_ms
     FROM system_metric_snapshot
     WHERE created_at > now() - $1::interval
     ORDER BY created_at ASC`,
    [interval],
  )

  return res.json({
    range,
    points: result.rows.map((row) => ({
      t: row.created_at,
      cpuPercent: row.cpu_percent != null ? Number(row.cpu_percent) : null,
      memPercent: row.mem_percent != null ? Number(row.mem_percent) : null,
      diskPercent: row.disk_percent != null ? Number(row.disk_percent) : null,
      netRxBytes: row.net_rx_bytes != null ? Number(row.net_rx_bytes) : null,
      netTxBytes: row.net_tx_bytes != null ? Number(row.net_tx_bytes) : null,
      requestCount: row.request_count,
      errorCount: row.error_count,
      avgLatencyMs: row.avg_latency_ms != null ? Number(row.avg_latency_ms) : null,
    })),
  })
}))

export default router
