import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError, verifyPassword, hashPassword, createSession
} from '../_lib/auth.js';
import { validatePasswordChange } from '../_lib/account.js';

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') { try { const parsed = JSON.parse(req.body); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; } }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
  if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
  if (Number(req.headers['content-length'] || 0) > 8000) return sendJson(res, 413, { error: 'Password request is too large.' });

  const input = validatePasswordChange(bodyObject(req));
  if (!input.ok) return sendJson(res, 400, { error: input.error });

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in again before changing your password.' });
    if (!(await enforceRateLimit(sql, req, `password-change:${user.id}`, 5, 60))) {
      return sendJson(res, 429, { error: 'Too many password change attempts. Please try again later.' });
    }
    const rows = await sql`SELECT password_hash FROM dc_auth_users WHERE id = ${user.id} AND is_active = TRUE LIMIT 1`;
    const currentIsValid = rows.length && await verifyPassword(input.currentPassword, rows[0].password_hash);
    if (!currentIsValid) return sendJson(res, 400, { error: 'Your current password is incorrect.' });

    const passwordHash = await hashPassword(input.newPassword);
    await sql`UPDATE dc_auth_users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${user.id}`;
    // Revoke all sessions, then issue a fresh session for this browser.
    await sql`DELETE FROM dc_auth_sessions WHERE user_id = ${user.id}`;
    await createSession(sql, user.id, res, input.remember);
    return sendJson(res, 200, { ok: true, passwordChanged: true, message: 'Password updated. Other sessions have been signed out.' });
  } catch (error) {
    console.error('Password change API error:', error?.code || error?.name || 'unknown');
    return sendJson(res, error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, { error: safeDatabaseError(error) });
  }
}
