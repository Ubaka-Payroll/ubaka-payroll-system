import { Router } from 'express'
import { AttendanceController } from '../controllers/AttendanceController'

const router = Router()
const attendanceController = new AttendanceController()

// Attendance event routes
router.post('/events', attendanceController.recordEvent)
router.get('/events/:workerId/:date', attendanceController.getEventsForDate)
router.get('/next-event/:workerId', attendanceController.getNextEventType)

// Hours calculation
router.get('/hours/:workerId/:date', attendanceController.calculateHours)
router.get('/history/:workerId', attendanceController.getWorkerHistory)

// Summary and search
router.get('/summary', attendanceController.getDailySummary)
router.get('/search', attendanceController.searchRecords)
router.get('/after-hours', attendanceController.getAfterHoursQueue)
router.post('/after-hours', attendanceController.resolveAfterHours)

export default router
