interface RequestSample {
  timestamp: number
  durationMs: number
  statusCode: number
}

const MAX_SAMPLES = 5000
const MAX_AGE_MS = 15 * 60 * 1000

let activeRequests = 0
let samples: RequestSample[] = []

function prune(now: number) {
  const cutoff = now - MAX_AGE_MS
  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(samples.length - MAX_SAMPLES)
  }
  while (samples.length && samples[0].timestamp < cutoff) {
    samples.shift()
  }
}

export function recordStart(): void {
  activeRequests += 1
}

export function recordEnd(durationMs: number, statusCode: number): void {
  activeRequests = Math.max(0, activeRequests - 1)
  const now = Date.now()
  samples.push({ timestamp: now, durationMs, statusCode })
  prune(now)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

export function getSnapshot(windowSec = 60) {
  const now = Date.now()
  prune(now)
  const cutoff = now - windowSec * 1000
  const windowSamples = samples.filter((s) => s.timestamp >= cutoff)
  const durations = windowSamples.map((s) => s.durationMs).sort((a, b) => a - b)

  const statusBuckets = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }
  for (const s of windowSamples) {
    const bucket = `${Math.floor(s.statusCode / 100)}xx` as keyof typeof statusBuckets
    if (bucket in statusBuckets) statusBuckets[bucket] += 1
  }

  return {
    activeRequests,
    ratePerMin: windowSec > 0 ? Math.round((windowSamples.length / windowSec) * 60) : 0,
    p50Ms: Math.round(percentile(durations, 50)),
    p95Ms: Math.round(percentile(durations, 95)),
    p99Ms: Math.round(percentile(durations, 99)),
    statusBuckets,
    windowSec,
  }
}

export function getRollupForSnapshot(windowSec = 60) {
  const now = Date.now()
  prune(now)
  const cutoff = now - windowSec * 1000
  const windowSamples = samples.filter((s) => s.timestamp >= cutoff)
  const requestCount = windowSamples.length
  const errorCount = windowSamples.filter((s) => s.statusCode >= 400).length
  const avgLatencyMs =
    requestCount > 0
      ? windowSamples.reduce((sum, s) => sum + s.durationMs, 0) / requestCount
      : 0

  return {
    requestCount,
    errorCount,
    avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
  }
}
