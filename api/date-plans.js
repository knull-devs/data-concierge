import {
  getDb, sendJson, requestHasValidOrigin, isJsonBody, enforceRateLimit,
  getSessionUser, safeDatabaseError
} from './_lib/auth.js';
import { normalizeDateAction, normalizeDateProposal, UUID_RE } from './_lib/date-plans.js';
import { createNotificationBestEffort } from './_lib/notifications.js';

const SETUP_MESSAGE = 'Date planning is not installed yet. Run db/migrations/001_member_profiles.sql, 002_discovery_matching.sql, 003_messages.sql, 004_notifications_settings.sql and 005_date_plans.sql in order in Neon SQL Editor.';
function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string') { try { const parsed = JSON.parse(req.body); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; } }
  return null;
}
function queryValue(req, name) {
  const value = req.query?.[name];
  return Array.isArray(value) ? String(value[0] || '') : typeof value === 'string' ? value : '';
}
function mapPlan(row, currentUserId) {
  return {
    id: row.id,
    introductionId: row.introduction_id,
    proposedBy: row.proposed_by,
    proposedByMe: row.proposed_by === currentUserId,
    scheduledFor: row.scheduled_for,
    city: row.city,
    venue: row.venue || '',
    note: row.note || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
    member: { id: row.other_id, name: row.other_name, city: row.other_city || '' }
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, PATCH'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
  if (req.method !== 'GET') {
    if (!requestHasValidOrigin(req)) return sendJson(res, 403, { error: 'This request origin is not allowed.' });
    if (!isJsonBody(req)) return sendJson(res, 415, { error: 'Send this request as JSON.' });
    if (Number(req.headers['content-length'] || 0) > 12000) return sendJson(res, 413, { error: 'Date plan request is too large.' });
  }

  try {
    const sql = getDb();
    const user = await getSessionUser(sql, req);
    if (!user) return sendJson(res, 401, { authenticated: false, error: 'Please log in to manage date plans.' });
    if (!(await enforceRateLimit(sql, req, `date-plans:${user.id}`, req.method === 'GET' ? 120 : 20, 60))) {
      return sendJson(res, 429, { error: 'Too many date-planning requests. Please wait and retry.' });
    }

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT d.id, d.introduction_id, d.proposed_by, d.scheduled_for, d.city, d.venue, d.note,
               d.status, d.created_at, d.updated_at, d.responded_at,
               other.id AS other_id, other.display_name AS other_name, COALESCE(op.city, other.city) AS other_city
        FROM dc_date_plans d
        INNER JOIN dc_introduction_requests r ON r.id = d.introduction_id AND r.status = 'accepted'
        INNER JOIN dc_auth_users other ON other.id = CASE WHEN r.requester_id = ${user.id} THEN r.recipient_id ELSE r.requester_id END AND other.is_active = TRUE
        LEFT JOIN dc_member_profiles op ON op.user_id = other.id
        WHERE r.requester_id = ${user.id} OR r.recipient_id = ${user.id}
        ORDER BY CASE WHEN d.status IN ('pending', 'accepted') THEN 0 ELSE 1 END, d.scheduled_for ASC, d.created_at DESC
        LIMIT 100
      `;
      return sendJson(res, 200, { ok: true, plans: rows.map(row => mapPlan(row, user.id)) });
    }

    const body = bodyObject(req);
    if (!body) return sendJson(res, 400, { error: 'Send a valid date-planning request.' });

    if (req.method === 'POST') {
      const normalized = normalizeDateProposal(body);
      if (!normalized.ok) return sendJson(res, 400, { error: normalized.error });
      const proposal = normalized.proposal;
      const introRows = await sql`
        SELECT r.id, r.requester_id, r.recipient_id, r.status,
               other.display_name AS other_name, other.is_active AS other_active
        FROM dc_introduction_requests r
        INNER JOIN dc_auth_users other ON other.id = CASE WHEN r.requester_id = ${user.id} THEN r.recipient_id ELSE r.requester_id END
        WHERE r.id = ${proposal.introductionId}
          AND r.status = 'accepted'
          AND (r.requester_id = ${user.id} OR r.recipient_id = ${user.id})
        LIMIT 1
      `;
      const intro = introRows[0];
      if (!intro || intro.other_active !== true) return sendJson(res, 403, { error: 'Date proposals are available only for an active, mutually accepted introduction.' });
      const otherId = intro.requester_id === user.id ? intro.recipient_id : intro.requester_id;
      try {
        const rows = await sql`
          INSERT INTO dc_date_plans (introduction_id, proposed_by, scheduled_for, city, venue, note)
          VALUES (${proposal.introductionId}, ${user.id}, ${proposal.scheduledFor}, ${proposal.city}, ${proposal.venue}, ${proposal.note})
          RETURNING id, introduction_id, proposed_by, scheduled_for, city, venue, note, status, created_at, updated_at, responded_at
        `;
        const row = rows[0];
        await createNotificationBestEffort(sql, otherId, {
          category: 'date_plan', title: 'A date has been proposed',
          body: `${user.display_name} suggested ${proposal.venue || 'a date'} in ${proposal.city}. Review the proposal when you are ready.`,
          href: '/date-plans.html', relatedId: row.id
        });
        return sendJson(res, 201, { ok: true, plan: { ...row, proposedByMe: true }, message: 'Date proposal sent. The other person can accept, decline or cancel.' });
      } catch (error) {
        if (error?.code === '23505') return sendJson(res, 409, { error: 'There is already a pending or accepted proposal for this introduction. Respond to it or cancel it before proposing another date.' });
        throw error;
      }
    }

    const normalizedAction = normalizeDateAction(body);
    if (!normalizedAction.ok) return sendJson(res, 400, { error: normalizedAction.error });
    const { planId, action } = normalizedAction;
    const planRows = await sql`
      SELECT d.id, d.introduction_id, d.proposed_by, d.scheduled_for, d.city, d.venue, d.note, d.status,
             d.created_at, d.updated_at, d.responded_at,
             r.requester_id, r.recipient_id, r.status AS introduction_status,
             proposer.display_name AS proposer_name
      FROM dc_date_plans d
      INNER JOIN dc_introduction_requests r ON r.id = d.introduction_id
      INNER JOIN dc_auth_users proposer ON proposer.id = d.proposed_by
      WHERE d.id = ${planId} AND (r.requester_id = ${user.id} OR r.recipient_id = ${user.id})
      LIMIT 1
    `;
    const plan = planRows[0];
    if (!plan || (plan.requester_id !== user.id && plan.recipient_id !== user.id)) return sendJson(res, 404, { error: 'This date proposal is not available to your account.' });
    if (plan.introduction_status !== 'accepted') return sendJson(res, 409, { error: 'Date planning requires a mutually accepted introduction.' });
    const otherId = plan.requester_id === user.id ? plan.recipient_id : plan.requester_id;
    let nextStatus;
    if (action === 'accept' || action === 'decline') {
      if (plan.status !== 'pending') return sendJson(res, 409, { error: 'This proposal is no longer pending.' });
      if (plan.proposed_by === user.id) return sendJson(res, 403, { error: 'You cannot respond to your own proposal.' });
      nextStatus = action === 'accept' ? 'accepted' : 'declined';
    } else if (action === 'cancel') {
      if (!['pending', 'accepted'].includes(plan.status)) return sendJson(res, 409, { error: 'Only a pending or accepted proposal can be cancelled.' });
      nextStatus = 'cancelled';
    } else {
      if (plan.status !== 'accepted') return sendJson(res, 409, { error: 'Only an accepted date can be marked complete.' });
      if (new Date(plan.scheduled_for).getTime() > Date.now()) return sendJson(res, 409, { error: 'This date is in the future. You can mark it complete after the scheduled time.' });
      nextStatus = 'completed';
    }

    const updated = await sql`
      UPDATE dc_date_plans SET status = ${nextStatus}, updated_at = NOW(), responded_at = NOW()
      WHERE id = ${planId} AND status = ${plan.status}
      RETURNING id, introduction_id, proposed_by, scheduled_for, city, venue, note, status, created_at, updated_at, responded_at
    `;
    if (!updated.length) return sendJson(res, 409, { error: 'This date proposal changed in another session. Refresh and try again.' });
    const messages = {
      accepted: 'Date proposal accepted. You can now coordinate the details together.',
      declined: 'Date proposal declined.',
      cancelled: 'Date proposal cancelled.',
      completed: 'Date marked as completed. Hope it was a good experience.'
    };
    await createNotificationBestEffort(sql, otherId, {
      category: 'date_plan', title: `Date proposal ${nextStatus}`,
      body: `${user.display_name} ${nextStatus} the date proposal for ${plan.venue || plan.city}.`,
      href: '/date-plans.html', relatedId: planId
    });
    return sendJson(res, 200, { ok: true, plan: updated[0], message: messages[nextStatus] });
  } catch (error) {
    console.error('Date plans API error:', error?.code || error?.name || 'unknown');
    const setup = ['42P01', '42703'].includes(error?.code);
    return sendJson(res, setup || error?.code === 'DB_NOT_CONFIGURED' ? 503 : 500, {
      code: setup ? 'DATE_PLANS_SETUP_REQUIRED' : undefined,
      error: setup ? SETUP_MESSAGE : safeDatabaseError(error)
    });
  }
}
