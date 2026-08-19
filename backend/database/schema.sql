-- Ubaka Attendance Tracking System Database Schema
-- PostgreSQL Database

-- Create ENUM types
CREATE TYPE event_type_enum AS ENUM ('ENTRY', 'EXIT', 'LEAVE_SITE', 'RETURN_TO_SITE');
CREATE TYPE anomaly_type_enum AS ENUM ('MISSING_EXIT', 'MISSING_RETURN', 'EXCESSIVE_BREAK', 'DUPLICATE_ENTRY');
CREATE TYPE email_type_enum AS ENUM ('DAILY_SUMMARY', 'ANALYTICS', 'EXCEPTION_ALERT');
CREATE TYPE email_status_enum AS ENUM ('PENDING', 'SENT', 'FAILED');

-- Worker Table
CREATE TABLE worker (
    id SERIAL PRIMARY KEY,
    nid VARCHAR(50) NOT NULL UNIQUE,
    worker_number VARCHAR(50) NOT NULL UNIQUE,
    classification VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    email_address VARCHAR(255),
    hourly_rate DECIMAL(10, 2) NOT NULL,
    fingerprint_data BYTEA NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Worker table
CREATE UNIQUE INDEX idx_worker_nid ON worker(nid);
CREATE UNIQUE INDEX idx_worker_number ON worker(worker_number);
CREATE INDEX idx_worker_classification ON worker(classification);
CREATE INDEX idx_worker_active ON worker(is_active);

-- Job classifications (built-in + custom names added from OTHER)
CREATE TABLE worker_classification (
    name VARCHAR(100) PRIMARY KEY,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO worker_classification (name, is_builtin) VALUES
    ('MASON', TRUE),
    ('CARPENTER', TRUE),
    ('ELECTRICIAN', TRUE),
    ('PLUMBER', TRUE),
    ('LABORER', TRUE),
    ('SUPERVISOR', TRUE),
    ('OPERATOR', TRUE);

-- AttendanceEvent Table
CREATE TABLE attendance_event (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    event_type event_type_enum NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    is_manual_entry BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES worker(id) ON DELETE CASCADE
);

-- Indexes for AttendanceEvent table
CREATE INDEX idx_attendance_worker ON attendance_event(worker_id);
CREATE INDEX idx_attendance_timestamp ON attendance_event(timestamp);
CREATE INDEX idx_attendance_worker_date ON attendance_event(worker_id, DATE(timestamp));

-- AttendanceAnomaly Table
CREATE TABLE attendance_anomaly (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    anomaly_type anomaly_type_enum NOT NULL,
    detection_date DATE NOT NULL,
    description TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES worker(id) ON DELETE CASCADE
);

-- Indexes for AttendanceAnomaly table
CREATE INDEX idx_anomaly_worker ON attendance_anomaly(worker_id);
CREATE INDEX idx_anomaly_date ON attendance_anomaly(detection_date);
CREATE INDEX idx_anomaly_resolved ON attendance_anomaly(is_resolved);

-- DailyWage Table (persisted hours × rate when worker exits for the day)
CREATE TABLE daily_wage (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    hours_worked DECIMAL(8, 2) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    wage_amount DECIMAL(12, 2) NOT NULL,
    entry_time TIMESTAMP,
    exit_time TIMESTAMP,
    break_duration_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES worker(id) ON DELETE CASCADE,
    UNIQUE (worker_id, work_date)
);

CREATE INDEX idx_daily_wage_date ON daily_wage(work_date);
CREATE INDEX idx_daily_wage_worker ON daily_wage(worker_id);

CREATE TABLE checkout_review (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES worker(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('OVERTIME', 'DELAYED_LEAVE')),
    overtime_end_time TIMESTAMP,
    notes TEXT,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (worker_id, work_date)
);

CREATE INDEX idx_checkout_review_date ON checkout_review(work_date);
CREATE INDEX idx_checkout_review_worker ON checkout_review(worker_id);

-- SiteConfiguration Table
CREATE TABLE site_configuration (
    id SERIAL PRIMARY KEY CHECK(id = 1),
    site_name VARCHAR(255) NOT NULL,
    site_location TEXT,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OwnerEmail Table
CREATE TABLE owner_email (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for OwnerEmail table
CREATE UNIQUE INDEX idx_owner_email ON owner_email(email_address);

-- EmailQueue Table
CREATE TABLE email_queue (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    email_type email_type_enum NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status email_status_enum DEFAULT 'PENDING',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for EmailQueue table
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_at);

-- SystemBackup Table
CREATE TABLE system_backup (
    id SERIAL PRIMARY KEY,
    backup_file_path VARCHAR(500) NOT NULL,
    backup_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Worker table
CREATE TRIGGER update_worker_updated_at
BEFORE UPDATE ON worker
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for SiteConfiguration table
CREATE TRIGGER update_site_configuration_updated_at
BEFORE UPDATE ON site_configuration
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
