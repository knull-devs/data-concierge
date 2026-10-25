import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'dc_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.end(JSON.stringify(payload));
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  return neon(connectionString);
}

export function requestHasValidOrigin(req) {
  // These endpoints mutate account/session state. Require a same-origin request
  // rather than treating a missing Origin header as trusted.
  const origin = req.headers.origin;
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  if (!origin || !hostHeader) return false;

  const host = String(hostHeader).split(',')[0].trim();
  const forwardedProtocol = req.headers['x-forwarded-proto'];
  const protocol = String(forwardedProtocol || (req.socket?.encrypted ? 'https' : 'http'))
    .split(',')[0].trim().toLowerCase();
  if (!host || !['http', 'https'].includes(protocol)) return false;

  try {
    const suppliedOrigin = new URL(origin);
    const expectedOrigin = new URL(`${protocol}://${host}`);
    return suppliedOrigin.origin === expectedOrigin.origin;
  } catch {
    return false;
  }
}

export function isJsonBody(req) {
  return String(req.headers['content-type'] || '').toLowerCase().includes('application/json');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function clientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp) return String(realIp).slice(0, 120);
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(v => v.trim()).filter(Boolean);
  return (forwarded[0] || 'unknown').slice(0, 120);
}

export async function enforceRateLimit(sql, req, scope, limit, windowMinutes) {
  const key = sha256(`${scope}:${clientIp(req)}`);
  const rows = await sql`
    INSERT INTO dc_auth_rate_limits (key_hash, attempts, window_started_at)
    VALUES (${key}, 1, now())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE
        WHEN dc_auth_rate_limits.window_started_at < now() - (${windowMinutes}::integer * interval '1 minute') THEN 1
        ELSE dc_auth_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN dc_auth_rate_limits.window_started_at < now() - (${windowMinutes}::integer * interval '1 minute') THEN now()
        ELSE dc_auth_rate_limits.window_started_at
      END
    RETURNING attempts
  `;
  return Number(rows[0]?.attempts || 0) <= limit;
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [algorithm, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash || !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const derived = Buffer.from(await scrypt(password, salt, 64));
  const expected = Buffer.from(hash, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function readCookie(req, cookieName) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name === cookieName) return part.slice(index + 1).trim();
  }
  return null;
}

function sessionCookie(token, maxAge = SESSION_SECONDS) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(res) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export async function createSession(sql, userId, res, remember = true) {
  const token = randomBytes(32).toString('base64url');
  const ttlSeconds = remember ? SESSION_SECONDS : 60 * 60 * 8;
  await sql`
    INSERT INTO dc_auth_sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${sha256(token)}, now() + (${ttlSeconds}::integer * interval '1 second'))
  `;
  res.setHeader('Set-Cookie', sessionCookie(token, ttlSeconds));
}

export async function getSessionUser(sql, req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 128) return null;
  const rows = await sql`
    SELECT u.id, u.display_name, u.email, u.city, u.created_at
    FROM dc_auth_sessions s
    INNER JOIN dc_auth_users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now() AND u.is_active = true
    LIMIT 1
  `;
  if (!rows.length) return null;
  return rows[0];
}

export function publicUser(row) {
  return { id: row.id, name: row.display_name, email: row.email, city: row.city, createdAt: row.created_at };
}

export function safeDatabaseError(error) {
  if (error?.code === 'DB_NOT_CONFIGURED') return 'Authentication is not configured yet. Add DATABASE_URL in Vercel and run db/schema.sql in your Neon database.';
  if (error?.code === '42P01' || error?.code === '42703') return 'Database schema is not installed or is outdated. Run db/schema.sql in your Neon SQL Editor, then retry.';
  return 'Authentication service is temporarily unavailable. Check the DATABASE_URL and database setup, then retry.';
}
