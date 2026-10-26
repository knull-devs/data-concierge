/**
 * Date Concierge adaptation of pH7Builder's MatchmakingCore.php.
 *
 * Upstream source: pH7Builder / _protected/app/system/core/classes/MatchmakingCore.php
 * Copyright (c) 2011-2026 Pierre-Henry Soria and pH7Builder contributors.
 * Licensed under the MIT License; see THIRD_PARTY_NOTICES.md.
 *
 * The source's age/location/activity/approved-avatar weights and Gaussian age
 * falloff are intentionally preserved. Date Concierge adds an explicit,
 * reciprocal-preference eligibility gate before scoring; it never ranks a
 * profile that has not opted into discovery.
 */

export const MATCH_WEIGHTS = Object.freeze({ age: 0.35, geography: 0.25, activity: 0.25, avatar: 0.15 });
export const AGE_TOLERANCE_YEARS = 5;
export const ACTIVITY_HALF_LIFE_DAYS = 30;
export const SAME_CITY_SCORE = 1;
export const SAME_COUNTRY_SCORE = 0.4;
export const INDIA_COUNTRY_CODE = 'IN';
export const MAX_MATCHES = 5;
export const CANDIDATE_POOL_MULTIPLIER = 12;
export const MAX_RANK_CANDIDATES = MAX_MATCHES * CANDIDATE_POOL_MULTIPLIER;

const GENDER_TO_INTEREST = Object.freeze({
  man: 'men',
  woman: 'women',
  non_binary: 'non_binary_people'
});

export function normalizeCity(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
}

export function ageFromBirthDate(value, now = new Date()) {
  if (value instanceof Date) value = value.toISOString().slice(0, 10);
  const text = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return null;
  const current = new Date(now);
  if (birth.getTime() > current.getTime()) return null;
  let age = current.getUTCFullYear() - year;
  if (current.getUTCMonth() < month - 1 || (current.getUTCMonth() === month - 1 && current.getUTCDate() < day)) age--;
  return age >= 0 ? age : null;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string');
  if (typeof value !== 'string' || value.length < 2 || value[0] !== '{' || value[value.length - 1] !== '}') return [];
  return value.slice(1, -1).split(',').map(item => item.replace(/^"|"$/g, '')).filter(Boolean);
}

function interestedIn(profile) {
  return asArray(profile?.interestedIn ?? profile?.interested_in);
}

function genderIdentity(profile) {
  return String(profile?.genderIdentity ?? profile?.gender_identity ?? '');
}

function ageRange(profile) {
  return {
    min: profile?.preferredAgeMin == null && profile?.preferred_age_min == null ? null : Number(profile?.preferredAgeMin ?? profile?.preferred_age_min),
    max: profile?.preferredAgeMax == null && profile?.preferred_age_max == null ? null : Number(profile?.preferredAgeMax ?? profile?.preferred_age_max)
  };
}

export function ageRangeAllows(profile, age) {
  const range = ageRange(profile);
  return Number.isInteger(age) && Number.isInteger(range.min) && Number.isInteger(range.max) && age >= range.min && age <= range.max;
}

function allowsGender(profile, otherGender) {
  const wants = interestedIn(profile);
  if (wants.includes('everyone')) return true;
  const category = GENDER_TO_INTEREST[otherGender];
  return Boolean(category && wants.includes(category));
}

/** Mutual intent is required: both members' discovery preferences must allow the other. */
export function isMutuallyCompatible(profile, candidate, now = new Date()) {
  if (!profile || !candidate) return false;
  const profileId = profile.id ?? profile.user_id;
  const candidateId = candidate.id ?? candidate.user_id;
  if (profileId != null && candidateId != null && String(profileId) === String(candidateId)) return false;
  if (profile.discoverable !== true && profile.discoverable !== 'true') return false;
  if (candidate.discoverable !== true && candidate.discoverable !== 'true') return false;
  if (profile.is_active === false || candidate.is_active === false) return false;

  const profileAge = ageFromBirthDate(profile.birthDate ?? profile.birth_date, now);
  const candidateAge = ageFromBirthDate(candidate.birthDate ?? candidate.birth_date, now);
  if (profileAge === null || candidateAge === null || profileAge < 18 || candidateAge < 18) return false;
  if (!ageRangeAllows(profile, candidateAge) || !ageRangeAllows(candidate, profileAge)) return false;
  if (!allowsGender(profile, genderIdentity(candidate)) || !allowsGender(candidate, genderIdentity(profile))) return false;
  return true;
}

function ageAffinity(profile, candidate, now) {
  const profileAge = ageFromBirthDate(profile.birthDate ?? profile.birth_date, now);
  const candidateAge = ageFromBirthDate(candidate.birthDate ?? candidate.birth_date, now);
  if (profileAge === null || candidateAge === null) return 0.5;
  const difference = Math.abs(profileAge - candidateAge);
  return Math.exp(-(difference ** 2) / (2 * AGE_TOLERANCE_YEARS ** 2));
}

function geoAffinity(profile, candidate) {
  const firstCity = normalizeCity(profile.city ?? profile.account_city);
  const secondCity = normalizeCity(candidate.city ?? candidate.account_city);
  if (firstCity && firstCity === secondCity) return SAME_CITY_SCORE;
  // Date Concierge's initial market is India-wide. The source algorithm gives
  // 0.4 for same-country profiles; all members in this launch cohort use IN.
  const firstCountry = String(profile.country || INDIA_COUNTRY_CODE).toUpperCase();
  const secondCountry = String(candidate.country || INDIA_COUNTRY_CODE).toUpperCase();
  return firstCountry && firstCountry === secondCountry ? SAME_COUNTRY_SCORE : 0;
}

function activityScore(candidate, now) {
  const raw = candidate.lastActivity ?? candidate.last_activity_at ?? candidate.created_at;
  if (!raw) return 0;
  const stamp = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  if (!Number.isFinite(stamp)) return 0;
  const nowStamp = new Date(now).getTime();
  const days = Math.max(0, (nowStamp - stamp) / 86400000);
  return Math.exp(-days / ACTIVITY_HALF_LIFE_DAYS);
}

function avatarScore(candidate) {
  const avatar = candidate.avatarUrl ?? candidate.avatar_url ?? candidate.avatar;
  const approved = candidate.avatarApproved ?? candidate.avatar_approved ?? candidate.approvedAvatar;
  return avatar && approved === true ? 1 : 0;
}

/**
 * pH7 MatchmakingCore's 0..1 scoring formula, adapted to Date Concierge rows.
 * This is a ranking heuristic, not a scientific prediction of chemistry.
 */
export function compatibilityScore(profile, candidate, now = new Date()) {
  return MATCH_WEIGHTS.age * ageAffinity(profile, candidate, now)
    + MATCH_WEIGHTS.geography * geoAffinity(profile, candidate)
    + MATCH_WEIGHTS.activity * activityScore(candidate, now)
    + MATCH_WEIGHTS.avatar * avatarScore(candidate);
}

export function sharedInterests(profile, candidate) {
  const first = new Set(asArray(profile?.interests));
  return asArray(candidate?.interests).filter(value => first.has(value));
}

export function getMatchReasons(profile, candidate, now = new Date()) {
  const reasons = [];
  const age = ageFromBirthDate(candidate.birthDate ?? candidate.birth_date, now);
  if (age !== null && ageRangeAllows(profile, age) && ageRangeAllows(candidate, ageFromBirthDate(profile.birthDate ?? profile.birth_date, now))) {
    reasons.push('Within both age preferences');
  }
  const firstCity = normalizeCity(profile.city ?? profile.account_city);
  const secondCity = normalizeCity(candidate.city ?? candidate.account_city);
  if (firstCity && firstCity === secondCity) reasons.push('Same city');
  else reasons.push('Both in India');

  const lastActivity = candidate.lastActivity ?? candidate.last_activity_at ?? candidate.created_at;
  const activityDate = lastActivity ? new Date(lastActivity).getTime() : NaN;
  if (Number.isFinite(activityDate)) {
    const days = Math.max(0, (new Date(now).getTime() - activityDate) / 86400000);
    if (days <= 7) reasons.push('Active this week');
    else if (days <= 30) reasons.push('Active this month');
  }

  const shared = sharedInterests(profile, candidate);
  if (shared.length) reasons.push(`${shared.length} shared interest${shared.length === 1 ? '' : 's'}`);
  const firstGoal = profile.relationshipGoal ?? profile.relationship_goal;
  const secondGoal = candidate.relationshipGoal ?? candidate.relationship_goal;
  if (firstGoal && firstGoal === secondGoal) reasons.push('Similar relationship intentions');
  if ((candidate.avatarUrl ?? candidate.avatar_url ?? candidate.avatar) && avatarScore(candidate) === 1) reasons.push('Approved profile photo');
  return reasons.slice(0, 4);
}

/** Rank a mutually eligible pool and return no more than five recommendations, matching pH7's limits. */
export function rankMatches(profile, candidates, limit = MAX_MATCHES, now = new Date()) {
  return candidates
    .filter(candidate => isMutuallyCompatible(profile, candidate, now))
    .map(candidate => ({
      ...candidate,
      score: compatibilityScore(profile, candidate, now),
      matchReasons: getMatchReasons(profile, candidate, now)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(MAX_MATCHES, Number(limit) || MAX_MATCHES)));
}
