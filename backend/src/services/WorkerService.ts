import { WorkerRepository } from '../repositories/WorkerRepository'
import { Worker } from '../models/types'
import {
  OTHER_CLASSIFICATION,
  normalizeClassificationName,
  sortClassifications,
} from '../constants/classifications'

export class WorkerService {
  private workerRepository: WorkerRepository

  constructor() {
    this.workerRepository = new WorkerRepository()
  }

  async getNextWorkerNumber(): Promise<string> {
    return await this.workerRepository.getNextWorkerNumber()
  }

  async registerWorker(rawData: any): Promise<Worker> {
    // 1. Map camelCase properties from frontend to snake_case columns
    const nid = rawData.nid
    const classification = rawData.classification
    const fullName = rawData.fullName || rawData.full_name
    const phoneNumber = rawData.phoneNumber || rawData.phone_number
    const emailAddress = rawData.emailAddress || rawData.email_address
    const hourlyRate = rawData.hourlyRate || rawData.hourly_rate
    const fingerprintStr = rawData.fingerprintId || rawData.fingerprint_data || rawData.fingerprintData

    if (!nid) throw new Error('National ID (NID) is required')
    if (!fullName) throw new Error('Full Name is required')
    if (!classification) throw new Error('Classification is required')
    const normalizedClassification = await this.ensureClassification(classification)
    if (hourlyRate === undefined || hourlyRate === null) throw new Error('Hourly Rate is required')
    if (!fingerprintStr) throw new Error('Fingerprint data is required')

    // 2. Decode fingerprint base64 template to binary Buffer for PostgreSQL BYTEA
    let fingerprintBuffer: Buffer
    try {
      fingerprintBuffer = Buffer.from(fingerprintStr, 'base64')
    } catch (err) {
      throw new Error('Invalid fingerprint data encoding (must be base64 string)')
    }

    // 3. Auto-generate the next worker number starting from W001
    const worker_number = await this.workerRepository.getNextWorkerNumber()

    // 4. Validate unique NID
    const existingByNID = await this.workerRepository.findByNID(nid)
    if (existingByNID) {
      throw new Error(`Worker with NID ${nid} already exists`)
    }

    // 5. Check duplicate fingerprint
    const duplicateFingerprint = await this.workerRepository.checkDuplicateFingerprint(fingerprintBuffer)
    if (duplicateFingerprint) {
      throw new Error('This fingerprint is already registered')
    }

    // 6. Build database entity
    const owner_id = rawData.ownerId || rawData.owner_id || null
    const entity = {
      nid,
      worker_number,
      classification: normalizedClassification,
      full_name: fullName,
      phone_number: phoneNumber || null,
      email_address: emailAddress || null,
      hourly_rate: parseFloat(hourlyRate),
      fingerprint_data: fingerprintBuffer,
      owner_id,
    }

    // 7. Save to DB
    const worker = await this.workerRepository.create(entity as any)
    return worker
  }

  async getWorkerById(id: number): Promise<Worker | null> {
    return await this.workerRepository.findById(id)
  }

  async getAllWorkers(includeInactive: boolean = false, ownerId?: string): Promise<Worker[]> {
    if (includeInactive) {
      return await this.workerRepository.findAll()
    }
    return await this.workerRepository.findActiveWorkers(ownerId)
  }

  async searchWorkers(searchTerm: string, ownerId?: string): Promise<Worker[]> {
    return await this.workerRepository.searchWorkers(searchTerm, ownerId)
  }

  async updateWorker(id: number, data: Partial<Worker>): Promise<Worker> {
    const worker = await this.workerRepository.findById(id)
    if (!worker) {
      throw new Error(`Worker with ID ${id} not found`)
    }

    // Prevent updating certain fields
    const { id: _, fingerprint_data, nid, worker_number, ...updateData } = data as any
    if (updateData.classification) {
      updateData.classification = await this.ensureClassification(String(updateData.classification))
    }

    return await this.workerRepository.update(id, updateData)
  }

  async deactivateWorker(id: number): Promise<Worker> {
    const worker = await this.workerRepository.findById(id)
    if (!worker) {
      throw new Error(`Worker with ID ${id} not found`)
    }

    if (!worker.is_active) {
      throw new Error('Worker is already inactive')
    }

    return await this.workerRepository.deactivateWorker(id)
  }

  async getWorkersByClassification(classification: string): Promise<Worker[]> {
    return await this.workerRepository.findByClassification(classification)
  }

  async listClassifications(): Promise<string[]> {
    const names = await this.workerRepository.listClassifications()
    return sortClassifications(names)
  }

  async addClassification(rawName: string): Promise<string> {
    return this.ensureClassification(rawName)
  }

  private requireStoredClassification(rawName: string): string {
    const name = normalizeClassificationName(rawName)
    if (name === OTHER_CLASSIFICATION) {
      throw new Error('Enter a name for the new classification')
    }
    return name
  }

  private async ensureClassification(rawName: string): Promise<string> {
    const name = this.requireStoredClassification(rawName)
    return this.workerRepository.addClassification(name)
  }

  async validateUniqueNID(nid: string, excludeId?: number): Promise<boolean> {
    const existing = await this.workerRepository.findByNID(nid)
    if (!existing) return true
    if (excludeId && existing.id === excludeId) return true
    return false
  }

  async validateUniqueWorkerNumber(workerNumber: string, excludeId?: number): Promise<boolean> {
    const existing = await this.workerRepository.findByWorkerNumber(workerNumber)
    if (!existing) return true
    if (excludeId && existing.id === excludeId) return true
    return false
  }
}
