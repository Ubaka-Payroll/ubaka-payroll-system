import fs from 'fs'
import os from 'os'

type Source = 'host' | 'container'

const hostProcPath = () => process.env.HOST_PROC_PATH || '/proc'
const hostRootPath = () => process.env.HOST_ROOT_PATH || '/'

function hasHostProc(): boolean {
  try {
    return fs.existsSync(hostProcPath())
  } catch {
    return false
  }
}

function readCpuTicks(procPath: string): { idle: number; total: number } | null {
  try {
    const line = fs.readFileSync(`${procPath}/stat`, 'utf8').split('\n')[0]
    const parts = line.trim().split(/\s+/).slice(1).map(Number)
    const [user, nice, system, idle, iowait, irq, softirq, steal] = parts
    const idleAll = idle + (iowait || 0)
    const total = user + nice + system + idleAll + (irq || 0) + (softirq || 0) + (steal || 0)
    return { idle: idleAll, total }
  } catch {
    return null
  }
}

async function sampleCpuFromProc(procPath: string, sampleMs: number): Promise<number | null> {
  const first = readCpuTicks(procPath)
  if (!first) return null
  await new Promise((resolve) => setTimeout(resolve, sampleMs))
  const second = readCpuTicks(procPath)
  if (!second) return null
  const totalDelta = second.total - first.total
  const idleDelta = second.idle - first.idle
  if (totalDelta <= 0) return null
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100))
}

function sampleCpuFromOs(sampleMs: number): Promise<number> {
  const snapshot = () =>
    os.cpus().reduce(
      (acc, cpu) => {
        const times = cpu.times
        const idle = times.idle
        const total = times.user + times.nice + times.sys + times.idle + times.irq
        return { idle: acc.idle + idle, total: acc.total + total }
      },
      { idle: 0, total: 0 },
    )

  const first = snapshot()
  return new Promise((resolve) => {
    setTimeout(() => {
      const second = snapshot()
      const totalDelta = second.total - first.total
      const idleDelta = second.idle - first.idle
      resolve(totalDelta <= 0 ? 0 : Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)))
    }, sampleMs)
  })
}

export async function getCpu(): Promise<{ percent: number; perCore: number[]; source: Source }> {
  const useHost = hasHostProc()
  const percent = useHost
    ? (await sampleCpuFromProc(hostProcPath(), 200)) ?? (await sampleCpuFromOs(200))
    : await sampleCpuFromOs(200)

  const perCore = os.cpus().map((cpu) => {
    const times = cpu.times
    const idle = times.idle
    const total = times.user + times.nice + times.sys + times.idle + times.irq
    return total > 0 ? Math.max(0, Math.min(100, (1 - idle / total) * 100)) : 0
  })

  return { percent, perCore, source: useHost ? 'host' : 'container' }
}

export function getMemory(): {
  usedBytes: number
  totalBytes: number
  percent: number
  source: Source
} {
  if (hasHostProc()) {
    try {
      const meminfo = fs.readFileSync(`${hostProcPath()}/meminfo`, 'utf8')
      const get = (key: string) => {
        const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)\\s*kB`, 'm'))
        return match ? Number(match[1]) * 1024 : null
      }
      const totalBytes = get('MemTotal')
      const availableBytes = get('MemAvailable')
      if (totalBytes != null && availableBytes != null) {
        const usedBytes = totalBytes - availableBytes
        return { usedBytes, totalBytes, percent: (usedBytes / totalBytes) * 100, source: 'host' }
      }
    } catch {
      // fall through to os module
    }
  }

  const totalBytes = os.totalmem()
  const usedBytes = totalBytes - os.freemem()
  return { usedBytes, totalBytes, percent: (usedBytes / totalBytes) * 100, source: 'container' }
}

export function getDisk(): {
  usedBytes: number
  totalBytes: number
  percent: number
  source: Source
} {
  const tryPath = (path: string, source: Source) => {
    const stats = fs.statfsSync(path)
    const totalBytes = stats.blocks * stats.bsize
    const freeBytes = stats.bavail * stats.bsize
    const usedBytes = totalBytes - freeBytes
    return { usedBytes, totalBytes, percent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0, source }
  }

  try {
    return tryPath(hostRootPath(), hasHostProc() ? 'host' : 'container')
  } catch {
    return tryPath('/', 'container')
  }
}

let lastNetSample: { at: number; rxBytes: number; txBytes: number } | null = null

function readNetTotals(procPath: string): { rxBytes: number; txBytes: number } | null {
  try {
    const lines = fs.readFileSync(`${procPath}/net/dev`, 'utf8').split('\n').slice(2)
    let rxBytes = 0
    let txBytes = 0
    for (const line of lines) {
      const [iface, rest] = line.split(':')
      if (!iface || !rest) continue
      const name = iface.trim()
      if (name === 'lo') continue
      const fields = rest.trim().split(/\s+/).map(Number)
      rxBytes += fields[0] || 0
      txBytes += fields[8] || 0
    }
    return { rxBytes, txBytes }
  } catch {
    return null
  }
}

export function getNetwork(): {
  rxBytesPerSec: number
  txBytesPerSec: number
  source: Source
} {
  const procPath = hostProcPath()
  const totals = readNetTotals(procPath)
  const source: Source = hasHostProc() ? 'host' : 'container'
  const now = Date.now()

  if (!totals) {
    return { rxBytesPerSec: 0, txBytesPerSec: 0, source }
  }

  if (!lastNetSample) {
    lastNetSample = { at: now, ...totals }
    return { rxBytesPerSec: 0, txBytesPerSec: 0, source }
  }

  const elapsedSec = (now - lastNetSample.at) / 1000
  const result =
    elapsedSec > 0
      ? {
          rxBytesPerSec: Math.max(0, (totals.rxBytes - lastNetSample.rxBytes) / elapsedSec),
          txBytesPerSec: Math.max(0, (totals.txBytes - lastNetSample.txBytes) / elapsedSec),
          source,
        }
      : { rxBytesPerSec: 0, txBytesPerSec: 0, source }

  lastNetSample = { at: now, ...totals }
  return result
}

export function getUptimeSec(): number {
  if (hasHostProc()) {
    try {
      const uptime = fs.readFileSync(`${hostProcPath()}/uptime`, 'utf8')
      const seconds = Number(uptime.trim().split(' ')[0])
      if (!Number.isNaN(seconds)) return seconds
    } catch {
      // fall through
    }
  }
  return os.uptime()
}

export function getLoadAvg(): [number, number, number] {
  return os.loadavg() as [number, number, number]
}

export async function getHostSnapshot() {
  const [cpu, network] = await Promise.all([getCpu(), Promise.resolve(getNetwork())])
  const memory = getMemory()
  const disk = getDisk()

  return {
    cpuPercent: Number(cpu.percent.toFixed(2)),
    perCore: cpu.perCore.map((v) => Number(v.toFixed(2))),
    memPercent: Number(memory.percent.toFixed(2)),
    memUsedBytes: memory.usedBytes,
    memTotalBytes: memory.totalBytes,
    diskPercent: Number(disk.percent.toFixed(2)),
    diskUsedBytes: disk.usedBytes,
    diskTotalBytes: disk.totalBytes,
    netRxBytesPerSec: Math.round(network.rxBytesPerSec),
    netTxBytesPerSec: Math.round(network.txBytesPerSec),
    loadavg: getLoadAvg(),
    uptimeSec: Math.round(getUptimeSec()),
    source: cpu.source,
  }
}
