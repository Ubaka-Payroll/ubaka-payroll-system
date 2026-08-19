-- Persist job classifications so custom "OTHER" names stay on the dropdown.

CREATE TABLE IF NOT EXISTS worker_classification (
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
    ('OPERATOR', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO worker_classification (name, is_builtin)
SELECT DISTINCT UPPER(TRIM(classification)), FALSE
FROM worker
WHERE classification IS NOT NULL
  AND TRIM(classification) <> ''
  AND UPPER(TRIM(classification)) <> 'OTHER'
ON CONFLICT (name) DO NOTHING;
