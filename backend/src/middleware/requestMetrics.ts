import { Request, Response, NextFunction } from 'express'
import * as RequestMetricsService from '../services/RequestMetricsService'

export function requestMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()
  RequestMetricsService.recordStart()

  res.on('finish', () => {
    const duration = Date.now() - startTime
    RequestMetricsService.recordEnd(duration, res.statusCode)
  })

  next()
}
