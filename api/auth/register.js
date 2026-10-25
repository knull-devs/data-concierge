import { getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit, hashPassword, createSession, publicUser, safeDatabaseError } from '../_lib/auth.js';

function ageAtLeast18(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const birth = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== isoDate) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const month = today.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 18 && birth.getTime() < today.getTime();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
  if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate : '';
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 80) : '';
  if (name.length < 2 || name.length > 80) return sendJson(res, 400, { error: 'Enter a name between 2 and 80 characters.' });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: 'Enter a valid email address.' });
  if (password.length < 10 || password.length > 128) return sendJson(res, 400, { error: 'Use a password between 10 and 128 characters.' });
  if (!ageAtLeast18(birthDate) || body.confirmAdult !== true) return sendJson(res, 400, { error: 'Date Concierge is for adults aged 18 and over.' });
  if (body.acceptTerms !== true) return sendJson(res, 400, { error: 'Please accept the Terms and Privacy Policy.' });
  if (!city) return sendJson(res, 400, { error: 'Choose your city to continue.' });

  try {
    const sql = getDb();
    if (!(await enforceRateLimit(sql, req, 'register', 5, 60))) return sendJson(res, 429, { error: 'Too many signup attempts from this network. Please try again later.' });
    const passwordHash = await hashPassword(password);
    let rows;
    try {
      rows = await sql`
        INSERT INTO dc_auth_users (display_name, email, password_hash, birth_date, city, accepted_terms_at)
        VALUES (${name}, ${email}, ${passwordHash}, ${birthDate}, ${city}, now())
        RETURNING id, display_name, email, city, created_at
      `;
    } catch (error) {
      if (error?.code === '23505') return sendJson(res, 409, { error: 'An account with this email already exists. Try logging in instead.' });
      throw error;
    }
    const user = rows[0];
    await createSession(sql, user.id, res);
    return sendJson(res, 201, { ok: true, authenticated: true, user: publicUser(user) });
  } catch (error) {
    console.error('Auth register error:', error?.code || error?.name || 'unknown');
    return sendJson(res, error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, { error: safeDatabaseError(error) });
  }
}
