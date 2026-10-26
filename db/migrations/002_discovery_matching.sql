-- Date Concierge discovery + introductions migration.
-- Run AFTER 001_member_profiles.sql. Safe to re-run; does not delete accounts or sessions.

ALTER TABLE dc_auth_users
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE dc_member_profiles
  ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_approved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS dc_member_profiles_discoverable_city_idx
  ON dc_member_profiles (discoverable, city);
CREATE INDEX IF NOT EXISTS dc_auth_users_active_activity_idx
  ON dc_auth_users (is_active, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS dc_introduction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT dc_intro_not_self CHECK (requester_id <> recipient_id),
  CONSTRAINT dc_intro_status_check CHECK (status IN ('pending', 'accepted', 'declined'))
);

-- One relationship record per pair, regardless of request direction.
CREATE UNIQUE INDEX IF NOT EXISTS dc_intro_pair_unique_idx
  ON dc_introduction_requests (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));
CREATE INDEX IF NOT EXISTS dc_intro_recipient_status_idx
  ON dc_introduction_requests (recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS dc_intro_requester_status_idx
  ON dc_introduction_requests (requester_id, status, created_at DESC);

-- Existing users start with their latest known activity at migration time. Subsequent
-- successful login/session checks update this timestamp for ranking recency.
