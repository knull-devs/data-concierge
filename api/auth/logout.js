import { getDb, sendJson, requestHasValidOrigin, readCookie, SESSION_COOKIE, sha256, clearSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
  const token = readCookie(req, SESSION_COOKIE);
  clearSessionCookie(res);
  if (token && token.length <= 128 && process.env.DATABASE_URL) {
    try { const sql = getDb(); await sql`DELETE FROM dc_auth_sessions WHERE token_hash = ${sha256(token)}`; }
    catch (error) { console.error('Auth logout cleanup error:', error?.code || error?.name || 'unknown'); }
  }
  return sendJson(res, 200, { ok: true, authenticated: false });
}
