import api from './api'

export interface IdentifyResult {
    workerId: number
    worker: {
        id: number
        worker_number: string
        full_name: string
        nid: string
        classification: string
        phone_number?: string
        hourly_rate: number | string
        is_active: boolean
    }
    confidence?: number
}

function apiErrorMessage(err: any, fallback: string): string {
    return (
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        fallback
    )
}

const fingerprintService = {
    /**
     * Step-by-step enrollment: capture 3 samples, then merge.
     * onProgress(step) is called before each finger placement (1..3).
     */
    async captureForEnrollment(
        onProgress?: (step: number, total: number) => void
    ): Promise<{ templateId: string; template: string; quality: number }> {
        const samples: string[] = []
        const total = 3

        for (let step = 1; step <= total; step += 1) {
            onProgress?.(step, total)
            try {
                const response = await api.post('/fingerprint/capture/sample', {}, { timeout: 60_000 })
                if (!response.data?.success || !response.data?.data?.template) {
                    throw new Error(response.data?.error || `Sample ${step} failed`)
                }
                samples.push(response.data.data.template)
                if (step < total) {
                    // Give the UI a beat to show "lift finger" before next poll starts
                    await new Promise(resolve => window.setTimeout(resolve, 400))
                }
            } catch (err: any) {
                throw new Error(apiErrorMessage(err, `Sample ${step} of ${total} failed`))
            }
        }

        try {
            const response = await api.post('/fingerprint/enroll/merge', { templates: samples })
            if (!response.data?.success) {
                throw new Error(response.data?.error || 'Failed to merge fingerprint samples')
            }
            return response.data.data as { templateId: string; template: string; quality: number }
        } catch (err: any) {
            throw new Error(apiErrorMessage(err, 'Failed to merge fingerprint samples'))
        }
    },

    /**
     * Triggers a scan on the hardware scanner and identifies the worker
     * against all stored fingerprint templates in the database.
     * Calls POST /api/fingerprint/identify
     */
    async identify(): Promise<IdentifyResult> {
        try {
            const response = await api.post('/fingerprint/identify', {}, { timeout: 40_000 })
            if (!response.data?.success) {
                throw new Error(response.data?.error || 'Fingerprint not recognized')
            }
            return response.data.data as IdentifyResult
        } catch (err: any) {
            throw new Error(apiErrorMessage(err, 'Fingerprint not recognized'))
        }
    },

    /**
     * Get current scanner status
     */
    async getStatus(): Promise<{ connected: boolean; mode: string; model: string }> {
        const response = await api.get('/fingerprint/status')
        return response.data?.data || { connected: false, mode: 'UNKNOWN', model: 'Unknown' }
    }
}

export default fingerprintService
