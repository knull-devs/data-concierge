(() => {
  'use strict';
  const form = document.getElementById('profile-form');
  if (!form) return;
  const loading = document.getElementById('profile-loading');
  const app = document.getElementById('profile-app');
  const pageError = document.getElementById('profile-page-error');
  const notice = document.getElementById('profile-notice');
  const saveButton = document.getElementById('profile-save');
  const interestChecks = [...form.querySelectorAll('input[name="interests"]')];
  const preferenceChecks = [...form.querySelectorAll('input[name="interestedIn"]')];
  const interestLabels = {
    coffee_and_cafes: 'Cafés & coffee', travel: 'Travel', reading: 'Books & reading', live_music: 'Live music',
    cooking: 'Cooking', food_culture: 'Food culture', art_and_design: 'Art & design', fitness: 'Fitness',
    hiking_outdoors: 'Hiking & outdoors', movies_and_series: 'Movies & series', pets: 'Pets', volunteering: 'Volunteering',
    photography: 'Photography', cricket_and_sports: 'Cricket & sports', board_games: 'Board games', gardening: 'Gardening'
  };
  const fieldNames = ['city', 'headline', 'aboutMe', 'genderIdentity', 'relationshipGoal', 'interestedIn', 'ageRange', 'interests', 'discoverable'];
  let account = null;

  const showPageError = message => {
    loading.hidden = true;
    app.hidden = true;
    pageError.textContent = message;
    pageError.hidden = false;
  };
  const showNotice = (message, kind = '') => {
    notice.textContent = message;
    notice.className = `profile-notice${kind ? ` is-${kind}` : ''}`;
    notice.hidden = false;
  };
  const clearNotice = () => { notice.hidden = true; notice.textContent = ''; notice.className = 'profile-notice'; };
  const el = id => document.getElementById(id);

  function clearFieldErrors() {
    fieldNames.forEach(name => {
      const error = form.querySelector(`[data-error-for="${name}"]`);
      if (error) { error.hidden = true; error.textContent = ''; }
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute('aria-invalid'));
  }

  function showFieldErrors(errors = {}) {
    clearFieldErrors();
    Object.entries(errors).forEach(([name, message]) => {
      const error = form.querySelector(`[data-error-for="${name}"]`);
      if (error) { error.textContent = message; error.hidden = false; }
      const controls = name === 'ageRange'
        ? [el('age-min'), el('age-max')]
        : name === 'interestedIn'
          ? preferenceChecks
          : name === 'interests'
            ? interestChecks
            : [form.elements.namedItem(name)];
      controls.filter(Boolean).forEach(control => {
        if (control instanceof HTMLElement) control.setAttribute('aria-invalid', 'true');
      });
    });
  }

  function setCheckboxGroup(name, values) {
    const chosen = new Set(Array.isArray(values) ? values : []);
    form.querySelectorAll(`input[name="${name}"]`).forEach(input => { input.checked = chosen.has(input.value); });
  }

  function readForm() {
    return {
      city: form.elements.city.value,
      headline: form.elements.headline.value,
      aboutMe: form.elements.aboutMe.value,
      genderIdentity: form.elements.genderIdentity.value,
      interestedIn: preferenceChecks.filter(input => input.checked).map(input => input.value),
      relationshipGoal: form.elements.relationshipGoal.value,
      preferredAgeMin: form.elements.preferredAgeMin.value || null,
      preferredAgeMax: form.elements.preferredAgeMax.value || null,
      interests: interestChecks.filter(input => input.checked).map(input => input.value),
      discoverable: Boolean(form.elements.discoverable?.checked)
    };
  }

  function setCompletion(completion) {
    const percent = Math.max(0, Math.min(100, Number(completion?.percent) || 0));
    el('profile-progress').value = percent;
    el('profile-progress-number').textContent = `${percent}%`;
    el('profile-progress-copy').textContent = percent >= 100
      ? 'Your profile has the main details needed for thoughtful introductions.'
      : percent >= 60
        ? 'Good progress. A few more details can help clarify what matters to you.'
        : 'A few details help us understand what you are looking for.';
  }

  function updateCounts() {
    el('headline-count').textContent = String(form.elements.headline.value.length);
    el('about-count').textContent = String(form.elements.aboutMe.value.length);
    const count = interestChecks.filter(input => input.checked).length;
    el('interests-count').textContent = String(count);
    el('interests-limit-message').textContent = count >= 8 ? 'You have selected the maximum of 8 interests.' : 'Choose what you would enjoy talking about.';
    interestChecks.forEach(input => { input.disabled = count >= 8 && !input.checked; });
  }

  function updatePreview() {
    const data = readForm();
    el('preview-name').textContent = account?.name || 'Your name';
    el('preview-headline').textContent = data.headline.trim() || 'Your headline will appear here.';
    el('preview-about').textContent = data.aboutMe.trim() || 'A few honest details can help someone understand what matters to you.';
    el('preview-city').textContent = data.city.trim() || 'Your city';
    const target = el('preview-interests');
    target.replaceChildren();
    const labels = data.interests.map(value => interestLabels[value]).filter(Boolean);
    if (!labels.length) {
      const empty = document.createElement('span');
      empty.className = 'profile-preview-empty';
      empty.textContent = 'Your selected interests appear here.';
      target.append(empty);
      return;
    }
    labels.forEach(label => {
      const chip = document.createElement('span');
      chip.textContent = label;
      target.append(chip);
    });
  }

  function fillProfile(profile, user) {
    account = user || null;
    form.elements.city.value = profile.city || '';
    form.elements.headline.value = profile.headline || '';
    form.elements.aboutMe.value = profile.aboutMe || '';
    form.elements.genderIdentity.value = profile.genderIdentity || '';
    form.elements.relationshipGoal.value = profile.relationshipGoal || '';
    form.elements.preferredAgeMin.value = profile.preferredAgeMin ?? '';
    form.elements.preferredAgeMax.value = profile.preferredAgeMax ?? '';
    if (form.elements.discoverable) form.elements.discoverable.checked = profile.discoverable === true;
    setCheckboxGroup('interestedIn', profile.interestedIn);
    setCheckboxGroup('interests', profile.interests);
    updateCounts();
    updatePreview();
  }

  async function loadProfile() {
    try {
      const response = await fetch('/api/profile/me', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) throw new Error(data.error || 'Could not load your profile.');
      fillProfile(data.profile || {}, data.user || null);
      setCompletion(data.completion);
      loading.hidden = true;
      app.hidden = false;
    } catch (error) {
      showPageError(error.message || 'Could not load your profile. Please refresh and try again.');
    }
  }

  form.addEventListener('input', () => {
    clearNotice();
    updateCounts();
    updatePreview();
  });
  form.addEventListener('change', event => {
    clearNotice();
    if (event.target.name === 'interestedIn') {
      const everyone = preferenceChecks.find(input => input.value === 'everyone');
      if (event.target.value === 'everyone' && event.target.checked) preferenceChecks.filter(input => input !== event.target).forEach(input => { input.checked = false; });
      else if (event.target.value !== 'everyone' && event.target.checked && everyone) everyone.checked = false;
    }
    updateCounts();
    updatePreview();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearNotice();
    clearFieldErrors();
    const body = readForm();
    saveButton.disabled = true;
    saveButton.classList.add('profile-save-loading');
    saveButton.textContent = 'Saving…';
    try {
      const response = await fetch('/api/profile/me', {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.replace('/?auth=login'); return; }
      if (!response.ok) {
        if (data.errors) showFieldErrors(data.errors);
        throw new Error(data.error || 'Your profile could not be saved.');
      }
      fillProfile(data.profile || body, account);
      setCompletion(data.completion);
      showNotice('Your profile has been saved. You can return to update it any time.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      showNotice(error.message || 'Your profile could not be saved. Please try again.', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.classList.remove('profile-save-loading');
      saveButton.innerHTML = 'Save profile <span aria-hidden="true">↗</span>';
    }
  });

  loadProfile();
})();
