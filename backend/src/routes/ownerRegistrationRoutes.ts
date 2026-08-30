import { Router, Request, Response, NextFunction } from 'express'
import { OwnerRegistrationController } from '../controllers/OwnerRegistrationController'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()
const controller = new OwnerRegistrationController()

// Public registration endpoint
router.post('/register', controller.register)

// Admin endpoints (protected)
router.get('/admin', requireAuth, requireRole('SYSTEM_ADMIN'), controller.getAllRequests)
router.post('/admin/:id/approve', requireAuth, requireRole('SYSTEM_ADMIN'), controller.approve)
router.post('/admin/:id/reject', requireAuth, requireRole('SYSTEM_ADMIN'), controller.reject)
router.put('/admin/:id/notes', requireAuth, requireRole('SYSTEM_ADMIN'), controller.updateNotes)

export default router
