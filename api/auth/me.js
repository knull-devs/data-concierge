import { getDb, sendJson, readCookie, SESSION_COOKIE, sha256, getSessionUser, publicUser, safeDatabaseError } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return sendJson(res, 200, { authenticated: false, user: null });
    const sql = getDb();
    const row = await getSessionUser(sql, req);
    if (!row) return sendJson(res, 200, { authenticated: false, user: null });
    return sendJson(res, 200, { authenticated: true, user: publicUser(row) });
  } catch (error) {
    console.error('Auth session check error:', error?.code || error?.name || 'unknown');
    return sendJson(res, error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, { error: safeDatabaseError(error) });
  }
}
