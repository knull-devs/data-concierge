(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const state = { acceptedIntros: [], plans: [], city: '' };
  const elem = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value != null) node.textContent = String(value); return node; };
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.replace('/?auth=login'); throw new Error('Your session has expired. Please sign in again.'); }
    return { response, data };
  }
  function showError(message) { byId('date-plans-error').textContent = message || 'Date plans could not be loaded.'; byId('date-plans-error').hidden = false; byId('date-plans-status').hidden = true; }
  function showStatus(message) { byId('date-plans-status').textContent = message; byId('date-plans-status').hidden = false; byId('date-plans-error').hidden = true; }
  function formatDate(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(date) : 'Date/time unavailable'; }
  function localInputValue(date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
  function configureDateBounds() {
    const input = byId('date-time'); const now = new Date();
    input.min = localInputValue(new Date(now.getTime() + 30 * 60 * 1000));
    input.max = localInputValue(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000));
  }
  function renderIntroOptions() {
    const select = byId('date-introduction'); select.replaceChildren();
    if (!state.acceptedIntros.length) {
      const option = elem('option', '', 'No accepted introductions available'); option.value = ''; select.append(option);
      byId('date-no-intros').hidden = false; byId('date-proposal-form').hidden = true; return;
    }
    byId('date-no-intros').hidden = true; byId('date-proposal-form').hidden = false;
    const placeholder = elem('option', '', 'Choose an introduction'); placeholder.value = ''; select.append(placeholder);
    state.acceptedIntros.forEach(item => { const option = elem('option', '', `${item.member?.name || 'Member'}${item.member?.city ? ` · ${item.member.city}` : ''}`); option.value = item.id; select.append(option); });
    if (state.city && !byId('date-city').value) byId('date-city').value = state.city;
  }
  function statusLabel(status) { return ({ pending: 'Awaiting response', accepted: 'Accepted by both', declined: 'Declined', cancelled: 'Cancelled', completed: 'Completed' })[status] || 'Updated'; }
  function actionButton(label, action, plan) {
    const button = elem('button', action === 'accept' ? 'mt-button mt-button-primary' : 'mt-button', label); button.type = 'button';
    button.addEventListener('click', () => runAction(plan, action, button));
    return button;
  }
  function renderPlan(plan) {
    const card = elem('article', 'mt-plan-card');
    const top = elem('div', 'mt-plan-top');
    const heading = elem('div'); heading.append(elem('h3', '', plan.venue || `Date in ${plan.city}`), elem('p', 'mt-plan-date', formatDate(plan.scheduledFor)));
    top.append(heading, elem('span', `mt-status-pill ${plan.status}`, statusLabel(plan.status)));
    const details = elem('div', 'mt-plan-details');
    details.append(elem('span', '', `♡  With ${plan.member?.name || 'your introduction'}`));
    details.append(elem('span', '', `⌖  ${plan.city}${plan.member?.city && plan.member.city !== plan.city ? ` · Member in ${plan.member.city}` : ''}`));
    if (plan.venue) details.append(elem('span', '', `⌂  ${plan.venue}`));
    details.append(elem('span', '', plan.proposedByMe ? 'You proposed this date' : 'Your introduction proposed this date'));
    card.append(top, details);
    if (plan.note) card.append(elem('p', 'mt-plan-note', plan.note));
    const actions = elem('div', 'mt-plan-actions');
    if (plan.status === 'pending' && !plan.proposedByMe) {
      actions.append(actionButton('Accept date', 'accept', plan), actionButton('Decline', 'decline', plan));
    } else if (plan.status === 'pending' && plan.proposedByMe) {
      actions.append(actionButton('Cancel proposal', 'cancel', plan));
    } else if (plan.status === 'accepted') {
      if (new Date(plan.scheduledFor).getTime() <= Date.now()) actions.append(actionButton('Mark completed', 'complete', plan));
      actions.append(actionButton('Cancel date', 'cancel', plan));
    }
    if (actions.childElementCount) card.append(actions);
    return card;
  }
  function renderPlans() {
    const list = byId('date-plans-list'); const empty = byId('date-plans-empty'); list.replaceChildren();
    if (!state.plans.length) { list.hidden = true; empty.hidden = false; return; }
    empty.hidden = true; list.hidden = false;
    state.plans.forEach(plan => list.append(renderPlan(plan)));
  }
  async function loadData() {
    byId('date-plans-loading').hidden = false; byId('date-plans-list').hidden = true; byId('date-plans-empty').hidden = true;
    try {
      const [introResult, planResult, accountResult] = await Promise.all([
        request('/api/introductions'), request('/api/date-plans'), request('/api/account/me')
      ]);
      if (!introResult.response.ok) throw new Error(introResult.data.error || 'Introductions could not be loaded.');
      if (!planResult.response.ok) throw new Error(planResult.data.error || 'Date planning setup is unavailable.');
      state.acceptedIntros = (Array.isArray(introResult.data.requests) ? introResult.data.requests : []).filter(item => item.status === 'accepted');
      state.plans = Array.isArray(planResult.data.plans) ? planResult.data.plans : [];
      if (accountResult.response.ok) state.city = accountResult.data.account?.city || '';
      renderIntroOptions(); renderPlans();
    } catch (error) { showError(error.message); }
    finally { byId('date-plans-loading').hidden = true; }
  }
  async function runAction(plan, action, button) {
    if (!plan?.id) return;
    button.disabled = true; const original = button.textContent; button.textContent = 'Updating…';
    try {
      const { response, data } = await request('/api/date-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: plan.id, action }) });
      if (!response.ok) throw new Error(data.error || 'Date proposal could not be updated.');
      showStatus(data.message || 'Date plan updated.'); await loadData();
    } catch (error) { showError(error.message); button.disabled = false; button.textContent = original; }
  }
  byId('date-proposal-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget; const button = byId('date-submit');
    const localDate = byId('date-time').value; const parsed = new Date(localDate);
    if (!localDate || !Number.isFinite(parsed.getTime())) { showError('Choose a valid date and time.'); return; }
    const payload = { introductionId: byId('date-introduction').value, scheduledFor: parsed.toISOString(), city: byId('date-city').value.trim(), venue: byId('date-venue').value.trim(), note: byId('date-note').value.trim() };
    button.disabled = true; button.textContent = 'Sending…';
    try {
      const { response, data } = await request('/api/date-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(data.error || 'Date proposal could not be sent.');
      byId('date-venue').value = ''; byId('date-note').value = ''; byId('date-time').value = ''; showStatus(data.message || 'Date proposal sent.'); await loadData();
    } catch (error) { showError(error.message); }
    finally { button.disabled = false; button.textContent = 'Send date proposal ↗'; }
  });
  byId('date-plans-refresh').addEventListener('click', loadData);
  configureDateBounds();
  loadData();
})();
