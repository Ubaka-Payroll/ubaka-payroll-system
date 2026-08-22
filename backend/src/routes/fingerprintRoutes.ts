import { Router } from 'express'
import { FingerprintController } from '../controllers/FingerprintController'

const router = Router()
const fingerprintController = new FingerprintController()

// Scanner status
router.get('/status', fingerprintController.getStatus)

// Test scanner connection
router.get('/test', fingerprintController.testScanner)

// Capture for enrollment (register new fingerprint)
router.post('/capture/enroll', fingerprintController.captureForEnrollment)
router.post('/capture/sample', fingerprintController.captureSample)
router.post('/enroll/merge', fingerprintController.mergeEnrollment)

// Identify worker by fingerprint (1:N matching)
router.post('/identify', fingerprintController.identifyWorker)

// Verify specific worker's fingerprint (1:1 matching)
router.post('/verify/:workerId', fingerprintController.verifyWorker)

export default router
