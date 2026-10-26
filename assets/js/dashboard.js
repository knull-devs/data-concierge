(() => {
  'use strict';
  const loading = document.getElementById('dashboard-loading');
  const content = document.getElementById('dashboard-content');
  const errorBox = document.getElementById('dashboard-error');
  const nameTarget = document.getElementById('member-name');
  const logoutButton = document.getElementById('logout-button');
  const showError = (message) => { loading.hidden = true; errorBox.textContent = message; errorBox.hidden = false; };
  fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(async response => ({ response, data: await response.json().catch(() => ({})) }))
    .then(({ response, data }) => {
      if (response.status === 401 || !data.authenticated) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) throw new Error(data.error || 'Authentication service is not available.');
      nameTarget.textContent = data.user.name.split(' ')[0];
      loading.hidden = true; content.hidden = false;
      // Profile setup is an optional module; a missing profile migration must not
      // block the existing authenticated dashboard from loading.
      fetch('/api/profile/me', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
        .then(async response => ({ response, data: await response.json().catch(() => ({})) }))
        .then(({ response, data: profileData }) => {
          if (response.status === 401) { window.location.replace('/?auth=login'); return; }
          if (!response.ok) throw new Error(profileData.error || 'Profile progress is not available yet.');
          const percent = Math.max(0, Math.min(100, Number(profileData.completion?.percent) || 0));
          const percentTarget = document.getElementById('dashboard-profile-percent');
          const progressTarget = document.getElementById('dashboard-profile-progress');
          const summaryTarget = document.getElementById('profile-summary');
          if (percentTarget) percentTarget.textContent = `${percent}%`;
          if (progressTarget) progressTarget.value = percent;
          if (summaryTarget) summaryTarget.textContent = percent >= 100
            ? 'Your core profile details are complete. You can update them whenever you like.'
            : 'Add relationship goals and preferences to shape your Date Concierge profile.';
        })
        .catch(profileError => {
          const summaryTarget = document.getElementById('profile-summary');
          if (summaryTarget) summaryTarget.textContent = 'Profile setup needs one database migration before it can be saved.';
          console.warn('Profile progress unavailable:', profileError.message);
        });
    })
    .catch(error => showError(error.message || 'Could not load your account. Please try again.'));
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true; logoutButton.textContent = 'Logging out…';
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } }); }
    finally { window.location.replace('/'); }
  });
})();
