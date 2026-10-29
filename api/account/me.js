import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError
} from '../_lib/auth.js';
import { normalizeAccountInput } from '../_lib/account.js';

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') { try { const parsed = JSON.parse(req.body); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; } }
  return null;
}

function publicSettings(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    city: row.city,
    birthDate: row.birth_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, PUT'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (req.method === 'PUT') {
    if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
    if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
    if (Number(req.headers['content-length'] || 0) > 8000) return sendJson(res, 413, { error: 'Account details are too large.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to manage your account.' });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, display_name, email, city, birth_date::text AS birth_date, created_at, updated_at
        FROM dc_auth_users WHERE id = ${user.id} AND is_active = TRUE LIMIT 1
      `;
      if (!rows.length) return sendJson(res, 401, { authenticated: false, error: 'This account is not available.' });
      return sendJson(res, 200, { ok: true, account: publicSettings(rows[0]) });
    }

    const body = bodyObject(req);
    const normalized = normalizeAccountInput(body);
    if (!normalized.ok) return sendJson(res, 400, { error: normalized.error });
    if (!(await enforceRateLimit(sql, req, `account-update:${user.id}`, 10, 15))) {
      return sendJson(res, 429, { error: 'Too many account changes. Please wait and try again.' });
    }

    const updatedRows = await sql`
      UPDATE dc_auth_users
      SET display_name = ${normalized.account.displayName}, city = ${normalized.account.city}, updated_at = NOW()
      WHERE id = ${user.id} AND is_active = TRUE
      RETURNING id, display_name, email, city, birth_date::text AS birth_date, created_at, updated_at
    `;
    if (!updatedRows.length) return sendJson(res, 404, { error: 'Account not found.' });

    // Keep the profile location aligned when the member-profile migration exists.
    // Account settings remain usable when that optional profile table has not yet been installed.
    let profileCitySynced = false;
    let profileCitySyncWarning = false;
    try {
      await sql`
        INSERT INTO dc_member_profiles (user_id, city)
        VALUES (${user.id}, ${normalized.account.city})
        ON CONFLICT (user_id) DO UPDATE SET city = EXCLUDED.city, updated_at = NOW()
      `;
      profileCitySynced = true;
    } catch (error) {
      if (!['42P01', '42703'].includes(error?.code)) {
        console.error('Account profile city sync warning:', error?.code || error?.name || 'unknown');
        profileCitySyncWarning = true;
      }
    }

    return sendJson(res, 200, {
      ok: true,
      saved: true,
      profileCitySynced,
      notice: profileCitySyncWarning ? 'Account details were saved, but the dating-profile city could not be synchronized. Open My Profile and save it there too.' : undefined,
      account: publicSettings(updatedRows[0])
    });
  } catch (error) {
    console.error('Account settings API error:', error?.code || error?.name || 'unknown');
    const setup = ['42P01', '42703'].includes(error?.code);
    return sendJson(res, setup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, {
      error: setup ? 'Account settings schema is unavailable. Check that db/schema.sql has been run in Neon.' : safeDatabaseError(error)
    });
  }
}
