import api from './api';

export interface MonthlyReportData {
    month: string;
    year: number;
    workers: WorkerMonthlyStats[];
    summary: {
        total_workers: number;
        total_days: number;
        total_hours: number;
        total_regular_pay: number;
        total_deductions: number;
        total_net_pay: number;
        average_hours_per_worker: number;
        late_arrival_rate: number;
    };
}

export interface WorkerMonthlyStats {
    worker_id: number;
    worker_number: string;
    full_name: string;
    classification: string;
    days_present: number;
    days_late: number;
    total_hours: number;
    regular_pay: number;
    deductions: number;
    net_pay: number;
    late_percentage: number;
}

export interface PayrollExportData {
    period: {
        start_date: string;
        end_date: string;
    };
    workers: Array<{
        worker_number: string;
        full_name: string;
        classification: string;
        hourly_rate: number;
        days_worked: number;
        total_hours: number;
        regular_pay: number;
        overtime_pay: number;
        gross_pay: number;
        late_deductions: number;
        other_deductions: number;
        total_deductions: number;
        net_pay: number;
    }>;
    totals: {
        total_workers: number;
        total_hours: number;
        total_gross_pay: number;
        total_deductions: number;
        total_net_pay: number;
    };
}

const reportService = {
    async getMonthlyReport(year: number, month: number): Promise<MonthlyReportData> {
        const response = await api.get(`/reports/monthly/${year}/${month}`);
        return response.data.data;
    },

    async getPayrollExport(startDate: string, endDate: string): Promise<PayrollExportData> {
        const response = await api.get('/reports/payroll-export', {
            params: { start_date: startDate, end_date: endDate }
        });
        return response.data.data;
    },
};

export default reportService;
