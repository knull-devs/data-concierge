import assert from 'node:assert/strict';
import { normalizeNotificationHref } from '../api/_lib/notifications.js';
import { normalizeDateAction, normalizeDateProposal, UUID_RE } from '../api/_lib/date-plans.js';

const introId = '5f5e1000-0000-4000-8000-000000000001';
const planId = '5f5e1000-0000-4000-8000-000000000002';
const now = Date.parse('2026-10-30T12:00:00.000Z');

assert.equal(normalizeNotificationHref('/messages.html?introductionId=abc'), '/messages.html?introductionId=abc');
assert.equal(normalizeNotificationHref('https://evil.example/phish'), '/dashboard.html');
assert.equal(normalizeNotificationHref('//evil.example/path'), '/dashboard.html');
assert.equal(normalizeNotificationHref('/messages.html\nLocation: https://evil.example'), '/dashboard.html');

const good = normalizeDateProposal({
  introductionId: introId,
  scheduledFor: '2026-10-30T14:00:00+00:00',
  city: '  Delhi   NCR ', venue: ' The Maple Room ', note: ' A thoughtful first date. '
}, now);
assert.equal(good.ok, true);
assert.equal(good.proposal.city, 'Delhi NCR');
assert.equal(good.proposal.venue, 'The Maple Room');
assert.equal(good.proposal.note, 'A thoughtful first date.');
assert.equal(good.proposal.scheduledFor, '2026-10-30T14:00:00.000Z');
assert.equal(normalizeDateProposal({ introductionId: introId, scheduledFor: '2026-10-30T12:10:00Z', city: 'Delhi' }, now).ok, false);
assert.equal(normalizeDateProposal({ introductionId: introId, scheduledFor: '2027-02-01T12:00:00Z', city: 'Delhi' }, now).ok, false);
assert.equal(normalizeDateProposal({ introductionId: 'not-a-uuid', scheduledFor: '2026-10-30T14:00:00Z', city: 'Delhi' }, now).ok, false);
assert.equal(normalizeDateProposal({ introductionId: introId, scheduledFor: '2026-10-30T14:00:00', city: 'Delhi' }, now).ok, false);
assert.equal(normalizeDateProposal({ introductionId: introId, scheduledFor: '2026-10-30T14:00:00Z', city: 'D'.repeat(81) }, now).ok, false);
assert.equal(normalizeDateProposal({ introductionId: introId, scheduledFor: '2026-10-30T14:00:00Z', city: 'Delhi', venue: 'V'.repeat(161) }, now).ok, false);
assert.equal(normalizeDateProposal({ introductionId: introId, scheduledFor: '2026-10-30T14:00:00Z', city: 'Delhi', note: 'N'.repeat(501) }, now).ok, false);

assert.equal(normalizeDateAction({ planId, action: 'accept' }).ok, true);
assert.equal(normalizeDateAction({ planId, action: 'decline' }).ok, true);
assert.equal(normalizeDateAction({ planId, action: 'cancel' }).ok, true);
assert.equal(normalizeDateAction({ planId, action: 'complete' }).ok, true);
assert.equal(normalizeDateAction({ planId, action: 'delete' }).ok, false);
assert.equal(normalizeDateAction({ planId: 'wrong', action: 'accept' }).ok, false);
assert.equal(UUID_RE.test(planId), true);

console.log('PASS: notification destination safety and date proposal/action validation');
