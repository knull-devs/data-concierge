(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  let accountLoaded = false;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.replace('/?auth=login'); throw new Error('Your session has expired.'); }
    return { response, data };
  }
  function status(id, message, success = false) {
    const box = byId(id); if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
    box.classList.toggle('is-success', Boolean(message && success));
  }
  function initials(name) { return String(name || 'Member').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '♡'; }
  function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
  function showPageError(message) { const el = byId('account-page-error'); el.textContent = message; el.hidden = false; }

  async function loadAccount() {
    const loading = byId('account-loading');
    try {
      const auth = await api('/api/auth/me');
      if (!auth.response.ok || !auth.data.authenticated) { window.location.replace('/?auth=login'); return; }
      const result = await api('/api/account/me');
      if (!result.response.ok) throw new Error(result.data.error || 'Account details could not be loaded.');
      const a = result.data.account || {};
      byId('account-name').value = a.displayName || auth.data.user?.name || '';
      byId('account-city').value = a.city || auth.data.user?.city || '';
      byId('account-email').value = a.email || auth.data.user?.email || '';
      byId('account-birth-date').value = a.birthDate ? dateLabel(`${a.birthDate}T00:00:00Z`) : '—';
      byId('account-created').textContent = dateLabel(a.createdAt);
      accountLoaded = true;
      byId('account-content').hidden = false;
    } catch (error) { showPageError(error.message || 'Could not load account settings.'); }
    finally { if (loading) loading.hidden = true; }
  }

  byId('account-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!accountLoaded) return;
    const button = byId('account-save');
    const name = byId('account-name').value.trim();
    const city = byId('account-city').value.trim();
    status('account-form-status', '');
    if (name.length < 2 || name.length > 80) { status('account-form-status', 'Name must be between 2 and 80 characters.'); return; }
    if (city.length < 2 || city.length > 80) { status('account-form-status', 'City must be between 2 and 80 characters.'); return; }
    button.disabled = true; button.textContent = 'Saving…';
    try {
      const result = await api('/api/account/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name, city }) });
      if (!result.response.ok) throw new Error(result.data.error || 'Changes could not be saved.');
      const account = result.data.account;
      byId('account-name').value = account.displayName;
      byId('account-city').value = account.city;
      status('account-form-status', result.data.notice || 'Your account details have been saved.', !result.data.notice);
    } catch (error) { status('account-form-status', error.message || 'Please try again.'); }
    finally { button.disabled = false; button.innerHTML = 'Save changes <span aria-hidden="true">→</span>'; }
  });

  byId('password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = form.elements.currentPassword.value;
    const newPassword = form.elements.newPassword.value;
    const confirmPassword = form.elements.confirmPassword.value;
    const button = byId('password-save');
    status('password-form-status', '');
    if (newPassword.length < 10 || newPassword.length > 128) { status('password-form-status', 'Use a new password between 10 and 128 characters.'); return; }
    if (newPassword !== confirmPassword) { status('password-form-status', 'The new passwords do not match.'); return; }
    button.disabled = true; button.textContent = 'Updating…';
    try {
      const result = await api('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword, remember: true }) });
      if (!result.response.ok) throw new Error(result.data.error || 'Password could not be changed.');
      form.reset();
      status('password-form-status', result.data.message || 'Password updated successfully.', true);
    } catch (error) { status('password-form-status', error.message || 'Please try again.'); }
    finally { button.disabled = false; button.innerHTML = 'Update password <span aria-hidden="true">→</span>'; }
  });

  async function logout() {
    const button = byId('account-logout'); button.disabled = true;
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }); }
    finally { window.location.replace('/'); }
  }
  byId('account-logout').addEventListener('click', logout);
  loadAccount();
})();
