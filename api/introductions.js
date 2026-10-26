import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError
} from './_lib/auth.js';
import { isDiscoveryReady } from './_lib/profile.js';
import { isMutuallyCompatible } from './_lib/matchmaking.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SETUP_MESSAGE = 'Introduction setup is not installed yet. Run db/migrations/001_member_profiles.sql first, then db/migrations/002_discovery_matching.sql in Neon SQL Editor.';

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  return null;
}
function mapMatchRow(row) {
  return {
    id: row.id,
    is_active: row.is_active,
    birthDate: row.birth_date,
    city: row.city || row.account_city || '',
    headline: row.headline || '',
    aboutMe: row.about_me || '',
    genderIdentity: row.gender_identity || '',
    interestedIn: Array.isArray(row.interested_in) ? row.interested_in : [],
    relationshipGoal: row.relationship_goal || '',
    preferredAgeMin: row.preferred_age_min == null ? null : Number(row.preferred_age_min),
    preferredAgeMax: row.preferred_age_max == null ? null : Number(row.preferred_age_max),
    interests: Array.isArray(row.interests) ? row.interests : [],
    discoverable: row.discoverable === true,
    lastActivity: row.last_activity_at || row.created_at,
    country: 'IN'
  };
}
async function loadMember(sql, id) {
  const rows = await sql`
    SELECT u.id, u.display_name, u.birth_date::text AS birth_date, u.city AS account_city,
           u.is_active, u.last_activity_at, u.created_at,
           p.city, p.headline, p.about_me, p.gender_identity, p.interested_in,
           p.relationship_goal, p.preferred_age_min, p.preferred_age_max, p.interests,
           p.discoverable, p.avatar_url, p.avatar_approved
    FROM dc_auth_users u
    LEFT JOIN dc_member_profiles p ON p.user_id = u.id
    WHERE u.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}
async function ensureDiscoveryMember(row) {
  if (!row || row.discoverable !== true || row.is_active !== true) return false;
  return isDiscoveryReady(mapMatchRow(row));
}
function publicRequest(row, currentUserId) {
  const isRequester = row.requester_id === currentUserId;
  const birth = row.other_birth_date ? new Date(`${String(row.other_birth_date).slice(0, 10)}T00:00:00Z`) : null;
  let age = null;
  if (birth && Number.isFinite(birth.getTime())) {
    const today = new Date();
    age = today.getUTCFullYear() - birth.getUTCFullYear();
    const dm = today.getUTCMonth() - birth.getUTCMonth();
    if (dm < 0 || (dm === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  }
  return {
    id: row.id,
    status: row.status,
    direction: isRequester ? 'sent' : 'received',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
    member: {
      name: row.other_name,
      age,
      city: row.other_city || row.other_account_city || '',
      headline: row.other_headline || '',
      aboutMe: row.other_about_me || ''
    }
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  if (req.method !== 'GET') {
    if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
    if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
    if (Number(req.headers['content-length'] || 0) > 8000) return sendJson(res, 413, { error: 'Request is too large.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to manage introductions.' });
    if (!(await enforceRateLimit(sql, req, `introductions:${user.id}`, 30, 60))) {
      return sendJson(res, 429, { error: 'Too many introduction actions. Please wait and retry.' });
    }

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT r.id, r.requester_id, r.recipient_id, r.status, r.created_at, r.updated_at, r.responded_at,
               other.id AS other_id, other.display_name AS other_name, other.birth_date::text AS other_birth_date,
               other.city AS other_account_city, mp.city AS other_city, mp.headline AS other_headline, mp.about_me AS other_about_me
        FROM dc_introduction_requests r
        INNER JOIN dc_auth_users other ON other.id = CASE WHEN r.requester_id = ${user.id} THEN r.recipient_id ELSE r.requester_id END
        LEFT JOIN dc_member_profiles mp ON mp.user_id = other.id
        WHERE r.requester_id = ${user.id} OR r.recipient_id = ${user.id}
        ORDER BY r.created_at DESC
        LIMIT 50
      `;
      return sendJson(res, 200, { ok: true, requests: rows.map(row => publicRequest(row, user.id)) });
    }

    const body = bodyObject(req);
    if (!body) return sendJson(res, 400, { error: 'Send a valid JSON request.' });
    if (req.method === 'POST') {
      const candidateId = typeof body.candidateId === 'string' ? body.candidateId.trim() : '';
      if (!UUID_RE.test(candidateId)) return sendJson(res, 400, { error: 'Choose a valid member to introduce.' });
      const selfRow = await loadMember(sql, user.id);
      if (!(await ensureDiscoveryMember(selfRow))) {
        return sendJson(res, 409, { code: 'DISCOVERY_DISABLED', error: 'Complete your profile and enable discovery before requesting introductions.' });
      }
      const candidateRow = await loadMember(sql, candidateId);
      if (!(await ensureDiscoveryMember(candidateRow))) return sendJson(res, 404, { error: 'This member is not available for introductions.' });
      if (!isMutuallyCompatible(mapMatchRow(selfRow), mapMatchRow(candidateRow))) {
        return sendJson(res, 403, { error: 'This introduction does not fit the current mutual preferences.' });
      }

      const existingRows = await sql`
        SELECT id, requester_id, recipient_id, status
        FROM dc_introduction_requests
        WHERE (requester_id = ${user.id} AND recipient_id = ${candidateId})
           OR (requester_id = ${candidateId} AND recipient_id = ${user.id})
        LIMIT 1
      `;
      const existing = existingRows[0];
      if (existing) {
        if (existing.requester_id === candidateId && existing.recipient_id === user.id && existing.status === 'pending') {
          const accepted = await sql`
            UPDATE dc_introduction_requests SET status = 'accepted', updated_at = NOW(), responded_at = NOW()
            WHERE id = ${existing.id} AND status = 'pending' RETURNING id, status
          `;
          if (accepted.length) return sendJson(res, 200, { ok: true, mutual: true, id: accepted[0].id, status: accepted[0].status, message: 'It is mutual — the introduction is accepted by both of you.' });
        }
        if (existing.requester_id === user.id && existing.status === 'pending') {
          return sendJson(res, 200, { ok: true, existing: true, id: existing.id, status: existing.status, message: 'You have already requested this introduction.' });
        }
        if (existing.status === 'accepted') return sendJson(res, 200, { ok: true, existing: true, id: existing.id, status: existing.status, message: 'This introduction is already accepted.' });
        return sendJson(res, 409, { error: 'An introduction request for this member already exists.', status: existing.status });
      }

      try {
        const inserted = await sql`
          INSERT INTO dc_introduction_requests (requester_id, recipient_id, status)
          VALUES (${user.id}, ${candidateId}, 'pending')
          RETURNING id, status, created_at
        `;
        return sendJson(res, 201, { ok: true, id: inserted[0].id, status: inserted[0].status, createdAt: inserted[0].created_at, message: 'Introduction request sent. The other person decides whether to accept.' });
      } catch (error) {
        if (error?.code !== '23505') throw error;
        const duplicate = await sql`
          SELECT id, requester_id, recipient_id, status FROM dc_introduction_requests
          WHERE (requester_id = ${user.id} AND recipient_id = ${candidateId})
             OR (requester_id = ${candidateId} AND recipient_id = ${user.id}) LIMIT 1
        `;
        const row = duplicate[0];
        if (row?.requester_id === candidateId && row?.recipient_id === user.id && row?.status === 'pending') {
          const accepted = await sql`UPDATE dc_introduction_requests SET status = 'accepted', updated_at = NOW(), responded_at = NOW() WHERE id = ${row.id} AND status = 'pending' RETURNING id, status`;
          if (accepted.length) return sendJson(res, 200, { ok: true, mutual: true, id: row.id, status: 'accepted', message: 'It is mutual — the introduction is accepted by both of you.' });
        }
        return sendJson(res, 409, { error: 'An introduction request for this member already exists.', status: row?.status || 'pending' });
      }
    }

    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    const action = body.action;
    if (!UUID_RE.test(requestId) || !['accept', 'decline'].includes(action)) return sendJson(res, 400, { error: 'Choose an introduction request and a valid response.' });
    const requestRows = await sql`
      SELECT id, requester_id, recipient_id, status FROM dc_introduction_requests
      WHERE id = ${requestId} AND recipient_id = ${user.id} AND status = 'pending'
      LIMIT 1
    `;
    const request = requestRows[0];
    if (!request) return sendJson(res, 404, { error: 'This pending request is no longer available.' });
    if (action === 'accept') {
      const selfRow = await loadMember(sql, user.id);
      const otherRow = await loadMember(sql, request.requester_id);
      if (!(await ensureDiscoveryMember(selfRow)) || !(await ensureDiscoveryMember(otherRow)) || !isMutuallyCompatible(mapMatchRow(selfRow), mapMatchRow(otherRow))) {
        return sendJson(res, 409, { error: 'This introduction can no longer be accepted because one profile is not available or preferences changed.' });
      }
    }
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    const updated = await sql`
      UPDATE dc_introduction_requests SET status = ${nextStatus}, updated_at = NOW(), responded_at = NOW()
      WHERE id = ${requestId} AND recipient_id = ${user.id} AND status = 'pending'
      RETURNING id, status, updated_at, responded_at
    `;
    if (!updated.length) return sendJson(res, 409, { error: 'This request has already been handled.' });
    return sendJson(res, 200, { ok: true, ...updated[0], message: nextStatus === 'accepted' ? 'Introduction accepted. Messaging will be enabled in a later milestone.' : 'Introduction declined.' });
  } catch (error) {
    console.error('Introductions API error:', error?.code || error?.name || 'unknown');
    const setup = error?.code === '42P01' || error?.code === '42703';
    return sendJson(res, setup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, {
      code: setup ? 'INTRODUCTIONS_SETUP_REQUIRED' : undefined,
      error: setup ? SETUP_MESSAGE : safeDatabaseError(error)
    });
  }
}
