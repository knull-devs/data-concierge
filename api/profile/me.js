import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError
} from '../_lib/auth.js';
import { normalizeProfileInput, mapProfileRow, getProfileCompletion } from '../_lib/profile.js';

function profileSetupError(error) {
  if (error?.code === '42P01' || error?.code === '42703') {
    return 'Profile setup is not installed yet. Run db/migrations/001_member_profiles.sql in your Neon SQL Editor, then retry.';
  }
  return safeDatabaseError(error);
}

function parsedBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  if (req.method === 'PUT') {
    if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
    if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > 16000) return sendJson(res, 413, { error: 'Profile details are too large.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to view or edit your profile.' });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT city, headline, about_me, gender_identity, interested_in,
               relationship_goal, preferred_age_min, preferred_age_max, interests, updated_at
        FROM dc_member_profiles
        WHERE user_id = ${user.id}
        LIMIT 1
      `;
      const profile = mapProfileRow(rows[0], user.city);
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        user: { id: user.id, name: user.display_name, email: user.email },
        profile,
        completion: getProfileCompletion(profile)
      });
    }

    const body = parsedBody(req);
    if (!body) return sendJson(res, 400, { error: 'Send a valid JSON profile.' });
    const allowed = await enforceRateLimit(sql, req, `profile-save:${user.id}`, 30, 60);
    if (!allowed) return sendJson(res, 429, { error: 'Too many profile saves. Please wait a minute and try again.' });

    const result = normalizeProfileInput(body, user.city);
    if (!result.ok) return sendJson(res, 400, { error: 'Please review the highlighted profile fields.', errors: result.errors });
    const p = result.profile;
    const rows = await sql`
      INSERT INTO dc_member_profiles (
        user_id, city, headline, about_me, gender_identity, interested_in,
        relationship_goal, preferred_age_min, preferred_age_max, interests, updated_at
      ) VALUES (
        ${user.id}, ${p.city}, ${p.headline}, ${p.aboutMe}, ${p.genderIdentity},
        ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.interestedIn)}::jsonb)),
        ${p.relationshipGoal}, ${p.preferredAgeMin}, ${p.preferredAgeMax},
        ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.interests)}::jsonb)), NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        city = EXCLUDED.city,
        headline = EXCLUDED.headline,
        about_me = EXCLUDED.about_me,
        gender_identity = EXCLUDED.gender_identity,
        interested_in = EXCLUDED.interested_in,
        relationship_goal = EXCLUDED.relationship_goal,
        preferred_age_min = EXCLUDED.preferred_age_min,
        preferred_age_max = EXCLUDED.preferred_age_max,
        interests = EXCLUDED.interests,
        updated_at = NOW()
      RETURNING city, headline, about_me, gender_identity, interested_in,
                relationship_goal, preferred_age_min, preferred_age_max, interests, updated_at
    `;
    const profile = mapProfileRow(rows[0], user.city);
    return sendJson(res, 200, { ok: true, saved: true, profile, completion: getProfileCompletion(profile) });
  } catch (error) {
    console.error('Profile API error:', error?.code || error?.name || 'unknown');
    const isSetup = error?.code === '42P01' || error?.code === '42703';
    return sendJson(res, isSetup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, { error: profileSetupError(error) });
  }
}
