import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import * as dotenv from 'dotenv'
import DatabaseManager from './config/database'
import workerRoutes from './routes/workerRoutes'
import attendanceRoutes from './routes/attendanceRoutes'
import fingerprintRoutes from './routes/fingerprintRoutes'
import attendanceCalculationRoutes from './routes/attendanceCalculationRoutes'
import reportRoutes from './routes/reportRoutes'
import authRoutes from './routes/authRoutes'
import adminRoutes from './routes/adminRoutes'
import ownerRoutes from './routes/ownerRoutes'
import sysadminRoutes from './routes/sysadminRoutes'
import ownerRegistrationRoutes from './routes/ownerRegistrationRoutes'
import { requestLogger } from './middleware/requestLogger'
import { requestMetricsMiddleware } from './middleware/requestMetrics'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/Logger'
import { startSystemMetricsCron } from './jobs/systemMetricsCron'
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './openapi'

// Load environment variables
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || undefined })

const app: Express = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use(requestLogger)
app.use(requestMetricsMiddleware)

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const dbManager = DatabaseManager.getInstance()
    const dbConnected = await dbManager.testConnection()

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV,
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
    })
  }
})

// API routes
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Ubaka Attendance Tracking API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      workers: '/api/workers',
      attendance: '/api/attendance',
      anomalies: '/api/anomalies',
      reports: '/api/reports',
      auth: '/api/auth',
      admin: '/api/admin',
      owner: '/api/owner',
      sysadmin: '/api/sysadmin',
    },
  })
})

// Mount routes
app.use('/api/workers', workerRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/fingerprint', fingerprintRoutes)
app.use('/api/attendance-calculation', attendanceCalculationRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/owner', ownerRoutes)
app.use('/api/sysadmin', sysadminRoutes)
app.use('/api/owner-registration', ownerRegistrationRoutes)

// Debug endpoint to list all routes
app.get('/api/debug/routes', (req: Request, res: Response) => {
  const routes: any[] = []
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      })
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          const path = middleware.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '')
          routes.push({
            path: path + handler.route.path,
            methods: Object.keys(handler.route.methods)
          })
        }
      })
    }
  })
  res.json({ routes })
})

app.get('/api/openapi.json', (_req: Request, res: Response) => {
  res.json(openapiSpec)
})

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec as object, {
    customSiteTitle: 'Ubaka API',
  }),
)

app.get('/api/health', async (_req: Request, res: Response) => {
  const dbManager = DatabaseManager.getInstance()
  const dbConnected = await dbManager.testConnection()
  res.json({
    ok: dbConnected,
    service: 'ubaka-backend',
    database: dbConnected ? 'connected' : 'disconnected',
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbManager = DatabaseManager.getInstance()
    const connected = await dbManager.testConnection()

    if (!connected) {
      logger.error('Failed to connect to database', new Error('Database connection failed'))
      process.exit(1)
    }

    app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV,
        database: 'connected',
      })
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`Environment: ${process.env.NODE_ENV}`)
      console.log(`Database: Connected`)
      console.log(`Logs: backend/logs/`)
    })

    startSystemMetricsCron()
  } catch (error) {
    logger.error('Failed to start server', error as Error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server...')
  const dbManager = DatabaseManager.getInstance()
  await dbManager.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing server...')
  const dbManager = DatabaseManager.getInstance()
  await dbManager.close()
  process.exit(0)
})

startServer()

export default app
