export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value, max) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';

export function normalizeDateProposal(body, now = Date.now()) {
  const introductionId = typeof body?.introductionId === 'string' ? body.introductionId.trim() : '';
  const scheduledFor = typeof body?.scheduledFor === 'string' ? body.scheduledFor.trim() : '';
  const rawCity = typeof body?.city === 'string' ? body.city.trim().replace(/\s+/g, ' ') : '';
  const rawVenue = typeof body?.venue === 'string' ? body.venue.trim().replace(/\s+/g, ' ') : '';
  const rawNote = typeof body?.note === 'string' ? body.note.replace(/\r\n?/g, '\n').trim() : '';
  if (rawCity.length > 80) return { ok: false, error: 'City must be 80 characters or fewer.' };
  if (rawVenue.length > 160) return { ok: false, error: 'Venue must be 160 characters or fewer.' };
  if (rawNote.length > 500) return { ok: false, error: 'Note must be 500 characters or fewer.' };
  const city = clean(rawCity, 80);
  const venue = clean(rawVenue, 160);
  const note = rawNote;
  if (!UUID_RE.test(introductionId)) return { ok: false, error: 'Choose a valid accepted introduction.' };
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(scheduledFor)) return { ok: false, error: 'Choose a date and time with a valid timezone.' };
  const timestamp = Date.parse(scheduledFor);
  if (!Number.isFinite(timestamp)) return { ok: false, error: 'Choose a valid date and time.' };
  if (timestamp < now + 30 * 60 * 1000) return { ok: false, error: 'Choose a date at least 30 minutes from now.' };
  if (timestamp > now + 90 * 24 * 60 * 60 * 1000) return { ok: false, error: 'Date proposals can be made up to 90 days ahead.' };
  if (city.length < 2) return { ok: false, error: 'Enter the city for your date.' };
  if (venue.length > 160) return { ok: false, error: 'Venue must be 160 characters or fewer.' };
  if (note.length > 500) return { ok: false, error: 'Note must be 500 characters or fewer.' };
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(`${city}${venue}${note}`)) return { ok: false, error: 'Date details contain unsupported characters.' };
  return { ok: true, proposal: { introductionId, scheduledFor: new Date(timestamp).toISOString(), city, venue, note } };
}

export function normalizeDateAction(body) {
  const planId = typeof body?.planId === 'string' ? body.planId.trim() : '';
  const action = body?.action;
  if (!UUID_RE.test(planId)) return { ok: false, error: 'Choose a valid date proposal.' };
  if (!['accept', 'decline', 'cancel', 'complete'].includes(action)) return { ok: false, error: 'Choose a valid date action.' };
  return { ok: true, planId, action };
}
