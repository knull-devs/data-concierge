(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const state = { items: [], filter: 'all', unreadCount: 0 };
  const categoryMeta = {
    introduction: { label: 'Introduction', icon: '♡' },
    message: { label: 'Message', icon: '▱' },
    date_plan: { label: 'Date plan', icon: '✧' },
    security: { label: 'Security', icon: '◇' },
    system: { label: 'Update', icon: '✦' }
  };
  const safeHref = value => {
    if (typeof value !== 'string') return '/dashboard.html';
    try { const url = new URL(value, window.location.origin); return url.origin === window.location.origin && url.pathname.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : '/dashboard.html'; }
    catch { return '/dashboard.html'; }
  };
  const elem = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value != null) node.textContent = String(value); return node; };
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.replace('/?auth=login'); throw new Error('Your session has expired. Please sign in again.'); }
    return { response, data };
  }
  function dateLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Just now';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  function showError(message) { const box = byId('notifications-error'); box.textContent = message || 'Notifications could not be loaded.'; box.hidden = false; }
  function updateCount() {
    byId('notifications-unread-count').textContent = `${state.unreadCount} unread`;
  }
  async function markRead(id) {
    const { response, data } = await request('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markRead', id }) });
    if (!response.ok) throw new Error(data.error || 'This notification could not be marked as read.');
    const item = state.items.find(entry => entry.id === id);
    if (item && !item.readAt) { item.readAt = data.notification?.read_at || new Date().toISOString(); item.unread = false; }
    state.unreadCount = Number(data.unreadCount || 0);
    updateCount(); render();
  }
  function render() {
    const list = byId('notifications-list');
    const empty = byId('notifications-empty');
    const items = state.items.filter(item => state.filter !== 'unread' || item.unread);
    list.replaceChildren();
    if (!items.length) {
      list.hidden = true;
      empty.hidden = false;
      empty.querySelector('strong').textContent = state.filter === 'unread' ? 'No unread updates.' : 'All caught up.';
      empty.querySelector('p').textContent = state.filter === 'unread' ? 'You have read all of your notifications.' : 'When someone requests an introduction, sends a message or responds to a date proposal, the update will appear here.';
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    items.forEach(item => {
      const card = elem('article', `mt-notification${item.unread ? ' is-unread' : ''}`);
      const meta = categoryMeta[item.category] || categoryMeta.system;
      card.append(elem('div', 'mt-notification-icon', meta.icon));
      const content = elem('div', 'mt-notification-content');
      const title = elem('h2', 'mt-notification-title');
      const link = elem('a', '', item.title || 'Date Concierge update');
      link.href = safeHref(item.href);
      link.addEventListener('click', async event => {
        if (!item.unread) return;
        event.preventDefault();
        try { await markRead(item.id); } catch { /* Navigation should still work if marking read fails. */ }
        window.location.href = safeHref(item.href);
      });
      title.append(link);
      content.append(title, elem('p', 'mt-notification-body', item.body || 'There is an update in your Date Concierge space.'));
      const metaRow = elem('div', 'mt-notification-meta');
      metaRow.append(elem('span', 'mt-category', meta.label), elem('time', 'mt-notification-time', dateLabel(item.createdAt)));
      if (item.unread) metaRow.append(elem('span', 'mt-category', 'Unread'));
      content.append(metaRow);
      const actions = elem('div', 'mt-notification-actions');
      const view = elem('a', 'mt-text-link', 'View ↗'); view.href = safeHref(item.href);
      view.addEventListener('click', async event => {
        if (!item.unread) return;
        event.preventDefault();
        try { await markRead(item.id); } catch { /* Continue to destination. */ }
        window.location.href = safeHref(item.href);
      });
      actions.append(view);
      if (item.unread) {
        const button = elem('button', 'mt-text-link', 'Mark read'); button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try { await markRead(item.id); } catch (error) { button.disabled = false; showError(error.message); }
        });
        actions.append(button);
      }
      card.append(content, actions);
      list.append(card);
    });
  }
  async function load() {
    byId('notifications-loading').hidden = false;
    byId('notifications-list').hidden = true;
    byId('notifications-empty').hidden = true;
    try {
      const { response, data } = await request('/api/notifications');
      if (!response.ok) throw new Error(data.error || 'Notifications could not be loaded.');
      state.items = Array.isArray(data.notifications) ? data.notifications.map(item => ({ ...item, href: safeHref(item.href), unread: item.unread === true })) : [];
      state.unreadCount = Number(data.unreadCount || 0);
      updateCount();
      byId('notifications-loading').hidden = true;
      render();
    } catch (error) { byId('notifications-loading').hidden = true; showError(error.message); }
  }
  byId('notifications-mark-all').addEventListener('click', async () => {
    const button = byId('notifications-mark-all'); button.disabled = true;
    try {
      const { response, data } = await request('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markAllRead' }) });
      if (!response.ok) throw new Error(data.error || 'Notifications could not be updated.');
      state.items.forEach(item => { item.unread = false; item.readAt = new Date().toISOString(); });
      state.unreadCount = 0; updateCount(); render();
      byId('notifications-status').textContent = 'All notifications marked as read.'; byId('notifications-status').hidden = false; byId('notifications-error').hidden = true;
    } catch (error) { showError(error.message); }
    finally { button.disabled = false; }
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(entry => entry.setAttribute('aria-pressed', String(entry === button)));
    render();
  }));
  load();
})();
