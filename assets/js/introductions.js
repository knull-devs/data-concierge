(() => {
  'use strict';
  const loading = document.getElementById('intro-loading');
  const error = document.getElementById('intro-error');
  const empty = document.getElementById('intro-empty');
  const list = document.getElementById('intro-request-list');
  const statusLabels = { pending: 'Awaiting response', accepted: 'Accepted by both', declined: 'Declined' };
  const textNode = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; el.textContent = text || ''; return el; };

  function renderRequest(item) {
    const card = document.createElement('article');
    card.className = 'intro-request-card';
    const person = document.createElement('div');
    person.className = 'intro-request-person';
    person.append(textNode('h3', '', [item.member?.name || 'Date Concierge member', Number.isInteger(item.member?.age) ? item.member.age : null].filter(Boolean).join(', ')));
    person.append(textNode('p', '', item.member?.city || 'India'));
    if (item.member?.headline) person.append(textNode('p', '', item.member.headline));
    if (item.member?.aboutMe) person.append(textNode('p', '', item.member.aboutMe));
    const status = textNode('span', 'intro-request-status', statusLabels[item.status] || item.status || 'Pending');
    person.append(status);
    const actions = document.createElement('div');
    actions.className = 'intro-request-actions';
    if (item.status === 'pending' && item.direction === 'received') {
      for (const [action, label] of [['decline', 'Decline'], ['accept', 'Accept introduction']]) {
        const button = textNode('button', '', label);
        button.type = 'button';
        button.dataset.action = action;
        button.addEventListener('click', () => respond(item.id, action, button, status));
        actions.append(button);
      }
    } else if (item.status === 'pending') {
      actions.append(textNode('span', 'intro-request-status', 'Sent by you'));
    } else if (item.status === 'accepted') {
      actions.append(textNode('span', 'intro-request-status', 'Messaging coming next'));
    }
    card.append(person, actions);
    return card;
  }

  async function respond(requestId, action, button, statusLabel) {
    const group = button.parentElement;
    group.querySelectorAll('button').forEach(item => { item.disabled = true; });
    button.textContent = action === 'accept' ? 'Accepting…' : 'Declining…';
    try {
      const response = await fetch('/api/introductions', {
        method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ requestId, action })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) throw new Error(data.error || 'Could not update this introduction.');
      statusLabel.textContent = data.status === 'accepted' ? statusLabels.accepted : statusLabels.declined;
      group.replaceChildren(textNode('span', 'intro-request-status', data.status === 'accepted' ? 'Messaging coming next' : 'Request declined'));
    } catch (e) {
      const note = textNode('p', 'match-card-status', e.message || 'Please try again.');
      group.append(note);
      group.querySelectorAll('button').forEach(item => { item.disabled = false; if (item.dataset.action === 'accept') item.textContent = 'Accept introduction'; else item.textContent = 'Decline'; });
    }
  }

  async function load() {
    try {
      const response = await fetch('/api/introductions', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) throw new Error(data.error || 'Your introductions could not be loaded.');
      loading.hidden = true;
      const requests = Array.isArray(data.requests) ? data.requests : [];
      if (!requests.length) { empty.hidden = false; return; }
      list.replaceChildren(...requests.map(renderRequest));
      list.hidden = false;
    } catch (e) {
      loading.hidden = true;
      error.textContent = e.message || 'Your introductions could not be loaded.';
      error.hidden = false;
    }
  }
  load();
})();
