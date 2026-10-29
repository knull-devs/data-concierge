-- Date Concierge direct-message foundation.
-- Run after 001_member_profiles.sql and 002_discovery_matching.sql.
-- Messages belong to a mutually accepted introduction; APIs enforce membership and status.

CREATE TABLE IF NOT EXISTS dc_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  introduction_id UUID NOT NULL REFERENCES dc_introduction_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT dc_messages_body_nonempty CHECK (char_length(trim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS dc_messages_conversation_created_idx
  ON dc_messages (introduction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dc_messages_unread_idx
  ON dc_messages (introduction_id, read_at)
  WHERE read_at IS NULL;
