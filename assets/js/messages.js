(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const state = { conversations: [], selectedId: '', selectedMember: null, messages: [], loadingThread: false };
  const escapeDate = value => value ? new Date(value) : null;

  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined && value !== null) element.textContent = String(value);
    return element;
  }
  function initials(name) { return String(name || 'Member').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '♡'; }
  function timeLabel(value) {
    const date = escapeDate(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    const delta = Date.now() - date.getTime();
    if (delta < 60_000) return 'now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date);
  }
  function dateLabel(value) {
    const date = escapeDate(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.replace('/?auth=login'); throw new Error('Your session has expired.'); }
    return { response, data };
  }
  function pageError(message) { const box = byId('messages-page-error'); box.textContent = message; box.hidden = !message; }
  function threadError(message) { const box = byId('thread-error'); box.textContent = message || ''; box.hidden = !message; }

  function avatar(name, src) {
    const el = node('span', 'dcm-person-avatar', initials(name).slice(0, 2));
    if (typeof src === 'string' && src) {
      try {
        const url = new URL(src, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
          const img = document.createElement('img'); img.src = url.href; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
          img.addEventListener('error', () => { img.remove(); el.textContent = initials(name).slice(0, 2); }, { once: true });
          el.textContent = ''; el.append(img);
        }
      } catch { /* Keep initials when avatar URL is not a safe same-origin path. */ }
    }
    return el;
  }

  function renderConversation(conversation) {
    const button = node('button', `dcm-conversation${conversation.introductionId === state.selectedId ? ' is-selected' : ''}`);
    button.type = 'button'; button.dataset.introductionId = conversation.introductionId;
    button.append(avatar(conversation.member?.name, conversation.member?.avatarUrl));
    const copy = node('span', 'dcm-conversation-copy');
    const top = node('span', 'dcm-conversation-top');
    top.append(node('strong', '', conversation.member?.name || 'Date Concierge member'), node('span', 'dcm-conversation-time', timeLabel(conversation.lastMessageAt || conversation.startedAt)));
    const previewText = conversation.lastMessage ? `${conversation.lastMessageFromMe ? 'You: ' : ''}${conversation.lastMessage}` : 'Your introduction is accepted. Say hello when you’re ready.';
    copy.append(top, node('span', 'dcm-conversation-preview', previewText));
    button.append(copy);
    if (Number(conversation.unreadCount) > 0) button.append(node('span', 'dcm-unread-count', Math.min(99, Number(conversation.unreadCount))));
    button.addEventListener('click', () => openConversation(conversation.introductionId, true));
    return button;
  }

  function renderConversationList() {
    const list = byId('conversation-list');
    const empty = byId('conversation-list-empty');
    const searchTerm = byId('conversation-search').value.trim().toLocaleLowerCase();
    const filtered = state.conversations.filter(c => String(c.member?.name || '').toLocaleLowerCase().includes(searchTerm) || String(c.lastMessage || '').toLocaleLowerCase().includes(searchTerm));
    if (!state.conversations.length) {
      list.hidden = true; empty.hidden = false; byId('conversation-count').textContent = 'No active conversations yet'; return;
    }
    empty.hidden = true;
    if (!filtered.length) {
      list.replaceChildren(node('p', 'dcm-list-state', 'No conversations match that search.'));
      list.hidden = false; byId('conversation-count').textContent = 'No search results'; return;
    }
    list.replaceChildren(...filtered.map(renderConversation));
    list.hidden = false;
    byId('conversation-count').textContent = `${state.conversations.length} accepted ${state.conversations.length === 1 ? 'introduction' : 'introductions'}`;
  }

  async function loadConversations() {
    const loading = byId('conversation-list-loading');
    const error = byId('conversation-list-error');
    loading.hidden = false; error.hidden = true;
    try {
      const result = await api('/api/messages');
      if (!result.response.ok) {
        loading.hidden = true;
        error.textContent = result.data.error || 'Inbox could not be loaded.';
        error.hidden = false;
        return false;
      }
      state.conversations = Array.isArray(result.data.conversations) ? result.data.conversations : [];
      loading.hidden = true;
      renderConversationList();
      return true;
    } catch (err) {
      loading.hidden = true; error.textContent = err.message || 'Inbox could not be loaded.'; error.hidden = false;
      return false;
    }
  }

  function renderMessage(message) {
    const own = message.senderId === state.currentUserId;
    const row = node('div', `dcm-message-row${own ? ' is-own' : ''}`);
    const bubble = node('div', 'dcm-message-bubble');
    bubble.append(node('div', 'dcm-message-body', message.body));
    bubble.append(node('span', 'dcm-message-meta', `${timeLabel(message.createdAt) || dateLabel(message.createdAt)}${own && message.readAt ? ' · Read' : ''}`));
    row.append(bubble);
    return row;
  }

  function renderMessages() {
    const list = byId('message-list');
    if (!state.messages.length) {
      list.replaceChildren();
      const empty = node('div', 'dcm-thread-empty', 'Your introduction is accepted. You can start with a simple hello, ask about an interest, or share what you are hoping to find.');
      list.append(empty);
      return;
    }
    let lastDate = '';
    const nodes = [];
    state.messages.forEach(message => {
      const date = dateLabel(message.createdAt);
      if (date && date !== lastDate) { nodes.push(node('span', 'dcm-day-divider', date)); lastDate = date; }
      nodes.push(renderMessage(message));
    });
    list.replaceChildren(...nodes);
    list.scrollTop = list.scrollHeight;
  }

  async function openConversation(introductionId, updateUrl = true) {
    const conversation = state.conversations.find(item => item.introductionId === introductionId);
    if (!conversation) return;
    state.selectedId = introductionId;
    state.selectedMember = conversation.member;
    byId('thread-placeholder').hidden = true;
    byId('thread-content').hidden = false;
    byId('thread-avatar').replaceChildren();
    const newAvatar = avatar(conversation.member?.name, conversation.member?.avatarUrl);
    byId('thread-avatar').replaceChildren(...newAvatar.childNodes);
    if (!newAvatar.childNodes.length) byId('thread-avatar').textContent = newAvatar.textContent;
    byId('thread-name').textContent = conversation.member?.name || 'Date Concierge member';
    byId('thread-location').textContent = conversation.member?.city ? `${conversation.member.city} · Accepted introduction` : 'Accepted introduction';
    byId('message-input').value = '';
    updateCount(); threadError('');
    document.body.classList.add('has-active-conversation');
    renderConversationList();
    if (updateUrl) history.replaceState(null, '', `/messages.html?introductionId=${encodeURIComponent(introductionId)}`);
    const list = byId('message-list');
    list.replaceChildren(node('p', 'dcm-list-state', 'Opening conversation…'));
    state.loadingThread = true;
    try {
      const result = await api(`/api/messages?introductionId=${encodeURIComponent(introductionId)}`);
      if (state.selectedId !== introductionId) return;
      if (!result.response.ok) throw new Error(result.data.error || 'Conversation could not be loaded.');
      state.messages = Array.isArray(result.data.messages) ? result.data.messages : [];
      renderMessages();
      const markResult = await api('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markRead', introductionId }) });
      if (markResult.response.ok) {
        conversation.unreadCount = 0;
        renderConversationList();
      }
    } catch (error) { if (state.selectedId === introductionId) threadError(error.message || 'Conversation could not be loaded.'); }
    finally { state.loadingThread = false; }
  }

  function updateCount() { byId('message-character-count').textContent = `${byId('message-input').value.length} / 2000`; }

  byId('message-input').addEventListener('input', updateCount);
  byId('message-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); byId('message-form').requestSubmit(); }
  });
  byId('message-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.selectedId || state.loadingThread) return;
    const input = byId('message-input');
    const message = input.value.trim();
    if (!message) return;
    const button = byId('send-message-button');
    button.disabled = true; button.textContent = 'Sending…'; threadError('');
    try {
      const result = await api('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ introductionId: state.selectedId, message }) });
      if (!result.response.ok) throw new Error(result.data.error || 'Message could not be sent.');
      state.messages.push(result.data.message);
      input.value = ''; updateCount(); renderMessages();
      const conv = state.conversations.find(item => item.introductionId === state.selectedId);
      if (conv) { conv.lastMessage = result.data.message.body; conv.lastMessageAt = result.data.message.createdAt; conv.lastMessageFromMe = true; }
      renderConversationList();
    } catch (error) { threadError(error.message || 'Message could not be sent.'); }
    finally { button.disabled = false; button.innerHTML = 'Send <span aria-hidden="true">↗</span>'; }
  });

  byId('conversation-search').addEventListener('input', renderConversationList);
  byId('messages-refresh').addEventListener('click', async () => {
    byId('messages-refresh').disabled = true;
    const previous = state.selectedId;
    try {
      const ok = await loadConversations();
      if (ok && previous && state.conversations.some(c => c.introductionId === previous)) await openConversation(previous, false);
    } finally { byId('messages-refresh').disabled = false; }
  });
  byId('messages-back').addEventListener('click', () => {
    document.body.classList.remove('has-active-conversation');
    history.replaceState(null, '', '/messages.html');
    state.selectedId = '';
  });
  byId('messages-logout').addEventListener('click', async () => {
    byId('messages-logout').disabled = true;
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }); }
    finally { window.location.replace('/'); }
  });

  async function boot() {
    try {
      const auth = await api('/api/auth/me');
      if (!auth.response.ok || !auth.data.authenticated) { window.location.replace('/?auth=login'); return; }
      state.currentUserId = auth.data.user?.id || '';
      const loading = byId('messages-loading');
      const result = await loadConversations();
      loading.hidden = true;
      byId('messages-workspace').hidden = false;
      if (!result) return;
      const requested = new URLSearchParams(window.location.search).get('introductionId');
      if (requested && state.conversations.some(c => c.introductionId === requested)) await openConversation(requested, false);
    } catch (error) { pageError(error.message || 'Could not open your messages.'); }
    finally { byId('messages-loading').hidden = true; }
  }
  boot();
})();
