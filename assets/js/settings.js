(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const keys = { inAppNotifications: 'setting-in-app', introductionUpdates: 'setting-intros', messageUpdates: 'setting-messages', dateUpdates: 'setting-dates', discoverable: 'setting-discoverable' };
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.replace('/?auth=login'); throw new Error('Your session has expired. Please sign in again.'); }
    return { response, data };
  }
  function error(message) { const box = byId('settings-error'); box.textContent = message || 'Settings could not be loaded.'; box.hidden = false; byId('settings-status').hidden = true; }
  function status(message) { const box = byId('settings-status'); box.textContent = message; box.hidden = false; byId('settings-error').hidden = true; }
  function readForm() { return Object.fromEntries(Object.entries(keys).map(([key, id]) => [key, byId(id).checked])); }
  function syncCategorySwitches() { const disabled = !byId('setting-in-app').checked; ['setting-intros', 'setting-messages', 'setting-dates'].forEach(id => { byId(id).disabled = disabled; }); }
  function fill(settings) { Object.entries(keys).forEach(([key, id]) => { byId(id).checked = settings?.[key] === true; }); syncCategorySwitches(); }
  async function load() {
    try {
      const { response, data } = await request('/api/settings');
      if (!response.ok) throw new Error(data.error || 'Settings could not be loaded.');
      fill(data.settings || {});
      byId('settings-loading').hidden = true; byId('settings-form').hidden = false;
    } catch (err) { byId('settings-loading').hidden = true; error(err.message); }
  }
  byId('settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = byId('settings-save'); const snapshot = readForm();
    button.disabled = true; button.textContent = 'Saving…';
    try {
      const { response, data } = await request('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
      if (!response.ok) throw new Error(data.error || 'Settings could not be saved.');
      fill(data.settings || snapshot);
      status('Your preferences have been saved.');
    } catch (err) { error(err.message); }
    finally { button.disabled = false; button.textContent = 'Save settings ↗'; }
  });
  // Turning off the master switch dims category switches but retains the saved choices.
  byId('setting-in-app').addEventListener('change', () => {
    syncCategorySwitches();
  });
  load();
})();
