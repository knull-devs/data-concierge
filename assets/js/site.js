(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const modal = $('#auth-modal');
  const message = $('#auth-message');
  const nav = $('#primary-nav');
  const navToggle = $('#mobile-nav-toggle');
  const toast = $('#site-toast');
  let toastTimer;

  const announce = (text, kind = 'info') => {
    if (!message) return;
    message.textContent = text;
    message.dataset.kind = kind;
    message.classList.add('is-visible');
  };
  const clearMessage = () => {
    if (!message) return;
    message.textContent = '';
    message.classList.remove('is-visible');
    delete message.dataset.kind;
  };
  const showToast = (text) => {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3800);
  };
  const switchAuthTab = (tabName) => {
    const isRegister = tabName === 'register';
    $$('.auth-tab').forEach((tab) => {
      const active = tab.dataset.authTab === tabName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $$('.auth-view').forEach((view) => {
      const active = view.id === (isRegister ? 'register-view' : 'login-view');
      view.classList.toggle('is-active', active);
      view.hidden = !active;
    });
    $('#auth-title').innerHTML = isRegister ? 'Create your account<span>.</span>' : 'Welcome back<span>.</span>';
    $('#auth-subtitle').textContent = isRegister ? 'A thoughtful introduction starts with you.' : 'Sign in to continue your journey.';
    $('#login-password').autocomplete = 'current-password';
    clearMessage();
    const firstField = isRegister ? $('#register-name') : $('#login-email');
    setTimeout(() => firstField?.focus({ preventScroll: true }), 80);
  };
  const openAuth = (tabName = 'login') => {
    if (!modal) return;
    switchAuthTab(tabName);
    if (!modal.open) modal.showModal();
    document.body.classList.add('modal-open');
    nav?.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'Open navigation');
  };
  const closeAuth = () => {
    if (modal?.open) modal.close();
    document.body.classList.remove('modal-open');
    clearMessage();
  };

  $$('[data-auth-open]').forEach((button) => button.addEventListener('click', () => openAuth(button.dataset.authOpen)));
  $$('[data-auth-close]').forEach((button) => button.addEventListener('click', closeAuth));
  $$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => switchAuthTab(tab.dataset.authTab)));
  modal?.addEventListener('close', () => document.body.classList.remove('modal-open'));
  modal?.addEventListener('click', (event) => { if (event.target === modal) closeAuth(); });

  navToggle?.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    nav?.classList.toggle('is-open', open);
  });
  $$('#primary-nav a').forEach((link) => link.addEventListener('click', () => {
    nav?.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'Open navigation');
  }));
  $$('[data-password-toggle]').forEach((button) => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    button.textContent = reveal ? '◎' : '◉';
  }));
  $('[data-forgot-password]')?.addEventListener('click', () => announce('Password recovery is not enabled in this first release. We will add verified email recovery before public launch.', 'info'));
  $$('[data-auth-provider]').forEach((button) => button.addEventListener('click', () => {
    const provider = button.dataset.authProvider || 'This';
    announce(`${provider} sign-in is displayed as a preview and is not connected yet. Use email and password for this test build.`, 'info');
  }));

  const latestAllowedBirthDate = () => {
    const now = new Date();
    const year = now.getFullYear() - 18;
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const birthDate = $('#register-birth-date');
  if (birthDate) birthDate.max = latestAllowedBirthDate();

  async function submitAuthForm(form, endpoint, isRegistration) {
    if (!form.reportValidity()) return;
    const submit = $('button[type="submit"]', form);
    const originalText = submit?.innerHTML || '';
    if (submit) { submit.disabled = true; submit.textContent = isRegistration ? 'Creating your account…' : 'Signing you in…'; }
    clearMessage();
    try {
      const formData = new FormData(form);
      const payload = isRegistration ? {
        name: String(formData.get('name') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || ''),
        birthDate: String(formData.get('birthDate') || ''),
        city: String(formData.get('city') || ''),
        confirmAdult: $('#register-adult')?.checked === true,
        acceptTerms: $('#register-terms')?.checked === true
      } : {
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || ''),
        remember: formData.get('remember') === 'on'
      };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const text = result.error || (response.status === 503 ? 'Authentication is not configured yet. Add DATABASE_URL and install db/schema.sql before testing accounts.' : 'We could not complete that request. Please try again.');
        throw new Error(text);
      }
      announce(isRegistration ? 'Your account is ready. Taking you to your space…' : 'Welcome back. Opening your space…', 'success');
      if (result.user) setHeaderAuthenticated(result.user);
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 350);
    } catch (error) {
      announce(error.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      if (submit) { submit.disabled = false; submit.innerHTML = originalText; }
    }
  }
  $('#login-form')?.addEventListener('submit', (event) => { event.preventDefault(); submitAuthForm(event.currentTarget, '/api/auth/login', false); });
  $('#register-form')?.addEventListener('submit', (event) => { event.preventDefault(); submitAuthForm(event.currentTarget, '/api/auth/register', true); });

  const setHeaderAuthenticated = () => {
    $('.header-login')?.classList.add('is-hidden');
    $('.header-signup')?.classList.add('is-hidden');
    $('#header-dashboard')?.classList.remove('is-hidden');
  };
  fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((response) => response.ok ? response.json() : null)
    .then((result) => { if (result?.authenticated) setHeaderAuthenticated(result.user); })
    .catch(() => {});

  const params = new URLSearchParams(window.location.search);
  if (params.get('auth') === 'login' || params.get('auth') === 'register') {
    openAuth(params.get('auth'));
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
  }
  $('#current-year') && ($('#current-year').textContent = String(new Date().getFullYear()));

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -25px 0px' });
    $$('.reveal:not(.is-visible)').forEach((element) => observer.observe(element));
  } else {
    $$('.reveal').forEach((element) => element.classList.add('is-visible'));
  }
})();
