-- ============================================================================
-- UBAKA ATTENDANCE V2 MIGRATION
-- Adds enhanced attendance tracking with strict 7:00 AM rule
-- ============================================================================

-- 1. Work Schedules
CREATE TABLE IF NOT EXISTS work_schedule (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL DEFAULT '07:00:00',
    end_time TIME NOT NULL DEFAULT '17:00:00',
    standard_hours DECIMAL(4,2) NOT NULL DEFAULT 10.00,
    early_arrival_allowed BOOLEAN DEFAULT TRUE,
    early_arrival_start TIME DEFAULT '05:30:00',
    overtime_grace_minutes INT DEFAULT 15,
    overtime_rate_multiplier DECIMAL(3,2) DEFAULT 1.50,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO work_schedule (name, is_default, start_time, end_time)
VALUES ('Standard Construction Shift', TRUE, '07:00:00', '17:00:00')
ON CONFLICT DO NOTHING;

-- 2. Overtime Authorizations
CREATE TABLE IF NOT EXISTS overtime_authorization (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    authorized_by INT REFERENCES worker(id),
    reason TEXT NOT NULL,
    approved_start_time TIME NOT NULL DEFAULT '17:00:00',
    approved_end_time TIME NOT NULL,
    approved_hours DECIMAL(4,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    actual_start_time TIME,
    actual_end_time TIME,
    actual_hours DECIMAL(4,2),
    payable_hours DECIMAL(4,2),
    verified BOOLEAN DEFAULT FALSE,
    verified_by INT REFERENCES worker(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(worker_id, work_date)
);

-- 3. Break Types (required by worker_break)
CREATE TABLE IF NOT EXISTS break_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_paid BOOLEAN DEFAULT FALSE,
    min_duration_minutes INT DEFAULT 0,
    max_duration_minutes INT,
    requires_approval BOOLEAN DEFAULT FALSE,
    auto_approve_within_limit BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO break_types (name, description, is_paid, min_duration_minutes, max_duration_minutes, requires_approval) VALUES
('Lunch Break', 'Standard lunch break', FALSE, 30, 60, FALSE),
('Tea Break', 'Short tea/coffee break', TRUE, 10, 15, FALSE),
('Emergency', 'Emergency leave from site', FALSE, NULL, NULL, TRUE),
('Prayer Break', 'Prayer/religious observance', TRUE, 10, 20, FALSE),
('Unauthorized', 'Unrecorded/unauthorized absence', FALSE, NULL, NULL, TRUE)
ON CONFLICT (name) DO NOTHING;

-- 4. Worker Breaks
CREATE TABLE IF NOT EXISTS worker_break (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    break_type_id INT REFERENCES break_types(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INT,
    is_authorized BOOLEAN DEFAULT TRUE,
    is_paid BOOLEAN DEFAULT FALSE,
    authorized_by INT REFERENCES worker(id),
    status VARCHAR(20) DEFAULT 'COMPLETED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Daily Work Summary (Main Payroll Table)
CREATE TABLE IF NOT EXISTS daily_work_summary (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    schedule_id INT REFERENCES work_schedule(id),
    
    -- Actual times from fingerprint
    actual_entry_time TIMESTAMP,
    actual_exit_time TIMESTAMP,
    
    -- Payable times (after rules)
    payable_entry_time TIMESTAMP,
    payable_exit_time TIMESTAMP,
    
    -- Status flags
    attendance_status VARCHAR(20) DEFAULT 'PRESENT',
    is_late BOOLEAN DEFAULT FALSE,
    late_minutes INT DEFAULT 0,
    late_deduction_amount DECIMAL(10,2) DEFAULT 0,
    is_early_departure BOOLEAN DEFAULT FALSE,
    early_departure_minutes INT DEFAULT 0,
    early_departure_deduction DECIMAL(10,2) DEFAULT 0,
    is_early_arrival BOOLEAN DEFAULT FALSE,
    
    -- Break tracking
    total_break_minutes INT DEFAULT 0,
    paid_break_minutes INT DEFAULT 0,
    unpaid_break_minutes INT DEFAULT 0,
    break_count INT DEFAULT 0,
    
    -- Hours
    regular_hours_gross DECIMAL(4,2) DEFAULT 0,
    regular_hours_net DECIMAL(4,2) DEFAULT 0,
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    total_payable_hours DECIMAL(4,2) DEFAULT 0,
    
    -- Financial
    hourly_rate DECIMAL(10,2),
    regular_pay DECIMAL(10,2) DEFAULT 0,
    overtime_pay DECIMAL(10,2) DEFAULT 0,
    gross_pay DECIMAL(10,2) DEFAULT 0,
    total_deductions DECIMAL(10,2) DEFAULT 0,
    net_pay DECIMAL(10,2) DEFAULT 0,
    
    -- Anomalies
    has_anomalies BOOLEAN DEFAULT FALSE,
    anomaly_count INT DEFAULT 0,
    requires_supervisor_review BOOLEAN DEFAULT FALSE,
    
    -- Approval
    calculation_status VARCHAR(20) DEFAULT 'PENDING',
    approved_by INT REFERENCES worker(id),
    approved_at TIMESTAMP,
    approved_for_payroll BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(worker_id, work_date)
);

-- 6. Late Arrivals Tracking
CREATE TABLE IF NOT EXISTS late_arrival (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    summary_id INT REFERENCES daily_work_summary(id) ON DELETE CASCADE,
    scheduled_time TIME NOT NULL DEFAULT '07:00:00',
    actual_time TIME NOT NULL,
    late_minutes INT NOT NULL,
    hourly_rate DECIMAL(10,2),
    deduction_amount DECIMAL(10,2) NOT NULL,
    deduction_applied BOOLEAN DEFAULT TRUE,
    warning_issued BOOLEAN DEFAULT FALSE,
    late_count_this_month INT DEFAULT 1,
    waived BOOLEAN DEFAULT FALSE,
    waived_by INT REFERENCES worker(id),
    waiver_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(worker_id, work_date)
);

-- 7. Attendance Adjustments
CREATE TABLE IF NOT EXISTS attendance_adjustment (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    summary_id INT REFERENCES daily_work_summary(id) ON DELETE CASCADE,
    anomaly_id INT REFERENCES attendance_anomaly(id),
    adjustment_type VARCHAR(50) NOT NULL,
    field_adjusted VARCHAR(50),
    original_value TEXT,
    adjusted_value TEXT,
    reason TEXT NOT NULL,
    hours_adjustment DECIMAL(4,2) DEFAULT 0,
    pay_adjustment DECIMAL(10,2) DEFAULT 0,
    adjusted_by INT NOT NULL REFERENCES worker(id),
    adjusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT REFERENCES worker(id),
    approved_at TIMESTAMP
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_ot_auth_worker_date ON overtime_authorization(worker_id, work_date);
CREATE INDEX IF NOT EXISTS idx_worker_break_date ON worker_break(worker_id, work_date);
CREATE INDEX IF NOT EXISTS idx_dws_worker_date ON daily_work_summary(worker_id, work_date);
CREATE INDEX IF NOT EXISTS idx_dws_status ON daily_work_summary(calculation_status);
CREATE INDEX IF NOT EXISTS idx_dws_review ON daily_work_summary(requires_supervisor_review) WHERE requires_supervisor_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_late_worker_date ON late_arrival(worker_id, work_date);
CREATE INDEX IF NOT EXISTS idx_adj_worker_date ON attendance_adjustment(worker_id, work_date);

-- Update trigger for daily_work_summary
CREATE OR REPLACE FUNCTION update_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dws_timestamp 
    BEFORE UPDATE ON daily_work_summary 
    FOR EACH ROW EXECUTE FUNCTION update_summary_timestamp();

COMMENT ON TABLE daily_work_summary IS 'Calculated daily attendance and payroll data - derived from attendance_event';
COMMENT ON TABLE overtime_authorization IS 'Pre-approved overtime - required for OT payment';
COMMENT ON TABLE late_arrival IS 'Late arrival tracking with strict 7:00 AM rule';
