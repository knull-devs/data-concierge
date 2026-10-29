-- Date Concierge in-app notifications and member preferences.
-- Run after 001_member_profiles.sql, 002_discovery_matching.sql and 003_messages.sql.
-- Safe to re-run. Does not modify auth users, sessions, profiles or existing messages.

CREATE TABLE IF NOT EXISTS dc_member_settings (
  user_id UUID PRIMARY KEY REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  in_app_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  introduction_updates BOOLEAN NOT NULL DEFAULT TRUE,
  message_updates BOOLEAN NOT NULL DEFAULT TRUE,
  date_updates BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dc_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  category VARCHAR(24) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(360) NOT NULL DEFAULT '',
  href VARCHAR(260) NOT NULL DEFAULT '/dashboard.html',
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT dc_notifications_category_check CHECK (category IN ('introduction', 'message', 'date_plan', 'system', 'security')),
  CONSTRAINT dc_notifications_href_internal_check CHECK (href LIKE '/%' AND href NOT LIKE '//%')
);

CREATE INDEX IF NOT EXISTS dc_notifications_user_created_idx ON dc_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dc_notifications_unread_idx ON dc_notifications (user_id, created_at DESC) WHERE read_at IS NULL;

INSERT INTO dc_member_settings (user_id)
SELECT id FROM dc_auth_users
ON CONFLICT (user_id) DO NOTHING;
