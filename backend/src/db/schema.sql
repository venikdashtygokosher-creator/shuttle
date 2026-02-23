-- Shuttle Passenger Management System — Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Admin Users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(50) DEFAULT 'admin',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(255) NOT NULL,
  phone               VARCHAR(50) NOT NULL,
  address             TEXT NOT NULL,
  email               VARCHAR(255),
  payment_method      VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card')),
  stripe_customer_id  VARCHAR(255),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Plans ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(255) NOT NULL,
  type                VARCHAR(30) NOT NULL CHECK (type IN ('monthly', 'bi-monthly', 'pay-as-you-go', 'manual')),
  total_cost          DECIMAL(10,2) NOT NULL DEFAULT 0,
  trip_limit          INTEGER,         -- NULL = unlimited
  duration_months     INTEGER,         -- 1 or 2, for monthly/bi-monthly
  manual_expiry_date  DATE,            -- for manual type
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Customer Plans (Subscriptions) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_plans (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES plans(id),
  start_date            DATE NOT NULL,
  expiry_date           DATE NOT NULL,
  trips_remaining       INTEGER,        -- NULL = unlimited
  status                VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  payment_method        VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card')),
  stripe_payment_id     VARCHAR(255),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Trips (Scheduled Routes) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('single', 'daily', 'weekly')),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  days_of_week    INTEGER[],      -- 0=Sun, 1=Mon, ... 6=Sat (for weekly)
  trip_date       DATE,           -- for single trips
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Trip Scans (Kiosk Check-ins) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_scans (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id                   UUID NOT NULL REFERENCES trips(id),
  customer_id               UUID NOT NULL REFERENCES customers(id),
  customer_plan_id          UUID REFERENCES customer_plans(id),
  scanned_at                TIMESTAMPTZ DEFAULT NOW(),
  status                    VARCHAR(20) NOT NULL CHECK (status IN ('allowed', 'denied', 'warning')),
  trips_remaining_after_scan INTEGER,
  deny_reason               TEXT
);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id               UUID NOT NULL REFERENCES customers(id),
  customer_plan_id          UUID REFERENCES customer_plans(id),
  amount                    DECIMAL(10,2) NOT NULL,
  method                    VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'card')),
  stripe_payment_intent_id  VARCHAR(255),
  status                    VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tracking Data ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracking_data (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   VARCHAR(255) NOT NULL,
  latitude    DECIMAL(10,8) NOT NULL,
  longitude   DECIMAL(11,8) NOT NULL,
  speed       DECIMAL(8,2),
  heading     DECIMAL(8,2),
  timestamp   TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(255) PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customer_plans_customer_id ON customer_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_plans_status ON customer_plans(status);
CREATE INDEX IF NOT EXISTS idx_trip_scans_customer_id ON trip_scans(customer_id);
CREATE INDEX IF NOT EXISTS idx_trip_scans_trip_id ON trip_scans(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_scans_scanned_at ON trip_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_tracking_device_id ON tracking_data(device_id);
CREATE INDEX IF NOT EXISTS idx_tracking_timestamp ON tracking_data(timestamp);

-- ─── Default Settings ─────────────────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('renewal_reminder_days', '3'),
  ('default_payment_method', '"cash"'),
  ('company_name', '"Shuttle Co"'),
  ('kiosk_title', '"Shuttle Check-In"'),
  ('stripe_publishable_key', '""'),
  ('traccar_url', '""')
ON CONFLICT (key) DO NOTHING;
