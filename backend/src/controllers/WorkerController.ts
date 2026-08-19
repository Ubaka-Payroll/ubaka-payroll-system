import { Request, Response } from 'express'
import { WorkerService } from '../services/WorkerService'
import { ApiResponse } from '../models/types'

export class WorkerController {
  private workerService: WorkerService

  constructor() {
    this.workerService = new WorkerService()
  }

  registerWorker = async (req: Request, res: Response): Promise<void> => {
    try {
      const worker = await this.workerService.registerWorker(req.body)
      const response: ApiResponse = {
        success: true,
        data: worker,
        message: 'Worker registered successfully',
      }
      res.status(201).json(response)
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      }
      res.status(400).json(response)
    }
  }

  getWorkerById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string)
      const worker = await this.workerService.getWorkerById(id)

      if (!worker) {
        const response: ApiResponse = {
          success: false,
          error: 'Worker not found',
        }
        res.status(404).json(response)
        return
      }

      const response: ApiResponse = {
        success: true,
        data: worker,
      }
      res.json(response)
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      }
      res.status(500).json(response)
    }
  }

  getAllWorkers = async (req: Request, res: Response): Promise<void> => {
    try {
      const includeInactive = req.query.includeInactive === 'true'
      const workers = await this.workerService.getAllWorkers(includeInactive)

      const response: ApiResponse = {
        success: true,
        data: workers,
      }
      res.json(response)
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      }
      res.status(500).json(response)
    }
  }

  updateWorker = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string)
      const worker = await this.workerService.updateWorker(id, req.body)

      const response: ApiResponse = {
        success: true,
        data: worker,
        message: 'Worker updated successfully',
      }
      res.json(response)
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      }
      res.status(400).json(response)
    }
  }

  deactivateWorker = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string)
      const worker = await this.workerService.deactivateWorker(id)

      const response: ApiResponse = {
        success: true,
        data: worker,
        message: 'Worker deactivated successfully',
      }
      res.json(response)
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      }
      res.status(400).json(response)
    }
  }

  getNextWorkerNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const nextNumber = await this.workerService.getNextWorkerNumber()
      res.json({
        success: true,
        data: { nextNumber }
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  searchWorkers = async (req: Request, res: Response): Promise<void> => {
    try {
      const searchTerm = req.query.q as string
      const workers = await this.workerService.searchWorkers(searchTerm || '')

      const response: ApiResponse = {
        success: true,
        data: workers,
      }
      res.json(response)
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: error.message,
      }
      res.status(500).json(response)
    }
  }

  listClassifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const classifications = await this.workerService.listClassifications()
      res.json({
        success: true,
        data: classifications,
      })
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      })
    }
  }

  addClassification = async (req: Request, res: Response): Promise<void> => {
    try {
      const name = await this.workerService.addClassification(req.body?.name || '')
      res.status(201).json({
        success: true,
        data: { name },
        message: 'Classification added',
      })
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      })
    }
  }
}
