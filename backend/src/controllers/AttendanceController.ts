import { Request, Response } from 'express'
import { AttendanceService } from '../services/AttendanceService'
import { ApiResponse, EventType } from '../models/types'

export class AttendanceController {
    private attendanceService: AttendanceService

    constructor() {
        this.attendanceService = new AttendanceService()
    }

    recordEvent = async (req: Request, res: Response): Promise<void> => {
        try {
            const { workerId, eventType, timestamp, isManualEntry, createdBy } = req.body

            if (!workerId || !eventType) {
                const response: ApiResponse = {
                    success: false,
                    error: 'workerId and eventType are required',
                }
                res.status(400).json(response)
                return
            }

            const ownerId = (req as any).user?.ownerId || (req as any).user?.id
            const event = await this.attendanceService.recordAttendanceEvent(
                workerId,
                eventType as EventType,
                timestamp ? new Date(timestamp) : new Date(),
                isManualEntry || false,
                createdBy || (req as any).user?.fullName || 'Desktop App',
                { ownerId }
            )

            const response: ApiResponse = {
                success: true,
                data: event,
                message: 'Attendance event recorded successfully',
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

    getEventsForDate = async (req: Request, res: Response): Promise<void> => {
        try {
            const workerId = parseInt(req.params.workerId as string)
            const date = new Date(req.params.date as string)

            if (isNaN(workerId) || isNaN(date.getTime())) {
                const response: ApiResponse = {
                    success: false,
                    error: 'Invalid workerId or date',
                }
                res.status(400).json(response)
                return
            }

            const events = await this.attendanceService.getWorkerEventsForDate(workerId, date)

            const response: ApiResponse = {
                success: true,
                data: events,
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

    calculateHours = async (req: Request, res: Response): Promise<void> => {
        try {
            const workerId = parseInt(req.params.workerId as string)
            const date = new Date(req.params.date as string)

            if (isNaN(workerId) || isNaN(date.getTime())) {
                const response: ApiResponse = {
                    success: false,
                    error: 'Invalid workerId or date',
                }
                res.status(400).json(response)
                return
            }

            const hoursWorked = await this.attendanceService.calculateHoursWorked(workerId, date)

            const response: ApiResponse = {
                success: true,
                data: hoursWorked,
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

    getDailySummary = async (req: Request, res: Response): Promise<void> => {
        try {
            const date = req.query.date ? new Date(req.query.date as string) : new Date()
            const ownerId = (req as any).user?.ownerId || (req as any).user?.id
            const siteName = (req as any).user?.siteName || (req.query.siteName as string)

            if (isNaN(date.getTime())) {
                const response: ApiResponse = {
                    success: false,
                    error: 'Invalid date',
                }
                res.status(400).json(response)
                return
            }

            const summary = await this.attendanceService.getDailySummary(date, ownerId, siteName)

            const response: ApiResponse = {
                success: true,
                data: summary,
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

    getWorkerHistory = async (req: Request, res: Response): Promise<void> => {
        try {
            const workerId = parseInt(req.params.workerId as string)
            const days = req.query.days ? parseInt(req.query.days as string) : 30

            if (isNaN(workerId)) {
                const response: ApiResponse = {
                    success: false,
                    error: 'Invalid workerId',
                }
                res.status(400).json(response)
                return
            }

            const history = await this.attendanceService.getWorkerAttendanceHistory(workerId, days)

            const response: ApiResponse = {
                success: true,
                data: history,
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

    searchRecords = async (req: Request, res: Response): Promise<void> => {
        try {
            const { workerId, startDate, endDate, classification } = req.query

            const criteria: any = {}
            if (workerId) criteria.workerId = parseInt(workerId as string)
            if (startDate) criteria.startDate = new Date(startDate as string)
            if (endDate) criteria.endDate = new Date(endDate as string)
            if (classification) criteria.classification = classification as string

            const records = await this.attendanceService.searchAttendanceRecords(criteria)

            const response: ApiResponse = {
                success: true,
                data: records,
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

    getNextEventType = async (req: Request, res: Response): Promise<void> => {
        try {
            const workerId = parseInt(req.params.workerId as string)
            const date = new Date()

            if (isNaN(workerId)) {
                const response: ApiResponse = {
                    success: false,
                    error: 'Invalid workerId',
                }
                res.status(400).json(response)
                return
            }

            const events = await this.attendanceService.getWorkerEventsForDate(workerId, date)
            const nextEventTypes = this.attendanceService.determineNextEventType(events)

            const response: ApiResponse = {
                success: true,
                data: {
                    currentEvents: events.length,
                    nextEventTypes,
                    lastEvent: events.length > 0 ? events[events.length - 1] : null,
                },
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

    getAfterHoursQueue = async (req: Request, res: Response): Promise<void> => {
        try {
            const ownerId = (req as any).user?.ownerId || (req as any).user?.id
            const data = await this.attendanceService.getAfterHoursQueue(ownerId)
            const response: ApiResponse = {
                success: true,
                data,
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

    resolveAfterHours = async (req: Request, res: Response): Promise<void> => {
        try {
            const { workerId, date, decision, overtimeEndTime, notes, reviewedBy } = req.body

            if (!workerId || !date || !decision) {
                const response: ApiResponse = {
                    success: false,
                    error: 'workerId, date, and decision are required',
                }
                res.status(400).json(response)
                return
            }

            if (decision !== 'OVERTIME' && decision !== 'DELAYED_LEAVE') {
                const response: ApiResponse = {
                    success: false,
                    error: 'decision must be OVERTIME or DELAYED_LEAVE',
                }
                res.status(400).json(response)
                return
            }

            const review = await this.attendanceService.resolveAfterHours({
                workerId: Number(workerId),
                date,
                decision,
                overtimeEndTime,
                notes,
                reviewedBy,
            })

            const response: ApiResponse = {
                success: true,
                data: review,
                message: 'After-hours decision saved',
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
}
