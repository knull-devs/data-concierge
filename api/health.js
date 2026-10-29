import { getDb, sendJson, safeDatabaseError } from './_lib/auth.js';

const REQUIRED_TABLES = [
  ['authUsers', 'dc_auth_users', 'schema'],
  ['authSessions', 'dc_auth_sessions', 'schema'],
  ['authRateLimits', 'dc_auth_rate_limits', 'schema'],
  ['profiles', 'dc_member_profiles', '001'],
  ['introductions', 'dc_introduction_requests', '002'],
  ['messages', 'dc_messages', '003'],
  ['memberSettings', 'dc_member_settings', '004'],
  ['notifications', 'dc_notifications', '004'],
  ['datePlans', 'dc_date_plans', '005']
];

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  try {
    const sql = getDb();
    // Static table readiness checks; no user input is incorporated into this query.
    const rows = await sql`SELECT 1 AS ok, to_regclass('public.dc_auth_users')::text AS auth_users, to_regclass('public.dc_auth_sessions')::text AS auth_sessions, to_regclass('public.dc_auth_rate_limits')::text AS auth_rate_limits, to_regclass('public.dc_member_profiles')::text AS profiles, to_regclass('public.dc_introduction_requests')::text AS introductions, to_regclass('public.dc_messages')::text AS messages, to_regclass('public.dc_member_settings')::text AS member_settings, to_regclass('public.dc_notifications')::text AS notifications, to_regclass('public.dc_date_plans')::text AS date_plans`;
    const row = rows[0] || {};
    const tables = Object.fromEntries(REQUIRED_TABLES.map(([alias, table]) => [table, Boolean(row[alias]) ]));
    const missing = REQUIRED_TABLES.filter(([alias]) => !row[alias]);
    const pendingMigrations = [...new Set(missing.map(([, , migration]) => migration))].sort();
    const authReady = Boolean(row.auth_users && row.auth_sessions);
    const schemaReady = missing.length === 0;
    return sendJson(res, 200, {
      ok: row.ok === 1,
      service: 'Date Concierge API',
      database: 'connected',
      authenticatedRoutesReady: authReady,
      schemaReady,
      tables,
      pendingMigrations: pendingMigrations.map(version => ({
        version,
        file: ({ 'schema': 'db/schema.sql', '001': 'db/migrations/001_member_profiles.sql', '002': 'db/migrations/002_discovery_matching.sql', '003': 'db/migrations/003_messages.sql', '004': 'db/migrations/004_notifications_settings.sql', '005': 'db/migrations/005_date_plans.sql' })[version]
      }))
    });
  } catch (error) {
    console.error('Health check error:', error?.code || error?.name || 'unknown');
    return sendJson(res, error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, { ok: false, database: 'unavailable', error: safeDatabaseError(error) });
  }
}
