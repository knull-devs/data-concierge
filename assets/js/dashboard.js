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
    })
    .catch(error => showError(error.message || 'Could not load your account. Please try again.'));
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true; logoutButton.textContent = 'Logging out…';
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } }); }
    finally { window.location.replace('/'); }
  });
})();
