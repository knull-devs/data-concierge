import {
  getDb, sendJson, enforceRateLimit, getSessionUser, safeDatabaseError
} from '../_lib/auth.js';
import { isDiscoveryReady } from '../_lib/profile.js';
import { rankMatches, isMutuallyCompatible, getMatchReasons, ageFromBirthDate, MAX_MATCHES, MAX_RANK_CANDIDATES } from '../_lib/matchmaking.js';

const SETUP_MESSAGE = 'Discovery setup is not installed yet. Run db/migrations/001_member_profiles.sql first, then db/migrations/002_discovery_matching.sql in Neon SQL Editor.';

function mappedProfile(row) {
  return {
    id: row.id,
    is_active: row.is_active,
    displayName: row.display_name,
    birthDate: row.birth_date,
    city: row.city || row.account_city || '',
    accountCity: row.account_city || '',
    headline: row.headline || '',
    aboutMe: row.about_me || '',
    genderIdentity: row.gender_identity || '',
    interestedIn: Array.isArray(row.interested_in) ? row.interested_in : [],
    relationshipGoal: row.relationship_goal || '',
    preferredAgeMin: row.preferred_age_min == null ? null : Number(row.preferred_age_min),
    preferredAgeMax: row.preferred_age_max == null ? null : Number(row.preferred_age_max),
    interests: Array.isArray(row.interests) ? row.interests : [],
    discoverable: row.discoverable === true,
    lastActivity: row.last_activity_at || row.created_at,
    avatarUrl: row.avatar_url || null,
    avatarApproved: row.avatar_approved === true,
    country: 'IN'
  };
}

function publicRecommendation(candidate, reference, score) {
  const age = ageFromBirthDate(candidate.birthDate);
  return {
    candidateId: candidate.id,
    name: candidate.displayName,
    age,
    city: candidate.city,
    headline: candidate.headline,
    aboutMe: candidate.aboutMe,
    interests: candidate.interests,
    matchScore: Math.round(score * 100),
    reasons: getMatchReasons(reference, candidate),
    // The photo field is available for the later moderated upload module. No
    // external/third-party images are invented or shown in this release.
    avatarUrl: candidate.avatarApproved === true ? (candidate.avatarUrl || null) : null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to discover members.' });
    if (!(await enforceRateLimit(sql, req, `discover:${user.id}`, 60, 60))) {
      return sendJson(res, 429, { error: 'Too many discovery requests. Please wait a moment and retry.' });
    }

    const ownRows = await sql`
      SELECT u.id, u.display_name, u.birth_date::text AS birth_date, u.city AS account_city,
             u.is_active, u.last_activity_at, u.created_at,
             p.city, p.headline, p.about_me, p.gender_identity, p.interested_in,
             p.relationship_goal, p.preferred_age_min, p.preferred_age_max, p.interests,
             p.discoverable, p.avatar_url, p.avatar_approved
      FROM dc_auth_users u
      LEFT JOIN dc_member_profiles p ON p.user_id = u.id
      WHERE u.id = ${user.id}
      LIMIT 1
    `;
    if (!ownRows.length || ownRows[0].city === undefined || ownRows[0].discoverable === undefined) {
      return sendJson(res, 503, { code: 'DISCOVERY_SETUP_REQUIRED', error: SETUP_MESSAGE });
    }
    const reference = mappedProfile(ownRows[0]);
    if (!reference.discoverable) {
      return sendJson(res, 409, {
        code: 'DISCOVERY_DISABLED',
        error: 'Your profile is not discoverable yet. Open your profile settings and turn on “Make my profile discoverable” when you are ready.'
      });
    }
    if (!isDiscoveryReady(reference)) {
      return sendJson(res, 409, {
        code: 'PROFILE_INCOMPLETE',
        error: 'Complete your profile details, age range, relationship goal, and at least 3 interests before discovery can begin.'
      });
    }

    // Update only the signed-in member's activity marker. This is adapted from
    // pH7's recent-activity ordering used by its related-profile controller.
    await sql`UPDATE dc_auth_users SET last_activity_at = NOW() WHERE id = ${user.id}`;
    reference.lastActivity = new Date();

    // pH7's related-profile controller requests 12x the visible list, then
    // ranks that candidate pool with MatchmakingCore. We allow a larger initial
    // scan because mutual preferences are enforced in this service after SQL.
    const candidateRows = await sql`
      SELECT u.id, u.display_name, u.birth_date::text AS birth_date, u.city AS account_city,
             u.is_active, u.last_activity_at, u.created_at,
             p.city, p.headline, p.about_me, p.gender_identity, p.interested_in,
             p.relationship_goal, p.preferred_age_min, p.preferred_age_max, p.interests,
             p.discoverable, p.avatar_url, p.avatar_approved
      FROM dc_auth_users u
      INNER JOIN dc_member_profiles p ON p.user_id = u.id
      WHERE u.id <> ${user.id}
        AND u.is_active = TRUE
        AND p.discoverable = TRUE
        AND p.headline <> ''
        AND p.about_me <> ''
        AND p.relationship_goal <> ''
        AND cardinality(p.interested_in) > 0
        AND p.preferred_age_min IS NOT NULL
        AND p.preferred_age_max IS NOT NULL
        AND cardinality(p.interests) >= 3
        AND u.birth_date <= CURRENT_DATE - INTERVAL '18 years'
      ORDER BY u.last_activity_at DESC NULLS LAST, p.updated_at DESC
      LIMIT 600
    `;

    const candidates = candidateRows.map(mappedProfile)
      .filter(candidate => isDiscoveryReady(candidate) && isMutuallyCompatible(reference, candidate))
      .slice(0, MAX_RANK_CANDIDATES);
    const limitRaw = req.query?.limit;
    const limit = Number.isInteger(Number(limitRaw)) && Number(limitRaw) > 0
      ? Math.min(MAX_MATCHES, Number(limitRaw)) : MAX_MATCHES;
    const ranked = rankMatches(reference, candidates, limit);
    const matches = ranked.map(candidate => publicRecommendation(candidate, reference, candidate.score));

    return sendJson(res, 200, {
      ok: true,
      count: matches.length,
      matches,
      note: 'Recommendations are a heuristic based on age fit, location, recent activity and approved-photo availability. They do not predict chemistry or guarantee a date.'
    });
  } catch (error) {
    console.error('Discovery API error:', error?.code || error?.name || 'unknown');
    const setup = error?.code === '42P01' || error?.code === '42703';
    return sendJson(res, setup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, {
      code: setup ? 'DISCOVERY_SETUP_REQUIRED' : undefined,
      error: setup ? SETUP_MESSAGE : safeDatabaseError(error)
    });
  }
}
