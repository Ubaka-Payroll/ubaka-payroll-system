-- Owner self-registration system

CREATE TABLE IF NOT EXISTS owner_registration_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  company_name VARCHAR(255) NOT NULL,
  number_of_sites INTEGER NOT NULL CHECK (number_of_sites > 0),
  site_names TEXT[] NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  subscription_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES app_user(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_owner_registration_status ON owner_registration_request(status);
CREATE INDEX IF NOT EXISTS idx_owner_registration_email ON owner_registration_request(email);
CREATE INDEX IF NOT EXISTS idx_owner_registration_created_at ON owner_registration_request(created_at DESC);
