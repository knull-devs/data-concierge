import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError
} from './_lib/auth.js';
import { mapProfileRow, isDiscoveryReady } from './_lib/profile.js';

const SETUP_MESSAGE = 'Settings are not installed yet. Run db/migrations/001_member_profiles.sql and db/migrations/004_notifications_settings.sql in Neon SQL Editor.';
const BOOLEAN_KEYS = ['inAppNotifications', 'introductionUpdates', 'messageUpdates', 'dateUpdates', 'discoverable'];

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try { const parsed = JSON.parse(req.body); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; }
    catch { return null; }
  }
  return null;
}
function publicSettings(row) {
  return {
    inAppNotifications: row?.in_app_notifications !== false,
    introductionUpdates: row?.introduction_updates !== false,
    messageUpdates: row?.message_updates !== false,
    dateUpdates: row?.date_updates !== false,
    discoverable: row?.discoverable === true,
    updatedAt: row?.updated_at || null
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, PUT'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (req.method === 'PUT') {
    if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
    if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
    if (Number(req.headers['content-length'] || 0) > 4000) return sendJson(res, 413, { error: 'Settings request is too large.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to manage settings.' });

    if (req.method === 'GET') {
      await sql`INSERT INTO dc_member_settings (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;
      const rows = await sql`
        SELECT s.in_app_notifications, s.introduction_updates, s.message_updates, s.date_updates, s.updated_at,
               COALESCE(p.discoverable, FALSE) AS discoverable
        FROM dc_member_settings s
        LEFT JOIN dc_member_profiles p ON p.user_id = s.user_id
        WHERE s.user_id = ${user.id} LIMIT 1
      `;
      return sendJson(res, 200, { ok: true, settings: publicSettings(rows[0]) });
    }

    if (!(await enforceRateLimit(sql, req, `settings-update:${user.id}`, 20, 60))) return sendJson(res, 429, { error: 'Too many settings changes. Please wait and try again.' });
    const body = bodyObject(req);
    if (!body || BOOLEAN_KEYS.some(key => typeof body[key] !== 'boolean')) {
      return sendJson(res, 400, { error: 'Choose a value for each notification and privacy setting.' });
    }

    if (body.discoverable) {
      const profileRows = await sql`
        SELECT city, headline, about_me, gender_identity, interested_in, relationship_goal,
               preferred_age_min, preferred_age_max, interests, discoverable, updated_at
        FROM dc_member_profiles WHERE user_id = ${user.id} LIMIT 1
      `;
      const profile = mapProfileRow(profileRows[0], user.city);
      if (!isDiscoveryReady(profile)) {
        return sendJson(res, 409, { code: 'PROFILE_INCOMPLETE', error: 'Complete your dating profile, age range and at least 3 interests before enabling discovery.' });
      }
    }

    await sql`
      INSERT INTO dc_member_settings (user_id, in_app_notifications, introduction_updates, message_updates, date_updates, updated_at)
      VALUES (${user.id}, ${body.inAppNotifications}, ${body.introductionUpdates}, ${body.messageUpdates}, ${body.dateUpdates}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        in_app_notifications = EXCLUDED.in_app_notifications,
        introduction_updates = EXCLUDED.introduction_updates,
        message_updates = EXCLUDED.message_updates,
        date_updates = EXCLUDED.date_updates,
        updated_at = NOW()
    `;
    await sql`
      INSERT INTO dc_member_profiles (user_id, city, discoverable)
      VALUES (${user.id}, ${user.city || ''}, ${body.discoverable})
      ON CONFLICT (user_id) DO UPDATE SET discoverable = EXCLUDED.discoverable, updated_at = NOW()
    `;
    const rows = await sql`
      SELECT s.in_app_notifications, s.introduction_updates, s.message_updates, s.date_updates, s.updated_at,
             COALESCE(p.discoverable, FALSE) AS discoverable
      FROM dc_member_settings s LEFT JOIN dc_member_profiles p ON p.user_id = s.user_id
      WHERE s.user_id = ${user.id} LIMIT 1
    `;
    return sendJson(res, 200, { ok: true, saved: true, settings: publicSettings(rows[0]) });
  } catch (error) {
    console.error('Settings API error:', error?.code || error?.name || 'unknown');
    const setup = ['42P01', '42703'].includes(error?.code);
    return sendJson(res, setup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, {
      code: setup ? 'SETTINGS_SETUP_REQUIRED' : undefined,
      error: setup ? SETUP_MESSAGE : safeDatabaseError(error)
    });
  }
}
