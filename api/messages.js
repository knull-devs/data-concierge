import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError
} from './_lib/auth.js';
import { isValidIntroductionId, normalizeMessage } from './_lib/messages.js';

const SETUP_MESSAGE = 'Messaging setup is not installed yet. Run db/migrations/001_member_profiles.sql, then 002_discovery_matching.sql, then 003_messages.sql in Neon SQL Editor.';
function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') { try { const parsed = JSON.parse(req.body); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; } }
  return null;
}
function getQuery(req, name) {
  const value = req.query?.[name];
  return Array.isArray(value) ? String(value[0] || '') : (typeof value === 'string' ? value : '');
}

async function acceptedIntroduction(sql, introductionId, userId) {
  const rows = await sql`
    SELECT id, requester_id, recipient_id, status
    FROM dc_introduction_requests
    WHERE id = ${introductionId} AND status = 'accepted'
      AND (requester_id = ${userId} OR recipient_id = ${userId})
      AND EXISTS (
        SELECT 1 FROM dc_auth_users other
        WHERE other.id = CASE WHEN requester_id = ${userId} THEN recipient_id ELSE requester_id END
          AND other.is_active = TRUE
      )
    LIMIT 1
  `;
  return rows[0] || null;
}

function otherMemberId(introduction, userId) {
  return introduction.requester_id === userId ? introduction.recipient_id : introduction.requester_id;
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  if (req.method !== 'GET') {
    if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
    if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
    if (Number(req.headers['content-length'] || 0) > 10000) return sendJson(res, 413, { error: 'Message request is too large.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to view messages.' });

    if (req.method === 'GET') {
      if (!(await enforceRateLimit(sql, req, `messages-read:${user.id}`, 120, 60))) {
        return sendJson(res, 429, { error: 'Too many message requests. Please wait a moment.' });
      }
      const introductionId = getQuery(req, 'introductionId').trim();
      if (introductionId) {
        if (!isValidIntroductionId(introductionId)) return sendJson(res, 400, { error: 'Choose a valid conversation.' });
        const intro = await acceptedIntroduction(sql, introductionId, user.id);
        if (!intro) return sendJson(res, 404, { error: 'Messages are available only for mutually accepted introductions.' });
        const rows = await sql`
          SELECT m.id, m.introduction_id, m.sender_id, m.body, m.created_at, m.read_at,
                 u.display_name AS sender_name
          FROM dc_messages m
          INNER JOIN dc_auth_users u ON u.id = m.sender_id
          WHERE m.introduction_id = ${introductionId}
          ORDER BY m.created_at DESC
          LIMIT 100
        `;
        return sendJson(res, 200, {
          ok: true,
          introductionId,
          messages: rows.reverse().map(row => ({
            id: row.id, introductionId: row.introduction_id, senderId: row.sender_id,
            senderName: row.sender_name, body: row.body, createdAt: row.created_at, readAt: row.read_at
          }))
        });
      }

      const rows = await sql`
        SELECT r.id AS introduction_id,
               other.id AS other_id, other.display_name AS other_name,
               COALESCE(mp.city, other.city) AS other_city,
               CASE WHEN mp.avatar_approved = TRUE THEN mp.avatar_url ELSE NULL END AS avatar_url,
               last_message.body AS last_message,
               last_message.sender_id AS last_sender_id,
               last_message.created_at AS last_message_at,
               COALESCE(unread.message_count, 0)::integer AS unread_count,
               r.updated_at AS introduction_updated_at
        FROM dc_introduction_requests r
        INNER JOIN dc_auth_users other
          ON other.id = CASE WHEN r.requester_id = ${user.id} THEN r.recipient_id ELSE r.requester_id END
         AND other.is_active = TRUE
        LEFT JOIN dc_member_profiles mp ON mp.user_id = other.id
        LEFT JOIN LATERAL (
          SELECT m.body, m.sender_id, m.created_at
          FROM dc_messages m
          WHERE m.introduction_id = r.id
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS message_count
          FROM dc_messages m
          WHERE m.introduction_id = r.id AND m.sender_id <> ${user.id} AND m.read_at IS NULL
        ) AS unread ON TRUE
        WHERE r.status = 'accepted' AND (r.requester_id = ${user.id} OR r.recipient_id = ${user.id})
        ORDER BY COALESCE(last_message.created_at, r.updated_at) DESC
        LIMIT 50
      `;
      return sendJson(res, 200, {
        ok: true,
        conversations: rows.map(row => ({
          introductionId: row.introduction_id,
          member: { id: row.other_id, name: row.other_name, city: row.other_city || '', avatarUrl: row.avatar_url || null },
          lastMessage: row.last_message || '',
          lastMessageAt: row.last_message_at || null,
          lastMessageFromMe: row.last_sender_id === user.id,
          unreadCount: Number(row.unread_count || 0),
          startedAt: row.introduction_updated_at
        }))
      });
    }

    if (!(await enforceRateLimit(sql, req, `messages-write:${user.id}`, 30, 1))) {
      return sendJson(res, 429, { error: 'You are sending messages too quickly. Wait a minute and try again.' });
    }
    const body = bodyObject(req);
    if (!body) return sendJson(res, 400, { error: 'Send a valid message request.' });
    const introductionId = typeof body.introductionId === 'string' ? body.introductionId.trim() : '';
    if (!isValidIntroductionId(introductionId)) return sendJson(res, 400, { error: 'Choose a valid conversation.' });
    const intro = await acceptedIntroduction(sql, introductionId, user.id);
    if (!intro) return sendJson(res, 404, { error: 'Messages are available only for mutually accepted introductions.' });

    if (req.method === 'PATCH') {
      if (body.action !== 'markRead') return sendJson(res, 400, { error: 'Unknown message action.' });
      const updated = await sql`
        UPDATE dc_messages SET read_at = NOW()
        WHERE introduction_id = ${introductionId} AND sender_id <> ${user.id} AND read_at IS NULL
        RETURNING id
      `;
      return sendJson(res, 200, { ok: true, markedRead: updated.length });
    }

    const normalized = normalizeMessage(body.message);
    if (!normalized.ok) return sendJson(res, 400, { error: normalized.error });
    const rows = await sql`
      INSERT INTO dc_messages (introduction_id, sender_id, body)
      VALUES (${introductionId}, ${user.id}, ${normalized.message})
      RETURNING id, introduction_id, sender_id, body, created_at, read_at
    `;
    await sql`UPDATE dc_introduction_requests SET updated_at = NOW() WHERE id = ${introductionId} AND status = 'accepted'`;
    const row = rows[0];
    return sendJson(res, 201, { ok: true, message: {
      id: row.id, introductionId: row.introduction_id, senderId: row.sender_id,
      senderName: user.display_name, body: row.body, createdAt: row.created_at, readAt: row.read_at
    } });
  } catch (error) {
    console.error('Messages API error:', error?.code || error?.name || 'unknown');
    const setup = ['42P01', '42703'].includes(error?.code);
    return sendJson(res, setup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, {
      code: setup ? 'MESSAGES_SETUP_REQUIRED' : undefined,
      error: setup ? SETUP_MESSAGE : safeDatabaseError(error)
    });
  }
}
