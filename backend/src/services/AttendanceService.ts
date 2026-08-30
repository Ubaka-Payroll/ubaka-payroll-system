import { AttendanceEventRepository } from '../repositories/AttendanceEventRepository'
import { WorkerRepository } from '../repositories/WorkerRepository'
import { DailyWageRepository } from '../repositories/DailyWageRepository'
import { CheckoutReviewRepository, CheckoutDecision } from '../repositories/CheckoutReviewRepository'
import { AttendanceEvent, EventType, HoursWorkedResult } from '../models/types'
import { logger } from '../utils/Logger'
import {
    lateMinutesFromWorkStart,
    overlapMs,
    payableEndFromSession,
    payableStartFromEntry,
    checkoutReviewOn,
} from '../constants/workDay'

function localDateKey(value: Date | string): string {
    if (typeof value === 'string') return value.slice(0, 10)
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function parseLocalDate(value: Date | string): Date {
    const key = localDateKey(value)
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function sameLocalDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

export class AttendanceService {
    private attendanceRepository: AttendanceEventRepository
    private workerRepository: WorkerRepository
    private dailyWageRepository: DailyWageRepository
    private checkoutReviewRepository: CheckoutReviewRepository

    constructor() {
        this.attendanceRepository = new AttendanceEventRepository()
        this.workerRepository = new WorkerRepository()
        this.dailyWageRepository = new DailyWageRepository()
        this.checkoutReviewRepository = new CheckoutReviewRepository()
    }

    async recordAttendanceEvent(
        workerId: number,
        eventType: EventType,
        timestamp: Date = new Date(),
        isManualEntry: boolean = false,
        createdBy?: string,
        options: { skipSequenceCheck?: boolean; ownerId?: string } = {}
    ): Promise<AttendanceEvent> {
        const worker = await this.workerRepository.findById(workerId)
        if (!worker) {
            throw new Error(`Worker with ID ${workerId} not found`)
        }
        if (!worker.is_active) {
            throw new Error('Cannot record attendance for inactive worker')
        }

        const todayEvents = await this.attendanceRepository.findByWorkerAndDate(workerId, timestamp)

        if (!options.skipSequenceCheck) {
            const validNextEvents = this.determineNextEventType(todayEvents)
            if (!validNextEvents.includes(eventType)) {
                throw new Error(
                    `Invalid event type '${eventType}'. Expected one of: ${validNextEvents.join(', ')}`
                )
            }
        } else if (eventType === 'EXIT' && todayEvents.some(e => e.event_type === 'EXIT')) {
            throw new Error('Worker already has an EXIT for this date')
        }

        const event = await this.attendanceRepository.recordEvent(
            workerId,
            eventType,
            timestamp,
            isManualEntry,
            createdBy
        )

        // Keep hours / breaks / wage up to date after entry, breaks, or exit
        if (
            eventType === 'ENTRY' ||
            eventType === 'EXIT' ||
            eventType === 'LEAVE_SITE' ||
            eventType === 'RETURN_TO_SITE'
        ) {
            await this.upsertDailyWageProgress(
                workerId,
                timestamp,
                Number(worker.hourly_rate),
                eventType === 'EXIT'
            )
        }

        return event
    }

    /**
     * Persist (or refresh) daily hours & wage.
     * - While still on site: provisional hours (entry → now, minus breaks) and wage
     * - On EXIT: finalized COMPLETE record
     */
    async upsertDailyWageProgress(
        workerId: number,
        date: Date,
        hourlyRate: number,
        finalized: boolean = false
    ): Promise<void> {
        // For in-progress days use wall-clock "now"; EXIT uses the exit event as session end
        const hoursResult = await this.calculateHoursWorked(workerId, date, {
            asOf: finalized ? date : new Date(),
        })
        if (hoursResult.hoursWorked === null) {
            logger.warn('Cannot update daily wage — no entry yet', { workerId })
            return
        }

        const hoursWorked = hoursResult.hoursWorked
        const wageAmount = Math.round(hoursWorked * hourlyRate * 100) / 100

        await this.dailyWageRepository.upsert({
            workerId,
            workDate: date,
            hoursWorked,
            hourlyRate,
            wageAmount,
            entryTime: hoursResult.entryTime,
            exitTime: hoursResult.exitTime,
            breakDurationMs: hoursResult.breakDuration ?? 0,
        })

        logger.info(finalized ? 'Daily wage finalized' : 'Daily wage progress updated', {
            workerId,
            hoursWorked,
            hourlyRate,
            wageAmount,
            breakCount: hoursResult.breakCount,
            status: hoursResult.status,
        })
    }

    /** @deprecated use upsertDailyWageProgress — kept for callers */
    async finalizeDailyWage(
        workerId: number,
        date: Date,
        hourlyRate: number
    ): Promise<void> {
        await this.upsertDailyWageProgress(workerId, date, hourlyRate, true)
    }

    determineNextEventType(events: AttendanceEvent[]): EventType[] {
        if (events.length === 0) {
            return ['ENTRY']
        }

        const lastEvent = events[events.length - 1]

        switch (lastEvent.event_type) {
            case 'ENTRY':
                return ['LEAVE_SITE', 'EXIT']
            case 'LEAVE_SITE':
                return ['RETURN_TO_SITE']
            case 'RETURN_TO_SITE':
                return ['LEAVE_SITE', 'EXIT']
            case 'EXIT':
                return []
            default:
                throw new Error(`Unknown event type: ${lastEvent.event_type}`)
        }
    }

    async getWorkerEventsForDate(workerId: number, date: Date): Promise<AttendanceEvent[]> {
        return await this.attendanceRepository.findByWorkerAndDate(workerId, date)
    }

    async calculateHoursWorked(
        workerId: number,
        date: Date,
        options: { asOf?: Date } = {}
    ): Promise<HoursWorkedResult> {
        const events = await this.attendanceRepository.findByWorkerAndDate(workerId, date)

        if (events.length === 0) {
            return {
                hoursWorked: null,
                status: 'INCOMPLETE',
                breakCount: 0,
                breakDuration: 0,
            }
        }

        const sortedEvents = events.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        const entryEvent = sortedEvents.find(e => e.event_type === 'ENTRY')
        const exitEvent = sortedEvents.find(e => e.event_type === 'EXIT')

        if (!entryEvent) {
            return {
                hoursWorked: null,
                status: 'INCOMPLETE',
                breakCount: 0,
                breakDuration: 0,
            }
        }

        const asOf = options.asOf ?? new Date()
        const entryTs = new Date(entryEvent.timestamp)
        const lastEventTs = new Date(sortedEvents[sortedEvents.length - 1].timestamp)
        const payableStart = payableStartFromEntry(entryTs)
        const lateMinutes = lateMinutesFromWorkStart(entryTs)
        const review = await this.checkoutReviewRepository.findByWorkerAndDate(workerId, date)
        const overtimeApproved = review?.decision === 'OVERTIME'

        const workDay = parseLocalDate(date)
        const sameCalendarDay = sameLocalDay(asOf, workDay)

        const rawSessionEnd = exitEvent
            ? new Date(exitEvent.timestamp)
            : overtimeApproved && review?.overtime_end_time
              ? new Date(review.overtime_end_time)
              : sameCalendarDay
                ? asOf
                : lastEventTs
        const sessionEnd = overtimeApproved
            ? rawSessionEnd
            : payableEndFromSession(rawSessionEnd, entryTs)
        const sessionDuration = Math.max(0, sessionEnd.getTime() - payableStart.getTime())

        // Pair LEAVE_SITE → RETURN_TO_SITE; only time inside 07:00–17:00 is unpaid break
        let totalBreakDuration = 0
        let breakCount = 0
        let openLeave: Date | null = null

        for (const event of sortedEvents) {
            const ts = new Date(event.timestamp)
            if (event.event_type === 'LEAVE_SITE') {
                openLeave = ts
                breakCount += 1
            } else if (event.event_type === 'RETURN_TO_SITE' && openLeave) {
                totalBreakDuration += overlapMs(openLeave, ts, payableStart, sessionEnd)
                openLeave = null
            }
        }
        if (openLeave) {
            totalBreakDuration += overlapMs(openLeave, sessionEnd, payableStart, sessionEnd)
        }

        const netDuration = Math.max(0, sessionDuration - totalBreakDuration)
        const hoursWorked = Math.round((netDuration / (1000 * 60 * 60)) * 60) / 60

        return {
            hoursWorked,
            status: exitEvent ? 'COMPLETE' : 'IN_PROGRESS',
            entryTime: entryEvent.timestamp,
            exitTime: exitEvent?.timestamp,
            breakDuration: totalBreakDuration,
            breakCount,
            lateMinutes,
        }
    }

    async getDailySummary(date: Date, ownerId?: string, siteName?: string): Promise<any[]> {
        const rows = await this.attendanceRepository.getDailyAttendanceSummary(date, ownerId, siteName)

        // Refresh hours / wage / breaks for every worker present today
        for (const row of rows) {
            try {
                const hoursResult = await this.calculateHoursWorked(row.worker_id, date)
                if (hoursResult.hoursWorked != null) {
                    await this.upsertDailyWageProgress(
                        row.worker_id,
                        date,
                        Number(row.hourly_rate),
                        hoursResult.status === 'COMPLETE'
                    )
                    const wage = await this.dailyWageRepository.findByWorkerAndDate(
                        row.worker_id,
                        date
                    )
                    if (wage) {
                        row.hours_worked = wage.hours_worked
                        row.daily_wage = wage.wage_amount
                        row.break_minutes = Math.round(
                            Number(wage.break_duration_ms || 0) / 60000
                        )
                    }
                }
                // Prefer live break count from events
                if (hoursResult.breakCount != null) {
                    row.break_count = hoursResult.breakCount
                }
                row.hours_status = hoursResult.status
                row.late_minutes = hoursResult.lateMinutes ?? 0
                const review = await this.checkoutReviewRepository.findByWorkerAndDate(
                    row.worker_id,
                    date
                )
                const reviewCutoff = checkoutReviewOn(date)
                const now = new Date()
                const afterHours = now >= reviewCutoff
                const exitTs = row.exit_time ? new Date(row.exit_time) : null
                row.checkout_decision = review?.decision ?? null
                row.needs_after_hours_review =
                    afterHours &&
                    !review &&
                    !!row.entry_time &&
                    (!exitTs || exitTs > reviewCutoff)
            } catch (err) {
                logger.warn('Failed to refresh daily summary row', {
                    workerId: row.worker_id,
                    error: (err as Error).message,
                })
            }
        }

        return rows.map(row => ({
            ...row,
            hours_worked: row.hours_worked != null ? Number(row.hours_worked) : null,
            daily_wage: row.daily_wage != null ? Number(row.daily_wage) : null,
            hourly_rate: Number(row.hourly_rate),
            break_count: Number(row.break_count || 0),
            break_minutes:
                row.break_minutes != null
                    ? Number(row.break_minutes)
                    : null,
            hours_status: row.hours_status || (row.exit_time ? 'COMPLETE' : 'IN_PROGRESS'),
            late_minutes: Number(row.late_minutes || 0),
            checkout_decision: row.checkout_decision || null,
            needs_after_hours_review: Boolean(row.needs_after_hours_review),
        }))
    }

    async getWorkerAttendanceHistory(workerId: number, days: number = 30): Promise<any[]> {
        const events = await this.attendanceRepository.getWorkerAttendanceHistory(workerId, days)

        const eventsByDate: { [key: string]: AttendanceEvent[] } = {}

        events.forEach(event => {
            const dateKey = new Date(event.timestamp).toISOString().split('T')[0]
            if (!eventsByDate[dateKey]) {
                eventsByDate[dateKey] = []
            }
            eventsByDate[dateKey].push(event)
        })

        const history = []
        for (const [dateStr, dateEvents] of Object.entries(eventsByDate)) {
            const date = new Date(dateStr)
            const hoursResult = await this.calculateHoursWorked(workerId, date)
            const wage = await this.dailyWageRepository.findByWorkerAndDate(workerId, date)

            history.push({
                date: dateStr,
                events: dateEvents.length,
                hoursWorked: hoursResult.hoursWorked,
                dailyWage: wage ? Number(wage.wage_amount) : null,
                status: hoursResult.status,
                entryTime: hoursResult.entryTime,
                exitTime: hoursResult.exitTime,
            })
        }

        return history.sort((a, b) => b.date.localeCompare(a.date))
    }

    async searchAttendanceRecords(criteria: {
        workerId?: number
        startDate?: Date
        endDate?: Date
        classification?: string
    }): Promise<any[]> {
        const { startDate, endDate } = criteria

        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required')
        }

        const events = await this.attendanceRepository.findByDateRange(startDate, endDate)

        const grouped: { [key: string]: AttendanceEvent[] } = {}

        events.forEach(event => {
            const key = `${event.worker_id}_${new Date(event.timestamp).toISOString().split('T')[0]}`
            if (!grouped[key]) {
                grouped[key] = []
            }
            grouped[key].push(event)
        })

        const records = []
        for (const [key] of Object.entries(grouped)) {
            const [workerIdStr, dateStr] = key.split('_')
            const workerId = parseInt(workerIdStr)
            const worker = await this.workerRepository.findById(workerId)

            if (worker) {
                const date = new Date(dateStr)
                const hoursResult = await this.calculateHoursWorked(workerId, date)
                const wage = await this.dailyWageRepository.findByWorkerAndDate(workerId, date)

                records.push({
                    workerId: worker.id,
                    workerNumber: worker.worker_number,
                    workerName: worker.full_name,
                    classification: worker.classification,
                    date: dateStr,
                    hoursWorked: hoursResult.hoursWorked,
                    dailyWage: wage ? Number(wage.wage_amount) : null,
                    status: hoursResult.status,
                    entryTime: hoursResult.entryTime,
                    exitTime: hoursResult.exitTime,
                })
            }
        }

        let filtered = records
        if (criteria.workerId) {
            filtered = filtered.filter(r => r.workerId === criteria.workerId)
        }
        if (criteria.classification) {
            filtered = filtered.filter(r => r.classification === criteria.classification)
        }

        return filtered.sort((a, b) => b.date.localeCompare(a.date))
    }

    async getAfterHoursQueue(ownerId?: string) {
        const now = new Date()
        const afterHoursToday = now >= checkoutReviewOn(now)
        const rows = await this.checkoutReviewRepository.listOpenCases(30, ownerId)
        const pending: ReturnType<AttendanceService['mapAfterHoursRow']>[] = []
        const overtimeOpen: ReturnType<AttendanceService['mapAfterHoursRow']>[] = []
        const resolved: ReturnType<AttendanceService['mapAfterHoursRow']>[] = []

        for (const row of rows) {
            const mapped = this.mapAfterHoursRow(row)
            const workDate = parseLocalDate(mapped.workDate)
            const isToday = sameLocalDay(workDate, now)
            const afterHours = !isToday || afterHoursToday
            const reviewCutoff = checkoutReviewOn(workDate)
            const hasExit = Boolean(mapped.exitTime)
            const exitAfterClose =
                hasExit && mapped.exitTime != null && new Date(mapped.exitTime) > reviewCutoff
            const decision = mapped.decision

            if (decision === 'OVERTIME' && !hasExit) {
                overtimeOpen.push(mapped)
                continue
            }

            if (decision) {
                if (isToday || afterHours) {
                    resolved.push(mapped)
                }
                continue
            }

            const needsReview = afterHours && (!hasExit || exitAfterClose)
            if (needsReview) {
                pending.push(mapped)
            }
        }

        return {
            afterHoursToday,
            workEnd: '18:00',
            pending,
            overtimeOpen,
            resolved: resolved.filter(r => {
                const workDate = parseLocalDate(r.workDate)
                return sameLocalDay(workDate, now)
            }),
        }
    }

    async resolveAfterHours(input: {
        workerId: number
        date: Date | string
        decision: CheckoutDecision
        overtimeEndTime?: Date | string | null
        notes?: string | null
        reviewedBy?: string | null
    }) {
        const workDate = parseLocalDate(input.date)
        const worker = await this.workerRepository.findById(input.workerId)
        if (!worker) {
            throw new Error(`Worker with ID ${input.workerId} not found`)
        }

        const events = await this.attendanceRepository.findByWorkerAndDate(input.workerId, workDate)
        if (!events.some(e => e.event_type === 'ENTRY')) {
            throw new Error('Worker has no entry for this date')
        }

        const hasExit = events.some(e => e.event_type === 'EXIT')
        let overtimeEnd: Date | null = null
        if (input.decision === 'OVERTIME' && input.overtimeEndTime) {
            overtimeEnd = new Date(input.overtimeEndTime)
            if (isNaN(overtimeEnd.getTime())) {
                throw new Error('Invalid overtime end time')
            }
        }

        const review = await this.checkoutReviewRepository.upsert({
            workerId: input.workerId,
            workDate,
            decision: input.decision,
            overtimeEndTime: overtimeEnd,
            notes: input.notes,
            reviewedBy: input.reviewedBy || 'Field Engineer',
        })

        if (input.decision === 'DELAYED_LEAVE' && !hasExit) {
            await this.recordAttendanceEvent(
                input.workerId,
                'EXIT',
                checkoutReviewOn(workDate),
                true,
                `${input.reviewedBy || 'Field Engineer'} · delayed leaving`,
                { skipSequenceCheck: true }
            )
        } else if (input.decision === 'OVERTIME' && overtimeEnd && !hasExit) {
            await this.recordAttendanceEvent(
                input.workerId,
                'EXIT',
                overtimeEnd,
                true,
                `${input.reviewedBy || 'Field Engineer'} · overtime`,
                { skipSequenceCheck: true }
            )
        } else {
            await this.upsertDailyWageProgress(
                input.workerId,
                workDate,
                Number(worker.hourly_rate),
                hasExit || input.decision === 'DELAYED_LEAVE'
            )
        }

        return review
    }

    private mapAfterHoursRow(row: Record<string, unknown>) {
        return {
            workerId: Number(row.worker_id),
            workerNumber: String(row.worker_number),
            fullName: String(row.full_name),
            classification: String(row.classification),
            hourlyRate: Number(row.hourly_rate),
            workDate: localDateKey(String(row.work_date)),
            entryTime: row.entry_time ? new Date(row.entry_time as string | Date).toISOString() : null,
            exitTime: row.exit_time ? new Date(row.exit_time as string | Date).toISOString() : null,
            hoursWorked: row.hours_worked != null ? Number(row.hours_worked) : null,
            wageAmount: row.wage_amount != null ? Number(row.wage_amount) : null,
            decision: (row.decision as CheckoutDecision | null) || null,
            overtimeEndTime: row.overtime_end_time
                ? new Date(row.overtime_end_time as string | Date).toISOString()
                : null,
            notes: (row.notes as string | null) || null,
            reviewedAt: row.reviewed_at
                ? new Date(row.reviewed_at as string | Date).toISOString()
                : null,
            reviewedBy: (row.reviewed_by as string | null) || null,
        }
    }
}
