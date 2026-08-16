-- Portal identity, subscriptions, and site-engineer tables.
-- Shares this PostgreSQL database with the desktop attendance app.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('SYSTEM_ADMIN', 'SITE_OWNER', 'FIELD_ENGINEER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE owner_request_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DEACTIVATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status_enum AS ENUM ('NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE engineer_status_enum AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE activation_key_status_enum AS ENUM ('AVAILABLE', 'ASSIGNED', 'USED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owner_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  message TEXT,
  status owner_request_status_enum NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES app_user(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_request_status ON owner_request(status);
CREATE INDEX IF NOT EXISTS idx_owner_request_email ON owner_request(email);

CREATE TABLE IF NOT EXISTS subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  status subscription_status_enum NOT NULL DEFAULT 'ACTIVE',
  plan_name VARCHAR(100) NOT NULL,
  seats INTEGER NOT NULL DEFAULT 3,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_owner ON subscription(owner_id);

CREATE TABLE IF NOT EXISTS field_engineer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  site_name VARCHAR(255) NOT NULL,
  status engineer_status_enum NOT NULL DEFAULT 'PENDING_ACTIVATION',
  activation_key_id UUID,
  user_id UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_field_engineer_owner ON field_engineer(owner_id);

CREATE TABLE IF NOT EXISTS activation_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  engineer_id UUID REFERENCES field_engineer(id) ON DELETE SET NULL,
  site_name VARCHAR(255),
  status activation_key_status_enum NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activation_key_owner ON activation_key(owner_id);

DO $$ BEGIN
  ALTER TABLE field_engineer
    ADD CONSTRAINT field_engineer_activation_key_fk
    FOREIGN KEY (activation_key_id) REFERENCES activation_key(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
