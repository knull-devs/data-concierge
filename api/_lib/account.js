export function normalizeAccountInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send valid account details.' };
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().replace(/\s+/g, ' ') : '';
  const city = typeof body.city === 'string' ? body.city.trim().replace(/\s+/g, ' ') : '';
  if (displayName.length < 2 || displayName.length > 80) return { ok: false, error: 'Name must be between 2 and 80 characters.' };
  if (/[\u0000-\u001f\u007f]/.test(displayName)) return { ok: false, error: 'Name contains unsupported characters.' };
  if (city.length < 2 || city.length > 80) return { ok: false, error: 'City must be between 2 and 80 characters.' };
  if (/[\u0000-\u001f\u007f]/.test(city)) return { ok: false, error: 'City contains unsupported characters.' };
  return { ok: true, account: { displayName, city } };
}

export function validatePasswordChange(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Send valid password details.' };
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || currentPassword.length > 128) return { ok: false, error: 'Enter your current password.' };
  if (newPassword.length < 10 || newPassword.length > 128) return { ok: false, error: 'Use a new password between 10 and 128 characters.' };
  if (currentPassword === newPassword) return { ok: false, error: 'Your new password must be different from your current password.' };
  return { ok: true, currentPassword, newPassword, remember: body.remember === true };
}
