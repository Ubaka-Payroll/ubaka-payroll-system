import Docker from 'dockerode'
import { logger } from '../utils/Logger'

export interface ContainerInfo {
  id: string
  name: string
  image: string
  state: string
  status: string
  startedAt: string | null
  restartCount: number
  cpuPercent: number | null
  memUsageBytes: number | null
  memLimitBytes: number | null
  memPercent: number | null
}

function getClient(): Docker | null {
  const url = process.env.DOCKER_PROXY_URL
  if (!url) return null
  try {
    const parsed = new URL(url)
    return new Docker({
      protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 2375,
    })
  } catch (err) {
    logger.error('Invalid DOCKER_PROXY_URL', err as Error)
    return null
  }
}

function calcCpuPercent(stats: any): number | null {
  try {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
    const cpuCount =
      stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1
    if (systemDelta <= 0 || cpuDelta < 0) return null
    return Number(((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2))
  } catch {
    return null
  }
}

export async function listContainers(): Promise<{ available: boolean; containers: ContainerInfo[]; error?: string }> {
  const docker = getClient()
  if (!docker) {
    return { available: false, containers: [] }
  }

  try {
    const list = await docker.listContainers({ all: true })

    const results = await Promise.allSettled(
      list.map(async (c): Promise<ContainerInfo> => {
        const container = docker.getContainer(c.Id)
        let stats: any = null
        let inspect: any = null
        try {
          ;[stats, inspect] = await Promise.all([
            container.stats({ stream: false }),
            container.inspect(),
          ])
        } catch {
          // container may have stopped between list and inspect — fall back to list data
        }

        const memUsage = stats?.memory_stats?.usage ?? null
        const memLimit = stats?.memory_stats?.limit ?? null

        return {
          id: c.Id.slice(0, 12),
          name: c.Names?.[0]?.replace(/^\//, '') || c.Id.slice(0, 12),
          image: c.Image,
          state: c.State,
          status: c.Status,
          startedAt: inspect?.State?.StartedAt ?? null,
          restartCount: inspect?.RestartCount ?? 0,
          cpuPercent: stats ? calcCpuPercent(stats) : null,
          memUsageBytes: memUsage,
          memLimitBytes: memLimit,
          memPercent: memUsage && memLimit ? Number(((memUsage / memLimit) * 100).toFixed(2)) : null,
        }
      }),
    )

    const containers = results
      .filter((r): r is PromiseFulfilledResult<ContainerInfo> => r.status === 'fulfilled')
      .map((r) => r.value)

    return { available: true, containers }
  } catch (err) {
    logger.error('Docker proxy unreachable', err as Error)
    return { available: false, containers: [], error: (err as Error).message }
  }
}
