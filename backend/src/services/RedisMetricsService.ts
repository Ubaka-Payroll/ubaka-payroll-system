import Redis from 'ioredis'
import { logger } from '../utils/Logger'

export interface RedisSnapshot {
  configured: boolean
  status: 'not_configured' | 'ok' | 'error'
  usedMemoryBytes?: number
  connectedClients?: number
  error?: string
}

function parseInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of info.split('\r\n')) {
    const [key, value] = line.split(':')
    if (key && value !== undefined) result[key] = value
  }
  return result
}

export async function getRedisSnapshot(): Promise<RedisSnapshot> {
  const url = process.env.REDIS_URL
  if (!url) {
    return { configured: false, status: 'not_configured' }
  }

  try {
    const client = new Redis(url, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 1 })
    try {
      await client.connect()
      const info = parseInfo(await client.info())
      return {
        configured: true,
        status: 'ok',
        usedMemoryBytes: Number(info.used_memory) || undefined,
        connectedClients: Number(info.connected_clients) || undefined,
      }
    } finally {
      client.disconnect()
    }
  } catch (err) {
    logger.error('Redis metrics unavailable', err as Error)
    return { configured: true, status: 'error', error: (err as Error).message }
  }
}
