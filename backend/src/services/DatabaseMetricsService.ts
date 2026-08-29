import { pool } from './portalMappers'

export interface LongRunningQuery {
  pid: number
  durationSec: number
  query: string
}

export async function getDatabaseSnapshot() {
  const p = pool()

  const [sizeResult, activityResult, longRunningResult] = await Promise.all([
    p.query('SELECT pg_database_size(current_database()) AS size'),
    p.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()'),
    p.query(
      `SELECT pid, EXTRACT(EPOCH FROM (now() - query_start))::numeric AS duration_sec, query
       FROM pg_stat_activity
       WHERE state = 'active'
         AND datname = current_database()
         AND pid <> pg_backend_pid()
         AND now() - query_start > interval '5 seconds'
       ORDER BY query_start ASC
       LIMIT 10`,
    ),
  ])

  return {
    pool: {
      total: p.totalCount,
      idle: p.idleCount,
      waiting: p.waitingCount,
    },
    sizeBytes: Number(sizeResult.rows[0]?.size ?? 0),
    activeConnections: activityResult.rows[0]?.n ?? 0,
    longRunningQueries: longRunningResult.rows.map(
      (row): LongRunningQuery => ({
        pid: row.pid,
        durationSec: Number(row.duration_sec),
        query: row.query,
      }),
    ),
  }
}
