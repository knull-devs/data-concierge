-- Date Concierge authentication schema for Neon PostgreSQL.
-- Run this file once in the Neon SQL Editor before testing registration/login.

CREATE TABLE IF NOT EXISTS dc_auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  birth_date DATE NOT NULL,
  city VARCHAR(80) NOT NULL,
  accepted_terms_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dc_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dc_auth_sessions_user_idx ON dc_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS dc_auth_sessions_expiry_idx ON dc_auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS dc_auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Periodic cleanup can be run manually during early testing:
-- DELETE FROM dc_auth_sessions WHERE expires_at < NOW();
-- DELETE FROM dc_auth_rate_limits WHERE window_started_at < NOW() - INTERVAL '14 days';
