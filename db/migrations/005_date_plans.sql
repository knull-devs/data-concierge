-- Date Concierge date planning, connected to accepted introductions.
-- Run after 004_notifications_settings.sql. Safe to re-run.

CREATE TABLE IF NOT EXISTS dc_date_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  introduction_id UUID NOT NULL REFERENCES dc_introduction_requests(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  city VARCHAR(80) NOT NULL,
  venue VARCHAR(160) NOT NULL DEFAULT '',
  note VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT dc_date_plan_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')),
  CONSTRAINT dc_date_plan_city_check CHECK (char_length(trim(city)) BETWEEN 2 AND 80),
  CONSTRAINT dc_date_plan_venue_check CHECK (char_length(venue) <= 160),
  CONSTRAINT dc_date_plan_note_check CHECK (char_length(note) <= 500)
);

-- One pending or accepted proposal per accepted introduction. A declined/cancelled
-- proposal remains in history and a new proposal can be created afterwards.
CREATE UNIQUE INDEX IF NOT EXISTS dc_date_plans_one_active_per_intro_idx
  ON dc_date_plans (introduction_id) WHERE status IN ('pending', 'accepted');
CREATE INDEX IF NOT EXISTS dc_date_plans_created_by_idx ON dc_date_plans (proposed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS dc_date_plans_date_status_idx ON dc_date_plans (scheduled_for, status);
