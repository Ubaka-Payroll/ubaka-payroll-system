import { Request, Response } from 'express'
import { FingerprintService } from '../services/FingerprintService'
import { WorkerRepository } from '../repositories/WorkerRepository'
import { logger } from '../utils/Logger'

export class FingerprintController {
    private workerRepository: WorkerRepository
    private fingerprintService: FingerprintService

    constructor() {
        this.workerRepository = new WorkerRepository()
        this.fingerprintService = new FingerprintService()
        logger.info('FingerprintController initialized', {
            fingerprintServiceCreated: !!this.fingerprintService
        })
    }

    /**
     * Get scanner status and information
     * GET /api/fingerprint/status
     */
    public getStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            logger.info('getStatus called - checking fingerprintService', {
                exists: !!this.fingerprintService,
                type: typeof this.fingerprintService,
                hasMethod: typeof this.fingerprintService?.getScannerInfo
            })

            if (!this.fingerprintService) {
                throw new Error('fingerprintService is undefined')
            }

            if (typeof this.fingerprintService.getScannerInfo !== 'function') {
                throw new Error(`getScannerInfo is not a function: ${typeof this.fingerprintService.getScannerInfo}`)
            }

            const scannerInfo = await this.fingerprintService.getScannerInfo()

            res.json({
                success: true,
                data: scannerInfo,
            })
        } catch (error) {
            logger.error('Failed to get scanner status', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to get scanner status',
                details: (error as Error).message
            })
        }
    }

    /**
     * Capture fingerprint for enrollment
     * POST /api/fingerprint/capture/enroll
     */
    public captureForEnrollment = async (req: Request, res: Response): Promise<void> => {
        try {
            logger.info('Fingerprint enrollment capture requested')

            const result = await this.fingerprintService.captureForEnrollment()

            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to capture fingerprint',
                })
                return
            }

            // Convert template to storable format
            const templateString = this.fingerprintService.templateToString(result.template!)

            res.json({
                success: true,
                data: {
                    templateId: result.template!.id,
                    template: templateString,
                    quality: result.quality,
                },
            })
        } catch (error) {
            logger.error('Fingerprint enrollment capture failed', error as Error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during fingerprint capture',
            })
        }
    }

    /**
     * Capture one fingerprint sample (step of enrollment)
     * POST /api/fingerprint/capture/sample
     */
    public captureSample = async (_req: Request, res: Response): Promise<void> => {
        try {
            logger.info('Fingerprint sample capture requested')
            const result = await this.fingerprintService.captureSample()

            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to capture fingerprint sample',
                })
                return
            }

            res.json({
                success: true,
                data: {
                    template: this.fingerprintService.templateToString(result.template!),
                    quality: result.quality,
                },
            })
        } catch (error) {
            logger.error('Fingerprint sample capture failed', error as Error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during fingerprint sample capture',
            })
        }
    }

    /**
     * Merge three enrollment samples
     * POST /api/fingerprint/enroll/merge
     */
    public mergeEnrollment = async (req: Request, res: Response): Promise<void> => {
        try {
            const templates = req.body?.templates
            if (!Array.isArray(templates) || templates.length !== 3) {
                res.status(400).json({
                    success: false,
                    error: 'Exactly three fingerprint samples are required',
                })
                return
            }

            logger.info('Fingerprint enrollment merge requested')
            const result = await this.fingerprintService.mergeEnrollmentTemplates(templates)

            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to merge fingerprint samples',
                })
                return
            }

            res.json({
                success: true,
                data: {
                    templateId: result.template!.id,
                    template: this.fingerprintService.templateToString(result.template!),
                    quality: result.quality,
                },
            })
        } catch (error) {
            logger.error('Fingerprint enrollment merge failed', error as Error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during fingerprint merge',
            })
        }
    }

    /**
     * Capture and identify worker by fingerprint
     * POST /api/fingerprint/identify
     */
    public identifyWorker = async (req: Request, res: Response): Promise<void> => {
        try {
            logger.info('Worker identification by fingerprint requested')

            // Capture fingerprint
            const captureResult = await this.fingerprintService.captureForVerification()

            if (!captureResult.success) {
                res.status(400).json({
                    success: false,
                    error: captureResult.error || 'Failed to capture fingerprint',
                })
                return
            }

            // Get all active workers with fingerprints
            const workers = await this.workerRepository.findActiveWorkers()
            const templates = new Map<number, string>()

            workers.forEach(worker => {
                if (worker.fingerprint_data) {
                    // fingerprint_data is a Buffer from PostgreSQL BYTEA column — convert to base64
                    const b64 = Buffer.isBuffer(worker.fingerprint_data)
                        ? worker.fingerprint_data.toString('base64')
                        : Buffer.from(worker.fingerprint_data).toString('base64')
                    templates.set(worker.id, b64)
                }
            })

            // Identify worker
            const matchResult = await this.fingerprintService.identifyFromDatabase(
                captureResult.template!,
                templates
            )

            if (!matchResult.matched) {
                res.status(404).json({
                    success: false,
                    error: 'Fingerprint not recognized',
                })
                return
            }

            // Get worker details
            const worker = await this.workerRepository.findById(matchResult.workerId!)

            res.json({
                success: true,
                data: {
                    workerId: matchResult.workerId,
                    worker: worker,
                    confidence: matchResult.confidence,
                },
            })

            logger.info('Worker identified by fingerprint', {
                workerId: matchResult.workerId,
                confidence: matchResult.confidence,
            })
        } catch (error) {
            logger.error('Worker identification failed', error as Error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during identification',
            })
        }
    }

    /**
     * Verify fingerprint matches specific worker
     * POST /api/fingerprint/verify/:workerId
     */
    public verifyWorker = async (req: Request, res: Response): Promise<void> => {
        try {
            const workerId = parseInt(req.params.workerId as string, 10)

            if (isNaN(workerId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid worker ID',
                })
                return
            }

            logger.info('Worker verification by fingerprint requested', { workerId })

            // Get worker
            const worker = await this.workerRepository.findById(workerId)

            if (!worker) {
                res.status(404).json({
                    success: false,
                    error: 'Worker not found',
                })
                return
            }

            if (!worker.fingerprint_data) {
                res.status(400).json({
                    success: false,
                    error: 'Worker has no fingerprint registered',
                })
                return
            }

            // Capture fingerprint
            const captureResult = await this.fingerprintService.captureForVerification()

            if (!captureResult.success) {
                res.status(400).json({
                    success: false,
                    error: captureResult.error || 'Failed to capture fingerprint',
                })
                return
            }

            // Match against worker's fingerprint (convert Buffer BYTEA → base64)
            const storedB64 = Buffer.isBuffer(worker.fingerprint_data)
                ? worker.fingerprint_data.toString('base64')
                : Buffer.from(worker.fingerprint_data).toString('base64')
            const matchResult = await this.fingerprintService.matchFingerprint(
                captureResult.template!,
                storedB64
            )

            res.json({
                success: true,
                data: {
                    matched: matchResult.matched,
                    workerId: worker.id,
                    confidence: matchResult.confidence,
                },
            })

            logger.info('Worker verification completed', {
                workerId,
                matched: matchResult.matched,
                confidence: matchResult.confidence,
            })
        } catch (error) {
            logger.error('Worker verification failed', error as Error)
            res.status(500).json({
                success: false,
                error: 'Internal server error during verification',
            })
        }
    }

    /**
     * Test scanner connection
     * GET /api/fingerprint/test
     */
    public testScanner = async (req: Request, res: Response): Promise<void> => {
        try {
            logger.info('Testing scanner connection...')

            // Test 1: Check if service is connected
            const isConnected = this.fingerprintService.isConnected()
            logger.info(`Scanner connected: ${isConnected}`)

            // Test 2: Try direct axios call
            const axios = require('axios')
            let directCallSuccess = false
            try {
                const directResponse = await axios.get('http://127.0.0.1:5001/scanner/status', { timeout: 5000 })
                directCallSuccess = directResponse.data.success
                logger.info('Direct axios call successful', directResponse.data)
            } catch (err: any) {
                logger.error('Direct axios call failed', err)
            }

            // Test 3: Try via service
            let serviceCallSuccess = false
            let scannerInfo = null
            try {
                scannerInfo = await this.fingerprintService.getScannerInfo()
                serviceCallSuccess = true
                logger.info('Service call successful', scannerInfo)
            } catch (err: any) {
                logger.error('Service call failed', err)
            }

            res.json({
                success: true,
                data: {
                    isConnected,
                    directCallSuccess,
                    serviceCallSuccess,
                    scannerInfo,
                },
            })
        } catch (error) {
            logger.error('Scanner test failed', error as Error)
            res.status(500).json({
                success: false,
                error: 'Scanner test failed',
            })
        }
    }
}
