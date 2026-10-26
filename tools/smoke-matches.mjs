import assert from 'node:assert/strict';
import {
  ageFromBirthDate, ageRangeAllows, compatibilityScore, getMatchReasons,
  isMutuallyCompatible, normalizeCity, rankMatches, MATCH_WEIGHTS
} from '../api/_lib/matchmaking.js';
import { isDiscoveryReady, normalizeProfileInput } from '../api/_lib/profile.js';

const now = new Date('2026-10-27T10:00:00.000Z');
const base = {
  id: 'member-a', is_active: true, displayName: 'A', birthDate: '1995-04-20', city: 'Delhi NCR', country: 'IN',
  genderIdentity: 'man', interestedIn: ['women'], relationshipGoal: 'serious_relationship',
  preferredAgeMin: 25, preferredAgeMax: 36, headline: 'Coffee, books and kind conversations',
  aboutMe: 'I enjoy slow weekends, good conversations, travel and finding new cafes.',
  interests: ['coffee_and_cafes', 'reading', 'travel'], discoverable: true,
  lastActivity: now.toISOString(), avatarUrl: null, avatarApproved: false
};
const candidate = {
  ...base, id: 'member-b', displayName: 'B', birthDate: '1996-04-20', city: '  delhi   ncr ',
  genderIdentity: 'woman', interestedIn: ['men'], preferredAgeMin: 28, preferredAgeMax: 38,
  avatarUrl: '/uploads/approved.jpg', avatarApproved: true
};

assert.equal(ageFromBirthDate('1996-04-20', now), 30, 'Age is calculated using calendar birthday, not year subtraction alone');
assert.equal(ageFromBirthDate('2030-01-01', now), null, 'Future birth dates are treated as unknown');
assert.equal(normalizeCity('  New   Delhi  '), 'new delhi', 'City matching collapses spaces and case');
assert.equal(ageRangeAllows(base, 30), true);
assert.equal(ageRangeAllows(base, 44), false);
assert.equal(isDiscoveryReady(base), true, 'Complete opted-in profiles are discovery ready');
assert.equal(isMutuallyCompatible(base, candidate, now), true, 'Reciprocal age and gender preferences allow this pair');
assert.equal(compatibilityScore(base, candidate, now) > 0.98, true, 'Same-city, recent, near-age approved-photo profile scores highly');
assert.equal(MATCH_WEIGHTS.age + MATCH_WEIGHTS.geography + MATCH_WEIGHTS.activity + MATCH_WEIGHTS.avatar, 1, 'pH7 weights sum to one');
assert.equal(getMatchReasons(base, candidate, now).includes('Same city'), true, 'Match explanation includes normalized same-city signal');

const wrongPreference = { ...candidate, interestedIn: ['women'] };
assert.equal(isMutuallyCompatible(base, wrongPreference, now), false, 'Preferences must be reciprocal');
assert.equal(isMutuallyCompatible(base, { ...candidate, discoverable: false }, now), false, 'Opted-out profiles are excluded');
assert.equal(isMutuallyCompatible(base, { ...candidate, preferredAgeMin: 35, preferredAgeMax: 38 }, now), false, 'Both members age ranges must accept each other');
assert.equal(isMutuallyCompatible(base, { ...candidate, id: base.id }, now), false, 'A member cannot match themselves');

const oldDifferentCity = { ...candidate, id: 'member-c', city: 'Jaipur', lastActivity: '2026-08-01T00:00:00.000Z', avatarUrl: null, avatarApproved: false };
assert.equal(compatibilityScore(base, oldDifferentCity, now) < compatibilityScore(base, candidate, now), true, 'Older activity, different city and no approved photo rank lower');
const ranked = rankMatches(base, [oldDifferentCity, candidate], 5, now);
assert.deepEqual(ranked.map(item => item.id), ['member-b', 'member-c'], 'Best-scoring eligible candidates rank first');
assert.equal(rankMatches(base, [candidate], 20, now).length, 1, 'Rank result is bounded by available profiles and source limit');

const signupReady = normalizeProfileInput({
  ...base, city: 'Delhi NCR', headline: 'Coffee, books and kind conversations',
  aboutMe: 'I enjoy slow weekends, good conversations, travel and finding new cafes.',
  genderIdentity: 'man', interestedIn: ['women'], relationshipGoal: 'serious_relationship',
  preferredAgeMin: 25, preferredAgeMax: 36, interests: ['coffee_and_cafes', 'reading', 'travel'], discoverable: true
}, 'Delhi NCR');
assert.equal(signupReady.ok, true, `A complete discovery profile should save: ${JSON.stringify(signupReady.errors)}`);
const incomplete = normalizeProfileInput({ ...signupReady.profile, headline: '', discoverable: true }, 'Delhi NCR');
assert.equal(incomplete.errors.discoverable !== undefined, true, 'Discovery opt-in requires profile readiness');

console.log('PASS: pH7 scoring port, adult age calculation, reciprocal preference/age filters, opt-out exclusion, candidate ranking and discovery-readiness validation.');
