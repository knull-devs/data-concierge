import assert from 'node:assert/strict';
import { normalizeProfileInput, mapProfileRow, getProfileCompletion, PROFILE_INTERESTS } from '../api/_lib/profile.js';

const valid = {
  city: 'Delhi NCR',
  headline: 'Books, cafés and long walks',
  aboutMe: 'I value kind conversations, a sense of humour and making time for people.',
  genderIdentity: 'woman',
  interestedIn: ['men'],
  relationshipGoal: 'serious_relationship',
  preferredAgeMin: '27',
  preferredAgeMax: '38',
  interests: ['reading', 'coffee_and_cafes', 'travel']
};

const normalized = normalizeProfileInput(valid, 'Delhi NCR');
assert.equal(normalized.ok, true, `Expected valid profile; got ${JSON.stringify(normalized.errors)}`);
assert.equal(normalized.profile.preferredAgeMin, 27);
assert.equal(normalized.profile.preferredAgeMax, 38);
assert.deepEqual(normalized.profile.interestedIn, ['men']);
assert.equal(getProfileCompletion(normalized.profile).percent, 100);

assert.equal(normalizeProfileInput({ ...valid, city: 'D' }).ok, false, 'City must contain at least 2 characters');
assert.equal(normalizeProfileInput({ ...valid, aboutMe: 'Too short' }).errors.aboutMe !== undefined, true, 'About text needs a minimum length when supplied');
assert.equal(normalizeProfileInput({ ...valid, headline: 'x'.repeat(101) }).errors.headline !== undefined, true, 'Headline max must be enforced server-side');
assert.equal(normalizeProfileInput({ ...valid, aboutMe: 'x'.repeat(601) }).errors.aboutMe !== undefined, true, 'About max must be enforced server-side');
assert.equal(normalizeProfileInput({ ...valid, preferredAgeMin: '42', preferredAgeMax: '26' }).errors.ageRange !== undefined, true, 'Age minimum must not exceed maximum');
assert.equal(normalizeProfileInput({ ...valid, preferredAgeMin: '17', preferredAgeMax: '35' }).errors.ageRange !== undefined, true, 'Age preferences must remain adult-only');
assert.equal(normalizeProfileInput({ ...valid, interestedIn: ['everyone', 'women'] }).errors.interestedIn !== undefined, true, 'Everyone cannot be combined with specific preferences');
assert.equal(normalizeProfileInput({ ...valid, interests: ['not-an-interest'] }).errors.interests !== undefined, true, 'Unknown interests must be rejected');
assert.equal(normalizeProfileInput({ ...valid, interests: PROFILE_INTERESTS.slice(0, 9) }).errors.interests !== undefined, true, 'At most 8 interests are allowed');

const empty = mapProfileRow(null, 'Jaipur');
assert.equal(empty.city, 'Jaipur');
assert.equal(getProfileCompletion(empty).percent, 13, 'The account city counts as one of eight completion items');

console.log('PASS: profile normalization, adult age range, preference exclusivity, interest allowlist/limit, completion score and empty-profile defaults.');
