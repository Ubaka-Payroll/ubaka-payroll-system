/**
 * Attendance Calculation Service
 * Core engine for calculating daily work summaries with strict 7:00 AM rule
 */

import { Pool } from 'pg'
import { logger } from '../utils/Logger'
import {
    DailyWorkSummary,
    LateArrival,
    AttendanceEvent,
    WorkerBreak,
    OvertimeAuthorization,
    WorkSchedule,
    AttendanceCalculationResult,
    EventType,
} from '../models/attendance-types'
import { DailyWorkSummaryRepository } from '../repositories/DailyWorkSummaryRepository'
import { LateArrivalRepository } from '../repositories/LateArrivalRepository'
import { WorkScheduleRepository } from '../repositories/WorkScheduleRepository'
import { AttendanceEventRepository } from '../repositories/AttendanceEventRepository'
import { overlapMs, workEndOn } from '../constants/workDay'

export class AttendanceCalculationService {
    private summaryRepo: DailyWorkSummaryRepository
    private lateRepo: LateArrivalRepository
    private scheduleRepo: WorkScheduleRepository
    private eventRepo: AttendanceEventRepository

    constructor() {
        this.summaryRepo = new DailyWorkSummaryRepository()
        this.lateRepo = new LateArrivalRepository()
        this.scheduleRepo = new WorkScheduleRepository()
        this.eventRepo = new AttendanceEventRepository()
    }

    /**
     * Calculate daily work summary for a worker on a specific date
     */
    async calculateDailyWorkSummary(
        workerId: number,
        date: string,
        hourlyRate: number
    ): Promise<AttendanceCalculationResult> {
        try {
            logger.info('Calculating daily work summary', { workerId, date })

            // Get work schedule
            const schedule = await this.scheduleRepo.getDefault()

            // Convert string date to Date object for repository query
            const dateObj = new Date(date)

            // Get all events for this worker on this date
            const events = await this.eventRepo.findByWorkerAndDate(workerId, dateObj)

            if (events.length === 0) {
                return this.createAbsentSummary(workerId, date, schedule, hourlyRate)
            }

            // Sort events by time
            events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

            const entryEvent = events.find((e) => e.event_type === 'ENTRY')
            const exitEvent = [...events].reverse().find((e) => e.event_type === 'EXIT')

            if (!entryEvent) {
                return this.createIncompleteSummary(
                    workerId,
                    date,
                    schedule,
                    hourlyRate,
                    'Missing entry event'
                )
            }

            // Calculate summary
            const summary = await this.calculateSummary({
                workerId,
                date,
                hourlyRate,
                schedule,
                entryTime: new Date(entryEvent.timestamp),
                exitTime: exitEvent ? new Date(exitEvent.timestamp) : null,
                events,
            })

            // Save to database
            const savedSummary = await this.summaryRepo.upsert(summary)

            // Create late arrival record if applicable
            let lateArrival: LateArrival | undefined
            if (summary.is_late) {
                const lateCount = await this.lateRepo.getLateCountThisMonth(workerId)
                lateArrival = await this.lateRepo.create({
                    worker_id: workerId,
                    work_date: date,
                    summary_id: savedSummary.id,
                    scheduled_time: schedule.start_time,
                    actual_time: this.extractTimeString(new Date(entryEvent.timestamp)),
                    late_minutes: summary.late_minutes,
                    hourly_rate: hourlyRate,
                    deduction_amount: 0,
                    deduction_applied: false,
                    warning_issued: lateCount >= 2, // Warn after 3rd late
                    late_count_this_month: lateCount + 1,
                    waived: false,
                })
            }

            const result: AttendanceCalculationResult = {
                summary: savedSummary,
                late_arrival: lateArrival,
                anomalies: [],
                warnings: [],
            }

            // Check for anomalies
            if (!exitEvent) {
                result.anomalies.push('Missing exit event')
                result.warnings.push('Worker has not exited yet or forgot to fingerprint out')
            }

            logger.info('Daily work summary calculated', {
                workerId,
                date,
                payableHours: summary.total_payable_hours,
                isLate: summary.is_late,
            })

            return result
        } catch (error) {
            logger.error('Failed to calculate daily work summary', error as Error)
            throw error
        }
    }

    /**
     * Core calculation logic
     */
    private async calculateSummary(params: {
        workerId: number
        date: string
        hourlyRate: number
        schedule: WorkSchedule
        entryTime: Date
        exitTime: Date | null
        events: AttendanceEvent[]
    }): Promise<DailyWorkSummary> {
        const { workerId, date, hourlyRate, schedule, entryTime, exitTime, events } = params

        // Create date objects for schedule times
        const scheduledStart = this.createDateTime(date, schedule.start_time)
        const scheduledEnd = this.createDateTime(date, schedule.end_time)

        // Late vs 07:00 is informational only — pay is hours actually worked
        const isLate = entryTime > scheduledStart
        const lateMinutes = isLate ? this.getMinutesDifference(scheduledStart, entryTime) : 0

        // Check if early arrival
        const isEarlyArrival = entryTime < scheduledStart

        // Payable entry time = MAX(actual_entry, scheduled_start)
        // If arrived early, paid from 7:00 AM. If late, paid from actual arrival.
        const payableEntryTime = isEarlyArrival ? scheduledStart : entryTime

        // Payable exit time = MIN(actual_exit, 17:00). Time after 5:00 PM is not paid.
        const actualExitTime = exitTime || new Date()
        const hardStop = workEndOn(entryTime)
        const scheduledCap = scheduledEnd < hardStop ? scheduledEnd : hardStop
        const payableExitTime = actualExitTime < scheduledCap ? actualExitTime : scheduledCap

        // Calculate breaks inside the paid 07:00–17:00 window
        const breakMinutes = this.calculateBreakMinutes(events, payableEntryTime, payableExitTime)

        // Calculate regular hours
        const grossMinutes = this.getMinutesDifference(payableEntryTime, payableExitTime)
        const netMinutes = Math.max(0, grossMinutes - breakMinutes.unpaid)
        const regularHoursGross = grossMinutes / 60
        const regularHoursNet = netMinutes / 60

        // Check for early departure
        const isEarlyDeparture = exitTime ? exitTime < scheduledEnd : false
        const earlyDepartureMinutes = isEarlyDeparture && exitTime
            ? this.getMinutesDifference(exitTime, scheduledEnd)
            : 0

        // Calculate overtime (only if exits after scheduled end)
        const overtimeHours = 0 // TODO: Implement with overtime authorization check

        // Pay for time actually worked (hours × rate). Late is recorded, not deducted.
        const regularPay = regularHoursNet * hourlyRate
        const overtimePay = overtimeHours * hourlyRate * schedule.overtime_rate_multiplier
        const grossPay = regularPay + overtimePay
        const netPay = grossPay

        // Determine attendance status
        let attendanceStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_DEPARTURE' | 'INCOMPLETE' = 'PRESENT'
        if (isLate) attendanceStatus = 'LATE'
        if (isEarlyDeparture) attendanceStatus = 'EARLY_DEPARTURE'
        if (!exitTime) attendanceStatus = 'INCOMPLETE'

        // Anomalies
        const hasAnomalies = !exitTime || breakMinutes.incomplete > 0
        const anomalyCount = (!exitTime ? 1 : 0) + (breakMinutes.incomplete > 0 ? 1 : 0)

        const summary: DailyWorkSummary = {
            worker_id: workerId,
            work_date: date,
            schedule_id: schedule.id,

            actual_entry_time: entryTime,
            actual_exit_time: exitTime,
            payable_entry_time: payableEntryTime,
            payable_exit_time: payableExitTime,

            attendance_status: attendanceStatus,
            is_late: isLate,
            late_minutes: lateMinutes,
            late_deduction_amount: 0,
            is_early_departure: isEarlyDeparture,
            early_departure_minutes: earlyDepartureMinutes,
            early_departure_deduction: 0,
            is_early_arrival: isEarlyArrival,

            total_break_minutes: breakMinutes.total,
            paid_break_minutes: breakMinutes.paid,
            unpaid_break_minutes: breakMinutes.unpaid,
            break_count: breakMinutes.count,

            regular_hours_gross: Number(regularHoursGross.toFixed(2)),
            regular_hours_net: Number(regularHoursNet.toFixed(2)),
            overtime_hours: Number(overtimeHours.toFixed(2)),
            total_payable_hours: Number((regularHoursNet + overtimeHours).toFixed(2)),

            hourly_rate: hourlyRate,
            regular_pay: Number(regularPay.toFixed(2)),
            overtime_pay: Number(overtimePay.toFixed(2)),
            gross_pay: Number(grossPay.toFixed(2)),
            total_deductions: 0,
            net_pay: Number(netPay.toFixed(2)),

            has_anomalies: hasAnomalies,
            anomaly_count: anomalyCount,
            requires_supervisor_review: hasAnomalies,

            calculation_status: 'CALCULATED',
            approved_for_payroll: false,
        }

        return summary
    }

    /**
     * Calculate break minutes from events
     */
    private calculateBreakMinutes(
        events: AttendanceEvent[],
        windowStart: Date,
        windowEnd: Date
    ): {
        total: number
        paid: number
        unpaid: number
        count: number
        incomplete: number
    } {
        let totalMinutes = 0
        let paidMinutes = 0
        let unpaidMinutes = 0
        let count = 0
        let incomplete = 0

        const breakStarts: Date[] = []
        const breakEnds: Date[] = []

        events.forEach((event) => {
            if (event.event_type === 'LEAVE_SITE') {
                breakStarts.push(new Date(event.timestamp))
            } else if (event.event_type === 'RETURN_TO_SITE') {
                breakEnds.push(new Date(event.timestamp))
            }
        })

        for (let i = 0; i < breakStarts.length; i++) {
            if (i < breakEnds.length) {
                const minutes = Math.round(
                    overlapMs(breakStarts[i], breakEnds[i], windowStart, windowEnd) / 60_000
                )
                totalMinutes += minutes
                if (minutes > 30) {
                    unpaidMinutes += minutes
                } else {
                    paidMinutes += minutes
                }
                count++
            } else {
                incomplete++
            }
        }

        return {
            total: totalMinutes,
            paid: paidMinutes,
            unpaid: unpaidMinutes,
            count,
            incomplete,
        }
    }

    /**
     * Create absent summary
     */
    private createAbsentSummary(
        workerId: number,
        date: string,
        schedule: WorkSchedule,
        hourlyRate: number
    ): AttendanceCalculationResult {
        const summary: DailyWorkSummary = {
            worker_id: workerId,
            work_date: date,
            schedule_id: schedule.id,
            actual_entry_time: null,
            actual_exit_time: null,
            payable_entry_time: null,
            payable_exit_time: null,
            attendance_status: 'ABSENT',
            is_late: false,
            late_minutes: 0,
            late_deduction_amount: 0,
            is_early_departure: false,
            early_departure_minutes: 0,
            early_departure_deduction: 0,
            is_early_arrival: false,
            total_break_minutes: 0,
            paid_break_minutes: 0,
            unpaid_break_minutes: 0,
            break_count: 0,
            regular_hours_gross: 0,
            regular_hours_net: 0,
            overtime_hours: 0,
            total_payable_hours: 0,
            hourly_rate: hourlyRate,
            regular_pay: 0,
            overtime_pay: 0,
            gross_pay: 0,
            total_deductions: 0,
            net_pay: 0,
            has_anomalies: true,
            anomaly_count: 1,
            requires_supervisor_review: true,
            calculation_status: 'CALCULATED',
            approved_for_payroll: false,
        }

        return {
            summary,
            anomalies: ['No attendance events recorded'],
            warnings: ['Worker was absent or forgot to fingerprint'],
        }
    }

    /**
     * Create incomplete summary
     */
    private createIncompleteSummary(
        workerId: number,
        date: string,
        schedule: WorkSchedule,
        hourlyRate: number,
        reason: string
    ): AttendanceCalculationResult {
        const summary: DailyWorkSummary = {
            worker_id: workerId,
            work_date: date,
            schedule_id: schedule.id,
            actual_entry_time: null,
            actual_exit_time: null,
            payable_entry_time: null,
            payable_exit_time: null,
            attendance_status: 'INCOMPLETE',
            is_late: false,
            late_minutes: 0,
            late_deduction_amount: 0,
            is_early_departure: false,
            early_departure_minutes: 0,
            early_departure_deduction: 0,
            is_early_arrival: false,
            total_break_minutes: 0,
            paid_break_minutes: 0,
            unpaid_break_minutes: 0,
            break_count: 0,
            regular_hours_gross: 0,
            regular_hours_net: 0,
            overtime_hours: 0,
            total_payable_hours: 0,
            hourly_rate: hourlyRate,
            regular_pay: 0,
            overtime_pay: 0,
            gross_pay: 0,
            total_deductions: 0,
            net_pay: 0,
            has_anomalies: true,
            anomaly_count: 1,
            requires_supervisor_review: true,
            calculation_status: 'CALCULATED',
            approved_for_payroll: false,
        }

        return {
            summary,
            anomalies: [reason],
            warnings: ['Attendance record is incomplete'],
        }
    }

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Create DateTime from date string and time string
     */
    private createDateTime(date: string, time: string): Date {
        return new Date(`${date}T${time}`)
    }

    /**
     * Get minutes difference between two dates
     */
    private getMinutesDifference(start: Date, end: Date): number {
        return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000 / 60))
    }

    /**
     * Extract time string from Date (HH:MM:SS)
     */
    private extractTimeString(date: Date): string {
        return date.toTimeString().substring(0, 8)
    }

    /**
     * Format date to YYYY-MM-DD
     */
    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0]
    }
}
