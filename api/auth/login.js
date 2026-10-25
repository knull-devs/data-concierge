import { getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit, verifyPassword, createSession, publicUser, safeDatabaseError } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
  if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 128) return sendJson(res, 400, { error: 'Enter your email and password.' });
  try {
    const sql = getDb();
    if (!(await enforceRateLimit(sql, req, 'login', 10, 15))) return sendJson(res, 429, { error: 'Too many sign-in attempts. Please wait and try again.' });
    const rows = await sql`SELECT id, display_name, email, city, password_hash, created_at, is_active FROM dc_auth_users WHERE email = ${email} LIMIT 1`;
    const user = rows[0];
    // Run one password hash check even for a missing email to reduce timing-based account discovery.
    const dummyHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
    const passwordValid = await verifyPassword(password, user?.password_hash || dummyHash);
    if (!user || !user.is_active || !passwordValid) return sendJson(res, 401, { error: 'Email or password is incorrect.' });
    const publicRow = { id: user.id, display_name: user.display_name, email: user.email, city: user.city, created_at: user.created_at };
    await createSession(sql, user.id, res, body.remember !== false);
    return sendJson(res, 200, { ok: true, authenticated: true, user: publicUser(publicRow) });
  } catch (error) {
    console.error('Auth login error:', error?.code || error?.name || 'unknown');
    return sendJson(res, error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, { error: safeDatabaseError(error) });
  }
}
