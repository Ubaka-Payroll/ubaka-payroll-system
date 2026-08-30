import { Router } from 'express'
import { ReportController } from '../controllers/ReportController'
import { requireAuth } from '../middleware/auth'

const router = Router()
const reportController = new ReportController()

router.use(requireAuth)

// Monthly report
router.get('/monthly/:year/:month', reportController.getMonthlyReport)

// Late arrival trends
router.get('/late-trends', reportController.getLateTrends)

// Payroll export (JSON)
router.get('/payroll-export', reportController.getPayrollExport)

// Payroll export (CSV)
router.get('/payroll-csv', reportController.exportPayrollCSV)

export default router
