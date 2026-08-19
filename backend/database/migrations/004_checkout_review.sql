-- Workers still on site after 17:00 wait for a Field Engineer decision:
-- OVERTIME (pay after 17:00) or DELAYED_LEAVE (pay stops at 17:00).

CREATE TABLE IF NOT EXISTS checkout_review (
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

CREATE INDEX IF NOT EXISTS idx_checkout_review_date ON checkout_review(work_date);
CREATE INDEX IF NOT EXISTS idx_checkout_review_worker ON checkout_review(worker_id);
