-- System Admin monitoring dashboard: historical metric snapshots.

CREATE TABLE IF NOT EXISTS system_metric_snapshot (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cpu_percent NUMERIC(5,2),
  mem_percent NUMERIC(5,2),
  disk_percent NUMERIC(5,2),
  net_rx_bytes BIGINT,
  net_tx_bytes BIGINT,
  request_count INTEGER,
  error_count INTEGER,
  avg_latency_ms NUMERIC(10,2),
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_system_metric_snapshot_created_at ON system_metric_snapshot(created_at DESC);
