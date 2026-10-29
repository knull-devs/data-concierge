(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const text = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null ? '' : String(value);
    return node;
  };
  const safeInitials = name => String(name || 'Member').trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase() || '♡';
  const statusText = status => ({ pending: 'Awaiting response', accepted: 'Accepted by both', declined: 'Declined' }[status] || 'Request updated');
  let currentUser = null;

  async function requestJson(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      credentials: options.credentials || 'same-origin',
      cache: options.cache || 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/?auth=login');
      throw new Error('Your session has expired. Please sign in again.');
    }
    return { response, data };
  }

  function renderGlobalError(message) {
    const loading = byId('dashboard-loading');
    const content = byId('dashboard-content');
    const box = byId('dashboard-error');
    if (loading) loading.hidden = true;
    if (content) content.hidden = true;
    if (box) {
      box.textContent = message || 'Your dashboard could not be loaded. Please refresh and try again.';
      box.hidden = false;
    }
  }

  function updateMember(user) {
    currentUser = user;
    const name = user?.name || user?.displayName || user?.display_name || 'Member';
    const firstName = name.trim().split(/\s+/)[0] || 'Member';
    if (byId('member-name')) byId('member-name').textContent = firstName;
    if (byId('member-full-name')) byId('member-full-name').textContent = name;
    if (byId('profile-card-name')) byId('profile-card-name').textContent = name;
    const initials = safeInitials(name);
    ['member-avatar', 'member-avatar-large'].forEach(id => { if (byId(id)) byId(id).textContent = initials; });
  }

  function updateProfile(profileData) {
    const percent = Math.max(0, Math.min(100, Number(profileData?.completion?.percent) || 0));
    if (byId('stat-profile-percent')) byId('stat-profile-percent').textContent = `${percent}%`;
    if (byId('dashboard-profile-percent')) byId('dashboard-profile-percent').textContent = `${percent}%`;
    if (byId('dashboard-progress-ring')) byId('dashboard-progress-ring').style.setProperty('--dc-progress', `${percent}%`);
    const summary = percent >= 100
      ? 'Your core profile details are in place. Keep it current whenever your intentions change.'
      : percent >= 60
        ? 'You are making progress. Add the remaining details to help clarify what matters to you.'
        : 'Add relationship goals and preferences to shape your introductions.';
    if (byId('profile-summary')) byId('profile-summary').textContent = summary;
  }

  function avatarFor(name, avatarUrl) {
    const visual = text('div', 'dc-match-visual', '');
    if (typeof avatarUrl === 'string' && avatarUrl) {
      try {
        const url = new URL(avatarUrl, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
          const image = document.createElement('img');
          image.src = url.href;
          image.alt = '';
          image.loading = 'lazy';
          image.decoding = 'async';
          image.referrerPolicy = 'same-origin';
          image.addEventListener('error', () => {
            image.remove();
            const monogram = text('span', 'dc-match-monogram', safeInitials(name).slice(0, 1));
            visual.append(monogram);
            visual.classList.remove('has-photo');
          }, { once: true });
          visual.append(image);
          visual.classList.add('has-photo');
        }
      } catch { /* Use the safe monogram fallback below. */ }
    }
    if (!visual.querySelector('img')) visual.append(text('span', 'dc-match-monogram', safeInitials(name).slice(0, 1)));
    return visual;
  }

  function renderMatch(match) {
    const card = text('article', 'dc-match-card', '');
    const name = String(match.name || 'Date Concierge member');
    const age = Number.isInteger(match.age) ? `, ${match.age}` : '';
    card.append(avatarFor(name, match.avatarUrl));
    const visual = card.querySelector('.dc-match-visual');
    if (Number.isFinite(Number(match.matchScore))) {
      const fit = text('span', 'dc-fit-chip', `${Math.max(0, Math.min(100, Number(match.matchScore)))}% profile fit`);
      visual.append(fit);
    }
    const body = text('div', 'dc-match-body', '');
    body.append(text('h3', '', `${name}${age}`));
    body.append(text('p', 'dc-match-city', match.city || 'Location not shared'));
    if (match.headline) body.append(text('p', 'dc-match-headline', match.headline));
    const interests = Array.isArray(match.interests) ? match.interests.slice(0, 3) : [];
    const labels = {
      coffee_and_cafes: 'Cafés', travel: 'Travel', reading: 'Books', live_music: 'Live music',
      cooking: 'Cooking', food_culture: 'Food', art_and_design: 'Art', fitness: 'Fitness',
      hiking_outdoors: 'Outdoors', movies_and_series: 'Movies', pets: 'Pets', volunteering: 'Volunteering',
      photography: 'Photography', cricket_and_sports: 'Sports', board_games: 'Board games', gardening: 'Gardening'
    };
    if (interests.length) {
      const tags = text('div', 'dc-match-tags', '');
      interests.forEach(value => { if (labels[value]) tags.append(text('span', '', labels[value])); });
      if (tags.childElementCount) body.append(tags);
    }
    const action = text('div', 'dc-match-action', '');
    const button = text('button', 'dc-request-button', 'Request introduction ↗');
    button.type = 'button';
    const status = text('p', 'dc-request-status', '');
    status.hidden = true;
    button.addEventListener('click', () => sendIntroduction(match.candidateId, button, status));
    action.append(button, status);
    body.append(action);
    card.append(body);
    return card;
  }

  async function sendIntroduction(candidateId, button, statusTarget) {
    if (!candidateId) return;
    button.disabled = true;
    button.textContent = 'Sending…';
    statusTarget.hidden = true;
    try {
      const { response, data } = await requestJson('/api/introductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId })
      });
      if (!response.ok) throw new Error(data.error || 'This introduction could not be requested.');
      button.textContent = data.status === 'accepted' ? 'Introduction accepted' : 'Request sent';
      statusTarget.textContent = data.message || 'Your request has been saved.';
      statusTarget.hidden = false;
      await loadIntroductions();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Request introduction ↗';
      statusTarget.textContent = error.message || 'Please try again.';
      statusTarget.hidden = false;
    }
  }

  async function loadRecommendations() {
    const loading = byId('dashboard-recommendations-loading');
    const errorBox = byId('dashboard-recommendations-error');
    const empty = byId('dashboard-recommendations-empty');
    const grid = byId('dashboard-recommendations');
    const note = byId('dashboard-recommendation-note');
    try {
      const { response, data } = await requestJson('/api/matches/recommendations', { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        loading.hidden = true;
        errorBox.replaceChildren(document.createTextNode(data.error || 'Recommendations could not be loaded.'));
        if (data.code === 'DISCOVERY_DISABLED' || data.code === 'PROFILE_INCOMPLETE') {
          const link = text('a', 'dc-state-link', 'Update my profile ↗');
          link.href = '/profile.html';
          errorBox.append(document.createElement('br'), link);
        }
        errorBox.hidden = false;
        if (byId('stat-suggestions')) byId('stat-suggestions').textContent = '—';
        return;
      }
      loading.hidden = true;
      const matches = Array.isArray(data.matches) ? data.matches : [];
      if (byId('stat-suggestions')) byId('stat-suggestions').textContent = String(matches.length);
      const sideCount = byId('side-match-count');
      if (sideCount) {
        sideCount.textContent = String(matches.length);
        sideCount.hidden = matches.length < 1;
      }
      if (!matches.length) { empty.hidden = false; return; }
      grid.replaceChildren(...matches.map(renderMatch));
      grid.hidden = false;
      note.hidden = false;
    } catch (error) {
      if (loading) loading.hidden = true;
      if (errorBox) { errorBox.textContent = error.message || 'Recommendations could not be loaded.'; errorBox.hidden = false; }
    }
  }

  async function loadIntroductions() {
    const loading = byId('dashboard-intro-loading');
    const errorBox = byId('dashboard-intro-error');
    const empty = byId('dashboard-intro-empty');
    const list = byId('dashboard-introductions-list');
    try {
      const { response, data } = await requestJson('/api/introductions', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(data.error || 'Your introductions could not be loaded.');
      if (loading) loading.hidden = true;
      const requests = Array.isArray(data.requests) ? data.requests : [];
      const pending = requests.filter(item => item.status === 'pending').length;
      if (byId('stat-introductions')) byId('stat-introductions').textContent = String(requests.length);
      const sideCount = byId('side-intro-count');
      if (sideCount) {
        sideCount.textContent = String(pending);
        sideCount.hidden = pending < 1;
      }
      if (!requests.length) { empty.hidden = false; list.hidden = true; return; }
      list.replaceChildren(...requests.slice(0, 3).map(renderIntroduction));
      list.hidden = false;
      empty.hidden = true;
    } catch (error) {
      if (loading) loading.hidden = true;
      if (errorBox) { errorBox.textContent = error.message || 'Your introductions could not be loaded.'; errorBox.hidden = false; }
    }
  }

  function renderIntroduction(item) {
    const row = text('article', 'dc-intro-row', '');
    const person = item.member || {};
    row.append(text('span', 'dc-intro-avatar', safeInitials(person.name).slice(0, 1)));
    const copy = text('div', 'dc-intro-copy', '');
    copy.append(text('strong', '', `${person.name || 'Date Concierge member'}${Number.isInteger(person.age) ? `, ${person.age}` : ''}`));
    let context = item.direction === 'received' ? 'Introduction request received' : 'Introduction request sent';
    if (person.city) context += ` · ${person.city}`;
    copy.append(text('span', '', context));
    const pill = text('span', `dc-status-pill${item.status === 'accepted' ? ' is-accepted' : item.status === 'declined' ? ' is-declined' : ''}`, statusText(item.status));
    row.append(copy, pill);
    return row;
  }

  async function loadProfile() {
    try {
      const { response, data } = await requestJson('/api/profile/me', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(data.error || 'Profile progress is not available yet.');
      updateProfile(data);
    } catch (error) {
      if (byId('profile-summary')) byId('profile-summary').textContent = 'Profile progress will appear once profile setup is complete.';
      if (byId('dashboard-profile-percent')) byId('dashboard-profile-percent').textContent = '—';
      if (byId('stat-profile-percent')) byId('stat-profile-percent').textContent = '—';
      console.info('Profile progress unavailable:', error.message);
    }
  }

  async function boot() {
    const loading = byId('dashboard-loading');
    const content = byId('dashboard-content');
    try {
      const { response, data } = await requestJson('/api/auth/me', { headers: { Accept: 'application/json' } });
      if (response.status === 401) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) throw new Error(data.error || 'Authentication service is not available.');
      if (!data.authenticated) { window.location.replace('/?auth=login'); return; }
      updateMember(data.user || {});
      if (loading) loading.hidden = true;
      if (content) content.hidden = false;
      await Promise.allSettled([loadProfile(), loadRecommendations(), loadIntroductions()]);
    } catch (error) {
      if (error.message === 'Your session has expired. Please sign in again.') return;
      renderGlobalError(error.message || 'Could not load your account. Please refresh and try again.');
    }
  }

  const logoutButton = byId('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;
      logoutButton.setAttribute('aria-busy', 'true');
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      } finally {
        window.location.replace('/');
      }
    });
  }

  boot();
})();
