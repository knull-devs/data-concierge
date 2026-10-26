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
