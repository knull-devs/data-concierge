import { getDb, sendJson, safeDatabaseError } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  try {
    const sql = getDb();
    const rows = await sql`SELECT 1 AS ok`;
    return sendJson(res, 200, { ok: rows[0]?.ok === 1, service: 'Date Concierge API', database: 'connected' });
  } catch (error) {
    console.error('Health check error:', error?.code || error?.name || 'unknown');
    return sendJson(res, error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, { ok: false, error: safeDatabaseError(error) });
  }
}
