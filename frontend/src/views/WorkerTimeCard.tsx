import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, DollarSign, TrendingUp, Users } from 'lucide-react';
import { workerService, Worker } from '../services/workerService';
import attendanceCalculationService, {
    DailyWorkSummary
} from '../services/attendanceCalculationService';
import { LoadingState, EmptyState } from '../components/ui';

const WorkerTimeCard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [worker, setWorker] = useState<Worker | null>(null);
    const [summaries, setSummaries] = useState<DailyWorkSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [totals, setTotals] = useState({
        totalDays: 0,
        presentDays: 0,
        lateDays: 0,
        totalHours: 0,
        totalPay: 0,
        totalDeductions: 0,
        netPay: 0
    });

    useEffect(() => {
        loadWorkerData();
    }, [id]);

    useEffect(() => {
        if (worker) {
            loadTimecardData();
        }
    }, [worker, startDate, endDate]);

    const loadWorkerData = async () => {
        if (!id) return;
        try {
            const workerData = await workerService.getWorkerById(parseInt(id));
            setWorker(workerData);
        } catch (error) {
            console.error('Error loading worker:', error);
        }
    };

    const loadTimecardData = async () => {
        if (!worker) return;
        setLoading(true);
        try {
            const dates = generateDateRange(startDate, endDate);
            const summaryPromises = dates.map(date =>
                attendanceCalculationService.getSummary(worker.id, date).catch(() => null)
            );
            const results = await Promise.all(summaryPromises);
            const validSummaries = results.filter(s => s !== null) as DailyWorkSummary[];
            setSummaries(validSummaries);
            calculateTotals(validSummaries);
        } catch (error) {
            console.error('Error loading timecard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateDateRange = (start: string, end: string): string[] => {
        const dates: string[] = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        while (startDate <= endDate) {
            dates.push(startDate.toISOString().split('T')[0]);
            startDate.setDate(startDate.getDate() + 1);
        }
        return dates;
    };

    const calculateTotals = (summaries: DailyWorkSummary[]) => {
        const totals = summaries.reduce(
            (acc, summary) => {
                if (summary.attendance_status === 'present') acc.presentDays++;
                if (summary.is_late) acc.lateDays++;
                acc.totalHours += parseFloat(String(summary.regular_hours_net || 0));
                acc.totalPay += parseFloat(String(summary.gross_pay || 0));
                acc.totalDeductions += parseFloat(String(summary.total_deductions || 0));
                acc.netPay += parseFloat(String(summary.net_pay || 0));
                return acc;
            },
            {
                totalDays: summaries.length,
                presentDays: 0,
                lateDays: 0,
                totalHours: 0,
                totalPay: 0,
                totalDeductions: 0,
                netPay: 0
            }
        );
        setTotals(totals);
    };

    const formatTime = (timeString?: string) => {
        if (!timeString) return '—';
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatHours = (hours: number | string) => {
        const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
        return isNaN(numHours) ? '0.00' : numHours.toFixed(2);
    };

    const formatCurrency = (amount: number | string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        const formatted = isNaN(numAmount) ? 0 : numAmount;
        return `${formatted.toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
    };

    if (!worker || loading) return <LoadingState label="Loading time card…" />;

    return (
        <div>
            <div style={{ marginBottom: '1rem' }}>
                <button onClick={() => navigate(`/workers/${id}`)} className="btn btn-ghost">
                    <ArrowLeft size={18} />
                    Back to worker details
                </button>
            </div>

            <div className="panel" style={{ marginBottom: '1.25rem' }}>
                <div className="panel__body">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                {worker.full_name}
                            </h2>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                <span>Worker #{worker.worker_number}</span>
                                <span>•</span>
                                <span>{worker.classification}</span>
                                <span>•</span>
                                <span>{formatCurrency(worker.hourly_rate)}/hour</span>
                            </div>
                        </div>
                        <span className={`status-badge ${worker.is_active ? 'active' : 'inactive'}`}>
                            {worker.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="toolbar">
                <div className="search-bar" style={{ maxWidth: '180px' }}>
                    <CalendarDays size={18} />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        max={endDate}
                        style={{ border: 'none', padding: 0, width: '100%' }}
                    />
                </div>
                <div className="search-bar" style={{ maxWidth: '180px' }}>
                    <CalendarDays size={18} />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        max={new Date().toISOString().split('T')[0]}
                        style={{ border: 'none', padding: 0, width: '100%' }}
                    />
                </div>
                <button onClick={loadTimecardData} className="btn btn-primary">
                    <TrendingUp size={18} />
                    Refresh
                </button>
            </div>

            <div className="stats-grid stats-grid--4">
                <div className="stat-card">
                    <div className="stat-card__top">
                        <div className="stat-card__icon">
                            <CalendarDays size={18} />
                        </div>
                    </div>
                    <div className="stat-value">{totals.totalDays}</div>
                    <div className="stat-label">Total days</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__top">
                        <div className="stat-card__icon">
                            <Users size={18} />
                        </div>
                    </div>
                    <div className="stat-value">{totals.presentDays}</div>
                    <div className="stat-label">Present</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__top">
                        <div className="stat-card__icon">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div className="stat-value">{totals.lateDays}</div>
                    <div className="stat-label">Late days</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card__top">
                        <div className="stat-card__icon">
                            <DollarSign size={18} />
                        </div>
                    </div>
                    <div className="stat-value stat-value--sm">{formatHours(totals.totalHours)}</div>
                    <div className="stat-label">Total hours</div>
                </div>
            </div>

            {summaries.length === 0 ? (
                <div className="panel">
                    <EmptyState
                        icon={<CalendarDays size={24} />}
                        title="No attendance records"
                        description="No attendance records found for the selected date range."
                    />
                </div>
            ) : (
                <div className="panel">
                    <div className="panel__head">
                        <h2 className="panel__title">Attendance records ({summaries.length} days)</h2>
                    </div>
                    <div className="panel__body" style={{ padding: 0 }}>
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Day</th>
                                        <th>Status</th>
                                        <th>Entry</th>
                                        <th>Exit</th>
                                        <th>Late</th>
                                        <th>Hours</th>
                                        <th>Pay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaries.map((summary) => (
                                        <tr key={summary.id}>
                                            <td><strong>{summary.work_date}</strong></td>
                                            <td>{new Date(summary.work_date).toLocaleDateString('en-US', { weekday: 'short' })}</td>
                                            <td>
                                                <span className={`status-badge ${summary.attendance_status === 'present' ? 'active' :
                                                        summary.attendance_status === 'absent' ? 'inactive' :
                                                            'incomplete'
                                                    }`}>
                                                    {summary.attendance_status}
                                                </span>
                                            </td>
                                            <td>{formatTime(summary.actual_entry_time)}</td>
                                            <td>{formatTime(summary.actual_exit_time)}</td>
                                            <td>
                                                {summary.is_late ? (
                                                    <span style={{ color: 'var(--rose)', fontWeight: 600 }}>
                                                        {summary.late_minutes} min
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td>{formatHours(summary.regular_hours_net)}h</td>
                                            <td style={{ fontWeight: 700 }}>{formatCurrency(summary.net_pay)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                                        <td colSpan={6}><strong>TOTALS</strong></td>
                                        <td><strong>{formatHours(totals.totalHours)}h</strong></td>
                                        <td><strong>{formatCurrency(totals.netPay)}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkerTimeCard;
