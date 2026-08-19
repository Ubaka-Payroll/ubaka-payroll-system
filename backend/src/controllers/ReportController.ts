import { Request, Response } from 'express'
import { ReportService } from '../services/ReportService'
import { logger } from '../utils/Logger'

export class ReportController {
    private reportService: ReportService

    constructor() {
        this.reportService = new ReportService()
    }

    /**
     * Get monthly report
     * GET /api/reports/monthly/:year/:month
     */
    public getMonthlyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const yearParam = Array.isArray(req.params.year) ? req.params.year[0] : req.params.year
            const monthParam = Array.isArray(req.params.month) ? req.params.month[0] : req.params.month

            const year = parseInt(yearParam, 10)
            const month = parseInt(monthParam, 10)

            if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid year or month'
                })
                return
            }

            logger.info('Monthly report requested', { year, month })

            const report = await this.reportService.generateMonthlyReport(month, year)

            res.json({
                success: true,
                data: report
            })
        } catch (error: any) {
            logger.error('Error generating monthly report', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to generate monthly report'
            })
        }
    }

    /**
     * Get late arrival trends
     * GET /api/reports/late-trends?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
     */
    public getLateTrends = async (req: Request, res: Response): Promise<void> => {
        try {
            const startDate = req.query.start_date as string
            const endDate = req.query.end_date as string

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'start_date and end_date are required'
                })
                return
            }

            logger.info('Late trends requested', { startDate, endDate })

            const trends = await this.reportService.generateLateArrivalTrends(startDate, endDate)

            res.json({
                success: true,
                data: trends
            })
        } catch (error: any) {
            logger.error('Error generating late trends', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to generate late arrival trends'
            })
        }
    }

    /**
     * Get payroll export data
     * GET /api/reports/payroll-export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
     */
    public getPayrollExport = async (req: Request, res: Response): Promise<void> => {
        try {
            const startDate = req.query.start_date as string
            const endDate = req.query.end_date as string

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'start_date and end_date are required'
                })
                return
            }

            logger.info('Payroll export requested', { startDate, endDate })

            const payrollData = await this.reportService.generatePayrollExport(startDate, endDate)

            res.json({
                success: true,
                data: payrollData
            })
        } catch (error: any) {
            logger.error('Error generating payroll export', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to generate payroll export'
            })
        }
    }

    /**
     * Export payroll to CSV
     * GET /api/reports/payroll-csv?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
     */
    public exportPayrollCSV = async (req: Request, res: Response): Promise<void> => {
        try {
            const startDate = req.query.start_date as string
            const endDate = req.query.end_date as string

            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'start_date and end_date are required'
                })
                return
            }

            logger.info('Payroll CSV export requested', { startDate, endDate })

            const payrollData = await this.reportService.generatePayrollExport(startDate, endDate)

            // Generate CSV content
            const csvHeader = [
                'Worker Number',
                'Full Name',
                'Classification',
                'Hourly Rate',
                'Days Worked',
                'Total Hours',
                'Regular Pay',
                'Overtime Pay',
                'Gross Pay',
                'Pay'
            ].join(',')

            const csvRows = payrollData.workers.map(w => [
                w.worker_number,
                `"${w.full_name}"`,
                `"${w.classification}"`,
                w.hourly_rate.toFixed(2),
                w.days_worked,
                w.total_hours.toFixed(2),
                w.regular_pay.toFixed(2),
                w.overtime_pay.toFixed(2),
                w.gross_pay.toFixed(2),
                w.net_pay.toFixed(2)
            ].join(','))

            // Add totals row
            const csvTotals = [
                'TOTALS',
                '',
                '',
                '',
                '',
                payrollData.totals.total_hours.toFixed(2),
                '',
                '',
                payrollData.totals.total_gross_pay.toFixed(2),
                payrollData.totals.total_net_pay.toFixed(2)
            ].join(',')

            const csv = [csvHeader, ...csvRows, '', csvTotals].join('\n')

            // Set headers for CSV download
            res.setHeader('Content-Type', 'text/csv')
            res.setHeader('Content-Disposition', `attachment; filename="payroll_${startDate}_to_${endDate}.csv"`)
            res.send(csv)

            logger.info('Payroll CSV exported successfully')
        } catch (error: any) {
            logger.error('Error exporting payroll CSV', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to export payroll CSV'
            })
        }
    }
}
