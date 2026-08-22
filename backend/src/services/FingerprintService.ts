import axios from 'axios'
import { logger } from '../utils/Logger'

export interface FingerprintTemplate {
    id: string
    data: string
    quality: number
    capturedAt: Date
}

export interface ScanResult {
    success: boolean
    template?: FingerprintTemplate
    quality?: number
    error?: string
}

export interface MatchResult {
    matched: boolean
    workerId?: number
    confidence?: number
    score?: number
    template?: FingerprintTemplate
}

export class FingerprintService {
    private serviceUrl: string = 'http://127.0.0.1:5001'
    private connected: boolean = false
    private scannerModel: string = 'ZKTeco Live20R'

    constructor() {
        this.checkHealth()
    }

    private async checkHealth(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.serviceUrl}/health`, { timeout: 3000 })
            this.connected = response.data?.status === 'ok'
            return this.connected
        } catch (err) {
            this.connected = false
            return false
        }
    }

    public isConnected(): boolean {
        return this.connected
    }

    public async getScannerInfo(): Promise<{
        model: string
        connected: boolean
        sdkType?: string
        mode?: string
        error?: string
    }> {
        try {
            const response = await axios.get(`${this.serviceUrl}/scanner/status`, {
                timeout: 8000,
                // 503 still returns useful JSON (connected:false + error)
                validateStatus: () => true,
            })

            if (response.data && typeof response.data === 'object') {
                const connected = response.data.connected === true
                this.connected = connected
                return {
                    model: response.data.model || this.scannerModel,
                    connected,
                    sdkType: response.data.sdk_type,
                    mode: response.data.mode,
                    error: response.data.error,
                }
            }
        } catch (err) {
            logger.warn('Failed to contact fingerprint microservice at port 5001', {
                error: (err as Error).message,
            })
        }

        // Fall back to /health so we can still report USB / init state
        try {
            const health = await axios.get(`${this.serviceUrl}/health`, {
                timeout: 3000,
                validateStatus: () => true,
            })
            const data = health.data || {}
            const connected =
                data.mode === 'PRODUCTION' && data.scanner_initialized === true
            this.connected = connected
            return {
                model: this.scannerModel,
                connected,
                sdkType: data.sdk_type,
                mode: data.mode,
                error: connected
                    ? undefined
                    : data.usb_present === false
                      ? 'Live20R not detected on USB'
                      : 'Fingerprint scanner not ready',
            }
        } catch (err) {
            this.connected = false
            logger.warn('Fingerprint /health also unreachable', {
                error: (err as Error).message,
            })
        }

        return {
            model: this.scannerModel,
            connected: false,
            error: 'Fingerprint service is not running on port 5001',
        }
    }

    public async captureForEnrollment(): Promise<ScanResult> {
        try {
            logger.info('Requesting enrollment capture from fingerprint service')
            const response = await axios.post(`${this.serviceUrl}/scanner/capture/enroll`, {}, {
                // Enrollment needs 3 finger placements; each scan can take up to ~30s.
                timeout: 100_000,
                validateStatus: () => true,
            })

            if (response.data?.success) {
                const template: FingerprintTemplate = {
                    id: response.data.template_id || `FP${Date.now()}`,
                    data: response.data.template,
                    quality: response.data.quality || 90,
                    capturedAt: new Date()
                }
                return {
                    success: true,
                    template,
                    quality: template.quality
                }
            }

            return {
                success: false,
                error: response.data?.error || 'Enrollment capture failed'
            }
        } catch (error: any) {
            logger.error('Enrollment capture HTTP request failed', error)
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Capture failed'
            }
        }
    }

    public async captureSample(): Promise<ScanResult> {
        try {
            logger.info('Requesting single fingerprint sample')
            const response = await axios.post(`${this.serviceUrl}/scanner/capture/sample`, {}, {
                timeout: 45_000,
                validateStatus: () => true,
            })

            if (response.data?.success) {
                const template: FingerprintTemplate = {
                    id: `SAMPLE${Date.now()}`,
                    data: response.data.template,
                    quality: response.data.quality || 85,
                    capturedAt: new Date(),
                }
                return { success: true, template, quality: template.quality }
            }

            return {
                success: false,
                error: response.data?.error || 'Fingerprint sample failed',
            }
        } catch (error: any) {
            logger.error('Sample capture HTTP request failed', error)
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Sample capture failed',
            }
        }
    }

    public async mergeEnrollmentTemplates(templates: string[]): Promise<ScanResult> {
        try {
            logger.info('Merging enrollment fingerprint samples', { count: templates.length })
            const response = await axios.post(
                `${this.serviceUrl}/scanner/enroll/merge`,
                { templates },
                { timeout: 15_000, validateStatus: () => true }
            )

            if (response.data?.success) {
                const template: FingerprintTemplate = {
                    id: response.data.template_id || `FP${Date.now()}`,
                    data: response.data.template,
                    quality: response.data.quality || 90,
                    capturedAt: new Date(),
                }
                return { success: true, template, quality: template.quality }
            }

            return {
                success: false,
                error: response.data?.error || 'Failed to merge fingerprint samples',
            }
        } catch (error: any) {
            logger.error('Enrollment merge HTTP request failed', error)
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Merge failed',
            }
        }
    }

    public async captureForVerification(): Promise<ScanResult> {
        try {
            logger.info('Requesting verification capture from fingerprint service')
            const response = await axios.post(`${this.serviceUrl}/scanner/capture/verify`, {}, { timeout: 20000 })

            if (response.data?.success) {
                const template: FingerprintTemplate = {
                    id: `SCAN${Date.now()}`,
                    data: response.data.template,
                    quality: response.data.quality || 85,
                    capturedAt: new Date()
                }
                return {
                    success: true,
                    template,
                    quality: template.quality
                }
            }

            return {
                success: false,
                error: response.data?.error || 'Verification capture failed'
            }
        } catch (error: any) {
            logger.error('Verification capture HTTP request failed', error)
            return {
                success: false,
                error: error.response?.data?.error || error.message || 'Verification capture failed'
            }
        }
    }

    public async matchFingerprint(
        capturedTemplate: FingerprintTemplate,
        storedTemplateB64: string
    ): Promise<MatchResult> {
        try {
            const response = await axios.post(`${this.serviceUrl}/scanner/match`, {
                captured_template: capturedTemplate.data,
                stored_template: storedTemplateB64
            }, { timeout: 10000 })

            if (response.data?.success) {
                return {
                    matched: response.data.matched,
                    confidence: response.data.confidence,
                    score: response.data.score,
                    template: capturedTemplate
                }
            }

            return { matched: false }
        } catch (error) {
            logger.error('Fingerprint matching request failed', error as Error)
            return { matched: false }
        }
    }

    public async identifyFromDatabase(
        capturedTemplate: FingerprintTemplate,
        storedTemplates: Map<number, string>
    ): Promise<MatchResult> {
        try {
            for (const [workerId, storedTemplateB64] of storedTemplates.entries()) {
                const res = await this.matchFingerprint(capturedTemplate, storedTemplateB64)
                if (res.matched) {
                    return {
                        matched: true,
                        workerId,
                        confidence: res.confidence,
                        score: res.score,
                        template: capturedTemplate
                    }
                }
            }
            return { matched: false }
        } catch (error) {
            logger.error('Identify from database failed', error as Error)
            return { matched: false }
        }
    }

    public templateToString(template: FingerprintTemplate): string {
        return template.data
    }

    public stringToTemplate(templateString: string, templateId: string): FingerprintTemplate {
        return {
            id: templateId,
            data: templateString,
            quality: 85,
            capturedAt: new Date()
        }
    }
}

export const fingerprintService = new FingerprintService()
