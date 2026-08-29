import cron from 'node-cron'
import { pool } from '../services/portalMappers'
import { logger } from '../utils/Logger'
import * as SystemMetricsService from '../services/SystemMetricsService'
import * as RequestMetricsService from '../services/RequestMetricsService'

const retentionDays = () => Number(process.env.SYSTEM_METRICS_RETENTION_DAYS || '30')

async function captureSnapshot() {
  const host = await SystemMetricsService.getHostSnapshot()
  const rollup = RequestMetricsService.getRollupForSnapshot(60)

  await pool().query(
    `INSERT INTO system_metric_snapshot
       (cpu_percent, mem_percent, disk_percent, net_rx_bytes, net_tx_bytes, request_count, error_count, avg_latency_ms, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      host.cpuPercent,
      host.memPercent,
      host.diskPercent,
      host.netRxBytesPerSec,
      host.netTxBytesPerSec,
      rollup.requestCount,
      rollup.errorCount,
      rollup.avgLatencyMs,
      JSON.stringify({ source: host.source, uptimeSec: host.uptimeSec }),
    ],
  )
}

async function pruneOldSnapshots() {
  await pool().query(
    `DELETE FROM system_metric_snapshot WHERE created_at < now() - ($1 || ' days')::interval`,
    [retentionDays()],
  )
}

export function startSystemMetricsCron(): void {
  cron.schedule('* * * * *', async () => {
    try {
      await captureSnapshot()
      await pruneOldSnapshots()
    } catch (err) {
      logger.error('System metrics snapshot job failed', err as Error)
    }
  })
  logger.info('System metrics cron scheduled', { intervalMinutes: 1 })
}
