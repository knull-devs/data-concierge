(() => {
  'use strict';

  const notice = document.querySelector('.dc-preview-notice');
  const announce = (message) => {
    if (!notice) return;
    notice.textContent = message;
    notice.classList.add('is-visible');
    notice.setAttribute('role', 'status');
  };

  document.querySelectorAll('[data-preview-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      announce('UI preview only: form validation works in your browser, but authentication and account creation are not connected yet.');
      notice?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-preview-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      announce('This link is a UI placeholder in the static preview. It will be wired when the backend pages are integrated.');
      notice?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const dob = document.querySelector('#register-birth-date');
  if (dob) {
    const today = new Date();
    const latestBirthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    const yyyy = latestBirthDate.getFullYear();
    const mm = String(latestBirthDate.getMonth() + 1).padStart(2, '0');
    const dd = String(latestBirthDate.getDate()).padStart(2, '0');
    dob.max = `${yyyy}-${mm}-${dd}`;
  }
})();
