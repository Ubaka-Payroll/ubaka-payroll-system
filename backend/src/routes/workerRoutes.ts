import { Router } from 'express'
import { WorkerController } from '../controllers/WorkerController'

const router = Router()
const workerController = new WorkerController()

// Worker routes
router.post('/', workerController.registerWorker)
router.get('/', workerController.getAllWorkers)
router.get('/search', workerController.searchWorkers)
router.get('/next-number', workerController.getNextWorkerNumber)
router.get('/classifications', workerController.listClassifications)
router.post('/classifications', workerController.addClassification)
router.get('/:id', workerController.getWorkerById)
router.put('/:id', workerController.updateWorker)
router.delete('/:id', workerController.deactivateWorker)

export default router
