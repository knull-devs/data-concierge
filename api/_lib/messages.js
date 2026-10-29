export const INTRODUCTION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_MESSAGE_LENGTH = 2000;

export function normalizeMessage(value) {
  if (typeof value !== 'string') return { ok: false, error: 'Write a message before sending.' };
  const message = value.replace(/\r\n?/g, '\n').trim();
  if (!message) return { ok: false, error: 'Write a message before sending.' };
  if (message.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) return { ok: false, error: 'Message contains unsupported control characters.' };
  return { ok: true, message };
}

export function isValidIntroductionId(value) {
  return typeof value === 'string' && INTRODUCTION_ID_RE.test(value.trim());
}
