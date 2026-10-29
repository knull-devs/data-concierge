import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError
} from './_lib/auth.js';
import { normalizeNotificationHref } from './_lib/notifications.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SETUP_MESSAGE = 'Notifications are not installed yet. Run db/migrations/004_notifications_settings.sql in your Neon SQL Editor.';

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try { const parsed = JSON.parse(req.body); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; }
    catch { return null; }
  }
  return null;
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) { res.setHeader('Allow', 'GET, PATCH'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (req.method === 'PATCH') {
    if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
    if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
    if (Number(req.headers['content-length'] || 0) > 4000) return sendJson(res, 413, { error: 'Notification action is too large.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to view notifications.' });

    if (req.method === 'GET') {
      if (!(await enforceRateLimit(sql, req, `notifications-read:${user.id}`, 120, 60))) return sendJson(res, 429, { error: 'Too many requests. Please wait and retry.' });
      const rows = await sql`
        SELECT id, category, title, body, href, related_id, created_at, read_at
        FROM dc_notifications
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT 60
      `;
      const unreadRows = await sql`SELECT COUNT(*)::integer AS count FROM dc_notifications WHERE user_id = ${user.id} AND read_at IS NULL`;
      return sendJson(res, 200, {
        ok: true,
        unreadCount: Number(unreadRows[0]?.count || 0),
        notifications: rows.map(row => ({
          id: row.id, category: row.category, title: row.title, body: row.body,
          href: normalizeNotificationHref(row.href), relatedId: row.related_id,
          createdAt: row.created_at, readAt: row.read_at, unread: !row.read_at
        }))
      });
    }

    if (!(await enforceRateLimit(sql, req, `notifications-write:${user.id}`, 60, 60))) return sendJson(res, 429, { error: 'Too many notification updates. Please wait and retry.' });
    const body = bodyObject(req);
    if (!body) return sendJson(res, 400, { error: 'Send a valid notification action.' });
    if (body.action === 'markAllRead') {
      const changed = await sql`UPDATE dc_notifications SET read_at = NOW() WHERE user_id = ${user.id} AND read_at IS NULL RETURNING id`;
      return sendJson(res, 200, { ok: true, markedRead: changed.length, unreadCount: 0 });
    }
    if (body.action === 'markRead' && typeof body.id === 'string' && UUID_RE.test(body.id)) {
      const changed = await sql`
        UPDATE dc_notifications SET read_at = COALESCE(read_at, NOW())
        WHERE id = ${body.id} AND user_id = ${user.id}
        RETURNING id, read_at
      `;
      if (!changed.length) return sendJson(res, 404, { error: 'This notification is no longer available.' });
      const unreadRows = await sql`SELECT COUNT(*)::integer AS count FROM dc_notifications WHERE user_id = ${user.id} AND read_at IS NULL`;
      return sendJson(res, 200, { ok: true, notification: changed[0], unreadCount: Number(unreadRows[0]?.count || 0) });
    }
    return sendJson(res, 400, { error: 'Choose a valid notification action.' });
  } catch (error) {
    console.error('Notifications API error:', error?.code || error?.name || 'unknown');
    const setup = ['42P01', '42703'].includes(error?.code);
    return sendJson(res, setup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, {
      code: setup ? 'NOTIFICATIONS_SETUP_REQUIRED' : undefined,
      error: setup ? SETUP_MESSAGE : safeDatabaseError(error)
    });
  }
}
