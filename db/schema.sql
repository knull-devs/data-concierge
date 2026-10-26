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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Date Concierge member profile foundation.
-- Safe to run once against an existing Neon database; it does not alter auth users or sessions.
CREATE TABLE IF NOT EXISTS dc_member_profiles (
  user_id UUID PRIMARY KEY REFERENCES dc_auth_users(id) ON DELETE CASCADE,
  city VARCHAR(80) NOT NULL DEFAULT '',
  headline VARCHAR(100) NOT NULL DEFAULT '',
  about_me VARCHAR(600) NOT NULL DEFAULT '',
  gender_identity VARCHAR(32) NOT NULL DEFAULT '',
  interested_in TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  relationship_goal VARCHAR(40) NOT NULL DEFAULT '',
  preferred_age_min SMALLINT,
  preferred_age_max SMALLINT,
  interests TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  discoverable BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  avatar_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dc_member_profiles_gender_check CHECK (gender_identity IN ('', 'man', 'woman', 'non_binary', 'prefer_not_to_say')),
  CONSTRAINT dc_member_profiles_goal_check CHECK (relationship_goal IN ('', 'serious_relationship', 'long_term_relationship', 'marriage_minded', 'open_to_see_where_it_goes')),
  CONSTRAINT dc_member_profiles_interested_check CHECK (cardinality(interested_in) <= 4 AND interested_in <@ ARRAY['men', 'women', 'non_binary_people', 'everyone']::TEXT[]),
  CONSTRAINT dc_member_profiles_interests_check CHECK (cardinality(interests) <= 8 AND interests <@ ARRAY['coffee_and_cafes', 'travel', 'reading', 'live_music', 'cooking', 'food_culture', 'art_and_design', 'fitness', 'hiking_outdoors', 'movies_and_series', 'pets', 'volunteering', 'photography', 'cricket_and_sports', 'board_games', 'gardening']::TEXT[]),
  CONSTRAINT dc_member_profiles_age_range_check CHECK (
    (preferred_age_min IS NULL AND preferred_age_max IS NULL) OR
    (preferred_age_min IS NOT NULL AND preferred_age_max IS NOT NULL AND preferred_age_min >= 18 AND preferred_age_max <= 99 AND preferred_age_min <= preferred_age_max)
  )
);
CREATE INDEX IF NOT EXISTS dc_member_profiles_city_idx ON dc_member_profiles(city);


-- One request per member pair; status mirrors the upstream pH7 friend-request lifecycle.
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
CREATE UNIQUE INDEX IF NOT EXISTS dc_intro_pair_unique_idx ON dc_introduction_requests (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));
CREATE INDEX IF NOT EXISTS dc_intro_recipient_status_idx ON dc_introduction_requests (recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS dc_intro_requester_status_idx ON dc_introduction_requests (requester_id, status, created_at DESC);
