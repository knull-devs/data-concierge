const GENDER_IDENTITIES = new Set(['', 'man', 'woman', 'non_binary', 'prefer_not_to_say']);
const INTERESTED_IN = new Set(['men', 'women', 'non_binary_people', 'everyone']);
const RELATIONSHIP_GOALS = new Set(['', 'serious_relationship', 'long_term_relationship', 'marriage_minded', 'open_to_see_where_it_goes']);
export const PROFILE_INTERESTS = Object.freeze([
  'coffee_and_cafes', 'travel', 'reading', 'live_music', 'cooking', 'food_culture',
  'art_and_design', 'fitness', 'hiking_outdoors', 'movies_and_series', 'pets',
  'volunteering', 'photography', 'cricket_and_sports', 'board_games', 'gardening'
]);
const PROFILE_INTEREST_SET = new Set(PROFILE_INTERESTS);

const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
const cleanParagraph = (value, maxLength) => typeof value === 'string'
  ? value.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim().replace(/[\t ]+/g, ' ')).join('\n').trim().slice(0, maxLength)
  : '';
const optionalInteger = value => value === '' || value === null || value === undefined ? null : Number(value);
function asStringArray(value) {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string');
  // Be defensive if a driver returns PostgreSQL TEXT[] in its textual form.
  if (typeof value !== 'string' || value === '{}' || value.length < 2 || value[0] !== '{' || value[value.length - 1] !== '}') return [];
  return value.slice(1, -1).split(',').map(item => item.replace(/^"|"$/g, '')).filter(Boolean);
}

export function normalizeProfileInput(body, fallbackCity = '') {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  const city = cleanText(input.city ?? fallbackCity, 80);
  const rawHeadline = typeof input.headline === 'string' ? input.headline.trim() : '';
  const rawAboutMe = typeof input.aboutMe === 'string' ? input.aboutMe.replace(/\r\n?/g, '\n').trim() : '';
  const headline = cleanText(input.headline, 100);
  const aboutMe = cleanParagraph(input.aboutMe, 600);
  const genderIdentity = typeof input.genderIdentity === 'string' ? input.genderIdentity : '';
  const relationshipGoal = typeof input.relationshipGoal === 'string' ? input.relationshipGoal : '';
  const discoverable = input.discoverable === true;
  if (input.discoverable !== undefined && typeof input.discoverable !== 'boolean') errors.discoverable = 'Choose whether you want compatible members to discover your profile.';

  if (city.length < 2) errors.city = 'Enter your city (at least 2 characters).';
  if (typeof input.city === 'string' && input.city.trim().length > 80) errors.city = 'City must be 80 characters or fewer.';
  if (headline.length > 0 && headline.length < 3) errors.headline = 'Headline must be at least 3 characters, or leave it blank.';
  if (rawHeadline.length > 100) errors.headline = 'Headline must be 100 characters or fewer.';
  if (aboutMe.length > 0 && aboutMe.length < 20) errors.aboutMe = 'Write at least 20 characters, or leave this field blank for now.';
  if (rawAboutMe.length > 600) errors.aboutMe = 'About you must be 600 characters or fewer.';
  if (!GENDER_IDENTITIES.has(genderIdentity)) errors.genderIdentity = 'Choose a valid option.';
  if (!RELATIONSHIP_GOALS.has(relationshipGoal)) errors.relationshipGoal = 'Choose a valid relationship goal.';

  const interestedInInput = Array.isArray(input.interestedIn) ? input.interestedIn : [];
  const interestedIn = [...new Set(interestedInInput.filter(value => typeof value === 'string'))];
  if (input.interestedIn !== undefined && !Array.isArray(input.interestedIn)) errors.interestedIn = 'Choose who you are interested in.';
  else if (interestedIn.length > 4 || interestedIn.some(value => !INTERESTED_IN.has(value))) errors.interestedIn = 'Choose valid introduction preferences.';
  else if (interestedIn.includes('everyone') && interestedIn.length > 1) errors.interestedIn = 'Choose “Everyone” by itself, or select specific preferences.';

  let preferredAgeMin;
  let preferredAgeMax;
  try {
    preferredAgeMin = optionalInteger(input.preferredAgeMin);
    preferredAgeMax = optionalInteger(input.preferredAgeMax);
  } catch {
    preferredAgeMin = NaN;
    preferredAgeMax = NaN;
  }
  if ((preferredAgeMin === null) !== (preferredAgeMax === null)) {
    errors.ageRange = 'Enter both ends of your preferred age range, or leave both blank.';
  } else if (preferredAgeMin !== null || preferredAgeMax !== null) {
    if (!Number.isInteger(preferredAgeMin) || !Number.isInteger(preferredAgeMax) || preferredAgeMin < 18 || preferredAgeMax > 99 || preferredAgeMin > preferredAgeMax) {
      errors.ageRange = 'Use an age range from 18 to 99, with the minimum no greater than the maximum.';
    }
  }

  const interestsInput = Array.isArray(input.interests) ? input.interests : [];
  const interests = [...new Set(interestsInput.filter(value => typeof value === 'string'))];
  if (input.interests !== undefined && !Array.isArray(input.interests)) errors.interests = 'Select interests from the list.';
  else if (interests.length > 8 || interests.some(value => !PROFILE_INTEREST_SET.has(value))) errors.interests = 'Choose up to 8 interests from the list.';

  const profile = {
    city,
    headline,
    aboutMe,
    genderIdentity,
    interestedIn,
    relationshipGoal,
    preferredAgeMin,
    preferredAgeMax,
    interests,
    discoverable
  };
  if (discoverable && !isDiscoveryReady(profile)) {
    errors.discoverable = 'To enable discovery, add a headline, a short introduction, your identity and relationship goal, who you want to meet, an age range, and at least 3 interests.';
  }
  return { ok: Object.keys(errors).length === 0, errors, profile };
}

export function mapProfileRow(row, fallbackCity = '') {
  if (!row) return {
    city: fallbackCity || '', headline: '', aboutMe: '', genderIdentity: '', interestedIn: [],
    relationshipGoal: '', preferredAgeMin: null, preferredAgeMax: null, interests: [], discoverable: false, updatedAt: null
  };
  return {
    city: row.city || fallbackCity || '',
    headline: row.headline || '',
    aboutMe: row.about_me || '',
    genderIdentity: row.gender_identity || '',
    interestedIn: asStringArray(row.interested_in),
    relationshipGoal: row.relationship_goal || '',
    preferredAgeMin: row.preferred_age_min === null || row.preferred_age_min === undefined ? null : Number(row.preferred_age_min),
    preferredAgeMax: row.preferred_age_max === null || row.preferred_age_max === undefined ? null : Number(row.preferred_age_max),
    interests: asStringArray(row.interests),
    discoverable: row.discoverable === true,
    updatedAt: row.updated_at || null
  };
}

export function isDiscoveryReady(profile) {
  const ageMin = profile?.preferredAgeMin ?? profile?.preferred_age_min;
  const ageMax = profile?.preferredAgeMax ?? profile?.preferred_age_max;
  const interestedIn = Array.isArray(profile?.interestedIn) ? profile.interestedIn : asStringArray(profile?.interested_in);
  const interests = Array.isArray(profile?.interests) ? profile.interests : asStringArray(profile?.interests);
  return String(profile?.city || '').trim().length >= 2
    && String(profile?.headline || '').trim().length >= 3
    && String(profile?.aboutMe ?? profile?.about_me ?? '').trim().length >= 20
    && Boolean(profile?.genderIdentity ?? profile?.gender_identity)
    && Boolean(profile?.relationshipGoal ?? profile?.relationship_goal)
    && interestedIn.length > 0
    && Number.isInteger(Number(ageMin)) && Number.isInteger(Number(ageMax))
    && Number(ageMin) >= 18 && Number(ageMax) <= 99 && Number(ageMin) <= Number(ageMax)
    && interests.length >= 3;
}

export function getProfileCompletion(profile) {
  const checks = [
    String(profile?.city || '').trim().length >= 2,
    String(profile?.headline || '').trim().length >= 3,
    String(profile?.aboutMe || '').trim().length >= 20,
    Boolean(profile?.genderIdentity && profile.genderIdentity !== 'prefer_not_to_say'),
    Array.isArray(profile?.interestedIn) && profile.interestedIn.length > 0,
    Boolean(profile?.relationshipGoal),
    Number.isInteger(profile?.preferredAgeMin) && Number.isInteger(profile?.preferredAgeMax),
    Array.isArray(profile?.interests) && profile.interests.length >= 3
  ];
  const completed = checks.filter(Boolean).length;
  return { percent: Math.round((completed / checks.length) * 100), completed, total: checks.length };
}
