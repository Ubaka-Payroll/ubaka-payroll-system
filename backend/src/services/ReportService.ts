/**
 * Report Service
 * Handles report generation, analytics, and data export
 */

import { logger } from '../utils/Logger'
import { DailyWorkSummaryRepository } from '../repositories/DailyWorkSummaryRepository'
import { LateArrivalRepository } from '../repositories/LateArrivalRepository'
import { WorkerRepository } from '../repositories/WorkerRepository'
import { AttendanceEventRepository } from '../repositories/AttendanceEventRepository'

export interface MonthlyReportData {
    month: string
    year: number
    workers: WorkerMonthlyStats[]
    summary: {
        total_workers: number
        total_days: number
        total_hours: number
        total_regular_pay: number
        total_deductions: number
        total_net_pay: number
        average_hours_per_worker: number
        late_arrival_rate: number
    }
}

export interface WorkerMonthlyStats {
    worker_id: number
    worker_number: string
    full_name: string
    classification: string
    days_present: number
    days_late: number
    total_hours: number
    regular_pay: number
    deductions: number
    net_pay: number
    late_percentage: number
}

export interface LateArrivalTrends {
    period: {
        start_date: string
        end_date: string
    }
    daily_stats: Array<{
        date: string
        total_late: number
        average_late_minutes: number
        total_deductions: number
    }>
    worker_stats: Array<{
        worker_id: number
        worker_number: string
        full_name: string
        total_lates: number
        average_late_minutes: number
        total_deductions: number
        trend: 'improving' | 'worsening' | 'stable'
    }>
    top_offenders: Array<{
        worker_id: number
        worker_number: string
        full_name: string
        late_count: number
        total_late_minutes: number
    }>
}

export interface PayrollExportData {
    period: {
        start_date: string
        end_date: string
    }
    workers: Array<{
        worker_number: string
        full_name: string
        classification: string
        hourly_rate: number
        days_worked: number
        total_hours: number
        regular_pay: number
        overtime_pay: number
        gross_pay: number
        late_deductions: number
        other_deductions: number
        total_deductions: number
        net_pay: number
    }>
    totals: {
        total_workers: number
        total_hours: number
        total_gross_pay: number
        total_deductions: number
        total_net_pay: number
    }
}

export class ReportService {
    private summaryRepo: DailyWorkSummaryRepository
    private lateRepo: LateArrivalRepository
    private workerRepo: WorkerRepository
    private eventRepo: AttendanceEventRepository

    constructor() {
        this.summaryRepo = new DailyWorkSummaryRepository()
        this.lateRepo = new LateArrivalRepository()
        this.workerRepo = new WorkerRepository()
        this.eventRepo = new AttendanceEventRepository()
    }

    /**
     * Generate monthly report for all workers
     */
    async generateMonthlyReport(month: number, year: number): Promise<MonthlyReportData> {
        try {
            logger.info('Generating monthly report', { month, year })

            // Calculate date range
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`
            const lastDay = new Date(year, month, 0).getDate()
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

            // Get all workers
            const workers = await this.workerRepo.findActiveWorkers()
            const workerStats: WorkerMonthlyStats[] = []

            for (const worker of workers) {
                const summaries = await this.summaryRepo.findByWorkerAndDateRange(
                    worker.id,
                    startDate,
                    endDate
                )

                const lateArrivals = await this.lateRepo.findByWorkerAndDateRange(
                    worker.id,
                    startDate,
                    endDate
                )

                const daysPresent = summaries.filter(s => s.attendance_status !== 'absent' as any).length
                const daysLate = lateArrivals.filter(la => !la.waived).length
                const totalHours = summaries.reduce((sum, s) => sum + (s.total_payable_hours || 0), 0)
                const regularPay = summaries.reduce((sum, s) => sum + (s.regular_pay || 0), 0)
                const netPay = summaries.reduce((sum, s) => sum + (s.net_pay || s.regular_pay || 0), 0)

                workerStats.push({
                    worker_id: worker.id,
                    worker_number: worker.worker_number,
                    full_name: worker.full_name,
                    classification: worker.classification,
                    days_present: daysPresent,
                    days_late: daysLate,
                    total_hours: totalHours,
                    regular_pay: regularPay,
                    deductions: 0,
                    net_pay: netPay,
                    late_percentage: daysPresent > 0 ? (daysLate / daysPresent) * 100 : 0
                })
            }

            // Calculate summary
            const totalHours = workerStats.reduce((sum, w) => sum + w.total_hours, 0)
            const totalRegularPay = workerStats.reduce((sum, w) => sum + w.regular_pay, 0)
            const totalDeductions = workerStats.reduce((sum, w) => sum + w.deductions, 0)
            const totalNetPay = workerStats.reduce((sum, w) => sum + w.net_pay, 0)
            const totalDaysPresent = workerStats.reduce((sum, w) => sum + w.days_present, 0)
            const totalDaysLate = workerStats.reduce((sum, w) => sum + w.days_late, 0)

            return {
                month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
                year,
                workers: workerStats,
                summary: {
                    total_workers: workers.length,
                    total_days: totalDaysPresent,
                    total_hours: totalHours,
                    total_regular_pay: totalRegularPay,
                    total_deductions: totalDeductions,
                    total_net_pay: totalNetPay,
                    average_hours_per_worker: workers.length > 0 ? totalHours / workers.length : 0,
                    late_arrival_rate: totalDaysPresent > 0 ? (totalDaysLate / totalDaysPresent) * 100 : 0
                }
            }
        } catch (error) {
            logger.error('Error generating monthly report', error as Error)
            throw error
        }
    }

    /**
     * Generate late arrival trends analysis
     */
    async generateLateArrivalTrends(startDate: string, endDate: string): Promise<LateArrivalTrends> {
        try {
            logger.info('Generating late arrival trends', { startDate, endDate })

            // Get all late arrivals in period
            const lateArrivals = await this.lateRepo.findByDateRange(startDate, endDate)

            // Daily statistics
            const dailyStatsMap = new Map<string, { total: number, minutes: number[], deductions: number }>()

            for (const late of lateArrivals) {
                // Ensure date is a string in YYYY-MM-DD format
                const workDate = late.work_date as any
                const date = workDate instanceof Date
                    ? workDate.toISOString().split('T')[0]
                    : String(workDate).split('T')[0]  // Handle ISO string format

                if (!dailyStatsMap.has(date)) {
                    dailyStatsMap.set(date, { total: 0, minutes: [], deductions: 0 })
                }
                const stats = dailyStatsMap.get(date)!
                stats.total++
                stats.minutes.push(late.late_minutes)
            }

            const daily_stats = Array.from(dailyStatsMap.entries()).map(([date, stats]) => ({
                date,
                total_late: stats.total,
                average_late_minutes: stats.minutes.reduce((a, b) => a + b, 0) / stats.total,
                total_deductions: 0
            })).sort((a, b) => a.date.localeCompare(b.date))

            // Worker statistics
            const workerStatsMap = new Map<number, {
                worker_id: number,
                worker_number: string,
                full_name: string,
                lates: typeof lateArrivals,
                total_minutes: number,
                total_deductions: number
            }>()

            for (const late of lateArrivals) {
                if (!workerStatsMap.has(late.worker_id)) {
                    workerStatsMap.set(late.worker_id, {
                        worker_id: late.worker_id,
                        worker_number: (late as any).worker_number,
                        full_name: (late as any).full_name,
                        lates: [],
                        total_minutes: 0,
                        total_deductions: 0
                    })
                }
                const stats = workerStatsMap.get(late.worker_id)!
                stats.lates.push(late)
                stats.total_minutes += late.late_minutes
            }

            const worker_stats = Array.from(workerStatsMap.values()).map(stats => {
                const lateCount = stats.lates.length
                const avgMinutes = stats.total_minutes / lateCount

                // Determine trend (compare first half vs second half)
                const midpoint = Math.floor(stats.lates.length / 2)
                const firstHalf = stats.lates.slice(0, midpoint)
                const secondHalf = stats.lates.slice(midpoint)

                const firstAvg = firstHalf.reduce((sum, l) => sum + l.late_minutes, 0) / (firstHalf.length || 1)
                const secondAvg = secondHalf.reduce((sum, l) => sum + l.late_minutes, 0) / (secondHalf.length || 1)

                let trend: 'improving' | 'worsening' | 'stable' = 'stable'
                if (firstAvg - secondAvg > 2) trend = 'improving'
                else if (secondAvg - firstAvg > 2) trend = 'worsening'

                return {
                    worker_id: stats.worker_id,
                    worker_number: stats.worker_number,
                    full_name: stats.full_name,
                    total_lates: lateCount,
                    average_late_minutes: avgMinutes,
                    total_deductions: 0,
                    trend
                }
            }).sort((a, b) => b.total_lates - a.total_lates)

            // Top offenders (most late arrivals)
            const top_offenders = worker_stats.slice(0, 10).map(w => ({
                worker_id: w.worker_id,
                worker_number: w.worker_number,
                full_name: w.full_name,
                late_count: w.total_lates,
                total_late_minutes: w.total_lates * w.average_late_minutes
            }))

            return {
                period: { start_date: startDate, end_date: endDate },
                daily_stats,
                worker_stats,
                top_offenders
            }
        } catch (error) {
            logger.error('Error generating late arrival trends', error as Error)
            throw error
        }
    }

    /**
     * Generate payroll export data
     */
    async generatePayrollExport(startDate: string, endDate: string): Promise<PayrollExportData> {
        try {
            logger.info('Generating payroll export', { startDate, endDate })

            const workers = await this.workerRepo.findActiveWorkers()
            const workerData = []

            for (const worker of workers) {
                const summaries = await this.summaryRepo.findByWorkerAndDateRange(
                    worker.id,
                    startDate,
                    endDate
                )

                const daysWorked = summaries.filter(s => s.attendance_status !== 'absent' as any).length
                const totalHours = summaries.reduce((sum, s) => sum + (s.total_payable_hours || 0), 0)
                const regularPay = summaries.reduce((sum, s) => sum + (s.regular_pay || 0), 0)
                const overtimePay = summaries.reduce((sum, s) => sum + (s.overtime_pay || 0), 0)
                const grossPay = regularPay + overtimePay

                workerData.push({
                    worker_number: worker.worker_number,
                    full_name: worker.full_name,
                    classification: worker.classification,
                    hourly_rate: worker.hourly_rate,
                    days_worked: daysWorked,
                    total_hours: totalHours,
                    regular_pay: regularPay,
                    overtime_pay: overtimePay,
                    gross_pay: grossPay,
                    late_deductions: 0,
                    other_deductions: 0,
                    total_deductions: 0,
                    net_pay: grossPay
                })
            }

            // Calculate totals
            const totals = {
                total_workers: workerData.length,
                total_hours: workerData.reduce((sum, w) => sum + w.total_hours, 0),
                total_gross_pay: workerData.reduce((sum, w) => sum + w.gross_pay, 0),
                total_deductions: workerData.reduce((sum, w) => sum + w.total_deductions, 0),
                total_net_pay: workerData.reduce((sum, w) => sum + w.net_pay, 0)
            }

            return {
                period: { start_date: startDate, end_date: endDate },
                workers: workerData,
                totals
            }
        } catch (error) {
            logger.error('Error generating payroll export', error as Error)
            throw error
        }
    }
}
