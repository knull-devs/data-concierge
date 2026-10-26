(() => {
  'use strict';
  const loading = document.getElementById('discovery-loading');
  const errorBox = document.getElementById('discovery-error');
  const empty = document.getElementById('discovery-empty');
  const grid = document.getElementById('discovery-grid');
  const scoreNote = document.getElementById('discovery-score-note');
  const interestsLabel = {
    coffee_and_cafes: 'Cafés & coffee', travel: 'Travel', reading: 'Books & reading', live_music: 'Live music',
    cooking: 'Cooking', food_culture: 'Food culture', art_and_design: 'Art & design', fitness: 'Fitness',
    hiking_outdoors: 'Hiking & outdoors', movies_and_series: 'Movies & series', pets: 'Pets', volunteering: 'Volunteering',
    photography: 'Photography', cricket_and_sports: 'Cricket & sports', board_games: 'Board games', gardening: 'Gardening'
  };
  const statusBox = (message, kind = '') => {
    const status = document.createElement('p');
    status.className = `match-card-status${kind ? ` is-${kind}` : ''}`;
    status.textContent = message;
    return status;
  };
  const textNode = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text || '';
    return el;
  };
  function showError(message, code) {
    loading.hidden = true;
    grid.hidden = true;
    empty.hidden = true;
    errorBox.replaceChildren();
    errorBox.append(document.createTextNode(message));
    if (code === 'DISCOVERY_DISABLED' || code === 'PROFILE_INCOMPLETE') {
      const link = document.createElement('a');
      link.className = 'button button-primary discovery-error-action';
      link.href = '/profile.html';
      link.textContent = 'Update my profile ↗';
      errorBox.append(document.createElement('br'), link);
    }
    errorBox.hidden = false;
  }

  async function requestIntroduction(candidateId, button, statusTarget) {
    button.disabled = true;
    button.textContent = 'Sending…';
    statusTarget.textContent = '';
    try {
      const response = await fetch('/api/introductions', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ candidateId })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) throw new Error(data.error || 'This introduction could not be requested.');
      button.textContent = data.status === 'accepted' ? 'Introduction accepted' : 'Request sent';
      statusTarget.textContent = data.message || 'Your introduction request is saved.';
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Request introduction ↗';
      statusTarget.textContent = error.message || 'Please try again.';
    }
  }

  function cardFor(match) {
    const card = document.createElement('article');
    card.className = 'match-card';
    const top = document.createElement('div');
    top.className = 'match-card-top';
    const avatar = document.createElement('div');
    avatar.className = 'match-card-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    if (typeof match.avatarUrl === 'string' && match.avatarUrl) {
      try {
        const url = new URL(match.avatarUrl, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
          const image = document.createElement('img');
          image.src = url.href;
          image.alt = '';
          image.loading = 'lazy';
          avatar.append(image);
        } else avatar.textContent = String(match.name || '?').trim().charAt(0).toUpperCase() || '♡';
      } catch { avatar.textContent = '♡'; }
    } else avatar.textContent = String(match.name || '?').trim().charAt(0).toUpperCase() || '♡';

    const person = document.createElement('div');
    person.className = 'match-card-person';
    person.append(textNode('h3', '', [match.name, Number.isInteger(match.age) ? match.age : null].filter(Boolean).join(', ')));
    person.append(textNode('p', 'match-card-meta', match.city || 'India'));
    const fit = document.createElement('div');
    fit.className = 'match-fit';
    fit.append(textNode('strong', '', `${Math.max(0, Math.min(100, Number(match.matchScore) || 0))}%`));
    fit.append(textNode('span', '', 'profile fit'));
    top.append(avatar, person, fit);
    card.append(top);
    if (match.headline) card.append(textNode('h4', 'match-card-headline', match.headline));
    if (match.aboutMe) card.append(textNode('p', 'match-card-about', match.aboutMe));

    const reasons = document.createElement('div');
    reasons.className = 'match-reasons';
    (Array.isArray(match.reasons) ? match.reasons : []).forEach(reason => reasons.append(textNode('span', 'match-reason', reason)));
    if (reasons.childElementCount) card.append(reasons);

    const interests = document.createElement('div');
    interests.className = 'match-interests';
    (Array.isArray(match.interests) ? match.interests : []).slice(0, 5).forEach(value => {
      if (interestsLabel[value]) interests.append(textNode('span', 'match-interest', interestsLabel[value]));
    });
    if (interests.childElementCount) card.append(interests);

    const actions = document.createElement('div');
    actions.className = 'match-card-actions';
    const button = textNode('button', 'match-request-button', 'Request introduction ↗');
    button.type = 'button';
    const status = statusBox('');
    status.hidden = true;
    button.addEventListener('click', async () => {
      status.hidden = false;
      await requestIntroduction(match.candidateId, button, status);
    });
    actions.append(button, status);
    card.append(actions);
    return card;
  }

  async function load() {
    try {
      const response = await fetch('/api/matches/recommendations', {
        credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) throw Object.assign(new Error(data.error || 'Recommendations are not available yet.'), { code: data.code });
      loading.hidden = true;
      const matches = Array.isArray(data.matches) ? data.matches : [];
      if (!matches.length) { empty.hidden = false; return; }
      grid.replaceChildren(...matches.map(cardFor));
      grid.hidden = false;
      scoreNote.hidden = false;
    } catch (error) {
      showError(error.message || 'Recommendations could not be loaded. Please try again.', error.code);
    }
  }
  load();
})();
