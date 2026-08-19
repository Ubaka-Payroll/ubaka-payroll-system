import api from './api'

export interface Worker {
    id: number
    nid: string
    worker_number: string
    classification: string
    full_name: string
    phone_number?: string
    email_address?: string
    hourly_rate: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface WorkerRegistrationData {
    nid: string
    worker_number: string
    classification: string
    full_name: string
    phone_number?: string
    email_address?: string
    hourly_rate: number
    fingerprint_data: string // Base64 encoded
}

export const workerService = {
    async registerWorker(data: WorkerRegistrationData): Promise<Worker> {
        const response = await api.post('/workers', data)
        return response.data.data
    },

    async getAllWorkers(includeInactive: boolean = false): Promise<Worker[]> {
        const response = await api.get('/workers', {
            params: { includeInactive },
        })
        return response.data.data
    },

    async getWorkerById(id: number): Promise<Worker> {
        const response = await api.get(`/workers/${id}`)
        return response.data.data
    },

    async updateWorker(id: number, data: Partial<Worker>): Promise<Worker> {
        const response = await api.put(`/workers/${id}`, data)
        return response.data.data
    },

    async deactivateWorker(id: number): Promise<Worker> {
        const response = await api.delete(`/workers/${id}`)
        return response.data.data
    },

    async searchWorkers(searchTerm: string): Promise<Worker[]> {
        const response = await api.get('/workers/search', {
            params: { q: searchTerm },
        })
        return response.data.data
    },

    async getNextWorkerNumber(): Promise<string> {
        const response = await api.get('/workers/next-number')
        return response.data.data.nextNumber
    },

    async getClassifications(): Promise<string[]> {
        const response = await api.get('/workers/classifications')
        return response.data.data
    },

    async addClassification(name: string): Promise<string> {
        const response = await api.post('/workers/classifications', { name })
        return response.data.data.name
    },
}
